require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const apiKeyGuard = require('./middleware/apiKey');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// Module Routes
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const bookingRoutes = require('./routes/bookings');
const guestRoutes = require('./routes/guests');
const reportRoutes = require('./routes/reports');
const restaurantRoutes = require('./routes/restaurant');
const gymRoutes = require('./routes/gym');
const kitchenRoutes = require('./routes/kitchen');
const storeRoutes = require('./routes/store');
const procurementRoutes = require('./routes/procurement');
const accountingRoutes = require('./routes/accounting');
const staffRoutes = require('./routes/staff');
const settingsRoutes = require('./routes/settings');

const app = express();

// ── Security & parsing ──
app.use(helmet());
app.use(express.json({ limit: '1mb' }));

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    credentials: true,
  })
);

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '..', 'public')));

// Basic rate limiting on the whole API surface.
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use('/api', apiKeyGuard);

// ── Health check ──
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'aurum-booking-backend', time: new Date().toISOString() }));

// ── Routes ──
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/guests', guestRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/restaurant', restaurantRoutes);
app.use('/api/kitchen', kitchenRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/procurement', procurementRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/settings', settingsRoutes);

// Centralized Gym Routes (mounts /api/members, /api/plans, /api/checkins, /api/payments, /api/gym, etc.)
app.use('/api', gymRoutes);
app.use('/api/gym', gymRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[server] Aurum Booking API listening on port ${PORT}`);
  });
}

if (require.main === module) {
  start().catch((err) => {
    console.error('[server] Failed to start:', err);
    process.exit(1);
  });
}

module.exports = app;
