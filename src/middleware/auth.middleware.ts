import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.utils';
import { PrismaClient } from '@prisma/client';
import { JwtPayload } from 'jsonwebtoken';

const prisma = new PrismaClient();

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = verifyToken(token);
      
      if (!decoded || typeof decoded !== 'object') {
        return res.status(401).json({ success: false, message: 'Not authorized, token invalid' });
      }
      
      const userId = (decoded as JwtPayload).id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Not authorized, token invalid' });
      }

      const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });

      if (!user) {
        return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
      }

      req.user = user;
      
      next();
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }
};