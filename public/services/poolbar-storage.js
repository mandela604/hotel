// services/poolbar-storage.js

/* ═══════════════════════════════════════════════
   STORAGE ADAPTERS — the only file that knows HOW data is persisted.

   Two adapters live here:
   - The demo storage shim (window.storage if the host page provides
     one, otherwise localStorage) used when CONFIG.USE_DEMO is true.
   - apiFetch, the one function that knows how to talk to the real
     backend, used when CONFIG.USE_DEMO is false.

   poolbar-data.js never persists anything directly — it always goes
   through loadLocal/saveLocal or apiFetch from here. Swapping storage
   backends (a different browser storage API, a different HTTP client,
   auth scheme, etc.) only ever means editing this file.
═══════════════════════════════════════════════ */

import { CONFIG } from './poolbar-config.js';

/* ── Demo storage shim — never touched when CONFIG.USE_DEMO is false;
     every production read/write goes through apiFetch below instead. ── */
export const storage = window.storage || {
  async get(key, shared) {
    const v = localStorage.getItem(key);
    return v == null ? null : { key, value: v, shared };
  },
  async set(key, value, shared) {
    localStorage.setItem(key, value);
    return { key, value, shared };
  },
  async delete(key, shared) {
    localStorage.removeItem(key);
    return { key, deleted: true, shared };
  },
  async list(prefix, shared) {
    const keys = Object.keys(localStorage).filter(k => !prefix || k.startsWith(prefix));
    return { keys, prefix, shared };
  }
};

/* ── Storage keys — one place to see everything Pool Bar persists ── */
export const KEY_STOCK = 'poolbar-stock';
export const KEY_SALES = 'poolbar-sales';
export const KEY_ORDERS = 'poolbar-orders';
export const KEY_PENDING = 'poolbar-pending-requisitions';
export const KEY_MOVEMENTS = 'poolbar-movements';
export const KEY_TRANSFERS = 'poolbar-store-transfers';

/* ── Demo-mode read/write helpers ── */
export async function loadLocal(key, fallback) {
  try {
    const r = await storage.get(key, true);
    if (r && r.value) {
      const parsed = JSON.parse(r.value);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch (e) {}
  return fallback;
}

export async function saveLocal(key, value) {
  try {
    await storage.set(key, JSON.stringify(value), true);
  } catch (e) {
    console.warn('[PoolBarData] Failed to save', key, e);
  }
}

/* ── Production backend call helper ──
   Every mutating (and the one bulk-read) function in poolbar-data.js
   calls this when CONFIG.USE_DEMO is false. It never falls back to
   demo data — a failed call always throws, and the page that called
   it is responsible for showing that failure to the user. This is the
   one place that knows how to talk to the real API, so going live
   never requires touching the individual get/create/edit/delete
   functions in poolbar-data.js. ── */
export async function apiFetch(method, path, body) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(CONFIG.API_KEY ? { Authorization: `Bearer ${CONFIG.API_KEY}` } : {}),
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(`${CONFIG.API_BASE}${path}`, opts);
  } catch (err) {
    // Network failure, DNS failure, CORS failure, etc. — surface it as-is.
    throw new Error(`Could not reach the server: ${err.message}`);
  }

  if (!res.ok) {
    // Try to pull a real message out of the error body; fall back to the
    // HTTP status if the server didn't send one.
    let detail = '';
    try {
      const errBody = await res.json();
      detail = errBody.message || errBody.error || '';
    } catch (e) { /* body wasn't JSON, or was empty — that's fine */ }
    throw new Error(detail || `Server returned ${res.status} ${res.statusText}`);
  }

  if (res.status === 204) return null; // No Content
  try {
    return await res.json();
  } catch (e) {
    return null; // OK response with no/invalid JSON body
  }
}

/* ── Small shared utilities used when writing new demo records ── */
export function generateId() {
  return 'pbs' + Date.now();
}

export function nowStamp() {
  return new Date()
    .toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
    .replace(',', '');
}