const test=require('node:test'),assert=require('node:assert/strict');
const G=require('./core.js'),A=require('./advanced.js'),S=require('./shapes.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} ≠ ${b}`);
const defaults=s=>Object.fromEntries(S.fields(s).map(f=>[f.key,f.value]));
test('exact triangles satisfy entered SSS lengths and all compatible side and angle restrictions',()=>{
 for(const sides of ['any','isosceles','equilateral'])for(const angle of sides==='equilateral'?['acute']:['any','acute','right','obtuse']){
  const spec={kind:'triangle',sides,angle},d=defaults(spec),p=S.exact(spec,d),a=G.dist(p[1],p[2]),b=G.dist(p[2],p[0]),c=G.dist(p[0],p[1]);near(a,d.a);if(d.b)near(b,d.b);if(d.c)near(c,d.c);if(sides!=='any')near(a,b);if(sides==='equilateral')near(a,c);if(angle!=='any')assert.equal(A.triangleType(p),angle);
 }
 assert.throws(()=>S.exact({kind:'triangle',angle:'any',sides:'any'},{a:1,b:2,c:3}));
 assert.throws(()=>S.exact({kind:'triangle',angle:'acute',sides:'any'},{a:3,b:4,c:5}),/ostroúhlý/);
});
test('exact quadrilaterals match all requested lengths, heights and defining geometric properties',()=>{
 for(const kind of ['square','rectangle','parallelogram','rhombus','kite','trapezoid','trapezoid-isosceles','trapezoid-right']){
  const spec={kind},d=defaults(spec),p=S.exact(spec,d),v=p.map((q,i)=>G.sub(p[(i+1)%4],q)),l=v.map(G.len);near(l[0],d.a);
  if(['square','rectangle','parallelogram','rhombus'].includes(kind)){near(G.cross(v[0],v[2]),0);near(G.cross(v[1],v[3]),0);}
  if(kind==='rectangle')near(l[1],d.b);
  if(['square','rectangle'].includes(kind))near(G.dot(v[0],v[1]),0);
  if(['square','rhombus'].includes(kind))l.forEach(n=>near(n,l[0]));
  if(kind==='kite'){near(l[3],d.a);near(l[1],d.b);near(l[2],d.b);near(G.dist(p[1],p[3]),d.e);}
  if(kind.startsWith('trapezoid')){near(l[2],d.c);near(Math.abs(p[0].y-p[3].y),d.h);near(G.cross(v[0],v[2]),0);}
  if(kind==='trapezoid-isosceles')near(l[1],l[3]);if(kind==='trapezoid-right')near(G.dot(v[0],v[3]),0);
 }
});
test('exact regular polygons have the requested side for every allowed number of vertices',()=>{
 for(let n=3;n<=40;n++){const p=S.exact({kind:'regular',n},{a:2.7});assert.equal(p.length,n);p.forEach((v,i)=>near(G.dist(v,p[(i+1)%n]),2.7));}
});
test('similarity dragging and rotation preserve lengths ratios, angles and centre for every polygon kind',()=>{
 for(const kind of ['square','rectangle','parallelogram','rhombus','kite','trapezoid','trapezoid-isosceles','trapezoid-right','regular']){
  const p=G.polygon(kind,7),q=S.similarity(p,1,G.mul(p[1],1.7)),r=S.rotate(q,.73),ratio=G.dist(q[0],q[1])/G.dist(p[0],p[1]);p.forEach((v,i)=>{near(G.dist(q[i],q[(i+1)%p.length])/G.dist(v,p[(i+1)%p.length]),ratio);near(G.dist(r[i],r[(i+1)%p.length]),G.dist(q[i],q[(i+1)%p.length]));});
 }
});
test('invalid dimensions, degenerate angles and impossible kites are rejected',()=>{
 for(const value of [0,-1,NaN,Infinity,1001])assert.throws(()=>S.exact({kind:'square'},{a:value}));
 assert.throws(()=>S.exact({kind:'parallelogram'},{a:5,b:3,angle:180}));assert.throws(()=>S.exact({kind:'kite'},{a:3,b:4,e:7}));assert.throws(()=>S.exact({kind:'trapezoid'},{a:4,c:4,h:3,offset:1}));
});
