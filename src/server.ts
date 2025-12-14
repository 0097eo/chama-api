import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import pinoHttp from 'pino-http';
import logger from './config/logger';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import chamaRoutes from './routes/chama.routes';
import contributionRoutes from './routes/contribution.routes';
import loanRoutes from './routes/loan.routes';
import reportRoutes from './routes/report.routes';
import mpesaRoutes from './routes/mpesa.routes';
import meetingRoutes from './routes/meeting.routes'
import notificationRoutes from './routes/notification.routes';
import fileRoutes from './routes/files.routes';
import auditRoutes from './routes/audit.routes';
import { WebSocketServer } from './websocket.server';
import { createServer } from 'http';
import { errorHandler } from './middleware/error.middleware';

dotenv.config();

export const app = express();
export const server = createServer(app);

const wsServer = new WebSocketServer(server);

const PORT = process.env.PORT || 3000;

// --- Global Middleware ---
// Add pino-http middleware first for request logging
app.use(pinoHttp({
  logger: logger,
  customLogLevel: function (req, res, err) {
    if (res.statusCode >= 400 && res.statusCode < 500) {
      return 'warn';
    }
    if (res.statusCode >= 500 || err) {
      return 'error';
    }
    return 'info';
  },
  customSuccessMessage: function (req, res) {
    if (res.statusCode === 404) {
      return 'Resource not found';
    }
    return `${req.method} request completed successfully`;
  },
  customErrorMessage: function (req, res, err) {
    return `Request failed due to ${err?.message || 'unknown error'}`; 
  },
  wrapSerializers: false,
  autoLogging: true,
  // Exclude health check from verbose logging if desired
  // genReqId: function (req, res) { return req.id },
  // redact: ['req.headers.authorization'], // Redact sensitive headers
}));

app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || 'http://localhost:3000',
  credentials: true,
}));

app.use(helmet());
// Remove morgan as pino-http handles request logging
// app.use(morgan('dev')); 
app.use(express.json());

// --- API Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chamas', chamaRoutes);
app.use('/api/contributions', contributionRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/payments', mpesaRoutes);
app.use('/api/meetings', meetingRoutes)
app.use('/api/notifications', notificationRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/audit', auditRoutes);

// --- Health Check Endpoint ---
app.get('/', (req, res) => {
  res.send('Chama-API is up and running!');
});

// --- Error Handler (MUST be last) ---
app.use(errorHandler);

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info('WebSocket server initialized');
});