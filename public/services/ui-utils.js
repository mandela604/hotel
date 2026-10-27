/**
 * services/ui-utils.js — Shared spinner + toast utility
 *
 * UIUtils.btnStart(btn)          disable button, show spinner
 * UIUtils.btnStop(btn)           restore button, re-enable
 * UIUtils.toast(msg, type)       type: 'success' | 'error' | 'info'
 *
 * Load once per page:
 *   <script src="/services/ui-utils.js"></script>
 * or relatively:
 *   <script src="../services/ui-utils.js"></script>
 */
(function (global) {
  'use strict';

  /* ── Inject CSS once ─────────────────────────────────── */
  var CSS_ID = 'ui-utils-css';
  function injectCss() {
    if (document.getElementById(CSS_ID)) return;
    var s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = [
      /* spinner keyframe */
      '@keyframes _uuSpin{to{transform:rotate(360deg)}}',
      '._uu-spin{display:inline-block;width:13px;height:13px;border:2px solid rgba(255,255,255,0.4);border-top-color:#fff;border-radius:50%;animation:_uuSpin .7s linear infinite;vertical-align:middle;flex-shrink:0;}',
      /* for buttons on light backgrounds */
      '._uu-spin-dark{border-color:rgba(0,0,0,0.15);border-top-color:#1c2440;}',

      /* toast container */
      '#_uu-toast-wrap{position:fixed;bottom:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:calc(100vw - 40px);}',
      '@media(max-width:480px){#_uu-toast-wrap{left:14px;right:14px;bottom:14px;}}',

      /* single toast */
      '._uu-toast{pointer-events:auto;display:flex;align-items:center;gap:9px;padding:11px 16px;border-radius:10px;',
        'background:#ffffff;border:1px solid #eef0f6;',
        'box-shadow:0 8px 28px rgba(15,34,55,0.18);',
        'font-family:"Segoe UI",-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif;',
        'font-size:13px;font-weight:600;color:#1c2440;',
        'animation:_uuSlideIn .25s ease both;}',
      '@keyframes _uuSlideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}',
      '@keyframes _uuFadeOut{to{opacity:0;transform:translateY(6px)}}',
      '._uu-toast.leaving{animation:_uuFadeOut .3s ease forwards;}',

      /* type accents */
      '._uu-toast.success{border-left:3px solid #12b76a;}',
      '._uu-toast.error  {border-left:3px solid #f04438;}',
      '._uu-toast.info   {border-left:3px solid #2f6fed;}',

      /* icons */
      '._uu-toast-icon{font-size:14px;flex-shrink:0;}',
      '._uu-toast.success ._uu-toast-icon{color:#12b76a;}',
      '._uu-toast.error   ._uu-toast-icon{color:#f04438;}',
      '._uu-toast.info    ._uu-toast-icon{color:#2f6fed;}',
      '._uu-toast-msg{flex:1;line-height:1.4;}',
      '._uu-toast-close{background:none;border:none;cursor:pointer;color:#9aa1b3;font-size:13px;padding:0;line-height:1;margin-left:4px;flex-shrink:0;}',
      '._uu-toast-close:hover{color:#1c2440;}',
    ].join('');
    document.head.appendChild(s);
  }

  /* ── Toast ───────────────────────────────────────────── */
  var _wrap = null;
  function getWrap() {
    if (_wrap && _wrap.parentNode) return _wrap;
    _wrap = document.getElementById('_uu-toast-wrap');
    if (!_wrap) {
      _wrap = document.createElement('div');
      _wrap.id = '_uu-toast-wrap';
      document.body.appendChild(_wrap);
    }
    return _wrap;
  }

  var ICONS = {
    success: 'fa-circle-check',
    error:   'fa-circle-xmark',
    info:    'fa-circle-info',
  };

  /**
   * Show a toast notification.
   * @param {string} msg
   * @param {'success'|'error'|'info'} type  default 'success'
   * @param {number} duration  ms before auto-dismiss, default 3500
   */
  function toast(msg, type, duration) {
    injectCss();
    type = type || 'success';
    duration = typeof duration === 'number' ? duration : 3500;
    var wrap = getWrap();

    var t = document.createElement('div');
    t.className = '_uu-toast ' + type;
    var iconCls = ICONS[type] || ICONS.info;
    t.innerHTML =
      '<i class="fa-solid ' + iconCls + ' _uu-toast-icon"></i>' +
      '<span class="_uu-toast-msg">' + _esc(msg) + '</span>' +
      '<button class="_uu-toast-close" aria-label="Dismiss"><i class="fa-solid fa-xmark"></i></button>';

    t.querySelector('._uu-toast-close').addEventListener('click', function () { dismiss(t); });
    wrap.appendChild(t);

    var timer = setTimeout(function () { dismiss(t); }, duration);
    t._uuTimer = timer;

    // Cap stack at 5
    var all = wrap.querySelectorAll('._uu-toast');
    if (all.length > 5) dismiss(all[0]);

    return t;
  }

  function dismiss(t) {
    if (!t || !t.parentNode) return;
    clearTimeout(t._uuTimer);
    t.classList.add('leaving');
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320);
  }

  /* ── Button spinner ──────────────────────────────────── */
  /**
   * Put a button into loading state.
   * @param {HTMLElement|string} btn  element or id string
   * @param {boolean} dark  use dark spinner (for light-bg buttons), default false
   */
  function btnStart(btn, dark) {
    injectCss();
    if (typeof btn === 'string') btn = document.getElementById(btn);
    if (!btn) return;
    if (btn._uuLoading) return; // already loading
    btn._uuLoading = true;
    btn._uuOrig = btn.innerHTML;
    btn._uuOrigDisabled = btn.disabled;
    var spinCls = '_uu-spin' + (dark ? ' _uu-spin-dark' : '');
    btn.innerHTML = '<span class="' + spinCls + '"></span>';
    btn.disabled = true;
    btn.style.opacity = '0.8';
  }

  /**
   * Restore a button from loading state.
   * @param {HTMLElement|string} btn
   */
  function btnStop(btn) {
    if (typeof btn === 'string') btn = document.getElementById(btn);
    if (!btn) return;
    btn._uuLoading = false;
    if (btn._uuOrig !== undefined) btn.innerHTML = btn._uuOrig;
    btn.disabled = !!btn._uuOrigDisabled;
    btn.style.opacity = '';
  }

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  global.UIUtils = { toast: toast, btnStart: btnStart, btnStop: btnStop };

})(window);
