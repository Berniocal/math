const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const E = require('./test-dopocet.js');
function rng(seed=1234567) {
  return ()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
}
// Nezávislá kontrola skutečným vyhodnocovačem původního editoru.
const source = fs.readFileSync(__dirname+(fs.existsSync(__dirname+'/index.html')?'/index.html':'/original.html'),'utf8');
function originalFunction(name) {
  const begin=source.indexOf('function '+name+'(');
  let end=source.indexOf('\nfunction ',begin+1);
  if(end<0)end=source.indexOf('\nasync function ',begin+1);
  return source.slice(begin,end);
}
const ctx=vm.createContext({Math});
for(const name of ['normalizeExpr','logBaseValue','evalJS'])vm.runInContext(originalFunction(name),ctx);
const evalOriginal=(calc,x)=>{
  const [l,r]=calc.split('=');return [ctx.evalJS(l,x),ctx.evalJS(r,x)];
};
async function generate(raw,targets,extra={}) {
  const result=await E.generate({raw,targets,rng:rng(),...extra});
  assert.ok(result.calc,result.message);
  for(const x of targets) {
    const [l,r]=evalOriginal(result.calc,x);
    assert.ok(Number.isFinite(l)&&Number.isFinite(r),result.calc);
    assert.ok(Math.abs(l-r)<1e-7*Math.max(1,Math.abs(l),Math.abs(r)),result.calc);
  }
  return result;
}

test('školní tvary mají zadané kořeny i v původním vyhodnocovači',async()=>{
  for(const [raw,targets] of [
    ['4*(x-2)+5=2*x+3',[3]],
    ['2*x^2-5*x+3=0',[2,3]],
    ['2*x^2-5*x+3=0',[2,2]],
    ['2*x^3-3*x^2+4*x-5=0',[-1,2,3]],
    ['(2*x-3)*(4*x+5)=0',[2,3]],
    ['(2*x-3)*(4*x+5)=0',[2,2]],
    ['((2*x+3)/(x-4))=5',[2]],
    ['logbase(2,3*x+4)=5',[2]],
    ['2*abs(3*x-4)+5=7',[2]],
    ['sqrt(2*x+3)=5',[3]],
    ['2*x+3=4',[0.5]],
    ['2*x+3=4',[-2/3]],
    ['2x+3=4',[0]],
    ['((2*x+3)/(4*x-5))=((6)/(7))',[2]]
  ])await generate(raw,targets);
});

test('obě větve absolutní hodnoty a sudé mocniny',()=>{
  for(const [raw,target,wanted] of [
    ['abs(3*x-4)=5',2,[1,11]],
    ['(3*x+4)^2=25',2,[-1,-11]],
    ['sqrt(3*x+4)=5',2,[19]],
    ['logbase(2,3*x+4)=5',2,[26]]
  ]) {
    const p=E.parse(raw);const leaf=p.numbers.find(n=>n.value===4&&!n.locked);
    const answers=E.inverse(p.expr,0,leaf.id,{x:target},{}).sort((a,b)=>a-b);
    assert.deepEqual(answers,wanted.sort((a,b)=>a-b));
  }
});

test('čísla uvnitř nelineárních operací nejsou falešné lineární parametry',()=>{
  for(const raw of ['logbase(2,3*x+4)=5','sqrt(3*x+4)=5','2/(3*x+4)=5','(3*x+4)^2=5']) {
    const p=E.parse(raw),leaf=p.numbers.find(n=>n.value===4);
    assert.equal(E.affine(p.expr,new Set([leaf.id]),{x:2},{}),null);
  }
});

