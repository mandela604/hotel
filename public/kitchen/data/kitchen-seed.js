/**
 * data/kitchen-seed.js — Kitchen module demo seed
 * DEMO_STOCK (raw ingredients) | DEMO_RECIPES (how to make each dish) |
 * DEMO_PRODUCTION (production log) | DEMO_MOVEMENTS | DEMO_TRANSFERS
 *
 * WHAT'S NEW
 * ──────────
 * DEMO_RECIPES: this is step 2 from the Jollof Rice walkthrough —
 * "to cook Jollof Rice, we normally use these ingredients, for this
 * base quantity, giving about this many plates." Each recipe is
 * defined per 1 unit of its base ingredient (e.g. per 1kg of rice),
 * so kitchen-service.js can scale it up/down for whatever batch size
 * staff actually cooks (step 3), without a new recipe every time.
 */
(function (global) {
  'use strict';

  function pad2(n) { return String(n).padStart(2, '0'); }
  function fmtStamp(date) {
    let h = date.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${String(date.getFullYear()).slice(-2)} ${pad2(h)}:${pad2(date.getMinutes())} ${ampm}`;
  }
  function stampMinutesAgo(min) { return fmtStamp(new Date(Date.now() - min * 60000)); }

  const DEMO_STOCK = [
    { name: 'Rice (Long Grain)', category: 'Grains', cat: 'Grains', unit: 'kg', qty: 85, min: 20, price: 1200, cost: 1200, batch: 'GR-0091', received: '05/08/26', desc: 'Local parboiled rice' },
    { name: 'Spaghetti', category: 'Grains', cat: 'Grains', unit: 'pack', qty: 40, min: 10, price: 900, cost: 900, batch: 'GR-0088', received: '02/08/26', desc: '' },
    { name: 'Chicken (Frozen)', category: 'Protein', cat: 'Protein', unit: 'kg', qty: 32, min: 15, price: 2800, cost: 2800, batch: 'PR-0114', received: '09/08/26', desc: 'Whole & cut portions' },
    { name: 'Beef', category: 'Protein', cat: 'Protein', unit: 'kg', qty: 18, min: 12, price: 3200, cost: 3200, batch: 'PR-0116', received: '09/08/26', desc: '' },
    { name: 'Fresh Fish (Croaker)', category: 'Protein', cat: 'Protein', unit: 'kg', qty: 9, min: 10, price: 3500, cost: 3500, batch: 'PR-0110', received: '08/08/26', desc: 'Low — reorder soon' },
    { name: 'Eggs', category: 'Protein', cat: 'Protein', unit: 'crate', qty: 14, min: 5, price: 3800, cost: 3800, batch: 'PR-0120', received: '10/08/26', desc: '' },
    { name: 'Tomatoes', category: 'Produce', cat: 'Produce', unit: 'kg', qty: 22, min: 15, price: 700, cost: 700, batch: 'PD-0201', received: '11/08/26', desc: '' },
    { name: 'Onions', category: 'Produce', cat: 'Produce', unit: 'kg', qty: 26, min: 15, price: 600, cost: 600, batch: 'PD-0202', received: '11/08/26', desc: '' },
    { name: 'Pepper (Tatashe)', category: 'Produce', cat: 'Produce', unit: 'kg', qty: 11, min: 8, price: 900, cost: 900, batch: 'PD-0203', received: '11/08/26', desc: '' },
    { name: 'Scotch Bonnet', category: 'Produce', cat: 'Produce', unit: 'kg', qty: 6, min: 5, price: 1500, cost: 1500, batch: 'PD-0204', received: '11/08/26', desc: '' },
    { name: 'Plantain', category: 'Produce', cat: 'Produce', unit: 'bunch', qty: 15, min: 8, price: 1800, cost: 1800, batch: 'PD-0210', received: '10/08/26', desc: '' },
    { name: 'Yam', category: 'Produce', cat: 'Produce', unit: 'tuber', qty: 24, min: 10, price: 2200, cost: 2200, batch: 'PD-0211', received: '10/08/26', desc: '' },
    { name: 'Palm Oil', category: 'Pantry', cat: 'Pantry', unit: 'litre', qty: 30, min: 10, price: 2100, cost: 2100, batch: 'PT-0301', received: '01/08/26', desc: '' },
    { name: 'Vegetable Oil', category: 'Pantry', cat: 'Pantry', unit: 'litre', qty: 28, min: 10, price: 1900, cost: 1900, batch: 'PT-0302', received: '01/08/26', desc: '' },
    { name: 'Salt', category: 'Pantry', cat: 'Pantry', unit: 'kg', qty: 20, min: 5, price: 350, cost: 350, batch: 'PT-0310', received: '20/07/26', desc: '' },
    { name: 'Seasoning Cubes', category: 'Pantry', cat: 'Pantry', unit: 'pack', qty: 45, min: 15, price: 500, cost: 500, batch: 'PT-0311', received: '20/07/26', desc: '' },
    { name: 'Curry Powder', category: 'Pantry', cat: 'Pantry', unit: 'kg', qty: 4, min: 3, price: 2600, cost: 2600, batch: 'PT-0320', received: '15/07/26', desc: 'Low — reorder soon' },
    { name: 'Thyme', category: 'Pantry', cat: 'Pantry', unit: 'kg', qty: 3, min: 2, price: 2400, cost: 2400, batch: 'PT-0321', received: '15/07/26', desc: '' },
  ];

  // ── Recipes: "how to make it" — defined per 1 unit of the base
  // ingredient. kitchen-service.js's scaleRecipe() multiplies every
  // line (and expectedYield) by (targetQty / baseQty) at production
  // time, so staff only ever enters "I'm cooking 3kg of rice today."
  const DEMO_RECIPES = [
    {
      id: 'RCP-00001',
      dish: 'Jollof Rice',
      baseQty: 1, baseUnit: 'kg', baseIngredient: 'Rice (Long Grain)',
      ingredients: [
        { name: 'Rice (Long Grain)', qty: 1,    unit: 'kg' },
        { name: 'Tomatoes',          qty: 0.8,  unit: 'kg' },
        { name: 'Onions',            qty: 0.5,  unit: 'kg' },
        { name: 'Vegetable Oil',     qty: 0.3,  unit: 'litre' },
        { name: 'Seasoning Cubes',   qty: 0.3,  unit: 'pack' },
        { name: 'Curry Powder',      qty: 0.05, unit: 'kg' },
        { name: 'Thyme',             qty: 0.02, unit: 'kg' },
      ],
      expectedYield: 3, expectedYieldUnit: 'plates',
      notes: 'Standard party-style jollof. Scale by kg of rice.',
    },
    {
      id: 'RCP-00002',
      dish: 'Fried Rice',
      baseQty: 1, baseUnit: 'kg', baseIngredient: 'Rice (Long Grain)',
      ingredients: [
        { name: 'Rice (Long Grain)', qty: 1,    unit: 'kg' },
        { name: 'Tomatoes',          qty: 0.5,  unit: 'kg' },
        { name: 'Onions',            qty: 0.25, unit: 'kg' },
        { name: 'Vegetable Oil',     qty: 0.25, unit: 'litre' },
        { name: 'Seasoning Cubes',   qty: 0.25, unit: 'pack' },
      ],
      expectedYield: 3.5, expectedYieldUnit: 'plates',
      notes: 'Scale by kg of rice.',
    },
    {
      id: 'RCP-00003',
      dish: 'Egusi Soup',
      baseQty: 1, baseUnit: 'kg', baseIngredient: 'Beef',
      ingredients: [
        { name: 'Beef',             qty: 1,    unit: 'kg' },
        { name: 'Palm Oil',         qty: 0.5,  unit: 'litre' },
        { name: 'Onions',           qty: 0.5,  unit: 'kg' },
        { name: 'Seasoning Cubes',  qty: 0.25, unit: 'pack' },
      ],
      expectedYield: 3.5, expectedYieldUnit: 'portions',
      notes: 'Scale by kg of beef.',
    },
    {
      id: 'RCP-00004',
      dish: 'Pepper Soup',
      baseQty: 1, baseUnit: 'kg', baseIngredient: 'Beef',
      ingredients: [
        { name: 'Beef',             qty: 1,    unit: 'kg' },
        { name: 'Scotch Bonnet',    qty: 0.25, unit: 'kg' },
        { name: 'Seasoning Cubes',  qty: 0.25, unit: 'pack' },
        { name: 'Thyme',            qty: 0.05, unit: 'kg' },
      ],
      expectedYield: 3.5, expectedYieldUnit: 'bowls',
      notes: 'Scale by kg of beef.',
    },
  ];

  const DEMO_PRODUCTION = [
    {
      id: 'PROD-00096', no: 'PROD-00096', batchNo: 'BATCH-00050', type: 'rts', dish: 'Fried Rice', outputQty: 30, outputUnit: 'Plates',
      meals: [{ name: 'Fried Rice', qty: 30, unit: 'Plates' }],
      recipeId: 'RCP-00002', scaleFactor: 8, expectedYield: 28,
      ingredients: [
        { name: 'Rice (Long Grain)', qty: 8, unit: 'kg' },
        { name: 'Tomatoes', qty: 4, unit: 'kg' },
        { name: 'Onions', qty: 2, unit: 'kg' },
        { name: 'Vegetable Oil', qty: 2, unit: 'litre' },
        { name: 'Seasoning Cubes', qty: 2, unit: 'pack' },
      ],
      cost: 8 * 1200 + 4 * 700 + 2 * 600 + 2 * 1900 + 2 * 500,
      staff: 'Head Chef', by: 'Head Chef', notes: 'Lunch preparation', remarks: 'Lunch preparation',
      date: stampMinutesAgo(90), time: '10:30 AM', status: 'completed', destination: 'Main Restaurant / POS', transferNo: 'KTN-00045',
    },
    {
      id: 'PROD-00095', no: 'PROD-00095', batchNo: 'BATCH-00049', type: 'rts', dish: 'Jollof Rice', outputQty: 20, outputUnit: 'Plates',
      meals: [{ name: 'Jollof Rice', qty: 20, unit: 'Plates' }],
      ingredients: [
        { name: 'Rice (Long Grain)', qty: 6, unit: 'kg' },
        { name: 'Tomatoes', qty: 5, unit: 'kg' },
        { name: 'Onions', qty: 3, unit: 'kg' },
        { name: 'Chicken (Frozen)', qty: 4, unit: 'kg' },
      ],
      cost: 6 * 1200 + 5 * 700 + 3 * 600 + 4 * 2800,
      staff: 'Head Chef', by: 'Head Chef', notes: '', remarks: '',
      date: stampMinutesAgo(180), time: '10:15 AM', status: 'accepted', destination: 'Main Restaurant / POS', transferNo: 'KTN-00044',
    },
    {
      id: 'PROD-00094', no: 'PROD-00094', batchNo: 'BATCH-00048', type: 'rts', dish: 'Egusi Soup', outputQty: 15, outputUnit: 'Portions',
      meals: [{ name: 'Egusi Soup', qty: 15, unit: 'Portions' }],
      recipeId: 'RCP-00003', scaleFactor: 4, expectedYield: 14,
      ingredients: [
        { name: 'Beef', qty: 4, unit: 'kg' },
        { name: 'Palm Oil', qty: 2, unit: 'litre' },
        { name: 'Onions', qty: 2, unit: 'kg' },
      ],
      cost: 4 * 3200 + 2 * 2100 + 2 * 600,
      staff: 'Sous Chef', by: 'Sous Chef', notes: '', remarks: '',
      date: stampMinutesAgo(300), time: '10:00 AM', status: 'accepted', destination: 'Pool Bar', transferNo: 'KTN-00043',
    },
    {
      id: 'PROD-00092', no: 'PROD-00092', batchNo: 'BATCH-00046', type: 'rts', dish: 'Pepper Soup', outputQty: 15, outputUnit: 'bowls',
      meals: [{ name: 'Pepper Soup', qty: 15, unit: 'bowls' }],
      recipeId: 'RCP-00004', scaleFactor: 4, expectedYield: 14,
      ingredients: [
        { name: 'Beef', qty: 4, unit: 'kg' },
        { name: 'Scotch Bonnet', qty: 1, unit: 'kg' },
        { name: 'Seasoning Cubes', qty: 1, unit: 'pack' },
      ],
      cost: 4 * 3200 + 1 * 1500 + 1 * 500,
      staff: 'Chef Ade', by: 'Chef Ade', notes: 'Voided — over-salted batch', remarks: 'Voided — over-salted batch',
      date: stampMinutesAgo(420), time: '09:30 AM', status: 'voided',
      voidReason: 'Over-salted, had to discard.', voidedBy: 'Chef Ade',
      destination: 'Room Service', transferNo: 'KTN-00042',
    },
  ];

  const DEMO_MOVEMENTS = [
    { date: stampMinutesAgo(90), item: 'Rice (Long Grain)', qtyIn: 0, qtyOut: 8, balance: 85, reason: 'Production (PROD-00096)' },
    { date: stampMinutesAgo(180), item: 'Chicken (Frozen)', qtyIn: 0, qtyOut: 4, balance: 32, reason: 'Production (PROD-00095)' },
  ];

  const DEMO_TRANSFERS = [
    { transferNo: 'KTN-00045', productionNo: 'PROD-00096', meal: 'Fried Rice', quantity: 30, unit: 'Plates', kitchen: 'Main Kitchen', restaurant: 'Main Restaurant / POS', sentBy: 'Head Chef', receivedBy: '', dateSent: '17/07/26 10:30 AM', dateReceived: '', status: 'sent', remarks: 'Lunch preparation' },
    { transferNo: 'KTN-00044', productionNo: 'PROD-00095', meal: 'Jollof Rice', quantity: 20, unit: 'Plates', kitchen: 'Main Kitchen', restaurant: 'Main Restaurant / POS', sentBy: 'Head Chef', receivedBy: 'Ada, Front of House', dateSent: '17/07/26 09:15 AM', dateReceived: '17/07/26 09:40 AM', status: 'accepted', remarks: '' },
    { transferNo: 'KTN-00043', productionNo: 'PROD-00094', meal: 'Egusi Soup', quantity: 15, unit: 'Portions', kitchen: 'Main Kitchen', restaurant: 'Main Restaurant / POS', sentBy: 'Sous Chef', receivedBy: 'Tunde, Waitstaff', dateSent: '16/07/26 08:40 PM', dateReceived: '16/07/26 09:05 PM', status: 'accepted', remarks: '' },
    { transferNo: 'KTN-00042', productionNo: 'PROD-00092', meal: 'Moi Moi', quantity: 25, unit: 'Pieces', kitchen: 'Main Kitchen', restaurant: 'Main Restaurant / POS', sentBy: 'Sous Chef', receivedBy: '', dateSent: '15/07/26 08:50 AM', dateReceived: '', status: 'rejected', remarks: '', rejectReason: 'Wrong batch — texture off, sent back.' },
    { transferNo: 'KTN-00041', productionNo: '', meal: 'Fried Rice', quantity: 10, unit: 'Plates', kitchen: 'Main Kitchen', restaurant: 'Main Restaurant / POS', sentBy: 'Head Chef', receivedBy: '', dateSent: '14/07/26 09:10 AM', dateReceived: '', status: 'cancelled', remarks: '', cancelReason: 'Duplicate entry — meal was combined with KTN-00042.' }
  ];

  global.KitchenSeed = { DEMO_STOCK, DEMO_RECIPES, DEMO_PRODUCTION, DEMO_MOVEMENTS, DEMO_TRANSFERS };
})(window);