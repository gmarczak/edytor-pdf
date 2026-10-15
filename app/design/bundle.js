/* Edytor PDF — bundle.js
   Wstrzykuje zestaw ikon (sprite SVG), przełącza tryb jasny/ciemny i podpina proste zachowania kontrolek.
   Użycie ikon:  <svg class="ep-icon" aria-hidden="true"><use href="#i-select"/></svg>
   Dostępne:     i-select, i-hand, i-edit-text, i-add-text, i-image, i-signature, i-highlight, i-underline, i-strike, i-comment, i-draw, i-rect, i-ellipse, i-line, i-arrow, i-erase, i-redact, i-field, i-checkbox, i-link, i-undo, i-redo, i-search, i-prev, i-next, i-down, i-minus, i-plus, i-check, i-pages, i-comments, i-form, i-panel-left, i-panel-right, i-close, i-bold, i-italic, i-align, i-more, i-fit, i-rotate, i-grid, i-settings, i-sun, i-moon, i-monitor
   Tryby:        EdytorPDF.initTheme()           — przy starcie aplikacji: zapisany wybór albo ustawienie systemu
                 EdytorPDF.setTheme('papier')    — jasny;  'grafit' — ciemny;  'auto' — jak w systemie
                 EdytorPDF.toggleTheme()         — przełącza jasny <-> ciemny
   Ikony: Lucide 0.460.0 (lucide.dev) — ISC License. Copyright (c) Lucide Contributors 2022;
   części z Feather, Copyright (c) Cole Bemis 2013-2022 (MIT). */
