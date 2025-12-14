import { Request, Response, NextFunction } from 'express'; 
import * as authService from '../services/auth.service';
import { isErrorWithMessage } from '../utils/error.utils';
import logger from '../config/logger';

// POST /api/auth/register
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, phoneNumber } = req.body;
    
    logger.debug({ email, phoneNumber }, 'User registration attempt');
    
    const user = await authService.registerUser(req.body);
    
    logger.info({ 
      userId: user.id, 
      email: user.email 
    }, 'User registered successfully');
    
    res.status(201).json({ success: true, message: 'User registered successfully', data: user });
  } catch (error) {
    logger.error({ 
      error, 
      email: req.body.email 
    }, 'User registration failed');
    next(error);
  }
};

// POST /api/auth/login
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    
    logger.debug({ email }, 'User login attempt');
    
    const data = await authService.loginUser(email, password);
    
    logger.info({ 
      userId: data.user?.id, 
      email 
    }, 'User logged in successfully');
    
    res.status(200).json({ success: true, message: 'Login successful', data });
  } catch (error) {
    logger.error({ 
      error, 
      email: req.body.email 
    }, 'User login failed');
    next(error);
  }
};

// GET /api/auth/profile
export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      logger.warn('Profile access attempt without authentication');
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    
    logger.debug({ userId }, 'Fetching user profile');
    
    const userProfile = await authService.getUserProfile(userId);
    
    logger.info({ userId }, 'User profile retrieved successfully');
    
    res.status(200).json({ success: true, data: userProfile });
  } catch (error) {
    logger.error({ 
      error, 
      userId: req.user?.id 
    }, 'Error fetching user profile');
    next(error);
  }
};

// PUT /api/auth/profile
export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      logger.warn('Profile update attempt without authentication');
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    
    const updateFields = Object.keys(req.body);
    logger.debug({ 
      userId, 
      updateFields 
    }, 'Updating user profile');
    
    const updatedUser = await authService.updateUserProfile(userId, req.body);
    
    logger.info({ 
      userId, 
      updateFields 
    }, 'User profile updated successfully');
    
    res.status(200).json({ success: true, message: 'Profile updated successfully', data: updatedUser });
  } catch (error) {
    logger.error({ 
      error, 
      userId: req.user?.id, 
      updateFields: Object.keys(req.body) 
    }, 'Error updating user profile');
    next(error);
  }
};

// POST /api/auth/verify-email
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      logger.warn('Email verification attempt without token');
      return res.status(400).json({ message: 'Token is required.' });
    }
    
    logger.debug({ tokenLength: token?.length }, 'Email verification attempt');
    
    await authService.verifyUserEmail(token);
    
    logger.info('Email verified successfully');
    
    res.status(200).json({ message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    logger.error({ error }, 'Email verification failed');
    
    if (isErrorWithMessage(error)) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'An unexpected error occurred.' });
  }
};

// POST /api/auth/forgot-password
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      logger.warn('Forgot password attempt without email');
      return res.status(400).json({ message: 'Email is required.' });
    }
    
    logger.debug({ email }, 'Password reset requested');
    
    await authService.requestPasswordReset(email);
    
    logger.info({ email }, 'Password reset email sent (if account exists)');
    
    res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });
  } catch (error) {
    logger.error({ 
      error, 
      email: req.body.email 
    }, 'Error processing forgot password request');
    
    if (isErrorWithMessage(error)) {
      return res.status(500).json({ message: error.message });
    }
    res.status(500).json({ message: 'An unexpected error occurred.' });
  }
};

// POST /api/auth/reset-password
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      logger.warn('Password reset attempt with missing token or password');
      return res.status(400).json({ message: 'Token and new password are required.' });
    }
    
    logger.debug({ tokenLength: token?.length }, 'Password reset attempt');
    
    await authService.resetUserPassword(token, password);
    
    logger.info('Password reset successfully');
    
    res.status(200).json({ message: 'Password has been reset successfully.' });
  } catch (error) {
    logger.error({ error }, 'Password reset failed');
    
    if (isErrorWithMessage(error)) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'An unexpected error occurred.' });
  }
};