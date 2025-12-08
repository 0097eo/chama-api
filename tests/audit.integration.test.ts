import { PrismaClient, AuditAction } from '@prisma/client';
import request from 'supertest';
import express, { Express } from 'express';
import { createAuditLog, findLogs, generateAuditExport } from '../src/services/audit.service';
import { getChamaAuditLogs, getUserActivityLogs, searchAuditLogs, exportAuditLogs } from '../src/controllers/audit.controller';

const prisma = new PrismaClient();
let app: Express;

// Test data IDs
const testUserIds: string[] = [];
const testChamaIds: string[] = [];

// Setup Express app with routes
beforeAll(async () => {
    app = express();
    app.use(express.json());
    
    // Define routes
    app.get('/api/audit/chama/:chamaId', getChamaAuditLogs);
    app.get('/api/audit/user/:userId', getUserActivityLogs);
    app.get('/api/audit/search', searchAuditLogs);
    app.post('/api/audit/export', exportAuditLogs);

    // Create test users
    const users = await Promise.all([
        prisma.user.create({
            data: {
                idNumber: '1111111111',
                email: 'test-user-1@test.com',
                firstName: 'Test',
                lastName: 'User1',
                phone: '+254700000001',
                password: 'hashedpassword',
            },
        }),
        prisma.user.create({
            data: {
                idNumber: '2222222222',
                email: 'test-user-2@test.com',
                firstName: 'Test',
                lastName: 'User2',
                phone: '+254700000002',
                password: 'hashedpassword',
            },
        }),
        prisma.user.create({
            data: {
                idNumber: '3333333333',
                email: 'test-user-3@test.com',
                firstName: 'Test',
                lastName: 'User3',
                phone: '+254700000003',
                password: 'hashedpassword',
            },
        }),
        prisma.user.create({
            data: {
                idNumber: '4444444444',
                email: 'test-user-4@test.com',
                firstName: 'Test',
                lastName: 'User4',
                phone: '+254700000004',
                password: 'hashedpassword',
            },
        }),
        prisma.user.create({
            data: {
                idNumber: '5555555555',
                email: 'test-user-5@test.com',
                firstName: 'Test',
                lastName: 'User5',
                phone: '+254700000005',
                password: 'hashedpassword',
            },
        }),
        prisma.user.create({
            data: {
                idNumber: '6666666666',
                email: 'test-user-6@test.com',
                firstName: 'Test',
                lastName: 'User6',
                phone: '+254700000006',
                password: 'hashedpassword',
            },
        }),
    ]);

    testUserIds.push(...users.map(u => u.id));

    // Create test chamas
    const chamas = await Promise.all([
        prisma.chama.create({
            data: {
                name: 'Test Chama 1',
                description: 'Test chama for integration tests',
                monthlyContribution: 1000,
                meetingDay: 'Monday',
            },
        }),
        prisma.chama.create({
            data: {
                name: 'Test Chama 2',
                description: 'Test chama for integration tests',
                monthlyContribution: 1000,
                meetingDay: 'Tuesday',
            },
        }),
        prisma.chama.create({
            data: {
                name: 'Test Chama 3',
                description: 'Test chama for integration tests',
                monthlyContribution: 1000,
                meetingDay: 'Wednesday',
            },
        }),
        prisma.chama.create({
            data: {
                name: 'Test Chama 4',
                description: 'Test chama for integration tests',
                monthlyContribution: 1000,
                meetingDay: 'Thursday',
            },
        }),
        prisma.chama.create({
            data: {
                name: 'Test Chama 5',
                description: 'Test chama for integration tests',
                monthlyContribution: 1000,
                meetingDay: 'Friday',
            },
        }),
    ]);

    testChamaIds.push(...chamas.map(c => c.id));
});

