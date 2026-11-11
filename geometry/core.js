/* Exact geometry used by the interactive drawing board; no DOM dependencies. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.Geometry=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const EPS=1e-8,TAU=2*Math.PI;
  const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y}),sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y}),mul=(a,t)=>({x:a.x*t,y:a.y*t});
  const dot=(a,b)=>a.x*b.x+a.y*b.y,cross=(a,b)=>a.x*b.y-a.y*b.x,len=a=>Math.hypot(a.x,a.y),dist=(a,b)=>len(sub(a,b));
  const near=(a,b,e=EPS)=>dist(a,b)<e,mod=(a,b)=>((a%b)+b)%b;
  function project(p,a,b){const d=sub(b,a),n=dot(d,d);if(n<EPS)return {...a,t:0};const t=dot(sub(p,a),d)/n;return {...add(a,mul(d,t)),t};}
  function onArc(p,c){if(c.type!=='arc'||Math.abs(c.sweep)>=TAU-EPS)return true;const angle=Math.atan2(p.y-c.c.y,p.x-c.c.x);return (c.sweep>=0?mod(angle-c.start,TAU):mod(c.start-angle,TAU))<=Math.abs(c.sweep)+EPS;}
  function inLine(t,l){return l.type!=='segment'||(t>=-EPS&&t<=1+EPS);}
  function intersections(a,b){
    const ac=a.type==='circle'||a.type==='arc',bc=b.type==='circle'||b.type==='arc';
    let out=[];
    if(!ac&&!bc){const u=sub(a.b,a.a),v=sub(b.b,b.a),den=cross(u,v);if(Math.abs(den)<EPS)return [];const w=sub(b.a,a.a),t=cross(w,v)/den,s=cross(w,u)/den;if(inLine(t,a)&&inLine(s,b))out=[add(a.a,mul(u,t))];}
    else if(ac&&bc){const d=dist(a.c,b.c);if(d<EPS||d>a.r+b.r+EPS||d<Math.abs(a.r-b.r)-EPS)return [];const x=(a.r*a.r-b.r*b.r+d*d)/(2*d),h2=a.r*a.r-x*x;if(h2<-EPS)return [];const u=mul(sub(b.c,a.c),1/d),p=add(a.c,mul(u,x)),v=mul({x:-u.y,y:u.x},Math.sqrt(Math.max(0,h2)));out=near(v,{x:0,y:0})?[p]:[add(p,v),sub(p,v)];}
    else {const c=ac?a:b,l=ac?b:a,d=sub(l.b,l.a),f=sub(l.a,c.c),A=dot(d,d);if(A<EPS)return [];const B=2*dot(d,f),C=dot(f,f)-c.r*c.r,D=B*B-4*A*C;if(D<-EPS)return [];const h=Math.sqrt(Math.max(0,D));for(const t of [(-B-h)/(2*A),(-B+h)/(2*A)])if(inLine(t,l)){const p=add(l.a,mul(d,t));if(!out.some(q=>near(p,q)))out.push(p);}}
    return out.filter(p=>(!ac||onArc(p,a))&&(!bc||onArc(p,b)));
  }
  function triangle(angle='any',sides='any',rng=Math.random){
    if(sides==='equilateral')return [{x:-2,y:1.1547005383792515},{x:2,y:1.1547005383792515},{x:0,y:-2.309401076758503}];
    if(sides==='isosceles') {const h=angle==='right'?2:angle==='obtuse'?0.7+rng()*.9:angle==='acute'?2.4+rng()*1.4:1+rng()*3;return [{x:-2,y:1},{x:2,y:1},{x:0,y:1-h}];}
    if(angle==='right')return [{x:-2,y:1.5},{x:2+rng(),y:1.5},{x:-2,y:-1-rng()*1.5}];
    if(angle==='obtuse')return [{x:-2,y:1},{x:2,y:1},{x:-.8+rng()*1.6,y:.05+rng()*.45}];
    if(angle==='acute')return [{x:-2,y:1},{x:2,y:1},{x:-.6+rng()*1.2,y:-1.7-rng()*1.5}];
    return [{x:-2,y:1},{x:2,y:1},{x:-1.5+rng()*3,y:-.2-rng()*3.2}];
  }
  function polygon(kind,n=5,rng=Math.random){
    const w=3.4+rng()*1.6,h=2+rng()*.8,s=.8+rng()*.8;
    switch(kind){
      case 'square':return [{x:-2,y:-2},{x:2,y:-2},{x:2,y:2},{x:-2,y:2}];
      case 'rectangle':return [{x:-w/2,y:-h/2},{x:w/2,y:-h/2},{x:w/2,y:h/2},{x:-w/2,y:h/2}];
      case 'parallelogram':return [{x:-w/2-s/2,y:-h/2},{x:w/2-s/2,y:-h/2},{x:w/2+s/2,y:h/2},{x:-w/2+s/2,y:h/2}];
      case 'rhombus':return [{x:-2.8,y:0},{x:0,y:-1.5},{x:2.8,y:0},{x:0,y:1.5}];
      case 'kite':return [{x:0,y:-2.6},{x:1.7,y:0},{x:0,y:1.3},{x:-1.7,y:0}];
      case 'trapezoid':return [{x:-1.1,y:-1.3},{x:1.5,y:-1.3},{x:2.6,y:1.3},{x:-2.6,y:1.3}];
      default:return Array.from({length:n},(_,i)=>({x:2.7*Math.cos(-Math.PI/2+i*TAU/n),y:2.7*Math.sin(-Math.PI/2+i*TAU/n)}));
    }
  }
  function transform(points,center,scale,rotation){const c=Math.cos(rotation),s=Math.sin(rotation);return points.map(p=>({x:center.x+scale*(p.x*c-p.y*s),y:center.y+scale*(p.x*s+p.y*c)}));}
  return {EPS,TAU,add,sub,mul,dot,cross,len,dist,near,mod,project,onArc,intersections,triangle,polygon,transform};
});
