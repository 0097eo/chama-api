import { Request, Response, NextFunction } from 'express';
import { MembershipRole } from '../generated/prisma/client';
import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

// Extend the Express Request type to include the authenticated user from 'protect' middleware
interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

export const checkMembership = (allowedRoles: MembershipRole[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const chamaId = req.params.chamaId || req.params.id; // Chama ID from URL params, e.g., /api/chamas/:id/

      if (!userId) {
        return res.status(401).json({ message: 'Authentication required.' });
      }
      if (!chamaId) {
        return res.status(400).json({ message: 'Chama ID parameter is missing.' });
      }

      const membership = await prisma.membership.findUnique({
        where: {
          userId_chamaId: {
            userId: userId,
            chamaId: chamaId,
          },
        },
      });

      if (!membership || !membership.isActive) {
        return res.status(403).json({ message: 'Access Denied: You are not an active member of this chama.' });
      }

      if (!allowedRoles.includes(membership.role)) {
        return res.status(403).json({ message: `Access Denied: This action requires one of the following roles: ${allowedRoles.join(', ')}.` });
      }

      next();
    } catch (error) {
      res.status(500).json({ message: 'Internal server error during permission check.' });
    }
  };
};