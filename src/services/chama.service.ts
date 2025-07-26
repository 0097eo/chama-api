import { Chama, Membership, MembershipRole, AuditAction, PrismaClient } from '../generated/prisma/client';
import { add } from 'date-fns';
import { createAuditLog } from './audit.service';

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

  return prisma.$transaction(async (tx) => {
    const newChama = await tx.chama.create({
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
        chamaId: newChama.id,
        userId: creatorId,
        role: 'ADMIN',
        isActive: true,
      },
    });

    return newChama;
  });
};

export const findUserChamas = (userId: string): Promise<Chama[]> => {
  return prisma.chama.findMany({
    where: {
      members: {
        some: {
          userId: userId,
          isActive: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' }
  });
};

export const findChamaDetails = (chamaId: string) => {
  return prisma.chama.findUnique({
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
};

export const updateChamaDetails = async (chamaId: string, actorId: string, data: Partial<ChamaCreationData>) => {
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

    return updatedChama;
};

export const deleteChamaById = async (chamaId: string, actorId: string) => {
    const oldValue = await prisma.chama.findUnique({ where: { id: chamaId } });

    const deletedChama = await prisma.chama.delete({ where: { id: chamaId } });

    await createAuditLog({
        actorId,
        chamaId,
        action: AuditAction.CHAMA_DELETE,
        oldValue: oldValue || undefined,
    });

    return deletedChama;
};

export const addMemberToChama = async (chamaId: string, actorId: string, userEmail: string): Promise<Membership> => {
    const userToAdd = await prisma.user.findUnique({
        where: { email: userEmail },
    });

    if (!userToAdd) {
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
    
    return newMembership;
};

export const removeMemberFromChama = async (chamaId: string, actorId: string, userIdToRemove: string) => {
    const membershipToRemove = await prisma.membership.findUnique({
        where: { userId_chamaId: { userId: userIdToRemove, chamaId } }
    });
    
    if (!membershipToRemove) {
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
    
    return deletedMembership;
};

export const updateMemberRoleInChama = async (chamaId: string, actorId: string, userIdToUpdate: string, newRole: MembershipRole) => {
    const oldMembership = await prisma.membership.findUnique({
        where: { userId_chamaId: { userId: userIdToUpdate, chamaId } },
    });

    if (!oldMembership) {
        throw new Error('Membership not found.');
    }
    
    if (newRole !== 'ADMIN') {
        const adminCount = await prisma.membership.count({
            where: { chamaId, role: 'ADMIN' },
        });
        if (adminCount <= 1 && oldMembership.role === 'ADMIN') {
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

    return updatedMembership;
};

export const createMemberInvitation = async (chamaId: string, email: string, inviterId: string) => {
    const existingMembership = await prisma.membership.findFirst({
        where: { chamaId, user: { email } },
    });
    if (existingMembership) {
        throw new Error('This user is already a member of the chama.');
    }
    const expiresAt = add(new Date(), { days: 7 });
    return prisma.chamaInvitation.create({
        data: { chamaId, email, inviterId, expiresAt },
    });
};

export const getDashboardData = async (chamaId: string) => {
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

    return {
        totalMembers: memberCount,
        totalContributionsThisYear: totalContributions._sum.amount || 0,
        activeLoansCount: loanData._count.id || 0,
        totalLoanAmountActive: loanData._sum.amount || 0,
    };
};