/* ============ WIDOK ============ */
// Widok dokumentu: wczytanie, strony, rysowanie (pdf.js), warstwa tekstu, miniatury, powiększenie, nawigacja, szukanie.
const docEl = $('#doc'), pagesEl = $('#pages');
let renderObserver = null;

// loadBytes – wczytuje dokument z bajtów do pdf-lib (zmiany) i pdf.js (widok) i buduje strony
async function loadBytes(bytes, o) {
  o = o || {};
  busy(true, 'Wczytuję dokument…');
  try {
    if (S.js) { try { await S.js.destroy(); } catch (e) {} S.js = null; }
    let lib = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false });
    if (lib.isEncrypted) {
      // plik zaszyfrowany: zwykle tylko hasłem właściciela (zakaz kopiowania/zmian) – zdejmujemy je; gdy jest hasło otwarcia – pytamy
      busy(true, 'Zdejmuję zabezpieczenie pliku…'); let pw = '';
      for (let k = 0; k < 4; k++) {
        try { bytes = await decryptPdf(bytes, pw); break; }
        catch (e) {
          if (e.message !== 'BAD_PASSWORD') throw new Error('Nie udało się zdjąć zabezpieczenia pliku: ' + e.message);
          const r = await ask(k ? 'Złe hasło – spróbuj ponownie' : 'Plik jest zabezpieczony hasłem', [{ id: 'pw', label: 'Hasło otwarcia dokumentu', type: 'password', value: '' }], 'Otwórz');
          if (!r) throw new Error('Nie podano hasła.'); pw = r.pw;
        }
      }
      lib = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false });
      if (lib.isEncrypted) throw new Error('Nie udało się zdjąć zabezpieczenia pliku.');
      toast('Zdjęto zabezpieczenie pliku (zapisany dokument nie będzie już chroniony).');
    }
    S.js = await pdfjsLib.getDocument({ data: bytes.slice(), fontExtraProperties: true, isEvalSupported: false }).promise;
    S.lib = lib; S.bytes = bytes; S.fonts = {}; S.textCache = {};
    if (!o.keepObjs) S.objs = {};
    if (!o.keepUndo) { S.undo = []; S.redo = []; S.dirty = false; }
    S.sel = null;
    $('#welcome').style.display = 'none';
    await buildPages();
    updateUndoButtons(); updateFormPanel(); updateCommentsPanel();
  } finally { busy(false); }
}
// commitDoc – po zmianie w pdf-lib: nowe bajty, odświeżenie widoku (pdf.js) i miniatur
async function commitDoc(label) {
  busy(true, label || 'Zapisuję zmiany…');
  try {
    const bytes = await S.lib.save({ useObjectStreams: false, updateFieldAppearances: false });
    if (S.js) { try { await S.js.destroy(); } catch (e) {} }
    S.js = await pdfjsLib.getDocument({ data: bytes.slice(), fontExtraProperties: true, isEvalSupported: false }).promise;
    S.bytes = bytes; S.textCache = {}; S.dirty = true;
    S.fonts = {};   // pdf-lib nie potrafi dopisać glifów do czcionki (subset) po zapisie – następny tekst osadzi czcionkę na nowo
    await buildPages(true);
    updateUndoButtons(); updateFormPanel(); updateCommentsPanel();
  } finally { busy(false); }
}

