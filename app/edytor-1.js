/* ============ PODSTAWY ============ */
// Edytor PDF – podstawy: biblioteki, stan programu, pomocnicze funkcje, okna dialogowe, cofanie.
'use strict';
const { PDFDocument, PDFName, PDFArray, PDFDict, PDFStream, PDFRawStream, PDFHexString, PDFString, PDFNumber, PDFRef, PDFBool,
        rgb, degrees, StandardFonts, decodePDFRawStream, PDFContentStream, PDFOperator, PDFOperatorNames, BlendMode, LineCapStyle,
        pushGraphicsState, popGraphicsState, setFillingColor, setStrokingColor, setLineWidth, rectangle, fill, stroke, fillAndStroke,
        moveTo, lineTo, closePath, appendBezierCurve, setGraphicsState, concatTransformationMatrix, setLineCap, setLineJoin, LineJoinStyle } = PDFLib;
// pdf.js: worker ze wstawionego tekstu (lib/pdf.worker.js), żeby program działał z dysku i bez internetu
pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([window.__PDFW], { type: 'text/javascript' }));
if (window.pdfjsLib && !pdfjsLib.OPS.showSpacedText) pdfjsLib.OPS.showSpacedText = 45;

// ---- stan programu ----
const S = {
  bytes: null,        // bajty bieżącego dokumentu (to, co trafi do pliku) – Uint8Array
  lib: null,          // dokument w pdf-lib (do zmian)
  js: null,           // dokument w pdf.js (do wyświetlania)
  pages: [],          // [{el, canvas, vp, w, h, rendered, tl, ov, items}] po jednej na stronę
  zoom: 1, zoomMode: 'fitw',
  tool: 'select',
  objs: {},           // obiekty warstwy (jeszcze nie wtopione w PDF): numer strony -> [obiekt]
  sel: null,          // zaznaczony obiekt {page, id}
  undo: [], redo: [],
  name: '', path: null, dirty: false,
  cur: 0,             // bieżąca strona (0-based)
  fonts: {},          // osadzone czcionki Liberation w pdf-lib: 'Sans:700:italic' -> PDFFont
  fontData: {},       // bajty plików czcionek Liberation
  textCache: {},      // analiza tekstu stron: numer strony -> {items, ops}
  lastId: 0,
  style: { font: 'Sans', size: 12, bold: false, italic: false, color: '#000000', stroke: '#d32f2f', fill: 'none', width: 2, opacity: 1, hl: '#ffeb3b', align: 'left' }
};
const DESK = window.desktop || null;   // most do systemu w programie (Electron); w przeglądarce null

// ---- pomocnicze ----
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const el = (tag, attrs, ...kids) => { const e = document.createElement(tag); for (const k in attrs || {}) { if (k === 'style') e.style.cssText = attrs[k]; else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]); else if (k === 'html') e.innerHTML = attrs[k]; else e.setAttribute(k, attrs[k]); } for (const c of kids) if (c != null) e.append(c); return e; };
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const uid = () => 'o' + (++S.lastId) + '_' + Date.now().toString(36);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hex2rgb = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return [0, 0, 0]; const n = parseInt(m[1], 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const rgb2hex = (r, g, b) => '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('');
const RGB = h => { const [r, g, b] = hex2rgb(h); return rgb(r, g, b); };
let toastT = null;
function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.className = 'toast on' + (err ? ' err' : ''); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), err ? 6000 : 2800); }
function status(t) { $('#stInfo').textContent = t || ''; }
function busy(on, t) { S.busy = !!on; document.body.style.cursor = on ? 'progress' : ''; $('#stRight').textContent = on ? (t || 'Pracuję…') : ''; }

