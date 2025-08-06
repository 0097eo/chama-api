import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation.middleware';

export const scheduleMeetingValidator = [
  body('chamaId').isString().notEmpty().withMessage('Chama ID is required.'),
  body('title').isString().notEmpty().withMessage('Meeting title is required.'),
  body('agenda').isString().notEmpty().withMessage('Meeting agenda is required.'),
  body('location').isString().notEmpty().withMessage('Meeting location is required.'),
  body('scheduledFor').isISO8601().toDate().withMessage('A valid meeting date and time are required.'),
  handleValidationErrors,
];

export const updateMeetingValidator = [
  body('title').optional().isString().notEmpty(),
  body('agenda').optional().isString().notEmpty(),
  body('location').optional().isString().notEmpty(),
  body('scheduledFor').optional().isISO8601().toDate(),
  handleValidationErrors,
];

export const saveMinutesValidator = [
  body('minutes').isString().notEmpty().withMessage('Meeting minutes cannot be empty.'),
  handleValidationErrors,
];