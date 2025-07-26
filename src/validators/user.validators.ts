import { body } from 'express-validator';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

// Custom validator for Kenyan phone numbers
const isKenyanPhoneNumber = (value: string) => {
  try {
    const phoneNumber = parsePhoneNumberFromString(value, 'KE');
    if (phoneNumber && phoneNumber.isValid()) {
      return true;
    }
  } catch (error) {
    return false;
  }
  return false;
};

export const registerValidator = [
  body('email', 'A valid email is required').isEmail().normalizeEmail(),
  body('firstName', 'First name is required').notEmpty().trim().escape(),
  body('lastName', 'Last name is required').notEmpty().trim().escape(),
  body('idNumber', 'A valid ID number is required').isString().notEmpty(),
  body('phone', 'A valid Kenyan phone number is required (+254... or 07...)')
    .custom(isKenyanPhoneNumber),
  body('password', 'Password must be at least 6 characters long').isLength({ min: 6 }),
];

export const loginValidator = [
  body('email', 'A valid email is required').isEmail().normalizeEmail(),
  body('password', 'Password cannot be empty').notEmpty(),
];

export const passwordResetValidator = [
  body('email', 'A valid email is required').isEmail().normalizeEmail(),
];

export const resetPasswordConfirmationValidator = [
  body('token', 'Token is required').notEmpty(),
  body('newPassword', 'New password must be at least 6 characters long').isLength({ min: 6 }),
];

export const profileUpdateValidator = [
    body('email', 'A valid email is required').optional().isEmail().normalizeEmail(),
    body('firstName').optional().notEmpty().trim().escape(),
    body('lastName').optional().notEmpty().trim().escape(),
    body('phone', 'A valid Kenyan phone number is required')
        .optional()
        .custom(isKenyanPhoneNumber),
];