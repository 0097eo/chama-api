import { Request, Response, NextFunction } from 'express'; 
import * as authService from '../services/auth.service';
import { isErrorWithMessage } from '../utils/error.utils';

// POST /api/auth/register
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.registerUser(req.body);
    res.status(201).json({ success: true, message: 'User registered successfully', data: user });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/login
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const data = await authService.loginUser(email, password);
    res.status(200).json({ success: true, message: 'Login successful', data });
  } catch (error) {
    next(error);
  }
};

// GET /api/auth/profile
export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    const userProfile = await authService.getUserProfile(userId);
    res.status(200).json({ success: true, data: userProfile });
  } catch (error) {
    next(error);
  }
};

// PUT /api/auth/profile
export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }
        const updatedUser = await authService.updateUserProfile(userId, req.body);
        res.status(200).json({ success: true, message: 'Profile updated successfully', data: updatedUser });
    } catch (error) {
        next(error);
    }
};

// POST /api/auth/verify-email
export const verifyEmail = async (req: Request, res: Response) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ message: 'Token is required.' });
        await authService.verifyUserEmail(token);
        res.status(200).json({ message: 'Email verified successfully. You can now log in.' });
    } catch (error) {
        if(isErrorWithMessage(error)) return res.status(400).json({ message: error.message });
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

// POST /api/auth/forgot-password
export const forgotPassword = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: 'Email is required.' });
        await authService.requestPasswordReset(email);
        res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    } catch (error) {
        if(isErrorWithMessage(error)) return res.status(500).json({ message: error.message });
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

// POST /api/auth/reset-password
export const resetPassword = async (req: Request, res: Response) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) return res.status(400).json({ message: 'Token and new password are required.' });
        await authService.resetUserPassword(token, password);
        res.status(200).json({ message: 'Password has been reset successfully.' });
    } catch (error) {
        if(isErrorWithMessage(error)) return res.status(400).json({ message: error.message });
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};