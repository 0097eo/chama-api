import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import * as mpesaController from '../controllers/mpesa.controller';
import { checkMembership } from '../middleware/membership.middleware';
import { MembershipRole } from '../generated/prisma';

const router = Router();

// STK Push initiation (protected)
router.post(
    '/stk-push',
    protect,
    mpesaController.initiateStkPushController
);

// This will handle the POST request from a real transaction callback
router.post(
    '/callback',
    mpesaController.handleMpesaCallback
);

// This will handle ANY other request type (like the GET ping from Safaricom)
// to the same URL, preventing the 500 error.
router.all(
    '/callback',
    mpesaController.acknowledgeMpesaRequest
);

// This will check the status of teh STK push
router.get(
    '/status/:checkoutRequestId',
    protect,
    mpesaController.checkStkStatusController
);

// Disburse a loan via M-Pesa B2C
router.post(
    '/b2c',
    protect,
    // Add a middleware to check if the user is a Treasurer
    mpesaController.disburseLoanB2CController
);

// Add B2C callback handlers
router.post('/b2c-result', mpesaController.handleB2CResultCallback);
router.post('/b2c-timeout', mpesaController.handleB2CTimeoutCallback);

//Get M-Pesa transactions for a chama
router.get(
    '/transactions/:chamaId',
    protect,
    checkMembership([MembershipRole.ADMIN, MembershipRole.TREASURER]),
    mpesaController.getMpesaTransactionsController
);

export default router;