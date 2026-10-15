/* ============ PLIK ============ */
// Plik: otwieranie, zapis, drukowanie, eksport, właściwości, ostatnie pliki, przeciąganie na okno.
// W programie (Electron) używamy okien systemowych przez window.desktop; w przeglądarce – wyboru pliku i pobierania.
const PDF_FILTER = [{ name: 'Dokument PDF', extensions: ['pdf'] }];
async function openFile() {
  if (!(await maybeSaveFirst())) return;
  if (DESK) { const p = await DESK.openDialog(PDF_FILTER); if (p) await openPath(p); return; }
  const f = $('#fOpen'); f.value = ''; f.onchange = async () => { const file = f.files[0]; if (file) await openBytes(new Uint8Array(await file.arrayBuffer()), file.name, null); }; f.click();
}
async function openPath(p) {
  try { const data = await DESK.readFile(p); await openBytes(new Uint8Array(data), p.split(/[\\/]/).pop(), p); }
  catch (e) { toast('Nie udało się otworzyć pliku: ' + e.message, true); }
}
async function openBytes(bytes, name, path) {
  try {
    if (!(bytes[0] === 0x25 && bytes[1] === 0x50) && !new TextDecoder('latin1').decode(bytes.subarray(0, 1024)).includes('%PDF')) throw new Error('To nie jest plik PDF.');
    S.name = name || 'dokument.pdf'; S.path = path || null; S.cur = 0; S.objs = {};
    await loadBytes(bytes); await loadAnnots(); setTool('select'); addRecent(path, S.name); toast('Otwarto ' + S.name); updateUndoButtons(); docEl.focus();
  } catch (e) { console.error(e); await alertBox('Nie udało się otworzyć pliku', `<div>${esc(e.message)}</div>`); }
}
async function newDoc() {
  if (!(await maybeSaveFirst())) return;
  const r = await ask('Nowy dokument', [{ id: 'size', label: 'Rozmiar strony', type: 'select', value: 'A4', options: Object.keys(PAGE_SIZES).map(k => [k, k]) }, { id: 'land', label: 'Poziomo', type: 'checkbox', value: false }, { id: 'count', label: 'Liczba stron', type: 'number', value: 1, min: 1 }]);
  if (!r) return;
  const doc = await PDFDocument.create(); let [w, h] = PAGE_SIZES[r.size]; if (r.land) [w, h] = [h, w]; for (let k = 0; k < Math.max(1, r.count | 0); k++) doc.addPage([w, h]);
  await openBytes(await doc.save(), 'nowy.pdf', null); S.dirty = true; updateUndoButtons();
}
async function fromImages(files) {
  if (!files) { const f = $('#fImgs'); f.value = ''; f.onchange = () => fromImages([...f.files]); f.click(); return; }
  if (!files.length) return; if (!(await maybeSaveFirst())) return;
  busy(true, 'Tworzę PDF z obrazów…');
  try {
    const doc = await PDFDocument.create();
    for (const file of files) { const bytes = new Uint8Array(await file.arrayBuffer()); const png = /png/i.test(file.type) || /\.png$/i.test(file.name); const img = png ? await doc.embedPng(bytes) : await doc.embedJpg(bytes); const k = Math.min(1, 595.28 / img.width, 841.89 / img.height); const page = doc.addPage([img.width * k, img.height * k]); page.drawImage(img, { x: 0, y: 0, width: img.width * k, height: img.height * k }); }
    await openBytes(await doc.save(), (files[0].name.replace(/\.[^.]+$/, '') || 'obrazy') + '.pdf', null); S.dirty = true; updateUndoButtons();
  } catch (e) { toast('Nie udało się: ' + e.message, true); } finally { busy(false); }
}
// finalBytes – bajty do zapisu: obiekty wtopione, metadane uzupełnione
async function finalBytes() {
  finishEdit(false); await applyObjects(null, true);
  try { S.lib.setModificationDate(new Date()); if (!S.lib.getProducer()) S.lib.setProducer('Edytor PDF (gmarczak)'); } catch (e) {}
  return await S.lib.save({ useObjectStreams: false, updateFieldAppearances: false });
}
async function saveFile(as) {
  if (!S.lib) return false; busy(true, 'Zapisuję…');
  try {
    const bytes = await finalBytes(); S.bytes = bytes;
    if (DESK) {
      let p = S.path; if (as || !p) { p = await DESK.saveDialog(S.name || 'dokument.pdf', PDF_FILTER, S.path ? S.path.replace(/[\\/][^\\/]*$/, '') : undefined); if (!p) return false; if (!/\.pdf$/i.test(p)) p += '.pdf'; }
      await DESK.writeFile(p, bytes); S.path = p; S.name = p.split(/[\\/]/).pop(); addRecent(p, S.name);
    } else { downloadBytes(bytes, S.name || 'dokument.pdf'); }
    S.dirty = false; updateUndoButtons(); toast('Zapisano ' + S.name); return true;
  } catch (e) { console.error(e); toast('Nie udało się zapisać: ' + e.message, true); return false; } finally { busy(false); }
}
async function saveBytesAs(bytes, name, ext) {
  if (DESK) { const p = await DESK.saveDialog(name, ext === 'zip' ? [{ name: 'Archiwum ZIP', extensions: ['zip'] }] : ext === 'png' ? [{ name: 'Obraz PNG', extensions: ['png'] }] : ext === 'txt' ? [{ name: 'Plik tekstowy', extensions: ['txt'] }] : PDF_FILTER); if (!p) return false; await DESK.writeFile(p, bytes); toast('Zapisano ' + p.split(/[\\/]/).pop()); return true; }
  downloadBytes(bytes, name); return true;
}
function downloadBytes(bytes, name) { const a = el('a', { href: URL.createObjectURL(new Blob([bytes])), download: name }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
async function maybeSaveFirst() {
  if (!S.lib || !S.dirty) return true;
  const r = await dialog({ title: 'Niezapisane zmiany', body: `<div>Dokument <b>${esc(S.name)}</b> ma niezapisane zmiany. Zapisać je?</div>`, buttons: [{ label: 'Anuluj', value: null }, { label: 'Nie zapisuj', value: 'no' }, { label: 'Zapisz', go: true, value: 'yes' }] });
  if (r === null) return false; if (r === 'yes') return await saveFile(false); return true;
}
async function closeDoc() {
  if (!(await maybeSaveFirst())) return;
  if (S.js) { try { await S.js.destroy(); } catch (e) {} }
  S.js = null; S.lib = null; S.bytes = null; S.pages = []; S.objs = {}; S.undo = []; S.redo = []; S.dirty = false; S.name = ''; S.path = null; S.sel = null;
  pagesEl.innerHTML = ''; $('#pThumbs').innerHTML = ''; $('#welcome').style.display = ''; $('#pageCount').textContent = '/ 0'; $('#props').classList.remove('on'); updateUndoButtons(); updateFormPanel(); updateCommentsPanel(); showRecent();
}
async function printDoc() {
  if (!S.lib) return; const bytes = await finalBytes(); S.bytes = bytes;
  if (DESK) { const r = await DESK.print(bytes); if (r && r.error) toast(r.error, true); return; }
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })); const w = window.open(url, '_blank'); if (!w) toast('Przeglądarka zablokowała okno – zezwól na wyskakujące okna.', true);
}
async function exportPng() {
  if (!S.lib) return; const p = S.pages[S.cur]; const vp = p.pg.getViewport({ scale: 2 }); const c = el('canvas', { width: Math.round(vp.width), height: Math.round(vp.height) });
  await p.pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  const blob = await new Promise(r => c.toBlob(r, 'image/png')); await saveBytesAs(new Uint8Array(await blob.arrayBuffer()), (S.name || 'strona').replace(/\.pdf$/i, '') + '-str' + (S.cur + 1) + '.png', 'png');
}
async function docProps() {
  if (!S.lib) return; const g = f => { try { return S.lib[f]() || ''; } catch (e) { return ''; } };
  const r = await ask('Właściwości dokumentu', [{ id: 'title', label: 'Tytuł', value: g('getTitle') }, { id: 'author', label: 'Autor', value: g('getAuthor') }, { id: 'subject', label: 'Temat', value: g('getSubject') }, { id: 'keywords', label: 'Słowa kluczowe (po przecinku)', value: (g('getKeywords') || '') }, { id: 'creator', label: 'Program źródłowy', value: g('getCreator') }, { id: 'info', type: 'info', html: `Stron: ${S.lib.getPageCount()} · rozmiar pliku: ${Math.round(S.bytes.length / 1024)} KB · wersja PDF ${new TextDecoder('latin1').decode(S.bytes.subarray(0, 12)).match(/%PDF-(\d\.\d)/)?.[1] || '?'}` }], 'Zapisz');
  if (!r) return; snapshot(); S.lib.setTitle(r.title); S.lib.setAuthor(r.author); S.lib.setSubject(r.subject); S.lib.setKeywords(r.keywords.split(',').map(x => x.trim()).filter(Boolean)); S.lib.setCreator(r.creator); await commitDoc('Zapisuję właściwości…'); toast('Właściwości zapisane');
}
async function extractText() {
  if (!S.lib) return; busy(true, 'Odczytuję tekst…'); let out = '';
  try { for (let i = 0; i < S.pages.length; i++) { const tc = await S.pages[i].pg.getTextContent(); let line = ''; for (const it of tc.items) { line += it.str; if (it.hasEOL) { out += line + '\n'; line = ''; } } out += line + '\n\n----- strona ' + (i + 1) + ' -----\n\n'; } } finally { busy(false); }
  const ta = el('textarea', { style: 'min-height:300px;font:13px ui-monospace,monospace' }); ta.value = out;
  await dialog({ title: 'Tekst dokumentu', body: ta, wide: true, buttons: [{ label: 'Zamknij', value: null }, { label: 'Kopiuj', value: 'c', onClick: async () => { await navigator.clipboard.writeText(ta.value); toast('Skopiowano'); return false; } }, { label: 'Zapisz .txt', go: true, value: 's', onClick: async () => { await saveBytesAs(new TextEncoder().encode(ta.value), (S.name || 'dokument').replace(/\.pdf$/i, '') + '.txt', 'txt'); } }] });
}
async function extractImages() {
  if (!S.lib) return; busy(true, 'Wyodrębniam obrazy…');
  try {
    const zip = new JSZip(); let n = 0;
    for (let i = 0; i < S.pages.length; i++) { const pg = S.pages[i].pg; const ol = await pg.getOperatorList(); const seen = new Set();
      for (let k = 0; k < ol.fnArray.length; k++) { if (ol.fnArray[k] !== OPS.paintImageXObject && ol.fnArray[k] !== OPS.paintImageXObjectRepeat) continue; const name = ol.argsArray[k][0]; if (seen.has(name)) continue; seen.add(name);
        let img = null; try { img = pg.objs.get(name); } catch (e) { try { img = pg.commonObjs.get(name); } catch (x) {} } if (!img) continue;
        const c = el('canvas', { width: img.width, height: img.height }); const ctx = c.getContext('2d');
        if (img.bitmap) ctx.drawImage(img.bitmap, 0, 0); else if (img.data) { const id = ctx.createImageData(img.width, img.height); if (img.kind === 1) { for (let q = 0, o = 0; q < img.width * img.height; q++, o += 4) { const v = (img.data[q >> 3] >> (7 - (q & 7))) & 1 ? 255 : 0; id.data[o] = id.data[o + 1] = id.data[o + 2] = v; id.data[o + 3] = 255; } } else if (img.kind === 2) { for (let q = 0, o = 0, s = 0; q < img.width * img.height; q++, o += 4, s += 3) { id.data[o] = img.data[s]; id.data[o + 1] = img.data[s + 1]; id.data[o + 2] = img.data[s + 2]; id.data[o + 3] = 255; } } else id.data.set(img.data.subarray(0, id.data.length)); ctx.putImageData(id, 0, 0); } else continue;
        const blob = await new Promise(r => c.toBlob(r, 'image/png')); zip.file(`strona${i + 1}-obraz${++n}.png`, await blob.arrayBuffer()); } }
    if (!n) return toast('W dokumencie nie ma obrazów.');
    await saveBytesAs(await zip.generateAsync({ type: 'uint8array' }), (S.name || 'dokument').replace(/\.pdf$/i, '') + '-obrazy.zip', 'zip');
  } catch (e) { toast('Nie udało się: ' + e.message, true); } finally { busy(false); }
}
// ---- ostatnie pliki (tylko w programie – przeglądarka nie zna ścieżek) ----
function addRecent(path, name) { if (!path) return; try { let r = JSON.parse(localStorage.getItem('edytor:ostatnie') || '[]'); r = [{ path, name, t: Date.now() }, ...r.filter(x => x.path !== path)].slice(0, 8); localStorage.setItem('edytor:ostatnie', JSON.stringify(r)); } catch (e) {} showRecent(); }
function showRecent() { const box = $('#recent'); box.innerHTML = ''; if (!DESK) return; let r = []; try { r = JSON.parse(localStorage.getItem('edytor:ostatnie') || '[]'); } catch (e) {} if (!r.length) return; box.append(el('b', {}, 'Ostatnio otwierane')); for (const x of r) box.append(el('a', { title: x.path, onclick: () => openPath(x.path) }, x.name)); }
// ---- przeciąganie plików na okno ----
document.addEventListener('dragover', e => { e.preventDefault(); docEl.classList.add('dropping'); });
document.addEventListener('dragleave', e => { if (!e.relatedTarget) docEl.classList.remove('dropping'); });
document.addEventListener('drop', async e => {
  e.preventDefault(); docEl.classList.remove('dropping'); const files = [...(e.dataTransfer.files || [])]; if (!files.length) return;
  const pdfs = files.filter(f => /\.pdf$/i.test(f.name) || f.type === 'application/pdf'), imgs = files.filter(f => /^image\/(png|jpeg)$/.test(f.type));
  if (pdfs.length) {
    const f = pdfs[0]; const path = DESK && DESK.pathOf ? DESK.pathOf(f) : null;
    if (S.lib) { const r = await dialog({ title: 'Plik PDF', body: `<div>Co zrobić z plikiem <b>${esc(f.name)}</b>?</div>`, buttons: [{ label: 'Anuluj', value: null }, { label: 'Wstaw jego strony', value: 'ins' }, { label: 'Otwórz', go: true, value: 'open' }] }); if (r === 'ins') return insertFromPdf(new Uint8Array(await f.arrayBuffer()), f.name); if (r !== 'open') return; if (!(await maybeSaveFirst())) return; }
    await openBytes(new Uint8Array(await f.arrayBuffer()), f.name, path);
  } else if (imgs.length) { if (S.lib) { for (const f of imgs) await placeImage(S.cur, 40, 40, f); } else await fromImages(imgs); }
  else toast('Obsługiwane są pliki PDF oraz obrazy PNG i JPG.', true);
});
window.addEventListener('beforeunload', e => { if (S.dirty && !DESK) { e.preventDefault(); e.returnValue = ''; } });

