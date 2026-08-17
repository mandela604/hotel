const Room = require('../models/Room');
const Booking = require('../models/Booking');
const asyncHandler = require('../middleware/asyncHandler');

exports.listRooms = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const rooms = await Room.find(filter);
  res.json(rooms);
});

exports.getRoom = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room) return res.status(404).json({ message: 'Room not found' });
  res.json(room);
});

exports.updateRoom = asyncHandler(async (req, res) => {
  const { status, rate, type } = req.body;
  const room = await Room.findByIdAndUpdate(
    req.params.id,
    { status, rate, type },
    { new: true, runValidators: true }
  );
  if (!room) return res.status(404).json({ message: 'Room not found' });
  res.json(room);
});

exports.listBookings = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const bookings = await Booking.find(filter);
  res.json(bookings);
});

exports.getBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  res.json(booking);
});

exports.createBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.create({
    _id: 'BK-' + Date.now(),
    ...req.body,
    status: 'Booked',
  });
  await Room.findByIdAndUpdate(req.body.room, { status: 'occupied' });
  res.status(201).json(booking);
});

exports.updateBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  res.json(booking);
});

exports.checkout = asyncHandler(async (req, res) => {
  const booking = await Booking.findByIdAndUpdate(
    req.params.id,
    { status: 'Checked Out' },
    { new: true }
  );
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  await Room.findByIdAndUpdate(booking.room, { status: 'available' });
  res.json(booking);
});
