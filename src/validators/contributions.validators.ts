import { body } from "express-validator";
import { handleValidationErrors } from "../middleware/validation.middleware";
import { ContributionStatus } from "@prisma/client";

export const recordContributionValidator = [
body('membershipId').isString().notEmpty().withMessage('Membership ID is required.'),
body('amount').isFloat({ gt: 0 }).withMessage('Contribution amount must be a positive number.'),
body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12.'),
body('year').isInt({ min: 2020, max: 2100 }).withMessage('Please provide a valid year.'),
body('paymentMethod').notEmpty().withMessage('Payment method is required.'),
body('paidAt').isISO8601().toDate().withMessage('A valid payment date is required.'),
handleValidationErrors,
];
export const updateContributionValidator = [
body('amount').optional().isFloat({ gt: 0 }).withMessage('Contribution amount must be a positive number.'),
body('paymentMethod').optional().notEmpty(),
body('status').optional().isIn(Object.values(ContributionStatus)),
handleValidationErrors,
];