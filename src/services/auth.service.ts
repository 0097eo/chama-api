import { PrismaClient, User } from '@prisma/client';
import bcrypt from 'bcrypt';
import logger from '../config/logger';
import { generateRefreshToken, generateToken } from '../utils/jwt.utils';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { sendEmail } from './notification.service';
import crypto from 'crypto';
import { AppError } from '../utils/customErrors';

const prisma = new PrismaClient();


const generateSecureToken = () => crypto.randomBytes(32).toString('hex');

const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

/**
 * Service to register a new user, generate a verification token, and send a verification email.
 */
export const registerUser = async (userData: any): Promise<Partial<User>> => {
  const { email, phone, idNumber, password } = userData;

  logger.info({ email, phone, idNumber }, 'Attempting to register user');

  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone }, { idNumber }] },
  });
  
  if (existingUser) {
    logger.warn({ email, phone, idNumber }, 'Registration failed: user already exists');
    throw new AppError('User with this email, phone, or ID number already exists', 400);
  }

  const phoneNumber = parsePhoneNumberFromString(phone, 'KE');
  if (!phoneNumber || !phoneNumber.isValid()) {
    logger.warn({ phone }, 'Invalid phone number format');
    throw new AppError('Invalid Kenyan phone number format', 400);
  }
  const normalizedPhone = phoneNumber.format('E.164');

  const hashedPassword = await hashPassword(password);
  const emailVerificationToken = generateSecureToken();

  const newUser = await prisma.user.create({
    data: {
      ...userData,
      phone: normalizedPhone,
      password: hashedPassword,
      emailVerificationToken,
      isEmailVerified: false,
    },
    select: { id: true, email: true, firstName: true, lastName: true, phone: true, role: true }
  });

  logger.info({ userId: newUser.id, email: newUser.email }, 'User registered successfully');

  const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${emailVerificationToken}`;
  await sendEmail(
      newUser.email!,
      'Verify Your Email Address for Chama App',
      `<h1>Welcome, ${newUser.firstName}!</h1>
       <p>Thank you for registering. Please click the link below to verify your email address:</p>
       <a href="${verificationLink}" style="padding: 10px 15px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a>
       <p>If you did not create an account, please ignore this email.</p>`
  );

  logger.info({ userId: newUser.id, email: newUser.email }, 'Verification email sent');

  return newUser;
};

/**
 * Verifies a user's email using a token.
 */
export const verifyUserEmail = async (token: string): Promise<Partial<User>> => {
    logger.info('Attempting to verify user email');

    const user = await prisma.user.findUnique({ where: { emailVerificationToken: token } });

    if (!user) {
        logger.warn('Email verification failed: invalid token');
        throw new AppError('Invalid or expired verification token', 400);
    }

    const verifiedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
            isEmailVerified: true,
            emailVerificationToken: null,
        },
        select: { id: true, email: true, isEmailVerified: true }
    });

    logger.info({ userId: verifiedUser.id, email: verifiedUser.email }, 'Email verified successfully');

    return verifiedUser;
};

/**
 * Service to log in a user, but only if their email is verified.
 */
export const loginUser = async (email: string, password: string): Promise<any> => {
    logger.info({ email }, 'Login attempt');

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
        logger.warn({ email }, 'Login failed: user not found');
        throw new AppError('Invalid credentials', 401);
    }

    if (!user.isEmailVerified) {
        logger.warn({ userId: user.id, email }, 'Login failed: email not verified');
        throw new AppError('Please verify your email address before logging in', 401);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        logger.warn({ userId: user.id, email }, 'Login failed: incorrect password');
        throw new AppError('Invalid credentials', 401);
    }

    const payload = { id: user.id };
    const accessToken = generateToken(payload);
    const refreshToken = generateRefreshToken(payload);

    logger.info({ userId: user.id, email }, 'Login successful');

    return {
        accessToken,
        refreshToken,
        user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
        },
    };
};

/**
 * Generates a password reset token and sends it to the user's email.
 */
export const requestPasswordReset = async (email: string) => {
    logger.info({ email }, 'Password reset requested');

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        logger.warn({ email }, 'Password reset request for non-existent user');
        return;
    }

    const passwordResetToken = generateSecureToken();
    const passwordResetTokenExpires = new Date(Date.now() + 3600000);

    await prisma.user.update({
        where: { id: user.id },
        data: { passwordResetToken, passwordResetTokenExpires },
    });

    logger.info({ userId: user.id, email }, 'Password reset token generated');

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${passwordResetToken}`;
    await sendEmail(
        user.email,
        'Password Reset Request',
        `<p>You requested a password reset for your Chama App account. Click the link below to set a new password:</p>
         <a href="${resetLink}">${resetLink}</a>
         <p>This link is valid for one hour. If you did not request this, you can safely ignore this email.</p>`
    );

    logger.info({ userId: user.id, email }, 'Password reset email sent');
};

/**
 * Resets a user's password using a valid token and new password.
 */
export const resetUserPassword = async (token: string, newPassword: string): Promise<Partial<User>> => {
    logger.info('Attempting password reset');

    const user = await prisma.user.findFirst({
        where: {
            passwordResetToken: token,
            passwordResetTokenExpires: { gte: new Date() },
        },
    });

    if (!user) {
        logger.warn('Password reset failed: invalid or expired token');
        throw new AppError('Invalid or expired password reset token', 400);
    }

    const hashedPassword = await hashPassword(newPassword);

    const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
            password: hashedPassword,
            passwordResetToken: null,
            passwordResetTokenExpires: null,
        },
        select: { id: true, email: true }
    });

    logger.info({ userId: updatedUser.id, email: updatedUser.email }, 'Password reset successful');

    return updatedUser;
};

export const getUserProfile = async (userId: string): Promise<Partial<User> | null> => {
    logger.info({ userId }, 'Fetching user profile');

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            idNumber: true,
            role: true,
            createdAt: true
        }
    });

    if (user) {
        logger.info({ userId }, 'User profile fetched successfully');
    } else {
        logger.warn({ userId }, 'User profile not found');
    }

    return user;
};

export const updateUserProfile = async (userId: string, data: Partial<User>): Promise<Partial<User>> => {
    logger.info({ userId }, 'Updating user profile');

    const { password, ...updateData } = data;
    
    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
        }
    });

    logger.info({ userId }, 'User profile updated successfully');

    return updatedUser;
};