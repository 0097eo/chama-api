import { Request, Response, NextFunction } from 'express';

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

// Create mock Prisma instance that will be reused
const mockPrismaInstance = {
  meeting: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  meetingAttendance: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  membership: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  notification: {
    create: jest.fn(),
  },
  $transaction: jest.fn((operations) => Promise.all(operations)),
};

// Mock Africa's Talking 
jest.mock('africastalking', () => {
  return jest.fn(() => ({
    SMS: {
      send: jest.fn().mockResolvedValue({ status: 'success' }),
    },
  }));
});

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  })),
}));

// Mock WebSocket Server
jest.mock('../src/websocket.server', () => ({
  WebSocketServer: {
    getInstance: jest.fn(() => ({
      sendToUser: jest.fn(),
      sendToChama: jest.fn(),
    })),
  },
}));

// Mock Prisma - return the same instance every time
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaInstance),
  MeetingStatus: {
    SCHEDULED: 'SCHEDULED',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
  },
  MembershipRole: {
    ADMIN: 'ADMIN',
    TREASURER: 'TREASURER',
    SECRETARY: 'SECRETARY',
    MEMBER: 'MEMBER',
  },
}));

// Mock the service module
jest.mock('../src/services/meeting.service', () => ({
  scheduleMeeting: jest.fn(),
  updateMeeting: jest.fn(),
  cancelMeeting: jest.fn(),
  markAttendance: jest.fn(),
  saveMeetingMinutes: jest.fn(),
  generateQrCode: jest.fn(),
  generateIcsFile: jest.fn(),
}));

// Mock audit service
jest.mock('../src/services/audit.service', () => ({
  createAuditLog: jest.fn().mockResolvedValue({}),
}));

// Mock qrcode
jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mock'),
}));

// Mock ics
jest.mock('ics', () => ({
  createEvent: jest.fn((event, callback) => {
    callback(null, 'BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR');
  }),
}));

// Mock error utils
jest.mock('../src/utils/error.utils', () => ({
  isErrorWithMessage: jest.fn((error: any) => error && error.message),
  isPrismaError: jest.fn(),
}));

import * as meetingController from '../src/controllers/meeting.controller';
import * as meetingService from '../src/services/meeting.service';
import { MeetingStatus } from '@prisma/client';

