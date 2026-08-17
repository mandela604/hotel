/**
 * component/sales-filter-bar.js — Reusable sales/report filter toolbar
 * ─────────────────────────────────────────────────────────────────────
 * Self-contained CSS + DOM (sfb- prefix). Works on Pool Bar, Restaurant,
 * Accounting, or any page that needs period / status / source / payment /
 * staff / date-range / search filters.
 *
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/flatpickr/4.6.13/flatpickr.min.js"></script>
 *   <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/flatpickr/4.6.13/flatpickr.min.css">
 *   <script src="component/sales-filter-bar.js"></script>
 *
 *   // Staff options from service — never hardcode names in the bar:
 *   const staffOptions = [...new Set(
 *     svc.state.sales.map(s => s.staff).filter(Boolean)
 *       .concat(svc.state.orders.map(o => o.staff).filter(Boolean))
 *   )].sort();
 *
 *   const bar = SalesFilterBar.create({
 *     target: '#filterSlot',
 *     show: {
 *       period: true,
 *       status: true,
 *       source: true,
 *       payment: true,
 *       staff: true,       // ← staff dropdown
 *       dateRange: true,
 *       search: true,
 *       clear: true,
 *     },
 *     staffOptions: staffOptions,  // from service / API
 *     periodOptions: [ ... ],
 *     statusOptions: [ ... ],
 *     sourceOptions: [ ... ],
 *     paymentOptions: ['Cash', 'POS', 'Transfer', 'Room Charge', 'Complimentary'],
 *     searchPlaceholder: 'Sale #, item, staff…',
 *     defaultPeriod: 'all',
 *     actions: [
 *       { id: 'print', label: 'Print Report', icon: 'fa-print', variant: 'outline' },
 *     ],
 *     onChange: (state) => {
 *       // state = {
 *       //   period, status, source, payment, staff, search,
 *       //   rangeStart, rangeEnd,
 *       //   bounds: { start, end, label }
 *       // }
 *     },
 *     onAction: (actionId, state) => { if (actionId === 'print') window.print(); },
 *   });
 *
 *   bar.getState();
 *   bar.setState({ period: 'today', status: 'completed', staff: 'Bola Nwosu' });
 *   bar.setStaffOptions(['Bola Nwosu', 'Emeka U.']); // refresh after new sales
 *   bar.reset();
 *   bar.destroy();
 */

