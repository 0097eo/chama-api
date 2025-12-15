import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { checkMembership } from '../middleware/membership.middleware';
import * as contributionController from '../controllers/contribution.controller';
import * as contributionValidator from '../validators/contributions.validators';
import { uploadCsv } from '../middleware/upload.midlleware';

const router = Router();

// All contribution routes are protected and require a logged-in user
router.use(protect);

/**
 * @swagger
 * /contributions:
 *   post:
 *     tags: [Contributions]
 *     summary: Record a new contribution
 *     description: Records a contribution payment for a chama member
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - membershipId
 *               - amount
 *               - month
 *               - year
 *               - paymentMethod
 *               - paidAt
 *             properties:
 *               membershipId:
 *                 type: string
 *                 example: cmdjw3rr50002cuhv9312yj79
 *                 description: ID of the membership record
 *               amount:
 *                 type: number
 *                 example: 5000
 *                 description: Contribution amount
 *               month:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 12
 *                 example: 1
 *                 description: Month of contribution (1-12)
 *               year:
 *                 type: integer
 *                 example: 2025
 *                 description: Year of contribution
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH, MPESA, BANK_TRANSFER, CHEQUE]
 *                 example: MPESA
 *                 description: Payment method used
 *               paidAt:
 *                 type: string
 *                 format: date-time
 *                 example: 2025-01-15T10:30:00Z
 *                 description: Actual payment date and time
 *               mpesaCode:
 *                 type: string
 *                 nullable: true
 *                 example: ABC123XYZ
 *                 description: M-Pesa transaction code or other payment reference
 *               status:
 *                 type: string
 *                 enum: [PENDING, PAID]
 *                 default: PAID
 *                 description: Payment status (defaults to PAID if not provided)
 *     responses:
 *       201:
 *         description: Contribution recorded successfully
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
 *                   example: Contribution recorded successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: cmdjw3rr50002cuhv9312yj79
 *                     membershipId:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     month:
 *                       type: integer
 *                     year:
 *                       type: integer
 *                     paymentMethod:
 *                       type: string
 *                     mpesaCode:
 *                       type: string
 *                       nullable: true
 *                     paidAt:
 *                       type: string
 *                       format: date-time
 *                     status:
 *                       type: string
 *                       enum: [PENDING, PAID]
 *                     penaltyApplied:
 *                       type: number
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post(
  '/',
  contributionValidator.recordContributionValidator,
  contributionController.recordContribution
);

/**
 * @swagger
 * /contributions/bulk-import/{chamaId}:
 *   post:
 *     tags: [Contributions]
 *     summary: Bulk import contributions from CSV
 *     description: |
 *       Import multiple contributions at once from CSV file. Admin/Treasurer only.
 *       
 *       **Required CSV Columns:**
 *       - email: Member's email address (used to find membership)
 *       - amount: Contribution amount (numeric)
 *       - month: Month number (1-12)
 *       - year: Year (e.g., 2025)
 *       - paymentMethod: CASH, MPESA, BANK_TRANSFER, or CHEQUE
 *       - paidAt: Payment date in ISO format (e.g., 2025-01-15T10:30:00Z or 2025-01-15)
 *       
 *       **Example CSV:**
 *       ```
 *       email,amount,month,year,paymentMethod,paidAt
 *       john@example.com,5000,1,2025,MPESA,2025-01-15T10:30:00Z
 *       jane@example.com,5000,1,2025,CASH,2025-01-15
 *       ```
 *       
 *       Note: All imported contributions are marked as PAID status.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chamaId
 *         required: true
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *         description: ID of the chama to import contributions for
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - contributionsFile
 *             properties:
 *               contributionsFile:
 *                 type: string
 *                 format: binary
 *                 description: CSV file with columns - email, amount, month, year, paymentMethod, paidAt
 *     responses:
 *       201:
 *         description: Contributions imported successfully
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
 *                   example: 50 contributions imported successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     createdCount:
 *                       type: integer
 *                       description: Number of contributions successfully created
 *                       example: 50
 *                     totalRecords:
 *                       type: integer
 *                       description: Total number of records in the CSV
 *                       example: 52
 *       400:
 *         description: Invalid CSV format or parsing error
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin or Treasurer access required
 */
