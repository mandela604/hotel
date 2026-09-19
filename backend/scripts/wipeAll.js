/**
 * WIPE ALL DATA — run once, deletes everything.
 * Usage: node backend/scripts/wipeAll.js
 */
const mongoose = require('mongoose');
require('dotenv').config({ requireEnvVariables: false });

const COLLECTIONS = [
  'bookings', 'rooms', 'guests', 'orders', 'sales', 'movements',
  'transfers', 'requisitions', 'restaurantstocks', 'poolbarstocks',
  'kitchenstocks', 'storestocks', 'recipes', 'purchaseorders',
  'purchaserequests', 'kitchencooorders', 'productions', 'users',
  'menuitems', 'activities', 'settings',
];

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }
  await mongoose.connect(uri);
  console.log('Connected. Wiping all collections...');

  const db = mongoose.connection.db;
  for (const col of COLLECTIONS) {
    const result = await db.collection(col).deleteMany({});
    console.log(`  ${col}: ${result.deletedCount} deleted`);
  }

  console.log('Done.');
  await mongoose.disconnect();
})();