// Clean up test data after all tests
afterAll(async () => {
    await prisma.auditLog.deleteMany({
        where: { userId: { in: testUserIds } },
    });
    await prisma.chama.deleteMany({
        where: { id: { in: testChamaIds } },
    });
    await prisma.user.deleteMany({
        where: { id: { in: testUserIds } },
    });
    await prisma.$disconnect();
});

describe('Audit Service Integration Tests', () => {
    describe('createAuditLog', () => {
        it('should create an audit log in the database', async () => {
            const data = {
                action: AuditAction.USER_UPDATE,
                actorId: testUserIds[0],
                ipAddress: '127.0.0.1',
                userAgent: 'jest-test',
            };

            await createAuditLog(data);

            const log = await prisma.auditLog.findFirst({
                where: { userId: testUserIds[0], action: AuditAction.USER_UPDATE },
                orderBy: { createdAt: 'desc' },
            });

            expect(log).toBeTruthy();
            expect(log?.action).toBe(AuditAction.USER_UPDATE);
            expect(log?.ipAddress).toBe('127.0.0.1');
            expect(log?.userAgent).toBe('jest-test');
        });

        it('should create audit log with all optional fields', async () => {
            const data = {
                action: AuditAction.CHAMA_UPDATE,
                actorId: testUserIds[1],
                targetId: testUserIds[2],
                chamaId: testChamaIds[0],
                oldValue: { status: 'pending' },
                newValue: { status: 'approved' },
                ipAddress: '192.168.1.1',
                userAgent: 'test-agent',
            };

            await createAuditLog(data);

            const log = await prisma.auditLog.findFirst({
                where: { 
                    userId: testUserIds[1],
                    chamaId: testChamaIds[0],
                },
                orderBy: { createdAt: 'desc' },
            });

            expect(log).toBeTruthy();
            expect(log?.targetId).toBe(testUserIds[2]);
            expect(log?.oldValue).toEqual({ status: 'pending' });
            expect(log?.newValue).toEqual({ status: 'approved' });
        });
    });

    describe('findLogs', () => {
        beforeAll(async () => {
            // Create test data
            await createAuditLog({
                action: AuditAction.USER_UPDATE,
                actorId: testUserIds[2],
                chamaId: testChamaIds[1],
            });
            await createAuditLog({
                action: AuditAction.USER_DELETE,
                actorId: testUserIds[2],
                chamaId: testChamaIds[1],
            });
            await createAuditLog({
                action: AuditAction.CHAMA_UPDATE,
                actorId: testUserIds[3],
                chamaId: testChamaIds[2],
            });
        });

        it('should find logs with pagination', async () => {
            const result = await findLogs({
                page: 1,
                limit: 2,
                filter: { userId: testUserIds[2] },
            });

            expect(result.logs).toHaveLength(2);
            expect(result.totalRecords).toBe(2);
            expect(result.totalPages).toBe(1);
        });

        it('should filter logs by chamaId', async () => {
            const result = await findLogs({
                page: 1,
                limit: 10,
                filter: { chamaId: testChamaIds[1] },
            });

            expect(result.logs.length).toBeGreaterThanOrEqual(2);
            result.logs.forEach(log => {
                expect(log.chamaId).toBe(testChamaIds[1]);
            });
        });

        it('should filter logs by action', async () => {
            const result = await findLogs({
                page: 1,
                limit: 10,
                filter: { action: AuditAction.USER_UPDATE },
            });

            expect(result.logs.length).toBeGreaterThan(0);
            result.logs.forEach(log => {
                expect(log.action).toBe(AuditAction.USER_UPDATE);
            });
        });

        it('should order logs by createdAt descending', async () => {
            const result = await findLogs({
                page: 1,
                limit: 10,
                filter: { userId: testUserIds[2] },
            });

            for (let i = 1; i < result.logs.length; i++) {
                expect(result.logs[i - 1].createdAt.getTime())
                    .toBeGreaterThanOrEqual(result.logs[i].createdAt.getTime());
            }
        });

        it('should include related user, target, and chama data', async () => {
            const result = await findLogs({
                page: 1,
                limit: 1,
                filter: { userId: testUserIds[2] },
            });

            expect(result.logs[0]).toHaveProperty('user');
            expect(result.logs[0]).toHaveProperty('target');
            expect(result.logs[0]).toHaveProperty('chama');
            expect(result.logs[0].user).toHaveProperty('email');
        });
    });

    describe('generateAuditExport', () => {
        it('should generate a CSV buffer from audit logs', async () => {
            const logs = await prisma.auditLog.findMany({
                where: { userId: testUserIds[2] },
                include: {
                    user: { select: { email: true, firstName: true, lastName: true }},
                    target: { select: { email: true }},
                    chama: { select: { name: true }}
                },
                take: 5,
            });

            const buffer = await generateAuditExport(logs);

            expect(buffer).toBeInstanceOf(Buffer);
            const csvContent = buffer.toString();
            
            // Verify CSV headers
            expect(csvContent).toContain('Timestamp');
            expect(csvContent).toContain('Action');
            expect(csvContent).toContain('Actor');
            
            // Verify CSV contains data
            expect(csvContent.split('\n').length).toBeGreaterThan(1);
        });

        it('should handle empty logs array', async () => {
            const buffer = await generateAuditExport([]);

            expect(buffer).toBeInstanceOf(Buffer);
            const csvContent = buffer.toString();
            
            // Should still have headers
            expect(csvContent).toContain('Timestamp');
        });
    });
});

