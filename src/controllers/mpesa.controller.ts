import { Request, Response } from 'express';
import * as mpesaService from '../services/mpesa.service';
import { isErrorWithMessage } from '../utils/error.utils';
import { PrismaClient } from '@prisma/client';
import { MembershipRole } from '@prisma/client';
import { LoanStatus, TransactionType } from '@prisma/client';
import { addMonths } from 'date-fns';

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

export const checkStkStatusController = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { checkoutRequestId } = req.params;
        const actorId = req.user?.id;
        if (!actorId) return res.status(401).json({ message: 'User not authenticated' });

        // Permission check: ensure the user requesting the status belongs to the chama of the contribution
        const contribution = await prisma.contribution.findFirst({
            where: { mpesaCheckoutId: checkoutRequestId },
            include: { membership: true }
        });
        if (!contribution) {
            return res.status(404).json({ message: 'Transaction not found for the given Checkout Request ID.' });
        }

        const isMember = await prisma.membership.findFirst({
            where: { userId: actorId, chamaId: contribution.membership.chamaId }
        });
        if (!isMember) {
            return res.status(403).json({ message: 'Permission Denied: You are not a member of the chama this transaction belongs to.' });
        }

        const response = await mpesaService.queryStkStatus(checkoutRequestId);
        res.status(200).json({ data: response });

    } catch (error) {
        if(isErrorWithMessage(error)) return res.status(500).json({ message: error.message });
        res.status(500).json({ message: 'An unexpected error occurred while checking transaction status.' });
    }
};

export const disburseLoanB2CController = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { loanId, phone, amount, remarks } = req.body;
        const actorId = req.user?.id;
        if (!actorId) return res.status(401).json({ message: 'User not authenticated' });
        
        // Permission Check: User must be a Treasurer of the chama this loan belongs to
        const loan = await prisma.loan.findUnique({ where: { id: loanId }, include: { membership: true }});
        if (!loan) return res.status(404).json({ message: "Loan not found." });

        const isTreasurer = await prisma.membership.findFirst({
            where: { userId: actorId, chamaId: loan.membership.chamaId, role: MembershipRole.TREASURER }
        });
        if (!isTreasurer) {
            return res.status(403).json({ message: "Permission Denied: Only the treasurer can disburse loans via M-Pesa." });
        }
        
        const response = await mpesaService.initiateB2CPayment(phone, amount, remarks);

        // Link the B2C request to the loan for tracking
        await prisma.loan.update({
            where: { id: loanId },
            data: { mpesaB2CRequestId: response.ConversationID }
        });

        res.status(200).json({ message: 'B2C disbursement initiated.', data: response });
    } catch (error) {
        if(isErrorWithMessage(error)) return res.status(500).json({ message: error.message });
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const handleB2CResultCallback = async (req: Request, res: Response) => {
    console.log('--- M-PESA B2C RESULT CALLBACK ---');
    console.log(JSON.stringify(req.body, null, 2));

    // Acknowledge the request to Safaricom immediately to prevent timeouts
    res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });

    try {
        const result = req.body.Result;
        if (!result) {
            throw new Error("Invalid B2C callback structure: Missing 'Result' object.");
        }

        const resultCode = result.ResultCode;
        const conversationID = result.ConversationID;

        // Find the loan via the ConversationID
        const loan = await prisma.loan.findFirst({
            where: { mpesaB2CRequestId: conversationID },
            include: { membership: true }
        });

        if (!loan) {
            console.warn(`No loan found for B2C ConversationID: ${conversationID}. Ignoring callback.`);
            return;
        }

        //If the ResultCode is 0 (success), update the loan status
        if (resultCode === 0) {
            // Get details from the callback metadata
            const resultParameters = result.ResultParameters.ResultParameter;
            const transactionAmount = resultParameters.find((p: any) => p.Key === 'TransactionAmount')?.Value;
            const transactionReceipt = resultParameters.find((p: any) => p.Key === 'TransactionReceipt')?.Value;
            
            await prisma.$transaction(async (tx) => {
                // Update the loan status to ACTIVE
                await tx.loan.update({
                    where: { id: loan.id },
                    data: {
                        status: LoanStatus.ACTIVE,
                        disbursedAt: new Date(),
                        dueDate: addMonths(new Date(), 1) // Set the first repayment date
                    }
                });

                // Create a LOAN_DISBURSEMENT transaction for the chama's books
                await tx.transaction.create({
                    data: {
                        chamaId: loan.membership.chamaId,
                        type: TransactionType.LOAN_DISBURSEMENT,
                        amount: -transactionAmount, // Negative amount as money is going out
                        description: `Loan disbursed to member. M-Pesa Receipt: ${transactionReceipt}`
                    }
                });
            });

            console.log(`Successfully processed B2C payment for loan ${loan.id}. Status set to ACTIVE.`);
            // TODO: Send a success notification (email/SMS) to the member.

        } else {
            // Handle failed B2C transaction
            const resultDesc = result.ResultDesc;
            console.error(`B2C disbursement failed for loan ${loan.id}. Reason: ${resultDesc}`);
        }

    } catch (error) {
        console.error('Error processing M-Pesa B2C callback asynchronously:', error);
    }
};

export const handleB2CTimeoutCallback = async (req: Request, res: Response) => {
    console.log('--- M-PESA B2C TIMEOUT CALLBACK ---');
    console.log(JSON.stringify(req.body, null, 2));

    // Acknowledge the request
    res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });

    // Process the timeout asynchronously
    try {
        const result = req.body.Result;
        if (!result) {
            throw new Error("Invalid B2C timeout callback structure.");
        }
        
        const conversationID = result.ConversationID;

        // Find the loan via the ConversationID
        const loan = await prisma.loan.findFirst({
            where: { mpesaB2CRequestId: conversationID }
        });

        if (!loan) {
            console.warn(`Timeout callback received for an unknown ConversationID: ${conversationID}`);
            return;
        }

        // revert the loan status back to APPROVED so the treasurer can try again.
        await prisma.loan.update({
            where: { id: loan.id },
            data: {
                status: LoanStatus.APPROVED, // Revert status
                mpesaB2CRequestId: null, // Clear the request ID for a retry
            }
        });
        
        console.log(`B2C disbursement for loan ${loan.id} timed out. Loan status reverted to APPROVED for retry.`);
        // TODO: Notify the treasurer that the disbursement timed out and needs to be re-initiated.

    } catch (error) {
        console.error('Error processing M-Pesa B2C timeout callback asynchronously:', error);
    }
};

export const getMpesaTransactionsController = async (req: Request, res: Response) => {
    // Note: Permission for this is already handled by the checkMembership middleware in the routes file.
    const { chamaId } = req.params;
    
    // Fetch all contributions paid via M-Pesa
    const contributions = await prisma.contribution.findMany({
        where: { 
            membership: { chamaId }, 
            mpesaCode: { not: null } 
        },
        include: {
            membership: {
                select: { user: { select: { firstName: true, lastName: true }}}
            }
        }
    });

    // Fetch all loans disbursed via M-Pesa B2C
    const loanDisbursements = await prisma.loan.findMany({
        where: { 
            membership: { chamaId }, 
            mpesaB2CRequestId: { not: null }
        },
        include: {
            membership: {
                select: { user: { select: { firstName: true, lastName: true }}}
            }
        }
    });

    res.status(200).json({ data: { contributions, loanDisbursements }});
};