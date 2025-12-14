import { PrismaClient, Loan, LoanStatus, Prisma, TransactionType, AuditAction } from '@prisma/client';
import { addMonths, format } from 'date-fns';
import { createAuditLog } from "./audit.service";
import logger from '../config/logger';

interface LogMeta {
    ipAddress?: string;
    userAgent?: string;
}

const prisma = new PrismaClient();

/**
 * Calculates if a member is eligible for a loan based on their contributions.
 * @returns {Promise<{isEligible: boolean, maxLoanable: number}>}
 */
export const calculateEligibility = async (membershipId: string, requestedAmount: number) => {
    logger.info({ membershipId, requestedAmount }, 'Calculating loan eligibility');

    const totalContributions = await prisma.contribution.aggregate({
        _sum: { amount: true },
        where: { membershipId, status: 'PAID' },
    });

    const totalPaid = totalContributions._sum.amount || 0;
    const multiplier = parseFloat(process.env.LOAN_ELIGIBILITY_MULTIPLIER || '3');
    const maxLoanable = totalPaid * multiplier;

    const eligibility = {
        isEligible: requestedAmount <= maxLoanable,
        maxLoanable,
    };

    logger.info({ membershipId, totalPaid, maxLoanable, isEligible: eligibility.isEligible }, 'Loan eligibility calculated');

    return eligibility;
};

/**
 * Generates a simple, flat-rate interest repayment schedule.
 */
export const generateRepaymentSchedule = (loan: Loan) => {
    logger.info({ loanId: loan.id, amount: loan.amount, duration: loan.duration }, 'Generating repayment schedule');

    const { amount, interestRate, duration, disbursedAt } = loan;
    if (!disbursedAt) {
        logger.warn({ loanId: loan.id }, 'Cannot generate schedule: loan not yet disbursed');
        return [];
    }

    const schedule = [];
    const totalInterest = amount * interestRate * (duration / 12);
    const totalRepayable = amount + totalInterest;
    const monthlyInstallment = totalRepayable / duration;
    let balance = totalRepayable;

    for (let i = 1; i <= duration; i++) {
        balance -= monthlyInstallment;
        schedule.push({
            installment: i,
            dueDate: format(addMonths(disbursedAt, i), 'yyyy-MM-dd'),
            payment: parseFloat(monthlyInstallment.toFixed(2)),
            balance: parseFloat(balance.toFixed(2)),
        });
    }

    logger.info({ loanId: loan.id, installments: schedule.length }, 'Repayment schedule generated');

    return schedule;
};

export const findLoanById = async (loanId: string) => {
    logger.info({ loanId }, 'Fetching loan by ID');

    const loan = await prisma.loan.findUnique({
        where: { id: loanId },
        include: {
            membership: {
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                        }
                    }
                }
            },
            payments: {
                orderBy: {
                    paidAt: 'asc'
                }
            }
        }
    });

    if (loan) {
        logger.info({ loanId, status: loan.status, paymentsCount: loan.payments.length }, 'Loan fetched successfully');
    } else {
        logger.warn({ loanId }, 'Loan not found');
    }

    return loan;
};

export const applyForLoan = async (data: Prisma.LoanCreateInput, membershipId: string, actorId: string, logMeta: LogMeta) => {
    logger.info({ membershipId, actorId, amount: data.amount }, 'Processing loan application');

    if (membershipId !== data.membership.connect?.id) {
        logger.warn({ membershipId, actorId }, 'Loan application rejected: membership mismatch');
        throw new Error("A member can only apply for a loan for themselves.");
    }

    const member = await prisma.membership.findFirst({ where: { id: membershipId, userId: actorId }});
    if(!member) {
        logger.warn({ membershipId, actorId }, 'Membership not found for authenticated user');
        throw new Error("Membership not found for the authenticated user.");
    }
    
    const { isEligible, maxLoanable } = await calculateEligibility(membershipId, data.amount);
    if (!isEligible) {
        logger.warn({ membershipId, requestedAmount: data.amount, maxLoanable }, 'Loan application rejected: exceeds eligibility');
        throw new Error(`Loan application rejected. You are only eligible to borrow up to ${maxLoanable.toFixed(2)}.`);
    }

    const newLoan = await prisma.loan.create({ data });

    await createAuditLog({
        action: AuditAction.LOAN_APPLY,
        actorId,
        chamaId: member.chamaId,
        loanId: newLoan.id,
        newValue: newLoan,
        ...logMeta,
    });

    logger.info({ loanId: newLoan.id, membershipId, amount: data.amount }, 'Loan application created successfully');

    return newLoan;
};

