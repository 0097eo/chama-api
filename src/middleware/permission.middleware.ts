import { Request, Response, NextFunction } from 'express';
import { MembershipRole, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

/**
 * Checks if a user has a specific role in a Chama, but derives the Chama ID
 * from a Loan ID provided in the request parameters.
 *
 * This is used for actions on a specific loan, like approving or disbursing.
 */
export const checkLoanPermission = (allowedRoles: MembershipRole[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user?.id;
      const loanId = req.params.id;

      if (!actorId) {
        return res.status(401).json({ message: 'Authentication required.' });
      }
      if (!loanId) {
        return res.status(400).json({ message: 'Loan ID parameter is missing.' });
      }

      // 1. Find the loan to get its details
      const loan = await prisma.loan.findUnique({
        where: { id: loanId },
        select: { membership: { select: { chamaId: true } } }, // Select only what we need
      });

      if (!loan) {
        return res.status(404).json({ message: 'Loan not found.' });
      }

      const chamaId = loan.membership.chamaId;

      // 2. Now check the actor's membership in that specific chama
      const actorMembership = await prisma.membership.findUnique({
        where: {
          userId_chamaId: {
            userId: actorId,
            chamaId: chamaId,
          },
        },
      });

      if (!actorMembership || !actorMembership.isActive) {
        return res.status(403).json({ message: 'Access Denied: You are not an active member of this chama.' });
      }

      if (!allowedRoles.includes(actorMembership.role)) {
        return res.status(403).json({ message: `Access Denied: This action requires one of the following roles: ${allowedRoles.join(', ')}.` });
      }

      // 3. If all checks pass, proceed
      next();
    } catch (error) {
      res.status(500).json({ message: 'Internal server error during loan permission check.' });
    }
  };
};

/**
 * Checks if a user has a specific role in a Chama, but derives the Chama ID
 * from a Meeting ID provided in the request parameters.
 *
 * This is used for actions on a specific meeting, like generating a QR code or saving minutes.
 */
export const checkMeetingPermission = (allowedRoles: MembershipRole[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user?.id;
      const meetingId = req.params.id;

      if (!actorId) {
        return res.status(401).json({ message: 'Authentication required.' });
      }
      if (!meetingId) {
        return res.status(400).json({ message: 'Meeting ID parameter is missing.' });
      }

      const meeting = await prisma.meeting.findUnique({
        where: { id: meetingId },
        select: { chamaId: true }, // Select only what we need
      });

      if (!meeting) {
        return res.status(404).json({ message: 'Meeting not found.' });
      }

      const chamaId = meeting.chamaId;

      const actorMembership = await prisma.membership.findUnique({
        where: {
          userId_chamaId: {
            userId: actorId,
            chamaId: chamaId,
          },
        },
      });

      if (!actorMembership || !actorMembership.isActive) {
        return res.status(403).json({ message: 'Access Denied: You are not an active member of this chama.' });
      }

      if (!allowedRoles.includes(actorMembership.role)) {
        return res.status(403).json({ message: `Access Denied: This action requires one of the following roles: ${allowedRoles.join(', ')}.` });
      }

      next();
    } catch (error) {
      res.status(500).json({ message: 'Internal server error during meeting permission check.' });
    }
  };
};