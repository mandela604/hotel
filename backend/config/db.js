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
    const db = conn.connection.db;
    // Check if a validator exists first
    const collInfo = await db.listCollections({ name: 'bookings' }).toArray();
    const opts = collInfo[0] && collInfo[0].options;
    const hasValidator = opts && opts.validator && Object.keys(opts.validator).length > 0;
    if (hasValidator) {
      console.log('[db] Found bookings collection validator — removing...');
      await db.command({
        collMod: 'bookings',
        validator: { $jsonSchema: { bsonType: 'object' } },
        validationLevel: 'off',
        validationAction: 'warn',
      });
      console.log('[db] Bookings collection validator cleared');
    } else {
      console.log('[db] No bookings collection validator found');
    }
  } catch (err) {
    console.error('[db] collMod error:', err.message);
    console.log('[db] TIP: Run this in MongoDB Atlas shell to fix manually:');
    console.log('[db]   db.runCommand({ collMod: "bookings", validationLevel: "off" })');
  }

  mongoose.connection.on('error', (err) => {
    console.error('[db] MongoDB error:', err.message);
  });

  return conn;
}

module.exports = connectDB;
