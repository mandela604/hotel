'use strict';

const FoodMenu = require('../models/FoodMenu');

// Cached set of available shared-food names (lowercased).
// Food items sell with no stock validation/deduction in both departments.
// Short TTL so management CRUD reflects quickly; CRUD also emits
// foodmenu:updated for the live frontend refresh.
let cache = null;
let cacheAt = 0;
const TTL = 30000;

async function foodNameSet() {
  if (cache && Date.now() - cacheAt < TTL) return cache;
  try {
    const rows = await FoodMenu.find({ available: { $ne: false } }).select('name').lean();
    cache = new Set(rows.map(function (r) { return String(r.name || '').toLowerCase(); }));
  } catch (e) { cache = new Set(); }
  cacheAt = Date.now();
  return cache;
}

async function isFoodItem(name) {
  if (!name) return false;
  const set = await foodNameSet();
  return set.has(String(name).trim().toLowerCase());
}

function bustFoodCache() { cache = null; cacheAt = 0; }

module.exports = { foodNameSet, isFoodItem, bustFoodCache };
