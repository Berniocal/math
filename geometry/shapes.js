/* Shape dimensions in centimetres; keeps construction rules independent of the UI. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./core.js'):root.Geometry,typeof module==='object'&&module.exports?require('./advanced.js'):root.GeometryAdvanced);if(typeof module==='object'&&module.exports)module.exports=api;else root.GeometryShapes=api;})(typeof globalThis==='object'?globalThis:this,function(G,A){
'use strict';
const names={square:'Čtverec',rectangle:'Obdélník',parallelogram:'Kosodélník',rhombus:'Kosočtverec',kite:'Deltoid',trapezoid:'Obecný lichoběžník','trapezoid-isosceles':'Rovnoramenný lichoběžník','trapezoid-right':'Pravoúhlý lichoběžník',regular:'Pravidelný n-úhelník',triangle:'Trojúhelník'};
const field=(key,label,value,unit='cm')=>({key,label,value,unit});
function fields(spec){
 const {kind,sides,angle}=spec;
 if(kind==='triangle'){
  if(sides==='equilateral')return [field('a','Délka strany',5)];
  if(sides==='isosceles')return angle==='right'?[field('a','Délka ramene',4)]:[field('c','Základna c = |AB|',6),field('a','Ramena a = b',angle==='obtuse'?3.2:5)];
  return angle==='right'?[field('a','Odvěsna a = |BC|',3),field('b','Odvěsna b = |CA|',4)]:[field('a','Strana a = |BC|',angle==='obtuse'?8:5),field('b','Strana b = |CA|',5),field('c','Strana c = |AB|',6)];
 }
 if(kind==='square'||kind==='regular')return [field('a','Délka strany',kind==='regular'?3:4)];
 if(kind==='rectangle')return [field('a','Strana a',5),field('b','Strana b',3)];
 if(kind==='parallelogram'||kind==='rhombus')return [field('a','Strana a',5),...(kind==='parallelogram'?[field('b','Strana b',3)]:[]),field('angle','Úhel u vrcholu A',60,'°')];
 if(kind==='kite')return [field('a','Strany AB = AD',4),field('b','Strany BC = CD',3),field('e','Úhlopříčka BD',4)];
 return [field('a','Základna AB',6),field('c','Základna CD',3),field('h','Výška',3),...(kind==='trapezoid'?[field('offset','Posun horní základny',1)]:[])];
}
function center(points){const c=G.mul(points.reduce(G.add,{x:0,y:0}),1/points.length);return points.map(p=>G.sub(p,c));}
function exact(spec,d){
 for(const f of fields(spec)){const v=d[f.key];if(!Number.isFinite(v)||Math.abs(v)>1000||(f.key!=='offset'&&v<=0))throw Error('Zadej platné kladné rozměry do 1000 cm.');}
 const {kind,sides,angle,n=5}=spec;let {a,b,c,h,offset=0}=d;let p;
 if(kind==='triangle'){
  if(sides==='equilateral')b=c=a;
  else if(sides==='isosceles'){b=a;if(angle==='right')c=a*Math.SQRT2;}
  else if(angle==='right')c=Math.hypot(a,b);
  if(!(a+b>c+1e-7&&a+c>b+1e-7&&b+c>a+1e-7))throw Error('Z těchto délek nejde sestrojit trojúhelník. Součet dvou stran musí být větší než třetí.');
  const x=(b*b+c*c-a*a)/(2*c),y=Math.sqrt(Math.max(0,b*b-x*x));p=[{x:0,y:0},{x:c,y:0},{x,y:-y}];
  if(angle!=='any'&&A.triangleType(p)!==angle)throw Error('Zadané strany netvoří '+({acute:'ostroúhlý',right:'pravoúhlý',obtuse:'tupoúhlý'})[angle]+' trojúhelník. Uprav délky nebo vyber Obecný.');
 }else if(kind==='regular'){
  if(!Number.isInteger(n)||n<3||n>40)throw Error('Počet vrcholů musí být celé číslo od 3 do 40.');
  const r=a/(2*Math.sin(Math.PI/n));p=Array.from({length:n},(_,i)=>({x:r*Math.cos(-Math.PI/2+i*G.TAU/n),y:r*Math.sin(-Math.PI/2+i*G.TAU/n)}));
 }else if(kind==='square'||kind==='rectangle'){b=kind==='square'?a:b;p=[{x:0,y:0},{x:a,y:0},{x:a,y:-b},{x:0,y:-b}];}
 else if(kind==='parallelogram'||kind==='rhombus'){
  if(!(d.angle>0&&d.angle<180))throw Error('Úhel musí být větší než 0° a menší než 180°.');
  b=kind==='rhombus'?a:b;const t=d.angle*Math.PI/180,x=b*Math.cos(t),y=-b*Math.sin(t);p=[{x:0,y:0},{x:a,y:0},{x:a+x,y},{x,y}];
 }else if(kind==='kite'){
  const z=d.e/2;if(z>=Math.min(a,b))throw Error('Úhlopříčka BD musí být kratší než dvojnásobek obou délek stran.');
  p=[{x:0,y:-Math.sqrt(a*a-z*z)},{x:z,y:0},{x:0,y:Math.sqrt(b*b-z*z)},{x:-z,y:0}];
 }else{
  if(Math.abs(a-c)<1e-7)throw Error('Lichoběžník musí mít dvě různě dlouhé základny.');
  if(kind==='trapezoid-isosceles')offset=(a-c)/2;if(kind==='trapezoid-right')offset=0;
  // AB and CD are parallel; a = |AB|, c = |CD|.
  p=[{x:0,y:0},{x:a,y:0},{x:offset+c,y:-h},{x:offset,y:-h}];
 }
 if(!p||A.area(p)<1e-6)throw Error('Útvar je příliš malý. Uprav jeho rozměry.');
 return center(p);
}
function similarity(p,index,target){const c=G.mul(p.reduce(G.add,{x:0,y:0}),1/p.length),u=G.sub(p[index],c),v=G.sub(target,c),scale=Math.max(.03,Math.min(100,G.len(v)/(G.len(u)||1)));return G.transform(p.map(q=>G.sub(q,c)),c,scale,Math.atan2(v.y,v.x)-Math.atan2(u.y,u.x));}
function rotate(p,angle){const c=G.mul(p.reduce(G.add,{x:0,y:0}),1/p.length);return G.transform(p.map(q=>G.sub(q,c)),c,1,angle);}
return {names,fields,center,exact,similarity,rotate};
});
