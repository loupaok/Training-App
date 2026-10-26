import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import coachRoutes from './routes/coaches.js';
import clientRoutes from './routes/clients.js';
import adminRoutes from './routes/admin.js';
import subscriptionRoutes from './routes/subscriptions.js';
import progressRoutes from './routes/progress.js';
import trainingPlanRoutes from './routes/trainingPlans.js';
import nutritionPlanRoutes from './routes/nutritionPlans.js';
import repsRoutes from './routes/reps.js';
import exerciseRoutes from './routes/exercises.js';
import mediaRoutes from './routes/media.js';
import mediaExerciseRoutes from './routes/mediaExercises.js';
import mediaFoodRoutes from './routes/mediaFoods.js';
import clientDashboardRoutes from './routes/clientDashboard.js';
import clientAppRoutes from './routes/client.js';
import pricingPlanRoutes from './routes/pricingPlans.js';
import manualNotificationRoutes from './routes/manualNotifications.js';
import templateRoutes from './routes/templates.js';
import foodRoutes from './routes/foods.js';
import supplementRoutes from './routes/supplements.js';
import questionnaireRoutes from './routes/questionnaire.js';
import registerRoutes from './routes/register.js';
import brandingRoutes from './routes/branding.js';
import weeklyUpdateRoutes from './routes/weekly-updates.js';
import settingsRoutes from './routes/settings.js';
import pointsRoutes from './routes/points.js';
import discordRoutes from './routes/discord.js';
import analyticsRoutes from './routes/analytics.js';
import cycleRoutes from './routes/cycles.js';
import nutritionCycleRoutes from './routes/nutrition-cycle.js';
import clientNutritionCycleRoutes from './routes/client-nutrition-cycle.js';
import discordSettingsRoutes from './routes/discord-settings.js';
import { authenticateToken, isClient, isCoach } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
}
const configuredOrigins = new Set([
  ...(process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  // Native Capacitor web views do not use a normal HTTPS browser origin.
  'capacitor://localhost',
  'ionic://localhost',
]);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT_MAX || 600),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Fast Refresh and React Strict Mode deliberately repeat bootstrap requests.
  // Keep local development usable while retaining rate limiting in production.
  skip: () => !isProduction,
  message: { message: 'Too many requests. Please try again later.' },
});

const authenticationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 10),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => !isProduction,
  message: { message: 'Too many authentication attempts. Please try again later.' },
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.UPLOAD_RATE_LIMIT_MAX || 40),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: (req) => !isProduction || !req.is('multipart/form-data'),
  message: { message: 'Too many uploads. Please try again later.' },
});

// Middleware
app.use(cors({
  origin(origin, callback) {
    // Requests without an Origin header include native apps and server-to-server jobs.
    if (!origin || configuredOrigins.has(origin)) return callback(null, true);
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use('/api', apiLimiter);
app.use(['/api/auth/login', '/api/register'], authenticationLimiter);
app.use('/api', uploadLimiter);
const bodyLimit = process.env.JSON_BODY_LIMIT || '1mb';
app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

// Serve uploaded files
app.use('/uploads', express.static('uploads', {
  setHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=86400');
  },
}));

// Database connection pool
export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Without this, mysql2 returns every DECIMAL column (weight_kg, price,
  // amount, ...) as a string like "50.00" instead of the number 50 — this
  // fixes it everywhere at once instead of converting each query by hand.
  decimalNumbers: true
});

// Test database connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✓ Database connected successfully');
    connection.release();
  } catch (err) {
    console.error('✗ Database connection failed:', err.message);
    process.exit(1);
  }
}

testConnection();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/coaches', authenticateToken, isCoach, coachRoutes);
app.use('/api/clients', authenticateToken, clientRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/subscriptions', authenticateToken, subscriptionRoutes);
app.use('/api/progress', authenticateToken, progressRoutes);
app.use('/api/training-plans', authenticateToken, trainingPlanRoutes);
app.use('/api/nutrition-plans', authenticateToken, nutritionCycleRoutes);
app.use('/api/nutrition-plans', authenticateToken, nutritionPlanRoutes);
app.use('/api/reps', authenticateToken, repsRoutes);
app.use('/api/exercises', authenticateToken, exerciseRoutes);
app.use('/api/media', authenticateToken, mediaExerciseRoutes);
app.use('/api/media', authenticateToken, mediaFoodRoutes);
app.use('/api/media', authenticateToken, mediaRoutes);
app.use('/api/client-dashboard', authenticateToken, isClient, clientDashboardRoutes);
app.use('/api/client', authenticateToken, clientAppRoutes);
app.use('/api/my/nutrition', authenticateToken, clientNutritionCycleRoutes);
// No blanket auth here — GET / is public (pricing page), everything else is
// gated per-route inside pricingPlans.js with authenticateToken + authorizeRole.
app.use('/api/pricing-plans', pricingPlanRoutes);
app.use('/api/manual-notifications', authenticateToken, manualNotificationRoutes);
app.use('/api/templates', authenticateToken, templateRoutes);
app.use('/api/foods', authenticateToken, foodRoutes);
app.use('/api/supplements', authenticateToken, supplementRoutes);
// Public GET (active questions) + coach-gated CRUD handled per-route inside.
app.use('/api/questionnaire', questionnaireRoutes);
// Fully public — new client signup, email-availability check, bank details.
app.use('/api', registerRoutes);
app.use('/api/branding', brandingRoutes);
app.use('/api/updates', authenticateToken, weeklyUpdateRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/points', pointsRoutes);
app.use('/api/discord', discordRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/cycles', cycleRoutes);
app.use('/api/discord-settings', discordSettingsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  import('./crons.js');
  import('./lib/discord.js').then(({ getActiveRoleId }) => getActiveRoleId()).catch(() => {});
});
