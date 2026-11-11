/* Geometry board. Local only, buildless and dependency free. */
(() => {
'use strict';
const G=window.Geometry, $=id=>document.getElementById(id), NS='http://www.w3.org/2000/svg';
const svg=$('plot'), shell=$('plotShell'), STORAGE='bernio.geometry.v1';
const initial=()=>({version:1,nextId:1,points:[],objects:[],defaults:{color:'#355fe0',width:2,dash:'solid',labelVisible:true,fill:true},settings:{showGrid:true,snapGrid:true,snapPoints:true,snapParts:true,showInstruments:true,autoNames:true,gridStep:1,parts:[2]}});
let state=initial(),view={x:0,y:0,scale:44},size={w:900,h:550},tool='select',family='triangle',selected=null,pending={},mouse=null,snapHint=null,drag=null,space=false,editing=null;
let undoStack=[],redoStack=[],lastInstrument=null,intersectionCache=null,frame=0,storageOK=true;
const clone=x=>JSON.parse(JSON.stringify(x)),uid=prefix=>prefix+(state.nextId++),pBy=id=>state.points.find(p=>p.id===id),oBy=id=>state.objects.find(o=>o.id===id);
const toScreen=p=>({x:(p.x-view.x)*view.scale+size.w/2,y:(p.y-view.y)*view.scale+size.h/2});
const fromScreen=p=>({x:(p.x-size.w/2)/view.scale+view.x,y:(p.y-size.h/2)/view.scale+view.y});
const eventPoint=e=>{const r=svg.getBoundingClientRect();return fromScreen({x:e.clientX-r.left,y:e.clientY-r.top});};
const px=n=>n/view.scale,subscript=s=>'_'+String(s).toLowerCase();
function el(tag,attrs={},parent=svg){const node=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))if(v!==undefined&&v!==null)node.setAttribute(k,String(v));if(parent)parent.appendChild(node);return node;}
function status(text){$('status').textContent=text;}
function invalidate(){intersectionCache=null;}
function saveLocal(){try{localStorage.setItem(STORAGE,JSON.stringify({state,view}));storageOK=true;}catch(e){storageOK=false;$('status').textContent='Nákres se nepodařilo automaticky uložit. Použij tlačítko Uložit.';}}
function before(){undoStack.push(JSON.stringify(state));if(undoStack.length>80)undoStack.shift();redoStack=[];}
function changed(){invalidate();saveLocal();refreshUI();render();}
function transact(fn){before();fn();changed();}
function undo(){if(!undoStack.length)return;cancel(false);redoStack.push(JSON.stringify(state));state=JSON.parse(undoStack.pop());selected=null;changed();}
function redo(){if(!redoStack.length)return;cancel(false);undoStack.push(JSON.stringify(state));state=JSON.parse(redoStack.pop());selected=null;changed();}
function point(id,seen=new Set()){
 const p=pBy(id);if(!p)return null;if(!p.dep)return {x:p.x,y:p.y};if(seen.has(id))return null;seen.add(id);
 const d=p.dep;let q=null;
 if(d.kind==='ratio'){const c=curve(d.edge,new Set(seen));if(c&&c.a)q=G.add(c.a,G.mul(G.sub(c.b,c.a),d.t));}
 if(d.kind==='foot'){const c=curve(d.edge,new Set(seen)),a=point(d.from,new Set(seen));if(c&&c.a&&a)q=G.project(a,c.a,c.b);}
 if(d.kind==='intersection'){const a=curve(d.a,new Set(seen)),b=curve(d.b,new Set(seen));if(a&&b){const pts=G.intersections(a,b);q=pts[d.branch||0]||null;}}
 return q&&Number.isFinite(q.x)&&Number.isFinite(q.y)?{x:q.x,y:q.y}:null;
}
function curve(key,seen=new Set()){
 if(!key)return null;const [id,index]=key.split(':'),o=oBy(id);if(!o)return null;let a,b;
 if(o.type==='polygon'){if(index===undefined)return null;const i=Number(index);a=point(o.vertices[i],new Set(seen));b=point(o.vertices[(i+1)%o.vertices.length],new Set(seen));return a&&b?{type:'segment',a,b,key}:null;}
 if(o.type==='circle'||o.type==='arc'){a=point(o.center,new Set(seen));b=point(o.through,new Set(seen));if(!a||!b)return null;return {type:o.type,c:a,r:G.dist(a,b),start:o.start||0,sweep:o.sweep??G.TAU,key};}
 if(o.type==='parallel'||o.type==='perp'){if(seen.has('curve'+id))return null;seen.add('curve'+id);const base=curve(o.base,new Set(seen));a=point(o.through,new Set(seen));if(!a||!base?.a)return null;const v=G.sub(base.b,base.a);b=G.add(a,o.type==='perp'?{x:-v.y,y:v.x}:v);return {type:'line',a,b,key};}
 a=point(o.a,new Set(seen));b=point(o.b,new Set(seen));return a&&b?{type:o.type,a,b,key}:null;
}
function curves(){const all=[];for(const o of state.objects){if(o.type==='polygon'){o.vertices.forEach((_,i)=>{const c=curve(o.id+':'+i);if(c)all.push(c);});}else{const c=curve(o.id);if(c)all.push(c);}}return all;}
function intersections(){if(intersectionCache)return intersectionCache;const all=curves(),out=[];for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){const a=all[i],b=all[j];G.intersections(a,b).forEach((p,k)=>out.push({...p,dep:{kind:'intersection',a:a.key,b:b.key,branch:k},kind:'intersection',hint:'Průsečík'}));}return intersectionCache=out;}
function parts(){const out=[];if(!state.settings.snapParts)return out;for(const c of curves())if(c.type==='segment')for(const n of state.settings.parts)for(let i=1;i<n;i++)out.push({...G.add(c.a,G.mul(G.sub(c.b,c.a),i/n)),dep:{kind:'ratio',edge:c.key,t:i/n},kind:'part',hint:i+'/'+n+' úsečky'});return out;}
function snap(raw,{grid=true,circle=null}={}){
 const tolerance=px(12),candidates=[];
 if(state.settings.snapPoints){for(const p of state.points){const q=point(p.id);if(q)candidates.push({...q,existing:p.id,kind:'point',hint:p.label});}candidates.push(...intersections());}
 candidates.push(...parts());
 let best=null,bestScore=Infinity;
 for(const c of candidates){if(circle&&Math.abs(G.dist(c,circle.c)-circle.r)>1e-6)continue;const d=G.dist(raw,c);const score=d+(c.kind==='point'?0:px(1.3));if(d<tolerance&&score<bestScore){best=c;bestScore=score;}}
 if(best)return best;
 if(grid&&state.settings.snapGrid){const step=state.settings.gridStep,q={x:Math.round(raw.x/step)*step,y:Math.round(raw.y/step)*step,kind:'grid',hint:'Mřížka'};if(!circle||Math.abs(G.dist(q,circle.c)-circle.r)<1e-6)return q;}
 return {x:raw.x,y:raw.y,kind:'free',hint:''};
}
function freshLabel(){const used=new Set(state.points.map(p=>p.label));for(let i=0;i<10000;i++){const name=String.fromCharCode(65+i%26)+(i<26?'':Math.floor(i/26));if(!used.has(name))return name;}return 'P'+state.nextId;}
function addPoint(q,options={}){if(q.existing&&pBy(q.existing))return q.existing;const p={id:uid('p'),x:q.x,y:q.y,label:options.label||freshLabel(),labelOffset:null,labelVisible:state.defaults.labelVisible,style:clone(state.defaults),...(q.dep?{dep:clone(q.dep)}:{}),...options};state.points.push(p);return p.id;}
function addObject(data){const o={id:uid('o'),label:'',labelOffset:{x:10,y:-10},...clone(state.defaults),...data};state.objects.push(o);return o;}
function triangleForEdge(key,vertex=null){
 const selectedCurve=curve(key);if(!selectedCurve?.a)return null;
 const candidates=state.objects.filter(o=>o.type==='polygon'&&o.vertices.length===3);
 for(const o of candidates)for(let index=0;index<3;index++){
  const opposite=(index+2)%3,v=o.vertices[opposite];if(vertex&&v!==vertex)continue;
  const side=curve(o.id+':'+index);if(!side)continue;const dir=G.sub(side.b,side.a),n=G.len(dir);if(n<G.EPS)continue;
  if(Math.abs(G.cross(G.sub(selectedCurve.a,side.a),dir))/n<1e-7&&Math.abs(G.cross(G.sub(selectedCurve.b,side.a),dir))/n<1e-7)return {o,index,opposite,vertex:v,name:pBy(v)?.label||'A'};
 }
 return null;
}
function specialPointName(q){if(!state.settings.autoNames||q.dep?.kind!=='ratio'||Math.abs(q.dep.t-.5)>1e-8)return null;const t=triangleForEdge(q.dep.edge);if(!t)return null;const c=curve(t.o.id+':'+t.index),mid=G.mul(G.add(c.a,c.b),.5);return G.near(q,mid,1e-7)?'S'+subscript(t.name):null;}
function createPoint(q,options={}){const name=specialPointName(q);return addPoint(q,{...(name?{label:name}:{}),...options});}
function recognize(a,b){
 if(!state.settings.autoNames)return null;
 for(const o of state.objects.filter(o=>o.type==='polygon')){
  if(o.vertices.length===4){if([a,b].includes(o.vertices[0])&&[a,b].includes(o.vertices[2]))return {label:'e',semantic:'Úhlopříčka '+pBy(a).label+pBy(b).label};if([a,b].includes(o.vertices[1])&&[a,b].includes(o.vertices[3]))return {label:'f',semantic:'Úhlopříčka '+pBy(a).label+pBy(b).label};}
  if(o.vertices.length===3)for(let i=0;i<3;i++){
   const vertex=o.vertices[i],v=point(vertex),pa=a===vertex?b:b===vertex?a:null;if(!pa)continue;const p=point(pa),edge=o.id+':'+((i+1)%3),c=curve(edge);if(!p||!v||!c)continue;const mid=G.mul(G.add(c.a,c.b),.5),name=pBy(vertex).label;
   if(G.near(p,mid,1e-6)){const pp=pBy(pa);if(pp&&!pp.customLabel)pp.label='S'+subscript(name);return {label:'t'+subscript(name),labelOffset:{x:-18,y:-8},semantic:'Těžnice z vrcholu '+name};}
   const foot=G.project(v,c.a,c.b);if(G.near(p,foot,1e-6)){const pp=pBy(pa);if(pp&&!pp.customLabel)pp.label=name+'_0';return {label:'v'+subscript(name),labelOffset:{x:19,y:8},semantic:'Výška z vrcholu '+name};}
  }
 }
 return null;
}
function makeTwoPoint(type,a,b){const one=createPoint(a),two=createPoint(b);const special=recognize(one,two);const count=state.objects.filter(o=>o.type===type).length;return addObject({type,a:one,b:two,label:type==='line'?String.fromCharCode(112+count%10):pBy(one).label+pBy(two).label,...(special||{})});}
function makeConstraint(type,base,q){
 const through=createPoint(q),t=triangleForEdge(base,through);let special=null,foot=null;
 if(type==='perp'&&t&&through===t.vertex&&state.settings.autoNames){const v=point(through),c=curve(base),pos=G.project(v,c.a,c.b);foot=state.points.find(p=>{const x=point(p.id);return x&&G.near(x,pos,1e-7);})?.id||addPoint(pos,{dep:{kind:'foot',edge:base,from:through},label:t.name+'_0'});const footPoint=pBy(foot),alias=t.name+'_0';if(footPoint.label!==alias&&!footPoint.customLabel){footPoint.aliases??=[];if(!footPoint.aliases.includes(alias))footPoint.aliases.push(alias);}special={label:'v'+subscript(t.name),labelOffset:{x:20,y:8},semantic:'Výška z vrcholu '+t.name,foot};}
 const num=state.objects.filter(o=>o.type===type).length+1;return addObject({type,base,through,label:(type==='perp'?'k':'p')+(num===1?'':subscript(num)),...(special||{})});
}
const shapeNames={square:'Čtverec',rectangle:'Obdélník',parallelogram:'Kosodélník',rhombus:'Kosočtverec',kite:'Deltoid',trapezoid:'Lichoběžník'};
function insertShape(){
 const n=Number($('vertexCount').value);if(family==='regular'&&(!Number.isInteger(n)||n<3||n>40)){status('Zadej celé číslo od 3 do 40.');$('vertexCount').focus();return;}
 const angle=$('triangleAngle').value,sides=$('equilateral').checked?'equilateral':$('isosceles').checked?'isosceles':'any';const kind=$('quadType').value;
 let points=family==='triangle'?G.triangle(angle,sides):G.polygon(family==='quad'?kind:'regular',n);
 const center={x:view.x+(Math.random()-.5)*2,y:view.y+(Math.random()-.5)*1.4};
 // A similarity transform preserves the requested properties; individual grid snapping would not.
 points=G.transform(points,center,Number($('shapeScale').value),$('rotateShape').checked?Math.random()*G.TAU:0);
 transact(()=>{const id=uid('o'),vertices=points.map(p=>addPoint(p,{owner:id}));const letters=vertices.map(p=>pBy(p).label);const label=(family==='triangle'?'△ ':'')+letters.join('');const o={id,type:'polygon',vertices,label,labelOffset:{x:0,y:0},...clone(state.defaults),kind:family==='triangle'?'triangle':family==='quad'?kind:'regular',angle,sides,sideLabels:letters.map((_,i)=>family==='triangle'?letters[(i+2)%3].toLowerCase():'')};state.objects.push(o);selected=id;});
 setTool('select');status('Útvar je vložen. Přesuneš jej tažením; jeho geometrické vlastnosti zůstanou zachované.');
}
function style(o){return {stroke:o.color||o.style?.color||'#355fe0','stroke-width':o.width||o.style?.width||2,'stroke-dasharray':({solid:null,dashed:'9 6',dashdot:'12 5 2 5'})[o.dash||o.style?.dash||'solid'],'stroke-linecap':'round','stroke-linejoin':'round',fill:'none'};}
function pathFor(c){if(!c)return '';if(c.a){let a=c.a,b=c.b;if(c.type!=='segment'){const v=G.sub(b,a),n=G.len(v);if(n<G.EPS)return '';const reach=(Math.hypot(size.w,size.h)/view.scale+G.dist(a,view))*2,u=G.mul(v,reach/n);a=G.sub(c.a,u);b=G.add(c.a,u);}a=toScreen(a);b=toScreen(b);return `M${a.x} ${a.y}L${b.x} ${b.y}`;}
 const center=toScreen(c.c),r=c.r*view.scale;if(c.type==='circle'||Math.abs(c.sweep)>=G.TAU-.01)return `M${center.x+r} ${center.y}A${r} ${r} 0 1 0 ${center.x-r} ${center.y}A${r} ${r} 0 1 0 ${center.x+r} ${center.y}`;
 const a={x:center.x+r*Math.cos(c.start),y:center.y+r*Math.sin(c.start)},b={x:center.x+r*Math.cos(c.start+c.sweep),y:center.y+r*Math.sin(c.start+c.sweep)};
 return `M${a.x} ${a.y}A${r} ${r} 0 ${Math.abs(c.sweep)>Math.PI?1:0} ${c.sweep>=0?1:0} ${b.x} ${b.y}`;
}
function polyCenter(o){const pts=o.vertices.map(id=>point(id));if(pts.some(p=>!p))return null;return G.mul(pts.reduce((a,b)=>G.add(a,b),{x:0,y:0}),1/pts.length);}
function labelDescriptor(key){
 const [id,side,index]=key.split(':'),p=pBy(id),o=oBy(id);
 if(p){const pos=point(id);if(!pos)return null;let off=p.labelOffset;if(!off&&p.owner){const owner=oBy(p.owner),c=owner&&polyCenter(owner);if(c){const d=G.sub(pos,c),l=G.len(d)||1;off={x:d.x/l*18,y:d.y/l*18};}}return {target:p,owner:pBy(id).owner,text:p.label+(p.aliases?.length?' = '+p.aliases.join(' = '):''),pos,offset:off||{x:12,y:-13},color:p.style?.color||'#284b82',size:18,point:true};}
 if(!o)return null;
 if(side==='side') {const i=Number(index),c=curve(id+':'+i),center=polyCenter(o);if(!c||!center)return null;const pos=G.mul(G.add(c.a,c.b),.5),d=G.sub(pos,center),n=G.len(d)||1;return {target:o,side:i,text:o.sideLabels[i],pos,offset:o.sideOffsets?.[i]||{x:d.x/n*17,y:d.y/n*17},color:o.color,size:17};}
 let pos=null;if(o.type==='polygon')pos=polyCenter(o);else{const c=curve(id);if(c?.a)pos=G.mul(G.add(c.a,c.b),.5);else if(c){const angle=o.type==='arc'?c.start+c.sweep/2:-Math.PI/4;pos=G.add(c.c,{x:c.r*Math.cos(angle),y:c.r*Math.sin(angle)});}}
 return pos?{target:o,text:o.label,pos,offset:o.labelOffset||{x:10,y:-10},color:o.color,size:17}:null;
}
function labelVisible(d){if(d.point&&d.target.labelVisible===false)return false;if(d.point&&d.owner&&oBy(d.owner)?.labelVisible===false)return false;return d.point||d.target.labelVisible!==false;}
function drawLabel(key,parent){const d=labelDescriptor(key);if(!d||!d.text||!labelVisible(d))return;const s=toScreen(d.pos),o=d.offset;const node=el('text',{x:s.x+o.x,y:s.y+o.y,fill:d.color,'font-size':d.size,'text-anchor':'middle','dominant-baseline':'central','paint-order':'stroke',stroke:'#ffffff','stroke-width':4,'stroke-linejoin':'round','data-label':key},parent);const pattern=/(_[a-zA-Z0-9]+)/g;let start=0;for(const m of d.text.matchAll(pattern)){if(m.index>start)node.appendChild(document.createTextNode(d.text.slice(start,m.index)));const span=el('tspan',{'baseline-shift':'sub','font-size':12},node);span.textContent=m[0].slice(1);start=m.index+m[0].length;}node.appendChild(document.createTextNode(d.text.slice(start)));}
function render(){
 frame=0;svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${size.w} ${size.h}`);svg.classList.toggle('select',tool==='select');svg.classList.toggle('pan',space||drag?.type==='pan');
 if(state.settings.showGrid){let step=state.settings.gridStep*view.scale;while(step<12)step*=2;while(step>180)step/=2;const origin=toScreen({x:0,y:0});const defs=el('defs'),pattern=el('pattern',{id:'grid',width:step,height:step,patternUnits:'userSpaceOnUse',x:G.mod(origin.x,step),y:G.mod(origin.y,step)},defs);el('path',{d:`M${step} 0H0V${step}`,fill:'none',stroke:'#e6ecf5','stroke-width':1},pattern);el('rect',{width:size.w,height:size.h,fill:'url(#grid)','pointer-events':'none'});}
 const objectsLayer=el('g'),marks=el('g',{'pointer-events':'none'}),pointLayer=el('g'),labels=el('g');
 for(const o of state.objects){
  if(o.type==='polygon'){const pts=o.vertices.map(p=>point(p));if(pts.some(p=>!p))continue;const coords=pts.map(toScreen),points=coords.map(p=>p.x+','+p.y).join(' ');el('polygon',{points,fill:o.fill?o.color:'transparent','fill-opacity':o.fill?.055:0,stroke:'none','data-object':o.id},objectsLayer);
   o.vertices.forEach((_,i)=>{const c=curve(o.id+':'+i),d=pathFor(c);if(selected===o.id)el('path',{d,fill:'none',stroke:'#9cb6ff','stroke-width':(o.width||2)+6,opacity:.4,'pointer-events':'none'},objectsLayer);el('path',{d,...style(o),'data-edge':o.id+':'+i,'data-object':o.id},objectsLayer);el('path',{d,fill:'none',stroke:'transparent','stroke-width':14,'data-edge':o.id+':'+i,'data-object':o.id},objectsLayer);});
  }else{const c=curve(o.id);if(!c)continue;const d=pathFor(c);if(selected===o.id)el('path',{d,fill:'none',stroke:'#9cb6ff','stroke-width':(o.width||2)+6,opacity:.4,'pointer-events':'none'},objectsLayer);el('path',{d,...style(o),'data-object':o.id,'data-edge':c.a?o.id:null},objectsLayer);el('path',{d,fill:'none',stroke:'transparent','stroke-width':14,'data-object':o.id,'data-edge':c.a?o.id:null},objectsLayer);
   if(o.type==='perp'){const base=curve(o.base),p=point(o.through);if(base?.a&&p){const f=G.project(p,base.a,base.b),v=G.sub(base.b,base.a),n=G.len(v);if(n>G.EPS){const u=G.mul(v,px(10)/n),d=G.sub(p,f),w=G.len(d)>G.EPS?G.mul(d,px(10)/G.len(d)):{x:-u.y,y:u.x};const a=toScreen(G.add(f,u)),b=toScreen(G.add(G.add(f,u),w)),c=toScreen(G.add(f,w));el('path',{d:`M${a.x} ${a.y}L${b.x} ${b.y}L${c.x} ${c.y}`,fill:'none',stroke:o.color,'stroke-width':1.2},marks);}}}
  }
 }
 if(state.settings.snapParts&&(tool!=='select'||pending.first||pending.base)){for(const p of parts()){const q=toScreen(p);el('path',{d:`M${q.x-3} ${q.y}h6M${q.x} ${q.y-3}v6`,stroke:'#b5c3d8','stroke-width':1},marks);}}
 if(snapHint&&tool!=='select'&&snapHint.kind!=='free'){const s=toScreen(snapHint);el('circle',{cx:s.x,cy:s.y,r:8,fill:'#f4a92f20',stroke:'#d69a32','stroke-width':1.3},marks);const t=el('text',{x:s.x+13,y:s.y-12,fill:'#99732f','font-size':12,'paint-order':'stroke',stroke:'white','stroke-width':3},marks);t.textContent=snapHint.hint||'';}
 for(const p of state.points){const q=point(p.id);if(!q)continue;const s=toScreen(q),color=p.style?.color||'#3154a0';if(selected===p.id)el('circle',{cx:s.x,cy:s.y,r:9,fill:'#edf3ff',stroke:'#8aa7f1','pointer-events':'none'},pointLayer);el('path',{d:`M${s.x-4} ${s.y-4}l8 8M${s.x-4} ${s.y+4}l8 -8`,stroke:color,'stroke-width':p.style?.width||1.8,'stroke-linecap':'round','pointer-events':'none'},pointLayer);el('circle',{cx:s.x,cy:s.y,r:9,fill:'transparent','data-point':p.id},pointLayer);}
 for(const o of state.objects){drawLabel(o.id,labels);if(o.type==='polygon'&&o.sideLabels)o.sideLabels.forEach((_,i)=>drawLabel(o.id+':side:'+i,labels));}for(const p of state.points)drawLabel(p.id,labels);
 drawPreview();
}
function requestRender(){if(!frame)frame=requestAnimationFrame(render);}
function previewPath(c){el('path',{d:pathFor(c),stroke:state.defaults.color,'stroke-width':state.defaults.width,fill:'none','stroke-dasharray':'6 5',opacity:.7,'pointer-events':'none'});}
function drawRuler(anchor,direction,kind='ruler'){
 const n=G.len(direction);if(n<G.EPS)return;const s=toScreen(anchor),angle=Math.atan2(direction.y,direction.x)*180/Math.PI;
 const g=el('g',{transform:`translate(${s.x} ${s.y}) rotate(${angle})`,'pointer-events':'none'});
 if(kind==='triangle'){el('path',{d:'M-125 0H165L-125 160Z',fill:'#9dd4ee',stroke:'#4a98b8','fill-opacity':.24,'stroke-width':1.3},g);el('path',{d:'M-82 28H85L-82 118Z',fill:'white',stroke:'#74b0cb','fill-opacity':.5},g);el('path',{d:'M0 -8V110',stroke:'#d15e65','stroke-width':1.4,'stroke-dasharray':'6 3'},g);}
 else el('rect',{x:-210,y:0,width:420,height:48,rx:4,fill:'#b5deec',stroke:'#66a5be','fill-opacity':.32,'stroke-width':1.2},g);
 for(let x=-120;x<=160;x+=10){el('path',{d:`M${x} 0v${x%50===0?17:x%20===0?11:7}`,stroke:'#51859e','stroke-width':.9},g);if(x%50===0){const t=el('text',{x:x+2,y:29,fill:'#51859e','font-size':10},g);t.textContent=String(Math.abs(x/50));}}
}
function drawCompass(center,tip){const c=toScreen(center),t=toScreen(tip),v=G.sub(t,c),n=G.len(v);if(n<2)return;const mid=G.mul(G.add(c,t),.5),h=Math.min(105,Math.max(45,n*.6)),perp={x:v.y/n*h,y:-v.x/n*h},hinge=G.add(mid,perp);const g=el('g',{'pointer-events':'none'});el('path',{d:`M${c.x} ${c.y}L${hinge.x} ${hinge.y}L${t.x} ${t.y}`,fill:'none',stroke:'#60738c','stroke-width':7,'stroke-linecap':'round','stroke-linejoin':'round',opacity:.75},g);el('path',{d:`M${c.x} ${c.y}L${hinge.x} ${hinge.y}L${t.x} ${t.y}`,fill:'none',stroke:'#cbd7e6','stroke-width':3},g);el('circle',{cx:hinge.x,cy:hinge.y,r:6,fill:'#e7edf6',stroke:'#61748d','stroke-width':2},g);el('path',{d:`M${c.x} ${c.y-6}v12`,stroke:'#233a59','stroke-width':2},g);el('path',{d:`M${t.x-2} ${t.y-2}l4 4`,stroke:state.defaults.color,'stroke-width':4},g);el('path',{d:`M${c.x} ${c.y}L${t.x} ${t.y}`,stroke:'#a2b3c9','stroke-width':1,'stroke-dasharray':'4 4'},g);}
function drawConstruction(c){if(!c)return;const base=curve(c.base);if(!base?.a)return;const p=c.p,v=G.sub(base.b,base.a),n=G.len(v);if(n<G.EPS)return;const f=G.project(p,base.a,base.b);
 if(c.type==='perp'){const dir={x:-v.y,y:v.x};drawRuler(f,dir,'triangle');previewPath({type:'line',a:p,b:G.add(p,dir)});}
 else{const normal={x:-v.y/n,y:v.x/n};drawRuler(G.sub(base.a,G.mul(normal,px(48))),v);const foot=G.project(p,base.a,base.b),slide=G.sub(p,foot);drawRuler(G.add(base.a,slide),v,'triangle');previewPath({type:'line',a:p,b:G.add(p,v)});}
}
function drawPreview(){
 const q=mouse?(snapHint||mouse):null;
 if(pending.first&&q&&(tool==='line'||tool==='segment')){previewPath({type:tool,a:pending.first,b:q});if(state.settings.showInstruments)drawRuler(pending.first,G.sub(q,pending.first));}
 if(tool==='parallel'||tool==='perp'){
  const base=pending.base||(!pending.base&&mouse?edgeHit(mouse)?.key:null),p=pending.first||q;
  if(base&&p){if(state.settings.showInstruments)drawConstruction({type:tool,base,p});else{const b=curve(base);if(b?.a){const v=G.sub(b.b,b.a);previewPath({type:'line',a:p,b:G.add(p,tool==='perp'?{x:-v.y,y:v.x}:v)});}}}
  else if(pending.first&&q&&state.settings.showInstruments)drawRuler(pending.first,G.sub(q,pending.first),'triangle');
 }
 if(pending.center&&q){const c=pending.center,r=pending.radius??G.dist(c,q);let tip=pending.radius?G.add(c,{x:r*Math.cos(pending.currentAngle??pending.start),y:r*Math.sin(pending.currentAngle??pending.start)}):q;if(tool==='circle'||!pending.radius)previewPath({type:'circle',c,r});else previewPath({type:'arc',c,r,start:pending.start,sweep:pending.sweep||.0001});if(state.settings.showInstruments)drawCompass(c,tip);}
 if(lastInstrument&&state.settings.showInstruments&&Date.now()<lastInstrument.until){if(lastInstrument.type==='circle')drawCompass(lastInstrument.center,lastInstrument.tip);else drawConstruction(lastInstrument);}
}
function edgeHit(raw,limit=12){let best=null,d=px(limit);for(const c of curves()){if(!c.a)continue;const q=G.project(raw,c.a,c.b);if(c.type==='segment'&&(q.t<0||q.t>1))continue;const n=G.dist(raw,q);if(n<d){best=c;d=n;}}return best;}
function pointHit(raw){let id=null,d=px(10);for(const p of state.points){const q=point(p.id);if(q&&G.dist(raw,q)<d){id=p.id;d=G.dist(raw,q);}}return id;}
function objectHit(raw){const edge=edgeHit(raw);if(edge)return edge.key.split(':')[0];for(const c of curves())if(c.c&&Math.abs(G.dist(raw,c.c)-c.r)<px(12)&&G.onArc(raw,c))return c.key;for(const o of [...state.objects].reverse())if(o.type==='polygon'){const pts=o.vertices.map(id=>point(id));if(pts.some(p=>!p))continue;let inside=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if(((a.y>raw.y)!==(b.y>raw.y))&&raw.x<(b.x-a.x)*(raw.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}if(inside)return o.id;}return null;}
function chosenSnap(raw,explicitId=null){const hit=explicitId||(state.settings.snapPoints?pointHit(raw):null);if(hit){const p=point(hit);return {...p,existing:hit,kind:'point',hint:pBy(hit).label};}return snap(raw);}
function keepInstrument(data){lastInstrument={...data,until:Date.now()+1400};setTimeout(()=>{lastInstrument=null;requestRender();},1450);}
function cancel(show=true){pending={};drag=null;snapHint=null;lastInstrument=null;$('cancel').hidden=true;if(show)status(helpFor(tool)[1]);requestRender();}
function helpFor(t){return ({select:['Výběr a úpravy','Klikni na objekt a uprav jeho vlastnosti dole. Popisek přepíšeš kliknutím nebo přesuneš tažením.'],point:['Bod','Klikni do plochy, na průsečík nebo na nabízený díl úsečky. Body se značí křížkem.'],line:['Přímka dvěma body','Vyber první a druhý bod. Existující body můžeš použít znovu.'],segment:['Úsečka dvěma body','Vyber krajní body. Díly úsečky se nabízejí podle nastavení přichytávání.'],parallel:['Rovnoběžka','Vyber přímku nebo stranu útvaru a bod, kterým má rovnoběžka procházet. Pořadí můžeš obrátit.'],perp:['Kolmice','Vyber bod a přímku nebo stranu útvaru. Pravítko ukazuje polohu rysky i výslednou kolmici. Pořadí je libovolné.'],circle:['Kružnice','Klikni na střed a pak na bod, kterým kružnice prochází. Kružítko ukazuje zvolený poloměr.'],arc:['Kružnicový oblouk','Klikni na střed, potom přilož tuhu druhým kliknutím. Dalším stiskem začni a držením tlačítka obtáhni oblouk. Puštěním dokončíš; úplná otočka vytvoří kružnici.']})[t];}
function setTool(t){finishEdit();cancel(false);tool=t;for(const b of document.querySelectorAll('[data-tool]'))b.classList.toggle('active',b.dataset.tool===t);if(t!=='select')selected=null;const [title,text]=helpFor(t);$('helpTitle').textContent=title;$('helpText').textContent=text;status(text);refreshUI();render();}
function updatePendingStatus(){const has=Object.keys(pending).length>0;$('cancel').hidden=!has;if(!has){status(helpFor(tool)[1]);return;}if(pending.radius)status('Poloměr je nastaven. Stiskni tlačítko a tažením opiš oblouk; puštěním dokončíš.');else if(pending.center)status('Vyber druhý bod – polohu tuhy a poloměr.');else if(pending.base)status('Přímka je vybraná. Vyber bod, kterým konstrukce projde.');else if(pending.first)status(tool==='parallel'||tool==='perp'?'Bod je vybraný. Klikni na přímku nebo stranu útvaru.':'Vyber druhý bod.');}
svg.addEventListener('pointerdown',e=>{
 if(e.button!==0&&e.button!==1)return;e.preventDefault();finishEdit();svg.focus({preventScroll:true});const raw=eventPoint(e);mouse=raw;
 if(e.button===1||space){drag={type:'pan',start:{x:e.clientX,y:e.clientY},view:{...view}};svg.setPointerCapture(e.pointerId);render();return;}
 if(tool==='select'){
  const key=e.target.closest('[data-label]')?.dataset.label;
  if(key){const d=labelDescriptor(key);selected=d.target.id;drag={type:'label',key,start:raw,offset:{...d.offset},client:{x:e.clientX,y:e.clientY},moved:false};svg.setPointerCapture(e.pointerId);refreshUI();return;}
  const pid=e.target.closest('[data-point]')?.dataset.point||pointHit(raw),id=pid||e.target.closest('[data-object]')?.dataset.object||objectHit(raw);selected=id;refreshUI();
  if(id){const p=pBy(id),o=oBy(id);let ids=[];if(p){if(p.owner)ids=oBy(p.owner)?.vertices||[];else if(!p.dep)ids=[id];}else if(o?.type==='polygon')ids=o.vertices;else if(o&&['line','segment'].includes(o.type))ids=[o.a,o.b].filter(p=>!pBy(p)?.dep&&!pBy(p)?.owner);else if(o&&['circle','arc'].includes(o.type))ids=[o.center,o.through].filter(p=>!pBy(p)?.dep&&!pBy(p)?.owner);else if(o?.through&&!pBy(o.through)?.dep&&!pBy(o.through)?.owner)ids=[o.through];
   if(ids.length){drag={type:'move',ids,start:raw,positions:ids.map(p=>({id:p,...point(p)})),moved:false};svg.setPointerCapture(e.pointerId);}else if(p?.dep)status('Tento bod je svázaný s konstrukcí. Posuň jeho výchozí útvar.');
  }render();return;
 }
 const q=chosenSnap(raw,e.target.closest('[data-point]')?.dataset.point);snapHint=q;
 if(tool==='point'){transact(()=>{selected=createPoint(q);});return;}
 if(tool==='line'||tool==='segment'){if(!pending.first)pending.first=clone(q);else{if(G.dist(pending.first,q)<1e-6){status('Druhý bod musí být jiný než první.');return;}transact(()=>{selected=makeTwoPoint(tool,pending.first,q).id;});pending={};}updatePendingStatus();render();return;}
 if(tool==='parallel'||tool==='perp'){
  const hitPoint=pointHit(raw),hit=edgeHit(raw);
  if(!pending.base&&!pending.first){if(hit&&!hitPoint)pending.base=hit.key;else pending.first=clone(q);}
  else if(pending.base){const b=curve(pending.base);if(tool==='parallel'&&G.dist(q,G.project(q,b.a,b.b))<1e-7){status('Bod leží na vybrané přímce. Vyber bod mimo ni pro odlišnou rovnoběžku.');return;}transact(()=>{selected=makeConstraint(tool,pending.base,q).id;});keepInstrument({type:tool,base:pending.base,p:q});pending={};}
  else if(hit){if(tool==='parallel'&&G.dist(pending.first,G.project(pending.first,hit.a,hit.b))<1e-7){status('Vybraný bod leží na této přímce. Zvol jinou přímku.');return;}transact(()=>{selected=makeConstraint(tool,hit.key,pending.first).id;});keepInstrument({type:tool,base:hit.key,p:pending.first});pending={};}
  else status('Klikni na přímku, úsečku nebo stranu útvaru.');updatePendingStatus();render();return;
 }
 if(tool==='circle'||tool==='arc'){
  if(!pending.center)pending.center=clone(q);
  else if(!pending.radius){const r=G.dist(pending.center,q);if(r<px(8)){status('Zvol větší poloměr.');return;}if(tool==='circle'){const center=pending.center;transact(()=>{const a=createPoint(center),b=createPoint(q);selected=addObject({type:'circle',center:a,through:b,label:'k'+subscript(state.objects.filter(o=>o.type==='circle').length+1)}).id;});keepInstrument({type:'circle',center,tip:q});pending={};}else{pending.through=clone(q);pending.radius=r;pending.start=Math.atan2(q.y-pending.center.y,q.x-pending.center.x);pending.currentAngle=pending.start;pending.sweep=0;}}
  else if(tool==='arc'){const c=pending.center,angle=Math.atan2(raw.y-c.y,raw.x-c.x);pending.start=angle;pending.currentAngle=angle;pending.sweep=0;drag={type:'arc',lastAngle:angle};svg.setPointerCapture(e.pointerId);status('Táhni kružítkem kolem středu. Puštěním dokončíš oblouk.');}
  updatePendingStatus();render();
 }
});
svg.addEventListener('pointermove',e=>{
 const raw=eventPoint(e);mouse=raw;$('coords').textContent=`x = ${raw.x.toFixed(2)} · y = ${(-raw.y).toFixed(2)}`;
 if(drag?.type==='pan'){view.x=drag.view.x-(e.clientX-drag.start.x)/view.scale;view.y=drag.view.y-(e.clientY-drag.start.y)/view.scale;requestRender();return;}
 if(drag?.type==='label'){if(!drag.moved&&Math.hypot(e.clientX-drag.client.x,e.clientY-drag.client.y)<4)return;if(!drag.moved){before();drag.moved=true;}const d=labelDescriptor(drag.key),delta=G.mul(G.sub(raw,drag.start),view.scale),offset=G.add(drag.offset,delta);if(d.side!==undefined){d.target.sideOffsets??={};d.target.sideOffsets[d.side]=offset;}else d.target.labelOffset=offset;requestRender();return;}
 if(drag?.type==='move'){let delta=G.sub(raw,drag.start);if(!drag.moved&&G.len(delta)<px(3))return;if(!drag.moved){before();drag.moved=true;}if(state.settings.snapGrid){const anchor=drag.positions[0],step=state.settings.gridStep;delta={x:Math.round((anchor.x+delta.x)/step)*step-anchor.x,y:Math.round((anchor.y+delta.y)/step)*step-anchor.y};}for(const original of drag.positions){const p=pBy(original.id);p.x=original.x+delta.x;p.y=original.y+delta.y;}invalidate();requestRender();return;}
 if(drag?.type==='arc'){const c=pending.center,circle={c,r:pending.radius};const end=snap(raw,{circle});snapHint=end;const a=Math.atan2(end.y-c.y,end.x-c.x),diff=Math.atan2(Math.sin(a-drag.lastAngle),Math.cos(a-drag.lastAngle));pending.sweep+=diff;pending.currentAngle=a;drag.lastAngle=a;requestRender();return;}
 snapHint=tool!=='select'?snap(raw):null;requestRender();
});
function release(e){
 if(!drag)return;const d=drag;drag=null;if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);
 if(d.type==='label'){if(d.moved)changed();else openEdit(d.key);}
 if(d.type==='move'&&d.moved)changed();
 if(d.type==='pan'){saveLocal();render();}
 if(d.type==='arc'){
  const sweep=pending.sweep;if(Math.abs(sweep)<.025){status('Oblouk je příliš krátký. Stiskni a táhni znovu.');render();return;}const c=clone(pending),full=Math.abs(sweep)>=G.TAU-.07;
  transact(()=>{const center=createPoint(c.center),through=createPoint(c.through);selected=addObject({type:full?'circle':'arc',center,through,start:c.start,sweep:full?G.TAU:sweep,label:(full?'k':'l')+subscript(state.objects.filter(o=>o.type===(full?'circle':'arc')).length+1)}).id;});const tip=G.add(c.center,{x:c.radius*Math.cos(c.currentAngle),y:c.radius*Math.sin(c.currentAngle)});keepInstrument({type:'circle',center:c.center,tip});pending={};updatePendingStatus();status(full?'Dokončena celá kružnice.':'Oblouk je dokončen.');render();
 }
}
svg.addEventListener('pointerup',release);
svg.addEventListener('pointercancel',e=>{if(drag?.moved&&(drag.type==='move'||drag.type==='label')){state=JSON.parse(undoStack.pop());changed();}drag=null;pending={};updatePendingStatus();render();});
svg.addEventListener('pointerleave',()=>{if(!drag){mouse=null;snapHint=null;requestRender();}});
svg.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(-e.deltaY*.001),eventPoint(e));},{passive:false});
function zoom(factor,anchor={x:view.x,y:view.y}){const s=toScreen(anchor);view.scale=Math.max(10,Math.min(220,view.scale*factor));view.x=anchor.x-(s.x-size.w/2)/view.scale;view.y=anchor.y-(s.y-size.h/2)/view.scale;saveLocal();render();}
function fit(){const pts=state.points.map(p=>point(p.id)).filter(Boolean);for(const c of curves())if(c.c)pts.push({x:c.c.x-c.r,y:c.c.y-c.r},{x:c.c.x+c.r,y:c.c.y+c.r});if(!pts.length){view={x:0,y:0,scale:44};}else{const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);view={x:(minX+maxX)/2,y:(minY+maxY)/2,scale:Math.max(10,Math.min(120,Math.min((size.w-100)/Math.max(2,maxX-minX),(size.h-100)/Math.max(2,maxY-minY))))};}saveLocal();render();}
function openEdit(key){const d=labelDescriptor(key);if(!d)return;editing=key;const screen=toScreen(d.pos);const input=$('inlineEdit');input.value=d.text;input.style.left=Math.max(5,Math.min(size.w-140,screen.x+d.offset.x-35))+'px';input.style.top=Math.max(5,Math.min(size.h-38,screen.y+d.offset.y-17))+'px';input.hidden=false;input.focus();input.select();}
function finishEdit(cancelEdit=false){if(!editing)return;const key=editing;editing=null;const input=$('inlineEdit'),d=labelDescriptor(key);if(d&&!cancelEdit&&input.value!==d.text){before();if(d.side!==undefined)d.target.sideLabels[d.side]=input.value.trim().slice(0,80);else{d.target.label=input.value.trim().slice(0,80);d.target.customLabel=true;delete d.target.aliases;}changed();}input.hidden=true;}
$('inlineEdit').addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter')finishEdit();if(e.key==='Escape')finishEdit(true);});$('inlineEdit').addEventListener('blur',()=>finishEdit());
function selection(){return pBy(selected)||oBy(selected);}
function refreshUI(){
 const obj=selection(),isPoint=!!pBy(selected),styleObj=isPoint?obj.style:obj||state.defaults;
 $('selectionTitle').textContent=obj?(isPoint?'Bod '+obj.label:'Vlastnosti: '+(obj.label||'objekt')):'Vlastnosti nové kresby';
 $('delete').hidden=!obj;$('color').value=styleObj?.color||'#355fe0';$('dash').value=styleObj?.dash||'solid';$('width').value=styleObj?.width||2;$('label').value=obj?.label||'';$('label').disabled=!obj;
 $('labelVisible').checked=obj?obj.labelVisible!==false:state.defaults.labelVisible;$('fill').checked=(obj||state.defaults).fill!==false;$('fill').disabled=!!obj&&obj.type!=='polygon';$('dash').disabled=isPoint;
 $('selectionInfo').textContent=obj?(obj.semantic||obj.dep?'Bod nebo přímka zachovává vazbu na původní konstrukci.':isPoint&&obj.owner?'Vrchol se přesouvá společně s útvarem.':obj.type==='polygon'?'Přetáhni útvar v režimu výběru.': 'Kliknutím na popisek jej přepíšeš.'):'Nastavení se použije pro další kreslení.';
 if(obj?.semantic)$('selectionInfo').textContent=obj.semantic;
 $('undo').disabled=!undoStack.length;$('redo').disabled=!redoStack.length;
 const count=state.objects.length;$('objectCount').textContent=`${count} ${count===1?'útvar':'útvarů'} · ${state.points.length} bodů`;
 const list=$('objectList');list.replaceChildren();for(const obj of [...state.objects,...state.points.filter(p=>!p.owner)]){const b=document.createElement('button');b.className='object-chip'+(obj.id===selected?' active':'');b.textContent=obj.label||obj.type||'Bod';b.style.borderLeft='3px solid '+(obj.color||obj.style?.color||'#355fe0');b.addEventListener('click',()=>{finishEdit();selected=obj.id;refreshUI();render();});list.appendChild(b);}
 for(const key of ['showGrid','snapGrid','snapPoints','snapParts','showInstruments','autoNames'])$(key).checked=state.settings[key];$('gridStep').value=state.settings.gridStep;for(const c of $('fractions').querySelectorAll('input'))c.checked=state.settings.parts.includes(Number(c.value));$('fractions').style.opacity=state.settings.snapParts?'1':'.4';
}
function editProperty(key,value){const obj=selection();transact(()=>{if(obj){if(pBy(obj.id)&&['color','width','dash'].includes(key))obj.style[key]=value;else obj[key]=value;if(key==='label')obj.customLabel=true;}else state.defaults[key]=value;});}
$('color').addEventListener('change',()=>editProperty('color',$('color').value));$('dash').addEventListener('change',()=>editProperty('dash',$('dash').value));function changeWidth(commit){const n=Number($('width').value),obj=selection(),current=(pBy(selected)?obj.style:obj||state.defaults).width;if(n>=.5&&n<=12){if(n!==current)editProperty('width',n);}else if(commit)refreshUI();}$('width').addEventListener('input',()=>changeWidth(false));$('width').addEventListener('change',()=>changeWidth(true));$('label').addEventListener('change',()=>editProperty('label',$('label').value.trim().slice(0,80)));$('labelVisible').addEventListener('change',()=>editProperty('labelVisible',$('labelVisible').checked));$('fill').addEventListener('change',()=>editProperty('fill',$('fill').checked));
function deleteSelection(){if(!selected)return;const id=selected;transact(()=>{
 let ids=new Set([id]);let modified=true;while(modified){modified=false;for(const o of state.objects){const refs=[o.a,o.b,o.center,o.through,o.base?.split(':')[0],...(o.vertices||[])].filter(Boolean);if(!ids.has(o.id)&&refs.some(r=>ids.has(r))){ids.add(o.id);modified=true;}}for(const p of state.points){const d=p.dep,refs=[p.owner,d?.from,d?.edge?.split(':')[0],d?.a?.split(':')[0],d?.b?.split(':')[0]].filter(Boolean);if(!ids.has(p.id)&&refs.some(r=>ids.has(r))){ids.add(p.id);modified=true;}}}
 state.objects=state.objects.filter(o=>!ids.has(o.id));state.points=state.points.filter(p=>!ids.has(p.id));selected=null;
 });status('Výběr a konstrukce, které na něm závisí, jsou smazané. Tlačítkem Zpět je obnovíš.');}
function updateTriangleOptions(){const eq=$('equilateral').checked;$('triangleAngle').disabled=eq;$('isosceles').disabled=eq;if(eq){$('triangleAngle').value='acute';$('isosceles').checked=true;}$('triangleHint').textContent=eq?'Rovnostranný trojúhelník je vždy ostroúhlý a rovnoramenný.':'Lze kombinovat typ úhlů a rovnoramennost.';}
$('equilateral').addEventListener('change',updateTriangleOptions);
for(const b of document.querySelectorAll('[data-family]'))b.addEventListener('click',()=>{family=b.dataset.family;for(const el of document.querySelectorAll('[data-family]'))el.classList.toggle('active',el===b);$('triangleOptions').hidden=family!=='triangle';$('quadOptions').hidden=family!=='quad';$('regularOptions').hidden=family!=='regular';$('insertShape').textContent=family==='triangle'?'＋ Vložit náhodný trojúhelník':family==='quad'?'＋ Vložit čtyřúhelník':'＋ Vložit pravidelný n-úhelník';});
for(const b of document.querySelectorAll('[data-tool]'))b.addEventListener('click',()=>setTool(b.dataset.tool));$('insertShape').addEventListener('click',insertShape);
for(const key of ['showGrid','snapGrid','snapPoints','snapParts','showInstruments','autoNames'])$(key).addEventListener('change',()=>{state.settings[key]=$(key).checked;changed();});
$('gridStep').addEventListener('change',()=>{const step=Number($('gridStep').value);if(step>=.1&&step<=10){state.settings.gridStep=step;changed();}else refreshUI();});$('fractions').addEventListener('change',()=>{state.settings.parts=Array.from($('fractions').querySelectorAll('input:checked'),c=>Number(c.value));changed();});
$('undo').addEventListener('click',undo);$('redo').addEventListener('click',redo);$('zoomIn').addEventListener('click',()=>zoom(1.2));$('zoomOut').addEventListener('click',()=>zoom(1/1.2));$('fit').addEventListener('click',fit);$('cancel').addEventListener('click',()=>cancel());$('delete').addEventListener('click',deleteSelection);
$('clear').addEventListener('click',()=>$('clearDialog').showModal());$('clearCancel').addEventListener('click',()=>$('clearDialog').close());$('clearConfirm').addEventListener('click',()=>{cancel(false);transact(()=>{state.points=[];state.objects=[];selected=null;});$('clearDialog').close();});
function download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('save').addEventListener('click',()=>download(new Blob([JSON.stringify({format:'bernio-geometry',version:1,state,view},null,2)],{type:'application/json'}),'geometry.json'));
$('load').addEventListener('click',()=>$('fileInput').click());
function validData(data){
 if(!data||data.version!==1||!Array.isArray(data.points)||!Array.isArray(data.objects)||data.points.length>2000||data.objects.length>1000)return false;
 const finite=n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<1e7,id=x=>typeof x==='string'&&/^[po]\d+$/.test(x),label=x=>typeof x==='string'&&x.length<=80,color=x=>/^#[\da-f]{6}$/i.test(x),offset=x=>!x||(finite(x.x)&&finite(x.y));
 const ids=new Set();for(const e of [...data.points,...data.objects]){if(!id(e.id)||ids.has(e.id)||!label(e.label)||!offset(e.labelOffset))return false;ids.add(e.id);}
 const pointIds=new Set(data.points.map(p=>p.id)),objectIds=new Set(data.objects.map(o=>o.id));const ref=x=>pointIds.has(x),base=x=>typeof x==='string'&&objectIds.has(x.split(':')[0]);
 for(const p of data.points){if(!finite(p.x)||!finite(p.y)||!color(p.style?.color)||!finite(p.style?.width)||p.style.width<.5||p.style.width>12||(p.owner&&!objectIds.has(p.owner)))return false;const d=p.dep;if(d&&!(d.kind==='ratio'&&base(d.edge)&&finite(d.t)||d.kind==='foot'&&base(d.edge)&&ref(d.from)||d.kind==='intersection'&&base(d.a)&&base(d.b)&&Number.isInteger(d.branch)&&d.branch>=0&&d.branch<2))return false;}
 for(const o of data.objects){if(!color(o.color)||!finite(o.width)||o.width<.5||o.width>12||!['solid','dashed','dashdot'].includes(o.dash))return false;if(o.type==='polygon'){if(!Array.isArray(o.vertices)||o.vertices.length<3||o.vertices.length>40||!o.vertices.every(ref)||!Array.isArray(o.sideLabels)||!o.sideLabels.every(label))return false;}else if(['segment','line'].includes(o.type)){if(!ref(o.a)||!ref(o.b)||o.a===o.b)return false;}else if(['perp','parallel'].includes(o.type)){if(!base(o.base)||!ref(o.through))return false;}else if(['arc','circle'].includes(o.type)){if(!ref(o.center)||!ref(o.through)||o.type==='arc'&&(!finite(o.start)||!finite(o.sweep)))return false;}else return false;}
 return Number.isInteger(data.nextId)&&data.nextId>0&&data.nextId<1e7;
}
function normalize(data){const fresh=initial();data.settings={...fresh.settings,...data.settings};data.defaults={...fresh.defaults,...data.defaults};const s=data.settings;s.gridStep=Number(s.gridStep);if(!Number.isFinite(s.gridStep)||s.gridStep<.1||s.gridStep>10)s.gridStep=1;s.parts=Array.isArray(s.parts)?s.parts.filter(n=>[2,3,4,5,8].includes(n)):[2];for(const key of ['showGrid','snapGrid','snapPoints','snapParts','showInstruments','autoNames'])s[key]=s[key]!==false;data.nextId=Math.max(data.nextId,...[...data.points,...data.objects].map(o=>Number(o.id.slice(1))+1));return data;}
$('fileInput').addEventListener('change',async()=>{const file=$('fileInput').files[0];if(!file)return;try{if(file.size>4e6)throw Error('Soubor je příliš velký.');const data=JSON.parse(await file.text());if(data.format!=='bernio-geometry'||!validData(data.state))throw Error('Neplatný soubor Geometry.');cancel(false);transact(()=>{state=normalize(data.state);selected=null;});fit();status('Nákres je otevřený.');}catch(e){status(e.message||'Soubor se nepodařilo načíst.');}$('fileInput').value='';});
$('export').addEventListener('click',()=>{
 finishEdit();cancel(false);render();const copy=svg.cloneNode(true);copy.querySelectorAll('[data-point]').forEach(e=>e.remove());copy.querySelectorAll('path[stroke="transparent"]').forEach(e=>e.remove());copy.querySelectorAll('[data-label],[data-object],[data-edge]').forEach(e=>{e.removeAttribute('data-label');e.removeAttribute('data-object');e.removeAttribute('data-edge');});const bg=document.createElementNS(NS,'rect');bg.setAttribute('width','100%');bg.setAttribute('height','100%');bg.setAttribute('fill','white');copy.insertBefore(bg,copy.firstChild);copy.setAttribute('width',size.w);copy.setAttribute('height',size.h);copy.setAttribute('xmlns',NS);const blob=new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob),img=new Image();img.onload=()=>{const canvas=document.createElement('canvas');canvas.width=size.w*2;canvas.height=size.h*2;const ctx=canvas.getContext('2d');ctx.scale(2,2);ctx.drawImage(img,0,0);canvas.toBlob(b=>{if(b)download(b,'geometry.png');else status('PNG se nepodařilo vytvořit.');});URL.revokeObjectURL(url);};img.onerror=()=>{URL.revokeObjectURL(url);status('PNG se nepodařilo vytvořit.');};img.src=url;
});
document.addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea')||$('clearDialog').open)return;if(e.code==='Space'){e.preventDefault();space=true;render();}if(e.key==='Escape'){cancel();selected=null;refreshUI();render();}if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteSelection();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}});
document.addEventListener('keyup',e=>{if(e.code==='Space'){space=false;render();}});window.addEventListener('blur',()=>{space=false;});
function splitter(node,axis){node.addEventListener('pointerdown',e=>{e.preventDefault();node.setPointerCapture(e.pointerId);const move=ev=>{if(axis==='x')document.documentElement.style.setProperty('--sidebar-width',Math.max(250,Math.min(500,ev.clientX))+'px');else document.documentElement.style.setProperty('--bottom-height',Math.max(145,Math.min(innerHeight*.48,innerHeight-ev.clientY-32))+'px');};const up=()=>{node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',up);};node.addEventListener('pointermove',move);node.addEventListener('pointerup',up);});node.addEventListener('keydown',e=>{if(!e.key.startsWith('Arrow'))return;e.preventDefault();const key=axis==='x'?'--sidebar-width':'--bottom-height',now=parseInt(getComputedStyle(document.documentElement).getPropertyValue(key))||(axis==='x'?315:205);document.documentElement.style.setProperty(key,Math.max(axis==='x'?250:145,Math.min(axis==='x'?500:innerHeight*.48,now+(e.key==='ArrowRight'||e.key==='ArrowUp'?10:-10)))+'px');});}
splitter($('sideSplitter'),'x');splitter($('bottomSplitter'),'y');
try{const data=JSON.parse(localStorage.getItem(STORAGE));if(data&&validData(data.state)){state=normalize(data.state);if(data.view&&Number.isFinite(data.view.x)&&Number.isFinite(data.view.y)&&data.view.scale>=10&&data.view.scale<=220)view=data.view;}}catch(e){storageOK=false;}
new ResizeObserver(()=>{const r=shell.getBoundingClientRect();size={w:Math.max(1,r.width),h:Math.max(1,r.height)};render();}).observe(shell);
refreshUI();render();
})();
