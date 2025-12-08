import { PrismaClient, Loan, LoanStatus, Prisma, TransactionType, AuditAction } from '@prisma/client';
import { addMonths, format } from 'date-fns';
import { createAuditLog } from "./audit.service";

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
    const totalContributions = await prisma.contribution.aggregate({
        _sum: { amount: true },
        where: { membershipId, status: 'PAID' },
    });
    const totalPaid = totalContributions._sum.amount || 0;
    const multiplier = parseFloat(process.env.LOAN_ELIGIBILITY_MULTIPLIER || '3');
    const maxLoanable = totalPaid * multiplier;

    return {
        isEligible: requestedAmount <= maxLoanable,
        maxLoanable,
    };
};

/**
 * Generates a simple, flat-rate interest repayment schedule.
 */
export const generateRepaymentSchedule = (loan: Loan) => {
    const { amount, interestRate, duration, disbursedAt } = loan;
    if (!disbursedAt) return [];

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
    return schedule;
};

export const findLoanById = async (loanId: string) => {
    return prisma.loan.findUnique({
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
};


export const applyForLoan = async (data: Prisma.LoanCreateInput, membershipId: string, actorId: string, logMeta: LogMeta) => {
    if (membershipId !== data.membership.connect?.id) throw new Error("A member can only apply for a loan for themselves.");
    const member = await prisma.membership.findFirst({ where: { id: membershipId, userId: actorId }});
    if(!member) throw new Error("Membership not found for the authenticated user.");
    
    const { isEligible, maxLoanable } = await calculateEligibility(membershipId, data.amount);
    if (!isEligible) {
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

    return newLoan;
};

export const approveOrRejectLoan = async (loanId: string, status: LoanStatus, actorId: string, logMeta: LogMeta) => {
    const oldValue = await prisma.loan.findUnique({ where: { id: loanId }, include: { membership: true } });
    if (!oldValue || oldValue.status !== LoanStatus.PENDING) throw new Error("Loan not found or cannot be updated.");

    let updatedLoan;
    if (status === LoanStatus.REJECTED) {
        updatedLoan = await prisma.loan.update({ where: { id: loanId }, data: { status: LoanStatus.REJECTED } });
    } else if (status === LoanStatus.APPROVED) {
        const totalInterest = oldValue.amount * oldValue.interestRate * (oldValue.duration / 12);
        const repaymentAmount = oldValue.amount + totalInterest;
        const monthlyInstallment = repaymentAmount / oldValue.duration;
        updatedLoan = await prisma.loan.update({
            where: { id: loanId },
            data: { status: LoanStatus.APPROVED, approvedAt: new Date(), repaymentAmount, monthlyInstallment },
        });
    } else {
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
    const oldValue = await prisma.loan.findUnique({ where: { id: loanId }, include: { membership: true } });
    if (!oldValue || oldValue.status !== LoanStatus.APPROVED) throw new Error("Loan must be approved before disbursement.");

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
    
    return updatedLoan;
};

export const recordLoanPayment = async (loanId: string, paymentData: Prisma.LoanPaymentCreateWithoutLoanInput, actorId: string, logMeta: LogMeta) => {
    const loan = await prisma.loan.findUnique({ where: { id: loanId }, include: { payments: true, membership: true } });
    if (!loan || loan.status !== LoanStatus.ACTIVE) throw new Error("Cannot record payment for this loan.");

    const normalizedMpesaCode = paymentData.mpesaCode?.trim() || undefined;

    if (normalizedMpesaCode) {
        const duplicatePayment = await prisma.loanPayment.findUnique({ where: { mpesaCode: normalizedMpesaCode } });
        if (duplicatePayment) {
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
    } else if (loan.dueDate) {
        await prisma.loan.update({ where: { id: loanId }, data: { dueDate: addMonths(loan.dueDate, 1) } });
    }

    await createAuditLog({
        action: AuditAction.LOAN_REPAYMENT,
        actorId,
        chamaId: loan.membership.chamaId,
        loanId,
        newValue: newPayment,
        ...logMeta,
    });
};

export const findLoanDefaulters = async (chamaId: string) => {
    return prisma.loan.findMany({
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
};

export const restructureLoan = async (loanId: string, data: { newInterestRate?: number, newDuration?: number, notes: string }, actorId: string, logMeta: LogMeta) => {
    const oldValue = await prisma.loan.findUnique({ where: { id: loanId }, include: { membership: true } });
    if (!oldValue) throw new Error("Loan not found.");

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

    return updatedLoan;
};
