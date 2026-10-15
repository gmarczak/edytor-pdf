/* ============ STRONY ============ */
// Strony: obracanie, usuwanie, kolejność, wstawianie (puste / z innego PDF), wyodrębnianie, dzielenie,
// przycinanie, rozmiar oraz narzędzia na wszystkich stronach: numeracja, znak wodny, nagłówek i stopka.
const PAGE_SIZES = { A4: [595.28, 841.89], A3: [841.89, 1190.55], A5: [419.53, 595.28], Letter: [612, 792], Legal: [612, 1008] };
const MM = 72 / 25.4;
// pageOp – wspólny przebieg zmiany struktury: najpierw wtop obiekty, potem zmiana, potem odświeżenie
async function pageOp(label, fn) {
  if (!S.lib) return;
  snapshot(); busy(true, label);
  try { await applyObjects(null, true); await fn(); await commitDoc(label); }
  catch (e) { console.error(e); toast('Nie udało się: ' + e.message, true); await undo(); }
  finally { busy(false); }
}
const curPages = () => selectedThumbPages();
async function rotatePages(delta) { const ps = curPages(); await pageOp('Obracam…', async () => { for (const i of ps) { const pg = S.lib.getPage(i); pg.setRotation(degrees(((pg.getRotation().angle + delta) % 360 + 360) % 360)); } }); }
async function deletePages() {
  const ps = curPages(); if (ps.length >= S.lib.getPageCount()) return toast('Dokument musi mieć co najmniej jedną stronę.', true);
  if (!(await confirmBox('Usuń strony', `Usunąć ${ps.length === 1 ? 'stronę ' + (ps[0] + 1) : ps.length + ' stron (' + ps.map(x => x + 1).join(', ') + ')'}?`))) return;
  await pageOp('Usuwam strony…', async () => { for (const i of [...ps].reverse()) S.lib.removePage(i); S.cur = Math.min(S.cur, S.lib.getPageCount() - 1); });
}
async function duplicatePages() { const ps = curPages(); await pageOp('Powielam…', async () => { const copies = await S.lib.copyPages(S.lib, ps); for (let k = ps.length - 1; k >= 0; k--) S.lib.insertPage(ps[k] + 1, copies[k]); }); }
async function movePage(from, to) { await pageOp('Przenoszę stronę…', async () => { const pg = S.lib.getPage(from); S.lib.removePage(from); S.lib.insertPage(to, pg); S.cur = to; }); }
async function insertBlank() {
  const r = await ask('Wstaw pustą stronę', [{ id: 'where', label: 'Gdzie', type: 'select', value: 'after', options: [['after', 'Za bieżącą stroną'], ['before', 'Przed bieżącą stroną'], ['end', 'Na końcu'], ['start', 'Na początku']] }, { id: 'size', label: 'Rozmiar', type: 'select', value: 'same', options: [['same', 'Taki jak bieżąca strona'], ['A4', 'A4'], ['A3', 'A3'], ['A5', 'A5'], ['Letter', 'Letter']] }, { id: 'land', label: 'Poziomo', type: 'checkbox', value: false }, { id: 'count', label: 'Ile stron', type: 'number', value: 1, min: 1 }]);
  if (!r) return;
  await pageOp('Wstawiam strony…', async () => {
    const cur = S.lib.getPage(S.cur); let [w, h] = r.size === 'same' ? [cur.getWidth(), cur.getHeight()] : PAGE_SIZES[r.size]; if (r.land && r.size !== 'same') [w, h] = [h, w];
    const at = r.where === 'after' ? S.cur + 1 : r.where === 'before' ? S.cur : r.where === 'start' ? 0 : S.lib.getPageCount();
    for (let k = 0; k < Math.max(1, r.count | 0); k++) S.lib.insertPage(at, [w, h]); S.cur = at;
  });
}
async function insertFromPdf(fileBytes, name) {
  let src; try { src = await PDFDocument.load(fileBytes, { ignoreEncryption: true }); } catch (e) { return toast('Nie udało się wczytać pliku ' + name, true); }
  const n = src.getPageCount();
  const r = await ask('Wstaw strony z pliku ' + name, [{ id: 'range', label: `Które strony (1–${n}), np. 1-3,5; puste = wszystkie`, value: '' }, { id: 'where', label: 'Gdzie', type: 'select', value: 'after', options: [['after', 'Za bieżącą stroną'], ['before', 'Przed bieżącą stroną'], ['end', 'Na końcu'], ['start', 'Na początku']] }]);
  if (!r) return;
  const idx = parseRange(r.range, n); if (!idx.length) return toast('Nieprawidłowy zakres stron.', true);
  await pageOp('Wstawiam strony…', async () => { const copies = await S.lib.copyPages(src, idx); let at = r.where === 'after' ? S.cur + 1 : r.where === 'before' ? S.cur : r.where === 'start' ? 0 : S.lib.getPageCount(); for (const c of copies) S.lib.insertPage(at++, c); });
}
// parseRange – „1-3,5,8-” -> lista indeksów (0-based) w granicach n
function parseRange(t, n) {
  t = String(t || '').trim(); if (!t) return Array.from({ length: n }, (_, k) => k);
  const out = new Set();
  for (const part of t.split(/[,; ]+/)) { const m = /^(\d+)?\s*-\s*(\d+)?$/.exec(part); if (m) { const a = m[1] ? +m[1] : 1, b = m[2] ? +m[2] : n; for (let k = Math.max(1, a); k <= Math.min(n, b); k++) out.add(k - 1); } else if (/^\d+$/.test(part)) { const k = +part; if (k >= 1 && k <= n) out.add(k - 1); } }
  return [...out].sort((a, b) => a - b);
}
async function extractPages() {
  const n = S.lib.getPageCount(); const sel = curPages();
  const r = await ask('Wyodrębnij strony do nowego pliku', [{ id: 'range', label: `Strony (1–${n})`, value: sel.map(x => x + 1).join(',') }]);
  if (!r) return; const idx = parseRange(r.range, n); if (!idx.length) return toast('Nieprawidłowy zakres.', true);
  await applyObjects(null, true);
  const out = await PDFDocument.create(); const copies = await out.copyPages(S.lib, idx); for (const c of copies) out.addPage(c);
  await saveBytesAs(await out.save(), (S.name || 'dokument').replace(/\.pdf$/i, '') + '-strony.pdf');
}
async function splitDoc() {
  const n = S.lib.getPageCount();
  const r = await ask('Podziel dokument', [{ id: 'mode', label: 'Sposób', type: 'select', value: 'each', options: [['each', 'Każda strona osobno'], ['every', 'Co N stron'], ['ranges', 'Według zakresów (np. 1-3; 4-6; 7-)']] }, { id: 'n', label: 'N (dla „co N stron”)', type: 'number', value: 2, min: 1 }, { id: 'ranges', label: 'Zakresy oddzielone średnikiem', value: '' }], 'Podziel i zapisz ZIP');
  if (!r) return;
  let groups = [];
  if (r.mode === 'each') groups = Array.from({ length: n }, (_, k) => [k]);
  else if (r.mode === 'every') { const k = Math.max(1, r.n | 0); for (let s = 0; s < n; s += k) groups.push(Array.from({ length: Math.min(k, n - s) }, (_, j) => s + j)); }
  else groups = r.ranges.split(';').map(x => parseRange(x, n)).filter(g => g.length);
  if (!groups.length) return toast('Brak zakresów.', true);
  await applyObjects(null, true); busy(true, 'Dzielę…');
  try {
    const zip = new JSZip(); const base = (S.name || 'dokument').replace(/\.pdf$/i, '');
    for (let g = 0; g < groups.length; g++) { const out = await PDFDocument.create(); const cp = await out.copyPages(S.lib, groups[g]); for (const c of cp) out.addPage(c); zip.file(`${base}-${String(g + 1).padStart(2, '0')}.pdf`, await out.save()); }
    await saveBytesAs(await zip.generateAsync({ type: 'uint8array' }), base + '-podzielony.zip', 'zip');
  } finally { busy(false); }
}
async function cropPages() {
  const r = await ask('Przytnij strony (marginesy do odcięcia, w mm)', [{ id: 'l', label: 'Z lewej', type: 'number', value: 0 }, { id: 'r', label: 'Z prawej', type: 'number', value: 0 }, { id: 't', label: 'Z góry', type: 'number', value: 0 }, { id: 'b', label: 'Z dołu', type: 'number', value: 0 }, { id: 'all', label: 'Wszystkie strony (nie tylko bieżąca)', type: 'checkbox', value: false }, { id: 'info', type: 'info', html: 'Przycięcie ustawia obszar wyświetlania (CropBox) – treść poza nim zostaje w pliku, ale nie jest pokazywana ani drukowana.' }]);
  if (!r) return;
  const ps = r.all ? Array.from({ length: S.lib.getPageCount() }, (_, k) => k) : curPages();
  await pageOp('Przycinam…', async () => { for (const i of ps) { const pg = S.lib.getPage(i); const mb = pg.getMediaBox(); const rot = pg.getRotation().angle; let [l, rr, t, b] = [r.l, r.r, r.t, r.b].map(v => (v || 0) * MM); if (rot === 90) [l, rr, t, b] = [b, t, l, rr]; else if (rot === 180) [l, rr, t, b] = [rr, l, b, t]; else if (rot === 270) [l, rr, t, b] = [t, b, rr, l]; pg.setCropBox(mb.x + l, mb.y + b, Math.max(20, mb.width - l - rr), Math.max(20, mb.height - t - b)); } });
}
async function resizePages() {
  const r = await ask('Zmień rozmiar stron', [{ id: 'size', label: 'Nowy rozmiar', type: 'select', value: 'A4', options: [['A4', 'A4'], ['A3', 'A3'], ['A5', 'A5'], ['Letter', 'Letter'], ['Legal', 'Legal']] }, { id: 'land', label: 'Poziomo', type: 'checkbox', value: false }, { id: 'scale', label: 'Przeskaluj treść, żeby pasowała', type: 'checkbox', value: true }, { id: 'all', label: 'Wszystkie strony', type: 'checkbox', value: true }]);
  if (!r) return;
  const ps = r.all ? Array.from({ length: S.lib.getPageCount() }, (_, k) => k) : curPages();
  await pageOp('Zmieniam rozmiar…', async () => { for (const i of ps) { const pg = S.lib.getPage(i); let [w, h] = PAGE_SIZES[r.size]; if (r.land) [w, h] = [h, w]; const ow = pg.getWidth(), oh = pg.getHeight(); if (r.scale) { const k = Math.min(w / ow, h / oh); pg.scaleContent(k, k); pg.translateContent((w - ow * k) / 2, (h - oh * k) / 2); } pg.setSize(w, h); pg.setCropBox(0, 0, w, h); } });
}
// ---- narzędzia na wielu stronach ----
function fillTpl(t, i, n) { return String(t || '').replace(/\{n\}/g, i + 1).replace(/\{N\}/g, n).replace(/\{data\}/g, new Date().toLocaleDateString('pl-PL')).replace(/\{plik\}/g, (S.name || '').replace(/\.pdf$/i, '')); }
// drawOnAllPages – rysuje napis na każdej stronie w wybranym miejscu (uwzględnia obrót strony)
async function drawOnPages(ps, fn) { for (const i of ps) { const p = S.pages[i]; const vp1 = p.pg.getViewport({ scale: 1 }); const rot = ((vp1.rotation % 360) + 360) % 360; const page = S.lib.getPage(i); await fn({ i, page, W: vp1.width, H: vp1.height, pt: (x, y) => vp1.convertToPdfPoint(x, y), R: degrees(rot) }); } }
async function pageNumbers() {
  const n = S.lib.getPageCount();
  const r = await ask('Numeracja stron', [{ id: 'tpl', label: 'Wzór ({n} – numer, {N} – liczba stron)', value: 'Strona {n} z {N}' }, { id: 'pos', label: 'Miejsce', type: 'select', value: 'bc', options: [['bc', 'Dół, środek'], ['br', 'Dół, prawa'], ['bl', 'Dół, lewa'], ['tc', 'Góra, środek'], ['tr', 'Góra, prawa'], ['tl', 'Góra, lewa']] }, { id: 'size', label: 'Rozmiar (pt)', type: 'number', value: 10 }, { id: 'margin', label: 'Odstęp od krawędzi (mm)', type: 'number', value: 10 }, { id: 'from', label: 'Od strony', type: 'number', value: 1, min: 1, max: n }, { id: 'start', label: 'Pierwszy numer', type: 'number', value: 1 }, { id: 'fam', label: 'Czcionka', type: 'select', value: 'Sans', options: [['Sans', 'Liberation Sans'], ['Serif', 'Liberation Serif'], ['Mono', 'Liberation Mono']] }, { id: 'color', label: 'Kolor', type: 'color', value: '#000000' }]);
  if (!r) return;
  const ps = Array.from({ length: n }, (_, k) => k).filter(k => k >= (r.from | 0) - 1);
  await pageOp('Numeruję strony…', async () => { const font = await libFont(r.fam); await drawOnPages(ps, async ({ page, W, H, pt, R, i }) => { const t = safeText(font, fillTpl(r.tpl, i - ((r.from | 0) - 1) + (r.start | 0) - 1, n - ((r.from | 0) - 1) + (r.start | 0) - 1)); const tw = font.widthOfTextAtSize(t, r.size); const m = r.margin * MM; const x = r.pos[1] === 'c' ? (W - tw) / 2 : r.pos[1] === 'r' ? W - m - tw : m; const y = r.pos[0] === 'b' ? H - m : m + r.size; const [px, py] = pt(x, y); page.drawText(t, { x: px, y: py, size: r.size, font, color: RGB(r.color), rotate: R }); }); });
}
async function watermark() {
  const r = await ask('Znak wodny', [{ id: 'text', label: 'Tekst', value: 'POUFNE' }, { id: 'size', label: 'Rozmiar (pt)', type: 'number', value: 60 }, { id: 'color', label: 'Kolor', type: 'color', value: '#c62828' }, { id: 'opacity', label: 'Krycie (0–1)', type: 'number', value: 0.25, step: 0.05, min: 0, max: 1 }, { id: 'angle', label: 'Kąt (°)', type: 'number', value: 45 }, { id: 'fam', label: 'Czcionka', type: 'select', value: 'Sans', options: [['Sans', 'Liberation Sans'], ['Serif', 'Liberation Serif'], ['Mono', 'Liberation Mono']] }, { id: 'bold', label: 'Pogrubienie', type: 'checkbox', value: true }, { id: 'pages', label: 'Strony (puste = wszystkie)', value: '' }]);
  if (!r || !r.text) return;
  const n = S.lib.getPageCount(); const ps = parseRange(r.pages, n);
  await pageOp('Dodaję znak wodny…', async () => { const font = await libFont(r.fam, r.bold); await drawOnPages(ps, async ({ page, W, H, pt, R, i }) => { const t = safeText(font, fillTpl(r.text, i, n)); const tw = font.widthOfTextAtSize(t, r.size); const a = r.angle * Math.PI / 180; const cx = W / 2, cy = H / 2; const sx = cx - (tw / 2) * Math.cos(a), sy = cy + (tw / 2) * Math.sin(a) + r.size * 0.35; const [px, py] = pt(sx, sy); page.drawText(t, { x: px, y: py, size: r.size, font, color: RGB(r.color), opacity: r.opacity, rotate: degrees(R.angle + r.angle) }); }); });
}
async function headerFooter() {
  const r = await ask('Nagłówek i stopka ({n} numer, {N} liczba stron, {data}, {plik})', [{ id: 'hl', label: 'Nagłówek – lewa', value: '' }, { id: 'hc', label: 'Nagłówek – środek', value: '' }, { id: 'hr', label: 'Nagłówek – prawa', value: '' }, { id: 'fl', label: 'Stopka – lewa', value: '' }, { id: 'fc', label: 'Stopka – środek', value: '' }, { id: 'fr', label: 'Stopka – prawa', value: '' }, { id: 'size', label: 'Rozmiar (pt)', type: 'number', value: 9 }, { id: 'margin', label: 'Odstęp od krawędzi (mm)', type: 'number', value: 8 }, { id: 'fam', label: 'Czcionka', type: 'select', value: 'Sans', options: [['Sans', 'Liberation Sans'], ['Serif', 'Liberation Serif'], ['Mono', 'Liberation Mono']] }, { id: 'color', label: 'Kolor', type: 'color', value: '#333333' }, { id: 'pages', label: 'Strony (puste = wszystkie)', value: '' }]);
  if (!r) return;
  const n = S.lib.getPageCount(); const ps = parseRange(r.pages, n);
  await pageOp('Dodaję nagłówek i stopkę…', async () => { const font = await libFont(r.fam); const m = r.margin * MM; await drawOnPages(ps, async ({ page, W, H, pt, R, i }) => { for (const [key, pos] of [['hl', 'tl'], ['hc', 'tc'], ['hr', 'tr'], ['fl', 'bl'], ['fc', 'bc'], ['fr', 'br']]) { if (!r[key]) continue; const t = safeText(font, fillTpl(r[key], i, n)); const tw = font.widthOfTextAtSize(t, r.size); const x = pos[1] === 'c' ? (W - tw) / 2 : pos[1] === 'r' ? W - m - tw : m; const y = pos[0] === 'b' ? H - m : m + r.size; const [px, py] = pt(x, y); page.drawText(t, { x: px, y: py, size: r.size, font, color: RGB(r.color), rotate: R }); } }); });
}