test('zachová uzamčená čísla, celý exponent a základ logaritmu',async()=>{
  const raw='logbase(2,3*x+4)=5',keep=Array(raw.length).fill(false);
  const at=raw.indexOf('3');keep[at]=true;
  const r=await generate(raw,[2],{keep});
  assert.match(r.calc,/logbase\(2,3\*x/);
  const p=E.parse('2*x^(1/(2+3))+4=5');
  const numbers=p.numbers.slice(1,4);
  assert.ok(numbers.length>=3);
  assert.ok(numbers.every(n=>n.locked));
});

test('přísný rozsah a zachování jediné volné konstanty mimo rozsah zámků',async()=>{
  const raw='100*x+2=3',keep=Array(raw.length).fill(false);
  for(let i=0;i<3;i++)keep[i]=true;
  const r=await generate(raw,[0.1],{keep,min:1,max:20});
  assert.match(r.calc,/^100\*x/);
  const p=E.parse(r.calc);
  for(const n of p.numbers.slice(1))assert.ok(Math.abs(n.value)<=20);
});

test('žádné neplatné odmocniny, logaritmy nebo nulové jmenovatele',async()=>{
  for(const [raw,target] of [['2/(x-3)=4',3],['sqrt(x-3)+2=4',2],['logbase(1,2*x+3)=4',2]]) {
    const keep=Array(raw.length).fill(true);
    // Odemkni pouze číslo na pravé straně: definiční obor se nesmí obcházet.
    keep[raw.length-1]=false;
    const result=await E.generate({raw,targets:[target],keep,rng:rng()});
    assert.equal(result.calc,null,raw);
  }
});

test('dvojnásobný kořen je skutečně dvojnásobný a všechny kořeny jsou uvedeny',async()=>{
  const r=await generate('2*x^2-5*x+3=0',[2,2]);
  assert.deepEqual(r.roots,[2]);assert.equal(r.complete,true);
  const p=E.rational(E.parse(r.calc).expr,{}).p;
  assert.equal(p[1]*p[1]-4*p[2]*p[0],0);
  const higher=await generate('2*x^3-3*x^2+4*x-5=0',[-1,2,3]);
  assert.deepEqual(higher.roots,[-1,2,3]);assert.equal(higher.complete,true);
});

test('identita ani konstanta se nevydávají za novou rovnici',async()=>{
  const raw='2*x=3*x';const r=await E.generate({raw,targets:[3],rng:rng(),min:1,max:5});
  assert.equal(r.calc,null);
});

test('vyloučí opakované varianty bez skrytého návratu k původnímu hledání',async()=>{
  const used=new Set();
  for(let i=0;i<12;i++) {
    const r=await generate('2*x+3=4',[2],{rng:rng(i+15),reject:calc=>used.has(calc)});
    assert.ok(!used.has(r.calc));used.add(r.calc);
  }
});

test('omezený a nesplnitelný požadavek nevrací falešné řešení',async()=>{
  const raw='2*x+3=4',keep=Array(raw.length).fill(true);keep[raw.length-1]=false;
  const r=await E.generate({raw,targets:[1000],keep,min:1,max:5,rng:rng()});
  assert.equal(r.calc,null);assert.ok(r.stats.sets<=48);
  assert.match(r.message,/Neznamená to/);
  await assert.rejects(E.generate({raw,targets:[NaN]}));
  assert.throws(()=>E.parse('x<3'));
  assert.throws(()=>E.parse('alert(2)=3'));
});

test('souřadnice řešení pro dva a tři neznámé',async()=>{
  for(const env of [{x:2,y:3},{x:2,y:3,z:-1}]) {
    const raw='2*x+3*y'+('z'in env?'-4*z':'')+'=7';
    const result=await E.generate({raw,envs:[env],rng:rng()});
    assert.ok(result.calc);
    const p=E.parse(result.calc);
    assert.ok(Math.abs(E.value(p.expr,env,{}))<1e-8);
  }
});

test('napojení editoru rozliší nezávislé a závislé soustavy',()=>{
  const ui=vm.createContext({EquationBacksolve:E,generateSimilar:()=>{}});
  vm.runInContext(fs.readFileSync(__dirname+'/test-dopocet-ui.js','utf8'),ui);
  for(const [lines,vars,rank] of [
    [['2*x+3*y=7','4*x-2*y=8'],['x','y'],2],
    [['2*x+3*y=7','4*x+6*y=14'],['x','y'],1],
    [['2*x+3*y+4*z=7','4*x-2*y+3*z=8','3*x+2*y-5*z=9'],['x','y','z'],3]
  ]) {
    const rows=lines.map(line=>ui.backsolveVariableForm(line,vars).a);
    assert.equal(ui.backsolveRowRank(rows),rank);
  }
  assert.equal(ui.backsolveVariableForm('2*x^2+3*y=7',['x','y']),null);
});

test('různá zadání a výsledky, žádný přijatý chybný příklad',async()=>{
  let successes=0;
  for(let seed=0;seed<150;seed++) {
    const random=rng(seed+1),a=1+Math.floor(random()*7),b=1+Math.floor(random()*7),x=seed%11-5;
    const raw=`${a}*(x-${b})+3=2*x+4`;
    const result=await E.generate({raw,targets:[x],rng:random,min:1,max:20});
    if(!result.calc)continue;
    successes++;
    const [l,r]=evalOriginal(result.calc,x);
    assert.ok(Number.isFinite(l)&&Number.isFinite(r)&&Math.abs(l-r)<1e-7,result.calc);
    assert.equal(result.complete,true);
    assert.deepEqual(result.roots,[x]);
  }
  assert.ok(successes>140,successes);
});
