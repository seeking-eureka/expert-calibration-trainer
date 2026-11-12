/* app.js: Expert Calibration Trainer UI. Session flow, inputs, SVG charts, exports. */
(function () {
  'use strict';
  const C = window.Calib;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const pct = (x, d) => isFinite(x) ? (x * 100).toFixed(d || 0) + '%' : '—';
  const pts = x => isFinite(x) ? (x >= 0 ? '+' : '−') + Math.abs(x * 100).toFixed(1) + ' pts' : '—';
  const f3 = x => isFinite(x) ? x.toFixed(3) : '—';
  const f2 = x => isFinite(x) ? x.toFixed(2) : '—';

  const DEFAULTS = { mode: 'test', persona: 'over', batches: 4, perBatch: 10, share: 40, target: 0.9 };
  const S = Object.assign({}, DEFAULTS, { cats: null });
  let builtIn = [], custom = [], bankMode = 'built-in', upMode = 'add', pendingFile = null;
  let session = null;

  /* ================= bank ================= */
  function bank() {
    if (bankMode === 'replace') return custom;
    if (bankMode === 'add') return builtIn.concat(custom);
    return builtIn;
  }
  function categories() {
    const seen = [];
    bank().forEach(it => { if (seen.indexOf(it.category) < 0) seen.push(it.category); });
    return seen;
  }
  function renderBank() {
    const b = bank(), nb = b.filter(x => x.type === 'binary').length;
    $('bankStatus').textContent = b.length + ' questions';
    const src = bankMode === 'built-in' ? 'Built-in bank' : bankMode === 'replace' ? 'Your file only' : 'Built-in bank plus ' + custom.length + ' of yours';
    $('bankMix').textContent = src + ' · ' + nb + ' true/false · ' + (b.length - nb) + ' range · ' + categories().length + ' categories';
    $('restoreBtn').hidden = bankMode === 'built-in';
    const cats = categories();
    if (!S.cats) S.cats = new Set(cats);
    cats.forEach(c => { if (!S.catsKnown || !S.catsKnown.has(c)) S.cats.add(c); });
    S.catsKnown = new Set(cats);
    $('catChips').innerHTML = cats.map(c => {
      const n = b.filter(x => x.category === c).length;
      return `<button class="chip ${S.cats.has(c) ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)} <span class="muted">${n}</span></button>`;
    }).join('');
    validateSetup();
  }
  function loadBuiltIn() {
    fetch('questions.csv', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); }).then(t => {
      const res = C.loadBank(t, 'built-in');
      builtIn = res.items; builtInText = t;
      if (res.errors.length) console.warn('Built-in bank errors', res.errors);
      renderBank(); renderDemo();
    }).catch(() => {
      $('bankStatus').textContent = 'Not loaded';
      msgs('setupMsgs', [['err', 'The built-in question bank (questions.csv) could not be loaded. Serve the app over HTTP, or load a CSV under Question Bank.']]);
    });
  }
  let builtInText = '';

  /* ================= setup ================= */
  function msgs(id, list) {
    $(id).innerHTML = list.map(m => `<div class="msg ${m[0]}">${m[1]}</div>`).join('');
  }
  function readInt(id, lo, hi) {
    const v = C.parseNumber($(id).value);
    const ok = Number.isInteger(v) && v >= lo && v <= hi;
    $(id).classList.toggle('bad', !ok);
    return ok ? v : null;
  }
  function validateSetup() {
    const errs = [];
    const B = readInt('inBatches', 1, 6), P = readInt('inPer', 5, 15);
    if (B === null) errs.push(['err', 'Batches must be a whole number from 1 to 6.']);
    if (P === null) errs.push(['err', 'Questions per batch must be a whole number from 5 to 15.']);
    S.share = +$('inShare').value;
    $('shareVal').textContent = S.share + '%';
    if (B !== null) S.batches = B;
    if (P !== null) S.perBatch = P;
    let ok = !errs.length;
    if (ok) {
      const total = B * P, nb = Math.round(total * S.share / 100), ni = total - nb;
      $('mixLine').textContent = total + ' questions: ' + nb + ' true/false, ' + ni + ' range';
      if (!S.cats || !S.cats.size) { errs.push(['err', 'Turn on at least one category.']); ok = false; }
      else if (bank().length) {
        const pool = bank().filter(x => S.cats.has(x.category));
        const gB = new Set(pool.filter(x => x.type === 'binary').map(x => x.event_group)).size;
        const gI = new Set(pool.filter(x => x.type === 'interval').map(x => x.event_group)).size;
        if (nb > gB && ni > gI) { errs.push(['err', `This session needs ${nb} true/false and ${ni} range questions, but the selected categories have ${gB} and ${gI}. Lower the session size or add categories.`]); ok = false; }
        else if (nb > gB) { errs.push(['err', `This session needs ${nb} true/false questions, but the selected categories have ${gB}. Lower the true/false share, the session size, or add categories.`]); ok = false; }
        else if (ni > gI) { errs.push(['err', `This session needs ${ni} range questions, but the selected categories have ${gI}. Raise the true/false share, lower the session size, or add categories.`]); ok = false; }
      } else { ok = false; }
    } else $('mixLine').textContent = '';
    msgs('setupMsgs', errs);
    $('startBtn').disabled = !ok;
    $('startBtn').textContent = S.mode === 'sim' ? 'Run simulated expert' : 'Start session';
    return ok;
  }
  function setChipGroup(attr, val) {
    document.querySelectorAll(`[data-${attr}]`).forEach(b => b.classList.toggle('on', b.dataset[attr] === String(val)));
  }
  function applyDefaults() {
    Object.assign(S, DEFAULTS);
    $('inBatches').value = S.batches; $('inPer').value = S.perBatch; $('inShare').value = S.share;
    $('inPersona').value = S.persona;
    setChipGroup('mode', S.mode); setChipGroup('target', S.target);
    $('personaRow').hidden = S.mode !== 'sim';
    S.cats = new Set(categories());
    if (builtIn.length) renderBank(); else validateSetup();
  }

  /* ================= session ================= */
  function startSession() {
    if (!validateSetup()) return;
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    const r = C.rng(seed);
    const d = C.drawSession(bank(), { batches: S.batches, perBatch: S.perBatch, binShare: S.share / 100, cats: S.cats }, r);
    if (d.error) {
      msgs('setupMsgs', [['err', `Couldn't draw enough distinct questions (${d.error.haveB} of ${d.error.nb} true/false, ${d.error.haveI} of ${d.error.ni} range). Try a smaller session.`]]);
      return;
    }
    session = {
      mode: S.mode, persona: S.persona, target: S.target, batches: d.batches,
      b: 0, q: 0, answers: d.batches.map(b => b.map(() => null)), started: new Date(), seed
    };
    if (S.mode === 'sim') {
      session.batches.forEach((b, k) => b.forEach((it, j) => { session.answers[k][j] = C.simulateAnswer(it, S.persona, k, S.target, r); }));
      showResults();
    } else {
      showView('vQuiz'); renderQuestion();
    }
  }
  function records(upTo) {
    const out = [];
    session.batches.forEach((b, k) => {
      if (upTo != null && k > upTo) return;
      b.forEach((it, j) => {
        const a = session.answers[k][j];
        if (a) out.push({ it, a, k, j, s: C.scoreAnswer(it, a, session.target) });
      });
    });
    return out;
  }
  function showView(id) {
    ['vSetup', 'vQuiz', 'vReview', 'vResults'].forEach(v => { $(v).hidden = v !== id; });
    window.scrollTo({ top: 0 });
  }

  /* ================= question screen ================= */
  let cur = null;
  function renderQuestion() {
    const it = session.batches[session.b][session.q];
    const nB = session.batches.length, nQ = session.batches[session.b].length;
    const done = session.batches.slice(0, session.b).reduce((s, b) => s + b.length, 0) + session.q;
    const total = session.batches.reduce((s, b) => s + b.length, 0);
    $('qPos').textContent = `Batch ${session.b + 1} of ${nB} · Question ${session.q + 1} of ${nQ}`;
    $('qCat').textContent = it.category;
    $('qBar').style.width = (100 * done / total) + '%';
    $('qText').textContent = it.question;
    $('qMsgs').innerHTML = '';
    cur = { it, choice: null, conf: null };
    const bin = it.type === 'binary';
    $('qBinary').hidden = !bin; $('qInterval').hidden = bin;
    $('qType').textContent = bin ? 'TRUE OR FALSE?' : `GIVE A ${Math.round(session.target * 100)}% RANGE`;
    if (bin) {
      document.querySelectorAll('.tf').forEach(b => b.classList.remove('on'));
      $('confRow').innerHTML = C.LEVELS.map(l => `<button class="chip conf" data-conf="${l}">${Math.round(l * 100)}%${l === 0.5 ? '<small>coin flip</small>' : l === 0.99 ? '<small>near certain</small>' : ''}</button>`).join('');
    } else {
      $('inLo').value = ''; $('inHi').value = ''; $('echoLo').textContent = ''; $('echoHi').textContent = '';
      $('inLo').classList.remove('bad'); $('inHi').classList.remove('bad');
      $('qRangeHint').textContent = `Give a low and high value you're ${Math.round(session.target * 100)}% sure contains the answer. Shorthand works: 4.4M, 1.2B, 38K, 9.1%.`;
      $('qUnit').textContent = it.unit ? 'Unit: ' + it.unit + (it.scale === 'log' ? ' · values must be above 0' : '') : '';
      setTimeout(() => $('inLo').focus(), 30);
    }
    $('nextBtn').disabled = true;
    $('nextBtn').textContent = session.q === nQ - 1 ? 'Finish batch' : 'Next';
    resetQuit();
  }
  function readRange(final) {
    const it = cur.it, lo = C.parseNumber($('inLo').value), hi = C.parseNumber($('inHi').value);
    const loTxt = $('inLo').value.trim(), hiTxt = $('inHi').value.trim();
    $('echoLo').textContent = isFinite(lo) ? '= ' + C.fmtValue(lo, it.unit) : '';
    $('echoHi').textContent = isFinite(hi) ? '= ' + C.fmtValue(hi, it.unit) : '';
    const errs = [];
    const badLo = loTxt && !isFinite(lo), badHi = hiTxt && !isFinite(hi);
    if (badLo || badHi) errs.push(['err', "That isn't a number the app can read. Try 4.4M, 1,200, or -37.63."]);
    let ok = isFinite(lo) && isFinite(hi);
    if (ok && lo >= hi) { errs.push(['err', 'The low end must be below the high end.']); ok = false; }
    if (ok && it.scale === 'log' && lo <= 0) { errs.push(['err', 'This answer is above 0, so the low end must be above 0.']); ok = false; }
    $('inLo').classList.toggle('bad', !!badLo || (final && !isFinite(lo)));
    $('inHi').classList.toggle('bad', !!badHi || (final && !isFinite(hi)) || (isFinite(lo) && isFinite(hi) && lo >= hi));
    msgs('qMsgs', errs);
    $('nextBtn').disabled = !ok;
    return ok ? { lo, hi } : null;
  }
  function submitAnswer() {
    if ($('nextBtn').disabled) return;
    let a;
    if (cur.it.type === 'binary') a = { choice: cur.choice, conf: cur.conf };
    else { a = readRange(true); if (!a) return; }
    session.answers[session.b][session.q] = a;
    if (session.q < session.batches[session.b].length - 1) { session.q++; renderQuestion(); }
    else showReview();
  }
  function resetQuit() {
    $('quitWrap').innerHTML = '<button class="link-btn danger" id="quitBtn">Quit session</button>';
  }

  /* ================= batch review ================= */
  function batchStats(recs) { return C.summarize(recs, session.target); }
  function tipFor(st) {
    const t = session.target, T = Math.round(t * 100);
    if (st.nI && st.hitRate < t - 0.2) return `<b>Widen your ranges.</b> Only ${st.hits} of ${st.nI} caught the answer. Try the equivalent-bet test: would you rather win $1,000 if the answer is in your range, or on a spin that pays ${T}% of the time? If you'd take the spin, your range is too narrow. Another trick: set each end on its own, asking "Am I ${Math.round((1 + t) / 2 * 100)}% sure it's above this?"`;
    if (st.nB && st.avgConf - st.acc > 0.1) return `<b>Dial back your confidence.</b> You averaged ${pct(st.avgConf)} confidence but were right ${pct(st.acc)} of the time. Before you choose 90% or 99%, name one reason you might be wrong. If one comes easily, pick a lower level.`;
    if (st.nI && st.hitRate >= Math.min(1, t + 0.08) && st.wWidth > 1.2) return `<b>You can tighten up.</b> Your ranges caught ${st.hits} of ${st.nI}, more than a ${T}% target needs, and the Winkler score charges you for the extra width. Try narrowing each range until you'd feel a real chance of missing.`;
    if (st.nB && st.acc - st.avgConf > 0.1) return `<b>You know more than you claim.</b> You were right ${pct(st.acc)} of the time at ${pct(st.avgConf)} average confidence. When you have a solid reason for an answer, it's fine to say 80% or 90%.`;
    if (st.nI && st.hitRate < t - 0.08) return `<b>Close on ranges, but still a bit narrow.</b> ${st.hits} of ${st.nI} caught the answer against a ${T}% target. Push each end out a little further than feels comfortable.`;
    return `<b>Well calibrated this batch.</b> Your confidence and your hit rate line up. Keep the same habits, and remember that a small batch can look good or bad by chance.`;
  }
  function answerText(it, a) {
    if (!a) return '—';
    if (it.type === 'binary') return (a.choice ? 'True' : 'False') + ' · ' + Math.round(a.conf * 100) + '%';
    return C.fmtValue(a.lo, it.unit) + ' to ' + C.fmtValue(a.hi, it.unit);
  }
  function truthText(it) { return it.type === 'binary' ? (it.answer ? 'True' : 'False') : C.fmtValue(it.answer, it.unit); }
  function srcLinks(it) {
    return it.sources.map(s => s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>` : esc(s.name)).join(' · ');
  }
  function kpiHTML(label, val, sub, chip, cls) {
    return `<div class="kpi ${cls || ''}"><div class="kpi-label">${label}</div><div class="kpi-val mono">${val}</div><div class="kpi-sub mono">${sub}</div>${chip ? `<div class="kpi-chip ${chip[0]}">${chip[1]}</div>` : ''}</div>`;
  }
  function gapChip(g) {
    if (!isFinite(g)) return null;
    if (g > 0.05) return ['bad', 'Overconfident'];
    if (g < -0.05) return ['warn', 'Underconfident'];
    return ['good', 'Well calibrated'];
  }
  function showReview() {
    const k = session.b, recs = records().filter(x => x.k === k), st = batchStats(recs);
    const last = k === session.batches.length - 1;
    $('rvTitle').textContent = `Batch ${k + 1} of ${session.batches.length} Complete`;
    $('rvNext').textContent = last ? 'See your results' : `Start batch ${k + 2}`;
    $('rvKpis').innerHTML =
      kpiHTML('True/false right', st.nB ? `${Math.round(st.acc * st.nB)} of ${st.nB}` : '—', st.nB ? `at ${pct(st.avgConf)} average confidence` : 'none in this batch') +
      kpiHTML('Range hit rate', st.nI ? pct(st.hitRate) : '—', st.nI ? `${st.hits} of ${st.nI} · target ${pct(session.target)}` : 'none in this batch') +
      kpiHTML('Overconfidence gap', pts(st.gap), 'stated confidence minus results', gapChip(st.gap));
    $('rvTip').innerHTML = tipFor(st);
    $('rvList').innerHTML = recs.map((x, i) => {
      const ok = x.s.outcome === 1;
      return `<div class="rv-item ${ok ? 'ok' : 'miss'}">
        <div class="rv-top"><span class="mono muted small">${i + 1} · ${esc(x.it.category)}</span><span class="badge ${ok ? 'good' : 'bad'}">${x.it.type === 'binary' ? (ok ? 'Right' : 'Wrong') : (ok ? 'Caught it' : 'Missed')}</span></div>
        <div class="rv-q">${esc(x.it.question)}</div>
        <div class="rv-ans mono small"><span>You: <b>${esc(answerText(x.it, x.a))}</b></span><span>Answer: <b class="accent-t">${esc(truthText(x.it))}</b></span></div>
        ${x.it.explanation ? `<div class="rv-exp small">${esc(x.it.explanation)}</div>` : ''}
        ${x.it.sources.length ? `<div class="rv-src small">Source: ${srcLinks(x.it)}</div>` : ''}
      </div>`;
    }).join('');
    showView('vReview');
  }

  /* ================= results ================= */
  let lastSummary = null;
  function showResults() {
    const recs = records(), st = C.summarize(recs, session.target);
    lastSummary = { st, recs };
    const sim = session.mode === 'sim';
    $('simBanner').hidden = !sim;
    if (sim) $('simBanner').innerHTML = `<b>Simulated results</b> for the <b>${esc(C.PERSONAS[session.persona].label.toLowerCase())}</b> expert. Switch the mode to "Take the test" to see your own.`;
    const nQ = recs.length;
    $('resMeta').textContent = `${nQ} questions in ${session.batches.length} batches · ${st.nB} true/false, ${st.nI} range at a ${pct(session.target)} target · ${session.started.toLocaleString()}`;
    renderKpis(st, recs);
    renderCost(st);
    renderCal($('calChart'), st);
    renderBrier(st);
    renderTrend(recs);
    renderStrip(recs);
    renderLog(recs);
    renderGuideYou();
    showView('vResults');
  }
  function renderKpis(st, recs) {
    const B = session.batches.length;
    const per = [...Array(B).keys()].map(k => C.summarize(recs.filter(x => x.k === k), session.target));
    const g0 = per[0].gap, g1 = per[B - 1].gap;
    let trend;
    if (B < 2) trend = kpiHTML('6 · Improvement trend', '—', 'needs 2 or more batches');
    else {
      const d = Math.abs(g1) - Math.abs(g0);
      trend = kpiHTML('6 · Improvement trend', (d <= 0 ? '−' : '+') + Math.abs(d * 100).toFixed(0) + ' pts',
        `gap, batch 1 → ${B}: ${pts(g0).replace(' pts', '')} → ${pts(g1)}`,
        d < -0.03 ? ['good', 'Closer to calibrated'] : d > 0.03 ? ['bad', 'Further from calibrated'] : ['warn', 'About the same']);
    }
    const ci = st.hitCI;
    $('resKpis').innerHTML =
      (st.nB ? kpiHTML('1 · Brier score', f3(st.brier), 'vs 0.250 always-50% · lower is better',
        st.brier < 0.2 ? ['good', 'Better than guessing'] : st.brier <= 0.25 ? ['warn', 'Near guessing'] : ['bad', 'Worse than guessing'])
        : kpiHTML('1 · Brier score', '—', 'no true/false questions')) +
      kpiHTML('2 · Overconfidence gap', pts(st.gap), `true/false ${isFinite(st.gapB) ? pts(st.gapB).replace(' pts', '') : '—'} · ranges ${isFinite(st.gapI) ? pts(st.gapI).replace(' pts', '') : '—'}`, gapChip(st.gap)) +
      (st.nI ? kpiHTML(`3 · ${pct(session.target)} range hit rate`, pct(st.hitRate), `${st.hits} of ${st.nI} · <span class="nowrap">95% range ${pct(ci.lo)}–${pct(ci.hi)}</span>`,
        ci.hi < session.target ? ['bad', 'Clearly below target'] : ci.lo > session.target ? ['warn', 'Above target'] : ['good', 'Consistent with target'])
        : kpiHTML('3 · Range hit rate', '—', 'no range questions')) +
      (st.nI ? kpiHTML('4 · Winkler score', st.winkler >= 1000 ? C.compact(st.winkler) : f2(st.winkler), `width ${st.wWidth >= 1000 ? C.compact(st.wWidth) : f2(st.wWidth)} + miss penalty ${f2(st.wPen)} · lower is better`) : kpiHTML('4 · Winkler score', '—', 'no range questions')) +
      (st.nB ? kpiHTML('5 · Log score', f3(st.logScore), 'vs 0.693 always-50% · lower is better') : kpiHTML('5 · Log score', '—', 'no true/false questions')) +
      trend;
  }
  function renderCost(st) {
    const el = $('costCard');
    if (!st.nI) { el.innerHTML = `<div class="kpi-label">7 · Cost of overconfidence</div><div class="kpi-sub">Needs at least one range question.</div>`; return; }
    const c = C.costOfOverconfidence(st.hitRate, session.target, 1e6, 1e7);
    const T = pct(session.target), usd = x => x >= 1e6 ? '$' + C.sig(x / 1e6, 3) + 'M' : '$' + Math.round(x / 1e3) + 'K';
    const over = st.hitRate < session.target;
    const headline = over ? c.mult95.toFixed(1) + '× too low' : st.hitRate > session.target ? (1 / c.mult95).toFixed(1) + '× too high' : 'On target';
    const body = over
      ? `The ${T} ranges in this session caught ${pct(st.hitRate)} of answers${c.floored ? ' (floored at 20% for this estimate)' : ''}. If you gave a ${T} range of <b>$1M to $10M</b> for an annual loss, a range that honest would run about <b>${usd(c.impliedLo)} to ${usd(c.impliedHi)}</b>.`
      : st.hitRate > session.target
        ? `The ${T} ranges in this session caught ${pct(st.hitRate)} of answers, more than the target. Ranges this wide would <b>overstate</b> the tail of a loss model, which wastes budget rather than hiding risk.`
        : `The ranges in this session caught answers at exactly the target rate, so a loss model built on them would get the tail about right.`;
    el.innerHTML = `<div class="kpi-label">7 · Cost of overconfidence</div>
      <div class="kpi-val mono">${headline}</div>
      <div class="kpi-sub">${body}</div>
      <div class="app-rows mono">
        <div class="app-row2"><span>1-in-20-year loss</span><span>${usd(c.q95s)} stated</span><span class="accent-t">${usd(c.q95a)} likely</span></div>
        <div class="app-row2"><span>1-in-100-year loss</span><span>${usd(c.q99s)} stated</span><span class="accent-t">${usd(c.q99a)} likely</span></div>
      </div>
      <div class="worst-note small">Lognormal fitted to the range, as FAIR-style loss models do. See Guide &amp; Math, section 8.</div>`;
  }

  /* ---------- SVG helpers ---------- */
  const NS = 'http://www.w3.org/2000/svg';
  function svg(el, w, h, html) { el.setAttribute('viewBox', `0 0 ${w} ${h}`); el.innerHTML = html; }
  const tip = $('chartTip');
  function bindTips(el) {
    el.querySelectorAll('[data-tip]').forEach(n => {
      n.addEventListener('mouseenter', e => { tip.innerHTML = n.getAttribute('data-tip'); tip.hidden = false; moveTip(e); });
      n.addEventListener('mousemove', moveTip);
      n.addEventListener('mouseleave', () => { tip.hidden = true; });
    });
  }
  function moveTip(e) {
    const pad = 14, w = tip.offsetWidth, h = tip.offsetHeight;
    let x = e.clientX + pad, y = e.clientY + pad;
    if (x + w > window.innerWidth - 8) x = e.clientX - w - pad;
    if (y + h > window.innerHeight - 8) y = e.clientY - h - pad;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }

  function renderCal(el, st) {
    const W = 640, H = 340, m = { l: 52, r: 22, t: 26, b: 44 };
    const X = p => m.l + (p - 0.5) / 0.5 * (W - m.l - m.r);
    const Y = v => H - m.b - v * (H - m.t - m.b);
    let g = '';
    for (let v = 0; v <= 1.0001; v += 0.25) g += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="#1f2a3d"/><text x="${m.l - 8}" y="${Y(v) + 4}" text-anchor="end">${Math.round(v * 100)}%</text>`;
    C.LEVELS.forEach(l => { g += `<text x="${X(l)}" y="${H - m.b + 18}" text-anchor="middle">${Math.round(l * 100)}%</text>`; });
    g += `<text x="${(m.l + W - m.r) / 2}" y="${H - 6}" text-anchor="middle" class="ax">Stated confidence</text>`;
    g += `<text x="14" y="${(m.t + H - m.b) / 2}" text-anchor="middle" transform="rotate(-90 14 ${(m.t + H - m.b) / 2})" class="ax">How often right</text>`;
    g += `<polygon points="${X(0.5)},${Y(0.5)} ${X(1)},${Y(1)} ${X(1)},${Y(0)} ${X(0.5)},${Y(0)}" fill="rgba(242,129,138,.05)"/>`;
    g += `<text x="${X(0.985)}" y="${Y(0.03)}" text-anchor="end" class="zone r">OVERCONFIDENT</text><text x="${X(0.515)}" y="${Y(0.95)}" class="zone b">UNDERCONFIDENT</text>`;
    g += `<line x1="${X(0.5)}" y1="${Y(0.5)}" x2="${X(1)}" y2="${Y(1)}" stroke="#8a96a8" stroke-dasharray="5 5" stroke-width="1.5"/>`;
    if (st.bins) {
      const pts2 = st.bins.filter(b => b.n > 0);
      if (pts2.length > 1) g += `<polyline fill="none" stroke="#7fb2ff" stroke-width="2" points="${pts2.map(b => X(b.level) + ',' + Y(b.acc)).join(' ')}"/>`;
      pts2.forEach(b => {
        const r = 4 + Math.sqrt(b.n) * 1.6;
        g += `<circle cx="${X(b.level)}" cy="${Y(b.acc)}" r="${r}" fill="#7fb2ff" fill-opacity=".85" stroke="#0a0e16" stroke-width="1.5" data-tip="Said ${Math.round(b.level * 100)}%: right ${Math.round(b.acc * b.n)} of ${b.n} (${pct(b.acc)})"/>`;
        g += `<text x="${X(b.level)}" y="${b.acc > 0.85 ? Y(b.acc) + r + 13 : Y(b.acc) - r - 5}" text-anchor="middle" class="nlab">n=${b.n}</text>`;
      });
    }
    if (st.nI) {
      const x = X(st.target), y = Y(st.hitRate), s = 8;
      g += `<polygon points="${x},${y - s} ${x + s},${y} ${x},${y + s} ${x - s},${y}" fill="#f2c46d" stroke="#0a0e16" stroke-width="1.5" data-tip="${pct(st.target)} ranges: caught ${st.hits} of ${st.nI} (${pct(st.hitRate)})"/>`;
      g += `<text x="${x - 12}" y="${y + 4}" text-anchor="end" class="nlab gold">ranges ${pct(st.hitRate)}</text>`;
    }
    svg(el, W, H, g); bindTips(el);
  }

  function renderBrier(st) {
    const el = $('brierBars');
    if (!st.nB) { el.innerHTML = '<p class="small muted">No true/false questions in this session.</p>'; return; }
    const mx = Math.max(st.unc, st.rel, st.res, 0.25);
    const row = (name, v, cls, what) => `<div class="bb-row"><div class="bb-name">${name}<small>${what}</small></div><div class="bb-bar"><i class="${cls}" style="width:${Math.max(0.5, 100 * v / mx)}%"></i></div><div class="bb-val mono">${f3(v)}</div></div>`;
    el.innerHTML =
      row('Reliability', st.rel, 'rel', 'calibration error · lower is better') +
      row('Resolution', st.res, 'res', 'separating true from false · higher is better') +
      row('Uncertainty', st.unc, 'unc', `set by the questions: ${pct(st.baseRate)} were true`) +
      `<div class="eq small-eq">Brier = ${f3(st.rel)} − ${f3(st.res)} + ${f3(st.unc)} = ${f3(st.brier)}</div>`;
  }

  function renderTrend(recs) {
    const el = $('trendChart'), B = session.batches.length;
    const W = 640, H = 260, m = { l: 52, r: 18, t: 14, b: 40 };
    const X = k => B === 1 ? (m.l + W - m.r) / 2 : m.l + k / (B - 1) * (W - m.l - m.r);
    const Y = v => H - m.b - v * (H - m.t - m.b);
    const per = [...Array(B).keys()].map(k => C.summarize(recs.filter(x => x.k === k), session.target));
    let g = '';
    for (let v = 0; v <= 1.0001; v += 0.25) g += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="#1f2a3d"/><text x="${m.l - 8}" y="${Y(v) + 4}" text-anchor="end">${Math.round(v * 100)}%</text>`;
    per.forEach((_, k) => { g += `<text x="${X(k)}" y="${H - m.b + 18}" text-anchor="${B > 1 && k === 0 ? 'start' : B > 1 && k === B - 1 ? 'end' : 'middle'}">Batch ${k + 1}</text>`; });
    g += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(session.target)}" y2="${Y(session.target)}" stroke="#f2c46d" stroke-dasharray="4 5" stroke-opacity=".7"/>`;
    const line = (key, col, dash, label) => {
      const ps = per.map((p, k) => [k, p[key]]).filter(p => isFinite(p[1]));
      if (!ps.length) return '';
      let s = ps.length > 1 ? `<polyline fill="none" stroke="${col}" stroke-width="2.2" ${dash ? 'stroke-dasharray="6 5"' : ''} points="${ps.map(p => X(p[0]) + ',' + Y(p[1])).join(' ')}"/>` : '';
      ps.forEach(p => { s += `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="4.5" fill="${col}" stroke="#0a0e16" stroke-width="1.5" data-tip="Batch ${p[0] + 1} ${label}: ${pct(p[1])}"/>`; });
      return s;
    };
    g += line('avgConf', '#7fb2ff', true, 'true/false confidence') + line('acc', '#7fb2ff', false, 'true/false accuracy') + line('hitRate', '#f2c46d', false, 'range hit rate');
    svg(el, W, H, g); bindTips(el);
  }

  function renderStrip(recs) {
    const iv = recs.filter(x => x.s.kind === 'interval');
    const el = $('stripChart');
    if (!iv.length) { svg(el, 640, 60, '<text x="320" y="34" text-anchor="middle">No range questions in this session.</text>'); $('stripNote').textContent = ''; return; }
    const lim = 2.5, rowH = 18, m = { l: 46, r: 18, t: 24, b: 34 };
    const W = 640, H = m.t + m.b + iv.length * rowH;
    const X = v => m.l + (Math.max(-lim, Math.min(lim, v)) + lim) / (2 * lim) * (W - m.l - m.r);
    let g = '';
    [-2, -1, 0, 1, 2].forEach(v => { g += `<line x1="${X(v)}" x2="${X(v)}" y1="${m.t - 6}" y2="${H - m.b}" stroke="#1f2a3d"/><text x="${X(v)}" y="${H - m.b + 16}" text-anchor="middle">${v > 0 ? '+' : ''}${v}</text>`; });
    g += `<text x="${X(-lim)}" y="${m.t - 10}" class="ax">← range below the answer</text><text x="${X(lim)}" y="${m.t - 10}" text-anchor="end" class="ax">range above the answer →</text>`;
    g += `<text x="${(m.l + W - m.r) / 2}" y="${H - 4}" text-anchor="middle" class="ax">Distance from the true answer, on the common scale (log₁₀, decades, or relative)</text>`;
    iv.forEach((x, i) => {
      const y = m.t + i * rowH + rowH / 2, a = X(x.s.rel.l), b = X(x.s.rel.u);
      const col = x.s.hit ? '#6fd3a0' : '#f2818a';
      const clipL = x.s.rel.l < -lim, clipR = x.s.rel.u > lim;
      const t = `${esc(x.it.question)}<br>You: ${esc(answerText(x.it, x.a))}<br>Answer: ${esc(truthText(x.it))}`;
      g += `<g data-tip="${t.replace(/"/g, '&quot;')}"><rect x="${m.l - 40}" y="${y - rowH / 2}" width="${W - m.l - m.r + 40}" height="${rowH}" fill="transparent"/>`;
      g += `<text x="${m.l - 8}" y="${y + 4}" text-anchor="end" class="rid">${esc(x.it.id)}</text>`;
      g += `<line x1="${a}" x2="${Math.max(b, a + 2)}" y1="${y}" y2="${y}" stroke="${col}" stroke-width="6" stroke-linecap="round" stroke-opacity=".9"/>`;
      if (clipL) g += `<text x="${a - 2}" y="${y + 4}" text-anchor="end" fill="${col}" class="clip">‹</text>`;
      if (clipR) g += `<text x="${b + 2}" y="${y + 4}" fill="${col}" class="clip">›</text>`;
      g += '</g>';
    });
    g += `<line x1="${X(0)}" x2="${X(0)}" y1="${m.t - 6}" y2="${H - m.b}" stroke="#e6ebf2" stroke-width="1.5"/>`;
    svg(el, W, H, g); bindTips(el);
    $('stripNote').textContent = `${iv.filter(x => x.s.hit).length} of ${iv.length} cross the line`;
  }

  function renderLog(recs) {
    let i = 0;
    $('logBody').innerHTML = recs.map(x => {
      i++;
      const ok = x.s.outcome === 1;
      return `<tr class="lrow" data-i="${i}"><td>${i}</td><td>${x.k + 1}</td><td class="qcell">${esc(x.it.question)}</td><td>${esc(answerText(x.it, x.a))}</td><td>${esc(truthText(x.it))}</td><td class="${ok ? 'good-t' : 'bad-t'}">${x.it.type === 'binary' ? (ok ? 'Right' : 'Wrong') : (ok ? 'Caught' : 'Missed')}</td></tr>
      <tr class="lexp" data-for="${i}" hidden><td></td><td colspan="5"><div class="small">${esc(x.it.explanation)}</div>${x.it.sources.length ? `<div class="small rv-src">Source: ${srcLinks(x.it)}</div>` : ''}</td></tr>`;
    }).join('');
  }

  function renderDemo() {
    // Pool ten simulated sessions so the example curve shows the typical shape, not one noisy draw.
    const r = C.rng(20261111), cats = new Set(categories()), recs = [];
    for (let rep = 0; rep < 10; rep++) {
      const d = C.drawSession(builtIn, { batches: 4, perBatch: 10, binShare: 0.4, cats }, r);
      if (d.error) return;
      d.batches.forEach((b, k) => b.forEach(it => { const a = C.simulateAnswer(it, 'over', k, 0.9, r); recs.push({ it, a, k, s: C.scoreAnswer(it, a, 0.9) }); }));
    }
    const st = C.summarize(recs, 0.9);
    st.bins.forEach(b => { b.n = Math.round(b.n / 10); });
    st.hits = Math.round(st.hits / 10); st.nI = Math.round(st.nI / 10);
    renderCal($('demoChart'), st);
  }

  function renderGuideYou() {
    const el = $('guideYou');
    if (!lastSummary) { el.innerHTML = 'Finish a session, or run a simulated expert, and your own numbers will appear here.'; return; }
    const st = lastSummary.st, who = session.mode === 'sim' ? 'The simulated ' + C.PERSONAS[session.persona].label.toLowerCase() + ' expert' : 'In your latest session, you';
    const parts = [];
    if (st.nB) parts.push(`${session.mode === 'sim' ? 'averaged' : 'averaged'} ${pct(st.avgConf)} confidence on true/false questions and ${session.mode === 'sim' ? 'was' : 'were'} right ${pct(st.acc)} of the time (Brier ${f3(st.brier)} = ${f3(st.rel)} − ${f3(st.res)} + ${f3(st.unc)})`);
    if (st.nI) parts.push(`caught ${st.hits} of ${st.nI} answers with ${pct(session.target)} ranges (Winkler ${f2(st.winkler)})`);
    el.innerHTML = `<b>${who}</b> ${parts.join(', and ')}.`;
  }

  /* ================= exports ================= */
  function download(name, text) {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function stamp() { const d = session.started; return d.toISOString().slice(0, 16).replace(/[:T]/g, '-'); }
  function exportAnswers() {
    const rows = [['session_start', 'mode', 'persona', 'target', 'batch', 'id', 'type', 'category', 'difficulty', 'question', 'unit', 'true_answer', 'your_choice', 'your_confidence', 'your_low', 'your_high', 'correct_or_caught', 'brier', 'log_score', 'winkler']];
    lastSummary.recs.forEach(x => {
      const b = x.it.type === 'binary';
      rows.push([session.started.toISOString(), session.mode, session.mode === 'sim' ? session.persona : '', session.target, x.k + 1, x.it.id, x.it.type, x.it.category, x.it.difficulty, x.it.question, x.it.unit,
        b ? (x.it.answer ? 'TRUE' : 'FALSE') : x.it.answer, b ? (x.a.choice ? 'TRUE' : 'FALSE') : '', b ? x.a.conf : '', b ? '' : x.a.lo, b ? '' : x.a.hi,
        x.s.outcome, b ? x.s.brier.toFixed(4) : '', b ? x.s.log.toFixed(4) : '', b ? '' : x.s.winkler.toFixed(4)]);
    });
    download(`calibration-answers-${stamp()}.csv`, C.toCSV(rows));
  }
  function exportSummary() {
    const st = lastSummary.st, recs = lastSummary.recs, rows = [['metric', 'value']];
    const add = (k, v) => rows.push([k, v]);
    add('session_start', session.started.toISOString()); add('mode', session.mode); if (session.mode === 'sim') add('persona', session.persona);
    add('range_target', session.target); add('true_false_questions', st.nB); add('range_questions', st.nI);
    if (st.nB) { add('brier', st.brier.toFixed(4)); add('reliability', st.rel.toFixed(4)); add('resolution', st.res.toFixed(4)); add('uncertainty', st.unc.toFixed(4)); add('log_score', st.logScore.toFixed(4)); add('tf_accuracy', st.acc.toFixed(4)); add('tf_avg_confidence', st.avgConf.toFixed(4)); }
    if (st.nI) {
      add('range_hit_rate', st.hitRate.toFixed(4)); add('range_hit_rate_95_lo', st.hitCI.lo.toFixed(4)); add('range_hit_rate_95_hi', st.hitCI.hi.toFixed(4));
      add('winkler', st.winkler.toFixed(4)); add('winkler_width', st.wWidth.toFixed(4)); add('winkler_penalty', st.wPen.toFixed(4));
      const c = C.costOfOverconfidence(st.hitRate, session.target, 1e6, 1e7);
      add('cost_1in20_multiplier', c.mult95.toFixed(3)); add('cost_1in100_multiplier', c.mult99.toFixed(3));
    }
    add('overconfidence_gap', st.gap.toFixed(4));
    session.batches.forEach((_, k) => { const p = C.summarize(recs.filter(x => x.k === k), session.target); add(`batch_${k + 1}_gap`, isFinite(p.gap) ? p.gap.toFixed(4) : ''); });
    download(`calibration-summary-${stamp()}.csv`, C.toCSV(rows));
  }

  /* ================= events ================= */
  document.addEventListener('click', e => {
    const t = e.target.closest('button, tr.lrow');
    if (!t) return;
    if (t.dataset.mode) { S.mode = t.dataset.mode; setChipGroup('mode', S.mode); $('personaRow').hidden = S.mode !== 'sim'; validateSetup(); }
    else if (t.dataset.target) { S.target = +t.dataset.target; setChipGroup('target', S.target); }
    else if (t.dataset.cat) { const c = t.dataset.cat; S.cats.has(c) ? S.cats.delete(c) : S.cats.add(c); t.classList.toggle('on', S.cats.has(c)); validateSetup(); }
    else if (t.dataset.upmode) { upMode = t.dataset.upmode; setChipGroup('upmode', upMode); }
    else if (t.dataset.tf != null) { cur.choice = t.dataset.tf === '1'; document.querySelectorAll('.tf').forEach(b => b.classList.toggle('on', b === t)); $('nextBtn').disabled = cur.conf == null; }
    else if (t.dataset.conf) { cur.conf = +t.dataset.conf; document.querySelectorAll('.chip.conf').forEach(b => b.classList.toggle('on', b === t)); $('nextBtn').disabled = cur.choice == null; }
    else if (t.classList.contains('lrow')) { const r = document.querySelector(`tr.lexp[data-for="${t.dataset.i}"]`); r.hidden = !r.hidden; t.classList.toggle('sel', !r.hidden); }
    else if (t.id === 'quitBtn') { $('quitWrap').innerHTML = '<span class="small muted">Quit and lose this session?</span> <button class="link-btn danger" id="quitYes">Yes, quit</button> <button class="link-btn" id="quitNo">Keep going</button>'; }
    else if (t.id === 'quitYes') { session = null; showView('vSetup'); }
    else if (t.id === 'quitNo') resetQuit();
  });
  $('startBtn').addEventListener('click', startSession);
  $('nextBtn').addEventListener('click', submitAnswer);
  $('rvNext').addEventListener('click', () => {
    if (session.b < session.batches.length - 1) { session.b++; session.q = 0; showView('vQuiz'); renderQuestion(); }
    else showResults();
  });
  $('againBtn').addEventListener('click', () => { showView('vSetup'); validateSetup(); });
  $('resetBtn').addEventListener('click', applyDefaults);
  $('dlResp').addEventListener('click', exportAnswers);
  $('dlSum').addEventListener('click', exportSummary);
  ['inBatches', 'inPer', 'inShare'].forEach(id => $(id).addEventListener('input', validateSetup));
  $('inPersona').addEventListener('change', () => { S.persona = $('inPersona').value; });
  ['inLo', 'inHi'].forEach(id => $(id).addEventListener('input', () => readRange(false)));
  document.addEventListener('keydown', e => {
    if ($('vQuiz').hidden || e.key !== 'Enter') return;
    e.preventDefault(); submitAnswer();
  });

  // uploads
  $('fileIn').addEventListener('change', () => { pendingFile = $('fileIn').files[0] || null; $('loadBtn').disabled = !pendingFile; $('upMsgs').innerHTML = ''; });
  $('loadBtn').addEventListener('click', () => {
    if (!pendingFile) return;
    const fr = new FileReader();
    fr.onload = () => {
      const res = C.loadBank(fr.result, 'upload');
      const list = [];
      if (!res.items.length) { list.push(['err', res.errors.length ? res.errors.slice(0, 6).map(esc).join('<br>') : 'No valid questions found.']); msgs('upMsgs', list); return; }
      if (upMode === 'add') {
        const ids = new Set(builtIn.map(x => x.id)), groups = new Set(builtIn.map(x => x.event_group));
        let renamed = 0;
        res.items.forEach(it => {
          if (ids.has(it.id)) { const g = it.event_group === it.id; it.id = 'U-' + it.id; if (g) it.event_group = it.id; renamed++; }
          if (groups.has(it.event_group) && it.origin === 'upload') { /* same event as a built-in item: keep, the drawer avoids pairing them */ }
        });
        if (renamed) list.push(['warn', `${renamed} id${renamed > 1 ? 's' : ''} matched built-in questions and got a "U-" prefix.`]);
      }
      custom = res.items; bankMode = upMode;
      if (res.errors.length) list.push(['warn', `Skipped ${res.errors.length} row${res.errors.length > 1 ? 's' : ''}:<br>${res.errors.slice(0, 6).map(esc).join('<br>')}${res.errors.length > 6 ? '<br>…' : ''}`]);
      list.unshift(['ok', `Loaded ${res.items.length} question${res.items.length > 1 ? 's' : ''} from ${esc(pendingFile.name)}.`]);
      msgs('upMsgs', list);
      renderBank();
    };
    fr.readAsText(pendingFile);
  });
  $('restoreBtn').addEventListener('click', () => { custom = []; bankMode = 'built-in'; msgs('upMsgs', []); $('fileIn').value = ''; pendingFile = null; $('loadBtn').disabled = true; S.cats = null; renderBank(); });
  $('tplBtn').addEventListener('click', () => { if (builtInText) download('calibration-question-bank.csv', builtInText); });

  // tabs
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => { x.classList.toggle('active', x === t); x.setAttribute('aria-selected', x === t); });
    $('tab-sim').classList.toggle('hidden', t.dataset.tab !== 'sim');
    $('tab-guide').classList.toggle('hidden', t.dataset.tab !== 'guide');
  }));

  applyDefaults();
  renderGuideYou();
  loadBuiltIn();
})();
