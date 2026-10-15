// Formularze: wypełnianie pól zapisanych w pliku (panel „Formularz”), spłaszczanie, usuwanie adnotacji.
function fieldKind(f) { if (f instanceof PDFLib.PDFTextField) return 'text'; if (f instanceof PDFLib.PDFCheckBox) return 'check'; if (f instanceof PDFLib.PDFRadioGroup) return 'radio'; if (f instanceof PDFLib.PDFDropdown) return 'drop'; if (f instanceof PDFLib.PDFOptionList) return 'list'; if (f instanceof PDFLib.PDFButton) return 'button'; if (f instanceof PDFLib.PDFSignature) return 'sig'; return 'other'; }
function updateFormPanel() {
  const box = $('#pForm'); box.innerHTML = ''; if (!S.lib) return;
  let fields = []; try { fields = S.lib.getForm().getFields(); } catch (e) { box.innerHTML = '<div class="m">Nie udało się odczytać formularza.</div>'; return; }
  if (!fields.length) { box.innerHTML = '<div class="m">Ten dokument nie ma pól formularza. Dodaj je narzędziami „Pole” i „Checkbox”.</div>'; return; }
  box.append(el('div', { class: 'm', style: 'margin-bottom:6px' }, `${fields.length} pól. Zmiany zapisują się po opuszczeniu pola.`));
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
