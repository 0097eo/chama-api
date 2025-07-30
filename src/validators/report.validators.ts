import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation.middleware';

const validReportTypes = [
    'financial_summary',
    'contributions',
    'loans',
    'cashflow',
    'member_performance'
];

export const exportReportValidator = [
  body('reportType').isIn(validReportTypes).withMessage(`Report type must be one of: ${validReportTypes.join(', ')}`),
  body('format').isIn(['pdf', 'excel']).withMessage('Format must be either pdf or excel.'),
  body('startDate').optional().isISO8601().withMessage('Start date must be a valid date.'),
  body('endDate').optional().isISO8601().withMessage('End date must be a valid date.'),
  handleValidationErrors,
];