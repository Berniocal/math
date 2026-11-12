const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const G=require('./core.js');
class Node {
 constructor(id=''){this.id=id;this.value='';this.checked=true;this.dataset={};this.style={};this.children=[];this.events={};this.classList={toggle(){}};}
 setAttribute(k,v){this[k]=String(v);} appendChild(n){this.children.push(n);return n;} replaceChildren(){this.children=[];} addEventListener(k,fn){(this.events[k]??=[]).push(fn);} removeEventListener(){} setPointerCapture(){} hasPointerCapture(){return false;} querySelectorAll(){return [];} focus(){} select(){} getBoundingClientRect(){return {x:0,y:0,left:0,top:0,width:900,height:550};}
}
function app(){const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,new Node(id));return nodes.get(id);};
 const document={getElementById:get,querySelectorAll:()=>[],createElementNS:()=>new Node(),createElement:()=>new Node(),createTextNode:s=>({textContent:s}),addEventListener(){},documentElement:new Node()};
 const window={Geometry:G,GeometryAdvanced:require('./advanced.js'),GeometryShapes:require('./shapes.js'),addEventListener(){}};const context=vm.createContext({window,document,localStorage:{getItem:()=>null,setItem(){}},ResizeObserver:class{observe(){}},requestAnimationFrame:()=>1,setTimeout:()=>1,console,Math,Blob,URL,URLSearchParams,location:{hash:''},innerHeight:900});
 let source=fs.readFileSync(__dirname+'/app.js','utf8');source=source.replace(/\}\)\(\);\s*$/,"globalThis.api={getState:()=>state,setState:s=>{state=s;invalidate();},initial,point,curve,createPoint,addObject,makeTwoPoint,makeConstraint,parts,snap,validData,normalize,undo,redo,transact,deleteSelection,select:id=>selected=id,setTool,editProperty,makeAngle,segmentEndpoint,lockSegment,measurementSummary,recordConstruction,showReplay,leaveReplay,validConstruction,beginShape,prepareShape,placementPoints,commitShape,rotatePlacement,rotateSelected,labelDescriptor};})();");vm.runInContext(source,context);context.api.node=get;return context.api;
}
function triangle(a){const s=a.initial();s.nextId=5;s.points=[{id:'p1',x:-3,y:1,label:'A',owner:'o4',style:{color:'#355fe0',width:2}},{id:'p2',x:3,y:1,label:'B',owner:'o4',style:{color:'#355fe0',width:2}},{id:'p3',x:1,y:-3,label:'C',owner:'o4',style:{color:'#355fe0',width:2}}];s.objects=[{id:'o4',type:'polygon',vertices:['p1','p2','p3'],label:'ABC',color:'#355fe0',width:2,dash:'solid',sideLabels:['c','a','b']}];a.setState(s);return s;}
const near=(p,q)=>assert.ok(G.dist(p,q)<1e-7,JSON.stringify({p,q}));
test('median and its midpoint are named and remain attached when the triangle moves',()=>{
 const a=app(),s=triangle(a);const mid=a.snap({x:0,y:1});assert.equal(mid.dep.kind,'ratio');assert.equal(mid.dep.t,.5);
 const o=a.makeTwoPoint('segment',{existing:'p3',...a.point('p3')},mid);assert.equal(o.label,'t_c');const p=s.points.find(p=>p.id===o.b);assert.equal(p.label,'S_c');near(a.point(p.id),{x:0,y:1});
 for(const p of s.points.filter(p=>p.owner)){p.x+=2;p.y-=3;}near(a.point(o.b),{x:2,y:-2});
 assert.ok(a.validData(s));
});
test('height uses an exact foot on the supporting side and names both objects',()=>{
 const a=app(),s=triangle(a),o=a.makeConstraint('perp','o4:1',{existing:'p1',...a.point('p1')});assert.equal(o.label,'v_a');assert.equal(s.points.find(p=>p.id===o.foot).label,'A_0');const base=a.curve('o4:1'),height=a.curve(o.id);assert.ok(Math.abs(G.dot(G.sub(base.b,base.a),G.sub(height.b,height.a)))<1e-8);near(a.point(o.foot),G.project(a.point('p1'),base.a,base.b));assert.ok(a.validData(s));
});
test('both diagonals receive e/f, and fractions can be disabled independently',()=>{
 const a=app(),s=triangle(a);s.points.push({id:'p5',x:-3,y:-3,label:'D',owner:'o4',style:{color:'#355fe0',width:2}});s.nextId=6;s.objects[0].vertices.push('p5');s.objects[0].sideLabels=['','','',''];
 const ac=a.makeTwoPoint('segment',{existing:'p1',...a.point('p1')},{existing:'p3',...a.point('p3')});assert.equal(ac.label,'e');const bd=a.makeTwoPoint('segment',{existing:'p2',...a.point('p2')},{existing:'p5',...a.point('p5')});assert.equal(bd.label,'f');
 s.settings.parts=[2,3,4,5,8];assert.ok(a.parts().some(p=>p.dep.t===.125));s.settings.snapParts=false;assert.equal(a.parts().length,0);
});
test('intersection points recompute, invalid intersections disappear, and circles support snapping',()=>{
 const a=app(),s=a.initial();a.setState(s);const p=(x,y)=>a.createPoint({x,y}),h=a.addObject({type:'line',a:p(-3,0),b:p(3,0)}),v=a.addObject({type:'line',a:p(1,-3),b:p(1,3)});const hit=a.snap({x:1.01,y:.01});assert.equal(hit.dep.kind,'intersection');const id=a.createPoint(hit);near(a.point(id),{x:1,y:0});s.points.find(p=>p.id===v.a).x=2;s.points.find(p=>p.id===v.b).x=2;near(a.point(id),{x:2,y:0});
 s.points.find(p=>p.id===v.a).x=-3;s.points.find(p=>p.id===v.a).y=1;s.points.find(p=>p.id===v.b).x=3;s.points.find(p=>p.id===v.b).y=1;assert.equal(a.point(id),null);
 const c=a.addObject({type:'circle',center:p(0,0),through:p(2,0)});assert.equal(G.intersections(a.curve(c.id),a.curve(h.id)).length,2);
});
test('undo/redo and cascading deletion preserve construction integrity',()=>{
 const a=app(),s=triangle(a);a.transact(()=>a.makeConstraint('perp','o4:1',{existing:'p1',...a.point('p1')}));assert.equal(a.getState().objects.length,2);a.undo();assert.equal(a.getState().objects.length,1);a.redo();assert.equal(a.getState().objects.length,2);a.select('o4');a.deleteSelection();assert.equal(a.getState().objects.length,0);assert.equal(a.getState().points.length,0);a.undo();assert.ok(a.validData(a.getState()));assert.equal(a.getState().objects.length,2);
});
test('a height also recognizes a separately drawn supporting line and coincident feet keep aliases',()=>{
 const a=app(),s=triangle(a);const base=a.makeTwoPoint('line',{existing:'p1',...a.point('p1')},{existing:'p2',...a.point('p2')});const h=a.makeConstraint('perp',base.id,{existing:'p3',...a.point('p3')});assert.equal(h.label,'v_c');
 const b=app(),bs=triangle(b);bs.points.find(p=>p.id==='p3').x=0;const midpoint=b.createPoint({x:0,y:1,dep:{kind:'ratio',edge:'o4:0',t:.5}});const h2=b.makeConstraint('perp','o4:0',{existing:'p3',...b.point('p3')});assert.equal(h2.foot,midpoint);assert.equal(bs.points.find(p=>p.id===midpoint).label,'S_c');assert.ok(bs.points.find(p=>p.id===midpoint).aliases.includes('C_0'));
});
function mouse(a,type,x,y,extra={}){const e={button:0,pointerId:1,clientX:450+x*44,clientY:275+y*44,preventDefault(){},target:{closest(){return null;}},...extra};for(const fn of a.node('plot').events[type]||[])fn(e);}
test('compass pointer workflow accumulates a complete turn through the zero-angle boundary',()=>{
 for(const direction of [1,-1]){const a=app();a.setTool('arc');mouse(a,'pointerdown',0,0);mouse(a,'pointerdown',2,0);mouse(a,'pointerdown',2,0);for(let i=1;i<=32;i++){const angle=direction*i*2*Math.PI/32;mouse(a,'pointermove',2*Math.cos(angle),2*Math.sin(angle));}mouse(a,'pointerup',2,0);const s=a.getState();assert.equal(s.objects.length,1);assert.equal(s.objects[0].type,'circle');assert.ok(Math.abs(a.curve(s.objects[0].id).r-2)<1e-8);assert.ok(a.validData(s));}
});
test('compass release keeps a partial directed arc rather than a full circle',()=>{
 const a=app();a.setTool('arc');mouse(a,'pointerdown',0,0);mouse(a,'pointerdown',2,0);mouse(a,'pointerdown',2,0);for(let i=1;i<=8;i++){const angle=-i*Math.PI/16;mouse(a,'pointermove',2*Math.cos(angle),2*Math.sin(angle));}mouse(a,'pointerup',0,-2);const o=a.getState().objects[0];assert.equal(o.type,'arc');assert.ok(Math.abs(o.sweep+Math.PI/2)<1e-7);
});
test('fixed-length segment endpoints rotate and translate without changing five centimetres',()=>{
 const a=app();a.node('segmentMode').value='fixed';a.node('segmentLength').value='5';a.setTool('segment');mouse(a,'pointerdown',0,0);mouse(a,'pointerdown',3,4);const o=a.getState().objects[0];assert.equal(o.fixedLength,5);assert.equal(a.getState().points.find(p=>p.id===o.b).dep.kind,'distance');a.select(o.b);a.setTool('select');mouse(a,'pointerdown',3,4);mouse(a,'pointermove',-4,3);mouse(a,'pointerup',-4,3);assert.ok(Math.abs(G.dist(a.point(o.a),a.point(o.b))-5)<1e-7);assert.ok(a.validData(a.getState()));assert.match(a.getState().construction.steps[0].text,/\|AB\| = 5 cm/);
});
test('a protractor angle follows movement of its reference arm',()=>{
 const a=app();const v=a.createPoint({x:0,y:0}),arm=a.createPoint({x:3,y:0});let o;a.transact(()=>{o=a.makeAngle({existing:v,...a.point(v)},{existing:arm,...a.point(arm)},{angle:-Math.PI/3,degrees:60,radius:2,point:{x:1,y:-Math.sqrt(3)}});});const A=require('./advanced.js');assert.ok(Math.abs(A.angle(a.point(arm),a.point(v),a.point(o.end))*180/Math.PI-60)<1e-7);a.getState().points.find(p=>p.id===arm).y=2;assert.ok(Math.abs(A.angle(a.point(arm),a.point(v),a.point(o.end))*180/Math.PI-60)<1e-7);assert.ok(a.validData(a.getState()));
});
test('construction playback preserves complete final state and appearance changes do not create extra steps',()=>{
 const a=app();let o;a.transact(()=>{o=a.makeTwoPoint('segment',{x:0,y:0},{x:5,y:0});});assert.equal(a.getState().construction.steps.length,1);a.select(o.id);a.editProperty('showLengths',true);assert.equal(a.getState().construction.steps.length,1);assert.ok(a.validConstruction(a.getState().construction));a.showReplay(0);assert.equal(a.getState().objects.length,0);a.showReplay(1);assert.equal(a.getState().objects[0].showLengths,true);a.leaveReplay();assert.equal(a.getState().objects.length,1);a.undo();assert.equal(a.getState().objects[0].showLengths,undefined);assert.equal(a.getState().construction.steps.length,1);
});

