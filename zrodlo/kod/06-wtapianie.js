// Wtapianie obiektów warstwy w plik PDF (pdf-lib). Współrzędne obiektów są „ekranowe” (punkty od lewego górnego
// rogu strony, tak jak ją widać – z uwzględnieniem obrotu strony); tu zamieniamy je na przestrzeń strony PDF.
const dataUrlBytes = u => { const b = atob(u.split(',')[1]); const a = new Uint8Array(b.length); for (let k = 0; k < b.length; k++) a[k] = b.charCodeAt(k); return a; };
function pageMap(i) {
  const p = S.pages[i]; const vp1 = p.pg.getViewport({ scale: 1 }); const page = S.lib.getPage(i);
  const rot = ((vp1.rotation % 360) + 360) % 360;
  return { page, vp1, rot, pt: (x, y) => vp1.convertToPdfPoint(x, y), box: rect => { const c = [[rect.x, rect.y], [rect.x + rect.w, rect.y], [rect.x, rect.y + rect.h], [rect.x + rect.w, rect.y + rect.h]].map(q => vp1.convertToPdfPoint(q[0], q[1])); const xs = c.map(q => q[0]), ys = c.map(q => q[1]); return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), c }; } };
}
// stan grafiki z kryciem (dla surowych operacji)
function gsKey(page, opacity, blend) { return page.node.newExtGState('GSe', S.lib.context.obj({ Type: 'ExtGState', ca: opacity ?? 1, CA: opacity ?? 1, ...(blend ? { BM: blend } : {}) })); }
const ISO = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z').replace(/^(\d{4})(\d{2})(\d{2})T/, 'D:$1$2$3');
// applyObjects – wtapia obiekty z podanych stron (albo ze wszystkich) i odświeża widok
async function applyObjects(pagesList, silent) {
  const list = pagesList || Object.keys(S.objs).map(Number);
  const todo = list.filter(i => objsOf(i).length); if (!todo.length) return false;
  busy(true, 'Wtapiam obiekty…');
  try {
    if (!silent) snapshot();
    for (const i of todo) { for (const o of objsOf(i)) { try { await burnObj(i, o); } catch (e) { console.error('obiekt', o, e); toast('Nie udało się wtopić obiektu (' + o.type + '): ' + e.message, true); } } S.objs[i] = []; }
    S.sel = null; await commitDoc('Zapisuję obiekty…'); if (!silent) toast('Obiekty wtopione w dokument');
    return true;
  } finally { busy(false); }
}
async function burnObj(i, o) {
  const M = pageMap(i); const { page, rot } = M; const R = degrees(rot);
  switch (o.type) {
    case 'text': {
      const font = await libFont(o.fam, o.bold, o.italic); const size = o.size; const lines = wrapText(font, o.text, size, Math.max(o.w - 2, 10)); const lh = size * 1.2;
      lines.forEach((ln, k) => { const t = safeText(font, ln); const lw = font.widthOfTextAtSize(t, size); const sx = o.align === 'center' ? o.x + (o.w - lw) / 2 : o.align === 'right' ? o.x + o.w - lw : o.x + 1; const sy = o.y + size * 1.0 + k * lh; const [x, y] = M.pt(sx, sy); page.drawText(t, { x, y, size, font, color: RGB(o.color), rotate: R, opacity: o.opacity ?? 1 }); });
      break; }
    case 'image': {
      const bytes = dataUrlBytes(o.src); const img = o.fmt === 'png' ? await S.lib.embedPng(bytes) : await S.lib.embedJpg(bytes);
      const th = ((o.rot || 0) * Math.PI) / 180; const cx = o.x + o.w / 2, cy = o.y + o.h / 2; const bl = [-o.w / 2, o.h / 2];
      const ax = cx + bl[0] * Math.cos(th) - bl[1] * Math.sin(th), ay = cy + bl[0] * Math.sin(th) + bl[1] * Math.cos(th);
      const [x, y] = M.pt(ax, ay); page.drawImage(img, { x, y, width: o.w, height: o.h, rotate: degrees(rot - (o.rot || 0)), opacity: o.opacity ?? 1 });
      break; }
    case 'rect': { const [x, y] = M.pt(o.x, o.y + o.h); page.drawRectangle({ x, y, width: o.w, height: o.h, rotate: R, borderColor: RGB(o.stroke), borderWidth: o.width, color: o.fill && o.fill !== 'none' ? RGB(o.fill) : undefined, opacity: o.opacity ?? 1, borderOpacity: o.opacity ?? 1 }); break; }
    case 'ellipse': { const [x, y] = M.pt(o.x + o.w / 2, o.y + o.h / 2); const sw = rot === 90 || rot === 270; page.drawEllipse({ x, y, xScale: (sw ? o.h : o.w) / 2 - o.width / 2, yScale: (sw ? o.w : o.h) / 2 - o.width / 2, borderColor: RGB(o.stroke), borderWidth: o.width, color: o.fill && o.fill !== 'none' ? RGB(o.fill) : undefined, opacity: o.opacity ?? 1, borderOpacity: o.opacity ?? 1 }); break; }
    case 'line': case 'arrow': {
      const [x1, y1, x2, y2] = linePts(o); const a = M.pt(o.x + x1, o.y + y1), b = M.pt(o.x + x2, o.y + y2);
      page.drawLine({ start: { x: a[0], y: a[1] }, end: { x: b[0], y: b[1] }, thickness: o.width, color: RGB(o.stroke), opacity: o.opacity ?? 1, lineCap: LineCapStyle.Round });
      if (o.type === 'arrow') { const an = Math.atan2(b[1] - a[1], b[0] - a[0]), L = 4 * o.width + 6; const p1 = [b[0] - L * Math.cos(an - 0.45), b[1] - L * Math.sin(an - 0.45)], p2 = [b[0] - L * Math.cos(an + 0.45), b[1] - L * Math.sin(an + 0.45)]; const gs = gsKey(page, o.opacity ?? 1); page.pushOperators(pushGraphicsState(), setGraphicsState(gs), setFillingColor(RGB(o.stroke)), moveTo(b[0], b[1]), lineTo(p1[0], p1[1]), lineTo(p2[0], p2[1]), closePath(), fill(), popGraphicsState()); }
      break; }
    case 'ink': {
      const gs = gsKey(page, o.opacity ?? 1); const ops = [pushGraphicsState(), setGraphicsState(gs), setStrokingColor(RGB(o.stroke)), setLineWidth(o.width), setLineCap(LineCapStyle.Round), setLineJoin(LineJoinStyle.Round)];
      for (const pa of o.paths) { pa.forEach((q, k) => { const [x, y] = M.pt(o.x + q[0], o.y + q[1]); ops.push(k ? lineTo(x, y) : moveTo(x, y)); }); if (pa.length === 1) { const [x, y] = M.pt(o.x + pa[0][0], o.y + pa[0][1]); ops.push(lineTo(x + 0.01, y)); } ops.push(stroke()); }
      ops.push(popGraphicsState()); page.pushOperators(...ops); break; }
    case 'hl': case 'ul': case 'st': {
      const quads = [], all = []; const ops = [pushGraphicsState(), setGraphicsState('GSa')];
      const col = RGB(o.color);
      for (const r of o.rects) {
        const UL = M.pt(r.x, r.y), UR = M.pt(r.x + r.w, r.y), LL = M.pt(r.x, r.y + r.h), LR = M.pt(r.x + r.w, r.y + r.h); quads.push(...UL, ...UR, ...LL, ...LR); all.push(UL, UR, LL, LR);
        if (o.type === 'hl') ops.push(setFillingColor(col), moveTo(...UL), lineTo(...UR), lineTo(...LR), lineTo(...LL), closePath(), fill());
        else { const t = Math.max(0.6, r.h * 0.07); const f = o.type === 'ul' ? 0.95 : 0.5; const A = M.pt(r.x, r.y + r.h * f), B = M.pt(r.x + r.w, r.y + r.h * f); ops.push(setStrokingColor(col), setLineWidth(t), moveTo(...A), lineTo(...B), stroke()); }
      }
      ops.push(popGraphicsState());
      const xs = all.map(q => q[0]), ys = all.map(q => q[1]); const rect = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
      const ap = S.lib.context.formXObject(ops, { BBox: rect, Resources: { ExtGState: { GSa: { Type: 'ExtGState', ca: o.type === 'hl' ? 1 : 1, CA: 1, BM: o.type === 'hl' ? 'Multiply' : 'Normal' } } } });
      const apRef = S.lib.context.register(ap);
      const [cr, cg, cb] = hex2rgb(o.color);
      const annot = S.lib.context.obj({ Type: 'Annot', Subtype: o.type === 'hl' ? 'Highlight' : o.type === 'ul' ? 'Underline' : 'StrikeOut', Rect: rect, QuadPoints: quads, C: [cr, cg, cb], CA: 1, F: 4, Contents: PDFHexString.fromText(o.text || ''), T: PDFHexString.fromText(o.author || localStorage.getItem('edytor:autor') || ''), M: PDFString.of(ISO()), AP: { N: apRef } });
      page.node.addAnnot(S.lib.context.register(annot)); break; }
    case 'note': {
      const b = M.box({ x: o.x, y: o.y, w: 20, h: 20 }); const [cr, cg, cb] = hex2rgb(o.color || '#ffd54f');
      const ops = [pushGraphicsState(), setFillingColor(rgb(cr, cg, cb)), setStrokingColor(rgb(0.2, 0.2, 0.2)), setLineWidth(1), setLineJoin(LineJoinStyle.Round), moveTo(2, 17), lineTo(18, 17), lineTo(18, 7), lineTo(8, 7), lineTo(4, 3), lineTo(4, 7), lineTo(2, 7), closePath(), fillAndStroke(), moveTo(5, 13.5), lineTo(15, 13.5), moveTo(5, 10.5), lineTo(12, 10.5), stroke(), popGraphicsState()];
      const ap = S.lib.context.formXObject(ops, { BBox: [0, 0, 20, 20] }); const apRef = S.lib.context.register(ap);
      const annot = S.lib.context.obj({ Type: 'Annot', Subtype: 'Text', Rect: [b.x, b.y, b.x + b.w, b.y + b.h], Contents: PDFHexString.fromText(o.text || ''), T: PDFHexString.fromText(o.author || ''), C: [cr, cg, cb], CA: 1, F: 4, Name: 'Comment', Open: false, M: PDFString.of(ISO()), AP: { N: apRef } });
      page.node.addAnnot(S.lib.context.register(annot)); break; }
    case 'white': { const [x, y] = M.pt(o.x, o.y + o.h); page.drawRectangle({ x, y, width: o.w, height: o.h, rotate: R, color: RGB(o.color || '#ffffff'), borderWidth: 0 }); break; }
    case 'redact': { const b = M.box(o); await removeTextInRect(i, b); const [x, y] = M.pt(o.x, o.y + o.h); page.drawRectangle({ x, y, width: o.w, height: o.h, rotate: R, color: rgb(0, 0, 0), borderWidth: 0 }); break; }
    case 'field': {
      const form = S.lib.getForm(); let name = o.name || 'pole'; let tf = null;
      try { tf = form.getTextField(name); } catch (e) { tf = null; }
      if (!tf) { try { tf = form.createTextField(name); } catch (e) { name = name + '_' + Date.now().toString(36); tf = form.createTextField(name); } }
      const font = await libFont('Sans'); tf.setText(o.value || '');
      const [x, y] = M.pt(o.x, o.y + o.h); tf.addToPage(page, { x, y, width: o.w, height: o.h, rotate: R, borderWidth: 1, borderColor: rgb(0.45, 0.55, 0.7), backgroundColor: rgb(1, 1, 1), font, textColor: rgb(0.07, 0.13, 0.2) });
      tf.setFontSize(Math.max(6, Math.min(o.h * 0.6, 12))); tf.updateAppearances(font); tf.defaultUpdateAppearances(font); break; }
    case 'check': {
      const form = S.lib.getForm(); let name = o.name || 'wybor'; let cb = null;
      try { cb = form.getCheckBox(name); } catch (e) { cb = null; }
      if (!cb) { try { cb = form.createCheckBox(name); } catch (e) { name = name + '_' + Date.now().toString(36); cb = form.createCheckBox(name); } }
      const [x, y] = M.pt(o.x, o.y + o.h); cb.addToPage(page, { x, y, width: o.w, height: o.h, rotate: R, borderWidth: 1, borderColor: rgb(0.45, 0.55, 0.7), backgroundColor: rgb(1, 1, 1) });
      if (o.checked) cb.check(); else cb.uncheck(); break; }
    case 'link': {
      const b = M.box(o); const annot = S.lib.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [b.x, b.y, b.x + b.w, b.y + b.h], Border: [0, 0, 0], F: 4, A: { Type: 'Action', S: 'URI', URI: PDFString.of(o.url) } });
      page.node.addAnnot(S.lib.context.register(annot)); break; }
  }
}
// loadAnnots – komentarze zapisane już w pliku (do panelu „Komentarze”)
async function loadAnnots() {
  S.annots = [];
  try { for (let i = 0; i < S.pages.length; i++) { const as = await S.pages[i].pg.getAnnotations(); for (const a of as) if (['Text', 'Highlight', 'Underline', 'StrikeOut', 'FreeText', 'Square', 'Circle', 'Ink'].includes(a.subtype) && (a.contentsObj && a.contentsObj.str || a.subtype === 'Text')) S.annots.push({ page: i, kind: { Text: 'komentarz', Highlight: 'zakreślenie', Underline: 'podkreślenie', StrikeOut: 'przekreślenie' }[a.subtype] || a.subtype, text: a.contentsObj ? a.contentsObj.str : '', author: a.titleObj ? a.titleObj.str : '' }); } } catch (e) {}
  updateCommentsPanel();
}