router.post(
  '/bulk-import/:chamaId',
  checkMembership(['ADMIN', 'TREASURER']),
  uploadCsv.single('contributionsFile'),
  contributionController.bulkImportContributions
);

/**
 * @swagger
 * /contributions/chama/{chamaId}:
 *   get:
 *     tags: [Contributions]
 *     summary: Get chama contributions
 *     description: Returns all contributions for a specific chama with filtering options
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
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, PAID]
 *       - in: query
 *         name: paymentMethod
 *         schema:
 *           type: string
 *           enum: [CASH, MPESA, BANK_TRANSFER, CHEQUE]
 *     responses:
 *       200:
 *         description: Contributions retrieved successfully
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
 *                         example: cmdjw3rr50002cuhv9312yj79
 *                       amount:
 *                         type: number
 *                       month:
 *                         type: integer
 *                       year:
 *                         type: integer
 *                       paymentMethod:
 *                         type: string
 *                       mpesaCode:
 *                         type: string
 *                         nullable: true
 *                       status:
 *                         type: string
 *                       penaltyApplied:
 *                         type: number
 *                       memberName:
 *                         type: string
 *                       paidAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     totalRecords:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     currentPage:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Not a member of this chama
 */
router.get(
  '/chama/:chamaId',
  checkMembership(['ADMIN', 'TREASURER', 'SECRETARY', 'MEMBER']),
  contributionController.getChamaContributions
);

/**
 * @swagger
 * /contributions/member/{membershipId}:
 *   get:
 *     tags: [Contributions]
 *     summary: Get member contributions
 *     description: Returns all contributions for a specific member. Users can view their own, admins can view any.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: membershipId
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
 *     responses:
 *       200:
 *         description: Member contributions retrieved successfully
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
 *                           id:
 *                             type: string
 *                           amount:
 *                             type: number
 *                           month:
 *                             type: integer
 *                           year:
 *                             type: integer
 *                           paymentMethod:
 *                             type: string
 *                           mpesaCode:
 *                             type: string
 *                             nullable: true
 *                           status:
 *                             type: string
 *                           penaltyApplied:
 *                             type: number
 *                           paidAt:
 *                             type: string
 *                             format: date-time
 *                     totalContributed:
 *                       type: number
 *                     expectedTotal:
 *                       type: number
 *                     balance:
 *                       type: number
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Access denied
 */
router.get(
  '/member/:membershipId',
  contributionController.getMemberContributions
);

/**
 * @swagger
 * /contributions/summary/{chamaId}:
 *   get:
 *     tags: [Contributions]
 *     summary: Get contribution summary
 *     description: Returns aggregated contribution statistics for the chama. Admin/Treasurer/Secretary only.
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
 *         description: Summary retrieved successfully
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
 *                     year:
 *                       type: integer
 *                       description: Current year for the summary
 *                     totalPaid:
 *                       type: number
 *                       description: Total amount paid by all members
 *                     totalPenalties:
 *                       type: number
 *                       description: Total penalties collected
 *                     paidContributionsCount:
 *                       type: integer
 *                       description: Number of paid contributions
 *                     totalExpected:
 *                       type: number
 *                       description: Expected total for the year
 *                     deficit:
 *                       type: number
 *                       description: Difference between expected and paid
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin, Treasurer, or Secretary access required
 */
router.get(
  '/summary/:chamaId',
  checkMembership(['ADMIN', 'TREASURER', 'SECRETARY']),
  contributionController.getContributionSummary
);

