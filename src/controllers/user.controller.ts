import { Request, Response, NextFunction } from 'express';
import * as userService from '../services/user.service';
import { PrismaClient } from '../generated/prisma'; // Import PrismaClient

const prisma = new PrismaClient(); // Create an instance to use

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = parseInt(req.query.limit as string, 10) || 10;
        const { users, totalRecords, totalPages } = await userService.getAllUsers(page, limit);
        res.status(200).json({ success: true, data: users, meta: { page, limit, totalRecords, totalPages } });
    } catch (error) { next(error); }
};
export const getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await userService.getUserById(req.params.id);
        if (!user) { return res.status(404).json({ success: false, message: 'User not found' }); }
        res.status(200).json({ success: true, data: user });
    } catch (error) { next(error); }
};
export const update = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const adminUserId = req.user!.id;
        const targetUserId = req.params.id;
        const updatedUser = await userService.updateUser(adminUserId, targetUserId, req.body);
        res.status(200).json({ success: true, message: 'User updated successfully', data: updatedUser });
    } catch (error) { next(error); }
};
export const remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const adminUserId = req.user!.id;
        const targetUserId = req.params.id;
        await userService.softDeleteUser(adminUserId, targetUserId);
        res.status(200).json({ success: true, message: 'User deleted successfully' });
    } catch (error) { next(error); }
};

/**
 * Controller to send an invitation email.
 */
export const invite = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required for invitation.' });
        }

        // We query the database directly instead of using the `getUserById` service function which returns partial data.
        const inviter = await prisma.user.findUnique({
            where: { id: req.user!.id }
        });

        if (!inviter) {
            // user should exist if they passed the 'protect' middleware
            return res.status(401).json({ success: false, message: 'Inviter not found' });
        }
        
        await userService.inviteUser(inviter, email);
        
        res.status(200).json({ success: true, message: `Invitation sent to ${email}` });
    } catch (error) { 
        next(error); 
    }
};


// Controller to search for users by name, email, or phone. 
export const search = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const query = req.query.q as string;
        if (!query || query.trim() === '') {
            return res.status(400).json({ success: false, message: 'A search query parameter "q" is required.' });
        }
        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = parseInt(req.query.limit as string, 10) || 10;
        const results = await userService.searchUsers(query, page, limit);
        res.status(200).json({ success: true, data: results.users, meta: { page, limit, totalRecords: results.totalRecords, totalPages: results.totalPages } });
    } catch (error) { next(error); }
};