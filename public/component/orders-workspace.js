/**
 * component/orders-workspace.js — Shared Quick Sale / Open Tab / Active Orders
 * ───────────────────────────────────────────────────────────────────────────
 * One component for Pool Bar + Restaurant. No requisition UI (raise those
 * from Transfer History / inventory pages via GraceHotelRequestForm).
 *
 * PREFERRED: pass a module service so all mutations go through one layer.
 *
 *   // Restaurant
 *   await RestaurantService.loadAll();
 *   OrdersWorkspace.attach('#appSlot', {
 *     module: 'restaurant',
 *     service: RestaurantService,
 *     shell: RestaurantShell,
 *     shellOptions: { ... },
 *     guests: [...],
 *   });
 *
 *   // Pool Bar
 *   await PoolBarService.loadAll();
 *   OrdersWorkspace.attach('#appSlot', {
 *     module: 'poolbar',
 *     service: PoolBarService,
 *     shell: PoolBarShell,
 *     shellOptions: { ... },
 *   });
 *
 * Service contract (minimal):
 *   state: { stock, sales, orders, movements, ready? }
 *   loadAll(): Promise
 *   onChange(fn): unsubscribe
 *   recordSale({ items, discount, method, staff, table, notes, roomNumber?, guestName? })
 *   openTab({ items, discount, staff, table, notes, roomNumber?, guestName? })
 *   markServed(orderId)
 *   payOrder(orderId, method | { method, roomNumber?, guestName? })
 *   cancelOrder(orderId)
 *
 * Guests: pass options.guests as [{ room, name, phone?, status? }, ...].
 * phone is optional — shown in the room/guest picker when present.
 *
 * Fallback (no service): uses keys + storage / demo / apiPaths as before.
 */

