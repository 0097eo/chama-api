import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';
import { handleValidationErrors, authRateLimiter } from '../middleware/validation.middleware';
import { registerValidator, loginValidator, profileUpdateValidator } from '../validators/user.validators';

const router = Router();

// --- PUBLIC ROUTES ---
router.post('/register', authRateLimiter, ...registerValidator, handleValidationErrors, authController.register);
router.post('/login', authRateLimiter, ...loginValidator, handleValidationErrors, authController.login);
router.post('/verify-email', authController.verifyEmail);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// --- MIDDLEWARE GATE ---
router.use(protect);

// --- PROTECTED ROUTES ---
router.get('/profile', authController.getProfile);
router.put('/profile', ...profileUpdateValidator, handleValidationErrors, authController.updateProfile);

export default router;