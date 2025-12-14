import { PrismaClient } from '@prisma/client';
import { Meeting, Prisma, NotificationType, AuditAction, MeetingStatus } from '@prisma/client';
import qrcode from 'qrcode';
import * as ics from 'ics';
import { createBulkNotifications } from './notification.service';
import { createAuditLog } from './audit.service';
import logger from '../config/logger';


interface LogMeta {
    ipAddress?: string;
    userAgent?: string;
}


const prisma = new PrismaClient();

/**
 * Schedules a new meeting and handles related tasks.
 */
export const scheduleMeeting = async (data: Prisma.MeetingCreateInput, actorId: string, logMeta: LogMeta) => {
    const chamaId = data.chama?.connect?.id;
    if (!chamaId) throw new Error("Chama ID is required to schedule a meeting.");

    const meeting = await prisma.meeting.create({
        data: {
            title: data.title,
            agenda: data.agenda,
            location: data.location,
            scheduledFor: data.scheduledFor,
            chama: { connect: { id: chamaId } }
        }
    });

    logger.info({ 
        meetingId: meeting.id, 
        chamaId, 
        actorId, 
        title: meeting.title, 
        scheduledFor: meeting.scheduledFor 
    }, 'Meeting scheduled');

    await createBulkNotifications(
        meeting.chamaId,
        `New Meeting Scheduled: ${meeting.title}`,
        `A new meeting has been scheduled for ${new Date(meeting.scheduledFor).toLocaleString()}.`,
        NotificationType.MEETING_REMINDER
    );

    await createAuditLog({
        action: AuditAction.MEETING_SCHEDULE,
        actorId,
        chamaId,
        meetingId: meeting.id,
        newValue: meeting,
        ...logMeta,
    });

    return meeting;
};

/**
 * Marks a user's attendance for a specific meeting.
 * @param meetingId - The ID of the meeting.
 * @param userId - The ID of the user attending.
 * @returns The new attendance record.
 */
export const markAttendance = async (meetingId: string, userId: string, logMeta: LogMeta) => {
    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) {
        logger.warn({ meetingId, userId }, 'Meeting not found for attendance');
        throw new Error('Meeting not found.');
    }

    const membership = await prisma.membership.findFirst({
        where: { userId, chamaId: meeting.chamaId, isActive: true },
    });
    if (!membership) {
        logger.warn({ meetingId, userId, chamaId: meeting.chamaId }, 'User not an active member');
        throw new Error('You are not an active member of the chama this meeting belongs to.');
    }

    const existingAttendance = await prisma.meetingAttendance.findUnique({
        where: { meetingId_membershipId: { meetingId, membershipId: membership.id } }
    });
    if (existingAttendance) {
        logger.warn({ meetingId, membershipId: membership.id }, 'Attendance already marked');
        throw new Error('Attendance has already been marked for this member.');
    }

    const newAttendance = await prisma.meetingAttendance.create({
        data: {
            meetingId,
            membershipId: membership.id,
        },
    });

    logger.info({ 
        meetingId, 
        userId, 
        membershipId: membership.id, 
        attendanceId: newAttendance.id 
    }, 'Attendance marked');

    await createAuditLog({
        action: AuditAction.MEETING_ATTENDANCE_MARK,
        actorId: userId, // The user marking attendance is the actor
        targetId: userId, // They are also the target of the action
        chamaId: meeting.chamaId,
        meetingId,
        newValue: { attendanceId: newAttendance.id },
        ...logMeta,
    });

    return newAttendance;
};

