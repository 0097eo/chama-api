import { Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma/client';
import * as notificationService from '../services/notification.service';
import { isErrorWithMessage, isPrismaError } from '../utils/error.utils';
import { NotificationType, MembershipRole } from '../generated/prisma/client';

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
    try {
        const actorId = req.user?.id!;
        const { id } = req.params;

        const notificationToDelete = await prisma.notification.findFirst({
            where: { 
                id: id,
                userId: actorId 
            } 
        });

        if (!notificationToDelete) {
            return res.status(404).json({ message: 'Notification not found or you do not have permission to delete it.' });
        }

        await prisma.notification.delete({
            where: { id: id },
        });
        
        res.status(200).json({ message: 'Notification deleted successfully.' });

    } catch (error) {
        // Handle cases where the record might have been deleted between the check and the delete operation
        if (isPrismaError(error) && error.code === 'P2025') {
            return res.status(404).json({ message: 'Notification not found.' });
        }
        res.status(500).json({ message: 'An unexpected error occurred while deleting the notification.' });
    }
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

export const sendContributionReminder = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { chamaId, userId, memberName, phoneNumber } = req.body;
        const actorId = req.user?.id!;

        if (!chamaId || !userId || !memberName || !phoneNumber) {
            return res.status(400).json({ message: "Chama ID, user ID, member name, and phone number are required." });
        }

        const actorMembership = await prisma.membership.findFirst({
            where: {
                userId: actorId,
                chamaId: chamaId,
                role: { in: [MembershipRole.ADMIN, MembershipRole.TREASURER, MembershipRole.SECRETARY] }
            }
        });

        if (!actorMembership) {
            return res.status(403).json({ message: "Permission Denied: You do not have the rights to send reminders for this chama." });
        }

        const chama = await prisma.chama.findUnique({ where: { id: chamaId } });
        const message = `Hello ${memberName}, this is a friendly reminder that your monthly contribution of KSH ${chama?.monthlyContribution.toLocaleString()} for ${chama?.name} is due. Thank you.`;

        await notificationService.sendSms([phoneNumber], message);
        
        res.status(200).json({ message: `Reminder sent successfully to ${memberName}.` });
    } catch (error) {
        if (isErrorWithMessage(error)) return res.status(500).json({ message: error.message });
        res.status(500).json({ message: 'An unexpected error occurred while sending the reminder.' });
    }
};

export const sendLoanReminder = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { chamaId, memberName, phoneNumber, loanId } = req.body;
        const actorId = req.user?.id!;

        if (!chamaId || !memberName || !phoneNumber || !loanId) {
            return res.status(400).json({ message: "Chama ID, member name, phone number, and loan ID are required." });
        }

        const actorMembership = await prisma.membership.findFirst({
            where: {
                userId: actorId,
                chamaId: chamaId,
                role: { in: [MembershipRole.ADMIN, MembershipRole.TREASURER] }
            }
        });

        if (!actorMembership) {
            return res.status(403).json({ message: "Permission Denied: Only an Admin or Treasurer can send loan reminders." });
        }

        const loan = await prisma.loan.findUnique({ where: { id: loanId } });
        if (!loan) {
            return res.status(404).json({ message: "Loan not found." });
        }
        
        const message = `Hello ${memberName}, this is a friendly reminder that your loan installment of KSH ${loan.monthlyInstallment?.toLocaleString()} is overdue. Please make a payment soon. Thank you.`;

        await notificationService.sendSms([phoneNumber], message);
        
        res.status(200).json({ message: `Loan reminder sent successfully to ${memberName}.` });
    } catch (error) {
        if (isErrorWithMessage(error)) return res.status(500).json({ message: error.message });
        res.status(500).json({ message: 'An unexpected error occurred while sending the reminder.' });
    }
};