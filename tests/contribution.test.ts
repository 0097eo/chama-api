import express, { Express, Request, Response, NextFunction } from 'express';
import request from 'supertest';

// Mock Prisma
const prismaMock = {
    contribution: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
      count: jest.fn(),
    },
    membership: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    chama:{
        findUnique: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation((callback) => callback(prismaMock)),
  };
  
  jest.mock('@prisma/client', () => ({
    PrismaClient: jest.fn().mockImplementation(() => prismaMock),
    MembershipRole: {
      ADMIN: 'ADMIN',
      TREASURER: 'TREASURER',
      SECRETARY: 'SECRETARY',
      MEMBER: 'MEMBER',
    },
    ContributionStatus: {
        PAID: 'PAID',
        PENDING: 'PENDING',
    },
    AuditAction: {
      CONTRIBUTION_CREATE: 'CONTRIBUTION_CREATE',
      CONTRIBUTION_UPDATE: 'CONTRIBUTION_UPDATE',
      CONTRIBUTION_DELETE: 'CONTRIBUTION_DELETE',
    },
  }));

// Mock services
jest.mock('../src/services/audit.service', () => ({
    createAuditLog: jest.fn(),
}));
jest.mock('../src/services/contribution.service');

// Mock middlewares
jest.mock('../src/middleware/auth.middleware', () => ({
    protect: (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        req.user = { id: 'user1' };
        next();
    },
}));

jest.mock('../src/middleware/membership.middleware', () => ({
    checkMembership: (allowedRoles: string[]) => (req: Request, res: Response, next: NextFunction) => {
      next();
    },
}));

import * as contributionController from '../src/controllers/contribution.controller';
import * as contributionService from '../src/services/contribution.service';
import contributionRoutes from '../src/routes/contribution.routes';
import { errorHandler } from '../src/middleware/error.middleware';


// Extend Request type for tests
interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