// buildPages – tworzy (albo odtwarza) kontenery stron; rysowane są tylko strony widoczne na ekranie
async function buildPages(keepScroll) {
  const scrollTop = docEl.scrollTop, scrollLeft = docEl.scrollLeft;
  if (renderObserver) renderObserver.disconnect();
  pagesEl.innerHTML = ''; S.pages = [];
  const n = S.js.numPages;
  $('#pageCount').textContent = '/ ' + n; $('#pageNo').max = n;
  const zoom = await effectiveZoom();
  for (let i = 0; i < n; i++) {
    const pg = await S.js.getPage(i + 1);
    const vp = pg.getViewport({ scale: zoom });
    const page = el('div', { class: 'page', 'data-i': i, style: `width:${vp.width}px;height:${vp.height}px` });
    const canvas = el('canvas', { class: 'pg', width: Math.round(vp.width), height: Math.round(vp.height), style: `width:${vp.width}px;height:${vp.height}px` });
    const tl = el('div', { class: 'tl' }), txl = el('div', { class: 'txl' }), ov = el('div', { class: 'lay' });
    page.append(canvas, tl, txl, ov);
    pagesEl.append(page);
    S.pages.push({ el: page, canvas, tl, txl, ov, vp, pg, w: vp.width, h: vp.height, rendered: false, rendering: null, items: null });
  }
  renderObserver = new IntersectionObserver(ents => { for (const e of ents) if (e.isIntersecting) renderPage(+e.target.dataset.i); }, { root: docEl, rootMargin: '400px 0px' });
  for (const p of S.pages) renderObserver.observe(p.el);
  renderAllObjs();
  buildThumbs();
  if (keepScroll) { docEl.scrollTop = scrollTop; docEl.scrollLeft = scrollLeft; }
  setCurrentPage(Math.min(S.cur, n - 1), !keepScroll);
  applyToolClass();
}
async function effectiveZoom() {
  if (S.zoomMode === 'fitw' || S.zoomMode === 'fitp') {
    const pg = await S.js.getPage(1); const vp = pg.getViewport({ scale: 1 });
    const avail = docEl.clientWidth - 48, availH = docEl.clientHeight - 48;
    S.zoom = S.zoomMode === 'fitw' ? avail / vp.width : Math.min(avail / vp.width, availH / vp.height);
    S.zoom = clamp(S.zoom, 0.2, 6);
  }
  return S.zoom;
}
// renderPage – rysuje stronę na canvasie i tworzy warstwę tekstu (do zaznaczania i szukania)
async function renderPage(i) {
  const p = S.pages[i]; if (!p || p.rendered || p.rendering) return;
  p.rendering = (async () => {
    p.el.classList.add('rendering');
    try {
      const ctx = p.canvas.getContext('2d');
      await p.pg.render({ canvasContext: ctx, viewport: p.vp }).promise;
      const tc = await p.pg.getTextContent();
      p.tl.innerHTML = ''; p.tl.style.setProperty('--scale-factor', p.vp.scale);
      await pdfjsLib.renderTextLayer({ textContentSource: tc, container: p.tl, viewport: p.vp, textDivs: [] }).promise;
      p.textContent = tc; p.rendered = true;
      if (S.tool === 'edittext') await showTextBoxes(i);
      if (S.search) markSearch(i);
    } catch (e) { if (!(e && e.name === 'RenderingCancelledException')) console.error(e); }
    finally { p.el.classList.remove('rendering'); p.rendering = null; }
  })();
  return p.rendering;
}
function pageAt(y) { for (let i = 0; i < S.pages.length; i++) { const p = S.pages[i]; if (p.el.offsetTop + p.h > y) return i; } return S.pages.length - 1; }
function setCurrentPage(i, scroll) {
  i = clamp(i, 0, S.pages.length - 1); S.cur = i; $('#pageNo').value = i + 1;
  $$('.thumb').forEach((t, k) => t.classList.toggle('cur', k === i));
  if (scroll && S.pages[i]) docEl.scrollTop = S.pages[i].el.offsetTop - 16;
}
docEl.addEventListener('scroll', () => { if (!S.pages.length) return; const i = pageAt(docEl.scrollTop + docEl.clientHeight / 3); if (i !== S.cur) setCurrentPage(i, false); });
$('#pageNo').addEventListener('change', e => setCurrentPage(+e.target.value - 1, true));
$('#bPrev').onclick = () => setCurrentPage(S.cur - 1, true);
$('#bNext').onclick = () => setCurrentPage(S.cur + 1, true);

// ---- powiększenie ----
async function setZoom(mode) {
  if (!S.js) return;
  if (mode === 'fitw' || mode === 'fitp') S.zoomMode = mode; else { S.zoomMode = 'fixed'; S.zoom = clamp(Number(mode), 0.2, 6); }
  const sel = $('#zoom'); sel.value = S.zoomMode === 'fixed' ? String([0.5, 0.75, 1, 1.25, 1.5, 2, 3].includes(S.zoom) ? S.zoom : '') : S.zoomMode;
  const frac = S.pages.length ? (docEl.scrollTop - S.pages[S.cur].el.offsetTop + 16) / S.pages[S.cur].h : 0;
  await buildPages(false);
  if (S.pages.length) docEl.scrollTop = S.pages[S.cur].el.offsetTop - 16 + frac * S.pages[S.cur].h;
  $('#stRight').textContent = Math.round(S.zoom * 100) + '%';
}
$('#zoom').addEventListener('change', e => setZoom(e.target.value));
$('#zIn').onclick = () => setZoom(Math.min(6, S.zoom * 1.25));
$('#zOut').onclick = () => setZoom(Math.max(0.2, S.zoom / 1.25));
docEl.addEventListener('wheel', e => { if (e.ctrlKey) { e.preventDefault(); setZoom(clamp(S.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), 0.2, 6)); } }, { passive: false });
let resizeT = null; window.addEventListener('resize', () => { if (S.zoomMode !== 'fixed' && S.js) { clearTimeout(resizeT); resizeT = setTimeout(() => buildPages(true), 200); } });

