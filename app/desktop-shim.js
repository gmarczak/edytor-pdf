/* Warstwa programu (Electron): numer wersji w górnym pasku, przycisk „🆕 Aktualizuj” i okno aktualizacji.
   Ten sam mechanizm, co w „Certyfikaty i instrukcje” (app/desktop-shim.js). W zwykłej przeglądarce nic nie robi. */
(function () {
  if (!window.desktop) return;
  const D = window.desktop;
  const escH = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // przyciski w górnym pasku: numer wersji (kliknięcie = sprawdź aktualizacje) i zielony „Aktualizuj”, gdy jest nowa wersja
  const addButtons = () => {
    const acts = document.querySelector('#appActions'), ver = document.querySelector('#stVersion'); if (!acts || !ver) return;
    const u = window.__upd;
    if (u && u.available && !acts.querySelector('#deskUpd')) {
      const b = document.createElement('button'); b.id = 'deskUpd'; b.className = 'ep-btn ep-btn--sm'; b.innerHTML = `<span style="width:6px;height:6px;border-radius:50%;background:var(--warning)"></span>Aktualizuj do ${escH(u.latest)}`; b.title = 'Dostępna nowa wersja programu – kliknij, żeby zaktualizować';
      b.onclick = () => showUpd(); acts.insertBefore(b, document.querySelector('#bSave'));
    }
    if (!ver.dataset.ready) {
      ver.dataset.ready = '1'; ver.hidden = false; document.querySelector('#stVersionSep').hidden = false; ver.textContent = 'wersja …'; ver.title = 'Kliknij, żeby sprawdzić, czy jest nowa wersja programu'; ver.style.cursor = 'pointer';
      D.appInfo().then(i => { ver.textContent = 'wersja ' + i.version; });
      ver.onclick = async () => { ver.textContent = 'sprawdzam…'; try { await window.checkUpd(true); } finally { D.appInfo().then(i => { ver.textContent = 'wersja ' + i.version; }); } showUpd(); };
    }
  };
  const st = document.createElement('style'); st.textContent = '@keyframes deskPulse{0%,100%{box-shadow:0 0 0 0 #2d6a1266}50%{box-shadow:0 0 0 6px #2d6a1200}} .deskOv{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:600;padding:16px;font:400 13px/20px var(--font-sans)} .deskBox{background:var(--surface-raised);color:var(--ink);border:1px solid var(--line);border-radius:var(--radius-lg);width:min(560px,100%);box-shadow:var(--shadow-pop)} .deskBox h3{margin:0;font:600 15px/20px var(--font-sans)} .deskBox .b{padding:16px 20px} .deskBox .f{padding:12px 20px;border-top:1px solid var(--line);display:flex;gap:8px;justify-content:flex-end} .deskBox button{height:32px;padding:0 12px;border-radius:6px;border:1px solid var(--line-strong);background:var(--surface-raised);color:var(--ink);cursor:pointer;font:600 13px/20px var(--font-sans)} .deskBox button.go{background:var(--accent);color:var(--on-accent);border-color:var(--accent)} .deskBox .pr{height:6px;background:var(--surface-sunken);border-radius:3px;overflow:hidden;margin-top:10px} .deskBox .pr i{display:block;height:100%;background:var(--accent);width:0}';
  (document.head || document.documentElement).appendChild(st);
  // okno aktualizacji: co nowego, „Aktualizuj teraz”, pasek postępu, komunikat o błędzie
  window.showUpd = function () {
    const u = window.__upd || {}; const ov = document.createElement('div'); ov.className = 'deskOv';
    const notes = String(u.notes || '').split(/\n+/).map(x => x.trim()).filter(Boolean);
    ov.innerHTML = `<div class="deskBox"><div class="b" style="border-bottom:1px solid #dddbd2"><h3>${u.available ? 'Dostępna nowa wersja ' + escH(u.latest) : 'Masz najnowszą wersję'}</h3><div style="color:var(--ink-muted);font-size:12px">Twoja wersja: ${escH(u.current || '')}${u.date ? ' · nowa z ' + escH(u.date) : ''}</div></div>
      <div class="b">${u.available ? (notes.length ? '<b>Co nowego:</b><ul style="margin:6px 0 0;padding-left:20px">' + notes.map(n => '<li>' + escH(n.replace(/^[-•*]\s*/, '')) + '</li>').join('') + '</ul>' : '') + '<p style="color:var(--ink-muted);font-size:12px;margin:12px 0 0">Aktualizacja trwa kilka sekund. Program uruchomi się ponownie – zapisz najpierw otwarty dokument.</p>' : (u.error ? escH(u.error) : 'Nie ma nic do zaktualizowania.')}<div id="deskUpdMsg" style="margin-top:10px;font-size:14px"></div><div class="pr" id="deskUpdPr" style="display:none"><i></i></div></div>
      <div class="f"><button data-x="close">${u.available ? 'Później' : 'Zamknij'}</button>${u.available ? '<button class="go" data-x="go">Aktualizuj teraz</button>' : ''}</div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', async ev => { const x = ev.target.dataset && ev.target.dataset.x; if (x === 'close') ov.remove();
      if (x === 'go') { ev.target.disabled = true; ov.querySelector('[data-x="close"]').disabled = true; const msg = ov.querySelector('#deskUpdMsg'), pr = ov.querySelector('#deskUpdPr'); pr.style.display = 'block';
        D.onUpdProgress((t, f) => { msg.textContent = t; pr.firstChild.style.width = Math.round((f || 0) * 100) + '%'; });
        try { const r = await D.updApply(); msg.innerHTML = 'Zainstalowano wersję ' + escH(r.version) + '. Uruchamiam ponownie…'; try { sessionStorage.removeItem('desk:upd'); } catch (e) {} }
        catch (e) { msg.style.color = 'var(--danger)'; msg.textContent = 'Nie udało się: ' + String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''); ev.target.disabled = false; ov.querySelector('[data-x="close"]').disabled = false; } } });
  };
  // checkUpd – pyta serwer o nową wersję (wynik pamięta do 3 godzin; force = sprawdź od razu)
  window.checkUpd = async function (force) { let r = null; try { r = JSON.parse(sessionStorage.getItem('desk:upd') || 'null'); } catch (e) {}
    if (!r || force || !r.t || Date.now() - r.t > 3 * 3600e3) { r = await D.updCheck(); r.t = Date.now(); try { sessionStorage.setItem('desk:upd', JSON.stringify(r)); } catch (e) {} }
    window.__upd = r; addButtons(); return r; };
  document.addEventListener('DOMContentLoaded', () => { addButtons(); window.checkUpd(false); setInterval(() => window.checkUpd(false), 3600e3); });
  window.isDesktop = true;
})();
