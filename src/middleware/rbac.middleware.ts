import { Request, Response, NextFunction } from 'express';
import { PrismaClient, UserRole } from '../generated/prisma';

const prisma = new PrismaClient();

export const checkRole = (roles: Array<UserRole>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden: Insufficient permissions.' });
    }
    
    next();
  };
};