import { Request, Response } from 'express';
import * as contributionService from '../services/contribution.service';
import { isErrorWithMessage, isPrismaError } from '../utils/error.utils';
import { PrismaClient } from '@prisma/client';
import { MembershipRole } from '@prisma/client';
import logger from '../config/logger';

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
        logger.info({ actorId, contributionId: contribution.id, membershipId: req.body.membershipId }, 'Contribution recorded successfully');
        res.status(201).json({ message: 'Contribution recorded successfully.', data: contribution });
    } catch (error) {
        if (isErrorWithMessage(error)) {
            const statusCode = error.message.includes('Permission Denied') ? 403 : 409;
            logger.warn({ error, actorId: req.user?.id }, 'Record contribution failed');
            return res.status(statusCode).json({ message: error.message });
        }
        logger.error({ error, actorId: req.user?.id }, 'Record contribution error');
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const updateContribution = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const actorId = req.user?.id;
        if (!actorId) return res.status(401).json({ message: 'User not authenticated' });
        
        const contributionToUpdate = await contributionService.findContributionById(req.params.id);
        if (!contributionToUpdate) {
            logger.warn({ contributionId: req.params.id }, 'Contribution not found for update');
            return res.status(404).json({ message: 'Contribution not found.' });
        }
        
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
            logger.warn({ actorId, contributionId: req.params.id }, 'Permission denied: Not admin or treasurer');
            return res.status(403).json({ message: "Permission Denied: You must be an Admin or Treasurer of this chama to update contributions." });
        }

        // Prepare logging metadata
        const logMeta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };

        // Pass metadata to the service function
        const contribution = await contributionService.updateContribution(req.params.id, req.body, actorId, logMeta);
        logger.info({ actorId, contributionId: req.params.id, updates: Object.keys(req.body) }, 'Contribution updated');
        res.status(200).json({ message: 'Contribution updated.', data: contribution });
    } catch (error) {
        if (isErrorWithMessage(error)) {
            logger.warn({ error, actorId: req.user?.id, contributionId: req.params.id }, 'Update contribution failed');
            return res.status(404).json({ message: error.message });
        }
        logger.error({ error, actorId: req.user?.id, contributionId: req.params.id }, 'Update contribution error');
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const deleteContribution = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const actorId = req.user?.id;
        if (!actorId) return res.status(401).json({ message: 'User not authenticated' });

        const contributionToDelete = await contributionService.findContributionById(req.params.id);
        if (!contributionToDelete) {
            logger.warn({ contributionId: req.params.id }, 'Contribution not found for deletion');
            return res.status(404).json({ message: 'Contribution not found.' });
        }

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
            logger.warn({ actorId, contributionId: req.params.id }, 'Permission denied: Not admin or treasurer for deletion');
            return res.status(403).json({ message: "Permission Denied: You must be an Admin or Treasurer of this chama to delete contributions." });
        }

        // Prepare logging metadata
        const logMeta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };

        // Pass metadata to the service function
        await contributionService.deleteContribution(req.params.id, actorId, logMeta);
        logger.info({ actorId, contributionId: req.params.id }, 'Contribution deleted');
        res.status(200).json({ message: 'Contribution deleted successfully.' });
    } catch (error) {
        if (isErrorWithMessage(error)) {
            logger.warn({ error, actorId: req.user?.id, contributionId: req.params.id }, 'Delete contribution failed');
            return res.status(404).json({ message: error.message });
        }
        logger.error({ error, actorId: req.user?.id, contributionId: req.params.id }, 'Delete contribution error');
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};


