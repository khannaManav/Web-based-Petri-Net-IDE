/**
 * interactions.js — Tools, mouse events, properties panel
 * 7CS997 MSc IT · University of Derby · Manav 100799466
 */
'use strict';
var CLICK_THRESH=5;
var mouseDownPos=null, dragMoved=false;

function setTool(t){
  tool=t; arcFrom=null; closeProps();
  document.querySelectorAll('button[id^="btn-"]').forEach(function(b){b.classList.remove('active');});
  var btn=document.getElementById('btn-'+t); if(btn)btn.classList.add('active');
  document.getElementById('cv').style.cursor=t==='select'?'default':'crosshair';
  hideArcPreview(); render();
}

var cvEl=document.getElementById('cv');

cvEl.addEventListener('click',function(e){
  if(e.target.closest&&e.target.closest('[data-id]'))return;
  if(e.target.dataset&&e.target.dataset.id)return;
  closeProps();
  var pos=_pos(e);
  if(tool==='place'){
    var id='p'+nextPid++;
    places.push({id:id,x:pos.x,y:pos.y,tokens:0,label:id,desc:''});
    initial[id]=0; setStatus('Added '+id); render();
  } else if(tool==='transition'){
    var id='t'+nextTid++;
    transitions.push({id:id,x:pos.x,y:pos.y,label:id});
    setStatus('Added '+id); render();
  }
});

cvEl.addEventListener('mousemove',function(e){
  var pos=_pos(e);
  if(mouseDownPos&&Math.hypot(pos.x-mouseDownPos.x,pos.y-mouseDownPos.y)>CLICK_THRESH) dragMoved=true;
  if(dragging&&tool==='select'){
    var arr=dragging.type==='place'?places:transitions;
    var el=null; arr.forEach(function(x){if(x.id===dragging.id)el=x;});
    if(el){el.x=pos.x-dragOff.x; el.y=pos.y-dragOff.y; render();}
  }
  if(tool==='arc'&&arcFrom){
    var src=null;
    places.concat(transitions).forEach(function(x){if(x.id===arcFrom.id)src=x;});
    if(!src)return;
    var sp=borderPt(src,pos.x,pos.y,arcFrom.type==='place');
    var bp=bezierPath(sp,pos);
    var prev=document.getElementById('arc-preview');
    prev.setAttribute('d',bp.d); prev.style.display='';
  }
});

cvEl.addEventListener('mouseup',function(){dragging=null;mouseDownPos=null;});
cvEl.addEventListener('mouseleave',function(){dragging=null;mouseDownPos=null;});
cvEl.addEventListener('contextmenu',function(e){e.preventDefault();});

function hideArcPreview(){document.getElementById('arc-preview').style.display='none';}

function _pos(e){
  var r=cvEl.getBoundingClientRect();
  return{x:e.clientX-r.left, y:e.clientY-r.top};
}

function onNodeMouseDown(e){
  e.stopPropagation();
  var id=e.currentTarget.dataset.id, type=e.currentTarget.dataset.type;
  mouseDownPos=_pos(e); dragMoved=false;
  if(tool!=='select')return;
  var arr=type==='place'?places:transitions;
  var el=null; arr.forEach(function(x){if(x.id===id)el=x;});
  if(!el)return;
  dragging={id:id,type:type}; dragOff={x:mouseDownPos.x-el.x, y:mouseDownPos.y-el.y};
}

function onNodeClick(e){
  var id=e.currentTarget.dataset.id, type=e.currentTarget.dataset.type;
  e.stopPropagation();
  if(dragMoved){dragMoved=false;return;}

  if(tool==='erase'){
    if(type==='place'){places=places.filter(function(p){return p.id!==id;});delete initial[id];}
    else{transitions=transitions.filter(function(t){return t.id!==id;});}
    arcs=arcs.filter(function(a){return a.from!==id&&a.to!==id;});
    closeProps(); render(); setStatus('Deleted '+id); return;
  }

  if(tool==='token'&&type==='place'){
    var p=null; places.forEach(function(x){if(x.id===id)p=x;});
    if(p){p.tokens++; initial[id]=p.tokens;}
    render(); return;
  }

  if(tool==='arc'){
    if(!arcFrom){arcFrom={id:id,type:type};render();return;}
    if(arcFrom.type===type){
      setStatus('Invalid: must connect Place to Transition');
      arcFrom=null; hideArcPreview(); render(); return;
    }
    if(arcFrom.id!==id){
      arcs.push({id:'a'+nextAid++,from:arcFrom.id,to:id,w:1});
      setStatus(arcFrom.id+' to '+id);
    }
    arcFrom=null; hideArcPreview(); render(); return;
  }

  if(tool==='select'){
    if(type==='transition'&&isEnabled(id,places,arcs)){
      firingId=id; fireTransition(id,places,arcs);
      var t=null; transitions.forEach(function(x){if(x.id===id)t=x;});
      setStatus((t?t.label:id)+' fired');
      render(); setTimeout(function(){firingId=null;render();},380); return;
    }
    var arr=type==='place'?places:transitions;
    var el=null; arr.forEach(function(x){if(x.id===id)el=x;});
    if(!el)return;
    selected={kind:type,id:id,el:el}; _openNode(el,type); render();
  }
}

