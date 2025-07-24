import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
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