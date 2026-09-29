const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = {
  angleMode: "deg",
  algebraMode: "linear",
  shape: "circle",
  functions: ["x^2"],
  graph: { minX: -10, maxX: 10, minY: -10, maxY: 10, panX: 0, panY: 0 }
};

function fmt(n, digits = 8) {
  if (!Number.isFinite(n)) return "undefined";
  if (Math.abs(n) < 1e-10) n = 0;
  const rounded = Number(n.toFixed(digits));
  return String(rounded);
}

function renderAnswer(target, title, value, steps = []) {
  $(target).innerHTML =
    '<div class="answer">' +
      '<div class="answer-value"><div class="label">' + title + '</div><div class="big">' + value + '</div></div>' +
      (steps.length ? '<div class="steps">' + steps.map((s, i) => '<div class="step"><b>Step ' + (i + 1) + '.</b> ' + s + '</div>').join("") + '</div>' : '') +
    '</div>';
}

/* ---------------- expression parser ---------------- */

const functions = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sqrt: Math.sqrt, abs: Math.abs,
  log: Math.log10, ln: Math.log, exp: Math.exp
};
const precedence = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 3, "u-": 4 };
const associativity = { "^": "right", "u-": "right" };

function tokenize(expression) {
  let s = expression.replace(/π/g, "pi").replace(/√/g, "sqrt");
  const raw = [];
  let i = 0;

  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i + 1;
      while (j < s.length && /[0-9.eE+-]/.test(s[j])) {
        if ((s[j] === "+" || s[j] === "-") && /[eE]/.test(s[j - 1]) === false) break;
        j++;
      }
      const token = s.slice(i, j);
      if (!/^\d*\.?\d+(e[+-]?\d+)?$/i.test(token)) throw new Error("Invalid number");
      raw.push({ type: "number", value: Number(token) }); i = j; continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i + 1;
      while (j < s.length && /[a-zA-Z_]/.test(s[j])) j++;
      raw.push({ type: "word", value: s.slice(i, j).toLowerCase() }); i = j; continue;
    }
    if ("+-*/^(),".includes(c)) { raw.push({ type: "op", value: c }); i++; continue; }
    throw new Error("Unknown character: " + c);
  }

  const out = [];
  const isValue = t => t && (t.type === "number" || t.type === "word" || t.value === ")");
  const isStart = t => t && (t.type === "number" || t.type === "word" || t.value === "(");
  for (let k = 0; k < raw.length; k++) {
    const t = raw[k];
    if (out.length && isValue(out[out.length - 1]) && isStart(t)) {
      const prev = out[out.length - 1];
      const prevIsFunction = prev.type === "word" && Object.prototype.hasOwnProperty.call(functions, prev.value);
      if (!prevIsFunction) out.push({ type: "op", value: "*" });
    }
    out.push(t);
  }
  return out;
}

function expressionToRpn(expression) {
  const tokens = tokenize(expression);
  const output = [];
  const stack = [];
  let prev = null;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (t.type === "number" || (t.type === "word" && !Object.prototype.hasOwnProperty.call(functions, t.value) && t.value !== "pi" && t.value !== "e")) {
      output.push(t);
      prev = t;
      continue;
    }

    if (t.type === "word") {
      if (Object.prototype.hasOwnProperty.call(functions, t.value)) stack.push(t);
      else if (t.value === "pi" || t.value === "e") output.push({ type: "number", value: t.value === "pi" ? Math.PI : Math.E });
      else throw new Error("Unknown name: " + t.value);
      prev = t;
      continue;
    }

    if (t.value === ",") {
      while (stack.length && stack[stack.length - 1].value !== "(") output.push(stack.pop());
      prev = t;
      continue;
    }

    if (t.value === "(") {
      stack.push(t); prev = t; continue;
    }

    if (t.value === ")") {
      while (stack.length && stack[stack.length - 1].value !== "(") output.push(stack.pop());
      if (!stack.length) throw new Error("Mismatched parentheses");
      stack.pop();
      if (stack.length && stack[stack.length - 1].type === "word") output.push(stack.pop());
      prev = t;
      continue;
    }

    let op = t.value;
    if (op === "-" && (!prev || prev.value === "(" || ["+","-","*","/","^",","].includes(prev.value))) op = "u-";

    while (stack.length && stack[stack.length - 1].value !== "(") {
      const top = stack[stack.length - 1].value;
      const p1 = precedence[op], p2 = precedence[top];
      if (p1 == null || p2 == null) break;
      const shouldPop = associativity[op] === "right" ? p1 < p2 : p1 <= p2;
      if (!shouldPop) break;
      output.push(stack.pop());
    }
    stack.push({ type: "op", value: op }); prev = { type: "op", value: op };
  }

  while (stack.length) {
    const top = stack.pop();
    if (top.value === "(") throw new Error("Mismatched parentheses");
    output.push(top);
  }
  return output;
}