// ---- miniatury stron (panel boczny) z przeciąganiem (zmiana kolejności) ----
async function buildThumbs() {
  const box = $('#pThumbs'); box.innerHTML = '';
  for (let i = 0; i < S.pages.length; i++) {
    const t = el('div', { class: 'thumb' + (i === S.cur ? ' cur' : ''), draggable: 'true', 'data-i': i, title: 'Kliknij, żeby przejść; przeciągnij, żeby zmienić kolejność; Ctrl+klik – zaznacz kilka' });
    const c = el('canvas', { width: 150, height: Math.round(150 * S.pages[i].h / S.pages[i].w) });
    t.append(c, el('div', { class: 'n' }, String(i + 1)));
    t.onclick = e => { if (e.ctrlKey || e.metaKey) t.classList.toggle('sel'); else { $$('.thumb.sel').forEach(x => x.classList.remove('sel')); setCurrentPage(i, true); } };
    t.ondragstart = e => { e.dataTransfer.setData('text/plain', String(i)); t.classList.add('drag'); };
    t.ondragend = () => t.classList.remove('drag');
    t.ondragover = e => { e.preventDefault(); t.classList.add('over'); };
    t.ondragleave = () => t.classList.remove('over');
    t.ondrop = async e => { e.preventDefault(); t.classList.remove('over'); const from = +e.dataTransfer.getData('text/plain'); if (from !== i && !isNaN(from)) await movePage(from, i); };
    box.append(t);
  }
  // rysuj miniatury po kolei, w tle
  (async () => { for (let i = 0; i < S.pages.length; i++) { const c = box.children[i] && box.children[i].querySelector('canvas'); if (!c || !S.pages[i]) return; try { const vp = S.pages[i].pg.getViewport({ scale: 150 / S.pages[i].pg.getViewport({ scale: 1 }).width }); await S.pages[i].pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise; } catch (e) {} } })();
}
const selectedThumbPages = () => { const s = $$('.thumb.sel').map(t => +t.dataset.i); return s.length ? s.sort((a, b) => a - b) : [S.cur]; };

// ---- szukanie w tekście ----
$('#search').addEventListener('input', e => { S.search = e.target.value.trim().toLowerCase(); S.searchHits = []; for (let i = 0; i < S.pages.length; i++) if (S.pages[i].rendered) markSearch(i); updateSearchCount(); });
$('#search').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); nextHit(e.shiftKey ? -1 : 1); } if (e.key === 'Escape') { e.target.value = ''; e.target.dispatchEvent(new Event('input')); docEl.focus(); } });
function markSearch(i) {
  const p = S.pages[i]; const q = S.search;
  $$('.hit', p.tl).forEach(h => { const t = document.createTextNode(h.textContent); h.replaceWith(t); });
  p.tl.normalize();
  if (!q) return;
  for (const span of $$('span', p.tl)) {
    const txt = span.textContent; const low = txt.toLowerCase(); let k = low.indexOf(q); if (k < 0) continue;
    const frag = document.createDocumentFragment(); let last = 0;
    while (k >= 0) { frag.append(txt.slice(last, k)); frag.append(el('span', { class: 'hit' }, txt.slice(k, k + q.length))); last = k + q.length; k = low.indexOf(q, last); }
    frag.append(txt.slice(last)); span.textContent = ''; span.append(frag);
  }
}
async function updateSearchCount() {
  const q = S.search; const n = $('#searchN'); if (!q) { n.textContent = ''; return; }
  let count = 0; for (let i = 0; i < S.pages.length; i++) { const p = S.pages[i]; if (!p.textContent) p.textContent = await p.pg.getTextContent(); const t = p.textContent.items.map(x => x.str).join(' ').toLowerCase(); let k = -1; while ((k = t.indexOf(q, k + 1)) >= 0) count++; }
  n.textContent = count ? count + ' tras.' : 'brak';
}
async function nextHit(dir) {
  const q = S.search; if (!q) return;
  for (let step = 1; step <= S.pages.length; step++) {
    const i = (S.cur + dir * step + S.pages.length * 2) % S.pages.length; const p = S.pages[i];
    if (!p.textContent) p.textContent = await p.pg.getTextContent();
    if (p.textContent.items.some(x => x.str.toLowerCase().includes(q))) { setCurrentPage(i, true); await renderPage(i); const h = $('.hit', p.tl); if (h) h.scrollIntoView({ block: 'center' }); return; }
  }
}

