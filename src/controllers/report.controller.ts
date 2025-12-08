import { Request, Response } from 'express';
import * as reportService from '../services/report.service';
import { isErrorWithMessage } from '../utils/error.utils';
import { Prisma, AuditAction } from '@prisma/client';
import * as auditService from '../services/audit.service';

const getDateFromParam = (param: any): Date | undefined => {
    if (param && typeof param === 'string') {
        const date = new Date(param);
        if (!isNaN(date.getTime())) {
            return date;
        }
    }
    return undefined;
};

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

export const getFinancialSummary = async (req: Request, res: Response) => {
    try {
        const summary = await reportService.getFinancialSummary(req.params.chamaId);
        res.status(200).json({ data: summary });
    } catch (error) {
        res.status(500).json({ message: 'Error generating financial summary.' });
    }
};

export const getContributionsReport = async (req: Request, res: Response) => {
    try {
        const { chamaId } = req.params;
        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = parseInt(req.query.limit as string, 10) || 20;
        
        const dateRange = {
            from: getDateFromParam(req.query.startDate),
            to: getDateFromParam(req.query.endDate),
        };

        const { contributions, totalRecords, totalPages } = await reportService.getContributionsReport(chamaId, dateRange, page, limit);
        
        res.status(200).json({
            data: contributions,
            meta: { page, limit, totalRecords, totalPages }
        });
    } catch (error) {
        res.status(500).json({ message: 'Error generating contributions report.' });
    }
};

export const getLoanPortfolioReport = async (req: Request, res: Response) => {
    try {
        const report = await reportService.getLoanPortfolioReport(req.params.chamaId);
        res.status(200).json({ data: report });
    } catch (error) {
        console.error("Error in getLoanPortfolioReport:", error);
        res.status(500).json({ message: 'Error generating loan portfolio report.' });
    }
};

export const getCashflowReport = async (req: Request, res: Response) => {
    try {
        const { chamaId } = req.params;
        const dateRange = {
            from: getDateFromParam(req.query.startDate),
            to: getDateFromParam(req.query.endDate),
        };

        const report = await reportService.getCashflowReport(chamaId, dateRange);
        res.status(200).json({ data: report });
    } catch (error) {
        res.status(500).json({ message: 'Error generating cashflow report.' });
    }
};

export const getMemberPerformanceReport = async (req: Request, res: Response) => {
    try {
        const report = await reportService.getMemberPerformanceReport(req.params.chamaId);
        res.status(200).json({ data: report });
    } catch (error) {
        res.status(500).json({ message: 'Error generating member performance report.' });
    }
};

export const getAuditTrailReport = async (req: Request, res: Response) => {
    try {
        const { chamaId } = req.params;
        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = parseInt(req.query.limit as string, 10) || 50;
        
        const { logs, totalRecords, totalPages } = await auditService.findLogs({
            page,
            limit,
            filter: { chamaId }
        });

        res.status(200).json({ 
            data: logs,
            meta: { page, limit, totalRecords, totalPages }
        });
    } catch (error) {
        res.status(500).json({ message: 'Error generating audit trail report.' });
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
                gte: getDateFromParam(startDate),
                lte: getDateFromParam(endDate),
            };
        }

        const { logs, totalRecords, totalPages } = await auditService.findLogs({ page, limit, filter });
        res.status(200).json({ data: logs, meta: { page, limit, totalRecords, totalPages } });
    } catch (error) {
        res.status(500).json({ message: 'Error searching audit logs.' });
    }
};

export const exportAuditLogs = async (req: Request, res: Response) => {
    try {
        const { action, userId, targetId, startDate, endDate, chamaId } = req.body || {};

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
        if (startDate || endDate) {
            filter.createdAt = {
                gte: getDateFromParam(startDate),
                lte: getDateFromParam(endDate),
            };
        }

        // Fetch all matching logs for export, ignoring pagination but setting a high safety limit
        const { logs } = await auditService.findLogs({ page: 1, limit: 10000, filter });
        
        if (logs.length === 0) {
            return res.status(404).json({ message: "No logs found matching the specified criteria for export." });
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

export const exportReport = async (req: Request, res: Response) => {
    try {
        const { reportType, format, startDate, endDate } = req.body;
        const { chamaId } = req.params;

        const dateRange = {
            from: getDateFromParam(startDate),
            to: getDateFromParam(endDate),
        };

        const buffer = await reportService.generateReportFile(chamaId, {
            reportType,
            format,
            dateRange,
        });

        const extension = format === 'pdf' ? 'pdf' : 'csv';
        const contentType = format === 'pdf' ? 'application/pdf' : 'text/csv';
        const filename = `${reportType}-report-${chamaId}-${new Date().toISOString()}.${extension}`;

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.status(200).send(buffer);
    } catch (error) {
        if (isErrorWithMessage(error)) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error exporting report.' });
    }
};