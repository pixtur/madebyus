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
  // A record is { variant: 'q1' | 's1' | 'd1', answers: '0112_', prod: 'pz123' | null }.
  // The variant id carries its own scoring version.

  /** -> "s1/010030/pz123" (the URL hash, without '#') */
  function encodeRecord(rec) {
    return rec.variant + '/' + rec.answers + (rec.prod ? '/' + rec.prod : '');
  }

  /** -> "MBU-s1-010030-pz123" — fits in an NFO or a 4k end scroller. */
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

    const parts = s.startsWith(PREFIX + '-') ? s.slice(PREFIX.length + 1).split('-') : s.split('/');
    if (parts.length < 2 || parts.length > 3) return null;
    const v = variants[parts[0]];
    if (!v || !v.decode(parts[1])) return null;
    let prod = null;
    if (parts.length === 3) {
      if (!parseProduction(parts[2])) return null;
      prod = parts[2];
    }
    return { variant: parts[0], answers: parts[1], prod };
  }

  // ---- Label -----------------------------------------------------------------

  /**
   * l: {gradeIndex, headline, detail}: headline is "Built with …", detail the compact answers.
   * qr: optional {count, isDark(row, col)}.
   * Returns a standalone SVG string (no external fonts or refs, safe to download).
   */
  function labelSvg(l, qr) {
    const hasQr = !!qr;
    const W = hasQr ? 440 : 296;
    const H = 172;
    const out = [];
    const font = "font-family=\"'Inter','Helvetica Neue',Arial,sans-serif\"";
    const mono = "font-family=\"'JetBrains Mono','DejaVu Sans Mono',Consolas,monospace\"";
    const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');

    out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
    out.push(`<rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="14" fill="#ffffff" stroke="#16181d" stroke-width="3"/>`);
    out.push(`<text x="18" y="36" ${font} font-size="21" font-weight="800" letter-spacing="1.2" fill="#16181d">${BRAND}</text>`);

    // Grade scale: the active grade is taller and wider, the others are muted.
    let x = 18;
    for (let i = 0; i < GRADES.length; i++) {
      const active = i === l.gradeIndex;
      const w = active ? 46 : 31;
      const h = active ? 58 : 38;
      const y = active ? 50 : 60;
      const first = i === 0, last = i === GRADES.length - 1;
      out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${active ? 8 : (first || last ? 6 : 2)}" fill="${GRADE_COLORS[i]}" opacity="${active ? 1 : 0.38}"${active ? ' stroke="#16181d" stroke-width="2.5"' : ''}/>`);
      out.push(`<text x="${x + w / 2}" y="${y + h / 2 + (active ? 10 : 6)}" text-anchor="middle" ${font} font-weight="800" font-size="${active ? 28 : 16}" fill="#ffffff">${GRADES[i]}</text>`);
      x += w + 2;
    }

    const headSize = l.headline.length > 34 ? 12 : 14;
    out.push(`<text x="18" y="135" ${font} font-size="${headSize}" font-weight="700" fill="#16181d">${esc(l.headline)}</text>`);
    const detailSize = l.detail.length > 38 ? 10 : 11;
    out.push(`<text x="18" y="156" ${mono} font-size="${detailSize}" fill="#5b616e">${esc(l.detail)}</text>`);

    if (hasQr) {
      const size = 136;
      const qx = W - size - 18;
      const qy = (H - size) / 2;
      const cell = size / qr.count;
      let d = '';
      for (let r = 0; r < qr.count; r++)
        for (let c = 0; c < qr.count; c++)
          if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
      out.push(`<line x1="${qx - 14}" y1="18" x2="${qx - 14}" y2="${H - 18}" stroke="#d6d9df" stroke-width="1.5"/>`);
      out.push(`<path transform="translate(${qx} ${qy}) scale(${cell})" d="${d}" fill="#16181d" shape-rendering="crispEdges"/>`);
    }

    out.push('</svg>');
    return out.join('');
  }

  root.MBU = { BRAND, PREFIX, GRADES, GRADE_COLORS, HIDDEN, parseProduction, encodeRecord, shortCode, decodeRecord, labelSvg };
})(typeof globalThis !== 'undefined' ? globalThis : this);
