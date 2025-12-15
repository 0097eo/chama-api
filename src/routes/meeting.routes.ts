import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { checkMembership } from '../middleware/membership.middleware';
import { checkMeetingPermission } from '../middleware/permission.middleware';
import * as meetingController from '../controllers/meeting.controller';
import * as meetingValidator from '../validators/meeting.validators';
import { MembershipRole } from '@prisma/client';

const router = Router();
router.use(protect);

const adminRoles = [MembershipRole.ADMIN, MembershipRole.SECRETARY];
const allMembers = Object.values(MembershipRole);

/**
 * @swagger
 * /meetings:
 *   post:
 *     tags: [Meetings]
 *     summary: Schedule a new meeting
 *     description: Creates a new meeting for a chama. Admin/Secretary only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chamaId
 *               - title
 *               - scheduledFor
 *               - location
 *             properties:
 *               chamaId:
 *                 type: string
 *                 example: cmdjw3rr50002cuhv9312yj79
 *               title:
 *                 type: string
 *                 example: Monthly General Meeting
 *               agenda:
 *                 type: string
 *                 example: Regular monthly meeting to discuss contributions and loan applications
 *               scheduledFor:
 *                 type: string
 *                 format: date-time
 *                 example: 2025-02-15T14:00:00Z
 *               location:
 *                 type: string
 *                 example: Community Hall, Main Street
 *     responses:
 *       201:
 *         description: Meeting scheduled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Meeting scheduled successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: cmdjw3rr50002cuhv9312yj79
 *                     title:
 *                       type: string
 *                     scheduledFor:
 *                       type: string
 *                       format: date-time
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin or Secretary access required
 */
router.post(
    '/',
    meetingValidator.scheduleMeetingValidator,
    meetingController.scheduleMeeting
);

/**
 * @swagger
 * /meetings/chama/{chamaId}:
 *   get:
 *     tags: [Meetings]
 *     summary: Get chama meetings
 *     description: Returns all meetings for a specific chama with filtering options
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chamaId
 *         required: true
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [SCHEDULED, COMPLETED, CANCELLED]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Meetings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: cmdjw3rr50002cuhv9312yj79
 *                       title:
 *                         type: string
 *                       scheduledFor:
 *                         type: string
 *                         format: date-time
 *                       location:
 *                         type: string
 *                       status:
 *                         type: string
 *                       attendanceCount:
 *                         type: integer
 *                 pagination:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Not a member of this chama
 */
router.get(
    '/chama/:chamaId',
    checkMembership(allMembers),
    meetingController.getChamaMeetings
);

/**
 * @swagger
 * /meetings/upcoming/{chamaId}:
 *   get:
 *     tags: [Meetings]
 *     summary: Get upcoming meetings
 *     description: Returns all upcoming scheduled meetings for a chama
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chamaId
 *         required: true
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *     responses:
 *       200:
 *         description: Upcoming meetings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Not a member of this chama
 */
router.get(
    '/upcoming/:chamaId',
    checkMembership(allMembers),
    meetingController.getUpcomingMeetings
);