function evaluateExpression(expression, vars = {}) {
  const rpn = expressionToRpn(expression);
  const stack = [];
  for (const t of rpn) {
    if (t.type === "number") stack.push(t.value);
    else if (t.type === "word") {
      const fn = functions[t.value];
      if (!fn || stack.length < 1) throw new Error("Invalid function");
      stack.push(fn(stack.pop()));
    } else {
      const op = t.value;
      if (op === "u-") {
        if (!stack.length) throw new Error("Invalid negative");
        stack.push(-stack.pop()); continue;
      }
      if (stack.length < 2) throw new Error("Invalid expression");
      const b = stack.pop(), a = stack.pop();
      if (op === "+") stack.push(a + b);
      else if (op === "-") stack.push(a - b);
      else if (op === "*") stack.push(a * b);
      else if (op === "/") stack.push(a / b);
      else if (op === "^") stack.push(a ** b);
    }
  }
  if (stack.length !== 1 || !Number.isFinite(stack[0])) throw new Error("Expression has no finite result");
  return stack[0];
}

function evalX(expression, x) {
  let expr = expression.replace(/\bx\b/gi, "(" + x + ")");
  if (!/\bx\b/i.test(expression)) expr = expression.replace(/x/gi, "(" + x + ")");
  return evaluateExpression(expr);
}

/* ---------------- navigation ---------------- */

