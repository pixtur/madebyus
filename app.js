(function () {
  'use strict';
  const M = window.MBU;
  const V = M.VARIANTS;
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

  // QR codes must point somewhere public; a file:// path is useless on someone else's phone.
  const PUBLIC_BASE = 'https://pixtur.github.io/madebyus/';
  const isHttp = location.protocol === 'http:' || location.protocol === 'https:';
  const base = () => isHttp ? location.origin + location.pathname : PUBLIC_BASE;

  // Questionnaires offered in the form. The others stay in variants.js so their links still open,
  // and #compare still works; add them back here to bring back the tabs.
  const OFFERED_VARIANTS = ['s1'];

  const state = { tab: OFFERED_VARIANTS[0], vals: [], prod: null };
  const variant = () => V[state.tab];
  const resetVals = () => { state.vals = variant().questions.map(() => null); };

  // ---- Label ------------------------------------------------------------------

  function makeQr(text) {
    if (typeof window.qrcode !== 'function') return null; // CDN unavailable: label without QR
    const q = window.qrcode(0, 'M');
    q.addData(text);
    q.make();
    return { count: q.getModuleCount(), isDark: (r, c) => q.isDark(r, c) };
  }

  const recordUrl = (rec) => base() + '#' + M.encodeRecord(rec);

  function labelFor(rec) {
    const v = V[rec.variant];
    const vals = v.decode(rec.answers);
    const s = v.score(vals);
    const p = M.parseProduction(rec.prod);
    return {
      gradeIndex: s.gradeIndex,
      headline: M.builtWith(vals),
      detail: [v.strip(vals)].concat(p ? [p.label] : []).join(' · '),
      notes: s.notes,
    };
  }

  const svgFor = (rec) => M.labelSvg(labelFor(rec), makeQr(recordUrl(rec)));

  // ---- Actions -------------------------------------------------------------------

  async function copy(text, button) {
    try {
      await navigator.clipboard.writeText(text);
      const old = button.textContent;
      button.textContent = 'Copied';
      setTimeout(() => { button.textContent = old; }, 1200);
    } catch {
      window.prompt('Copy this:', text); // clipboard API is blocked on file:// in some browsers
    }
  }

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function downloadPng(rec) {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svgFor(rec)], { type: 'image/svg+xml' }));
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width * 3;
      c.height = img.height * 3;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => download(b, 'made-by-us-' + M.shortCode(rec) + '.png'), 'image/png');
    };
    img.src = url;
  }

  function renderActions(host, rec) {
    host.innerHTML = '';
    const add = (label, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', () => fn(b));
      host.appendChild(b);
    };
    add('Copy link', b => copy(isHttp ? recordUrl(rec) : location.href.split('#')[0] + '#' + M.encodeRecord(rec), b));
    add('Copy short code', b => copy(M.shortCode(rec), b));
    add('SVG', () => download(new Blob([svgFor(rec)], { type: 'image/svg+xml' }), 'made-by-us-' + M.shortCode(rec) + '.svg'));
    add('PNG', () => downloadPng(rec));
  }

  const renderNotes = (host, notes) => { host.innerHTML = notes.map(n => `<li>${esc(n)}</li>`).join(''); };

  // ---- Tabs -----------------------------------------------------------------------

  function buildTabs() {
    if (OFFERED_VARIANTS.length < 2) { $('tabs').hidden = true; return; }
    const tabs = OFFERED_VARIANTS.map(id => ({ id, name: V[id].name, blurb: V[id].blurb }))
      .concat([{ id: 'compare', name: 'Compare', blurb: 'The same productions graded by all three.' }]);
    $('tabs').innerHTML = tabs.map(t =>
      `<button type="button" role="tab" data-tab="${t.id}">${t.name}<small>${esc(t.blurb)}</small></button>`).join('');
    $('tabs').addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-tab]');
      if (!b) return;
      if (b.dataset.tab === 'compare') { history.replaceState(null, '', '#compare'); showCompare(); return; }
      history.replaceState(null, '', location.pathname + location.search);
      state.tab = b.dataset.tab;
      resetVals();
      showEdit();
    });
  }

  function markTab(id) {
    renderRules(id === 'compare' ? M.VARIANT_ORDER : [id]);
    for (const b of $('tabs').querySelectorAll('button')) b.setAttribute('aria-selected', String(b.dataset.tab === id));
  }

  function show(section) {
    for (const id of ['edit', 'view', 'compare-view']) $(id).hidden = id !== section;
  }

  // ---- Edit mode ------------------------------------------------------------------

  function optionHtml(q, i, o, idx) {
    const name = 'q-' + i;
    if (q.compact || q.inline) {
      return `<label><input type="radio" name="${name}" value="${idx}">${esc(o.label)}${o.desc ? ` <small>(${esc(o.desc)})</small>` : ''}</label>`;
    }
    return `<label class="opt"><input type="radio" name="${name}" value="${idx}"><span>${esc(o.label)}</span>` +
      (o.desc ? `<span class="d">${esc(o.desc)}</span>` : '') + '</label>';
  }

  function buildQuestions() {
    const v = variant();
    const host = $('questions');
    host.innerHTML = '';
    let fs = null;
    v.questions.forEach((q, i) => {
      const order = q.order || q.options.map((o, idx) => idx);
      const opts = order.map(idx => optionHtml(q, i, q.options[idx], idx)).join('');
      if (q.inline && fs) {
        const sub = document.createElement('div');
        sub.className = 'sub';
        sub.dataset.q = i;
        sub.innerHTML = `<div class="q">${esc(q.title)}</div><div class="pills">${opts}</div>`;
        fs.appendChild(sub);
        return;
      }
      fs = document.createElement('fieldset');
      fs.dataset.q = i;
      fs.innerHTML = `<legend>${esc(q.title)}</legend>` + (q.hint ? `<p class="hint">${esc(q.hint)}</p>` : '') +
        (q.compact ? `<div class="pills">${opts}</div>` : opts);
      host.appendChild(fs);
    });
  }

  function readForm() {
    const v = variant();
    for (let i = 0; i < v.questions.length; i++) {
      const r = [...document.getElementsByName('q-' + i)].find(x => x.checked);
      state.vals[i] = r ? +r.value : null;
    }
    // Forget answers to follow-ups that are no longer asked.
    for (let i = 0; i < v.questions.length; i++) if (!v.visible(state.vals, i)) state.vals[i] = null;
    const site = $('prod-site').value, id = $('prod-id').value.trim();
    state.prod = site && M.parseProduction(site + id) ? site + id : null;
  }

  function syncForm() {
    state.vals.forEach((val, i) => {
      for (const r of document.getElementsByName('q-' + i)) r.checked = val !== null && +r.value === val;
    });
    const p = M.parseProduction(state.prod);
    $('prod-site').value = p ? p.site : '';
    $('prod-id').value = p ? p.id : '';
  }

  function updateEdit() {
    const v = variant();
    let asked = 0, answered = 0;
    v.questions.forEach((q, i) => {
      const vis = v.visible(state.vals, i);
      const el = document.querySelector(`[data-q="${i}"]`);
      if (q.inline) el.hidden = !vis;
      if (vis) { asked++; if (state.vals[i] !== null) answered++; }
    });
    for (const fs of document.querySelectorAll('#questions fieldset')) {
      const idx = [+fs.dataset.q].concat([...fs.querySelectorAll('.sub:not([hidden])')].map(s => +s.dataset.q));
      fs.classList.toggle('done', idx.every(i => state.vals[i] !== null));
    }

    if (v.isComplete(state.vals)) {
      const rec = { variant: v.id, answers: v.encode(state.vals), prod: state.prod };
      $('edit-label').innerHTML = svgFor(rec);
      renderNotes($('edit-notes'), labelFor(rec).notes);
      renderActions($('edit-actions'), rec);
      $('progress').textContent = 'Short code: ' + M.shortCode(rec);
      history.replaceState(null, '', '#' + M.encodeRecord(rec));
    } else {
      $('edit-label').innerHTML = '<div class="placeholder">Answer every question to get a label.<br>' +
        'There is no default answer — a label is a claim you make.</div>';
      $('edit-notes').innerHTML = '';
      $('edit-actions').innerHTML = '';
      $('progress').textContent = `${answered} of ${asked} answered`;
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  function showEdit() {
    markTab(state.tab);
    show('edit');
    buildQuestions();
    syncForm();
    updateEdit();
  }

  // ---- View mode ----------------------------------------------------------------------

  function showView(rec) {
    const v = V[rec.variant];
    const vals = v.decode(rec.answers);
    state.tab = rec.variant;
    state.vals = vals;
    state.prod = rec.prod;
    markTab(rec.variant);
    show('view');

    $('view-label').innerHTML = svgFor(rec);
    renderActions($('view-actions'), rec);
    $('view-variant').textContent = v.name + ' questionnaire';
    const p = M.parseProduction(rec.prod);
    $('view-prod').innerHTML = p
      ? `<p>Claimed for <a href="${p.url}" target="_blank" rel="noopener">${esc(p.label)}</a>.</p>`
      : '<p class="hint">Not linked to a production.</p>';
    const rows = [];
    v.questions.forEach((q, i) => {
      if (!v.visible(vals, i)) return;
      const title = q.inline ? '↳ ' + q.title : q.title;
      rows.push(`<tr><td>${esc(title)}</td><td>${esc(q.options[vals[i]].label)}</td></tr>`);
    });
    $('view-answers').innerHTML = '<tr><th>Question</th><th>Answer</th></tr>' + rows.join('');
    renderNotes($('view-notes'), labelFor(rec).notes);
  }

  // ---- Compare --------------------------------------------------------------------------

  function showCompare() {
    markTab('compare');
    show('compare-view');
    const head = '<tr><th>Production</th>' + M.VARIANT_ORDER.map(id => `<th class="g">${V[id].name}</th>`).join('') + '</tr>';
    const rows = M.SCENARIOS.map(s => {
      const grades = M.VARIANT_ORDER.map(id => V[id].score(V[id].decode(s[id])).gradeIndex);
      const differs = new Set(grades).size > 1;
      return `<tr><td>${esc(s.name)}${differs ? ' <small class="muted">· differs</small>' : ''}</td>` +
        M.VARIANT_ORDER.map((id, k) => `<td class="g"><a class="chip" style="background:${M.GRADE_COLORS[grades[k]]}" ` +
          `href="#${M.encodeRecord({ variant: id, answers: s[id], prod: null })}">${M.GRADES[grades[k]]}</a></td>`).join('') + '</tr>';
    }).join('');
    $('compare-table').innerHTML = head + rows;
  }

  // ---- Rules text ---------------------------------------------------------------------

  /** Scoring rules of the questionnaire on screen (all of them on the comparison). */
  function renderRules(ids) {
    const single = ids.length === 1 && OFFERED_VARIANTS.length === 1 && ids[0] === OFFERED_VARIANTS[0];
    $('rules').innerHTML = ids.map(id =>
      `<h3>${single ? 'Scoring' : `${V[id].name} (${id})`}</h3><ul>${V[id].rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul>`).join('');
  }

  // ---- Routing ------------------------------------------------------------------------

  function route() {
    if (location.hash === '#compare') { showCompare(); return; }
    const rec = location.hash.length > 1 ? M.decodeRecord(location.hash, V) : null;
    if (rec) showView(rec);
    else { resetVals(); showEdit(); }
  }

  buildTabs();
  $('form').addEventListener('change', () => { readForm(); updateEdit(); });
  $('prod-id').addEventListener('input', () => { readForm(); updateEdit(); });
  $('btn-edit').addEventListener('click', showEdit);
  $('btn-new').addEventListener('click', () => {
    state.tab = OFFERED_VARIANTS[0]; // a hidden questionnaire is only reachable through its links
    resetVals();
    state.prod = null;
    history.replaceState(null, '', location.pathname + location.search);
    showEdit();
  });
  $('btn-decode').addEventListener('click', () => {
    const rec = M.decodeRecord($('decode-input').value, V);
    if (!rec) { $('decode-msg').textContent = 'Not a valid code or link.'; return; }
    $('decode-msg').textContent = '';
    history.pushState(null, '', '#' + M.encodeRecord(rec));
    route();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  window.addEventListener('hashchange', route);
  route();
})();
