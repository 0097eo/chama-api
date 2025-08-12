import { Prisma, PrismaClient } from '../generated/prisma/client';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

const prisma = new PrismaClient();

interface DateRange {
    startDate?: string;
    endDate?: string;
}

const buildDateFilter = ({ startDate, endDate }: DateRange) => {
    return {
        // "gte" (>=) should be the very start of the day (00:00:00 UTC)
        gte: startDate ? new Date(startDate).toISOString() : undefined,
        // "lte" (<=) should be the very end of the day (23:59:59 UTC)
        lte: endDate ? new Date(`${endDate}T23:59:59.999Z`).toISOString() : undefined,
    };
};


export const getFinancialSummary = async (chamaId: string) => {
    const contributions = await prisma.contribution.aggregate({
        _sum: { amount: true, penaltyApplied: true },
        where: { membership: { chamaId }, status: 'PAID' },
    });
    const loansDisbursed = await prisma.loan.aggregate({
        _sum: { amount: true },
        where: { membership: { chamaId }, status: { not: 'PENDING' } },
    });
    const loanRepayments = await prisma.loanPayment.aggregate({
        _sum: { amount: true },
        where: { loan: { membership: { chamaId } } },
    });
    const activeLoans = await prisma.loan.aggregate({
        _sum: { amount: true },
        where: { membership: { chamaId }, status: 'ACTIVE' },
    });
    const totalInflow = (contributions._sum.amount || 0) + (loanRepayments._sum.amount || 0);
    const totalOutflow = loansDisbursed._sum.amount || 0;
    return {
        totalContributions: contributions._sum.amount || 0,
        totalPenalties: contributions._sum.penaltyApplied || 0,
        totalLoansDisbursed: loansDisbursed._sum.amount || 0,
        totalLoanRepayments: loanRepayments._sum.amount || 0,
        outstandingLoanPrincipal: activeLoans._sum.amount || 0,
        netPosition: totalInflow - totalOutflow,
    };
};

export const getContributionsReport = async (chamaId: string, dateRange: DateRange, page: number, limit: number) => {
    const where: Prisma.ContributionWhereInput = {
        membership: { chamaId },
        paidAt: buildDateFilter(dateRange),
    };

    const contributions = await prisma.contribution.findMany({
        where,
        include: { membership: { include: { user: true } } },
        orderBy: { paidAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
    });
    const totalRecords = await prisma.contribution.count({ where });
    return { contributions, totalRecords, totalPages: Math.ceil(totalRecords / limit) };
};

export const getLoanPortfolioReport = async (chamaId: string) => {
    const loanStatusCounts = await prisma.loan.groupBy({
        by: ['status'],
        _count: { status: true },
        _sum: { amount: true },
        where: { membership: { chamaId } },
    });
    const totalRepayments = await prisma.loanPayment.aggregate({
        _sum: { amount: true },
        where: { loan: { membership: { chamaId } } },
    });
    const portfolio = {
        totalPrincipalDisbursed: 0,
        totalRepayments: totalRepayments._sum.amount || 0,
        statusBreakdown: loanStatusCounts.map(s => ({ status: s.status, count: s._count.status, totalAmount: s._sum.amount || 0 })),
    };
    portfolio.totalPrincipalDisbursed = portfolio.statusBreakdown.reduce((sum, s) => sum + s.totalAmount, 0);
    return portfolio;
};

export const getCashflowReport = async (chamaId: string, dateRange: DateRange) => {
    const dateFilter = buildDateFilter(dateRange);

    const inflows = await prisma.contribution.aggregate({
        _sum: { amount: true },
        where: { membership: { chamaId }, status: 'PAID', paidAt: dateFilter },
    });
    const loanRepayments = await prisma.loanPayment.aggregate({
        _sum: { amount: true },
        where: { loan: { membership: { chamaId } }, paidAt: dateFilter },
    });
    const outflows = await prisma.loan.aggregate({
        _sum: { amount: true },
        where: { membership: { chamaId }, disbursedAt: dateFilter },
    });
    const totalIn = (inflows._sum.amount || 0) + (loanRepayments._sum.amount || 0);
    const totalOut = outflows._sum.amount || 0;
    return {
        period: dateRange,
        totalInflows: totalIn,
        totalOutflows: totalOut,
        netCashflow: totalIn - totalOut,
    };
};

export const getMemberPerformanceReport = async (chamaId: string) => {
    return prisma.membership.findMany({
        where: { chamaId, isActive: true },
        select: {
            id: true,
            user: { select: { firstName: true, lastName: true, email: true } },
            _count: {
                select: { contributions: true, loans: true },
            },
            contributions: {
                where: { status: 'PAID' },
                select: { amount: true }
            },
            loans: {
                select: { amount: true, status: true }
            }
        },
    });
};

export const getAuditTrailReport = async (chamaId: string, page: number, limit: number) => {
    const where: Prisma.AuditLogWhereInput = { chamaId };
    const auditLogs = await prisma.auditLog.findMany({
        where,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
    });
    const totalRecords = await prisma.auditLog.count({ where });
    return { auditLogs, totalRecords, totalPages: Math.ceil(totalRecords / limit) };
};


export const generateReportFile = async (chamaId: string, options: { reportType: string; format: 'pdf' | 'excel'; dateRange: DateRange }): Promise<Buffer> => {
    switch (options.reportType) {
        case 'contributions':
            const { contributions } = await getContributionsReport(chamaId, options.dateRange, 1, 10000);
            if (options.format === 'excel') {
                const buffer = await generateExcel(contributions);
                return buffer as Buffer;
            }
            const pdfBuffer = await generatePdf(contributions);
            return pdfBuffer as Buffer;
        default:
            throw new Error('Unsupported report type for export.');
    }
};

const generateExcel = async (data: any[]): Promise<Buffer> => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');
    if (data.length === 0) {
        const buffer = await workbook.csv.writeBuffer();
        return Buffer.from(buffer);
    }
    const simpleData = data.map(d => ({
        memberName: `${d.membership.user.firstName} ${d.membership.user.lastName}`,
        amount: d.amount,
        penalty: d.penaltyApplied,
        month: d.month,
        year: d.year,
        paymentMethod: d.paymentMethod,
        datePaid: d.paidAt,
    }));
    worksheet.columns = Object.keys(simpleData[0]).map(key => ({ header: key, key, width: 25 }));
    worksheet.addRows(simpleData);
    const buffer = await workbook.csv.writeBuffer();
    return Buffer.from(buffer);
};

const generatePdf = (data: any[]): Promise<Buffer> => {
    return new Promise((resolve) => {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const buffers: any[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.fontSize(18).text('Chama Contributions Report', { align: 'center' });
        doc.moveDown();
        if (data.length > 0) {
            doc.fontSize(10);
            doc.font('Helvetica-Bold');
            doc.text('Member | Amount | Month/Year | Date Paid');
            doc.font('Helvetica');
            data.forEach(item => {
                const name = `${item.membership.user.firstName} ${item.membership.user.lastName}`;
                const row = `${name} | ${item.amount} | ${item.month}/${item.year} | ${new Date(item.paidAt!).toLocaleDateString()}`;
                doc.text(row);
            });
        } else {
            doc.text('No data available for this report.');
        }
        doc.end();
    });
};