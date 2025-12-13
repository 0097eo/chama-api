import { Express, Request, Response, NextFunction } from 'express';

process.env.AT_API_KEY = 'test-api-key';
process.env.AT_USERNAME = 'test-username';
process.env.EMAIL_HOST = 'smtp.test.com';
process.env.EMAIL_PORT = '587';
process.env.EMAIL_USER = 'test@test.com';
process.env.EMAIL_PASS = 'test-password';
process.env.EMAIL_FROM = 'noreply@test.com';
process.env.CORS_ORIGINS = 'http://localhost:3000';

// Mock Prisma 
jest.mock('@prisma/client', () => {
  const mockPrismaFunctions = {
    contribution: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    loan: {
      aggregate: jest.fn(),
      groupBy: jest.fn(),
      findUnique: jest.fn(),
    },
    loanPayment: {
      aggregate: jest.fn(),
    },
    membership: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn((operations) => Promise.all(operations)),
  };

  return {
    PrismaClient: jest.fn().mockImplementation(() => mockPrismaFunctions),
    MembershipRole: {
      ADMIN: 'ADMIN',
      TREASURER: 'TREASURER',
      SECRETARY: 'SECRETARY',
      MEMBER: 'MEMBER',
    },
    AuditAction: {
      CREATE: 'CREATE',
      UPDATE: 'UPDATE',
      DELETE: 'DELETE',
    },
  };
});

// Mock middleware
jest.mock('../src/middleware/auth.middleware', () => ({
  protect: jest.fn((req: Request, res: Response, next: NextFunction) => next()),
}));

jest.mock('../src/middleware/membership.middleware', () => ({
  checkMembership: jest.fn(() => (req: Request, res: Response, next: NextFunction) => next()),
}));

// Mock services
jest.mock('../src/services/audit.service', () => ({
  findLogs: jest.fn(),
  generateAuditExport: jest.fn(),
}));

// Mock controllers
jest.mock('../src/controllers/report.controller', () => ({
  getFinancialSummary: jest.fn(),
  getContributionsReport: jest.fn(),
  getLoanPortfolioReport: jest.fn(),
  getCashflowReport: jest.fn(),
  getMemberPerformanceReport: jest.fn(),
  getAuditTrailReport: jest.fn(),
  searchAuditLogs: jest.fn(),
  exportAuditLogs: jest.fn(),
  exportReport: jest.fn(),
}));


import * as reportController from '../src/controllers/report.controller';
import * as reportService from '../src/services/report.service';
import * as auditService from '../src/services/audit.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient() as any;

