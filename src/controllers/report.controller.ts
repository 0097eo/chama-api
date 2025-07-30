import { Request, Response } from 'express';
import * as reportService from '../services/report.service';
import { isErrorWithMessage } from '../utils/error.utils';

const getDateRange = (req: Request) => ({
    startDate: req.query.startDate as string | undefined,
    endDate: req.query.endDate as string | undefined,
});

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
        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = parseInt(req.query.limit as string, 10) || 20;
        const report = await reportService.getContributionsReport(req.params.chamaId, { startDate: req.query.startDate as string, endDate: req.query.endDate as string }, page, limit);
        res.status(200).json({ data: report });
    } catch (error) {
        res.status(500).json({ message: 'Error generating contributions report.' });
    }
};

export const getLoanPortfolioReport = async (req: Request, res: Response) => {
    try {
        const report = await reportService.getLoanPortfolioReport(req.params.chamaId);
        res.status(200).json({ data: report });
    } catch (error) {
        res.status(500).json({ message: 'Error generating loan portfolio report.' });
    }
};

export const getCashflowReport = async (req: Request, res: Response) => {
    try {
        const report = await reportService.getCashflowReport(req.params.chamaId, getDateRange(req));
        res.status(200).json({ data: report });
    } catch (error) {
        res.status(500).json({ message: 'Error generating cashflow report.' });
    }
};

export const getMemberPerformanceReport = async (req: Request, res: Response) => {
    try {
        const report = await reportService.getMemberPerformanceReport(req.params.chamaId);
        
        const processedReport = report.map(m => ({
            membershipId: m.id,
            name: `${m.user.firstName} ${m.user.lastName}`,
            email: m.user.email,
            totalContributions: m.contributions.reduce((sum, c) => sum + c.amount, 0),
            contributionCount: m._count.contributions,
            totalLoanPrincipal: m.loans.reduce((sum, l) => sum + l.amount, 0),
            loanCount: m._count.loans,
            activeLoans: m.loans.filter(l => l.status === 'ACTIVE').length
        }));
        res.status(200).json({ data: processedReport });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error generating member performance report.' });
    }
};

export const getAuditTrailReport = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = parseInt(req.query.limit as string, 10) || 50;
        const report = await reportService.getAuditTrailReport(req.params.chamaId, page, limit);
        res.status(200).json({ data: report });
    } catch (error) {
        res.status(500).json({ message: 'Error generating audit trail report.' });
    }
};

export const exportReport = async (req: Request, res: Response) => {
    try {
        const { reportType, format, startDate, endDate } = req.body;
        const { chamaId } = req.params;

        const buffer = await reportService.generateReportFile(chamaId, {
            reportType,
            format,
            dateRange: { startDate, endDate },
        });

        const extension = format === 'pdf' ? 'pdf' : 'csv'; // exceljs outputs csv, so extension should be csv
        const contentType = format === 'pdf' ? 'application/pdf' : 'text/csv';
        const filename = `${reportType}-${chamaId}-${new Date().toISOString()}.${extension}`;

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