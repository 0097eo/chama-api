import request from 'supertest';
import { mockDeep } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { Express, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import cloudinary from '../src/config/cloudinary.config';


// 1. Mock Prisma Client 
const prismaMock = mockDeep<PrismaClient>();

jest.mock('@prisma/client', () => ({
  __esModule: true,
  PrismaClient: jest.fn(() => prismaMock),
  MembershipRole: {
    ADMIN: 'ADMIN',
    TREASURER: 'TREASURER',
    SECRETARY: 'SECRETARY',
    MEMBER: 'MEMBER',
  },
  ContributionStatus: {
    PENDING: 'PENDING',
    PAID: 'PAID',
    OVERDUE: 'OVERDUE',
  },
  LoanStatus: {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    ACTIVE: 'ACTIVE',
    PAID: 'PAID',
    DEFAULTED: 'DEFAULTED',
  },
  MeetingStatus: {
    SCHEDULED: 'SCHEDULED',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
  },
  UserRole: {
    USER: 'USER',
    ADMIN: 'ADMIN',
  },
  TransactionType: {
    CONTRIBUTION: 'CONTRIBUTION',
    LOAN_DISBURSEMENT: 'LOAN_DISBURSEMENT',
    LOAN_REPAYMENT: 'LOAN_REPAYMENT',
    EXPENSE: 'EXPENSE',
    OTHER: 'OTHER',
  },
  NotificationType: {
    MEETING_REMINDER: 'MEETING_REMINDER',
    CONTRIBUTION_DUE: 'CONTRIBUTION_DUE',
    LOAN_APPROVED: 'LOAN_APPROVED',
    GENERAL: 'GENERAL',
  },
  AuditAction: {
    USER_UPDATE: 'USER_UPDATE',
    USER_DELETE: 'USER_DELETE',
    USER_INVITE: 'USER_INVITE',
    CHAMA_UPDATE: 'CHAMA_UPDATE',
    CHAMA_DELETE: 'CHAMA_DELETE',
    CHAMA_MEMBER_ADD: 'CHAMA_MEMBER_ADD',
    CHAMA_MEMBER_REMOVE: 'CHAMA_MEMBER_REMOVE',
    CHAMA_MEMBER_ROLE_UPDATE: 'CHAMA_MEMBER_ROLE_UPDATE',
    CONTRIBUTION_CREATE: 'CONTRIBUTION_CREATE',
    CONTRIBUTION_UPDATE: 'CONTRIBUTION_UPDATE',
    CONTRIBUTION_DELETE: 'CONTRIBUTION_DELETE',
    LOAN_APPLY: 'LOAN_APPLY',
    LOAN_APPROVE: 'LOAN_APPROVE',
    LOAN_REJECT: 'LOAN_REJECT',
    LOAN_DISBURSE: 'LOAN_DISBURSE',
    LOAN_REPAYMENT: 'LOAN_REPAYMENT',
    LOAN_RESTRUCTURE: 'LOAN_RESTRUCTURE',
    MEETING_SCHEDULE: 'MEETING_SCHEDULE',
    MEETING_UPDATE: 'MEETING_UPDATE',
    MEETING_CANCEL: 'MEETING_CANCEL',
    MEETING_ATTENDANCE_MARK: 'MEETING_ATTENDANCE_MARK',
    MEETING_MINUTES_SAVE: 'MEETING_MINUTES_SAVE',
  },
}));

// Mock AfricasTalking
jest.mock('africastalking', () => {
  return jest.fn().mockImplementation(() => {
    return {
      SMS: {
        send: jest.fn(),
      },
    };
  });
});

// 2. Mock Cloudinary
jest.mock('../src/config/cloudinary.config', () => ({
  uploader: {
    destroy: jest.fn().mockResolvedValue({ result: 'ok' }),
  },
}));

// 3. Mock JWT utils (for auth middleware)
jest.mock('../src/utils/jwt.utils', () => ({
  verifyToken: jest.fn().mockReturnValue({ id: 'mockUserId', role: 'USER' }),
  generateToken: jest.fn().mockReturnValue('mock-token'),
}));

// 4. Mock Auth Middleware
jest.mock('../src/middleware/auth.middleware', () => ({
    protect: (req: any, res: Response, next: NextFunction) => {
        req.user = { id: 'mockUserId', role: 'USER' };
        next();
    }
}));

// 5. Mock Membership Middleware
jest.mock('../src/middleware/membership.middleware', () => ({
    checkMembership: (allowedRoles: string[]) => (req: Request, res: Response, next: NextFunction) => {
      next();
    },
}));

// 6. Mock Multer - FIX: Mock all upload middlewares consistently
jest.mock('../src/middleware/upload.midlleware', () => ({
    uploadGenericFile: {
        single: jest.fn((fieldName: string) => (req: any, res: any, next: any) => {
            if (req.file === undefined) {
                req.file = undefined;
            } else {
                req.file = {
                    originalname: req.file ? req.file.originalname : 'mock-file.pdf',
                    mimetype: req.file ? req.file.mimetype : 'application/pdf',
                    path: 'http://mock-cloudinary.com/mock-file.pdf',
                    filename: 'mock_public_id_123',
                    size: 1024,
                };
            }
            next();
        }),
    },
    uploadConstitution: {
        single: jest.fn((fieldName: string) => (req: any, res: any, next: any) => next()),
    },
    uploadCsv: {
        single: jest.fn((fieldName: string) => (req: any, res: any, next: any) => next()),
    }
}));

interface AuthenticatedRequest extends Request {
  user?: { id: string; role?: string };
}

describe('File Module Tests', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.file.create.mockReset();
    prismaMock.file.findUnique.mockReset();
    prismaMock.file.findMany.mockReset();
    prismaMock.file.delete.mockReset();
    prismaMock.membership.findFirst.mockReset();
    prismaMock.$transaction.mockReset();
    (cloudinary.uploader.destroy as jest.Mock).mockClear();
    
    const uploadGenericFileMock = require('../src/middleware/upload.midlleware').uploadGenericFile;
    if (uploadGenericFileMock.single.mock) {
        uploadGenericFileMock.single.mockClear();
        uploadGenericFileMock.single.mockImplementation((fieldName: string) => (req: any, res: any, next: any) => {
            if (req.file === undefined) {
                req.file = undefined;
            } else {
                req.file = {
                    originalname: req.file.originalname,
                    mimetype: req.file.mimetype,
                    path: 'http://mock-cloudinary.com/mock-file.pdf',
                    filename: 'mock_public_id_123',
                    size: 1024,
                };
            }
            next();
        });
    }
  });

  // --- Unit Tests for file.service.ts ---
  describe('File Service Unit Tests', () => {
    let fileService: any;

    beforeEach(() => {
        // Clear module cache to get fresh service instance with mocked prisma
        jest.resetModules();
        fileService = require('../src/services/file.service');
    });
    
    describe('createFileRecord', () => {
      it('should create a new file record in the database', async () => {
        const fileData = {
          filename: 'test.pdf',
          url: 'http://example.com/test.pdf',
          publicId: 'public_id_123',
          fileType: 'application/pdf',
          size: 12345,
          category: 'documents',
          chamaId: 'chama1',
          uploaderId: 'user1',
        };

        const expectedFile = { id: 'file1', ...fileData, uploadedAt: new Date() };

        prismaMock.file.create.mockResolvedValue(expectedFile as any);

        const result = await fileService.createFileRecord(fileData);

        expect(prismaMock.file.create).toHaveBeenCalledWith({ data: fileData });
        expect(result).toEqual(expectedFile);
      });
    });

    describe('deleteFile', () => {
      const fileId = 'file_to_delete';
      const publicId = 'public_id_to_delete';



      it('should throw an error if the file record is not found', async () => {
        prismaMock.file.findUnique.mockResolvedValue(null);

        await expect(fileService.deleteFile(fileId)).rejects.toThrow('File not found in the database.');
        expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
        expect(prismaMock.file.delete).not.toHaveBeenCalled();
      });
    });
  });

  // --- Integration Tests for files.routes.ts ---
  describe('File API Integration Tests', () => {
    let app: Express;
    let server: any;
    let token: string;
    const mockUserId = 'mockUserId';
    const mockChamaId = 'mockChamaId';

    beforeAll(() => {
        const { app: serverApp, server: httpServer } = require('../src/server');
        app = serverApp;
        server = httpServer;

        token = jwt.sign({ id: mockUserId, role: 'USER' }, 'your-secret-key-for-testing', { expiresIn: '1h' });
    });

    afterAll((done) => {
        if (server) {
            server.close(done);
        } else {
            done();
        }
    });

    describe('POST /api/files/upload/:chamaId', () => {


      it('should return 400 if no file is attached', async () => {
        const uploadGenericFileMock = require('../src/middleware/upload.midlleware').uploadGenericFile;
        uploadGenericFileMock.single.mockImplementationOnce((fieldName: string) => (req: any, res: Response, next: NextFunction) => {
            req.file = undefined;
            next();
        });

        const response = await request(app)
          .post(`/api/files/upload/${mockChamaId}`)
          .set('Authorization', `Bearer ${token}`)
          .field('category', 'general');

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('No file was uploaded. Please select a file to upload.');
        expect(prismaMock.file.create).not.toHaveBeenCalled();
      });




    });

    describe('GET /api/files/chama/:chamaId', () => {
      it('should return 200 and a list of files for the chama', async () => {
        const mockFiles = [
          { id: 'file1', filename: 'doc1.pdf', chamaId: mockChamaId, uploader: { firstName: 'John', lastName: 'Doe' } },
          { id: 'file2', filename: 'image.jpg', chamaId: mockChamaId, uploader: { firstName: 'Jane', lastName: 'Smith' } },
        ];

        prismaMock.file.findMany.mockResolvedValue(mockFiles as any);

        const response = await request(app)
          .get(`/api/files/chama/${mockChamaId}`)
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(mockFiles);
        expect(prismaMock.file.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { chamaId: mockChamaId },
            orderBy: { uploadedAt: 'desc' },
            include: { uploader: { select: { firstName: true, lastName: true }}}
        }));
      });

      it('should return 200 and an empty array if no files found', async () => {
        prismaMock.file.findMany.mockResolvedValue([]);

        const response = await request(app)
          .get(`/api/files/chama/${mockChamaId}`)
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual([]);
      });
    });

    describe('GET /api/files/:id', () => {
      const fileId = 'existingFileId';
      const fileInChama = {
        id: fileId,
        filename: 'report.pdf',
        chamaId: mockChamaId,
        uploaderId: 'otherUser',
        url: 'http://mock.com/report.pdf',
        publicId: 'publicId',
        fileType: 'application/pdf',
        size: 1000,
        uploadedAt: new Date(),
        category: 'reports',
      };



      it('should return 404 if the file does not exist', async () => {
        prismaMock.file.findUnique.mockResolvedValue(null);

        const response = await request(app)
          .get(`/api/files/${fileId}`)
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('File not found.');
        expect(prismaMock.file.findUnique).toHaveBeenCalledWith({ where: { id: fileId } });
        expect(prismaMock.membership.findFirst).not.toHaveBeenCalled();
      });

      it('should return 403 if the user is not a member of the file\'s chama', async () => {
        prismaMock.file.findUnique.mockResolvedValue(fileInChama as any);
        prismaMock.membership.findFirst.mockResolvedValue(null);

        const response = await request(app)
          .get(`/api/files/${fileId}`)
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(403);
        expect(response.body.message).toBe('Permission Denied: You are not a member of the chama this file belongs to.');
        expect(prismaMock.file.findUnique).toHaveBeenCalledWith({ where: { id: fileId } });
        expect(prismaMock.membership.findFirst).toHaveBeenCalledWith({
            where: { userId: mockUserId, chamaId: mockChamaId }
        });
      });
    });

    describe('DELETE /api/files/:id', () => {
      const fileIdToDelete = 'fileToDelete';
      const fileRecordInChama = {
        id: fileIdToDelete,
        filename: 'to-delete.doc',
        chamaId: mockChamaId,
        uploaderId: 'someUser',
        url: 'http://mock.com/to-delete.doc',
        publicId: 'publicIdToDelete',
        fileType: 'application/msword',
        size: 500,
        uploadedAt: new Date(),
        category: 'docs',
      };





      it('should return 404 if the file does not exist', async () => {
        prismaMock.file.findUnique.mockResolvedValue(null);

        const response = await request(app)
          .delete(`/api/files/${fileIdToDelete}`)
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('File not found.');
        expect(prismaMock.file.findUnique).toHaveBeenCalledWith({ where: { id: fileIdToDelete } });
        expect(prismaMock.membership.findFirst).not.toHaveBeenCalled();
        expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
        expect(prismaMock.file.delete).not.toHaveBeenCalled();
      });
    });
  });
});