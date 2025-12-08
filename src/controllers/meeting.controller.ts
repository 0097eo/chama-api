import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import * as meetingService from '../services/meeting.service';
import { isErrorWithMessage } from '../utils/error.utils';
import { MembershipRole, MeetingStatus } from '@prisma/client';

const prisma = new PrismaClient();
interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

export const scheduleMeeting = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { chamaId, title, agenda, location, scheduledFor } = req.body;
        const actorId = req.user?.id!;
        const logMeta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };

        const membership = await prisma.membership.findFirst({
            where: { userId: actorId, chamaId, role: { in: [MembershipRole.ADMIN, MembershipRole.SECRETARY]}}
        });
        if (!membership) return res.status(403).json({ message: "Permission Denied." });

        const data = { title, agenda, location, scheduledFor, chama: { connect: { id: chamaId } } };
        const meeting = await meetingService.scheduleMeeting(data, actorId, logMeta);
        res.status(201).json({ message: 'Meeting scheduled successfully.', data: meeting });
    } catch (error) {
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const updateMeeting = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const actorId = req.user?.id!;
        const logMeta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
        const updatedMeeting = await meetingService.updateMeeting(req.params.id, req.body, actorId, logMeta);
        res.status(200).json({ message: 'Meeting updated successfully.', data: updatedMeeting });
    } catch(error) {
        if(isErrorWithMessage(error)) return res.status(404).json({ message: error.message });
        res.status(500).json({ message: "An unexpected error occurred." });
    }
};

export const cancelMeeting = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const actorId = req.user?.id!;
        const logMeta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
        await meetingService.cancelMeeting(req.params.id, actorId, logMeta);
        res.status(200).json({ message: 'Meeting has been cancelled.' });
    } catch(error) {
        if(isErrorWithMessage(error)) return res.status(404).json({ message: error.message });
        res.status(500).json({ message: "An unexpected error occurred." });
    }
};

export const markAttendance = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const actorId = req.user?.id!;
        const logMeta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
        const attendance = await meetingService.markAttendance(req.params.id, actorId, logMeta);
        res.status(201).json({ message: 'Attendance marked successfully.', data: attendance });
    } catch (error) {
        if(isErrorWithMessage(error)) return res.status(409).json({ message: error.message });
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
};

export const saveMeetingMinutes = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const actorId = req.user?.id!;
        const logMeta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
        await meetingService.saveMeetingMinutes(req.params.id, req.body.minutes, actorId, logMeta);
        res.status(200).json({ message: 'Meeting minutes saved successfully.' });
    } catch(error) {
        if(isErrorWithMessage(error)) return res.status(404).json({ message: error.message });
        res.status(500).json({ message: "An unexpected error occurred." });
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

export const getAttendanceList = async (req: Request, res: Response) => {
    const attendance = await prisma.meetingAttendance.findMany({
        where: { meetingId: req.params.id },
        include: { membership: { include: { user: { select: { firstName: true, lastName: true }}}}}
    });
    res.status(200).json({ data: attendance });
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