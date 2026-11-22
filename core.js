/*
 * Made by Us — shared core: grades, records (the link), production ids and the label SVG.
 * Variant-specific questions and scoring live in variants.js. No DOM access here.
 */
(function (root) {
  'use strict';

  const BRAND = 'MADE BY US';
  const PREFIX = 'MBU';
  const GRADES = ['A+', 'A', 'B', 'C', 'D', 'E', 'F'];
  const GRADE_COLORS = ['#0a7a3d', '#24a148', '#8cc63f', '#f2c12e', '#f08a24', '#e0502a', '#b81f2b'];
  const HIDDEN = '_'; // answer slot of a question that was not asked

  const PROD_RE = /^(dz|pz)([1-9][0-9]{0,8})$/;

  /** "dz123" -> {site, id, url, label} or null */
  function parseProduction(code) {
    const m = PROD_RE.exec(code || '');
    if (!m) return null;
    return m[1] === 'dz'
      ? { code, site: 'dz', id: m[2], label: 'Demozoo #' + m[2], url: 'https://demozoo.org/productions/' + m[2] + '/' }
      : { code, site: 'pz', id: m[2], label: 'Pouët #' + m[2], url: 'https://www.pouet.net/prod.php?which=' + m[2] };
  }

  // ---- Records -------------------------------------------------------------
  // A record is { variant: 'q1' | 's1' | 'd1', answers: '0112_', prod: 'pz123' | null,
  //               title, by, at: free text | null }.
  // The variant id carries its own scoring version. Title, group ("by") and party ("at") are free
  // text because a release has no Demozoo or Pouët entry yet when the label is made at the party;
  // the database id can be added later without changing the answers.

  const NAME_FIELDS = [['title', 't'], ['by', 'by'], ['at', 'at']]; // record field, URL key
  const NAME_MAX = 80;

  /** Single line, no control characters, at most NAME_MAX characters; null if empty. */
  function cleanName(text) {
    const t = String(text == null ? '' : text).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, NAME_MAX);
    return t || null;
  }

  /** -> "s1/010030/pz123?t=Elevated&by=RGBA" (the URL hash, without '#') */
  function encodeRecord(rec) {
    const q = new URLSearchParams();
    for (const [field, key] of NAME_FIELDS) if (rec[field]) q.set(key, rec[field]);
    const qs = q.toString();
    return rec.variant + '/' + rec.answers + (rec.prod ? '/' + rec.prod : '') + (qs ? '?' + qs : '');
  }

  /** “Elevated” by RGBA @ Revision 2026 — or null if nothing was named. */
  function nameLine(rec) {
    const parts = [];
    if (rec.title) parts.push('\u201c' + rec.title + '\u201d');
    if (rec.by) parts.push('by ' + rec.by);
    if (rec.at) parts.push('@ ' + rec.at);
    return parts.length ? parts.join(' ') : null;
  }

  /** -> "MBU-s1-010030-pz123" — fits in an NFO or a 4k end scroller. Free-text names are left out. */
  function shortCode(rec) {
    return PREFIX + '-' + rec.variant + '-' + rec.answers + (rec.prod ? '-' + rec.prod : '');
  }

  /**
   * Accepts a hash, a full URL, a bare record or a short code.
   * variants: map id -> variant (from variants.js). Returns a record or null.
   */
  function decodeRecord(input, variants) {
    let s = String(input || '').trim();
    const hashAt = s.indexOf('#');
    if (hashAt >= 0) s = s.slice(hashAt + 1);

    let query = '';
    const queryAt = s.indexOf('?');
    if (queryAt >= 0) { query = s.slice(queryAt + 1); s = s.slice(0, queryAt); }

    const parts = s.startsWith(PREFIX + '-') ? s.slice(PREFIX.length + 1).split('-') : s.split('/');
    if (parts.length < 2 || parts.length > 3) return null;
    const v = variants[parts[0]];
    if (!v || !v.decode(parts[1])) return null;
    let prod = null;
    if (parts.length === 3) {
      if (!parseProduction(parts[2])) return null;
      prod = parts[2];
    }
    const rec = { variant: parts[0], answers: parts[1], prod, title: null, by: null, at: null };
    const params = new URLSearchParams(query);
    for (const [field, key] of NAME_FIELDS) {
      const raw = params.get(key);
      if (raw === null) continue;
      if (raw.length > NAME_MAX) return null;
      rec[field] = cleanName(raw);
    }
    return rec;
  }

  // ---- Label -----------------------------------------------------------------
  // Several visual styles of the same label. They only differ in how they show the result;
  // answers, scoring and links are identical.

  const LABEL_STYLES = [
    { id: 'grade', name: 'Grade', desc: 'A+ … F fridge sticker' },
    { id: 'mono', name: 'Mono', desc: 'the grade in black and greys' },
    { id: 'bars', name: 'Bars', desc: 'how much of each part is ours' },
    { id: 'percent', name: 'Percent', desc: 'one estimated share' },
    { id: 'minimal', name: 'Minimal', desc: 'small one-line badge' },
    { id: 'slide', name: 'Slide', desc: 'compact bars for the party slide' },
    { id: 'columns', name: 'Columns', desc: 'compact vertical bars for the party slide' },
  ];

  const INK = '#16181d', MUTED = '#5b616e', LINE = '#d6d9df', TRACK = '#e6e7ea';
  const FONT = "font-family=\"'Inter','Helvetica Neue',Arial,sans-serif\"";
  const MONO = "font-family=\"'JetBrains Mono','DejaVu Sans Mono',Consolas,monospace\"";
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const clip = (t, n) => t.length > n ? t.slice(0, n - 1) + '…' : t;

  function open(W, H, rx) {
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
      `<rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="${rx}" fill="#ffffff" stroke="${INK}" stroke-width="3"/>`,
    ];
  }

  function qrPath(qr, x, y, size) {
    const cell = size / qr.count;
    let d = '';
    for (let r = 0; r < qr.count; r++)
      for (let c = 0; c < qr.count; c++)
        if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return `<path transform="translate(${x} ${y}) scale(${cell})" d="${d}" fill="${INK}" shape-rendering="crispEdges"/>`;
  }

  /** QR column with divider on the right edge of a W×H label. */
  function qrColumn(out, qr, W, H) {
    const size = 136;
    const qx = W - size - 18;
    out.push(`<line x1="${qx - 14}" y1="18" x2="${qx - 14}" y2="${H - 18}" stroke="${LINE}" stroke-width="1.5"/>`);
    out.push(qrPath(qr, qx, (H - size) / 2, size));
  }

  /** "Built with …", optional production line, compact answers; from y = first baseline. */
  function footerLines(out, l, y) {
    const headSize = l.headline.length > 34 ? 12 : 14;
    out.push(`<text x="18" y="${y}" ${FONT} font-size="${headSize}" font-weight="700" fill="${INK}">${esc(l.headline)}</text>`);
    y += 21;
    if (l.name) {
      out.push(`<text x="18" y="${y}" ${FONT} font-size="11" fill="${INK}">${esc(clip(l.name, 40))}</text>`);
      y += 20;
    }
    const detailSize = l.detail.length > 38 ? 10 : 11;
    out.push(`<text x="18" y="${y}" ${MONO} font-size="${detailSize}" fill="${MUTED}">${esc(l.detail)}</text>`);
    return y;
  }

  const brand = (out, y = 36) =>
    out.push(`<text x="18" y="${y}" ${FONT} font-size="21" font-weight="800" letter-spacing="1.2" fill="${INK}">${BRAND}</text>`);

  /** The A+ … F scale; colors: per-grade colors, or null for black and greys. */
  function gradeScale(out, gradeIndex, colors) {
    let x = 18;
    for (let i = 0; i < GRADES.length; i++) {
      const active = i === gradeIndex;
      const w = active ? 46 : 31;
      const h = active ? 58 : 38;
      const y = active ? 50 : 60;
      const first = i === 0, last = i === GRADES.length - 1;
      const rx = active ? 8 : (first || last ? 6 : 2);
      const fill = colors ? colors[i] : (active ? INK : TRACK);
      const opacity = colors && !active ? 0.38 : 1;
      const textFill = colors || active ? '#ffffff' : '#8a8f99';
      const stroke = active && colors ? ` stroke="${INK}" stroke-width="2.5"` : '';
      out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" opacity="${opacity}"${stroke}/>`);
      out.push(`<text x="${x + w / 2}" y="${y + h / 2 + (active ? 10 : 6)}" text-anchor="middle" ${FONT} font-weight="800" font-size="${active ? 28 : 16}" fill="${textFill}">${GRADES[i]}</text>`);
      x += w + 2;
    }
  }

  function gradeLabel(l, qr, colors) {
    const W = qr ? 440 : 296;
    const H = l.name ? 192 : 172;
    const out = open(W, H, 14);
    brand(out);
    gradeScale(out, l.gradeIndex, colors);
    footerLines(out, l, 135);
    if (qr) qrColumn(out, qr, W, H);
    out.push('</svg>');
    return out.join('');
  }

  function barsLabel(l, qr) {
    const rows = l.parts.length;
    const W = qr ? 440 : 296;
    const top = 64, step = 19;
    const H = top + rows * step + (l.name ? 74 : 54);
    const out = open(W, H, 14);
    brand(out);
    out.push(`<text x="18" y="54" ${FONT} font-size="11" fill="${MUTED}">How much of each part is ours (estimated)</text>`);
    const bx = 128, bw = (qr ? W - 168 : W - 18) - bx - 34;
    l.parts.forEach((p, i) => {
      const y = top + i * step;
      out.push(`<text x="18" y="${y + 11}" ${FONT} font-size="11" fill="${INK}">${esc(p.name)}</text>`);
      out.push(`<rect x="${bx}" y="${y + 2}" width="${bw}" height="11" rx="2" fill="${TRACK}"/>`);
      if (p.ours > 0) out.push(`<rect x="${bx}" y="${y + 2}" width="${Math.max(2, Math.round(bw * p.ours))}" height="11" rx="2" fill="${INK}"/>`);
      out.push(`<text x="${bx + bw + 30}" y="${y + 11}" text-anchor="end" ${MONO} font-size="10" fill="${MUTED}">${Math.round(p.ours * 100)}%</text>`);
    });
    footerLines(out, l, top + rows * step + 16);
    if (qr) qrColumn(out, qr, W, H);
    out.push('</svg>');
    return out.join('');
  }

  function percentLabel(l, qr) {
    const W = qr ? 440 : 296;
    const H = l.name ? 192 : 172;
    const out = open(W, H, 14);
    brand(out);
    const pct = Math.round(l.percent * 100);
    const size = 56;
    out.push(`<text x="16" y="106" ${FONT} font-size="${size}" font-weight="800" letter-spacing="-1" fill="${INK}">${pct}%</text>`);
    // Approximate text width: digits ~0.6em, "%" ~0.9em; the caption starts right after it.
    const tx = Math.round(16 + size * (0.6 * String(pct).length + 0.9) + 12);
    out.push(`<text x="${tx}" y="84" ${FONT} font-size="12" font-weight="700" fill="${INK}">made by us</text>`);
    out.push(`<text x="${tx}" y="101" ${FONT} font-size="10" fill="${MUTED}">estimated from</text>`);
    out.push(`<text x="${tx}" y="114" ${FONT} font-size="10" fill="${MUTED}">the answers</text>`);
    footerLines(out, l, 135);
    if (qr) qrColumn(out, qr, W, H);
    out.push('</svg>');
    return out.join('');
  }

  function minimalLabel(l, qr) {
    // The QR code needs ~2px per module to stay scannable on screen, hence the 72px box.
    const H = 96, box = 72, pad = 12;
    const W = qr ? 400 : 316;
    const out = open(W, H, 12);
    out.push(`<rect x="${pad}" y="${pad}" width="${box}" height="${box}" rx="8" fill="${INK}"/>`);
    out.push(`<text x="${pad + box / 2}" y="${pad + box / 2 + 14}" text-anchor="middle" ${FONT} font-size="40" font-weight="800" fill="#ffffff">${GRADES[l.gradeIndex]}</text>`);
    const tx = pad + box + 14;
    out.push(`<text x="${tx}" y="44" ${FONT} font-size="17" font-weight="800" letter-spacing="1" fill="${INK}">${BRAND}</text>`);
    out.push(`<text x="${tx}" y="64" ${FONT} font-size="11" fill="${MUTED}">${esc(clip(l.headline, 34))}</text>`);
    if (qr) out.push(qrPath(qr, W - pad - box, pad, box));
    out.push('</svg>');
    return out.join('');
  }

  // Compact styles for the party slide: short part names, no numbers, no codes, small QR code.
  const SMALL_QR = 48;

  function slideLabel(l, qr) {
    const pad = 12, top = 36, rowH = 14, rows = l.parts.length;
    const W = qr ? 250 : 200;
    const H = top + rows * rowH + 26;
    const out = open(W, H, 10);
    out.push(`<text x="${pad}" y="24" ${FONT} font-size="14" font-weight="800" letter-spacing="1" fill="${INK}">${BRAND}</text>`);
    const bx = 64, bw = (qr ? W - pad - SMALL_QR - 10 : W - pad) - bx;
    l.parts.forEach((p, i) => {
      const y = top + i * rowH;
      out.push(`<text x="${pad}" y="${y + 9}" ${FONT} font-size="10" fill="${INK}">${esc(p.short || p.name)}</text>`);
      out.push(`<rect x="${bx}" y="${y + 2}" width="${bw}" height="8" rx="2" fill="${TRACK}"/>`);
      if (p.ours > 0) out.push(`<rect x="${bx}" y="${y + 2}" width="${Math.max(2, Math.round(bw * p.ours))}" height="8" rx="2" fill="${INK}"/>`);
    });
    out.push(`<text x="${pad}" y="${top + rows * rowH + 13}" ${FONT} font-size="9" fill="${MUTED}">${esc(clip(l.headline, 44))}</text>`);
    if (qr) out.push(qrPath(qr, W - pad - SMALL_QR, top + (rows * rowH - SMALL_QR) / 2, SMALL_QR));
    out.push('</svg>');
    return out.join('');
  }

  function columnsLabel(l, qr) {
    const pad = 12, top = 36, colW = 44, barW = 32, barH = 56, n = l.parts.length;
    const W = pad + n * colW + (qr ? 10 + SMALL_QR : 0) + pad;
    const H = top + barH + 22;
    const out = open(W, H, 10);
    out.push(`<text x="${pad}" y="24" ${FONT} font-size="14" font-weight="800" letter-spacing="1" fill="${INK}">${BRAND}</text>`);
    // "Built with …" shares the brand line; ~5px per character at 9px leaves room for this many.
    const headX = pad + 112;
    const headChars = Math.floor((W - pad - headX) / 5);
    // Continues the brand: MADE BY US …with TiXL.
    const cont = l.headline.replace(/^Built /, '\u2026');
    out.push(`<text x="${headX}" y="24" ${FONT} font-size="9" fill="${MUTED}">${esc(clip(cont, headChars))}</text>`);
    l.parts.forEach((p, i) => {
      const cx = pad + i * colW + colW / 2;
      out.push(`<rect x="${cx - barW / 2}" y="${top}" width="${barW}" height="${barH}" rx="2" fill="${TRACK}"/>`);
      const h = p.ours > 0 ? Math.max(2, Math.round(barH * p.ours)) : 0;
      if (h) out.push(`<rect x="${cx - barW / 2}" y="${top + barH - h}" width="${barW}" height="${h}" rx="2" fill="${INK}"/>`);
      out.push(`<text x="${cx}" y="${top + barH + 12}" text-anchor="middle" ${FONT} font-size="9" fill="${INK}">${esc(p.short || p.name)}</text>`);
    });
    if (qr) out.push(qrPath(qr, W - pad - SMALL_QR, top + (barH - SMALL_QR) / 2, SMALL_QR));
    out.push('</svg>');
    return out.join('');
  }

  /**
   * l: {gradeIndex, headline, name, detail, parts, percent}
   *   headline: "Built with …"; name: optional production line (“Title” by Group @ Party);
   *   detail: the compact answers; parts: [{name, ours 0…1}] or null; percent: 0…1 or null.
   * qr: optional {count, isDark(row, col)}. style: a LABEL_STYLES id; bars and percent fall back
   * to grade when the questionnaire has no per-part answers.
   * Returns a standalone SVG string (no external fonts or refs, safe to download).
   */
  function labelSvg(l, qr, style) {
    switch (style) {
      case 'mono': return gradeLabel(l, qr, null);
      case 'bars': return l.parts ? barsLabel(l, qr) : gradeLabel(l, qr, GRADE_COLORS);
      case 'percent': return l.percent != null ? percentLabel(l, qr) : gradeLabel(l, qr, GRADE_COLORS);
      case 'minimal': return minimalLabel(l, qr);
      case 'slide': return l.parts ? slideLabel(l, qr) : minimalLabel(l, qr);
      case 'columns': return l.parts ? columnsLabel(l, qr) : minimalLabel(l, qr);
      default: return gradeLabel(l, qr, GRADE_COLORS);
    }
  }

  root.MBU = { BRAND, PREFIX, GRADES, GRADE_COLORS, HIDDEN, NAME_MAX, LABEL_STYLES, parseProduction, cleanName, nameLine, encodeRecord, shortCode, decodeRecord, labelSvg };
})(typeof globalThis !== 'undefined' ? globalThis : this);
