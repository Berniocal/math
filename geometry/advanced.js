/* Geometry constraints, measurements and compact construction links. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./core.js'):root.Geometry);if(typeof module==='object'&&module.exports)module.exports=api;else root.GeometryAdvanced=api;})(typeof globalThis==='object'?globalThis:this,function(G){
'use strict';
const copy=x=>JSON.parse(JSON.stringify(x)),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const unit=v=>G.mul(v,1/(G.len(v)||1));
function area(p){return Math.abs(p.reduce((s,a,i)=>s+G.cross(a,p[(i+1)%p.length]),0))/2;}
function angle(a,v,b){const u=G.sub(a,v),w=G.sub(b,v);return Math.acos(clamp(G.dot(u,w)/(G.len(u)*G.len(w)||1),-1,1));}
function triangleType(p){const d=p.map((a,i)=>G.dist(a,p[(i+1)%3])**2).sort((a,b)=>a-b),q=d[2]-d[1]-d[0];return Math.abs(q)<1e-7?'right':q>0?'obtuse':'acute';}
function constrainedResize(o,p,index,target){
 if(!p.every(Boolean)||area(p)<1e-7)return p;
 const center=G.mul(p.reduce(G.add,{x:0,y:0}),1/p.length),sides=o.sides||'any';
 if(o.kind==='regular'||o.kind==='square'||o.kind==='triangle'&&(sides==='equilateral'||sides==='isosceles'&&o.angle==='right')){
  const a=G.sub(p[index],center),b=G.sub(target,center),scale=clamp(G.len(b)/(G.len(a)||1),.03,100),rotation=Math.atan2(b.y,b.x)-Math.atan2(a.y,a.x);return G.transform(p.map(v=>G.sub(v,center)),center,scale,rotation);
 }
 if(o.kind==='triangle'&&sides!=='isosceles'){
  if(o.angle==='right'){
   const right=p.map((v,i)=>Math.abs(G.dot(unit(G.sub(p[(i+1)%3],v)),unit(G.sub(p[(i+2)%3],v))))).indexOf(Math.min(...p.map((v,i)=>Math.abs(G.dot(unit(G.sub(p[(i+1)%3],v)),unit(G.sub(p[(i+2)%3],v)))))));
   const out=p.map(v=>({...v}));if(index!==right){const v=G.sub(p[index],p[right]),u=unit(v),length=Math.max(.15,G.dot(G.sub(target,p[right]),u));out[index]=G.add(p[right],G.mul(u,length));}
   else{const a=p[(right+1)%3],b=p[(right+2)%3],c=G.mul(G.add(a,b),.5),r=G.dist(a,b)/2;let vector=G.sub(target,c);if(G.len(vector)<1e-8)vector=G.sub(p[right],c);let d=unit(vector);let q=G.add(c,G.mul(d,r));if(G.dist(q,a)<.15||G.dist(q,b)<.15)return p;out[right]=q;}return out;
  }
  const attempt=t=>p.map((v,i)=>i===index?G.add(v,G.mul(G.sub(target,v),t)):{...v});
  const valid=q=>area(q)>.03&&(o.angle==='any'||!o.angle||triangleType(q)===o.angle)&&q.every((v,i)=>G.dist(v,q[(i+1)%q.length])>.15);
  if(valid(attempt(1)))return attempt(1);let lo=0,hi=1;for(let k=0;k<32;k++){const mid=(lo+hi)/2;if(valid(attempt(mid)))lo=mid;else hi=mid;}return attempt(lo*.999);
 }
 let u=unit(G.sub(p[1],p[0])),v={x:-u.y,y:u.x};
 if(o.kind==='rhombus'||o.kind==='kite'){u=unit(G.sub(p[2],p[0]));v={x:-u.y,y:u.x};}
 const anchor=o.kind==='triangle'?center:p[(index+Math.floor(p.length/2))%p.length],a=G.sub(p[index],anchor),b=G.sub(target,anchor);
 let sx=Math.abs(G.dot(a,u))>.05?clamp(G.dot(b,u)/G.dot(a,u),.05,100):1,sy=Math.abs(G.dot(a,v))>.05?clamp(G.dot(b,v)/G.dot(a,v),.05,100):1;
 if(o.kind==='triangle'&&sides==='isosceles'){
  const half=G.dist(p[0],p[1])/2,h=G.dist(p[2],G.mul(G.add(p[0],p[1]),.5));
  if(o.angle==='acute')sy=Math.max(sy,half*sx/h*1.015);
  if(o.angle==='obtuse')sy=Math.min(sy,half*sx/h*.985);
 }
 return p.map(q=>{const d=G.sub(q,anchor);return G.add(anchor,G.add(G.mul(u,G.dot(d,u)*sx),G.mul(v,G.dot(d,v)*sy)));});
}
function fixedEndpoint(a,target,length){const d=G.sub(target,a),u=G.len(d)>1e-10?unit(d):{x:1,y:0};return G.add(a,G.mul(u,length));}
function scene(state){return {points:copy(state.points),objects:copy(state.objects)};}
function diff(before,after){const old=new Map([...before.points,...before.objects].map(o=>[o.id,JSON.stringify(o)])),now=[...after.points,...after.objects],ids=new Set(now.map(o=>o.id));return {p:after.points.filter(o=>old.get(o.id)!==JSON.stringify(o)),o:after.objects.filter(o=>old.get(o.id)!==JSON.stringify(o)),r:[...old.keys()].filter(id=>!ids.has(id))};}
function apply(base,patch){const removed=new Set(patch.r||[]);for(const [key,list]of [['points',patch.p||[]],['objects',patch.o||[]]]){const updates=new Map(list.map(o=>[o.id,copy(o)])),result=base[key].filter(o=>!removed.has(o.id)).map(o=>{const v=updates.get(o.id)||o;updates.delete(o.id);return v;});result.push(...updates.values());base[key]=result;}return base;}
function at(construction,index){const result=copy(construction.base);for(const step of construction.steps.slice(0,index))apply(result,step.patch);return result;}
function compact(state,view){const c=state.construction||{base:scene(state),steps:[]};return {v:2,b:[c.base.points,c.base.objects],s:c.steps.map(s=>[s.text,s.patch.p||[],s.patch.o||[],s.patch.r||[]]),d:state.defaults,t:state.settings,w:view};}
function expand(data){if(data?.v!==2||!Array.isArray(data.b)||data.b.length!==2||!Array.isArray(data.s)||data.s.length>2000)throw Error('Neplatný odkaz Geometry.');const construction={base:{points:data.b[0],objects:data.b[1]},steps:data.s.map(s=>{if(!Array.isArray(s)||s.length!==4||typeof s[0]!=='string'||s[0].length>1000||!s.slice(1).every(Array.isArray))throw Error('Neplatný krok konstrukce.');return {text:s[0],patch:{p:s[1],o:s[2],r:s[3]}};})};const result=at(construction,construction.steps.length);return {state:{version:1,nextId:1,...result,defaults:data.d,settings:data.t,construction},view:data.w};}
function base64(bytes){let str='';for(let i=0;i<bytes.length;i+=8192)str+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
async function encode(state,view){const bytes=new TextEncoder().encode(JSON.stringify(compact(state,view)));if(typeof CompressionStream==='function'){const stream=new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));const compressed=new Uint8Array(await new Response(stream).arrayBuffer());return 'z'+base64(compressed);}return 'j'+base64(bytes);}
async function decode(code){if(typeof code!=='string'||code.length>2000000||!/^[zj][\w-]+$/.test(code))throw Error('Neplatný nebo příliš velký odkaz.');const raw=code.slice(1).replace(/-/g,'+').replace(/_/g,'/');let bytes=Uint8Array.from(atob(raw),c=>c.charCodeAt(0));if(code[0]==='z'){if(typeof DecompressionStream!=='function')throw Error('Tento prohlížeč neumí rozbalit odkaz. Otevři jej v novějším prohlížeči.');const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();const chunks=[];let total=0;while(true){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>8000000){await reader.cancel();throw Error('Nákres v odkazu je příliš velký.');}chunks.push(value);}bytes=new Uint8Array(total);let i=0;for(const c of chunks){bytes.set(c,i);i+=c.length;}}if(bytes.length>8000000)throw Error('Nákres v odkazu je příliš velký.');return expand(JSON.parse(new TextDecoder().decode(bytes)));}
return {area,angle,triangleType,constrainedResize,fixedEndpoint,scene,diff,apply,at,compact,expand,encode,decode};
});
