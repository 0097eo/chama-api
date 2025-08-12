import { Request, Response } from 'express';
import * as contributionService from '../services/contribution.service';
import { isErrorWithMessage, isPrismaError } from '../utils/error.utils';
import { PrismaClient } from '../generated/prisma';
import { MembershipRole } from '../generated/prisma/client';

const prisma = new PrismaClient();

interface AuthenticatedRequest extends Request {
  user?: { id: string };
  file?: Express.Multer.File;
}

export const recordContribution = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const actorId = req.user?.id;
        if (!actorId) return res.status(401).json({ message: 'User not authenticated' });
        
        // Prepare logging metadata
        const logMeta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };

        // Pass metadata to the service function
        const contribution = await contributionService.recordContribution(req.body, actorId, logMeta);
        res.status(201).json({ message: 'Contribution recorded successfully.', data: contribution });
    } catch (error) {
        if (isErrorWithMessage(error)) {
            const statusCode = error.message.includes('Permission Denied') ? 403 : 409;
            return res.status(statusCode).json({ message: error.message });
        }
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const updateContribution = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const actorId = req.user?.id;
        if (!actorId) return res.status(401).json({ message: 'User not authenticated' });
        
        const contributionToUpdate = await contributionService.findContributionById(req.params.id);
        if (!contributionToUpdate) return res.status(404).json({ message: 'Contribution not found.' });
        
        const membership = await prisma.membership.findFirst({
            where: {
                userId: actorId,
                role: { in: [MembershipRole.ADMIN, MembershipRole.TREASURER] },
                chama: {
                    members: { some: { id: contributionToUpdate.membershipId } }
                }
            }
        });

        if (!membership) {
            return res.status(403).json({ message: "Permission Denied: You must be an Admin or Treasurer of this chama to update contributions." });
        }

        // Prepare logging metadata
        const logMeta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };

        // Pass metadata to the service function
        const contribution = await contributionService.updateContribution(req.params.id, req.body, actorId, logMeta);
        res.status(200).json({ message: 'Contribution updated.', data: contribution });
    } catch (error) {
        if (isErrorWithMessage(error)) {
             return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const deleteContribution = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const actorId = req.user?.id;
        if (!actorId) return res.status(401).json({ message: 'User not authenticated' });

        const contributionToDelete = await contributionService.findContributionById(req.params.id);
        if (!contributionToDelete) return res.status(404).json({ message: 'Contribution not found.' });

        const membership = await prisma.membership.findFirst({
            where: {
                userId: actorId,
                role: { in: [MembershipRole.ADMIN, MembershipRole.TREASURER] },
                chama: {
                    members: { some: { id: contributionToDelete.membershipId } }
                }
            }
        });
        
        if (!membership) {
            return res.status(403).json({ message: "Permission Denied: You must be an Admin or Treasurer of this chama to delete contributions." });
        }

        // Prepare logging metadata
        const logMeta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };

        // Pass metadata to the service function
        await contributionService.deleteContribution(req.params.id, actorId, logMeta);
        res.status(200).json({ message: 'Contribution deleted successfully.' });
    } catch (error) {
        if (isErrorWithMessage(error)) {
             return res.status(404).json({ message: error.message });
        }
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};


export const getChamaContributions = async (req: Request, res: Response) => {
    try {
        const { chamaId } = req.params;
        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = parseInt(req.query.limit as string, 10) || 10;
        const data = await contributionService.findChamaContributions(chamaId, page, limit);
        res.status(200).json({ data });
    } catch (error) {
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const getMemberContributions = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { membershipId } = req.params;
        const actorId = req.user?.id;
        if (!actorId) return res.status(401).json({ message: 'User not authenticated' });

        const membership = await prisma.membership.findUnique({ where: { id: membershipId } });
        if (!membership) return res.status(404).json({ message: 'Membership not found.' });

        const isOwner = membership.userId === actorId;
        const isPrivilegedAdmin = await prisma.membership.findFirst({
            where: { userId: actorId, chamaId: membership.chamaId, role: { in: [MembershipRole.ADMIN, MembershipRole.TREASURER] } }
        });

        if (!isOwner && !isPrivilegedAdmin) {
            return res.status(403).json({ message: "Permission Denied: You cannot view this member's contributions." });
        }

        const contributions = await contributionService.findMemberContributions(membershipId);
        res.status(200).json({ data: contributions });
    } catch (error) {
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const getContributionById = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const actorId = req.user?.id;
        if (!actorId) return res.status(401).json({ message: 'User not authenticated' });

        const contribution = await contributionService.findContributionById(req.params.id);
        if (!contribution) return res.status(404).json({ message: 'Contribution not found.' });

        const actorMembership = await prisma.membership.findFirst({
            where: {
                userId: actorId,
                chama: {
                    members: {
                        some: { id: contribution.membershipId }
                    }
                }
            }
        });

        if (!actorMembership) {
            return res.status(403).json({ message: "Permission Denied: You are not a member of the chama this contribution belongs to." });
        }

        res.status(200).json({ data: contribution });
    } catch (error) {
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const getContributionSummary = async (req: Request, res: Response) => {
    try {
        const summary = await contributionService.getContributionSummary(req.params.chamaId);
        res.status(200).json({ data: summary });
    } catch (error) {
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const getDefaulters = async (req: Request, res: Response) => {
    try {
        const defaulters = await contributionService.findDefaulters(req.params.chamaId);
        res.status(200).json({ data: defaulters });
    } catch (error) {
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const bulkImportContributions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { chamaId } = req.params;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'CSV file is required for bulk import.' });
    }
    const result = await contributionService.parseAndImportContributions(chamaId, file.buffer);
    res.status(201).json({ message: 'Bulk import processed successfully.', data: result });
  } catch (error) {
    if (isErrorWithMessage(error)) {
        if (error.message.includes('Invalid file type')) return res.status(415).json({ message: error.message });
        if (error.message.includes('CSV parsing error')) return res.status(400).json({ message: error.message });
        return res.status(400).json({ message: error.message });
    }
    console.error('Bulk Import Error:', error);
    res.status(500).json({ message: 'An unexpected error occurred during the bulk import process.' });
  }
};

export const exportContributions = async (req: Request, res: Response) => {
    try {
        const { chamaId } = req.params;
        const buffer = await contributionService.generateContributionsExport(chamaId);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=contributions-${chamaId}-${new Date().toISOString()}.csv`);
        res.status(200).send(buffer);
    } catch (error) {
        res.status(500).json({ message: 'An unexpected error occurred during export.' });
    }
};