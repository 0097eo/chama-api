import { Chama, Membership, MembershipRole, AuditAction, PrismaClient } from '@prisma/client';
import { add } from 'date-fns';
import { createAuditLog } from './audit.service';
import logger from '../config/logger';

const prisma = new PrismaClient();

interface ChamaCreationData {
  name: string;
  description?: string;
  monthlyContribution: number;
  meetingDay: string;
  constitutionUrl?: string;
}

const generateRegistrationNumber = (): string => {
    const prefix = "CHM";
    const randomNumber = Math.floor(100000 + Math.random() * 900000);
    return `${prefix}-${randomNumber}`;
};

export const createChamaAndFirstMember = async (data: ChamaCreationData, creatorId: string): Promise<Chama> => {
  logger.info({ creatorId, chamaName: data.name }, 'Creating new chama');

  let uniqueRegistrationNumber: string;
  let isUnique = false;

  while (!isUnique) {
      uniqueRegistrationNumber = generateRegistrationNumber();
      const existingChama = await prisma.chama.findUnique({
          where: { registrationNumber: uniqueRegistrationNumber },
      });
      if (!existingChama) {
          isUnique = true;
      }
  }

  const newChama = await prisma.$transaction(async (tx) => {
    const chama = await tx.chama.create({
      data: {
        name: data.name,
        description: data.description,
        monthlyContribution: data.monthlyContribution,
        meetingDay: data.meetingDay,
        constitutionUrl: data.constitutionUrl,
        totalMembers: 1,
        registrationNumber: uniqueRegistrationNumber,
      },
    });

    await tx.membership.create({
      data: {
        chamaId: chama.id,
        userId: creatorId,
        role: 'ADMIN',
        isActive: true,
      },
    });

    return chama;
  });

  logger.info({ chamaId: newChama.id, creatorId, registrationNumber: newChama.registrationNumber }, 'Chama created successfully');

  return newChama;
};

export const findUserChamas = async (userId: string): Promise<Chama[]> => {
  logger.info({ userId }, 'Fetching user chamas');

  const chamas = await prisma.chama.findMany({
    where: {
      members: {
        some: {
          userId: userId,
          isActive: true,
        },
      },
    },
    include: {
        members: {
            where: { isActive: true },
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
        }
    },
    orderBy: {
        createdAt: 'desc'
    }
  });

  logger.info({ userId, count: chamas.length }, 'User chamas fetched successfully');

  return chamas;
};

export const findChamaDetails = async (chamaId: string) => {
  logger.info({ chamaId }, 'Fetching chama details');

  const chama = await prisma.chama.findUnique({
    where: { id: chamaId },
    include: {
      members: {
        where: { isActive: true },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, phone: true },
          },
        },
        orderBy: { role: 'asc' }
      },
    },
  });

  if (chama) {
    logger.info({ chamaId, memberCount: chama.members.length }, 'Chama details fetched successfully');
  } else {
    logger.warn({ chamaId }, 'Chama not found');
  }

  return chama;
};

export const updateChamaDetails = async (chamaId: string, actorId: string, data: Partial<ChamaCreationData>) => {
    logger.info({ chamaId, actorId }, 'Updating chama details');

    const oldValue = await prisma.chama.findUnique({ where: { id: chamaId } });

    const updatedChama = await prisma.chama.update({
        where: { id: chamaId },
        data: data,
    });

    await createAuditLog({
        actorId,
        chamaId,
        action: AuditAction.CHAMA_UPDATE,
        oldValue: oldValue || undefined,
        newValue: updatedChama,
    });

    logger.info({ chamaId, actorId }, 'Chama details updated successfully');

    return updatedChama;
};

export const deleteChamaById = async (chamaId: string, actorId: string) => {
    logger.info({ chamaId, actorId }, 'Deleting chama');

    const oldValue = await prisma.chama.findUnique({ where: { id: chamaId } });

    const deletedChama = await prisma.chama.delete({ where: { id: chamaId } });

    await createAuditLog({
        actorId,
        chamaId,
        action: AuditAction.CHAMA_DELETE,
        oldValue: oldValue || undefined,
    });

    logger.info({ chamaId, actorId }, 'Chama deleted successfully');

    return deletedChama;
};

export const addMemberToChama = async (chamaId: string, actorId: string, userEmail: string): Promise<Membership> => {
    logger.info({ chamaId, actorId, userEmail }, 'Adding member to chama');

    const userToAdd = await prisma.user.findUnique({
        where: { email: userEmail },
    });

    if (!userToAdd) {
        logger.warn({ chamaId, userEmail }, 'Cannot add member: user not found');
        throw new Error('User with this email does not exist. Please ask them to register first.');
    }

    const newMembership = await prisma.$transaction(async (tx) => {
        const membership = await tx.membership.create({
            data: {
                userId: userToAdd.id,
                chamaId: chamaId,
                role: 'MEMBER',
                isActive: true,
            },
        });
        await tx.chama.update({
            where: { id: chamaId },
            data: { totalMembers: { increment: 1 } },
        });
        return membership;
    });

    await createAuditLog({
        actorId,
        chamaId,
        action: AuditAction.CHAMA_MEMBER_ADD,
        targetId: userToAdd.id,
        newValue: { membershipId: newMembership.id, userId: userToAdd.id, userEmail },
    });

    logger.info({ chamaId, actorId, newMemberId: userToAdd.id }, 'Member added to chama successfully');
    
    return newMembership;
};

