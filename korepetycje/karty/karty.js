/* Karty pracy: worksheet engine.
 *
 * A sheet page carries its data in <script type="application/json" id="sheet-data">
 * (written by scripts/build_karty.py from korepetycje/karty/sheets/<id>.json).
 * This file renders it, checks answers in the browser and saves progress in
 * localStorage. The checking half (Check) has no DOM use, so Node can load it:
 * scripts/check_karty.js uses it to test every key.
 *
 * Answer types (see korepetycje/karty/README.md):
 *   num    number: "3", "-1/2", "1,75"           key: "1.75" / "27/8" / ["4","-4"]
 *   expr   algebraic expression, simplified    key: "x^7/y^9"
 *   pow    a single power with a given base    key: "2^7"
 *   sci    scientific notation a*10^k          key: "4,7*10^-4"
 *   choice one of several options              key: option index
 *   order  put items in order                  key: item indices, first to last
 *   self   no input; show solution, self-mark
 */
(function(root){
'use strict';

/* ───────────────────────── parsing ───────────────────────── */

function norm(s){
  return String(s == null ? '' : s)
    .replace(/[−‒–—]/g, '-')
    .replace(/[·×⋅∙•]/g, '*')
    .replace(/\*\*/g, '^')
    .replace(/[{\[]/g, '(').replace(/[}\]]/g, ')')
    .replace(/:/g, '/')
    .replace(/,/g, '.')
    .replace(/\s+/g, '');
}

/* plain number: integer, decimal, fraction, mixed number ("1 1/2"); trailing unit ignored */
function parseNum(raw){
  var s0 = String(raw == null ? '' : raw).trim();
  var mixed = s0.replace(/[−–]/g, '-').match(/^([+-]?)(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if(mixed){
    var d0 = +mixed[4]; if(!d0) return null;
    var mv = +mixed[2] + (+mixed[3]) / d0;
    return mixed[1] === '-' ? -mv : mv;
  }
  var s = norm(s0).replace(/(?:[a-ząćęłńóśźż%°]+\d?)(?:\/[a-z]+)?$/i, '');
  var m = s.match(/^([+-]?)(\d+(?:\.\d+)?|\.\d+)(?:\/(\d+(?:\.\d+)?))?$/);
  if(!m) return null;
  var v = parseFloat(m[2]);
  if(m[3] !== undefined){ var d = parseFloat(m[3]); if(!d) return null; v /= d; }
  return m[1] === '-' ? -v : v;
}

function tokenize(s){
  var t = [], i = 0;
  while(i < s.length){
    var c = s[i];
    if(/[0-9.]/.test(c)){
      var j = i; while(j < s.length && /[0-9.]/.test(s[j])) j++;
      var n = s.slice(i, j);
      if(!/^(\d+\.?\d*|\.\d+)$/.test(n)) throw new Error('num');
      t.push({k:'n', v:parseFloat(n), s:n}); i = j; continue;
    }
    if(/[a-zA-Z]/.test(c)){ t.push({k:'v', v:c}); i++; continue; }
    if('+-*/^()'.indexOf(c) >= 0){ t.push({k:c}); i++; continue; }
    throw new Error('char');
  }
  var out = [];
  for(var k = 0; k < t.length; k++){
    var a = out[out.length - 1], b = t[k];
    if(a && (a.k === 'n' || a.k === 'v' || a.k === ')') && (b.k === 'n' || b.k === 'v' || b.k === '(')) out.push({k:'*', imp:true});
    out.push(b);
  }
  return out;
}

/* AST: {t:'n',v} {t:'v',v} {t:'neg',a} {t:'+'|'-'|'*'|'/'|'^',a,b} {t:'()',a} */
function parse(raw){
  var toks = tokenize(norm(raw)), p = 0;
  if(!toks.length) throw new Error('empty');
  function peek(){ return toks[p] && toks[p].k; }
  function expr(){
    var a = term();
    while(peek() === '+' || peek() === '-'){ var op = toks[p++].k; a = {t:op, a:a, b:term()}; }
    return a;
  }
  function term(){
    var a = unary();
    while(peek() === '*' || peek() === '/'){ var tk = toks[p++]; a = {t:tk.k, a:a, b:unary(), imp:tk.imp}; }
    return a;
  }
  function unary(){
    if(peek() === '-'){ p++; return {t:'neg', a:unary()}; }
    if(peek() === '+'){ p++; return unary(); }
    return power();
  }
  function power(){
    var a = atom();
    if(peek() === '^'){ p++; return {t:'^', a:a, b:unary()}; }
    return a;
  }
  function atom(){
    var tk = toks[p++];
    if(!tk) throw new Error('end');
    if(tk.k === 'n') return {t:'n', v:tk.v, s:tk.s};
    if(tk.k === 'v') return {t:'v', v:tk.v};
    if(tk.k === '('){ var e = expr(); if(peek() !== ')') throw new Error('paren'); p++; return {t:'()', a:e}; }
    throw new Error('token');
  }
  var ast = expr();
  if(p !== toks.length) throw new Error('trailing');
  return ast;
}

function evalAst(n, env){
  switch(n.t){
    case 'n': return n.v;
    case 'v': if(!(n.v in env)) throw new Error('var'); return env[n.v];
    case 'neg': return -evalAst(n.a, env);
    case '()': return evalAst(n.a, env);
    case '+': return evalAst(n.a, env) + evalAst(n.b, env);
    case '-': return evalAst(n.a, env) - evalAst(n.b, env);
    case '*': return evalAst(n.a, env) * evalAst(n.b, env);
    case '/': return evalAst(n.a, env) / evalAst(n.b, env);
    case '^': return Math.pow(evalAst(n.a, env), evalAst(n.b, env));
  }
  throw new Error('node');
}

function walk(n, fn){
  fn(n);
  if(n.a) walk(n.a, fn);
  if(n.b) walk(n.b, fn);
}
function varCounts(ast){
  var c = {};
  walk(ast, function(n){ if(n.t === 'v') c[n.v] = (c[n.v] || 0) + 1; });
  return c;
}
function hasNegExp(ast){
  var neg = false;
  walk(ast, function(n){
    if(n.t !== '^') return;
    var e = n.b; while(e.t === '()') e = e.a;
    if(e.t === 'neg' || (e.t === 'n' && e.v < 0)) neg = true;
  });
  return neg;
}

function close(a, b){
  if(!isFinite(a) || !isFinite(b)) return false;
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

/* value of a constant input (any notation), or null */
function constVal(raw){
  var v = parseNum(raw);
  if(v !== null) return v;
  try{
    var ast = parse(raw);
    if(Object.keys(varCounts(ast)).length) return null;
    v = evalAst(ast, {});
    return isFinite(v) ? v : null;
  }catch(e){ return null; }
}

/* deterministic pseudo-random points so a check gives the same result every time */
function samplePoints(vars, count){
  var pts = [], seed = 12345;
  function rnd(){ seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
  for(var i = 0; i < count; i++){
    var env = {};
    vars.forEach(function(v){ env[v] = v === 'n' || v === 'k' ? 1 + Math.floor(rnd() * 6) : 1.1 + rnd() * 1.9; });
    pts.push(env);
  }
  return pts;
}

var POW_RE = /^\(?([+-]?\d+(?:\.\d+)?)\)?\^\(?([+-]?\d+)\)?$/;
var SCI_RE = /^([+-]?\d+(?:\.\d+)?)(?:\*10\^\(?([+-]?\d+)\)?)?$/;
var SCI_RE2 = /^10\^\(?([+-]?\d+)\)?$/;

function sciParts(raw){
  var s = norm(raw).replace(/(?:[a-z]+\d?)(?:\/[a-z]+)?$/i, ''), m;
  if((m = s.match(SCI_RE2))) return {a:1, k:+m[1]};
  m = s.match(/^([+-]?\d+(?:\.\d+)?)\*10\^\(?([+-]?\d+)\)?$/);
  if(m) return {a:parseFloat(m[1]), k:+m[2]};
  var e = s.match(/^([+-]?\d+(?:\.\d+)?)e([+-]?\d+)$/i);
  if(e) return {a:parseFloat(e[1]), k:+e[2]};
  return null;
}

/* Result: {s:'ok'|'form'|'bad'|'empty'|'error', msg} */
var Check = {
  num: function(ans, val){
    if(String(val).trim() === '') return {s:'empty'};
    var keys = [].concat(ans.key).map(function(k){ return constVal(k); });
    var v = parseNum(val);
    if(v === null){
      var cv = constVal(val);
      if(cv === null) return {s:'error', msg:'Nie rozumiem tego zapisu.'};
      if(keys.some(function(k){ return close(cv, k); })) return {s:'form', msg:'Wartość dobra, ale zapisz wynik jako liczbę (np. 27/8 albo 3,375).'};
      return {s:'bad'};
    }
    var tol = ans.tol || 0, rtol = ans.rtol || 0;
    var ok = keys.some(function(k){
      if(tol) return Math.abs(v - k) <= tol;
      if(rtol) return Math.abs(v - k) <= rtol * Math.abs(k);
      return close(v, k);
    });
    return {s: ok ? 'ok' : 'bad'};
  },
  expr: function(ans, val){
    if(String(val).trim() === '') return {s:'empty'};
    var a, b;
    try{ a = parse(val); }catch(e){ return {s:'error', msg:'Nie rozumiem tego zapisu.'}; }
    b = parse(ans.key);
    var vars = Object.keys(Object.assign({}, varCounts(a), varCounts(b)));
    var pts = samplePoints(vars, 8), same = true;
    try{
      for(var i = 0; i < pts.length; i++){ if(!close(evalAst(a, pts[i]), evalAst(b, pts[i]))){ same = false; break; } }
    }catch(e){ return {s:'error', msg:'Nie rozumiem tego zapisu.'}; }
    if(!same) return {s:'bad'};
    if(ans.noNeg !== false && hasNegExp(a)) return {s:'form', msg:'Dobrze, ale zapisz wynik bez wykładników ujemnych.'};
    if(ans.simple !== false){
      var c = varCounts(a);
      for(var v in c){ if(c[v] > 1) return {s:'form', msg:'Dobrze, ale uprość do końca: każda zmienna powinna wystąpić raz.'}; }
    }
    return {s:'ok'};
  },
  pow: function(ans, val){
    if(String(val).trim() === '') return {s:'empty'};
    var k = norm(ans.key).match(POW_RE), m = norm(val).match(POW_RE);
    if(m && +m[1] === +k[1] && +m[2] === +k[2]) return {s:'ok'};
    var v = constVal(val), kv = Math.pow(+k[1], +k[2]);
    if(v === null) return {s:'error', msg:'Wpisz potęgę, np. 2^7.'};
    if(close(v, kv)) return {s:'form', msg:'Wartość dobra, ale zapisz ją jako jedną potęgę liczby ' + k[1] + ', np. ' + k[1] + '^5.'};
    return {s:'bad'};
  },
  sci: function(ans, val){
    if(String(val).trim() === '') return {s:'empty'};
    var kp = sciParts(ans.key), kv = kp.a * Math.pow(10, kp.k);
    var p = sciParts(val);
    var v = p ? p.a * Math.pow(10, p.k) : constVal(val);
    if(v === null) return {s:'error', msg:'Wpisz wynik w postaci a·10^k, np. 4,7*10^-4.'};
    if(!close(v, kv)) return {s:'bad'};
    if(!p || Math.abs(p.a) < 1 || Math.abs(p.a) >= 10) return {s:'form', msg:'Wartość dobra, ale zapisz ją w notacji wykładniczej: a·10^k, gdzie 1 ≤ a < 10.'};
    return {s:'ok'};
  },
  choice: function(ans, val){
    if(val === '' || val == null) return {s:'empty'};
    return {s: +val === +ans.key ? 'ok' : 'bad'};
  },
  order: function(ans, val){
    var seq = val ? String(val).split(',').filter(Boolean).map(Number) : [];
    if(seq.length < ans.items.length) return {s:'empty'};
    return {s: seq.join(',') === ans.key.join(',') ? 'ok' : 'bad'};
  },
  self: function(ans, val){
    if(val === 'ok') return {s:'ok'};
    if(val === 'bad') return {s:'bad'};
    return {s:'empty'};
  }
};

/* LaTeX preview of a typed expression */
function texOf(n){
  switch(n.t){
    case 'n': return n.s.replace('.', '{,}');
    case 'v': return n.v;
    case 'neg': return '-' + texOf(n.a);
    case '()': return '\\left(' + texOf(n.a) + '\\right)';
    case '+': return texOf(n.a) + '+' + texOf(n.b);
    case '-': return texOf(n.a) + '-' + texOf(n.b);
    case '*': return texOf(n.a) + (n.imp ? '' : '\\cdot ') + texOf(n.b);
    case '/': return '\\frac{' + texOf(strip(n.a)) + '}{' + texOf(strip(n.b)) + '}';
    case '^': return '{' + texOf(n.a) + '}^{' + texOf(strip(n.b)) + '}';
  }
  return '';
}
function strip(n){ while(n.t === '()') n = n.a; return n; }
function texOfInput(raw){
  try{ return texOf(parse(raw)); }catch(e){ return null; }
}

var API = {Check:Check, parse:parse, parseNum:parseNum, constVal:constVal, sciParts:sciParts, texOfInput:texOfInput};
if(typeof module !== 'undefined' && module.exports){ module.exports = API; return; }
root.Karty = API;

/* ───────────────────────── page ───────────────────────── */

var dataEl = document.getElementById('sheet-data');
if(!dataEl) return;
var sheet = JSON.parse(dataEl.textContent);
var app = document.getElementById('sheet');
var STORE = 'karty:' + sheet.id;
var LETTERS = 'abcdefghijklmnopqrstuvwxyz';
var TYPED = {num:1, expr:1, pow:1, sci:1};
var HINTS = {
  num: 'liczba',
  expr: 'wyrażenie',
  pow: 'np. 2^7',
  sci: 'np. 4,7*10^-4'
};

var saved = {};
try{ saved = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; }catch(e){ saved = {}; }
function save(){
  try{ localStorage.setItem(STORE, JSON.stringify(saved)); }catch(e){}
}

/* Full-size fractions in questions; systems with fractions get extra row space so rows don't touch. */
function bigFractions(q){
  if(q.indexOf('\\frac') < 0) return q;
  q = q.replace(/\\frac(?=[{\s\d])/g, '\\dfrac');
  return q.replace(/\\begin\{cases\}([\s\S]*?)\\end\{cases\}/g, function(m, body){
    return '\\begin{cases}' + body.replace(/\\\\(?!\[)/g, '\\\\[10pt]') + '\\end{cases}';
  });
}
function plural(n, one, few, many){
  var t = n % 10, h = n % 100;
  return n + ' ' + (n === 1 ? one : (t >= 2 && t <= 4 && (h < 12 || h > 14)) ? few : many);
}
function el(tag, cls, html){
  var e = document.createElement(tag);
  if(cls) e.className = cls;
  if(html != null) e.innerHTML = html;
  return e;
}
function esc(s){
  return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; });
}

function math(node){
  if(root.renderMathInElement){
    root.renderMathInElement(node, {
      delimiters:[{left:'$$', right:'$$', display:true}, {left:'$', right:'$', display:false}],
      throwOnError:false
    });
  }
}
function texInline(tex, node){
  if(root.katex){ try{ root.katex.render(tex, node, {throwOnError:false}); return; }catch(e){} }
  node.textContent = tex;
}

/* key in readable form for the answer reveal and the printed key */
function keyText(ans){
  if(ans.display) return ans.display;
  switch(ans.type){
    case 'choice': return ans.options[ans.key];
    case 'order': return ans.key.map(function(i){ return ans.items[i]; }).join(' $<$ ');
    case 'self': return '';
    case 'num': {
      var k = [].concat(ans.key).map(function(x){
        var t = texOfInput(x);
        return t ? '$' + t + '$' : esc(String(x).replace('.', ','));
      }).join(' lub ');
      return k + (ans.unit ? ' ' + ans.unit : '');
    }
    default: {
      var t = texOfInput(ans.key);
      return t ? '$' + t + '$' : esc(ans.key);
    }
  }
}

var parts = [];   /* {id, el, answers:[{ans, get(), set(), mark()}], status} */
var scoreEl;

function buildAnswer(ans, pid, ai, partEl){
  var store = saved[pid] = saved[pid] || {};
  var wrap = el('div', 'ka-ans ka-t-' + ans.type);
  var api = {ans:ans, wrap:wrap};

  if(ans.label){ var lab = el('span', 'ka-lab', ans.label); wrap.appendChild(lab); }

  if(TYPED[ans.type]){
    var inp = el('input', 'ka-input');
    inp.type = 'text';
    inp.setAttribute('autocomplete', 'off');
    inp.setAttribute('autocapitalize', 'off');
    inp.spellcheck = false;
    inp.inputMode = ans.type === 'num' ? 'decimal' : 'text';
    inp.placeholder = ans.placeholder || HINTS[ans.type];
    inp.setAttribute('aria-label', (ans.label ? ans.label.replace(/\$/g, '') + ' ' : '') + 'odpowiedź');
    inp.value = store[ai] || '';
    var box = el('span', 'ka-field');
    box.appendChild(inp);
    if(ans.unit) box.appendChild(el('span', 'ka-unit', ans.unit));
    wrap.appendChild(box);
    var prev = null;
    if(ans.type !== 'num'){
      prev = el('span', 'ka-preview');
      prev.setAttribute('aria-hidden', 'true');
      wrap.appendChild(prev);
    }
    var updPrev = function(){
      if(!prev) return;
      var t = inp.value.trim() ? texOfInput(inp.value) : null;
      prev.hidden = !t;
      if(t) texInline(t, prev);
    };
    updPrev();
    inp.addEventListener('input', function(){
      store[ai] = inp.value; save(); updPrev();
      wrap.classList.remove('is-ok', 'is-bad', 'is-form', 'is-error'); partEl.classList.remove('is-ok', 'is-bad');
    });
    inp.addEventListener('keydown', function(e){
      if(e.key === 'Enter'){ e.preventDefault(); checkPart(partOf(partEl)); }
    });
    api.get = function(){ return inp.value; };
    api.reset = function(){ inp.value = ''; updPrev(); };
  }
  else if(ans.type === 'choice'){
    var row = el('span', 'ka-choices');
    row.setAttribute('role', 'radiogroup');
    var btns = ans.options.map(function(o, oi){
      var b = el('button', 'ka-choice', o);
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(store[ai] === String(oi)));
      b.addEventListener('click', function(){
        store[ai] = String(oi); save();
        btns.forEach(function(x, xi){ x.setAttribute('aria-checked', String(xi === oi)); });
        wrap.classList.remove('is-ok', 'is-bad', 'is-form', 'is-error'); partEl.classList.remove('is-ok', 'is-bad');
      });
      row.appendChild(b);
      return b;
    });
    wrap.appendChild(row);
    api.get = function(){ return store[ai] == null ? '' : store[ai]; };
    api.reset = function(){ btns.forEach(function(x){ x.setAttribute('aria-checked', 'false'); }); };
  }
  else if(ans.type === 'order'){
    var pool = el('div', 'ka-pool'), seqEl = el('div', 'ka-seq');
    seqEl.setAttribute('data-empty', 'Klikaj liczby od najmniejszej do największej');
    var seq = store[ai] ? String(store[ai]).split(',').filter(Boolean).map(Number) : [];
    var chips = ans.items.map(function(it, ii){
      var c = el('button', 'ka-chip', it);
      c.type = 'button';
      c.addEventListener('click', function(){
        var at = seq.indexOf(ii);
        if(at >= 0) seq.splice(at); else seq.push(ii);
        store[ai] = seq.join(','); save(); draw();
        wrap.classList.remove('is-ok', 'is-bad'); partEl.classList.remove('is-ok', 'is-bad');
      });
      return c;
    });
    var draw = function(){
      pool.innerHTML = ''; seqEl.innerHTML = '';
      chips.forEach(function(c, ii){ if(seq.indexOf(ii) < 0) pool.appendChild(c); });
      seq.forEach(function(ii, k){
        if(k) seqEl.appendChild(el('span', 'ka-lt', '&lt;'));
        seqEl.appendChild(chips[ii]);
      });
    };
    draw();
    wrap.appendChild(pool); wrap.appendChild(seqEl);
    api.get = function(){ return seq.join(','); };
    api.reset = function(){ seq = []; draw(); };
  }
  else if(ans.type === 'self'){
    var sr = el('span', 'ka-self');
    var yes = el('button', 'ka-self-btn', 'Mam dobrze'), no = el('button', 'ka-self-btn', 'Mam źle');
    yes.type = no.type = 'button';
    var paint = function(){
      yes.setAttribute('aria-pressed', String(store[ai] === 'ok'));
      no.setAttribute('aria-pressed', String(store[ai] === 'bad'));
    };
    yes.addEventListener('click', function(){ store[ai] = 'ok'; save(); paint(); checkPart(partOf(partEl)); });
    no.addEventListener('click', function(){ store[ai] = 'bad'; save(); paint(); checkPart(partOf(partEl)); });
    paint();
    sr.appendChild(el('span', 'ka-self-q', 'Porównaj z rozwiązaniem:'));
    sr.appendChild(yes); sr.appendChild(no);
    wrap.appendChild(sr);
    api.get = function(){ return store[ai] || ''; };
    api.reset = function(){ paint(); };
  }

  api.mark = function(r){
    wrap.classList.remove('is-ok', 'is-bad', 'is-form', 'is-error'); partEl.classList.remove('is-ok', 'is-bad');
    if(r.s !== 'empty') wrap.classList.add('is-' + r.s);
  };
  return api;
}

function partOf(node){
  for(var i = 0; i < parts.length; i++) if(parts[i].el === node) return parts[i];
  return null;
}

function checkPart(p, quiet){
  var msgs = [], all = true, any = false;
  p.answers.forEach(function(a){
    var r = Check[a.ans.type](a.ans, a.get());
    if(!quiet || r.s !== 'empty') a.mark(r);
    if(r.s !== 'empty') any = true;
    if(r.s !== 'ok') all = false;
    if(r.msg && msgs.indexOf(r.msg) < 0) msgs.push(r.msg);
  });
  var isSelf = p.answers.length && p.answers.every(function(a){ return a.ans.type === 'self'; });
  p.status = all ? 'ok' : (any ? 'bad' : 'empty');
  p.el.classList.toggle('is-ok', p.status === 'ok');
  p.el.classList.toggle('is-bad', p.status === 'bad');
  if(!quiet || any){
    p.msg.textContent = msgs.join(' ');
    p.msg.hidden = !msgs.length;
    if(any && !isSelf) p.revealBtn.hidden = false;
    if(!any && !quiet){ p.msg.textContent = 'Najpierw wpisz odpowiedź.'; p.msg.hidden = false; }
  }
  updateScore();
}

function updateScore(){
  var done = 0, ok = 0;
  parts.forEach(function(p){ if(p.status && p.status !== 'empty') done++; if(p.status === 'ok') ok++; });
  scoreEl.innerHTML = '<b>' + ok + '</b> / ' + parts.length + ' <span>dobrze</span>' +
    (done ? '<span class="ks-sep">·</span><span>sprawdzone: ' + done + '</span>' : '');
}

function render(){
  var head = el('header', 'ks-head');
  head.appendChild(el('p', 'ks-kicker', esc(sheet.kicker || 'Karta pracy')));
  head.appendChild(el('h1', 'ks-title', esc(sheet.title)));
  if(sheet.subtitle) head.appendChild(el('p', 'ks-sub', esc(sheet.subtitle)));
  var nParts = 0;
  sheet.tasks.forEach(function(t){ nParts += t.parts.length; });
  var meta = el('p', 'ks-meta', plural(sheet.tasks.length, 'zadanie', 'zadania', 'zadań') + ' · ' +
    plural(nParts, 'podpunkt', 'podpunkty', 'podpunktów') +
    (sheet.date ? ' · ' + sheet.date.split('-').reverse().join('.') : '') + ' · Leon Górecki');
  head.appendChild(meta);
  app.appendChild(head);

  var nameRow = el('div', 'ks-namerow', '<span>Imię i nazwisko</span><span>Klasa</span><span>Wynik</span>');
  app.appendChild(nameRow);

  var bar = el('div', 'ks-bar');
  scoreEl = el('span', 'ks-score');
  scoreEl.setAttribute('aria-live', 'polite');
  var checkAll = el('button', 'ks-btn ks-btn-main', 'Sprawdź wszystko');
  var printBtn = el('button', 'ks-btn', 'Drukuj / PDF');
  var printKey = el('button', 'ks-btn', 'Drukuj z odpowiedziami');
  var clear = el('button', 'ks-btn ks-btn-quiet', 'Wyczyść');
  [checkAll, printBtn, printKey, clear].forEach(function(b){ b.type = 'button'; });
  bar.appendChild(scoreEl);
  var btns = el('span', 'ks-bar-btns');
  btns.appendChild(checkAll); btns.appendChild(printBtn); btns.appendChild(printKey); btns.appendChild(clear);
  bar.appendChild(btns);
  app.appendChild(bar);

  var help = el('details', 'ks-help');
  help.innerHTML = '<summary>Jak wpisywać odpowiedzi</summary><ul>' +
    '<li>Ułamek: <code>3/4</code>, liczba mieszana: <code>1 1/2</code>, dziesiętna: <code>0,25</code> lub <code>0.25</code></li>' +
    '<li>Potęga: <code>2^7</code>, wykładnik ujemny: <code>10^-4</code>, złożony wykładnik w nawiasie: <code>2^(n+2)</code></li>' +
    '<li>Mnożenie: <code>4,7*10^-4</code> albo bez znaku: <code>2xy</code></li>' +
    '<li>Jednostkę możesz pominąć. Pod polem widać, jak program odczytał Twój zapis.</li>' +
    '<li>Zielone pole: dobrze. Czerwone: źle. Żółte: wynik dobry, ale trzeba go jeszcze uprościć lub zapisać inaczej.</li>' +
    '</ul>';
  app.appendChild(help);

  if(sheet.intro) app.appendChild(el('p', 'ks-intro', sheet.intro));

  var keyList = el('ol', 'ks-key-list');

  sheet.tasks.forEach(function(t, ti){
    var card = el('section', 'kt' + (t.star ? ' kt-star' : ''));
    card.id = 'z' + (ti + 1);
    /* The lead block (number, label, instruction, first row of parts) never splits across pages. */
    var lead = el('div', 'kt-lead');
    var num = el('div', 'kt-num', String(ti + 1));
    lead.appendChild(num);
    var body = lead;
    if(t.label || t.star) body.appendChild(el('p', 'kt-label', esc(t.label || '') + (t.star ? ' <span class="kt-starbadge">zadanie z gwiazdką</span>' : '')));
    if(t.prompt) body.appendChild(el('p', 'kt-prompt', t.prompt));
    var cols0 = t.cols || 1;
    var makeGrid = function(){
      var g = el('div', 'kt-parts');
      g.style.setProperty('--cols', cols0);
      g.setAttribute('data-cols', cols0);
      return g;
    };
    var gridLead = makeGrid(), gridRest = makeGrid();
    var keyItem = el('li', 'ks-key-item');
    var keyParts = [];

    t.parts.forEach(function(pt, pi){
      var pid = (ti + 1) + LETTERS[pi];
      var pe = el('div', 'kp');
      var single = t.parts.length === 1;
      var qrow = el('div', 'kp-q');
      if(!single) qrow.appendChild(el('span', 'kp-letter', LETTERS[pi] + ')'));
      if(pt.q) qrow.appendChild(el('div', 'kp-text', bigFractions(pt.q)));
      pe.appendChild(qrow);
      var ansRow = el('div', 'kp-answers');
      var rec = {id:pid, el:pe, answers:[], status:''};
      (pt.answers || []).forEach(function(a, ai){
        var api = buildAnswer(a, pid, ai, pe);
        rec.answers.push(api);
        ansRow.appendChild(api.wrap);
      });
      pe.appendChild(ansRow);

      var isSelf = rec.answers.length && rec.answers.every(function(a){ return a.ans.type === 'self'; });
      var tools = el('div', 'kp-tools');
      var cb = el('button', 'kp-btn', 'Sprawdź'); cb.type = 'button';
      cb.addEventListener('click', function(){ checkPart(rec); });
      if(!isSelf) tools.appendChild(cb);
      var rb = el('button', 'kp-btn kp-btn-quiet', isSelf ? 'Pokaż rozwiązanie' : 'Pokaż odpowiedź'); rb.type = 'button';
      rb.hidden = !isSelf;
      tools.appendChild(rb);
      pe.appendChild(tools);
      var msg = el('p', 'kp-msg'); msg.hidden = true; msg.setAttribute('aria-live', 'polite');
      pe.appendChild(msg);

      var keyHtml = rec.answers.map(function(a){
        var k = keyText(a.ans);
        if(!k) return '';
        if(!a.ans.label) return k;
        var plain = a.ans.label.replace(/\$/g, '').trim();
        var sep = /[=:]$/.test(plain) || a.ans.type === 'choice' || a.ans.type === 'order' ? ' ' : ' = ';
        return a.ans.label + sep + k;
      }).filter(Boolean).join(', ');
      var reveal = el('div', 'kp-reveal');
      reveal.hidden = true;
      reveal.innerHTML = (keyHtml ? '<p class="kp-key"><span class="kp-key-h">Odpowiedź:</span> ' + keyHtml + '</p>' : '') +
        (pt.solution ? '<div class="kp-sol">' + pt.solution + '</div>' : '');
      pe.appendChild(reveal);
      rb.addEventListener('click', function(){
        reveal.hidden = !reveal.hidden;
        rb.textContent = reveal.hidden ? (isSelf ? 'Pokaż rozwiązanie' : 'Pokaż odpowiedź') : 'Ukryj';
      });
      rec.msg = msg; rec.revealBtn = rb;
      parts.push(rec);
      (pi < cols0 ? gridLead : gridRest).appendChild(pe);
      keyParts.push((single ? '' : '<b>' + LETTERS[pi] + ')</b> ') + (keyHtml || (pt.solution ? '<span class="ks-key-sol">' + pt.solution + '</span>' : '')));
    });

    lead.appendChild(gridLead);
    card.appendChild(lead);
    if(gridRest.children.length) card.appendChild(gridRest);
    app.appendChild(card);
    keyItem.innerHTML = keyParts.join('<span class="ks-key-gap"></span>');
    keyList.appendChild(keyItem);
  });

  var key = el('section', 'ks-key');
  key.appendChild(el('h2', 'ks-key-h', 'Odpowiedzi'));
  key.appendChild(keyList);
  app.appendChild(key);

  checkAll.addEventListener('click', function(){
    parts.forEach(function(p){ checkPart(p, true); });
    var first = parts.filter(function(p){ return p.status === 'bad'; })[0];
    if(first) first.el.scrollIntoView({behavior:'smooth', block:'center'});
  });
  printBtn.addEventListener('click', function(){ document.body.classList.remove('print-key'); window.print(); });
  printKey.addEventListener('click', function(){ document.body.classList.add('print-key'); window.print(); });
  window.addEventListener('afterprint', function(){ document.body.classList.remove('print-key'); });
  clear.addEventListener('click', function(){
    if(!confirm('Wyczyścić wszystkie odpowiedzi na tej karcie?')) return;
    try{ localStorage.removeItem(STORE); }catch(e){}
    location.reload();
  });

  math(app);
  fitAll();
  var fitTimer = 0;
  window.addEventListener('resize', function(){ clearTimeout(fitTimer); fitTimer = setTimeout(fitAll, 120); });
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll);
  /* restore marks for anything already answered */
  parts.forEach(function(p){ checkPart(p, true); });
  updateScore();

  if(location.hash){
    var target = document.getElementById(location.hash.slice(1));
    if(target) setTimeout(function(){ target.scrollIntoView(); }, 50);
  }
}

/* No sideways scrolling: drop columns until every part's maths fits,
   then, if one column is still too narrow (phones), shrink that formula. */
function overflows(node){ return node.scrollWidth > node.clientWidth + 1; }
function fitAll(){
  /* per task: the lead grid and the rest grid always share one column count */
  Array.prototype.forEach.call(app.querySelectorAll('.kt'), function(task){
    var grids = Array.prototype.slice.call(task.querySelectorAll('.kt-parts'));
    if(!grids.length) return;
    var texts = task.querySelectorAll('.kp-text');
    Array.prototype.forEach.call(texts, function(tx){ tx.style.fontSize = ''; });
    var cols = +grids[0].getAttribute('data-cols') || 1;
    if(window.matchMedia('(max-width:640px)').matches) cols = 1;
    var set = function(c){ grids.forEach(function(g){ g.style.setProperty('--cols', c); }); };
    set(cols);
    var any = function(){ return Array.prototype.some.call(texts, overflows); };
    while(cols > 1 && any()){ cols--; set(cols); }
    Array.prototype.forEach.call(texts, function(tx){
      var size = 100;
      while(overflows(tx) && size > 60){ size -= 5; tx.style.fontSize = size + '%'; }
    });
  });
}

function start(){ render(); }
if(root.renderMathInElement || document.readyState === 'complete') start();
else window.addEventListener('load', start);

})(typeof window !== 'undefined' ? window : this);
