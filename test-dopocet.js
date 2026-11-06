/* Testovací generátor: rozbor výrazu, zpětné operace a lineární podmínky.
 * Žádné vzorkování koeficientu v 0/1 ani procházení všech jeho hodnot.
 * Volná čísla se volí v omezeném počtu sad; závislá čísla se dopočítají.
 */
(function (host) {
  'use strict';
  const EPS = 1e-9;
  const functions = new Set(['sqrt', 'abs', 'ln', 'log', 'logbase', 'exp', 'sin', 'cos', 'tan']);
  const fail = message => { throw new Error(message); };
  const close = (a, b, tol = EPS) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a-b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
  const constant = value => ({type:'number', value, id:-1, locked:true});
  function binary(op, left, right) {
    if (op === '*' && ((left.type === 'number' && left.value === 0) || (right.type === 'number' && right.value === 0))) return constant(0);
    if (op === '+' && right.type === 'number' && right.value === 0) return left;
    if (op === '+' && left.type === 'number' && left.value === 0) return right;
    if (op === '-' && right.type === 'number' && right.value === 0) return left;
    return {type:'binary', op, left, right};
  }
  function parse(raw, keep = []) {
    if (raw.length > 3000) fail('Příliš dlouhý výraz pro testovací dopočet.');
    let pos = 0, index = 0, depth = 0;
    const lex = [], numbers = [];
    while (pos < raw.length) {
      if (/\s/.test(raw[pos])) { pos++; continue; }
      const tail = raw.slice(pos);
      const match = tail.match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
      if (match) {
        const n = {type:'number', value:Number(match[0]), id:index++, start:pos, end:pos+match[0].length, locked:keep.slice(pos,pos+match[0].length).some(Boolean)};
        numbers.push(n); lex.push(n); pos += match[0].length;
      } else {
        const name = tail.match(/^[A-Za-z_]+/);
        if (name) { lex.push({type:'name', value:name[0]}); pos += name[0].length; }
        else if ('+-*/^(),='.includes(raw[pos])) lex.push({type:raw[pos++]});
        else fail('Tento zápis zatím přímý dopočet nepodporuje.');
      }
      if (lex.length > 512) fail('Příliš složitý výraz pro testovací dopočet.');
    }
    let cursor = 0;
    const peek = () => lex[cursor]?.type;
    const take = type => { if (peek() !== type) fail('Neúplná rovnice nebo chybějící závorka.'); return lex[cursor++]; };
    function atom() {
      if (++depth > 64) fail('Příliš mnoho vnořených závorek.');
      let out;
      if (peek() === 'number') out = take('number');
      else if (peek() === '(') { take('('); out = sum(); take(')'); }
      else if (peek() === 'name') {
        const name = take('name').value;
        if (functions.has(name)) {
          take('('); const args = [sum()];
          while (peek() === ',') { take(','); args.push(sum()); }
          take(')');
          if (args.length !== (name === 'logbase' ? 2 : 1)) fail('Nesprávný počet argumentů funkce.');
          out = {type:'function', name, args};
        } else if (['x','y','z','pi','e'].includes(name)) out = {type:'variable', name};
        else fail('Dopočet zatím podporuje proměnné x, y a z.');
      } else fail('Neúplný výraz: doplň číslo nebo proměnnou.');
      depth--; return out;
    }
    function power() {
      const left = atom();
      if (peek() === '^') { take('^'); return {type:'binary', op:'^', left, right:unary()}; }
      return left;
    }
    function unary() {
      if (peek() === '+' || peek() === '-') {
        const op = lex[cursor++].type;
        if (++depth > 64) fail('Příliš složitý výraz.');
        const arg = unary(); depth--;
        return {type:'unary', op, arg};
      }
      return power();
    }
    function product() {
      let left = unary();
      while (true) {
        if (peek() === '*' || peek() === '/') {
          const op = lex[cursor++].type; left = {type:'binary', op, left, right:unary()};
        } else if (['number','name','('].includes(peek())) {
          left = {type:'binary', op:'*', left, right:unary()};
        } else break;
      }
      return left;
    }
    function sum() {
      let left = product();
      while (peek() === '+' || peek() === '-') {
        const op = lex[cursor++].type; left = {type:'binary', op, left, right:product()};
      }
      return left;
    }
    const left = sum(); take('='); const right = sum();
    if (cursor !== lex.length) fail('Zadej jednu rovnici na každý řádek. Nerovnice jsou zatím dostupné v původním generátoru.');
    function lock(n) {
      if (n.type === 'number') n.locked = true;
      children(n).forEach(lock);
    }
    function protect(n) {
      if (n.type === 'binary' && n.op === '^') lock(n.right);
      if (n.type === 'function' && n.name === 'logbase') lock(n.args[0]);
      children(n).forEach(protect);
    }
    protect(left); protect(right);
    // Samostatné =0 ponechá standardní součinový/polynomický tvar.
    for (const side of [left,right]) if (side.type === 'number' && side.value === 0) side.locked = true;
    if (numbers.filter(n=>!n.locked).length > 45) fail('Příliš mnoho měnitelných čísel (maximum 45).');
    return {raw, left, right, expr:{type:'binary', op:'-', left, right}, numbers};
  }
  function children(n) {
    if (n.type === 'binary') return [n.left,n.right];
    if (n.type === 'unary') return [n.arg];
    return n.args || [];
  }
  function value(n, env, values) {
    if (n.type === 'number') return n.id >= 0 && values[n.id] !== undefined ? values[n.id] : n.value;
    if (n.type === 'variable') return n.name === 'pi' ? Math.PI : n.name === 'e' ? Math.E : env[n.name];
    if (n.type === 'unary') return (n.op === '-' ? -1 : 1) * value(n.arg,env,values);
    if (n.type === 'binary') {
      const a = value(n.left,env,values), b = value(n.right,env,values);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
      if (n.op === '+') return a+b;
      if (n.op === '-') return a-b;
      if (n.op === '*') return a*b;
      if (n.op === '/') return b === 0 ? NaN : a/b;
      return Math.pow(a,b);
    }
    const args = n.args.map(a=>value(a,env,values));
    if (!args.every(Number.isFinite)) return NaN;
    const a = args[0];
    if (n.name === 'logbase') return a>0 && a!==1 && args[1]>0 ? Math.log(args[1])/Math.log(a) : NaN;
    if (n.name === 'ln' || n.name === 'log') return a>0 ? Math.log(a) : NaN;
    if (n.name === 'sign') return Math.sign(a);
    return Math[n.name](a);
  }
  function contains(n, ids) {
    return (n.type === 'number' && ids.has(n.id)) || children(n).some(c=>contains(c,ids));
  }
  // Zpětné operace po jediné cestě od rovnítka ke konkrétnímu číslu.
  function inverse(n, goal, id, env, values) {
    if (!Number.isFinite(goal)) return [];
    if (n.type === 'number') return n.id === id ? [goal] : [];
    if (n.type === 'unary') return inverse(n.arg,n.op==='-' ? -goal : goal,id,env,values);
    const ids = new Set([id]);
    const descend = (child, goals) => goals.flatMap(g=>inverse(child,g,id,env,values));
    if (n.type === 'binary') {
      const inLeft = contains(n.left,ids), inRight = contains(n.right,ids);
      if (inLeft === inRight) return [];
      const other = value(inLeft ? n.right : n.left,env,values);
      if (!Number.isFinite(other)) return [];
      const child = inLeft ? n.left : n.right;
      if (n.op === '+') return descend(child,[goal-other]);
      if (n.op === '-') return descend(child,[inLeft ? goal+other : other-goal]);
      if (n.op === '*') return other === 0 ? [] : descend(child,[goal/other]);
      if (n.op === '/') {
        if (inLeft) return other===0 ? [] : descend(child,[goal*other]);
        return goal===0 ? [] : descend(child,[other/goal]);
      }
      if (!inLeft || other===0) return [];
      const isInt = close(other,Math.round(other),1e-12);
      const k = isInt ? Math.round(other) : other;
      if (goal < 0 && (!isInt || Math.abs(k%2)!==1)) return [];
      const a = goal<0 ? -Math.pow(-goal,1/k) : Math.pow(goal,1/k);
      return descend(child,isInt && k%2===0 && a!==0 ? [a,-a] : [a]);
    }
    if (n.type !== 'function') return [];
    if (n.name === 'logbase') {
      if (!contains(n.args[1],ids)) return [];
      const base = value(n.args[0],env,values);
      return base>0 && base!==1 ? descend(n.args[1],[Math.pow(base,goal)]) : [];
    }
    if (n.name === 'sqrt') return goal<0 ? [] : descend(n.args[0],[goal*goal]);
    if (n.name === 'abs') return goal<0 ? [] : descend(n.args[0],goal===0 ? [0] : [goal,-goal]);
    if (n.name === 'ln' || n.name === 'log') return descend(n.args[0],[Math.exp(goal)]);
    if (n.name === 'exp') return goal<=0 ? [] : descend(n.args[0],[Math.log(goal)]);
    return [];
  }
  // Strukturní linearita: číslo pod logaritmem či ve jmenovateli se nikdy
  // nepovažuje za lineární parametr jen podle dvou numerických vzorků.
  function affine(n, ids, env, values) {
    const zero = () => Array(ids.size).fill(0);
    if (!contains(n,ids)) {
      const c = value(n,env,values); return Number.isFinite(c) ? {c,a:zero()} : null;
    }
    if (n.type === 'number') {
      const a=zero(); a[[...ids].indexOf(n.id)]=1; return {c:0,a};
    }
    if (n.type === 'unary') {
      const f=affine(n.arg,ids,env,values), sign=n.op==='-'?-1:1;
      return f ? {c:sign*f.c,a:f.a.map(x=>sign*x)} : null;
    }
    if (n.type !== 'binary') return null;
    const l=affine(n.left,ids,env,values), r=affine(n.right,ids,env,values);
    if (!l || !r) return null;
    const lc=l.a.some(x=>x!==0), rc=r.a.some(x=>x!==0);
    if (n.op==='+' || n.op==='-') {
      const sign=n.op==='+'?1:-1; return {c:l.c+sign*r.c,a:l.a.map((x,i)=>x+sign*r.a[i])};
    }
    if (n.op==='*') {
      if (lc && rc) return null;
      return {c:l.c*r.c,a:l.a.map((x,i)=>x*r.c+r.a[i]*l.c)};
    }
    if (n.op==='/' && !rc && r.c!==0) return {c:l.c/r.c,a:l.a.map(x=>x/r.c)};
    if (n.op==='^' && !rc && r.c===1) return l;
    return null;
  }
  function derivative(n, variable) {
    if (n.type==='number') return constant(0);
    if (n.type==='variable') return constant(n.name===variable?1:0);
    if (n.type==='unary') return {type:'unary',op:n.op,arg:derivative(n.arg,variable)};
    if (n.type!=='binary') return null;
    const a=n.left,b=n.right,da=derivative(a,variable),db=derivative(b,variable);
    if (!da || !db) return null;
    if (n.op==='+' || n.op==='-') return binary(n.op,da,db);
    if (n.op==='*') return binary('+',binary('*',da,b),binary('*',a,db));
    if (n.op==='/') return binary('/',binary('-',binary('*',da,b),binary('*',a,db)),binary('^',b,constant(2)));
    if (n.op==='^' && db.type==='number' && db.value===0) return binary('*',binary('*',b,binary('^',a,binary('-',b,constant(1)))),da);
    return null;
  }
  function solveMatrix(rows, rhs) {
    const n=rows[0]?.length || 0;
    if (rows.length !== n || !n) return null;
    const m=rows.map((r,i)=>{
      const scale=Math.max(...r.map(Math.abs));
      return scale>0 && Number.isFinite(scale) ? r.map(x=>x/scale).concat(rhs[i]/scale) : null;
    });
    if (m.some(r=>!r || !r.every(Number.isFinite))) return null;
    for (let c=0;c<n;c++) {
      let p=c;
      for (let r=c+1;r<n;r++) if (Math.abs(m[r][c])>Math.abs(m[p][c])) p=r;
      if (Math.abs(m[p][c])<1e-11) return null;
      [m[c],m[p]]=[m[p],m[c]];
      const d=m[c][c]; for(let j=c;j<=n;j++) m[c][j]/=d;
      for(let r=0;r<n;r++) if(r!==c) {
        const f=m[r][c]; for(let j=c;j<=n;j++) m[r][j]-=f*m[c][j];
      }
    }
    const out=m.map(r=>r[n]); return out.every(Number.isFinite)?out:null;
  }
  const trim = p => { const out=p.slice(); while(out.length>1 && out.at(-1)===0)out.pop(); return out; };
  const add = (a,b,sign=1) => trim(Array.from({length:Math.max(a.length,b.length)},(_,i)=>(a[i]||0)+sign*(b[i]||0)));
  function multiply(a,b) {
    if(a.length+b.length>26)return null;
    const out=Array(a.length+b.length-1).fill(0);
    a.forEach((x,i)=>b.forEach((y,j)=>out[i+j]+=x*y)); return trim(out);
  }
  function rational(n, values) {
    if(n.type==='number')return {p:[value(n,{},values)],q:[1]};
    if(n.type==='variable') {
      if(n.name==='x')return {p:[0,1],q:[1]};
      if(n.name==='pi'||n.name==='e')return {p:[value(n,{},values)],q:[1]};
      return null;
    }
    if(n.type==='unary') { const f=rational(n.arg,values);return f?{p:f.p.map(x=>(n.op==='-'?-1:1)*x),q:f.q}:null; }
    if(n.type!=='binary')return null;
    const a=rational(n.left,values),b=rational(n.right,values);
    if(!a||!b)return null;
    let p,q;
    if(n.op==='+'||n.op==='-') {
      const l=multiply(a.p,b.q),r=multiply(b.p,a.q);q=multiply(a.q,b.q);
      if(!l||!r||!q)return null;p=add(l,r,n.op==='+'?1:-1);
    } else if(n.op==='*'){p=multiply(a.p,b.p);q=multiply(a.q,b.q);}
    else if(n.op==='/'){p=multiply(a.p,b.q);q=multiply(a.q,b.p);}
    else {
      const exp=value(n.right,{},values);
      if(!Number.isInteger(exp)||Math.abs(exp)>12)return null;
      p=[1];q=[1];
      for(let i=0;i<Math.abs(exp);i++) { p=multiply(p,exp<0?a.q:a.p);q=multiply(q,exp<0?a.p:a.q);if(!p||!q)return null; }
    }
    return p&&q&&p.concat(q).every(Number.isFinite)?{p:trim(p),q:trim(q)}:null;
  }
  function render(parsed, values) {
    let out=parsed.raw;
    for(const n of parsed.numbers.slice().reverse()) {
      if(n.locked || values[n.id]===undefined || values[n.id]===n.value)continue;
      const v=values[n.id];
      out=out.slice(0,n.start)+(v<0?'('+v+')':String(v))+out.slice(n.end);
    }
    // Záporný číselný člen má běžné znaménko; jinde závorky chrání např. mocninu.
    return out.replace(/\+\((-\d+)\)/g,'$1').replace(/-\(-([0-9]+)\)/g,'+$1');
  }
  const shuffled = (items,rng) => {
    const out=items.slice();for(let i=out.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;
  };
  function groupsOf(items,k,limit) {
    const out=[];
    function visit(start,group) {
      if(out.length>=limit)return;
      if(group.length===k){out.push(group.slice());return;}
      for(let i=start;i<=items.length-(k-group.length);i++){visit(i+1,group.concat(items[i]));if(out.length>=limit)break;}
    }
    visit(0,[]);return out;
  }
  function rootsOfPolynomial(p) {
    if(p.length===2)return [-p[0]/p[1]];
    if(p.length!==3)return null;
    const [c,b,a]=p,d=b*b-4*a*c;
    if(d < -EPS)return [];
    if(Math.abs(d)<=EPS)return [-b/(2*a)];
    const q=-0.5*(b+(b>=0?1:-1)*Math.sqrt(d));
    return [q/a,c/q].sort((x,y)=>x-y);
  }
  function zeroFactors(parsed) {
    let side=null;
    if(parsed.right.type==='number' && parsed.right.value===0)side=parsed.left;
    if(parsed.left.type==='number' && parsed.left.value===0)side=parsed.right;
    const out=[];
    function visit(n) {
      if(n.type==='binary' && n.op==='*'){visit(n.left);visit(n.right);}
      else out.push(n);
    }
    if(side)visit(side);
    return out.length>1?out:[];
  }
  async function generate(options) {
    const started=Date.now(),parsed=parse(options.raw,options.keep),rng=options.rng||Math.random;
    const stats={sets:0,calculations:0,method:'',ms:0};
    const min=Math.max(1,Math.ceil(options.min??1)),max=Math.min(999,Math.floor(options.max??20));
    if(min>max)fail('Neplatný rozsah celočíselných koeficientů.');
    const mutable=parsed.numbers.filter(n=>!n.locked);
    if(!mutable.length)fail('V rovnici není číslo, které smím změnit.');
    const targets=(options.targets||[]).slice();
    const envs=options.envs || targets.map(x=>({x}));
    if(!envs.length || envs.some(e=>Object.values(e).some(x=>!Number.isFinite(x))))fail('Zadej platný požadovaný výsledek.');
    const constraints=[];
    for(const env of envs) {
      const multiplicity=constraints.filter(c=>c.env.x===env.x && JSON.stringify(c.env)===JSON.stringify(env)).length;
      let expr=parsed.expr;
      for(let i=0;i<multiplicity;i++){expr=derivative(expr,'x');if(!expr)fail('Opakované kořeny umí testovací dopočet zatím jen u algebraických rovnic.');}
      constraints.push({expr,env});
    }
    if(constraints.length>6)fail('Testovací dopočet podporuje nejvýše šest kořenů.');
    const originalRational=rational(parsed.expr,{});
    const factors=zeroFactors(parsed);
    const maxSets=options.maxSets??48;
    const integer = v => {
      const r=Math.round(v);
      return Number.isFinite(v) && Math.abs(v-r)<1e-7 && Math.abs(r)>=min && Math.abs(r)<=max ? r : null;
    };
    const validAt = (values,env) => {
      const l=value(parsed.left,env,values),r=value(parsed.right,env,values);
      return close(l,r,1e-10);
    };
    function accept(values, dependent, method) {
      if(!mutable.every(n=>integer(values[n.id])!==null))return null;
      if(!envs.every(env=>validAt(values,env)))return null;
      for(const c of constraints.slice(1))if(!close(value(c.expr,c.env,values),0,1e-8))return null;
      const rat=rational(parsed.expr,values);
      if(rat && rat.p.length===1)return null; // konstanta ani identita nejsou nové rovnice s daným kořenem
      if(originalRational && rat && originalRational.p.length>1 && rat.p.length!==originalRational.p.length)return null;
      if(!rat) {
        const probes=[-2.73,-0.41,0.37,1.19,4.61];
        const vars=Object.keys(envs[0]);
        let nonzero=false;
        for(const variable of vars)for(const d of probes){const f=value(parsed.expr,{...envs[0],[variable]:envs[0][variable]+d},values);if(Number.isFinite(f)&&Math.abs(f)>1e-7)nonzero=true;}
        if(!nonzero)return null;
      }
      const calc=render(parsed,values);
      if(calc===parsed.raw || options.reject?.(calc))return null;
      // Zkontroluj i skutečný výstup po nahrazení číslic a úpravě znamének.
      const check=parse(calc);
      if(!envs.every(env=>close(value(check.left,env,{}),value(check.right,env,{}),1e-10)))return null;
      // Úplnost podle stupně tvrď jen pro bezpečně reprezentované celočíselné
      // koeficienty. U desetinných konstant zůstane pouze kontrola dosazením.
      const certified=rat && rat.p.concat(rat.q).every(Number.isSafeInteger);
      let roots=certified?rootsOfPolynomial(rat.p):null;
      if(roots)roots=roots.filter(x=>validAt(values,{x})).map(x=>x===0?0:x);
      let complete=roots!==null;
      if(certified && roots===null && envs.every(e=>Object.keys(e).length===1&&'x' in e) && rat.p.length-1===constraints.length) {
        // n platných kořenů včetně násobnosti vyčerpává stupeň čitatele.
        roots=[...new Set(envs.map(e=>e.x))].sort((a,b)=>a-b);complete=true;
      }
      stats.method=method;stats.ms=Date.now()-started;
      return {calc,stats:{...stats},targets:envs,roots,complete,dependent:dependent.map(id=>({from:parsed.numbers[id].value,to:values[id]}))};
    }
    for(let seed=0;seed<maxSets;seed++) {
      stats.sets++;
      const values={};
      for(const n of mutable) {
        const magnitude=min+Math.floor(rng()*(max-min+1));
        values[n.id]=seed<24 && integer(n.value)!==null ? n.value : (rng()<0.5?-1:1)*magnitude;
      }
      // Nejdřív malé obměny vzoru, až poté širší volby volných čísel.
      if(seed>0 && seed<24) {
        const free=shuffled(mutable,rng).slice(0,1+Math.floor(seed/8));
        for(const n of free) {
          const step=1+Math.floor(rng()*Math.min(5,max-min+1));
          const changed=values[n.id]+(rng()<0.5?-step:step);
          values[n.id]=integer(changed)??(rng()<0.5?-1:1)*(min+Math.floor(rng()*(max-min+1)));
        }
      }
      const order=shuffled(mutable.map(n=>n.id),rng);
      if(constraints.length===1) {
        for(const id of order) {
          stats.calculations++;
          const answers=inverse(parsed.expr,0,id,envs[0],values);
          for(const answer of answers) {
            const solved=integer(answer);if(solved===null)continue;
            const candidate={...values,[id]:solved};
            const result=accept(candidate,[id],'Zpětné operace');if(result)return result;
          }
        }
      } else {
        const plans=[constraints];
        // Součin rovný nule: přiděl kořeny jednotlivým činitelům.
        // Pak jsou čísla v různých činitelích nezávislé lineární parametry.
        if(factors.length>=envs.length) {
          const allocation=shuffled(factors,rng);
          plans.unshift(envs.map((env,i)=>({expr:allocation[i],env})));
        }
        for(const plan of plans) {
        // Nejdřív vyřaď čísla, která nejsou lineárními parametry samostatně.
        const eligible=order.filter(id=>plan.every(c=>affine(c.expr,new Set([id]),c.env,values)));
        for(const group of groupsOf(eligible,plan.length,160)) {
          stats.calculations++;
          const ids=new Set(group), forms=plan.map(c=>affine(c.expr,ids,c.env,values));
          if(forms.some(f=>!f))continue;
          const solved=solveMatrix(forms.map(f=>f.a),forms.map(f=>-f.c));
          if(!solved)continue;
          const ints=solved.map(integer);if(ints.some(v=>v===null))continue;
          const candidate={...values};group.forEach((id,i)=>candidate[id]=ints[i]);
          const result=accept(candidate,group,'Soustava podmínek pro koeficienty');if(result)return result;
        }
        }
      }
      if(options.yield && seed%3===2)await options.yield();
      if(Date.now()-started>(options.timeLimit??1200))break;
    }
    stats.ms=Date.now()-started;
    return {calc:null,stats,message:'V omezeném počtu voleb volných čísel se nepodařilo dopočítat novou variantu. Zkus širší rozsah, odemknout číslo nebo původní generátor. Neznamená to, že taková rovnice neexistuje.'};
  }
  const api={parse,value,inverse,affine,rational,generate,render,solveMatrix};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else host.EquationBacksolve=api;
})(typeof globalThis!=='undefined'?globalThis:this);