describe('Meeting Module Tests', () => {
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

  describe('Meeting Controller Unit Tests', () => {
    describe('scheduleMeeting', () => {
      it('should create a meeting and return 201', async () => {
        const mockMeeting = {
          id: 'meeting1',
          title: 'Monthly Meeting',
          agenda: 'Discuss finances',
          location: 'Office',
          scheduledFor: new Date('2024-12-20T10:00:00Z'),
          chamaId: 'chama1',
          status: 'SCHEDULED',
          minutes: null,
        };

        mockRequest.body = {
          chamaId: 'chama1',
          title: 'Monthly Meeting',
          agenda: 'Discuss finances',
          location: 'Office',
          scheduledFor: new Date('2024-12-20T10:00:00Z'),
        };

        (meetingService.scheduleMeeting as jest.Mock).mockResolvedValue(mockMeeting);

        await meetingController.scheduleMeeting(
          mockRequest as AuthenticatedRequest,
          mockResponse as Response,
          mockNext
        );

        expect(meetingService.scheduleMeeting).toHaveBeenCalledWith(
          {
            title: 'Monthly Meeting',
            agenda: 'Discuss finances',
            location: 'Office',
            scheduledFor: mockRequest.body.scheduledFor,
            chama: { connect: { id: 'chama1' } },
          },
          'cluser123',
          { ipAddress: '127.0.0.1', userAgent: 'jest-test' }
        );
        expect(mockResponse.status).toHaveBeenCalledWith(201);
        expect(mockResponse.json).toHaveBeenCalledWith({
          message: 'Meeting scheduled successfully.',
          data: mockMeeting,
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should call next with error if service throws', async () => {
        mockRequest.body = {
          chamaId: 'chama1',
          title: 'Test Meeting',
          agenda: 'Test',
          location: 'Office',
          scheduledFor: new Date(),
        };

        const error = new Error('Chama ID is required');
        (meetingService.scheduleMeeting as jest.Mock).mockRejectedValue(error);

        await meetingController.scheduleMeeting(
          mockRequest as AuthenticatedRequest,
          mockResponse as Response,
          mockNext
        );

        expect(mockNext).toHaveBeenCalledWith(error);
        expect(mockResponse.status).not.toHaveBeenCalled();
      });
    });

    describe('updateMeeting', () => {
      it('should update a meeting and return 200', async () => {
        const mockUpdatedMeeting = {
          id: 'meeting1',
          title: 'Updated Title',
          agenda: 'Updated agenda',
          location: 'New Location',
          scheduledFor: new Date(),
          chamaId: 'chama1',
          status: 'SCHEDULED',
          minutes: null,
        };

        mockRequest.params = { id: 'meeting1' };
        mockRequest.body = { title: 'Updated Title' };

        (meetingService.updateMeeting as jest.Mock).mockResolvedValue(mockUpdatedMeeting);

        await meetingController.updateMeeting(
          mockRequest as AuthenticatedRequest,
          mockResponse as Response,
          mockNext
        );

        expect(meetingService.updateMeeting).toHaveBeenCalledWith(
          'meeting1',
          { title: 'Updated Title' },
          'cluser123',
          { ipAddress: '127.0.0.1', userAgent: 'jest-test' }
        );
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          message: 'Meeting updated successfully.',
          data: mockUpdatedMeeting,
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should call next with error if meeting not found', async () => {
        mockRequest.params = { id: 'nonexistent' };
        mockRequest.body = { title: 'Test' };

        const error = new Error('Meeting not found');
        (meetingService.updateMeeting as jest.Mock).mockRejectedValue(error);

        await meetingController.updateMeeting(
          mockRequest as AuthenticatedRequest,
          mockResponse as Response,
          mockNext
        );

        expect(mockNext).toHaveBeenCalledWith(error);
        expect(mockResponse.status).not.toHaveBeenCalled();
      });
    });

    describe('cancelMeeting', () => {
      it('should cancel a meeting and return 200', async () => {
        mockRequest.params = { id: 'meeting1' };

        const cancelledMeeting = {
          id: 'meeting1',
          status: 'CANCELLED',
        };

        (meetingService.cancelMeeting as jest.Mock).mockResolvedValue(cancelledMeeting);

        await meetingController.cancelMeeting(
          mockRequest as AuthenticatedRequest,
          mockResponse as Response,
          mockNext
        );

        expect(meetingService.cancelMeeting).toHaveBeenCalledWith(
          'meeting1',
          'cluser123',
          { ipAddress: '127.0.0.1', userAgent: 'jest-test' }
        );
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          message: 'Meeting has been cancelled.',
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should call next with error if cancellation fails', async () => {
        mockRequest.params = { id: 'meeting1' };

        const error = new Error('Meeting not found');
        (meetingService.cancelMeeting as jest.Mock).mockRejectedValue(error);

        await meetingController.cancelMeeting(
          mockRequest as AuthenticatedRequest,
          mockResponse as Response,
          mockNext
        );

        expect(mockNext).toHaveBeenCalledWith(error);
        expect(mockResponse.status).not.toHaveBeenCalled();
      });
    });

    describe('markAttendance', () => {
      it('should mark attendance and return 201', async () => {
        const mockAttendance = {
          id: 'attendance1',
          meetingId: 'meeting1',
          membershipId: 'membership1',
          attendedAt: new Date(),
        };

        mockRequest.params = { id: 'meeting1' };

        (meetingService.markAttendance as jest.Mock).mockResolvedValue(mockAttendance);

        await meetingController.markAttendance(
          mockRequest as AuthenticatedRequest,
          mockResponse as Response,
          mockNext
        );

        expect(meetingService.markAttendance).toHaveBeenCalledWith(
          'meeting1',
          'cluser123',
          { ipAddress: '127.0.0.1', userAgent: 'jest-test' }
        );
        expect(mockResponse.status).toHaveBeenCalledWith(201);
        expect(mockResponse.json).toHaveBeenCalledWith({
          message: 'Attendance marked successfully.',
          data: mockAttendance,
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should call next with error if already marked', async () => {
        mockRequest.params = { id: 'meeting1' };

        const error = new Error('Attendance has already been marked for this member.');
        (meetingService.markAttendance as jest.Mock).mockRejectedValue(error);

        await meetingController.markAttendance(
          mockRequest as AuthenticatedRequest,
          mockResponse as Response,
          mockNext
        );

        expect(mockNext).toHaveBeenCalledWith(error);
        expect(mockResponse.status).not.toHaveBeenCalled();
      });
    });

    describe('saveMeetingMinutes', () => {
      it('should save minutes and return 200', async () => {
        mockRequest.params = { id: 'meeting1' };
        mockRequest.body = { minutes: 'Test minutes' };

        const updatedMeeting = {
          id: 'meeting1',
          minutes: 'Test minutes',
          status: 'COMPLETED',
        };

        (meetingService.saveMeetingMinutes as jest.Mock).mockResolvedValue(updatedMeeting);

        await meetingController.saveMeetingMinutes(
          mockRequest as AuthenticatedRequest,
          mockResponse as Response,
          mockNext
        );

        expect(meetingService.saveMeetingMinutes).toHaveBeenCalledWith(
          'meeting1',
          'Test minutes',
          'cluser123',
          { ipAddress: '127.0.0.1', userAgent: 'jest-test' }
        );
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          message: 'Meeting minutes saved successfully.',
        });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should call next with error if meeting not found', async () => {
        mockRequest.params = { id: 'nonexistent' };
        mockRequest.body = { minutes: 'Test' };

        const error = new Error('Meeting not found.');
        (meetingService.saveMeetingMinutes as jest.Mock).mockRejectedValue(error);

        await meetingController.saveMeetingMinutes(
          mockRequest as AuthenticatedRequest,
          mockResponse as Response,
          mockNext
        );

        expect(mockNext).toHaveBeenCalledWith(error);
        expect(mockResponse.status).not.toHaveBeenCalled();
      });
    });

    describe('getChamaMeetings', () => {
      it('should return all meetings for a chama', async () => {
        const mockMeetings = [
          { id: 'meeting1', title: 'Meeting 1', chamaId: 'chama1', scheduledFor: new Date() },
          { id: 'meeting2', title: 'Meeting 2', chamaId: 'chama1', scheduledFor: new Date() },
        ];

        mockRequest.params = { chamaId: 'chama1' };
        mockPrismaInstance.meeting.findMany.mockResolvedValue(mockMeetings);

        await meetingController.getChamaMeetings(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockPrismaInstance.meeting.findMany).toHaveBeenCalledWith({
          where: { chamaId: 'chama1' },
          orderBy: { scheduledFor: 'desc' },
        });
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({ data: mockMeetings });
        expect(mockNext).not.toHaveBeenCalled();
      });

      it('should call next with error if query fails', async () => {
        mockRequest.params = { chamaId: 'chama1' };
        
        const error = new Error('Database error');
        mockPrismaInstance.meeting.findMany.mockRejectedValue(error);

        await meetingController.getChamaMeetings(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockNext).toHaveBeenCalledWith(error);
        expect(mockResponse.json).not.toHaveBeenCalled();
      });
    });

    describe('getUpcomingMeetings', () => {
      it('should return upcoming scheduled meetings', async () => {
        const futureDate = new Date(Date.now() + 86400000);
        const mockMeetings = [
          { id: 'meeting1', title: 'Upcoming Meeting', chamaId: 'chama1', scheduledFor: futureDate, status: 'SCHEDULED' },
        ];

        mockRequest.params = { chamaId: 'chama1' };
        mockPrismaInstance.meeting.findMany.mockResolvedValue(mockMeetings);

        await meetingController.getUpcomingMeetings(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockPrismaInstance.meeting.findMany).toHaveBeenCalledWith({
          where: { 
            chamaId: 'chama1',
            status: MeetingStatus.SCHEDULED,
            scheduledFor: { gte: expect.any(Date) }
          },
          orderBy: { scheduledFor: 'asc' },
        });
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({ data: mockMeetings });
      });
    });

    describe('getMeetingDetails', () => {
      it('should return meeting details', async () => {
        const mockMeeting = { 
          id: 'meeting1', 
          title: 'Test Meeting',
          agenda: 'Test agenda',
          location: 'Office',
          scheduledFor: new Date(),
          chamaId: 'chama1',
        };

        mockRequest.params = { id: 'meeting1' };
        mockPrismaInstance.meeting.findUnique.mockResolvedValue(mockMeeting);

        await meetingController.getMeetingDetails(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockPrismaInstance.meeting.findUnique).toHaveBeenCalledWith({
          where: { id: 'meeting1' },
        });
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({ data: mockMeeting });
      });

      it('should return 404 if meeting not found', async () => {
        mockRequest.params = { id: 'nonexistent' };
        mockPrismaInstance.meeting.findUnique.mockResolvedValue(null);

        await meetingController.getMeetingDetails(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({
          message: 'Meeting not found.',
        });
      });
    });

    describe('getAttendanceList', () => {
      it('should return attendance list with user details', async () => {
        const mockAttendance = [
          {
            id: 'att1',
            meetingId: 'meeting1',
            membershipId: 'mem1',
            attendedAt: new Date(),
            membership: {
              id: 'mem1',
              user: { firstName: 'John', lastName: 'Doe' }
            }
          }
        ];

        mockRequest.params = { id: 'meeting1' };
        mockPrismaInstance.meetingAttendance.findMany.mockResolvedValue(mockAttendance);

        await meetingController.getAttendanceList(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockPrismaInstance.meetingAttendance.findMany).toHaveBeenCalledWith({
          where: { meetingId: 'meeting1' },
          include: {
            membership: {
              include: {
                user: {
                  select: { firstName: true, lastName: true }
                }
              }
            }
          }
        });
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({ data: mockAttendance });
      });
    });

    describe('generateAttendanceQrCode', () => {
      it('should generate QR code successfully', async () => {
        const mockQrCode = 'data:image/png;base64,mockQrCodeData';

        mockRequest.params = { id: 'meeting1' };
        (meetingService.generateQrCode as jest.Mock).mockResolvedValue(mockQrCode);

        await meetingController.generateAttendanceQrCode(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(meetingService.generateQrCode).toHaveBeenCalledWith('meeting1');
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          data: { qrCodeDataUrl: mockQrCode },
        });
      });

      it('should call next with error if QR generation fails', async () => {
        mockRequest.params = { id: 'meeting1' };

        const error = new Error('Failed to generate QR code');
        (meetingService.generateQrCode as jest.Mock).mockRejectedValue(error);

        await meetingController.generateAttendanceQrCode(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockNext).toHaveBeenCalledWith(error);
        expect(mockResponse.json).not.toHaveBeenCalled();
      });
    });

    describe('generateCalendarFile', () => {
      it('should generate calendar file successfully', async () => {
        const mockMeeting = {
          id: 'meeting1',
          title: 'Test Meeting',
          agenda: 'Discuss topics',
          location: 'Office',
          scheduledFor: new Date('2024-12-20T10:00:00Z'),
          chamaId: 'chama1',
        };

        const mockBuffer = Buffer.from('BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR');

        mockRequest.params = { id: 'meeting1' };
        mockPrismaInstance.meeting.findUnique.mockResolvedValue(mockMeeting);
        (meetingService.generateIcsFile as jest.Mock).mockResolvedValue(mockBuffer);

        await meetingController.generateCalendarFile(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockPrismaInstance.meeting.findUnique).toHaveBeenCalledWith({
          where: { id: 'meeting1' },
        });
        expect(meetingService.generateIcsFile).toHaveBeenCalledWith(mockMeeting);
        expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'text/calendar');
        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          'Content-Disposition',
          'attachment; filename=meeting-meeting1.ics'
        );
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.send).toHaveBeenCalledWith(mockBuffer);
      });

      it('should return 404 if meeting not found', async () => {
        mockRequest.params = { id: 'nonexistent' };
        mockPrismaInstance.meeting.findUnique.mockResolvedValue(null);

        await meetingController.generateCalendarFile(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(mockResponse.status).toHaveBeenCalledWith(404);
        expect(mockResponse.json).toHaveBeenCalledWith({
          message: 'Meeting not found.',
        });
      });
    });
  });
});