import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { checkMembership } from '../middleware/membership.middleware';
import { checkLoanPermission } from '../middleware/permission.middleware';
import * as loanController from '../controllers/loan.controller';
import * as loanValidator from '../validators/loan.validators';
import { MembershipRole } from '@prisma/client';

const router = Router();

router.use(protect);

/**
 * @swagger
 * /loans/eligibility:
 *   get:
 *     tags: [Loans]
 *     summary: Check loan eligibility
 *     description: Checks if the authenticated user is eligible for a loan based on contribution history and existing loans
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: chamaId
 *         required: true
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *       - in: query
 *         name: amount
 *         schema:
 *           type: number
 *         description: Requested loan amount to check eligibility
 *     responses:
 *       200:
 *         description: Eligibility check completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     isEligible:
 *                       type: boolean
 *                       example: true
 *                       description: Whether the member is eligible for the requested amount
 *                     maxLoanable:
 *                       type: number
 *                       example: 50000
 *                       description: Maximum amount the member can borrow based on contributions
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/eligibility', loanController.checkEligibilityController);

/**
 * @swagger
 * /loans/{id}:
 *   get:
 *     tags: [Loans]
 *     summary: Get loan details
 *     description: Returns detailed information about a specific loan. Accessible by loan owner or admin.
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
 *         description: Loan details retrieved successfully
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
 *                     membershipId:
 *                       type: string
 *                     amount:
 *                       type: number
 *                       description: Principal loan amount
 *                     interestRate:
 *                       type: number
 *                       description: Annual interest rate as decimal (e.g., 0.10 for 10%)
 *                     duration:
 *                       type: integer
 *                       description: Duration in months
 *                     status:
 *                       type: string
 *                       enum: [PENDING, APPROVED, REJECTED, ACTIVE, PAID, DEFAULTED]
 *                     purpose:
 *                       type: string
 *                     repaymentAmount:
 *                       type: number
 *                       nullable: true
 *                       description: Total amount to repay (principal + interest)
 *                     monthlyInstallment:
 *                       type: number
 *                       nullable: true
 *                       description: Monthly payment amount
 *                     dueDate:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                       description: Next payment due date
 *                     isRestructured:
 *                       type: boolean
 *                       description: Whether loan has been restructured
 *                     restructureNotes:
 *                       type: string
 *                       nullable: true
 *                     membership:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         user:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                             firstName:
 *                               type: string
 *                             lastName:
 *                               type: string
 *                             email:
 *                               type: string
 *                     payments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           amount:
 *                             type: number
 *                           paidAt:
 *                             type: string
 *                             format: date-time
 *                     appliedAt:
 *                       type: string
 *                       format: date-time
 *                     approvedAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                     disbursedAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Access denied
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id', loanController.getLoanById);

/**
 * @swagger
 * /loans:
 *   post:
 *     tags: [Loans]
 *     summary: Apply for a loan
 *     description: |
 *       Submit a loan application to a chama. The system will:
 *       - Verify the member is applying for themselves
 *       - Check eligibility based on paid contributions (max = contributions × multiplier)
 *       - Create loan application in PENDING status
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
 *               - duration
 *               - purpose
 *             properties:
 *               membershipId:
 *                 type: string
 *                 example: cmdjw3rr50002cuhv9312yj79
 *                 description: Must be the authenticated user's membership
 *               amount:
 *                 type: number
 *                 example: 25000
 *                 description: Requested loan amount (must not exceed eligibility)
 *               duration:
 *                 type: integer
 *                 description: Loan duration in months
 *                 example: 12
 *               purpose:
 *                 type: string
 *                 example: Business expansion
 *                 description: Reason for the loan
 *     responses:
 *       201:
 *         description: Loan application submitted successfully
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
 *                   example: Loan application submitted successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: cmdjw3rr50002cuhv9312yj79
 *                     status:
 *                       type: string
 *                       example: PENDING
 *                     amount:
 *                       type: number
 *                     duration:
 *                       type: integer
 *       400:
 *         description: Validation error or exceeds loan eligibility
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Loan application rejected. You are only eligible to borrow up to 30000.00.
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Cannot apply for loan on behalf of another member
 */
