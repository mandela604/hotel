const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set in .env');

  mongoose.set('strictQuery', true);
  const conn = await mongoose.connect(uri, {
    autoIndex: process.env.NODE_ENV !== 'production',
  });

  console.log(`[db] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);

  // Drop stale collection-level validator on bookings (enum on 'type' was
  // removed from the Mongoose schema but persists in MongoDB).
  try {
    await conn.connection.db.command({ collMod: 'bookings', validationLevel: 'off' });
    console.log('[db] Set validationLevel=off on bookings');
  } catch (err) {
    console.log('[db] collMod skip:', err.message);
  }

  mongoose.connection.on('error', (err) => {
    console.error('[db] MongoDB error:', err.message);
  });

  return conn;
}

module.exports = connectDB;
