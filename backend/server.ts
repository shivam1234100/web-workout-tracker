// Load .env before anything else so route modules see the variables at import time
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import workoutRoutes from './routes/workout';
import aiRoutes from './routes/ai';
import summaryRoutes from './routes/summary';

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.JWT_SECRET) {
    console.error('JWT_SECRET must be set in production');
    process.exit(1);
}
if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// FRONTEND_URL may be a comma-separated list of allowed origins
const allowedOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map(o => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

app.use(cors({
    origin: allowedOrigins.length > 0
        ? [...allowedOrigins, 'http://localhost:5173']
        : true,
    credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/auth', authRoutes);
app.use('/workouts', workoutRoutes);
app.use('/ai', aiRoutes);
app.use('/summary', summaryRoutes);

app.get('/', (req, res) => {
    res.send('AI Workout Tracker API is running');
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
