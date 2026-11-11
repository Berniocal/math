const test=require('node:test');
const assert=require('node:assert/strict');
const G=require('./core.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function classify(p){const s=[G.dist(p[0],p[1])**2,G.dist(p[1],p[2])**2,G.dist(p[2],p[0])**2].sort((a,b)=>a-b);const delta=s[2]-s[1]-s[0];return {angle:Math.abs(delta)<1e-7?'right':delta>0?'obtuse':'acute',s};}
function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
test('all compatible triangle constraints hold over 1000 deterministic random samples',()=>{
 const rng=random(713);for(const angle of ['any','right','obtuse','acute'])for(const sides of ['any','isosceles'])for(let k=0;k<1000;k++){
  let p=G.triangle(angle,sides,rng);p=G.transform(p,{x:4,y:-2},.5+rng()*2,rng()*G.TAU);const q=classify(p);if(angle!=='any')assert.equal(q.angle,angle);if(sides==='isosceles')close(G.dist(p[0],p[2]),G.dist(p[1],p[2]));assert.ok(Math.abs(G.cross(G.sub(p[1],p[0]),G.sub(p[2],p[0])))>.01);
 }
 const eq=G.triangle('any','equilateral',rng),d=eq.map((p,i)=>G.dist(p,eq[(i+1)%3]));close(d[0],d[1]);close(d[1],d[2]);assert.equal(classify(eq).angle,'acute');
});
test('quadrilateral definitions and regular polygons survive rotation and scale',()=>{
 const rng=random(100);for(let k=0;k<100;k++)for(const kind of ['square','rectangle','parallelogram','rhombus','kite','trapezoid']){
  const p=G.transform(G.polygon(kind,4,rng),{x:-5,y:7},rng()+.5,rng()*G.TAU),v=p.map((q,i)=>G.sub(p[(i+1)%4],q)),l=v.map(G.len);
  if(['square','rectangle','parallelogram','rhombus','trapezoid'].includes(kind))close(G.cross(v[0],v[2]),0);
  if(['square','rectangle','parallelogram','rhombus'].includes(kind))close(G.cross(v[1],v[3]),0);
  if(['square','rectangle'].includes(kind))close(G.dot(v[0],v[1]),0);
  if(['square','rhombus'].includes(kind))for(const d of l)close(d,l[0]);
  if(kind==='kite'){close(l[0],l[3]);close(l[1],l[2]);}
 }
 for(let n=3;n<=40;n++){const p=G.polygon('regular',n),d=G.dist(p[0],p[1]);p.forEach((v,i)=>{close(G.dist(v,{x:0,y:0}),2.7);close(G.dist(v,p[(i+1)%n]),d);});}
});
test('intersections respect segments, tangency and directed arcs crossing zero',()=>{
 const line=(a,b,type='line')=>({a,b,type}),circle={type:'circle',c:{x:0,y:0},r:2};
 const h=line({x:-3,y:0},{x:3,y:0}),v=line({x:1,y:-4},{x:1,y:4});close(G.intersections(h,v)[0].x,1);
 assert.equal(G.intersections(h,line({x:1,y:3},{x:1,y:4},'segment')).length,0);
 assert.equal(G.intersections(h,line({x:0,y:1},{x:3,y:1})).length,0);
 const hits=G.intersections(h,circle);assert.equal(hits.length,2);close(hits[0].x,-2);close(hits[1].x,2);
 assert.equal(G.intersections(line({x:-5,y:2},{x:5,y:2}),circle).length,1);
 assert.equal(G.intersections(circle,{...circle,c:{x:4,y:0}}).length,1);
 assert.equal(G.intersections(circle,{...circle,c:{x:3,y:0}}).length,2);
 assert.equal(G.intersections(circle,circle).length,0);
 const arc={...circle,type:'arc',start:Math.PI*1.8,sweep:Math.PI*.4};const a=G.intersections(h,arc);assert.equal(a.length,1);close(a[0].x,2);
 assert.equal(G.intersections(h,{...arc,start:.3,sweep:-.6}).length,1);
 assert.equal(G.intersections(h,{...arc,start:1,sweep:.5}).length,0);
});
test('projection provides exact feet and division ratios outside a segment',()=>{
 const a={x:3,y:2},b={x:7,y:5},p={x:8,y:-3},foot=G.project(p,a,b);close(G.dot(G.sub(p,foot),G.sub(b,a)),0);close(G.cross(G.sub(foot,a),G.sub(b,a)),0);
 const far=G.project({x:100,y:90},a,b);assert.ok(far.t>1);
 for(const n of [2,3,4,5,8])for(let i=1;i<n;i++){const q=G.add(a,G.mul(G.sub(b,a),i/n));close(G.dist(a,q)/G.dist(a,b),i/n);}
});
