import { Request, Response } from 'express';
import * as auditService from '../services/audit.service';
import { Prisma, AuditAction } from '../generated/prisma/client';

const toAuditActionArray = (actions: string[]): AuditAction[] => {
    const validActions: AuditAction[] = [];
    const allEnumValues = Object.values(AuditAction);

    for (const action of actions) {
        if (allEnumValues.includes(action as AuditAction)) {
            validActions.push(action as AuditAction);
        }
    }
    return validActions;
};

export const getChamaAuditLogs = async (req: Request, res: Response) => {
    try {
        const { chamaId } = req.params;
        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = parseInt(req.query.limit as string, 10) || 20;

        const result = await auditService.findLogs({
            page,
            limit,
            filter: { chamaId }
        });

        res.status(200).json({ data: result });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching chama audit logs.' });
    }
};

export const getUserActivityLogs = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = parseInt(req.query.limit as string, 10) || 20;

        const result = await auditService.findLogs({
            page,
            limit,
            filter: { userId }
        });

        res.status(200).json({ data: result });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user activity logs.' });
    }
};

export const searchAuditLogs = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = parseInt(req.query.limit as string, 10) || 20;
        const { action, userId, targetId, startDate, endDate } = req.query;

        const filter: Prisma.AuditLogWhereInput = {};

        if (action) {
            const actionStrings = (action as string).split(',');
            const validActions = toAuditActionArray(actionStrings);
            if (validActions.length > 0) {
                filter.action = { in: validActions };
            }
        }
        
        if (userId) filter.userId = userId as string;
        if (targetId) filter.targetId = targetId as string;
        if (startDate || endDate) {
            filter.createdAt = {
                gte: startDate ? new Date(startDate as string) : undefined,
                lte: endDate ? new Date(endDate as string) : undefined,
            };
        }

        const result = await auditService.findLogs({ page, limit, filter });
        res.status(200).json({ data: result });
    } catch (error) {
        res.status(500).json({ message: 'Error searching audit logs.' });
    }
};

export const exportAuditLogs = async (req: Request, res: Response) => {
    try {
        const { action, userId, targetId, startDate, endDate, chamaId } = req.body;

        const filter: Prisma.AuditLogWhereInput = {};

        if (action) {
            const actionStrings = Array.isArray(action) ? action : [action];
            const validActions = toAuditActionArray(actionStrings);
            if (validActions.length > 0) {
                filter.action = { in: validActions };
            }
        }

        if (userId) filter.userId = userId;
        if (targetId) filter.targetId = targetId;
        if (chamaId) filter.chamaId = chamaId;

        // More robust date handling
        if (startDate || endDate) {
            const gte = startDate && typeof startDate === 'string' ? new Date(startDate) : undefined;
            const lte = endDate && typeof endDate === 'string' ? new Date(endDate) : undefined;
            
            // Ensure we don't create an empty createdAt filter if dates are invalid
            if (gte || lte) {
                filter.createdAt = { gte, lte };
            }
        }

        // Fetch all matching logs for export, ignoring pagination
        const { logs } = await auditService.findLogs({ page: 1, limit: 10000, filter }); // Set a high limit for export
        
        if (logs.length === 0) {
            return res.status(404).json({ message: "No logs found matching the specified criteria." });
        }

        const buffer = await auditService.generateAuditExport(logs);
        const filename = `audit-report-${new Date().toISOString()}.csv`;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.status(200).send(buffer);
    } catch (error) {
        res.status(500).json({ message: 'Error exporting audit logs.' });
    }
};