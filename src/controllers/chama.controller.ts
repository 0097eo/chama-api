import { Request, Response } from 'express';
import * as chamaService from '../services/chama.service';
import { MembershipRole } from '@prisma/client';
import { isErrorWithMessage, isPrismaError } from '../utils/error.utils';

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
    res.status(201).json({ message: 'Chama created successfully', data: newChama });
  } catch (error) {
    if (isPrismaError(error) && error.code === 'P2002') {
      return res.status(409).json({ message: 'A chama with this name already exists.' });
    }
    console.error('Create Chama Error:', error);
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
    res.status(200).json({ data: chamas });
  } catch (error) {
    console.error('Get User Chamas Error:', error);
    res.status(500).json({ message: 'An unexpected error occurred while fetching your chamas.' });
  }
};

export const getChamaById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const chama = await chamaService.findChamaDetails(id);
    if (!chama) {
      return res.status(404).json({ message: 'Chama not found.' });
    }
    res.status(200).json({ data: chama });
  } catch (error) {
    console.error('Get Chama By ID Error:', error);
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
        res.status(200).json({ message: 'Chama updated successfully', data: updatedChama });
    } catch (error) {
        if (isPrismaError(error) && error.code === 'P2025') {
             return res.status(404).json({ message: 'Chama not found.' });
        }
        console.error('Update Chama Error:', error);
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
        res.status(200).json({ message: 'Chama deleted successfully.' });
    } catch (error) {
        if (isPrismaError(error) && error.code === 'P2025') {
             return res.status(404).json({ message: 'Chama not found.' });
        }
        console.error('Delete Chama Error:', error);
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
        res.status(201).json({ message: `User ${email} successfully added to the chama.`, data: newMembership });
    } catch (error) {
        if (isPrismaError(error) && error.code === 'P2002') {
            return res.status(409).json({ message: 'This user is already a member of this chama.' });
        }
        if (isErrorWithMessage(error)) {
            return res.status(404).json({ message: error.message });
        }
        console.error('Add Member Error:', error);
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
        res.status(200).json({ message: 'Member removed successfully.' });
    } catch (error) {
        if (isPrismaError(error) && error.code === 'P2025') {
            return res.status(404).json({ message: 'Membership not found for this user and chama.' });
        }
        if(isErrorWithMessage(error) && error.message.includes('Membership not found')){
            return res.status(404).json({ message: error.message });
        }
        console.error('Remove Member Error:', error);
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
        res.status(200).json({ message: "Member's role updated successfully.", data: updatedMembership });
    } catch (error) {
        if (isPrismaError(error) && error.code === 'P2025') {
            return res.status(404).json({ message: 'Membership not found for this user and chama.' });
        }
        if (isErrorWithMessage(error)) {
            return res.status(400).json({ message: error.message });
        }
        console.error('Update Member Role Error:', error);
        res.status(500).json({ message: "An unexpected error occurred while updating the member's role." });
    }
};

export const getChamaDashboard = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const dashboardData = await chamaService.getDashboardData(id);
        res.status(200).json({ data: dashboardData });
    } catch (error) {
        console.error('Get Dashboard Error:', error);
        res.status(500).json({ message: 'An unexpected error occurred while fetching dashboard data.' });
    }
};