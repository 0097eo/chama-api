import { MembershipRole, PrismaClient } from "../generated/prisma";
import { Request, Response } from "express";
import * as loanService from "../services/loan.service";
import { isErrorWithMessage } from "../utils/error.utils";


const prisma = new PrismaClient();

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

export const applyForLoan = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const actorId = req.user?.id;
        if (!actorId) return res.status(401).json({ message: 'User not authenticated' });
        
        const { membershipId, amount, duration, purpose, interestRate } = req.body;
        const data = { amount, duration, purpose, interestRate, membership: { connect: { id: membershipId } } };

        const newLoan = await loanService.applyForLoan(data, membershipId, actorId);
        res.status(201).json({ message: 'Loan application submitted successfully.', data: newLoan });
    } catch (error) {
        if(isErrorWithMessage(error)) return res.status(400).json({ message: error.message });
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const getChamaLoans = async (req: Request, res: Response) => {
    // Permission handled by middleware
    const loans = await prisma.loan.findMany({ where: { membership: { chamaId: req.params.chamaId } } });
    res.status(200).json({ data: loans });
};

export const getMemberLoans = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { membershipId } = req.params;
        const actorId = req.user?.id!;
        const membership = await prisma.membership.findUnique({ where: { id: membershipId } });
        if (!membership) return res.status(404).json({ message: 'Membership not found.' });
        
        const isOwner = membership.userId === actorId;
        const isPrivileged = await prisma.membership.findFirst({
            where: { userId: actorId, chamaId: membership.chamaId, role: { in: [MembershipRole.ADMIN, MembershipRole.TREASURER]}}
        });

        if (!isOwner && !isPrivileged) return res.status(403).json({ message: "Permission Denied." });
        
        const loans = await prisma.loan.findMany({ where: { membershipId } });
        res.status(200).json({ data: loans });
    } catch (error) {
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const approveOrRejectLoan = async (req: Request, res: Response) => {
    try {
        const updatedLoan = await loanService.approveOrRejectLoan(req.params.id, req.body.status);
        res.status(200).json({ message: 'Loan status updated successfully.', data: updatedLoan });
    } catch (error) {
        if(isErrorWithMessage(error)) return res.status(400).json({ message: error.message });
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const disburseLoan = async (req: Request, res: Response) => {
    try {
        const disbursedLoan = await loanService.disburseLoan(req.params.id);
        res.status(200).json({ message: 'Loan disbursed successfully.', data: disbursedLoan });
    } catch (error) {
        if(isErrorWithMessage(error)) return res.status(400).json({ message: error.message });
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const recordLoanPayment = async (req: AuthenticatedRequest, res: Response) => {
    try {
        // Permission Check: Ensure user is owner or admin/treasurer
        const actorId = req.user?.id!;
        const loan = await prisma.loan.findUnique({ where: { id: req.params.id }, include: { membership: true } });
        if (!loan) return res.status(404).json({ message: "Loan not found." });

        const isOwner = loan.membership.userId === actorId;
        const isPrivileged = await prisma.membership.findFirst({
            where: { userId: actorId, chamaId: loan.membership.chamaId, role: { in: [MembershipRole.ADMIN, MembershipRole.TREASURER]}}
        });
        if (!isOwner && !isPrivileged) return res.status(403).json({ message: "Permission Denied." });

        await loanService.recordLoanPayment(req.params.id, req.body);
        res.status(201).json({ message: 'Payment recorded successfully.' });
    } catch (error) {
        if(isErrorWithMessage(error)) return res.status(400).json({ message: error.message });
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const getRepaymentSchedule = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const actorId = req.user?.id!;
        const loan = await prisma.loan.findUnique({ where: { id: req.params.id }, include: { membership: true } });
        if (!loan) return res.status(404).json({ message: "Loan not found." });

        const isOwner = loan.membership.userId === actorId;
        const isPrivileged = await prisma.membership.findFirst({
            where: { userId: actorId, chamaId: loan.membership.chamaId, role: { in: [MembershipRole.ADMIN, MembershipRole.TREASURER]}}
        });
        if (!isOwner && !isPrivileged) return res.status(403).json({ message: "Permission Denied." });

        const schedule = loanService.generateRepaymentSchedule(loan);
        res.status(200).json({ data: schedule });
    } catch (error) {
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const getLoanDefaulters = async (req: Request, res: Response) => {
    // Permission handled by middleware
    const defaulters = await loanService.findLoanDefaulters(req.params.chamaId);
    res.status(200).json({ data: defaulters });
};

export const restructureLoan = async (req: Request, res: Response) => {
    try {
        const updatedLoan = await loanService.restructureLoan(req.params.id, req.body);
        res.status(200).json({ message: 'Loan restructured successfully.', data: updatedLoan });
    } catch (error) {
        if(isErrorWithMessage(error)) return res.status(400).json({ message: error.message });
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};