/**
 * @swagger
 * /contributions/defaulters/{chamaId}:
 *   get:
 *     tags: [Contributions]
 *     summary: Get defaulting members
 *     description: Returns list of members who have missed contributions. Admin/Treasurer/Secretary only.
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
 *         name: period
 *         schema:
 *           type: string
 *           enum: [current, last3months, last6months, all]
 *           default: current
 *     responses:
 *       200:
 *         description: Defaulters list retrieved successfully
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
 *                       memberName:
 *                         type: string
 *                       membershipId:
 *                         type: string
 *                       missedPayments:
 *                         type: integer
 *                       totalOwed:
 *                         type: number
 *                       lastPaymentDate:
 *                         type: string
 *                         format: date
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin, Treasurer, or Secretary access required
 */
router.get(
  '/defaulters/:chamaId',
  checkMembership(['ADMIN', 'TREASURER', 'SECRETARY']),
  contributionController.getDefaulters
);

/**
 * @swagger
 * /contributions/export/{chamaId}:
 *   get:
 *     tags: [Contributions]
 *     summary: Export contributions to CSV
 *     description: Exports contribution data to CSV format. Admin/Treasurer/Secretary only.
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
 *         description: CSV file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin, Treasurer, or Secretary access required
 */
router.get(
  '/export/:chamaId',
  checkMembership(['ADMIN', 'TREASURER', 'SECRETARY']),
  contributionController.exportContributions
);

/**
 * @swagger
 * /contributions/{id}:
 *   get:
 *     tags: [Contributions]
 *     summary: Get contribution by ID
 *     description: Returns detailed information about a specific contribution
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
 *         description: Contribution retrieved successfully
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
 *                     membershipId:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     month:
 *                       type: integer
 *                     year:
 *                       type: integer
 *                     paymentMethod:
 *                       type: string
 *                     mpesaCode:
 *                       type: string
 *                       nullable: true
 *                     paidAt:
 *                       type: string
 *                       format: date-time
 *                     status:
 *                       type: string
 *                     penaltyApplied:
 *                       type: number
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id', contributionController.getContributionById);

/**
 * @swagger
 * /contributions/{id}:
 *   put:
 *     tags: [Contributions]
 *     summary: Update contribution record
 *     description: |
 *       Updates contribution details (e.g., correct amount or payment method).
 *       
 *       **Important Notes:**
 *       - When updating status from PENDING to PAID, penalty is automatically recalculated
 *       - Penalty calculation is based on payment date vs. deadline (15th of the month)
 *       - Only Admin/Treasurer can update contributions
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
 *               amount:
 *                 type: number
 *                 description: Updated contribution amount
 *               month:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 12
 *                 description: Updated month (1-12)
 *               year:
 *                 type: integer
 *                 description: Updated year
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH, MPESA, BANK_TRANSFER, CHEQUE]
 *                 description: Updated payment method
 *               mpesaCode:
 *                 type: string
 *                 nullable: true
 *                 description: Updated M-Pesa code or payment reference
 *               paidAt:
 *                 type: string
 *                 format: date-time
 *                 description: Updated payment date (affects penalty calculation)
 *               status:
 *                 type: string
 *                 enum: [PENDING, PAID]
 *                 description: Updated status (penalty recalculated if changing to PAID)
 *               penaltyApplied:
 *                 type: number
 *                 description: Manual penalty override (use with caution)
 *     responses:
 *       200:
 *         description: Contribution updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     status:
 *                       type: string
 *                     penaltyApplied:
 *                       type: number
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put(
  '/:id',
  contributionValidator.updateContributionValidator,
  contributionController.updateContribution
);

/**
 * @swagger
 * /contributions/{id}:
 *   delete:
 *     tags: [Contributions]
 *     summary: Delete contribution
 *     description: Permanently deletes a contribution record. Requires high privilege.
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
 *         description: Contribution deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: Contribution deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete('/:id', contributionController.deleteContribution);

export default router;