(function () {
  var SPRITE = '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden"><symbol id="i-select" viewBox="0 0 24 24"><path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/></symbol><symbol id="i-hand" viewBox="0 0 24 24"><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></symbol><symbol id="i-edit-text" viewBox="0 0 24 24"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/></symbol><symbol id="i-add-text" viewBox="0 0 24 24"><path d="M15 12h6"/><path d="M15 6h6"/><path d="m3 13 3.553-7.724a.5.5 0 0 1 .894 0L11 13"/><path d="M3 18h18"/><path d="M4 11h6"/></symbol><symbol id="i-image" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></symbol><symbol id="i-signature" viewBox="0 0 24 24"><path d="m21 17-2.156-1.868A.5.5 0 0 0 18 15.5v.5a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1c0-2.545-3.991-3.97-8.5-4a1 1 0 0 0 0 5c4.153 0 4.745-11.295 5.708-13.5a2.5 2.5 0 1 1 3.31 3.284"/><path d="M3 21h18"/></symbol><symbol id="i-highlight" viewBox="0 0 24 24"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></symbol><symbol id="i-underline" viewBox="0 0 24 24"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" x2="20" y1="20" y2="20"/></symbol><symbol id="i-strike" viewBox="0 0 24 24"><path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" x2="20" y1="12" y2="12"/></symbol><symbol id="i-comment" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></symbol><symbol id="i-draw" viewBox="0 0 24 24"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></symbol><symbol id="i-rect" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2"/></symbol><symbol id="i-ellipse" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></symbol><symbol id="i-line" viewBox="0 0 24 24"><path d="M22 2 2 22"/></symbol><symbol id="i-arrow" viewBox="0 0 24 24"><path d="M13 5H19V11"/><path d="M19 5L5 19"/></symbol><symbol id="i-erase" viewBox="0 0 24 24"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></symbol><symbol id="i-redact" viewBox="0 0 24 24"><rect fill="currentColor" width="20" height="12" x="2" y="6" rx="2"/></symbol><symbol id="i-field" viewBox="0 0 24 24"><path d="M5 4h1a3 3 0 0 1 3 3 3 3 0 0 1 3-3h1"/><path d="M13 20h-1a3 3 0 0 1-3-3 3 3 0 0 1-3 3H5"/><path d="M5 16H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1"/><path d="M13 8h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-7"/><path d="M9 7v10"/></symbol><symbol id="i-checkbox" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></symbol><symbol id="i-link" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></symbol><symbol id="i-undo" viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/></symbol><symbol id="i-redo" viewBox="0 0 24 24"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13"/></symbol><symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></symbol><symbol id="i-prev" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></symbol><symbol id="i-next" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></symbol><symbol id="i-down" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol><symbol id="i-minus" viewBox="0 0 24 24"><path d="M5 12h14"/></symbol><symbol id="i-plus" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="M12 5v14"/></symbol><symbol id="i-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></symbol><symbol id="i-pages" viewBox="0 0 24 24"><path d="M20 7h-3a2 2 0 0 1-2-2V2"/><path d="M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l4 4v10a2 2 0 0 1-2 2Z"/><path d="M3 7.6v12.8A1.6 1.6 0 0 0 4.6 22h9.8"/></symbol><symbol id="i-comments" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M13 8H7"/><path d="M17 12H7"/></symbol><symbol id="i-form" viewBox="0 0 24 24"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></symbol><symbol id="i-panel-left" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></symbol><symbol id="i-panel-right" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/></symbol><symbol id="i-close" viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></symbol><symbol id="i-bold" viewBox="0 0 24 24"><path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/></symbol><symbol id="i-italic" viewBox="0 0 24 24"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></symbol><symbol id="i-align" viewBox="0 0 24 24"><path d="M15 12H3"/><path d="M17 18H3"/><path d="M21 6H3"/></symbol><symbol id="i-more" viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></symbol><symbol id="i-fit" viewBox="0 0 24 24"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" x2="14" y1="3" y2="10"/><line x1="3" x2="10" y1="21" y2="14"/></symbol><symbol id="i-rotate" viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></symbol><symbol id="i-grid" viewBox="0 0 24 24"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></symbol><symbol id="i-settings" viewBox="0 0 24 24"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></symbol><symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></symbol><symbol id="i-moon" viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></symbol><symbol id="i-monitor" viewBox="0 0 24 24"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></symbol></svg>';

  var LIGHT = 'papier', DARK = 'grafit', KEY = 'ep-theme';

  function injectIcons(doc) {
    doc = doc || document;
    if (!doc.body || doc.getElementById('ep-icons')) return;
    var host = doc.createElement('div');
    host.innerHTML = SPRITE;
    var svg = host.firstChild;
    svg.id = 'ep-icons';
    doc.body.insertBefore(svg, doc.body.firstChild);
  }

  function each(root, sel, fn) { Array.prototype.forEach.call(root.querySelectorAll(sel), fn); }

  /* ---------- tryb jasny / ciemny ---------- */
  function darkQuery() { return window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null; }
  function systemTheme() { var q = darkQuery(); return q && q.matches ? DARK : LIGHT; }
  function getMode() {
    try { var m = window.localStorage.getItem(KEY); return m === LIGHT || m === DARK ? m : 'auto'; }
    catch (e) { return 'auto'; }
  }
  function currentTheme() { return document.documentElement.getAttribute('data-theme') || LIGHT; }

  function syncThemeControls(root) {
    root = root || document;
    var theme = currentTheme(), mode = getMode(), dark = theme === DARK;
    each(root, '[data-ep-theme-toggle]', function (b) {
      b.setAttribute('aria-pressed', dark ? 'true' : 'false');
      b.setAttribute('title', dark ? 'Tryb jasny' : 'Tryb ciemny');
    });
    each(root, '[data-ep-theme-mode] [data-mode]', function (r) {
      r.setAttribute('aria-checked', r.getAttribute('data-mode') === mode ? 'true' : 'false');
    });
  }

  function applyTheme(mode) {
    var theme = mode === 'auto' ? systemTheme() : mode;
    document.documentElement.setAttribute('data-theme', theme);
    syncThemeControls(document);
    try { document.dispatchEvent(new CustomEvent('ep:theme', { detail: { theme: theme, mode: mode } })); } catch (e) {}
    return theme;
  }

  /* mode: 'papier' (jasny) | 'grafit' (ciemny) | 'auto' (jak w systemie) */
  function setTheme(mode) {
    if (mode !== LIGHT && mode !== DARK) mode = 'auto';
    try {
      if (mode === 'auto') window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, mode);
    } catch (e) {}
    return applyTheme(mode);
  }

  function toggleTheme() { return setTheme(currentTheme() === DARK ? LIGHT : DARK); }

  var watching = false;
  function initTheme() {
    applyTheme(getMode());
    var q = darkQuery();
    if (q && !watching) {
      watching = true;
      var onChange = function () { if (getMode() === 'auto') applyTheme('auto'); };
      if (q.addEventListener) q.addEventListener('change', onChange); else if (q.addListener) q.addListener(onChange);
    }
    return currentTheme();
  }

  /* Podpina zachowania w obrębie root:
     [data-ep-tools]        — grupa narzędzi: jedno aria-pressed="true" naraz
     [role="tablist"]       — karty: aria-selected + pokazywanie paneli z aria-controls
     [data-ep-thumbs]       — miniatury: aria-current="page" na klikniętej
     [data-ep-swatches]     — próbki koloru: aria-checked na klikniętej
     [data-ep-theme-toggle] — przycisk jasny/ciemny
     [data-ep-theme-mode]   — wybór Jasny / Ciemny / Jak w systemie (przyciski z data-mode) */
  function wire(root) {
    root = root || document;
    injectIcons(root.ownerDocument || root);
    each(root, '[data-ep-tools]', function (g) {
      g.addEventListener('click', function (e) {
        var b = e.target.closest('[aria-pressed]');
        if (!b || !g.contains(b) || b.disabled) return;
        each(g, '[aria-pressed]', function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      });
    });
    each(root, '[role="tablist"]', function (list) {
      list.addEventListener('click', function (e) {
        var t = e.target.closest('[role="tab"]');
        if (!t || !list.contains(t)) return;
        each(list, '[role="tab"]', function (x) {
          var on = x === t;
          x.setAttribute('aria-selected', on ? 'true' : 'false');
          x.tabIndex = on ? 0 : -1;
          var id = x.getAttribute('aria-controls');
          var panel = id && (root.ownerDocument || root).getElementById(id);
          if (panel) panel.hidden = !on;
        });
      });
    });
    each(root, '[data-ep-thumbs]', function (list) {
      list.addEventListener('click', function (e) {
        var t = e.target.closest('.ep-thumb');
        if (!t || !list.contains(t)) return;
        each(list, '.ep-thumb', function (x) {
          if (x === t) x.setAttribute('aria-current', 'page'); else x.removeAttribute('aria-current');
        });
      });
    });
    each(root, '[data-ep-swatches]', function (list) {
      list.addEventListener('click', function (e) {
        var s = e.target.closest('.ep-swatch');
        if (!s || !list.contains(s)) return;
        each(list, '.ep-swatch', function (x) { x.setAttribute('aria-checked', x === s ? 'true' : 'false'); });
      });
    });
    each(root, '[data-ep-theme-toggle]', function (b) {
      b.addEventListener('click', function () { toggleTheme(); });
    });
    each(root, '[data-ep-theme-mode]', function (g) {
      g.addEventListener('click', function (e) {
        var r = e.target.closest('[data-mode]');
        if (r && g.contains(r)) setTheme(r.getAttribute('data-mode'));
      });
    });
    syncThemeControls(root);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { injectIcons(document); });
  } else {
    injectIcons(document);
  }

  window.EdytorPDF = Object.assign(window.EdytorPDF || {}, {
    injectIcons: injectIcons, wire: wire, sprite: SPRITE,
    initTheme: initTheme, setTheme: setTheme, toggleTheme: toggleTheme,
    getTheme: currentTheme, getThemeMode: getMode
  });
})();
