import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation.middleware';
import { MembershipRole } from '../generated/prisma/client';

export const createChamaValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Chama name is required.')
    .isLength({ min: 3 })
    .withMessage('Chama name must be at least 3 characters long.'),

  body('description')
    .optional()
    .trim()
    .isString(),

  body('monthlyContribution')
    .isFloat({ gt: 0 })
    .withMessage('Monthly contribution must be a positive number.'),

  body('meetingDay')
    .trim()
    .notEmpty()
    .withMessage('Meeting day description is required (e.g., "Last Sunday of the month").'),

  handleValidationErrors,
];

export const updateChamaValidator = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Chama name cannot be empty.')
    .isLength({ min: 3 })
    .withMessage('Chama name must be at least 3 characters long.'),

  body('description')
    .optional()
    .trim()
    .isString(),

  body('monthlyContribution')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('Monthly contribution must be a positive number.'),

  body('meetingDay')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Meeting day description cannot be empty.'),

  handleValidationErrors,
];

export const inviteMemberValidator = [
  body('email')
    .isEmail()
    .withMessage('A valid email address is required to invite a member.'),

  handleValidationErrors,
];

export const updateRoleValidator = [
  body('role')
    .isIn(Object.values(MembershipRole))
    .withMessage(`Invalid role specified. Must be one of: ${Object.values(MembershipRole).join(', ')}`),

  handleValidationErrors,
];