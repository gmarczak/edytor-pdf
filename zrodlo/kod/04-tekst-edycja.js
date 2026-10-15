// Edycja istniejącego tekstu: ramki na wierszach, pole edycji w miejscu napisu i zapis zmiany do pliku.
// Trzy sposoby zapisu (wybierany automatycznie):
//  A) podmiana napisu w strumieniu treści – ta sama czcionka, rozmiar i położenie (gdy czcionka ma potrzebne znaki),
//  B) usunięcie starego napisu ze strumienia i narysowanie nowego czcionką Liberation (dobraną do oryginału),
//  C) gdy napisu nie da się znaleźć w strumieniu (np. jest w obiekcie formularza) – zakrycie kolorem tła i nowy napis.
let editing = null;   // trwająca edycja: {line, page, el}

// groupLines – łączy napisy leżące na jednej linii bazowej (także w różnych czcionkach, np. pogrubione słowo
// w zdaniu) w jeden wiersz do edycji. Wiersz pamięta swoje fragmenty (frags) – każdy z własną czcionką i położeniem.
function groupLines(items) {
  const lines = [];
  for (const it of items) {
    if (it.mode === 3 || it.mode === 7 || !it.text.length) continue;   // niewidoczny tekst (np. warstwa OCR) pomijamy
    const d = [it.m[0] / it.scale, it.m[1] / it.scale], nrm = [-d[1], d[0]];
    const start = apply(it.m, 0, it.rise), end = apply(it.m, it.adv, it.rise);
    it.d = d; it.start = start; it.end = end; it.len = it.adv * it.scale;
    let line = null;
    for (const L of lines) {
      if (Math.abs(L.angle - it.angle) > 1) continue;
      const v = [start[0] - L.end[0], start[1] - L.end[1]]; const gap = v[0] * d[0] + v[1] * d[1], perp = Math.abs(v[0] * nrm[0] + v[1] * nrm[1]);
      const em = Math.max(it.sizePt, L.sizePt);
      if (perp < 0.3 * em && gap >= -0.3 * em && gap <= 1.5 * em) { line = L; break; }
    }
    if (!line) { line = { items: [], angle: it.angle, m: it.m, rise: it.rise, d, nrm, start, end, sizePt: it.sizePt, page: it.page }; lines.push(line); }
    line.items.push(it); line.end = end; line.sizePt = Math.max(line.sizePt, it.sizePt);
  }
  for (const L of lines) {
    // fragmenty w kolejności wzdłuż wiersza; tekst wiersza = fragmenty z odstępami tam, gdzie jest przerwa
    L.items.sort((a, b) => ((a.start[0] - L.start[0]) * L.d[0] + (a.start[1] - L.start[1]) * L.d[1]) - ((b.start[0] - L.start[0]) * L.d[0] + (b.start[1] - L.start[1]) * L.d[1]));
    L.start = L.items[0].start; L.m = L.items[0].m; L.rise = L.items[0].rise; L.font = L.items[0].font; L.fontName = L.items[0].fontName; L.color = L.items[0].color;
    L.text = ''; L.frags = [];
    for (let k = 0; k < L.items.length; k++) {
      const it = L.items[k]; let sep = '';
      if (k) { const pv = L.items[k - 1]; const gap = (it.start[0] - pv.end[0]) * L.d[0] + (it.start[1] - pv.end[1]) * L.d[1]; it.gapBefore = gap; if (gap > 0.22 * Math.min(it.sizePt, pv.sizePt) && !/\s$/.test(L.text) && !/^\s/.test(it.text)) sep = ' '; } else it.gapBefore = 0;
      L.text += sep; L.frags.push({ it, sep, from: L.text.length, to: L.text.length + it.text.length }); L.text += it.text;
    }
    const last = L.items[L.items.length - 1]; L.end = last.end;
    const total = ((L.end[0] - L.start[0]) * L.d[0] + (L.end[1] - L.start[1]) * L.d[1]);
    const asc = Math.max(...L.items.map(it => ((it.font && it.font.ascent) || 0.9) * it.sizePt)), desc = Math.min(...L.items.map(it => ((it.font && it.font.descent) || -0.22) * it.sizePt));
    const o = L.start; L.width = total; L.asc = asc; L.desc = desc;
    L.corners = [[0, desc], [total, desc], [total, asc], [0, asc]].map(([x, y]) => [o[0] + x * L.d[0] + y * L.nrm[0], o[1] + x * L.d[1] + y * L.nrm[1]]);
  }
  // kolejność czytania: od góry do dołu, od lewej do prawej (strona w pdf ma oś y w górę)
  lines.sort((a, b) => (Math.abs(a.start[1] - b.start[1]) > 0.5 * Math.min(a.sizePt, b.sizePt) ? b.start[1] - a.start[1] : a.start[0] - b.start[0]));
  return lines.filter(L => L.text.trim().length);
}
// screenBox – ramka wiersza w pikselach strony (lewy górny róg, szerokość, wysokość, obrót)
function screenBox(p, L) {
  const vp = p.vp; const pts = L.corners.map(c => vp.convertToViewportPoint(c[0], c[1]));
  const tl = pts[3], tr = pts[2], bl = pts[0];
  const w = Math.hypot(tr[0] - tl[0], tr[1] - tl[1]), h = Math.hypot(bl[0] - tl[0], bl[1] - tl[1]);
  const ang = Math.atan2(tr[1] - tl[1], tr[0] - tl[0]) * 180 / Math.PI;
  return { x: tl[0], y: tl[1], w, h, ang };
}
// showTextBoxes – rysuje ramki na wszystkich wierszach strony (narzędzie „Edytuj tekst”)
async function showTextBoxes(i) {
  const p = S.pages[i]; if (!p.rendered) return;
  p.txl.innerHTML = '';
  let an; try { an = await analyzePage(i); } catch (e) { console.error(e); return; }
  p.lines = groupLines(an.items);
  for (const L of p.lines) {
    const b = screenBox(p, L); const editable = L.items.every(it => it.rawOp) || true;
    const d = el('div', { class: 'tx' + (editable ? '' : ' off'), style: `left:${b.x}px;top:${b.y}px;width:${Math.max(b.w, 4)}px;height:${Math.max(b.h, 4)}px;transform:rotate(${b.ang}deg)`, title: 'Kliknij, żeby edytować: ' + (L.font && L.font.name || '').replace(/^[A-Z]{6}\\+/, '') + ' ' + Math.round(L.items[0].sizePt * 10) / 10 + ' pt' });
    // klik = edycja wiersza; przeciągnięcie = przesunięcie wiersza w inne miejsce
    d.onmousedown = e => {
      e.stopPropagation(); e.preventDefault(); if (S.busy) return;
      const sx = e.clientX, sy = e.clientY; let moved = false;
      const mv = ev => { const dx = ev.clientX - sx, dy = ev.clientY - sy; if (!moved && Math.hypot(dx, dy) < 4) return; moved = true; d.classList.add('moving'); d.style.transform = `translate(${dx}px,${dy}px) rotate(${b.ang}deg)`; status('Przesuwanie wiersza – puść, żeby zapisać nowe położenie'); };
      const up = async ev => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); if (!moved) { startEdit(i, L); return; } d.classList.remove('moving'); await moveLine(i, L, ev.clientX - sx, ev.clientY - sy); };
      window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
    };
    p.txl.append(d);
  }
}
function hideTextBoxes() { for (const p of S.pages) p.txl.innerHTML = ''; }
// fontCss – rodzina CSS do podglądu: czcionka wczytana przez pdf.js (ta sama, co w dokumencie) + zapasowa
function fontCss(it) { const f = it.font; const n = (f && f.name || '').toLowerCase(); const fb = /courier|mono/.test(n) ? FONT_CSS.Mono : /times|serif|georgia|cambria|garamond|book/.test(n) && !/sans/.test(n) ? FONT_CSS.Serif : FONT_CSS.Sans; return (f && !f.missingFile ? '"' + it.fontName + '",' : '') + fb; }
// dobór czcionki Liberation do oryginału (sposób B i C)
function matchFont(i, it) {
  const info = fontInfo(i, it) || {}; const name = ((it.font && it.font.name) || info.base || '').toLowerCase();
  const bold = /bold|black|heavy|semibold|demibold/.test(name) || !!(info.flags & (1 << 18));
  const italic = /italic|oblique/.test(name) || !!(info.flags & 64);
  const fixed = info.fixed || /courier|mono/.test(name);
  const serif = !fixed && (/times|serif|georgia|cambria|garamond|book|roman|minion|palatino|century/.test(name) || (info.serif && !/arial|helvetica|verdana|calibri|segoe|tahoma|sans|roboto|dejavu|liberation|open/.test(name)));
  return { fam: fixed ? 'Mono' : serif ? 'Serif' : 'Sans', bold, italic };
}
// startEdit – otwiera pole edycji na wierszu
function startEdit(i, L) {
  finishEdit(true);
  const p = S.pages[i]; const b = screenBox(p, L); const z = p.vp.scale;
  const ed = el('div', { class: 'inl', contenteditable: 'true', spellcheck: 'false', style: `left:${b.x}px;top:${b.y}px;min-height:${b.h}px;font-size:${L.sizePt * z}px;transform:rotate(${b.ang}deg);line-height:${b.h}px` });
  for (const f of L.frags) { if (f.sep) ed.append(document.createTextNode(f.sep)); ed.append(el('span', { style: `font-family:${fontCss(f.it)};color:${rgb2hex(...f.it.color)};font-size:${f.it.sizePt * z}px` }, f.it.text)); }
  p.el.append(ed);
  const mf = matchFont(i, L.items[0]);
  editing = { line: L, page: i, el: ed, style: { size: Math.round(L.items[0].sizePt * 10) / 10, color: rgb2hex(...L.items[0].color), fam: mf.fam, bold: mf.bold, italic: mf.italic, changed: false } };
  ed.focus(); const r = document.createRange(); r.selectNodeContents(ed); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
  ed.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finishEdit(false); } if (e.key === 'Escape') { e.preventDefault(); finishEdit(true); } });
  ed.addEventListener('mousedown', e => e.stopPropagation());
  ed.addEventListener('blur', () => setTimeout(() => { if (editing && editing.el === ed && !editing.inPanel) finishEdit(false); }, 150));
  showEditPanel();
  status('Edycja tekstu: Enter – zapisz, Esc – anuluj. ' + (L.items.every(it => it.rawOp) ? 'Napis zostanie zmieniony w oryginalnej czcionce, jeśli ma ona potrzebne znaki.' : 'Napis leży w osadzonym obiekcie – zostanie zakryty i narysowany na nowo.') + ' Żeby przesunąć wiersz, przeciągnij jego ramkę.');
}
// finishEdit – zamyka pole edycji i (jeśli nie anulowano) zapisuje zmianę
async function finishEdit(cancel) {
  if (!editing) return;
  const e = editing; editing = null; e.el.remove(); status('');
  const txt = e.el.innerText.replace(/\n+$/, '');
  if (cancel) { showEditPanel(); return; }
  if (txt === e.line.text && !e.style.changed) { showEditPanel(); return; }
  try { snapshot(); await applyLineEdit(e.page, e.line, txt, e.style); await commitDoc('Zapisuję zmianę tekstu…'); toast(txt ? 'Tekst zmieniony' : 'Tekst usunięty'); }
  catch (x) { console.error(x); toast('Nie udało się zmienić tekstu: ' + x.message, true); }
  showEditPanel();
}
// panel właściwości podczas edycji tekstu (rozmiar, kolor, pogrubienie, rodzina – wymusza narysowanie na nowo)
function showEditPanel() {
  const pr = $('#props');
  if (!editing) { if (S.tool === 'edittext') { pr.classList.add('on'); pr.innerHTML = '<h3>Edytuj tekst</h3><div class="m" style="font-size:13px">Najedź na tekst i kliknij wiersz, żeby go zmienić. Enter zapisuje, Esc anuluje. Pusty tekst usuwa wiersz.</div><div class="m" style="font-size:12px;margin-top:10px">Jeśli oryginalna czcionka ma potrzebne znaki, zmiana jest zapisywana tą samą czcionką. W innym razie (np. polskie znaki w czcionce bez nich) tekst jest rysowany na nowo czcionką Liberation dobraną do oryginału.</div>'; } return; }
  const st = editing.style, L = editing.line;
  pr.classList.add('on');
  pr.innerHTML = `<h3>Edytowany tekst</h3><div class="m" style="font-size:12px">Czcionka w pliku: <b>${esc([...new Set(L.items.map(it => (it.font && it.font.name || '?').replace(/^[A-Z]{6}\+/, '')))].join(', '))}</b> ${Math.round(L.items[0].sizePt * 10) / 10} pt</div>
    <label>Rozmiar (pt)</label><input type="number" id="epSize" step="0.5" min="1" value="${st.size}">
    <label>Kolor</label><input type="color" id="epColor" value="${st.color}">
    <div class="row"><button id="epB" class="${st.bold ? 'on' : ''}"><b>B</b></button><button id="epI" class="${st.italic ? 'on' : ''}"><i>I</i></button></div>
    <label>Czcionka zastępcza (gdy trzeba narysować na nowo)</label><select id="epFam"><option value="Sans">Liberation Sans (jak Arial)</option><option value="Serif">Liberation Serif (jak Times)</option><option value="Mono">Liberation Mono (jak Courier)</option></select>
    <div class="m" style="font-size:12px;margin-top:8px">Zmiana rozmiaru, koloru lub stylu zapisuje tekst na nowo czcionką zastępczą.</div>
    <button class="go" id="epOk">Zapisz (Enter)</button><button id="epCancel">Anuluj (Esc)</button>`;
  $('#epFam').value = st.fam;
  const keep = () => { editing.inPanel = true; setTimeout(() => { if (editing) { editing.inPanel = false; editing.el.focus(); } }, 50); };
  pr.onmousedown = () => { if (editing) editing.inPanel = true; };
  $('#epSize').onchange = e => { st.size = Number(e.target.value) || st.size; st.changed = true; editing.el.style.fontSize = st.size * S.pages[editing.page].vp.scale + 'px'; keep(); };
  $('#epColor').oninput = e => { st.color = e.target.value; st.changed = true; editing.el.style.color = st.color; keep(); };
  $('#epB').onclick = e => { st.bold = !st.bold; st.changed = true; e.currentTarget.classList.toggle('on', st.bold); editing.el.style.fontWeight = st.bold ? '700' : '400'; keep(); };
  $('#epI').onclick = e => { st.italic = !st.italic; st.changed = true; e.currentTarget.classList.toggle('on', st.italic); editing.el.style.fontStyle = st.italic ? 'italic' : 'normal'; keep(); };
  $('#epFam').onchange = e => { st.fam = e.target.value; st.changed = true; editing.el.style.fontFamily = FONT_CSS[st.fam]; keep(); };
  $('#epOk').onclick = () => { editing.inPanel = false; finishEdit(false); };
  $('#epCancel').onclick = () => { editing.inPanel = false; finishEdit(true); };
}

