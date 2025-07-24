import { PrismaClient } from '../../generated/prisma';

// This file uses "declaration merging" to add custom properties to the Express Request object.
declare global {
  namespace Express {
    export interface Request {
      // These properties are now optional on EVERY request object.
      // They will be undefined until our middleware assigns them.
      user?: { id: string };
      prisma?: PrismaClient;
    }
  }
}