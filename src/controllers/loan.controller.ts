import { LoanStatus, MembershipRole, PrismaClient } from '@prisma/client';
import { Request, Response } from "express";
import * as loanService from "../services/loan.service";
import { isErrorWithMessage } from "../utils/error.utils";
import logger from '../config/logger';

const prisma = new PrismaClient();

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

export const getLoanById = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const actorId = req.user?.id!;
        const { id: loanId } = req.params;

        logger.debug({ actorId, loanId }, 'Fetching loan by ID');

        const loan = await loanService.findLoanById(loanId);
        if (!loan) {
            logger.warn({ actorId, loanId }, 'Loan not found');
            return res.status(404).json({ message: "Loan not found." });
        }

        const isOwner = loan.membership.userId === actorId;
        const isPrivileged = await prisma.membership.findFirst({
            where: {
                userId: actorId,
                chamaId: loan.membership.chamaId,
                role: { in: [MembershipRole.ADMIN, MembershipRole.TREASURER, MembershipRole.SECRETARY] }
            }
        });

        if (!isOwner && !isPrivileged) {
            logger.warn({ 
                actorId, 
                loanId, 
                ownerId: loan.membership.userId,
                chamaId: loan.membership.chamaId 
            }, 'Unauthorized loan access attempt');
            return res.status(403).json({ message: "Permission Denied: You are not authorized to view this loan." });
        }

        logger.info({ 
            actorId, 
            loanId, 
            chamaId: loan.membership.chamaId,
            isOwner 
        }, 'Loan retrieved successfully');

        res.status(200).json({ data: loan });
    } catch (error) {
        logger.error({ 
            error, 
            actorId: req.user?.id, 
            loanId: req.params.id 
        }, 'Error fetching loan by ID');
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const checkEligibilityController = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { membershipId, amount } = req.query;
        const actorId = req.user?.id!;

        if (!membershipId || !amount) {
            logger.warn({ actorId }, 'Eligibility check with missing parameters');
            return res.status(400).json({ message: "membershipId and amount are required query parameters." });
        }

        logger.debug({ 
            actorId, 
            membershipId, 
            amount: parseFloat(amount as string) 
        }, 'Checking loan eligibility');
        
        const member = await prisma.membership.findFirst({ where: { id: membershipId as string, userId: actorId }});
        if (!member) {
            logger.warn({ 
                actorId, 
                membershipId 
            }, 'Eligibility check for non-owned membership');
            return res.status(403).json({ message: "Permission Denied: You can only check eligibility for your own membership." });
        }

        const eligibility = await loanService.calculateEligibility(membershipId as string, parseFloat(amount as string));
        
        logger.info({ 
            actorId, 
            membershipId, 
            amount: parseFloat(amount as string),
            isEligible: eligibility.isEligible 
        }, 'Loan eligibility checked');

        res.status(200).json({ data: eligibility });
    } catch (error) {
        logger.error({ 
            error, 
            actorId: req.user?.id, 
            membershipId: req.query.membershipId,
            amount: req.query.amount 
        }, 'Error checking loan eligibility');
        if (isErrorWithMessage(error)) return res.status(500).json({ message: error.message });
    }
};