// ---- zapis zmiany wiersza ----
// encodeFor – kody znaków nowego napisu w oryginalnej czcionce albo null, gdy czcionka ich nie ma
function encodeFor(i, it, text) {
  const an = S.textCache[i]; const cm = an.codeMaps[it.fontName] || new Map(); const info = fontInfo(i, it);
  const simple = info && info.sub !== '/Type0'; const bpc = it.bpc || 1;
  let fk = null; const F = it.font;
  if (simple && info.embedded && F && F.data) { try { fk = window.fontkit.create(F.data instanceof Uint8Array ? F.data : new Uint8Array(F.data)); } catch (e) { fk = null; } }
  const codes = [];
  for (const ch of text) {
    let c = cm.get(ch);
    if (c === undefined && simple && info && info.nonsymbolic) {
      const wa = winAnsiCode(ch);
      const encOk = info.encName === 'WinAnsiEncoding' || (!info.encName && wa < 127) || (info.encName === 'StandardEncoding' && wa < 127 && ch !== "'" && ch !== '`');
      const glyphOk = !info.embedded || (fk && fk.hasGlyphForCodePoint(ch.codePointAt(0)));
      if (wa >= 0 && encOk && glyphOk) c = wa;
    }
    if (c === undefined || c < 0) return null;
    if (bpc === 1 && c > 255) return null;
    codes.push(c);
  }
  return { codes, bpc };
}
const hexOf = (codes, bpc) => '<' + codes.map(c => c.toString(16).padStart(bpc * 2, '0')).join('') + '>';
// fragStyle – styl fragmentu do narysowania na nowo: czcionka Liberation dobrana do oryginału, rozmiar i kolor z pliku
function fragStyle(i, it) { const mf = matchFont(i, it); return { fam: mf.fam, bold: mf.bold, italic: mf.italic, size: it.sizePt, color: rgb2hex(...it.color) }; }
// deleteFrag – usuwa napis fragmentu ze strumienia (gdy wiemy, gdzie jest) albo zakrywa go kolorem tła
function deleteFrag(it, edits, covered) { if (it.rawOp) { let rep = ''; if (it.rawOp.op === "'") rep = 'T*'; else if (it.rawOp.op === '"') rep = `${it.rawOp.nums[0] || 0} Tw ${it.rawOp.nums[1] || 0} Tc T*`; edits.push({ start: it.rawOp.start, end: it.rawOp.end, rep }); } else covered.push(it); }
// applyLineEdit – zapisuje zmianę wiersza. Niezmienione fragmenty na początku i końcu wiersza zostają nietknięte;
// zmieniony środek: A) podmiana w oryginalnej czcionce, B/C) nowy napis czcionką Liberation. Gdy nowy tekst nie mieści się
// przed następnym fragmentem, cały wiersz jest rysowany na nowo (fragment po fragmencie, z zachowaniem odstępów).
async function applyLineEdit(i, L, text, st) {
  const page = S.lib.getPage(i); const raw = S.textCache[i].raw; const frags = L.frags;
  let pi = 0, pos = 0;
  while (pi < frags.length) { const piece = frags[pi].sep + frags[pi].it.text; if (text.startsWith(piece, pos)) { pos += piece.length; pi++; } else break; }
  let si = frags.length, end = text.length;
  while (si > pi) { const piece = frags[si - 1].sep + frags[si - 1].it.text; if (end - piece.length >= pos && text.slice(0, end).endsWith(piece)) { end -= piece.length; si--; } else break; }
  if (pi === si) { if (pi > 0) { pi--; pos -= (frags[pi].sep + frags[pi].it.text).length; } else { si++; end += (frags[0].sep + frags[0].it.text).length; } }
  if (st.changed) { pi = 0; pos = 0; si = frags.length; end = text.length; }   // zmiana stylu dotyczy całego wiersza
  const middle = frags.slice(pi, si); let middleNew = text.slice(pos, end);
  if (middle[0].sep && middleNew.startsWith(middle[0].sep)) middleNew = middleNew.slice(middle[0].sep.length);
  const it0 = middle[0].it; const next = frags[si] ? frags[si].it : null;
  const along = q => (q[0] - it0.start[0]) * L.d[0] + (q[1] - it0.start[1]) * L.d[1];
  let avail = next ? along(next.start) - 0.15 * it0.sizePt : Infinity;
  // sąsiedni wiersz na tej samej linii bazowej po prawej (np. następna komórka tabeli) też ogranicza miejsce
  for (const L2 of (S.pages[i].lines || [])) { if (L2 === L || Math.abs(L2.angle - L.angle) > 1) continue; const v = [L2.start[0] - it0.start[0], L2.start[1] - it0.start[1]]; const perp = Math.abs(v[0] * L.nrm[0] + v[1] * L.nrm[1]), a = v[0] * L.d[0] + v[1] * L.d[1]; if (perp < 0.3 * it0.sizePt && a > 0) avail = Math.min(avail, a - 0.15 * it0.sizePt); }
  const edits = [], covered = [];
  // A) jeden zmieniony fragment, oryginalna czcionka ma znaki, nowy tekst mieści się
  if (middle.length === 1 && !st.changed && it0.rawOp && middleNew) {
    const enc = encodeFor(i, it0, middleNew);
    if (enc) {
      const wm = (S.textCache[i].widthMaps || {})[it0.fontName] || new Map(); let w = 0; for (const c of enc.codes) w += (wm.get(c) ?? 0.55) * Math.abs(it0.fs) * it0.scale;
      if (w <= avail) {
        const op = it0.rawOp; let rep = hexOf(enc.codes, enc.bpc) + ' Tj';
        if (op.op === "'") rep = 'T* ' + rep; else if (op.op === '"') rep = `${op.nums[0] || 0} Tw ${op.nums[1] || 0} Tc T* ` + rep;
        await replaceContent(i, raw, [{ start: op.start, end: op.end, rep }]); return;
      }
    }
  }
  // B/C) jeden zmieniony fragment narysowany czcionką Liberation, jeśli się mieści
  const styleOf = it => (st.changed ? { fam: st.fam, bold: st.bold, italic: st.italic, size: st.size, color: st.color } : fragStyle(i, it));
  if (middle.length === 1) {
    const sty = styleOf(it0); const font = await libFont(sty.fam, sty.bold, sty.italic); const t = safeText(font, middleNew);
    if (!middleNew || font.widthOfTextAtSize(t, sty.size) <= avail) {
      deleteFrag(it0, edits, covered); if (edits.length) await replaceContent(i, raw, edits); if (covered.length) coverItems(i, covered);
      if (t) page.drawText(t, { x: it0.start[0], y: it0.start[1], size: sty.size, font, color: RGB(sty.color), rotate: degrees(L.angle) });
      return;
    }
  }
  // cały wiersz na nowo: fragmenty po kolei, z oryginalnymi odstępami
  for (const f of frags) deleteFrag(f.it, edits, covered);
  if (edits.length) await replaceContent(i, raw, edits); if (covered.length) coverItems(i, covered);
  let x = 0; let drewMiddle = false;
  for (let k = 0; k < frags.length; k++) {
    const it = frags[k].it; const inMiddle = k >= pi && k < si; let t;
    if (inMiddle) { if (drewMiddle) continue; t = middleNew; drewMiddle = true; } else t = it.text;
    if (k > 0 && frags[k].sep) x += Math.max(0, it.gapBefore || 0); else if (k > 0) x += Math.max(0, it.gapBefore || 0);
    const sty = inMiddle ? styleOf(it) : fragStyle(i, it); const font = await libFont(sty.fam, sty.bold, sty.italic); t = safeText(font, t);
    if (t) { page.drawText(t, { x: L.start[0] + x * L.d[0], y: L.start[1] + x * L.d[1], size: sty.size, font, color: RGB(sty.color), rotate: degrees(L.angle) }); x += font.widthOfTextAtSize(t, sty.size); }
  }
}
// moveLine – przesuwa cały wiersz o (dx, dy) pikseli ekranu. Napis, po którym następuje zmiana położenia (Td, T*, Tm, ET),
// jest owijany w „tx ty Td … -tx -ty Td” (ta sama czcionka); pozostałe są rysowane na nowo czcionką Liberation w nowym miejscu.
async function moveLine(i, L, dx, dy) {
  const p = S.pages[i]; const vp = p.vp;
  const a = vp.convertToPdfPoint(0, 0), b2 = vp.convertToPdfPoint(dx, dy); const du = [b2[0] - a[0], b2[1] - a[1]];
  if (Math.hypot(du[0], du[1]) < 0.2) { showTextBoxes(i); return; }
  try {
    snapshot();
    const raw = S.textCache[i].raw; const edits = [], covered = [], redraw = [];
    const textOps = new Set(['Tj', 'TJ', "'", '"', 'Td', 'TD', 'Tm', 'T*', 'ET', 'BT']);
    for (const f of L.frags) {
      const it = f.it; let safe = false;
      if (it.rawOp) { const k = raw.ops.indexOf(it.rawOp); for (let j = k + 1; j < raw.ops.length; j++) { const o = raw.ops[j].op; if (textOps.has(o)) { safe = !(o === 'Tj' || o === 'TJ' || o === "'" || o === '"'); break; } } if (k + 1 >= raw.ops.length) safe = true; }
      if (safe) {
        const m = it.m; const det = m[0] * m[3] - m[1] * m[2] || 1;   // (dx,dy) w przestrzeni strony -> przesunięcie Td w przestrzeni tekstu
        const tx = (du[0] * m[3] - du[1] * m[2]) / det, ty = (-du[0] * m[1] + du[1] * m[0]) / det;
        const src = new TextDecoder('latin1').decode(raw.bytes.subarray(it.rawOp.start, it.rawOp.end));
        const n = v => (Math.round(v * 1000) / 1000).toString();
        edits.push({ start: it.rawOp.start, end: it.rawOp.end, rep: `${n(tx)} ${n(ty)} Td ${src} ${n(-tx)} ${n(-ty)} Td` });
      } else { deleteFrag(it, edits, covered); redraw.push(it); }
    }
    if (edits.length) await replaceContent(i, raw, edits); if (covered.length) coverItems(i, covered);
    const page = S.lib.getPage(i);
    for (const it of redraw) { const sty = fragStyle(i, it); const font = await libFont(sty.fam, sty.bold, sty.italic); const t = safeText(font, it.text); if (t) page.drawText(t, { x: it.start[0] + du[0], y: it.start[1] + du[1], size: sty.size, font, color: RGB(sty.color), rotate: degrees(L.angle) }); }
    await commitDoc('Przesuwam tekst…'); toast('Wiersz przesunięty');
  } catch (x) { console.error(x); toast('Nie udało się przesunąć: ' + x.message, true); }
}
// replaceContent – wprowadza zamiany (od końca) do strumienia treści strony i zapisuje go jako jeden strumień
async function replaceContent(i, raw, edits) {
  const page = S.lib.getPage(i);
  edits.sort((a, b) => b.start - a.start);
  let parts = []; let last = raw.bytes.length;
  for (const e of edits) { parts.unshift(raw.bytes.subarray(e.end, last)); parts.unshift(Uint8Array.from('\n' + e.rep + '\n', c => c.charCodeAt(0) & 255)); last = e.start; }
  parts.unshift(raw.bytes.subarray(0, last));
  let len = 0; for (const p of parts) len += p.length; const out = new Uint8Array(len); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  const ref = S.lib.context.register(S.lib.context.flateStream(out));
  page.node.set(PDFName.of('Contents'), S.lib.context.obj([ref]));
  page.contentStream = undefined; page.contentStreamRef = undefined;
  delete S.textCache[i];
}
// coverItems – zakrywa napisy prostokątem w kolorze tła (próbkowanym z obrazu strony)
function coverItems(i, items) {
  const page = S.lib.getPage(i); const p = S.pages[i];
  for (const it of items) {
    const col = sampleBackground(p, it.corners);
    const pad = 0.5; const d = [it.m[0] / it.scale, it.m[1] / it.scale], nrm = [-d[1], d[0]];
    const c = it.corners.map(([x, y], k) => [x + (k === 0 || k === 3 ? -pad : pad) * d[0] + (k < 2 ? -pad : pad) * nrm[0], y + (k === 0 || k === 3 ? -pad : pad) * d[1] + (k < 2 ? -pad : pad) * nrm[1]]);
    page.pushOperators(pushGraphicsState(), setFillingColor(RGB(col)), moveTo(c[0][0], c[0][1]), lineTo(c[1][0], c[1][1]), lineTo(c[2][0], c[2][1]), lineTo(c[3][0], c[3][1]), closePath(), fill(), popGraphicsState());
  }
}
// sampleBackground – najczęstszy kolor pikseli tuż przy ramce napisu (zwykle tło strony)
function sampleBackground(p, corners) {
  try {
    const pts = corners.map(c => p.vp.convertToViewportPoint(c[0], c[1]));
    const x0 = Math.max(0, Math.floor(Math.min(...pts.map(q => q[0])) - 3)), x1 = Math.min(p.canvas.width - 1, Math.ceil(Math.max(...pts.map(q => q[0])) + 3));
    const y0 = Math.max(0, Math.floor(Math.min(...pts.map(q => q[1])) - 3)), y1 = Math.min(p.canvas.height - 1, Math.ceil(Math.max(...pts.map(q => q[1])) + 3));
    const ctx = p.canvas.getContext('2d'); const cnt = new Map(); const add = (x, y) => { const d = ctx.getImageData(x, y, 1, 1).data; const k = (d[0] >> 3 << 10) | (d[1] >> 3 << 5) | (d[2] >> 3); cnt.set(k, (cnt.get(k) || 0) + 1); };
    for (let x = x0; x <= x1; x += 2) { add(x, y0); add(x, y1); } for (let y = y0; y <= y1; y += 2) { add(x0, y); add(x1, y); }
    let best = null, bn = -1; for (const [k, n] of cnt) if (n > bn) { bn = n; best = k; }
    if (best === null) return '#ffffff';
    return rgb2hex(((best >> 10) & 31) / 31, ((best >> 5) & 31) / 31, (best & 31) / 31);
  } catch (e) { return '#ffffff'; }
}
// removeTextInRect – usuwa ze strumienia napisy (albo ich części) leżące w prostokącie (zaczernianie).
// Częściowo zakryty napis jest dzielony: zostają znaki spoza prostokąta, a w miejsce usuniętych wchodzi odstęp (TJ).
async function removeTextInRect(i, r) {
  delete S.textCache[i];   // treść strony mogła się zmienić (np. wtopione obiekty) – analizuj od nowa
  const an = await analyzePage(i); const edits = []; let n = 0;
  const inRect = (x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  for (const it of an.items) {
    if (!it.rawOp) continue;
    const asc = (it.font && it.font.ascent) || 0.9, desc = (it.font && it.font.descent) || -0.22; const fs = it.fs;
    const covered = it.glyphs.map(g => { const c = apply(it.m, g.x + g.w / 2, (asc + desc) / 2 * fs + it.rise); const lo = apply(it.m, g.x + g.w / 2, desc * fs + it.rise), hi = apply(it.m, g.x + g.w / 2, asc * fs + it.rise); return inRect(c[0], c[1]) || (inRect(lo[0], lo[1]) && inRect(hi[0], hi[1])); });
    if (!covered.some(Boolean)) continue;
    n++;
    let pre = ''; if (it.rawOp.op === "'") pre = 'T* '; else if (it.rawOp.op === '"') pre = `${it.rawOp.nums[0] || 0} Tw ${it.rawOp.nums[1] || 0} Tc T* `;
    if (covered.every(Boolean)) { edits.push({ start: it.rawOp.start, end: it.rawOp.end, rep: pre.trim() }); continue; }
    // część napisu zostaje: [<zachowane> -odstęp <zachowane>] TJ
    const bpc = it.bpc || 1; const parts = []; let run = null, gap = 0;
    const flushRun = () => { if (run && run.length) parts.push(hexOf(run, bpc)); run = null; };
    const flushGap = () => { if (gap && fs * it.th) parts.push(String(Math.round(-gap / (fs * it.th) * 1000))); gap = 0; };
    it.glyphs.forEach((g, k) => { if (covered[k] || g.c < 0) { flushRun(); gap += g.w; } else { flushGap(); (run || (run = [])).push(g.c); } });
    flushRun(); flushGap();
    edits.push({ start: it.rawOp.start, end: it.rawOp.end, rep: pre + '[' + parts.join(' ') + '] TJ' });
  }
  if (edits.length) await replaceContent(i, an.raw, edits);
  return n;
}