/* ============ FORMULARZE ============ */
// Formularze: wypełnianie pól zapisanych w pliku (panel „Formularz”), spłaszczanie, usuwanie adnotacji.
function fieldKind(f) { if (f instanceof PDFLib.PDFTextField) return 'text'; if (f instanceof PDFLib.PDFCheckBox) return 'check'; if (f instanceof PDFLib.PDFRadioGroup) return 'radio'; if (f instanceof PDFLib.PDFDropdown) return 'drop'; if (f instanceof PDFLib.PDFOptionList) return 'list'; if (f instanceof PDFLib.PDFButton) return 'button'; if (f instanceof PDFLib.PDFSignature) return 'sig'; return 'other'; }
function updateFormPanel() {
  const box = $('#pForm'); box.innerHTML = ''; if (!S.lib) return;
  let fields = []; try { fields = S.lib.getForm().getFields(); } catch (e) { box.innerHTML = '<div style="font-size:12px;color:var(--mut)">Nie udało się odczytać formularza.</div>'; return; }
  if (!fields.length) { box.innerHTML = '<div style="font-size:12px;color:var(--mut)">Ten dokument nie ma pól formularza. Dodaj je narzędziami „Pole” i „Checkbox”.</div>'; return; }
  box.append(el('div', { style: 'font-size:12px;color:var(--mut);margin-bottom:6px' }, `${fields.length} pól. Zmiany zapisują się po opuszczeniu pola.`));
  for (const f of fields) {
    const kind = fieldKind(f); const name = f.getName(); const row = el('div', { class: 'fld' }, el('span', { title: name }, name));
    let inp = null;
    try {
      if (kind === 'text') { inp = el('input'); inp.value = f.getText() || ''; inp.onchange = () => setField(f, inp.value); }
      else if (kind === 'check') { inp = el('input', { type: 'checkbox', style: 'flex:0;width:auto' }); inp.checked = f.isChecked(); inp.onchange = () => setField(f, inp.checked); }
      else if (kind === 'radio' || kind === 'drop') { inp = el('select'); if (kind === 'drop') inp.append(el('option', { value: '' }, '—')); for (const o of f.getOptions()) inp.append(el('option', { value: o }, o)); const s = f.getSelected(); inp.value = Array.isArray(s) ? (s[0] || '') : (s || ''); inp.onchange = () => setField(f, inp.value); }
      else if (kind === 'list') { inp = el('select', { multiple: 'true', style: 'height:60px' }); for (const o of f.getOptions()) inp.append(el('option', { value: o }, o)); for (const s of f.getSelected()) { const op = [...inp.options].find(x => x.value === s); if (op) op.selected = true; } inp.onchange = () => setField(f, [...inp.selectedOptions].map(x => x.value)); }
      else inp = el('span', { style: 'color:var(--mut);font-size:12px' }, kind === 'sig' ? 'podpis' : kind === 'button' ? 'przycisk' : 'inne');
    } catch (e) { inp = el('span', { style: 'color:var(--warn);font-size:12px' }, 'błąd'); }
    row.append(inp); box.append(row);
  }
}
async function setField(f, v) {
  try {
    snapshot(); const kind = fieldKind(f); const font = await libFont('Sans');
    if (kind === 'text') { f.setText(String(v)); f.updateAppearances(font); }
    else if (kind === 'check') { if (v) f.check(); else f.uncheck(); f.updateAppearances(); }
    else if (kind === 'radio') { if (v) f.select(v); f.updateAppearances(); }
    else if (kind === 'drop') { if (v) f.select(v); else f.clear(); f.updateAppearances(font); }
    else if (kind === 'list') { f.select(v); f.updateAppearances(font); }
    await commitDoc('Zapisuję pole…');
  } catch (e) { console.error(e); toast('Nie udało się zapisać pola: ' + e.message, true); }
}
async function flattenForm() {
  if (!S.lib) return; if (!(await confirmBox('Spłaszcz formularz', 'Pola formularza zostaną zamienione na zwykłą treść strony – nie będzie już można ich wypełniać. Kontynuować?'))) return;
  await pageOp('Spłaszczam formularz…', async () => { const form = S.lib.getForm(); try { form.updateFieldAppearances(await libFont('Sans')); } catch (e) {} form.flatten(); });
}
async function removeAnnots() {
  if (!S.lib) return; if (!(await confirmBox('Usuń adnotacje', 'Usunąć ze wszystkich stron komentarze, zakreślenia, łącza i inne adnotacje (pola formularza zostają)? '))) return;
  await pageOp('Usuwam adnotacje…', async () => {
    for (let i = 0; i < S.lib.getPageCount(); i++) { const node = S.lib.getPage(i).node; const an = node.Annots(); if (!an) continue; const keep = [];
      for (let k = 0; k < an.size(); k++) { const ref = an.get(k); const d = S.lib.context.lookup(ref); const sub = d && d.get && String(d.get(PDFName.of('Subtype')) || ''); if (sub === '/Widget') keep.push(ref); }
      node.set(PDFName.of('Annots'), S.lib.context.obj(keep)); }
    S.objs = {};
  });
}