describe('Contribution Module Tests', () => {
    let app: Express;
    let mockContributionService: jest.Mocked<typeof contributionService>;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use('/', contributionRoutes);
        app.use(errorHandler);
        mockContributionService = contributionService as jest.Mocked<typeof contributionService>;
      });
  
    afterEach(() => {
      jest.clearAllMocks();
    });
  
    //--------------------------------------------------------------------------
    // Controller Layer Unit Tests
    //--------------------------------------------------------------------------
    describe('Contribution Controller Unit Tests', () => {
        let mockRequest: Partial<AuthenticatedRequest>;
        let mockResponse: Partial<Response>;
        let responseJson: jest.Mock;
    
        beforeEach(() => {
          responseJson = jest.fn();
          mockRequest = {
            params: {},
            body: {},
            query: {},
            user: { id: 'user1' },
            ip: '127.0.0.1',
            headers: { 'user-agent': 'test-agent' },
          };
          mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: responseJson,
            send: jest.fn(),
            setHeader: jest.fn(),
          };
        });

        it('recordContribution should create a contribution and return 201', async () => {
            const contributionData = { membershipId: 'mem1', amount: 100, month: 1, year: 2024, paymentMethod: 'CASH', paidAt: new Date() };
            mockRequest.body = contributionData;
            const newContribution = { id: 'contr1', ...contributionData };
            mockContributionService.recordContribution.mockResolvedValue(newContribution as any);
      
            await contributionController.recordContribution(mockRequest as Request, mockResponse as Response);
      
            expect(mockContributionService.recordContribution).toHaveBeenCalledWith(
                contributionData, 
                'user1', 
                { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
            );
            expect(mockResponse.status).toHaveBeenCalledWith(201);
            expect(responseJson).toHaveBeenCalledWith({ message: 'Contribution recorded successfully.', data: newContribution });
        });

        it('updateContribution should update a contribution and return 200', async () => {
            const contributionData = { amount: 150 };
            mockRequest.body = contributionData;
            mockRequest.params = { id: 'contr1' };
            const updatedContribution = { id: 'contr1', amount: 150 };
            mockContributionService.findContributionById.mockResolvedValue({ id: 'contr1', membershipId: 'mem1' } as any);
            prismaMock.membership.findFirst.mockResolvedValue({ id: 'mem1', role: 'ADMIN', userId: 'user1', chamaId: 'chama1' } as any);
            mockContributionService.updateContribution.mockResolvedValue(updatedContribution as any);

            await contributionController.updateContribution(mockRequest as AuthenticatedRequest, mockResponse as Response);

            expect(mockContributionService.updateContribution).toHaveBeenCalledWith(
                'contr1', 
                contributionData, 
                'user1', 
                { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
            );
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(responseJson).toHaveBeenCalledWith({ message: 'Contribution updated.', data: updatedContribution });
        });

        it('deleteContribution should delete a contribution and return 200', async () => {
            mockRequest.params = { id: 'contr1' };
            mockContributionService.findContributionById.mockResolvedValue({ id: 'contr1', membershipId: 'mem1' } as any);
            prismaMock.membership.findFirst.mockResolvedValue({ id: 'mem1', role: 'ADMIN', userId: 'user1', chamaId: 'chama1' } as any);
            mockContributionService.deleteContribution.mockResolvedValue({} as any);

            await contributionController.deleteContribution(mockRequest as AuthenticatedRequest, mockResponse as Response);

            expect(mockContributionService.deleteContribution).toHaveBeenCalledWith(
                'contr1', 
                'user1', 
                { ipAddress: '127.0.0.1', userAgent: 'test-agent' }
            );
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(responseJson).toHaveBeenCalledWith({ message: 'Contribution deleted successfully.' });
        });

        it('getChamaContributions should return contributions and status 200', async () => {
            mockRequest.params = { chamaId: 'chama1' };
            mockRequest.query = { page: '1', limit: '10' };
            const contributions = { contributions: [{ id: 'contr1' }], totalRecords: 1, totalPages: 1 };
            mockContributionService.findChamaContributions.mockResolvedValue(contributions as any);

            await contributionController.getChamaContributions(mockRequest as Request, mockResponse as Response);

            expect(mockContributionService.findChamaContributions).toHaveBeenCalledWith('chama1', 1, 10);
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(responseJson).toHaveBeenCalledWith({ data: contributions });
        });

        it('getMemberContributions should return member contributions and status 200', async () => {
            mockRequest.params = { membershipId: 'mem1' };
            const userContributions = [{ id: 'contr1' }];
            const membership = { id: 'mem1', userId: 'user1', chamaId: 'chama1' };
            prismaMock.membership.findUnique.mockResolvedValue(membership as any);
            mockContributionService.findMemberContributions.mockResolvedValue(userContributions as any);
      
            await contributionController.getMemberContributions(mockRequest as AuthenticatedRequest, mockResponse as Response);
      
            expect(mockContributionService.findMemberContributions).toHaveBeenCalledWith('mem1');
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(responseJson).toHaveBeenCalledWith({ data: userContributions });
        });

        it('getContributionById should return a contribution and status 200', async () => {
            mockRequest.params = { id: 'contr1' };
            const contribution = { id: 'contr1', membershipId: 'mem1' };
            mockContributionService.findContributionById.mockResolvedValue(contribution as any);
            prismaMock.membership.findFirst.mockResolvedValue({ id: 'mem1', userId: 'user1' } as any);

            await contributionController.getContributionById(mockRequest as AuthenticatedRequest, mockResponse as Response);

            expect(mockContributionService.findContributionById).toHaveBeenCalledWith('contr1');
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(responseJson).toHaveBeenCalledWith({ data: contribution });
        });

        it('getContributionSummary should return summary and status 200', async () => {
            mockRequest.params = { chamaId: 'chama1' };
            const summary = { totalPaid: 1000 };
            mockContributionService.getContributionSummary.mockResolvedValue(summary as any);

            await contributionController.getContributionSummary(mockRequest as Request, mockResponse as Response);

            expect(mockContributionService.getContributionSummary).toHaveBeenCalledWith('chama1');
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(responseJson).toHaveBeenCalledWith({ data: summary });
        });

        it('getDefaulters should return defaulters and status 200', async () => {
            mockRequest.params = { chamaId: 'chama1' };
            const defaulters = [{ id: 'user2' }];
            mockContributionService.findDefaulters.mockResolvedValue(defaulters as any);

            await contributionController.getDefaulters(mockRequest as Request, mockResponse as Response);

            expect(mockContributionService.findDefaulters).toHaveBeenCalledWith('chama1');
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(responseJson).toHaveBeenCalledWith({ data: defaulters });
        });

        it('exportContributions should return a CSV file', async () => {
            mockRequest.params = { chamaId: 'chama1' };
            const csvBuffer = Buffer.from('a,b,c');
            mockContributionService.generateContributionsExport.mockResolvedValue(csvBuffer);

            await contributionController.exportContributions(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
            expect(mockResponse.send).toHaveBeenCalledWith(csvBuffer);
        });
    });

    //--------------------------------------------------------------------------
    // Integration Tests
    //--------------------------------------------------------------------------
    describe('Contribution API Integration Tests', () => {

        it('POST / - should record a new contribution', async () => {
            const contributionData = { membershipId: 'mem1', amount: 100, month: 1, year: 2024, paymentMethod: 'CASH', paidAt: new Date().toISOString() };
            const newContribution = { id: 'contr1', ...contributionData };
            mockContributionService.recordContribution.mockResolvedValue(newContribution as any);
      
            const response = await request(app)
              .post('/')
              .send(contributionData);
      
            expect(response.status).toBe(201);
            expect(response.body.data).toMatchObject({ id: 'contr1' });
        });

        it('PUT /:id - should update a contribution', async () => {
            const contributionData = { amount: 150 };
            const updatedContribution = { id: 'contr1', amount: 150 };
            mockContributionService.findContributionById.mockResolvedValue({ id: 'contr1', membershipId: 'mem1' } as any);
            prismaMock.membership.findFirst.mockResolvedValue({ id: 'mem1', role: 'ADMIN', userId: 'user1', chamaId: 'chama1' } as any);
            mockContributionService.updateContribution.mockResolvedValue(updatedContribution as any);

            const response = await request(app)
                .put('/contr1')
                .send(contributionData);

            expect(response.status).toBe(200);
            expect(response.body.data).toMatchObject({ amount: 150 });
        });

        it('DELETE /:id - should delete a contribution', async () => {
            mockContributionService.findContributionById.mockResolvedValue({ id: 'contr1', membershipId: 'mem1' } as any);
            prismaMock.membership.findFirst.mockResolvedValue({ id: 'mem1', role: 'ADMIN', userId: 'user1', chamaId: 'chama1' } as any);
            mockContributionService.deleteContribution.mockResolvedValue({} as any);

            const response = await request(app)
                .delete('/contr1');

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Contribution deleted successfully.');
        });

        it('GET /chama/:chamaId - should fetch contributions for a chama', async () => {
            const contributions = { contributions: [{ id: 'contr1' }], totalRecords: 1, totalPages: 1 };
            mockContributionService.findChamaContributions.mockResolvedValue(contributions as any);
      
            const response = await request(app)
              .get('/chama/chama1');
      
            expect(response.status).toBe(200);
            expect(response.body.data.totalRecords).toBe(1);
        });

        it('GET /member/:membershipId - should fetch contributions for a member', async () => {
            const userContributions = [{ id: 'contr1' }];
            const membership = { id: 'mem1', userId: 'user1', chamaId: 'chama1' };
            prismaMock.membership.findUnique.mockResolvedValue(membership as any);
            mockContributionService.findMemberContributions.mockResolvedValue(userContributions as any);
      
            const response = await request(app)
              .get('/member/mem1');
      
            expect(response.status).toBe(200);
            expect(response.body.data).toEqual(userContributions);
        });

        it('GET /summary/:chamaId - should get a contribution summary', async () => {
            const summary = { totalPaid: 1000 };
            mockContributionService.getContributionSummary.mockResolvedValue(summary as any);

            const response = await request(app)
                .get('/summary/chama1');

            expect(response.status).toBe(200);
            expect(response.body.data).toEqual(summary);
        });

        it('GET /defaulters/:chamaId - should get a list of defaulters', async () => {
            const defaulters = [{ id: 'user2' }];
            mockContributionService.findDefaulters.mockResolvedValue(defaulters as any);

            const response = await request(app)
                .get('/defaulters/chama1');

            expect(response.status).toBe(200);
            expect(response.body.data).toEqual(defaulters);
        });

        it('GET /export/:chamaId - should export contributions as a CSV file', async () => {
            const csvBuffer = Buffer.from('a,b,c');
            mockContributionService.generateContributionsExport.mockResolvedValue(csvBuffer);

            const response = await request(app)
                .get('/export/chama1');

            expect(response.status).toBe(200);
            expect(response.header['content-type']).toContain('text/csv');
            expect(response.text).toBe('a,b,c');
        });
    });
});