router.post(
    '/',
    loanValidator.applyLoanValidator,
    loanController.applyForLoan
);

/**
 * @swagger
 * /loans/chama/{chamaId}:
 *   get:
 *     tags: [Loans]
 *     summary: Get chama loans
 *     description: Returns all loans for a specific chama. Admin/Treasurer/Secretary only.
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED, ACTIVE, PAID, DEFAULTED]
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
 *         description: Loans retrieved successfully
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
 *                 pagination:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin, Treasurer, or Secretary access required
 */
router.get(
    '/chama/:chamaId',
    checkMembership([MembershipRole.ADMIN, MembershipRole.TREASURER, MembershipRole.SECRETARY]),
    loanController.getChamaLoans
);

/**
 * @swagger
 * /loans/defaulters/{chamaId}:
 *   get:
 *     tags: [Loans]
 *     summary: Get loan defaulters
 *     description: |
 *       Returns list of members with ACTIVE loans whose dueDate has passed.
 *       Admin/Treasurer only.
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
 *                       id:
 *                         type: string
 *                       amount:
 *                         type: number
 *                       repaymentAmount:
 *                         type: number
 *                       dueDate:
 *                         type: string
 *                         format: date-time
 *                       membership:
 *                         type: object
 *                         properties:
 *                           user:
 *                             type: object
 *                             properties:
 *                               firstName:
 *                                 type: string
 *                               lastName:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                       payments:
 *                         type: array
 *                         items:
 *                           type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin or Treasurer access required
 */
router.get(
    '/defaulters/:chamaId',
    checkMembership([MembershipRole.ADMIN, MembershipRole.TREASURER]),
    loanController.getLoanDefaulters
);

/**
 * @swagger
 * /loans/member/{membershipId}:
 *   get:
 *     tags: [Loans]
 *     summary: Get member loans
 *     description: Returns all loans for a specific member. Members can view their own, admins can view any.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: membershipId
 *         required: true
 *         schema:
 *           type: string
 *           example: cmdjw3rr50002cuhv9312yj79
 *     responses:
 *       200:
 *         description: Member loans retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Access denied
 */
router.get('/member/:membershipId', loanController.getMemberLoans);

