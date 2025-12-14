import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import * as meetingService from '../services/meeting.service';
import { MeetingStatus } from '@prisma/client';
import logger from '../config/logger';

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

    logger.debug({ 
      actorId, 
      chamaId, 
      title, 
      scheduledFor 
    }, 'Scheduling new meeting');

    const data = { 
      title, 
      agenda, 
      location, 
      scheduledFor, 
      chama: { connect: { id: chamaId } } 
    };
    
    const meeting = await meetingService.scheduleMeeting(data, actorId, logMeta);
    
    logger.info({ 
      actorId, 
      meetingId: meeting.id, 
      chamaId, 
      scheduledFor: meeting.scheduledFor 
    }, 'Meeting scheduled successfully');
    
    res.status(201).json({ 
      message: 'Meeting scheduled successfully.', 
      data: meeting 
    });
  } catch (error) {
    logger.error({ 
      error, 
      actorId: req.user?.id, 
      chamaId: req.body.chamaId 
    }, 'Error scheduling meeting');
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
    const { id: meetingId } = req.params;
    const updateFields = Object.keys(req.body);
    const logMeta = { 
      ipAddress: req.ip, 
      userAgent: req.headers['user-agent'] 
    };

    logger.debug({ 
      actorId, 
      meetingId, 
      updateFields 
    }, 'Updating meeting');
    
    const updatedMeeting = await meetingService.updateMeeting(
      meetingId,
      req.body,
      actorId,
      logMeta
    );
    
    logger.info({ 
      actorId, 
      meetingId, 
      updateFields,
      chamaId: updatedMeeting.chamaId 
    }, 'Meeting updated successfully');
    
    res.status(200).json({ 
      message: 'Meeting updated successfully.', 
      data: updatedMeeting 
    });
  } catch (error) {
    logger.error({ 
      error, 
      actorId: req.user?.id, 
      meetingId: req.params.id,
      updateFields: Object.keys(req.body) 
    }, 'Error updating meeting');
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
    const { id: meetingId } = req.params;
    const logMeta = { 
      ipAddress: req.ip, 
      userAgent: req.headers['user-agent'] 
    };

    logger.debug({ actorId, meetingId }, 'Cancelling meeting');
    
    await meetingService.cancelMeeting(meetingId, actorId, logMeta);
    
    logger.info({ actorId, meetingId }, 'Meeting cancelled successfully');
    
    res.status(200).json({ 
      message: 'Meeting has been cancelled.' 
    });
  } catch (error) {
    logger.error({ 
      error, 
      actorId: req.user?.id, 
      meetingId: req.params.id 
    }, 'Error cancelling meeting');
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
    const { id: meetingId } = req.params;
    const logMeta = { 
      ipAddress: req.ip, 
      userAgent: req.headers['user-agent'] 
    };

    logger.debug({ actorId, meetingId }, 'Marking attendance');
    
    const attendance = await meetingService.markAttendance(
      meetingId,
      actorId,
      logMeta
    );
    
    logger.info({ 
      actorId, 
      meetingId, 
      attendanceId: attendance.id,
      membershipId: attendance.membershipId 
    }, 'Attendance marked successfully');
    
    res.status(201).json({ 
      message: 'Attendance marked successfully.', 
      data: attendance 
    });
  } catch (error) {
    logger.error({ 
      error, 
      actorId: req.user?.id, 
      meetingId: req.params.id 
    }, 'Error marking attendance');
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
    const { id: meetingId } = req.params;
    const { minutes } = req.body;
    const logMeta = { 
      ipAddress: req.ip, 
      userAgent: req.headers['user-agent'] 
    };

    logger.debug({ 
      actorId, 
      meetingId, 
      minutesLength: minutes?.length 
    }, 'Saving meeting minutes');
    
    await meetingService.saveMeetingMinutes(
      meetingId,
      minutes,
      actorId,
      logMeta
    );
    
    logger.info({ 
      actorId, 
      meetingId, 
      minutesLength: minutes?.length 
    }, 'Meeting minutes saved successfully');
    
    res.status(200).json({ 
      message: 'Meeting minutes saved successfully.' 
    });
  } catch (error) {
    logger.error({ 
      error, 
      actorId: req.user?.id, 
      meetingId: req.params.id 
    }, 'Error saving meeting minutes');
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
    const { chamaId } = req.params;

    logger.debug({ chamaId }, 'Fetching chama meetings');

    const meetings = await prisma.meeting.findMany({ 
      where: { chamaId }, 
      orderBy: { scheduledFor: 'desc' } 
    });
    
    logger.info({ 
      chamaId, 
      meetingsCount: meetings.length 
    }, 'Chama meetings retrieved successfully');
    
    res.status(200).json({ data: meetings });
  } catch (error) {
    logger.error({ 
      error, 
      chamaId: req.params.chamaId 
    }, 'Error fetching chama meetings');
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
    const { chamaId } = req.params;

    logger.debug({ chamaId }, 'Fetching upcoming meetings');

    const meetings = await prisma.meeting.findMany({ 
      where: { 
        chamaId, 
        status: MeetingStatus.SCHEDULED, 
        scheduledFor: { gte: new Date() } 
      }, 
      orderBy: { scheduledFor: 'asc' } 
    });
    
    logger.info({ 
      chamaId, 
      upcomingMeetingsCount: meetings.length 
    }, 'Upcoming meetings retrieved successfully');
    
    res.status(200).json({ data: meetings });
  } catch (error) {
    logger.error({ 
      error, 
      chamaId: req.params.chamaId 
    }, 'Error fetching upcoming meetings');
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
    const { id: meetingId } = req.params;

    logger.debug({ meetingId }, 'Fetching meeting details');

    const meeting = await prisma.meeting.findUnique({ 
      where: { id: meetingId } 
    });
    
    if (!meeting) {
      logger.warn({ meetingId }, 'Meeting not found');
      return res.status(404).json({ message: 'Meeting not found.' });
    }
    
    logger.info({ 
      meetingId, 
      chamaId: meeting.chamaId,
      status: meeting.status 
    }, 'Meeting details retrieved successfully');
    
    res.status(200).json({ data: meeting });
  } catch (error) {
    logger.error({ 
      error, 
      meetingId: req.params.id 
    }, 'Error fetching meeting details');
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
    const { id: meetingId } = req.params;

    logger.debug({ meetingId }, 'Fetching attendance list');

    const attendance = await prisma.meetingAttendance.findMany({
      where: { meetingId },
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
    
    logger.info({ 
      meetingId, 
      attendanceCount: attendance.length 
    }, 'Attendance list retrieved successfully');
    
    res.status(200).json({ data: attendance });
  } catch (error) {
    logger.error({ 
      error, 
      meetingId: req.params.id 
    }, 'Error fetching attendance list');
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
    const { id: meetingId } = req.params;

    logger.debug({ meetingId }, 'Generating attendance QR code');

    const qrCode = await meetingService.generateQrCode(meetingId);
    
    logger.info({ meetingId }, 'QR code generated successfully');
    
    res.status(200).json({ data: { qrCodeDataUrl: qrCode } });
  } catch (error) {
    logger.error({ 
      error, 
      meetingId: req.params.id 
    }, 'Error generating QR code');
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
    const { id: meetingId } = req.params;

    logger.debug({ meetingId }, 'Generating calendar file');

    const meeting = await prisma.meeting.findUnique({ 
      where: { id: meetingId } 
    });
    
    if (!meeting) {
      logger.warn({ meetingId }, 'Calendar file requested for non-existent meeting');
      return res.status(404).json({ message: 'Meeting not found.' });
    }
    
    const fileBuffer = await meetingService.generateIcsFile(meeting);
    
    logger.info({ 
      meetingId, 
      chamaId: meeting.chamaId,
      fileSize: fileBuffer.length 
    }, 'Calendar file generated successfully');
    
    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', `attachment; filename=meeting-${meeting.id}.ics`);
    res.status(200).send(fileBuffer);
  } catch (error) {
    logger.error({ 
      error, 
      meetingId: req.params.id 
    }, 'Error generating calendar file');
    next(error);
  }
};