function shapeApp(kind='square'){
 const a=app();a.node('quadType').value=kind;a.node('triangleAngle').value='any';a.node('isosceles').checked=false;a.node('equilateral').checked=false;a.node('vertexCount').value='5';a.node('shapeScale').value='1';a.node('placementRotation').value='0';a.node('exactSizes').checked=true;return a;
}
test('new drawing defaults are black and unfilled, and old automatic labels stay off the canvas',()=>{
 const a=shapeApp();assert.equal(a.initial().defaults.color,'#000000');assert.equal(a.initial().defaults.fill,false);
 const old=a.initial();delete old.appearanceVersion;old.defaults.color='#355fe0';old.defaults.fill=true;assert.equal(a.normalize(old).defaults.color,'#000000');assert.equal(old.defaults.fill,false);
 const chosen=a.initial();chosen.defaults.color='#355fe0';assert.equal(a.normalize(chosen).defaults.color,'#355fe0');
 const s=triangle(a);assert.equal(a.labelDescriptor('o4'),null);const segment=a.makeTwoPoint('segment',{x:8,y:8},{x:10,y:9});assert.equal(segment.label,'');segment.label=s.points.find(p=>p.id===segment.a).label+s.points.find(p=>p.id===segment.b).label;assert.equal(a.labelDescriptor(segment.id),null);segment.customLabel=true;assert.ok(a.labelDescriptor(segment.id));
});
test('exact rectangle placement follows the mouse, preserves dimensions and supports repeated colour',()=>{
 const a=shapeApp('rectangle');a.getState().defaults.color='#c00000';a.beginShape('quad');a.rotatePlacement(30);mouse(a,'pointermove',2,1);assert.equal(a.getState().objects.length,0);mouse(a,'pointerdown',2,1);const s=a.getState(),o=s.objects[0],p=o.vertices.map(id=>a.point(id));assert.equal(o.label,'');assert.equal(o.fill,false);assert.equal(o.color,'#c00000');p.forEach((_,i)=>assert.equal(s.points.find(v=>v.id===o.vertices[i]).style.color,'#c00000'));assert.ok(Math.abs(G.dist(p[0],p[1])-5)<1e-7);assert.ok(Math.abs(G.dist(p[1],p[2])-3)<1e-7);
 mouse(a,'pointerdown',-3,2);assert.equal(s.objects.length,2);assert.equal(s.objects[1].color,'#c00000');a.setTool('point');mouse(a,'pointerdown',9,4);assert.equal(s.points.at(-1).style.color,'#c00000');assert.ok(a.validConstruction(s.construction,s));
});
test('touch placement commits only at release and cancellation leaves the board unchanged',()=>{
 const a=shapeApp();a.beginShape('quad');mouse(a,'pointerdown',0,0,{pointerType:'touch'});assert.equal(a.getState().objects.length,0);mouse(a,'pointermove',3,2,{pointerType:'touch'});assert.equal(a.getState().objects.length,0);mouse(a,'pointerup',3,2,{pointerType:'touch'});const s=a.getState();assert.equal(s.objects.length,1);const p=s.objects[0].vertices.map(id=>a.point(id)),center=G.mul(p.reduce(G.add,{x:0,y:0}),.25);near(center,{x:3,y:2});
 mouse(a,'pointerdown',0,0,{pointerType:'touch'});mouse(a,'pointercancel',0,0,{pointerType:'touch'});assert.equal(s.objects.length,1);
});
test('invalid exact dimensions cannot be placed and can be corrected without reselecting a tool',()=>{
 const a=shapeApp('rectangle');a.beginShape('quad');const input=a.node('shapeDimensions').children[0].children[0];input.value='0';input.events.input[0]();mouse(a,'pointerdown',0,0);assert.equal(a.getState().objects.length,0);assert.equal(a.node('shapeError').hidden,false);input.value='7.5';input.events.input[0]();mouse(a,'pointerdown',0,0);const o=a.getState().objects[0];assert.ok(Math.abs(G.dist(a.point(o.vertices[0]),a.point(o.vertices[1]))-7.5)<1e-7);
});
test('proportional vertex resizing and rotation keep all side ratios and attached construction points',()=>{
 const a=shapeApp('rectangle');a.beginShape('quad');mouse(a,'pointerdown',0,0);a.setTool('select');const o=a.getState().objects[0],p=o.vertices.map(id=>a.point(id));a.getState().settings.snapGrid=false;const mid=a.createPoint({x:0,y:0,dep:{kind:'ratio',edge:o.id+':0',t:.5}});
 mouse(a,'pointerdown',p[0].x,p[0].y);mouse(a,'pointermove',p[0].x*1.5,p[0].y*1.5);mouse(a,'pointerup',p[0].x*1.5,p[0].y*1.5);let q=o.vertices.map(id=>a.point(id));assert.ok(Math.abs(G.dist(q[0],q[1])-7.5)<1e-7);assert.ok(Math.abs(G.dist(q[1],q[2])-4.5)<1e-7);a.select(o.id);a.rotateSelected(Math.PI/2);q=o.vertices.map(id=>a.point(id));near(a.point(mid),G.mul(G.add(q[0],q[1]),.5));assert.ok(Math.abs(G.dist(q[0],q[1])-7.5)<1e-7);assert.ok(a.validConstruction(a.getState().construction,a.getState()));a.undo();a.redo();assert.ok(a.validConstruction(a.getState().construction,a.getState()));
});