export const removeMemberFromChama = async (chamaId: string, actorId: string, userIdToRemove: string) => {
    logger.info({ chamaId, actorId, userIdToRemove }, 'Removing member from chama');

    const membershipToRemove = await prisma.membership.findUnique({
        where: { userId_chamaId: { userId: userIdToRemove, chamaId } }
    });
    
    if (!membershipToRemove) {
        logger.warn({ chamaId, userIdToRemove }, 'Cannot remove member: membership not found');
        throw new Error('Membership not found.');
    }

    const deletedMembership = await prisma.$transaction(async (tx) => {
        const membership = await tx.membership.delete({ where: { userId_chamaId: { userId: userIdToRemove, chamaId } } });
        await tx.chama.update({ where: { id: chamaId }, data: { totalMembers: { decrement: 1 } } });
        return membership;
    });

    await createAuditLog({
        actorId,
        chamaId,
        action: AuditAction.CHAMA_MEMBER_REMOVE,
        targetId: userIdToRemove,
        oldValue: membershipToRemove,
    });

    logger.info({ chamaId, actorId, userIdToRemove }, 'Member removed from chama successfully');
    
    return deletedMembership;
};

export const updateMemberRoleInChama = async (chamaId: string, actorId: string, userIdToUpdate: string, newRole: MembershipRole) => {
    logger.info({ chamaId, actorId, userIdToUpdate, newRole }, 'Updating member role');

    const oldMembership = await prisma.membership.findUnique({
        where: { userId_chamaId: { userId: userIdToUpdate, chamaId } },
    });

    if (!oldMembership) {
        logger.warn({ chamaId, userIdToUpdate }, 'Cannot update role: membership not found');
        throw new Error('Membership not found.');
    }
    
    if (newRole !== 'ADMIN') {
        const adminCount = await prisma.membership.count({
            where: { chamaId, role: 'ADMIN' },
        });
        if (adminCount <= 1 && oldMembership.role === 'ADMIN') {
            logger.warn({ chamaId, userIdToUpdate }, 'Cannot demote last admin');
            throw new Error('Cannot demote the last admin. Please assign another admin first.');
        }
    }

    const updatedMembership = await prisma.membership.update({
        where: { userId_chamaId: { userId: userIdToUpdate, chamaId } },
        data: { role: newRole },
    });
    
    await createAuditLog({
        actorId,
        chamaId,
        action: AuditAction.CHAMA_MEMBER_ROLE_UPDATE,
        targetId: userIdToUpdate,
        oldValue: { role: oldMembership.role },
        newValue: { role: newRole },
    });

    logger.info({ chamaId, actorId, userIdToUpdate, oldRole: oldMembership.role, newRole }, 'Member role updated successfully');

    return updatedMembership;
};

export const createMemberInvitation = async (chamaId: string, email: string, inviterId: string) => {
    logger.info({ chamaId, email, inviterId }, 'Creating member invitation');

    const existingMembership = await prisma.membership.findFirst({
        where: { chamaId, user: { email } },
    });

    if (existingMembership) {
        logger.warn({ chamaId, email }, 'Cannot invite: user already a member');
        throw new Error('This user is already a member of the chama.');
    }

    const expiresAt = add(new Date(), { days: 7 });
    const invitation = await prisma.chamaInvitation.create({
        data: { chamaId, email, inviterId, expiresAt },
    });

    logger.info({ chamaId, email, inviterId, invitationId: invitation.id }, 'Member invitation created successfully');

    return invitation;
};

export const getDashboardData = async (chamaId: string) => {
    logger.info({ chamaId }, 'Fetching dashboard data');

    const currentYear = new Date().getFullYear();

    const [totalContributions, loanData, memberCount] = await Promise.all([
        prisma.contribution.aggregate({
            _sum: { amount: true },
            where: { membership: { chamaId }, year: currentYear, status: 'PAID' },
        }),
        prisma.loan.aggregate({
            _sum: { amount: true },
            _count: { id: true },
            where: { membership: { chamaId }, status: 'ACTIVE' },
        }),
        prisma.membership.count({
            where: { chamaId, isActive: true },
        }),
    ]);

    const dashboardData = {
        totalMembers: memberCount,
        totalContributionsThisYear: totalContributions._sum.amount || 0,
        activeLoansCount: loanData._count.id || 0,
        totalLoanAmountActive: loanData._sum.amount || 0,
    };

    logger.info({ chamaId, ...dashboardData }, 'Dashboard data fetched successfully');

    return dashboardData;
};