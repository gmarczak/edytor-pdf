// Analiza tekstu strony: z listy operacji pdf.js odczytujemy każdy napis (czcionka, rozmiar, położenie, kolor,
// kody znaków), a z surowego strumienia treści (pdf-lib) – gdzie dokładnie w pliku ten napis jest zapisany.
// Dzięki temu „Edytuj tekst” może podmienić napis w pliku (ta sama czcionka) albo usunąć go i narysować nowy.
const OPS = pdfjsLib.OPS;
const mul = (m, n) => [m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3], m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3], m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5]];
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const TEXT_OPS = new Set([OPS.showText, OPS.showSpacedText, OPS.nextLineShowText, OPS.nextLineSetSpacingShowText]);

// analyzePage – zwraca listę napisów (items) strony i surowe operacje strumienia (raw) do późniejszej edycji
async function analyzePage(i) {
  if (S.textCache[i]) return S.textCache[i];
  const p = S.pages[i]; const pg = p.pg;
  const ol = await pg.getOperatorList();
  const items = []; const fontsUsed = {};
  // stan grafiki i tekstu
  let ctm = [1, 0, 0, 1, 0, 0], stack = [], depth = 0, depthStack = [];
  let tm = null, tlm = null, font = null, fontName = null, fs = 0, tc = 0, tw = 0, th = 1, tl = 0, rise = 0, mode = 0, fill = [0, 0, 0];
  let rawIdx = 0;
  const F = ol.fnArray, A = ol.argsArray;
  for (let k = 0; k < F.length; k++) {
    const f = F[k], a = A[k];
    switch (f) {
      case OPS.save: stack.push({ ctm, fill, font, fontName, fs, tc, tw, th, tl, rise, mode }); break;
      case OPS.restore: { const s = stack.pop(); if (s) ({ ctm, fill, font, fontName, fs, tc, tw, th, tl, rise, mode } = s); break; }
      case OPS.transform: ctm = mul(a, ctm); break;
      case OPS.beginText: tm = [1, 0, 0, 1, 0, 0]; tlm = tm; break;
      case OPS.endText: break;
      case OPS.setCharSpacing: tc = a[0]; break;
      case OPS.setWordSpacing: tw = a[0]; break;
      case OPS.setHScale: th = a[0] / 100; break;
      case OPS.setLeading: tl = a[0]; break;
      case OPS.setFont: fontName = a[0]; fs = a[1]; try { font = pg.commonObjs.get(fontName); } catch (e) { font = null; } if (font) fontsUsed[fontName] = font; break;
      case OPS.setTextRenderingMode: mode = a[0]; break;
      case OPS.setTextRise: rise = a[0]; break;
      case OPS.moveText: tlm = mul([1, 0, 0, 1, a[0], a[1]], tlm || [1, 0, 0, 1, 0, 0]); tm = tlm; break;
      case OPS.setLeadingMoveText: tl = -a[1]; tlm = mul([1, 0, 0, 1, a[0], a[1]], tlm || [1, 0, 0, 1, 0, 0]); tm = tlm; break;
      case OPS.setTextMatrix: tm = a.slice(0, 6); tlm = tm; break;
      case OPS.nextLine: tlm = mul([1, 0, 0, 1, 0, -tl], tlm || [1, 0, 0, 1, 0, 0]); tm = tlm; break;
      case OPS.setFillRGBColor: fill = [a[0] / 255, a[1] / 255, a[2] / 255]; break;
      case OPS.setFillGray: fill = [a[0] / 255, a[0] / 255, a[0] / 255]; break;
      case OPS.paintFormXObjectBegin: depthStack.push({ ctm, stack: stack.length }); depth++; ctm = mul(a[0] || [1, 0, 0, 1, 0, 0], ctm); break;
      case OPS.paintFormXObjectEnd: { const d = depthStack.pop(); if (d) { ctm = d.ctm; stack.length = d.stack; } depth = Math.max(0, depth - 1); break; }
      case OPS.beginAnnotation: depthStack.push({ ctm, stack: stack.length }); depth++; break;
      case OPS.endAnnotation: { const d = depthStack.pop(); if (d) { ctm = d.ctm; stack.length = d.stack; } depth = Math.max(0, depth - 1); break; }
      default:
        if (TEXT_OPS.has(f)) {
          let glyphs = a[0];
          if (f === OPS.nextLineShowText) { tlm = mul([1, 0, 0, 1, 0, -tl], tlm || [1, 0, 0, 1, 0, 0]); tm = tlm; }
          if (f === OPS.nextLineSetSpacingShowText) { tw = a[0]; tc = a[1]; glyphs = a[2]; tlm = mul([1, 0, 0, 1, 0, -tl], tlm || [1, 0, 0, 1, 0, 0]); tm = tlm; }
          if (!tm) { tm = [1, 0, 0, 1, 0, 0]; tlm = tm; }
          const it = { page: i, opIdx: k, rawIdx: depth === 0 ? rawIdx : -1, depth, fontName, font, fs, color: fill, mode, text: '', codes: [], glyphs: [], adv: 0, tm: tm.slice(), ctm: ctm.slice(), rise, th, tc, tw };
          if (depth === 0) rawIdx++;
          const isT3 = font && font.isType3Font; const fm = (font && font.fontMatrix) || [0.001, 0, 0, 0.001, 0, 0];
          let x = 0;
          for (const g of glyphs || []) {
            if (typeof g === 'number') { const dx = -g / 1000 * fs * th; if (-g / 1000 * fs > 0.2 * Math.abs(fs) && it.glyphs.length) { it.text += ' '; it.codes.push(-1); it.glyphs.push({ u: ' ', c: -1, x, w: dx, synth: true }); } x += dx; continue; }
            const w0 = isT3 ? g.width * fm[0] : g.width / 1000;
            const dx = (w0 * fs + tc + (g.isSpace ? tw : 0)) * th;
            const u = g.unicode || '';
            it.text += u; it.codes.push(g.originalCharCode); it.glyphs.push({ u, c: g.originalCharCode, x, w: dx, inFont: g.isInFont !== false });
            x += dx;
          }
          it.adv = x;
          tm = mul([1, 0, 0, 1, x, 0], tm);
          if (it.glyphs.length && fs) { items.push(it); }
        }
    }
  }
  // ramki napisów w przestrzeni strony (user space): od (0, descent) do (adv, ascent) w przestrzeni tekstu
  for (const it of items) {
    const asc = (it.font && it.font.ascent) || 0.9, desc = (it.font && it.font.descent) || -0.22;
    const m = mul(it.tm, it.ctm); const fs = it.fs;
    const c = [[0, desc * fs + it.rise], [it.adv, desc * fs + it.rise], [it.adv, asc * fs + it.rise], [0, asc * fs + it.rise]].map(([x, y]) => apply(m, x, y));
    it.corners = c; it.m = m;
    it.scale = Math.hypot(m[0], m[1]);           // ile punktów strony ma 1 jednostka tekstu
    it.angle = Math.atan2(m[1], m[0]) * 180 / Math.PI;
    it.sizePt = Math.abs(fs) * it.scale;         // widoczny rozmiar czcionki w punktach
  }
  // surowy strumień treści – do podmiany napisów w pliku
  const raw = await rawContent(i);
  const textRaw = raw.ops.filter(o => o.op === 'Tj' || o.op === 'TJ' || o.op === "'" || o.op === '"');
  for (const it of items) {
    it.rawOp = it.rawIdx >= 0 ? textRaw[it.rawIdx] || null : null;
    // kontrola: bajty napisu w pliku muszą odpowiadać kodom znaków z pdf.js (1 albo 2 bajty na znak)
    if (it.rawOp) {
      const bytes = it.rawOp.bytes; const codes = it.codes.filter(c => c >= 0);
      let ok = false, bpc = 0;
      if (bytes.length === codes.length && codes.every((c, j) => c === bytes[j])) { ok = true; bpc = 1; }
      else if (bytes.length === codes.length * 2 && codes.every((c, j) => c === (bytes[2 * j] << 8 | bytes[2 * j + 1]))) { ok = true; bpc = 2; }
      if (!ok) it.rawOp = null; else it.bpc = bpc;
    }
  }
  // mapa znak -> kod dla każdej czcionki (z napisów, które są w dokumencie)
  const codeMaps = {}, widthMaps = {};
  for (const it of items) { const cm = codeMaps[it.fontName] || (codeMaps[it.fontName] = new Map()); const wm = widthMaps[it.fontName] || (widthMaps[it.fontName] = new Map()); for (const g of it.glyphs) { if (g.c >= 0 && g.u && g.u.length === 1 && !cm.has(g.u)) cm.set(g.u, g.c); if (g.c >= 0 && it.fs && !wm.has(g.c)) wm.set(g.c, g.w / Math.abs(it.fs)); } }
  const res = { items, raw, codeMaps, widthMaps, fontsUsed };
  S.textCache[i] = res; return res;
}

