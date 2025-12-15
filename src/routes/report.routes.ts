import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { checkMembership } from '../middleware/membership.middleware';
import * as reportController from '../controllers/report.controller';
import * as reportValidator from '../validators/report.validators';
import { MembershipRole } from '@prisma/client';

const router = Router();
router.use(protect);

// All reporting routes require at least a Secretary role to view.
const privilegedRoles = [MembershipRole.ADMIN, MembershipRole.TREASURER, MembershipRole.SECRETARY];

/**
 * @swagger
 * /reports/financial-summary/{chamaId}:
 *   get:
 *     tags: [Reports]
 *     summary: Get financial summary report
 *     description: Returns comprehensive financial overview of the chama. Admin/Treasurer/Secretary only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chamaId
 *         required: true
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *     responses:
 *       200:
 *         description: Financial summary retrieved successfully
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
 *                     totalContributions:
 *                       type: number
 *                       example: 500000
 *                     totalPenalties:
 *                       type: number
 *                     totalLoansDisbursed:
 *                       type: number
 *                     totalLoanRepayments:
 *                       type: number
 *                     outstandingLoanPrincipal:
 *                       type: number
 *                     netPosition:
 *                       type: number
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin, Treasurer, or Secretary access required
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
    '/financial-summary/:chamaId',
    checkMembership(privilegedRoles),
    reportController.getFinancialSummary
);

/**
 * @swagger
 * /reports/contributions/{chamaId}:
 *   get:
 *     tags: [Reports]
 *     summary: Get contributions report
 *     description: Returns detailed contributions analysis with member-wise breakdown. Admin/Treasurer/Secretary only.
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
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for date range filter
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for date range filter
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
 *     responses:
 *       200:
 *         description: Contributions report retrieved successfully
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
 *                     contributions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           memberName:
 *                             type: string
 *                           amount:
 *                             type: number
 *                           penaltyApplied:
 *                             type: number
 *                           month:
 *                             type: integer
 *                           year:
 *                             type: integer
 *                           paymentMethod:
 *                             type: string
 *                           paidAt:
 *                             type: string
 *                             format: date-time
 *                     totalRecords:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin, Treasurer, or Secretary access required
 */
router.get(
    '/contributions/:chamaId',
    checkMembership(privilegedRoles),
    reportController.getContributionsReport
);

/**
 * @swagger
 * /reports/loans/{chamaId}:
 *   get:
 *     tags: [Reports]
 *     summary: Get loan portfolio report
 *     description: Returns comprehensive loan analysis including performance, defaults, and repayment tracking. Admin/Treasurer/Secretary only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chamaId
 *         required: true
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *     responses:
 *       200:
 *         description: Loan portfolio report retrieved successfully
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
 *                     totalPrincipalDisbursed:
 *                       type: number
 *                     totalRepayments:
 *                       type: number
 *                     statusBreakdown:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           status:
 *                             type: string
 *                           count:
 *                             type: integer
 *                           totalAmount:
 *                             type: number
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin, Treasurer, or Secretary access required
 */
router.get(
    '/loans/:chamaId',
    checkMembership(privilegedRoles),
    reportController.getLoanPortfolioReport
);

/**
 * @swagger
 * /reports/cashflow/{chamaId}:
 *   get:
 *     tags: [Reports]
 *     summary: Get cashflow report
 *     description: Returns detailed cashflow analysis showing inflows, outflows, and net position. Admin/Treasurer/Secretary only.
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
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for date range filter
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for date range filter
 *     responses:
 *       200:
 *         description: Cashflow report retrieved successfully
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
 *                     period:
 *                       type: object
 *                       properties:
 *                         startDate:
 *                           type: string
 *                           format: date-time
 *                         endDate:
 *                           type: string
 *                           format: date-time
 *                     totalInflows:
 *                       type: number
 *                     totalOutflows:
 *                       type: number
 *                     netCashflow:
 *                       type: number
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin, Treasurer, or Secretary access required
 */
router.get(
    '/cashflow/:chamaId',
    checkMembership(privilegedRoles),
    reportController.getCashflowReport
);

/**
 * @swagger
 * /reports/member-performance/{chamaId}:
 *   get:
 *     tags: [Reports]
 *     summary: Get member performance report
 *     description: Returns individual member performance metrics including contributions, loans, and attendance. Admin/Treasurer/Secretary only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chamaId
 *         required: true
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *     responses:
 *       200:
 *         description: Member performance report retrieved successfully
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
 *                       user:
 *                         type: object
 *                         properties:
 *                           firstName:
 *                             type: string
 *                           lastName:
 *                             type: string
 *                           email:
 *                             type: string
 *                       _count:
 *                         type: object
 *                         properties:
 *                           contributions:
 *                             type: integer
 *                           loans:
 *                             type: integer
 *                       contributions:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             amount:
 *                               type: number
 *                       loans:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             amount:
 *                               type: number
 *                             status:
 *                               type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin, Treasurer, or Secretary access required
 */
router.get(
    '/member-performance/:chamaId',
    checkMembership(privilegedRoles),
    reportController.getMemberPerformanceReport
);

/**
 * @swagger
 * /reports/audit-trail/{chamaId}:
 *   get:
 *     tags: [Reports]
 *     summary: Get audit trail report
 *     description: Returns complete audit trail of all activities in the chama. Admin only.
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
 *           default: 50
 *     responses:
 *       200:
 *         description: Audit trail retrieved successfully
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
 *                     logs:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           action:
 *                             type: string
 *                           user:
 *                             type: object
 *                             properties:
 *                               firstName:
 *                                 type: string
 *                               lastName:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                     totalRecords:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin access required
 */
router.get(
    '/audit-trail/:chamaId',
    checkMembership([MembershipRole.ADMIN]),
    reportController.getAuditTrailReport
);

/**
 * @swagger
 * /reports/export/{chamaId}:
 *   post:
 *     tags: [Reports]
 *     summary: Export report
 *     description: Exports any report in PDF or Excel format. Admin/Treasurer/Secretary only.
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
 *               - reportType
 *               - format
 *             properties:
 *               reportType:
 *                 type: string
 *                 example: contributions
 *               format:
 *                 type: string
 *                 enum: [pdf, excel]
 *                 example: pdf
 *               dateRange:
 *                 type: object
 *                 properties:
 *                   from:
 *                     type: string
 *                     format: date-time
 *                   to:
 *                     type: string
 *                     format: date-time
 *     responses:
 *       200:
 *         description: Report exported successfully
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *         headers:
 *           Content-Disposition:
 *             schema:
 *               type: string
 *               example: attachment; filename="report.pdf"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin, Treasurer, or Secretary access required
 */
router.post(
    '/export/:chamaId',
    checkMembership(privilegedRoles),
    reportValidator.exportReportValidator,
    reportController.exportReport
);

export default router;