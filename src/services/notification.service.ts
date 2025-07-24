// src/services/notification.service.ts
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: Number(process.env.SMTP_PORT) === 465, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendInvitationEmail = async (email: string, inviterName: string) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `You have been invited to join a Chama!`,
    html: `<p>Hello,</p><p>You have been invited by ${inviterName} to join their Chama. Please click the link below to register and get started.</p><p><a href="${process.env.CORS_ORIGINS}/register">Register Now</a></p>`,
  };

  await transporter.sendMail(mailOptions);
};

// Todo -  Add an SMS function here using Africa's Talking SDK later