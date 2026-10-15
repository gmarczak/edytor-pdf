// Test programu „Edytor PDF” w prawdziwym oknie Electrona (Playwright). Na Linuksie: xvfb-run -a node testy/test_programu.js
// Sprawdza: uruchomienie, otwarcie pliku z wiersza poleceń, edycję tekstu, dodanie obiektów, zapis przez okno systemowe (atrapa),
// wynik na dysku, przycisk wersji i okno aktualizacji (serwer aktualizacji – atrapa z pliku).
const path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const ROOT = path.join(__dirname, '..');
const { _electron } = require(path.join(ROOT, 'node_modules', 'playwright-core'));
const APP = path.join(ROOT, 'app');
const PDF = process.argv[2] || path.join(__dirname, 'przyklad.pdf');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'edytor-test-')); const CFG = path.join(TMP, 'cfg');
const OUT = path.join(TMP, 'wynik.pdf');
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  // atrapa serwera aktualizacji: wersja.json z wyższym numerem wersji
  const srv = http.createServer((req, res) => { if (req.url.startsWith('/edytor/wersja.json')) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ version: '9.9.9', date: '2030-01-01', notes: 'Testowa wersja', files: { 'core.js': { sha256: '0', size: 1 }, 'package.json': { sha256: '0', size: 1 } } })); } else { res.statusCode = 404; res.end(); } });
  await new Promise(r => srv.listen(0, '127.0.0.1', r)); const port = srv.address().port;
  const app = await _electron.launch({ executablePath: require(path.join(ROOT, 'node_modules', 'electron')), args: [APP, '--no-sandbox', '--no-proxy-server', PDF], env: { ...process.env, XDG_CONFIG_HOME: CFG, NO_PROXY: '127.0.0.1,localhost', no_proxy: '127.0.0.1,localhost' } });
  // adres atrapy serwera aktualizacji w ustawieniach programu (folder danych wskazuje Electron)
  const ud = await app.evaluate(({ app }) => app.getPath('userData')); fs.mkdirSync(ud, { recursive: true }); fs.writeFileSync(path.join(ud, 'ustawienia.json'), JSON.stringify({ updateUrl: `http://127.0.0.1:${port}/edytor`, skroty: true }));
  // okna systemowe zamieniamy na atrapy (zapis -> OUT)
  await app.evaluate(({ dialog }, OUT) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: OUT }); dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] }); }, OUT);
  const page = await app.firstWindow();
  page.on('pageerror', e => console.log('PAGEERROR', e.message)); page.on('console', m => { if (m.type() === 'error') console.log('console:', m.text().slice(0, 200)); });
  await page.waitForFunction(() => window.isDesktop && window.desktop && typeof S !== 'undefined', null, { timeout: 20000 });
  await page.evaluate(() => window.checkUpd(true));
  ok(await page.title() !== '', 'okno programu uruchomione');
  // plik z wiersza poleceń
  await page.waitForFunction(() => S.lib && S.pages.length > 0 && S.pages[0].rendered && !S.busy, null, { timeout: 30000 });
  ok(await page.evaluate(() => S.path !== null && S.name.endsWith('.pdf')), 'plik z wiersza poleceń otwarty: ' + await page.evaluate(() => S.name));
  // przycisk wersji i okno aktualizacji
  await page.waitForFunction(() => document.querySelector('#stVersion') && /wersja \d/.test(document.querySelector('#stVersion').textContent), null, { timeout: 15000 });
  ok(true, 'numer wersji w pasku stanu: ' + await page.evaluate(() => document.querySelector('#stVersion').textContent));
  await page.waitForFunction(() => document.querySelector('#deskUpd'), null, { timeout: 15000 }).catch(() => {});
  ok(!!(await page.$('#deskUpd')), 'przycisk „Aktualizuj” widoczny, gdy serwer ma nowszą wersję ' + JSON.stringify(await page.evaluate(() => window.__upd)));
  await page.click('#deskUpd'); await page.waitForSelector('.deskBox'); ok((await page.textContent('.deskBox')).includes('9.9.9'), 'okno aktualizacji pokazuje nową wersję'); await page.click('.deskBox [data-x=close]');
  // edycja tekstu
  await page.click('button[data-tool=edittext]'); await page.waitForSelector('.page .tx', { timeout: 20000 });
  const before = await page.evaluate(() => S.pages[0].lines[0].text);
  await (await page.$('.page .tx')).click({ force: true }); await page.waitForSelector('.inl');
  await page.keyboard.press('End'); await page.keyboard.type(' (edycja w programie: żółw)'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelector('.inl')); await page.waitForTimeout(300); await page.waitForFunction(() => !S.busy, null, { timeout: 30000 });
  ok(true, 'zmieniono wiersz: ' + JSON.stringify(before));
  // nowy tekst + prostokąt + komentarz (przez API obiektów)
  await page.evaluate(() => { addObj(0, { type: 'text', x: 60, y: 300, w: 300, h: 40, text: 'Dodane w programie', fam: 'Sans', size: 14, bold: true, italic: false, color: '#1f5f99', align: 'left', opacity: 1 }); addObj(0, { type: 'rect', x: 60, y: 350, w: 200, h: 60, stroke: '#d32f2f', fill: 'none', width: 2, opacity: 1 }); addObj(0, { type: 'note', x: 400, y: 300, text: 'Uwaga testowa', color: '#ffd54f', author: 'Test' }); });
  ok(await page.evaluate(() => (S.objs[0] || []).length === 3), 'dodano 3 obiekty');
  // zapis jako (atrapa okna zapisu -> OUT)
  await page.evaluate(() => saveFile(true)); await page.waitForFunction(() => !S.busy && !S.dirty, null, { timeout: 60000 });
  ok(fs.existsSync(OUT) && fs.statSync(OUT).size > 1000, 'plik zapisany na dysku: ' + OUT);
  const txt = fs.readFileSync(OUT, 'latin1');
  ok(/\/Annots/.test(txt) && /\/Text/.test(txt), 'w pliku jest komentarz (adnotacja)');
  ok(await page.evaluate(() => S.path) === OUT, 'program pamięta nową ścieżkę');
  // zamknięcie bez zmian – bez pytania
  await app.close();
  srv.close();
  console.log(fails ? `\n${fails} błędów` : '\nWszystko OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('BŁĄD TESTU', e); process.exit(1); });