export const approveOrRejectLoan = async (loanId: string, status: LoanStatus, actorId: string, logMeta: LogMeta) => {
    logger.info({ loanId, status, actorId }, 'Processing loan approval/rejection');

    const oldValue = await prisma.loan.findUnique({ where: { id: loanId }, include: { membership: true } });
    if (!oldValue || oldValue.status !== LoanStatus.PENDING) {
        logger.warn({ loanId, currentStatus: oldValue?.status }, 'Cannot update loan: not found or not pending');
        throw new Error("Loan not found or cannot be updated.");
    }

    let updatedLoan;
    if (status === LoanStatus.REJECTED) {
        updatedLoan = await prisma.loan.update({ where: { id: loanId }, data: { status: LoanStatus.REJECTED } });
        logger.info({ loanId, actorId }, 'Loan rejected');
    } else if (status === LoanStatus.APPROVED) {
        const totalInterest = oldValue.amount * oldValue.interestRate * (oldValue.duration / 12);
        const repaymentAmount = oldValue.amount + totalInterest;
        const monthlyInstallment = repaymentAmount / oldValue.duration;
        updatedLoan = await prisma.loan.update({
            where: { id: loanId },
            data: { status: LoanStatus.APPROVED, approvedAt: new Date(), repaymentAmount, monthlyInstallment },
        });
        logger.info({ loanId, actorId, repaymentAmount, monthlyInstallment }, 'Loan approved');
    } else {
        logger.warn({ loanId, status }, 'Invalid status provided for loan approval');
        throw new Error("Invalid status provided. Must be APPROVED or REJECTED.");
    }

    await createAuditLog({
        action: status === LoanStatus.APPROVED ? AuditAction.LOAN_APPROVE : AuditAction.LOAN_REJECT,
        actorId,
        chamaId: oldValue.membership.chamaId,
        loanId,
        oldValue,
        newValue: updatedLoan,
        ...logMeta,
    });

    return updatedLoan;
};

export const disburseLoan = async (loanId: string, actorId: string, logMeta: LogMeta) => {
    logger.info({ loanId, actorId }, 'Disbursing loan');

    const oldValue = await prisma.loan.findUnique({ where: { id: loanId }, include: { membership: true } });
    if (!oldValue || oldValue.status !== LoanStatus.APPROVED) {
        logger.warn({ loanId, currentStatus: oldValue?.status }, 'Cannot disburse: loan not approved');
        throw new Error("Loan must be approved before disbursement.");
    }

    const updatedLoan = await prisma.$transaction(async (tx) => {
        const loan = await tx.loan.update({
            where: { id: loanId },
            data: { status: LoanStatus.ACTIVE, disbursedAt: new Date(), dueDate: addMonths(new Date(), 1) },
        });
        await tx.transaction.create({
            data: {
                chamaId: oldValue.membership.chamaId,
                type: TransactionType.LOAN_DISBURSEMENT,
                amount: -loan.amount,
                description: `Loan disbursement to member for loan ID: ${loanId}`,
            },
        });
        return loan;
    });

    await createAuditLog({
        action: AuditAction.LOAN_DISBURSE,
        actorId,
        chamaId: oldValue.membership.chamaId,
        loanId,
        oldValue,
        newValue: updatedLoan,
        ...logMeta,
    });

    logger.info({ loanId, actorId, amount: oldValue.amount }, 'Loan disbursed successfully');
    
    return updatedLoan;
};

