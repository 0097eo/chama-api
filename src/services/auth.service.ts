import { PrismaClient, User } from '../generated/prisma';
import bcrypt from 'bcrypt';
import { generateRefreshToken, generateToken } from '../utils/jwt.utils'; // Assuming you have these
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { sendEmail } from './notification.service';
import crypto from 'crypto'; // Native Node.js module for generating secure random tokens

const prisma = new PrismaClient();

// A helper to generate secure random tokens for verification and reset
const generateSecureToken = () => crypto.randomBytes(32).toString('hex');

// Hashes a password using bcrypt
const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

/**
 * Service to register a new user, generate a verification token, and send a verification email.
 */
export const registerUser = async (userData: any): Promise<Partial<User>> => {
  const { email, phone, idNumber, password } = userData;

  // Check if user already exists
  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone }, { idNumber }] },
  });
  if (existingUser) {
    throw new Error('User with this email, phone, or ID number already exists');
  }

  // Normalize phone number to E.164 format
  const phoneNumber = parsePhoneNumberFromString(phone, 'KE');
  if (!phoneNumber || !phoneNumber.isValid()) {
      throw new Error('Invalid Kenyan phone number format');
  }
  const normalizedPhone = phoneNumber.format('E.164');

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Generate email verification token
  const emailVerificationToken = generateSecureToken();

  const newUser = await prisma.user.create({
    data: {
      ...userData,
      phone: normalizedPhone,
      password: hashedPassword,
      emailVerificationToken, // Save the token to the user record
      isEmailVerified: false, // Start as unverified
    },
    select: { id: true, email: true, firstName: true, lastName: true, phone: true, role: true }
  });

  // Send verification email
  const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${emailVerificationToken}`;
  await sendEmail(
      newUser.email!,
      'Verify Your Email Address for Chama App',
      `<h1>Welcome, ${newUser.firstName}!</h1>
       <p>Thank you for registering. Please click the link below to verify your email address:</p>
       <a href="${verificationLink}" style="padding: 10px 15px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a>
       <p>If you did not create an account, please ignore this email.</p>`
  );

  return newUser;
};

/**
 * Verifies a user's email using a token.
 */
export const verifyUserEmail = async (token: string): Promise<Partial<User>> => {
    const user = await prisma.user.findUnique({ where: { emailVerificationToken: token } });

    if (!user) {
        throw new Error('Invalid or expired verification token.');
    }

    return prisma.user.update({
        where: { id: user.id },
        data: {
            isEmailVerified: true,
            emailVerificationToken: null, // Clear the token after use
        },
        select: { id: true, email: true, isEmailVerified: true }
    });
};


/**
 * Service to log in a user, but only if their email is verified.
 */
export const loginUser = async (email: string, password: string): Promise<any> => {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
        throw new Error('Invalid credentials');
    }

    if (!user.isEmailVerified) {
        throw new Error('Please verify your email address before logging in.');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        throw new Error('Invalid credentials');
    }

    const payload = { id: user.id };
    const accessToken = generateToken(payload);
    const refreshToken = generateRefreshToken(payload);

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
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        // For security, do not reveal if the user exists. Silently succeed.
        return;
    }

    const passwordResetToken = generateSecureToken();
    const passwordResetTokenExpires = new Date(Date.now() + 3600000); // Token expires in 1 hour

    await prisma.user.update({
        where: { id: user.id },
        data: { passwordResetToken, passwordResetTokenExpires },
    });

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${passwordResetToken}`;
    await sendEmail(
        user.email,
        'Password Reset Request',
        `<p>You requested a password reset for your Chama App account. Click the link below to set a new password:</p>
         <a href="${resetLink}">${resetLink}</a>
         <p>This link is valid for one hour. If you did not request this, you can safely ignore this email.</p>`
    );
};

/**
 * Resets a user's password using a valid token and new password.
 */
export const resetUserPassword = async (token: string, newPassword: string): Promise<Partial<User>> => {
    const user = await prisma.user.findFirst({
        where: {
            passwordResetToken: token,
            passwordResetTokenExpires: { gte: new Date() }, // Check if token is not expired
        },
    });

    if (!user) {
        throw new Error('Invalid or expired password reset token.');
    }

    const hashedPassword = await hashPassword(newPassword);

    return prisma.user.update({
        where: { id: user.id },
        data: {
            password: hashedPassword,
            passwordResetToken: null, // Invalidate the token after use
            passwordResetTokenExpires: null,
        },
        select: { id: true, email: true }
    });
};


export const getUserProfile = async (userId: string): Promise<Partial<User> | null> => {
    return prisma.user.findUnique({
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
};

export const updateUserProfile = async (userId: string, data: Partial<User>): Promise<Partial<User>> => {
    const { password, ...updateData } = data;
    return prisma.user.update({
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
};