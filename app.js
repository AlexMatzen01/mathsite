(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const state = { angle: 'deg', algebra: 'linear', shape: 'circle', funcs: ['x^2'] };

  const fmt = (n) => {
    if (!Number.isFinite(n)) return 'undefined';
    if (Math.abs(n) < 1e-10) n = 0;
    return String(Number(n.toFixed(8)));
  };

  function answer(id, title, value, steps = []) {
    const el = $(id);
    if (!el) return;
    el.innerHTML = `<div class="answer"><div class="answer-value"><div class="label">${title}</div><div class="big">${value}</div></div>${steps.length ? `<div class="steps">${steps.map((s,i)=>`<div class="step"><b>Step ${i+1}.</b> ${s}</div>`).join('')}</div>` : ''}</div>`;
  }

  function openPage(id) {
    $$('.page').forEach(p => p.classList.toggle('active', p.id === id));
    $$('.nav-link').forEach(b => b.classList.toggle('active', b.dataset.page === id));
    $('#nav')?.classList.remove('open');
    if (id === 'graph') setTimeout(drawGraph, 0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  $$('.nav-link').forEach(b => b.addEventListener('click', () => openPage(b.dataset.page)));
  $$('[data-go]').forEach(b => b.addEventListener('click', () => openPage(b.dataset.go)));
  $('#menuButton')?.addEventListener('click', () => $('#nav')?.classList.toggle('open'));

  function evalMath(expr) {
    let s = String(expr).replaceAll('π', 'Math.PI').replaceAll('√', 'Math.sqrt');
    s = s.replace(/\bpi\b/gi, 'Math.PI').replace(/\be\b/g, 'Math.E');
    s = s.replace(/\bsqrt\s*\(/gi, 'Math.sqrt(');
    s = s.replace(/\bsin\s*\(/gi, 'Math.sin(').replace(/\bcos\s*\(/gi, 'Math.cos(').replace(/\btan\s*\(/gi, 'Math.tan(');
    s = s.replace(/\basin\s*\(/gi, 'Math.asin(').replace(/\bacos\s*\(/gi, 'Math.acos(').replace(/\batan\s*\(/gi, 'Math.atan(');
    s = s.replace(/\blog\s*\(/gi, 'Math.log10(').replace(/\bln\s*\(/gi, 'Math.log(');
    s = s.replace(/\babs\s*\(/gi, 'Math.abs(').replace(/\bexp\s*\(/gi, 'Math.exp(');
    s = s.replace(/(\d|\)|Math\.PI|Math\.E)\s*x\s*(?=\d|\()/gi, '$1*');
    s = s.replace(/(\d|\)|Math\.PI|Math\.E)\s*(?=Math\.)/g, '$1*');
    s = s.replace(/(\d|\)|Math\.PI|Math\.E)\s+(?=\d)/g, '$1*');
    s = s.replace(/\^/g, '**');
    if (!/^[0-9+\-*/%().,\sA-Za-z_]+$/.test(s)) throw new Error('Invalid characters');
    if (/\b(?:window|document|globalThis|constructor|prototype|Function|eval|fetch|location|alert)\b/i.test(s)) throw new Error('Invalid expression');
    const value = Function(`"use strict"; return (${s})`)();
    if (!Number.isFinite(value)) throw new Error('No finite result');
    return value;
  }

  function evalX(expr, x) {
    const safe = String(expr).replace(/\bx\b/gi, `(${x})`);
    return evalMath(safe);
  }

  function renderFunctions() {
    const list = $('#functionList');
    if (!list) return;
    list.innerHTML = state.funcs.map((fn,i) => `<div class="function-row"><span class="dot"></span><input class="function-input" data-i="${i}" value="${fn.replaceAll('"','&quot;')}"><button class="icon-button remove-fn" data-i="${i}">×</button></div>`).join('');
    $$('.function-input').forEach(input => input.addEventListener('input', e => { state.funcs[+e.target.dataset.i] = e.target.value; drawGraph(); }));
    $$('.remove-fn').forEach(btn => btn.addEventListener('click', () => { if (state.funcs.length > 1) { state.funcs.splice(+btn.dataset.i, 1); renderFunctions(); drawGraph(); } }));
  }

  function bounds() {
    const n = id => Number($(id)?.value);
    let minX=n('#minX'), maxX=n('#maxX'), minY=n('#minY'), maxY=n('#maxY');
    if (!Number.isFinite(minX)) minX=-10; if (!Number.isFinite(maxX)) maxX=10;
    if (!Number.isFinite(minY)) minY=-10; if (!Number.isFinite(maxY)) maxY=10;
    if (minX >= maxX) [minX,maxX]=[-10,10]; if (minY >= maxY) [minY,maxY]=[-10,10];
    return {minX,maxX,minY,maxY};
  }

  function drawGraph() {
    const canvas = $('#graphCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(520, Math.floor(rect.width || 900));
    const h = Math.max(340, Math.floor((rect.width || 900) * 2/3));
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w*dpr; canvas.height = h*dpr; ctx.setTransform(dpr,0,0,dpr,0,0);
    const b=bounds(); const sx=x=>(x-b.minX)/(b.maxX-b.minX)*w; const sy=y=>h-(y-b.minY)/(b.maxY-b.minY)*h;
    ctx.clearRect(0,0,w,h); ctx.fillStyle='#090d17'; ctx.fillRect(0,0,w,h);
    ctx.lineWidth=1; ctx.strokeStyle='rgba(255,255,255,.06)'; ctx.beginPath();
    for(let x=Math.ceil(b.minX);x<=b.maxX;x++){const px=sx(x);ctx.moveTo(px,0);ctx.lineTo(px,h);} for(let y=Math.ceil(b.minY);y<=b.maxY;y++){const py=sy(y);ctx.moveTo(0,py);ctx.lineTo(w,py);} ctx.stroke();
    const ox=sx(0), oy=sy(0); ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=1.5;ctx.beginPath();
    if(ox>=0&&ox<=w){ctx.moveTo(ox,0);ctx.lineTo(ox,h);} if(oy>=0&&oy<=h){ctx.moveTo(0,oy);ctx.lineTo(w,oy);}ctx.stroke();
    ctx.fillStyle='rgba(225,230,245,.6)';ctx.font='11px system-ui';ctx.textAlign='center';
    for(let x=Math.ceil(b.minX);x<=b.maxX;x++) if(x!==0) ctx.fillText(String(x),sx(x),Math.min(h-6,Math.max(13,oy+15)));
    ctx.textAlign='right'; for(let y=Math.ceil(b.minY);y<=b.maxY;y++) if(y!==0) ctx.fillText(String(y),Math.max(30,ox-6),sy(y)+4);
    const strokes=['#a898ff','#5fdcff','#ff8fd0','#77e6a7'];
    state.funcs.forEach((fn,fi)=>{
      ctx.strokeStyle=strokes[fi];ctx.lineWidth=2.2;ctx.beginPath();let drawing=false,last=null;
      const samples=Math.max(800,Math.floor(w));
      for(let i=0;i<=samples;i++){
        const x=b.minX+(b.maxX-b.minX)*i/samples; let y;
        try{y=evalX(fn,x);}catch{drawing=false;last=null;continue;}
        if(!Number.isFinite(y)||Math.abs(y)>1e7){drawing=false;last=null;continue;}
        const py=sy(y); if(last!==null&&Math.abs(py-last)>h*1.5)drawing=false; if(!drawing)ctx.moveTo(sx(x),py);else ctx.lineTo(sx(x),py); drawing=true; last=py;
      }
      ctx.stroke();
    });
    const status=$('#graphStatus'); if(status) status.textContent=`Plotted ${state.funcs.length} function${state.funcs.length===1?'':'s'}.`;
  }

  $('#addFunction')?.addEventListener('click',()=>{if(state.funcs.length<4){state.funcs.push('sin(x)');renderFunctions();drawGraph();}});
  $('#plotButton')?.addEventListener('click',drawGraph);
  $('#resetGraph')?.addEventListener('click',()=>{[['#minX',-10],['#maxX',10],['#minY',-10],['#maxY',10]].forEach(([id,v])=>$(id).value=v);drawGraph();});
  const canvas=$('#graphCanvas'); let drag=false,last={x:0,y:0};
  canvas?.addEventListener('pointerdown',e=>{drag=true;last={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
  canvas?.addEventListener('pointerup',()=>drag=false); canvas?.addEventListener('pointerleave',()=>drag=false);
  canvas?.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();const b=bounds();const x=b.minX+(e.clientX-r.left)/r.width*(b.maxX-b.minX);const y=b.maxY-(e.clientY-r.top)/r.height*(b.maxY-b.minY);if(!drag){$('#coords').textContent=`x: ${fmt(x)}, y: ${fmt(y)}`;return;}const dx=(e.clientX-last.x)/r.width*(b.maxX-b.minX);const dy=(e.clientY-last.y)/r.height*(b.maxY-b.minY);$('#minX').value=b.minX-dx;$('#maxX').value=b.maxX-dx;$('#minY').value=b.minY+dy;$('#maxY').value=b.maxY+dy;last={x:e.clientX,y:e.clientY};drawGraph();});
  canvas?.addEventListener('wheel',e=>{e.preventDefault();const b=bounds(),f=e.deltaY<0?.82:1.22,mx=(b.minX+b.maxX)/2,my=(b.minY+b.maxY)/2,nx=(b.maxX-b.minX)*f,ny=(b.maxY-b.minY)*f;$('#minX').value=mx-nx/2;$('#maxX').value=mx+nx/2;$('#minY').value=my-ny/2;$('#maxY').value=my+ny/2;drawGraph();},{passive:false});

  function solveSystem(){
    const v=id=>Number($(id).value); const a=v('#s1a'),b=v('#s1b'),c=v('#s1c'),d=v('#s2a'),e=v('#s2b'),f=v('#s2c'); const det=a*e-b*d;
    if(Math.abs(det)<1e-12){const same=Math.abs(a*f-d*c)<1e-10&&Math.abs(b*f-e*c)<1e-10;answer('#systemResult','System type',same?'Infinitely many solutions':'No solution',[same?'The two equations describe the same line.':'The two equations have the same slope but different intercepts.']);return;}
    const x=(c*e-b*f)/det,y=(a*f-c*d)/det;answer('#systemResult','Solution',`(${fmt(x)}, ${fmt(y)})`,['Eliminate one variable.','Solve for the remaining variable.','Substitute back into either equation.','Check the ordered pair in both equations.']);
  }
  $('#solveSystem')?.addEventListener('click',solveSystem);
  $$('[data-system]').forEach(b=>b.addEventListener('click',()=>{b.dataset.system.split(',').map(Number).forEach((v,i)=>$('#'+['s1a','s1b','s1c','s2a','s2b','s2c'][i]).value=v);solveSystem();}));

  $$('#algebraMode button').forEach(btn=>btn.addEventListener('click',()=>{state.algebra=btn.dataset.mode; $$('#algebraMode button').forEach(b=>b.classList.toggle('selected',b===btn)); ['linear','quadratic','exponential'].forEach(m=>$('#'+m+'Form')?.classList.toggle('hidden',m!==state.algebra));}));
  $('#solveLinear')?.addEventListener('click',()=>{const a=+$('#linA').value,b=+$('#linB').value,c=+$('#linC').value;if(a===0){answer('#algebraResult','Result',b===c?'All real numbers':'No solution');return;}answer('#algebraResult','x =',fmt((c-b)/a),[`Subtract ${fmt(b)}: ax = ${fmt(c-b)}.`,`Divide by ${fmt(a)}.`]);});
  $('#solveQuadratic')?.addEventListener('click',()=>{const a=+$('#quadA').value,b=+$('#quadB').value,c=+$('#quadC').value;if(a===0){answer('#algebraResult','Linear result',fmt(-c/b));return;}const d=b*b-4*a*c;if(d>0){const x1=(-b+Math.sqrt(d))/(2*a),x2=(-b-Math.sqrt(d))/(2*a);answer('#algebraResult','Roots',`${fmt(x1)} and ${fmt(x2)}`,[`Discriminant = ${fmt(d)}.`,'Use the quadratic formula.']);}else if(d===0)answer('#algebraResult','Double root',fmt(-b/(2*a)),['The discriminant is 0.']);else answer('#algebraResult','Complex roots',`${fmt(-b/(2*a))} ± ${fmt(Math.sqrt(-d)/(2*a))}i`,['The discriminant is negative.']);});
  $('#solveExponential')?.addEventListener('click',()=>{const a=+$('#expA').value,b=+$('#expB').value,y=+$('#expY').value;if(a===0||b<=0||b===1||y/a<=0){answer('#algebraResult','Result','Undefined for these inputs');return;}const x=Math.log(y/a)/Math.log(b);answer('#algebraResult','x =',fmt(x),[`Divide by a: b^x = ${fmt(y/a)}.`,'Take logs and divide by log(b).']);});

  const toRad=x=>state.angle==='deg'?x*Math.PI/180:x, fromRad=x=>state.angle==='deg'?x*180/Math.PI:x;
  $('#calculateTrig')?.addEventListener('click',()=>{const x=+$('#theta').value;answer('#trigResult','Trig values',`sin ${fmt(Math.sin(toRad(x)))} • cos ${fmt(Math.cos(toRad(x)))} • tan ${fmt(Math.tan(toRad(x)))}`,[`Mode: ${state.angle==='deg'?'degrees':'radians'}.`]);});
  $$('[data-trig]').forEach(btn=>btn.addEventListener('click',()=>{const x=+$('#theta').value,fn=btn.dataset.trig;answer('#trigResult',fn+'(θ)',fmt(Math[fn](toRad(x))));}));
  $$('#angleMode button').forEach(btn=>btn.addEventListener('click',()=>{state.angle=btn.dataset.angleMode; $$('#angleMode button').forEach(b=>b.classList.toggle('selected',b===btn));}));
  $('#calculateInverse')?.addEventListener('click',()=>{const v=+$('#invValue').value,fn=$('#invFunc').value;if((fn==='asin'||fn==='acos')&&(v<-1||v>1)){answer('#trigResult','Inverse trig','Undefined');return;}answer('#trigResult',fn+' result',fmt(fromRad(Math[fn](v)))+(state.angle==='deg'?'°':' rad'));});

  const fields={circle:[['r','Radius']],triangle:[['base','Base'],['height','Height']],rectangle:[['width','Width'],['height','Height']],sphere:[['r','Radius']],cylinder:[['r','Radius'],['h','Height']]};
  function renderShape(){const f=fields[state.shape];$('#shapeFields').innerHTML=f.map(([id,label])=>`<label>${label}<input id="g_${id}" type="number" value="5" step="any"></label>`).join('');}
  $$('#shapeMode button').forEach(btn=>btn.addEventListener('click',()=>{state.shape=btn.dataset.shape; $$('#shapeMode button').forEach(b=>b.classList.toggle('selected',b===btn));renderShape();}));
  $('#calculateGeometry')?.addEventListener('click',()=>{const g=id=>+$('#g_'+id).value;let title,value,steps=[];if(state.shape==='circle'){const r=g('r');title='Circle';value=`A = ${fmt(Math.PI*r*r)} • C = ${fmt(2*Math.PI*r)}`;steps=['A = πr²','C = 2πr'];}else if(state.shape==='triangle'){const b=g('base'),h=g('height');title='Triangle';value=`Area = ${fmt(b*h/2)}`;steps=['A = ½bh'];}else if(state.shape==='rectangle'){const w=g('width'),h=g('height');title='Rectangle';value=`A = ${fmt(w*h)} • P = ${fmt(2*(w+h))}`;steps=['A = wh','P = 2(w+h)'];}else if(state.shape==='sphere'){const r=g('r');title='Sphere';value=`SA = ${fmt(4*Math.PI*r*r)} • V = ${fmt(4/3*Math.PI*r*r*r)}`;steps=['SA = 4πr²','V = ⁴⁄₃πr³'];}else{const r=g('r'),h=g('h');title='Cylinder';value=`SA = ${fmt(2*Math.PI*r*(r+h))} • V = ${fmt(Math.PI*r*r*h)}`;steps=['SA = 2πr(r+h)','V = πr²h'];}answer('#geometryResult',title,value,steps);});

  $$('[data-key]').forEach(btn=>btn.addEventListener('click',()=>{const input=$('#calcInput');if(btn.dataset.key==='pi')input.value+='π';else input.value+=btn.dataset.key;input.focus();}));
  $('#clearCalc')?.addEventListener('click',()=>$('#calcInput').value='');
  $('#evaluateCalc')?.addEventListener('click',()=>{try{const raw=$('#calcInput').value;answer('#calcResult','Result',fmt(evalMath(raw)),[`Expression: ${raw}`]);}catch(e){answer('#calcResult','Error','Check the expression',[e.message]);}});
  $('#calcInput')?.addEventListener('keydown',e=>{if(e.key==='Enter')$('#evaluateCalc').click();});

  renderFunctions(); renderShape(); drawGraph();
  window.addEventListener('resize',()=>{if($('#graph')?.classList.contains('active'))drawGraph();});
})();