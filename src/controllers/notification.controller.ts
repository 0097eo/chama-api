import { Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma/client';
import * as notificationService from '../services/notification.service';
import { isErrorWithMessage } from '../utils/error.utils';
import { NotificationType } from '../generated/prisma/client';

const prisma = new PrismaClient();

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}


export const getUserNotifications = async (req: AuthenticatedRequest, res: Response) => {
    const actorId = req.user?.id!;
    const notifications = await prisma.notification.findMany({
        where: { userId: actorId },
        orderBy: { createdAt: 'desc' },
        take: 50, // Limit to the latest 50
    });
    res.status(200).json({ data: notifications });
};

export const markAsRead = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const actorId = req.user?.id!;
        const { id } = req.params;
        
        // Ensure the user can only mark their own notification as read
        const notification = await prisma.notification.findFirst({ where: { id, userId: actorId } });
        if (!notification) {
            return res.status(404).json({ message: 'Notification not found or you do not have permission to update it.' });
        }

        const updated = await prisma.notification.update({
            where: { id },
            data: { read: true },
        });
        res.status(200).json({ data: updated });
    } catch (error) {
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const deleteNotification = async (req: AuthenticatedRequest, res: Response) => {
    // Similar permission check as markAsRead
    // ...
};

export const broadcastToChama = async (req: Request, res: Response) => {
    try {
        const { chamaId } = req.params;
        const { title, message } = req.body;
        if (!title || !message) {
            return res.status(400).json({ message: 'Title and message are required.' });
        }

        const members = await prisma.membership.findMany({ where: { chamaId, isActive: true } });
        const userIds = members.map(m => m.userId);

        await notificationService.createBulkNotifications(userIds, title, message, NotificationType.GENERAL);
        
        const phoneNumbers = (await prisma.user.findMany({ where: { id: { in: userIds } } })).map(u => u.phone);
        await notificationService.sendSms(phoneNumbers, message);

        res.status(200).json({ message: 'Broadcast sent successfully.' });
    } catch (error) {
        if (isErrorWithMessage(error)) return res.status(500).json({ message: error.message });
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const sendSmsController = async (req: Request, res: Response) => {
    try {
        const { to, message } = req.body;
        if (!to || !message) {
            return res.status(400).json({ message: 'A recipient phone number (to) and a message are required.' });
        }
        const recipients = Array.isArray(to) ? to : [to];
        const response = await notificationService.sendSms(recipients, message);
        res.status(200).json({ message: 'SMS sent.', data: response });
    } catch (error) {
        if (isErrorWithMessage(error)) return res.status(500).json({ message: error.message });
    }
};

export const sendEmailController = async (req: Request, res: Response) => {
    try {
        const { to, subject, html } = req.body;
        if (!to || !subject || !html) {
            return res.status(400).json({ message: 'A recipient (to), subject, and html body are required.' });
        }
        const response = await notificationService.sendEmail(to, subject, html);
        res.status(200).json({ message: 'Email sent.', data: response });
    } catch (error) {
        if (isErrorWithMessage(error)) return res.status(500).json({ message: error.message });
    }
};