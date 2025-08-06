import { PrismaClient } from '../generated/prisma/client';
import { Meeting, Prisma, MeetingStatus } from '../generated/prisma/client';
import qrcode from 'qrcode';
import * as ics from 'ics';

const prisma = new PrismaClient();

/**
 * Schedules a new meeting and handles related tasks.
 */
export const scheduleMeeting = async (data: Prisma.MeetingCreateInput) => {
    const meeting = await prisma.meeting.create({ data });

    // TODO send SMS/email notifications to all members of the chama.
    // e.g., NotificationService.sendMeetingScheduledAlert(meeting.chamaId, meeting.id);

    return meeting;
};

/**
 * Marks a user's attendance for a specific meeting.
 * @param meetingId - The ID of the meeting.
 * @param userId - The ID of the user attending.
 * @returns The new attendance record.
 */
export const markAttendance = async (meetingId: string, userId: string) => {
    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new Error('Meeting not found.');

    const membership = await prisma.membership.findFirst({
        where: { userId, chamaId: meeting.chamaId, isActive: true },
    });
    if (!membership) throw new Error('You are not an active member of the chama this meeting belongs to.');

    // Prevent duplicate attendance records
    const existingAttendance = await prisma.meetingAttendance.findUnique({
        where: { meetingId_membershipId: { meetingId, membershipId: membership.id } }
    });
    if (existingAttendance) throw new Error('Attendance has already been marked for this member.');

    return prisma.meetingAttendance.create({
        data: {
            meetingId,
            membershipId: membership.id,
        },
    });
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