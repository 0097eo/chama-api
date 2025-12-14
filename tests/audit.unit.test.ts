import { AuditAction } from '@prisma/client';
import { Request, Response } from 'express';

// Mock Prisma Client BEFORE importing services
const mockCreate = jest.fn();
const mockFindMany = jest.fn();
const mockCount = jest.fn();

jest.mock('../src/config/logger', () => {
    return {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    };
});

jest.mock('@prisma/client', () => {
    const actual = jest.requireActual('@prisma/client');
    return {
        ...actual,
        PrismaClient: jest.fn().mockImplementation(() => ({
            auditLog: {
                create: mockCreate,
                findMany: mockFindMany,
                count: mockCount,
            },
        })),
    };
});

// Mock ExcelJS
jest.mock('exceljs', () => {
    const mockAddRowsFn = jest.fn();
    const mockWriteBufferFn = jest.fn();
    const mockAddWorksheetFn = jest.fn();
    
    class MockWorkbook {
        addWorksheet = mockAddWorksheetFn;
        csv = {
            writeBuffer: mockWriteBufferFn,
        };
        
        constructor() {
            const mockWorksheet = {
                columns: [],
                addRows: mockAddRowsFn,
            };
            mockAddWorksheetFn.mockReturnValue(mockWorksheet);
            mockWriteBufferFn.mockResolvedValue(Buffer.from('mock csv content'));
        }
    }
    
    return {
        Workbook: MockWorkbook,
        __mockAddWorksheet: mockAddWorksheetFn,
        __mockAddRows: mockAddRowsFn,
        __mockWriteBuffer: mockWriteBufferFn,
    };
});

const ExcelJSMock = jest.requireMock('exceljs');
const mockAddWorksheetRef = ExcelJSMock.__mockAddWorksheet;
const mockAddRowsRef = ExcelJSMock.__mockAddRows;
const mockWriteBufferRef = ExcelJSMock.__mockWriteBuffer;

import { createAuditLog, findLogs, generateAuditExport } from '../src/services/audit.service';
import { getChamaAuditLogs, getUserActivityLogs, searchAuditLogs, exportAuditLogs } from '../src/controllers/audit.controller';
import logger from '../src/config/logger';

describe('Audit Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createAuditLog', () => {
        it('should create an audit log with minimal data', async () => {
            mockCreate.mockResolvedValueOnce({});
            
            const data = {
                action: AuditAction.USER_UPDATE,
                actorId: 'user123',
            };
            await createAuditLog(data);
            
            expect(mockCreate).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    action: AuditAction.USER_UPDATE,
                    userId: 'user123',
                }),
            });
        });

        it('should create an audit log with all optional data', async () => {
            mockCreate.mockResolvedValueOnce({});
            
            const data = {
                action: AuditAction.CHAMA_UPDATE,
                actorId: 'user123',
                targetId: 'target456',
                chamaId: 'chama789',
                contributionId: 'contrib001',
                loanId: 'loan002',
                meetingId: 'meet003',
                oldValue: { status: 'pending' },
                newValue: { status: 'approved' },
                ipAddress: '192.168.1.1',
                userAgent: 'test-agent',
            };
            await createAuditLog(data);
            
            expect(mockCreate).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    action: AuditAction.CHAMA_UPDATE,
                    userId: 'user123',
                    targetId: 'target456',
                    chamaId: 'chama789',
                }),
            });
        });

        it('should handle error during log creation', async () => {
            mockCreate.mockRejectedValueOnce(new Error('DB Error'));

            const data = {
                action: AuditAction.USER_UPDATE,
                actorId: 'user123',
            };
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

            await createAuditLog(data);

            expect(mockCreate).toHaveBeenCalled();
            expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({
                error: expect.any(Error),
                action: AuditAction.USER_UPDATE,
                actorId: 'user123'
                    }),
                    'Failed to create audit log'
                );
            consoleErrorSpy.mockRestore();
        });
    });

    describe('findLogs', () => {
        const mockLogs = [
            { id: 'log1', action: AuditAction.USER_UPDATE, createdAt: new Date() },
            { id: 'log2', action: AuditAction.CHAMA_UPDATE, createdAt: new Date() },
        ];

        beforeEach(() => {
            mockFindMany.mockResolvedValue(mockLogs);
            mockCount.mockResolvedValue(mockLogs.length);
        });

        it('should find logs with default pagination and no filter', async () => {
            const params = { page: 1, limit: 10, filter: {} };
            const result = await findLogs(params);

            expect(mockFindMany).toHaveBeenCalledWith({
                where: {},
                skip: 0,
                take: 10,
                orderBy: { createdAt: 'desc' },
                include: expect.any(Object),
            });
            expect(result).toEqual({
                logs: mockLogs,
                totalRecords: mockLogs.length,
                totalPages: 1,
            });
        });

        it('should apply correct pagination', async () => {
            const params = { page: 2, limit: 1, filter: {} };
            await findLogs(params);
            
            expect(mockFindMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    skip: 1,
                    take: 1,
                })
            );
        });

        it('should apply filters correctly', async () => {
            const filter = { userId: 'user123', action: AuditAction.USER_UPDATE };
            const params = { page: 1, limit: 10, filter };
            await findLogs(params);

            expect(mockFindMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: filter,
                })
            );
        });
    });

    describe('generateAuditExport', () => {
        it('should generate a CSV buffer from audit logs', async () => {
            const logs = [
                {
                    createdAt: new Date('2023-01-01T10:00:00Z'),
                    action: AuditAction.USER_UPDATE,
                    ipAddress: '192.168.1.1',
                    user: { email: 'user@example.com', firstName: 'Test', lastName: 'User' },
                    target: null,
                    chama: null,
                },
                {
                    createdAt: new Date('2023-01-02T11:00:00Z'),
                    action: AuditAction.CHAMA_UPDATE,
                    ipAddress: '192.168.1.2',
                    user: { email: 'admin@example.com', firstName: 'Admin', lastName: 'User' },
                    target: null,
                    chama: { name: 'Test Chama' },
                },
            ];
            
            const buffer = await generateAuditExport(logs);

            expect(mockAddWorksheetRef).toHaveBeenCalledWith('Audit Trail');
            expect(mockAddRowsRef).toHaveBeenCalled();
            expect(mockWriteBufferRef).toHaveBeenCalled();
            expect(buffer).toBeInstanceOf(Buffer);
            expect(buffer.toString()).toContain('mock csv content');
        });
    });
});

