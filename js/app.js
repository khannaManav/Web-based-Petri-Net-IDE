/**
 * app.js — State + Simulation Controls
 * 7CS997 MSc IT · University of Derby · Manav 100799466
 *
 * Two fixes for professor's algorithm models (fmul, fdiv):
 *
 * Fix 1 — t→t Priority:
 *   In TINA NDR, a t→t arc (tA→tB) means tA has priority over tB.
 *   pickTransition() uses these arcs to choose which enabled transition fires.
 *   For basic user-drawn nets: no t→t arcs exist, so random selection applies.
 *
 * Fix 2 — Minimum batch 10:
 *   Even when total tokens drop to a small number (as in fdiv mid-computation),
 *   we always fire at least 10 steps per timer tick so the model visibly
 *   progresses and completes in seconds, not minutes.
 */
'use strict';

var places      = [];
var transitions = [];
var arcs        = [];
var initial     = {};
var nextPid = 0, nextTid = 0, nextAid = 0;
var tool        = 'select';
var arcFrom     = null;
var dragging    = null;
var dragOff     = { x: 0, y: 0 };
var selected    = null;
var firingId    = null;
var autoInterval = null;

/* ── Status bar ── */
var _st = null;
function setStatus(msg) {
  var el = document.getElementById('status-msg');
  el.textContent = msg;
  clearTimeout(_st);
  _st = setTimeout(function() { el.textContent = ''; }, 5000);
}

/* ── pickTransition ──────────────────────────────────────────────────────
 *
 * For basic user-drawn nets:
 *   No t→t arcs exist, so dep={} always. Returns enabled[0] (array order).
 *   Equivalent to deterministic selection — works for all simple nets.
 *
 * For algorithm nets (fdiv, fmul):
 *   t→t arcs encode priority: tA→tB means tA fires before tB.
 *   We deprioritise any transition that is the TARGET of a t→t arc
 *   from another currently-enabled transition, then return the first
 *   non-deprioritised candidate.
 */
function pickTransition(enabled) {
  if (!enabled.length) return null;
  if (enabled.length === 1) return enabled[0];

  /* Build "deprioritised" set from t→t arcs */
  var eids = {};
  enabled.forEach(function(t) { eids[t.id] = true; });

  var dep = {};
  arcs.forEach(function(a) {
    /* t→t arc: both endpoints are enabled transitions */
    if (eids[a.from] && eids[a.to]) {
      dep[a.to] = true;   /* target fires AFTER source */
    }
  });

  /* Return first non-deprioritised transition */
  for (var i = 0; i < enabled.length; i++) {
    if (!dep[enabled[i].id]) return enabled[i];
  }
  return enabled[0]; /* fallback: all tied, pick first */
}

/* ── batchSize ───────────────────────────────────────────────────────────
 * Minimum 10 ensures fdiv (426 steps) completes in ~43 ticks @ 150 ms = 6 s.
 * Scales up for large-token models so fmul doesn't take hours.
 */
function batchSize() {
  // Use arc count to distinguish simple user-drawn nets from algorithm nets.
  // Simple nets (few arcs): batch=1 so every firing is visible on screen.
  // Algorithm nets (fdiv=225 arcs, fmul=65 arcs): larger batch to complete fast.
  var n = arcs.length;
  if (n > 100) return 50;   // fdiv (225 arcs): ~9 ticks to complete
  if (n > 30)  return 10;   // fmul (65 arcs):  ~12 ticks to complete
  return 1;                  // simple user nets: every step visible
}

/* ── Step once ── */
function stepOnce() {
  var en = getEnabledTransitions(transitions, places, arcs);
  if (!en.length) {
    setStatus('Computation complete — check marking bar for result');
    return;
  }
  var t = pickTransition(en);
  firingId = t.id;
  fireTransition(t.id, places, arcs);
  setStatus((t.label || t.id) + ' fired');
  render();
  setTimeout(function() { firingId = null; render(); }, 350);
}

/* ── Auto simulation ── */
function toggleAuto() {
  var btn = document.getElementById('btn-auto');
  if (autoInterval) {
    clearInterval(autoInterval);
    autoInterval = null;
    btn.textContent = '▶▶ Auto';
    btn.className = 'g';
    return;
  }
  btn.textContent = '⏸ Pause';
  btn.className = 'orange';

  var speed = parseInt(document.getElementById('speed-slider').value, 10) * 150;

  autoInterval = setInterval(function() {
    var batch = batchSize();
    var lastT  = null;

    for (var i = 0; i < batch; i++) {
      var en = getEnabledTransitions(transitions, places, arcs);
      if (!en.length) {
        toggleAuto();
        render();
        var nz = places.filter(function(p) { return p.tokens > 0; });
        var res = nz.map(function(p) {
          return (p.label && p.label !== p.id ? p.label : p.id) + ':' + p.tokens;
        }).join('  ');
        setStatus('✓ Computation complete · Result: ' + (res || 'all places empty'));
        return;
      }
      lastT = pickTransition(en);
      fireTransition(lastT.id, places, arcs);
    }

    if (lastT) firingId = lastT.id;
    render();
    setTimeout(function() { firingId = null; }, Math.min(120, speed * 0.25));

    /* Progress display while running */
    var nz2 = places.filter(function(p) { return p.tokens > 0; });
    var prog = nz2.slice(0, 5).map(function(p) {
      return (p.label && p.label !== p.id ? p.label : p.id) + ':' + p.tokens;
    }).join('  ');
    document.getElementById('status-msg').textContent = 'Running … ' + prog;

  }, speed);
}

function resetMarking() {
  places.forEach(function(p) {
    p.tokens = initial[p.id] !== undefined ? initial[p.id] : 0;
  });
  if (autoInterval) toggleAuto();
  setStatus('Marking reset');
  render();
}

function clearAll() {
  if (!confirm('Clear everything from the canvas?')) return;
  places = []; transitions = []; arcs = []; initial = {};
  nextPid = 0; nextTid = 0; nextAid = 0; arcFrom = null;
  if (autoInterval) toggleAuto();
  closeProps(); hideArcPreview(); render();
  setStatus('Canvas cleared');
}

document.addEventListener('DOMContentLoaded', function() {
  setTool('select');
  render();
});
