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

  let storeItem = null;
  if (storeId) {
    const StoreStock = require('../models/StoreStock');
    storeItem = await StoreStock.findOne({ id: storeId }).catch(function(){ return null; });
    if (!storeItem) {
      return res.status(400).json({ success: false, error: 'Selected Store item not found — please re-pick from dropdown.' });
    }
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
    id: storeId || uuidv4(),
    storeId: storeId || '',
    procurementId: storeItem ? (storeItem.procurementId || '') : '',
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

  const item = await KitchenStock.findOne({ name: new RegExp(`^${sanitizeRegex(name.trim())}$`, 'i') });
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
    destination,
    cooId,
    recipeId,
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

      if (!ing.stockId) {
        return res.status(400).json({ success: false, error: `Missing stockId for "${ing.name}" — pick from Kitchen inventory.` });
      }
      const stockItem = await KitchenStock.findOne({ id: ing.stockId });
      if (!stockItem) {
        return res.status(404).json({ success: false, error: `Ingredient "${ing.name}" (stockId: ${ing.stockId}) not found in KitchenStock.` });
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

      const stockItem = await KitchenStock.findOne({ id: ing.stockId });

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
    recipeId: recipeId || '',
    outputQty: outputQty ? Number(outputQty) : null,
    outputUnit: outputUnit || 'portions',
    expectedYield: expectedYield ? Number(expectedYield) : null,
    expectedYieldUnit: expectedYieldUnit || 'portions',
    type: type || 'rts',
    cooId: cooId || '',
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
 * POST /production/batch
 * Creates a single Production document containing multiple dishes.
 * Each dish has its own recipe, expected yield, and ingredient deductions.
 * Works for both normal (rts) and Cook on Order (coo) production.
 */
exports.recordBatchProduction = asyncHandler(async (req, res) => {
  const { dishes, type, cooId, staff, notes, destination } = req.body;

  if (!dishes || !dishes.length) {
    return res.status(400).json({ success: false, error: 'At least one dish is required' });
  }

  const count = await Production.countDocuments();
  const no = `PROD-${String(count + 97).padStart(5, '0')}`;
  const batchNo = `BATCH-${String(count + 51).padStart(5, '0')}`;

  let totalCost = 0;
  const processedDishes = [];
  const allIngredients = [];

  // ── Pass 1: validate ALL ingredients for ALL dishes before touching stock ──
  for (let di = 0; di < dishes.length; di++) {
    const d = dishes[di];
    if (!d.recipeId) {
      return res.status(400).json({ success: false, error: `Dish ${di + 1}: recipeId is required` });
    }
    const recipe = await Recipe.findOne({ id: d.recipeId });
    if (!recipe) {
      return res.status(400).json({ success: false, error: `Dish ${di + 1}: recipe not found` });
    }
    const batchQty = Number(d.batchQty) || 0;
    if (batchQty <= 0) {
      return res.status(400).json({ success: false, error: `Dish ${di + 1} (${recipe.dish}): batchQty must be > 0` });
    }
    const factor = recipe.baseQty > 0 ? batchQty / recipe.baseQty : 0;
    const scaledIngredients = recipe.ingredients.map(ing => ({
      name: ing.name,
      unit: ing.unit || '',
      qty: Math.round(ing.qty * factor * 1000) / 1000,
    }));
    for (const ing of scaledIngredients) {
      if (!ing.name || ing.qty <= 0) continue;
      const stockItem = await KitchenStock.findOne({ name: new RegExp(`^${sanitizeRegex(ing.name.trim())}$`, 'i') });
      if (!stockItem) {
        return res.status(400).json({ success: false, error: `Dish ${di + 1} (${recipe.dish}): ingredient "${ing.name}" not in Kitchen Stock` });
      }
      if (stockItem.qty < ing.qty) {
        return res.status(400).json({ success: false, error: `Dish ${di + 1} (${recipe.dish}): not enough ${stockItem.name}. Have ${stockItem.qty}, need ${ing.qty}` });
      }
    }
  }

  // ── Pass 2: all validated — deduct ingredients and build dishes array ──
  for (let di = 0; di < dishes.length; di++) {
    const d = dishes[di];
    const recipe = await Recipe.findOne({ id: d.recipeId });
    const batchQty = Number(d.batchQty) || 0;
    const factor = recipe.baseQty > 0 ? batchQty / recipe.baseQty : 0;
    const expectedYield = Math.round(recipe.expectedYield * factor * 100) / 100;

    let dishCost = 0;
    const dishIngredients = [];

    for (const ing of recipe.ingredients) {
      const q = Math.round(ing.qty * factor * 1000) / 1000;
      if (!ing.name || q <= 0) continue;

      const stockItem = await KitchenStock.findOne({ name: new RegExp(`^${sanitizeRegex(ing.name.trim())}$`, 'i') });
      const unitCost = stockItem ? (stockItem.price || stockItem.cost || 0) : 0;

      if (stockItem) {
        stockItem.qty = Math.max(0, stockItem.qty - q);
        await stockItem.save();

        await KitchenMovement.create({
          date: nowStamp(),
          item: stockItem.name,
          qtyIn: 0,
          qtyOut: q,
          balance: stockItem.qty,
          reason: `Batch Production (${no}) — ${recipe.dish}`,
        });
      }

      dishCost += unitCost * q;
      dishIngredients.push({ name: ing.name, qty: q, unit: stockItem ? stockItem.unit : (ing.unit || ''), stockId: stockItem ? stockItem.id : '', cost: unitCost * q });
      allIngredients.push({ name: ing.name, qty: q, unit: stockItem ? stockItem.unit : (ing.unit || '') });
    }

    totalCost += dishCost;

    processedDishes.push({
      recipeId: recipe.id,
      dish: recipe.dish,
      batchQty,
      expectedYield,
      expectedYieldUnit: recipe.expectedYieldUnit || 'portions',
      outputQty: 0,
      outputUnit: recipe.expectedYieldUnit || 'portions',
      yieldVariancePct: 0,
      ingredients: dishIngredients,
      cost: dishCost,
      status: 'in-progress',
      transferNo: '',
    });
  }

  const run = await Production.create({
    id: uuidv4(),
    no,
    productionNo: no,
    batchNo,
    dish: processedDishes.map(d => d.dish).join(', '),
    recipeId: processedDishes.length === 1 ? processedDishes[0].recipeId : '',
    type: type || 'rts',
    cooId: cooId || '',
    cost: totalCost,
    gasCost: 0,
    meals: [],
    ingredients: allIngredients,
    dishes: processedDishes,
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
 * Records actual yield. Supports both batch (dishes[]) and legacy single-dish.
 * For batch: pass { dishes: [{ dishIndex, outputQty, outputUnit }] }
 * For legacy: pass { outputQty, outputUnit }
 */
exports.completeProduction = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { outputQty, outputUnit, notes, status, dishes: dishUpdates } = req.body;

  const run = await Production.findOne({ id });
  if (!run) return res.status(404).json({ success: false, error: 'Production run not found' });
  if (run.status === 'voided') {
    return res.status(400).json({ success: false, error: 'Cannot edit a voided production run' });
  }

  // ── Batch mode: per-dish yield updates ──
  if (Array.isArray(dishUpdates) && dishUpdates.length && Array.isArray(run.dishes) && run.dishes.length) {
    for (const du of dishUpdates) {
      const idx = Number(du.dishIndex);
      if (isNaN(idx) || idx < 0 || idx >= run.dishes.length) continue;
      const dish = run.dishes[idx];
      if (dish.status === 'voided' || dish.status === 'completed') continue;

      const q = Number(du.outputQty) || 0;
      if (q <= 0) continue;

      dish.outputQty = q;
      if (du.outputUnit) dish.outputUnit = du.outputUnit;
      if (dish.expectedYield) {
        dish.yieldVariancePct = Math.round(((q - dish.expectedYield) / dish.expectedYield) * 10000) / 100;
      }
      dish.status = 'completed';

      // Auto-create transfer for COO dish
      if (run.cooId && dish.recipeId) {
        const existingTransfer = await Transfer.findOne({ cooId: run.cooId, meal: dish.dish });
        if (!existingTransfer) {
          const transferCount = await Transfer.countDocuments();
          const transfer = await Transfer.create({
            id: uuidv4(),
            transferNo: 'KTN-' + String(transferCount + 1).padStart(5, '0'),
            cooId: run.cooId,
            productionNo: run.id,
            meal: dish.dish,
            quantity: q,
            unit: dish.outputUnit || 'portions',
            kitchen: 'Main Kitchen',
            restaurant: 'Main Restaurant / POS',
            from: 'Main Kitchen',
            to: 'Main Restaurant / POS',
            sentBy: run.staff || 'Head Chef',
            dateSent: nowStamp(),
            status: 'sent',
            remarks: 'COO batch production',
          });
          dish.transferNo = transfer.transferNo;
        }
      }
    }

    // Compute top-level aggregated values
    const completedDishes = run.dishes.filter(d => d.status === 'completed');
    run.outputQty = completedDishes.reduce((s, d) => s + (d.outputQty || 0), 0);
    run.outputUnit = completedDishes.length ? (completedDishes[0].outputUnit || 'portions') : run.outputUnit;
    if (run.expectedYield) {
      run.yieldVariancePct = Math.round(((run.outputQty - run.expectedYield) / run.expectedYield) * 10000) / 100;
    }
    if (run.cost && run.outputQty) {
      run.costPerUnit = Math.round((run.cost / run.outputQty) * 100) / 100;
    }

    // All dishes completed → batch completed
    const allDone = run.dishes.every(d => d.status === 'completed' || d.status === 'voided');
    if (allDone || (status !== undefined)) {
      run.status = status || 'completed';
    }
  } else {
    // ── Legacy single-dish mode ──
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

    // Auto-create transfer for COO single-dish
    if (run.cooId && run.status === 'completed') {
      const existingTransfer = await Transfer.findOne({ cooId: run.cooId });
      if (!existingTransfer) {
        const KitchenCooOrder = require('../models/KitchenCooOrder');
        const cooOrder = await KitchenCooOrder.findOne({ id: run.cooId });
        const transferCount = await Transfer.countDocuments();
        const transfer = await Transfer.create({
          id: uuidv4(),
          transferNo: 'KTN-' + String(transferCount + 1).padStart(5, '0'),
          cooId: run.cooId,
          meal: run.dish,
          quantity: Number(run.outputQty) || 0,
          unit: run.outputUnit || 'portions',
          kitchen: 'Main Kitchen',
          restaurant: 'Main Restaurant / POS',
          from: 'Main Kitchen',
          to: 'Main Restaurant / POS',
          sentBy: run.staff || 'Head Chef',
          dateSent: nowStamp(),
          status: 'sent',
          remarks: 'COO production — ' + (cooOrder ? cooOrder.table : ''),
        });
        run.transferNo = transfer.transferNo;
      }
    }
  }

  if (notes !== undefined) {
    run.notes = notes;
    run.remarks = notes;
  }
  if (status !== undefined && !Array.isArray(dishUpdates)) run.status = status;

  await run.save();
  res.json({ success: true, data: run });
});

exports.voidProduction = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason, dishIndex } = req.body;

  const run = await Production.findOne({ id });
  if (!run) return res.status(404).json({ success: false, error: 'Production run not found' });
  if (run.status === 'voided') return res.status(400).json({ success: false, error: 'Already voided' });

  // ── Single-dish void (batch mode) ──
  if (dishIndex !== undefined && Array.isArray(run.dishes) && run.dishes.length) {
    const idx = Number(dishIndex);
    if (isNaN(idx) || idx < 0 || idx >= run.dishes.length) {
      return res.status(400).json({ success: false, error: 'Invalid dish index' });
    }
    const dish = run.dishes[idx];
    if (dish.status === 'voided') {
      return res.status(400).json({ success: false, error: 'Dish already voided' });
    }

    // Restore ingredients for this specific dish
    if (Array.isArray(dish.ingredients)) {
      for (const ing of dish.ingredients) {
        const stockItem = ing.stockId
          ? await KitchenStock.findOne({ id: ing.stockId })
          : await KitchenStock.findOne({ name: new RegExp(`^${sanitizeRegex(ing.name.trim())}$`, 'i') });
        if (stockItem) {
          stockItem.qty += Number(ing.qty);
          await stockItem.save();
          await KitchenMovement.create({
            date: nowStamp(),
            item: stockItem.name,
            qtyIn: Number(ing.qty),
            qtyOut: 0,
            balance: stockItem.qty,
            reason: `Void Batch Production (${run.no}) — ${dish.dish} — Restored`,
          });
        }
      }
    }

    dish.status = 'voided';

    // Recompute top-level output
    const activeDishes = run.dishes.filter(d => d.status !== 'voided');
    const completedDishes = run.dishes.filter(d => d.status === 'completed');
    run.outputQty = completedDishes.reduce((s, d) => s + (d.outputQty || 0), 0);
    if (run.cost && run.outputQty) {
      run.costPerUnit = Math.round((run.cost / run.outputQty) * 100) / 100;
    }

    // If all dishes voided → void entire batch
    const allVoided = run.dishes.every(d => d.status === 'voided');
    if (allVoided) {
      run.status = 'voided';
      run.voidReason = reason || 'All dishes voided';
      run.voidDate = new Date();
      run.voidedBy = req.user ? req.user.name : 'Head Chef';
    }

    await run.save();
    return res.json({ success: true, data: run });
  }

  // ── Full batch void (legacy or entire batch) ──
  run.status = 'voided';
  run.voidReason = reason || 'Discarded batch';
  run.voidDate = new Date();
  run.voidedBy = req.user ? req.user.name : 'Head Chef';

  // Void all dishes in batch
  if (Array.isArray(run.dishes)) {
    for (const dish of run.dishes) {
      if (dish.status !== 'voided') dish.status = 'voided';
    }
  }

  // Restore ingredients
  if (Array.isArray(run.dishes) && run.dishes.length) {
    // Batch mode: restore per-dish ingredients
    for (const dish of run.dishes) {
      if (Array.isArray(dish.ingredients)) {
        for (const ing of dish.ingredients) {
          const stockItem = ing.stockId
            ? await KitchenStock.findOne({ id: ing.stockId })
            : await KitchenStock.findOne({ name: new RegExp(`^${sanitizeRegex(ing.name.trim())}$`, 'i') });
          if (stockItem) {
            stockItem.qty += Number(ing.qty);
            await stockItem.save();
            await KitchenMovement.create({
              date: nowStamp(),
              item: stockItem.name,
              qtyIn: Number(ing.qty),
              qtyOut: 0,
              balance: stockItem.qty,
              reason: `Void Batch Production (${run.no}) — ${dish.dish} — Restored`,
            });
          }
        }
      }
    }
  } else if (Array.isArray(run.ingredients)) {
    // Legacy mode
    for (const ing of run.ingredients) {
      const stockItem = ing.stockId
        ? await KitchenStock.findOne({ id: ing.stockId })
        : await KitchenStock.findOne({ name: new RegExp(`^${sanitizeRegex(ing.name.trim())}$`, 'i') });
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

  await run.save();
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

  if (productionNo) {
    // For batch production, allow multiple transfers (one per dish).
    // Only block if a transfer with the same meal name already exists for this production.
    const existing = await Transfer.findOne({ productionNo, meal: meal.trim() });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Transfer already created for ' + meal + ' in this production run' });
    }
  }

  const count = await Transfer.countDocuments();
  const transferNo = `KTN-${String(count + 46).padStart(5, '0')}`;

  const transfer = await Transfer.create({
    id: uuidv4(),
    transferNo,
    productionNo: productionNo || '',
    meal: meal.trim(),
    quantity: Number(quantity),
    unit: unit || 'Portions',
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

  const existing = await Recipe.findOne({ dish: new RegExp(`^${sanitizeRegex(dish.trim())}$`, 'i') });
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
    expectedYieldUnit: expectedYieldUnit || 'portions',
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
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 100));
  const item  = req.query.item  ? new RegExp(sanitizeRegex(req.query.item.trim()),  'i') : null;
  const from  = req.query.from  ? new Date(req.query.from)  : null;
  const to    = req.query.to    ? new Date(req.query.to)    : null;

  const filter = {};
  if (item) filter.item = item;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to)   { to.setHours(23, 59, 59, 999); filter.createdAt.$lte = to; }
  }

  const [list, total] = await Promise.all([
    KitchenMovement.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    KitchenMovement.countDocuments(filter),
  ]);
  res.json({ success: true, count: list.length, total, page, pages: Math.ceil(total / limit), data: list });
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
      await stockItem.save();
    } else {
      const StoreStock = require('../models/StoreStock');
      const storeRef = it.stockId ? await StoreStock.findOne({ id: it.stockId }).catch(() => null) : null;
      stockItem = await KitchenStock.create({
        id: it.stockId || uuidv4(),
        storeId: it.stockId || '',
        procurementId: storeRef ? (storeRef.procurementId || '') : '',
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