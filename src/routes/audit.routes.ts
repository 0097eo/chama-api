import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import * as auditController from '../controllers/audit.controller';
import { UserRole } from '@prisma/client';
import { checkMembership } from '../middleware/membership.middleware';
import { checkRole } from '../middleware/rbac.middleware';

const router = Router();
router.use(protect);

/**
 * @swagger
 * /audit/chama/{chamaId}:
 *   get:
 *     tags: [Audit]
 *     summary: Get audit logs for a specific chama
 *     description: Retrieves all audit trail logs for a chama. Accessible by chama members only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chamaId
 *         required: true
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *         description: The chama ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of records per page
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2024-01-01"
 *         description: Filter logs from this date (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2024-12-31"
 *         description: Filter logs until this date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       action:
 *                         type: string
 *                         example: "CONTRIBUTION_CREATED"
 *                       userId:
 *                         type: string
 *                       targetId:
 *                         type: string
 *                         nullable: true
 *                       chamaId:
 *                         type: string
 *                         nullable: true
 *                       contributionId:
 *                         type: string
 *                         nullable: true
 *                       loanId:
 *                         type: string
 *                         nullable: true
 *                       meetingId:
 *                         type: string
 *                         nullable: true
 *                       oldValue:
 *                         type: object
 *                         nullable: true
 *                       newValue:
 *                         type: object
 *                         nullable: true
 *                       ipAddress:
 *                         type: string
 *                         nullable: true
 *                       userAgent:
 *                         type: string
 *                         nullable: true
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       user:
 *                         type: object
 *                         properties:
 *                           email:
 *                             type: string
 *                           firstName:
 *                             type: string
 *                           lastName:
 *                             type: string
 *                       target:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           email:
 *                             type: string
 *                       chama:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           name:
 *                             type: string
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Not a member of this chama
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
    '/chama/:chamaId',
    checkMembership,
    auditController.getChamaAuditLogs
);

// Only application-level ADMINS can access these logs for compliance.
router.use(checkRole([UserRole.ADMIN]));

/**
 * @swagger
 * /audit/user/{userId}:
 *   get:
 *     tags: [Audit]
 *     summary: Get activity logs for a specific user
 *     description: Retrieves all audit logs initiated by a user. Admin only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *         description: The user ID
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
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2024-01-01"
 *         description: Filter logs from this date (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2024-12-31"
 *         description: Filter logs until this date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: User activity logs retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin access required
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
    '/user/:userId',
    auditController.getUserActivityLogs
);

/**
 * @swagger
 * /audit/search:
 *   get:
 *     tags: [Audit]
 *     summary: Search audit logs with filters
 *     description: Advanced search for audit logs across all chamas. Admin only.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action type
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *         description: Filter by actor user ID
 *       - in: query
 *         name: targetId
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *         description: Filter by target user ID
 *       - in: query
 *         name: chamaId
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *         description: Filter by chama ID
 *       - in: query
 *         name: contributionId
 *         schema:
 *           type: string
 *         description: Filter by contribution ID
 *       - in: query
 *         name: loanId
 *         schema:
 *           type: string
 *         description: Filter by loan ID
 *       - in: query
 *         name: meetingId
 *         schema:
 *           type: string
 *         description: Filter by meeting ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2024-01-01"
 *         description: Filter logs from this date (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2024-12-31"
 *         description: Filter logs until this date (YYYY-MM-DD)
 *       - in: query
 *         name: ipAddress
 *         schema:
 *           type: string
 *         description: Filter by IP address
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
 *         description: Search results
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin access required
 */
router.get(
    '/search',
    auditController.searchAuditLogs
);

/**
 * @swagger
 * /audit/export:
 *   post:
 *     tags: [Audit]
 *     summary: Export audit logs to CSV
 *     description: Exports filtered audit logs to CSV format. Admin only.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               chamaId:
 *                 type: string
 *                 example: cmdjw3rr50002cuhv9312yj79
 *                 description: Filter by chama ID
 *               userId:
 *                 type: string
 *                 example: cmdjw3rr50002cuhv9312yj79
 *                 description: Filter by actor user ID
 *               targetId:
 *                 type: string
 *                 description: Filter by target user ID
 *               action:
 *                 type: string
 *                 description: Filter by action type
 *               contributionId:
 *                 type: string
 *                 description: Filter by contribution ID
 *               loanId:
 *                 type: string
 *                 description: Filter by loan ID
 *               meetingId:
 *                 type: string
 *                 description: Filter by meeting ID
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: "2024-01-01"
 *                 description: Filter from this date (YYYY-MM-DD)
 *               endDate:
 *                 type: string
 *                 format: date
 *                 example: "2024-12-31"
 *                 description: Filter until this date (YYYY-MM-DD)
 *               ipAddress:
 *                 type: string
 *                 description: Filter by IP address
 *     responses:
 *       200:
 *         description: CSV file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin access required
 */
router.post(
    '/export',
    auditController.exportAuditLogs
);

export default router;