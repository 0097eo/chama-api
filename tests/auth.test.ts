import request from 'supertest';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaClient, User, UserRole } from '../src/generated/prisma';
import bcrypt from 'bcrypt';

const prismaMock = mockDeep<PrismaClient>();

jest.mock('../src/generated/prisma', () => {
    return {
        __esModule: true,
        PrismaClient: jest.fn(() => prismaMock),
        UserRole: {
            USER: 'USER',
            ADMIN: 'ADMIN',
        },
        MembershipRole: {
            ADMIN: 'ADMIN',
            TREASURER: 'TREASURER',
            SECRETARY: 'SECRETARY',
            MEMBER: 'MEMBER',
        },
        ContributionStatus: {
            PENDING: 'PENDING',
            PAID: 'PAID',
            OVERDUE: 'OVERDUE',
        },
        LoanStatus: {
            PENDING: 'PENDING',
            APPROVED: 'APPROVED',
            REJECTED: 'REJECTED',
            ACTIVE: 'ACTIVE',
            PAID: 'PAID',
            DEFAULTED: 'DEFAULTED',
        }
    };
});

jest.mock('bcrypt');

jest.mock('../src/services/notification.service', () => ({
    sendEmail: jest.fn().mockResolvedValue(true),
}));

import { app, server } from '../src/server';
import { sendEmail } from '../src/services/notification.service';

const prisma = new PrismaClient() as unknown as DeepMockProxy<PrismaClient>;

describe('Auth Routes', () => {
    afterAll((done) => {
        server.close(() => {
            done();
        });
    });

    beforeEach(() => {
        jest.clearAllMocks();
        prismaMock.user.create.mockClear();
        prismaMock.user.findUnique.mockClear();
        prismaMock.user.findFirst.mockClear();
        prismaMock.user.update.mockClear();
        (bcrypt.compare as jest.Mock).mockClear();
        (sendEmail as jest.Mock).mockClear();
    });

    const mockUser: User = {
        id: '1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        phone: '+254712345678',
        role: UserRole.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        idNumber: '12345678',
        isEmailVerified: false,
        emailVerificationToken: 'token123',
        passwordResetToken: null,
        passwordResetTokenExpires: null,
        password: 'hashedpassword'
    };

    describe('POST /register', () => {
        it('should register a new user', async () => {
            prismaMock.user.findFirst.mockResolvedValue(null);
            prismaMock.user.create.mockResolvedValue(mockUser);
            (sendEmail as jest.Mock).mockResolvedValue(true);

            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'test@example.com',
                    password: 'password123',
                    firstName: 'Test',
                    lastName: 'User',
                    phone: '0712345678',
                    idNumber: '12345678'
                });

            expect(res.statusCode).toEqual(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('id');
            expect(res.body.data).toHaveProperty('email');
            expect(sendEmail).toHaveBeenCalled();
        });

        it('should not register a user with an existing email', async () => {
            prismaMock.user.findFirst.mockResolvedValue(mockUser);

            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'test@example.com',
                    password: 'password123',
                    firstName: 'Test',
                    lastName: 'User',
                    phone: '0712345678',
                    idNumber: '12345678'
                });

            expect(res.statusCode).toEqual(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toContain('already exists');
        });
    });

    describe('POST /login', () => {
        it('should login an existing user', async () => {
            prismaMock.user.findUnique.mockResolvedValue({ 
                ...mockUser, 
                isEmailVerified: true 
            });
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);

            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123',
                });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('accessToken');
            expect(res.body.data).toHaveProperty('refreshToken');
            expect(res.body.data).toHaveProperty('user');
        });

        it('should not login a user with incorrect credentials', async () => {
            prismaMock.user.findUnique.mockResolvedValue({ 
                ...mockUser, 
                isEmailVerified: true 
            });
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);

            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'wrongpassword',
                });

            expect(res.statusCode).toEqual(401);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toContain('Invalid credentials');
        });

        it('should not login an unverified user', async () => {
            prismaMock.user.findUnique.mockResolvedValue(mockUser);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);

            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123',
                });

            expect(res.statusCode).toEqual(401);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toContain('verify your email');
        });
    });
});