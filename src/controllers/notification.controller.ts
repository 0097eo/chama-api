import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import * as notificationService from '../services/notification.service';
import { isErrorWithMessage, isPrismaError } from '../utils/error.utils';
import { NotificationType, MembershipRole } from '@prisma/client';
import logger from '../config/logger';

const prisma = new PrismaClient();

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

/**
 * Gets notifications for the authenticated user within a specific chama.
 */
export const getUserNotificationsForChama = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const actorId = req.user?.id!;
        const { chamaId } = req.params;

        logger.debug({ actorId, chamaId }, 'Fetching user notifications for chama');

        const membership = await prisma.membership.findFirst({
            where: { userId: actorId, chamaId }
        });

        if (!membership) {
            logger.warn({ actorId, chamaId }, 'Non-member attempting to access chama notifications');
            return res.status(403).json({ message: "You are not a member of this chama." });
        }

        const notifications = await prisma.notification.findMany({
            where: { membershipId: membership.id },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        logger.info({ 
            actorId, 
            chamaId, 
            membershipId: membership.id,
            notificationsCount: notifications.length 
        }, 'User notifications retrieved successfully');

        res.status(200).json({ data: notifications });
    } catch (error) {
        logger.error({ 
            error, 
            actorId: req.user?.id, 
            chamaId: req.params.chamaId 
        }, 'Error fetching user notifications');
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

/**
 * Marks a notification as read and emits WebSocket event
 */
export const markAsRead = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const actorId = req.user?.id!;
        const { id: notificationId } = req.params;

        logger.debug({ actorId, notificationId }, 'Marking notification as read');

        const notification = await prisma.notification.findFirst({
            where: {
                id: notificationId,
                membership: {
                    userId: actorId,
                },
            },
        });

        if (!notification) {
            logger.warn({ 
                actorId, 
                notificationId 
            }, 'Notification not found or unauthorized access');
            return res.status(404).json({ message: 'Notification not found or you do not have permission to update it.' });
        }

        const updated = await prisma.notification.update({
            where: { id: notificationId },
            data: { read: true },
        });

        // Emit WebSocket event
        await notificationService.markNotificationAsRead(notificationId, actorId);

        logger.info({ 
            actorId, 
            notificationId, 
            membershipId: notification.membershipId 
        }, 'Notification marked as read');

        res.status(200).json({ data: updated });
    } catch (error) {
        logger.error({ 
            error, 
            actorId: req.user?.id, 
            notificationId: req.params.id 
        }, 'Error marking notification as read');
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

/**
 * Deletes a notification and emits WebSocket event
 */
export const deleteNotification = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const actorId = req.user?.id!;
        const { id: notificationId } = req.params;

        logger.debug({ actorId, notificationId }, 'Deleting notification');

        const notificationToDelete = await prisma.notification.findFirst({
            where: {
                id: notificationId,
                membership: { userId: actorId },
            },
        });

        if (!notificationToDelete) {
            logger.warn({ 
                actorId, 
                notificationId 
            }, 'Notification not found or unauthorized deletion attempt');
            return res.status(404).json({ message: 'Notification not found or you do not have permission to delete it.' });
        }

        await prisma.notification.delete({ where: { id: notificationId } });
        
        // Emit WebSocket event
        await notificationService.notifyNotificationDeleted(notificationId, actorId);
        
        logger.info({ 
            actorId, 
            notificationId, 
            membershipId: notificationToDelete.membershipId 
        }, 'Notification deleted successfully');
        
        res.status(200).json({ message: 'Notification deleted successfully.' });
    } catch (error) {
        if (isPrismaError(error) && error.code === 'P2025') {
            logger.warn({ 
                actorId: req.user?.id, 
                notificationId: req.params.id 
            }, 'Notification not found during deletion');
            return res.status(404).json({ message: 'Notification not found.' });
        }
        logger.error({ 
            error, 
            actorId: req.user?.id, 
            notificationId: req.params.id 
        }, 'Error deleting notification');
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

/**
 * Sends a notification to all active members of a chama.
 */
export const broadcastToChama = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { chamaId } = req.params;
        const { title, message } = req.body;

        if (!title || !message) {
            logger.warn({ chamaId }, 'Broadcast attempt with missing title or message');
            return res.status(400).json({ message: 'Title and message are required.' });
        }

        logger.debug({ 
            chamaId, 
            title, 
            messageLength: message?.length 
        }, 'Broadcasting notification to chama');

        await notificationService.createBulkNotifications(chamaId, title, message, NotificationType.GENERAL);
        
        // Send SMS notifications
        const members = await prisma.membership.findMany({
            where: { chamaId, isActive: true },
            include: { user: { select: { phone: true } } }
        });
        const phoneNumbers = members.map(m => m.user.phone);

        if (phoneNumbers.length > 0) {
            logger.debug({ 
                chamaId, 
                recipientsCount: phoneNumbers.length 
            }, 'Sending SMS broadcast');
            await notificationService.sendSms(phoneNumbers, message);
        }
        
        logger.info({ 
            chamaId, 
            recipientsCount: phoneNumbers.length,
            title 
        }, 'Broadcast sent successfully');
        
        res.status(200).json({ message: 'Broadcast sent successfully.' });
    } catch (error) {
        logger.error({ 
            error, 
            chamaId: req.params.chamaId,
            title: req.body.title 
        }, 'Error broadcasting to chama');
        if (isErrorWithMessage(error)) return res.status(500).json({ message: error.message });
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const sendSmsController = async (req: Request, res: Response) => {
    try {
        const { to, message } = req.body;

        if (!to || !message) {
            logger.warn('SMS send attempt with missing recipient or message');
            return res.status(400).json({ message: 'A recipient phone number (to) and a message are required.' });
        }

        const recipients = Array.isArray(to) ? to : [to];

        logger.debug({ 
            recipientsCount: recipients.length, 
            messageLength: message?.length 
        }, 'Sending SMS');

        const response = await notificationService.sendSms(recipients, message);
        
        logger.info({ 
            recipientsCount: recipients.length,
            success: true 
        }, 'SMS sent successfully');

        res.status(200).json({ message: 'SMS sent.', data: response });
    } catch (error) {
        logger.error({ 
            error, 
            recipientsCount: Array.isArray(req.body.to) ? req.body.to.length : 1 
        }, 'Error sending SMS');
        if (isErrorWithMessage(error)) return res.status(500).json({ message: error.message });
    }
};

export const sendEmailController = async (req: Request, res: Response) => {
    try {
        const { to, subject, html } = req.body;

        if (!to || !subject || !html) {
            logger.warn('Email send attempt with missing parameters');
            return res.status(400).json({ message: 'A recipient (to), subject, and html body are required.' });
        }

        logger.debug({ 
            to, 
            subject 
        }, 'Sending email');

        const response = await notificationService.sendEmail(to, subject, html);
        
        logger.info({ 
            to, 
            subject,
            success: true 
        }, 'Email sent successfully');

        res.status(200).json({ message: 'Email sent.', data: response });
    } catch (error) {
        logger.error({ 
            error, 
            to: req.body.to, 
            subject: req.body.subject 
        }, 'Error sending email');
        if (isErrorWithMessage(error)) return res.status(500).json({ message: error.message });
    }
};

export const sendContributionReminder = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { chamaId, userId, memberName, phoneNumber } = req.body;
        const actorId = req.user?.id!;

        if (!chamaId || !userId || !memberName || !phoneNumber) {
            logger.warn({ actorId }, 'Contribution reminder attempt with missing parameters');
            return res.status(400).json({ message: "Chama ID, user ID, member name, and phone number are required." });
        }

        logger.debug({ 
            actorId, 
            chamaId, 
            targetUserId: userId, 
            memberName 
        }, 'Sending contribution reminder');

        const actorMembership = await prisma.membership.findFirst({
            where: {
                userId: actorId,
                chamaId: chamaId,
                role: { in: [MembershipRole.ADMIN, MembershipRole.TREASURER, MembershipRole.SECRETARY] }
            }
        });

        if (!actorMembership) {
            logger.warn({ 
                actorId, 
                chamaId, 
                targetUserId: userId 
            }, 'Unauthorized contribution reminder attempt');
            return res.status(403).json({ message: "Permission Denied: You do not have the rights to send reminders for this chama." });
        }

        const chama = await prisma.chama.findUnique({ where: { id: chamaId } });
        const message = `Hello ${memberName}, this is a friendly reminder that your monthly contribution of KSH ${chama?.monthlyContribution.toLocaleString()} for ${chama?.name} is due. Thank you.`;

        await notificationService.sendSms([phoneNumber], message);
        
        logger.info({ 
            actorId, 
            chamaId, 
            targetUserId: userId, 
            memberName,
            amount: chama?.monthlyContribution 
        }, 'Contribution reminder sent successfully');
        
        res.status(200).json({ message: `Reminder sent successfully to ${memberName}.` });
    } catch (error) {
        logger.error({ 
            error, 
            actorId: req.user?.id, 
            chamaId: req.body.chamaId,
            targetUserId: req.body.userId 
        }, 'Error sending contribution reminder');
        if (isErrorWithMessage(error)) return res.status(500).json({ message: error.message });
        res.status(500).json({ message: 'An unexpected error occurred while sending the reminder.' });
    }
};