export const updateMeeting = async (meetingId: string, data: Partial<Meeting>, actorId: string, logMeta: LogMeta) => {
    const oldValue = await prisma.meeting.findUnique({ where: { id: meetingId } });
    const updatedMeeting = await prisma.meeting.update({ where: { id: meetingId }, data });

    logger.info({ 
        meetingId, 
        actorId, 
        chamaId: updatedMeeting.chamaId, 
        updates: Object.keys(data) 
    }, 'Meeting updated');

    await createAuditLog({
        action: AuditAction.MEETING_UPDATE,
        actorId,
        chamaId: updatedMeeting.chamaId,
        meetingId,
        oldValue,
        newValue: updatedMeeting,
        ...logMeta,
    });
    
    return updatedMeeting;
};

export const saveMeetingMinutes = async (meetingId: string, minutes: string, actorId: string, logMeta: LogMeta) => {
    const oldValue = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!oldValue) {
        logger.warn({ meetingId }, 'Meeting not found for saving minutes');
        throw new Error("Meeting not found.");
    }

    // When minutes are saved, the meeting is marked as COMPLETED
    const updatedMeeting = await prisma.meeting.update({
        where: { id: meetingId },
        data: { minutes, status: MeetingStatus.COMPLETED }
    });

    logger.info({ 
        meetingId, 
        actorId, 
        chamaId: updatedMeeting.chamaId, 
        status: MeetingStatus.COMPLETED 
    }, 'Meeting minutes saved');

    await createAuditLog({
        action: AuditAction.MEETING_MINUTES_SAVE,
        actorId,
        chamaId: updatedMeeting.chamaId,
        meetingId,
        oldValue,
        newValue: updatedMeeting,
        ...logMeta,
    });

    return updatedMeeting;
};

export const cancelMeeting = async (meetingId: string, actorId: string, logMeta: LogMeta) => {
    const oldValue = await prisma.meeting.findUnique({ where: { id: meetingId } });
    const cancelledMeeting = await prisma.meeting.update({
        where: { id: meetingId },
        data: { status: MeetingStatus.CANCELLED },
    });
    
    logger.info({ 
        meetingId, 
        actorId, 
        chamaId: cancelledMeeting.chamaId 
    }, 'Meeting cancelled');

    await createAuditLog({
        action: AuditAction.MEETING_CANCEL,
        actorId,
        chamaId: cancelledMeeting.chamaId,
        meetingId,
        oldValue,
        newValue: cancelledMeeting,
        ...logMeta,
    });

    return cancelledMeeting;
};

/**
 * Generates a data URL for a QR code that contains the meeting ID.
 * This can be scanned by the frontend to call the mark attendance API.
 */
export const generateQrCode = async (meetingId: string): Promise<string> => {
    try {
        // The QR code will simply contain the meeting ID.
        // The frontend app will scan this, get the ID, and make an API call.
        const qrCodeDataUrl = await qrcode.toDataURL(meetingId);
        logger.debug({ meetingId }, 'QR code generated');
        return qrCodeDataUrl;
    } catch (err) {
        logger.error({ error: err, meetingId }, 'QR code generation error');
        throw new Error('Failed to generate QR code.');
    }
};

/**
 * Generates an iCalendar (.ics) file event as a Buffer.
 */
export const generateIcsFile = (meeting: Meeting): Promise<Buffer> => {
    const scheduledDate = new Date(meeting.scheduledFor);
    const event: ics.EventAttributes = {
        start: [
            scheduledDate.getFullYear(),
            scheduledDate.getMonth() + 1,
            scheduledDate.getDate(),
            scheduledDate.getHours(),
            scheduledDate.getMinutes()
        ],
        duration: { hours: 1 }, // Assume a 1-hour duration
        title: meeting.title,
        description: meeting.agenda,
        location: meeting.location,
        status: 'CONFIRMED',
    };

    return new Promise((resolve, reject) => {
        ics.createEvent(event, (error, value) => {
            if (error) {
                logger.error({ error, meetingId: meeting.id }, 'ICS generation error');
                return reject(new Error('Failed to create calendar event.'));
            }
            logger.debug({ meetingId: meeting.id, title: meeting.title }, 'ICS file generated');
            resolve(Buffer.from(value));
        });
    });
};