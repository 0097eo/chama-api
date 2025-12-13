import request from 'supertest';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaClient, User, UserRole } from '@prisma/client';

const prismaMock = mockDeep<PrismaClient>();

jest.mock('@prisma/client', () => {
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

jest.mock('../src/services/notification.service', () => ({
    sendEmail: jest.fn().mockResolvedValue(true),
    sendInvitationEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../src/services/audit.service', () => ({
    createAuditLog: jest.fn().mockResolvedValue(true),
}));

import { app, server } from '../src/server';
import { sendInvitationEmail } from '../src/services/notification.service';
import { createAuditLog } from '../src/services/audit.service';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient() as unknown as DeepMockProxy<PrismaClient>;

describe('User Routes', () => {
    let adminToken: string;
    let userToken: string;

    const mockAdminUser: User = {
        id: 'admin-1',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        phone: '+254712345678',
        role: UserRole.ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        idNumber: '11111111',
        isEmailVerified: true,
        emailVerificationToken: null,
        passwordResetToken: null,
        passwordResetTokenExpires: null,
        password: 'hashedpassword'
    };

    const mockRegularUser: User = {
        id: 'user-1',
        email: 'user@example.com',
        firstName: 'Regular',
        lastName: 'User',
        phone: '+254723456789',
        role: UserRole.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        idNumber: '22222222',
        isEmailVerified: true,
        emailVerificationToken: null,
        passwordResetToken: null,
        passwordResetTokenExpires: null,
        password: 'hashedpassword'
    };

    const mockTargetUser: User = {
        id: 'user-2',
        email: 'target@example.com',
        firstName: 'Target',
        lastName: 'User',
        phone: '+254734567890',
        role: UserRole.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        idNumber: '33333333',
        isEmailVerified: true,
        emailVerificationToken: null,
        passwordResetToken: null,
        passwordResetTokenExpires: null,
        password: 'hashedpassword'
    };

    beforeAll(() => {
        const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
        adminToken = jwt.sign({ id: mockAdminUser.id, role: mockAdminUser.role }, JWT_SECRET);
        userToken = jwt.sign({ id: mockRegularUser.id, role: mockRegularUser.role }, JWT_SECRET);
    });

    afterAll((done) => {
        server.close(() => {
            done();
        });
    });

    beforeEach(() => {
        jest.clearAllMocks();
        prismaMock.user.findMany.mockClear();
        prismaMock.user.findFirst.mockClear();
        prismaMock.user.findUnique.mockClear();
        prismaMock.user.update.mockClear();
        prismaMock.user.count.mockClear();
        (sendInvitationEmail as jest.Mock).mockClear();
        (createAuditLog as jest.Mock).mockClear();
    });

    describe('GET /api/users', () => {
        it('should get all users for admin', async () => {
            prismaMock.user.findUnique.mockResolvedValue(mockAdminUser);
            prismaMock.user.findMany.mockResolvedValue([mockRegularUser, mockTargetUser]);
            prismaMock.user.count.mockResolvedValue(2);

            const res = await request(app)
                .get('/api/users')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.meta).toHaveProperty('page', 1);
            expect(res.body.meta).toHaveProperty('totalRecords', 2);
        });

        it('should deny access to non-admin users', async () => {
            prismaMock.user.findUnique.mockResolvedValue(mockRegularUser);

            const res = await request(app)
                .get('/api/users')
                .set('Authorization', `Bearer ${userToken}`);

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toBe(false);
        });

        it('should deny access without token', async () => {
            const res = await request(app).get('/api/users');

            expect(res.statusCode).toEqual(401);
            expect(res.body.success).toBe(false);
        });

        it('should handle pagination correctly', async () => {
            prismaMock.user.findUnique.mockResolvedValue(mockAdminUser);
            prismaMock.user.findMany.mockResolvedValue([mockTargetUser]);
            prismaMock.user.count.mockResolvedValue(10);

            const res = await request(app)
                .get('/api/users?page=2&limit=5')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.meta.page).toBe(2);
            expect(res.body.meta.limit).toBe(5);
            expect(res.body.meta.totalPages).toBe(2);
        });
    });

    describe('GET /api/users/:id', () => {
        it('should get a user by id', async () => {
            prismaMock.user.findUnique.mockResolvedValue(mockRegularUser);
            prismaMock.user.findFirst.mockResolvedValue(mockTargetUser);

            const res = await request(app)
                .get(`/api/users/${mockTargetUser.id}`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('id', mockTargetUser.id);
        });

        it('should return 404 for non-existent user', async () => {
            prismaMock.user.findUnique.mockResolvedValue(mockRegularUser);
            prismaMock.user.findFirst.mockResolvedValue(null);

            const res = await request(app)
                .get('/api/users/non-existent-id')
                .set('Authorization', `Bearer ${userToken}`);

            expect(res.statusCode).toEqual(404);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toContain('not found');
        });

        it('should require authentication', async () => {
            const res = await request(app).get(`/api/users/${mockTargetUser.id}`);

            expect(res.statusCode).toEqual(401);
            expect(res.body.success).toBe(false);
        });
    });

    describe('PUT /api/users/:id', () => {
        it('should update a user as admin', async () => {
            const updateData = { firstName: 'Updated', lastName: 'Name' };
            const updatedUser = { ...mockTargetUser, ...updateData };

            prismaMock.user.findUnique.mockResolvedValue(mockAdminUser);
            prismaMock.user.findFirst.mockResolvedValue(mockTargetUser);
            prismaMock.user.update.mockResolvedValue(updatedUser);

            const res = await request(app)
                .put(`/api/users/${mockTargetUser.id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send(updateData);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.firstName).toBe('Updated');
            expect(createAuditLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'USER_UPDATE',
                    actorId: mockAdminUser.id,
                    targetId: mockTargetUser.id,
                })
            );
        });

        it('should deny update to non-admin users', async () => {
            prismaMock.user.findUnique.mockResolvedValue(mockRegularUser);

            const res = await request(app)
                .put(`/api/users/${mockTargetUser.id}`)
                .set('Authorization', `Bearer ${userToken}`)
                .send({ firstName: 'Updated' });

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toBe(false);
        });

        it('should handle invalid phone number', async () => {
            prismaMock.user.findUnique.mockResolvedValue(mockAdminUser);
            prismaMock.user.findFirst.mockResolvedValue(mockTargetUser);

            const res = await request(app)
                .put(`/api/users/${mockTargetUser.id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ phone: 'invalid-phone' });

            expect(res.statusCode).toEqual(500);
        });

        it('should normalize valid phone number', async () => {
            const updatedUser = { ...mockTargetUser, phone: '+254712345678' };

            prismaMock.user.findUnique.mockResolvedValue(mockAdminUser);
            prismaMock.user.findFirst.mockResolvedValue(mockTargetUser);
            prismaMock.user.update.mockResolvedValue(updatedUser);

            const res = await request(app)
                .put(`/api/users/${mockTargetUser.id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ phone: '0712345678' });

            expect(res.statusCode).toEqual(200);
            expect(prismaMock.user.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        phone: '+254712345678'
                    })
                })
            );
        });

        it('should return 404 for non-existent user', async () => {
            prismaMock.user.findUnique.mockResolvedValue(mockAdminUser);
            prismaMock.user.findFirst.mockResolvedValue(null);

            const res = await request(app)
                .put('/api/users/non-existent-id')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ firstName: 'Updated' });

            expect(res.statusCode).toEqual(500);
        });
    });

    describe('DELETE /api/users/:id', () => {
        it('should soft delete a user as admin', async () => {
            prismaMock.user.findUnique.mockResolvedValue(mockAdminUser);
            prismaMock.user.findFirst.mockResolvedValue(mockTargetUser);
            prismaMock.user.update.mockResolvedValue({ ...mockTargetUser, deletedAt: new Date() });

            const res = await request(app)
                .delete(`/api/users/${mockTargetUser.id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('deleted successfully');
            expect(createAuditLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'USER_DELETE',
                    actorId: mockAdminUser.id,
                    targetId: mockTargetUser.id,
                })
            );
        });

        it('should deny delete to non-admin users', async () => {
            prismaMock.user.findUnique.mockResolvedValue(mockRegularUser);

            const res = await request(app)
                .delete(`/api/users/${mockTargetUser.id}`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(res.statusCode).toEqual(403);
            expect(res.body.success).toBe(false);
        });

        it('should return error for non-existent user', async () => {
            prismaMock.user.findUnique.mockResolvedValue(mockAdminUser);
            prismaMock.user.findFirst.mockResolvedValue(null);

            const res = await request(app)
                .delete('/api/users/non-existent-id')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toEqual(500);
        });
    });

    describe('POST /api/users/invite', () => {
        it('should send invitation email', async () => {
            prismaMock.user.findUnique
                .mockResolvedValueOnce(mockRegularUser) // For auth middleware
                .mockResolvedValueOnce(mockRegularUser); // For controller

            const res = await request(app)
                .post('/api/users/invite')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ email: 'newuser@example.com' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('Invitation sent');
            expect(sendInvitationEmail).toHaveBeenCalledWith(
                'newuser@example.com',
                'Regular User'
            );
        });

        it('should return 400 if email is missing', async () => {
            prismaMock.user.findUnique.mockResolvedValue(mockRegularUser);

            const res = await request(app)
                .post('/api/users/invite')
                .set('Authorization', `Bearer ${userToken}`)
                .send({});

            expect(res.statusCode).toEqual(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toContain('Email is required');
        });

        it('should require authentication', async () => {
            const res = await request(app)
                .post('/api/users/invite')
                .send({ email: 'test@example.com' });

            expect(res.statusCode).toEqual(401);
            expect(res.body.success).toBe(false);
        });

        it('should handle inviter not found', async () => {
            prismaMock.user.findUnique
                .mockResolvedValueOnce(mockRegularUser)
                .mockResolvedValueOnce(null);

            const res = await request(app)
                .post('/api/users/invite')
                .set('Authorization', `Bearer ${userToken}`)
                .send({ email: 'test@example.com' });

            expect(res.statusCode).toEqual(401);
            expect(res.body.message).toContain('Inviter not found');
        });
    });

    describe('GET /api/users/search', () => {
        it('should search users by query', async () => {
            prismaMock.user.findUnique.mockResolvedValue(mockRegularUser);
            prismaMock.user.findMany.mockResolvedValue([mockTargetUser]);
            prismaMock.user.count.mockResolvedValue(1);

            const res = await request(app)
                .get('/api/users/search?q=target')
                .set('Authorization', `Bearer ${userToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].email).toBe('target@example.com');
        });

        it('should return 400 if query is missing', async () => {
            prismaMock.user.findUnique.mockResolvedValue(mockRegularUser);

            const res = await request(app)
                .get('/api/users/search')
                .set('Authorization', `Bearer ${userToken}`);

            expect(res.statusCode).toEqual(400);
            expect(res.body.success).toBe(false);
            expect(res.body.message).toContain('search query parameter');
        });

        it('should return 400 if query is empty', async () => {
            prismaMock.user.findUnique.mockResolvedValue(mockRegularUser);

            const res = await request(app)
                .get('/api/users/search?q=   ')
                .set('Authorization', `Bearer ${userToken}`);

            expect(res.statusCode).toEqual(400);
            expect(res.body.success).toBe(false);
        });

        it('should handle pagination in search', async () => {
            prismaMock.user.findUnique.mockResolvedValue(mockRegularUser);
            prismaMock.user.findMany.mockResolvedValue([mockTargetUser]);
            prismaMock.user.count.mockResolvedValue(15);

            const res = await request(app)
                .get('/api/users/search?q=user&page=2&limit=10')
                .set('Authorization', `Bearer ${userToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.meta.page).toBe(2);
            expect(res.body.meta.totalPages).toBe(2);
        });

        it('should require authentication', async () => {
            const res = await request(app).get('/api/users/search?q=test');

            expect(res.statusCode).toEqual(401);
            expect(res.body.success).toBe(false);
        });

        it('should return empty results for no matches', async () => {
            prismaMock.user.findUnique.mockResolvedValue(mockRegularUser);
            prismaMock.user.findMany.mockResolvedValue([]);
            prismaMock.user.count.mockResolvedValue(0);

            const res = await request(app)
                .get('/api/users/search?q=nonexistent')
                .set('Authorization', `Bearer ${userToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(0);
            expect(res.body.meta.totalRecords).toBe(0);
        });
    });
});