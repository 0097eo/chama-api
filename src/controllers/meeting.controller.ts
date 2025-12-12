import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import * as meetingService from '../services/meeting.service';
import { MeetingStatus } from '@prisma/client';

const prisma = new PrismaClient();

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

/**
 * Schedules a new meeting
 */
export const scheduleMeeting = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { chamaId, title, agenda, location, scheduledFor } = req.body;
    const actorId = req.user?.id!;
    const logMeta = { 
      ipAddress: req.ip, 
      userAgent: req.headers['user-agent'] 
    };

    const data = { 
      title, 
      agenda, 
      location, 
      scheduledFor, 
      chama: { connect: { id: chamaId } } 
    };
    
    const meeting = await meetingService.scheduleMeeting(data, actorId, logMeta);
    
    res.status(201).json({ 
      message: 'Meeting scheduled successfully.', 
      data: meeting 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Updates an existing meeting
 */
export const updateMeeting = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const actorId = req.user?.id!;
    const logMeta = { 
      ipAddress: req.ip, 
      userAgent: req.headers['user-agent'] 
    };
    
    const updatedMeeting = await meetingService.updateMeeting(
      req.params.id,
      req.body,
      actorId,
      logMeta
    );
    
    res.status(200).json({ 
      message: 'Meeting updated successfully.', 
      data: updatedMeeting 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancels a meeting
 */
export const cancelMeeting = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const actorId = req.user?.id!;
    const logMeta = { 
      ipAddress: req.ip, 
      userAgent: req.headers['user-agent'] 
    };
    
    await meetingService.cancelMeeting(req.params.id, actorId, logMeta);
    
    res.status(200).json({ 
      message: 'Meeting has been cancelled.' 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Marks attendance for the authenticated user
 * Any active member can mark their own attendance
 */
export const markAttendance = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const actorId = req.user?.id!;
    const logMeta = { 
      ipAddress: req.ip, 
      userAgent: req.headers['user-agent'] 
    };
    
    const attendance = await meetingService.markAttendance(
      req.params.id,
      actorId,
      logMeta
    );
    
    res.status(201).json({ 
      message: 'Attendance marked successfully.', 
      data: attendance 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Saves meeting minutes
 */
export const saveMeetingMinutes = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const actorId = req.user?.id!;
    const logMeta = { 
      ipAddress: req.ip, 
      userAgent: req.headers['user-agent'] 
    };
    
    await meetingService.saveMeetingMinutes(
      req.params.id,
      req.body.minutes,
      actorId,
      logMeta
    );
    
    res.status(200).json({ 
      message: 'Meeting minutes saved successfully.' 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Gets all meetings for a chama
 */
export const getChamaMeetings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const meetings = await prisma.meeting.findMany({ 
      where: { chamaId: req.params.chamaId }, 
      orderBy: { scheduledFor: 'desc' } 
    });
    
    res.status(200).json({ data: meetings });
  } catch (error) {
    next(error);
  }
};

/**
 * Gets upcoming meetings for a chama
 */
export const getUpcomingMeetings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const meetings = await prisma.meeting.findMany({ 
      where: { 
        chamaId: req.params.chamaId, 
        status: MeetingStatus.SCHEDULED, 
        scheduledFor: { gte: new Date() } 
      }, 
      orderBy: { scheduledFor: 'asc' } 
    });
    
    res.status(200).json({ data: meetings });
  } catch (error) {
    next(error);
  }
};

/**
 * Gets details of a specific meeting
 */
export const getMeetingDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const meeting = await prisma.meeting.findUnique({ 
      where: { id: req.params.id } 
    });
    
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found.' });
    }
    
    res.status(200).json({ data: meeting });
  } catch (error) {
    next(error);
  }
};

/**
 * Gets attendance list for a meeting
 */
export const getAttendanceList = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const attendance = await prisma.meetingAttendance.findMany({
      where: { meetingId: req.params.id },
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
    
    res.status(200).json({ data: attendance });
  } catch (error) {
    next(error);
  }
};

/**
 * Generates QR code for attendance marking
 */
export const generateAttendanceQrCode = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const qrCode = await meetingService.generateQrCode(req.params.id);
    
    res.status(200).json({ data: { qrCodeDataUrl: qrCode } });
  } catch (error) {
    next(error);
  }
};

/**
 * Generates calendar file (.ics) for a meeting
 * Any authenticated user can download calendar files
 */
export const generateCalendarFile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const meeting = await prisma.meeting.findUnique({ 
      where: { id: req.params.id } 
    });
    
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found.' });
    }
    
    const fileBuffer = await meetingService.generateIcsFile(meeting);
    
    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', `attachment; filename=meeting-${meeting.id}.ics`);
    res.status(200).send(fileBuffer);
  } catch (error) {
    next(error);
  }
};