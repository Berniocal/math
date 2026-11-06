/* Napojení experimentu na kopii původního editoru. */
const originalGenerateSimilar = generateSimilar;
let backsolveBusy = false;

function loadBacksolveExample(which) {
  const examples = {
    linear: ['4*(x-2)+5=2*x+3', ['3']],
    quadratic: ['2*x^2-5*x+3=0', ['2','3']],
    fraction: ['((2*x+3)/(x-4))=5', ['2']],
    logarithm: ['logbase(2,3*x+4)=5', ['2']],
    absolute: ['2*abs(3*x-4)+5=7', ['2']],
    radical: ['sqrt(2*x+3)=5', ['3']],
    system: ['2*x+3*y=7\n4*x-2*y=8', ['2','3']]
  };
  const example = examples[which];
  if (!example || backsolveBusy) return;
  save(); root=calcTextToNodes(example[0]); path=[]; cursor=root.length;
  render(); updateDebug(); refreshGeneratorTargets(true);
  example[1].forEach((v,i)=>{const el=document.getElementById('target_'+i);if(el)el.value=v;});
  lastGeneratedCalc='';lastGeneratedLatex='';
  document.getElementById('generated').textContent='Vytvoř nový příklad z připravené ukázky.';
  document.getElementById('backsolveStatus').textContent='Ukázka je připravená. Stiskni Vytvořit.';
  hideKb();
}

function backsolveVariableForm(calc, vars) {
  const parsed=EquationBacksolve.parse(calc);
  function convert(n) {
    if(n.type==='variable' && vars.includes(n.name)) return {type:'number',id:10000+vars.indexOf(n.name),value:0};
    if(n.type==='number')return {...n,id:-1};
    if(n.type==='binary')return {...n,left:convert(n.left),right:convert(n.right)};
    if(n.type==='unary')return {...n,arg:convert(n.arg)};
    if(n.type==='function')return {...n,args:n.args.map(convert)};
    return n;
  }
  return EquationBacksolve.affine(convert(parsed.expr),new Set(vars.map((_,i)=>10000+i)),{},{});
}

function backsolveRowRank(rows) {
  const m=rows.map(r=>{const s=Math.max(...r.map(Math.abs));return r.map(x=>s?x/s:x);});
  let rank=0;
  for(let c=0;c<(m[0]?.length||0);c++) {
    let p=rank;
    for(let r=rank;r<m.length;r++)if(Math.abs(m[r][c])>Math.abs(m[p]?.[c]||0))p=r;
    if(!m[p]||Math.abs(m[p][c])<1e-10)continue;
    [m[p],m[rank]]=[m[rank],m[p]];
    const d=m[rank][c];for(let j=c;j<m[rank].length;j++)m[rank][j]/=d;
    for(let r=rank+1;r<m.length;r++){const f=m[r][c];for(let j=c;j<m[r].length;j++)m[r][j]-=f*m[rank][j];}
    rank++;
  }
  return rank;
}

