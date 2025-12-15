import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import * as mpesaController from '../controllers/mpesa.controller';
import { checkMembership } from '../middleware/membership.middleware';
import { MembershipRole } from '@prisma/client';

const router = Router();

/**
 * @swagger
 * /payments/stk-push:
 *   post:
 *     tags: [M-Pesa Payments]
 *     summary: Initiate STK push
 *     description: Initiates an M-Pesa STK (Sim Toolkit) push payment request to a user's phone
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - amount
 *               - contributionId
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "254712345678"
 *                 description: Phone number in format 254XXXXXXXXX
 *               amount:
 *                 type: number
 *                 example: 1000
 *                 minimum: 1
 *               contributionId:
 *                 type: string
 *                 example: cmdjw3rr50002cuhv9312yj79
 *                 description: The ID of the contribution record this payment is for
 *     responses:
 *       200:
 *         description: STK push initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Payment request sent to your phone
 *                 data:
 *                   type: object
 *                   properties:
 *                     CheckoutRequestID:
 *                       type: string
 *                       description: Use this to check payment status
 *                     MerchantRequestID:
 *                       type: string
 *                     ResponseCode:
 *                       type: string
 *       400:
 *         description: Invalid phone number or amount
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: M-Pesa service error
 */
router.post(
    '/stk-push',
    protect,
    mpesaController.initiateStkPushController
);

/**
 * @swagger
 * /payments/callback:
 *   post:
 *     tags: [M-Pesa Payments]
 *     summary: M-Pesa callback endpoint
 *     description: Webhook endpoint for M-Pesa to send payment confirmation. Not for direct use.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: M-Pesa callback payload
 *     responses:
 *       200:
 *         description: Callback received and processed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ResultCode:
 *                   type: integer
 *                   example: 0
 *                 ResultDesc:
 *                   type: string
 *                   example: Accepted
 */
router.post(
    '/callback',
    mpesaController.handleMpesaCallback
);

/**
 * @swagger
 * /payments/callback:
 *   get:
 *     tags: [M-Pesa Payments]
 *     summary: M-Pesa callback health check
 *     description: Handles M-Pesa's GET ping to verify callback URL is active
 *     responses:
 *       200:
 *         description: Callback endpoint is active
 */
router.all(
    '/callback',
    mpesaController.acknowledgeMpesaRequest
);

/**
 * @swagger
 * /payments/status/{checkoutRequestId}:
 *   get:
 *     tags: [M-Pesa Payments]
 *     summary: Check STK push status
 *     description: Queries the status of a previously initiated STK push payment
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: checkoutRequestId
 *         required: true
 *         schema:
 *           type: string
 *         description: Checkout request ID from STK push initiation
 *     responses:
 *       200:
 *         description: Payment status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     ResultCode:
 *                       type: string
 *                     ResultDesc:
 *                       type: string
 *                     ResponseCode:
 *                       type: string
 *                     ResponseDescription:
 *                       type: string
 *                     CheckoutRequestID:
 *                       type: string
 *                     MerchantRequestID:
 *                       type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Transaction not found
 */
router.get(
    '/status/:checkoutRequestId',
    protect,
    mpesaController.checkStkStatusController
);

/**
 * @swagger
 * /payments/b2c:
 *   post:
 *     tags: [M-Pesa Payments]
 *     summary: Disburse loan via B2C
 *     description: Sends money from business (chama) to customer (member) via M-Pesa B2C. Treasurer only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - amount
 *               - remarks
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "254712345678"
 *                 description: Recipient phone number in format 254XXXXXXXXX
 *               amount:
 *                 type: number
 *                 example: 50000
 *                 minimum: 10
 *               remarks:
 *                 type: string
 *                 example: Loan disbursement - December 2025
 *                 maxLength: 100
 *                 description: A description of the transaction
 *     responses:
 *       200:
 *         description: B2C transaction initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Disbursement initiated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     ConversationID:
 *                       type: string
 *                     OriginatorConversationID:
 *                       type: string
 *                     ResponseCode:
 *                       type: string
 *       400:
 *         description: Invalid request or insufficient balance
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Treasurer access required
 *       500:
 *         description: M-Pesa service error
 */
router.post(
    '/b2c',
    protect,
    checkMembership([MembershipRole.TREASURER]),
    mpesaController.disburseLoanB2CController
);

/**
 * @swagger
 * /payments/b2c-result:
 *   post:
 *     tags: [M-Pesa Payments]
 *     summary: B2C result callback
 *     description: Webhook endpoint for M-Pesa B2C transaction results. Not for direct use.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: M-Pesa B2C result payload
 *     responses:
 *       200:
 *         description: Result callback processed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ResultCode:
 *                   type: integer
 *                 ResultDesc:
 *                   type: string
 */
router.post('/b2c-result', mpesaController.handleB2CResultCallback);

/**
 * @swagger
 * /payments/b2c-timeout:
 *   post:
 *     tags: [M-Pesa Payments]
 *     summary: B2C timeout callback
 *     description: Webhook endpoint for M-Pesa B2C timeout notifications. Not for direct use.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: M-Pesa B2C timeout payload
 *     responses:
 *       200:
 *         description: Timeout callback processed
 */
router.post('/b2c-timeout', mpesaController.handleB2CTimeoutCallback);

/**
 * @swagger
 * /payments/transactions/{chamaId}:
 *   get:
 *     tags: [M-Pesa Payments]
 *     summary: Get M-Pesa transactions
 *     description: Returns all M-Pesa transactions for a chama. Admin/Treasurer only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chamaId
 *         required: true
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: transactionType
 *         schema:
 *           type: string
 *           enum: [C2B, B2C]
 *         description: Filter by transaction type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, COMPLETED, FAILED, CANCELLED]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Transactions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: cmdjw3rr50002cuhv9312yj79
 *                       transactionType:
 *                         type: string
 *                         enum: [C2B, B2C]
 *                       amount:
 *                         type: number
 *                       phoneNumber:
 *                         type: string
 *                       mpesaReceiptNumber:
 *                         type: string
 *                       status:
 *                         type: string
 *                       accountReference:
 *                         type: string
 *                       transactionDate:
 *                         type: string
 *                         format: date-time
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalInflow:
 *                       type: number
 *                     totalOutflow:
 *                       type: number
 *                     netAmount:
 *                       type: number
 *                 pagination:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin or Treasurer access required
 */
router.get(
    '/transactions/:chamaId',
    protect,
    checkMembership([MembershipRole.ADMIN, MembershipRole.TREASURER]),
    mpesaController.getMpesaTransactionsController
);

export default router;