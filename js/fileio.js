/**
 * fileio.js — JSON save/load, NDR export/import, Server API
 * NDR parser handles curved arcs, labels, inhibitors, t->t arcs
 * 7CS997 MSc IT · University of Derby · Manav 100799466
 */
'use strict';
var SERVER='http://localhost:3001/api';

/* ── JSON Save ── */
function saveNetJSON(){
  var d={
    meta:{v:1,date:new Date().toISOString()},
    places:places.map(function(p){ return {id:p.id,label:p.label,desc:p.desc||'',tokens:p.tokens,x:Math.round(p.x),y:Math.round(p.y)}; }),
    transitions:transitions.map(function(t){ return {id:t.id,label:t.label,x:Math.round(t.x),y:Math.round(t.y)}; }),
    arcs:arcs.map(function(a){ return {id:a.id,from:a.from,to:a.to,weight:a.w==null?1:a.w}; })
  };
  _dl('petrinet.json',JSON.stringify(d,null,2));
  setStatus('Saved petrinet.json');
}

/* ── JSON Load ── */
function loadNetFile(evt){
  var f=evt.target.files[0]; if(!f)return;
  var r=new FileReader();
  r.onload=function(e){
    try{ _apply(JSON.parse(e.target.result)); setStatus('Loaded '+f.name); }
    catch(err){ setStatus('Error: invalid JSON'); }
  };
  r.readAsText(f);
  evt.target.value='';
}

/* ── NDR Export ── */
function exportNDR(){
  var L=[];
  places.forEach(function(p){
    var ln='p '+p.x.toFixed(1)+' '+p.y.toFixed(1)+' '+p.id+' '+p.tokens+' n';
    if(p.label&&p.label!==p.id) ln+=' '+(/\s/.test(p.label)?'{'+p.label+'}':p.label)+' n';
    L.push(ln);
  });
  transitions.forEach(function(t){
    var ln='t '+t.x.toFixed(1)+' '+t.y.toFixed(1)+' '+t.id+' 0 w n';
    if(t.label&&t.label!==t.id) ln+=' {'+t.label+'} n';
    L.push(ln);
  });
  arcs.forEach(function(a){
    var w=a.w==null?1:a.w;
    L.push('e '+a.from+' '+a.to+' '+(w===0?'?-1':w)+' n');
  });
  L.push('h PetriNetIDE');
  _dl('petrinet.ndr',L.join('\n'));
  setStatus('Exported petrinet.ndr');
}

/* ── NDR Import ── */
function importNDRFile(evt){
  var f=evt.target.files[0]; if(!f)return;
  var r=new FileReader();
  r.onload=function(e){
    try{
      var res=_ndr(e.target.result);
      if(!res.places.length&&!res.transitions.length){ setStatus('No elements found in file'); return; }
      places=res.places; transitions=res.transitions; arcs=res.arcs;
      initial={}; places.forEach(function(p){ initial[p.id]=p.tokens; });
      nextPid=places.length; nextTid=transitions.length; nextAid=arcs.length;
      if(autoInterval)toggleAuto();
      closeProps(); arcFrom=null;
      render();
      setStatus('Imported '+f.name+': '+places.length+'P '+transitions.length+'T '+arcs.length+'A');
    }catch(err){
      setStatus('NDR error: '+err.message);
      console.error('NDR import error:',err);
    }
  };
  r.readAsText(f,'utf-8');
  evt.target.value='';
}

/* ──────────────────────────────────────────────────────────────────
   NDR PARSER
   Handles:
   1. Simple arc:  e from to weight anchor
   2. Curved arc:  e from f1 f2 to f3 f4 weight anchor
   3. Place label: p x y name marking anchor label anchor
   4. Trans label: t x y name [...] {label} anchor
   5. t->t arcs imported without bipartite check
   ────────────────────────────────────────────────────────────────── */
function _ndr(text){
  var pl=[],tr=[],ar=[]; var aid=0;
  var lines=text.split(/\r?\n/);
  for(var i=0;i<lines.length;i++){
    var line=lines[i].trim();
    if(!line||line[0]==='#') continue;
    var tok=_tok(line);
    if(!tok.length) continue;
    var type=tok[0];

    if(type==='p'&&tok.length>=5){
      var pn=_nm(tok[3]);
      var marking=parseInt(tok[4],10)||0;
      var px=Math.max(40,parseFloat(tok[1])||100);
      var py=Math.max(40,parseFloat(tok[2])||100);
      // tok[5]=anchor, tok[6]=label, tok[7]=label_anchor
      var plabel=pn.id, pdesc='';
      if(tok.length>=7){
        var r6=tok[6];
        if(r6.startsWith('{')&&r6.endsWith('}')){ plabel=r6.slice(1,-1).trim(); }
        else { plabel=r6; }
        if(plabel&&plabel!==pn.id) pdesc=plabel;
      }
      pl.push({id:pn.id,label:plabel,desc:pdesc,tokens:marking,x:px,y:py});
    }

    else if(type==='t'&&tok.length>=4){
      var tn=_nm(tok[3]);
      var tx=Math.max(40,parseFloat(tok[1])||200);
      var ty=Math.max(40,parseFloat(tok[2])||100);
      var tlabel=tn.id;
      for(var j=4;j<tok.length;j++){
        if(tok[j].startsWith('{')&&tok[j].endsWith('}')){
          tlabel=tok[j].slice(1,-1).trim(); break;
        }
      }
      tr.push({id:tn.id,label:tlabel,x:tx,y:ty});
    }

    else if(type==='e'&&tok.length>=4){
      var fromR,toR,wStr;
      // If tok[2] is a float -> curved arc format
      if(_flt(tok[2])){
        fromR=tok[1]; toR=tok[4]; wStr=tok[7]||'1';
      } else {
        fromR=tok[1]; toR=tok[2]; wStr=tok[3]||'1';
      }
      if(!fromR||!toR) continue;
      var from=_nm(fromR).id, to=_nm(toR).id;
      var w=wStr.startsWith('?-')?0:(parseInt(wStr,10)||1);
      ar.push({id:'a'+(aid++),from:from,to:to,w:w});
    }
    // h = net name, skip
  }
  return{places:pl,transitions:tr,arcs:ar};
}

