import axios from 'axios';
import { format } from 'date-fns';
import { PrismaClient } from '@prisma/client';
import { isErrorWithMessage } from '../utils/error.utils';
import logger from '../config/logger'; // Import Pino logger

const prisma = new PrismaClient();

// This is an in-memory cache. In a real production app, you might use Redis.
let mpesaToken: { token: string; expires: Date } | null = null;

/**
 * Generates or retrieves a cached M-Pesa Daraja API access token.
 * This function is based on the "Authorization API" documentation.
 */
const getAccessToken = async (): Promise<string> => {
    if (mpesaToken && mpesaToken.expires > new Date()) {
        logger.debug('Using cached M-Pesa access token');
        return mpesaToken.token;
    }

    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    const baseURL = process.env.MPESA_API_BASE_URL;

    if (!consumerKey || !consumerSecret || !baseURL) {
        logger.error('M-Pesa environment variables not configured');
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

        logger.info({ expiresIn }, 'M-Pesa access token obtained');
        return token;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            logger.error({ error: error.response?.data || error.message }, 'M-Pesa auth error');
        } else {
            logger.error({ error }, 'M-Pesa auth error');
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
    const callbackURL = `${process.env.MPESA_CALLBACK_URL}/api/payments/callback`;
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
        logger.info({ phone, amount, contributionId }, 'Initiating STK push');
        
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
            logger.info({ checkoutRequestId, contributionId }, 'STK push initiated successfully');
        }

        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response?.data) {
            logger.error({ error: error.response.data, phone, amount, contributionId }, 'STK push failed');
            throw new Error(JSON.stringify(error.response.data));
        } else if (isErrorWithMessage(error)) {
            logger.error({ error: error.message, phone, amount, contributionId }, 'STK push failed');
            throw new Error(error.message);
        }
        logger.error({ error, phone, amount, contributionId }, 'STK push failed');
        throw new Error('Failed to initiate M-Pesa STK Push.');
    }
};

/**
 * Queries the status of a previously initiated M-Pesa STK Push transaction.
 * @params checkoutRequestId - The ID of the checkout request to query.
 * @returns The response from the Daraja API.
 */

export const queryStkStatus = async (checkoutRequestId: string) => {
    const token = await getAccessToken();
    const shortCode = process.env.MPESA_BUSINESS_SHORT_CODE!;
    const baseURL = process.env.MPESA_API_BASE_URL!;
    const passkey = process.env.MPESA_PASSKEY!;
    const timestamp = format(new Date(), 'yyyyMMddHHmmss');
    const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');

    const payload = {
        BusinessShortCode: shortCode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
    };

    try {
        logger.debug({ checkoutRequestId }, 'Querying STK push status');
        
        const response = await axios.post(`${baseURL}/mpesa/stkpushquery/v1/query`, payload, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
        
        logger.info({ checkoutRequestId, resultCode: response.data.ResultCode }, 'STK push status queried');
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response?.data) {
            logger.error({ error: error.response.data, checkoutRequestId }, 'STK push query error');
            throw new Error(JSON.stringify(error.response.data));
        } else if (isErrorWithMessage(error)) {
            logger.error({ error: error.message, checkoutRequestId }, 'STK push query error');
            throw new Error(error.message);
        }
        logger.error({ error, checkoutRequestId }, 'STK push query error');
        throw new Error('Failed to query M-Pesa STK Push status.');
    }
}

/**
 * Initiates a B2C payment to a mobile number.
 * NOTE: B2C requires a seperate, more stringent approval from Safaricom.
 * @param phone - The recipient's phone number in 254... format.
 * @param amount - The amount to be sent.
 * @param remarks - A description of the transaction.
 * @return The response from the Daraja API.
 */

export const initiateB2CPayment = async (phone: string, amount: number, remarks: string) => {
    const token = await getAccessToken();
    const shortCode = process.env.MPESA_BUSINESS_SHORT_CODE!;
    const baseURL = process.env.MPESA_API_BASE_URL!;

    //NOTE: For B2C, you need different credentials: an initiator name and security credential.
    const initiatorName = process.env.MPESA_B2C_INITIATOR_NAME!;
    const securityCredential = process.env.MPESA_B2C_SECURITY_CREDENTIAL!;

    const payload = {
        InitiatorName: initiatorName,
        SecurityCredential: securityCredential,
        CommandID: 'BusinessPayment',
        Amount: amount,
        PartyA: shortCode,
        PartyB: phone,
        Remarks: remarks,
        QueueTimeOutURL: `${process.env.MPESA_CALLBACK_URL}/api/payments/b2c-timeout`,
        ResultURL: `${process.env.MPESA_CALLBACK_URL}/api/payments/b2c-result`,
        Occassion: `Payment to ${phone}`,
    }

    try {
        logger.info({ phone, amount, remarks }, 'Initiating B2C payment');
        
        const response = await axios.post(`${baseURL}/mpesa/b2c/v1/paymentrequest`, payload, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        logger.info({ 
            phone, 
            amount, 
            conversationId: response.data.ConversationID 
        }, 'B2C payment initiated successfully');
        
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response?.data) {
            logger.error({ error: error.response.data, phone, amount }, 'B2C payment error');
            throw new Error(JSON.stringify(error.response.data));
        } else if (isErrorWithMessage(error)) {
            logger.error({ error: error.message, phone, amount }, 'B2C payment error');
            throw new Error(error.message);
        }
        logger.error({ error, phone, amount }, 'B2C payment error');
        throw new Error('Failed to initiate M-Pesa B2C payment.');
    }
}