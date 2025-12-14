import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import * as userService from '../services/user.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();


export const getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = parseInt(req.query.limit as string, 10) || 10;
        
        logger.info({ page, limit }, 'Fetching all users');
        
        const { users, totalRecords, totalPages } = await userService.getAllUsers(page, limit);
        
        logger.info({ count: users.length, totalRecords }, 'Users fetched successfully');
        
        res.status(200).json({ success: true, data: users, meta: { page, limit, totalRecords, totalPages } });
    } catch (error) { 
        logger.error({ error }, 'Error fetching all users');
        next(error); 
    }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.params.id;
        
        logger.info({ userId }, 'Fetching user by ID');
        
        const user = await userService.getUserById(userId);
        
        if (!user) { 
            logger.warn({ userId }, 'User not found');
            return res.status(404).json({ success: false, message: 'User not found' }); 
        }
        
        logger.info({ userId }, 'User fetched successfully');
        
        res.status(200).json({ success: true, data: user });
    } catch (error) { 
        logger.error({ error, userId: req.params.id }, 'Error fetching user by ID');
        next(error); 
    }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const adminUserId = req.user!.id;
        const targetUserId = req.params.id;
        
        logger.info({ adminUserId, targetUserId }, 'Updating user');
        
        const updatedUser = await userService.updateUser(adminUserId, targetUserId, req.body);
        
        logger.info({ adminUserId, targetUserId }, 'User updated successfully');
        
        res.status(200).json({ success: true, message: 'User updated successfully', data: updatedUser });
    } catch (error) { 
        logger.error({ error, adminUserId: req.user?.id, targetUserId: req.params.id }, 'Error updating user');
        next(error); 
    }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const adminUserId = req.user!.id;
        const targetUserId = req.params.id;
        
        logger.info({ adminUserId, targetUserId }, 'Deleting user');
        
        await userService.softDeleteUser(adminUserId, targetUserId);
        
        logger.info({ adminUserId, targetUserId }, 'User deleted successfully');
        
        res.status(200).json({ success: true, message: 'User deleted successfully' });
    } catch (error) { 
        logger.error({ error, adminUserId: req.user?.id, targetUserId: req.params.id }, 'Error deleting user');
        next(error); 
    }
};

/**
 * Controller to send an invitation email.
 */
export const invite = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email } = req.body;
        const inviterId = req.user!.id;
        
        if (!email) {
            logger.warn({ inviterId }, 'Invitation attempt with missing email');
            return res.status(400).json({ success: false, message: 'Email is required for invitation.' });
        }

        logger.info({ inviterId, targetEmail: email }, 'Sending user invitation');

        const inviter = await prisma.user.findUnique({
            where: { id: inviterId }
        });

        if (!inviter) {
            logger.error({ inviterId }, 'Inviter not found');
            return res.status(401).json({ success: false, message: 'Inviter not found' });
        }
        
        await userService.inviteUser(inviter, email);
        
        logger.info({ inviterId, targetEmail: email }, 'Invitation sent successfully');
        
        res.status(200).json({ success: true, message: `Invitation sent to ${email}` });
    } catch (error) { 
        logger.error({ error, inviterId: req.user?.id, targetEmail: req.body.email }, 'Error sending invitation');
        next(error); 
    }
};

// Controller to search for users by name, email, or phone. 
export const search = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const query = req.query.q as string;
        
        if (!query || query.trim() === '') {
            logger.warn('Search attempt with empty query');
            return res.status(400).json({ success: false, message: 'A search query parameter "q" is required.' });
        }
        
        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = parseInt(req.query.limit as string, 10) || 10;
        
        logger.info({ query, page, limit }, 'Searching users');
        
        const results = await userService.searchUsers(query, page, limit);
        
        logger.info({ query, count: results.users.length, totalRecords: results.totalRecords }, 'User search completed');
        
        res.status(200).json({ success: true, data: results.users, meta: { page, limit, totalRecords: results.totalRecords, totalPages: results.totalPages } });
    } catch (error) { 
        logger.error({ error, query: req.query.q }, 'Error searching users');
        next(error); 
    }
};