(function (global) {
  'use strict';

  if (global.OrdersWorkspace) return;

  const CSS = `
    .ow-root{
      --ow-bg:#f4f6fb; --ow-surface:#ffffff; --ow-surface2:#f4f6fb; --ow-surface3:#eef0f6;
      --ow-border:#eef0f6; --ow-border2:#dfe3ec;
      --ow-text:#1c2440; --ow-text2:#6b7280; --ow-text3:#9aa1b3;
      --ow-shadow:0 4px 20px rgba(15,34,55,0.07); --ow-shadow-lg:0 8px 40px rgba(15,34,55,0.10);
      --ow-gold:#2f6fed; --ow-gold-light:#5b8ff9; --ow-gold-dim:rgba(47,111,237,0.10); --ow-gold-border:rgba(47,111,237,0.25);
      --ow-green:#12b76a; --ow-green-bg:#e9f9f0;
      --ow-red:#f04438; --ow-red-bg:#feecec;
      --ow-amber:#f79009; --ow-amber-bg:#fff4e5;
      --ow-blue:#2f6fed; --ow-blue-bg:#eaf1ff;
      --ow-purple:#8b5cf6; --ow-purple-bg:#f4efff;
      font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif;
      font-size:13px; color:var(--ow-text);
      display:flex; flex-direction:column; gap:16px;
    }
    .ow-kpi-row{ display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
    @media (max-width:1100px){ .ow-kpi-row{ grid-template-columns:repeat(2,1fr); } }
    @media (max-width:420px){ .ow-kpi-row{ grid-template-columns:1fr 1fr; gap:10px; } }
    .ow-kpi{
      background:var(--ow-surface); border:1px solid var(--ow-border); border-radius:14px;
      padding:14px 14px 12px; position:relative; overflow:hidden; box-shadow:var(--ow-shadow);
      display:flex; flex-direction:column; transition:transform .2s,box-shadow .2s,border-color .2s;
      animation:owFadeUp .4s ease both;
    }
    .ow-kpi:nth-child(1){animation-delay:.04s} .ow-kpi:nth-child(2){animation-delay:.08s}
    .ow-kpi:nth-child(3){animation-delay:.12s} .ow-kpi:nth-child(4){animation-delay:.16s}
    .ow-kpi:hover{ transform:translateY(-2px); box-shadow:var(--ow-shadow-lg); border-color:var(--ow-gold-border); }
    .ow-kpi::before{ content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,var(--ow-gold),transparent); }
    .ow-kpi.acc-green::before{ background:linear-gradient(90deg,var(--ow-green),transparent); }
    .ow-kpi.acc-blue::before{ background:linear-gradient(90deg,var(--ow-blue),transparent); }
    .ow-kpi.acc-red::before{ background:linear-gradient(90deg,var(--ow-red),transparent); }
    .ow-kpi.acc-purple::before{ background:linear-gradient(90deg,var(--ow-purple),transparent); }
    .ow-kpi-top{ display:flex; align-items:flex-start; gap:10px; margin-bottom:6px; }
    .ow-kpi-ic{ width:30px; height:30px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:13px; flex-shrink:0; }
    .ow-ic-green{ background:var(--ow-green-bg); color:var(--ow-green); }
    .ow-ic-blue{ background:var(--ow-blue-bg); color:var(--ow-blue); }
    .ow-ic-red{ background:var(--ow-red-bg); color:var(--ow-red); }
    .ow-ic-purple{ background:var(--ow-purple-bg); color:var(--ow-purple); }
    .ow-kpi-label{ font-size:11px; color:var(--ow-text2); font-weight:600; line-height:1.3; }
    .ow-kpi-value{ font-size:22px; font-weight:800; color:var(--ow-text); margin:4px 0 2px; line-height:1; }
    .ow-kpi-trend{ font-size:10.5px; font-weight:600; color:var(--ow-text3); margin-top:auto; }
    .ow-kpi-trend.up{ color:var(--ow-green); } .ow-kpi-trend.warn{ color:var(--ow-amber); }
    .ow-kpi-trend.down{ color:var(--ow-red); } .ow-kpi-trend.neutral{ color:var(--ow-text3); }

    .ow-mode-tabs{
      display:flex; gap:2px; background:var(--ow-surface); border:1px solid var(--ow-border);
      border-radius:14px; padding:4px; box-shadow:var(--ow-shadow); flex-wrap:wrap;
    }
    .ow-mode-tab{
      flex:1; min-width:140px; text-align:center; padding:11px; border-radius:10px;
      background:none; border:none; font-family:inherit; font-size:13px; font-weight:700;
      color:var(--ow-text3); cursor:pointer; transition:all .2s;
    }
    .ow-mode-tab i{ margin-right:6px; }
    .ow-mode-tab.active{ background:var(--ow-gold-dim); color:var(--ow-gold); }
    .ow-mode-tab .sub{ display:block; font-size:10px; font-weight:600; color:var(--ow-text3); margin-top:2px; }
    .ow-tab-badge{
      display:none; align-items:center; justify-content:center; min-width:19px; height:19px;
      padding:0 5px; border-radius:50%; background:var(--ow-blue); color:#fff;
      font-size:10.5px; font-weight:800; margin-left:6px; vertical-align:middle;
    }
    .ow-tab-badge.show{ display:inline-flex; }

    .ow-view{ display:none; }
    .ow-view.active{ display:block; }

    .ow-builder{ display:grid; grid-template-columns:1fr 340px; gap:14px; align-items:start; }
    @media (max-width:900px){ .ow-builder{ grid-template-columns:1fr; } }

    .ow-menu{ background:var(--ow-surface); border:1px solid var(--ow-border); border-radius:14px; box-shadow:var(--ow-shadow); overflow:hidden; }
    .ow-mp-header{ padding:14px 16px; border-bottom:1px solid var(--ow-border); display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .ow-cat-tabs{ display:flex; gap:4px; flex-wrap:wrap; }
    .ow-cat-tab{
      background:none; border:1px solid var(--ow-border); border-radius:8px; padding:4px 11px;
      font-family:inherit; font-size:11.5px; font-weight:600; color:var(--ow-text3); cursor:pointer; white-space:nowrap;
    }
    .ow-cat-tab:hover, .ow-cat-tab.active{ background:var(--ow-gold-dim); border-color:var(--ow-gold-border); color:var(--ow-gold); }
    .ow-search{
      display:flex; align-items:center; gap:7px; background:var(--ow-surface2); border:1px solid var(--ow-border);
      border-radius:10px; padding:8px 12px; min-width:160px; max-width:220px;
    }
    .ow-search:focus-within{ border-color:var(--ow-gold-border); }
    .ow-search i{ color:var(--ow-text3); font-size:12px; }
    .ow-search input{ background:none; border:none; outline:none; color:var(--ow-text); font-family:inherit; font-size:13px; width:100%; }
    .ow-search input::placeholder{ color:var(--ow-text3); }
    .ow-mi-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:10px; padding:14px; }
    .ow-mi-tile{
      background:var(--ow-surface2); border:1px solid var(--ow-border); border-radius:10px; padding:12px;
      cursor:pointer; transition:all .15s; text-align:left; width:100%; font-family:inherit; position:relative; overflow:hidden;
    }
    .ow-mi-tile:hover{ border-color:var(--ow-gold-border); background:var(--ow-gold-dim); }
    .ow-mi-tile:disabled{ opacity:.5; cursor:not-allowed; }
    .ow-mi-tile:disabled:hover{ border-color:var(--ow-border); background:var(--ow-surface2); }
    .ow-mi-cat{ font-size:9px; color:var(--ow-text3); text-transform:uppercase; letter-spacing:.6px; margin-bottom:4px; font-weight:700; }
    .ow-mi-name{ font-size:13px; font-weight:700; color:var(--ow-text); margin-bottom:5px; }
    .ow-mi-price{ font-size:12.5px; color:var(--ow-gold); font-weight:700; margin-bottom:5px; }
    .ow-mi-stock{ font-size:10.5px; color:var(--ow-text3); font-weight:600; }
    .ow-mi-stock.low{ color:var(--ow-amber); } .ow-mi-stock.out{ color:var(--ow-red); font-weight:700; }
    .ow-mi-badge{ position:absolute; top:8px; right:8px; font-size:8.5px; font-weight:700; text-transform:uppercase; padding:2px 6px; border-radius:20px; background:var(--ow-red-bg); color:var(--ow-red); }
    .ow-empty-note{ font-size:12.5px; color:var(--ow-text3); padding:24px; text-align:center; grid-column:1/-1; font-weight:600; }

    .ow-cart{
      background:var(--ow-surface); border:1px solid var(--ow-border); border-radius:14px; box-shadow:var(--ow-shadow);
      display:flex; flex-direction:column; position:sticky; top:16px;
    }
    .ow-cart-head{ padding:14px 16px; border-bottom:1px solid var(--ow-border); display:flex; align-items:center; justify-content:space-between; }
    .ow-cart-title{ font-size:13px; font-weight:800; color:var(--ow-text); }
    .ow-btn-ghost{ background:none; border:none; color:var(--ow-text3); font-family:inherit; font-size:11.5px; font-weight:700; cursor:pointer; padding:4px 8px; display:inline-flex; align-items:center; gap:5px; }
    .ow-btn-ghost:hover{ color:var(--ow-gold); }
    .ow-cart-body{ flex:1; overflow-y:auto; padding:8px 14px; min-height:80px; max-height:260px; }
    .ow-cart-empty{ text-align:center; padding:24px 12px; color:var(--ow-text3); font-size:12.5px; font-weight:600; }
    .ow-ci{ display:flex; align-items:center; gap:8px; padding:8px 0; border-bottom:1px solid var(--ow-border); }
    .ow-ci:last-child{ border-bottom:none; }
    .ow-ci-name{ flex:1; font-size:12.5px; color:var(--ow-text); font-weight:600; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .ow-ci-qty{ display:flex; align-items:center; gap:4px; flex-shrink:0; }
    .ow-ci-qty button{ background:var(--ow-surface2); border:1px solid var(--ow-border); color:var(--ow-text); width:22px; height:22px; border-radius:6px; cursor:pointer; font-size:12px; display:flex; align-items:center; justify-content:center; }
    .ow-ci-qty button:hover{ background:var(--ow-gold-dim); color:var(--ow-gold); border-color:var(--ow-gold-border); }
    .ow-ci-qty span{ font-size:12.5px; font-weight:700; min-width:18px; text-align:center; }
    .ow-ci-price{ font-size:12px; color:var(--ow-gold); font-weight:700; min-width:60px; text-align:right; flex-shrink:0; }
    .ow-ci-del{ background:none; border:none; color:var(--ow-text3); cursor:pointer; font-size:12px; padding:2px 4px; flex-shrink:0; }
    .ow-ci-del:hover{ color:var(--ow-red); }
    .ow-cart-footer{ border-top:1px solid var(--ow-border); padding:14px 16px; }
    .ow-ct-row{ display:flex; justify-content:space-between; font-size:12.5px; color:var(--ow-text2); font-weight:600; margin-bottom:6px; align-items:center; }
    .ow-ct-row.total{ font-size:15px; font-weight:800; color:var(--ow-text); margin-top:8px; padding-top:8px; border-top:1px solid var(--ow-border); }
    .ow-ct-row.total .ow-ct-val{ color:var(--ow-gold); font-size:19px; }
    .ow-disc-input{ width:50px; background:var(--ow-surface2); border:1px solid var(--ow-border); border-radius:6px; padding:3px 6px; color:var(--ow-text); font-size:12px; text-align:center; outline:none; }
    .ow-disc-input:focus{ border-color:var(--ow-gold-border); }
    .ow-fg{ display:flex; flex-direction:column; gap:5px; margin-bottom:10px; }
    .ow-label{ font-size:9.5px; text-transform:uppercase; letter-spacing:1.2px; color:var(--ow-text3); font-weight:700; }
    .ow-input, .ow-select{ background:var(--ow-surface2); border:1px solid var(--ow-border); border-radius:9px; padding:8px 11px; color:var(--ow-text); font-family:inherit; font-size:12.5px; outline:none; width:100%; }
    .ow-input:focus, .ow-select:focus{ border-color:var(--ow-gold-border); }

    .ow-btn{ display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:10px; font-family:inherit; font-size:12.5px; font-weight:700; cursor:pointer; transition:all .2s; border:1px solid transparent; }
    .ow-btn-primary{ background:var(--ow-gold); color:#fff; }
    .ow-btn-primary:hover{ background:var(--ow-gold-light); transform:translateY(-1px); }
    .ow-btn-primary:disabled{ opacity:.5; cursor:not-allowed; transform:none; }
    .ow-btn-outline{ background:none; border-color:var(--ow-border); color:var(--ow-text2); }
    .ow-btn-outline:hover{ border-color:var(--ow-gold); color:var(--ow-gold); }
    .ow-btn-sm{ padding:6px 12px; font-size:11.5px; }

    .ow-room-results{ max-height:140px; overflow-y:auto; border:1px solid var(--ow-border); border-radius:9px; background:var(--ow-surface2); margin-top:4px; display:none; }
    .ow-room-results.show{ display:block; }
    .ow-room-item{ padding:9px 12px; cursor:pointer; border-bottom:1px solid var(--ow-border); transition:background .15s; }
    .ow-room-item:last-child{ border-bottom:none; }
    .ow-room-item:hover{ background:var(--ow-gold-dim); }
    .ow-room-item .rn{ font-weight:700; color:var(--ow-text); font-size:12.5px; }
    .ow-room-item .gn{ font-size:11.5px; color:var(--ow-text2); margin-top:1px; }
    .ow-selected-room{ display:none; align-items:center; justify-content:space-between; gap:8px; background:var(--ow-blue-bg); border:1px solid rgba(47,111,237,.3); border-radius:9px; padding:9px 12px; margin-top:6px; }
    .ow-selected-room.show{ display:flex; }
    .ow-selected-room .info{ font-size:12.5px; font-weight:700; color:var(--ow-blue); }
    .ow-selected-room .info span{ display:block; font-size:11px; font-weight:600; color:var(--ow-text2); margin-top:1px; }
    .ow-selected-room .clear-btn{ background:none; border:none; color:var(--ow-text3); cursor:pointer; font-size:13px; padding:2px 4px; }
    .ow-selected-room .clear-btn:hover{ color:var(--ow-red); }

    .ow-toolbar{ background:var(--ow-surface); border:1px solid var(--ow-border); border-radius:14px; box-shadow:var(--ow-shadow); padding:14px 16px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; justify-content:space-between; margin-bottom:14px; }
    .ow-status-pills{ display:flex; gap:6px; flex-wrap:wrap; }
    .ow-status-pill{ display:flex; align-items:center; gap:5px; padding:7px 12px; border-radius:20px; font-size:11.5px; font-weight:700; cursor:pointer; border:1px solid var(--ow-border); background:var(--ow-surface2); color:var(--ow-text2); white-space:nowrap; }
    .ow-status-pill:hover{ border-color:var(--ow-gold-border); }
    .ow-status-pill .pdot{ width:6px; height:6px; border-radius:50%; }
    .ow-status-pill.on.all{ background:var(--ow-gold-dim); border-color:var(--ow-gold-border); color:var(--ow-gold); }
    .ow-status-pill.on.open{ background:var(--ow-blue-bg); border-color:rgba(47,111,237,.4); color:var(--ow-blue); }
    .ow-status-pill.on.served{ background:var(--ow-green-bg); border-color:rgba(18,183,106,.4); color:var(--ow-green); }
    .ow-status-pill.on.paid{ background:var(--ow-purple-bg); border-color:rgba(139,92,246,.4); color:var(--ow-purple); }
    .ow-status-pill.on.cancelled{ background:var(--ow-red-bg); border-color:rgba(240,68,56,.4); color:var(--ow-red); }

    .ow-panel{ background:var(--ow-surface); border:1px solid var(--ow-border); border-radius:14px; box-shadow:var(--ow-shadow); overflow:hidden; }
    .ow-panel-head{ display:flex; align-items:center; justify-content:space-between; padding:16px 20px 14px; border-bottom:1px solid var(--ow-border); flex-wrap:wrap; gap:8px; }
    .ow-panel-title{ font-size:12.5px; font-weight:800; color:var(--ow-text); }
    .ow-panel-note{ font-size:11px; color:var(--ow-text3); font-weight:600; }
    .ow-tbl-wrap{ overflow-x:auto; }
    .ow-table{ width:100%; border-collapse:collapse; font-size:12.5px; min-width:820px; }
    .ow-table thead th{ text-align:left; padding:10px 14px; font-size:9px; text-transform:uppercase; letter-spacing:1.5px; color:var(--ow-text3); font-weight:700; background:var(--ow-surface2); border-bottom:1px solid var(--ow-border); white-space:nowrap; }
    .ow-table tbody tr{ border-bottom:1px solid var(--ow-border); }
    .ow-table tbody tr:last-child{ border-bottom:none; }
    .ow-table tbody tr:hover{ background:var(--ow-surface2); }
    .ow-table tbody td{ padding:11px 14px; color:var(--ow-text); vertical-align:middle; white-space:nowrap; }
    .ow-empty-row td{ text-align:center; padding:32px; color:var(--ow-text3); white-space:normal; font-weight:600; }
    .ow-pay-cell{ display:flex; flex-direction:column; gap:1px; }
    .ow-pay-cell .ow-pay-guest{ font-size:10.5px; color:var(--ow-text3); font-weight:600; }
    .ow-chip{ display:inline-flex; align-items:center; gap:4px; padding:3px 9px; border-radius:20px; font-size:10.5px; font-weight:700; white-space:nowrap; }
    .ow-chip i{ font-size:7px; }
    .ow-chip-open{ background:var(--ow-blue-bg); color:var(--ow-blue); }
    .ow-chip-served{ background:var(--ow-green-bg); color:var(--ow-green); }
    .ow-chip-paid{ background:var(--ow-purple-bg); color:var(--ow-purple); }
    .ow-chip-cancelled{ background:var(--ow-red-bg); color:var(--ow-red); }
    .ow-back-bar{
      display:flex; align-items:center; gap:10px; margin-bottom:2px;
    }
    .ow-back-btn{
      display:inline-flex; align-items:center; gap:7px; padding:8px 12px;
      border-radius:10px; border:1px solid var(--ow-border); background:var(--ow-surface);
      color:var(--ow-text2); font-family:inherit; font-size:12.5px; font-weight:700;
      cursor:pointer; text-decoration:none; box-shadow:var(--ow-shadow);
      transition:all .15s;
    }
    .ow-back-btn:hover{ border-color:var(--ow-gold-border); color:var(--ow-gold); background:var(--ow-gold-dim); }
    .ow-back-label{ font-size:12px; color:var(--ow-text3); font-weight:600; }
    .ow-act-btns{ display:flex; gap:5px; flex-wrap:nowrap; }
    .ow-act-btn{ background:none; border:1px solid var(--ow-border); border-radius:7px; padding:5px 10px; font-size:11px; font-weight:700; color:var(--ow-text2); cursor:pointer; transition:all .15s; font-family:inherit; white-space:nowrap; display:inline-flex; align-items:center; gap:5px; }
    .ow-act-btn:hover{ border-color:var(--ow-gold-border); color:var(--ow-gold); }

    .ow-modal-overlay{ display:none; position:fixed; inset:0; background:rgba(15,20,45,0.55); backdrop-filter:blur(4px); z-index:300; align-items:flex-start; justify-content:center; padding:20px 16px; overflow-y:auto; }
    .ow-modal-overlay.show{ display:flex; }
    .ow-modal{ background:var(--ow-surface); border:1px solid var(--ow-border); border-radius:18px; padding:24px; width:min(420px,96vw); box-shadow:0 32px 80px rgba(15,34,55,0.25); animation:owModalIn .22s cubic-bezier(.4,0,.2,1); margin:auto; position:relative; overflow:hidden; }
    .ow-modal::before{ content:''; position:absolute; top:0; left:0; right:0; height:3px; background:var(--ow-gold); }
    @keyframes owModalIn{ from{opacity:0;transform:translateY(16px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
    .ow-modal-header{ display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
    .ow-modal-title{ font-size:17px; font-weight:800; color:var(--ow-text); }
    .ow-modal-close{ background:none; border:none; color:var(--ow-text3); font-size:16px; cursor:pointer; padding:4px; line-height:1; }
    .ow-modal-close:hover{ color:var(--ow-text); }
    .ow-val-note{ font-size:12px; color:var(--ow-text2); margin-bottom:14px; line-height:1.5; font-weight:600; }
    .ow-val-note strong{ color:var(--ow-text); }
    .ow-val-total{ font-size:22px; font-weight:800; color:var(--ow-gold); margin-bottom:14px; }
    .ow-modal-footer{ display:flex; gap:8px; justify-content:flex-end; margin-top:16px; padding-top:14px; border-top:1px solid var(--ow-border); }

    .ow-toast{ position:fixed; bottom:24px; right:24px; background:var(--ow-surface); border:1px solid var(--ow-border); border-radius:12px; padding:13px 20px; font-size:13.5px; color:var(--ow-text); box-shadow:0 8px 30px rgba(0,0,0,0.25); z-index:999999; display:flex; align-items:center; gap:10px; animation:owToastIn .3s cubic-bezier(0.18, 0.89, 0.32, 1.28); max-width:calc(100vw - 40px); font-weight:600; }
    .ow-toast.success{ background:#12b76a !important; color:#ffffff !important; border:1px solid #0e9355 !important; font-weight:700 !important; box-shadow:0 10px 30px rgba(18,183,106,0.4) !important; }
    .ow-toast.success i{ color:#ffffff !important; font-size:17px !important; }
    .ow-toast.error{ background:#f04438 !important; color:#ffffff !important; border:1px solid #d92d20 !important; font-weight:700 !important; box-shadow:0 10px 30px rgba(240,68,56,0.4) !important; }
    .ow-toast.error i{ color:#ffffff !important; font-size:17px !important; }
    .ow-toast.info{ background:#2f6fed !important; color:#ffffff !important; border:1px solid #1554d1 !important; font-weight:700 !important; box-shadow:0 10px 30px rgba(47,111,237,0.4) !important; }
    .ow-toast.info i{ color:#ffffff !important; font-size:17px !important; }
    @keyframes owToastIn{ from{opacity:0;transform:translateY(12px) scale(0.95)} to{opacity:1;transform:translateY(0) scale(1)} }
    @keyframes owFadeUp{ from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  `;

  let _styles = false;
  function injectStyles() {
    if (_styles) return;
    _styles = true;
    const el = document.createElement('style');
    el.id = 'ow-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  function pad2(n) { return String(n).padStart(2, '0'); }
  function fmtN(n) { return '₦' + Math.round(n || 0).toLocaleString('en-NG'); }
  function todayDDMMYY() {
    const d = new Date();
    return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + String(d.getFullYear()).slice(-2);
  }
  function nowStamp() {
    return new Date().toLocaleString('en-GB', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    }).replace(',', '');
  }
  function stockLevel(i) {
    return i.qty <= 0 ? 'out' : (i.qty <= (i.min || 0) ? 'low' : 'ok');
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function defaultStorage() {
    return global.storage || {
      async get(key) {
        const v = localStorage.getItem(key);
        return v == null ? null : { key, value: v };
      },
      async set(key, value) {
        localStorage.setItem(key, value);
        return { key, value };
      },
    };
  }

  function attach(target, options) {
    injectStyles();
    options = options || {};
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) {
      console.warn('[OrdersWorkspace] target not found:', target);
      return null;
    }

    const moduleName = options.module || 'poolbar';
    const service = options.service || null; // RestaurantService | PoolBarService | adapter
    const keys = Object.assign({
      stock: moduleName + '-stock',
      sales: moduleName + '-sales',
      orders: moduleName + '-orders',
      movements: moduleName + '-movements',
    }, options.keys || (service && service.KEYS ? {
      stock: service.KEYS.STOCK,
      sales: service.KEYS.SALES,
      orders: service.KEYS.ORDERS,
      movements: service.KEYS.MOVEMENTS,
    } : {}));
    const prefixes = Object.assign(
      moduleName === 'restaurant'
        ? { sale: 'RST-', order: 'RSO-' }
        : { sale: 'PBS-', order: 'PBO-' },
      options.idPrefixes || {}
    );
    // Fallback list — live: service.paymentMethods / API page payload / options.paymentMethods
    const FALLBACK_PAY_METHODS = ['Cash', 'POS', 'Transfer', 'Room Charge', 'Complimentary'];
    let paymentMethods = (options.paymentMethods && options.paymentMethods.length)
      ? options.paymentMethods.slice()
      : FALLBACK_PAY_METHODS.slice();
    const allowRoomCharge = options.allowRoomCharge !== false;
    const guests = options.guests || [];
    const CFG = Object.assign({ API_BASE: '', API_KEY: '' }, options.CFG || {});
    const apiPaths = Object.assign({
      page: '/api/' + moduleName + '/orders-page',
      sales: '/api/' + moduleName + '/sales',
      orders: '/api/' + moduleName + '/orders',
    }, options.apiPaths || {});
    const storage = options.storage || defaultStorage();
    const demo = options.demo || {};
    // Back to sales page that opened orders (e.g. poolbar-sales.html / restaurant-sales.html)
    const backHref = options.backHref || (moduleName === 'restaurant' ? 'restaurant-sales.html' : 'poolbar-sales.html');
    const backLabel = options.backLabel || 'Back to Sales';
    const demoStaffName = options.demoStaffName || (moduleName === 'restaurant' ? 'Restaurant Manager' : 'Pool Bar Manager');

    // Optional shell
    let shell = null;
    if (options.shell && typeof options.shell.attach === 'function' && options.shellOptions) {
      shell = options.shell.attach(options.shellOptions);
    } else if (options.shellHandle) {
      shell = options.shellHandle;
    }

    function resolveStaffName() {
      // Live/session first, then option, then fallback default
      try {
        if (shell && typeof shell.getUser === 'function') {
          const u = shell.getUser();
          if (u && (u.name || u.username)) return u.name || u.username;
        }
      } catch (e) { /* ignore */ }
      if (options.currentUser && (options.currentUser.name || options.currentUser.username)) {
        return options.currentUser.name || options.currentUser.username;
      }
      return demoStaffName;
    }

    let stock = [];
    let sales = [];
    let orders = [];
    let movements = [];
    let cart = [];
    let mode = 'quick'; // quick | tab | active
    let activeCat = 'All';
    let statusFilter = '';
    let payOrderId = null;
    let unsubService = null;
    const uid = 'ow' + Math.random().toString(36).slice(2, 8);

    function syncFromService() {
      if (!service || !service.state) return;
      stock = service.state.stock || [];
      sales = service.state.sales || [];
      orders = service.state.orders || [];
      movements = service.state.movements || [];
    }

    async function loadShared(key, fallback) {
      try {
        const r = await storage.get(key, true);
        if (r && r.value) {
          const parsed = JSON.parse(r.value);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (e) { /* first run */ }
      return fallback || [];
    }
    async function saveShared(key, value) {
      try {
        await storage.set(key, JSON.stringify(value), true);
      } catch (e) {
        console.warn('[OrdersWorkspace] save failed:', key, e);
      }
    }
    async function apiFetch(method, path, body) {
      if (!CFG.API_BASE) throw new Error('No API_BASE');
      const opts = { method, headers: { 'Content-Type': 'application/json' } };
      if (CFG.API_KEY) opts.headers.Authorization = 'Bearer ' + CFG.API_KEY;
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(CFG.API_BASE + path, opts);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }
    function apiSave(method, path, body) {
      apiFetch(method, path, body).catch(function (e) {
        console.warn('[API write]', e.message);
      });
    }

    // ── Shell HTML ──
    el.innerHTML = `
      <div class="ow-root" id="${uid}">
        <div class="ow-back-bar">
          <a class="ow-back-btn" href="${esc(backHref)}" data-role="backBtn">
            <i class="fa-solid fa-arrow-left"></i> ${esc(backLabel)}
          </a>
        </div>

        <div class="ow-kpi-row" data-role="kpiRow"></div>

        <div class="ow-mode-tabs">
          <button type="button" class="ow-mode-tab active" data-mode="quick">
            <i class="fa-solid fa-bolt"></i>Quick Sale
            <span class="sub">Charge & complete now</span>
          </button>
          <button type="button" class="ow-mode-tab" data-mode="tab">
            <i class="fa-solid fa-receipt"></i>Open Tab
            <span class="sub">Serve first, pay later</span>
          </button>
          <button type="button" class="ow-mode-tab" data-mode="active">
            <i class="fa-solid fa-list-check"></i>Active Orders
            <span class="sub">Open & served tabs</span>
            <span class="ow-tab-badge" data-role="activeBadge">0</span>
          </button>
        </div>

        <div class="ow-view active" data-view="builder">
          <div class="ow-builder">
            <div class="ow-menu">
              <div class="ow-mp-header">
                <div class="ow-cat-tabs" data-role="catTabs"></div>
                <div class="ow-search" style="margin-left:auto;">
                  <i class="fa-solid fa-magnifying-glass"></i>
                  <input type="text" data-role="itemSearch" placeholder="Search items…">
                </div>
              </div>
              <div class="ow-mi-grid" data-role="itemGrid"></div>
            </div>

            <div class="ow-cart">
              <div class="ow-cart-head">
                <div class="ow-cart-title" data-role="cartTitle">Cart</div>
                <button type="button" class="ow-btn-ghost" data-act="clearCart"><i class="fa-solid fa-trash"></i> Clear</button>
              </div>
              <div class="ow-cart-body" data-role="cartBody"><div class="ow-cart-empty">Tap an item to add it</div></div>
              <div class="ow-cart-footer">
                <div class="ow-fg">
                  <label class="ow-label">Table / Seat <span style="text-transform:none;letter-spacing:0;font-weight:600;color:var(--ow-text3)">(optional)</span></label>
                  <input class="ow-input" data-role="fTable" placeholder="e.g. T-04 or Pool Lounger 3">
                </div>
                <div class="ow-fg">
                  <label class="ow-label">Staff</label>
                  <input class="ow-input" data-role="fStaff" placeholder="Staff name" readonly style="opacity:.9;">
                </div>
                <div class="ow-fg" data-role="methodWrap">
                  <label class="ow-label">Payment</label>
                  <select class="ow-select" data-role="fMethod">
                    ${paymentMethods.map(function (m) { return '<option value="' + esc(m) + '">' + esc(m) + '</option>'; }).join('')}
                  </select>
                </div>
                ${allowRoomCharge ? `
                <div class="ow-fg" data-role="roomChargeWrap" style="display:none;">
                  <label class="ow-label">Room / Guest</label>
                  <input class="ow-input" data-role="roomSearch" placeholder="Search room, guest, or phone…">
                  <div class="ow-room-results" data-role="roomResults"></div>
                  <div class="ow-selected-room" data-role="selectedRoomBox">
                    <div class="info"></div>
                    <button type="button" class="clear-btn" data-act="clearRoom" title="Clear"><i class="fa-solid fa-xmark"></i></button>
                  </div>
                  <input type="hidden" data-role="fRoomNumber">
                  <input type="hidden" data-role="fGuestName">
                  <input type="hidden" data-role="fGuestPhone">
                  <input type="hidden" data-role="fGuestId">
                </div>` : ''}
                <div class="ow-fg">
                  <label class="ow-label">Notes</label>
                  <input class="ow-input" data-role="fNotes" placeholder="Optional">
                </div>
                <div class="ow-ct-row"><span>Subtotal</span><span data-role="cartSub">₦0</span></div>
                <div class="ow-ct-row">
                  <span>Discount %</span>
                  <input class="ow-disc-input" type="number" min="0" max="100" value="0" data-role="cartDisc">
                </div>
                <div class="ow-ct-row total"><span>Total</span><span class="ow-ct-val" data-role="cartTotal">₦0</span></div>
                <button type="button" class="ow-btn ow-btn-primary" style="width:100%;justify-content:center;margin-top:10px;" data-act="submit" disabled data-role="submitBtn">
                  <i class="fa-solid fa-check"></i> <span data-role="submitLabel">Complete Sale</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="ow-view" data-view="active">
          <div class="ow-toolbar">
            <div class="ow-status-pills" data-role="statusPills">
              <div class="ow-status-pill on all" data-status=""><span class="pdot" style="background:var(--ow-gold)"></span>All</div>
              <div class="ow-status-pill open" data-status="open"><span class="pdot" style="background:var(--ow-blue)"></span>Open</div>
              <div class="ow-status-pill served" data-status="served"><span class="pdot" style="background:var(--ow-green)"></span>Served</div>
              <div class="ow-status-pill paid" data-status="paid"><span class="pdot" style="background:var(--ow-purple)"></span>Paid</div>
              <div class="ow-status-pill cancelled" data-status="cancelled"><span class="pdot" style="background:var(--ow-red)"></span>Cancelled</div>
            </div>
          </div>
          <div class="ow-panel">
            <div class="ow-panel-head">
              <div class="ow-panel-title">Orders</div>
              <span class="ow-panel-note" data-role="ordCount">—</span>
            </div>
            <div class="ow-tbl-wrap">
              <table class="ow-table">
                <thead>
                  <tr>
                    <th>Order No.</th><th>Table</th><th>Items</th><th>Total</th>
                    <th>Payment</th><th>Staff</th><th>Date</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody data-role="ordBody"></tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="ow-modal-overlay" data-role="payModal">
          <div class="ow-modal">
            <div class="ow-modal-header">
              <div class="ow-modal-title">Collect Payment</div>
              <button type="button" class="ow-modal-close" data-act="closePay"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="ow-val-note">Paying <strong data-role="payOrderName">—</strong></div>
            <div class="ow-val-total" data-role="payOrderTotal">₦0</div>
            <div class="ow-fg">
              <label class="ow-label">Payment method</label>
              <select class="ow-select" data-role="payMethod">
                ${paymentMethods.map(function (m) {
                  return '<option value="' + esc(m) + '">' + esc(m) + '</option>';
                }).join('')}
              </select>
            </div>
            ${allowRoomCharge ? `
            <div class="ow-fg" data-role="payRoomChargeWrap" style="display:none;">
              <label class="ow-label">Room / Guest</label>
              <input class="ow-input" data-role="payRoomSearch" placeholder="Search room, guest, or phone…">
              <div class="ow-room-results" data-role="payRoomResults"></div>
              <div class="ow-selected-room" data-role="paySelectedRoomBox">
                <div class="info"></div>
                <button type="button" class="clear-btn" data-act="clearPayRoom"><i class="fa-solid fa-xmark"></i></button>
              </div>
              <input type="hidden" data-role="payRoomNumber">
              <input type="hidden" data-role="payGuestName">
              <input type="hidden" data-role="payGuestPhone">
            </div>` : ''}
            <div class="ow-modal-footer">
              <button type="button" class="ow-btn ow-btn-outline ow-btn-sm" data-act="closePay">Cancel</button>
              <button type="button" class="ow-btn ow-btn-primary ow-btn-sm" data-act="confirmPay"><i class="fa-solid fa-check"></i> Confirm Payment</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const root = el.querySelector('#' + uid);
    const $ = function (sel) { return root.querySelector(sel); };
    const $$ = function (sel) { return root.querySelectorAll(sel); };

    function showToast(msg, type) {
      type = type || 'success';
      const t = document.createElement('div');
      t.className = 'ow-toast ' + type;
      const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info';
      t.innerHTML = '<i class="fa-solid ' + icon + '"></i> ' + esc(msg);
      document.body.appendChild(t);
      setTimeout(function () { t.remove(); }, 4500);
    }

    function setMode(m) {
      mode = m;
      $$('.ow-mode-tab').forEach(function (tab) {
        tab.classList.toggle('active', tab.dataset.mode === m);
      });
      const isActive = m === 'active';
      $('[data-view="builder"]').classList.toggle('active', !isActive);
      $('[data-view="active"]').classList.toggle('active', isActive);
      // Payment: Quick Sale = required; Open Tab = optional (still pay later if skipped).
      const methodWrap = $('[data-role="methodWrap"]');
      if (methodWrap) methodWrap.style.display = (m === 'quick' || m === 'tab') ? '' : 'none';
      const methodLabel = methodWrap && methodWrap.querySelector('.ow-label');
      if (methodLabel) {
        methodLabel.innerHTML = m === 'tab'
          ? 'Payment <span style="text-transform:none;letter-spacing:0;font-weight:600;color:var(--ow-text3)">(optional)</span>'
          : 'Payment';
      }
      // Open Tab gets a blank first option so staff can skip payment.
      const methodSel = $('[data-role="fMethod"]');
      if (methodSel) {
        const cur = methodSel.value;
        const opts = (m === 'tab' ? [''] : []).concat(paymentMethods);
        methodSel.innerHTML = opts.map(function (pm) {
          if (!pm) return '<option value="">— Pay later —</option>';
          return '<option value="' + esc(pm) + '">' + esc(pm) + '</option>';
        }).join('');
        if (m === 'tab' && (!cur || paymentMethods.indexOf(cur) < 0)) methodSel.value = '';
        else if (paymentMethods.indexOf(cur) >= 0) methodSel.value = cur;
        else methodSel.value = paymentMethods[0] || '';
      }
      toggleRoomChargeUI();
      $('[data-role="submitLabel"]').textContent = m === 'quick' ? 'Complete Sale' : 'Open Tab';
      $('[data-role="cartTitle"]').textContent = m === 'quick' ? 'Quick Sale' : 'Open Tab';
      if (isActive) renderOrdersTable();
    }

    function applyPaymentMethods(list) {
      if (!list || !list.length) return;
      paymentMethods = list.slice();
      const fill = function (sel) {
        if (!sel) return;
        const cur = sel.value;
        sel.innerHTML = paymentMethods.map(function (m) {
          return '<option value="' + esc(m) + '">' + esc(m) + '</option>';
        }).join('');
        if (paymentMethods.indexOf(cur) >= 0) sel.value = cur;
      };
      fill($('[data-role="fMethod"]'));
      fill($('[data-role="payMethod"]'));
    }

    function resolvePaymentMethodsFromService() {
      if (!service) return null;
      if (Array.isArray(service.paymentMethods) && service.paymentMethods.length) return service.paymentMethods;
      if (service.state && Array.isArray(service.state.paymentMethods) && service.state.paymentMethods.length) {
        return service.state.paymentMethods;
      }
      if (typeof service.getPaymentMethods === 'function') {
        try {
          const m = service.getPaymentMethods();
          if (Array.isArray(m) && m.length) return m;
        } catch (e) { /* ignore */ }
      }
      return null;
    }

    function isTodayDate(d) {
      if (!d) return false;
      const dt = new Date(d);
      if (!isNaN(dt.getTime())) {
        const today = new Date();
        return dt.getDate() === today.getDate() &&
               dt.getMonth() === today.getMonth() &&
               dt.getFullYear() === today.getFullYear();
      }
      return String(d).startsWith(todayDDMMYY());
    }

    function unitsSoldToday() {
      return sales
        .filter(function (s) { return s.status === 'completed' && isTodayDate(s.date); })
        .reduce(function (sum, s) {
          return sum + (s.items || []).reduce(function (a, i) { return a + (i.qty || 0); }, 0);
        }, 0);
    }

    function renderKPIs() {
      const completedToday = sales.filter(function (s) {
        return s.status === 'completed' && isTodayDate(s.date);
      });
      const cancelledToday = orders.filter(function (o) {
        return o.status === 'cancelled' && isTodayDate(o.date);
      });
      const activeTabs = orders.filter(function (o) {
        return o.status === 'open' || o.status === 'served';
      }).length;
      const revenue = completedToday.reduce(function (s, x) { return s + (x.total || 0); }, 0);
      const units = unitsSoldToday();

      $('[data-role="kpiRow"]').innerHTML =
        '<div class="ow-kpi acc-green">' +
        '<div class="ow-kpi-top"><div class="ow-kpi-ic ow-ic-green"><i class="fa-solid fa-circle-check"></i></div><div class="ow-kpi-label">Completed Today</div></div>' +
        '<div class="ow-kpi-value">' + completedToday.length + '</div>' +
        '<div class="ow-kpi-trend up">' + fmtN(revenue) + ' in sales</div></div>' +
        '<div class="ow-kpi acc-blue">' +
        '<div class="ow-kpi-top"><div class="ow-kpi-ic ow-ic-blue"><i class="fa-solid fa-clipboard-list"></i></div><div class="ow-kpi-label">Active Tabs</div></div>' +
        '<div class="ow-kpi-value">' + activeTabs + '</div>' +
        '<div class="ow-kpi-trend neutral">' + (activeTabs ? 'Open or served' : 'None open') + '</div></div>' +
        '<div class="ow-kpi acc-red">' +
        '<div class="ow-kpi-top"><div class="ow-kpi-ic ow-ic-red"><i class="fa-solid fa-ban"></i></div><div class="ow-kpi-label">Cancelled Today</div></div>' +
        '<div class="ow-kpi-value">' + cancelledToday.length + '</div>' +
        '<div class="ow-kpi-trend ' + (cancelledToday.length ? 'down' : 'up') + '">' +
        (cancelledToday.length ? 'Tabs cancelled' : 'None cancelled') + '</div></div>' +
        '<div class="ow-kpi acc-purple">' +
        '<div class="ow-kpi-top"><div class="ow-kpi-ic ow-ic-purple"><i class="fa-solid fa-boxes-stacked"></i></div><div class="ow-kpi-label">Units Sold</div></div>' +
        '<div class="ow-kpi-value">' + units + '</div>' +
        '<div class="ow-kpi-trend neutral">Sold this shift (today)</div></div>';

      const badge = $('[data-role="activeBadge"]');
      if (activeTabs > 0) {
        badge.textContent = activeTabs;
        badge.classList.add('show');
      } else {
        badge.classList.remove('show');
      }
    }

    function getCategories() {
      return ['All'].concat(Array.from(new Set(stock.map(function (i) { return i.category || 'Other'; }))));
    }

    function renderPicker() {
      const cats = getCategories();
      $('[data-role="catTabs"]').innerHTML = cats.map(function (c) {
        return '<button type="button" class="ow-cat-tab' + (c === activeCat ? ' active' : '') +
          '" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
      }).join('');
      const q = ($('[data-role="itemSearch"]').value || '').toLowerCase();
      const items = stock.filter(function (i) {
        return (activeCat === 'All' || i.category === activeCat) &&
          (!q || (i.name || '').toLowerCase().includes(q));
      });
      const grid = $('[data-role="itemGrid"]');
      if (!items.length) {
        grid.innerHTML = '<div class="ow-empty-note">No stock items match.</div>';
        return;
      }
      grid.innerHTML = items.map(function (i) {
        const lvl = stockLevel(i);
        const inCart = cart.find(function (c) { return c.key === i.name; });
        const remaining = i.qty - (inCart ? inCart.qty : 0);
        const disabled = i.qty <= 0 || remaining <= 0;
        return '<button type="button" class="ow-mi-tile" data-add="' + esc(i.name) + '" ' + (disabled ? 'disabled' : '') + '>' +
          (i.qty <= 0 ? '<span class="ow-mi-badge">Out</span>' : '') +
          '<div class="ow-mi-cat">' + esc(i.category || '') + '</div>' +
          '<div class="ow-mi-name">' + esc(i.name) + '</div>' +
          '<div class="ow-mi-price">' + fmtN(i.price) + '</div>' +
          '<div class="ow-mi-stock ' + lvl + '">' + i.qty + ' ' + esc(i.unit || '') + ' on hand</div></button>';
      }).join('');
    }

    function renderCart() {
      const body = $('[data-role="cartBody"]');
      if (!cart.length) {
        body.innerHTML = '<div class="ow-cart-empty">Tap an item to add it</div>';
        updateTotals();
        return;
      }
      body.innerHTML = cart.map(function (c) {
        return '<div class="ow-ci">' +
          '<div class="ow-ci-name">' + esc(c.key) + '</div>' +
          '<div class="ow-ci-qty">' +
          '<button type="button" data-adj="' + esc(c.key) + '" data-delta="-1">−</button>' +
          '<span>' + c.qty + '</span>' +
          '<button type="button" data-adj="' + esc(c.key) + '" data-delta="1">+</button></div>' +
          '<div class="ow-ci-price">' + fmtN(c.price * c.qty) + '</div>' +
          '<button type="button" class="ow-ci-del" data-remove="' + esc(c.key) + '"><i class="fa-solid fa-xmark"></i></button></div>';
      }).join('');
      updateTotals();
    }

    function updateTotals() {
      const sub = cart.reduce(function (s, c) { return s + c.price * c.qty; }, 0);
      const disc = parseFloat($('[data-role="cartDisc"]').value) || 0;
      $('[data-role="cartSub"]').textContent = fmtN(sub);
      $('[data-role="cartTotal"]').textContent = fmtN(sub * (1 - disc / 100));
      $('[data-role="submitBtn"]').disabled = cart.length === 0;
    }

    function addToCart(key) {
      const inv = stock.find(function (i) { return i.name === key; });
      if (!inv || inv.qty <= 0) {
        showToast(key + ' is out of stock.', 'error');
        return;
      }
      const existing = cart.find(function (c) { return c.key === key; });
      if (existing) {
        if (existing.qty >= inv.qty) {
          showToast('Only ' + inv.qty + ' ' + (inv.unit || '') + ' of ' + key + ' available.', 'error');
          return;
        }
        existing.qty++;
      } else {
        cart.push({ key: key, qty: 1, price: inv.price, unit: inv.unit });
      }
      renderCart();
      renderPicker();
    }

    function adjustQty(key, delta) {
      const c = cart.find(function (x) { return x.key === key; });
      if (!c) return;
      const inv = stock.find(function (i) { return i.name === key; });
      const max = inv ? inv.qty : c.qty;
      const next = c.qty + delta;
      if (next < 1) {
        cart = cart.filter(function (x) { return x.key !== key; });
      } else if (next > max) {
        showToast('Only ' + max + ' available.', 'error');
        return;
      } else {
        c.qty = next;
      }
      renderCart();
      renderPicker();
    }

    function clearCart() {
      cart = [];
      renderCart();
      renderPicker();
    }

    function nextSaleId() {
      let max = 1000;
      sales.forEach(function (s) {
        const n = parseInt(String(s.id || '').replace(prefixes.sale, ''), 10);
        if (!isNaN(n) && n > max) max = n;
      });
      return prefixes.sale + (max + 1);
    }
    function nextOrderId() {
      let max = 0;
      orders.forEach(function (o) {
        const n = parseInt(String(o.id || '').replace(prefixes.order, ''), 10);
        if (!isNaN(n) && n > max) max = n;
      });
      return prefixes.order + String(max + 1).padStart(3, '0');
    }

    function getRoomFields(prefix) {
      // prefix '' for cart, 'pay' for modal
      if (prefix === 'pay') {
        return {
          room: ($('[data-role="payRoomNumber"]') || {}).value || '',
          guest: ($('[data-role="payGuestName"]') || {}).value || '',
          phone: ($('[data-role="payGuestPhone"]') || {}).value || '',
          guestId: ($('[data-role="payGuestId"]') || {}).value || '',
        };
      }
      return {
        room: ($('[data-role="fRoomNumber"]') || {}).value || '',
        guest: ($('[data-role="fGuestName"]') || {}).value || '',
        phone: ($('[data-role="fGuestPhone"]') || {}).value || '',
        guestId: ($('[data-role="fGuestId"]') || {}).value || '',
      };
    }

    async function submitOrder() {
      if (!cart.length) {
        showToast('Add at least one item.', 'error');
        return;
      }
      const table = ($('[data-role="fTable"]').value || '').trim(); // optional
      let staff = ($('[data-role="fStaff"]').value || '').trim() || resolveStaffName();
      if (!staff) { showToast('Staff name is required.', 'error'); return; }
      const notes = ($('[data-role="fNotes"]').value || '').trim();
      const discount = parseFloat($('[data-role="cartDisc"]').value) || 0;
      const subtotal = cart.reduce(function (s, c) { return s + c.price * c.qty; }, 0);
      const total = subtotal * (1 - discount / 100);
      const stamp = nowStamp();
      const items = cart.map(function (c) { return { name: c.key, key: c.key, qty: c.qty, price: c.price }; });

      try {
        if (mode === 'quick') {
          // Payment required only for Quick Sale
          const room = getRoomFields('');
          let method = ($('[data-role="fMethod"]') || {}).value || 'Cash';
          const isRoomCharge = method === 'Room Charge';
          if (isRoomCharge && !room.room) {
            showToast('Select a room for Room Charge.', 'error');
            return;
          }
          if (service && typeof service.recordSale === 'function') {
            const sale = await service.recordSale({
              items: items,
              discount: discount,
              method: method,
              staff: staff,
              table: table || '—',
              notes: notes,
              roomNumber: isRoomCharge ? (room.room || null) : null,
              guestName: isRoomCharge ? (room.guest || null) : null,
              guestPhone: isRoomCharge ? (room.phone || null) : null,
              guestId: isRoomCharge ? (room.guestId || null) : null,
            });
            syncFromService();
            showToast(
              isRoomCharge
                ? (sale && sale.id ? sale.id + ' ' : '') + 'charged to Room ' + room.room + ' — ' + fmtN(total) + '.'
                : (sale && sale.id ? sale.id + ' recorded — ' : 'Sale recorded — ') + fmtN(total) + '.',
              'success'
            );
          } else {
            const sale = {
              id: nextSaleId(),
              items: items.map(function (c) { return { name: c.name, qty: c.qty, price: c.price }; }),
              subtotal: subtotal, discount: discount, total: total,
              method: method, staff: staff, table: table || '—', notes: notes,
              date: stamp, status: 'completed', source: 'quick',
              roomNumber: isRoomCharge ? (room.room || null) : null,
              guestName: isRoomCharge ? (room.guest || null) : null,
              guestPhone: isRoomCharge ? (room.phone || null) : null,
            };
            cart.forEach(function (c) {
              const inv = stock.find(function (i) { return i.name === c.key; });
              if (inv) {
                inv.qty = Math.max(0, inv.qty - c.qty);
                movements.unshift({
                  date: stamp, item: c.key, qtyIn: 0, qtyOut: c.qty, balance: inv.qty,
                  reason: 'Sale (' + sale.id + ')',
                });
              }
            });
            sales.unshift(sale);
            await Promise.all([
              saveShared(keys.sales, sales),
              saveShared(keys.stock, stock),
              saveShared(keys.movements, movements),
            ]);
            apiSave('POST', apiPaths.sales, sale);
            showToast(
              isRoomCharge
                ? sale.id + ' charged to Room ' + room.room + ' — ' + fmtN(total) + '.'
                : sale.id + ' recorded — ' + fmtN(total) + '.',
              'success'
            );
          }
        } else {
          // Open Tab — payment optional (can still pay later via Active Orders → Pay).
          const room = getRoomFields('');
          let method = (($('[data-role="fMethod"]') || {}).value || '').trim();
          const isRoomCharge = method === 'Room Charge';
          // Empty method = leave unset; Room Charge still needs a room if chosen
          if (isRoomCharge && !room.room) {
            showToast('Select a room for Room Charge, or clear payment method.', 'error');
            return;
          }
          if (!method) method = null;
          const roomNumber = isRoomCharge ? (room.room || null) : null;
          const guestName = isRoomCharge ? (room.guest || null) : null;
          const guestPhone = isRoomCharge ? (room.phone || null) : null;
          const guestId = isRoomCharge ? (room.guestId || null) : null;

          if (service && typeof service.openTab === 'function') {
            const order = await service.openTab({
              items: items,
              discount: discount,
              staff: staff,
              table: table || '—',
              notes: notes,
              method: method,
              payMethod: method,
              roomNumber: roomNumber,
              guestName: guestName,
              guestPhone: guestPhone,
              guestId: guestId,
            });
            syncFromService();
            showToast('Tab ' + ((order && order.id) || '') + ' opened' + (table ? ' for ' + table : '') + '.', 'success');
          } else {
            const order = {
              id: nextOrderId(),
              items: items.map(function (c) { return { name: c.name, qty: c.qty, price: c.price }; }),
              subtotal: subtotal, discount: discount, total: total,
              staff: staff, table: table || '—', notes: notes,
              date: stamp, status: 'open', source: 'tab',
              method: method,
              payMethod: method,
              roomNumber: roomNumber,
              guestName: guestName,
              guestPhone: guestPhone,
            };
            orders.unshift(order);
            await saveShared(keys.orders, orders);
            apiSave('POST', apiPaths.orders, order);
            showToast('Tab ' + order.id + ' opened' + (table ? ' for ' + table : '') + '.', 'success');
          }
        }
      } catch (err) {
        showToast((err && err.message) || 'Could not submit order.', 'error');
        return;
      }

      clearCart();
      $('[data-role="fTable"]').value = '';
      // keep staff from session
      $('[data-role="fStaff"]').value = resolveStaffName();
      $('[data-role="fNotes"]').value = '';
      $('[data-role="cartDisc"]').value = '0';
      clearSelectedRoom('');
      const methodSel = $('[data-role="fMethod"]');
      if (methodSel) methodSel.value = paymentMethods[0] || 'Cash';
      toggleRoomChargeUI();
      renderKPIs();
      renderOrdersTable();
      renderPicker();
    }

    // Payment column: for a Room Charge order/sale, show the room AND the
    // guest name underneath — previously only "Room 101" was rendered even
    // though o.guestName was already being captured and stored.
    function renderOrdersTable() {
      const rows = orders
        .filter(function (o) { return !statusFilter || o.status === statusFilter; })
        .sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
      $('[data-role="ordCount"]').textContent = rows.length + ' order' + (rows.length !== 1 ? 's' : '');
      if (!rows.length) {
        $('[data-role="ordBody"]').innerHTML =
          '<tr class="ow-empty-row"><td colspan="9">No orders match this filter.</td></tr>';
        return;
      }
      $('[data-role="ordBody"]').innerHTML = rows.map(function (o) {
        let payCell;
        if (o.roomNumber) {
          payCell = '<div class="ow-pay-cell"><span>Room ' + esc(o.roomNumber) + '</span>' +
            (o.guestName ? '<span class="ow-pay-guest">' + esc(o.guestName) + '</span>' : '') +
            '</div>';
        } else {
          payCell = esc(o.payMethod || '—');
        }
        const st = o.status || 'open';
        return '<tr>' +
          '<td style="font-weight:700;">' + esc(o.id) + '</td>' +
          '<td>' + esc(o.table) + '</td>' +
          '<td>' + (o.items || []).length + ' item' + ((o.items || []).length !== 1 ? 's' : '') + '</td>' +
          '<td style="font-weight:700;color:var(--ow-gold);">' + fmtN(o.total) + '</td>' +
          '<td>' + payCell + '</td>' +
          '<td>' + esc(o.staff) + '</td>' +
          '<td>' + esc(o.date) + '</td>' +
          '<td><span class="ow-chip ow-chip-' + st + '"><i class="fa-solid fa-circle"></i>' +
          st.charAt(0).toUpperCase() + st.slice(1) + '</span></td>' +
          '<td><div class="ow-act-btns">' +
          (st === 'open'
            ? '<button type="button" class="ow-act-btn" data-served="' + esc(o.id) + '"><i class="fa-solid fa-bell-concierge"></i>Served</button>'
            : '') +
          (st === 'served'
            ? '<button type="button" class="ow-act-btn" data-pay="' + esc(o.id) + '"><i class="fa-solid fa-naira-sign"></i>Pay</button>'
            : '') +
          (st === 'open' || st === 'served'
            ? '<button type="button" class="ow-act-btn" data-cancel="' + esc(o.id) + '"><i class="fa-solid fa-ban"></i>Cancel</button>'
            : '') +
          '</div></td></tr>';
      }).join('');
    }

    async function markServed(id) {
      try {
        if (service && typeof service.markServed === 'function') {
          await service.markServed(id);
          syncFromService();
        } else {
          const o = orders.find(function (x) { return x.id === id; });
          if (!o) return;
          o.status = 'served';
          await saveShared(keys.orders, orders);
          apiSave('PATCH', apiPaths.orders + '/' + id, { status: 'served' });
        }
        showToast(id + ' marked as served.', 'success');
        renderOrdersTable();
        renderKPIs();
      } catch (err) {
        showToast((err && err.message) || 'Could not update order.', 'error');
      }
    }

    function toggleRoomChargeUI() {
      const method = ($('[data-role="fMethod"]') || {}).value || '';
      const wrap = $('[data-role="roomChargeWrap"]');
      if (!wrap) return;
      const show = method === 'Room Charge';
      wrap.style.display = show ? '' : 'none';
      if (!show) clearSelectedRoom('');
    }

    function togglePayRoomChargeUI() {
      const method = ($('[data-role="payMethod"]') || {}).value || '';
      const wrap = $('[data-role="payRoomChargeWrap"]');
      if (!wrap) return;
      const show = method === 'Room Charge';
      wrap.style.display = show ? '' : 'none';
      if (!show) clearSelectedRoom('pay');
    }

    function openPayModal(id) {
      const o = orders.find(function (x) { return x.id === id; });
      if (!o) return;
      payOrderId = id;
      // Include the guest name here too — this is the same information
      // that was already being stored (o.guestName) but never shown.
      let nameBits = o.id + (o.table && o.table !== '—' ? ' — ' + o.table : '');
      if (o.roomNumber) {
        nameBits += ' (Room ' + o.roomNumber + (o.guestName ? ' — ' + o.guestName : '') + ')';
      }
      $('[data-role="payOrderName"]').textContent = nameBits;
      $('[data-role="payOrderTotal"]').textContent = fmtN(o.total);
      const paySel = $('[data-role="payMethod"]');
      if (paySel) paySel.value = o.roomNumber ? 'Room Charge' : (paymentMethods[0] || 'Cash');
      clearSelectedRoom('pay');
      if (o.roomNumber) {
        selectRoom(o.roomNumber, o.guestName || '', o.guestPhone || '', 'pay', o.guestId || '');
      }
      togglePayRoomChargeUI();
      $('[data-role="payModal"]').classList.add('show');
    }

    async function confirmPayOrder() {
      const o = orders.find(function (x) { return x.id === payOrderId; });
      if (!o) return;
      const room = getRoomFields('pay');
      let method = ($('[data-role="payMethod"]') || {}).value || 'Cash';
      const isRoomCharge = method === 'Room Charge';
      if (isRoomCharge && !room.room) {
        showToast('Select a room for Room Charge.', 'error');
        return;
      }

      try {
        if (service && typeof service.payOrder === 'function') {
          const payArg = isRoomCharge
            ? { method: method, roomNumber: room.room || null, guestName: room.guest || null, guestPhone: room.phone || null, guestId: room.guestId || null }
            : method;
          const result = await service.payOrder(payOrderId, payArg);
          syncFromService();
          const saleId = result && result.sale ? result.sale.id : '';
          $('[data-role="payModal"]').classList.remove('show');
          showToast(
            isRoomCharge
              ? o.id + ' charged to Room ' + room.room + ' — ' + fmtN(o.total) + '.'
              : o.id + ' paid — ' + fmtN(o.total) + (saleId ? ' recorded as ' + saleId : '') + '.',
            'success'
          );
        } else {
          const stamp = nowStamp();
          const sale = {
            id: nextSaleId(),
            items: o.items,
            subtotal: o.subtotal,
            discount: o.discount,
            total: o.total,
            method: method,
            staff: o.staff,
            table: o.table,
            notes: o.notes,
            date: stamp,
            status: 'completed',
            source: 'tab',
            roomNumber: room.room || null,
            guestName: room.guest || null,
            guestPhone: room.phone || null,
          };
          (o.items || []).forEach(function (item) {
            const inv = stock.find(function (i) { return i.name === item.name; });
            if (inv) {
              inv.qty = Math.max(0, inv.qty - item.qty);
              movements.unshift({
                date: stamp, item: item.name, qtyIn: 0, qtyOut: item.qty, balance: inv.qty,
                reason: 'Tab Payment (' + o.id + ')',
              });
            }
          });
          sales.unshift(sale);
          o.status = 'paid';
          o.payMethod = method;
          o.paidSaleId = sale.id;
          o.roomNumber = isRoomCharge ? (room.room || null) : (o.roomNumber || null);
          o.guestName = isRoomCharge ? (room.guest || null) : (o.guestName || null);
          o.guestPhone = isRoomCharge ? (room.phone || null) : (o.guestPhone || null);
          sale.roomNumber = o.roomNumber;
          sale.guestName = o.guestName;
          sale.guestPhone = o.guestPhone;
          await Promise.all([
            saveShared(keys.sales, sales),
            saveShared(keys.stock, stock),
            saveShared(keys.movements, movements),
            saveShared(keys.orders, orders),
          ]);
          apiSave('PATCH', apiPaths.orders + '/' + o.id, {
            status: 'paid', method: method, roomNumber: o.roomNumber, guestName: o.guestName, guestPhone: o.guestPhone,
          });
          $('[data-role="payModal"]').classList.remove('show');
          showToast(
            isRoomCharge
              ? o.id + ' charged to Room ' + room.room + ' — ' + fmtN(o.total) + '.'
              : o.id + ' paid — ' + fmtN(o.total) + ' recorded as ' + sale.id + '.',
            'success'
          );
        }
        renderOrdersTable();
        renderKPIs();
        renderPicker();
      } catch (err) {
        showToast((err && err.message) || 'Payment failed.', 'error');
      }
    }

    async function cancelOrder(id) {
      try {
        if (service && typeof service.cancelOrder === 'function') {
          await service.cancelOrder(id);
          syncFromService();
        } else {
          const o = orders.find(function (x) { return x.id === id; });
          if (!o) return;
          o.status = 'cancelled';
          await saveShared(keys.orders, orders);
          apiSave('PATCH', apiPaths.orders + '/' + id, { status: 'cancelled' });
        }
        showToast(id + ' cancelled.', 'error');
        renderOrdersTable();
        renderKPIs();
      } catch (err) {
        showToast((err && err.message) || 'Could not cancel order.', 'error');
      }
    }

    // Room search helpers — matches by room number, guest name, or phone
    function filterGuests(q) {
      q = (q || '').toLowerCase();
      if (!q) return [];
      return guests.filter(function (g) {
        return String(g.room).includes(q)
          || (g.name || '').toLowerCase().includes(q)
          || (g.phone || '').toLowerCase().includes(q);
      }).slice(0, 8);
    }

    function onRoomSearch(which) {
      const input = which === 'pay' ? $('[data-role="payRoomSearch"]') : $('[data-role="roomSearch"]');
      const results = which === 'pay' ? $('[data-role="payRoomResults"]') : $('[data-role="roomResults"]');
      if (!input || !results) return;
      const list = filterGuests(input.value);
      if (!list.length) {
        results.classList.remove('show');
        results.innerHTML = '';
        return;
      }
      results.innerHTML = list.map(function (g) {
        return '<div class="ow-room-item" data-pick-room="' + esc(g.room) + '" data-pick-guest="' + esc(g.name) + '" data-pick-phone="' + esc(g.phone || '') + '" data-pick-guest-id="' + esc(g.guestId || '') + '" data-pick-which="' + which + '">' +
          '<div class="rn">Room ' + esc(g.room) + '</div>' +
          '<div class="gn">' + esc(g.name) + (g.phone ? ' · ' + esc(g.phone) : '') + (g.status ? ' · ' + esc(g.status) : '') + '</div></div>';
      }).join('');
      results.classList.add('show');
    }

    function selectRoom(room, name, phone, which, guestId) {
      if (which === 'pay') {
        $('[data-role="payRoomNumber"]').value = room;
        $('[data-role="payGuestName"]').value = name;
        if ($('[data-role="payGuestPhone"]')) $('[data-role="payGuestPhone"]').value = phone || '';
        if ($('[data-role="payGuestId"]')) $('[data-role="payGuestId"]').value = guestId || '';
        $('[data-role="payRoomSearch"]').value = '';
        $('[data-role="payRoomResults"]').classList.remove('show');
        const box = $('[data-role="paySelectedRoomBox"]');
        box.querySelector('.info').innerHTML =
          'Room ' + esc(room) + '<span>' + esc(name) + (phone ? ' · ' + esc(phone) : '') + '</span>';
        box.classList.add('show');
      } else {
        $('[data-role="fRoomNumber"]').value = room;
        $('[data-role="fGuestName"]').value = name;
        if ($('[data-role="fGuestPhone"]')) $('[data-role="fGuestPhone"]').value = phone || '';
        if ($('[data-role="fGuestId"]')) $('[data-role="fGuestId"]').value = guestId || '';
        if ($('[data-role="roomSearch"]')) $('[data-role="roomSearch"]').value = '';
        if ($('[data-role="roomResults"]')) $('[data-role="roomResults"]').classList.remove('show');
        const box = $('[data-role="selectedRoomBox"]');
        if (box) {
          box.querySelector('.info').innerHTML =
            'Room ' + esc(room) + '<span>' + esc(name) + (phone ? ' · ' + esc(phone) : '') + '</span>';
          box.classList.add('show');
        }
      }
    }

    function clearSelectedRoom(which) {
      if (which === 'pay') {
        if ($('[data-role="payRoomNumber"]')) $('[data-role="payRoomNumber"]').value = '';
        if ($('[data-role="payGuestName"]')) $('[data-role="payGuestName"]').value = '';
        if ($('[data-role="payGuestPhone"]')) $('[data-role="payGuestPhone"]').value = '';
        if ($('[data-role="payGuestId"]')) $('[data-role="payGuestId"]').value = '';
        if ($('[data-role="payRoomSearch"]')) $('[data-role="payRoomSearch"]').value = '';
        if ($('[data-role="payRoomResults"]')) {
          $('[data-role="payRoomResults"]').classList.remove('show');
          $('[data-role="payRoomResults"]').innerHTML = '';
        }
        if ($('[data-role="paySelectedRoomBox"]')) $('[data-role="paySelectedRoomBox"]').classList.remove('show');
      } else {
        if ($('[data-role="fRoomNumber"]')) $('[data-role="fRoomNumber"]').value = '';
        if ($('[data-role="fGuestName"]')) $('[data-role="fGuestName"]').value = '';
        if ($('[data-role="fGuestPhone"]')) $('[data-role="fGuestPhone"]').value = '';
        if ($('[data-role="fGuestId"]')) $('[data-role="fGuestId"]').value = '';
        if ($('[data-role="roomSearch"]')) $('[data-role="roomSearch"]').value = '';
        if ($('[data-role="roomResults"]')) {
          $('[data-role="roomResults"]').classList.remove('show');
          $('[data-role="roomResults"]').innerHTML = '';
        }
        if ($('[data-role="selectedRoomBox"]')) $('[data-role="selectedRoomBox"]').classList.remove('show');
      }
    }

    // Events
    root.addEventListener('click', function (e) {
      const modeTab = e.target.closest('[data-mode]');
      if (modeTab && modeTab.classList.contains('ow-mode-tab')) {
        setMode(modeTab.dataset.mode);
        return;
      }
      const cat = e.target.closest('[data-cat]');
      if (cat) {
        activeCat = cat.dataset.cat;
        renderPicker();
        return;
      }
      const add = e.target.closest('[data-add]');
      if (add) {
        addToCart(add.dataset.add);
        return;
      }
      const adj = e.target.closest('[data-adj]');
      if (adj) {
        adjustQty(adj.dataset.adj, parseInt(adj.dataset.delta, 10));
        return;
      }
      const rem = e.target.closest('[data-remove]');
      if (rem) {
        cart = cart.filter(function (c) { return c.key !== rem.dataset.remove; });
        renderCart();
        renderPicker();
        return;
      }
      const act = e.target.closest('[data-act]');
      if (act) {
        const a = act.dataset.act;
        if (a === 'clearCart') clearCart();
        else if (a === 'submit') submitOrder();
        else if (a === 'closePay') $('[data-role="payModal"]').classList.remove('show');
        else if (a === 'confirmPay') confirmPayOrder();
        else if (a === 'clearRoom') clearSelectedRoom('');
        else if (a === 'clearPayRoom') clearSelectedRoom('pay');
        return;
      }
      const served = e.target.closest('[data-served]');
      if (served) { markServed(served.dataset.served); return; }
      const pay = e.target.closest('[data-pay]');
      if (pay) { openPayModal(pay.dataset.pay); return; }
      const cancel = e.target.closest('[data-cancel]');
      if (cancel) { cancelOrder(cancel.dataset.cancel); return; }
      const pick = e.target.closest('[data-pick-room]');
      if (pick) {
        selectRoom(pick.dataset.pickRoom, pick.dataset.pickGuest, pick.dataset.pickPhone || '', pick.dataset.pickWhich || '', pick.dataset.pickGuestId || '');
        return;
      }
      const pill = e.target.closest('.ow-status-pill');
      if (pill) {
        statusFilter = pill.dataset.status || '';
        $$('.ow-status-pill').forEach(function (p) { p.classList.remove('on'); });
        pill.classList.add('on');
        renderOrdersTable();
      }
    });

    $('[data-role="itemSearch"]').addEventListener('input', function () { renderPicker(); });
    $('[data-role="cartDisc"]').addEventListener('input', function () { updateTotals(); });
    if ($('[data-role="fMethod"]')) {
      $('[data-role="fMethod"]').addEventListener('change', toggleRoomChargeUI);
    }
    if ($('[data-role="payMethod"]')) {
      $('[data-role="payMethod"]').addEventListener('change', togglePayRoomChargeUI);
    }
    if ($('[data-role="roomSearch"]')) {
      $('[data-role="roomSearch"]').addEventListener('input', function () { onRoomSearch(''); });
    }
    if ($('[data-role="payRoomSearch"]')) {
      $('[data-role="payRoomSearch"]').addEventListener('input', function () { onRoomSearch('pay'); });
    }
    $('[data-role="payModal"]').addEventListener('click', function (e) {
      if (e.target === this) this.classList.remove('show');
    });

    async function init() {
      // ── Preferred path: module service ──
      if (service) {
        try {
          if (!service.state || !service.state.ready) {
            if (typeof service.loadAll === 'function') await service.loadAll();
          }
          syncFromService();
          const fromSvc = resolvePaymentMethodsFromService();
          if (fromSvc) applyPaymentMethods(fromSvc);
          if (typeof service.onChange === 'function') {
            unsubService = service.onChange(function () {
              syncFromService();
              const pm = resolvePaymentMethodsFromService();
              if (pm) applyPaymentMethods(pm);
              renderKPIs();
              renderPicker();
              renderCart();
              renderOrdersTable();
            });
          }
          if (shell && shell.setApiMode) {
            shell.setApiMode('Live');
          }
          finish();
          return;
        } catch (e) {
          console.warn('[OrdersWorkspace] service load failed, falling back:', e.message);
        }
      }

      // ── Fallback: direct API / storage ──
      if (CFG.API_BASE) {
        try {
          const data = await apiFetch('GET', apiPaths.page);
          stock = data.stock || [];
          sales = data.sales || [];
          orders = data.orders || [];
          movements = data.movements || [];
          if (Array.isArray(data.paymentMethods) && data.paymentMethods.length) {
            applyPaymentMethods(data.paymentMethods);
          }
          if (shell && shell.setApiMode) shell.setApiMode('Live');
          finish();
          return;
        } catch (e) {
          console.warn('[OrdersWorkspace] API fallback:', e.message);
        }
      }
      stock = await loadShared(keys.stock, demo.stock || []);
      sales = await loadShared(keys.sales, demo.sales || []);
      orders = await loadShared(keys.orders, demo.orders || []);
      movements = await loadShared(keys.movements, []);
      await Promise.all([
        saveShared(keys.stock, stock),
        saveShared(keys.sales, sales),
        saveShared(keys.orders, orders),
        saveShared(keys.movements, movements),
      ]);
      finish();
    }

    function finish() {
      const staffInput = $('[data-role="fStaff"]');
      if (staffInput) staffInput.value = resolveStaffName();
      // Continuously poll every 100ms up to 2.5s for session user to arrive from shell
      const pollStart = Date.now();
      const staffPoll = setInterval(function () {
        const resolved = resolveStaffName();
        if (resolved && resolved !== demoStaffName) {
          const elStaff = $('[data-role="fStaff"]');
          if (elStaff) elStaff.value = resolved;
          clearInterval(staffPoll);
        } else if (Date.now() - pollStart > 2500) {
          clearInterval(staffPoll);
        }
      }, 100);
      toggleRoomChargeUI();
      renderKPIs();
      renderPicker();
      renderCart();
      renderOrdersTable();
      setMode('quick');
    }

    init();

    return {
      refresh: function () {
        if (service) syncFromService();
        renderKPIs();
        renderPicker();
        renderCart();
        renderOrdersTable();
      },
      getState: function () {
        return { stock: stock, sales: sales, orders: orders, cart: cart, mode: mode, service: !!service };
      },
      destroy: function () {
        if (typeof unsubService === 'function') {
          try { unsubService(); } catch (e) {}
          unsubService = null;
        }
        el.innerHTML = '';
      },
      shell: shell,
      service: service,
    };
  }

  global.OrdersWorkspace = { attach: attach };
})(window);