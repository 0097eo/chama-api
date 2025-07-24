import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';
import { registerValidator,loginValidator, profileUpdateValidator } from '../utils/validators';
import { handleValidationErrors, authRateLimiter } from '../middleware/validation.middleware';
import {
    passwordResetValidator,
    resetPasswordConfirmationValidator
} from '../utils/validators';


const router = Router();

// --- Public Routes ---
// Apply rate limiter to sensitive public endpoints
router.post(
  '/register',
  authRateLimiter,
  registerValidator,
  handleValidationErrors,
  authController.register
);

router.post(
  '/login',
  authRateLimiter,
  loginValidator,
  handleValidationErrors,
  authController.login
);

// --- Protected Routes ---
// The 'protect' middleware will be applied to all routes below this point
router.use(protect);

router.get('/profile', authController.getProfile);
router.put(
  '/profile',
  profileUpdateValidator,
  handleValidationErrors,
  authController.updateProfile
);

// ---TODO--- Placeholder routes to be implemented ---
// router.post('/refresh', authController.refreshToken);
// router.post('/forgot-password', passwordResetValidator, handleValidationErrors, authController.forgotPassword);
// router.post('/reset-password', resetPasswordConfirmationValidator, handleValidationErrors, authController.resetPassword);

export default router;