// dialog – ogólne okno: tytuł, treść (HTML lub element), przyciski; zwraca wartość klikniętego przycisku
function dialog({ title, body, buttons, wide, onOpen }) {
  return new Promise(res => {
    const ov = el('div', { class: 'ov' }); const box = el('div', { class: 'box' }); if (wide) box.style.width = 'min(900px,100%)';
    box.append(el('h3', {}, title)); const b = el('div', { class: 'b' }); if (typeof body === 'string') b.innerHTML = body; else if (body) b.append(body); box.append(b);
    const f = el('div', { class: 'f' });
    for (const bt of buttons || [{ label: 'OK', go: true, value: true }]) f.append(el('button', { class: (bt.go ? 'go' : '') + (bt.x ? ' x' : ''), onclick: async () => { if (bt.onClick) { const r = await bt.onClick(b); if (r === false) return; } ov.remove(); res(bt.value === undefined ? bt.label : bt.value); } }, bt.label));
    box.append(f); ov.append(box); document.body.append(ov);
    ov.addEventListener('keydown', e => { if (e.key === 'Escape') { ov.remove(); res(null); } e.stopPropagation(); });
    const first = b.querySelector('input,select,textarea'); if (first) first.focus(); else f.lastChild.focus();
    if (onOpen) onOpen(b, ov);
  });
}
// ask – okno z polami: fields = [{id, label, type, value, options, hint}]; zwraca obiekt wartości albo null
async function ask(title, fields, okLabel) {
  const b = el('div');
  for (const f of fields) {
    if (f.type === 'info') { b.append(el('div', { class: 'm', html: f.html })); continue; }
    b.append(el('label', {}, f.label));
    let inp;
    if (f.type === 'select') { inp = el('select', { id: 'q_' + f.id }); for (const o of f.options) inp.append(el('option', { value: o[0] }, o[1])); inp.value = f.value; }
    else if (f.type === 'textarea') { inp = el('textarea', { id: 'q_' + f.id }); inp.value = f.value || ''; }
    else if (f.type === 'checkbox') { inp = el('input', { id: 'q_' + f.id, type: 'checkbox', style: 'width:auto' }); inp.checked = !!f.value; }
    else { inp = el('input', { id: 'q_' + f.id, type: f.type || 'text' }); inp.value = f.value ?? ''; if (f.min != null) inp.min = f.min; if (f.max != null) inp.max = f.max; if (f.step != null) inp.step = f.step; if (f.placeholder) inp.placeholder = f.placeholder; }
    b.append(inp); if (f.hint) b.append(el('div', { class: 'm' }, f.hint));
  }
  const r = await dialog({ title, body: b, buttons: [{ label: 'Anuluj', value: null }, { label: okLabel || 'OK', go: true, value: true }] });
  if (!r) return null;
  const out = {}; for (const f of fields) { if (f.type === 'info') continue; const i = $('#q_' + f.id, b); out[f.id] = f.type === 'checkbox' ? i.checked : (f.type === 'number' ? Number(i.value) : i.value); }
  return out;
}
const confirmBox = (title, text) => dialog({ title, body: `<div>${esc(text)}</div>`, buttons: [{ label: 'Anuluj', value: false }, { label: 'Tak', go: true, value: true }] });
const alertBox = (title, html) => dialog({ title, body: html, buttons: [{ label: 'Zamknij', value: true }] });

// ---- cofanie: każda zmiana dokumentu to nowy zestaw bajtów + kopia listy obiektów ----
const cloneObjs = () => JSON.parse(JSON.stringify(S.objs));
function snapshot() { S.undo.push({ bytes: S.bytes, objs: cloneObjs(), cur: S.cur }); if (S.undo.length > 40) S.undo.shift(); S.redo = []; S.dirty = true; updateUndoButtons(); }
function updateUndoButtons() {
  if (DESK && DESK.setDirty) { try { DESK.setDirty(!!(S.lib && S.dirty)); } catch (e) {} }
  $('#bUndo').disabled = !S.undo.length; $('#bRedo').disabled = !S.redo.length; $('#bSave').disabled = !S.lib;
  $('#fileName').textContent = S.lib ? (S.name || 'bez nazwy') : '';
  // stan zapisu słowem obok nazwy pliku: „Zapisano” albo kropka i „Niezapisane zmiany”
  const ds = $('#docState'); ds.hidden = !S.lib; ds.className = 'ep-docstate' + (S.dirty ? ' ep-docstate--dirty' : '');
  ds.innerHTML = S.dirty ? 'Niezapisane zmiany' : '<svg class="ep-icon" aria-hidden="true"><use href="#i-check"/></svg>Zapisano';
  document.title = (S.lib ? (S.name || 'bez nazwy') + (S.dirty ? ' • ' : ' – ') : '') + 'Edytor PDF';
}
// panel właściwości: treść z kodu („<h3>Tytuł</h3>…”) trafia do nagłówka i ciała panelu
function setProps(html, icon) {
  const m = /^\s*<h3>(.*?)<\/h3>/.exec(html); $('#propsTitle').textContent = m ? m[1].replace(/<[^>]+>/g, '') : 'Właściwości';
  $('#propsBody').innerHTML = m ? html.slice(m[0].length) : html;
  $('#propsIcon').innerHTML = `<use href="#${icon || 'i-settings'}"/>`;
}
function showInspector(on) { $('#props').classList.toggle('on', !!on); $('#bProps').setAttribute('aria-pressed', on ? 'true' : 'false'); if (!on) { $('#propsBody').innerHTML = ''; } }
async function undo() { if (!S.undo.length) return; const st = S.undo.pop(); S.redo.push({ bytes: S.bytes, objs: cloneObjs(), cur: S.cur }); await restoreState(st); toast('Cofnięto'); }
async function redo() { if (!S.redo.length) return; const st = S.redo.pop(); S.undo.push({ bytes: S.bytes, objs: cloneObjs(), cur: S.cur }); await restoreState(st); toast('Ponowiono'); }
async function restoreState(st) { S.objs = st.objs; S.sel = null; if (st.bytes !== S.bytes) await loadBytes(st.bytes, { keepObjs: true, keepUndo: true }); else { renderAllObjs(); } S.dirty = true; updateUndoButtons(); }

