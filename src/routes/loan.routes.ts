import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { checkMembership } from '../middleware/membership.middleware';
import { checkLoanPermission } from '../middleware/permission.middleware';
import * as loanController from '../controllers/loan.controller';
import * as loanValidator from '../validators/loan.validators';
import { MembershipRole } from '../generated/prisma/client';

const router = Router();

router.use(protect);

// POST /api/loans - Any authenticated user can apply for a loan for their own membership.
router.post(
    '/',
    loanValidator.applyLoanValidator,
    loanController.applyForLoan
);


// GET /api/loans/chama/:chamaId - Admin/Treasurer/Secretary can view all loans in a chama.
router.get(
    '/chama/:chamaId',
    checkMembership([MembershipRole.ADMIN, MembershipRole.TREASURER, MembershipRole.SECRETARY]),
    loanController.getChamaLoans
);

// GET /api/loans/defaulters/:chamaId - Admin/Treasurer can see loan defaulters for a chama.
router.get(
    '/defaulters/:chamaId',
    checkMembership([MembershipRole.ADMIN, MembershipRole.TREASURER]),
    loanController.getLoanDefaulters
);


// GET /api/loans/member/:membershipId - A member can see their own loans, or an admin can see any.
router.get('/member/:membershipId', loanController.getMemberLoans);


// GET /api/loans/:id/schedule - The loan owner or an admin can see the repayment schedule.
router.get('/:id/schedule', loanController.getRepaymentSchedule);

// POST /api/loans/:id/payments - The loan owner or an admin can record a payment.
router.post(
    '/:id/payments',
    loanValidator.recordPaymentValidator,
    loanController.recordLoanPayment
);

// PUT /api/loans/:id/approve - Only Admin/Treasurer can approve or reject a loan.
router.put(
    '/:id/approve',
    checkLoanPermission([MembershipRole.ADMIN, MembershipRole.TREASURER]),
    loanValidator.approveLoanValidator,
    loanController.approveOrRejectLoan
);

// PUT /api/loans/:id/disburse - Only Treasurer can disburse funds for an approved loan.
router.put(
    '/:id/disburse',
    checkLoanPermission([MembershipRole.TREASURER]),
    loanController.disburseLoan
);

// PUT /api/loans/:id/restructure - Only Admin/Treasurer can restructure a loan's terms.
router.put(
    '/:id/restructure',
    checkLoanPermission([MembershipRole.ADMIN, MembershipRole.TREASURER]),
    loanValidator.restructureLoanValidator,
    loanController.restructureLoan
);


export default router;