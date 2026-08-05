const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not set. Copy .env.example to .env and configure it.');
  }

  mongoose.set('strictQuery', true);

  const conn = await mongoose.connect(uri, {
    // Modern mongoose (8.x) no longer needs useNewUrlParser/useUnifiedTopology,
    // but autoIndex is worth being explicit about per environment.
    autoIndex: process.env.NODE_ENV !== 'production',
  });

  console.log(`[db] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);

  mongoose.connection.on('error', (err) => {
    console.error('[db] MongoDB connection error:', err.message);
  });

  return conn;
}

module.exports = connectDB;
