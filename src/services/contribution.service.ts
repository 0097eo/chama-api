import { Contribution, Prisma, PrismaClient, AuditAction } from '@prisma/client';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { createAuditLog } from './audit.service';

const prisma = new PrismaClient();

interface LogMeta {
    ipAddress?: string;
    userAgent?: string;
}

const PENALTY_RATE = 0.05; // 5% penalty
const PAYMENT_DEADLINE_DAY = 15; // Payments are late after the 15th of the month

interface ContributionData {
    membershipId: string;
    amount: number;
    month: number;
    year: number;
    paymentMethod: string;
    mpesaCode?: string | null;
    paidAt: Date;
    status?: 'PENDING' | 'PAID'; // Add optional status field
}

/**
 * Calculates penalty for a late contribution.
 * @param contributionData - The contribution details.
 * @param standardAmount - The standard monthly contribution amount for the chama.
 * @returns The calculated penalty amount.
 */
const calculatePenalty = (contributionData: ContributionData, standardAmount: number): number => {
    // Only calculate penalty for PAID contributions
    if (contributionData.status === 'PENDING') {
        return 0; // No penalty for pending payments
    }
    
    const paymentDate = new Date(contributionData.paidAt);
    const deadline = new Date(contributionData.year, contributionData.month - 1, PAYMENT_DEADLINE_DAY);
    if (paymentDate > deadline) {
        return standardAmount * PENALTY_RATE;
    }
    return 0;
};

/**
 * Records a new contribution, checks for duplicates, applies penalties, and creates an audit log.
 */
export const recordContribution = async (data: ContributionData, actorId: string, logMeta: LogMeta): Promise<Contribution> => {
    const membership = await prisma.membership.findUnique({
        where: { id: data.membershipId },
        include: { chama: true },
    });
    if (!membership) throw new Error('Membership not found.');

    const canRecord = membership.userId === actorId || await prisma.membership.findFirst({
        where: { userId: actorId, chamaId: membership.chamaId, role: { in: ['ADMIN', 'TREASURER'] } }
    });
    if (!canRecord) throw new Error('Permission Denied: You cannot record a contribution for this member.');

    const existingContribution = await prisma.contribution.findFirst({
        where: { membershipId: data.membershipId, month: data.month, year: data.year }
    });
    if (existingContribution) throw new Error('A contribution for this member for the specified month and year already exists.');

    // Determine the final status and penalty
    const finalStatus = data.status || 'PAID'; // Default to PAID for backward compatibility
    const penaltyApplied = calculatePenalty({ ...data, status: finalStatus }, membership.chama.monthlyContribution);

    const newContribution = await prisma.contribution.create({
        data: {
            ...data,
            status: finalStatus,
            penaltyApplied,
        },
    });

    // Create the audit log for the creation event
    await createAuditLog({
        action: AuditAction.CONTRIBUTION_CREATE,
        actorId,
        chamaId: membership.chamaId,
        contributionId: newContribution.id,
        newValue: newContribution,
        ...logMeta,
    });

    return newContribution;
};

/**
 * Updates an existing contribution record and creates an audit log.
 */
export const updateContribution = async (id: string, data: Partial<Contribution>, actorId: string, logMeta: LogMeta) => {
    const oldValue = await prisma.contribution.findUnique({
        where: { id },
        include: { membership: true }
    });
    if (!oldValue) throw new Error('Contribution not found.');

    // If updating from PENDING to PAID, recalculate penalty
    let updateData = { ...data };
    if (oldValue.status === 'PENDING' && data.status === 'PAID') {
        const membership = await prisma.membership.findUnique({
            where: { id: oldValue.membershipId },
            include: { chama: true }
        });
        if (membership) {
            const contributionData = {
                ...oldValue,
                ...data,
                status: 'PAID' as const,
                paidAt: data.paidAt || new Date(),
            };
            updateData.penaltyApplied = calculatePenalty(contributionData, membership.chama.monthlyContribution);
        }
    }

    const updatedContribution = await prisma.contribution.update({ 
        where: { id }, 
        data: updateData 
    });

    await createAuditLog({
        action: AuditAction.CONTRIBUTION_UPDATE,
        actorId,
        chamaId: oldValue.membership.chamaId,
        contributionId: id,
        oldValue,
        newValue: updatedContribution,
        ...logMeta,
    });
    
    return updatedContribution;
};

/**
 * Deletes a contribution record and creates an audit log.
 */
