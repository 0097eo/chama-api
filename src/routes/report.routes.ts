import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { checkMembership } from '../middleware/membership.middleware';
import * as reportController from '../controllers/report.controller';
import * as reportValidator from '../validators/report.validators';
import { MembershipRole } from '../generated/prisma/client';

const router = Router();
router.use(protect);

// All reporting routes require at least a Secretary role to view.
const privilegedRoles = [MembershipRole.ADMIN, MembershipRole.TREASURER, MembershipRole.SECRETARY];

// GET /api/reports/financial-summary/:chamaId
router.get(
    '/financial-summary/:chamaId',
    checkMembership(privilegedRoles),
    reportController.getFinancialSummary
);

// GET /api/reports/contributions/:chamaId
router.get(
    '/contributions/:chamaId',
    checkMembership(privilegedRoles),
    reportController.getContributionsReport
);

// GET /api/reports/loans/:chamaId
router.get(
    '/loans/:chamaId',
    checkMembership(privilegedRoles),
    reportController.getLoanPortfolioReport
);

// GET /api/reports/cashflow/:chamaId
router.get(
    '/cashflow/:chamaId',
    checkMembership(privilegedRoles),
    reportController.getCashflowReport
);

// GET /api/reports/member-performance/:chamaId
router.get(
    '/member-performance/:chamaId',
    checkMembership(privilegedRoles),
    reportController.getMemberPerformanceReport
);

// GET /api/reports/audit-trail/:chamaId
router.get(
    '/audit-trail/:chamaId',
    checkMembership([MembershipRole.ADMIN]), // Only Admins can view the full audit trail
    reportController.getAuditTrailReport
);

// POST /api/reports/export - A POST route is used here to allow for a complex JSON body
// specifying report type, format, and date ranges.
router.post(
    '/export/:chamaId',
    checkMembership(privilegedRoles),
    reportValidator.exportReportValidator,
    reportController.exportReport
);


export default router;