import { body } from "express-validator";
import { handleValidationErrors } from "../middleware/validation.middleware";
import { LoanStatus } from "../generated/prisma";

export const applyLoanValidator = [
  body('membershipId').isString().notEmpty().withMessage('Membership ID is required.'),
  body('amount').isFloat({ gt: 0 }).withMessage('Loan amount must be a positive number.'),
  body('duration').isInt({ gt: 0 }).withMessage('Duration must be a positive number of months.'),
  body('purpose').isString().notEmpty().withMessage('Loan purpose is required.'),
  body('interestRate').isFloat({ min: 0 }).withMessage('Interest rate is required.'),
  handleValidationErrors,
];

export const approveLoanValidator = [
  body('status').isIn([LoanStatus.APPROVED, LoanStatus.REJECTED]).withMessage('Status must be either APPROVED or REJECTED.'),
  handleValidationErrors,
];

export const recordPaymentValidator = [
  body('amount').isFloat({ gt: 0 }).withMessage('Payment amount must be a positive number.'),
  body('paymentMethod').isString().notEmpty().withMessage('Payment method is required.'),
  handleValidationErrors,
];

export const restructureLoanValidator = [
  body('newInterestRate').optional().isFloat({ min: 0 }),
  body('newDuration').optional().isInt({ gt: 0 }),
  body('notes').isString().notEmpty().withMessage('Restructure notes are required.'),
  handleValidationErrors,
];