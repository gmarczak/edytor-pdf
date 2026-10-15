// Obiekty na stronie (warstwa edycji): nowy tekst, obrazy, podpisy, kształty, rysunki, zakreślenia, komentarze,
// wymazania, zaczernienia, pola formularza, łącza. Leżą nad stroną, można je przesuwać i zmieniać;
// do pliku PDF trafiają przy zapisie („wtopienie”). Współrzędne: punkty od lewego górnego rogu strony (tak, jak widać).
const Z = () => S.zoom;
function objsOf(i) { return S.objs[i] || (S.objs[i] = []); }
function findObj(i, id) { return objsOf(i).find(o => o.id === id); }
function addObj(i, o) { o.id = o.id || uid(); objsOf(i).push(o); snapshot(); renderObjs(i); selectObj(i, o.id); return o; }
function removeObj(i, id) { const a = objsOf(i); const k = a.findIndex(o => o.id === id); if (k >= 0) { snapshot(); a.splice(k, 1); } if (S.sel && S.sel.id === id) S.sel = null; renderObjs(i); showProps(); }
function selectObj(i, id) { S.sel = id ? { page: i, id } : null; for (const p of S.pages) $$('.ob', p.ov).forEach(e => e.classList.toggle('sel', !!S.sel && e.dataset.id === S.sel.id)); showProps(); }
function renderAllObjs() { for (let i = 0; i < S.pages.length; i++) renderObjs(i); }
const SVGNS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
// shapeSvg – rysunek kształtu/linii/rysunku jako SVG (ten sam wygląd, co potem w PDF)
function shapeSvg(o, z) {
  const svg = svgEl('svg', { viewBox: `0 0 ${Math.max(o.w, 1)} ${Math.max(o.h, 1)}`, preserveAspectRatio: 'none' });
  const st = { fill: o.fill && o.fill !== 'none' ? o.fill : 'none', stroke: o.stroke, 'stroke-width': o.width, opacity: o.opacity ?? 1, 'vector-effect': 'non-scaling-stroke', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  if (o.type === 'rect') svg.append(svgEl('rect', { x: o.width / 2, y: o.width / 2, width: Math.max(o.w - o.width, 0), height: Math.max(o.h - o.width, 0), ...st }));
  if (o.type === 'ellipse') svg.append(svgEl('ellipse', { cx: o.w / 2, cy: o.h / 2, rx: Math.max(o.w / 2 - o.width / 2, 0), ry: Math.max(o.h / 2 - o.width / 2, 0), ...st }));
  if (o.type === 'line' || o.type === 'arrow') {
    const [x1, y1, x2, y2] = linePts(o); svg.setAttribute('viewBox', `0 0 ${Math.max(o.w, 1)} ${Math.max(o.h, 1)}`);
    svg.append(svgEl('line', { x1, y1, x2, y2, ...st, fill: 'none' }));
    if (o.type === 'arrow') { const a = Math.atan2(y2 - y1, x2 - x1), L = 4 * o.width + 6; const p = [[x2, y2], [x2 - L * Math.cos(a - 0.45), y2 - L * Math.sin(a - 0.45)], [x2 - L * Math.cos(a + 0.45), y2 - L * Math.sin(a + 0.45)]]; svg.append(svgEl('polygon', { points: p.map(q => q.join(',')).join(' '), fill: o.stroke, opacity: o.opacity ?? 1 })); }
  }
  if (o.type === 'ink') for (const path of o.paths) svg.append(svgEl('path', { d: path.map((q, k) => (k ? 'L' : 'M') + q[0] + ' ' + q[1]).join(' '), ...st, fill: 'none' }));
  return svg;
}
// linePts – końce linii wewnątrz jej ramki (flip mówi, czy linia idzie z lewego-dolnego do prawego-górnego)
const linePts = o => o.flip ? [0, o.h, o.w, 0] : [0, 0, o.w, o.h];
const NOTE_SVG = c => `<svg viewBox="0 0 24 24"><path d="M3 4h18v12H9l-5 4v-4H3z" fill="${c}" stroke="#333" stroke-width="1.2" stroke-linejoin="round"/><path d="M7 8h10M7 11h7" stroke="#333" stroke-width="1.2"/></svg>`;
// renderObjs – odtwarza elementy DOM obiektów strony
function renderObjs(i) {
  const p = S.pages[i]; if (!p) return; const z = Z(); p.ov.innerHTML = '';
  for (const o of objsOf(i)) {
    const d = el('div', { class: 'ob ' + o.type + (S.sel && S.sel.id === o.id ? ' sel' : ''), 'data-id': o.id });
    if (o.type === 'hl' || o.type === 'ul' || o.type === 'st') {
      // zakreślenia: kilka prostokątów (po jednym na fragment wiersza); ramka = otoczka
      const xs = o.rects.map(r => r.x), ys = o.rects.map(r => r.y), xe = o.rects.map(r => r.x + r.w), ye = o.rects.map(r => r.y + r.h);
      o.x = Math.min(...xs); o.y = Math.min(...ys); o.w = Math.max(...xe) - o.x; o.h = Math.max(...ye) - o.y;
      d.style.cssText = `left:${o.x * z}px;top:${o.y * z}px;width:${o.w * z}px;height:${o.h * z}px`;
      for (const r of o.rects) { const s = el('div', { style: `position:absolute;left:${(r.x - o.x) * z}px;top:${(r.y - o.y) * z}px;width:${r.w * z}px;height:${r.h * z}px;` + (o.type === 'hl' ? `background:${o.color};opacity:.45;mix-blend-mode:multiply` : o.type === 'ul' ? `border-bottom:${Math.max(1, r.h * 0.07 * z)}px solid ${o.color}` : `background:linear-gradient(transparent 50%,${o.color} 50%,${o.color} calc(50% + ${Math.max(1, r.h * 0.07 * z)}px),transparent 0)`) }); d.append(s); }
    } else if (o.type === 'note') {
      d.style.cssText = `left:${o.x * z}px;top:${o.y * z}px;width:${22 * z}px;height:${22 * z}px`; d.innerHTML = NOTE_SVG(o.color || '#ffd54f'); d.title = o.text || '';
      d.ondblclick = e => { e.stopPropagation(); editNote(i, o); };
    } else {
      d.style.cssText = `left:${o.x * z}px;top:${o.y * z}px;width:${o.w * z}px;height:${o.h * z}px;opacity:${o.type === 'text' || o.type === 'image' ? (o.opacity ?? 1) : 1}`;
      if (o.type === 'text') { const ed = el('div', { class: 'ed', style: `font-family:${FONT_CSS[o.fam]};font-size:${o.size * z}px;font-weight:${o.bold ? 700 : 400};font-style:${o.italic ? 'italic' : 'normal'};color:${o.color};text-align:${o.align};line-height:1.2` }); ed.textContent = o.text; d.append(ed); d.ondblclick = e => { e.stopPropagation(); editTextObj(i, o, d); }; }
      else if (o.type === 'image') { d.append(el('img', { src: o.src, draggable: 'false' })); }
      else if (o.type === 'white') { d.style.background = o.color || '#fff'; d.style.outline = S.sel && S.sel.id === o.id ? '' : '1px dashed #bbb'; }
      else if (o.type === 'redact') { d.style.background = '#000'; }
      else if (o.type === 'field') { d.append(el('div', { style: `padding:0 3px;font:${Math.max(8, Math.min(o.h * 0.7, 12)) * z}px "Liberation Sans";line-height:${o.h * z}px;overflow:hidden;white-space:nowrap;color:#123` }, o.value || '')); d.title = 'Pole: ' + o.name; }
      else if (o.type === 'check') { d.classList.add('field'); d.title = 'Pole wyboru: ' + o.name; if (o.checked) d.style.background = '#9dbbd9'; }
      else if (o.type === 'link') { d.style.cssText += ';border:1px dashed #1f5f99;background:#1f5f9911'; d.title = o.url; }
      else d.append(shapeSvg(o, z));
      if (o.rot) d.style.transform = `rotate(${o.rot}deg)`;
    }
    for (const h of ['nw', 'ne', 'sw', 'se', 'e', 'w']) if (!(o.type === 'note' || o.type === 'hl' || o.type === 'ul' || o.type === 'st')) d.append(el('div', { class: 'h ' + h, 'data-h': h }));
    d.onmousedown = e => objMouseDown(e, i, o, d);
    p.ov.append(d);
  }
}
// ---- mysz: zaznaczanie, przesuwanie, zmiana rozmiaru obiektów ----
function objMouseDown(e, i, o, d) {
  if (S.busy) return;
  if (S.tool !== 'select' && S.tool !== o.type && !(S.tool === 'sig' && o.type === 'image')) return;
  if (e.target.classList.contains('ed') && d.classList.contains('sel') && e.target.isContentEditable) return;
  e.stopPropagation(); e.preventDefault(); selectObj(i, o.id);
  if (o.type === 'hl' || o.type === 'ul' || o.type === 'st') return;
  const h = e.target.dataset.h; const z = Z(); const sx = e.clientX, sy = e.clientY; const o0 = { x: o.x, y: o.y, w: o.w, h: o.h };
  const p = S.pages[i]; const minS = 4; let moved = false;
  const mv = ev => {
    const dx = (ev.clientX - sx) / z, dy = (ev.clientY - sy) / z; if (Math.abs(dx) + Math.abs(dy) > 0.5) moved = true;
    if (!h) { o.x = clamp(o0.x + dx, -o.w + 10, p.w / z - 10); o.y = clamp(o0.y + dy, -o.h + 10, p.h / z - 10); }
    else {
      const keep = (o.type === 'image' && !ev.shiftKey) ? o0.w / o0.h : 0;
      let x = o0.x, y = o0.y, w = o0.w, hh = o0.h;
      if (h.includes('e')) w = Math.max(minS, o0.w + dx); if (h.includes('w')) { w = Math.max(minS, o0.w - dx); x = o0.x + o0.w - w; }
      if (h.includes('s')) hh = Math.max(minS, o0.h + dy); if (h.includes('n')) { hh = Math.max(minS, o0.h - dy); y = o0.y + o0.h - hh; }
      if (keep) { hh = w / keep; if (h.includes('n')) y = o0.y + o0.h - hh; }
      if (o.type === 'ink') { const kx = w / o0.w, ky = hh / o0.h; o.paths = o.paths.map(pa => pa.map(q => [q[0] * kx, q[1] * ky])); o0.w = w; o0.h = hh; }
      o.x = x; o.y = y; o.w = w; o.h = hh;
      if (o.type === 'text' && h) { o.autoH = false; }
    }
    d.style.left = o.x * z + 'px'; d.style.top = o.y * z + 'px'; d.style.width = o.w * z + 'px'; d.style.height = o.h * z + 'px';
    if (h && (o.type === 'rect' || o.type === 'ellipse' || o.type === 'line' || o.type === 'arrow' || o.type === 'ink')) { const s = d.querySelector('svg'); if (s) s.replaceWith(shapeSvg(o, z)); }
  };
  const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); if (moved) { const a = objsOf(i); const k = a.indexOf(o); const now = { ...o }; Object.assign(o, o0); if (o.type === 'ink') o.paths = now.paths; snapshot(); Object.assign(o, now); renderObjs(i); showProps(); } };
  window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
}
// ---- rysowanie nowych obiektów na stronie ----
let drawState = null;
function pageMouseDown(e, i) {
  if (S.busy) return;
  const p = S.pages[i]; const z = Z(); const r = p.el.getBoundingClientRect();
  const x = (e.clientX - r.left) / z, y = (e.clientY - r.top) / z; const t = S.tool;
  if (t === 'select' || t === 'hand' || t === 'edittext') { if (t === 'select') selectObj(i, null); return; }
  if (t === 'hl' || t === 'ul' || t === 'st') return;   // zaznaczanie tekstu – obsłużone po puszczeniu myszy
  e.preventDefault();
  if (t === 'image') { e.preventDefault(); pickImage(i, x, y); return; }
  if (t === 'sig') { signatureDialog(i, x, y); return; }
  if (t === 'note') { addObj(i, { type: 'note', x: x - 11, y: y - 11, text: '', color: '#ffd54f', author: '' }); editNote(i, objsOf(i)[objsOf(i).length - 1]); return; }
  const rub = el('div', { class: 'rub' }); p.ov.append(rub);
  drawState = { i, x0: x, y0: y, rub, pts: [[x, y]], moved: false, svg: null };
  if (t === 'draw') { rub.remove(); drawState.rub = null; drawState.svg = svgEl('svg', { style: 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none' }); drawState.path = svgEl('path', { fill: 'none', stroke: S.style.stroke, 'stroke-width': S.style.width * z, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: S.style.opacity }); drawState.svg.append(drawState.path); p.ov.append(drawState.svg); }
  const mv = ev => {
    const cx = clamp((ev.clientX - r.left) / z, 0, p.w / z), cy = clamp((ev.clientY - r.top) / z, 0, p.h / z); drawState.moved = true;
    if (t === 'draw') { drawState.pts.push([cx, cy]); drawState.path.setAttribute('d', drawState.pts.map((q, k) => (k ? 'L' : 'M') + q[0] * z + ' ' + q[1] * z).join(' ')); return; }
    const bx = Math.min(cx, drawState.x0), by = Math.min(cy, drawState.y0); drawState.cx = cx; drawState.cy = cy;
    rub.style.cssText = `left:${bx * z}px;top:${by * z}px;width:${Math.abs(cx - drawState.x0) * z}px;height:${Math.abs(cy - drawState.y0) * z}px`;
  };
  const up = ev => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); finishDraw(ev); };
  window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
}
async function finishDraw() {
  const d = drawState; drawState = null; if (!d) return; const t = S.tool; const i = d.i; const st = S.style;
  if (d.rub) d.rub.remove(); if (d.svg) d.svg.remove();
  if (t === 'draw') { if (d.pts.length < 2) return; const xs = d.pts.map(q => q[0]), ys = d.pts.map(q => q[1]); const x = Math.min(...xs), y = Math.min(...ys); addObj(i, { type: 'ink', x, y, w: Math.max(1, Math.max(...xs) - x), h: Math.max(1, Math.max(...ys) - y), paths: [d.pts.map(q => [q[0] - x, q[1] - y])], stroke: st.stroke, width: st.width, opacity: st.opacity }); return; }
  let x = Math.min(d.x0, d.cx ?? d.x0), y = Math.min(d.y0, d.cy ?? d.y0), w = Math.abs((d.cx ?? d.x0) - d.x0), h = Math.abs((d.cy ?? d.y0) - d.y0);
  if (t === 'text') { if (w < 20) { w = 220; } if (h < 10) h = st.size * 1.6; const o = addObj(i, { type: 'text', x, y, w, h, text: '', fam: st.font, size: st.size, bold: st.bold, italic: st.italic, color: st.color, align: st.align, opacity: 1, autoH: true }); const dEl = $(`.ob[data-id="${o.id}"]`, S.pages[i].ov); editTextObj(i, o, dEl); return; }
  if (w < 3 && h < 3) { if (t === 'field') { w = 160; h = 22; } else if (t === 'check') { w = 16; h = 16; } else return; }
  if (t === 'rect' || t === 'ellipse') addObj(i, { type: t, x, y, w, h, stroke: st.stroke, fill: st.fill, width: st.width, opacity: st.opacity });
  if (t === 'line' || t === 'arrow') { const flip = ((d.cx ?? d.x0) - d.x0) * ((d.cy ?? d.y0) - d.y0) < 0; addObj(i, { type: t, x, y, w: Math.max(w, 1), h: Math.max(h, 1), flip, stroke: st.stroke, width: st.width, opacity: st.opacity }); }
  if (t === 'white') addObj(i, { type: 'white', x, y, w, h, color: '#ffffff' });
  if (t === 'redact') addObj(i, { type: 'redact', x, y, w, h });
  if (t === 'field') { const n = await ask('Nowe pole tekstowe', [{ id: 'name', label: 'Nazwa pola', value: 'pole' + (objsOf(i).filter(o => o.type === 'field').length + 1) }, { id: 'value', label: 'Wartość początkowa', value: '' }]); if (n) addObj(i, { type: 'field', x, y, w, h, name: n.name || 'pole', value: n.value }); }
  if (t === 'check') { const n = await ask('Nowe pole wyboru', [{ id: 'name', label: 'Nazwa pola', value: 'wybor' + (objsOf(i).filter(o => o.type === 'check').length + 1) }, { id: 'checked', label: 'Zaznaczone', type: 'checkbox', value: false }]); if (n) addObj(i, { type: 'check', x, y, w: Math.max(w, 8), h: Math.max(h, 8), name: n.name || 'wybor', checked: n.checked }); }
  if (t === 'link') { const n = await ask('Łącze', [{ id: 'url', label: 'Adres (np. https://…)', value: 'https://' }]); if (n && n.url) addObj(i, { type: 'link', x, y, w, h, url: n.url }); }
}
// zakreślenia z zaznaczenia tekstu (warstwa tekstu pdf.js) – po puszczeniu myszy
function markupFromSelection(i) {
  const sel = window.getSelection(); if (!sel || sel.isCollapsed || !sel.rangeCount) return;
  const p = S.pages[i]; const pr = p.el.getBoundingClientRect(); const z = Z(); const rects = [];
  for (let k = 0; k < sel.rangeCount; k++) for (const r of sel.getRangeAt(k).getClientRects()) {
    if (r.width < 1 || r.height < 1) continue; const x = (r.left - pr.left) / z, y = (r.top - pr.top) / z; if (x < -2 || y < -2 || x > p.w / z + 2 || y > p.h / z + 2) continue;
    rects.push({ x, y, w: r.width / z, h: r.height / z });
  }
  if (!rects.length) return;
  // scal prostokąty tego samego wiersza
  rects.sort((a, b) => a.y - b.y || a.x - b.x); const merged = [];
  for (const r of rects) { const m = merged[merged.length - 1]; if (m && Math.abs(m.y - r.y) < 2 && r.x <= m.x + m.w + 3) { const xe = Math.max(m.x + m.w, r.x + r.w); m.w = xe - m.x; m.h = Math.max(m.h, r.h); } else merged.push({ ...r }); }
  sel.removeAllRanges();
  addObj(i, { type: S.tool, rects: merged, color: S.tool === 'hl' ? S.style.hl : S.style.stroke, text: '' });
}
// edycja tekstu nowego pola tekstowego (w miejscu)
function editTextObj(i, o, d) {
  const ed = d.querySelector('.ed'); if (!ed) return; selectObj(i, o.id); ed.contentEditable = 'true'; ed.focus();
  if (!o.text) { ed.textContent = ''; }
  const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  const grow = () => { if (o.autoH !== false) { const need = ed.scrollHeight / Z(); if (need > o.h) { o.h = need; d.style.height = o.h * Z() + 'px'; } } };
  ed.oninput = grow;
  ed.onkeydown = e => { e.stopPropagation(); if (e.key === 'Escape') { ed.blur(); } };
  ed.onblur = () => { ed.contentEditable = 'false'; const t = ed.innerText.replace(/\n$/, ''); if (t !== o.text) { const old = o.text; o.text = old; snapshot(); o.text = t; } if (!o.text.trim()) { const a = objsOf(i); const k = a.indexOf(o); if (k >= 0) a.splice(k, 1); S.sel = null; } renderObjs(i); showProps(); };
}
async function editNote(i, o) {
  const r = await ask('Komentarz', [{ id: 'text', label: 'Treść', type: 'textarea', value: o.text }, { id: 'author', label: 'Autor', value: o.author || localStorage.getItem('edytor:autor') || '' }, { id: 'color', label: 'Kolor', type: 'color', value: o.color || '#ffd54f' }]);
  if (!r) { if (!o.text) removeObj(i, o.id); return; }
  if (!r.text.trim()) { removeObj(i, o.id); return; }
  snapshot(); o.text = r.text; o.author = r.author; o.color = r.color; try { localStorage.setItem('edytor:autor', r.author); } catch (e) {}
  renderObjs(i); updateCommentsPanel(); showProps();
}
// obraz z pliku -> obiekt na stronie (dopasowany do 1/3 szerokości strony)
function pickImage(i, x, y) { const f = $('#fImg'); f.value = ''; f.onchange = async () => { const file = f.files[0]; if (file) await placeImage(i, x, y, file); }; f.click(); }
async function placeImage(i, x, y, file, maxW) {
  const src = await fileToDataUrl(file); const img = await loadImg(src); const p = S.pages[i];
  const w = Math.min(img.naturalWidth * 0.75, maxW || p.w / Z() / 3), h = w * img.naturalHeight / img.naturalWidth;
  addObj(i, { type: 'image', x: x ?? 40, y: y ?? 40, w, h, src, fmt: /png/i.test(file.type) || /\.png$/i.test(file.name) ? 'png' : 'jpg', opacity: 1 });
}
const fileToDataUrl = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
const loadImg = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('Nie udało się wczytać obrazu')); im.src = src; });
// ---- panel właściwości zaznaczonego obiektu ----
function showProps() {
  const pr = $('#props');
  if (editing) return;
  if (!S.sel) { if (S.tool === 'edittext') { showEditPanel(); return; } if (['rect', 'ellipse', 'line', 'arrow', 'draw', 'text', 'hl'].includes(S.tool)) { styleProps(); return; } pr.classList.remove('on'); pr.innerHTML = ''; return; }
  const i = S.sel.page, o = findObj(i, S.sel.id); if (!o) { pr.classList.remove('on'); return; }
  pr.classList.add('on');
  const names = { text: 'Pole tekstowe', image: 'Obraz', rect: 'Prostokąt', ellipse: 'Elipsa', line: 'Linia', arrow: 'Strzałka', ink: 'Rysunek', hl: 'Zakreślenie', ul: 'Podkreślenie', st: 'Przekreślenie', note: 'Komentarz', white: 'Wymazanie', redact: 'Zaczernienie', field: 'Pole formularza', check: 'Pole wyboru', link: 'Łącze' };
  let h = `<h3>${names[o.type] || o.type}</h3>`;
  const num = (id, label, v, step) => `<label>${label}</label><input type="number" id="${id}" value="${Math.round(v * 10) / 10}" step="${step || 1}">`;
  if (o.type === 'text') h += `<label>Czcionka</label><select id="pFam"><option value="Sans">Liberation Sans (Arial)</option><option value="Serif">Liberation Serif (Times)</option><option value="Mono">Liberation Mono (Courier)</option></select>${num('pSize', 'Rozmiar (pt)', o.size, 0.5)}<label>Kolor</label><input type="color" id="pColor" value="${o.color}"><div class="row"><button id="pB" class="${o.bold ? 'on' : ''}"><b>B</b></button><button id="pI" class="${o.italic ? 'on' : ''}"><i>I</i></button></div><label>Wyrównanie</label><select id="pAlign"><option value="left">Do lewej</option><option value="center">Do środka</option><option value="right">Do prawej</option></select>`;
  if (o.type === 'rect' || o.type === 'ellipse' || o.type === 'line' || o.type === 'arrow' || o.type === 'ink') h += `<label>Kolor linii</label><input type="color" id="pStroke" value="${o.stroke}">${num('pWidth', 'Grubość (pt)', o.width, 0.5)}` + (o.type === 'rect' || o.type === 'ellipse' ? `<label>Wypełnienie</label><div class="row"><input type="color" id="pFill" value="${o.fill && o.fill !== 'none' ? o.fill : '#ffffff'}"><button id="pNoFill" class="${!o.fill || o.fill === 'none' ? 'on' : ''}">bez</button></div>` : '');
  if (o.type === 'image' || o.type === 'rect' || o.type === 'ellipse' || o.type === 'line' || o.type === 'arrow' || o.type === 'ink' || o.type === 'text') h += num('pOpacity', 'Krycie (0–1)', o.opacity ?? 1, 0.1);
  if (o.type === 'hl' || o.type === 'ul' || o.type === 'st') h += `<label>Kolor</label><input type="color" id="pColor" value="${o.color}"><label>Komentarz do zaznaczenia</label><textarea id="pText">${esc(o.text || '')}</textarea>`;
  if (o.type === 'note') h += `<label>Treść</label><textarea id="pText">${esc(o.text)}</textarea><label>Autor</label><input id="pAuthor" value="${esc(o.author || '')}"><label>Kolor</label><input type="color" id="pColor" value="${o.color}">`;
  if (o.type === 'white') h += `<label>Kolor</label><input type="color" id="pColor" value="${o.color || '#ffffff'}">`;
  if (o.type === 'field') h += `<label>Nazwa pola</label><input id="pName" value="${esc(o.name)}"><label>Wartość</label><input id="pValue" value="${esc(o.value || '')}">`;
  if (o.type === 'check') h += `<label>Nazwa pola</label><input id="pName" value="${esc(o.name)}"><label><input type="checkbox" id="pChecked" ${o.checked ? 'checked' : ''} style="width:auto"> zaznaczone</label>`;
  if (o.type === 'link') h += `<label>Adres</label><input id="pUrl" value="${esc(o.url)}">`;
  if (o.type !== 'note' && o.type !== 'hl' && o.type !== 'ul' && o.type !== 'st') h += `<div class="row">${num('pX', 'X (pt)', o.x)}${num('pY', 'Y (pt)', o.y)}</div><div class="row">${num('pW', 'Szerokość', o.w)}${num('pH', 'Wysokość', o.h)}</div>`;
  if (o.type === 'image') h += num('pRot', 'Obrót (°)', o.rot || 0, 90);
  h += `<button id="pDup">Powiel (Ctrl+D)</button><button id="pBurn">Wtop w dokument</button><button class="x" id="pDel">Usuń (Del)</button>`;
  pr.innerHTML = h;
  const bind = (id, fn, ev) => { const e = $('#' + id, pr); if (e) e.addEventListener(ev || 'change', () => { snapshot(); fn(e); renderObjs(i); if (ev !== 'input') showProps(); }); };
  if (o.type === 'text') { $('#pFam').value = o.fam; $('#pAlign').value = o.align; bind('pFam', e => o.fam = e.value); bind('pSize', e => o.size = +e.value || o.size); bind('pColor', e => o.color = e.value, 'input'); bind('pAlign', e => o.align = e.value); $('#pB').onclick = () => { snapshot(); o.bold = !o.bold; renderObjs(i); showProps(); }; $('#pI').onclick = () => { snapshot(); o.italic = !o.italic; renderObjs(i); showProps(); }; }
  bind('pStroke', e => o.stroke = e.value, 'input'); bind('pWidth', e => o.width = +e.value || 1); bind('pFill', e => o.fill = e.value, 'input'); if ($('#pNoFill', pr)) $('#pNoFill').onclick = () => { snapshot(); o.fill = 'none'; renderObjs(i); showProps(); };
  bind('pOpacity', e => o.opacity = clamp(+e.value, 0, 1)); bind('pColor', e => o.color = e.value, 'input'); bind('pText', e => o.text = e.value); bind('pAuthor', e => o.author = e.value);
  bind('pName', e => o.name = e.value); bind('pValue', e => o.value = e.value); bind('pChecked', e => o.checked = e.checked); bind('pUrl', e => o.url = e.value);
  bind('pX', e => o.x = +e.value); bind('pY', e => o.y = +e.value); bind('pW', e => o.w = Math.max(2, +e.value)); bind('pH', e => o.h = Math.max(2, +e.value)); bind('pRot', e => o.rot = ((+e.value % 360) + 360) % 360);
  $('#pDel').onclick = () => removeObj(i, o.id);
  $('#pDup').onclick = () => duplicateSel();
  $('#pBurn').onclick = () => applyObjects([i]);
  if (o.type === 'note' || o.type === 'hl') updateCommentsPanel();
}
// panel stylu dla narzędzi rysowania (przed narysowaniem)
function styleProps() {
  const pr = $('#props'); const st = S.style; pr.classList.add('on');
  const t = S.tool;
  pr.innerHTML = `<h3>Styl nowych obiektów</h3>` + (t === 'text' ? `<label>Czcionka</label><select id="sFam"><option value="Sans">Liberation Sans (Arial)</option><option value="Serif">Liberation Serif (Times)</option><option value="Mono">Liberation Mono (Courier)</option></select><label>Rozmiar (pt)</label><input type="number" id="sSize" value="${st.size}" step="0.5"><label>Kolor</label><input type="color" id="sColor" value="${st.color}"><div class="row"><button id="sB" class="${st.bold ? 'on' : ''}"><b>B</b></button><button id="sI" class="${st.italic ? 'on' : ''}"><i>I</i></button></div><div class="m" style="font-size:12px;margin-top:8px">Kliknij na stronie albo przeciągnij ramkę, a potem wpisz tekst.</div>` :
    t === 'hl' ? `<label>Kolor zakreślenia</label><input type="color" id="sHl" value="${st.hl}"><div class="m" style="font-size:12px;margin-top:8px">Zaznacz tekst na stronie myszą.</div>` :
    `<label>Kolor linii</label><input type="color" id="sStroke" value="${st.stroke}"><label>Grubość (pt)</label><input type="number" id="sWidth" value="${st.width}" step="0.5" min="0.5">` + (t === 'rect' || t === 'ellipse' ? `<label>Wypełnienie</label><div class="row"><input type="color" id="sFill" value="${st.fill !== 'none' ? st.fill : '#ffffff'}"><button id="sNoFill" class="${st.fill === 'none' ? 'on' : ''}">bez</button></div>` : '') + `<label>Krycie (0–1)</label><input type="number" id="sOpacity" value="${st.opacity}" step="0.1" min="0" max="1">`);
  const b = (id, fn, ev) => { const e = $('#' + id, pr); if (e) e.addEventListener(ev || 'change', () => fn(e)); };
  if ($('#sFam', pr)) $('#sFam').value = st.font;
  b('sFam', e => st.font = e.value); b('sSize', e => st.size = +e.value || 12); b('sColor', e => st.color = e.value, 'input'); b('sHl', e => st.hl = e.value, 'input');
  b('sStroke', e => st.stroke = e.value, 'input'); b('sWidth', e => st.width = +e.value || 1); b('sFill', e => { st.fill = e.value; $('#sNoFill').classList.remove('on'); }, 'input'); b('sOpacity', e => st.opacity = clamp(+e.value, 0, 1));
  if ($('#sNoFill', pr)) $('#sNoFill').onclick = () => { st.fill = 'none'; styleProps(); };
  if ($('#sB', pr)) $('#sB').onclick = () => { st.bold = !st.bold; styleProps(); }; if ($('#sI', pr)) $('#sI').onclick = () => { st.italic = !st.italic; styleProps(); };
}
function duplicateSel() { if (!S.sel) return; const i = S.sel.page, o = findObj(i, S.sel.id); if (!o || o.type === 'hl' || o.type === 'ul' || o.type === 'st') return; const c = JSON.parse(JSON.stringify(o)); c.id = uid(); c.x += 12; c.y += 12; if (c.name) c.name += '_2'; addObj(i, c); }
function deleteSel() { if (!S.sel) return; removeObj(S.sel.page, S.sel.id); }
// ---- panel komentarzy ----
function updateCommentsPanel() {
  const box = $('#pComments'); box.innerHTML = ''; let n = 0;
  for (let i = 0; i < S.pages.length; i++) for (const o of objsOf(i)) if ((o.type === 'note' || o.type === 'hl' || o.type === 'ul' || o.type === 'st') && (o.text || o.type === 'note')) {
    n++; const c = el('div', { class: 'com' }, el('b', {}, `str. ${i + 1} · ${o.type === 'note' ? 'komentarz' : 'zaznaczenie'}${o.author ? ' · ' + o.author : ''}`), document.createTextNode(o.text || '(bez treści)'));
    c.onclick = () => { setCurrentPage(i, true); selectObj(i, o.id); }; box.append(c);
  }
  // komentarze już zapisane w pliku
  if (S.annots && S.annots.length) for (const a of S.annots) { n++; const c = el('div', { class: 'com' }, el('b', {}, `str. ${a.page + 1} · ${a.kind}${a.author ? ' · ' + a.author : ''} (w pliku)`), document.createTextNode(a.text || '(bez treści)')); c.onclick = () => setCurrentPage(a.page, true); box.append(c); }
  if (!n) box.innerHTML = '<div style="font-size:12px;color:var(--mut)">Brak komentarzy. Użyj narzędzia „Komentarz” albo „Zakreśl”.</div>';
}
