import { PrismaClient, AuditAction, Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';

const prisma = new PrismaClient();

interface AuditLogData {
  action: AuditAction;
  actorId: string;
  targetId?: string;
  chamaId?: string;
  contributionId?: string;
  loanId?: string;
  meetingId?: string;
  oldValue?: object | null;
  newValue?: object | null;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Creates a new entry in the AuditLog table.
 * @param data - The structured data for the audit log entry.
 */
export const createAuditLog = async (data: AuditLogData) => {
  try {
    const logPayload: { [key: string]: any } = {
        action: data.action,
        userId: data.actorId,
        oldValue: data.oldValue ?? Prisma.JsonNull,
        newValue: data.newValue ?? Prisma.JsonNull,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
    };

    if (data.targetId) {
        logPayload.targetId = data.targetId;
    }

    if (data.chamaId) {
        logPayload.chamaId = data.chamaId;
    }

    if (data.contributionId) {
        logPayload.contributionId = data.contributionId;
    }

    if (data.loanId) {
        logPayload.loanId = data.loanId;
    }

    if (data.meetingId) {
        logPayload.meetingId = data.meetingId;
    }

    await prisma.auditLog.create({
      data: logPayload as Prisma.AuditLogCreateInput,
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
};

interface FindLogsParams {
    page: number;
    limit: number;
    filter: Prisma.AuditLogWhereInput;
}

/**
 * Finds and paginates audit logs based on a filter.
 */
export const findLogs = async ({ page, limit, filter }: FindLogsParams) => {
    const skip = (page - 1) * limit;
    const logs = await prisma.auditLog.findMany({
        where: filter,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
            user: { select: { email: true, firstName: true, lastName: true }},
            target: { select: { email: true }},
            chama: { select: { name: true }}
        }
    });
    const totalRecords = await prisma.auditLog.count({ where: filter });
    return { logs, totalRecords, totalPages: Math.ceil(totalRecords / limit) };
};

/**
 * Generates an Excel buffer for a list of audit logs.
 */
export const generateAuditExport = async (logs: any[]): Promise<Buffer> => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Audit Trail');

    worksheet.columns = [
        { header: 'Timestamp', key: 'createdAt', width: 25 },
        { header: 'Action', key: 'action', width: 30 },
        { header: 'Actor', key: 'actor', width: 30 },
        { header: 'Target User', key: 'target', width: 30 },
        { header: 'Chama', key: 'chama', width: 30 },
        { header: 'IP Address', key: 'ipAddress', width: 20 },
    ];

    const processedLogs = logs.map(log => ({
        createdAt: log.createdAt,
        action: log.action,
        actor: log.user?.email || 'N/A',
        target: log.target?.email || 'N/A',
        chama: log.chama?.name || 'N/A',
        ipAddress: log.ipAddress || 'N/A'
    }));
    
    worksheet.addRows(processedLogs);

    const excelJsBuffer = await workbook.csv.writeBuffer();
    
    return excelJsBuffer as unknown as Buffer;
};