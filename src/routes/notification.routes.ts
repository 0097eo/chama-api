import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import * as notificationController from '../controllers/notification.controller';
import { checkMembership } from '../middleware/membership.middleware';
import { MembershipRole } from '../generated/prisma/client';
import { checkRole } from '../middleware/rbac.middleware';

const router = Router();
router.use(protect);

// GET /api/notifications - Get notifications for the authenticated user
router.get('/', notificationController.getUserNotifications);

// PUT /api/notifications/:id/read - Mark a specific notification as read
router.put('/:id/read', notificationController.markAsRead);

// DELETE /api/notifications/:id - Delete a notification
router.delete('/:id', notificationController.deleteNotification);

// POST /api/notifications/broadcast/:chamaId - Send a message to all chama members
router.post(
    '/broadcast/:chamaId',
    checkMembership([MembershipRole.ADMIN, MembershipRole.SECRETARY]),
    notificationController.broadcastToChama
);

// POST /api/notifications/reminders/contribution - Send a contribution reminder
router.post(
    '/reminders/contribution',
    protect,
    notificationController.sendContributionReminder
);

// POST /api/notifications/sms - Send a direct SMS (Admin tool)
router.post(
    '/sms',
    checkRole([MembershipRole.ADMIN]),
    notificationController.sendSmsController
);

// POST /api/notifications/email - Send a direct email (Admin tool)
router.post(
    '/email',
    checkRole([MembershipRole.ADMIN]),
    notificationController.sendEmailController
);

export default router;