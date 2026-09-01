const { v4: uuidv4 } = require('uuid');
const KitchenStock = require('../models/KitchenStock');
const Production = require('../models/Production');
const Transfer = require('../models/Transfer');
const Recipe = require('../models/Recipe');
const KitchenMovement = require('../models/KitchenMovement');
const Requisition = require('../models/Requisition');
const Counter = require('../models/Counter');
const asyncHandler = require('../middleware/asyncHandler');

// Escapes regex special characters from user-supplied strings so they
// can be safely used in new RegExp(...) without ReDoS or broken patterns.
function sanitizeRegex(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function todayDDMMYY() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
}

function nowStamp() {
  const d = new Date();
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${todayDDMMYY()} ${String(h).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`;
}

/**
 * Formats any date-ish value (Date object, ISO string, timestamp) as
 * dd/mm/yy, same shape as todayDDMMYY(). Returns '' for anything that
 * doesn't parse, instead of throwing.
 */
function formatDate(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
}

/* ── Stock CRUD ── */
exports.listStock = asyncHandler(async (req, res) => {
  const list = await KitchenStock.find().sort({ name: 1 });
  res.json({ success: true, count: list.length, data: list });
});

exports.addStock = asyncHandler(async (req, res) => {
  const { name, category, cat, unit, min, desc, storeId } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Item name is required' });
  }

  // Check by storeId first (unique link to Store DB), then by exact name
  if (storeId) {
    const existing = await KitchenStock.findOne({ storeId });
    if (existing) {
      return res.status(409).json({ success: false, error: `"${name}" is already tracked`, existingId: existing.id });
    }
  }
  const existing = await KitchenStock.findOne({ name: new RegExp('^' + name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') });
  if (existing) {
    return res.status(409).json({ success: false, error: `"${name}" is already tracked`, existingId: existing.id });
  }

  const item = await KitchenStock.create({
    id: uuidv4(),
    storeId: storeId || '',
    name: name.trim(),
    category: category || cat || 'Grains',
    cat: cat || category || 'Grains',
    unit: unit || 'kg',
    qty: 0,
    min: Number(min) || 10,
    price: 0,
    cost: 0,
    batch: '—',
    received: todayDDMMYY(),
    desc: desc || '',
  });

  res.status(201).json({ success: true, data: item });
});

exports.updateStock = asyncHandler(async (req, res) => {
  const item = await KitchenStock.findOne({ id: req.params.id });
  if (!item) return res.status(404).json({ success: false, error: 'Stock item not found' });

  const { name, category, cat, unit, min, desc } = req.body;
  if (name) item.name = name.trim();
  if (category || cat) {
    item.category = category || cat;
    item.cat = cat || category;
  }
  if (unit) item.unit = unit;
  if (min !== undefined) item.min = Number(min);
  if (desc !== undefined) item.desc = desc;

  await item.save();
  res.json({ success: true, data: item });
});

exports.deleteStock = asyncHandler(async (req, res) => {
  const item = await KitchenStock.findOneAndDelete({ id: req.params.id });
  if (!item) return res.status(404).json({ success: false, error: 'Stock item not found' });
  res.json({ success: true, message: `Ingredient "${item.name}" deleted` });
});

exports.deductStock = asyncHandler(async (req, res) => {
  const { name, qty, reason, notes } = req.body;
  if (!name || !qty || Number(qty) <= 0) {
    return res.status(400).json({ success: false, error: 'Valid ingredient name and quantity required' });
  }

  const item = await KitchenStock.findOne({ name: new RegExp(`^${name.trim()}$`, 'i') });
  if (!item) return res.status(404).json({ success: false, error: `"${name}" not found in stock` });
  if (item.qty < Number(qty)) {
    return res.status(400).json({ success: false, error: `Cannot deduct ${qty} ${item.unit}. Only ${item.qty} on hand.` });
  }

  item.qty -= Number(qty);
  await item.save();

  await KitchenMovement.create({
    date: nowStamp(),
    item: item.name,
    qtyIn: 0,
    qtyOut: Number(qty),
    balance: item.qty,
    reason: notes ? `${reason} — ${notes}` : reason || 'Manual Deduction',
  });

  res.json({ success: true, data: item });
});

/* ── Production Runs ── */
exports.listProduction = asyncHandler(async (req, res) => {
  const list = await Production.find().sort({ createdAt: -1 });
  res.json({ success: true, count: list.length, data: list });
});

exports.recordProduction = asyncHandler(async (req, res) => {
  const {
    dish,
    outputQty,
    outputUnit,
    expectedYield,
    expectedYieldUnit,
    ingredients,
    gasCost,
    staff,
    notes,
    type,
    destination
  } = req.body;

  if (!dish || !dish.trim()) {
    return res.status(400).json({ success: false, error: 'Dish name is required' });
  }
  if (!ingredients || !ingredients.length) {
    return res.status(400).json({ success: false, error: 'At least one ingredient is required' });
  }

  const count = await Production.countDocuments();
  const no = `PROD-${String(count + 97).padStart(5, '0')}`;
  const batchNo = `BATCH-${String(count + 51).padStart(5, '0')}`;

  let totalCost = 0;
  const processedIngredients = [];

  // ── Pass 1: validate every ingredient BEFORE touching any stock.
  // This prevents a partial deduction where ingredient 1 succeeds but
  // ingredient 3 fails — stock would be permanently wrong with no rollback.
  if (Array.isArray(ingredients)) {
    for (const ing of ingredients) {
      const q = Number(ing.qty) || 0;
      if (!ing.name || q <= 0) continue;

      const stockItem = await KitchenStock.findOne({ name: new RegExp(`^${sanitizeRegex(ing.name.trim())}$`, 'i') });
      if (!stockItem) {
        return res.status(404).json({ success: false, error: `Ingredient "${ing.name}" not found in stock` });
      }
      if (stockItem.qty < q) {
        return res.status(400).json({ success: false, error: `Not enough ${stockItem.name}. Have ${stockItem.qty}, need ${q}` });
      }
    }
  }

  // ── Pass 2: all ingredients validated — now safe to deduct.
  if (Array.isArray(ingredients)) {
    for (const ing of ingredients) {
      const q = Number(ing.qty) || 0;
      if (!ing.name || q <= 0) continue;

      const stockItem = await KitchenStock.findOne({ name: new RegExp(`^${sanitizeRegex(ing.name.trim())}$`, 'i') });

      const unitCost = stockItem.price || stockItem.cost || 0;
      stockItem.qty = Math.max(0, stockItem.qty - q);
      await stockItem.save();

      await KitchenMovement.create({
        date: nowStamp(),
        item: stockItem.name,
        qtyIn: 0,
        qtyOut: q,
        balance: stockItem.qty,
        reason: `Production Started (${no})`,
      });

      totalCost += unitCost * q;
      processedIngredients.push({ name: ing.name, qty: q, unit: stockItem.unit });
    }
  }

  // Add gas/fuel cost on top of ingredient costs.
  totalCost += Number(gasCost) || 0;

  // Actual output isn't known yet — that's recorded later via completeProduction.
  const run = await Production.create({
    id: uuidv4(),
    no,
    productionNo: no,
    batchNo,
    dish: dish.trim(),
    outputQty: outputQty ? Number(outputQty) : null,
    outputUnit: outputUnit || 'plates',
    expectedYield: expectedYield ? Number(expectedYield) : null,
    expectedYieldUnit: expectedYieldUnit || 'plates',
    type: type || 'rts',
    cost: totalCost,
    gasCost: Number(gasCost) || 0,
    meals: [],
    ingredients: processedIngredients,
    staff: staff || (req.user ? req.user.name : 'Head Chef'),
    by: staff || (req.user ? req.user.name : 'Head Chef'),
    notes: notes || '',
    remarks: notes || '',
    date: nowStamp(),
    status: 'in-progress',
    destination: destination || 'Main Restaurant / POS',
  });

  res.status(201).json({ success: true, data: run });
});

/**
 * PUT /production/:id
 * Records the actual yield once a run finishes — outputQty/outputUnit
 * and notes. Does NOT re-touch stock/ingredient deductions (those were
 * already applied at record time). Blocked once a run has been voided,
 * since voiding already restored stock and closed the run out.
 *
 * When outputQty is recorded and an expectedYield was captured at start,
 * this also computes yieldVariancePct and costPerUnit, and — unless the
 * caller explicitly sends a different status — flips the run from
 * 'in-progress' ("Awaiting Yield" in the UI) to 'completed'.
 */
exports.completeProduction = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { outputQty, outputUnit, notes, status } = req.body;

  const run = await Production.findOne({ id });
  if (!run) return res.status(404).json({ success: false, error: 'Production run not found' });
  if (run.status === 'voided') {
    return res.status(400).json({ success: false, error: 'Cannot edit a voided production run' });
  }

  if (outputQty !== undefined) {
    const q = Number(outputQty);
    if (!q || q <= 0) {
      return res.status(400).json({ success: false, error: 'outputQty must be a number > 0' });
    }
    run.outputQty = q;
    if (Array.isArray(run.meals) && run.meals[0]) run.meals[0].qty = q;

    if (run.expectedYield) {
      run.yieldVariancePct = Math.round(((q - run.expectedYield) / run.expectedYield) * 10000) / 100;
    }
    if (run.cost) {
      run.costPerUnit = Math.round((run.cost / q) * 100) / 100;
    }
    if (status === undefined) {
      run.status = 'completed';
    }
  }
  if (outputUnit !== undefined) {
    run.outputUnit = outputUnit;
    if (Array.isArray(run.meals) && run.meals[0]) run.meals[0].unit = outputUnit;
  }
  if (notes !== undefined) {
    run.notes = notes;
    run.remarks = notes;
  }
  if (status !== undefined) run.status = status;

  await run.save();
  res.json({ success: true, data: run });
});

exports.voidProduction = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const run = await Production.findOne({ id });
  if (!run) return res.status(404).json({ success: false, error: 'Production run not found' });
  if (run.status === 'voided') return res.status(400).json({ success: false, error: 'Already voided' });

  run.status = 'voided';
  run.voidReason = reason || 'Discarded batch';
  run.voidDate = new Date();
  run.voidedBy = req.user ? req.user.name : 'Head Chef';
  await run.save();

  if (Array.isArray(run.ingredients)) {
    for (const ing of run.ingredients) {
      const stockItem = await KitchenStock.findOne({ name: new RegExp(`^${ing.name.trim()}$`, 'i') });
      if (stockItem) {
        stockItem.qty += Number(ing.qty);
        await stockItem.save();

        await KitchenMovement.create({
          date: nowStamp(),
          item: stockItem.name,
          qtyIn: Number(ing.qty),
          qtyOut: 0,
          balance: stockItem.qty,
          reason: `Void Production (${run.no}) — Restored`,
        });
      }
    }
  }

  res.json({ success: true, data: run });
});

/* ── Meal Transfers ── */
exports.listTransfers = asyncHandler(async (req, res) => {
  const list = await Transfer.find().sort({ createdAt: -1 });
  res.json({ success: true, count: list.length, data: list });
});

exports.addTransfer = asyncHandler(async (req, res) => {
  const { productionNo, meal, quantity, unit, sentBy, remarks, restaurant } = req.body;
  if (!meal || !quantity || Number(quantity) <= 0) {
    return res.status(400).json({ success: false, error: 'Meal name and valid quantity required' });
  }

  const count = await Transfer.countDocuments();
  const transferNo = `KTN-${String(count + 46).padStart(5, '0')}`;

  const transfer = await Transfer.create({
    id: uuidv4(),
    transferNo,
    productionNo: productionNo || '',
    meal: meal.trim(),
    quantity: Number(quantity),
    unit: unit || 'Plates',
    sentBy: sentBy || (req.user ? req.user.name : 'Head Chef'),
    dateSent: nowStamp(),
    status: 'sent',
    remarks: remarks || '',
    restaurant: restaurant || 'Main Restaurant / POS',
  });

  res.status(201).json({ success: true, data: transfer });
});

exports.updateTransferStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, cancelReason, rejectReason, receivedBy } = req.body;

  const transfer = await Transfer.findOne({ id });
  if (!transfer) return res.status(404).json({ success: false, error: 'Transfer not found' });

  if (status) transfer.status = status;
  if (cancelReason) transfer.cancelReason = cancelReason;
  if (rejectReason) transfer.rejectReason = rejectReason;
  if (receivedBy) transfer.receivedBy = receivedBy;
  if (status === 'accepted') transfer.dateReceived = nowStamp();

  await transfer.save();
  res.json({ success: true, data: transfer });
});

/* ── Requisitions (Kitchen → Store, status tracking) ── */
/**
 * GET /requisitions
 * Powers the dashboard's "Incoming Store Requisitions" panel
 * (svc.getKitchenRequisitions() in kitchen-dashboard.html).
 * Kitchen just watches fulfillment status (Pending/Partial/Full/Rejected)
 * come back — raising/fulfilling happens on the Store side.
 *
 * Field names are mapped to what the dashboard's paint() expects:
 * r.no, r.items.length, r.dateRaisedDisplay, r.status.
 */
exports.listKitchenRequisitions = asyncHandler(async (req, res) => {
  const list = await Requisition.find({ dept: 'Kitchen' }).sort({ dateRaised: -1 });

  const data = list.map(r => ({
    id: r.id,
    no: r.requisitionNo,
    dept: r.dept,
    requester: r.requester,
    priority: r.priority,
    status: r.status,
    items: r.items,
    dateRaised: r.dateRaised,
    dateRaisedDisplay: formatDate(r.dateRaised),
  }));

  res.json({ success: true, count: data.length, data });
});

/* ── Recipes & Movements ── */
exports.listRecipes = asyncHandler(async (req, res) => {
  const list = await Recipe.find().sort({ dish: 1 });
  res.json({ success: true, count: list.length, data: list });
});

/**
 * Recipe.id is required + unique in the schema, but kitchen-recipes.html
 * never sends one — it only sends dish/baseQty/baseUnit/ingredients/
 * expectedYield/expectedYieldUnit. Passing req.body straight to
 * Recipe.create() therefore always failed schema validation. Generate
 * the id server-side as a uuidv4, consistent with every other model's
 * app-level id (KitchenStock, PoolbarStock, Sale, PoolbarOrder,
 * Requisition).
 */
exports.createRecipe = asyncHandler(async (req, res) => {
  const { dish, baseQty, baseUnit, baseIngredient, ingredients, expectedYield, expectedYieldUnit, gasCostPerUnit, notes } = req.body;

  const existing = await Recipe.findOne({ dish: new RegExp(`^${dish.trim()}$`, 'i') });
  if (existing) {
    return res.status(409).json({ success: false, error: `A recipe for "${dish}" already exists` });
  }

  const recipe = await Recipe.create({
    id: uuidv4(),
    dish: dish.trim(),
    baseQty: baseQty !== undefined ? Number(baseQty) : 1,
    baseUnit: baseUnit || 'kg',
    baseIngredient: baseIngredient || '',
    ingredients: ingredients || [],
    expectedYield: expectedYield !== undefined ? Number(expectedYield) : 0,
    expectedYieldUnit: expectedYieldUnit || 'plates',
    gasCostPerUnit: gasCostPerUnit !== undefined ? Number(gasCostPerUnit) : 0,
    notes: notes || '',
  });

  res.status(201).json({ success: true, data: recipe });
});

/**
 * FIX: was Recipe.findById(id) — Mongo `_id`, not the recipe's own `id`
 * field. Recipe.id is what createRecipe generates and what any caller
 * actually has (RCP-#### previously, now a uuidv4), so this always
 * 404'd whenever the frontend correctly passed recipe.id back.
 */
exports.editRecipe = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const recipe = await Recipe.findOne({ id });
  if (!recipe) return res.status(404).json({ success: false, error: 'Recipe not found' });

  const { dish, baseQty, baseUnit, baseIngredient, ingredients, expectedYield, expectedYieldUnit, gasCostPerUnit, notes } = req.body;
  if (dish !== undefined) recipe.dish = dish.trim();
  if (baseQty !== undefined) recipe.baseQty = Number(baseQty);
  if (baseUnit !== undefined) recipe.baseUnit = baseUnit;
  if (baseIngredient !== undefined) recipe.baseIngredient = baseIngredient;
  if (ingredients !== undefined) recipe.ingredients = ingredients;
  if (expectedYield !== undefined) recipe.expectedYield = Number(expectedYield);
  if (expectedYieldUnit !== undefined) recipe.expectedYieldUnit = expectedYieldUnit;
  if (gasCostPerUnit !== undefined) recipe.gasCostPerUnit = Number(gasCostPerUnit);
  if (notes !== undefined) recipe.notes = notes;

  await recipe.save();
  res.json({ success: true, data: recipe });
});

/**
 * FIX: was Recipe.findByIdAndDelete(req.params.id) — same Mongo `_id`
 * vs. app-level `id` mismatch as editRecipe above.
 */
exports.deleteRecipe = asyncHandler(async (req, res) => {
  const recipe = await Recipe.findOneAndDelete({ id: req.params.id });
  if (!recipe) return res.status(404).json({ success: false, error: 'Recipe not found' });
  res.json({ success: true, message: `Recipe "${recipe.dish}" deleted` });
});

exports.listMovements = asyncHandler(async (req, res) => {
  const list = await KitchenMovement.find().sort({ createdAt: -1 }).limit(100);
  res.json({ success: true, count: list.length, data: list });
});

/* ── Create Requisition (Kitchen → Store) ── */
exports.createRequisition = asyncHandler(async (req, res) => {
  const { requester, dept, priority, remark, neededBy, items } = req.body;

  const counter = await Counter.findOneAndUpdate(
    { key: 'req:KREQ' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  const requisitionNo = `KREQ-${new Date().getFullYear()}-${String(counter.seq).padStart(5, '0')}`;
  const now = new Date();
  const dateRaisedISO = now.toISOString().split('T')[0];
  const dateRaisedDisplay = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const reqDoc = await Requisition.create({
    id: requisitionNo,
    requisitionNo,
    mode: 'store_issue',
    requester: requester || (req.user ? req.user.name : 'Kitchen'),
    dept: dept || 'Kitchen',
    priority: priority || 'Normal',
    remark: remark || '',
    neededBy: neededBy || '',
    fulfillStore: 'Central Store',
    items: items.map(i => ({
      name: i.name,
      stockId: i.stockId || '',
      unit: i.unit || 'kg',
      qty: Number(i.qty) || 0,
      cost: Number(i.cost) || 0,
      remark: i.remark || '',
      issuedQty: 0,
    })),
    status: 'Pending',
    dateRaised: dateRaisedISO,
    dateRaisedDisplay,
  });

  res.status(201).json({ success: true, data: reqDoc });
});

/* ── Requisition receive (mirrors poolbar/restaurant) ── */

async function logMovement(item, qtyIn, qtyOut, balance, reason) {
  try {
    await KitchenMovement.create({ date: nowStamp(), item, qtyIn, qtyOut, balance, reason });
  } catch (_) { /* non-critical */ }
}

exports.receiveRequisition = asyncHandler(async (req, res) => {
  const reqDoc = await Requisition.findOne({ $or: [{ id: req.params.id }, { requisitionNo: req.params.id }] });
  if (!reqDoc) return res.status(404).json({ success: false, error: 'Requisition not found' });

  for (const it of (reqDoc.items || [])) {
    const addQty = Number(it.issuedQty > 0 ? it.issuedQty : (it.issuedQty !== 0 ? it.qty : 0)) || 0;
    if (addQty <= 0) continue;

    let stockItem = null;
    if (it.stockId) {
      stockItem = await KitchenStock.findOne({ id: it.stockId }).catch(() => null);
    }
    if (!stockItem) {
      stockItem = await KitchenStock.findOne({ name: new RegExp(`^${sanitizeRegex(it.name.trim())}$`, 'i') });
    }

    if (stockItem) {
      stockItem.qty += addQty;
      if (Number(it.cost) > 0) { stockItem.price = Number(it.cost); stockItem.cost = Number(it.cost); }
      await stockItem.save();
    } else {
      stockItem = await KitchenStock.create({
        id: it.stockId || uuidv4(),
        name: it.name.trim(),
        category: 'General',
        unit: it.unit || 'kg',
        qty: addQty,
        min: 10,
        price: Number(it.cost) || 0,
        cost: Number(it.cost) || 0,
        batch: reqDoc.requisitionNo || '—',
      });
    }

    await logMovement(stockItem.name, addQty, 0, stockItem.qty, `Requisition Received (${reqDoc.requisitionNo})`);
  }

  reqDoc.status = 'Completed';
  await reqDoc.save();

  res.json({ success: true, data: reqDoc });
});