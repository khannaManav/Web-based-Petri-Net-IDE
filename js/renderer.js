/**
 * renderer.js — SVG Rendering
 * PR=22, TW=14, TH=28 (smaller icons)
 * 7CS997 MSc IT · University of Derby · Manav 100799466
 */
'use strict';

var PR=22, TW=14, TH=28, CURVE=14, TC='#1F3864';

function borderPt(el, tx, ty, isPlace) {
  var dx=tx-el.x, dy=ty-el.y, ang=Math.atan2(dy,dx);
  if (isPlace) return { x:el.x+PR*Math.cos(ang), y:el.y+PR*Math.sin(ang) };
  var ca=Math.abs(Math.cos(ang)), sa=Math.abs(Math.sin(ang));
  var s = TW*sa<=TH*ca ? TW/ca : TH/sa;
  return { x:el.x+s*Math.cos(ang), y:el.y+s*Math.sin(ang) };
}

function bezierPath(s, e) {
  var dx=e.x-s.x, dy=e.y-s.y, len=Math.hypot(dx,dy)||1;
  var nx=-dy/len, ny=dx/len;
  var mx=(s.x+e.x)/2, my=(s.y+e.y)/2;
  var cx=mx+nx*CURVE, cy=my+ny*CURVE;
  return {
    d:'M '+s.x.toFixed(1)+','+s.y.toFixed(1)+' Q '+cx.toFixed(1)+','+cy.toFixed(1)+' '+e.x.toFixed(1)+','+e.y.toFixed(1),
    mid:{ x:.25*s.x+.5*cx+.25*e.x, y:.25*s.y+.5*cy+.25*e.y }
  };
}

function tokenDots(x, y, n) {
  if (n<=0) return '';
  var pe='pointer-events="none"';
  if (n===1) return '<circle cx="'+x+'" cy="'+y+'" r="4.5" fill="'+TC+'" '+pe+'/>';
  if (n===2) return '<circle cx="'+(x-7)+'" cy="'+y+'" r="3.5" fill="'+TC+'" '+pe+'/>'+
                    '<circle cx="'+(x+7)+'" cy="'+y+'" r="3.5" fill="'+TC+'" '+pe+'/>';
  if (n===3) return '<circle cx="'+x+'" cy="'+(y-6)+'" r="3.5" fill="'+TC+'" '+pe+'/>'+
                    '<circle cx="'+(x-6)+'" cy="'+(y+4)+'" r="3.5" fill="'+TC+'" '+pe+'/>'+
                    '<circle cx="'+(x+6)+'" cy="'+(y+4)+'" r="3.5" fill="'+TC+'" '+pe+'/>';
  return '<text x="'+x+'" y="'+(y+4)+'" text-anchor="middle" font-size="12" font-weight="700" fill="'+TC+'" '+pe+'>'+n+'</text>';
}

function render() {
  renderArcs();
  renderNodes();
  updateMarkingBar();
  updateCounts();
}

function renderArcs() {
  var all=[].concat(places, transitions);
  var h='';
  arcs.forEach(function(a) {
    var fe=null, te=null;
    all.forEach(function(e){ if(e.id===a.from) fe=e; if(e.id===a.to) te=e; });
    if(!fe||!te) return;
    var fp=places.some(function(p){ return p.id===a.from; });
    var tp=places.some(function(p){ return p.id===a.to; });
    var s=borderPt(fe,te.x,te.y,fp);
    var e2=borderPt(te,fe.x,fe.y,tp);
    var bp=bezierPath(s,e2);
    var d=bp.d, mid=bp.mid;
    var isSel=selected&&selected.kind==='arc'&&selected.id===a.id;
    var isInh=(a.w===0);
    var toEn=!tp && isEnabled(a.to,places,arcs);
    var col='#666';
    var mk=isInh?'url(#inh)':'url(#arr)';
    if(isSel){ col='#2E75B6'; mk=isInh?'url(#inh-sel)':'url(#arr-sel)'; }
    else if(toEn){ col='#27ae60'; mk=isInh?'url(#inh-en)':'url(#arr-en)'; }
    var sw=isSel?3:toEn?2.5:1.8;
    h+='<path data-id="'+a.id+'" data-type="arc" d="'+d+'" fill="none" stroke="'+col+'" stroke-width="'+sw+'" marker-end="'+mk+'" style="cursor:pointer"/>';
    var w=a.w==null?1:a.w;
    if(w!==1&&w!==0){
      h+='<rect x="'+(mid.x-8)+'" y="'+(mid.y-9)+'" width="16" height="14" rx="3" fill="white" stroke="#bbb" stroke-width=".7" pointer-events="none"/>';
      h+='<text x="'+mid.x+'" y="'+(mid.y+3)+'" text-anchor="middle" font-size="10.5" font-weight="600" fill="#1F3864" pointer-events="none">'+w+'</text>';
    }
  });
  var L=document.getElementById('arcs-layer');
  L.innerHTML=h;
  L.querySelectorAll('[data-id]').forEach(function(el){ el.addEventListener('click',onArcClick); });
}

