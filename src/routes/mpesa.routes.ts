import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import * as mpesaController from '../controllers/mpesa.controller';

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

export default router;