// rawContent – łączy wszystkie strumienie treści strony w jeden ciąg bajtów i dzieli go na operacje
async function rawContent(i) {
  const page = S.lib.getPage(i); const node = page.node;
  const contents = node.Contents(); const streams = [];
  const pushStream = s => { if (!s) return; if (s instanceof PDFRawStream) streams.push(decodePDFRawStream(s).decode()); else if (s.getUnencodedContents) streams.push(s.getUnencodedContents()); else if (s.getContents) streams.push(s.getContents()); };
  if (contents instanceof PDFArray) { for (let k = 0; k < contents.size(); k++) pushStream(S.lib.context.lookup(contents.get(k))); }
  else if (contents) pushStream(contents);
  let len = 0; for (const s of streams) len += s.length + 1;
  const bytes = new Uint8Array(len); let o = 0; for (const s of streams) { bytes.set(s, o); o += s.length; bytes[o++] = 10; }
  return { bytes, ops: tokenizeContent(bytes) };
}
// tokenizeContent – rozbiera strumień treści PDF na operacje: {op, start, end, bytes (napisy), nums}
function tokenizeContent(b) {
  const n = b.length; const ops = []; let i = 0; let operands = []; let opStart = -1; let arrDepth = 0;
  const WS = c => c === 32 || c === 10 || c === 13 || c === 9 || c === 12 || c === 0;
  const DELIM = c => c === 40 || c === 41 || c === 60 || c === 62 || c === 91 || c === 93 || c === 123 || c === 125 || c === 47 || c === 37;
  const flush = (op, start, end) => { const strs = [], nums = []; for (const o of operands) { if (o.t === 's') strs.push(o.v); else if (o.t === 'n') nums.push(o.v); } let out = []; for (const s of strs) for (const x of s) out.push(x); ops.push({ op, start: operands.length ? operands[0].start : start, end, bytes: Uint8Array.from(out), nums, operands }); operands = []; opStart = -1; };
  while (i < n) {
    const c = b[i];
    if (WS(c)) { i++; continue; }
    if (c === 37) { while (i < n && b[i] !== 10 && b[i] !== 13) i++; continue; }   // komentarz
    const start = i;
    if (c === 40) { // (napis)
      let d = 1; i++; const out = [];
      while (i < n && d > 0) { const x = b[i];
        if (x === 92) { i++; const e = b[i]; if (e === 110) out.push(10); else if (e === 114) out.push(13); else if (e === 116) out.push(9); else if (e === 98) out.push(8); else if (e === 102) out.push(12); else if (e >= 48 && e <= 55) { let v = 0, k = 0; while (k < 3 && b[i] >= 48 && b[i] <= 55) { v = v * 8 + (b[i] - 48); i++; k++; } i--; out.push(v & 255); } else if (e === 13) { if (b[i + 1] === 10) i++; } else if (e === 10) { } else out.push(e); i++; continue; }
        if (x === 40) d++; else if (x === 41) { d--; if (d === 0) { i++; break; } }
        out.push(x); i++; }
      operands.push({ t: 's', v: out, start, end: i }); continue;
    }
    if (c === 60) { if (b[i + 1] === 60) { i += 2; operands.push({ t: 'd', start }); continue; }
      i++; const out = []; let hi = -1;
      while (i < n && b[i] !== 62) { const x = b[i++]; let v = -1; if (x >= 48 && x <= 57) v = x - 48; else if (x >= 65 && x <= 70) v = x - 55; else if (x >= 97 && x <= 102) v = x - 87; if (v < 0) continue; if (hi < 0) hi = v; else { out.push(hi * 16 + v); hi = -1; } }
      if (hi >= 0) out.push(hi * 16); i++; operands.push({ t: 's', v: out, start, end: i }); continue; }
    if (c === 62) { i += (b[i + 1] === 62) ? 2 : 1; continue; }
    if (c === 91) { arrDepth++; i++; operands.push({ t: 'a', start }); continue; }
    if (c === 93) { arrDepth--; i++; continue; }
    if (c === 123 || c === 125) { i++; continue; }
    if (c === 47) { i++; while (i < n && !WS(b[i]) && !DELIM(b[i])) i++; operands.push({ t: 'name', v: String.fromCharCode.apply(null, b.subarray(start + 1, i)), start, end: i }); continue; }
    // liczba albo operator
    while (i < n && !WS(b[i]) && !DELIM(b[i])) i++;
    const tok = String.fromCharCode.apply(null, b.subarray(start, i));
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(tok)) { operands.push({ t: 'n', v: parseFloat(tok), start, end: i }); continue; }
    if (tok === 'BI') { // obraz wstawiony w treść: do „EI”
      let j = i; while (j < n) { if (b[j] === 73 && b[j + 1] === 68 && WS(b[j + 2]) && (j === 0 || WS(b[j - 1]) || DELIM(b[j - 1]))) { j += 3; break; } j++; }
      while (j < n) { if (WS(b[j]) && b[j + 1] === 69 && b[j + 2] === 73 && (j + 3 >= n || WS(b[j + 3]) || DELIM(b[j + 3]))) { j += 3; break; } j++; }
      operands = []; ops.push({ op: 'BI', start, end: j, bytes: new Uint8Array(0), nums: [], operands: [] }); i = j; continue; }
    if (tok.length) flush(tok, start, i);
  }
  return ops;
}
// nazwa czcionki w zasobach strony dla loadedName pdf.js (np. g_d0_f1 -> F1) – z surowych operacji Tf
function fontResourceName(i, item) {
  const raw = S.textCache[i].raw; let name = null; if (!item.rawOp) return null;
  for (const o of raw.ops) { if (o.start > item.rawOp.start) break; if (o.op === 'Tf') { const nm = o.operands.find(x => x.t === 'name'); if (nm) name = nm.v; } }
  return name;
}
// fontInfo – informacje o czcionce z pliku (pdf-lib): podtyp, kodowanie, czy osadzona, flagi
function fontInfo(i, item) {
  try {
    const page = S.lib.getPage(i); const res = page.node.Resources(); const fonts = res && res.lookup(PDFName.of('Font'), PDFDict);
    const rn = fontResourceName(i, item); if (!fonts || !rn) return null;
    const fd = fonts.lookup(PDFName.of(rn), PDFDict); if (!fd) return null;
    const sub = String(fd.get(PDFName.of('Subtype')) || '');
    const enc = fd.get(PDFName.of('Encoding')); const encName = enc instanceof PDFName ? enc.decodeText() : (enc ? 'dict' : '');
    let desc = fd.lookup(PDFName.of('FontDescriptor'), PDFDict);
    if (!desc && sub === '/Type0') { const dfs = fd.lookup(PDFName.of('DescendantFonts'), PDFArray); const df = dfs && dfs.lookup(0, PDFDict); desc = df && df.lookup(PDFName.of('FontDescriptor'), PDFDict); }
    const flags = desc ? Number((desc.get(PDFName.of('Flags')) || {}).asNumber ? desc.get(PDFName.of('Flags')).asNumber() : 0) : 0;
    const embedded = !!(desc && (desc.get(PDFName.of('FontFile')) || desc.get(PDFName.of('FontFile2')) || desc.get(PDFName.of('FontFile3'))));
    const base = String(fd.get(PDFName.of('BaseFont')) || '').replace(/^\//, '');
    return { sub, encName, flags, embedded, base, resName: rn, dict: fd, nonsymbolic: !!(flags & 32), serif: !!(flags & 2), fixed: !!(flags & 1) };
  } catch (e) { return null; }
}
// WinAnsi: kody dla znaków spoza ASCII, które można wpisać w czcionce ze standardowym kodowaniem
const WINANSI = { '€': 128, '‚': 130, 'ƒ': 131, '„': 132, '…': 133, '†': 134, '‡': 135, 'ˆ': 136, '‰': 137, 'Š': 138, '‹': 139, 'Œ': 140, 'Ž': 142, '‘': 145, '’': 146, '“': 147, '”': 148, '•': 149, '–': 150, '—': 151, '˜': 152, '™': 153, 'š': 154, '›': 155, 'œ': 156, 'ž': 158, 'Ÿ': 159 };
function winAnsiCode(ch) { const c = ch.charCodeAt(0); if (c >= 32 && c < 127) return c; if (c >= 160 && c <= 255) return c; return WINANSI[ch] ?? -1; }
