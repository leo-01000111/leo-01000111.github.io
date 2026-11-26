#!/usr/bin/env node
/* Test every answer key in korepetycje/karty/sheets/*.json against the real checker
 * (korepetycje/karty/karty.js). A key must pass its own check as 'ok'. For expr keys
 * this also proves the key is in final form (no negative exponents, each variable once).
 * Optional per-answer "tests": [{"in": "...", "expect": "ok|form|bad|error"}] are run too.
 * Exit code 1 on any failure. Run: node scripts/check_karty.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const K = require('../korepetycje/karty/karty.js');

const dir = path.join(__dirname, '..', 'korepetycje', 'karty', 'sheets');
let bad = 0, n = 0;
const L = 'abcdefghijklmnopqrstuvwxyz';

for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
  const s = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  s.tasks.forEach((t, ti) => t.parts.forEach((p, pi) => (p.answers || []).forEach((a, ai) => {
    const where = `${f} zad. ${ti + 1}${L[pi]}) answer ${ai + 1}`;
    const run = (input, expect) => {
      n++;
      let r;
      try { r = K.Check[a.type](a, input); } catch (e) { r = { s: 'crash: ' + e.message }; }
      if (r.s !== expect) { bad++; console.error(`FAIL ${where}: input ${JSON.stringify(input)} -> ${r.s}, expected ${expect}`); }
    };
    if (a.type === 'num') [].concat(a.key).forEach((k) => run(String(k), 'ok'));
    else if (a.type === 'expr' || a.type === 'pow' || a.type === 'sci') run(a.key, 'ok');
    else if (a.type === 'choice') run(String(a.key), 'ok');
    else if (a.type === 'order') run(a.key.join(','), 'ok');
    (a.tests || []).forEach((tc) => run(tc.in, tc.expect));
  })));
}

/* engine self-tests */
const self = [
  ['num', { key: '27/8' }, '3,375', 'ok'], ['num', { key: '27/8' }, '27/8', 'ok'], ['num', { key: '-1/2' }, '−0,5', 'ok'],
  ['num', { key: '1.5' }, '1 1/2', 'ok'], ['num', { key: '3200000' }, '3 200 000', 'ok'], ['num', { key: '8' }, '8 km', 'ok'],
  ['num', { key: '27/8' }, '(2/3)^-3', 'form'], ['num', { key: '4' }, '5', 'bad'], ['num', { key: '4' }, 'abc', 'error'],
  ['num', { key: '84.5', rtol: 0.02 }, '85', 'ok'], ['num', { key: '84.5', rtol: 0.02 }, '80', 'bad'],
  ['expr', { key: 'x/y^2' }, 'x*y^-2', 'form'], ['expr', { key: 'x/y^2' }, 'x/y^2', 'ok'], ['expr', { key: 'a^7' }, 'a^5*a^-2*a^4', 'form'],
  ['expr', { key: 'a^5/(2b^5)' }, 'a^5/(2*b^5)', 'ok'], ['expr', { key: 'a^7' }, 'a^6', 'bad'], ['expr', { key: 'y^8/(2x)' }, '0.5y^8/x', 'ok'],
  ['pow', { key: '2^7' }, '2^7', 'ok'], ['pow', { key: '2^7' }, '128', 'form'], ['pow', { key: '2^7' }, '4^3*2', 'form'], ['pow', { key: '5^3' }, '5^(3)', 'ok'],
  ['sci', { key: '4,7*10^-4' }, '4,7·10^-4', 'ok'], ['sci', { key: '4,7*10^-4' }, '0,00047', 'form'], ['sci', { key: '4,7*10^-4' }, '47*10^-5', 'form'],
  ['sci', { key: '5*10^2' }, '5*10^2 s', 'ok'], ['sci', { key: '4,7*10^-4' }, '4,7*10^4', 'bad'],
];
for (const [type, ans, input, expect] of self) {
  n++;
  const r = K.Check[type](ans, input);
  if (r.s !== expect) { bad++; console.error(`FAIL engine ${type} key ${ans.key}: ${JSON.stringify(input)} -> ${r.s}, expected ${expect}`); }
}

console.log(`check_karty: ${n - bad}/${n} checks passed`);
process.exit(bad ? 1 : 0);
