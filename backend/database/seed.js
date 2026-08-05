/**
 * Grace Hotel — Database Seeder
 * Populates MongoDB with demo data on first run.
 * Run: npm run seed
 */

const { connectDB } = require('../config/database');
const models = require('./models');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

async function seed() {
  await connectDB();

  // Clear existing data
  await Promise.all(
    Object.values(models).map((m) => m.deleteMany({}).catch((e) => {
      console.error(`[Seed] Failed to clear ${m.modelName}:`, e.message);
    }))
  );

  console.log('[Seed] Cleared all collections.');

  // Roles
  await models.Role.insertMany([
    { id: uuidv4(), name: 'owner', description: 'Full system owner', permissions: ['*'], level: 99 },
    { id: uuidv4(), name: 'gm', description: 'General Manager', permissions: ['all'], level: 90 },
    { id: uuidv4(), name: 'md', description: 'Managing Director', permissions: ['all'], level: 95 },
    { id: uuidv4(), name: 'accountant', description: 'Finance', permissions: ['accounting','reports'], level: 60 },
    { id: uuidv4(), name: 'procurement_manager', description: 'Procurement', permissions: ['procurement','store','reports'], level: 70 },
    { id: uuidv4(), name: 'sales_rep', description: 'Front Office', permissions: ['booking','guests','sales'], level: 40 },
    { id: uuidv4(), name: 'kitchen_staff', description: 'Kitchen', permissions: ['kitchen','store'], level: 30 },
    { id: uuidv4(), name: 'restaurant_staff', description: 'Restaurant', permissions: ['restaurant','sales'], level: 30 },
    { id: uuidv4(), name: 'poolbar_staff', description: 'Pool Bar', permissions: ['poolbar','sales'], level: 30 },
    { id: uuidv4(), name: 'store_staff', description: 'Store', permissions: ['store','requisitions'], level: 25 },
  ]);
  console.log('[Seed] Roles created.');

  // Users
  const defaultPassword = await bcrypt.hash('password123', 10);
  const users = [
    { id: uuidv4(), name: 'General Manager', email: 'gm@gracehotel.com', password: defaultPassword, role: 'gm', initials: 'GM', phone: '08010000001' },
    { id: uuidv4(), name: 'Managing Director', email: 'md@gracehotel.com', password: defaultPassword, role: 'md', initials: 'MD', phone: '08010000002' },
    { id: uuidv4(), name: 'Accountant', email: 'acct@gracehotel.com', password: defaultPassword, role: 'accountant', initials: 'AC', phone: '08010000003' },
    { id: uuidv4(), name: 'Procurement Manager', email: 'proc@gracehotel.com', password: defaultPassword, role: 'procurement_manager', initials: 'PM', phone: '08010000004' },
    { id: uuidv4(), name: 'Sales Rep', email: 'sales@gracehotel.com', password: defaultPassword, role: 'sales_rep', initials: 'SR', phone: '08010000005' },
    { id: uuidv4(), name: 'Kitchen Staff', email: 'kitchen@gracehotel.com', password: defaultPassword, role: 'kitchen_staff', initials: 'KS', phone: '08010000006' },
    { id: uuidv4(), name: 'Restaurant Staff', email: 'rest@gracehotel.com', password: defaultPassword, role: 'restaurant_staff', initials: 'RS', phone: '08010000007' },
    { id: uuidv4(), name: 'Pool Bar Staff', email: 'pool@gracehotel.com', password: defaultPassword, role: 'poolbar_staff', initials: 'PB', phone: '08010000008' },
    { id: uuidv4(), name: 'Store Staff', email: 'store@gracehotel.com', password: defaultPassword, role: 'store_staff', initials: 'SS', phone: '08010000009' },
  ];
  await models.User.insertMany(users);
  console.log('[Seed] Users created.');

  // Rooms
  const roomTypes = ['Standard','Deluxe','Deluxe','Suite','Standard','Standard','Conference','Presidential'];
  const rates = { Standard: 25000, Deluxe: 45000, Suite: 80000, Conference: 120000, Presidential: 250000 };
  const roomDocs = [];
  for (let floor = 1; floor <= 4; floor++) {
    for (let i = 1; i <= 12; i++) {
      const num = floor * 100 + i;
      const type = roomTypes[Math.floor(Math.random() * roomTypes.length)];
      roomDocs.push({
        id: uuidv4(),
        roomNumber: String(num),
        type,
        floor,
        rate: rates[type],
        capacity: type === 'Presidential' ? 6 : type === 'Suite' ? 4 : type === 'Conference' ? 20 : 2,
        amenities: ['WiFi','TV','AC','Mini Bar'],
        status: ['available','occupied','occupied','occupied','dirty','maintenance','reserved'][Math.floor(Math.random()*7)],
      });
    }
  }
  await models.Room.insertMany(roomDocs);
  console.log(`[Seed] ${roomDocs.length} rooms created.`);

  // Activity Log
  await models.ActivityLog.insertMany([
    { id: uuidv4(), department: 'Booking', action: 'check-in', description: 'Room 402 checked in — Barr. Musa (3 nights)', userName: 'GM', color: 'gold', href: '/booking.html' },
    { id: uuidv4(), department: 'Kitchen', action: 'production', description: 'PROD-00096 — 30 plates Fried Rice sent to Restaurant', userName: 'KS', color: 'purple', href: '/kitchen.html' },
    { id: uuidv4(), department: 'Procurement', action: 'request', description: 'PR-041 — Toiletries restock requested', userName: 'PM', color: 'cyan', href: '/procurement.html' },
    { id: uuidv4(), department: 'Restaurant', action: 'sale', description: 'SALE-1043 — ₦12,000 settled by Cash, Table 2', userName: 'RS', color: 'blue', href: '/restaurant.html' },
    { id: uuidv4(), department: 'Pool Bar', action: 'sale', description: 'PBS-1021 — 3x Heineken sold, ₦10,500', userName: 'PB', color: 'green', href: '/poolbar.html' },
  ]);
  console.log('[Seed] Activity log created.');

  // Menu Items
  await models.MenuItem.insertMany([
    { id: uuidv4(), name: 'Fried Rice', price: 3500, category: 'Main Course', department: 'restaurant', available: true },
    { id: uuidv4(), name: 'Jollof Rice', price: 3000, category: 'Main Course', department: 'restaurant', available: true },
    { id: uuidv4(), name: 'Grilled Chicken', price: 5500, category: 'Main Course', department: 'restaurant', available: true },
    { id: uuidv4(), name: 'Heineken', price: 3500, category: 'Drinks', department: 'both', available: true },
    { id: uuidv4(), name: 'Coca-Cola', price: 1500, category: 'Drinks', department: 'both', available: true },
  ]);
  console.log('[Seed] Menu items created.');

  // Suppliers
  await models.Supplier.insertMany([
    { id: uuidv4(), name: 'Fresh Foods Ltd', category: 'Food', contactName: 'Adebayo', phone: '08020000001' },
    { id: uuidv4(), name: 'Beverage Corp', category: 'Drinks', contactName: 'Ngozi', phone: '08020000002' },
    { id: uuidv4(), name: 'Hotel Supplies Co', category: 'General', contactName: 'Tunde', phone: '08020000003' },
  ]);
  console.log('[Seed] Suppliers created.');

  // Kitchen Inventory
  await models.KitchenInventory.insertMany([
    { id: uuidv4(), name: 'Rice', unit: 'kg', qty: 50, reorder: 20, costPerUnit: 1200 },
    { id: uuidv4(), name: 'Chicken', unit: 'kg', qty: 30, reorder: 15, costPerUnit: 2800 },
    { id: uuidv4(), name: 'Tomato', unit: 'kg', qty: 15, reorder: 10, costPerUnit: 800 },
    { id: uuidv4(), name: 'Oil', unit: 'L', qty: 8, reorder: 5, costPerUnit: 600 },
  ]);
  console.log('[Seed] Kitchen inventory created.');

  // Store Items
  await models.StoreItem.insertMany([
    { id: uuidv4(), name: 'Toilet Paper', unit: 'packs', stock: 100, reorder: 50, pricePerUnit: 300 },
    { id: uuidv4(), name: 'Shampoo', unit: 'bottles', stock: 45, reorder: 20, pricePerUnit: 1200 },
    { id: uuidv4(), name: 'Bath Soap', unit: 'packs', stock: 80, reorder: 40, pricePerUnit: 600 },
  ]);
  console.log('[Seed] Store items created.');

  // Requisitions
  await models.Requisition.insertMany([
    { id: uuidv4(), reqNo: 'KREQ-2025-001', mode: 'store_issue', byName: 'Kitchen Staff', department: 'kitchen', status: 'Pending', dateRaised: new Date() },
    { id: uuidv4(), reqNo: 'RREQ-2025-001', mode: 'store_issue', byName: 'Restaurant Staff', department: 'restaurant', status: 'Pending', dateRaised: new Date() },
  ]);
  console.log('[Seed] Requisitions created.');

  // Gym Plans
  const plans = await models.GymPlan.insertMany([
    { id: uuidv4(), name: 'Monthly', price: 15000, durationDays: 30, benefits: 'Full gym access' },
    { id: uuidv4(), name: 'Quarterly', price: 40000, durationDays: 90, benefits: 'Full gym + sauna' },
    { id: uuidv4(), name: 'Annual', price: 150000, durationDays: 365, benefits: 'All access + PT sessions' },
  ]);
  console.log('[Seed] Gym plans created.');

  // Gym Members
  await models.GymMember.insertMany([
    { id: uuidv4(), name: 'John Doe', planId: plans[0].id, startDate: new Date(), endDate: new Date(Date.now() + 30*24*60*60*1000), status: 'active', visits: 12 },
    { id: uuidv4(), name: 'Jane Smith', planId: plans[1].id, startDate: new Date(), endDate: new Date(Date.now() + 90*24*60*60*1000), status: 'active', visits: 8 },
  ]);
  console.log('[Seed] Gym members created.');

  // Staff
  await models.Staff.insertMany([
    { id: uuidv4(), name: 'Ngozi Eze', role: 'Front Desk', department: 'front_office', shift: 'Morning', status: 'on_duty', baseSalary: 120000, phone: '08030000001' },
    { id: uuidv4(), name: 'Tunde Adeyemi', role: 'Accountant', department: 'finance', shift: 'Morning', status: 'on_duty', baseSalary: 180000, phone: '08030000002' },
    { id: uuidv4(), name: 'Amina Bello', role: 'Chef', department: 'kitchen', shift: 'Evening', status: 'on_duty', baseSalary: 250000, phone: '08030000003' },
  ]);
  console.log('[Seed] Staff created.');

  // Configs
  await models.Config.insertMany([
    { id: uuidv4(), key: 'hotel_name', value: 'Grace Hotel' },
    { id: uuidv4(), key: 'currency', value: '₦' },
  ]);
  console.log('[Seed] Config created.');

  console.log('[Seed] Seeding complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('[Seed] Failed:', err);
  process.exit(1);
});