export const applyForLoan = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const actorId = req.user?.id!;
        const logMeta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
        const { membershipId, amount, duration, purpose, interestRate } = req.body;

        logger.debug({ 
            actorId, 
            membershipId, 
            amount, 
            duration, 
            purpose 
        }, 'Loan application initiated');

        const data = { amount, duration, purpose, interestRate, membership: { connect: { id: membershipId } } };
        const newLoan = await loanService.applyForLoan(data, membershipId, actorId, logMeta);
        
        logger.info({ 
            actorId, 
            loanId: newLoan.id, 
            membershipId, 
            amount, 
            duration 
        }, 'Loan application submitted successfully');

        res.status(201).json({ message: 'Loan application submitted successfully.', data: newLoan });
    } catch (error) {
        logger.error({ 
            error, 
            actorId: req.user?.id, 
            membershipId: req.body.membershipId,
            amount: req.body.amount 
        }, 'Loan application failed');
        if (isErrorWithMessage(error)) return res.status(400).json({ message: error.message });
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const approveOrRejectLoan = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const actorId = req.user?.id!;
        const logMeta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
        const { id: loanId } = req.params;
        const { status } = req.body;

        logger.debug({ 
            actorId, 
            loanId, 
            newStatus: status 
        }, 'Loan status update initiated');

        const updatedLoan = await loanService.approveOrRejectLoan(loanId, status, actorId, logMeta);
        
        logger.info({ 
            actorId, 
            loanId, 
            newStatus: status,
            membershipId: updatedLoan.membershipId 
        }, 'Loan status updated successfully');

        res.status(200).json({ message: 'Loan status updated successfully.', data: updatedLoan });
    } catch (error) {
        logger.error({ 
            error, 
            actorId: req.user?.id, 
            loanId: req.params.id,
            requestedStatus: req.body.status 
        }, 'Loan status update failed');
        if (isErrorWithMessage(error)) return res.status(400).json({ message: error.message });
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const disburseLoan = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const actorId = req.user?.id!;
        const logMeta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
        const { id: loanId } = req.params;

        logger.debug({ actorId, loanId }, 'Loan disbursement initiated');

        const disbursedLoan = await loanService.disburseLoan(loanId, actorId, logMeta);
        
        logger.info({ 
            actorId, 
            loanId, 
            amount: disbursedLoan.amount,
            membershipId: disbursedLoan.membershipId 
        }, 'Loan disbursed successfully');

        res.status(200).json({ message: 'Loan disbursed successfully.', data: disbursedLoan });
    } catch (error) {
        logger.error({ 
            error, 
            actorId: req.user?.id, 
            loanId: req.params.id 
        }, 'Loan disbursement failed');
        if (isErrorWithMessage(error)) return res.status(400).json({ message: error.message });
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const recordLoanPayment = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const actorId = req.user?.id!;
        const logMeta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
        const { id: loanId } = req.params;
        const { amount, paymentDate } = req.body;

        logger.debug({ 
            actorId, 
            loanId, 
            amount, 
            paymentDate 
        }, 'Recording loan payment');

        const loan = await prisma.loan.findUnique({ where: { id: loanId }, include: { membership: true } });
        if (!loan) {
            logger.warn({ actorId, loanId }, 'Payment attempted for non-existent loan');
            return res.status(404).json({ message: "Loan not found." });
        }

        const isOwner = loan.membership.userId === actorId;
        const isPrivileged = await prisma.membership.findFirst({
            where: { userId: actorId, chamaId: loan.membership.chamaId, role: { in: [MembershipRole.ADMIN, MembershipRole.TREASURER]}}
        });
        
        if (!isOwner && !isPrivileged) {
            logger.warn({ 
                actorId, 
                loanId, 
                ownerId: loan.membership.userId,
                chamaId: loan.membership.chamaId 
            }, 'Unauthorized payment recording attempt');
            return res.status(403).json({ message: "Permission Denied." });
        }

        await loanService.recordLoanPayment(loanId, req.body, actorId, logMeta);
        
        logger.info({ 
            actorId, 
            loanId, 
            amount, 
            chamaId: loan.membership.chamaId,
            isOwner 
        }, 'Loan payment recorded successfully');

        res.status(201).json({ message: 'Payment recorded successfully.' });
    } catch (error) {
        logger.error({ 
            error, 
            actorId: req.user?.id, 
            loanId: req.params.id,
            amount: req.body.amount 
        }, 'Loan payment recording failed');
        if (isErrorWithMessage(error)) return res.status(400).json({ message: error.message });
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const restructureLoan = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const actorId = req.user?.id!;
        const logMeta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
        const { id: loanId } = req.params;
        const restructureFields = Object.keys(req.body);

        logger.debug({ 
            actorId, 
            loanId, 
            restructureFields 
        }, 'Loan restructuring initiated');

        const updatedLoan = await loanService.restructureLoan(loanId, req.body, actorId, logMeta);
        
        logger.info({ 
            actorId, 
            loanId, 
            restructureFields,
            newAmount: updatedLoan.amount,
            newDuration: updatedLoan.duration 
        }, 'Loan restructured successfully');

        res.status(200).json({ message: 'Loan restructured successfully.', data: updatedLoan });
    } catch (error) {
        logger.error({ 
            error, 
            actorId: req.user?.id, 
            loanId: req.params.id,
            restructureFields: Object.keys(req.body) 
        }, 'Loan restructuring failed');
        if (isErrorWithMessage(error)) return res.status(400).json({ message: error.message });
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const getChamaLoans = async (req: Request, res: Response) => {
    try {
        const { chamaId } = req.params;

        logger.debug({ chamaId }, 'Fetching chama loans');

        const loans = await prisma.loan.findMany({ where: { membership: { chamaId } } });
        
        logger.info({ 
            chamaId, 
            loansCount: loans.length 
        }, 'Chama loans retrieved successfully');

        res.status(200).json({ data: loans });
    } catch (error) {
        logger.error({ 
            error, 
            chamaId: req.params.chamaId 
        }, 'Error fetching chama loans');
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const getMemberLoans = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { membershipId } = req.params;
        const actorId = req.user?.id!;

        logger.debug({ actorId, membershipId }, 'Fetching member loans');

        const membership = await prisma.membership.findUnique({ where: { id: membershipId } });
        if (!membership) {
            logger.warn({ actorId, membershipId }, 'Loans requested for non-existent membership');
            return res.status(404).json({ message: 'Membership not found.' });
        }
        
        const isOwner = membership.userId === actorId;
        const isPrivileged = await prisma.membership.findFirst({
            where: { userId: actorId, chamaId: membership.chamaId, role: { in: [MembershipRole.ADMIN, MembershipRole.TREASURER]}}
        });

        if (!isOwner && !isPrivileged) {
            logger.warn({ 
                actorId, 
                membershipId, 
                ownerId: membership.userId,
                chamaId: membership.chamaId 
            }, 'Unauthorized member loans access attempt');
            return res.status(403).json({ message: "Permission Denied." });
        }
        
        const loans = await prisma.loan.findMany({ where: { membershipId } });
        
        logger.info({ 
            actorId, 
            membershipId, 
            loansCount: loans.length,
            chamaId: membership.chamaId,
            isOwner 
        }, 'Member loans retrieved successfully');

        res.status(200).json({ data: loans });
    } catch (error) {
        logger.error({ 
            error, 
            actorId: req.user?.id, 
            membershipId: req.params.membershipId 
        }, 'Error fetching member loans');
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const getRepaymentSchedule = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const actorId = req.user?.id!;
        const { id: loanId } = req.params;

        logger.debug({ actorId, loanId }, 'Fetching repayment schedule');

        const loan = await prisma.loan.findUnique({ where: { id: loanId }, include: { membership: true } });
        if (!loan) {
            logger.warn({ actorId, loanId }, 'Repayment schedule requested for non-existent loan');
            return res.status(404).json({ message: "Loan not found." });
        }

        const isOwner = loan.membership.userId === actorId;
        const isPrivileged = await prisma.membership.findFirst({
            where: { userId: actorId, chamaId: loan.membership.chamaId, role: { in: [MembershipRole.ADMIN, MembershipRole.TREASURER]}}
        });
        
        if (!isOwner && !isPrivileged) {
            logger.warn({ 
                actorId, 
                loanId, 
                ownerId: loan.membership.userId,
                chamaId: loan.membership.chamaId 
            }, 'Unauthorized repayment schedule access attempt');
            return res.status(403).json({ message: "Permission Denied." });
        }

        const schedule = loanService.generateRepaymentSchedule(loan);
        
        logger.info({ 
            actorId, 
            loanId, 
            scheduleLength: schedule.length,
            chamaId: loan.membership.chamaId,
            isOwner 
        }, 'Repayment schedule generated successfully');

        res.status(200).json({ data: schedule });
    } catch (error) {
        logger.error({ 
            error, 
            actorId: req.user?.id, 
            loanId: req.params.id 
        }, 'Error fetching repayment schedule');
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const getLoanDefaulters = async (req: Request, res: Response) => {
    try {
        const { chamaId } = req.params;

        logger.debug({ chamaId }, 'Fetching loan defaulters');

        const defaulters = await loanService.findLoanDefaulters(chamaId);
        
        logger.info({ 
            chamaId, 
            defaultersCount: defaulters.length 
        }, 'Loan defaulters retrieved successfully');

        res.status(200).json({ data: defaulters });
    } catch (error) {
        logger.error({ 
            error, 
            chamaId: req.params.chamaId 
        }, 'Error fetching loan defaulters');
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};