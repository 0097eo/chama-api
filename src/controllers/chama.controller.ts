import { Request, Response } from 'express';
import * as chamaService from '../services/chama.service';
import { MembershipRole } from '@prisma/client';
import { isErrorWithMessage, isPrismaError } from '../utils/error.utils';
import logger from '../config/logger';

// Extend request type to include user and file from middleware
interface AuthenticatedRequest extends Request {
  user?: { id: string };
  file?: Express.Multer.File & { path: string };
}

export const createChama = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const creatorId = req.user?.id;
    if (!creatorId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    const { name, description, monthlyContribution, meetingDay } = req.body;
    const constitutionUrl = req.file?.path;
    const chamaData = {
      name,
      description,
      monthlyContribution: parseFloat(monthlyContribution),
      meetingDay,
      constitutionUrl,
    };
    const newChama = await chamaService.createChamaAndFirstMember(chamaData, creatorId);
    logger.info({ creatorId, chamaId: newChama.id, chamaName: name }, 'Chama created successfully');
    res.status(201).json({ message: 'Chama created successfully', data: newChama });
  } catch (error) {
    if (isPrismaError(error) && error.code === 'P2002') {
      logger.warn({ error, chamaName: req.body.name }, 'Duplicate chama name');
      return res.status(409).json({ message: 'A chama with this name already exists.' });
    }
    logger.error({ error, creatorId: req.user?.id }, 'Create Chama Error');
    res.status(500).json({ message: 'An unexpected error occurred while creating the chama.' });
  }
};

export const getUserChamas = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    const chamas = await chamaService.findUserChamas(userId);
    logger.info({ userId, chamaCount: chamas.length }, 'User chamas fetched');
    res.status(200).json({ data: chamas });
  } catch (error) {
    logger.error({ error, userId: req.user?.id }, 'Get User Chamas Error');
    res.status(500).json({ message: 'An unexpected error occurred while fetching your chamas.' });
  }
};

export const getChamaById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const chama = await chamaService.findChamaDetails(id);
    if (!chama) {
      logger.warn({ chamaId: id }, 'Chama not found');
      return res.status(404).json({ message: 'Chama not found.' });
    }
    logger.info({ chamaId: id }, 'Chama details fetched');
    res.status(200).json({ data: chama });
  } catch (error) {
    logger.error({ error, chamaId: req.params.id }, 'Get Chama By ID Error');
    res.status(500).json({ message: 'An unexpected error occurred while fetching chama details.' });
  }
};

export const updateChama = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const actorId = req.user?.id;
        if (!actorId) {
            return res.status(401).json({ message: 'User not authenticated' });
        }
        const updatedChama = await chamaService.updateChamaDetails(id, actorId, req.body);
        logger.info({ actorId, chamaId: id, updates: Object.keys(req.body) }, 'Chama updated successfully');
        res.status(200).json({ message: 'Chama updated successfully', data: updatedChama });
    } catch (error) {
        if (isPrismaError(error) && error.code === 'P2025') {
            logger.warn({ chamaId: req.params.id }, 'Chama not found for update');
            return res.status(404).json({ message: 'Chama not found.' });
        }
        logger.error({ error, actorId: req.user?.id, chamaId: req.params.id }, 'Update Chama Error');
        res.status(500).json({ message: 'An unexpected error occurred while updating the chama.' });
    }
};

export const deleteChama = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const actorId = req.user?.id;
        if (!actorId) {
            return res.status(401).json({ message: 'User not authenticated' });
        }
        await chamaService.deleteChamaById(id, actorId);
        logger.info({ actorId, chamaId: id }, 'Chama deleted successfully');
        res.status(200).json({ message: 'Chama deleted successfully.' });
    } catch (error) {
        if (isPrismaError(error) && error.code === 'P2025') {
            logger.warn({ chamaId: req.params.id }, 'Chama not found for deletion');
            return res.status(404).json({ message: 'Chama not found.' });
        }
        logger.error({ error, actorId: req.user?.id, chamaId: req.params.id }, 'Delete Chama Error');
        res.status(500).json({ message: 'An unexpected error occurred while deleting the chama.' });
    }
};