function openPage(id) {
  $$(".page").forEach(p => p.classList.toggle("active", p.id === id));
  $$(".nav-link").forEach(b => b.classList.toggle("active", b.dataset.page === id));
  $("#nav").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$$(".nav-link").forEach(btn => btn.addEventListener("click", () => openPage(btn.dataset.page)));
$$("[data-go]").forEach(btn => btn.addEventListener("click", () => openPage(btn.dataset.go)));
$("#menuButton").addEventListener("click", () => $("#nav").classList.toggle("open"));

/* ---------------- graphing ---------------- */

function renderFunctions() {
  $("#functionList").innerHTML = state.functions.map((fn, i) =>
    '<div class="function-row"><span class="dot"></span><input class="function-input" data-index="' + i + '" value="' + fn.replaceAll('"', '&quot;') + '" aria-label="Function ' + (i+1) + '"><button class="icon-button remove-fn" data-index="' + i + '" aria-label="Remove function">×</button></div>'
  ).join("");
  $$(".function-input").forEach(input => input.addEventListener("input", e => state.functions[Number(e.target.dataset.index)] = e.target.value));
  $$(".remove-fn").forEach(btn => btn.addEventListener("click", () => {
    if (state.functions.length === 1) return;
    state.functions.splice(Number(btn.dataset.index), 1);
    renderFunctions(); drawGraph();
  }));
}
$("#addFunction").addEventListener("click", () => {
  if (state.functions.length >= 4) return;
  state.functions.push("sin(x)");
  renderFunctions(); drawGraph();
});

function getGraphBounds() {
  return {
    minX: Number($("#minX").value) || -10,
    maxX: Number($("#maxX").value) || 10,
    minY: Number($("#minY").value) || -10,
    maxY: Number($("#maxY").value) || 10
  };
}
function drawGraph() {
  const canvas = $("#graphCanvas"), ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const w = Math.max(500, Math.floor(rect.width * dpr));
  const h = Math.max(320, Math.floor(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  ctx.clearRect(0,0,w,h);

  let {minX, maxX, minY, maxY} = getGraphBounds();
  if (minX >= maxX) [minX,maxX] = [-10,10];
  if (minY >= maxY) [minY,maxY] = [-10,10];
  state.graph = { minX, maxX, minY, maxY };

  const pxX = x => (x-minX)/(maxX-minX)*w;
  const pxY = y => h-(y-minY)/(maxY-minY)*h;
  const stepX = Math.max((maxX-minX)/12, 0.1);
  const stepY = Math.max((maxY-minY)/10, 0.1);

  ctx.lineWidth = 1*dpr;
  ctx.strokeStyle = "rgba(255,255,255,.055)";
  ctx.beginPath();
  for (let x=Math.ceil(minX/stepX)*stepX; x<=maxX; x+=stepX) { const p=pxX(x); ctx.moveTo(p,0); ctx.lineTo(p,h); }
  for (let y=Math.ceil(minY/stepY)*stepY; y<=maxY; y+=stepY) { const p=pxY(y); ctx.moveTo(0,p); ctx.lineTo(w,p); }
  ctx.stroke();

  const ox = (0>=minX && 0<=maxX) ? pxX(0) : null;
  const oy = (0>=minY && 0<=maxY) ? pxY(0) : null;
  ctx.strokeStyle = "rgba(255,255,255,.32)";
  ctx.lineWidth = 1.4*dpr;
  ctx.beginPath();
  if (ox !== null) { ctx.moveTo(ox,0); ctx.lineTo(ox,h); }
  if (oy !== null) { ctx.moveTo(0,oy); ctx.lineTo(w,oy); }
  ctx.stroke();

  ctx.fillStyle = "rgba(225,230,245,.55)";
  ctx.font = (11*dpr) + "px system-ui";
  ctx.textAlign = "center";
  for (let x=Math.ceil(minX/stepX)*stepX; x<=maxX; x+=stepX) {
    const p=pxX(x); if (Math.abs(p-(ox||-999))<3) continue;
    ctx.fillText(fmt(x,2), p, Math.min(h-5, (oy ?? h-5)+15*dpr));
  }
  ctx.textAlign = "right";
  for (let y=Math.ceil(minY/stepY)*stepY; y<=maxY; y+=stepY) {
    const p=pxY(y); if (Math.abs(p-(oy||-999))<3) continue;
    ctx.fillText(fmt(y,2), Math.max(34, (ox ?? 34)-6*dpr), p+4*dpr);
  }

  const strokes = ["#a898ff","#5fdcff","#ff8fd0","#77e6a7"];
  state.functions.forEach((fn, fi) => {
    ctx.strokeStyle = strokes[fi];
    ctx.lineWidth = 2.2*dpr;
    ctx.beginPath();
    let drawing = false;
    const samples = Math.max(800, Math.floor(w/dpr)*1.4);
    let lastY = null;
    for (let i=0; i<=samples; i++) {
      const x=minX+(maxX-minX)*i/samples;
      let y;
      try { y = evalX(fn,x); } catch { drawing=false; lastY=null; continue; }
      if (!Number.isFinite(y) || Math.abs(y)>1e8) { drawing=false; lastY=null; continue; }
      const py=pxY(y);
      if (lastY !== null && Math.abs(py-lastY)>h*1.8) drawing=false;
      if (!drawing) ctx.moveTo(pxX(x),py); else ctx.lineTo(pxX(x),py);
      drawing=true; lastY=py;
    }
    ctx.stroke();
  });
  $("#graphStatus").textContent = "Plotted " + state.functions.length + " function" + (state.functions.length===1?"":"s") + ".";
}
$("#plotButton").addEventListener("click", drawGraph);
$("#resetGraph").addEventListener("click", () => {
  $("#minX").value=-10; $("#maxX").value=10; $("#minY").value=-10; $("#maxY").value=10; drawGraph();
});

const canvas = $("#graphCanvas");
let dragging = false, lastPointer = null;
canvas.addEventListener("pointerdown", e => { dragging=true; lastPointer={x:e.clientX,y:e.clientY}; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener("pointermove", e => {
  const r=canvas.getBoundingClientRect();
  if (!dragging) {
    const {minX,maxX,minY,maxY}=getGraphBounds();
    const x=minX+(e.clientX-r.left)/r.width*(maxX-minX);
    const y=maxY-(e.clientY-r.top)/r.height*(maxY-minY);
    $("#coords").textContent="x: "+fmt(x,3)+", y: "+fmt(y,3);
    return;
  }
  const {minX,maxX,minY,maxY}=getGraphBounds();
  const dx=(e.clientX-lastPointer.x)/r.width*(maxX-minX);
  const dy=(e.clientY-lastPointer.y)/r.height*(maxY-minY);
  $("#minX").value=minX-dx; $("#maxX").value=maxX-dx; $("#minY").value=minY+dy; $("#maxY").value=maxY+dy;
  lastPointer={x:e.clientX,y:e.clientY}; drawGraph();
});
canvas.addEventListener("pointerup", () => dragging=false);
canvas.addEventListener("pointerleave", () => dragging=false);
canvas.addEventListener("wheel", e => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? .82 : 1.22;
  const {minX,maxX,minY,maxY}=getGraphBounds();
  const mx=(minX+maxX)/2, my=(minY+maxY)/2;
  const nx=(maxX-minX)*factor, ny=(maxY-minY)*factor;
  $("#minX").value=mx-nx/2; $("#maxX").value=mx+nx/2; $("#minY").value=my-ny/2; $("#maxY").value=my+ny/2;
  drawGraph();
}, {passive:false});

/* ---------------- systems ---------------- */

function solveSystem(a,b,c,d,e,f) {
  const det = a*e-b*d;
  if (Math.abs(det) < 1e-12) {
    const same = Math.abs(a* f - d*c) < 1e-12 && Math.abs(b*f-e*c) < 1e-12;
    return same ? {type:"infinite"} : {type:"none"};
  }
  const x=(c*e-b*f)/det, y=(a*f-c*d)/det;
  return {type:"unique",x,y,det};
}
function showSystem() {
  const a=Number($("#s1a").value), b=Number($("#s1b").value), c=Number($("#s1c").value);
  const d=Number($("#s2a").value), e=Number($("#s2b").value), f=Number($("#s2c").value);
  const result=solveSystem(a,b,c,d,e,f);
  if (result.type==="unique") {
    renderAnswer("#systemResult","Solution","("+fmt(result.x)+", "+fmt(result.y)+")",[
      "Multiply the equations by values that make one variable cancel.",
      "Eliminate one variable to get the remaining variable.",
      "Substitute back into either equation.",
      "Check the ordered pair in both original equations."
    ]);
  } else if (result.type==="infinite") {
    renderAnswer("#systemResult","System type","Infinitely many solutions",[
      "The equations reduce to the same line.",
      "Every point on that line satisfies both equations."
    ]);
  } else {
    renderAnswer("#systemResult","System type","No solution",[
      "The equations have the same slope but different intercepts.",
      "The lines are parallel, so they never intersect."
    ]);
  }
}
$("#solveSystem").addEventListener("click",showSystem);
$$("[data-system]").forEach(b=>b.addEventListener("click",()=>{
  const [a,b,c,d,e,f]=b.dataset.system.split(",").map(Number);
  ["s1a","s1b","s1c","s2a","s2b","s2c"].forEach((id,i)=>$("#"+id).value=[a,b,c,d,e,f][i]);
  showSystem();
}));

/* ---------------- algebra ---------------- */

$$("[data-mode]").forEach(btn=>btn.addEventListener("click",()=>{
  if (!btn.closest("#algebraMode")) return;
  state.algebraMode=btn.dataset.mode;
  $$("#algebraMode button").forEach(b=>b.classList.toggle("selected",b===btn));
  ["linear","quadratic","exponential"].forEach(id=>$("#"+id+"Form").classList.toggle("hidden",id!==state.algebraMode));
}));
$("#solveLinear").addEventListener("click",()=>{
  const a=Number($("#linA").value), b=Number($("#linB").value), c=Number($("#linC").value);
  if (a===0) {
    renderAnswer("#algebraResult","Result",b===c?"All real numbers":"No solution",["When a = 0, the equation is no longer a true linear equation."]);
    return;
  }
  renderAnswer("#algebraResult","x =",fmt((c-b)/a),[
    "Subtract b from both sides: ax = "+fmt(c-b)+".",
    "Divide both sides by a: x = ("+fmt(c-b)+") / ("+fmt(a)+")."
  ]);
});
$("#solveQuadratic").addEventListener("click",()=>{
  const a=Number($("#quadA").value), b=Number($("#quadB").value), c=Number($("#quadC").value);
  if (a===0) { renderAnswer("#algebraResult","x =",fmt((c-b)/a),["a = 0, so this is actually linear."]); return; }
  const D=b*b-4*a*c;
  if (D>0) {
    const r1=(-b+Math.sqrt(D))/(2*a), r2=(-b-Math.sqrt(D))/(2*a);
    renderAnswer("#algebraResult","Roots",fmt(r1)+"  and  "+fmt(r2),[
      "Find the discriminant: b² − 4ac = "+fmt(D)+".",
      "Use x = (−b ± √(b² − 4ac)) / 2a.",
      "The two real roots are "+fmt(r1)+" and "+fmt(r2)+"."
    ]);
  } else if (Math.abs(D)<1e-12) {
    const r=-b/(2*a);
    renderAnswer("#algebraResult","Double root",fmt(r),["The discriminant is 0, so the parabola touches the x-axis once."]);
  } else {
    const real=-b/(2*a), imag=Math.sqrt(-D)/(2*a);
    renderAnswer("#algebraResult","Complex roots",fmt(real)+" ± "+fmt(Math.abs(imag))+"i",["The discriminant is negative, so there are no real roots."]);
  }
});
$("#solveExponential").addEventListener("click",()=>{
  const a=Number($("#expA").value), b=Number($("#expB").value), y=Number($("#expY").value);
  if (a===0 || b<=0 || b===1 || y/a<=0) {
    renderAnswer("#algebraResult","Result","Undefined for these inputs",["Use a ≠ 0, b > 0, b ≠ 1, and y/a > 0 for a real logarithmic solution."]);
    return;
  }
  const x=Math.log(y/a)/Math.log(b);
  renderAnswer("#algebraResult","x =",fmt(x),[
    "Divide by a: bˣ = "+fmt(y/a)+".",
    "Take log of both sides: x·log(b) = log("+fmt(y/a)+").",
    "Divide by log(b): x = log("+fmt(y/a)+") / log(b)."
  ]);
});

/* ---------------- trig ---------------- */

function toRad(x) { return state.angleMode==="deg" ? x*Math.PI/180 : x; }
function fromRad(x) { return state.angleMode==="deg" ? x*180/Math.PI : x; }
function trigValue(name,x) {
  const r=toRad(x);
  return Math[name](r);
}
$("#calculateTrig").addEventListener("click",()=>{
  const x=Number($("#theta").value);
  renderAnswer("#trigResult","Trig values","sin "+fmt(trigValue("sin",x))+" • cos "+fmt(trigValue("cos",x))+" • tan "+fmt(trigValue("tan",x)),[
    "Angle mode: "+(state.angleMode==="deg"?"degrees":"radians")+".",
    "sin(θ) = "+fmt(trigValue("sin",x))+".",
    "cos(θ) = "+fmt(trigValue("cos",x))+".",
    "tan(θ) = "+fmt(trigValue("tan",x))+"."
  ]);
});
$("[data-trig]").forEach(btn=>btn.addEventListener("click",()=>{\n  const x=Number($("#theta").value), fn=btn.dataset.trig;\n  renderAnswer("#trigResult",fn+"(θ)",fmt(trigValue(fn,x)),["Angle mode: "+(state.angleMode==="deg"?"degrees":"radians")+"." ]);\n}));
$$("#angleMode button").forEach(btn=>btn.addEventListener("click",()=>{
  state.angleMode=btn.dataset.angleMode;
  $$("#angleMode button").forEach(b=>b.classList.toggle("selected",b===btn));
}));
$("#calculateInverse").addEventListener("click",()=>{
  const value=Number($("#invValue").value), fn=$("#invFunc").value;
  if ((fn === "asin" || fn === "acos") && (value < -1 || value > 1)) {
    renderAnswer("#trigResult","Inverse trig","Undefined in the real numbers",["sin⁻¹ and cos⁻¹ require inputs from −1 to 1."]);
    return;
  }
  const result=fromRad(Math[fn](value));
  renderAnswer("#trigResult",fn+" result",fmt(result)+(state.angleMode==="deg"?"°":" rad"),["The inverse function returned an angle in "+(state.angleMode==="deg"?"degrees":"radians")+"."]);
});

/* ---------------- geometry ---------------- */

const shapeMeta = {
  circle: { title:"Circle", fields:[["r","Radius"]] },
  triangle: { title:"Triangle", fields:[["base","Base"],["height","Height"]] },
  rectangle: { title:"Rectangle", fields:[["width","Width"],["height","Height"]] },
  sphere: { title:"Sphere", fields:[["r","Radius"]] },
  cylinder: { title:"Cylinder", fields:[["r","Radius"],["h","Height"]] }
};
function renderShapeFields() {
  const meta=shapeMeta[state.shape];
  $("#shapeFields").innerHTML=meta.fields.map(f=>'<label>'+f[1]+'<input id="g_'+f[0]+'" type="number" value="5" step="any"></label>').join("");
}
$$("[data-shape]").forEach(btn=>btn.addEventListener("click",()=>{
  state.shape=btn.dataset.shape;
  $$("#shapeMode button").forEach(b=>b.classList.toggle("selected",b===btn));
  renderShapeFields();
}));
$("#calculateGeometry").addEventListener("click",()=>{
  const get=id=>Number($("#g_"+id).value);
  let title="", value="", steps=[];
  if (state.shape==="circle") {
    const r=get("r"), area=Math.PI*r*r, circumference=2*Math.PI*r;
    title="Circle"; value="A = "+fmt(area)+" • C = "+fmt(circumference); steps=["Area = πr²","Circumference = 2πr","r = "+fmt(r)];
  } else if (state.shape==="triangle") {
    const b=get("base"), h=get("height"), a=b*h/2;
    title="Triangle"; value="Area = "+fmt(a); steps=["Area = ½bh","½ × "+fmt(b)+" × "+fmt(h)+" = "+fmt(a)];
  } else if (state.shape==="rectangle") {
    const w=get("width"), h=get("height"), a=w*h, p=2*(w+h);
    title="Rectangle"; value="A = "+fmt(a)+" • P = "+fmt(p); steps=["Area = wh","Perimeter = 2(w + h)"];
  } else if (state.shape==="sphere") {
    const r=get("r"), sa=4*Math.PI*r*r, v=4/3*Math.PI*r*r*r;
    title="Sphere"; value="SA = "+fmt(sa)+" • V = "+fmt(v); steps=["Surface area = 4πr²","Volume = ⁴⁄₃πr³"];
  } else {
    const r=get("r"), h=get("h"), sa=2*Math.PI*r*(r+h), v=Math.PI*r*r*h;
    title="Cylinder"; value="SA = "+fmt(sa)+" • V = "+fmt(v); steps=["Surface area = 2πr(r + h)","Volume = πr²h"];
  }
  renderAnswer("#geometryResult",title,value,steps);
});

/* ---------------- arithmetic ---------------- */

$$("[data-key]").forEach(btn=>btn.addEventListener("click",()=>{
  const input=$("#calcInput"), key=btn.dataset.key;
  input.value += key==="pi" ? "π" : key;
  input.focus();
}));
$("#clearCalc").addEventListener("click",()=>$("#calcInput").value="");
$("#evaluateCalc").addEventListener("click",()=>{
  try {
    const raw=$("#calcInput").value;
    const value=evaluateExpression(raw);
    renderAnswer("#calcResult","Result",fmt(value),["Expression: "+raw,"Evaluated using standard order of operations."]);
  } catch (err) {
    renderAnswer("#calcResult","Error","Check the expression",[err.message]);
  }
});
$("#calcInput").addEventListener("keydown",e=>{ if(e.key==="Enter") $("#evaluateCalc").click(); });

/* boot */
renderFunctions();
renderShapeFields();
requestAnimationFrame(drawGraph);
window.addEventListener("resize", drawGraph);
