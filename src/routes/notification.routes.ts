import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { checkMembership } from '../middleware/membership.middleware';
import * as notificationController from '../controllers/notification.controller';
import { MembershipRole } from '@prisma/client';

const router = Router();
router.use(protect);

const allMembers = Object.values(MembershipRole);
const privilegedRoles = [MembershipRole.ADMIN, MembershipRole.SECRETARY];

/**
 * @swagger
 * /notifications/chama/{chamaId}:
 *   get:
 *     tags: [Notifications]
 *     summary: Get user notifications for chama
 *     description: Returns all notifications for the authenticated user within a specific chama
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
 *         name: isRead
 *         schema:
 *           type: boolean
 *         description: Filter by read/unread status
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [CONTRIBUTION_DUE, LOAN_APPROVED, LOAN_PAYMENT_DUE, MEETING_REMINDER, GENERAL, URGENT]
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
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
 *                       type:
 *                         type: string
 *                       title:
 *                         type: string
 *                         example: Contribution Due
 *                       message:
 *                         type: string
 *                         example: Your monthly contribution of KES 5,000 is due on January 31st
 *                       isRead:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 unreadCount:
 *                   type: integer
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
    notificationController.getUserNotificationsForChama
);

/**
 * @swagger
 * /notifications/{id}/read:
 *   put:
 *     tags: [Notifications]
 *     summary: Mark notification as read
 *     description: Marks a specific notification as read
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
 *         description: Notification marked as read
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
 *                   example: Notification marked as read
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Not authorized to mark this notification
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put('/:id/read', notificationController.markAsRead);

/**
 * @swagger
 * /notifications/{id}:
 *   delete:
 *     tags: [Notifications]
 *     summary: Delete notification
 *     description: Deletes a specific notification
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
 *         description: Notification deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Not authorized to delete this notification
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete('/:id', notificationController.deleteNotification);

/**
 * @swagger
 * /notifications/broadcast/{chamaId}:
 *   post:
 *     tags: [Notifications]
 *     summary: Broadcast message to chama
 *     description: Sends a notification to all members of a chama. Admin/Secretary only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chamaId
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
 *               - title
 *               - message
 *               - type
 *             properties:
 *               title:
 *                 type: string
 *                 example: Important Announcement
 *               message:
 *                 type: string
 *                 example: Our next meeting has been rescheduled to February 15th
 *               type:
 *                 type: string
 *                 enum: [CONTRIBUTION_DUE, LOAN_APPROVED, LOAN_PAYMENT_DUE, MEETING_REMINDER, GENERAL, URGENT]
 *                 description: Notification type
 *     responses:
 *       201:
 *         description: Broadcast sent successfully
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
 *                   example: Message broadcast to 25 members
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin or Secretary access required
 */
router.post(
    '/broadcast/:chamaId',
    checkMembership(privilegedRoles),
    notificationController.broadcastToChama
);

/**
 * @swagger
 * /notifications/reminders/contribution:
 *   post:
 *     tags: [Notifications]
 *     summary: Send contribution reminder
 *     description: Sends reminder notifications to members with pending contributions
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
 *             properties:
 *               chamaId:
 *                 type: string
 *                 example: cmdjw3rr50002cuhv9312yj79
 *               daysBeforeDue:
 *                 type: integer
 *                 default: 3
 *                 description: Send reminder X days before due date
 *               memberIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   example: cmdjw3rr50002cuhv9312yj79
 *                 description: Specific members to remind (optional)
 *               sendEmail:
 *                 type: boolean
 *                 default: false
 *               sendSms:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Reminders sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: Reminders sent to 15 members
 *                 data:
 *                   type: object
 *                   properties:
 *                     remindersSent:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post(
    '/reminders/contribution',
    notificationController.sendContributionReminder
);

/**
 * @swagger
 * /notifications/reminders/loan:
 *   post:
 *     tags: [Notifications]
 *     summary: Send loan payment reminder
 *     description: Sends reminder notifications to members with upcoming or overdue loan payments
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
 *             properties:
 *               chamaId:
 *                 type: string
 *                 example: cmdjw3rr50002cuhv9312yj79
 *               reminderType:
 *                 type: string
 *                 enum: [UPCOMING, OVERDUE]
 *                 default: UPCOMING
 *               daysBeforeDue:
 *                 type: integer
 *                 default: 7
 *                 description: For UPCOMING reminders
 *               daysOverdue:
 *                 type: integer
 *                 description: For OVERDUE reminders
 *               sendEmail:
 *                 type: boolean
 *                 default: false
 *               sendSms:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Loan reminders sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: Loan reminders sent to 8 members
 *                 data:
 *                   type: object
 *                   properties:
 *                     remindersSent:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post(
    '/reminders/loan',
    notificationController.sendLoanReminder
);

/**
 * @swagger
 * /notifications/sms:
 *   post:
 *     tags: [Notifications]
 *     summary: Send SMS notification
 *     description: Sends a direct SMS to specified phone numbers. System admin utility.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - message
 *             properties:
 *               to:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["254712345678", "254723456789"]
 *                 description: Array of phone numbers
 *               message:
 *                 type: string
 *                 maxLength: 160
 *                 example: Your contribution is due tomorrow
 *     responses:
 *       200:
 *         description: SMS sent successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin access required
 */
router.post('/sms', notificationController.sendSmsController);

/**
 * @swagger
 * /notifications/email:
 *   post:
 *     tags: [Notifications]
 *     summary: Send email notification
 *     description: Sends a direct email to specified address. System admin utility.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - subject
 *               - html
 *             properties:
 *               to:
 *                 type: string
 *                 format: email
 *                 example: member@example.com
 *                 description: Recipient email address
 *               subject:
 *                 type: string
 *                 example: Important Update from Your Chama
 *               html:
 *                 type: string
 *                 description: HTML email body
 *     responses:
 *       200:
 *         description: Email sent successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin access required
 */
router.post('/email', notificationController.sendEmailController);

export default router;