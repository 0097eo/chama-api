import { PrismaClient, Loan, LoanStatus, Membership, User, Chama, Contribution, MembershipRole, Prisma } from '@prisma/client';
import { addMonths } from 'date-fns';
import * as loanService from '../src/services/loan.service';
import { createAuditLog } from '../src/services/audit.service';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import loanRoutes from '../src/routes/loan.routes';
import { errorHandler } from '../src/middleware/error.middleware';

jest.mock('../src/services/audit.service', () => ({
    createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

// Mock the auth middleware
jest.mock('../src/middleware/auth.middleware', () => ({
    protect: (req: Request, res: Response, next: NextFunction) => {
        (req as any).user = { id: 'user1' };
        next();
    }
}));

// Mock Prisma module
jest.mock('@prisma/client', () => {
    const mockPrisma = {
        loan: {
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            findMany: jest.fn(),
            aggregate: jest.fn(),
        },
        contribution: {
            aggregate: jest.fn(),
        },
        membership: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
        },
        loanPayment: {
            create: jest.fn(),
        },
        $transaction: jest.fn(),
    };
    return {
        PrismaClient: jest.fn(() => mockPrisma),
        LoanStatus: {
            PENDING: 'PENDING',
            APPROVED: 'APPROVED',
            REJECTED: 'REJECTED',
            ACTIVE: 'ACTIVE',
            PAID: 'PAID',
            DEFAULTED: 'DEFAULTED',
        },
        MembershipRole: {
            ADMIN: 'ADMIN',
            MEMBER: 'MEMBER',
            TREASURER: 'TREASURER'
        },
        TransactionType: {
            CONTRIBUTION: 'CONTRIBUTION',
            LOAN_DISBURSEMENT: 'LOAN_DISBURSEMENT',
            LOAN_REPAYMENT: 'LOAN_REPAYMENT',
            EXPENSE: 'EXPENSE',
            OTHER: 'OTHER',
        },
        AuditAction: {
            LOAN_APPLY: 'LOAN_APPLY',
            LOAN_APPROVE: 'LOAN_APPROVE',
            LOAN_REJECT: 'LOAN_REJECT',
            LOAN_REPAYMENT: 'LOAN_REPAYMENT',
            LOAN_RESTRUCTURE: 'LOAN_RESTRUCTURE',
            LOAN_DISBURSE: 'LOAN_DISBURSE',
        },
        Prisma: {
            Decimal: jest.fn((value) => ({
                _d: [Number(value)],
                toString: () => String(value),
            })),
        },
    };
});

const prisma = new PrismaClient() as unknown as PrismaClient;

const app = express();
app.use(express.json());
app.use('/loans', loanRoutes);
app.use(errorHandler);

// Mock data
let mockUsers: User[];
let mockChamas: Chama[];
let mockMemberships: Membership[];
let mockContributions: Contribution[];
let mockLoans: Loan[];
let mockLoanPayments: any[];

beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock data before each test
    mockUsers = [
        { 
            id: 'user1', 
            email: 'user1@example.com', 
            firstName: 'John', 
            lastName: 'Doe', 
            password: 'password1', 
            phone: '1234567890',
            idNumber: 'ID123456',
            role: 'USER' as any,
            isEmailVerified: true,
            emailVerificationToken: null,
            passwordResetToken: null,
            passwordResetTokenExpires: null,
            createdAt: new Date(), 
            updatedAt: new Date(),
            deletedAt: null,
        },
        { 
            id: 'user2', 
            email: 'user2@example.com', 
            firstName: 'Jane', 
            lastName: 'Doe', 
            password: 'password2', 
            phone: '0987654321',
            idNumber: 'ID789012',
            role: 'USER' as any,
            isEmailVerified: true,
            emailVerificationToken: null,
            passwordResetToken: null,
            passwordResetTokenExpires: null,
            createdAt: new Date(), 
            updatedAt: new Date(),
            deletedAt: null,
        },
    ];

    mockChamas = [
        { 
            id: 'chama1', 
            name: 'Test Chama', 
            description: null,
            registrationNumber: null,
            totalMembers: 1,
            monthlyContribution: 1000,
            meetingDay: 'Monday',
            constitutionUrl: null,
            createdAt: new Date(),
        },
    ];

    mockMemberships = [
        { 
            id: 'membership1', 
            userId: 'user1', 
            chamaId: 'chama1', 
            role: MembershipRole.ADMIN,
            isActive: true,
            joinedAt: new Date(),
        },
        { 
            id: 'membership2', 
            userId: 'user2', 
            chamaId: 'chama1', 
            role: MembershipRole.MEMBER,
            isActive: true,
            joinedAt: new Date(),
        },
    ];

    mockContributions = [
        { 
            id: 'contrib1', 
            amount: 5000, 
            membershipId: 'membership1', 
            paidAt: new Date(), 
            status: 'PAID' as any,
            mpesaCheckoutId: null,
            month: 1,
            year: 2024,
            paymentMethod: 'MPESA',
            mpesaCode: null,
            penaltyApplied: null,
        },
        { 
            id: 'contrib2', 
            amount: 10000, 
            membershipId: 'membership2', 
            paidAt: new Date(), 
            status: 'PAID' as any,
            mpesaCheckoutId: null,
            month: 1,
            year: 2024,
            paymentMethod: 'MPESA',
            mpesaCode: null,
            penaltyApplied: null,
        },
    ];

    mockLoans = [];
    mockLoanPayments = [];
});

