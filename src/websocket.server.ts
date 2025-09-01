import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

interface AuthenticatedSocket {
  userId: string;
  membershipIds: string[];
}

export class WebSocketServer {
  private io: Server;
  private connectedUsers = new Map<string, string>(); // userId -> socketId
  private static instance: WebSocketServer;

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGINS?.split(',') || ["http://localhost:3000"],
        methods: ["GET", "POST"]
      }
    });

    this.setupAuthentication();
    this.setupConnectionHandlers();
    WebSocketServer.instance = this;
  }

  public static getInstance(): WebSocketServer {
    return WebSocketServer.instance;
  }

  private setupAuthentication() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // For NextAuth, decode the JWT to get user ID
        let userId: string;
        try {
          // Try NextAuth JWT format first
          const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as any;
          userId = decoded.id || decoded.sub;
        } catch (nextAuthError) {
          // Fallback to regular JWT if NextAuth fails
          try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
            userId = decoded.id;
          } catch (jwtError) {
            return next(new Error('Invalid authentication token'));
          }
        }

        if (!userId) {
          return next(new Error('User ID not found in token'));
        }
        
        // Get user's memberships to know which chamas they belong to
        const memberships = await prisma.membership.findMany({
          where: { userId, isActive: true },
          select: { id: true, chamaId: true }
        });

        (socket as any).auth = {
          userId,
          membershipIds: memberships.map(m => m.id),
          chamaIds: memberships.map(m => m.chamaId)
        };

        next();
      } catch (error) {
        console.error('WebSocket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupConnectionHandlers() {
    this.io.on('connection', (socket) => {
      const auth = (socket as any).auth as AuthenticatedSocket & { chamaIds: string[] };
      
      console.log(`User ${auth.userId} connected`);
      
      // Store connection
      this.connectedUsers.set(auth.userId, socket.id);
      
      // Join user-specific room
      socket.join(`user:${auth.userId}`);
      
      // Join chama-specific rooms
      auth.chamaIds.forEach(chamaId => {
        socket.join(`chama:${chamaId}`);
      });

      socket.on('disconnect', () => {
        console.log(`User ${auth.userId} disconnected`);
        this.connectedUsers.delete(auth.userId);
      });

      // Handle marking notifications as read in real-time
      socket.on('mark_notification_read', (notificationId: string) => {
        socket.to(`user:${auth.userId}`).emit('notification_read', { notificationId });
      });
    });
  }

  // Send notification to specific user
  public sendToUser(userId: string, event: string, data: any) {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  // Send notification to all members of a chama
  public sendToChama(chamaId: string, event: string, data: any) {
    this.io.to(`chama:${chamaId}`).emit(event, data);
  }

  // Send to multiple users
  public sendToUsers(userIds: string[], event: string, data: any) {
    userIds.forEach(userId => {
      this.io.to(`user:${userId}`).emit(event, data);
    });
  }

  // Check if user is online
  public isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  // Get online users count for a chama
  public async getOnlineUsersInChama(chamaId: string): Promise<string[]> {
    const sockets = await this.io.in(`chama:${chamaId}`).fetchSockets();
    return sockets.map(socket => (socket as any).auth.userId);
  }
}