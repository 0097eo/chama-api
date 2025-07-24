import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';
import { handleValidationErrors, authRateLimiter } from '../middleware/validation.middleware';
import { registerValidator, loginValidator, profileUpdateValidator } from '../utils/validators';

const router = Router();

// --- PUBLIC ROUTES ---
router.post('/register', authRateLimiter, ...registerValidator, handleValidationErrors, authController.register);
router.post('/login', authRateLimiter, ...loginValidator, handleValidationErrors, authController.login);

// --- MIDDLEWARE GATE ---
router.use(protect);

// --- PROTECTED ROUTES ---
router.get('/profile', authController.getProfile);
router.put('/profile', ...profileUpdateValidator, handleValidationErrors, authController.updateProfile);

export default router;