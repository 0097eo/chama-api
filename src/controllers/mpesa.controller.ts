import { Request, Response } from 'express';
import * as mpesaService from '../services/mpesa.service';
import { isErrorWithMessage } from '../utils/error.utils';
import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

interface AuthenticatedRequest extends Request {
    user?: { id: string };
}

export const initiateStkPushController = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { amount, phone, contributionId } = req.body;
        const userId = req.user?.id;

        if (!amount || !phone || !contributionId) {
            return res.status(400).json({ message: 'Amount, phone, and contributionId are required.' });
        }

        const contribution = await prisma.contribution.findUnique({
            where: { id: contributionId },
            include: { membership: true }
        });

        if (!contribution || contribution.membership.userId !== userId) {
            return res.status(403).json({ message: "Permission Denied: You can only pay for your own contributions." });
        }
        if (contribution.status === 'PAID') {
            return res.status(409).json({ message: "This contribution has already been paid." });
        }

        const response = await mpesaService.initiateStkPush(phone, amount, contributionId);
        
        res.status(200).json({ message: 'STK Push initiated successfully. Please check your phone.', data: response });

    } catch (error) {
        if(isErrorWithMessage(error)) return res.status(500).json({ message: error.message });
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const handleMpesaCallback = async (req: Request, res: Response) => {
    console.log('--- M-PESA CALLBACK RECEIVED ---');
    console.log(JSON.stringify(req.body, null, 2));

    // Acknowledge the request to Safaricom immediately
    res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });

    // --- Process the data asynchronously after responding ---
    try {
        if (!req.body.Body || !req.body.Body.stkCallback) {
            throw new Error('Invalid M-Pesa callback structure');
        }

        const callbackData = req.body.Body.stkCallback;
        const resultCode = callbackData.ResultCode;
        const checkoutRequestId = callbackData.CheckoutRequestID;

        if (resultCode === 0) {
            // Payment Success
            const metadata = callbackData.CallbackMetadata.Item;
            const mpesaReceiptNumber = metadata.find((item: any) => item.Name === 'MpesaReceiptNumber')?.Value;
            
            const updateResult = await prisma.contribution.updateMany({
                where: { mpesaCheckoutId: checkoutRequestId },
                data: {
                    status: 'PAID',
                    mpesaCode: mpesaReceiptNumber,
                    paidAt: new Date(),
                    paymentMethod: 'M-PESA',
                },
            });
            if (updateResult.count > 0) {
                 console.log(`Successfully updated contribution with Checkout ID ${checkoutRequestId} as PAID.`);
            } else {
                console.warn(`No contribution found for Checkout ID ${checkoutRequestId}.`);
            }
        } else {
            // Payment Failed or Canceled
            const resultDesc = callbackData.ResultDesc;
            console.log(`M-Pesa transaction failed for ${checkoutRequestId}. Reason: ${resultDesc}`);
        }
    } catch (error) {
        console.error('Error processing M-Pesa callback asynchronously:', error);
    }
};


export const acknowledgeMpesaRequest = (req: Request, res: Response) => {
    console.log('--- SAFARICOM PING RECEIVED ---');
    res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
};