describe('Audit Controller', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockStatus: jest.Mock;
    let mockJson: jest.Mock;
    let mockSend: jest.Mock;
    let mockSetHeader: jest.Mock;

    beforeEach(() => {
        mockJson = jest.fn();
        mockSend = jest.fn();
        mockStatus = jest.fn().mockReturnValue({ json: mockJson, send: mockSend });
        mockSetHeader = jest.fn();

        mockRequest = {};
        mockResponse = {
            status: mockStatus,
            json: mockJson,
            send: mockSend,
            setHeader: mockSetHeader,
        };
        jest.clearAllMocks();
    });

    describe('getChamaAuditLogs', () => {
        it('should return chama audit logs', async () => {
            const chamaId = 'chama123';
            const mockLogs = [{ id: 'log1', chamaId }];
            const mockResult = { logs: mockLogs, totalRecords: 1, totalPages: 1 };
            
            mockFindMany.mockResolvedValueOnce(mockLogs);
            mockCount.mockResolvedValueOnce(1);

            mockRequest.params = { chamaId };
            mockRequest.query = { page: '1', limit: '20' };

            await getChamaAuditLogs(mockRequest as Request, mockResponse as Response);

            expect(mockFindMany).toHaveBeenCalled();
            expect(mockStatus).toHaveBeenCalledWith(200);
            expect(mockJson).toHaveBeenCalledWith({ data: expect.objectContaining({ logs: mockLogs }) });
        });

        it('should handle error when fetching chama audit logs', async () => {
            const chamaId = 'chama123';
            mockFindMany.mockRejectedValueOnce(new Error('Service Error'));

            mockRequest.params = { chamaId };
            mockRequest.query = {};

            await getChamaAuditLogs(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(500);
            expect(mockJson).toHaveBeenCalledWith({ message: 'Error fetching chama audit logs.' });
        });
    });

    describe('getUserActivityLogs', () => {
        it('should return user activity logs', async () => {
            const userId = 'user456';
            const mockLogs = [{ id: 'log2', userId }];
            
            mockFindMany.mockResolvedValueOnce(mockLogs);
            mockCount.mockResolvedValueOnce(1);

            mockRequest.params = { userId };
            mockRequest.query = { page: '1', limit: '20' };

            await getUserActivityLogs(mockRequest as Request, mockResponse as Response);

            expect(mockFindMany).toHaveBeenCalled();
            expect(mockStatus).toHaveBeenCalledWith(200);
            expect(mockJson).toHaveBeenCalledWith({ data: expect.objectContaining({ logs: mockLogs }) });
        });

        it('should handle error when fetching user activity logs', async () => {
            const userId = 'user456';
            mockFindMany.mockRejectedValueOnce(new Error('Service Error'));

            mockRequest.params = { userId };
            mockRequest.query = {};

            await getUserActivityLogs(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(500);
            expect(mockJson).toHaveBeenCalledWith({ message: 'Error fetching user activity logs.' });
        });
    });

    describe('searchAuditLogs', () => {
        it('should return audit logs based on action filter', async () => {
            const mockLogs = [{ id: 'log3', action: AuditAction.USER_UPDATE }];
            
            mockFindMany.mockResolvedValueOnce(mockLogs);
            mockCount.mockResolvedValueOnce(1);

            mockRequest.query = { action: AuditAction.USER_UPDATE, page: '1', limit: '20' };

            await searchAuditLogs(mockRequest as Request, mockResponse as Response);

            expect(mockFindMany).toHaveBeenCalled();
            expect(mockStatus).toHaveBeenCalledWith(200);
        });

        it('should return audit logs based on multiple action filters', async () => {
            const mockLogs = [{ id: 'log3', action: AuditAction.USER_UPDATE }];
            
            mockFindMany.mockResolvedValueOnce(mockLogs);
            mockCount.mockResolvedValueOnce(1);

            mockRequest.query = { action: `${AuditAction.USER_UPDATE},${AuditAction.USER_DELETE}`, page: '1', limit: '20' };

            await searchAuditLogs(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(200);
        });

        it('should return audit logs based on userId filter', async () => {
            const mockLogs = [{ id: 'log4', userId: 'user789' }];
            
            mockFindMany.mockResolvedValueOnce(mockLogs);
            mockCount.mockResolvedValueOnce(1);

            mockRequest.query = { userId: 'user789', page: '1', limit: '20' };

            await searchAuditLogs(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(200);
        });

        it('should return audit logs based on targetId filter', async () => {
            const mockLogs = [{ id: 'log5', targetId: 'target001' }];
            
            mockFindMany.mockResolvedValueOnce(mockLogs);
            mockCount.mockResolvedValueOnce(1);

            mockRequest.query = { targetId: 'target001', page: '1', limit: '20' };

            await searchAuditLogs(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(200);
        });

        it('should return audit logs based on date range filter', async () => {
            const mockLogs = [{ id: 'log6', createdAt: new Date() }];
            
            mockFindMany.mockResolvedValueOnce(mockLogs);
            mockCount.mockResolvedValueOnce(1);

            const startDate = '2023-01-01T00:00:00Z';
            const endDate = '2023-01-31T23:59:59Z';
            mockRequest.query = { startDate, endDate, page: '1', limit: '20' };

            await searchAuditLogs(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(200);
        });

        it('should handle error when searching audit logs', async () => {
            mockFindMany.mockRejectedValueOnce(new Error('Service Error'));

            mockRequest.query = { action: AuditAction.USER_UPDATE };

            await searchAuditLogs(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(500);
            expect(mockJson).toHaveBeenCalledWith({ message: 'Error searching audit logs.' });
        });
    });

    describe('exportAuditLogs', () => {
        it('should export audit logs as a CSV file', async () => {
            const mockLogs = [{ id: 'log7', action: AuditAction.USER_UPDATE }];
            const mockBuffer = Buffer.from('test csv content');

            mockFindMany.mockResolvedValueOnce(mockLogs);
            mockCount.mockResolvedValueOnce(1);
            mockWriteBufferRef.mockResolvedValueOnce(mockBuffer);

            mockRequest.body = { action: AuditAction.USER_UPDATE };

            await exportAuditLogs(mockRequest as Request, mockResponse as Response);

            expect(mockFindMany).toHaveBeenCalled();
            expect(mockAddWorksheetRef).toHaveBeenCalledWith('Audit Trail');
            expect(mockSetHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
            expect(mockSetHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('attachment; filename=audit-report-'));
            expect(mockStatus).toHaveBeenCalledWith(200);
            expect(mockSend).toHaveBeenCalledWith(mockBuffer);
        });

        it('should return 404 if no logs are found for export', async () => {
            mockFindMany.mockResolvedValueOnce([]);
            mockCount.mockResolvedValueOnce(0);

            mockRequest.body = { action: AuditAction.USER_UPDATE };

            await exportAuditLogs(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(404);
            expect(mockJson).toHaveBeenCalledWith({ message: 'No logs found matching the specified criteria.' });
        });

        it('should handle error during audit log export', async () => {
            mockFindMany.mockRejectedValueOnce(new Error('Service Error'));

            mockRequest.body = { action: AuditAction.USER_UPDATE };

            await exportAuditLogs(mockRequest as Request, mockResponse as Response);

            expect(mockStatus).toHaveBeenCalledWith(500);
            expect(mockJson).toHaveBeenCalledWith({ message: 'Error exporting audit logs.' });
        });
    });
});