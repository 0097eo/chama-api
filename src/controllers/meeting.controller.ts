import { Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma/client';
import * as meetingService from '../services/meeting.service';
import { isErrorWithMessage } from '../utils/error.utils';
import { MembershipRole, MeetingStatus } from '../generated/prisma/client';

const prisma = new PrismaClient();

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

export const scheduleMeeting = async (req: AuthenticatedRequest, res: Response) => {
    // Permission for this must be checked in the controller since we get chamaId from the body
    try {
        const { chamaId } = req.body;
        const actorId = req.user?.id!;
        const membership = await prisma.membership.findFirst({
            where: { userId: actorId, chamaId, role: { in: [MembershipRole.ADMIN, MembershipRole.SECRETARY]}}
        });
        if (!membership) return res.status(403).json({ message: "Permission Denied." });

        const meeting = await meetingService.scheduleMeeting(req.body);
        res.status(201).json({ message: 'Meeting scheduled successfully.', data: meeting });
    } catch (error) {
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const getChamaMeetings = async (req: Request, res: Response) => {
    const meetings = await prisma.meeting.findMany({ where: { chamaId: req.params.chamaId }, orderBy: { scheduledFor: 'desc' } });
    res.status(200).json({ data: meetings });
};

export const getUpcomingMeetings = async (req: Request, res: Response) => {
    const meetings = await prisma.meeting.findMany({ where: { chamaId: req.params.chamaId, status: MeetingStatus.SCHEDULED, scheduledFor: { gte: new Date() } }, orderBy: { scheduledFor: 'asc' } });
    res.status(200).json({ data: meetings });
};

export const getMeetingDetails = async (req: Request, res: Response) => {
    const meeting = await prisma.meeting.findUnique({ where: { id: req.params.id } });
    if (!meeting) return res.status(404).json({ message: 'Meeting not found.' });
    res.status(200).json({ data: meeting });
};

export const updateMeeting = async (req: Request, res: Response) => {
    const updatedMeeting = await prisma.meeting.update({ where: { id: req.params.id }, data: req.body });
    res.status(200).json({ message: 'Meeting updated successfully.', data: updatedMeeting });
};

export const cancelMeeting = async (req: Request, res: Response) => {
    await prisma.meeting.update({ where: { id: req.params.id }, data: { status: MeetingStatus.CANCELLED } });
    res.status(200).json({ message: 'Meeting has been cancelled.' });
};

export const markAttendance = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const attendance = await meetingService.markAttendance(req.params.id, req.user?.id!);
        res.status(201).json({ message: 'Attendance marked successfully.', data: attendance });
    } catch (error) {
        if(isErrorWithMessage(error)) return res.status(409).json({ message: error.message });
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const getAttendanceList = async (req: Request, res: Response) => {
    const attendance = await prisma.meetingAttendance.findMany({
        where: { meetingId: req.params.id },
        include: { membership: { include: { user: { select: { firstName: true, lastName: true }}}}}
    });
    res.status(200).json({ data: attendance });
};

export const saveMeetingMinutes = async (req: Request, res: Response) => {
    await prisma.meeting.update({
        where: { id: req.params.id },
        data: { minutes: req.body.minutes, status: MeetingStatus.COMPLETED }
    });
    res.status(200).json({ message: 'Meeting minutes saved successfully.' });
};

export const generateAttendanceQrCode = async (req: Request, res: Response) => {
    try {
        const qrCode = await meetingService.generateQrCode(req.params.id);
        res.status(200).json({ data: { qrCodeDataUrl: qrCode } });
    } catch (error) {
        if(isErrorWithMessage(error)) return res.status(500).json({ message: error.message });
    }
};

export const generateCalendarFile = async (req: Request, res: Response) => {
    try {
        const meeting = await prisma.meeting.findUnique({ where: { id: req.params.id }});
        if (!meeting) return res.status(404).json({ message: 'Meeting not found.' });

        const fileBuffer = await meetingService.generateIcsFile(meeting);
        res.setHeader('Content-Type', 'text/calendar');
        res.setHeader('Content-Disposition', `attachment; filename=meeting-${meeting.id}.ics`);
        res.status(200).send(fileBuffer);
    } catch (error) {
        if(isErrorWithMessage(error)) return res.status(500).json({ message: error.message });
    }
};