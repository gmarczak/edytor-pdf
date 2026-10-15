/* ============ UI ============ */
// Interfejs: menu, narzędzia, obsługa myszy na stronach, skróty klawiszowe, podpis, pomoc, start programu.
const TOOL_HINT = { select: 'Zaznacz: kliknij obiekt, żeby go przesunąć lub zmienić; dwuklik na tekście – edycja.', hand: 'Łapka: przeciągaj, żeby przewijać dokument.', edittext: 'Edytuj tekst: najedź na wiersz i kliknij, żeby zmienić istniejący tekst.', text: 'Dodaj tekst: kliknij albo przeciągnij ramkę na stronie i wpisz tekst.', image: 'Obraz: kliknij na stronie, żeby wybrać plik PNG/JPG.', sig: 'Podpis: kliknij w miejscu podpisu – narysuj go, wpisz albo wczytaj obraz.', hl: 'Zakreśl: zaznacz tekst myszą.', ul: 'Podkreśl: zaznacz tekst myszą.', st: 'Przekreśl: zaznacz tekst myszą.', note: 'Komentarz: kliknij na stronie, żeby dodać notatkę.', draw: 'Rysuj: przeciągaj myszą po stronie.', rect: 'Prostokąt: przeciągnij ramkę.', ellipse: 'Elipsa: przeciągnij ramkę.', line: 'Linia: przeciągnij od początku do końca.', arrow: 'Strzałka: przeciągnij od początku do grotu.', white: 'Wymaż: przeciągnij ramkę – obszar zostanie zakryty białym prostokątem.', redact: 'Zaczernij: przeciągnij ramkę – tekst pod spodem zostanie usunięty z pliku, a obszar zaczerniony.', field: 'Pole formularza: przeciągnij ramkę pola tekstowego.', check: 'Pole wyboru: kliknij albo przeciągnij ramkę.', link: 'Łącze: przeciągnij ramkę obszaru, który ma być klikalny.' };
const TOOL_NAME = { select: 'Zaznacz', hand: 'Łapka', edittext: 'Edytuj tekst', text: 'Dodaj tekst', image: 'Obraz', sig: 'Podpis', hl: 'Zakreśl', ul: 'Podkreśl', st: 'Przekreśl', note: 'Komentarz', draw: 'Rysuj', rect: 'Prostokąt', ellipse: 'Elipsa', line: 'Linia', arrow: 'Strzałka', white: 'Wymaż', redact: 'Zaczernij', field: 'Pole', check: 'Checkbox', link: 'Łącze' };
function setTool(t) {
  finishEdit(false); S.tool = t; $$('#tools button.t').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === t ? 'true' : 'false'));
  const hint = (TOOL_HINT[t] || '').replace(/^[^:]+:\s*/, ''); $('#stTool').innerHTML = '<b>' + esc(TOOL_NAME[t] || t) + '</b> — ' + esc(hint);
  if (t !== 'select') selectObj(null, null); applyToolClass(); showProps();
  if (t === 'edittext') for (let i = 0; i < S.pages.length; i++) if (S.pages[i].rendered) showTextBoxes(i); else hideTextBoxes();
  if (t !== 'edittext') hideTextBoxes();
}
function applyToolClass() {
  docEl.classList.toggle('hand', S.tool === 'hand'); docEl.classList.toggle('drawing', ['draw', 'rect', 'ellipse', 'line', 'arrow', 'white', 'redact', 'field', 'check', 'link', 'text'].includes(S.tool));
  const markup = ['hl', 'ul', 'st'].includes(S.tool);
  for (const p of S.pages) { p.el.classList.toggle('edit-text', S.tool === 'edittext'); p.ov.style.pointerEvents = (S.tool === 'edittext' || markup) ? 'none' : ''; p.tl.style.pointerEvents = markup ? 'auto' : 'none'; p.tl.style.userSelect = markup ? 'text' : 'none'; p.tl.style.opacity = markup ? '1' : '.25'; p.tl.style.color = markup ? 'transparent' : ''; }
}
$$('#tools button.t').forEach(b => b.onclick = () => setTool(b.dataset.tool));
// mysz na stronach: rysowanie / zaznaczanie / łapka
pagesEl.addEventListener('mousedown', e => {
  const pageEl = e.target.closest('.page'); if (!pageEl) return; const i = +pageEl.dataset.i;
  if (S.tool === 'hand' || (e.button === 1)) { e.preventDefault(); const sx = e.clientX, sy = e.clientY, st = docEl.scrollTop, sl = docEl.scrollLeft; docEl.classList.add('dragging'); const mv = ev => { docEl.scrollTop = st - (ev.clientY - sy); docEl.scrollLeft = sl - (ev.clientX - sx); }; const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); docEl.classList.remove('dragging'); }; window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up); return; }
  if (e.button !== 0) return;
  if (editing) { finishEdit(false); }
  if (e.target.closest('.ob') || e.target.closest('.tx') || e.target.closest('.inl')) return;
  pageMouseDown(e, i);
});
pagesEl.addEventListener('mouseup', e => { if (!['hl', 'ul', 'st'].includes(S.tool)) return; const pageEl = e.target.closest('.page'); if (!pageEl) return; setTimeout(() => markupFromSelection(+pageEl.dataset.i), 10); });
pagesEl.addEventListener('contextmenu', e => { const ob = e.target.closest('.ob'); if (!ob) return; e.preventDefault(); const i = +ob.closest('.page').dataset.i; selectObj(i, ob.dataset.id); showMenu('mEdycja', e.clientX, e.clientY); });
// ---- menu ----
function showMenu(id, x, y) { closeMenus(); const m = $('#' + id); m.classList.add('open'); m.style.left = Math.min(x, window.innerWidth - m.offsetWidth - 8) + 'px'; m.style.top = y + 'px'; const b = $(`[data-menu="${id}"]`); if (b) b.setAttribute('aria-expanded', 'true'); }
function closeMenus() { $$('.menu.open').forEach(m => m.classList.remove('open')); $$('[data-menu]').forEach(b => b.setAttribute('aria-expanded', 'false')); }
$$('.top nav button[data-menu]').forEach(b => { b.onclick = e => { e.stopPropagation(); const r = b.getBoundingClientRect(); if ($('#' + b.dataset.menu).classList.contains('open')) closeMenus(); else showMenu(b.dataset.menu, r.left, r.bottom + 2); }; b.onmouseenter = () => { if ($('.menu.open')) { const r = b.getBoundingClientRect(); showMenu(b.dataset.menu, r.left, r.bottom + 2); } }; });
document.addEventListener('mousedown', e => { if (!e.target.closest('.menu') && !e.target.closest('[data-menu]')) closeMenus(); });
$$('.menu button[data-cmd]').forEach(b => b.onclick = () => { closeMenus(); runCmd(b.dataset.cmd); });
$('#bUndo').onclick = undo; $('#bRedo').onclick = redo; $('#bSave').onclick = () => saveFile(false);
$('#bOpenW').onclick = openFile; $('#bNewW').onclick = newDoc; $('#bImgW').onclick = () => fromImages();
$$('.side .tabs button').forEach(b => b.onclick = () => { $$('.side .tabs button').forEach(x => x.setAttribute('aria-selected', x === b ? 'true' : 'false')); $$('.side .pane').forEach(p => p.hidden = p.id !== b.dataset.pane); });
// przyciski paneli w pasku narzędzi i zamykanie panelu właściwości
$('#bSide').onclick = () => runCmd('toggleSide'); $('#bProps').onclick = () => runCmd('toggleProps'); $('#bPropsClose').onclick = () => showInspector(false);
const needDoc = () => { if (!S.lib) { toast('Najpierw otwórz dokument.'); return false; } return true; };
async function runCmd(c) {
  const D = needDoc;
  switch (c) {
    case 'open': return openFile(); case 'new': return newDoc(); case 'fromImages': return fromImages();
    case 'save': return D() && saveFile(false); case 'saveAs': return D() && saveFile(true); case 'exportPng': return D() && exportPng(); case 'print': return D() && printDoc();
    case 'props': return D() && docProps(); case 'close': return D() && closeDoc();
    case 'undo': return undo(); case 'redo': return redo(); case 'delete': return deleteSel(); case 'duplicate': return duplicateSel();
    case 'selectAllText': { if (!D()) return; const p = S.pages[S.cur]; const r = document.createRange(); r.selectNodeContents(p.tl); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); return; }
    case 'copyText': { const s = window.getSelection(); const t = s ? s.toString() : ''; if (t) { await navigator.clipboard.writeText(t); toast('Skopiowano tekst'); } else toast('Najpierw zaznacz tekst (narzędzie Zakreśl pozwala zaznaczać).'); return; }
    case 'apply': return D() && applyObjects();
    case 'find': $('#search').focus(); $('#search').select(); return;
    case 'zoomIn': return setZoom(Math.min(6, S.zoom * 1.25)); case 'zoomOut': return setZoom(Math.max(0.2, S.zoom / 1.25)); case 'fitw': return setZoom('fitw'); case 'fitp': return setZoom('fitp');
    case 'toggleSide': { const on = !$('#side').classList.contains('on'); $('#side').classList.toggle('on', on); $('#bSide').setAttribute('aria-pressed', on ? 'true' : 'false'); if (S.zoomMode !== 'fixed' && S.js) buildPages(true); return; }
    case 'toggleProps': { if ($('#props').classList.contains('on')) showInspector(false); else { showProps(); if (!$('#props').classList.contains('on')) { showInspector(true); setProps('<h3>Właściwości</h3><p class="ep-note">Zaznacz obiekt na stronie albo wybierz narzędzie, żeby zobaczyć jego ustawienia.</p>'); } } return; }
    case 'rotL': return D() && rotatePages(-90); case 'rotR': return D() && rotatePages(90); case 'delPage': return D() && deletePages(); case 'dupPage': return D() && duplicatePages();
    case 'insBlank': return D() && insertBlank();
    case 'insPdf': { if (!D()) return; if (DESK) { const p = await DESK.openDialog(PDF_FILTER); if (p) await insertFromPdf(new Uint8Array(await DESK.readFile(p)), p.split(/[\\/]/).pop()); } else { const f = $('#fPdf2'); f.value = ''; f.onchange = async () => { const file = f.files[0]; if (file) await insertFromPdf(new Uint8Array(await file.arrayBuffer()), file.name); }; f.click(); } return; }
    case 'extract': return D() && extractPages(); case 'split': return D() && splitDoc(); case 'crop': return D() && cropPages(); case 'resize': return D() && resizePages();
    case 'pageNumbers': return D() && pageNumbers(); case 'watermark': return D() && watermark(); case 'headerFooter': return D() && headerFooter();
    case 'flatten': return D() && flattenForm(); case 'removeAnnots': return D() && removeAnnots(); case 'extractText': return D() && extractText(); case 'extractImages': return D() && extractImages();
    case 'help': return showHelp(); case 'shortcuts': return showShortcuts(); case 'about': return showAbout();
  }
}
// ---- skróty klawiszowe ----
document.addEventListener('keydown', e => {
  const inField = e.target.matches('input,textarea,select,[contenteditable="true"]') || e.target.isContentEditable;
  const k = e.key.toLowerCase(); const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && k === 'o') { e.preventDefault(); return openFile(); }
  if (ctrl && k === 's') { e.preventDefault(); return S.lib && saveFile(e.shiftKey); }
  if (ctrl && k === 'p') { e.preventDefault(); return S.lib && printDoc(); }
  if (ctrl && k === 'f') { e.preventDefault(); return runCmd('find'); }
  if (ctrl && (k === '=' || k === '+')) { e.preventDefault(); return runCmd('zoomIn'); }
  if (ctrl && k === '-') { e.preventDefault(); return runCmd('zoomOut'); }
  if (ctrl && k === '0') { e.preventDefault(); return setZoom('fitw'); }
  if (e.key === 'F4') { e.preventDefault(); return runCmd('toggleSide'); }
  if (inField) return;
  if (ctrl && k === 'z') { e.preventDefault(); return e.shiftKey ? redo() : undo(); }
  if (ctrl && k === 'y') { e.preventDefault(); return redo(); }
  if (ctrl && k === 'd') { e.preventDefault(); return duplicateSel(); }
  if (ctrl && k === 'a') { e.preventDefault(); return runCmd('selectAllText'); }
  if (ctrl && k === 'c') { const s = window.getSelection(); if (s && s.toString()) return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { if (S.sel) { e.preventDefault(); deleteSel(); } return; }
  if (e.key === 'Escape') { if (S.sel) selectObj(null, null); else setTool('select'); closeMenus(); return; }
  if (ctrl) return;
  const map = { v: 'select', h: 'hand', t: 'edittext', n: 'text', i: 'image', r: 'rect', e: 'ellipse', l: 'line', d: 'draw', k: 'note', w: 'white' };
  if (map[k]) { setTool(map[k]); return; }
  if (e.key === 'PageDown' || (e.key === 'ArrowRight' && !S.sel)) { setCurrentPage(S.cur + 1, true); } if (e.key === 'PageUp' || (e.key === 'ArrowLeft' && !S.sel)) { setCurrentPage(S.cur - 1, true); }
  if (e.key === 'Home' && !S.sel) setCurrentPage(0, true); if (e.key === 'End' && !S.sel) setCurrentPage(S.pages.length - 1, true);
  if (S.sel && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault(); const o = findObj(S.sel.page, S.sel.id); if (!o || o.rects) return; const d = e.shiftKey ? 10 : 1; snapshot(); if (e.key === 'ArrowLeft') o.x -= d; if (e.key === 'ArrowRight') o.x += d; if (e.key === 'ArrowUp') o.y -= d; if (e.key === 'ArrowDown') o.y += d; renderObjs(S.sel.page); showProps(); }
});
// ---- podpis: rysowany, wpisany albo z obrazu ----
async function signatureDialog(i, x, y) {
  const b = el('div'); let mode = 'draw'; let imgFile = null;
  const tabs = el('div', { class: 'tabs' }); const panes = {};
  const canvas = el('canvas', { class: 'sig', width: 600, height: 200 }); const ctx = canvas.getContext('2d'); ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1a237e'; let drawing = false, last = null, drawn = false;
  const pos = ev => { const r = canvas.getBoundingClientRect(); return [(ev.clientX - r.left) * canvas.width / r.width, (ev.clientY - r.top) * canvas.height / r.height]; };
  canvas.onpointerdown = ev => { drawing = true; last = pos(ev); canvas.setPointerCapture(ev.pointerId); }; canvas.onpointermove = ev => { if (!drawing) return; const p = pos(ev); ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); last = p; drawn = true; }; canvas.onpointerup = () => { drawing = false; };
  panes.draw = el('div', {}, canvas, el('div', { class: 'row' }, el('button', { onclick: () => { ctx.clearRect(0, 0, 600, 200); drawn = false; } }, 'Wyczyść'), el('label', { style: 'margin:0;display:flex;align-items:center;gap:6px' }, 'Kolor ', el('input', { type: 'color', value: '#1a237e', style: 'width:60px', oninput: ev => ctx.strokeStyle = ev.target.value }))));
  const typed = el('input', { placeholder: 'Imię i nazwisko', style: 'font-family:"Liberation Serif";font-style:italic;font-size:32px' });
  panes.type = el('div', {}, el('label', {}, 'Wpisz podpis (zostanie zapisany pochyłą czcionką Liberation Serif)'), typed);
  const fin = el('input', { type: 'file', accept: 'image/png,image/jpeg' }); fin.onchange = () => { imgFile = fin.files[0] || null; };
  panes.img = el('div', {}, el('label', {}, 'Obraz podpisu (PNG z przezroczystym tłem wygląda najlepiej)'), fin);
  for (const [k, lab] of [['draw', 'Narysuj'], ['type', 'Wpisz'], ['img', 'Z obrazu']]) tabs.append(el('button', { class: k === 'draw' ? 'on' : '', onclick: ev => { mode = k; $$('button', tabs).forEach(t => t.classList.toggle('on', t === ev.target)); for (const q in panes) panes[q].style.display = q === k ? '' : 'none'; } }, lab));
  b.append(tabs, panes.draw, panes.type, panes.img); panes.type.style.display = 'none'; panes.img.style.display = 'none';
  const r = await dialog({ title: 'Podpis', body: b, buttons: [{ label: 'Anuluj', value: null }, { label: 'Wstaw podpis', go: true, value: true }] });
  if (!r) return;
  if (mode === 'draw') { if (!drawn) return toast('Nic nie narysowano.'); const t = trimCanvas(canvas); const src = t.toDataURL('image/png'); const w = Math.min(t.width * 0.4, 220); addObj(i, { type: 'image', x: x - w / 2, y: y - (w * t.height / t.width) / 2, w, h: w * t.height / t.width, src, fmt: 'png', opacity: 1, sig: true }); }
  else if (mode === 'type') { const t = typed.value.trim(); if (!t) return; addObj(i, { type: 'text', x: x - 80, y: y - 14, w: Math.max(160, t.length * 14), h: 36, text: t, fam: 'Serif', size: 24, bold: false, italic: true, color: '#1a237e', align: 'left', opacity: 1, autoH: true }); }
  else if (mode === 'img') { if (!imgFile) return toast('Nie wybrano obrazu.'); await placeImage(i, x - 90, y - 40, imgFile, 180); }
}
function trimCanvas(c) { const ctx = c.getContext('2d'); const d = ctx.getImageData(0, 0, c.width, c.height).data; let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0; for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } if (x1 < x0) return c; const o = el('canvas', { width: x1 - x0 + 9, height: y1 - y0 + 9 }); o.getContext('2d').drawImage(c, x0 - 4, y0 - 4, x1 - x0 + 9, y1 - y0 + 9, 0, 0, x1 - x0 + 9, y1 - y0 + 9); return o; }
// ---- pomoc ----
function showHelp() { return alertBox('Jak używać edytora', `<div style="line-height:1.6;font-size:14px">
<p><b>Edycja istniejącego tekstu</b> – narzędzie „Edytuj tekst” (T): kliknij wiersz, popraw go i naciśnij Enter. Jeśli czcionka z pliku ma potrzebne znaki, tekst zostaje zapisany tą samą czcionką w tym samym miejscu. Gdy nie ma (np. polskie znaki w czcionce bez nich) albo zmieniasz rozmiar/kolor, stary napis jest usuwany z pliku, a nowy rysowany czcionką Liberation dobraną do oryginału. Pusty tekst usuwa wiersz.</p>
<p><b>Nowe elementy</b> – tekst, obrazy, podpis, kształty, rysunek, komentarze, wymazania, pola formularza i łącza leżą na stronie jako obiekty: można je przesuwać, zmieniać w panelu po prawej i usuwać (Del). Do pliku trafiają przy zapisie („Zapisz”) albo przez „Edycja → Wtop obiekty w dokument”.</p>
<p><b>Zakreślanie</b> – wybierz „Zakreśl”, „Podkreśl” albo „Przekreśl” i zaznacz tekst myszą. W panelu można dopisać komentarz do zaznaczenia – w pliku będzie to zwykła adnotacja, którą zobaczy też Adobe Reader.</p>
<p><b>Zaczernianie</b> – „Zaczernij” usuwa tekst pod ramką z treści pliku (nie da się go odzyskać ani skopiować) i zakrywa obszar czernią. Obrazy pod spodem zostają zakryte, ale nie są usuwane z pliku.</p>
<p><b>Strony</b> – panel po lewej: kliknij miniaturę, przeciągnij, żeby zmienić kolejność, Ctrl+klik zaznacza kilka stron. Menu „Strony” obraca, usuwa, wstawia (puste albo z innego PDF), wyodrębnia, dzieli, przycina i zmienia rozmiar.</p>
<p><b>Formularze</b> – zakładka „Formularz” pokazuje pola z pliku i pozwala je wypełnić. „Narzędzia → Spłaszcz formularz” zamienia pola na stałą treść.</p>
<p><b>Narzędzia</b> – numeracja stron, znak wodny, nagłówek i stopka, wyodrębnianie tekstu i obrazów, usuwanie adnotacji. „Plik → PDF z obrazów” składa PDF ze zdjęć/skanów.</p>
<p><b>Ograniczenia</b> – dokumenty zabezpieczone hasłem trzeba najpierw odblokować w innym programie. Tekst w zeskanowanych obrazach (bez warstwy tekstowej) nie jest edytowalny – można go zakryć „Wymaż” i wpisać nowy.</p></div>`); }
function showShortcuts() { return alertBox('Skróty klawiszowe', `<div style="font-size:14px;line-height:1.9"><span class="kbd">Ctrl+O</span> otwórz · <span class="kbd">Ctrl+S</span> zapisz · <span class="kbd">Ctrl+Shift+S</span> zapisz jako · <span class="kbd">Ctrl+P</span> drukuj · <span class="kbd">Ctrl+F</span> szukaj<br><span class="kbd">Ctrl+Z</span> cofnij · <span class="kbd">Ctrl+Y</span> ponów · <span class="kbd">Ctrl+D</span> powiel obiekt · <span class="kbd">Del</span> usuń obiekt · <span class="kbd">strzałki</span> przesuń obiekt (z Shift o 10 pt)<br><span class="kbd">Ctrl +</span> / <span class="kbd">Ctrl −</span> / <span class="kbd">Ctrl+kółko</span> powiększenie · <span class="kbd">Ctrl+0</span> dopasuj szerokość · <span class="kbd">F4</span> panel stron<br><span class="kbd">V</span> zaznacz · <span class="kbd">H</span> łapka · <span class="kbd">T</span> edytuj tekst · <span class="kbd">N</span> nowy tekst · <span class="kbd">I</span> obraz · <span class="kbd">R</span> prostokąt · <span class="kbd">E</span> elipsa · <span class="kbd">L</span> linia · <span class="kbd">D</span> rysuj · <span class="kbd">K</span> komentarz · <span class="kbd">W</span> wymaż<br><span class="kbd">PageUp</span> / <span class="kbd">PageDown</span> strony · <span class="kbd">Esc</span> odznacz / narzędzie Zaznacz<br>W edycji tekstu: <span class="kbd">Enter</span> zapisz, <span class="kbd">Shift+Enter</span> nowy wiersz (nowe pole), <span class="kbd">Esc</span> anuluj</div>`); }
async function showAbout() { let v = ''; if (DESK) { try { const i = await DESK.appInfo(); v = 'wersja ' + i.version; } catch (e) {} } return alertBox('Edytor PDF', `<div style="font-size:14px;line-height:1.6"><p><b>Edytor PDF</b> ${esc(v)} – edycja tekstu, obrazów, adnotacji, formularzy i stron w plikach PDF. Wszystko dzieje się na Twoim komputerze – pliki nigdzie nie są wysyłane.</p><p>Autor: <a href="https://gmarczak.xyz" target="_blank">gmarczak</a> · aktualizacje: <a href="https://aktualizacje.gmarczak.xyz" target="_blank">aktualizacje.gmarczak.xyz</a></p><p class="m">Biblioteki: pdf-lib (MIT), pdf.js (Apache 2.0), fontkit (MIT), JSZip (MIT); czcionki Liberation (SIL OFL 1.1).</p></div>`); }
// ---- start ----
(async function init() {
  if (window.EdytorPDF) { EdytorPDF.initTheme(); EdytorPDF.wire($('#appActions')); EdytorPDF.wire($('#mWidok')); }
  setTool('select'); updateUndoButtons(); showRecent();
  if (DESK) {
    if (DESK.onOpenFile) DESK.onOpenFile(async p => { if (await maybeSaveFirst()) openPath(p); });
    try { const p = DESK.argvFile && await DESK.argvFile(); if (p) await openPath(p); } catch (e) {}
    setInterval(() => { try { DESK.setDirty && DESK.setDirty(!!(S.lib && S.dirty)); } catch (e) {} }, 1000);
    document.querySelectorAll('a[target=_blank]').forEach(a => a.onclick = ev => { ev.preventDefault(); DESK.openExternal(a.href); });
  }
})();

