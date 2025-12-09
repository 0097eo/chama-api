import express, { Express, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';

// Mock Prisma FIRST before any imports that use it
const prismaMock = {
  chama: {
    findUnique: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  membership: {
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
  },
  user: {
    findUnique: jest.fn().mockResolvedValue({ id: 'cluser123' }),
  },
  contribution: {
    aggregate: jest.fn(),
  },
  loan: {
    aggregate: jest.fn(),
  },
  chamaInvitation: {
    create: jest.fn(),
  },
  $transaction: jest.fn().mockImplementation((callback) => callback(prismaMock)),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => prismaMock),
  MembershipRole: {
    ADMIN: 'ADMIN',
    MEMBER: 'MEMBER',
  },
  AuditAction: {
    CHAMA_UPDATE: 'CHAMA_UPDATE',
    CHAMA_DELETE: 'CHAMA_DELETE',
    CHAMA_MEMBER_ADD: 'CHAMA_MEMBER_ADD',
    CHAMA_MEMBER_REMOVE: 'CHAMA_MEMBER_REMOVE',
    CHAMA_MEMBER_ROLE_UPDATE: 'CHAMA_MEMBER_ROLE_UPDATE',
  }
}));

// Mock JWT utils
jest.mock('../src/utils/jwt.utils', () => ({
  verifyToken: jest.fn().mockReturnValue({ id: 'cluser123' }),
  generateToken: jest.fn().mockReturnValue('mock-token'),
}));

// Mock audit service
jest.mock('../src/services/audit.service', () => ({
  createAuditLog: jest.fn(),
}));

// Mock chama service
jest.mock('../src/services/chama.service');

// Mock Cloudinary upload
jest.mock('../src/config/cloudinary.config', () => ({
  uploadToCloudinary: jest.fn().mockResolvedValue({ secure_url: 'http://example.com/file.pdf' }),
}));

// Mock auth middleware
jest.mock('../src/middleware/auth.middleware', () => ({
    protect: (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        req.user = { id: 'cluser123' };
        next();
    }
}));

jest.mock('../src/middleware/membership.middleware', () => ({
    checkMembership: (allowedRoles: string[]) => (req: Request, res: Response, next: NextFunction) => {
      next();
    },
}));

import chamaRoutes from '../src/routes/chama.routes';
import { errorHandler } from '../src/middleware/error.middleware';


interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

