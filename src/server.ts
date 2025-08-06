import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import chamaRoutes from './routes/chama.routes';
import contributionRoutes from './routes/contribution.routes';
import loanRoutes from './routes/loan.routes';
import reportRoutes from './routes/report.routes';
import mpesaRoutes from './routes/mpesa.routes';
import meetingRoutes from './routes/meeting.routes'
// Todo -  import { errorHandler } from './middleware/error.middleware';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- Global Middleware ---
// Enable CORS with specified origins
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || 'http://localhost:3000'
}));

// Secure apps by setting various HTTP headers
app.use(helmet());

// Logger for HTTP requests
app.use(morgan('dev'));

// Parse JSON bodies
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

// --- Health Check Endpoint ---
app.get('/', (req, res) => {
  res.send('Chama-API is up and running!');
});

// --- Error Handling Middleware ---
// This should be the last middleware
// Todo -  app.use(errorHandler); //  will add this later when I create the middleware

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});