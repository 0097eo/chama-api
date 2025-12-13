import request from 'supertest';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaClient, User, UserRole, MembershipRole, ContributionStatus, LoanStatus } from '@prisma/client';
import axios from 'axios';
import jwt from 'jsonwebtoken';

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
        },
        TransactionType: {
            CONTRIBUTION: 'CONTRIBUTION',
            LOAN_DISBURSEMENT: 'LOAN_DISBURSEMENT',
            LOAN_REPAYMENT: 'LOAN_REPAYMENT',
            WITHDRAWAL: 'WITHDRAWAL',
            FINE: 'FINE',
        }
    };
});

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

import { app, server } from '../src/server';

const prisma = new PrismaClient() as unknown as DeepMockProxy<PrismaClient>;

describe('M-Pesa Routes', () => {
    let userToken: string;
    let treasurerToken: string;
    let adminToken: string;

    const mockUser: User = {
        id: 'user-1',
        email: 'user@example.com',
        firstName: 'Regular',
        lastName: 'User',
        phone: '+254712345678',
        role: UserRole.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        idNumber: '12345678',
        isEmailVerified: true,
        emailVerificationToken: null,
        passwordResetToken: null,
        passwordResetTokenExpires: null,
        password: 'hashedpassword'
    };

    const mockTreasurer: User = {
        id: 'treasurer-1',
        email: 'treasurer@example.com',
        firstName: 'Treasurer',
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

    const mockAdmin: User = {
        id: 'admin-1',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        phone: '+254734567890',
        role: UserRole.ADMIN,
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

    const mockChama = {
        id: 'chama-1',
        name: 'Test Chama',
        description: 'Test Description',
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockMembership = {
        id: 'membership-1',
        userId: mockUser.id,
        chamaId: mockChama.id,
        role: MembershipRole.MEMBER,
        joinedAt: new Date(),
        user: mockUser,
    };

    const mockTreasurerMembership = {
        id: 'membership-2',
        userId: mockTreasurer.id,
        chamaId: mockChama.id,
        role: MembershipRole.TREASURER,
        joinedAt: new Date(),
        user: mockTreasurer,
    };

    const mockContribution = {
        id: 'contribution-1',
        membershipId: mockMembership.id,
        amount: 1000,
        dueDate: new Date(),
        status: ContributionStatus.PENDING,
        mpesaCheckoutId: null,
        mpesaCode: null,
        paidAt: null,
        paymentMethod: null,
        createdAt: new Date(),
        membership: mockMembership,
    };

    const mockLoan = {
        id: 'loan-1',
        membershipId: mockMembership.id,
        amount: 5000,
        interestRate: 5,
        status: LoanStatus.APPROVED,
        requestedAt: new Date(),
        approvedAt: new Date(),
        disbursedAt: null,
        dueDate: null,
        mpesaB2CRequestId: null,
        membership: mockMembership,
    };

    beforeAll(() => {
        // Set up M-Pesa environment variables
        process.env.MPESA_CONSUMER_KEY = 'test_consumer_key';
        process.env.MPESA_CONSUMER_SECRET = 'test_consumer_secret';
        process.env.MPESA_PASSKEY = 'test_passkey';
        process.env.MPESA_BUSINESS_SHORT_CODE = '174379';
        process.env.MPESA_CALLBACK_URL = 'https://test-api.com';
        process.env.MPESA_API_BASE_URL = 'https://sandbox.safaricom.co.ke';
        process.env.MPESA_ENV = 'sandbox';
        process.env.MPESA_TRANSACTION_TYPE = 'CustomerPayBillOnline';
        process.env.MPESA_B2C_INITIATOR_NAME = 'testapi';
        process.env.MPESA_B2C_SECURITY_CREDENTIAL = 'test_credential';
        process.env.AT_API_KEY = 'test_at_api_key';
        process.env.AT_USERNAME = 'test_at_username';

        const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
        userToken = jwt.sign({ id: mockUser.id, role: mockUser.role }, JWT_SECRET);
        treasurerToken = jwt.sign({ id: mockTreasurer.id, role: mockTreasurer.role }, JWT_SECRET);
        adminToken = jwt.sign({ id: mockAdmin.id, role: mockAdmin.role }, JWT_SECRET);
    });

    afterAll((done) => {
        server.close(() => {
            done();
        });
    });

    beforeEach(() => {
        jest.clearAllMocks();
        prismaMock.user.findUnique.mockClear();
        prismaMock.contribution.findUnique.mockClear();
        prismaMock.contribution.findFirst.mockClear();
        prismaMock.contribution.update.mockClear();
        prismaMock.contribution.updateMany.mockClear();
        prismaMock.contribution.findMany.mockClear();
        prismaMock.loan.findUnique.mockClear();
        prismaMock.loan.findFirst.mockClear();
        prismaMock.loan.update.mockClear();
        prismaMock.loan.findMany.mockClear();
        prismaMock.membership.findFirst.mockClear();
        prismaMock.transaction.create.mockClear();
        mockedAxios.get.mockClear();
        mockedAxios.post.mockClear();
    });

    describe('POST /api/payments/stk-push', () => {
        it('should initiate STK push successfully', async () => {
            // Mock auth
            prismaMock.user.findUnique.mockResolvedValue(mockUser);
            
            // Mock contribution lookup
            prismaMock.contribution.findUnique.mockResolvedValue({
                ...mockContribution,
                membership: mockMembership,
            } as any);

            // Mock M-Pesa token request
            mockedAxios.get.mockResolvedValue({
                data: {
                    access_token: 'test_token',
                    expires_in: 3599,
                },
            });

            // Mock STK push request
            mockedAxios.post.mockResolvedValue({
                data: {
                    MerchantRequestID: 'merchant-123',
                    CheckoutRequestID: 'checkout-123',
                    ResponseCode: '0',
                    ResponseDescription: 'Success',
                    CustomerMessage: 'Success',
                },
            });

            // Mock contribution update
            prismaMock.contribution.update.mockResolvedValue({
                ...mockContribution,
                mpesaCheckoutId: 'checkout-123',
            } as any);

            const res = await request(app)
                .post('/api/payments/stk-push')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    amount: 1000,
                    phone: '254712345678',
                    contributionId: mockContribution.id,
                });

            expect(res.statusCode).toEqual(200);
            expect(res.body.message).toContain('STK Push initiated successfully');
            expect(res.body.data).toHaveProperty('CheckoutRequestID', 'checkout-123');
        });

        it('should require authentication', async () => {
            const res = await request(app)
                .post('/api/payments/stk-push')
                .send({
                    amount: 1000,
                    phone: '254712345678',
                    contributionId: mockContribution.id,
                });

            expect(res.statusCode).toEqual(401);
            expect(res.body.success).toBe(false);
        });

        it('should validate required fields', async () => {
            prismaMock.user.findUnique.mockResolvedValue(mockUser);

            const res = await request(app)
                .post('/api/payments/stk-push')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    amount: 1000,
                    // Missing phone and contributionId
                });

            expect(res.statusCode).toEqual(400);
            expect(res.body.message).toContain('required');
        });

        it('should deny payment for other users contributions', async () => {
            const otherUserMembership = { ...mockMembership, userId: 'other-user' };
            
            prismaMock.user.findUnique.mockResolvedValue(mockUser);
            prismaMock.contribution.findUnique.mockResolvedValue({
                ...mockContribution,
                membership: otherUserMembership,
            } as any);

            const res = await request(app)
                .post('/api/payments/stk-push')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    amount: 1000,
                    phone: '254712345678',
                    contributionId: mockContribution.id,
                });

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toContain('Permission Denied');
        });

        it('should prevent payment for already paid contributions', async () => {
            prismaMock.user.findUnique.mockResolvedValue(mockUser);
            prismaMock.contribution.findUnique.mockResolvedValue({
                ...mockContribution,
                status: ContributionStatus.PAID,
                membership: mockMembership,
            } as any);

            const res = await request(app)
                .post('/api/payments/stk-push')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    amount: 1000,
                    phone: '254712345678',
                    contributionId: mockContribution.id,
                });

            expect(res.statusCode).toEqual(409);
            expect(res.body.message).toContain('already been paid');
        });

        it('should handle M-Pesa API errors', async () => {
            prismaMock.user.findUnique.mockResolvedValue(mockUser);
            prismaMock.contribution.findUnique.mockResolvedValue({
                ...mockContribution,
                membership: mockMembership,
            } as any);

            mockedAxios.get.mockResolvedValue({
                data: { access_token: 'test_token', expires_in: 3599 },
            });

            mockedAxios.post.mockRejectedValue({
                isAxiosError: true,
                response: {
                    data: {
                        errorCode: '500.001.1001',
                        errorMessage: 'Invalid Access Token',
                    },
                },
            });

            const res = await request(app)
                .post('/api/payments/stk-push')
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    amount: 1000,
                    phone: '254712345678',
                    contributionId: mockContribution.id,
                });

            expect(res.statusCode).toEqual(500);
        });
    });

    describe('POST /api/payments/callback', () => {
        it('should handle successful payment callback', async () => {
            const callbackPayload = {
                Body: {
                    stkCallback: {
                        MerchantRequestID: 'merchant-123',
                        CheckoutRequestID: 'checkout-123',
                        ResultCode: 0,
                        ResultDesc: 'The service request is processed successfully.',
                        CallbackMetadata: {
                            Item: [
                                { Name: 'Amount', Value: 1000 },
                                { Name: 'MpesaReceiptNumber', Value: 'QGH12345' },
                                { Name: 'TransactionDate', Value: 20231215120000 },
                                { Name: 'PhoneNumber', Value: 254712345678 },
                            ],
                        },
                    },
                },
            };

            prismaMock.contribution.updateMany.mockResolvedValue({ count: 1 });

            const res = await request(app)
                .post('/api/payments/callback')
                .send(callbackPayload);

            expect(res.statusCode).toEqual(200);
            expect(res.body.ResultCode).toBe(0);
            expect(res.body.ResultDesc).toBe('Accepted');

            // Wait for async processing
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(prismaMock.contribution.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { mpesaCheckoutId: 'checkout-123' },
                    data: expect.objectContaining({
                        status: 'PAID',
                        mpesaCode: 'QGH12345',
                        paymentMethod: 'M-PESA',
                    }),
                })
            );
        });

        it('should handle failed payment callback', async () => {
            const callbackPayload = {
                Body: {
                    stkCallback: {
                        MerchantRequestID: 'merchant-123',
                        CheckoutRequestID: 'checkout-123',
                        ResultCode: 1032,
                        ResultDesc: 'Request cancelled by user',
                    },
                },
            };

            const res = await request(app)
                .post('/api/payments/callback')
                .send(callbackPayload);

            expect(res.statusCode).toEqual(200);
            expect(res.body.ResultCode).toBe(0);
            
            // Wait for async processing
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(prismaMock.contribution.updateMany).not.toHaveBeenCalled();
        });

        it('should handle invalid callback structure', async () => {
            const res = await request(app)
                .post('/api/payments/callback')
                .send({ invalid: 'data' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.ResultCode).toBe(0);
        });
    });

    describe('GET/POST /api/payments/callback (acknowledgement)', () => {
        it('should acknowledge Safaricom ping', async () => {
            const res = await request(app).get('/api/payments/callback');

            expect(res.statusCode).toEqual(200);
            expect(res.body.ResultCode).toBe(0);
            expect(res.body.ResultDesc).toBe('Accepted');
        });
    });

    describe('GET /api/payments/status/:checkoutRequestId', () => {
        it('should check STK status successfully', async () => {
            prismaMock.user.findUnique.mockResolvedValue(mockUser);
            prismaMock.contribution.findFirst.mockResolvedValue({
                ...mockContribution,
                mpesaCheckoutId: 'checkout-123',
                membership: mockMembership,
            } as any);
            prismaMock.membership.findFirst.mockResolvedValue(mockMembership as any);

            mockedAxios.get.mockResolvedValue({
                data: { access_token: 'test_token', expires_in: 3599 },
            });

            mockedAxios.post.mockResolvedValue({
                data: {
                    ResponseCode: '0',
                    ResponseDescription: 'The service request has been accepted successfully',
                    MerchantRequestID: 'merchant-123',
                    CheckoutRequestID: 'checkout-123',
                    ResultCode: '0',
                    ResultDesc: 'The service request is processed successfully.',
                },
            });

            const res = await request(app)
                .get('/api/payments/status/checkout-123')
                .set('Authorization', `Bearer ${userToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.data).toHaveProperty('CheckoutRequestID', 'checkout-123');
        });

        it('should return 404 for non-existent transaction', async () => {
            prismaMock.user.findUnique.mockResolvedValue(mockUser);
            prismaMock.contribution.findFirst.mockResolvedValue(null);

            const res = await request(app)
                .get('/api/payments/status/invalid-checkout')
                .set('Authorization', `Bearer ${userToken}`);

            expect(res.statusCode).toEqual(404);
            expect(res.body.message).toContain('not found');
        });

        it('should deny access to non-members', async () => {
            prismaMock.user.findUnique.mockResolvedValue(mockUser);
            prismaMock.contribution.findFirst.mockResolvedValue({
                ...mockContribution,
                mpesaCheckoutId: 'checkout-123',
                membership: mockMembership,
            } as any);
            prismaMock.membership.findFirst.mockResolvedValue(null);

            const res = await request(app)
                .get('/api/payments/status/checkout-123')
                .set('Authorization', `Bearer ${userToken}`);

            expect(res.statusCode).toEqual(403);
            expect(res.body.message).toContain('not a member');
        });
    });

    
    describe('POST /api/payments/b2c-result', () => {
        it('should handle successful B2C result', async () => {
            const b2cResultPayload = {
                Result: {
                    ResultType: 0,
                    ResultCode: 0,
                    ResultDesc: 'The service request is processed successfully.',
                    OriginatorConversationID: 'orig-123',
                    ConversationID: 'conv-123',
                    TransactionID: 'trans-123',
                    ResultParameters: {
                        ResultParameter: [
                            { Key: 'TransactionAmount', Value: 5000 },
                            { Key: 'TransactionReceipt', Value: 'QGH67890' },
                            { Key: 'B2CRecipientIsRegisteredCustomer', Value: 'Y' },
                        ],
                    },
                },
            };

            prismaMock.loan.findFirst.mockResolvedValue({
                ...mockLoan,
                mpesaB2CRequestId: 'conv-123',
                membership: mockMembership,
            } as any);

            const mockTransaction = jest.fn();
            prismaMock.$transaction.mockImplementation(async (callback: any) => {
                return callback({
                    loan: {
                        update: jest.fn().mockResolvedValue({
                            ...mockLoan,
                            status: LoanStatus.ACTIVE,
                        }),
                    },
                    transaction: {
                        create: mockTransaction.mockResolvedValue({}),
                    },
                });
            });

            const res = await request(app)
                .post('/api/payments/b2c-result')
                .send(b2cResultPayload);

            expect(res.statusCode).toEqual(200);
            expect(res.body.ResultCode).toBe(0);

            // Wait for async processing
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(prismaMock.$transaction).toHaveBeenCalled();
        });

        it('should handle failed B2C result', async () => {
            const b2cResultPayload = {
                Result: {
                    ResultType: 0,
                    ResultCode: 2001,
                    ResultDesc: 'The initiator information is invalid.',
                    OriginatorConversationID: 'orig-123',
                    ConversationID: 'conv-123',
                    TransactionID: 'trans-123',
                },
            };

            prismaMock.loan.findFirst.mockResolvedValue({
                ...mockLoan,
                mpesaB2CRequestId: 'conv-123',
            } as any);

            const res = await request(app)
                .post('/api/payments/b2c-result')
                .send(b2cResultPayload);

            expect(res.statusCode).toEqual(200);

            // Wait for async processing
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(prismaMock.$transaction).not.toHaveBeenCalled();
        });

        it('should handle B2C result for unknown loan', async () => {
            const b2cResultPayload = {
                Result: {
                    ResultType: 0,
                    ResultCode: 0,
                    ResultDesc: 'Success',
                    ConversationID: 'unknown-conv',
                },
            };

            prismaMock.loan.findFirst.mockResolvedValue(null);

            const res = await request(app)
                .post('/api/payments/b2c-result')
                .send(b2cResultPayload);

            expect(res.statusCode).toEqual(200);
        });
    });

    describe('POST /api/payments/b2c-timeout', () => {
        it('should handle B2C timeout', async () => {
            const timeoutPayload = {
                Result: {
                    ResultType: 0,
                    ResultCode: 1,
                    ResultDesc: 'The balance is insufficient for the transaction',
                    OriginatorConversationID: 'orig-123',
                    ConversationID: 'conv-123',
                    TransactionID: 'trans-123',
                },
            };

            prismaMock.loan.findFirst.mockResolvedValue({
                ...mockLoan,
                mpesaB2CRequestId: 'conv-123',
            } as any);

            prismaMock.loan.update.mockResolvedValue({
                ...mockLoan,
                status: LoanStatus.APPROVED,
                mpesaB2CRequestId: null,
            } as any);

            const res = await request(app)
                .post('/api/payments/b2c-timeout')
                .send(timeoutPayload);

            expect(res.statusCode).toEqual(200);
            expect(res.body.ResultCode).toBe(0);

            // Wait for async processing
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(prismaMock.loan.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: mockLoan.id },
                    data: expect.objectContaining({
                        status: LoanStatus.APPROVED,
                        mpesaB2CRequestId: null,
                    }),
                })
            );
        });

        it('should handle timeout for unknown conversation', async () => {
            const timeoutPayload = {
                Result: {
                    ConversationID: 'unknown-conv',
                },
            };

            prismaMock.loan.findFirst.mockResolvedValue(null);

            const res = await request(app)
                .post('/api/payments/b2c-timeout')
                .send(timeoutPayload);

            expect(res.statusCode).toEqual(200);
        });
    });

    describe('GET /api/payments/transactions/:chamaId', () => {
        
        it('should deny access to non-members', async () => {
            prismaMock.user.findUnique.mockResolvedValue(mockUser);
            prismaMock.membership.findFirst.mockResolvedValue(null);          

            const res = await request(app)
                .get(`/api/payments/transactions/${mockChama.id}`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(res.statusCode).toEqual(403);
        });
    });
});