export const getChamaContributions = async (req: Request, res: Response) => {
    try {
        const { chamaId } = req.params;
        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = parseInt(req.query.limit as string, 10) || 10;
        const data = await contributionService.findChamaContributions(chamaId, page, limit);
        logger.info({ chamaId, page, limit, count: data.contributions.length }, 'Chama contributions fetched');
        res.status(200).json({ data });
    } catch (error) {
        logger.error({ error, chamaId: req.params.chamaId }, 'Get chama contributions error');
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const getMemberContributions = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { membershipId } = req.params;
        const actorId = req.user?.id;
        if (!actorId) return res.status(401).json({ message: 'User not authenticated' });

        const membership = await prisma.membership.findUnique({ where: { id: membershipId } });
        if (!membership) {
            logger.warn({ membershipId }, 'Membership not found');
            return res.status(404).json({ message: 'Membership not found.' });
        }

        const isOwner = membership.userId === actorId;
        const isPrivilegedAdmin = await prisma.membership.findFirst({
            where: { userId: actorId, chamaId: membership.chamaId, role: { in: [MembershipRole.ADMIN, MembershipRole.TREASURER] } }
        });

        if (!isOwner && !isPrivilegedAdmin) {
            logger.warn({ actorId, membershipId }, 'Permission denied: Cannot view member contributions');
            return res.status(403).json({ message: "Permission Denied: You cannot view this member's contributions." });
        }

        const contributions = await contributionService.findMemberContributions(membershipId);
        logger.info({ actorId, membershipId, count: contributions.length }, 'Member contributions fetched');
        res.status(200).json({ data: contributions });
    } catch (error) {
        logger.error({ error, actorId: req.user?.id, membershipId: req.params.membershipId }, 'Get member contributions error');
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const getContributionById = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const actorId = req.user?.id;
        if (!actorId) return res.status(401).json({ message: 'User not authenticated' });

        const contribution = await contributionService.findContributionById(req.params.id);
        if (!contribution) {
            logger.warn({ contributionId: req.params.id }, 'Contribution not found');
            return res.status(404).json({ message: 'Contribution not found.' });
        }

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
            logger.warn({ actorId, contributionId: req.params.id }, 'Permission denied: Not a member of chama');
            return res.status(403).json({ message: "Permission Denied: You are not a member of the chama this contribution belongs to." });
        }

        logger.info({ actorId, contributionId: req.params.id }, 'Contribution fetched by ID');
        res.status(200).json({ data: contribution });
    } catch (error) {
        logger.error({ error, actorId: req.user?.id, contributionId: req.params.id }, 'Get contribution by ID error');
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const getContributionSummary = async (req: Request, res: Response) => {
    try {
        const summary = await contributionService.getContributionSummary(req.params.chamaId);
        logger.info({ chamaId: req.params.chamaId }, 'Contribution summary fetched');
        res.status(200).json({ data: summary });
    } catch (error) {
        logger.error({ error, chamaId: req.params.chamaId }, 'Get contribution summary error');
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const getDefaulters = async (req: Request, res: Response) => {
    try {
        const defaulters = await contributionService.findDefaulters(req.params.chamaId);
        logger.info({ chamaId: req.params.chamaId, defaultersCount: defaulters.length }, 'Defaulters fetched');
        res.status(200).json({ data: defaulters });
    } catch (error) {
        logger.error({ error, chamaId: req.params.chamaId }, 'Get defaulters error');
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const bulkImportContributions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { chamaId } = req.params;
    const file = req.file;
    if (!file) {
      logger.warn({ chamaId }, 'Bulk import attempted without file');
      return res.status(400).json({ message: 'CSV file is required for bulk import.' });
    }
    const result = await contributionService.parseAndImportContributions(chamaId, file.buffer);
    logger.info({ chamaId, createdCount: result.createdCount, totalRecords: result.totalRecords }, 'Bulk import processed');
    res.status(201).json({ message: 'Bulk import processed successfully.', data: result });
  } catch (error) {
    if (isErrorWithMessage(error)) {
        if (error.message.includes('Invalid file type')) {
            logger.warn({ error, chamaId: req.params.chamaId }, 'Invalid file type for bulk import');
            return res.status(415).json({ message: error.message });
        }
        if (error.message.includes('CSV parsing error')) {
            logger.warn({ error, chamaId: req.params.chamaId }, 'CSV parsing error');
            return res.status(400).json({ message: error.message });
        }
        logger.warn({ error, chamaId: req.params.chamaId }, 'Bulk import failed');
        return res.status(400).json({ message: error.message });
    }
    logger.error({ error, chamaId: req.params.chamaId }, 'Bulk import error');
    res.status(500).json({ message: 'An unexpected error occurred during the bulk import process.' });
  }
};

export const exportContributions = async (req: Request, res: Response) => {
    try {
        const { chamaId } = req.params;
        const buffer = await contributionService.generateContributionsExport(chamaId);
        logger.info({ chamaId, exportSize: buffer.length }, 'Contributions exported');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=contributions-${chamaId}-${new Date().toISOString()}.csv`);
        res.status(200).send(buffer);
    } catch (error) {
        logger.error({ error, chamaId: req.params.chamaId }, 'Export contributions error');
        res.status(500).json({ message: 'An unexpected error occurred during export.' });
    }
};