export const recordLoanPayment = async (loanId: string, paymentData: Prisma.LoanPaymentCreateWithoutLoanInput, actorId: string, logMeta: LogMeta) => {
    logger.info({ loanId, actorId, amount: paymentData.amount }, 'Recording loan payment');

    const loan = await prisma.loan.findUnique({ where: { id: loanId }, include: { payments: true, membership: true } });
    if (!loan || loan.status !== LoanStatus.ACTIVE) {
        logger.warn({ loanId, currentStatus: loan?.status }, 'Cannot record payment: loan not active');
        throw new Error("Cannot record payment for this loan.");
    }

    const normalizedMpesaCode = paymentData.mpesaCode?.trim() || undefined;

    if (normalizedMpesaCode) {
        const duplicatePayment = await prisma.loanPayment.findUnique({ where: { mpesaCode: normalizedMpesaCode } });
        if (duplicatePayment) {
            logger.warn({ loanId, mpesaCode: normalizedMpesaCode }, 'Duplicate M-Pesa code detected');
            throw new Error('Payment with the provided M-Pesa code already exists.');
        }
    }

    const cleanedPaymentData: Prisma.LoanPaymentCreateWithoutLoanInput = {
        ...paymentData,
        mpesaCode: normalizedMpesaCode,
    };

    const totalPaid = loan.payments.reduce((sum, p) => sum + p.amount, 0) + cleanedPaymentData.amount;
    const isFullyPaid = totalPaid >= (loan.repaymentAmount || 0);

    const newPayment = await prisma.loanPayment.create({
        data: { loanId: loanId, ...cleanedPaymentData },
    });

    if (isFullyPaid) {
        await prisma.loan.update({ where: { id: loanId }, data: { status: LoanStatus.PAID, dueDate: null } });
        logger.info({ loanId, totalPaid }, 'Loan fully paid');
    } else if (loan.dueDate) {
        await prisma.loan.update({ where: { id: loanId }, data: { dueDate: addMonths(loan.dueDate, 1) } });
        logger.info({ loanId, totalPaid, remaining: (loan.repaymentAmount || 0) - totalPaid }, 'Payment recorded, due date extended');
    }

    await createAuditLog({
        action: AuditAction.LOAN_REPAYMENT,
        actorId,
        chamaId: loan.membership.chamaId,
        loanId,
        newValue: newPayment,
        ...logMeta,
    });

    logger.info({ loanId, paymentId: newPayment.id, amount: paymentData.amount }, 'Loan payment recorded successfully');
};

export const findLoanDefaulters = async (chamaId: string) => {
    logger.info({ chamaId }, 'Finding loan defaulters');

    const defaulters = await prisma.loan.findMany({
        where: {
            membership: { chamaId },
            status: LoanStatus.ACTIVE,
            dueDate: { lt: new Date() }, // Due date is in the past
        },
        include: {
            membership: { include: { user: true } },
            payments: true,
        },
    });

    logger.info({ chamaId, defaultersCount: defaulters.length }, 'Loan defaulters found');

    return defaulters;
};

export const restructureLoan = async (loanId: string, data: { newInterestRate?: number, newDuration?: number, notes: string }, actorId: string, logMeta: LogMeta) => {
    logger.info({ loanId, actorId, newInterestRate: data.newInterestRate, newDuration: data.newDuration }, 'Restructuring loan');

    const oldValue = await prisma.loan.findUnique({ where: { id: loanId }, include: { membership: true } });
    if (!oldValue) {
        logger.warn({ loanId }, 'Loan not found for restructuring');
        throw new Error("Loan not found.");
    }

    const newInterestRate = data.newInterestRate ?? oldValue.interestRate;
    const newDuration = data.newDuration ?? oldValue.duration;
    const totalInterest = oldValue.amount * newInterestRate * (newDuration / 12);
    const repaymentAmount = oldValue.amount + totalInterest;
    const monthlyInstallment = repaymentAmount / newDuration;

    const updatedLoan = await prisma.loan.update({
        where: { id: loanId },
        data: { interestRate: newInterestRate, duration: newDuration, repaymentAmount, monthlyInstallment, isRestructured: true, restructureNotes: data.notes },
    });

    await createAuditLog({
        action: AuditAction.LOAN_RESTRUCTURE,
        actorId,
        chamaId: oldValue.membership.chamaId,
        loanId,
        oldValue,
        newValue: updatedLoan,
        ...logMeta,
    });

    logger.info({ loanId, actorId, newRepaymentAmount: repaymentAmount, newMonthlyInstallment: monthlyInstallment }, 'Loan restructured successfully');

    return updatedLoan;
};