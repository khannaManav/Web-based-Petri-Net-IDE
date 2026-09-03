/**
 * engine.js — Petri Net Simulation Engine
 * Pure logic. No DOM. No browser dependencies.
 * 7CS997 MSc IT · University of Derby · Manav 100799466
 */
'use strict';

function isEnabled(tid, places, arcs) {
  var ins = arcs.filter(function(a) {
    return a.to === tid && places.find(function(p) { return p.id === a.from; });
  });
  if (!ins.length) return false;
  return ins.every(function(a) {
    var p = places.find(function(x) { return x.id === a.from; });
    if (!p) return false;
    var w = a.w == null ? 1 : a.w;
    return w === 0 ? p.tokens === 0 : p.tokens >= w;
  });
}

function fireTransition(tid, places, arcs) {
  arcs.filter(function(a) { return a.to === tid; }).forEach(function(a) {
    var p = places.find(function(x) { return x.id === a.from; });
    var w = a.w == null ? 1 : a.w;
    if (p && w !== 0) p.tokens -= w;
  });
  arcs.filter(function(a) { return a.from === tid; }).forEach(function(a) {
    var p = places.find(function(x) { return x.id === a.to; });
    var w = a.w == null ? 1 : a.w;
    if (p) p.tokens += w;
  });
}

function getEnabledTransitions(transitions, places, arcs) {
  return transitions.filter(function(t) { return isEnabled(t.id, places, arcs); });
}

function isDeadlock(transitions, places, arcs) {
  return getEnabledTransitions(transitions, places, arcs).length === 0;
}
