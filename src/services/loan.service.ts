import { PrismaClient, Loan, LoanStatus, Prisma, TransactionType } from "../generated/prisma";
import { addMonths, format } from 'date-fns';

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


export const applyForLoan = async (data: Prisma.LoanCreateInput, membershipId: string, actorId: string) => {
    if (membershipId !== data.membership.connect?.id) throw new Error("A member can only apply for a loan for themselves.");
    const member = await prisma.membership.findFirst({ where: { id: membershipId, userId: actorId }});
    if(!member) throw new Error("Membership not found for the authenticated user.");
    
    const { isEligible, maxLoanable } = await calculateEligibility(membershipId, data.amount);
    if (!isEligible) {
        throw new Error(`Loan application rejected. You are only eligible to borrow up to ${maxLoanable.toFixed(2)}.`);
    }

    return prisma.loan.create({ data });
};

export const approveOrRejectLoan = async (loanId: string, status: LoanStatus) => {
    const loan = await prisma.loan.findUnique({ where: { id: loanId } });
    if (!loan || loan.status !== LoanStatus.PENDING) throw new Error("Loan not found or cannot be updated.");

    if (status === LoanStatus.REJECTED) {
        return prisma.loan.update({ where: { id: loanId }, data: { status: LoanStatus.REJECTED } });
    }

    if (status !== LoanStatus.APPROVED) {
        throw new Error("Invalid status provided. Must be APPROVED or REJECTED.");
    }

    // If approved, calculate repayment details
    const totalInterest = loan.amount * loan.interestRate * (loan.duration / 12);
    const repaymentAmount = loan.amount + totalInterest;
    const monthlyInstallment = repaymentAmount / loan.duration;

    return prisma.loan.update({
        where: { id: loanId },
        data: {
            status: LoanStatus.APPROVED,
            approvedAt: new Date(),
            repaymentAmount,
            monthlyInstallment,
        },
    });
};

export const disburseLoan = async (loanId: string) => {
    const loan = await prisma.loan.findUnique({ where: { id: loanId } });
    if (!loan || loan.status !== LoanStatus.APPROVED) throw new Error("Loan must be approved before disbursement.");

    return prisma.$transaction(async (tx) => {
        const updatedLoan = await tx.loan.update({
            where: { id: loanId },
            data: {
                status: LoanStatus.ACTIVE,
                disbursedAt: new Date(),
                dueDate: addMonths(new Date(), 1),
            },
        });

        // Record the disbursement as a transaction for the chama's books
        const membership = await tx.membership.findUnique({ where: { id: loan.membershipId }});
        if (membership) {
            await tx.transaction.create({
                data: {
                    chamaId: membership.chamaId,
                    type: TransactionType.LOAN_DISBURSEMENT,
                    amount: -loan.amount, // Negative amount as money is going out
                    description: `Loan disbursement to member for loan ID: ${loanId}`,
                },
            });
        }
        return updatedLoan;
    });
};

export const recordLoanPayment = async (loanId: string, paymentData: Prisma.LoanPaymentCreateWithoutLoanInput) => {
    const loan = await prisma.loan.findUnique({
        where: { id: loanId },
        include: { payments: true },
    });
    if (!loan || loan.status !== LoanStatus.ACTIVE) throw new Error("Cannot record payment for this loan.");

    const totalPaid = loan.payments.reduce((sum, p) => sum + p.amount, 0) + paymentData.amount;
    const isFullyPaid = totalPaid >= (loan.repaymentAmount || 0);

    return prisma.$transaction(async (tx) => {
        await tx.loanPayment.create({
            data: {
                loanId: loanId,
                ...paymentData
            },
        });

        if (isFullyPaid) {
            await tx.loan.update({ where: { id: loanId }, data: { status: LoanStatus.PAID, dueDate: null } });
        } else {
            // Update the next due date
            if (loan.dueDate) {
                await tx.loan.update({ where: { id: loanId }, data: { dueDate: addMonths(loan.dueDate, 1) } });
            }
        }
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

export const restructureLoan = async (loanId: string, data: { newInterestRate?: number, newDuration?: number, notes: string }) => {
    const loan = await prisma.loan.findUnique({ where: { id: loanId } });
    if (!loan) throw new Error("Loan not found.");

    const newInterestRate = data.newInterestRate ?? loan.interestRate;
    const newDuration = data.newDuration ?? loan.duration;

    const totalInterest = loan.amount * newInterestRate * (newDuration / 12);
    const repaymentAmount = loan.amount + totalInterest;
    const monthlyInstallment = repaymentAmount / newDuration;

    return prisma.loan.update({
        where: { id: loanId },
        data: {
            interestRate: newInterestRate,
            duration: newDuration,
            repaymentAmount,
            monthlyInstallment,
            isRestructured: true,
            restructureNotes: data.notes,
        },
    });
};