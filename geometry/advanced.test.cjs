const test=require('node:test'),assert=require('node:assert/strict');
const G=require('./core.js'),A=require('./advanced.js');
const close=(a,b,epsilon=1e-6)=>assert.ok(Math.abs(a-b)<epsilon,`${a} versus ${b}`);
const orient=(p,k)=>G.transform(p,{x:2,y:-1},1.3,k*.73);
function assertQuad(kind,p){const v=p.map((q,i)=>G.sub(p[(i+1)%4],q)),l=v.map(G.len);assert.ok(A.area(p)>0);
 if(['square','rectangle','parallelogram','rhombus','trapezoid','trapezoid-isosceles','trapezoid-right'].includes(kind))close(G.cross(v[0],v[2]),0);
 if(['square','rectangle','parallelogram','rhombus'].includes(kind))close(G.cross(v[1],v[3]),0);
 if(['square','rectangle','trapezoid-right'].includes(kind))close(G.dot(v[0],v[3]),0);
 if(['square','rhombus'].includes(kind))l.forEach(x=>close(x,l[0]));
 if(kind==='kite'){close(l[0],l[3]);close(l[1],l[2]);}
 if(kind==='trapezoid-isosceles')close(l[1],l[3]);
}
test('all quadrilateral handles preserve defining properties under independent dimension changes',()=>{
 for(const kind of ['square','rectangle','parallelogram','rhombus','kite','trapezoid','trapezoid-isosceles','trapezoid-right'])for(let k=0;k<7;k++)for(let i=0;i<4;i++){
  const p=orient(G.polygon(kind),k),target=G.add(p[i],{x:1.3*Math.cos(k),y:2.1*Math.sin(k+.3)}),q=A.constrainedResize({kind},p,i,target);assertQuad(kind,q);assert.ok(q.some((v,j)=>G.dist(v,p[j])>.00001));
 }
});
test('every triangle handle preserves angle class and equality constraints',()=>{
 for(const sides of ['any','isosceles','equilateral'])for(const angle of sides==='equilateral'?['acute']:['any','acute','right','obtuse'])for(let k=0;k<10;k++)for(let i=0;i<3;i++){
  const p=orient(G.triangle(angle,sides),k),q=A.constrainedResize({kind:'triangle',angle,sides},p,i,G.add(p[i],{x:Math.sin(k)*3,y:Math.cos(k)*2}));assert.ok(A.area(q)>.00001);
  if(angle!=='any')assert.equal(A.triangleType(q),angle);
  if(sides!=='any')close(G.dist(q[0],q[2]),G.dist(q[1],q[2]));
  if(sides==='equilateral')close(G.dist(q[0],q[1]),G.dist(q[1],q[2]));
 }
});
test('regular polygons resize and rotate as similarities',()=>{for(let n=3;n<=40;n++){const p=G.polygon('regular',n),q=A.constrainedResize({kind:'regular'},p,1,{x:5,y:4}),d=G.dist(q[0],q[1]);q.forEach((v,i)=>close(G.dist(v,q[(i+1)%n]),d));}});
test('distance constraints, areas and angles use mathematical centimetres',()=>{close(G.dist({x:2,y:3},A.fixedEndpoint({x:2,y:3},{x:-8,y:7},5)),5);close(A.area([{x:0,y:0},{x:5,y:0},{x:5,y:3},{x:0,y:3}]),15);close(A.angle({x:1,y:0},{x:0,y:0},{x:0,y:1})*180/Math.PI,90);});
test('construction patches replay additions, edits and removals without mutating the source',()=>{const base={points:[],objects:[]},one={points:[{id:'p1',x:0,y:0}],objects:[]},two={points:[{id:'p1',x:4,y:2},{id:'p2',x:3,y:1}],objects:[]},three={points:[{id:'p1',x:4,y:2}],objects:[]};const c={base,steps:[{patch:A.diff(base,one)},{patch:A.diff(one,two)},{patch:A.diff(two,three)}]};assert.deepEqual(A.at(c,0),base);assert.deepEqual(A.at(c,1),one);assert.deepEqual(A.at(c,2),two);assert.deepEqual(A.at(c,3),three);assert.deepEqual(base,{points:[],objects:[]});});
test('UTF-8 compressed base64url round-trip keeps the complete scene and all construction steps',async()=>{const construction={base:{points:[],objects:[]},steps:[]};let scene={points:[],objects:[]};for(let i=0;i<20;i++){const next=structuredClone(scene);next.points.push({id:'p'+i,label:'Bod č. '+i,x:Math.sqrt(i+2),y:i/7,style:{color:'#355fe0',width:2}});construction.steps.push({text:'Bod '+i+'; |AB| = 5 cm',patch:A.diff(scene,next)});scene=next;}const state={...scene,construction,defaults:{color:'#355fe0'},settings:{gridStep:.1}},view={x:2,y:1,scale:44};const code=await A.encode(state,view);assert.match(code,/^[zj][\w-]+$/);const restored=await A.decode(code);assert.deepEqual(restored.state.points,state.points);assert.deepEqual(restored.state.construction,construction);assert.deepEqual(restored.view,view);assert.ok(code.length<JSON.stringify(A.compact(state,view)).length/2);});
test('invalid share payloads are rejected',async()=>{await assert.rejects(A.decode('garbage'));await assert.rejects(A.decode('z%%%'));assert.throws(()=>A.expand({v:2,b:[[],[]],s:[['bad']]}));});
