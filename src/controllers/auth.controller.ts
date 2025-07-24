import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

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
export const getProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
export const updateProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

// ---TODO--- Password Reset and other functions to be added ---
// We'll add forgotPassword, resetPassword, and refreshToken here later.