import axios from 'axios';
import { format } from 'date-fns';
import { PrismaClient } from '../generated/prisma';
import { isErrorWithMessage } from '../utils/error.utils';

const prisma = new PrismaClient();

// This is an in-memory cache. In a real production app, you might use Redis.
let mpesaToken: { token: string; expires: Date } | null = null;

/**
 * Generates or retrieves a cached M-Pesa Daraja API access token.
 * This function is based on the "Authorization API" documentation.
 */
const getAccessToken = async (): Promise<string> => {
    if (mpesaToken && mpesaToken.expires > new Date()) {
        return mpesaToken.token;
    }

    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    const baseURL = process.env.MPESA_API_BASE_URL;

    if (!consumerKey || !consumerSecret || !baseURL) {
        throw new Error('M-Pesa environment variables are not configured.');
    }

    const url = `${baseURL}/oauth/v1/generate?grant_type=client_credentials`;
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

    try {
        const response = await axios.get(url, {
            headers: {
                Authorization: `Basic ${auth}`,
            },
        });

        const token = response.data.access_token;
        const expiresIn = response.data.expires_in; // Typically 3599 seconds

        const expires = new Date().getTime() + (expiresIn - 60) * 1000;
        mpesaToken = { token, expires: new Date(expires) };

        return token;
    } catch (error) {
        if (axios.isAxiosError(error)) {
             console.error('M-Pesa Auth Error:', error.response?.data || error.message);
        } else {
            console.error('M-Pesa Auth Error:', error);
        }
        throw new Error('Failed to obtain M-Pesa access token.');
    }
};

/**
 * Initiates an M-Pesa STK Push request.
 * This function is based on the "LIPA NA MPESA (STKPUSH) API" documentation.
 * @param phone - The customer's phone number in 254... format.
 * @param amount - The amount to be paid.
 * @param contributionId - The ID of the contribution record this payment is for.
 * @returns The response from the Daraja API.
 */
export const initiateStkPush = async (phone: string, amount: number, contributionId: string) => {
    const token = await getAccessToken();

    const shortCode = process.env.MPESA_BUSINESS_SHORT_CODE!;
    const passkey = process.env.MPESA_PASSKEY!;
    const callbackURL = process.env.MPESA_CALLBACK_URL!;
    const baseURL = process.env.MPESA_API_BASE_URL!;
    
    const timestamp = format(new Date(), 'yyyyMMddHHmmss');
    const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');

    const payload = {
        BusinessShortCode: shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: process.env.MPESA_TRANSACTION_TYPE!,
        Amount: amount,
        PartyA: phone,
        PartyB: shortCode,
        PhoneNumber: phone,
        CallBackURL: callbackURL,
        AccountReference: "ChamaContribution",
        TransactionDesc: `Payment for contribution ID ${contributionId}`,
    };

    const url = `${baseURL}/mpesa/stkpush/v1/processrequest`;
    
    try {
        const response = await axios.post(url, payload, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
            
        });

        const checkoutRequestId = response.data.CheckoutRequestID;
        if (checkoutRequestId) {
            await prisma.contribution.update({
                where: { id: contributionId },
                data: { mpesaCheckoutId: checkoutRequestId },
            });
        }

        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response?.data) {
            // Re-throw the specific error message from Safaricom
            throw new Error(JSON.stringify(error.response.data));
        } else if (isErrorWithMessage(error)) {
            throw new Error(error.message);
        }
        throw new Error('Failed to initiate M-Pesa STK Push.');
    }
};