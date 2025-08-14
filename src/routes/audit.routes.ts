import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import * as auditController from '../controllers/audit.controller';
import { UserRole } from '../generated/prisma/client';
import { checkMembership } from '../middleware/membership.middleware';
import { checkRole } from '../middleware/rbac.middleware';

const router = Router();
router.use(protect);


// GET /api/audit/chama/:chamaId - Get all audit logs for a specific chama
router.get(
    '/chama/:chamaId',
    auditController.getChamaAuditLogs
);

// Only application-level ADMINS can access these logs for compliance.
router.use(checkRole([UserRole.ADMIN]));
// GET /api/audit/user/:userId - Get all logs initiated by a specific user

router.get(
    '/user/:userId',
    auditController.getUserActivityLogs
);

// GET /api/audit/search - Search logs by action, date range, etc.
router.get(
    '/search',
    auditController.searchAuditLogs
);

// POST /api/audit/export - Export audit logs to CSV
router.post(
    '/export',
    auditController.exportAuditLogs
);


export default router;