describe('Audit Controller Integration Tests', () => {
    beforeAll(async () => {
        // Create test data for controllers
        await createAuditLog({
            action: AuditAction.USER_UPDATE,
            actorId: testUserIds[4],
            chamaId: testChamaIds[3],
        });
        await createAuditLog({
            action: AuditAction.LOAN_APPROVE,
            actorId: testUserIds[4],
            chamaId: testChamaIds[3],
        });
        await createAuditLog({
            action: AuditAction.CONTRIBUTION_CREATE,
            actorId: testUserIds[5],
            chamaId: testChamaIds[4],
        });
    });

    describe('GET /api/audit/chama/:chamaId', () => {
        it('should return audit logs for a specific chama', async () => {
            const response = await request(app)
                .get(`/api/audit/chama/${testChamaIds[3]}`)
                .expect(200);

            expect(response.body.data).toBeDefined();
            expect(response.body.data.logs).toBeInstanceOf(Array);
            expect(response.body.data.logs.length).toBeGreaterThan(0);
            
            response.body.data.logs.forEach((log: any) => {
                expect(log.chamaId).toBe(testChamaIds[3]);
            });
        });

        it('should support pagination', async () => {
            const response = await request(app)
                .get(`/api/audit/chama/${testChamaIds[3]}`)
                .query({ page: 1, limit: 1 })
                .expect(200);

            expect(response.body.data.logs).toHaveLength(1);
            expect(response.body.data.totalPages).toBeGreaterThanOrEqual(1);
        });

        it('should return empty array for non-existent chama', async () => {
            const response = await request(app)
                .get('/api/audit/chama/non-existent-chama')
                .expect(200);

            expect(response.body.data.logs).toHaveLength(0);
        });
    });

    describe('GET /api/audit/user/:userId', () => {
        it('should return audit logs for a specific user', async () => {
            const response = await request(app)
                .get(`/api/audit/user/${testUserIds[4]}`)
                .expect(200);

            expect(response.body.data.logs).toBeInstanceOf(Array);
            expect(response.body.data.logs.length).toBeGreaterThan(0);
            
            response.body.data.logs.forEach((log: any) => {
                expect(log.userId).toBe(testUserIds[4]);
            });
        });

        it('should support pagination', async () => {
            const response = await request(app)
                .get(`/api/audit/user/${testUserIds[4]}`)
                .query({ page: 1, limit: 1 })
                .expect(200);

            expect(response.body.data.logs).toHaveLength(1);
        });
    });

    describe('GET /api/audit/search', () => {
        it('should search logs by action', async () => {
            const response = await request(app)
                .get('/api/audit/search')
                .query({ action: AuditAction.LOAN_APPROVE })
                .expect(200);

            expect(response.body.data.logs).toBeInstanceOf(Array);
            response.body.data.logs.forEach((log: any) => {
                expect(log.action).toBe(AuditAction.LOAN_APPROVE);
            });
        });

        it('should search logs by multiple actions', async () => {
            const response = await request(app)
                .get('/api/audit/search')
                .query({ action: `${AuditAction.USER_UPDATE},${AuditAction.LOAN_APPROVE}` })
                .expect(200);

            expect(response.body.data.logs).toBeInstanceOf(Array);
            response.body.data.logs.forEach((log: any) => {
                expect([AuditAction.USER_UPDATE, AuditAction.LOAN_APPROVE]).toContain(log.action);
            });
        });

        it('should search logs by userId', async () => {
            const response = await request(app)
                .get('/api/audit/search')
                .query({ userId: testUserIds[4] })
                .expect(200);

            expect(response.body.data.logs).toBeInstanceOf(Array);
            response.body.data.logs.forEach((log: any) => {
                expect(log.userId).toBe(testUserIds[4]);
            });
        });

        it('should search logs by date range', async () => {
            const now = new Date();
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            
            const response = await request(app)
                .get('/api/audit/search')
                .query({
                    startDate: yesterday.toISOString(),
                    endDate: now.toISOString(),
                })
                .expect(200);

            expect(response.body.data.logs).toBeInstanceOf(Array);
        });

        it('should combine multiple filters', async () => {
            const response = await request(app)
                .get('/api/audit/search')
                .query({
                    userId: testUserIds[4],
                    action: AuditAction.USER_UPDATE,
                })
                .expect(200);

            expect(response.body.data.logs).toBeInstanceOf(Array);
            response.body.data.logs.forEach((log: any) => {
                expect(log.userId).toBe(testUserIds[4]);
                expect(log.action).toBe(AuditAction.USER_UPDATE);
            });
        });
    });

    describe('POST /api/audit/export', () => {
        it('should export audit logs as CSV', async () => {
            const response = await request(app)
                .post('/api/audit/export')
                .send({ userId: testUserIds[4] })
                .expect(200);

            expect(response.headers['content-type']).toBe('text/csv');
            expect(response.headers['content-disposition']).toMatch(/attachment; filename=audit-report-/);
            
            const csvContent = response.text;
            expect(csvContent).toContain('Timestamp');
            expect(csvContent).toContain('Action');
            expect(csvContent.split('\n').length).toBeGreaterThan(1);
        });

        it('should export logs filtered by action', async () => {
            const response = await request(app)
                .post('/api/audit/export')
                .send({ action: AuditAction.LOAN_APPROVE })
                .expect(200);

            expect(response.headers['content-type']).toBe('text/csv');
            const csvContent = response.text;
            expect(csvContent).toContain('LOAN_APPROVE');
        });

        it('should return 404 when no logs match criteria', async () => {
            const response = await request(app)
                .post('/api/audit/export')
                .send({ userId: 'non-existent-user' })
                .expect(404);

            expect(response.body.message).toBe('No logs found matching the specified criteria.');
        });

        it('should export logs filtered by chamaId', async () => {
            const response = await request(app)
                .post('/api/audit/export')
                .send({ chamaId: testChamaIds[3] })
                .expect(200);

            expect(response.headers['content-type']).toBe('text/csv');
        });

        it('should handle date range filter in export', async () => {
            const now = new Date();
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            
            const response = await request(app)
                .post('/api/audit/export')
                .send({
                    userId: testUserIds[4],
                    startDate: yesterday.toISOString(),
                    endDate: now.toISOString(),
                })
                .expect(200);

            expect(response.headers['content-type']).toBe('text/csv');
        });
    });
});
