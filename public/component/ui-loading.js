/* ═══════════════════════════════════════════════════════════
   ui-loading.js — Skeleton loaders + button loading states
   Shared across procurement (and any future module).
   Drop-in: include <script src="../component/ui-loading.js"> before page scripts.
   ═══════════════════════════════════════════════════════════ */

(function(global){
'use strict';

/* ─── Inject CSS once ─── */
if (!document.getElementById('uiLoadingCSS')){
  const style = document.createElement('style');
  style.id = 'uiLoadingCSS';
  style.textContent = `
/* ── Skeleton shimmer ── */
@keyframes skShimmer {
  0%   { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
.sk-box {
  background: linear-gradient(90deg, var(--surface2,#f0f2f5) 25%, var(--surface3,#e4e7ec) 37%, var(--surface2,#f0f2f5) 63%);
  background-size: 800px 100%;
  animation: skShimmer 1.4s ease-in-out infinite;
  border-radius: var(--radius-sm, 8px);
}
.sk-text {
  height: 12px;
  border-radius: 6px;
}
.sk-text.lg  { height: 20px; width: 60%; }
.sk-text.md  { height: 14px; width: 45%; }
.sk-text.sm  { height: 10px; width: 30%; }
.sk-circle {
  border-radius: 50%;
}

/* ── KPI skeleton card ── */
.sk-kpi {
  background: var(--surface, #fff);
  border: 1px solid var(--border, #eef0f6);
  border-radius: var(--radius, 14px);
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sk-kpi .sk-top {
  display: flex;
  align-items: center;
  gap: 12px;
}
.sk-kpi .sk-ic {
  width: 38px; height: 38px;
  flex-shrink: 0;
}
.sk-kpi .sk-lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sk-kpi .sk-val {
  height: 28px;
  width: 55%;
  margin-top: 4px;
}

/* ── Table skeleton row ── */
.sk-row {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  gap: 16px;
  border-bottom: 1px solid var(--border, #eef0f6);
}
.sk-row .sk-cell {
  height: 14px;
  border-radius: 6px;
}
.sk-row .sk-cell:first-child { width: 18%; }
.sk-row .sk-cell:nth-child(2) { width: 22%; }
.sk-row .sk-cell:nth-child(3) { width: 12%; }
.sk-row .sk-cell:nth-child(4) { width: 14%; }
.sk-row .sk-cell:nth-child(5) { width: 14%; }
.sk-row .sk-cell:nth-child(6) { width: 10%; }
.sk-row .sk-cell:last-child  { width: 10%; }

/* ── Pipeline skeleton ── */
.sk-pipeline-row {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  gap: 14px;
  border-bottom: 1px solid var(--border, #eef0f6);
}
.sk-pipeline-row .sk-ic { width: 36px; height: 36px; flex-shrink: 0; }
.sk-pipeline-row .sk-lines { flex: 1; display: flex; flex-direction: column; gap: 6px; }

/* ── Button loading ── */
.btn-loading {
  position: relative;
  pointer-events: none;
  opacity: 0.7;
}
.btn-loading .btn-spinner {
  display: inline-block;
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: btnSpin .6s linear infinite;
  vertical-align: middle;
  margin-right: 6px;
}
@keyframes btnSpin { to { transform: rotate(360deg); } }
.btn-loading .btn-label { opacity: 0.6; }

/* dark buttons: white spinner */
.btn.btn-loading .btn-spinner,
button.btn-loading .btn-spinner {
  border-color: rgba(255,255,255,0.3);
  border-top-color: #fff;
}
/* outline / ghost buttons: dark spinner */
.btn-outline.btn-loading .btn-spinner,
.btn-ghost.btn-loading .btn-spinner {
  border-color: rgba(0,0,0,0.15);
  border-top-color: var(--text, #1c2440);
}
  `;
  document.head.appendChild(style);
}

/* ═══════════ Skeleton renderers ═══════════ */

/** Render N skeleton KPI cards into a container */
function skKPIs(count){
  count = count || 4;
  let html = '';
  for (let i = 0; i < count; i++){
    html += `
      <div class="sk-kpi">
        <div class="sk-top">
          <div class="sk-box sk-ic sk-circle"></div>
          <div class="sk-lines">
            <div class="sk-box sk-text sm"></div>
            <div class="sk-box sk-text lg sk-val"></div>
          </div>
        </div>
        <div class="sk-box sk-text sm" style="width:40%;"></div>
      </div>`;
  }
  return html;
}

/** Render N skeleton table rows (8 cells each) */
function skTableRows(rowCount, colCount){
  rowCount = rowCount || 5;
  colCount = colCount || 7;
  let rows = '';
  for (let r = 0; r < rowCount; r++){
    let cells = '';
    for (let c = 0; c < colCount; c++){
      const w = [18,22,12,14,14,10,10][c] || 12;
      cells += `<div class="sk-box sk-cell" style="width:${w}%;"></div>`;
    }
    rows += `<div class="sk-row">${cells}</div>`;
  }
  return rows;
}

/** Render skeleton pipeline rows (icon + two lines + count pill) */
function skPipelineRows(count){
  count = count || 5;
  let html = '';
  for (let i = 0; i < count; i++){
    html += `
      <div class="sk-pipeline-row">
        <div class="sk-box sk-ic sk-circle"></div>
        <div class="sk-lines">
          <div class="sk-box sk-text md" style="width:50%;"></div>
          <div class="sk-box sk-text sm" style="width:30%;"></div>
        </div>
        <div class="sk-box sk-text" style="width:36px;height:24px;border-radius:12px;"></div>
      </div>`;
  }
  return html;
}

/* ═══════════ Button loading helper ═══════════ */

/**
 * Set/clear loading state on a button.
 * @param {HTMLElement} btn
 * @param {boolean} loading
 * @param {string} [label] — optional text to show next to spinner
 */
function setBtnLoading(btn, loading, label){
  if (!btn) return;
  if (loading){
    btn.dataset.origHtml = btn.innerHTML;
    btn.classList.add('btn-loading');
    btn.disabled = true;
    const lbl = label || btn.textContent.trim();
    btn.innerHTML = `<span class="btn-spinner"></span><span class="btn-label">${lbl}</span>`;
  } else {
    btn.classList.remove('btn-loading');
    btn.disabled = false;
    if (btn.dataset.origHtml){
      btn.innerHTML = btn.dataset.origHtml;
      delete btn.dataset.origHtml;
    }
  }
}

/* ═══════════ Expose ═══════════ */
global.LoadingUI = {
  skKPIs,
  skTableRows,
  skPipelineRows,
  setBtnLoading,
};

})(window);