function renderNodes() {
  var h='';
  var F='font-family="Segoe UI,Arial,sans-serif"';

  places.forEach(function(p) {
    var arcS=arcFrom&&arcFrom.id===p.id;
    var sel=selected&&selected.kind==='place'&&selected.id===p.id;
    var str=arcS?'#e67e22':sel?'#2E75B6':'#1F3864';
    var sw=(arcS||sel)?3.5:2;
    var cur=tool==='select'?'grab':'pointer';
    var main=(p.label&&p.label!==p.id)?p.label:p.id;
    var sub=(p.label&&p.label!==p.id)?p.id:'';
    h+='<g data-id="'+p.id+'" data-type="place" style="cursor:'+cur+'">';
    h+='<circle cx="'+p.x+'" cy="'+p.y+'" r="'+PR+'" fill="white" stroke="'+str+'" stroke-width="'+sw+'"/>';
    h+=tokenDots(p.x,p.y,p.tokens);
    h+='<text x="'+p.x+'" y="'+(p.y-PR-6)+'" text-anchor="middle" font-size="11" font-weight="600" fill="#1F3864" '+F+' pointer-events="none">'+main+'</text>';
    if(sub) h+='<text x="'+p.x+'" y="'+(p.y+PR+13)+'" text-anchor="middle" font-size="9" fill="#aaa" '+F+' pointer-events="none">'+sub+'</text>';
    h+='</g>';
  });

  transitions.forEach(function(t) {
    var arcS=arcFrom&&arcFrom.id===t.id;
    var sel=selected&&selected.kind==='transition'&&selected.id===t.id;
    var en=isEnabled(t.id,places,arcs);
    var fir=firingId===t.id;
    var fill=fir?'#f39c12':en?'#27ae60':'#1F3864';
    var str=arcS?'#e67e22':sel?'#2E75B6':fill;
    var sw=(arcS||sel)?3.5:2;
    var cur=tool==='select'?(en?'pointer':'grab'):'pointer';
    var main=(t.label&&t.label!==t.id)?t.label:t.id;
    var sub=(t.label&&t.label!==t.id)?t.id:'';
    var mainY=sub?t.y+2:t.y+4;
    h+='<g data-id="'+t.id+'" data-type="transition" style="cursor:'+cur+'">';
    h+='<rect x="'+(t.x-TW)+'" y="'+(t.y-TH)+'" width="'+(TW*2)+'" height="'+(TH*2)+'" fill="'+fill+'" stroke="'+str+'" stroke-width="'+sw+'" rx="2"/>';
    h+='<text x="'+t.x+'" y="'+mainY+'" text-anchor="middle" font-size="10" font-weight="600" fill="white" '+F+' pointer-events="none">'+main+'</text>';
    if(sub) h+='<text x="'+t.x+'" y="'+(t.y+14)+'" text-anchor="middle" font-size="8" fill="rgba(255,255,255,.6)" '+F+' pointer-events="none">'+sub+'</text>';
    h+='</g>';
  });

  var L=document.getElementById('nodes-layer');
  L.innerHTML=h;
  L.querySelectorAll('[data-id]').forEach(function(g) {
    g.addEventListener('mousedown',onNodeMouseDown);
    g.addEventListener('click',onNodeClick);
    g.addEventListener('contextmenu',onNodeRightClick);
  });
}

function updateMarkingBar() {
  document.getElementById('marking-display').textContent = places.length
    ? '{ '+places.map(function(p){ return (p.label&&p.label!==p.id?p.label:p.id)+':'+p.tokens; }).join(',  ')+' }' : '{ }';
}

function updateCounts() {
  document.getElementById('cnt-p').textContent=places.length;
  document.getElementById('cnt-t').textContent=transitions.length;
  document.getElementById('cnt-a').textContent=arcs.length;
  var dl=transitions.length>0&&isDeadlock(transitions,places,arcs);
  document.getElementById('deadlock-badge').style.display=dl?'inline':'none';
}
