require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

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
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const server = http.createServer(app);
const ALLOWED_DEPTS = new Set(['booking','restaurant','poolbar','kitchen','store','procurement','accounting','gym','global']);
function getJwtSecret() { return process.env.JWT_SECRET || ''; }
function parseSocketToken(socket) {
  try {
    const hdr = socket.handshake.headers.cookie || '';
    const m = hdr.match(/(?:^|;\s*)token=([^;]+)/);
    if (m) return decodeURIComponent(m[1]);
  } catch(e){}
  return socket.handshake.auth && socket.handshake.auth.token ? socket.handshake.auth.token : null;
}
const io = new Server(server, {
  cors: {
    origin: (process.env.CORS_ORIGIN || '').split(',').map(s=>s.trim()).filter(Boolean).length ? (process.env.CORS_ORIGIN || '').split(',').map(s=>s.trim()) : true,
    credentials: true
  }
});
app.set('io', io);
io.use(async (socket, next) => {
  try {
    const token = parseSocketToken(socket);
    const secret = getJwtSecret();
    if (!token || !secret) return next(new Error('unauthorized'));
    const decoded = jwt.verify(token, secret);
    const user = await User.findOne({ id: decoded.id }).select('-password');
    if (!user || user.status === 'inactive') return next(new Error('unauthorized'));
    socket.data.user = { id: user.id, name: user.name, role: user.role, dept: user.dept || '' };
    next();
  } catch(e) { next(new Error('unauthorized')); }
});
io.on('connection', (socket) => {
  const rawDept = (socket.handshake.query.dept || socket.handshake.auth?.dept || socket.data?.user?.dept || '').toString().toLowerCase();
  const dept = ALLOWED_DEPTS.has(rawDept) ? rawDept : '';
  if (dept) socket.join(dept);
  socket.join('global');
  socket.on('join', (room) => {
    const r = String(room||'').toLowerCase().trim();
    if (ALLOWED_DEPTS.has(r)) socket.join(r);
  });
  socket.on('disconnect', () => {});
});
io.engine.on('connection_error', (err) => {
  console.warn('[ws] connection_error', err.code, err.message);
});
app.use(cookieParser());

app.use(helmet(helmetConfig));
app.use(express.json({ limit: '2mb' }));
const corsOrigins = (process.env.CORS_ORIGIN || '').split(',').map(s=>s.trim()).filter(Boolean);
app.use(cors({ origin: corsOrigins.length ? corsOrigins : true, credentials: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Root always serves the login page — the frontend redirects to the
// dashboard only after a successful login. Matches the behavior of the
// rest of the suite (visit the site → login first, always).
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'login.html')));

app.use(express.static(PUBLIC_DIR));

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
app.use('/api/foodmenu', auth, require('./routes/foodMenu'));
app.use('/api/kitchen', auth, require('./routes/kitchen'));
app.use('/api/gym', auth, require('./routes/gym'));
app.use('/api/store', auth, require('./routes/store'));
app.use('/api/staff', auth, require('./routes/staff'));
app.use('/api/procurement', auth, require('./routes/procurement'));
app.use('/api/accounting', auth, require('./routes/accounting'));
app.use('/api/activity', auth, require('./routes/activity'));
app.use('/api/settings', auth, require('./routes/settings'));
app.use('/api/room-categories', auth, require('./routes/roomCategories'));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

async function start() {
  await connectDB();
  server.listen(PORT, () => console.log(`[server] Aurum Hotel API + WS on port ${PORT}`));
}

function shutdown(signal) {
  console.log(`[server] ${signal} received, closing...`);
  io.close(() => {
    server.close(() => {
      console.log('[server] closed');
      process.exit(0);
    });
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

if (require.main === module) {
  start().catch((err) => { console.error('[server] Failed:', err); process.exit(1); });
}

module.exports = app;