function onNodeRightClick(e){
  e.preventDefault(); e.stopPropagation();
  var id=e.currentTarget.dataset.id, type=e.currentTarget.dataset.type;
  if(tool==='token'&&type==='place'){
    var p=null; places.forEach(function(x){if(x.id===id)p=x;});
    if(p&&p.tokens>0){p.tokens--;initial[id]=p.tokens;}
    render();
    var cur=null; places.forEach(function(x){if(x.id===id)cur=x;});
    setStatus(id+': '+(cur?cur.tokens:0)+' token(s)');
  }
}

function onArcClick(e){
  var id=e.currentTarget.dataset.id;
  if(tool==='erase'){
    arcs=arcs.filter(function(a){return a.id!==id;});
    closeProps(); render(); setStatus('Arc deleted'); return;
  }
  if(tool==='select'){
    var a=null; arcs.forEach(function(x){if(x.id===id)a=x;});
    if(!a)return;
    selected={kind:'arc',id:id,el:a}; _openArc(a); render();
  }
}

function _openNode(el,type){
  document.getElementById('props-bar').style.display='flex';
  document.getElementById('props-title').textContent='Editing '+type+': '+el.id;
  document.getElementById('name-row').style.display='flex';
  document.getElementById('desc-row').style.display='flex';
  document.getElementById('tokens-row').style.display=type==='place'?'flex':'none';
  document.getElementById('weight-row').style.display='none';
  document.getElementById('name-input').value=el.label||el.id;
  document.getElementById('desc-input').value=el.desc||'';
  if(type==='place') document.getElementById('tokens-input').value=el.tokens;
  document.getElementById('name-input').focus();
}

function _openArc(a){
  document.getElementById('props-bar').style.display='flex';
  document.getElementById('props-title').textContent='Arc: '+a.from+' to '+a.to;
  document.getElementById('name-row').style.display='none';
  document.getElementById('desc-row').style.display='none';
  document.getElementById('tokens-row').style.display='none';
  document.getElementById('weight-row').style.display='flex';
  document.getElementById('weight-input').value=a.w==null?1:a.w;
  document.getElementById('weight-input').focus();
}

function adjustToken(delta){
  var inp=document.getElementById('tokens-input');
  inp.value=Math.max(0,(parseInt(inp.value||'0',10)+delta));
}

function applyProps(){
  if(!selected)return;
  if(selected.kind==='arc'){
    var v=parseInt(document.getElementById('weight-input').value,10);
    selected.el.w=isNaN(v)?1:Math.max(0,Math.min(99,v));
  }else{
    var lv=document.getElementById('name-input').value.trim();
    if(lv)selected.el.label=lv;
    selected.el.desc=document.getElementById('desc-input').value.trim();
    if(selected.kind==='place'){
      var tv=parseInt(document.getElementById('tokens-input').value,10);
      if(!isNaN(tv)&&tv>=0){selected.el.tokens=tv;initial[selected.id]=tv;}
    }
  }
  closeProps(); render();
}

function closeProps(){document.getElementById('props-bar').style.display='none';selected=null;}

document.addEventListener('keydown',function(e){
  if(e.target.tagName==='INPUT')return;
  var m={s:'select',p:'place',t:'transition',a:'arc',k:'token',e:'erase'};
  if(m[e.key.toLowerCase()]){setTool(m[e.key.toLowerCase()]);return;}
  if(e.key===' '){e.preventDefault();stepOnce();return;}
  if(e.key==='r'||e.key==='R'){resetMarking();return;}
  if(e.key==='Escape'){setTool('select');return;}
  if((e.key==='Delete'||e.key==='Backspace')&&selected){
    var id=selected.id, k=selected.kind;
    if(k==='arc') arcs=arcs.filter(function(a){return a.id!==id;});
    else if(k==='place'){
      places=places.filter(function(p){return p.id!==id;});
      arcs=arcs.filter(function(a){return a.from!==id&&a.to!==id;});
      delete initial[id];
    }else{
      transitions=transitions.filter(function(t){return t.id!==id;});
      arcs=arcs.filter(function(a){return a.from!==id&&a.to!==id;});
    }
    closeProps(); render(); setStatus('Deleted');
  }
});

document.getElementById('speed-slider').addEventListener('input',function(){
  if(autoInterval){toggleAuto();toggleAuto();}
});