generateSimilar = async function () {
  if(backsolveBusy)return;
  if(document.getElementById('backsolveMode').value==='original') {
    document.getElementById('backsolveStatus').textContent='Použit původní generátor.';
    return originalGenerateSimilar();
  }
  const box=document.getElementById('generated'), status=document.getElementById('backsolveStatus');
  const button=document.getElementById('generateButton');
  let snapshot='';
  const snapshotNow=()=>JSON.stringify({marked:calcMarkedA(root),inputs:[...document.querySelectorAll('#targetBox input')].map(el=>el.value),limits:coeffLimits()});
  try {
    refreshGeneratorTargets(true);
    const marked=calcMarkedA(root),raw=marked.s;
    if(hasInequality(raw))throw Error('Testovací dopočet je zatím určený pro rovnice a soustavy. Pro nerovnice přepni na původní generátor.');
    const mode=detectGeneratorMode(), {minCoeff,maxCoeff}=coeffLimits();
    const inputs=[...document.querySelectorAll('#targetBox input')];
    const targetValues=inputs.map(el=>parseTargetNumber(el.value));
    if(inputs.some((el,i)=>el.value.trim()&&targetValues[i]===null))throw Error('Některý výsledek není platné číslo. Lze zadat i zlomek, například 1/2.');
    const lines=[...raw.matchAll(/[^\n;]+/g)].filter(m=>m[0].trim());
    if(!lines.length||lines.length>3)throw Error('Zadej jednu rovnici nebo soustavu dvou či tří rovnic.');
    const system=lines.length>1, vars=['x','y','z'].slice(0,lines.length);
    const vector=Object.fromEntries(vars.map((v,i)=>[v,targetValues[i]??(i+1)]));
    let targets=targetValues.filter(x=>x!==null);
    if(!targets.length)targets=[3];
    snapshot=snapshotNow();
    backsolveBusy=true; button.disabled=true;button.textContent='Dopočítávám…';
    status.textContent='Volím volná čísla a dopočítávám zbývající koeficienty.';
    lastGeneratedCalc='';lastGeneratedLatex='';
    await sleep0();
    const results=[],rows=[];
    for(const line of lines) {
      const offset=line.index, text=line[0];
      const result=await EquationBacksolve.generate({
        raw:text,keep:marked.keep.slice(offset,offset+text.length),
        targets:system?[]:targets,envs:system?[vector]:undefined,
        min:minCoeff,max:maxCoeff,yield:sleep0,
        reject:calc=>{
          if(!system)return isRepeatedGeneratedCandidate(calc);
          const candidate=results.map(r=>r.calc).concat(calc).join('\n');
          if(isRepeatedGeneratedCandidate(candidate))return true;
          const form=backsolveVariableForm(calc,vars);
          return !!form && rows.every(Boolean) && backsolveRowRank(rows.map(r=>r.a).concat([form.a]))<rows.length+1;
        }
      });
      results.push(result);
      if(!result.calc)break;
      if(system)rows.push(backsolveVariableForm(result.calc,vars));
    }
    if(snapshot!==snapshotNow()) {status.textContent='Zadání se během výpočtu změnilo. Stiskni znovu Vytvořit.';return;}
    const total=results.reduce((s,r)=>({sets:s.sets+r.stats.sets,calculations:s.calculations+r.stats.calculations,ms:s.ms+r.stats.ms}),{sets:0,calculations:0,ms:0});
    const failed=results.find(r=>!r.calc);
    status.textContent=`Přímé výpočty: ${total.calculations} · Volby volných čísel: ${total.sets} · Čas: ${total.ms} ms`;
    if(failed) {box.textContent=failed.message;return;}
    lastGeneratedCalc=results.map(r=>r.calc).join('\n');
    rememberGeneratedCandidate(lastGeneratedCalc);
    lastGeneratedLatex=system?'\\left\\{\\begin{aligned}'+results.map(r=>calcToLatexSimple(r.calc)).join('\\\\')+'\\end{aligned}\\right.':calcToLatexSimple(lastGeneratedCalc);
    let info='';
    if(system) {
      info='Ověřeno dosazením: \\('+vars.map(v=>v+'='+fmtLatexNumber(vector[v])).join(',\\quad ')+'\\).';
      info+=rows.every(Boolean)&&backsolveRowRank(rows.map(r=>r.a))===vars.length?' Lineární soustava má právě toto jedno řešení.':' U této soustavy mohou existovat i další řešení.';
    } else {
      const result=results[0];
      if(result.complete) info='Všechna reálná řešení: \\(x\\in\\{'+result.roots.map(fmtLatexNumber).join(';\\,')+'\\}\\).';
      else info='Ověřeno v definičním oboru: \\(x='+[...new Set(targets)].map(fmtLatexNumber).join(';\\,')+'\\). Úplná množina řešení tohoto tvaru zde zatím není ověřena; může obsahovat i další hodnoty.';
    }
    box.innerHTML='\\['+lastGeneratedLatex+'\\]<div class="muted">'+info+'</div>';
    const detail=document.createElement('details');
    const summary=document.createElement('summary');summary.textContent='Jak vznikl příklad';detail.append(summary);
    const p=document.createElement('p');
    p.textContent=results.map((r,i)=>(system?'Řádek '+(i+1)+': ':'')+r.stats.method+'. Dopočtená čísla: '+r.dependent.map(d=>d.to).join(', ')+'.').join(' ');
    detail.append(p);box.append(detail);
    if(window.MathJax)await MathJax.typesetPromise([box]);
  } catch(e) {
    lastGeneratedCalc='';lastGeneratedLatex='';
    box.textContent=e.message || 'Dopočet se nepodařil.';
    status.textContent='Testovací dopočet skončil bez nového příkladu.';
  } finally {
    backsolveBusy=false;button.disabled=false;button.textContent='Vytvořit';
  }
};
