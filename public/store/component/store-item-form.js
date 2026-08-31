/**
 * component/store-item-form.js — Add / Edit Stock Item modal
 * ──────────────────────────────────────────────────────────
 * Item Master form for Central Store.
 * Qty and Avg Cost always start at 0 and are system-controlled.
 * They only change when Store receives goods from Procurement.
 *
 * Usage:
 *   StoreItemForm.open({
 *     mode: 'add',                    // or 'edit'
 *     item: null,                     // existing item when editing
 *     categories: ['Food Staples', …],
 *     onSave: async (entry) => { … }, // required
 *     onCancel: () => {},             // optional
 *   });
 *
 *   StoreItemForm.close();
 */
(function (global) {
  'use strict';

  if (global.StoreItemForm) return;

  const CSS = `
    .sif-overlay{
      display:none; position:fixed; inset:0; background:rgba(15,20,40,0.55);
      backdrop-filter:blur(4px); z-index:400;
      align-items:center; justify-content:center; padding:16px;
      font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif;
    }
    .sif-overlay.show{ display:flex; }
    .sif-modal{
      background:#fff; border:1px solid #eef0f6; border-radius:18px;
      width:min(520px,96vw); max-height:calc(100vh - 32px);
      box-shadow:0 30px 80px rgba(15,20,40,0.25);
      display:flex; flex-direction:column; overflow:hidden;
      animation:sifIn .22s cubic-bezier(.4,0,.2,1); color:#1c2440;
    }
    @keyframes sifIn{ from{opacity:0;transform:translateY(14px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
    .sif-header{
      display:flex; align-items:center; justify-content:space-between;
      padding:20px 24px 0; flex-shrink:0;
    }
    .sif-title{ font-size:18px; font-weight:800; color:#1c2440; margin:0; }
    .sif-close{
      background:#f4f6fb; border:1px solid #eef0f6; border-radius:8px;
      width:32px; height:32px; color:#6b7280; font-size:14px; cursor:pointer;
      display:flex; align-items:center; justify-content:center; transition:all .2s;
    }
    .sif-close:hover{ color:#f04438; border-color:rgba(240,68,56,0.3); }
    .sif-body{
      padding:16px 24px; overflow-y:auto; flex:1; min-height:0;
    }
    .sif-section{
      font-size:9px; text-transform:uppercase; letter-spacing:2px;
      color:#2f6fed; font-weight:800; margin-bottom:12px; padding-bottom:7px;
      border-bottom:1px solid rgba(47,111,237,0.25);
    }
    .sif-row{ display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:4px; }
    @media (max-width:480px){ .sif-row{ grid-template-columns:1fr; } }
    .sif-group{ display:flex; flex-direction:column; gap:5px; margin-bottom:12px; }
    .sif-group.span2{ grid-column:span 2; }
    @media (max-width:480px){ .sif-group.span2{ grid-column:span 1; } }
    .sif-label{
      font-size:9px; text-transform:uppercase; letter-spacing:1.2px;
      color:#9aa1b3; font-weight:700;
    }
    .sif-input, .sif-select{
      background:#f4f6fb; border:1px solid #eef0f6; border-radius:9px;
      padding:10px 12px; color:#1c2440; font-family:inherit; font-size:13px;
      outline:none; transition:border-color .2s; width:100%;
    }
    .sif-input:focus, .sif-select:focus{ border-color:rgba(47,111,237,0.25); }
    .sif-input:disabled{
      background:#eef0f6; color:#9aa1b3; cursor:not-allowed;
    }
    .sif-hint{ font-size:11px; color:#9aa1b3; line-height:1.4; margin-top:2px; }
    .sif-footer{
      display:flex; gap:10px; justify-content:flex-end; align-items:center;
      padding:14px 24px 20px; border-top:1px solid #eef0f6; flex-shrink:0;
      background:#fff;
    }
    .sif-btn{
      display:inline-flex; align-items:center; justify-content:center; gap:6px;
      padding:10px 18px; border-radius:10px; font-family:inherit; font-size:13px;
      font-weight:700; cursor:pointer; transition:all .2s; border:1px solid transparent;
      white-space:nowrap; min-height:40px;
    }
    .sif-btn-outline{
      background:#fff; border-color:#eef0f6; color:#6b7280;
    }
    .sif-btn-outline:hover{ border-color:#2f6fed; color:#2f6fed; }
    .sif-btn-primary{
      background:#2f6fed; color:#fff;
    }
    .sif-btn-primary:hover{ background:#5b8ff9; }
    .sif-btn-primary:disabled{ opacity:.55; cursor:not-allowed; }
  `;

  const UNITS = ['kg','g','Ltr','ml','pcs','Bottles','Cans','Packs','Cartons','Bags','Crates'];
  const BASE_UNITS = ['','pcs','kg','g','Ltr','ml','Bottles','Cans','Packs','Bags'];

  let root = null;
  let opts = null;
  let saving = false;

  function ensureDom() {
    if (root) return;
    const style = document.createElement('style');
    style.id = 'sif-css';
    style.textContent = CSS;
    document.head.appendChild(style);

    root = document.createElement('div');
    root.className = 'sif-overlay';
    root.id = 'sifOverlay';
    root.innerHTML = `
      <div class="sif-modal" role="dialog" aria-modal="true">
        <div class="sif-header">
          <h2 class="sif-title" data-role="title">Add Stock Item</h2>
          <button type="button" class="sif-close" data-act="close" aria-label="Close">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="sif-body">
          <div class="sif-section">Item Details</div>
          <div class="sif-row">
            <div class="sif-group span2">
              <label class="sif-label">Item Name</label>
              <input class="sif-input" type="text" data-role="name" placeholder="e.g. Rice (Long Grain), Bottled Water, Palm Oil" autocomplete="off">
            </div>
            <div class="sif-group">
              <label class="sif-label">Category</label>
              <select class="sif-select" data-role="cat"></select>
            </div>
            <div class="sif-group">
              <label class="sif-label">Unit</label>
              <select class="sif-select" data-role="unit">
                ${UNITS.map(u => `<option value="${u}">${u}</option>`).join('')}
              </select>
            </div>
            <div class="sif-group">
              <label class="sif-label">Base Unit (optional)</label>
              <select class="sif-select" data-role="baseUnit">
                ${BASE_UNITS.map(u => `<option value="${u}">${u || '— same as Unit —'}</option>`).join('')}
              </select>
              <div class="sif-hint">The individual unit inside each pack. E.g. if Unit = "Cartons" and 1 Carton = 12 Bottles, set Base Unit = "Bottles".</div>
            </div>
            <div class="sif-group">
              <label class="sif-label">Pack Size</label>
              <input class="sif-input" type="number" data-role="packSize" placeholder="0" min="0" step="1">
              <div class="sif-hint">How many base units in one pack. E.g. 12 Bottles per Carton. For variable items (Cow, Pepper), leave at 0 when receiving, then set after portioning — cost will auto-recalculate per base unit.</div>
            </div>
            <div class="sif-group">
              <label class="sif-label">Quantity On Hand</label>
              <input class="sif-input" type="number" data-role="qty" value="0" disabled>
              <div class="sif-hint">Always starts at 0. Updated only when Procurement sends goods to Store.</div>
            </div>
            <div class="sif-group">
              <label class="sif-label">Reorder Level (in base units)</label>
              <input class="sif-input" type="number" data-role="reorder" placeholder="0" min="0" step="any">
              <div class="sif-hint">Stock alert triggers when on-hand drops below this (measured in base units).</div>
            </div>
            <div class="sif-group span2">
              <label class="sif-label">Average Unit Cost (₦)</label>
              <input class="sif-input" type="number" data-role="cost" value="0" disabled>
              <div class="sif-hint">Always starts at 0. Calculated automatically when goods are received from Procurement (weighted average).</div>
            </div>
          </div>
        </div>
        <div class="sif-footer">
          <button type="button" class="sif-btn sif-btn-outline" data-act="close">Cancel</button>
          <button type="button" class="sif-btn sif-btn-primary" data-act="save" data-role="saveBtn">
            <i class="fa-solid fa-check"></i> <span data-role="saveLabel">Save Item</span>
          </button>
        </div>
      </div>`;
    document.body.appendChild(root);

    root.addEventListener('click', function (e) {
      if (e.target === root) close();
      const act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'close') close();
      if (act.dataset.act === 'save') save();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root && root.classList.contains('show')) close();
    });
  }

  function $(sel) { return root.querySelector(sel); }

  function fillCategories(categories, selected) {
    const sel = $('[data-role="cat"]');
    const list = (categories && categories.length) ? categories : ['Other'];
    sel.innerHTML = list.map(c =>
      `<option value="${esc(c)}"${c === selected ? ' selected' : ''}>${esc(c)}</option>`
    ).join('');
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function open(options) {
    ensureDom();
    opts = options || {};
    const isEdit = opts.mode === 'edit' && opts.item;
    const item = opts.item || {};

    $('[data-role="title"]').textContent = isEdit ? 'Edit Stock Item' : 'Add Stock Item';
    $('[data-role="saveLabel"]').textContent = isEdit ? 'Save Changes' : 'Save Item';

    $('[data-role="name"]').value = item.name || '';
    fillCategories(opts.categories, item.cat || (opts.categories && opts.categories[0]) || 'Other');
    $('[data-role="unit"]').value = item.unit || 'kg';
    $('[data-role="baseUnit"]').value = item.baseUnit || '';
    $('[data-role="packSize"]').value = item.packSize || '';
    $('[data-role="qty"]').value = item.qty != null ? item.qty : 0;
    $('[data-role="reorder"]').value = item.reorder != null && item.reorder !== '' ? item.reorder : (item.min != null ? item.min : '');
    $('[data-role="cost"]').value = item.cost != null ? item.cost : 0;

    // Always locked — system controlled
    $('[data-role="qty"]').disabled = true;
    $('[data-role="cost"]').disabled = true;

    saving = false;
    const saveBtn = $('[data-role="saveBtn"]');
    if (saveBtn) saveBtn.disabled = false;

    root.classList.add('show');
    setTimeout(function () {
      const nameInput = $('[data-role="name"]');
      if (nameInput) nameInput.focus();
    }, 50);
  }

  function close() {
    if (!root) return;
    root.classList.remove('show');
    if (opts && typeof opts.onCancel === 'function') {
      try { opts.onCancel(); } catch (e) {}
    }
    opts = null;
  }

  async function save() {
    if (!opts || saving) return;
    const name = ($('[data-role="name"]').value || '').trim();
    if (!name) {
      $('[data-role="name"]').focus();
      if (typeof opts.onError === 'function') opts.onError('Please enter an item name.');
      else alert('Please enter an item name.');
      return;
    }

    const isEdit = opts.mode === 'edit' && opts.item;
    const entry = {
      id: isEdit ? opts.item.id : null,
      name: name,
      cat: $('[data-role="cat"]').value,
      unit: $('[data-role="unit"]').value,
      baseUnit: $('[data-role="baseUnit"]').value,
      packSize: parseFloat($('[data-role="packSize"]').value) || 0,
      reorder: parseFloat($('[data-role="reorder"]').value) || 0,
      qty: isEdit ? (opts.item.qty ?? 0) : 0,
      cost: isEdit ? (opts.item.cost ?? 0) : 0,
    };

    saving = true;
    const saveBtn = $('[data-role="saveBtn"]');
    if (saveBtn) saveBtn.disabled = true;

    try {
      if (typeof opts.onSave === 'function') {
        await opts.onSave(entry, isEdit);
      }
      root.classList.remove('show');
      opts = null;
    } catch (err) {
      if (typeof opts.onError === 'function') opts.onError(err.message || 'Could not save item.');
      else alert(err.message || 'Could not save item.');
    } finally {
      saving = false;
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  global.StoreItemForm = {
    open: open,
    close: close,
  };
})(window);