export const sendLoanReminder = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { chamaId, memberName, phoneNumber, loanId } = req.body;
        const actorId = req.user?.id!;

        if (!chamaId || !memberName || !phoneNumber || !loanId) {
            logger.warn({ actorId }, 'Loan reminder attempt with missing parameters');
            return res.status(400).json({ message: "Chama ID, member name, phone number, and loan ID are required." });
        }

        logger.debug({ 
            actorId, 
            chamaId, 
            loanId, 
            memberName 
        }, 'Sending loan reminder');

        const actorMembership = await prisma.membership.findFirst({
            where: {
                userId: actorId,
                chamaId: chamaId,
                role: { in: [MembershipRole.ADMIN, MembershipRole.TREASURER] }
            }
        });

        if (!actorMembership) {
            logger.warn({ 
                actorId, 
                chamaId, 
                loanId 
            }, 'Unauthorized loan reminder attempt');
            return res.status(403).json({ message: "Permission Denied: Only an Admin or Treasurer can send loan reminders." });
        }

        const loan = await prisma.loan.findUnique({ where: { id: loanId } });
        if (!loan) {
            logger.warn({ 
                actorId, 
                chamaId, 
                loanId 
            }, 'Loan reminder for non-existent loan');
            return res.status(404).json({ message: "Loan not found." });
        }
        
        const message = `Hello ${memberName}, this is a friendly reminder that your loan installment of KSH ${loan.monthlyInstallment?.toLocaleString()} is overdue. Please make a payment soon. Thank you.`;

        await notificationService.sendSms([phoneNumber], message);
        
        logger.info({ 
            actorId, 
            chamaId, 
            loanId, 
            memberName,
            installmentAmount: loan.monthlyInstallment 
        }, 'Loan reminder sent successfully');
        
        res.status(200).json({ message: `Loan reminder sent successfully to ${memberName}.` });
    } catch (error) {
        logger.error({ 
            error, 
            actorId: req.user?.id, 
            chamaId: req.body.chamaId,
            loanId: req.body.loanId 
        }, 'Error sending loan reminder');
        if (isErrorWithMessage(error)) return res.status(500).json({ message: error.message });
        res.status(500).json({ message: 'An unexpected error occurred while sending the reminder.' });
    }
};