export const deleteContribution = async (id: string, actorId: string, logMeta: LogMeta) => {
    const oldValue = await prisma.contribution.findUnique({
        where: { id },
        include: { membership: true }
    });
    if (!oldValue) throw new Error('Contribution not found.');
    
    const deletedContribution = await prisma.contribution.delete({ where: { id } });

    await createAuditLog({
        action: AuditAction.CONTRIBUTION_DELETE,
        actorId,
        chamaId: oldValue.membership.chamaId,
        oldValue: deletedContribution,
        ...logMeta,
    });

    return deletedContribution;
};

export const findChamaContributions = async (chamaId: string, page: number, limit: number) => {
    const skip = (page - 1) * limit;
    const where: Prisma.ContributionWhereInput = { membership: { chamaId } };
    const contributions = await prisma.contribution.findMany({
        where,
        skip,
        take: limit,
        include: { membership: { include: { user: { select: { firstName: true, lastName: true } } } } },
        orderBy: { paidAt: 'desc' }
    });
    const totalRecords = await prisma.contribution.count({ where });
    return { contributions, totalRecords, totalPages: Math.ceil(totalRecords / limit) };
};

export const findMemberContributions = async (membershipId: string) => {
    return prisma.contribution.findMany({
        where: { membershipId },
        orderBy: [{ year: 'desc' }, { month: 'desc' }]
    });
};

export const findContributionById = (id: string) => {
    return prisma.contribution.findUnique({ where: { id } });
};

export const getContributionSummary = async (chamaId: string) => {
    const year = new Date().getFullYear();
    const where = { membership: { chamaId }, year };
    const result = await prisma.contribution.aggregate({
        _sum: { amount: true, penaltyApplied: true },
        _count: { id: true },
        where: { ...where, status: 'PAID' }
    });
    const activeMembers = await prisma.membership.count({ where: { chamaId, isActive: true } });
    const chama = await prisma.chama.findUnique({ where: { id: chamaId } });
    const totalExpected = (activeMembers * (chama?.monthlyContribution || 0)) * 12;
    const totalPaid = result._sum.amount || 0;
    return {
        year,
        totalPaid,
        totalPenalties: result._sum.penaltyApplied || 0,
        paidContributionsCount: result._count.id,
        totalExpected,
        deficit: totalExpected - totalPaid,
    };
};

export const findDefaulters = async (chamaId: string) => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const paidMemberIds = (await prisma.contribution.findMany({
        where: { month, year, status: 'PAID', membership: { chamaId } },
        select: { membershipId: true },
    })).map(c => c.membershipId);
    return prisma.membership.findMany({
        where: { chamaId, isActive: true, id: { notIn: paidMemberIds } },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
    });
};

export const parseAndImportContributions = async (chamaId: string, fileBuffer: Buffer) => {
    const csvData = fileBuffer.toString('utf-8');
    const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });
    if (parsed.errors.length) {
        throw new Error(`CSV parsing error: ${parsed.errors[0].message}`);
    }
    const records = parsed.data as any[];
    return prisma.$transaction(async (tx) => {
        const results = [];
        for (const record of records) {
            const membership = await tx.membership.findFirst({
                where: { user: { email: record.email }, chamaId },
            });
            if (!membership) continue;
            const contribution = await tx.contribution.create({
                data: {
                    membershipId: membership.id,
                    amount: parseFloat(record.amount),
                    month: parseInt(record.month, 10),
                    year: parseInt(record.year, 10),
                    paymentMethod: record.paymentMethod,
                    paidAt: new Date(record.paidAt),
                    status: 'PAID', // Bulk imports are considered completed payments
                }
            });
            results.push(contribution);
        }
        return { createdCount: results.length, totalRecords: records.length };
    });
};

export const generateContributionsExport = async (chamaId: string): Promise<Buffer> => {
    const contributions = await prisma.contribution.findMany({
        where: { membership: { chamaId } },
        include: { membership: { include: { user: true } } },
        orderBy: { paidAt: 'asc' },
    });
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Contributions');
    worksheet.columns = [
        { header: 'Member Name', key: 'name', width: 30 },
        { header: 'Amount', key: 'amount', width: 15 },
        { header: 'Penalty', key: 'penalty', width: 15 },
        { header: 'Month', key: 'month', width: 10 },
        { header: 'Year', key: 'year', width: 10 },
        { header: 'Payment Method', key: 'method', width: 20 },
        { header: 'Date Paid', key: 'paidAt', width: 20 },
        { header: 'Status', key: 'status', width: 15 },
    ];
    contributions.forEach(c => {
        worksheet.addRow({
            name: `${c.membership.user.firstName} ${c.membership.user.lastName}`,
            amount: c.amount,
            penalty: c.penaltyApplied,
            month: c.month,
            year: c.year,
            method: c.paymentMethod,
            paidAt: c.paidAt,
            status: c.status,
        });
    });
    const buffer = await workbook.csv.writeBuffer();
    return Buffer.from(buffer);
};