function _tok(line){
  var tok=[]; var i=0;
  while(i<line.length){
    while(i<line.length&&/\s/.test(line[i]))i++;
    if(i>=line.length)break;
    if(line[i]==='{'){
      var d=1,j=i+1;
      while(j<line.length&&d>0){ if(line[j]==='{')d++; if(line[j]==='}')d--; j++; }
      tok.push(line.slice(i,j)); i=j;
    }else{
      var k=i; while(k<line.length&&!/\s/.test(line[k]))k++;
      tok.push(line.slice(i,k)); i=k;
    }
  }
  return tok;
}

function _nm(raw){
  if(!raw)return{id:'x',label:'x'};
  if(raw.startsWith('{')&&raw.endsWith('}')){
    var inner=raw.slice(1,-1), ci=inner.indexOf(',');
    if(ci>=0){
      var lbl=inner.slice(0,ci).trim();
      var nid=inner.slice(ci+1).trim().replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'_');
      return{id:nid||lbl.replace(/[^a-zA-Z0-9_]/g,'_'),label:lbl};
    }
    var c=inner.trim().replace(/[^a-zA-Z0-9_]/g,'_');
    return{id:c,label:inner.trim()};
  }
  return{id:raw,label:raw};
}

function _flt(s){
  if(!s)return false;
  return !isNaN(parseFloat(s))&&isFinite(+s)&&/^-?[\d.]/.test(s);
}

/* ── Server Save ── */
function saveToServer(){
  var name=prompt('Net name:','my-net'); if(!name||!name.trim())return;
  _ok(function(online){
    if(!online){setStatus('Server offline — use Save .json');return;}
    var payload={name:name.trim(),net:{
      places:places.map(function(p){return{id:p.id,label:p.label,desc:p.desc||'',tokens:p.tokens,x:Math.round(p.x),y:Math.round(p.y)};}),
      transitions:transitions.map(function(t){return{id:t.id,label:t.label,x:Math.round(t.x),y:Math.round(t.y)};}),
      arcs:arcs.map(function(a){return{id:a.id,from:a.from,to:a.to,weight:a.w==null?1:a.w};})
    }};
    fetch(SERVER+'/nets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
      .then(function(r){return r.json().then(function(d){return{ok:r.ok,d:d};});})
      .then(function(x){setStatus(x.ok?'Saved "'+x.d.name+'" to server':'Server error: '+x.d.error);})
      .catch(function(e){setStatus('Network error: '+e.message);});
  });
}

/* ── Server Load ── */
function loadFromServer(){
  _ok(function(online){
    if(!online){setStatus('Server offline — use Load .json');return;}
    fetch(SERVER+'/nets').then(function(r){return r.json();}).then(function(ld){
      if(!ld.nets||!ld.nets.length){setStatus('No nets on server');return;}
      var name=prompt('Saved nets:\n\n'+ld.nets.join('\n')+'\n\nEnter name:'); if(!name||!name.trim())return;
      fetch(SERVER+'/nets/'+encodeURIComponent(name.trim())).then(function(r){
        if(!r.ok){setStatus('Not found: '+name.trim());return;}
        r.json().then(function(data){ _apply(data.net); setStatus('Loaded "'+name.trim()+'"'); });
      });
    }).catch(function(e){setStatus('Network error: '+e.message);});
  });
}

function _ok(cb){
  fetch(SERVER+'/health').then(function(r){cb(r.ok);}).catch(function(){cb(false);});
}

/* ── Helpers ── */
function _apply(d){
  places=(d.places||[]).map(function(p){return{id:p.id,label:p.label||p.id,desc:p.desc||'',tokens:p.tokens||0,x:p.x,y:p.y};});
  transitions=(d.transitions||[]).map(function(t){return{id:t.id,label:t.label||t.id,x:t.x,y:t.y};});
  arcs=(d.arcs||[]).map(function(a){return{id:a.id,from:a.from,to:a.to,w:a.weight==null?1:a.weight};});
  initial={}; places.forEach(function(p){initial[p.id]=p.tokens;});
  nextPid=_mx(places,'p')+1; nextTid=_mx(transitions,'t')+1; nextAid=_mx(arcs,'a')+1;
  if(autoInterval)toggleAuto(); closeProps(); arcFrom=null; render();
}

function _mx(arr,pfx){
  var m=-1;
  arr.forEach(function(el){var n=parseInt(String(el.id).slice(pfx.length),10);if(!isNaN(n)&&n>m)m=n;});
  return m<0?0:m;
}

function _dl(name,text){
  var b=new Blob([text],{type:'text/plain'}), u=URL.createObjectURL(b);
  var a=document.createElement('a'); a.href=u; a.download=name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u);
}
