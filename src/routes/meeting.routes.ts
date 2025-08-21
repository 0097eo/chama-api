import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { checkMembership } from '../middleware/membership.middleware';
import { checkMeetingPermission } from '../middleware/permission.middleware';
import * as meetingController from '../controllers/meeting.controller';
import * as meetingValidator from '../validators/meeting.validators';
import { MembershipRole } from '../generated/prisma/client';

const router = Router();
router.use(protect);

const adminRoles = [MembershipRole.ADMIN, MembershipRole.SECRETARY];
const allMembers = Object.values(MembershipRole);

// POST /api/meetings - Schedule a new meeting for a chama
router.post(
    '/',
    meetingValidator.scheduleMeetingValidator,
    meetingController.scheduleMeeting
);

// GET /api/meetings/chama/:chamaId - Get all meetings for a chama
router.get(
    '/chama/:chamaId',
    checkMembership(allMembers),
    meetingController.getChamaMeetings
);

// GET /api/meetings/upcoming/:chamaId - Get upcoming meetings for a chama
router.get(
    '/upcoming/:chamaId',
    checkMembership(allMembers),
    meetingController.getUpcomingMeetings
);

// GET /api/meetings/:id - Get details for a single meeting
router.get(
    '/:id',
    checkMeetingPermission(allMembers),
    meetingController.getMeetingDetails
);

// PUT /api/meetings/:id - Update meeting info (only Admin/Secretary)
router.put(
    '/:id',
    checkMeetingPermission(adminRoles),
    meetingValidator.updateMeetingValidator,
    meetingController.updateMeeting
);

// DELETE /api/meetings/:id - Cancel a meeting (only Admin/Secretary)
router.delete(
    '/:id',
    checkMeetingPermission(adminRoles),
    meetingController.cancelMeeting
);

// POST /api/meetings/:id/attendance - Any member can mark their own attendance
router.post(
    '/:id/attendance',
    checkMeetingPermission(allMembers),
    meetingController.markAttendance
);

// GET /api/meetings/:id/attendance - Any member can view who attended
router.get(
    '/:id/attendance',
    checkMeetingPermission(allMembers),
    meetingController.getAttendanceList
);

// POST /api/meetings/:id/minutes - Only Admin/Secretary can save meeting minutes
router.post(
    '/:id/minutes',
    checkMeetingPermission(adminRoles),
    meetingValidator.saveMinutesValidator,
    meetingController.saveMeetingMinutes
);

// GET /api/meetings/:id/qr-code - Generate a QR code for attendance
router.get(
    '/:id/qr-code',
    checkMeetingPermission(allMembers),
    meetingController.generateAttendanceQrCode
);

// GET /api/meetings/:id/calendar - Generate an .ics file for calendar integration
router.get(
    '/:id/calendar',
    checkMeetingPermission(allMembers),
    meetingController.generateCalendarFile
);

export default router;