describe('Loan Module', () => {
    describe('Loan Service', () => {
        describe('calculateEligibility', () => {
            it('should determine a member is eligible if they request less than or equal to their max loanable amount', async () => {
                const requestedAmount = 15000;
                const expectedMaxLoanable = 5000 * 3; // 15000
    
                (prisma.contribution.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 5000 } });
    
                const { isEligible, maxLoanable } = await loanService.calculateEligibility('membership1', requestedAmount);
    
                expect(isEligible).toBe(true);
                expect(maxLoanable).toEqual(expectedMaxLoanable);
            });
    
            it('should determine a member is ineligible if they request more than their max loanable amount', async () => {
                const requestedAmount = 20000;
                const expectedMaxLoanable = 5000 * 3; // 15000
    
                (prisma.contribution.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 5000 } });
    
                const { isEligible, maxLoanable } = await loanService.calculateEligibility('membership1', requestedAmount);
    
                expect(isEligible).toBe(false);
                expect(maxLoanable).toEqual(expectedMaxLoanable);
            });
        });
    
        describe('generateRepaymentSchedule', () => {
            it('should generate a correct flat-rate interest repayment schedule', () => {
                const loan: Loan = {
                    id: 'loan1',
                    amount: 12000,
                    interestRate: 0.1,
                    duration: 12,
                    status: LoanStatus.ACTIVE,
                    membershipId: 'membership1',
                    approvedAt: new Date('2023-01-01'),
                    disbursedAt: new Date('2023-01-01'),
                    repaymentAmount: 13200,
                    monthlyInstallment: 1100,
                    isRestructured: false,
                    restructureNotes: null,
                    dueDate: addMonths(new Date('2023-01-01'), 1),
                    appliedAt: new Date('2022-12-01'),
                    purpose: 'Business',
                    mpesaB2CRequestId: null,
                };
    
                const schedule = loanService.generateRepaymentSchedule(loan);
    
                expect(schedule.length).toBe(12);
                expect(schedule[0].payment).toBe(1100);
                expect(schedule[11].balance).toBeCloseTo(0);
            });
        });
    
        describe('applyForLoan', () => {
            it('should successfully apply for a loan if eligible', async () => {
                const loanData = {
                    amount: 10000,
                    duration: 12,
                    purpose: 'Business',
                    interestRate: 0.1,
                    membership: { connect: { id: 'membership1' } },
                };
                const newLoan = { 
                    id: 'loan1', 
                    amount: loanData.amount,
                    interestRate: loanData.interestRate,
                    duration: loanData.duration,
                    purpose: loanData.purpose,
                    status: LoanStatus.PENDING,
                    membershipId: 'membership1',
                    approvedAt: null,
                    disbursedAt: null,
                    repaymentAmount: 0,
                    monthlyInstallment: 0,
                    isRestructured: false,
                    restructureNotes: null,
                    dueDate: null,
                    appliedAt: expect.any(Date),
                    mpesaB2CRequestId: null,
                };
    
                (prisma.membership.findFirst as jest.Mock).mockResolvedValue({
                    ...mockMemberships[0],
                    chamaId: 'chama1'
                });
                (prisma.contribution.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 5000 } });
                (prisma.loan.create as jest.Mock).mockResolvedValue(newLoan);
    
    
                const result = await loanService.applyForLoan(loanData, 'membership1', 'user1', {});
    
                expect(result).toEqual(newLoan);
                expect(createAuditLog).toHaveBeenCalled();
            });
    
            it('should throw an error if member is not eligible', async () => {
                const loanData = {
                    amount: 20000,
                    duration: 12,
                    purpose: 'Business',
                    interestRate: 0.1,
                    membership: { connect: { id: 'membership1' } },
                };
    
                (prisma.membership.findFirst as jest.Mock).mockResolvedValue(mockMemberships[0]);
                (prisma.contribution.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 5000 } });
    
                await expect(loanService.applyForLoan(loanData, 'membership1', 'user1', {})).rejects.toThrow('Loan application rejected.');
            });
        });
    
        describe('approveOrRejectLoan', () => {
            it('should approve a pending loan', async () => {
                const loan: Loan & { membership: { chamaId: string } } = {
                    id: 'loan1',
                    amount: 10000,
                    interestRate: 0.1,
                    duration: 10,
                    disbursedAt: null,
                    status: LoanStatus.PENDING,
                    membershipId: 'membership1',
                    approvedAt: null,
                    repaymentAmount: 0,
                    monthlyInstallment: 0,
                    isRestructured: false,
                    restructureNotes: null,
                    dueDate: null,
                    appliedAt: new Date(),
                    purpose: 'Business',
                    mpesaB2CRequestId: null,
                    membership: { chamaId: 'chama1' }
                };
                const updatedLoan = { ...loan, status: LoanStatus.APPROVED, approvedAt: expect.any(Date) };
                (prisma.loan.findUnique as jest.Mock).mockResolvedValue(loan);
                (prisma.loan.update as jest.Mock).mockResolvedValue(updatedLoan);
    
    
                const result = await loanService.approveOrRejectLoan('loan1', LoanStatus.APPROVED, 'user1', {});
                expect(result.status).toBe(LoanStatus.APPROVED);
                expect(createAuditLog).toHaveBeenCalled();
            });
    
            it('should reject a pending loan', async () => {
                const loan: Loan & { membership: { chamaId: string } } = {
                    id: 'loan1',
                    amount: 10000,
                    interestRate: 0.1,
                    duration: 10,
                    disbursedAt: null,
                    status: LoanStatus.PENDING,
                    membershipId: 'membership1',
                    approvedAt: null,
                    repaymentAmount: 0,
                    monthlyInstallment: 0,
                    isRestructured: false,
                    restructureNotes: null,
                    dueDate: null,
                    appliedAt: new Date(),
                    purpose: 'Business',
                    mpesaB2CRequestId: null,
                    membership: { chamaId: 'chama1' }
                };
                const updatedLoan = { ...loan, status: LoanStatus.REJECTED };
    
                (prisma.loan.findUnique as jest.Mock).mockResolvedValue(loan);
                (prisma.loan.update as jest.Mock).mockResolvedValue(updatedLoan);
    
                const result = await loanService.approveOrRejectLoan('loan1', LoanStatus.REJECTED, 'user1', {});
                expect(result.status).toBe(LoanStatus.REJECTED);
                expect(createAuditLog).toHaveBeenCalled();
            });
        });
    
        describe('disburseLoan', () => {
            it('should disburse an approved loan', async () => {
                const loan: Loan & { membership: { chamaId: string } } = { 
                    id: 'loan1', 
                    amount: 10000, 
                    interestRate: 0.1,
                    duration: 12,
                    approvedAt: new Date(),
                    repaymentAmount: 11000,
                    monthlyInstallment: 916.67,
                    isRestructured: false,
                    restructureNotes: null,
                    dueDate: new Date(),
                    appliedAt: new Date(),
                    purpose: 'Business',
                    mpesaB2CRequestId: null,
                    status: LoanStatus.APPROVED,
                    membershipId: 'membership1',
                    disbursedAt: null,
                    membership: { chamaId: 'chama1' }
                };
                const updatedLoan = { ...loan, status: LoanStatus.ACTIVE, disbursedAt: expect.any(Date) };
    
                (prisma.loan.findUnique as jest.Mock).mockResolvedValue(loan);
                (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
                    const tx = {
                        loan: {
                            update: jest.fn().mockResolvedValue(updatedLoan),
                        },
                        transaction: {
                            create: jest.fn().mockResolvedValue({}),
                        },
                    };
                    return await callback(tx);
                });
    
                const result = await loanService.disburseLoan('loan1', 'user1', {});
                expect(result.status).toBe(LoanStatus.ACTIVE);
                expect(createAuditLog).toHaveBeenCalled();
            });
    
            it('should throw an error if loan is not approved', async () => {
                const loan: Loan = { 
                    id: 'loan1', 
                    amount: 10000, 
                    interestRate: 0.1,
                    duration: 12,
                    approvedAt: null,
                    repaymentAmount: 11000,
                    monthlyInstallment: 916.67,
                    isRestructured: false,
                    restructureNotes: null,
                    dueDate: new Date(),
                    appliedAt: new Date(),
                    purpose: 'Business',
                    mpesaB2CRequestId: null,
                    status: LoanStatus.PENDING,
                    membershipId: 'membership1',
                    disbursedAt: null,
                };
                (prisma.loan.findUnique as jest.Mock).mockResolvedValue(loan);
    
                await expect(loanService.disburseLoan('loan1', 'user1', {})).rejects.toThrow('Loan must be approved before disbursement.');
            });
        });
    
        describe('recordLoanPayment', () => {
            it('should record a payment and update loan status if fully paid', async () => {
                const loan: Loan & { payments: { amount: number }[], membership: { chamaId: string } } = {
                    id: 'loan1',
                    status: LoanStatus.ACTIVE,
                    repaymentAmount: 10000,
                    payments: [{ amount: 9000 }],
                    membershipId: 'membership1',
                    amount: 10000,
                    interestRate: 0.1,
                    duration: 10,
                    approvedAt: new Date(),
                    disbursedAt: new Date(),
                    monthlyInstallment: 1000,
                    isRestructured: false,
                    restructureNotes: null,
                    dueDate: new Date(),
                    appliedAt: new Date(),
                    purpose: 'Business',
                    mpesaB2CRequestId: null,
                    membership: { chamaId: 'chama1' }
                };
                const paymentData = { 
                    amount: 1000, 
                    paidAt: new Date(),
                    paymentMethod: 'MPESA'
                };
    
                (prisma.loan.findUnique as jest.Mock).mockResolvedValue(loan);
                (prisma.loanPayment.create as jest.Mock).mockResolvedValue({});
                (prisma.loan.update as jest.Mock).mockResolvedValue({ ...loan, status: LoanStatus.PAID });
    
                await loanService.recordLoanPayment('loan1', paymentData, 'user1', {});
    
                expect(prisma.loanPayment.create).toHaveBeenCalled();
                expect(prisma.loan.update).toHaveBeenCalledWith({
                    where: { id: 'loan1' },
                    data: { status: LoanStatus.PAID, dueDate: null }
                });
                expect(createAuditLog).toHaveBeenCalled();
            });
        });
    
        describe('findLoanDefaulters', () => {
            it('should find loans that are past their due date', async () => {
                const defaulters: Loan[] = [{ 
                    id: 'loan1', 
                    dueDate: new Date('2022-01-01'),
                    amount: 10000,
                    interestRate: 0.1,
                    duration: 12,
                    approvedAt: new Date(),
                    repaymentAmount: 11000,
                    monthlyInstallment: 916.67,
                    isRestructured: false,
                    restructureNotes: null,
                    appliedAt: new Date(),
                    purpose: 'Business',
                    mpesaB2CRequestId: null,
                    status: LoanStatus.ACTIVE,
                    membershipId: 'membership1',
                    disbursedAt: new Date('2022-01-01'),
                }];
                (prisma.loan.findMany as jest.Mock).mockResolvedValue(defaulters);
    
                const result = await loanService.findLoanDefaulters('chama1');
    
                expect(result.length).toBe(1);
                expect(result[0].id).toBe('loan1');
            });
        });
    
        describe('restructureLoan', () => {
            it('should restructure a loan with new terms', async () => {
                const loan: Loan & { membership: { chamaId: string } } = { 
                    id: 'loan1', 
                    amount: 10000, 
                    interestRate: 0.1, 
                    duration: 10, 
                    membershipId: 'membership1',
                    approvedAt: new Date(),
                    disbursedAt: new Date(),
                    repaymentAmount: 11000,
                    monthlyInstallment: 1100,
                    isRestructured: false,
                    restructureNotes: null,
                    dueDate: new Date(),
                    appliedAt: new Date(),
                    purpose: 'Business',
                    mpesaB2CRequestId: null,
                    status: LoanStatus.ACTIVE,
                    membership: { chamaId: 'chama1' }
                };
                const restructureData = { newInterestRate: 0.12, newDuration: 12, notes: 'Agreed with member' };
                const updatedLoan = { 
                    ...loan, 
                    interestRate: 0.12, 
                    duration: 12, 
                    isRestructured: true, 
                    restructureNotes: restructureData.notes 
                };
    
                (prisma.loan.findUnique as jest.Mock).mockResolvedValue(loan);
                (prisma.loan.update as jest.Mock).mockResolvedValue(updatedLoan);
    
                const result = await loanService.restructureLoan('loan1', restructureData, 'user1', {});
    
                expect(result.interestRate).toBe(0.12);
                expect(result.duration).toBe(12);
                expect(createAuditLog).toHaveBeenCalled();
            });
        });
    });

    describe('Loan API Integration tests', () => {
        const loan = {
            id: 'loan1',
            amount: 10000,
            status: LoanStatus.PENDING,
            membershipId: 'membership1',
            membership: { 
                chamaId: 'chama1',
                userId: 'user1',
            }
        };

        beforeEach(() => {
            // Default mocks for most tests
            (prisma.loan.findUnique as jest.Mock).mockResolvedValue(loan);
            (prisma.loan.update as jest.Mock).mockImplementation(async ({ data }: any) => ({
                ...loan,
                ...data,
            }));
        });
        describe('POST /loans', () => {
            it('should apply for a loan successfully', async () => {
                const loanData = {
                    membershipId: 'membership1',
                    amount: 10000,
                    duration: 12,
                    purpose: 'Business',
                    interestRate: 0.1,
                };

                const newLoan = { 
                    id: 'loan1', 
                    amount: 10000,
                    duration: 12,
                    purpose: 'Business',
                    interestRate: 0.1,
                    status: LoanStatus.PENDING,
                    membershipId: 'membership1',
                    approvedAt: null,
                    disbursedAt: null,
                    repaymentAmount: 0,
                    monthlyInstallment: 0,
                    isRestructured: false,
                    restructureNotes: null,
                    dueDate: null,
                    appliedAt: new Date(),
                    mpesaB2CRequestId: null,
                };

                (prisma.membership.findFirst as jest.Mock).mockResolvedValue(mockMemberships[0]);
                (prisma.contribution.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 5000 } });
                (prisma.loan.create as jest.Mock).mockResolvedValue(newLoan);

                const res = await request(app)
                    .post('/loans')
                    .send(loanData)
                    .expect(201);

                expect(res.body.message).toBe('Loan application submitted successfully.');
                expect(res.body.data).toMatchObject({
                    id: 'loan1',
                    amount: 10000,
                    status: LoanStatus.PENDING,
                });
            });

            it('should return 400 if member is not eligible', async () => {
                const loanData = {
                    membershipId: 'membership1',
                    amount: 20000,
                    duration: 12,
                    purpose: 'Business',
                    interestRate: 0.1,
                };

                (prisma.membership.findFirst as jest.Mock).mockResolvedValue(mockMemberships[0]);
                (prisma.contribution.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 5000 } });

                const res = await request(app)
                    .post('/loans')
                    .send(loanData)
                    .expect(400);

                expect(res.body.message).toContain('Loan application rejected');
            });
        });

        describe('GET /loans/:id', () => {
            it('should get loan details for the owner', async () => {
                const loan = {
                    id: 'loan1',
                    amount: 10000,
                    status: LoanStatus.ACTIVE,
                    membershipId: 'membership1',
                    membership: {
                        userId: 'user1',
                        chamaId: 'chama1',
                        user: mockUsers[0]
                    },
                    payments: [],
                };

                (prisma.loan.findUnique as jest.Mock).mockResolvedValue(loan);
                (prisma.membership.findUnique as jest.Mock).mockResolvedValue({ role: MembershipRole.ADMIN, isActive: true });

                const res = await request(app)
                    .get('/loans/loan1')
                    .expect(200);

                expect(res.body.data.id).toBe('loan1');
                expect(res.body.data.amount).toBe(10000);
            });

            it('should return 404 if loan not found', async () => {
                (prisma.loan.findUnique as jest.Mock).mockResolvedValue(null);

                const res = await request(app)
                    .get('/loans/nonexistent')
                    .expect(404);

                expect(res.body.message).toBe('Loan not found.');
            });

            it('should return 403 if user is not authorized', async () => {
                const loan = {
                    id: 'loan1',
                    amount: 10000,
                    status: LoanStatus.ACTIVE,
                    membershipId: 'membership2', // Belongs to user2
                    membership: {
                        userId: 'user2',
                        chamaId: 'chama1',
                        user: mockUsers[1]
                    },
                    payments: [],
                };

                (prisma.loan.findUnique as jest.Mock).mockResolvedValue(loan);
                // user1 (the requester) has no membership in this context for the check
                (prisma.membership.findUnique as jest.Mock).mockResolvedValue(null);

                const res = await request(app)
                    .get('/loans/loan1')
                    .expect(403);

                expect(res.body.message).toContain('Permission Denied: You are not authorized to view this loan.');
            });
        });

        describe('PUT /loans/:id/approve', () => {
            it('should approve a loan if user is an ADMIN', async () => {
                (prisma.membership.findUnique as jest.Mock).mockResolvedValue({ role: MembershipRole.ADMIN, isActive: true });

                const res = await request(app)
                    .put('/loans/loan1/approve')
                    .send({ status: LoanStatus.APPROVED })
                    .expect(200);

                expect(res.body.message).toBe('Loan status updated successfully.');
                expect(res.body.data.status).toBe(LoanStatus.APPROVED);
            });

            it('should approve a loan if user is a TREASURER', async () => {
                (prisma.membership.findUnique as jest.Mock).mockResolvedValue({ role: MembershipRole.TREASURER, isActive: true });

                const res = await request(app)
                    .put('/loans/loan1/approve')
                    .send({ status: LoanStatus.APPROVED })
                    .expect(200);

                expect(res.body.message).toBe('Loan status updated successfully.');
                expect(res.body.data.status).toBe(LoanStatus.APPROVED);
            });

            it('should NOT approve a loan if user is a MEMBER', async () => {
                (prisma.membership.findUnique as jest.Mock).mockResolvedValue({ role: MembershipRole.MEMBER, isActive: true });

                const res = await request(app)
                    .put('/loans/loan1/approve')
                    .send({ status: LoanStatus.APPROVED })
                    .expect(403);

                expect(res.body.message).toContain('Access Denied');
            });
        });

        describe('PUT /loans/:id/disburse', () => {
            const approvedLoan = { ...loan, status: LoanStatus.APPROVED };
            const activeLoan = { ...loan, status: LoanStatus.ACTIVE };
            
            beforeEach(() => {
                (prisma.loan.findUnique as jest.Mock).mockResolvedValue(approvedLoan);
                (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
                    const tx = {
                        loan: { update: jest.fn().mockResolvedValue(activeLoan) },
                        transaction: { create: jest.fn().mockResolvedValue({}) },
                    };
                    return await callback(tx);
                });
            });

            it('should disburse a loan if user is a TREASURER', async () => {
                (prisma.membership.findUnique as jest.Mock).mockResolvedValue({ role: MembershipRole.TREASURER, isActive: true });
        
                const res = await request(app)
                    .put('/loans/loan1/disburse')
                    .expect(200);
        
                expect(res.body.message).toBe('Loan disbursed successfully.');
                expect(res.body.data.status).toBe(LoanStatus.ACTIVE);
            });

            it('should NOT disburse a loan if user is an ADMIN', async () => {
                (prisma.membership.findUnique as jest.Mock).mockResolvedValue({ role: MembershipRole.ADMIN, isActive: true });

                const res = await request(app)
                    .put('/loans/loan1/disburse')
                    .expect(403);

                expect(res.body.message).toContain('Access Denied');
            });

            it('should NOT disburse a loan if user is a MEMBER', async () => {
                (prisma.membership.findUnique as jest.Mock).mockResolvedValue({ role: MembershipRole.MEMBER, isActive: true });

                const res = await request(app)
                    .put('/loans/loan1/disburse')
                    .expect(403);

                expect(res.body.message).toContain('Access Denied');
            });
        });
        
        describe('PUT /loans/:id/restructure', () => {
            const restructureData = { newInterestRate: 0.12, newDuration: 12, notes: 'Agreed with member' };

            it('should restructure a loan if user is an ADMIN', async () => {
                (prisma.membership.findUnique as jest.Mock).mockResolvedValue({ role: MembershipRole.ADMIN, isActive: true });

                const res = await request(app)
                    .put('/loans/loan1/restructure')
                    .send(restructureData)
                    .expect(200);

                expect(res.body.message).toBe('Loan restructured successfully.');
                expect(res.body.data.isRestructured).toBe(true);
            });

            it('should restructure a loan if user is a TREASURER', async () => {
                (prisma.membership.findUnique as jest.Mock).mockResolvedValue({ role: MembershipRole.TREASURER, isActive: true });

                const res = await request(app).put('/loans/loan1/restructure')
                    .send(restructureData)
                    .expect(200);

                expect(res.body.message).toBe('Loan restructured successfully.');
                expect(res.body.data.isRestructured).toBe(true);
            });

            it('should NOT restructure a loan if user is a MEMBER', async () => {
                (prisma.membership.findUnique as jest.Mock).mockResolvedValue({ role: MembershipRole.MEMBER, isActive: true });

                const res = await request(app)
                    .put('/loans/loan1/restructure')
                    .send(restructureData)
                    .expect(403);

                expect(res.body.message).toContain('Access Denied');
            });
        });
        
    });
});
