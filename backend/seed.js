require('dotenv').config();
const mongoose = require('mongoose');

const connectDB = require('./config/db');

const User = require('./models/User');
const Room = require('./models/Room');
const Booking = require('./models/Booking');
const MenuItem = require('./models/MenuItem');
const Table = require('./models/Table');
const Sale = require('./models/Sale');
const KitchenStock = require('./models/KitchenStock');
const Production = require('./models/Production');
const Transfer = require('./models/Transfer');
const GymPlan = require('./models/GymPlan');
const GymMember = require('./models/GymMember');
const GymCheckin = require('./models/GymCheckin');
const StoreItem = require('./models/StoreItem');
const Requisition = require('./models/Requisition');
const PurchaseRequest = require('./models/PurchaseRequest');
const Supplier = require('./models/Supplier');
const Staff = require('./models/Staff');
const LedgerEntry = require('./models/LedgerEntry');
const IncomeEntry = require('./models/IncomeEntry');
const ExpenseEntry = require('./models/ExpenseEntry');
const Activity = require('./models/Activity');
const Config = require('./models/Config');

function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(0,0,0,0); return d; }
function daysAhead(n) { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(0,0,0,0); return d; }
function today() { return daysAgo(0); }

async function seed() {
  await connectDB();

  console.log('[seed] Clearing existing data...');
  const models = [User,Room,Booking,MenuItem,Table,Sale,KitchenStock,Production,Transfer,GymPlan,GymMember,GymCheckin,StoreItem,Requisition,PurchaseRequest,Supplier,Staff,LedgerEntry,IncomeEntry,ExpenseEntry,Activity,Config];
  for (const m of models) await m.deleteMany({});

  console.log('[seed] Seeding...');

  // ── Users ──
  await User.create([
    { name: 'Amaka Chukwu', email: 'admin@aurum.com', password: '', role: 'admin', privilege: '', initials: 'AC' },
    { name: 'Blessing Ike', email: 'manager@aurum.com', password: '', role: 'manager', privilege: '', initials: 'BI' },
  ]);

  // ── Config ──
  await Config.create({ hotelName: 'Aurum Hotel', currency: '₦', currencyCode: 'NGN', locale: 'en-NG', mdApprovalThreshold: 100000 });

  // ── Rooms ──
  const rooms = [];
  const roomData = [
    ['R101','Standard',45000,'occupied','Aisha Musa'], ['R102','Standard',45000,'occupied','Biodun Obi'],
    ['R103','Standard',45000,'available'], ['R104','Standard',45000,'available'], ['R105','Standard',45000,'available'],
    ['R106','Standard',45000,'available'], ['R107','Standard',45000,'available'], ['R108','Standard',45000,'dirty'],
    ['R201','Deluxe',75000,'occupied','Chidi Eze'], ['R202','Deluxe',75000,'occupied','Ngozi Adeleke'],
    ['R203','Deluxe',75000,'available'], ['R204','Deluxe',75000,'available'], ['R205','Deluxe',75000,'available'],
    ['R206','Deluxe',75000,'dirty'], ['R301','Suite',120000,'occupied','Emeka Okafor'],
    ['R302','Suite',120000,'occupied','Fatima Bello'], ['R303','Suite',120000,'maintenance'],
    ['C001','Conference',180000,'occupied','TechCorp Ltd'], ['C002','Conference',180000,'available'],
  ];
  for (const [num,type,rate,status,guest] of roomData) {
    rooms.push(await Room.create({ number:num, type, rate, status }));
  }

  // ── Bookings ──
  await Booking.create([
    { room:'R101',type:'Standard',guest:'Aisha Musa',checkIn:daysAgo(3),checkOut:daysAhead(1),status:'Checked In',amount:135000,nights:3,paid:135000,payMethod:'Cash',payStatus:'Paid',adults:2 },
    { room:'R102',type:'Standard',guest:'Biodun Obi',checkIn:daysAgo(1),checkOut:today(),status:'Checked In',amount:45000,nights:1,paid:45000,payMethod:'Card',payStatus:'Paid',adults:1 },
    { room:'R201',type:'Deluxe',guest:'Chidi Eze',checkIn:daysAgo(5),checkOut:daysAhead(2),status:'Checked In',amount:375000,nights:5,paid:375000,payMethod:'Cash',payStatus:'Paid',adults:2,children:1 },
    { room:'R202',type:'Deluxe',guest:'Ngozi Adeleke',checkIn:daysAgo(2),checkOut:daysAhead(1),status:'Checked In',amount:225000,nights:3,paid:200000,payMethod:'Transfer',payStatus:'Partial',adults:2 },
    { room:'R301',type:'Suite',guest:'Emeka Okafor',checkIn:daysAgo(6),checkOut:daysAhead(2),status:'Checked In',amount:960000,nights:8,paid:500000,payMethod:'Card',payStatus:'Partial',adults:2,children:2 },
    { room:'R302',type:'Suite',guest:'Fatima Bello',checkIn:daysAgo(2),checkOut:today(),status:'Checked In',amount:240000,nights:2,paid:240000,payMethod:'Cash',payStatus:'Paid',adults:1 },
    { room:'C001',type:'Conference',guest:'TechCorp Ltd',checkIn:today(),checkOut:today(),status:'Checked In',amount:180000,nights:1,paid:180000,payMethod:'Transfer',payStatus:'Paid' },
  ]);

  // ── Restaurant Menu ──
  await MenuItem.create([
    { name:'Jollof Rice & Chicken',price:8500,category:'Main',department:'restaurant' },
    { name:'Peppered Snail',price:14000,category:'Starter',department:'restaurant' },
    { name:'Grilled Tilapia',price:18500,category:'Main',department:'restaurant' },
    { name:'Suya Platter',price:12000,category:'Starter',department:'restaurant' },
    { name:'Egusi Soup & Eba',price:7500,category:'Main',department:'restaurant' },
    { name:'Chapman',price:3500,category:'Drink',department:'restaurant' },
    { name:'Fresh Juice',price:2500,category:'Drink',department:'restaurant' },
    { name:'Red Velvet Cake',price:5500,category:'Dessert',department:'restaurant' },
    { name:'Fried Rice & Chicken',price:9000,category:'Main',department:'restaurant' },
    { name:'Pepper Soup',price:6500,category:'Starter',department:'restaurant' },
  ]);

  // ── Tables ──
  await Table.create([
    { number:1,seats:2,status:'available' },
    { number:2,seats:4,status:'occupied',waiter:'Tunde',orderTotal:67500 },
    { number:3,seats:4,status:'available' },
    { number:4,seats:6,status:'occupied',waiter:'Sade',orderTotal:124000 },
    { number:5,seats:2,status:'reserved',guest:'Mr. Dike' },
    { number:6,seats:8,status:'occupied',waiter:'Ayo',orderTotal:210000 },
    { number:7,seats:4,status:'available' },
    { number:8,seats:6,status:'reserved',guest:'Bello Family' },
  ]);

  // ── Restaurant Sales ──
  await Sale.create([
    { id:'SALE-1041',department:'restaurant',items:[{name:'Jollof Rice & Chicken',qty:2,price:8500},{name:'Chapman',qty:2,price:3500}],subtotal:24000,total:24000,method:'Cash',staff:'Tunde',table:'2',date:daysAgo(1),status:'completed' },
    { id:'SALE-1042',department:'restaurant',items:[{name:'Grilled Tilapia',qty:1,price:18500},{name:'Fresh Juice',qty:1,price:2500}],subtotal:21000,total:21000,method:'Card',staff:'Sade',table:'4',date:daysAgo(1),status:'completed' },
    { id:'SALE-1043',department:'restaurant',items:[{name:'Suya Platter',qty:1,price:12000}],subtotal:12000,total:12000,method:'Cash',staff:'Tunde',table:'2',date:today(),status:'completed' },
    { id:'SALE-1044',department:'restaurant',items:[{name:'Egusi Soup & Eba',qty:2,price:7500},{name:'Red Velvet Cake',qty:1,price:5500}],subtotal:20500,total:20500,method:'Room Charge',staff:'Ayo',table:'6',date:today(),status:'completed' },
  ]);

  // ── Pool Bar Menu ──
  await MenuItem.create([
    { name:'Tropical Punch',price:4500,category:'Mocktail',department:'poolbar' },
    { name:'Frozen Margarita',price:7500,category:'Cocktail',department:'poolbar' },
    { name:'Heineken',price:3500,category:'Beer',department:'poolbar' },
    { name:'Grilled Corn',price:2500,category:'Snack',department:'poolbar' },
    { name:'Coconut Water',price:2000,category:'Drink',department:'poolbar' },
    { name:'Club Sandwich',price:6500,category:'Snack',department:'poolbar' },
    { name:'Nkemdirim Special',price:8000,category:'Cocktail',department:'poolbar' },
  ]);

  // ── Pool Bar Sales ──
  await Sale.create([
    { id:'PBS-1021',department:'poolbar',items:[{name:'Heineken',qty:3,price:3500}],subtotal:10500,total:10500,method:'Cash',staff:'Emeka',date:today(),status:'completed' },
    { id:'PBS-1022',department:'poolbar',items:[{name:'Frozen Margarita',qty:2,price:7500},{name:'Grilled Corn',qty:1,price:2500}],subtotal:17500,total:17500,method:'Room Charge',staff:'Emeka',date:today(),status:'completed' },
  ]);

  // ── Kitchen Stock ──
  await KitchenStock.create([
    { name:'Rice (Long Grain)',category:'Grains',unit:'kg',qty:45,reorderLevel:20,cost:800 },
    { name:'Palm Oil',category:'Pantry',unit:'Ltr',qty:8,reorderLevel:10,cost:2500 },
    { name:'Chicken (Frozen)',category:'Protein',unit:'kg',qty:25,reorderLevel:15,cost:3500 },
    { name:'Tomatoes',category:'Produce',unit:'kg',qty:12,reorderLevel:10,cost:600 },
    { name:'Onions',category:'Produce',unit:'kg',qty:18,reorderLevel:10,cost:400 },
    { name:'Vegetable Oil',category:'Pantry',unit:'Ltr',qty:6,reorderLevel:5,cost:1800 },
    { name:'Salt',category:'Pantry',unit:'kg',qty:4,reorderLevel:3,cost:200 },
    { name:'Sugar',category:'Pantry',unit:'kg',qty:3,reorderLevel:5,cost:300 },
    { name:'Flour',category:'Grains',unit:'kg',qty:8,reorderLevel:10,cost:500 },
    { name:'Eggs',category:'Protein',unit:'crates',qty:2,reorderLevel:3,cost:2800 },
  ]);

  // ── Kitchen Production ──
  await Production.create([
    { productionNo:'PROD-00096',dish:'Fried Rice',outputQty:30,outputUnit:'plates',chef:'Bello Musa',date:daysAgo(1),time:'08:30',status:'completed',department:'Restaurant' },
    { productionNo:'PROD-00097',dish:'Jollof Rice',outputQty:15,outputUnit:'plates',chef:'Fatima Aliyu',date:today(),time:'07:45',status:'in_progress',department:'Restaurant' },
    { productionNo:'PROD-00098',dish:'Grilled Chicken',outputQty:50,outputUnit:'pieces',chef:'Bello Musa',date:today(),time:'11:00',status:'planned',department:'Restaurant' },
  ]);

  // ── Transfers ──
  await Transfer.create([
    { transferNo:'TRF-001',meal:'Fried Rice',quantity:30,unit:'plates',from:'Kitchen',to:'Restaurant',sentBy:'Bello Musa',status:'accepted',dateSent:daysAgo(1) },
    { transferNo:'TRF-002',meal:'Jollof Rice',quantity:15,unit:'plates',from:'Kitchen',to:'Restaurant',sentBy:'Fatima Aliyu',status:'sent',dateSent:today() },
  ]);

  // ── Gym Plans ──
  const plans = [];
  const p1 = await GymPlan.create({ name:'Monthly',price:15000,durationDays:30 });
  const p2 = await GymPlan.create({ name:'Quarterly',price:35000,durationDays:90 });
  const p3 = await GymPlan.create({ name:'Annual',price:100000,durationDays:365 });
  plans.push(p1,p2,p3);

  // ── Gym Members ──
  const m1 = await GymMember.create({ name:'Adebayo Ogunlesi',phone:'08012345678',room:'N/A',plan:p3._id,planName:'Annual',startDate:daysAgo(60),endDate:daysAhead(305),status:'active',totalCheckins:34 });
  const m2 = await GymMember.create({ name:'Chioma Nwosu',phone:'08098765432',room:'R201',plan:p1._id,planName:'Monthly',startDate:daysAgo(15),endDate:daysAhead(15),status:'active',totalCheckins:8 });
  const m3 = await GymMember.create({ name:'Femi Adeyemi',phone:'07011112222',room:'N/A',plan:p2._id,planName:'Quarterly',startDate:daysAgo(45),endDate:daysAhead(45),status:'active',totalCheckins:22 });

  // ── Gym Checkins ──
  await GymCheckin.create([
    { member:m1._id,name:'Adebayo Ogunlesi',date:today(),time:'06:30 AM' },
    { member:m2._id,name:'Chioma Nwosu',date:today(),time:'07:15 AM' },
    { member:m3._id,name:'Femi Adeyemi',date:today(),time:'08:00 AM' },
  ]);

  // ── Staff ──
  await Staff.create([
    { name:'Tunde Adebayo',role:'Waiter',dept:'Restaurant',shift:'Morning',status:'on_duty',salary:85000 },
    { name:'Sade Okonkwo',role:'Waitress',dept:'Restaurant',shift:'Morning',status:'on_duty',salary:85000 },
    { name:'Emeka Chukwu',role:'Barman',dept:'Pool Bar',shift:'Morning',status:'on_duty',salary:90000 },
    { name:'Ayo Babatunde',role:'Waiter',dept:'Restaurant',shift:'Evening',status:'off_duty',salary:85000 },
    { name:'Ngozi Obi',role:'Receptionist',dept:'Front Desk',shift:'Morning',status:'on_duty',salary:95000 },
    { name:'Chika Eze',role:'Receptionist',dept:'Front Desk',shift:'Evening',status:'off_duty',salary:95000 },
    { name:'Bello Musa',role:'Chef',dept:'Kitchen',shift:'Morning',status:'on_duty',salary:150000 },
    { name:'Fatima Aliyu',role:'Sous Chef',dept:'Kitchen',shift:'Morning',status:'on_duty',salary:120000 },
    { name:'James Okafor',role:'Security',dept:'Security',shift:'Night',status:'on_duty',salary:75000 },
    { name:'Ada Nwosu',role:'Housekeeper',dept:'Rooms',shift:'Morning',status:'on_duty',salary:70000 },
    { name:'Uche Dibia',role:'Maintenance',dept:'Facilities',shift:'Morning',status:'on_duty',salary:80000 },
    { name:'Blessing Ike',role:'Manager',dept:'Management',shift:'Morning',status:'on_duty',salary:250000 },
    { name:'Kabiru Aliyu',role:'Store Keeper',dept:'Store',shift:'Morning',status:'on_duty',salary:95000 },
    { name:'Ngozi Eze',role:'Bartender',dept:'Restaurant',shift:'Evening',status:'off_duty',salary:85000 },
    { name:'Chinedu Obi',role:'Chef',dept:'Kitchen',shift:'Evening',status:'off_duty',salary:120000 },
  ]);

  // ── Store Items ──
  await StoreItem.create([
    { name:'Rice (Long Grain)',category:'Food Staples',unit:'kg',qty:35,cost:800,reorderLevel:20 },
    { name:'Palm Oil',category:'Food Staples',unit:'Ltr',qty:8,cost:2500,reorderLevel:10 },
    { name:'Chicken (Frozen)',category:'Food Staples',unit:'kg',qty:20,cost:3500,reorderLevel:15 },
    { name:'Tomatoes',category:'Food Staples',unit:'kg',qty:15,cost:600,reorderLevel:10 },
    { name:'Onions',category:'Food Staples',unit:'kg',qty:20,cost:400,reorderLevel:10 },
    { name:'Star Lager',category:'Beverages',unit:'Bottles',qty:240,cost:450,reorderLevel:48 },
    { name:'Heineken',category:'Beverages',unit:'Bottles',qty:180,cost:650,reorderLevel:36 },
    { name:'Hennessy VS',category:'Beverages',unit:'Bottles',qty:6,cost:18000,reorderLevel:12 },
    { name:'Bottled Water 1.5L',category:'Beverages',unit:'Cartons',qty:60,cost:1200,reorderLevel:24 },
    { name:'Bleach 5L',category:'Cleaning',unit:'Ltr',qty:18,cost:1500,reorderLevel:6 },
    { name:'Floor Cleaner 5L',category:'Cleaning',unit:'Ltr',qty:9,cost:2000,reorderLevel:6 },
    { name:'Industrial Detergent 10kg',category:'Cleaning',unit:'Bags',qty:5,cost:8000,reorderLevel:3 },
    { name:'King Duvet Set',category:'Linen',unit:'Pieces',qty:22,cost:12000,reorderLevel:10 },
    { name:'Pillow Cases (pair)',category:'Linen',unit:'Pieces',qty:40,cost:2500,reorderLevel:20 },
    { name:'Guest Shampoo 250ml',category:'Toiletries',unit:'Pieces',qty:300,cost:350,reorderLevel:100 },
    { name:'POS Terminal',category:'Electronics',unit:'Pieces',qty:2,cost:95000,reorderLevel:1 },
    { name:'Branded Envelopes',category:'Office',unit:'Packs',qty:8,cost:1200,reorderLevel:5 },
  ]);

  // ── Procurement Suppliers ──
  await Supplier.create([
    { name:'Lagos Fresh Produce Ltd',category:'Food & Beverage',contactPerson:'Chidi Umeh',phone:'+234 803 555 1010',email:'sales@lagosfresh.ng',rating:5 },
    { name:'PureLine Toiletries Co.',category:'Toiletries & Amenities',contactPerson:'Ada Nwankwo',phone:'+234 806 444 2020',email:'orders@pureline.ng',rating:4 },
    { name:'SparkleClean Supplies',category:'Cleaning Supplies',contactPerson:'Tunde Bakare',phone:'+234 701 222 3030',email:'info@sparkleclean.ng',rating:4 },
    { name:'Prestige Linen & Textiles',category:'Linen & Uniforms',contactPerson:'Funke Adeyinka',phone:'+234 802 666 4040',email:'sales@prestigelinen.ng',rating:5 },
    { name:'TechPoint Electronics',category:'IT & Electronics',contactPerson:'Emeka Obasi',phone:'+234 809 333 5050',email:'b2b@techpoint.ng',rating:3 },
  ]);

  // ── Purchase Requests ──
  await PurchaseRequest.create([
    { prNo:'PR-041',item:'Toiletries (100 units)',cat:'Toiletries & Amenities',dept:'Housekeeping',by:'Kabiru Aliyu',date:daysAgo(1),needed:daysAhead(4),qty:100,unit:'Units',unitCost:480,totalAmount:48000,priority:'Normal',approvalStage:'pending',status:'pending',history:[{date:daysAgo(1).toISOString().split('T')[0],action:'Request submitted',by:'Kabiru Aliyu',stage:'pending'}] },
    { prNo:'PR-039',item:'Wine Restocking (Assorted)',cat:'Food & Beverage',dept:'Restaurant / Bar',by:'Ngozi Eze',date:daysAgo(3),needed:daysAhead(2),qty:24,unit:'Bottles',unitCost:5000,totalAmount:120000,priority:'Urgent',approvalStage:'accountant',status:'accountant',history:[{date:daysAgo(3).toISOString().split('T')[0],action:'Request submitted',by:'Ngozi Eze',stage:'pending'},{date:daysAgo(2).toISOString().split('T')[0],action:'Accountant review',by:'Accountant',stage:'accountant'}] },
    { prNo:'PR-038',item:'Cleaning Supplies (Bulk)',cat:'Cleaning Supplies',dept:'Housekeeping',by:'Kabiru Aliyu',date:daysAgo(5),needed:daysAgo(1),qty:1,unit:'Lot',unitCost:22000,totalAmount:22000,priority:'Normal',approvalStage:'gm',status:'gm',history:[{date:daysAgo(5).toISOString().split('T')[0],action:'Request submitted',by:'Kabiru Aliyu',stage:'pending'},{date:daysAgo(4).toISOString().split('T')[0],action:'Accountant approved',by:'Accountant',stage:'accountant'}] },
    { prNo:'PR-037',item:'Guest Room Linen Set',cat:'Linen & Uniforms',dept:'Housekeeping',by:'Kabiru Aliyu',date:daysAgo(9),needed:daysAgo(3),qty:40,unit:'Sets',unitCost:24000,totalAmount:960000,priority:'Normal',approvalStage:'approved',status:'approved',supplier:'Prestige Linen & Textiles',poNo:'PO-1014',history:[{date:daysAgo(9).toISOString().split('T')[0],action:'Request submitted',by:'Kabiru Aliyu',stage:'pending'},{date:daysAgo(8).toISOString().split('T')[0],action:'Accountant approved',by:'Accountant',stage:'accountant'},{date:daysAgo(6).toISOString().split('T')[0],action:'GM approved',by:'General Manager',stage:'gm'},{date:daysAgo(3).toISOString().split('T')[0],action:'MD approved',by:'Managing Director',stage:'md'}] },
    { prNo:'PR-036',item:'Kitchen Gas Cylinders (Refill)',cat:'Maintenance & Equipment',dept:'Kitchen',by:'Chinedu Obi',date:daysAgo(2),needed:daysAhead(1),qty:6,unit:'Cylinders',unitCost:18000,totalAmount:108000,priority:'Urgent',approvalStage:'pending',status:'pending',history:[{date:daysAgo(2).toISOString().split('T')[0],action:'Request submitted',by:'Chinedu Obi',stage:'pending'}] },
  ]);

  // ── Requisitions ──
  await Requisition.create([
    { requisitionNo:'KREQ-2025-00045',mode:'store_issue',requester:'Chinedu Obi',dept:'Kitchen',neededBy:daysAhead(1).toISOString().split('T')[0],priority:'Urgent',items:[{name:'Rice (Long Grain)',unit:'kg',qty:20,cost:800},{name:'Chicken (Frozen)',unit:'kg',qty:10,cost:3500}],status:'Pending',dateRaised:daysAgo(1) },
    { requisitionNo:'HREQ-2025-00012',mode:'store_issue',requester:'Kabiru Aliyu',dept:'Housekeeping',neededBy:daysAhead(3).toISOString().split('T')[0],priority:'Normal',items:[{name:'Guest Shampoo 250ml',unit:'Pieces',qty:100,cost:350},{name:'Bleach 5L',unit:'Ltr',qty:2,cost:1500}],status:'Pending',dateRaised:daysAgo(2) },
    { requisitionNo:'BREQ-2025-00008',mode:'purchase',requester:'Emeka Chukwu',dept:'Bar',neededBy:daysAhead(5).toISOString().split('T')[0],priority:'Normal',items:[{name:'Heineken',unit:'Bottles',qty:48,cost:650},{name:'Hennessy VS',unit:'Bottles',qty:6,cost:18000}],status:'Pending',supplier:'Lagos Fresh Produce Ltd',dateRaised:daysAgo(3) },
  ]);

  // ── Ledger Entries ──
  await LedgerEntry.create([
    { date:daysAgo(1),ref:'INV-2201',description:'Room Booking — R201 (Chidi Eze)',type:'income',amount:375000,department:'Rooms' },
    { date:daysAgo(1),ref:'INV-2202',description:'Restaurant Sales — Lunch Service',type:'income',amount:284000,department:'Restaurant' },
    { date:daysAgo(1),ref:'INV-2203',description:'Pool Bar Sales',type:'income',amount:122000,department:'Pool Bar' },
    { date:daysAgo(1),ref:'EXP-0441',description:'Staff Salaries — Partial Advance',type:'expense',amount:480000,department:'Staff' },
    { date:daysAgo(1),ref:'EXP-0442',description:'PR-040 — Fresh Produce',type:'expense',amount:75000,department:'Procurement' },
    { date:daysAgo(2),ref:'INV-2198',description:'Room Booking — R301 (Emeka Okafor)',type:'income',amount:960000,department:'Rooms' },
    { date:daysAgo(2),ref:'INV-2199',description:'Conference Room C001 — TechCorp',type:'income',amount:180000,department:'Rooms' },
    { date:daysAgo(2),ref:'EXP-0440',description:'Electricity & Utilities',type:'expense',amount:320000,department:'Facilities' },
    { date:daysAgo(3),ref:'INV-2195',description:'Restaurant Sales — Dinner',type:'income',amount:510000,department:'Restaurant' },
  ]);

  // ── Income / Expense entries for P&L ──
  await IncomeEntry.create([
    { date:daysAgo(1),description:'Room Revenue',category:'Rooms',amount:781000 },
    { date:daysAgo(1),description:'Restaurant Revenue',category:'Restaurant',amount:284000 },
    { date:daysAgo(1),description:'Pool Bar Revenue',category:'Pool Bar',amount:122000 },
    { date:daysAgo(2),description:'Room Revenue',category:'Rooms',amount:1140000 },
    { date:daysAgo(3),description:'Restaurant Revenue',category:'Restaurant',amount:510000 },
  ]);

  await ExpenseEntry.create([
    { date:daysAgo(1),description:'Staff Salaries',category:'Salaries',amount:480000 },
    { date:daysAgo(1),description:'Fresh Produce Purchase',category:'Procurement',amount:75000 },
    { date:daysAgo(2),description:'Electricity & Utilities',category:'Utilities',amount:320000 },
  ]);

  // ── Activity Feed ──
  await Activity.create([
    { dept:'Booking',color:'gold',text:'Room 402 checked in — Barr. Musa (3 nights)',time:'8 min ago',href:'booking/booking-dashboard.html' },
    { dept:'Kitchen',color:'purple',text:'PROD-00096 — 30 plates Fried Rice sent to Restaurant',time:'22 min ago',href:'kitchen/kitchen-dashboard.html' },
    { dept:'Procurement',color:'cyan',text:'PR-041 moved to pending — Toiletries restock',time:'40 min ago',href:'procurement/procurement-dashboard.html' },
    { dept:'Restaurant',color:'blue',text:'SALE-1043 — ₦12,000 settled by Cash, Table 2',time:'1 hr ago',href:'restaurant/restaurant-dashboard.html' },
    { dept:'Pool Bar',color:'green',text:'PBS-1021 — 3x Heineken sold, ₦10,500',time:'1 hr ago',href:'poolbar/poolbar-dashboard.html' },
    { dept:'Accounting',color:'amber',text:'Shift reconciled — Tunde Adeyemi',time:'3 hr ago',href:'accounting/accounting-dashboard.html' },
    { dept:'Staff',color:'blue',text:'Ngozi Eze clocked in for Front Office shift',time:'4 hr ago',href:'staff.html' },
    { dept:'Gym',color:'purple',text:'Adebayo Ogunlesi checked in for morning workout',time:'5 hr ago',href:'gym/gym-dashboard.html' },
    { dept:'Store',color:'amber',text:'KREQ-2025-00045 — Kitchen requisition awaiting approval',time:'6 hr ago',href:'store/store-dashboard.html' },
  ]);

  console.log('[seed] Done! All demo data inserted.');
  process.exit(0);
}

seed().catch((err) => { console.error('[seed] Failed:', err); process.exit(1); });