export const addMember = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: chamaId } = req.params;
        const { email } = req.body;
        const actorId = req.user?.id;
        if (!actorId) {
            return res.status(401).json({ message: 'User not authenticated' });
        }
        const newMembership = await chamaService.addMemberToChama(chamaId, actorId, email);
        logger.info({ actorId, chamaId, memberEmail: email }, 'Member added to chama');
        res.status(201).json({ message: `User ${email} successfully added to the chama.`, data: newMembership });
    } catch (error) {
        if (isPrismaError(error) && error.code === 'P2002') {
            logger.warn({ chamaId: req.params.id, email: req.body.email }, 'Duplicate member');
            return res.status(409).json({ message: 'This user is already a member of this chama.' });
        }
        if (isErrorWithMessage(error)) {
            logger.warn({ error, chamaId: req.params.id, email: req.body.email }, 'Add member failed');
            return res.status(404).json({ message: error.message });
        }
        logger.error({ error, actorId: req.user?.id, chamaId: req.params.id }, 'Add Member Error');
        res.status(500).json({ message: 'An unexpected error occurred while adding the member.' });
    }
};

export const removeMember = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: chamaId, userId } = req.params;
        const actorId = req.user?.id;
        if (!actorId) {
            return res.status(401).json({ message: 'User not authenticated' });
        }
        await chamaService.removeMemberFromChama(chamaId, actorId, userId);
        logger.info({ actorId, chamaId, removedUserId: userId }, 'Member removed from chama');
        res.status(200).json({ message: 'Member removed successfully.' });
    } catch (error) {
        if (isPrismaError(error) && error.code === 'P2025') {
            logger.warn({ chamaId: req.params.id, userId: req.params.userId }, 'Membership not found for removal');
            return res.status(404).json({ message: 'Membership not found for this user and chama.' });
        }
        if(isErrorWithMessage(error) && error.message.includes('Membership not found')){
            logger.warn({ error, chamaId: req.params.id, userId: req.params.userId }, 'Membership not found');
            return res.status(404).json({ message: error.message });
        }
        logger.error({ error, actorId: req.user?.id, chamaId: req.params.id }, 'Remove Member Error');
        res.status(500).json({ message: 'An unexpected error occurred while removing the member.' });
    }
};

export const updateMemberRole = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: chamaId, userId } = req.params;
        const { role } = req.body as { role: MembershipRole };
        const actorId = req.user?.id;
        if (!actorId) {
            return res.status(401).json({ message: 'User not authenticated' });
        }
        const updatedMembership = await chamaService.updateMemberRoleInChama(chamaId, actorId, userId, role);
        logger.info({ actorId, chamaId, targetUserId: userId, newRole: role }, 'Member role updated');
        res.status(200).json({ message: "Member's role updated successfully.", data: updatedMembership });
    } catch (error) {
        if (isPrismaError(error) && error.code === 'P2025') {
            logger.warn({ chamaId: req.params.id, userId: req.params.userId }, 'Membership not found for role update');
            return res.status(404).json({ message: 'Membership not found for this user and chama.' });
        }
        if (isErrorWithMessage(error)) {
            logger.warn({ error, chamaId: req.params.id, userId: req.params.userId }, 'Update member role failed');
            return res.status(400).json({ message: error.message });
        }
        logger.error({ error, actorId: req.user?.id, chamaId: req.params.id }, 'Update Member Role Error');
        res.status(500).json({ message: "An unexpected error occurred while updating the member's role." });
    }
};

export const getChamaDashboard = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const dashboardData = await chamaService.getDashboardData(id);
        logger.info({ chamaId: id }, 'Dashboard data fetched');
        res.status(200).json({ data: dashboardData });
    } catch (error) {
        logger.error({ error, chamaId: req.params.id }, 'Get Dashboard Error');
        res.status(500).json({ message: 'An unexpected error occurred while fetching dashboard data.' });
    }
};