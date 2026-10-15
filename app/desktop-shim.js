/* Warstwa programu (Electron): numer wersji w górnym pasku, przycisk „🆕 Aktualizuj” i okno aktualizacji.
   Ten sam mechanizm, co w „Certyfikaty i instrukcje” (app/desktop-shim.js). W zwykłej przeglądarce nic nie robi. */
(function () {
  if (!window.desktop) return;
  const D = window.desktop;
  const escH = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // przyciski w górnym pasku: numer wersji (kliknięcie = sprawdź aktualizacje) i zielony „Aktualizuj”, gdy jest nowa wersja
  const addButtons = () => {
    const nav = document.querySelector('.top nav:last-of-type'); if (!nav) return;
    const u = window.__upd;
    if (u && u.available && !nav.querySelector('#deskUpd')) {
      const b = document.createElement('button'); b.id = 'deskUpd'; b.className = 'tb'; b.innerHTML = `🆕 Aktualizuj <span style="opacity:.8;font-weight:400">(${escH(u.latest)})</span>`; b.title = 'Dostępna nowa wersja programu – kliknij, żeby zaktualizować';
      b.style.cssText = 'background:#2d6a12;border:1px solid #2d6a12;font-weight:600;animation:deskPulse 2s ease-in-out 3'; b.onclick = () => showUpd(); nav.insertBefore(b, nav.firstChild);
    }
    if (!nav.querySelector('#deskVer')) {
      const b = document.createElement('button'); b.id = 'deskVer'; b.className = 'tb'; b.textContent = 'wersja …'; b.title = 'Kliknij, żeby sprawdzić, czy jest nowa wersja programu';
      b.style.cssText = 'color:#b4b2a9;font-size:12px;text-decoration:underline dotted';
      D.appInfo().then(i => { b.textContent = 'wersja ' + i.version; });
      b.onclick = async () => { b.textContent = 'sprawdzam…'; try { await window.checkUpd(true); } finally { D.appInfo().then(i => { b.textContent = 'wersja ' + i.version; }); } showUpd(); };
      nav.insertBefore(b, nav.firstChild);
    }
  };
  const st = document.createElement('style'); st.textContent = '@keyframes deskPulse{0%,100%{box-shadow:0 0 0 0 #2d6a1266}50%{box-shadow:0 0 0 6px #2d6a1200}} .deskOv{position:fixed;inset:0;background:#0008;display:flex;align-items:center;justify-content:center;z-index:600;padding:16px;font:15px/1.5 system-ui,"Segoe UI",sans-serif} .deskBox{background:#fff;color:#1d1d1b;border-radius:14px;width:min(560px,100%);box-shadow:0 10px 40px #0005} .deskBox h3{margin:0;font-size:18px} .deskBox .b{padding:16px 20px} .deskBox .f{padding:12px 20px;border-top:1px solid #dddbd2;display:flex;gap:10px;justify-content:flex-end} .deskBox button{padding:9px 16px;border-radius:8px;border:1px solid #dddbd2;background:#fff;cursor:pointer;font:inherit} .deskBox button.go{background:#2d6a12;color:#fff;border-color:#2d6a12} .deskBox .pr{height:8px;background:#ecebe5;border-radius:4px;overflow:hidden;margin-top:10px} .deskBox .pr i{display:block;height:100%;background:#1f5f99;width:0}';
  (document.head || document.documentElement).appendChild(st);
  // okno aktualizacji: co nowego, „Aktualizuj teraz”, pasek postępu, komunikat o błędzie
  window.showUpd = function () {
    const u = window.__upd || {}; const ov = document.createElement('div'); ov.className = 'deskOv';
    const notes = String(u.notes || '').split(/\n+/).map(x => x.trim()).filter(Boolean);
    ov.innerHTML = `<div class="deskBox"><div class="b" style="border-bottom:1px solid #dddbd2"><h3>${u.available ? '🆕 Dostępna nowa wersja ' + escH(u.latest) : '✓ Masz najnowszą wersję'}</h3><div style="color:#6b6a64;font-size:13px">Twoja wersja: ${escH(u.current || '')}${u.date ? ' · nowa z ' + escH(u.date) : ''}</div></div>
      <div class="b">${u.available ? (notes.length ? '<b>Co nowego:</b><ul style="margin:6px 0 0;padding-left:20px">' + notes.map(n => '<li>' + escH(n.replace(/^[-•*]\s*/, '')) + '</li>').join('') + '</ul>' : '') + '<p style="color:#6b6a64;font-size:13px;margin:12px 0 0">Aktualizacja trwa kilka sekund. Program uruchomi się ponownie – zapisz najpierw otwarty dokument.</p>' : (u.error ? escH(u.error) : 'Nie ma nic do zaktualizowania.')}<div id="deskUpdMsg" style="margin-top:10px;font-size:14px"></div><div class="pr" id="deskUpdPr" style="display:none"><i></i></div></div>
      <div class="f"><button data-x="close">${u.available ? 'Później' : 'Zamknij'}</button>${u.available ? '<button class="go" data-x="go">Aktualizuj teraz</button>' : ''}</div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', async ev => { const x = ev.target.dataset && ev.target.dataset.x; if (x === 'close') ov.remove();
      if (x === 'go') { ev.target.disabled = true; ov.querySelector('[data-x="close"]').disabled = true; const msg = ov.querySelector('#deskUpdMsg'), pr = ov.querySelector('#deskUpdPr'); pr.style.display = 'block';
        D.onUpdProgress((t, f) => { msg.textContent = t; pr.firstChild.style.width = Math.round((f || 0) * 100) + '%'; });
        try { const r = await D.updApply(); msg.innerHTML = '✓ Zainstalowano wersję ' + escH(r.version) + '. Uruchamiam ponownie…'; try { sessionStorage.removeItem('desk:upd'); } catch (e) {} }
        catch (e) { msg.style.color = '#a32d2d'; msg.textContent = 'Nie udało się: ' + String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''); ev.target.disabled = false; ov.querySelector('[data-x="close"]').disabled = false; } } });
  };
  // checkUpd – pyta serwer o nową wersję (wynik pamięta do 3 godzin; force = sprawdź od razu)
  window.checkUpd = async function (force) { let r = null; try { r = JSON.parse(sessionStorage.getItem('desk:upd') || 'null'); } catch (e) {}
    if (!r || force || !r.t || Date.now() - r.t > 3 * 3600e3) { r = await D.updCheck(); r.t = Date.now(); try { sessionStorage.setItem('desk:upd', JSON.stringify(r)); } catch (e) {} }
    window.__upd = r; addButtons(); return r; };
  document.addEventListener('DOMContentLoaded', () => { addButtons(); window.checkUpd(false); setInterval(() => window.checkUpd(false), 3600e3); });
  window.isDesktop = true;
})();
