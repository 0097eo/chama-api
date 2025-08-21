import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { checkMembership } from '../middleware/membership.middleware';
import * as notificationController from '../controllers/notification.controller';
import { MembershipRole } from '../generated/prisma/client';

const router = Router();
router.use(protect);

const allMembers = Object.values(MembershipRole);
const privilegedRoles = [MembershipRole.ADMIN, MembershipRole.SECRETARY];
const financialRoles = [MembershipRole.ADMIN, MembershipRole.TREASURER];

// GET /api/notifications/chama/:chamaId - Get notifications for the authenticated user IN A SPECIFIC CHAMA.
router.get(
    '/chama/:chamaId',
    checkMembership(allMembers),
    notificationController.getUserNotificationsForChama
);

// PUT /api/notifications/:id/read - Mark a specific notification as read.
router.put('/:id/read', notificationController.markAsRead);

// DELETE /api/notifications/:id - Delete a notification.
router.delete('/:id', notificationController.deleteNotification);

// POST /api/notifications/broadcast/:chamaId - Send a message to all chama members.
router.post(
    '/broadcast/:chamaId',
    checkMembership(privilegedRoles),
    notificationController.broadcastToChama
);

// POST /api/notifications/reminders/contribution
router.post(
    '/reminders/contribution',
    notificationController.sendContributionReminder
);

// POST /api/notifications/reminders/loan
router.post(
    '/reminders/loan',
    notificationController.sendLoanReminder
);


// These are general utility routes, need top-level admin protection via rbac.middleware
router.post('/sms', notificationController.sendSmsController);
router.post('/email', notificationController.sendEmailController);

export default router;