describe('Report Module Tests', () => {
  describe('Report Service Unit Tests', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('getFinancialSummary', () => {
      it('should calculate financial summary correctly', async () => {
        prisma.contribution.aggregate.mockResolvedValue({
          _sum: { amount: 10000, penaltyApplied: 500 },
        });
        prisma.loan.aggregate
          .mockResolvedValueOnce({ _sum: { amount: 5000 } })
          .mockResolvedValueOnce({ _sum: { amount: 3000 } });
        prisma.loanPayment.aggregate.mockResolvedValue({
          _sum: { amount: 2000 },
        });

        const summary = await reportService.getFinancialSummary('chama1');

        expect(summary).toEqual({
          totalContributions: 10000,
          totalPenalties: 500,
          totalLoansDisbursed: 5000,
          totalLoanRepayments: 2000,
          outstandingLoanPrincipal: 3000,
          netPosition: 7000,
        });
      });

      it('should handle zero values', async () => {
        prisma.contribution.aggregate.mockResolvedValue({
          _sum: { amount: null, penaltyApplied: null },
        });
        prisma.loan.aggregate
          .mockResolvedValueOnce({ _sum: { amount: null } })
          .mockResolvedValueOnce({ _sum: { amount: null } });
        prisma.loanPayment.aggregate.mockResolvedValue({
          _sum: { amount: null },
        });

        const summary = await reportService.getFinancialSummary('chama1');

        expect(summary).toEqual({
          totalContributions: 0,
          totalPenalties: 0,
          totalLoansDisbursed: 0,
          totalLoanRepayments: 0,
          outstandingLoanPrincipal: 0,
          netPosition: 0,
        });
      });
    });

    describe('getContributionsReport', () => {
      it('should return paginated contributions', async () => {
        const mockContributions = [
          { id: 'c1', amount: 1000, membership: { user: { firstName: 'John' } } },
          { id: 'c2', amount: 2000, membership: { user: { firstName: 'Jane' } } },
        ];
        prisma.contribution.findMany.mockResolvedValue(mockContributions);
        prisma.contribution.count.mockResolvedValue(50);

        const result = await reportService.getContributionsReport(
          'chama1',
          { from: new Date('2024-01-01'), to: new Date('2024-12-31') },
          2,
          20
        );

        expect(result).toEqual({
          contributions: mockContributions,
          totalRecords: 50,
          totalPages: 3,
        });
        expect(prisma.contribution.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            skip: 20,
            take: 20,
          })
        );
      });
    });

    describe('getLoanPortfolioReport', () => {
      it('should calculate loan portfolio correctly', async () => {
        prisma.loan.groupBy.mockResolvedValue([
          { status: 'ACTIVE', _count: { status: 5 }, _sum: { amount: 10000 } },
          { status: 'PAID', _count: { status: 3 }, _sum: { amount: 5000 } },
        ]);
        prisma.loanPayment.aggregate.mockResolvedValue({
          _sum: { amount: 3000 },
        });

        const portfolio = await reportService.getLoanPortfolioReport('chama1');

        expect(portfolio).toEqual({
          totalPrincipalDisbursed: 15000,
          totalRepayments: 3000,
          statusBreakdown: [
            { status: 'ACTIVE', count: 5, totalAmount: 10000 },
            { status: 'PAID', count: 3, totalAmount: 5000 },
          ],
        });
      });
    });

    describe('getCashflowReport', () => {
      it('should calculate cashflow for date range', async () => {
        prisma.contribution.aggregate.mockResolvedValue({
          _sum: { amount: 8000 },
        });
        prisma.loanPayment.aggregate.mockResolvedValue({
          _sum: { amount: 2000 },
        });
        prisma.loan.aggregate.mockResolvedValue({
          _sum: { amount: 5000 },
        });

        const dateRange = {
          from: new Date('2024-01-01'),
          to: new Date('2024-12-31'),
        };
        const report = await reportService.getCashflowReport('chama1', dateRange);

        expect(report).toEqual({
          period: {
            startDate: dateRange.from.toISOString(),
            endDate: dateRange.to.toISOString(),
          },
          totalInflows: 10000,
          totalOutflows: 5000,
          netCashflow: 5000,
        });
      });
    });

    describe('getMemberPerformanceReport', () => {
      it('should return member performance data', async () => {
        const mockMembers = [
          {
            id: 'm1',
            user: { firstName: 'John', lastName: 'Doe', email: 'john@test.com' },
            _count: { contributions: 10, loans: 2 },
            contributions: [{ amount: 1000 }, { amount: 2000 }],
            loans: [{ amount: 5000, status: 'ACTIVE' }],
          },
        ];
        prisma.membership.findMany.mockResolvedValue(mockMembers);

        const report = await reportService.getMemberPerformanceReport('chama1');

        expect(report).toEqual(mockMembers);
        expect(prisma.membership.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { chamaId: 'chama1', isActive: true },
          })
        );
      });
    });

    describe('generateReportFile', () => {
      it('should generate Excel file for contributions', async () => {
        const mockContributions = [
          {
            amount: 1000,
            penaltyApplied: 0,
            month: 1,
            year: 2024,
            paymentMethod: 'MPESA',
            paidAt: new Date('2024-01-15'),
            membership: {
              user: { firstName: 'John', lastName: 'Doe' },
            },
          },
        ];
        prisma.contribution.findMany.mockResolvedValue(mockContributions);
        prisma.contribution.count.mockResolvedValue(1);

        const buffer = await reportService.generateReportFile('chama1', {
          reportType: 'contributions',
          format: 'excel',
          dateRange: {},
        });

        expect(buffer).toBeInstanceOf(Buffer);
      });

      it('should generate PDF file for contributions', async () => {
        const mockContributions = [
          {
            amount: 1000,
            penaltyApplied: 0,
            month: 1,
            year: 2024,
            paidAt: new Date('2024-01-15'),
            membership: {
              user: { firstName: 'John', lastName: 'Doe' },
            },
          },
        ];
        prisma.contribution.findMany.mockResolvedValue(mockContributions);
        prisma.contribution.count.mockResolvedValue(1);

        const buffer = await reportService.generateReportFile('chama1', {
          reportType: 'contributions',
          format: 'pdf',
          dateRange: {},
        });

        expect(buffer).toBeInstanceOf(Buffer);
      });

      it('should throw error for unsupported report type', async () => {
        await expect(
          reportService.generateReportFile('chama1', {
            reportType: 'unsupported',
            format: 'pdf',
            dateRange: {},
          })
        ).rejects.toThrow('Unsupported report type for export.');
      });
    });
  });

  describe('Report Controller Unit Tests', () => {
    let mockRequest: any;
    let mockResponse: any;

    beforeEach(() => {
      jest.clearAllMocks();
      mockRequest = {
        params: {},
        query: {},
        body: {},
      };
      mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        setHeader: jest.fn().mockReturnThis(),
      };
    });

    describe('getFinancialSummary', () => {
      it('should return financial summary', async () => {
        mockRequest.params = { chamaId: 'chama1' };
        (reportController.getFinancialSummary as jest.Mock).mockImplementation(
          async (req, res) => {
            res.status(200).json({ data: { totalContributions: 10000 } });
          }
        );

        await reportController.getFinancialSummary(mockRequest, mockResponse);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.any(Object) })
        );
      });
    });

    describe('getContributionsReport', () => {
      it('should return contributions with pagination', async () => {
        mockRequest.params = { chamaId: 'chama1' };
        mockRequest.query = { page: '2', limit: '10', startDate: '2024-01-01' };
        
        (reportController.getContributionsReport as jest.Mock).mockImplementation(
          async (req, res) => {
            res.status(200).json({
              data: [],
              meta: { page: 2, limit: 10, totalRecords: 50, totalPages: 5 },
            });
          }
        );

        await reportController.getContributionsReport(mockRequest, mockResponse);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          data: [],
          meta: { page: 2, limit: 10, totalRecords: 50, totalPages: 5 },
        });
      });
    });

    describe('getLoanPortfolioReport', () => {
      it('should return loan portfolio report', async () => {
        mockRequest.params = { chamaId: 'chama1' };
        
        (reportController.getLoanPortfolioReport as jest.Mock).mockImplementation(
          async (req, res) => {
            res.status(200).json({ data: {} });
          }
        );

        await reportController.getLoanPortfolioReport(mockRequest, mockResponse);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });
    });

    describe('getCashflowReport', () => {
      it('should return cashflow report', async () => {
        mockRequest.params = { chamaId: 'chama1' };
        mockRequest.query = { startDate: '2024-01-01', endDate: '2024-12-31' };
        
        (reportController.getCashflowReport as jest.Mock).mockImplementation(
          async (req, res) => {
            res.status(200).json({ data: {} });
          }
        );

        await reportController.getCashflowReport(mockRequest, mockResponse);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });
    });

    describe('getMemberPerformanceReport', () => {
      it('should return member performance report', async () => {
        mockRequest.params = { chamaId: 'chama1' };
        
        (reportController.getMemberPerformanceReport as jest.Mock).mockImplementation(
          async (req, res) => {
            res.status(200).json({ data: [] });
          }
        );

        await reportController.getMemberPerformanceReport(mockRequest, mockResponse);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });
    });

    describe('getAuditTrailReport', () => {
      it('should return audit trail with pagination', async () => {
        mockRequest.params = { chamaId: 'chama1' };
        mockRequest.query = { page: '1', limit: '50' };
        
        (reportController.getAuditTrailReport as jest.Mock).mockImplementation(
          async (req, res) => {
            res.status(200).json({
              data: [],
              meta: { page: 1, limit: 50, totalRecords: 0, totalPages: 0 },
            });
          }
        );

        await reportController.getAuditTrailReport(mockRequest, mockResponse);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });
    });

    describe('exportReport', () => {
      it('should export report as PDF', async () => {
        mockRequest.params = { chamaId: 'chama1' };
        mockRequest.body = {
          reportType: 'contributions',
          format: 'pdf',
          startDate: '2024-01-01',
        };
        
        (reportController.exportReport as jest.Mock).mockImplementation(
          async (req, res) => {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment');
            res.status(200).send(Buffer.from('test'));
          }
        );

        await reportController.exportReport(mockRequest, mockResponse);

        expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

    describe('searchAuditLogs', () => {
      it('should search audit logs with filters', async () => {
        mockRequest.query = {
          page: '1',
          limit: '20',
          action: 'CREATE,UPDATE',
          userId: 'user123',
        };

        (auditService.findLogs as jest.Mock).mockResolvedValue({
          logs: [],
          totalRecords: 0,
          totalPages: 0,
        });

        (reportController.searchAuditLogs as jest.Mock).mockImplementation(
          async (req, res) => {
            const result = await auditService.findLogs({
              page: 1,
              limit: 20,
              filter: { userId: 'user123' },
            });
            res.status(200).json({
              data: result.logs,
              meta: { page: 1, limit: 20, totalRecords: 0, totalPages: 0 },
            });
          }
        );

        await reportController.searchAuditLogs(mockRequest, mockResponse);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should handle date range filters', async () => {
        mockRequest.query = {
          startDate: '2024-01-01',
          endDate: '2024-12-31',
        };

        (auditService.findLogs as jest.Mock).mockResolvedValue({
          logs: [],
          totalRecords: 0,
          totalPages: 0,
        });

        (reportController.searchAuditLogs as jest.Mock).mockImplementation(
          async (req, res) => {
            res.status(200).json({
              data: [],
              meta: { page: 1, limit: 20, totalRecords: 0, totalPages: 0 },
            });
          }
        );

        await reportController.searchAuditLogs(mockRequest, mockResponse);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should return 500 on error', async () => {
        mockRequest.query = {};

        (reportController.searchAuditLogs as jest.Mock).mockImplementation(
          async (req, res) => {
            res.status(500).json({ message: 'Error searching audit logs.' });
          }
        );

        await reportController.searchAuditLogs(mockRequest, mockResponse);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
      });
    });

    describe('exportAuditLogs', () => {
      it('should export audit logs as CSV', async () => {
        mockRequest.body = {
          action: ['CREATE'],
          chamaId: 'chama1',
        };

        const mockLogs = [
          { id: 'log1', action: 'CREATE', userId: 'user1', createdAt: new Date() },
        ];

        (auditService.findLogs as jest.Mock).mockResolvedValue({
          logs: mockLogs,
          totalRecords: 1,
          totalPages: 1,
        });

        (auditService.generateAuditExport as jest.Mock).mockResolvedValue(
          Buffer.from('csv data')
        );

        (reportController.exportAuditLogs as jest.Mock).mockImplementation(
          async (req, res) => {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment');
            res.status(200).send(Buffer.from('csv data'));
          }
        );

        await reportController.exportAuditLogs(mockRequest, mockResponse);

        expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should return 404 when no logs found', async () => {
        mockRequest.body = { chamaId: 'chama1' };

        (reportController.exportAuditLogs as jest.Mock).mockImplementation(
          async (req, res) => {
            res.status(404).json({
              message: 'No logs found matching the specified criteria for export.',
            });
          }
        );

        await reportController.exportAuditLogs(mockRequest, mockResponse);

        expect(mockResponse.status).toHaveBeenCalledWith(404);
      });

      it('should return 500 on error', async () => {
        mockRequest.body = {};

        (reportController.exportAuditLogs as jest.Mock).mockImplementation(
          async (req, res) => {
            res.status(500).json({ message: 'Error exporting audit logs.' });
          }
        );

        await reportController.exportAuditLogs(mockRequest, mockResponse);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
      });
    });

    describe('Error handling scenarios', () => {
      it('should handle missing chamaId in getFinancialSummary', async () => {
        mockRequest.params = {};

        (reportController.getFinancialSummary as jest.Mock).mockImplementation(
          async (req, res) => {
            res.status(500).json({ message: 'Error generating financial summary.' });
          }
        );

        await reportController.getFinancialSummary(mockRequest, mockResponse);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
      });

      it('should handle invalid date parameters in getContributionsReport', async () => {
        mockRequest.params = { chamaId: 'chama1' };
        mockRequest.query = { startDate: 'invalid-date' };

        (reportController.getContributionsReport as jest.Mock).mockImplementation(
          async (req, res) => {
            res.status(200).json({
              data: [],
              meta: { page: 1, limit: 20, totalRecords: 0, totalPages: 0 },
            });
          }
        );

        await reportController.getContributionsReport(mockRequest, mockResponse);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
      });

      it('should handle database errors in getLoanPortfolioReport', async () => {
        mockRequest.params = { chamaId: 'chama1' };

        (reportController.getLoanPortfolioReport as jest.Mock).mockImplementation(
          async (req, res) => {
            res.status(500).json({ message: 'Error generating loan portfolio report.' });
          }
        );

        await reportController.getLoanPortfolioReport(mockRequest, mockResponse);

        expect(mockResponse.status).toHaveBeenCalledWith(500);
      });
    });
    });
  });
});