/**
 * @swagger
 * /loans/{id}/schedule:
 *   get:
 *     tags: [Loans]
 *     summary: Get repayment schedule
 *     description: |
 *       Returns the complete repayment schedule for a loan. 
 *       Schedule is only generated for disbursed loans.
 *       Accessible by loan owner or admin.
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
 *         description: Repayment schedule retrieved successfully
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
 *                       installment:
 *                         type: integer
 *                         example: 1
 *                         description: Installment number (1 to duration)
 *                       dueDate:
 *                         type: string
 *                         format: date
 *                         example: "2025-02-15"
 *                         description: Date when this installment is due
 *                       payment:
 *                         type: number
 *                         example: 2291.67
 *                         description: Monthly installment amount
 *                       balance:
 *                         type: number
 *                         example: 25208.33
 *                         description: Remaining balance after this payment
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Access denied
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id/schedule', loanController.getRepaymentSchedule);

/**
 * @swagger
 * /loans/{id}/payments:
 *   post:
 *     tags: [Loans]
 *     summary: Record loan payment
 *     description: |
 *       Records a repayment for an ACTIVE loan. Treasurer only.
 *       
 *       Payment processing:
 *       - Validates loan is in ACTIVE status
 *       - Checks for duplicate mpesaCode if provided
 *       - Updates loan status to PAID when fully repaid
 *       - Extends dueDate by 1 month for partial payments
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
 *               - amount
 *               - paymentMethod
 *               - paidAt
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 5000
 *                 description: Payment amount
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH, MPESA, BANK_TRANSFER, CHEQUE]
 *                 example: MPESA
 *               mpesaCode:
 *                 type: string
 *                 nullable: true
 *                 example: ABC123XYZ
 *                 description: M-Pesa transaction code (must be unique)
 *               paidAt:
 *                 type: string
 *                 format: date-time
 *                 example: 2025-01-15T10:30:00Z
 *                 description: Date and time of payment
 *     responses:
 *       201:
 *         description: Payment recorded successfully
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
 *                   example: Loan payment recorded successfully
 *       400:
 *         description: Validation error or duplicate mpesaCode
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Treasurer access required
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post(
    '/:id/payments',
    checkLoanPermission([MembershipRole.TREASURER]),
    loanValidator.recordPaymentValidator,
    loanController.recordLoanPayment
);

/**
 * @swagger
 * /loans/{id}/approve:
 *   put:
 *     tags: [Loans]
 *     summary: Approve or reject loan
 *     description: |
 *       Approves or rejects a PENDING loan application. Admin/Treasurer only.
 *       
 *       When approving:
 *       - Calculates total interest and repayment amount
 *       - Sets monthly installment
 *       - Updates status to APPROVED
 *       
 *       When rejecting:
 *       - Updates status to REJECTED
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [APPROVED, REJECTED]
 *                 example: APPROVED
 *                 description: Must be either APPROVED or REJECTED
 *     responses:
 *       200:
 *         description: Loan status updated successfully
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
 *                     status:
 *                       type: string
 *                     repaymentAmount:
 *                       type: number
 *                       nullable: true
 *                     monthlyInstallment:
 *                       type: number
 *                       nullable: true
 *                     approvedAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *       400:
 *         description: Loan not in PENDING status or invalid status provided
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin or Treasurer access required
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put(
    '/:id/approve',
    checkLoanPermission([MembershipRole.ADMIN, MembershipRole.TREASURER]),
    loanValidator.approveLoanValidator,
    loanController.approveOrRejectLoan
);

/**
 * @swagger
 * /loans/{id}/disburse:
 *   put:
 *     tags: [Loans]
 *     summary: Disburse loan funds
 *     description: |
 *       Marks an APPROVED loan as disbursed. Treasurer only.
 *       
 *       Actions performed:
 *       - Updates loan status to ACTIVE
 *       - Sets disbursedAt timestamp
 *       - Sets first dueDate (1 month from disbursement)
 *       - Creates LOAN_DISBURSEMENT transaction (debit)
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
 *         description: Loan disbursed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                   example: Loan disbursed successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: ACTIVE
 *                     disbursedAt:
 *                       type: string
 *                       format: date-time
 *                     dueDate:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Loan not in APPROVED status
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Treasurer access required
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put(
    '/:id/disburse',
    checkLoanPermission([MembershipRole.TREASURER]),
    loanController.disburseLoan
);

/**
 * @swagger
 * /loans/{id}/restructure:
 *   put:
 *     tags: [Loans]
 *     summary: Restructure loan terms
 *     description: |
 *       Modifies the terms of an existing loan. Admin/Treasurer only.
 *       
 *       Restructuring:
 *       - Updates interest rate and/or duration
 *       - Recalculates repayment amount and monthly installment
 *       - Marks loan as restructured
 *       - Records restructure notes
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
 *               - notes
 *             properties:
 *               newDuration:
 *                 type: integer
 *                 description: New loan duration in months (optional)
 *                 example: 18
 *               newInterestRate:
 *                 type: number
 *                 description: New interest rate as decimal (optional, e.g., 0.12 for 12%)
 *                 example: 0.08
 *               notes:
 *                 type: string
 *                 example: Requested extension due to financial hardship
 *                 description: Reason for restructuring (required)
 *     responses:
 *       200:
 *         description: Loan restructured successfully
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
 *                     interestRate:
 *                       type: number
 *                     duration:
 *                       type: integer
 *                     repaymentAmount:
 *                       type: number
 *                     monthlyInstallment:
 *                       type: number
 *                     isRestructured:
 *                       type: boolean
 *                       example: true
 *                     restructureNotes:
 *                       type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Admin or Treasurer access required
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put(
    '/:id/restructure',
    checkLoanPermission([MembershipRole.ADMIN, MembershipRole.TREASURER]),
    loanValidator.restructureLoanValidator,
    loanController.restructureLoan
);

export default router;