describe('Chama Module Tests', () => {
  let chamaService: jest.Mocked<typeof import('../src/services/chama.service')>;
  let chamaController: typeof import('../src/controllers/chama.controller');

  beforeAll(() => {
    chamaService = require('../src/services/chama.service');
    chamaController = require('../src/controllers/chama.controller');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  //--------------------------------------------------------------------------
  // Controller Layer Unit Tests
  //--------------------------------------------------------------------------
  describe('Chama Controller Unit Tests', () => {
    let mockRequest: Partial<AuthenticatedRequest>;
    let mockResponse: Partial<Response>;
    let responseJson: jest.Mock;
    let nextFunction: NextFunction = jest.fn();

    beforeEach(() => {
      responseJson = jest.fn();
      mockRequest = {
        params: {},
        body: {},
        user: { id: '1' },
      };
      mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: responseJson,
      };
    });

    it('createChama should create a chama and return 201', async () => {
      mockRequest.body = { name: 'Test Chama', monthlyContribution: 1000, meetingDay: 'Monday' };
      const newChama = { id: '1', name: 'Test Chama', totalMembers: 1 };
      chamaService.createChamaAndFirstMember.mockResolvedValue(newChama as any);

      await chamaController.createChama(mockRequest as Request, mockResponse as Response);

      expect(chamaService.createChamaAndFirstMember).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Test Chama' }),
        '1'
      );
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(responseJson).toHaveBeenCalledWith(expect.objectContaining({ 
        message: 'Chama created successfully',
        data: newChama 
      }));
    });
    
    it('getUserChamas should return user chamas and status 200', async () => {
      const chamas = [{ id: '1', name: 'My Chama' }];
      chamaService.findUserChamas.mockResolvedValue(chamas as any);

      await chamaController.getUserChamas(mockRequest as Request, mockResponse as Response);

      expect(chamaService.findUserChamas).toHaveBeenCalledWith('1');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith({ data: chamas });
    });

    it('getChamaById should return chama details and status 200', async () => {
      mockRequest.params = { id: 'chama1' };
      const chama = { id: 'chama1', name: 'Detailed Chama' };
      chamaService.findChamaDetails.mockResolvedValue(chama as any);

      await chamaController.getChamaById(mockRequest as Request, mockResponse as Response);

      expect(chamaService.findChamaDetails).toHaveBeenCalledWith('chama1');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith({ data: chama });
    });

    it('getChamaById should return 404 if chama not found', async () => {
      mockRequest.params = { id: 'nonexistent' };
      chamaService.findChamaDetails.mockResolvedValue(null);

      await chamaController.getChamaById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(responseJson).toHaveBeenCalledWith({ message: 'Chama not found.' });
    });

    it('updateChama should update chama and return 200', async () => {
      mockRequest.params = { id: 'chama1' };
      mockRequest.body = { description: 'New Description' };
      const updatedChama = { id: 'chama1', description: 'New Description' };
      chamaService.updateChamaDetails.mockResolvedValue(updatedChama as any);
      
      await chamaController.updateChama(mockRequest as Request, mockResponse as Response);

      expect(chamaService.updateChamaDetails).toHaveBeenCalledWith('chama1', '1', mockRequest.body);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(expect.objectContaining({ 
        message: 'Chama updated successfully',
        data: updatedChama 
      }));
    });

    it('deleteChama should delete chama and return 200', async () => {
      mockRequest.params = { id: 'chama1' };
      chamaService.deleteChamaById.mockResolvedValue({} as any);

      await chamaController.deleteChama(mockRequest as Request, mockResponse as Response);

      expect(chamaService.deleteChamaById).toHaveBeenCalledWith('chama1', '1');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith({ message: 'Chama deleted successfully.' });
    });

    it('addMember should add a member and return 201', async () => {
      mockRequest.params = { id: 'chama1' };
      mockRequest.body = { email: 'member@test.com' };
      const newMembership = { id: 'mem2', role: 'MEMBER' };
      chamaService.addMemberToChama.mockResolvedValue(newMembership as any);

      await chamaController.addMember(mockRequest as Request, mockResponse as Response);

      expect(chamaService.addMemberToChama).toHaveBeenCalledWith('chama1', '1', 'member@test.com');
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(responseJson).toHaveBeenCalledWith(expect.objectContaining({ 
        data: newMembership 
      }));
    });

    it('removeMember should remove a member and return 200', async () => {
      mockRequest.params = { id: 'chama1', userId: 'user2' };
      chamaService.removeMemberFromChama.mockResolvedValue({} as any);

      await chamaController.removeMember(mockRequest as Request, mockResponse as Response);

      expect(chamaService.removeMemberFromChama).toHaveBeenCalledWith('chama1', '1', 'user2');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith({ message: 'Member removed successfully.' });
    });

    it('updateMemberRole should update a role and return 200', async () => {
      mockRequest.params = { id: 'chama1', userId: 'user2' };
      mockRequest.body = { role: 'ADMIN' };
      const updatedMembership = { id: 'mem2', role: 'ADMIN' };
      chamaService.updateMemberRoleInChama.mockResolvedValue(updatedMembership as any);

      await chamaController.updateMemberRole(mockRequest as Request, mockResponse as Response);

      expect(chamaService.updateMemberRoleInChama).toHaveBeenCalledWith('chama1', '1', 'user2', 'ADMIN');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(expect.objectContaining({ 
        data: updatedMembership 
      }));
    });

    it('getChamaDashboard should return dashboard data and status 200', async () => {
      mockRequest.params = { id: 'chama1' };
      const dashboardData = { 
        totalMembers: 10, 
        totalContributionsThisYear: 50000, 
        activeLoansCount: 0, 
        totalLoanAmountActive: 0 
      };
      chamaService.getDashboardData.mockResolvedValue(dashboardData);

      await chamaController.getChamaDashboard(mockRequest as Request, mockResponse as Response);
      
      expect(chamaService.getDashboardData).toHaveBeenCalledWith('chama1');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith({ data: dashboardData });
    });
  });

  //--------------------------------------------------------------------------
  // Integration Tests
  //--------------------------------------------------------------------------
  describe('Chama API Integration Tests', () => {
    let app: Express;
    let token: string;
    const userId = 'cluser123';

    beforeAll(() => {
      app = express();
      app.use(express.json());
      
      // Mount routes
      app.use('/', chamaRoutes);
      app.use(errorHandler);

      token = jwt.sign({ id: userId, role: 'USER' }, 'your-secret-key-for-testing', { expiresIn: '1h' });
    });

    it('POST / - should create a new chama', async () => {
      const chamaData = { 
        name: 'Integration Test Chama', 
        monthlyContribution: 500, 
        meetingDay: 'Friday' 
      };
      const createdChama = { id: 'integ-chama-1', ...chamaData, totalMembers: 1 };
      
      chamaService.createChamaAndFirstMember.mockResolvedValue(createdChama as any);

      const response = await request(app)
        .post('/')
        .set('Authorization', `Bearer ${token}`)
        .send(chamaData);

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({ name: chamaData.name });
    });

    it('GET / - should fetch chamas for the authenticated user', async () => {
      const userChamas = [{ id: 'chama1', name: 'User Chama 1' }];
      chamaService.findUserChamas.mockResolvedValue(userChamas as any);

      const response = await request(app)
        .get('/')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(userChamas);
    });

    it('GET /:id - should fetch a single chama by ID', async () => {
      const chama = { id: 'chama1', name: 'Single Chama' };
      chamaService.findChamaDetails.mockResolvedValue(chama as any);

      const response = await request(app)
        .get('/chama1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(chama);
    });

    it('PUT /:id - should update a chama', async () => {
      const updateData = { description: "Updated Description" };
      const updatedChama = { id: 'chama1', name: 'Original Name', ...updateData };
      chamaService.updateChamaDetails.mockResolvedValue(updatedChama as any);

      const response = await request(app)
        .put('/chama1')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);
      
      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(updatedChama);
    });

    it('DELETE /:id - should delete a chama', async () => {
      chamaService.deleteChamaById.mockResolvedValue({} as any);

      const response = await request(app)
        .delete('/chama1')
        .set('Authorization', `Bearer ${token}`);
        
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Chama deleted successfully.');
    });

    it('POST /:id/members - should add a member to a chama', async () => {
      const newMember = { email: 'new.member@example.com' };
      const newMembership = { id: 'mem-new', userId: 'newUser123', role: 'MEMBER' };
      chamaService.addMemberToChama.mockResolvedValue(newMembership as any);

      const response = await request(app)
        .post('/chama1/members')
        .set('Authorization', `Bearer ${token}`)
        .send(newMember);

      expect(response.status).toBe(201);
      expect(response.body.data).toEqual(newMembership);
    });

    it('DELETE /:id/members/:userId - should remove a member from a chama', async () => {
      chamaService.removeMemberFromChama.mockResolvedValue({} as any);

      const response = await request(app)
        .delete('/chama1/members/user2')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Member removed successfully.');
    });

    it('PUT /:id/members/:userId/role - should update a member role', async () => {
      const roleUpdate = { role: 'ADMIN' };
      const updatedMembership = { id: 'mem2', role: 'ADMIN' };
      chamaService.updateMemberRoleInChama.mockResolvedValue(updatedMembership as any);
      
      const response = await request(app)
        .put('/chama1/members/user2/role')
        .set('Authorization', `Bearer ${token}`)
        .send(roleUpdate);

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(updatedMembership);
    });

    it('GET /:id/dashboard - should get dashboard data', async () => {
      const dashboardData = { 
        totalMembers: 5, 
        totalContributionsThisYear: 12000, 
        activeLoansCount: 0, 
        totalLoanAmountActive: 0 
      };
      chamaService.getDashboardData.mockResolvedValue(dashboardData);

      const response = await request(app)
        .get('/chama1/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(dashboardData);
    });
  });
});