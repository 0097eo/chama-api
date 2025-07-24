import { PrismaClient, User } from '../generated/prisma';
import bcrypt from 'bcrypt';
import { generateRefreshToken, generateToken } from '../utils/jwt.utils';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

const prisma = new PrismaClient();

// Hashes a password using bcrypt
const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

// Service to register a new user
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
  if (!phoneNumber) {
      throw new Error('Invalid phone number format');
  }
  const normalizedPhone = phoneNumber.format('E.164'); // e.g., +254712345678

  // Hash password
  const hashedPassword = await hashPassword(password);

  const newUser = await prisma.user.create({
    data: {
      ...userData,
      phone: normalizedPhone,
      password: hashedPassword,
    },
    select: { // Only return safe fields
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
    }
  });

  return newUser;
};

// Service to log in a user
export const loginUser = async (email: string, password: string): Promise<any> => {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
        throw new Error('Invalid credentials'); // Use generic message for security
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

// Service to get user profile
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

// Service to update user profile
export const updateUserProfile = async (userId: string, data: Partial<User>): Promise<Partial<User>> => {
    // Prevent password from being updated through this endpoint
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