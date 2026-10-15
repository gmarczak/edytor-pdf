// Edytor PDF – uruchamiacz (ten sam mechanizm, co w programie „Certyfikaty i instrukcje”). Wybiera najnowszą wersję programu:
// wbudowaną albo pobraną aktualizację (folder „wersje” w danych programu) i ją uruchamia.
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
// ver – odczytuje numer wersji z package.json w podanym folderze (null, gdy go brak)
const ver = d => { try { return JSON.parse(fs.readFileSync(path.join(d, 'package.json'), 'utf8')).version; } catch (e) { return null; } };
// cmp – porównuje dwa numery wersji (np. 1.2.10 jest nowsza niż 1.2.9); wynik > 0 = pierwsza nowsza
const cmp = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
// na początek bierzemy wersję wbudowaną (folder, w którym leży ten plik)
let best = __dirname, bestV = ver(__dirname) || '0.0.0';
// przeglądamy pobrane aktualizacje i wybieramy najnowszą kompletną (musi mieć core.js)
try {
  const dir = path.join(app.getPath('userData'), 'wersje');
  for (const n of fs.readdirSync(dir)) { if (!/^\d+(\.\d+)*$/.test(n)) continue; const d = path.join(dir, n), v = ver(d); if (v && fs.existsSync(path.join(d, 'core.js')) && cmp(v, bestV) > 0) { best = d; bestV = v; } }
} catch (e) { /* brak aktualizacji – używamy wbudowanej wersji */ }
// uruchamiamy wybraną wersję; jeśli aktualizacja okaże się uszkodzona – wracamy do wersji wbudowanej
global.APP_DIR = best;
try { require(path.join(best, 'core.js')); }
catch (e) { if (best !== __dirname) { console.error('Aktualizacja uszkodzona, wracam do wersji wbudowanej:', e); global.APP_DIR = __dirname; require(path.join(__dirname, 'core.js')); } else throw e; }