/**
 * @swagger
 * /meetings/{id}:
 *   get:
 *     tags: [Meetings]
 *     summary: Get meeting details
 *     description: Returns detailed information about a specific meeting
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *     responses:
 *       200:
 *         description: Meeting details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: cmdjw3rr50002cuhv9312yj79
 *                     title:
 *                       type: string
 *                     agenda:
 *                       type: string
 *                     scheduledFor:
 *                       type: string
 *                       format: date-time
 *                     location:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [SCHEDULED, COMPLETED, CANCELLED]
 *                     minutes:
 *                       type: string
 *                     attendees:
 *                       type: array
 *                       items:
 *                         type: object
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Not a member of this chama
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
    '/:id',
    checkMeetingPermission(allMembers),
    meetingController.getMeetingDetails
);

/**
 * @swagger
 * /meetings/{id}:
 *   put:
 *     tags: [Meetings]
 *     summary: Update meeting
 *     description: Updates meeting information. Admin/Secretary only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               agenda:
 *                 type: string
 *               scheduledFor:
 *                 type: string
 *                 format: date-time
 *               location:
 *                 type: string
 *     responses:
 *       200:
 *         description: Meeting updated successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin or Secretary access required
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put(
    '/:id',
    checkMeetingPermission(adminRoles),
    meetingValidator.updateMeetingValidator,
    meetingController.updateMeeting
);

/**
 * @swagger
 * /meetings/{id}:
 *   delete:
 *     tags: [Meetings]
 *     summary: Cancel meeting
 *     description: Cancels a scheduled meeting. Admin/Secretary only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *     responses:
 *       200:
 *         description: Meeting cancelled successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin or Secretary access required
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete(
    '/:id',
    checkMeetingPermission(adminRoles),
    meetingController.cancelMeeting
);

/**
 * @swagger
 * /meetings/{id}/attendance:
 *   post:
 *     tags: [Meetings]
 *     summary: Mark attendance
 *     description: Records attendance for a meeting. Members can mark their own attendance.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *     responses:
 *       201:
 *         description: Attendance marked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Attendance marked successfully
 *       400:
 *         description: Meeting hasn't started or already attended
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post(
    '/:id/attendance',
    checkMeetingPermission(allMembers),
    meetingController.markAttendance
);

/**
 * @swagger
 * /meetings/{id}/attendance:
 *   get:
 *     tags: [Meetings]
 *     summary: Get attendance list
 *     description: Returns list of attendees for a meeting
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *     responses:
 *       200:
 *         description: Attendance list retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalMembers:
 *                       type: integer
 *                     attendeesCount:
 *                       type: integer
 *                     attendanceRate:
 *                       type: number
 *                       example: 85.5
 *                     attendees:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           memberName:
 *                             type: string
 *                           markedAt:
 *                             type: string
 *                             format: date-time
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
    '/:id/attendance',
    checkMeetingPermission(allMembers),
    meetingController.getAttendanceList
);

/**
 * @swagger
 * /meetings/{id}/minutes:
 *   post:
 *     tags: [Meetings]
 *     summary: Save meeting minutes
 *     description: Records the official minutes for a meeting. Admin/Secretary only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - minutes
 *             properties:
 *               minutes:
 *                 type: string
 *                 description: Full meeting minutes in markdown or plain text
 *                 example: "# Meeting Minutes\n\n## Attendees\n- John Doe\n- Jane Smith\n\n## Resolutions\n..."
 *     responses:
 *       201:
 *         description: Minutes saved successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin or Secretary access required
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post(
    '/:id/minutes',
    checkMeetingPermission(adminRoles),
    meetingValidator.saveMinutesValidator,
    meetingController.saveMeetingMinutes
);

/**
 * @swagger
 * /meetings/{id}/qr-code:
 *   get:
 *     tags: [Meetings]
 *     summary: Generate attendance QR code
 *     description: Generates a QR code for quick attendance marking at the meeting venue
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *     responses:
 *       200:
 *         description: QR code generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     qrCodeUrl:
 *                       type: string
 *                       format: uri
 *                       description: Data URL of QR code image
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
    '/:id/qr-code',
    checkMeetingPermission(allMembers),
    meetingController.generateAttendanceQrCode
);

/**
 * @swagger
 * /meetings/{id}/calendar:
 *   get:
 *     tags: [Meetings]
 *     summary: Generate calendar file
 *     description: Generates an .ics calendar file for adding the meeting to personal calendars
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *     responses:
 *       200:
 *         description: Calendar file generated successfully
 *         content:
 *           text/calendar:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Disposition:
 *             schema:
 *               type: string
 *               example: attachment; filename="meeting.ics"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
    '/:id/calendar',
    checkMeetingPermission(allMembers),
    meetingController.generateCalendarFile
);

export default router;