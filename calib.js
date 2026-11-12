/*
 * calib.js: scoring engine for the Expert Calibration Trainer.
 * Pure functions only: CSV parsing, number parsing and formatting, session drawing,
 * simulated experts, and every score shown in the app. No DOM access.
 */
(function (root) {
  'use strict';

  const LEVELS = [0.5, 0.6, 0.7, 0.8, 0.9, 0.99];
  const CAP = 0.99;

  /* ---------- random numbers ---------- */
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) {
    let u = 0, v = 0;
    while (u === 0) u = r();
    while (v === 0) v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function shuffle(arr, r) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /* ---------- normal quantile (Acklam) ---------- */
  function normInv(p) {
    if (p <= 0) return -Infinity; if (p >= 1) return Infinity;
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
    const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    const pl = 0.02425;
    let q, r;
    if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - pl) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  /* ---------- Beta posterior interval for a hit rate (grid) ---------- */
  function betaInterval(h, n, level) {
    const A = 1 + h, B = 1 + n - h, N = 4000;
    const lp = [], xs = [];
    let mx = -Infinity;
    for (let i = 0; i < N; i++) {
      const x = (i + 0.5) / N; xs.push(x);
      const v = (A - 1) * Math.log(x) + (B - 1) * Math.log(1 - x);
      lp.push(v); if (v > mx) mx = v;
    }
    let tot = 0; const cdf = lp.map(v => (tot += Math.exp(v - mx)));
    const lo = (1 - level) / 2, hi = 1 - lo;
    let L = 0, U = 1;
    for (let i = 0; i < N; i++) { if (cdf[i] / tot >= lo) { L = xs[i]; break; } }
    for (let i = 0; i < N; i++) { if (cdf[i] / tot >= hi) { U = xs[i]; break; } }
    return { mean: A / (A + B), lo: L, hi: U };
  }

  /* ---------- CSV ---------- */
  function parseCSV(text) {
    const rows = []; let row = [], f = '', q = false, i = 0;
    text = String(text).replace(/^\uFEFF/, '');
    while (i < text.length) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i += 2; continue; } q = false; i++; continue; }
        f += ch; i++; continue;
      }
      if (ch === '"') { q = true; i++; continue; }
      if (ch === ',') { row.push(f); f = ''; i++; continue; }
      if (ch === '\r') { i++; continue; }
      if (ch === '\n') { row.push(f); rows.push(row); row = []; f = ''; i++; continue; }
      f += ch; i++;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    return rows.filter(r => r.some(c => c.trim() !== ''));
  }
  function csvCell(v) {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCSV(rows) { return rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n'; }

  const REQUIRED = ['id', 'type', 'question', 'answer'];
  function loadBank(text, origin) {
    const rows = parseCSV(text), errors = [], items = [];
    if (!rows.length) return { items, errors: ['The file is empty.'] };
    const head = rows[0].map(h => h.trim().toLowerCase());
    const miss = REQUIRED.filter(c => head.indexOf(c) < 0);
    if (miss.length) return { items, errors: ['Missing required column' + (miss.length > 1 ? 's' : '') + ': ' + miss.join(', ') + '.'] };
    const seen = new Set();
    rows.slice(1).forEach((r, k) => {
      const line = k + 2, o = {};
      head.forEach((h, j) => { o[h] = (r[j] || '').trim(); });
      const type = o.type.toLowerCase();
      const bad = m => errors.push('Row ' + line + (o.id ? ' (' + o.id + ')' : '') + ': ' + m);
      if (!o.id) return bad('missing id.');
      if (seen.has(o.id)) return bad('duplicate id.');
      if (!o.question) return bad('missing question text.');
      if (type !== 'binary' && type !== 'interval') return bad('type must be binary or interval.');
      const it = {
        id: o.id, type, question: o.question,
        category: o.category || 'Custom', region: o.region || '', era: o.era || '',
        event_group: o.event_group || o.id, difficulty: (o.difficulty || 'medium').toLowerCase(),
        unit: o.unit || '', scale: (o.scale || 'linear').toLowerCase() === 'log' ? 'log' : 'linear',
        explanation: o.explanation || '',
        sources: [[o.source_name, o.source_url], [o.source2_name, o.source2_url]].filter(s => s[0] || s[1]).map(s => ({ name: s[0] || s[1], url: /^https?:\/\//i.test(s[1] || '') ? s[1] : '' })),
        verified_on: o.verified_on || '', origin: origin || 'built-in',
        score_scale: parseFloat(o.score_scale) > 0 ? parseFloat(o.score_scale) : null
      };
      if (['easy', 'medium', 'hard'].indexOf(it.difficulty) < 0) it.difficulty = 'medium';
      if (type === 'binary') {
        const a = o.answer.toUpperCase();
        if (a !== 'TRUE' && a !== 'FALSE') return bad('a binary answer must be TRUE or FALSE.');
        it.answer = a === 'TRUE';
      } else {
        const v = parseNumber(o.answer);
        if (!isFinite(v)) return bad('an interval answer must be a number.');
        if (it.scale === 'log' && v <= 0) return bad('log-scale answers must be above 0.');
        it.answer = v;
      }
      seen.add(o.id); items.push(it);
    });
    return { items, errors };
  }

  /* ---------- numbers ---------- */
  const MULT = { '': 1, k: 1e3, thousand: 1e3, m: 1e6, mm: 1e6, mn: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9, t: 1e12, tn: 1e12, trillion: 1e12 };
  function parseNumber(s) {
    if (typeof s === 'number') return s;
    let t = String(s == null ? '' : s).trim().toLowerCase();
    if (!t) return NaN;
    t = t.replace(/[$€£¥,\s%]/g, '').replace(/^\((.*)\)$/, '-$1').replace(/[−–]/g, '-');
    const m = t.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)([a-z]*)$/);
    if (!m || !(m[2] in MULT)) return NaN;
    return parseFloat(m[1]) * MULT[m[2]];
  }
  function sig(x, d) {
    if (!isFinite(x) || x === 0) return x;
    const p = Math.pow(10, d - 1 - Math.floor(Math.log10(Math.abs(x))));
    return Math.round(x * p) / p;
  }
  function trimNum(x, dp) {
    return x.toFixed(dp).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  }
  function compact(x) {
    const a = Math.abs(x), s = x < 0 ? '-' : '';
    if (a >= 1e12) return s + trimNum(sig(a / 1e12, 3), 2) + 'T';
    if (a >= 1e9) return s + trimNum(sig(a / 1e9, 3), 2) + 'B';
    if (a >= 1e6) return s + trimNum(sig(a / 1e6, 3), 2) + 'M';
    if (a >= 1000) return s + a.toLocaleString('en-US', { maximumFractionDigits: 2 });
    return s + trimNum(sig(a, 4), 2);
  }
  const CUR = { usd: '$', eur: '€', gbp: '£' };
  function fmtValue(x, unit) {
    if (!isFinite(x)) return '—';
    const u = (unit || '').trim(), ul = u.toLowerCase();
    if (ul === 'year') return String(Math.round(x));
    const cur = CUR[ul.split(' ')[0]];
    if (cur) {
      const rest = u.split(' ').slice(1).join(' ');
      return (x < 0 ? '-' : '') + cur + compact(Math.abs(x)) + (rest ? ' ' + rest : '');
    }
    if (ul === 'percent') return compact(x) + '%';
    return compact(x) + (u ? ' ' + u : '');
  }

  /* ---------- scoring scale ---------- */
  // Interval scores are computed on a common scale so different units can be averaged:
  // log-scale items in orders of magnitude (log10); years per decade; other linear items
  // relative to the size of the true answer. A CSV column score_scale overrides the divisor.
  function scaleOf(it) {
    if (it.scale === 'log') return null;
    if (it.score_scale) return it.score_scale;
    if ((it.unit || '').toLowerCase() === 'year') return 10;
    return Math.max(Math.abs(it.answer), 1e-9);
  }
  function tf(it, x) {
    if (it.scale === 'log') return x > 0 ? Math.log10(x) : NaN;
    return x / scaleOf(it);
  }
  function itf(it, z) {
    if (it.scale === 'log') return Math.pow(10, z);
    return z * scaleOf(it);
  }

  /* ---------- drawing a session ---------- */
  function drawSession(bank, opts, r) {
    const B = opts.batches, P = opts.perBatch, total = B * P;
    const nb = Math.round(total * opts.binShare), ni = total - nb;
    const pool = bank.filter(it => opts.cats.has(it.category));
    const used = new Set();
    function pick(items, n) {
      const strata = {};
      shuffle(items, r).forEach(it => { const k = it.category + '|' + it.difficulty; (strata[k] = strata[k] || []).push(it); });
      const keys = shuffle(Object.keys(strata), r), out = [];
      let progress = true;
      while (out.length < n && progress) {
        progress = false;
        for (const k of keys) {
          if (out.length >= n) break;
          const s = strata[k];
          while (s.length && used.has(s[0].event_group)) s.shift();
          if (s.length) { const it = s.shift(); used.add(it.event_group); out.push(it); progress = true; }
        }
      }
      return out;
    }
    const bins = pick(pool.filter(it => it.type === 'binary'), nb);
    const ints = pick(pool.filter(it => it.type === 'interval'), ni);
    if (bins.length < nb || ints.length < ni) {
      return { error: { nb, ni, haveB: bins.length, haveI: ints.length } };
    }
    const binCount = Array(B).fill(Math.floor(nb / B));
    shuffle([...Array(B).keys()], r).slice(0, nb % B).forEach(k => binCount[k]++);
    const order = (a, b) => (a.category + a.difficulty).localeCompare(b.category + b.difficulty);
    const batches = Array.from({ length: B }, () => []);
    const deal = (items, fill) => {
      let k = Math.floor(r() * B);
      items.sort(order).forEach(it => {
        let tries = 0;
        while (fill[k] <= 0 && tries < B) { k = (k + 1) % B; tries++; }
        batches[k].push(it); fill[k]--; k = (k + 1) % B;
      });
    };
    deal(bins, binCount.slice());
    deal(ints, binCount.map(c => P - c));
    return { batches: batches.map(b => shuffle(b, r)) };
  }

  /* ---------- simulated experts ---------- */
  const PERSONAS = {
    calibrated: { label: 'Well-calibrated', conf: () => 0, cover: (t) => t },
    over: { label: 'Overconfident', conf: (k) => Math.max(0.06, 0.24 - 0.05 * k), cover: (t, k) => Math.min(t - 0.06, 0.42 + 0.1 * k) },
    under: { label: 'Underconfident', conf: (k) => -Math.max(0.06, 0.16 - 0.02 * k), cover: (t) => Math.min(0.99, t + (1 - t) * 0.85) }
  };
  const P_RIGHT = { easy: 0.86, medium: 0.7, hard: 0.56 };
  function snapLevel(p) {
    let best = LEVELS[0];
    LEVELS.forEach(l => { if (Math.abs(l - p) < Math.abs(best - p)) best = l; });
    return best;
  }
  function simulateAnswer(it, persona, k, target, r) {
    const P = PERSONAS[persona];
    if (it.type === 'binary') {
      const pr = P_RIGHT[it.difficulty] || 0.7;
      const right = r() < pr;
      const conf = snapLevel(Math.min(0.99, Math.max(0.5, pr + P.conf(k) + 0.06 * gauss(r))));
      return { choice: right ? it.answer : !it.answer, conf };
    }
    const c = P.cover(target, k);
    const tau = 0.35, w = tau * normInv((1 + c) / 2), e = tau * gauss(r);
    const z = tf(it, it.answer);
    let lo = itf(it, z + e - w), hi = itf(it, z + e + w);
    if ((it.unit || '').toLowerCase() === 'year') { lo = Math.floor(lo); hi = Math.ceil(hi); }
    else { lo = sig(lo, 2); hi = sig(hi, 2); if (hi <= lo) hi = sig(lo * 1.1 + 1e-9, 2); }
    return { lo, hi };
  }

  /* ---------- scoring ---------- */
  function scoreAnswer(it, a, target) {
    if (it.type === 'binary') {
      const conf = Math.min(CAP, a.conf);
      const correct = a.choice === it.answer;
      const pTrue = a.choice ? conf : 1 - conf;
      const o = it.answer ? 1 : 0;
      return { kind: 'binary', conf, correct, pTrue, o, brier: (pTrue - o) * (pTrue - o), log: -Math.log(correct ? conf : 1 - conf), stated: conf, outcome: correct ? 1 : 0 };
    }
    const y = tf(it, it.answer), l = tf(it, a.lo), u = tf(it, a.hi), alpha = 1 - target;
    const hit = a.lo <= it.answer && it.answer <= a.hi;
    const width = u - l;
    const pen = y < l ? (2 / alpha) * (l - y) : y > u ? (2 / alpha) * (y - u) : 0;
    return { kind: 'interval', hit, width, pen, winkler: width + pen, rel: { l: l - y, u: u - y }, stated: target, outcome: hit ? 1 : 0 };
  }

  function mean(a) { return a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN; }

  function summarize(records, target) {
    const bin = records.filter(x => x.s.kind === 'binary').map(x => x.s);
    const iv = records.filter(x => x.s.kind === 'interval').map(x => x.s);
    const out = { nB: bin.length, nI: iv.length, target };
    if (bin.length) {
      out.brier = mean(bin.map(s => s.brier));
      out.logScore = mean(bin.map(s => s.log));
      out.acc = mean(bin.map(s => s.outcome));
      out.avgConf = mean(bin.map(s => s.conf));
      // Murphy decomposition, binned by distinct forecast value of P(true)
      const obar = mean(bin.map(s => s.o)), g = {};
      bin.forEach(s => { const k = s.pTrue.toFixed(2); (g[k] = g[k] || []).push(s); });
      let rel = 0, res = 0;
      Object.keys(g).forEach(k => {
        const n = g[k].length, p = +k, ok = mean(g[k].map(s => s.o));
        rel += n * (p - ok) * (p - ok); res += n * (ok - obar) * (ok - obar);
      });
      out.rel = rel / bin.length; out.res = res / bin.length; out.unc = obar * (1 - obar); out.baseRate = obar;
      out.bins = LEVELS.map(l => {
        const xs = bin.filter(s => Math.abs(s.conf - l) < 1e-9);
        return { level: l, n: xs.length, acc: xs.length ? mean(xs.map(s => s.outcome)) : NaN };
      });
    }
    if (iv.length) {
      const h = iv.filter(s => s.hit).length;
      out.hits = h; out.hitRate = h / iv.length;
      out.hitCI = betaInterval(h, iv.length, 0.95);
      out.winkler = mean(iv.map(s => s.winkler));
      out.wWidth = mean(iv.map(s => s.width));
      out.wPen = mean(iv.map(s => s.pen));
    }
    const all = records.map(x => x.s);
    out.gap = mean(all.map(s => s.stated)) - mean(all.map(s => s.outcome));
    out.gapB = bin.length ? out.avgConf - out.acc : NaN;
    out.gapI = iv.length ? target - out.hitRate : NaN;
    return out;
  }

  /* ---------- cost of overconfidence ---------- */
  // A lognormal loss range stated at the target level; widen it to the coverage the expert
  // actually achieved and compare the 1-in-20 and 1-in-100 year losses.
  function costOfOverconfidence(hitRate, target, L, U) {
    L = L || 1e6; U = U || 1e7;
    const h = Math.min(0.995, Math.max(0.2, hitRate));
    const zs = normInv((1 + target) / 2), za = normInv((1 + h) / 2);
    const m = Math.sqrt(L * U), span = Math.log(U / L);
    const ss = span / (2 * zs), sa = span / (2 * za);
    const q = (s, p) => m * Math.exp(normInv(p) * s);
    return {
      L, U, h, floored: hitRate < 0.2, zs, za, sigmaStated: ss, sigmaActual: sa,
      q95s: q(ss, 0.95), q95a: q(sa, 0.95), q99s: q(ss, 0.99), q99a: q(sa, 0.99),
      mult95: q(sa, 0.95) / q(ss, 0.95), mult99: q(sa, 0.99) / q(ss, 0.99),
      impliedLo: m * Math.exp(-zs * sa), impliedHi: m * Math.exp(zs * sa)
    };
  }

  root.Calib = {
    LEVELS, CAP, rng, gauss, shuffle, normInv, betaInterval, parseCSV, toCSV, loadBank,
    parseNumber, fmtValue, compact, sig, tf, itf, scaleOf, drawSession, PERSONAS, simulateAnswer,
    scoreAnswer, summarize, costOfOverconfidence, mean
  };
})(typeof window !== 'undefined' ? window : globalThis);
