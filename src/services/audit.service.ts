import { PrismaClient, AuditAction, Prisma } from '../generated/prisma/client';

const prisma = new PrismaClient();

interface AuditLogData {
  action: AuditAction;
  actorId: string;
  targetId?: string;
  chamaId?: string;
  oldValue?: object;
  newValue?: object;
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
    };

    if (data.targetId) {
        logPayload.targetId = data.targetId;
    }

    if (data.chamaId) {
        logPayload.chamaId = data.chamaId;
    }

    await prisma.auditLog.create({
      data: logPayload as Prisma.AuditLogCreateInput,
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
    // Todo - send this error to a monitoring service. (Sentry, Datadog, etc.)
  }
};