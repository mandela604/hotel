require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');

// Helmet's default Content-Security-Policy (`script-src 'self'`) blocks
// every inline <script> block this app's static HTML pages rely on.
// Disable that one policy so the frontend works; keep the rest of
// helmet's response headers (X-Frame-Options, nosniff, etc.).
const helmetConfig = {
  contentSecurityPolicy: false,
};
const auth = require('./middleware/auth');
const sanitize = require('./middleware/sanitize');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
app.use(cookieParser());

app.use(helmet(helmetConfig));
app.use(express.json({ limit: '2mb' }));
app.use(cors({ origin: process.env.CORS_ORIGIN || true, credentials: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false }));
app.use('/api', sanitize); // strip Mongo operators + trim/sanitize all incoming strings

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'aurum-hotel', time: new Date().toISOString() }));

app.use('/api/auth', require('./routes/auth'));

app.use('/api/dashboard', auth, require('./routes/dashboard'));
// FIX: was mounted 3x at /api/rooms, /api/bookings, /api/guests — none of
// which match booking-service.js's CONFIG.API_BASE ('/api/booking',
// singular). Every prod-mode booking call 404'd. routes/bookings.js
// already defines its own /rooms, /bookings/:room, /guests/:id paths
// internally, so it needs exactly ONE mount point, matching every other
// module's single-mount convention (kitchen, restaurant, gym, poolbar).
app.use('/api/booking', auth, require('./routes/bookings'));
app.use('/api/restaurant', auth, require('./routes/restaurant'));
app.use('/api/poolbar', auth, require('./routes/poolbar'));
app.use('/api/kitchen', auth, require('./routes/kitchen'));
app.use('/api/gym', auth, require('./routes/gym'));
app.use('/api/store', auth, require('./routes/store'));
app.use('/api/staff', auth, require('./routes/staff'));
app.use('/api/procurement', auth, require('./routes/procurement'));
app.use('/api/accounting', auth, require('./routes/accounting'));
app.use('/api/activity', auth, require('./routes/activity'));
app.use('/api/settings', auth, require('./routes/settings'));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

async function start() {
  await connectDB();
  app.listen(PORT, () => console.log(`[server] Aurum Hotel API on port ${PORT}`));
}

if (require.main === module) {
  start().catch((err) => { console.error('[server] Failed:', err); process.exit(1); });
}

module.exports = app;