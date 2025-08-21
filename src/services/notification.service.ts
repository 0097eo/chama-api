import nodemailer from 'nodemailer';
import AfricasTalking from 'africastalking';
import { PrismaClient } from '../generated/prisma';
import { NotificationType, Prisma, User } from '../generated/prisma';

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
 * Creates a notification record in the database.
 */
export const createNotification = (data: NotificationData) => {
    return prisma.notification.create({ data });
};

/**
 * Creates a notification for multiple users at once (broadcast).
 * @param userIds - An array of user IDs to send the notification to.
 */
export const createBulkNotifications = async (chamaId: string, title: string, message: string, type: NotificationType) => {
    const memberships = await prisma.membership.findMany({
        where: { chamaId, isActive: true },
        select: { id: true }, // Select only the membership IDs
    });

    if (memberships.length === 0) return;

    const membershipIds = memberships.map(m => m.id);

    const notificationsData = membershipIds.map(membershipId => ({
        membershipId,
        title,
        message,
        type,
    }));

    await prisma.notification.createMany({
        data: notificationsData,
    });
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