import { PrismaClient } from '../generated/prisma/client';
import { Meeting, Prisma, NotificationType, AuditAction, MeetingStatus } from '../generated/prisma/client';
import qrcode from 'qrcode';
import * as ics from 'ics';
import { createBulkNotifications } from './notification.service';
import { createAuditLog } from './audit.service';


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
    if (!meeting) throw new Error('Meeting not found.');

    const membership = await prisma.membership.findFirst({
        where: { userId, chamaId: meeting.chamaId, isActive: true },
    });
    if (!membership) throw new Error('You are not an active member of the chama this meeting belongs to.');

    const existingAttendance = await prisma.meetingAttendance.findUnique({
        where: { meetingId_membershipId: { meetingId, membershipId: membership.id } }
    });
    if (existingAttendance) throw new Error('Attendance has already been marked for this member.');

    const newAttendance = await prisma.meetingAttendance.create({
        data: {
            meetingId,
            membershipId: membership.id,
        },
    });

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
    if (!oldValue) throw new Error("Meeting not found.");

    // When minutes are saved, the meeting is marked as COMPLETED
    const updatedMeeting = await prisma.meeting.update({
        where: { id: meetingId },
        data: { minutes, status: MeetingStatus.COMPLETED }
    });

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
        return qrCodeDataUrl;
    } catch (err) {
        console.error('QR Code Generation Error:', err);
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
                console.error('ICS Generation Error:', error);
                return reject(new Error('Failed to create calendar event.'));
            }
            resolve(Buffer.from(value));
        });
    });
};