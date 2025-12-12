import { Request, Response, NextFunction } from 'express';
import * as notificationController from '../src/controllers/notification.controller';
import * as notificationService from '../src/services/notification.service';

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

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
    notification: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
    },
    membership: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    chama: {
      findUnique: jest.fn(),
    },
    loan: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((operations) => Promise.all(operations)),
  };

  return {
    PrismaClient: jest.fn().mockImplementation(() => mockPrismaFunctions),
    NotificationType: {
      GENERAL: 'GENERAL',
      INVITATION: 'INVITATION',
    },
    MembershipRole: {
      ADMIN: 'ADMIN',
      TREASURER: 'TREASURER',
      SECRETARY: 'SECRETARY',
    },
  };
});

// Mock the service module
jest.mock('../src/services/notification.service', () => ({
    markNotificationAsRead: jest.fn(),
    notifyNotificationDeleted: jest.fn(),
    createBulkNotifications: jest.fn(),
    sendSms: jest.fn(),
    sendEmail: jest.fn(),
}));

// Mock error utils
jest.mock('../src/utils/error.utils', () => ({
  isErrorWithMessage: jest.fn((error: any) => error && error.message),
  isPrismaError: jest.fn(),
}));

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient() as any;

describe('Notification Module Tests', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = {
      user: { id: 'cluser123' },
      params: {},
      body: {},
      headers: { 'user-agent': 'jest-test' },
      ip: '127.0.0.1',
    } as Partial<AuthenticatedRequest>;

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('Notification Controller Unit Tests', () => {
    describe('getUserNotificationsForChama', () => {
        it('should return user notifications for a specific chama', async () => {
            mockRequest.params = { chamaId: 'chama1' };
            const membership = { id: 'membership1' };
            const notifications = [{ id: 'notification1', message: 'Test' }];
            prisma.membership.findFirst.mockResolvedValue(membership);
            prisma.notification.findMany.mockResolvedValue(notifications);
    
            await notificationController.getUserNotificationsForChama(mockRequest as AuthenticatedRequest, mockResponse as Response);
    
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({ data: notifications });
        });

        it('should return 403 if user is not a member of the chama', async () => {
            mockRequest.params = { chamaId: 'chama1' };
            prisma.membership.findFirst.mockResolvedValue(null);
    
            await notificationController.getUserNotificationsForChama(mockRequest as AuthenticatedRequest, mockResponse as Response);
    
            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: "You are not a member of this chama." });
        });
    });
    
    describe('markAsRead', () => {
        it('should mark a notification as read', async () => {
            mockRequest.params = { id: 'notification1' };
            const notification = { id: 'notification1', membership: { userId: 'cluser123' } };
            const updatedNotification = { id: 'notification1', read: true };
            prisma.notification.findFirst.mockResolvedValue(notification);
            prisma.notification.update.mockResolvedValue(updatedNotification);
    
            await notificationController.markAsRead(mockRequest as AuthenticatedRequest, mockResponse as Response);
    
            expect(notificationService.markNotificationAsRead).toHaveBeenCalledWith('notification1', 'cluser123');
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({ data: updatedNotification });
        });

        it('should return 404 if notification not found', async () => {
            mockRequest.params = { id: 'notification1' };
            prisma.notification.findFirst.mockResolvedValue(null);
    
            await notificationController.markAsRead(mockRequest as AuthenticatedRequest, mockResponse as Response);
    
            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Notification not found or you do not have permission to update it.' });
        });
    });

    describe('deleteNotification', () => {
        it('should delete a notification', async () => {
            mockRequest.params = { id: 'notification1' };
            const notification = { id: 'notification1', membership: { userId: 'cluser123' } };
            prisma.notification.findFirst.mockResolvedValue(notification);
    
            await notificationController.deleteNotification(mockRequest as AuthenticatedRequest, mockResponse as Response);
    
            expect(notificationService.notifyNotificationDeleted).toHaveBeenCalledWith('notification1', 'cluser123');
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Notification deleted successfully.' });
        });

        it('should return 404 if notification not found', async () => {
            mockRequest.params = { id: 'notification1' };
            prisma.notification.findFirst.mockResolvedValue(null);
    
            await notificationController.deleteNotification(mockRequest as AuthenticatedRequest, mockResponse as Response);
    
            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Notification not found or you do not have permission to delete it.' });
        });
    });

    describe('broadcastToChama', () => {
        it('should broadcast a message to a chama', async () => {
            mockRequest.params = { chamaId: 'chama1' };
            mockRequest.body = { title: 'Test', message: 'Test message' };
            const members = [{ user: { phone: '123' } }];
            prisma.membership.findMany.mockResolvedValue(members);

            await notificationController.broadcastToChama(mockRequest as AuthenticatedRequest, mockResponse as Response);

            expect(notificationService.createBulkNotifications).toHaveBeenCalledWith('chama1', 'Test', 'Test message', 'GENERAL');
            expect(notificationService.sendSms).toHaveBeenCalledWith(['123'], 'Test message');
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Broadcast sent successfully.' });
        });

        it('should return 400 if title or message is missing', async () => {
            mockRequest.params = { chamaId: 'chama1' };
            mockRequest.body = { title: 'Test' };
    
            await notificationController.broadcastToChama(mockRequest as AuthenticatedRequest, mockResponse as Response);
    
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Title and message are required.' });
        });
    });

    describe('sendSmsController', () => {
        it('should send an SMS', async () => {
            mockRequest.body = { to: '12345', message: 'Test' };

            await notificationController.sendSmsController(mockRequest as Request, mockResponse as Response);

            expect(notificationService.sendSms).toHaveBeenCalledWith(['12345'], 'Test');
            expect(mockResponse.status).toHaveBeenCalledWith(200);
        });

        it('should return 400 if to or message is missing', async () => {
            mockRequest.body = { to: '12345' };
    
            await notificationController.sendSmsController(mockRequest as Request, mockResponse as Response);
    
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'A recipient phone number (to) and a message are required.' });
        });
    });
    
    describe('sendEmailController', () => {
        it('should send an email', async () => {
            mockRequest.body = { to: 'test@test.com', subject: 'hi', html: '<p>hello</p>' };

            await notificationController.sendEmailController(mockRequest as Request, mockResponse as Response);

            expect(notificationService.sendEmail).toHaveBeenCalledWith('test@test.com', 'hi', '<p>hello</p>');
            expect(mockResponse.status).toHaveBeenCalledWith(200);
        });

        it('should return 400 if to, subject, or html is missing', async () => {
            mockRequest.body = { to: 'test@test.com', subject: 'hi' };
    
            await notificationController.sendEmailController(mockRequest as Request, mockResponse as Response);
    
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'A recipient (to), subject, and html body are required.' });
        });
    });

    describe('sendContributionReminder', () => {
        it('should send a contribution reminder', async () => {
            mockRequest.body = { chamaId: 'chama1', userId: 'user2', memberName: 'John Doe', phoneNumber: '12345' };
            const actorMembership = { id: 'membership1' };
            const chama = { id: 'chama1', name: 'Test Chama', monthlyContribution: 1000 };
            prisma.membership.findFirst.mockResolvedValue(actorMembership);
            prisma.chama.findUnique.mockResolvedValue(chama);

            await notificationController.sendContributionReminder(mockRequest as AuthenticatedRequest, mockResponse as Response);

            expect(notificationService.sendSms).toHaveBeenCalledWith(['12345'], 'Hello John Doe, this is a friendly reminder that your monthly contribution of KSH 1,000 for Test Chama is due. Thank you.');
            expect(mockResponse.status).toHaveBeenCalledWith(200);
        });

        it('should return 400 if required fields are missing', async () => {
            mockRequest.body = {};
    
            await notificationController.sendContributionReminder(mockRequest as AuthenticatedRequest, mockResponse as Response);
    
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Chama ID, user ID, member name, and phone number are required.' });
        });
    });
    
    describe('sendLoanReminder', () => {
        it('should send a loan reminder', async () => {
            mockRequest.body = { chamaId: 'chama1', memberName: 'Jane Doe', phoneNumber: '54321', loanId: 'loan1' };
            const actorMembership = { id: 'membership2' };
            const loan = { id: 'loan1', monthlyInstallment: 500 };
            prisma.membership.findFirst.mockResolvedValue(actorMembership);
            prisma.loan.findUnique.mockResolvedValue(loan);

            await notificationController.sendLoanReminder(mockRequest as AuthenticatedRequest, mockResponse as Response);

            expect(notificationService.sendSms).toHaveBeenCalledWith(['54321'], 'Hello Jane Doe, this is a friendly reminder that your loan installment of KSH 500 is overdue. Please make a payment soon. Thank you.');
            expect(mockResponse.status).toHaveBeenCalledWith(200);
        });

        it('should return 400 if required fields are missing', async () => {
            mockRequest.body = {};
    
            await notificationController.sendLoanReminder(mockRequest as AuthenticatedRequest, mockResponse as Response);
    
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Chama ID, member name, phone number, and loan ID are required.' });
        });
    });
  });
});