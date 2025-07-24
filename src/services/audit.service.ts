import { PrismaClient, AuditAction, Prisma } from '../generated/prisma';

const prisma = new PrismaClient();

interface AuditLogData {
  action: AuditAction;
  userId: string;     // The ID of the user performing the action (e.g., the admin)
  targetId: string;   // The ID of the user being affected by the action
  oldValue?: object;  // The state of the data before the change
  newValue?: object;  // The state of the data after the change
}

/**
 * Creates a new entry in the AuditLog table.
 * This should be called after a successful sensitive operation (e.g., update, delete).
 * @param data - The structured data for the audit log entry.
 */
export const createAuditLog = async (data: AuditLogData) => {
  // Use a try-catch block to ensure that a failure in logging
  // does not cause the main application request to fail.
  try {
    await prisma.auditLog.create({
      data: {
        action: data.action,
        userId: data.userId,
        targetId: data.targetId,
        // Use Prisma.JsonNull if a value is undefined, otherwise convert the object to JSON
        oldValue: data.oldValue ? data.oldValue : Prisma.JsonNull,
        newValue: data.newValue ? data.newValue : Prisma.JsonNull,
      },
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
    // Todo - send this error to a monitoring service.
  }
};