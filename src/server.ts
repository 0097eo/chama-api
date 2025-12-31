import dotenv from 'dotenv';
dotenv.config();

import './instrument';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { Sentry } from './instrument';
import logger from './config/logger';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import chamaRoutes from './routes/chama.routes';
import contributionRoutes from './routes/contribution.routes';
import loanRoutes from './routes/loan.routes';
import reportRoutes from './routes/report.routes';
import mpesaRoutes from './routes/mpesa.routes';
import meetingRoutes from './routes/meeting.routes';
import notificationRoutes from './routes/notification.routes';
import fileRoutes from './routes/files.routes';
import auditRoutes from './routes/audit.routes';
import { WebSocketServer } from './websocket.server';
import { createServer } from 'http';
import { errorHandler } from './middleware/error.middleware';
import swaggerDocs from './utils/swagger';

export const app = express();
export const server = createServer(app);

new WebSocketServer(server);

const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(pinoHttp({
  logger,
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 400 && res.statusCode < 500) return 'warn';
    if (res.statusCode >= 500 || err) return 'error';
    return 'info';
  },
  customSuccessMessage: (req, res) => {
    if (res.statusCode === 404) return 'Resource not found';
    return `${req.method} request completed`;
  },
  customErrorMessage: (req, res, err) => {
    return `Request failed: ${err?.message || 'unknown error'}`;
  },
  wrapSerializers: false,
  autoLogging: true,
}));

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || ['*'];

    if (allowedOrigins.includes('*')) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 600,
}));

app.use(helmet());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chamas', chamaRoutes);
app.use('/api/contributions', contributionRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/payments', mpesaRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/audit', auditRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.send('Chama-API is up and running!');
});

if (process.env.NODE_ENV !== 'production') {
  app.get('/sentry-test', (req, res) => {
    throw new Error('Sentry test error');
  });
}

Sentry.setupExpressErrorHandler(app);

app.use(errorHandler);

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info('WebSocket server initialized');
  swaggerDocs(app, PORT);
});