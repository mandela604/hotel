/**
 * Fix RSO-00057: Finalize the Room Charge order for Joshua (Room 204)
 * so the ₦4,000 Yellow Rice charge reflects on his folio.
 *
 * Run: node backend/scripts/finalizeRSO00057.js
 */
const mongoose = require('mongoose');
require('dotenv').config({ requireEnvVariables: false });

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const ordersCol = db.collection('orders');
  const salesCol  = db.collection('sales');
  const guestsCol = db.collection('guests');

  // 1. Find the order
  const order = await ordersCol.findOne({ id: 'RSO-00057' });
  if (!order) { console.error('Order RSO-00057 not found'); await mongoose.disconnect(); process.exit(1); }
  console.log('Order found:', JSON.stringify({ id: order.id, status: order.status, method: order.method, roomNumber: order.roomNumber, guestName: order.guestName, total: order.total }, null, 2));

  // 2. If already paid, skip
  if (order.status === 'paid') {
    console.log('Order already paid. Checking if folio charge exists...');
  }

  // 3. Find or create a sale record linked to this order
  let sale = await salesCol.findOne({ source: order.id });
  if (!sale) {
    const count = await salesCol.countDocuments({ department: 'restaurant' });
    const saleId = `RST-${String(count + 1).padStart(5, '0')}`;
    sale = {
      id: saleId,
      source: order.id,
      department: 'restaurant',
      items: (order.items || []).map(i => ({
        name: i.name || i.key || '',
        qty: Number(i.qty) || 1,
        price: Number(i.price) || 0,
      })),
      subtotal: order.subtotal || 0,
      discount: order.discount || 0,
      total: order.total || 0,
      method: 'Room Charge',
      staff: order.staff || '',
      table: order.table || '',
      notes: order.notes || '',
      date: new Date(),
      status: 'pending',
      roomNumber: order.roomNumber || null,
      guestName: order.guestName || null,
      guestPhone: order.guestPhone || null,
    };
    await salesCol.insertOne(sale);
    console.log('Created sale:', sale.id);
  } else {
    // Ensure sale is pending for Room Charge
    if (sale.status !== 'pending') {
      await salesCol.updateOne({ _id: sale._id }, { $set: { status: 'pending', method: 'Room Charge' } });
      console.log('Updated sale status to pending');
    }
    console.log('Existing sale:', sale.id);
  }

  // 4. Mark order as paid
  if (order.status !== 'paid') {
    await ordersCol.updateOne({ _id: order._id }, {
      $set: {
        status: 'paid',
        method: 'Room Charge',
        payMethod: 'Room Charge',
        paidSaleId: sale.id,
        processedBy: 'system-fix',
      }
    });
    console.log('Order RSO-00057 marked as paid');
  }

  // 5. Post charge to guest folio if not already there
  const roomNumber = order.roomNumber || (sale && sale.roomNumber) || '204';
  const guestName  = order.guestName  || (sale && sale.guestName)  || 'joshua';

  // Find guest by room booking
  let guest = null;
  const bookingsCol = db.collection('bookings');
  const booking = await bookingsCol.findOne({ room: String(roomNumber).trim(), status: 'checkedin' });
  if (booking && booking.guestId) {
    guest = await guestsCol.findOne({ id: booking.guestId });
    if (!guest) guest = await guestsCol.findOne({ guestId: booking.guestId });
  }
  if (!guest) guest = await guestsCol.findOne({ name: new RegExp(`^${guestName}$`, 'i') });
  if (!guest && booking && booking.phone) guest = await guestsCol.findOne({ phone: booking.phone });

  if (!guest) {
    console.error('Could not find guest for Room', roomNumber, '- name:', guestName);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log('Guest found:', guest.name, '(id:', guest.id, 'guestId:', guest.guestId, ')');

  // Check if charge already exists
  const alreadyCharged = (guest.charges || []).some(c => c.originalSaleId === sale.id || (c.room === String(roomNumber) && c.amount === (order.total || 0) && c.desc && c.desc.includes('Yellow')));
  if (alreadyCharged) {
    console.log('Charge already exists on guest folio. Skipping.');
  } else {
    const bRef = booking ? (booking.id || (booking._id ? booking._id.toString() : '')) : '';
    const charge = {
      id: require('uuid').v4(),
      bookingRef: bRef,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }),
      source: 'Restaurant',
      desc: (order.items || []).map(i => `${i.qty || 1}x ${i.name || i.key || 'Item'}`).join(', '),
      room: String(roomNumber),
      amount: order.total || 0,
      paid: 0,
      by: order.staff || 'system-fix',
      status: 'Pending',
      payments: [],
      originalSaleId: sale.id,
    };
    await guestsCol.updateOne({ _id: guest._id }, { $push: { charges: charge } });
    console.log('Posted ₦' + (order.total || 0) + ' charge to', guest.name, 'folio');
  }

  // 6. Summary
  const updatedGuest = await guestsCol.findOne({ _id: guest._id });
  const folioCount = (updatedGuest.charges || []).length;
  const pendingCount = (updatedGuest.charges || []).filter(c => c.status === 'Pending').length;
  console.log('\n=== DONE ===');
  console.log('Guest:', updatedGuest.name);
  console.log('Total folio charges:', folioCount);
  console.log('Pending charges:', pendingCount);
  console.log('Order RSO-00057 status: paid');

  await mongoose.disconnect();
})();
