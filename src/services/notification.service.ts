import nodemailer from 'nodemailer';
import AfricasTalking from 'africastalking';
import { PrismaClient } from '../generated/prisma';
import { NotificationType, Prisma, User } from '../generated/prisma';
import { WebSocketServer } from '../websocket.server';

const prisma = new PrismaClient();

const atCredentials = {
    apiKey: process.env.AT_API_KEY!,
    username: process.env.AT_USERNAME!,
};
const africasTalking = AfricasTalking(atCredentials);
const sms = africasTalking.SMS;

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: Number(process.env.EMAIL_PORT) === 465, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

interface NotificationData {
    membershipId: string;
    title: string;
    message: string;
    type: NotificationType;
}

export const sendInvitationEmail = async (email: string, inviterName: string) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `You have been invited to join a Chama!`,
    html: `<p>Hello,</p><p>You have been invited by ${inviterName} to join their Chama. Please click the link below to register and get started.</p><p><a href="${process.env.CORS_ORIGINS}/register">Register Now</a></p>`,
  };

  await transporter.sendMail(mailOptions);
};

/**
 * Creates a notification record and sends real-time notification
 */
export const createNotification = async (data: NotificationData) => {
    const notification = await prisma.notification.create({ 
        data,
        include: {
            membership: {
                include: {
                    user: { select: { id: true } },
                    chama: { select: { id: true, name: true } }
                }
            }
        }
    });

    // Send real-time notification via WebSocket to a specific user
    const wsServer = WebSocketServer.getInstance();
    if (wsServer) {
        wsServer.sendToUser(notification.membership.user.id, 'new_notification', {
            id: notification.id,
            title: notification.title,
            message: notification.message,
            type: notification.type,
            chamaName: notification.membership.chama.name,
            createdAt: notification.createdAt,
            read: false
        });
    }

    return notification;
};

/**
 * Creates bulk notifications (database records) and sends a single real-time broadcast notification
 */
export const createBulkNotifications = async (chamaId: string, title: string, message: string, type: NotificationType) => {
    const memberships = await prisma.membership.findMany({
        where: { chamaId, isActive: true },
        select: { 
            id: true, 
            user: { select: { id: true } },
            chama: { select: { name: true } }
        },
    });

    if (memberships.length === 0) return;

    const notificationsData = memberships.map(membership => ({
        membershipId: membership.id,
        title,
        message,
        type,
    }));

    await prisma.$transaction(
        notificationsData.map(data => prisma.notification.create({ data }))
    );

    const wsServer = WebSocketServer.getInstance();
    if (wsServer) {
        wsServer.sendToChama(chamaId, 'new_broadcast_notification', {
            title,
            message,
            type,
            chamaName: memberships[0].chama.name, // Assuming all members belong to the same chama
            createdAt: new Date().toISOString()
        });
    }
};

/**
 * Sends an SMS using Africa's Talking.
 */
export const sendSms = async (to: string[], message: string) => {
    try {
        const response = await sms.send({
            to,
            message,
            from: process.env.AT_SENDER_ID, // Optional Sender ID
        });
        console.log('SMS sent successfully:', response);
        return response;
    } catch (error) {
        console.error('SMS sending error:', error);
        throw new Error('Failed to send SMS.');
    }
};

/**
 * Sends an email using Nodemailer.
 */
export const sendEmail = async (to: string, subject: string, html: string) => {
    try {
        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to,
            subject,
            html, // HTML body
        });
        console.log('Email sent successfully:', info.messageId);
        return info;
    } catch (error) {
        console.error('Email sending error:', error);
        throw new Error('Failed to send email.');
    }
};

/**
 * Send real-time notification when a notification is marked as read
 */
export const markNotificationAsRead = async (notificationId: string, userId: string) => {
    const wsServer = WebSocketServer.getInstance();
    if (wsServer) {
        wsServer.sendToUser(userId, 'notification_marked_read', {
            notificationId,
            timestamp: new Date().toISOString()
        });
    }
};

/**
 * Send real-time notification when a notification is deleted
 */
export const notifyNotificationDeleted = async (notificationId: string, userId: string) => {
    const wsServer = WebSocketServer.getInstance();
    if (wsServer) {
        wsServer.sendToUser(userId, 'notification_deleted', {
            notificationId,
            timestamp: new Date().toISOString()
        });
    }
};