(function () {
  'use strict';

  const CSS = `
    .sfb-root{
      --sfb-surface:#ffffff; --sfb-surface2:#f4f6fb; --sfb-border:#eef0f6; --sfb-border2:#dfe3ec;
      --sfb-text:#1c2440; --sfb-text2:#6b7280; --sfb-text3:#9aa1b3;
      --sfb-gold:#2f6fed; --sfb-gold-light:#5b8ff9; --sfb-gold-dim:rgba(47,111,237,0.10); --sfb-gold-border:rgba(47,111,237,0.25);
      --sfb-green:#12b76a; --sfb-green-bg:#e9f9f0;
      --sfb-red:#f04438; --sfb-red-bg:#feecec;
      --sfb-amber:#f79009; --sfb-amber-bg:#fff4e5;
      --sfb-blue:#2f6fed; --sfb-blue-bg:#eaf1ff;
      --sfb-shadow:0 4px 20px rgba(15,34,55,0.07);
      font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif;
      font-size:13px; color:var(--sfb-text);
      background:var(--sfb-surface); border:1px solid var(--sfb-border); border-radius:14px;
      box-shadow:var(--sfb-shadow); padding:14px 16px; display:flex; flex-direction:column; gap:10px;
    }
    .sfb-row{ display:flex; align-items:flex-end; gap:8px; flex-wrap:wrap; width:100%; }
    .sfb-row-1{ justify-content:flex-start; }
    .sfb-row-2{ justify-content:center; }
    .sfb-row-single{ justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:10px; }
    .sfb-single-left{ display:flex; align-items:flex-end; gap:8px; flex-wrap:wrap; flex:1 1 auto; min-width:0; }
    .sfb-single-right{ display:flex; align-items:flex-end; gap:8px; flex:0 0 auto; margin-left:auto; }
    .sfb-actions{ display:flex; align-items:center; gap:8px; flex:0 0 auto; flex-wrap:wrap; }
    .sfb-group{ display:flex; flex-direction:column; gap:4px; min-width:0; }
    .sfb-search-wrap{ flex:1 1 180px; min-width:160px; max-width:280px; }
    .sfb-search-wrap .sfb-search{ max-width:none; width:100%; min-width:0; }
    .sfb-label{ font-size:9px; text-transform:uppercase; letter-spacing:1.1px; color:var(--sfb-text3); font-weight:700; padding-left:2px; }

    .sfb-pills{ display:flex; gap:6px; flex-wrap:wrap; }
    .sfb-pill{
      display:inline-flex; align-items:center; gap:5px;
      padding:6px 10px; border-radius:20px; font-size:11.5px; font-weight:600;
      cursor:pointer; border:1px solid var(--sfb-border); background:var(--sfb-surface2);
      color:var(--sfb-text2); transition:all .15s; white-space:nowrap; user-select:none;
    }
    .sfb-pill:hover{ border-color:var(--sfb-gold-border); color:var(--sfb-gold); }
    .sfb-pill .sfb-dot{ width:6px; height:6px; border-radius:50%; flex-shrink:0; }

    .sfb-pill.period.on{ background:var(--sfb-gold-dim); border-color:var(--sfb-gold-border); color:var(--sfb-gold); }

    .sfb-pill.status.on.all{ background:var(--sfb-gold-dim); border-color:var(--sfb-gold-border); color:var(--sfb-gold); }
    .sfb-pill.status.on.completed{ background:var(--sfb-green-bg); border-color:rgba(18,183,106,.4); color:var(--sfb-green); }
    .sfb-pill.status.on.voided{ background:var(--sfb-red-bg); border-color:rgba(240,68,56,.4); color:var(--sfb-red); }
    .sfb-pill.status.on.open{ background:var(--sfb-blue-bg); border-color:rgba(47,111,237,.35); color:var(--sfb-blue); }
    .sfb-pill.status.on.pending{ background:var(--sfb-amber-bg); border-color:rgba(247,144,9,.4); color:var(--sfb-amber); }

    .sfb-pill.source.on{ background:var(--sfb-gold-dim); border-color:var(--sfb-gold-border); color:var(--sfb-gold); }

    .sfb-search{
      display:flex; align-items:center; gap:7px; background:var(--sfb-surface2);
      border:1px solid var(--sfb-border); border-radius:10px; padding:8px 12px;
      transition:border-color .2s; min-width:180px; max-width:260px; flex:1;
    }
    .sfb-search:focus-within{ border-color:var(--sfb-gold-border); }
    .sfb-search input{ background:none; border:none; outline:none; color:var(--sfb-text); font-size:13px; width:100%; font-family:inherit; }
    .sfb-search input::placeholder{ color:var(--sfb-text3); }
    .sfb-search i{ color:var(--sfb-text3); font-size:12px; }

    .sfb-select{
      background:var(--sfb-surface2); border:1px solid var(--sfb-border); border-radius:10px;
      padding:8px 10px; color:var(--sfb-text); font-size:12.5px; cursor:pointer;
      outline:none; transition:border-color .2s; min-width:120px; font-family:inherit;
    }
    .sfb-select:focus{ border-color:var(--sfb-gold-border); }
    .sfb-select.staff{ min-width:130px; max-width:180px; }

    .sfb-daterange{
      display:flex; align-items:center; gap:7px; background:var(--sfb-surface2);
      border:1px solid var(--sfb-border); border-radius:10px; padding:8px 12px;
      transition:border-color .2s; min-width:190px; cursor:pointer;
    }
    .sfb-daterange:focus-within, .sfb-daterange.open{ border-color:var(--sfb-gold-border); }
    .sfb-daterange input{
      background:none; border:none; outline:none; color:var(--sfb-text);
      font-size:12.5px; width:100%; cursor:pointer; font-family:inherit;
    }
    .sfb-daterange input::placeholder{ color:var(--sfb-text3); }
    .sfb-daterange i.cal{ color:var(--sfb-text3); font-size:12px; }
    .sfb-daterange-clear{
      background:none; border:none; color:var(--sfb-text3); cursor:pointer;
      font-size:12px; padding:0; display:none; line-height:1;
    }
    .sfb-daterange.has-value .sfb-daterange-clear{ display:flex; }
    .sfb-daterange-clear:hover{ color:var(--sfb-red); }

    .sfb-ghost{
      background:none; border:none; color:var(--sfb-text3); font-size:11.5px; font-weight:700;
      cursor:pointer; padding:8px 6px; display:inline-flex; align-items:center; gap:5px; font-family:inherit;
    }
    .sfb-ghost:hover{ color:var(--sfb-gold); }

    .sfb-btn{
      display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:10px;
      font-size:11.5px; font-weight:600; cursor:pointer; transition:all .2s; white-space:nowrap;
      border:1px solid transparent; font-family:inherit;
    }
    .sfb-btn-outline{ background:none; border-color:var(--sfb-border); color:var(--sfb-text2); }
    .sfb-btn-outline:hover{ border-color:var(--sfb-gold); color:var(--sfb-gold); }
    .sfb-btn-primary{ background:var(--sfb-gold); border-color:var(--sfb-gold); color:#fff; }
    .sfb-btn-primary:hover{ background:var(--sfb-gold-light); border-color:var(--sfb-gold-light); }

    .sfb-chips{ display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
    .sfb-chip{
      display:inline-flex; align-items:center; gap:6px; background:var(--sfb-gold-dim);
      border:1px solid var(--sfb-gold-border); color:var(--sfb-gold); font-size:11px; font-weight:600;
      padding:4px 8px 4px 10px; border-radius:20px; white-space:nowrap;
    }
    .sfb-chip button{ background:none; border:none; color:var(--sfb-gold); cursor:pointer; font-size:11px; line-height:1; padding:0; display:flex; }
    .sfb-chip button:hover{ color:var(--sfb-red); }

    @media (max-width:900px){
      .sfb-row-1, .sfb-row-2, .sfb-row-single{ gap:8px; }
      .sfb-single-right{ margin-left:0; width:100%; }
      .sfb-search-wrap{ flex:1 1 100%; max-width:none; }
      .sfb-search, .sfb-daterange{ max-width:100%; }
      .sfb-select{ max-width:none; }
      .sfb-actions .sfb-btn{ justify-content:center; }
    }

    .flatpickr-calendar.sfb-fp{ background:#ffffff !important; border:1px solid #eef0f6 !important; box-shadow:0 18px 46px rgba(15,34,55,0.16) !important; font-family:inherit !important; }
    .flatpickr-calendar.sfb-fp.arrowTop:before, .flatpickr-calendar.sfb-fp.arrowTop:after{ border-bottom-color:#ffffff !important; }
    .flatpickr-calendar.sfb-fp .flatpickr-months, .flatpickr-calendar.sfb-fp .flatpickr-weekdays{ background:#ffffff !important; }
    .flatpickr-calendar.sfb-fp .flatpickr-current-month .flatpickr-monthDropdown-months,
    .flatpickr-calendar.sfb-fp .flatpickr-current-month input.cur-year{ color:#1c2440 !important; }
    .flatpickr-calendar.sfb-fp span.flatpickr-weekday{ color:#9aa1b3 !important; }
    .flatpickr-calendar.sfb-fp .flatpickr-day{ color:#6b7280 !important; }
    .flatpickr-calendar.sfb-fp .flatpickr-day.today{ border-color:#2f6fed !important; }
    .flatpickr-calendar.sfb-fp .flatpickr-day:hover{ background:#f4f6fb !important; }
    .flatpickr-calendar.sfb-fp .flatpickr-day.selected,
    .flatpickr-calendar.sfb-fp .flatpickr-day.startRange,
    .flatpickr-calendar.sfb-fp .flatpickr-day.endRange{ background:#2f6fed !important; border-color:#2f6fed !important; color:#ffffff !important; }
    .flatpickr-calendar.sfb-fp .flatpickr-day.inRange{ background:rgba(47,111,237,0.10) !important; border-color:rgba(47,111,237,0.10) !important; box-shadow:-5px 0 0 rgba(47,111,237,0.10), 5px 0 0 rgba(47,111,237,0.10) !important; }
  `;

  let _stylesInjected = false;
  function _injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const el = document.createElement('style');
    el.id = 'sfb-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function _daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return _startOfDay(d);
  }
  function _dateOnly(dt) {
    return dt ? new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()) : null;
  }

  const DEFAULTS = {
    show: {
      period: true,
      status: true,
      source: false,
      payment: true,
      staff: false,
      dateRange: true,
      search: true,
      clear: true,
      chips: true,
    },
    periodOptions: [
      { value: 'all', label: 'All Time' },
      { value: 'today', label: 'Today' },
      { value: '7d', label: 'Last 7 Days' },
      { value: '30d', label: 'Last 30 Days' },
    ],
    statusOptions: [
      { value: '', label: 'All', tone: 'all' },
      { value: 'completed', label: 'Completed', tone: 'completed', color: '#12b76a' },
      { value: 'voided', label: 'Voided', tone: 'voided', color: '#f04438' },
    ],
    sourceOptions: [
      { value: '', label: 'All Sources' },
      { value: 'quick', label: 'Quick Sale' },
      { value: 'tab', label: 'Open Tab' },
    ],
    paymentOptions: ['Cash', 'POS', 'Transfer', 'Room Charge', 'Complimentary'],
    staffOptions: [],
    searchPlaceholder: 'Sale #, item, staff…',
    defaultPeriod: 'all',
    defaultStatus: '',
    defaultSource: '',
    defaultPayment: '',
    defaultStaff: '',
    layout: 'auto', // 'auto' | 'rows' | 'single'
    actions: [],
    onChange: null,
    onAction: null,
  };

  function create(options) {
    options = options || {};
    _injectStyles();

    const cfg = {
      show: Object.assign({}, DEFAULTS.show, options.show || {}),
      periodOptions: options.periodOptions || DEFAULTS.periodOptions,
      statusOptions: options.statusOptions || DEFAULTS.statusOptions,
      sourceOptions: options.sourceOptions || DEFAULTS.sourceOptions,
      paymentOptions: options.paymentOptions || DEFAULTS.paymentOptions,
      staffOptions: Array.isArray(options.staffOptions) ? options.staffOptions.slice() : [],
      searchPlaceholder: options.searchPlaceholder || DEFAULTS.searchPlaceholder,
      defaultPeriod: options.defaultPeriod != null ? options.defaultPeriod : DEFAULTS.defaultPeriod,
      defaultStatus: options.defaultStatus != null ? options.defaultStatus : DEFAULTS.defaultStatus,
      defaultSource: options.defaultSource != null ? options.defaultSource : DEFAULTS.defaultSource,
      defaultPayment: options.defaultPayment != null ? options.defaultPayment : DEFAULTS.defaultPayment,
      defaultStaff: options.defaultStaff != null ? options.defaultStaff : DEFAULTS.defaultStaff,
      layout: options.layout || DEFAULTS.layout || 'auto',
      actions: options.actions || [],
      onChange: options.onChange || null,
      onAction: options.onAction || null,
    };

    const state = {
      period: cfg.defaultPeriod,
      status: cfg.defaultStatus,
      source: cfg.defaultSource,
      payment: cfg.defaultPayment,
      staff: cfg.defaultStaff,
      search: '',
      rangeStart: null,
      rangeEnd: null,
    };

    let fp = null;
    let _syncing = false;
    let root = null;
    let chipsRow = null;

    function boundsFromState() {
      if (state.period === 'custom' && state.rangeStart && state.rangeEnd) {
        return { start: state.rangeStart, end: state.rangeEnd, label: 'Custom range' };
      }
      if (state.period === 'today') {
        const t = _startOfDay(new Date());
        return { start: t, end: t, label: 'Today' };
      }
      if (state.period === '7d') {
        return { start: _daysAgo(6), end: _startOfDay(new Date()), label: 'Last 7 days' };
      }
      if (state.period === '30d') {
        return { start: _daysAgo(29), end: _startOfDay(new Date()), label: 'Last 30 days' };
      }
      return { start: null, end: null, label: 'All time' };
    }

    function emit() {
      if (typeof cfg.onChange === 'function') {
        cfg.onChange(Object.assign({}, state, { bounds: boundsFromState() }));
      }
      renderChips();
    }

    function setPeriodPill(value) {
      if (!root) return;
      root.querySelectorAll('.sfb-pill.period').forEach(function (p) {
        p.classList.toggle('on', p.dataset.value === value);
      });
    }

    function setStatusPill(value) {
      if (!root) return;
      root.querySelectorAll('.sfb-pill.status').forEach(function (p) {
        p.classList.toggle('on', (p.dataset.value || '') === (value || ''));
      });
    }

    function setSourcePill(value) {
      if (!root) return;
      root.querySelectorAll('.sfb-pill.source').forEach(function (p) {
        p.classList.toggle('on', (p.dataset.value || '') === (value || ''));
      });
    }

    function applyPeriodToDates(period) {
      _syncing = true;
      if (period === 'all') {
        state.rangeStart = null;
        state.rangeEnd = null;
        if (fp) fp.clear();
        const box = root && root.querySelector('.sfb-daterange');
        if (box) box.classList.remove('has-value');
      } else if (period === 'today') {
        const t = _startOfDay(new Date());
        state.rangeStart = t;
        state.rangeEnd = t;
        if (fp) fp.setDate([t, t], false);
        const box = root && root.querySelector('.sfb-daterange');
        if (box) box.classList.add('has-value');
      } else if (period === '7d') {
        const s = _daysAgo(6), e = _startOfDay(new Date());
        state.rangeStart = s;
        state.rangeEnd = e;
        if (fp) fp.setDate([s, e], false);
        const box = root && root.querySelector('.sfb-daterange');
        if (box) box.classList.add('has-value');
      } else if (period === '30d') {
        const s = _daysAgo(29), e = _startOfDay(new Date());
        state.rangeStart = s;
        state.rangeEnd = e;
        if (fp) fp.setDate([s, e], false);
        const box = root && root.querySelector('.sfb-daterange');
        if (box) box.classList.add('has-value');
      }
      _syncing = false;
    }

    function renderStaffOptions() {
      const sel = root && root.querySelector('[data-sfb="staff"]');
      if (!sel) return;
      const current = state.staff;
      let html = '<option value="">All Staff</option>';
      cfg.staffOptions.forEach(function (name) {
        html += '<option value="' + _esc(name) + '"' +
          (current === name ? ' selected' : '') + '>' + _esc(name) + '</option>';
      });
      sel.innerHTML = html;
      if (current && cfg.staffOptions.indexOf(current) === -1) {
        state.staff = '';
        sel.value = '';
      }
    }

    function renderChips() {
      if (!cfg.show.chips || !chipsRow) return;
      const chips = [];
      if (state.period && state.period !== 'all') {
        const opt = cfg.periodOptions.find(function (o) { return o.value === state.period; });
        chips.push({
          label: 'Period: ' + (opt ? opt.label : state.period === 'custom' ? 'Custom' : state.period),
          clear: function () {
            state.period = 'all';
            applyPeriodToDates('all');
            setPeriodPill('all');
            emit();
          },
        });
      }
      if (state.status) {
        const opt = cfg.statusOptions.find(function (o) { return o.value === state.status; });
        chips.push({
          label: 'Status: ' + (opt ? opt.label : state.status),
          clear: function () {
            state.status = '';
            setStatusPill('');
            emit();
          },
        });
      }
      if (state.source) {
        const opt = cfg.sourceOptions.find(function (o) { return o.value === state.source; });
        chips.push({
          label: 'Source: ' + (opt ? opt.label : state.source),
          clear: function () {
            state.source = '';
            setSourcePill('');
            emit();
          },
        });
      }
      if (state.payment) {
        chips.push({
          label: 'Payment: ' + state.payment,
          clear: function () {
            state.payment = '';
            const sel = root && root.querySelector('[data-sfb="payment"]');
            if (sel) sel.value = '';
            emit();
          },
        });
      }
      if (state.staff) {
        chips.push({
          label: 'Staff: ' + state.staff,
          clear: function () {
            state.staff = '';
            const sel = root && root.querySelector('[data-sfb="staff"]');
            if (sel) sel.value = '';
            emit();
          },
        });
      }
      if (state.search) {
        chips.push({
          label: 'Search: "' + state.search + '"',
          clear: function () {
            state.search = '';
            const inp = root && root.querySelector('[data-sfb="search"]');
            if (inp) inp.value = '';
            emit();
          },
        });
      }
      if (state.period === 'custom' && state.rangeStart && state.rangeEnd) {
        const fmt = function (d) {
          return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
        };
        chips.push({
          label: 'Date: ' + fmt(state.rangeStart) + ' – ' + fmt(state.rangeEnd),
          clear: function () {
            state.period = 'all';
            applyPeriodToDates('all');
            setPeriodPill('all');
            emit();
          },
        });
      }

      if (chips.length === 0) {
        chipsRow.style.display = 'none';
        chipsRow.innerHTML = '';
        return;
      }
      chipsRow.style.display = '';
      chipsRow.innerHTML = '<div class="sfb-chips">' + chips.map(function (c, i) {
        return '<span class="sfb-chip">' + _esc(c.label) +
          '<button type="button" data-chip="' + i + '" aria-label="Remove filter"><i class="fa-solid fa-xmark"></i></button></span>';
      }).join('') + '</div>';
      chipsRow.querySelectorAll('[data-chip]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          chips[parseInt(btn.dataset.chip, 10)].clear();
        });
      });
    }

    function buildHtml() {
      function pillsGroup(label, kind, options, isOn) {
        var html = '<div class="sfb-group"><span class="sfb-label">' + label + '</span><div class="sfb-pills">';
        options.forEach(function (o) {
          var val = o.value != null ? o.value : '';
          var on = isOn(val) ? ' on' : '';
          if (kind === 'status') {
            var tone = o.tone || (val || 'all');
            var dot = o.color
              ? '<span class="sfb-dot" style="background:' + _esc(o.color) + '"></span>'
              : '';
            html += '<div class="sfb-pill status ' + _esc(tone) + on + '" data-value="' + _esc(val) + '">' +
              dot + _esc(o.label) + '</div>';
          } else {
            html += '<div class="sfb-pill ' + kind + on + '" data-value="' + _esc(val) + '">' +
              _esc(o.label) + '</div>';
          }
        });
        html += '</div></div>';
        return html;
      }

      var periodG = '', statusG = '', sourceG = '', paymentG = '', staffG = '';
      var dateG = '', searchG = '', clearG = '', actionsG = '';

      if (cfg.show.period) {
        periodG = pillsGroup('Period', 'period', cfg.periodOptions, function (v) {
          return v === state.period;
        });
      }
      if (cfg.show.status) {
        statusG = pillsGroup('Status', 'status', cfg.statusOptions, function (v) {
          return (v || '') === (state.status || '');
        });
      }
      if (cfg.show.source) {
        sourceG = pillsGroup('Source', 'source', cfg.sourceOptions, function (v) {
          return (v || '') === (state.source || '');
        });
      }
      if (cfg.show.payment) {
        paymentG = '<div class="sfb-group"><span class="sfb-label">Payment</span><select class="sfb-select" data-sfb="payment">';
        paymentG += '<option value="">All Payments</option>';
        cfg.paymentOptions.forEach(function (p) {
          paymentG += '<option value="' + _esc(p) + '"' + (state.payment === p ? ' selected' : '') + '>' + _esc(p) + '</option>';
        });
        paymentG += '</select></div>';
      }
      if (cfg.show.staff) {
        staffG = '<div class="sfb-group"><span class="sfb-label">Staff</span>' +
          '<select class="sfb-select staff" data-sfb="staff">' +
          '<option value="">All Staff</option>';
        cfg.staffOptions.forEach(function (name) {
          staffG += '<option value="' + _esc(name) + '"' +
            (state.staff === name ? ' selected' : '') + '>' + _esc(name) + '</option>';
        });
        staffG += '</select></div>';
      }
      if (cfg.show.dateRange) {
        dateG = '<div class="sfb-group"><span class="sfb-label">Date</span>' +
          '<div class="sfb-daterange" data-sfb="daterange-box">' +
          '<i class="fa-solid fa-calendar-days cal"></i>' +
          '<input type="text" data-sfb="daterange" placeholder="Date range" readonly>' +
          '<button type="button" class="sfb-daterange-clear" data-sfb="daterange-clear" title="Clear dates"><i class="fa-solid fa-xmark"></i></button>' +
          '</div></div>';
      }
      if (cfg.show.search) {
        searchG = '<div class="sfb-group sfb-search-wrap"><span class="sfb-label">Search</span>' +
          '<div class="sfb-search"><i class="fa-solid fa-magnifying-glass"></i>' +
          '<input type="text" data-sfb="search" placeholder="' + _esc(cfg.searchPlaceholder) + '">' +
          '</div></div>';
      }
      if (cfg.show.clear) {
        clearG = '<div class="sfb-group"><span class="sfb-label">&nbsp;</span>' +
          '<button type="button" class="sfb-ghost" data-sfb="clear"><i class="fa-solid fa-xmark"></i> Clear</button></div>';
      }

      var actions = '';
      cfg.actions.forEach(function (a) {
        var variant = a.variant === 'primary' ? 'sfb-btn-primary' : 'sfb-btn-outline';
        var icon = a.icon ? '<i class="fa-solid ' + _esc(a.icon) + '"></i> ' : '';
        actions += '<button type="button" class="sfb-btn ' + variant + '" data-sfb-action="' + _esc(a.id) + '">' +
          icon + _esc(a.label) + '</button>';
      });
      if (actions) {
        actionsG = '<div class="sfb-group"><span class="sfb-label">&nbsp;</span>' +
          '<div class="sfb-actions">' + actions + '</div></div>';
      }

      // auto: use two rows only when report-style filters are on
      var useRows = cfg.layout === 'rows';
      if (cfg.layout === 'auto') {
        useRows = !!(cfg.show.period || cfg.show.source || cfg.show.dateRange || cfg.show.staff);
      }
      if (cfg.layout === 'single') useRows = false;

      var chips = cfg.show.chips
        ? '<div class="sfb-row" data-sfb="chips-row" style="display:none;"></div>'
        : '';

      if (useRows) {
        // Reports: Row1 Period|Status|Source|Payment — Row2 Staff|Date|Search|Clear|Actions
        var row1 = periodG + statusG + sourceG + paymentG;
        var row2 = staffG + dateG + searchG + clearG + actionsG;
        return '<div class="sfb-row sfb-row-1">' + row1 + '</div>' +
          (row2 ? '<div class="sfb-row sfb-row-2">' + row2 + '</div>' : '') +
          chips;
      }

      // Sales / compact: one row, left filters + right actions
      var main = periodG + statusG + sourceG + paymentG + staffG + dateG + searchG + clearG;
      return '<div class="sfb-row sfb-row-single">' +
        '<div class="sfb-single-left">' + main + '</div>' +
        (actionsG ? '<div class="sfb-single-right">' + actionsG + '</div>' : '') +
        '</div>' + chips;
    }

    function bind() {
      if (!root) return;

      root.querySelectorAll('.sfb-pill.period').forEach(function (p) {
        p.addEventListener('click', function () {
          state.period = p.dataset.value;
          setPeriodPill(state.period);
          applyPeriodToDates(state.period);
          emit();
        });
      });

      root.querySelectorAll('.sfb-pill.status').forEach(function (p) {
        p.addEventListener('click', function () {
          state.status = p.dataset.value || '';
          setStatusPill(state.status);
          emit();
        });
      });

      root.querySelectorAll('.sfb-pill.source').forEach(function (p) {
        p.addEventListener('click', function () {
          state.source = p.dataset.value || '';
          setSourcePill(state.source);
          emit();
        });
      });

      const paySel = root.querySelector('[data-sfb="payment"]');
      if (paySel) {
        paySel.addEventListener('change', function () {
          state.payment = paySel.value;
          emit();
        });
      }

      const staffSel = root.querySelector('[data-sfb="staff"]');
      if (staffSel) {
        staffSel.addEventListener('change', function () {
          state.staff = staffSel.value;
          emit();
        });
      }

      const searchInp = root.querySelector('[data-sfb="search"]');
      if (searchInp) {
        searchInp.addEventListener('input', function () {
          state.search = searchInp.value;
          emit();
        });
      }

      const clearBtn = root.querySelector('[data-sfb="clear"]');
      if (clearBtn) {
        clearBtn.addEventListener('click', function () {
          reset();
        });
      }

      root.querySelectorAll('[data-sfb-action]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (typeof cfg.onAction === 'function') {
            cfg.onAction(btn.dataset.sfbAction, Object.assign({}, state, { bounds: boundsFromState() }));
          }
        });
      });

      if (cfg.show.dateRange && typeof flatpickr === 'function') {
        const input = root.querySelector('[data-sfb="daterange"]');
        const box = root.querySelector('[data-sfb="daterange-box"]');
        const clearDate = root.querySelector('[data-sfb="daterange-clear"]');

        fp = flatpickr(input, {
          mode: 'range',
          dateFormat: 'd/m/Y',
          onOpen: function () { box.classList.add('open'); },
          onClose: function () { box.classList.remove('open'); },
          onReady: function (selectedDates, dateStr, instance) {
            if (instance.calendarContainer) instance.calendarContainer.classList.add('sfb-fp');
          },
          onChange: function (selectedDates) {
            if (_syncing) return;
            if (selectedDates.length === 2) {
              state.rangeStart = _dateOnly(selectedDates[0]);
              state.rangeEnd = _dateOnly(selectedDates[1]);
              box.classList.add('has-value');
              state.period = 'custom';
              setPeriodPill('__none__');
              root.querySelectorAll('.sfb-pill.period').forEach(function (p) { p.classList.remove('on'); });
            } else if (selectedDates.length === 0) {
              state.rangeStart = null;
              state.rangeEnd = null;
              box.classList.remove('has-value');
              if (state.period === 'custom') {
                state.period = 'all';
                setPeriodPill('all');
              }
            }
            emit();
          },
        });

        box.addEventListener('click', function (e) {
          if (e.target.closest('[data-sfb="daterange-clear"]')) return;
          fp.open();
        });
        clearDate.addEventListener('click', function (e) {
          e.stopPropagation();
          fp.clear();
          state.rangeStart = null;
          state.rangeEnd = null;
          box.classList.remove('has-value');
          state.period = 'all';
          setPeriodPill('all');
          emit();
        });
      }
    }

    function mount(target) {
      let el = target;
      if (typeof target === 'string') el = document.querySelector(target);
      if (!el) throw new Error('[SalesFilterBar] target not found: ' + target);

      root = document.createElement('div');
      root.className = 'sfb-root';
      root.innerHTML = buildHtml();
      el.innerHTML = '';
      el.appendChild(root);
      chipsRow = root.querySelector('[data-sfb="chips-row"]');
      bind();
      applyPeriodToDates(state.period);
      renderChips();
      return api;
    }

    function getState() {
      return Object.assign({}, state, { bounds: boundsFromState() });
    }

    function setState(partial) {
      partial = partial || {};
      if (partial.period != null) {
        state.period = partial.period;
        setPeriodPill(state.period);
        if (partial.period !== 'custom') applyPeriodToDates(state.period);
      }
      if (partial.status != null) {
        state.status = partial.status;
        setStatusPill(state.status);
      }
      if (partial.source != null) {
        state.source = partial.source;
        setSourcePill(state.source);
      }
      if (partial.payment != null) {
        state.payment = partial.payment;
        const sel = root && root.querySelector('[data-sfb="payment"]');
        if (sel) sel.value = state.payment;
      }
      if (partial.staff != null) {
        state.staff = partial.staff;
        const sel = root && root.querySelector('[data-sfb="staff"]');
        if (sel) sel.value = state.staff;
      }
      if (partial.search != null) {
        state.search = partial.search;
        const inp = root && root.querySelector('[data-sfb="search"]');
        if (inp) inp.value = state.search;
      }
      if (partial.rangeStart != null) state.rangeStart = partial.rangeStart;
      if (partial.rangeEnd != null) state.rangeEnd = partial.rangeEnd;
      emit();
    }

    /** Refresh staff dropdown after new sales (options from service, not hardcoded). */
    function setStaffOptions(names) {
      cfg.staffOptions = Array.isArray(names) ? names.slice() : [];
      renderStaffOptions();
      if (state.staff && cfg.staffOptions.indexOf(state.staff) === -1) {
        state.staff = '';
        emit();
      }
    }

    function reset() {
      state.period = cfg.defaultPeriod;
      state.status = cfg.defaultStatus;
      state.source = cfg.defaultSource;
      state.payment = cfg.defaultPayment;
      state.staff = cfg.defaultStaff;
      state.search = '';
      state.rangeStart = null;
      state.rangeEnd = null;
      setPeriodPill(state.period);
      setStatusPill(state.status);
      setSourcePill(state.source);
      applyPeriodToDates(state.period);
      const paySel = root && root.querySelector('[data-sfb="payment"]');
      if (paySel) paySel.value = state.payment;
      const staffSel = root && root.querySelector('[data-sfb="staff"]');
      if (staffSel) staffSel.value = state.staff;
      const inp = root && root.querySelector('[data-sfb="search"]');
      if (inp) inp.value = '';
      emit();
    }

    function destroy() {
      if (fp) { try { fp.destroy(); } catch (e) {} fp = null; }
      if (root && root.parentNode) root.parentNode.removeChild(root);
      root = null;
      chipsRow = null;
    }

    const api = {
      getState: getState,
      setState: setState,
      setStaffOptions: setStaffOptions,
      reset: reset,
      destroy: destroy,
      boundsFromState: boundsFromState,
      saleInBounds: function (dateStr, parseStampFn) {
        const b = boundsFromState();
        if (!b.start || !b.end) return true;
        const parse = parseStampFn || function (s) {
          if (!s) return null;
          const parts = s.split(' ');
          const dm = parts[0].split('/').map(function (n) { return parseInt(n, 10); });
          return new Date(2000 + dm[2], dm[1] - 1, dm[0]);
        };
        const dt = parse(dateStr);
        if (!dt) return false;
        const d = _dateOnly(dt);
        return d >= b.start && d <= b.end;
      },
    };

    if (options.target) mount(options.target);
    return api;
  }

  window.SalesFilterBar = { create: create };
})();