// ---- czcionki Liberation (dla nowego tekstu): plik -> bajty, osadzenie w pdf-lib ----
const FONT_FILES = { Sans: 'LiberationSans', Serif: 'LiberationSerif', Mono: 'LiberationMono' };
const FONT_CSS = { Sans: '"Liberation Sans",Arial,sans-serif', Serif: '"Liberation Serif","Times New Roman",serif', Mono: '"Liberation Mono","Courier New",monospace' };
// loadLocal – bajty pliku programu (czcionki, qpdf.wasm): w programie przez most do dysku (strona jest z file://), w przeglądarce przez fetch
let appDirP = null;
async function loadLocal(rel) {
  if (DESK) { if (!appDirP) appDirP = DESK.appInfo().then(i => i.appDir); const dir = await appDirP; return new Uint8Array(await DESK.readFile(dir + DESK.sep + rel.split('/').join(DESK.sep))); }
  const r = await fetch(rel); if (!r.ok) throw new Error('Brak pliku ' + rel); return new Uint8Array(await r.arrayBuffer());
}
async function fontBytes(fam, bold, italic) {
  const key = FONT_FILES[fam] + '-' + (bold && italic ? 'BoldItalic' : bold ? 'Bold' : italic ? 'Italic' : 'Regular');
  if (!S.fontData[key]) S.fontData[key] = await loadLocal('czcionki/' + key + '.ttf');
  return S.fontData[key];
}
// decryptPdf – zdejmuje zabezpieczenie (qpdf w WASM); pw = hasło użytkownika (puste, gdy plik ma tylko hasło właściciela)
let qpdfP = null;
async function decryptPdf(bytes, pw) {
  if (!qpdfP) qpdfP = window.createQpdf({ locateFile: f => new URL('lib/' + f, location.href).href, print: () => {}, printErr: t => { qpdfErr += t + '\n'; } });
  const q = await qpdfP; qpdfErr = '';
  try { q.FS.unlink('/in.pdf'); } catch (e) {} try { q.FS.unlink('/out.pdf'); } catch (e) {}
  q.FS.writeFile('/in.pdf', bytes);
  let code = 0; try { code = q.callMain(['--decrypt', '--password=' + (pw || ''), '/in.pdf', '/out.pdf']); } catch (e) { code = typeof e === 'number' ? e : (e && e.status) || 2; }
  let out = null; try { out = q.FS.readFile('/out.pdf'); } catch (e) {}
  if (!out || !out.length || code === 2) throw new Error(/password/i.test(qpdfErr) ? 'BAD_PASSWORD' : ('qpdf: ' + (qpdfErr.trim() || 'kod ' + code)));
  return out;
}
let qpdfErr = '';
async function libFont(fam, bold, italic) {
  const key = fam + ':' + (bold ? 1 : 0) + ':' + (italic ? 1 : 0);
  if (!S.fonts[key]) { if (!S.lib.__fontkit) { S.lib.registerFontkit(window.fontkit); S.lib.__fontkit = true; } S.fonts[key] = await S.lib.embedFont(await fontBytes(fam, bold, italic), { subset: true }); }
  return S.fonts[key];
}
// łamanie tekstu na wiersze o zadanej szerokości (w punktach), szerokość mierzy czcionka pdf-lib
function wrapText(font, text, size, width) {
  const out = [];
  for (const para of String(text).replace(/\r/g, '').split('\n')) {
    const words = para.split(' '); let line = '';
    for (const w of words) {
      const cand = line ? line + ' ' + w : w;
      if (font.widthOfTextAtSize(cand, size) <= width || !line) {
        if (font.widthOfTextAtSize(cand, size) > width && !line) { // bardzo długie słowo – tnij po znakach
          let cur = ''; for (const ch of w) { if (font.widthOfTextAtSize(cur + ch, size) > width && cur) { out.push(cur); cur = ch; } else cur += ch; } line = cur;
        } else line = cand;
      } else { out.push(line); line = w; }
    }
    out.push(line);
  }
  return out;
}
// tekst bez znaków, których nie ma w czcionce (żeby pdf-lib nie przerwał zapisu)
function safeText(font, text) { let out = ''; for (const ch of String(text)) { try { font.encodeText(ch); out += ch; } catch (e) { out += '?'; } } return out; }

