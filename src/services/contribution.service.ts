import { Contribution, Prisma, PrismaClient } from '../generated/prisma/client';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';

const prisma = new PrismaClient();

const PENALTY_RATE = 0.05; // 5% penalty
const PAYMENT_DEADLINE_DAY = 15; // Payments are late after the 15th of the month

interface ContributionData {
    membershipId: string;
    amount: number;
    month: number;
    year: number;
    paymentMethod: string;
    mpesaCode?: string;
    paidAt: Date;
}

/**
 * Calculates penalty for a late contribution.
 * @param contributionData - The contribution details.
 * @param standardAmount - The standard monthly contribution amount for the chama.
 * @returns The calculated penalty amount.
 */
const calculatePenalty = (contributionData: ContributionData, standardAmount: number): number => {
    const paymentDate = new Date(contributionData.paidAt);
    const deadline = new Date(contributionData.year, contributionData.month - 1, PAYMENT_DEADLINE_DAY);

    if (paymentDate > deadline) {
        return standardAmount * PENALTY_RATE;
    }
    return 0;
};

/**
 * Records a new contribution, checks for duplicates, and applies penalties.
 */
export const recordContribution = async (data: ContributionData, actorId: string): Promise<Contribution> => {
    const membership = await prisma.membership.findUnique({
        where: { id: data.membershipId },
        include: { chama: true },
    });

    if (!membership) throw new Error('Membership not found.');

    // An admin or the member themselves can record their payment
    const canRecord = membership.userId === actorId || await prisma.membership.findFirst({
        where: { userId: actorId, chamaId: membership.chamaId, role: { in: ['ADMIN', 'TREASURER'] } }
    });
    if (!canRecord) throw new Error('Permission Denied: You cannot record a contribution for this member.');

    // Prevent duplicate contributions for the same month/year
    const existingContribution = await prisma.contribution.findFirst({
        where: { membershipId: data.membershipId, month: data.month, year: data.year }
    });
    if (existingContribution) throw new Error('A contribution for this member for the specified month and year already exists.');

    const penaltyApplied = calculatePenalty(data, membership.chama.monthlyContribution);

    return prisma.contribution.create({
        data: {
            ...data,
            status: 'PENDING',
            penaltyApplied,
        },
    });
};

/**
 * Finds all contributions for a given chama, with pagination.
 */
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

/**
 * Finds all contributions for a specific member.
 */
export const findMemberContributions = async (membershipId: string) => {
    return prisma.contribution.findMany({
        where: { membershipId },
        orderBy: [{ year: 'desc' }, { month: 'desc' }]
    });
};

/**
 * Retrieves a single contribution by its ID.
 */
export const findContributionById = (id: string) => {
    return prisma.contribution.findUnique({ where: { id } });
};

/**
 * Updates an existing contribution record.
 */
export const updateContribution = (id: string, data: Partial<Contribution>) => {
    return prisma.contribution.update({ where: { id }, data });
};

/**
 * Deletes a contribution record.
 */
export const deleteContribution = (id: string) => {
    return prisma.contribution.delete({ where: { id } });
};

/**
 * Generates a summary of contributions for a chama for the current year.
 */
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

/**
 * Finds all active members who have not made a contribution for the current month.
 */
export const findDefaulters = async (chamaId: string) => {
    const now = new Date();
    const month = now.getMonth() + 1; // getMonth() is 0-indexed
    const year = now.getFullYear();

    const paidMemberIds = (await prisma.contribution.findMany({
        where: {
            month,
            year,
            status: 'PAID',
            membership: { chamaId },
        },
        select: { membershipId: true },
    })).map(c => c.membershipId);

    const defaulters = await prisma.membership.findMany({
        where: {
            chamaId,
            isActive: true,
            id: { notIn: paidMemberIds },
        },
        include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        },
    });

    return defaulters;
};

/**
 * Parses a CSV file and creates contribution records in bulk.
 */
export const parseAndImportContributions = async (chamaId: string, fileBuffer: Buffer) => {
    const csvData = fileBuffer.toString('utf-8');
    const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });

    if (parsed.errors.length) {
        throw new Error(`CSV parsing error: ${parsed.errors[0].message}`);
    }

    const records = parsed.data as any[];

    // This would be a great place for a transaction
    return prisma.$transaction(async (tx) => {
        const results = [];
        for (const record of records) {
            // Find membership by user email and chamaId
            const membership = await tx.membership.findFirst({
                where: { user: { email: record.email }, chamaId },
            });
            if (!membership) continue; // Skip if member not found in this chama

            const contribution = await tx.contribution.create({
                data: {
                    membershipId: membership.id,
                    amount: parseFloat(record.amount),
                    month: parseInt(record.month, 10),
                    year: parseInt(record.year, 10),
                    paymentMethod: record.paymentMethod,
                    paidAt: new Date(record.paidAt),
                    status: 'PAID',
                }
            });
            results.push(contribution);
        }
        return { createdCount: results.length, totalRecords: records.length };
    });
};

/**
 * Generates an Excel buffer for all contributions in a chama.
 */
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
        });
    });

    const buffer = await workbook.csv.writeBuffer();
    return buffer as Buffer;
};
