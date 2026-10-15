// Edytor PDF – właściwa logika programu (aktualizowana razem z aplikacją). Ładowana przez main.js z najnowszej
// dostępnej wersji (wbudowanej albo z aktualizacji). Mechanizm aktualizacji i skrótów jest taki sam, jak w programie
// „Certyfikaty i instrukcje” (app/core.js) – tylko adres serwera to …/edytor.
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, net } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const fss = require('fs');
const os = require('os');
const crypto = require('crypto');
const APP_DIR = global.APP_DIR || __dirname;
const CFG_FILE = () => path.join(app.getPath('userData'), 'ustawienia.json');
function cfg() { try { return JSON.parse(fss.readFileSync(CFG_FILE(), 'utf8')); } catch (e) { return {}; } }
function saveCfg(c) { fss.mkdirSync(path.dirname(CFG_FILE()), { recursive: true }); fss.writeFileSync(CFG_FILE(), JSON.stringify(c, null, 1)); }
const curVersion = () => { try { return JSON.parse(fss.readFileSync(path.join(APP_DIR, 'package.json'), 'utf8')).version; } catch (e) { return app.getVersion(); } };
const cmpV = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
const APP_ID = 'pl.gmarczak.edytorpdf', SHORTCUT = 'Edytor PDF.lnk';

// plik PDF przekazany przy uruchomieniu (dwuklik „Otwórz za pomocą”, przeciągnięcie na ikonę)
const pdfArg = argv => (argv || []).slice(app.isPackaged ? 1 : 2).find(a => /\.pdf$/i.test(a) && !a.startsWith('-')) || null;
let win = null, dirty = false, pendingFile = pdfArg(process.argv);
function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 960, minWidth: 900, minHeight: 600,
    title: 'Edytor PDF', autoHideMenuBar: true, backgroundColor: '#e9e8e3', icon: path.join(APP_DIR, 'icon.ico'),
    webPreferences: { preload: path.join(APP_DIR, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(APP_DIR, 'edytor.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (/^https?:/i.test(url)) { e.preventDefault(); shell.openExternal(url); } });
  win.webContents.session.on('will-download', (e, item) => { item.setSaveDialogOptions({ title: 'Zapisz plik', defaultPath: path.join(app.getPath('downloads'), item.getFilename()) }); });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools();
    if (input.type === 'keyDown' && input.key === 'F5') win.webContents.reload();
  });
  // zamknięcie okna z niezapisanymi zmianami – pytamy
  win.on('close', e => {
    if (!dirty) return;
    const r = dialog.showMessageBoxSync(win, { type: 'question', buttons: ['Anuluj', 'Zamknij bez zapisywania'], defaultId: 0, cancelId: 0, title: 'Niezapisane zmiany', message: 'Dokument ma niezapisane zmiany.', detail: 'Zamknij to okno i zapisz dokument przyciskiem „Zapisz”, albo zamknij program bez zapisywania.' });
    if (r === 0) e.preventDefault();
  });
}
if (!app.requestSingleInstanceLock()) { app.quit(); }
else {
  app.on('second-instance', (e, argv) => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); const f = pdfArg(argv); if (f) win.webContents.send('openFile', f); } });
  app.whenReady().then(() => { createWindow(); try { ensureShortcuts(); } catch (e) { console.error(e); } });
}
app.on('window-all-closed', () => app.quit());
app.on('open-file', (e, p) => { e.preventDefault(); if (win) win.webContents.send('openFile', p); else pendingFile = p; });
const BOOT_DIR = (require.main && require.main.filename) ? path.dirname(require.main.filename) : APP_DIR;
// skróty na Pulpicie i w menu Start (Windows) – przy pierwszym uruchomieniu albo gdy folder programu przeniesiono
function ensureShortcuts() {
  if (process.platform !== 'win32' || !app.isPackaged) return;
  app.setAppUserModelId(APP_ID);
  const c = cfg(), first = !c.skroty;
  const places = [app.getPath('desktop'), path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs')];
  for (const dir of places) {
    const lnk = path.join(dir, SHORTCUT); let cur = null;
    try { cur = shell.readShortcutLink(lnk).target; } catch (e) {}
    if (first || (cur && cur.toLowerCase() !== process.execPath.toLowerCase())) {
      shell.writeShortcutLink(lnk, cur ? 'replace' : 'create', { target: process.execPath, cwd: path.dirname(process.execPath), icon: path.join(BOOT_DIR, 'icon.ico'), iconIndex: 0, description: 'Edytor PDF – edycja tekstu, obrazów, formularzy i stron', appUserModelId: APP_ID });
    }
  }
  if (first) saveCfg({ ...c, skroty: true });
}
const parentWin = e => BrowserWindow.fromWebContents(e.sender) || win;

// ---- pliki ----
ipcMain.handle('openDialog', async (e, filters) => { const r = await dialog.showOpenDialog(parentWin(e), { title: 'Otwórz plik', filters: filters || [], properties: ['openFile'] }); return r.canceled ? null : r.filePaths[0]; });
ipcMain.handle('saveDialog', async (e, name, filters, defDir) => { const r = await dialog.showSaveDialog(parentWin(e), { title: 'Zapisz plik', defaultPath: defDir ? path.join(defDir, name) : path.join(app.getPath('documents'), name), filters: filters || [] }); return r.canceled ? null : r.filePath; });
ipcMain.handle('readFile', async (e, p) => new Uint8Array(await fs.readFile(p)));
// zapis: najpierw do pliku tymczasowego obok, potem zamiana – w razie błędu stary plik zostaje nienaruszony
ipcMain.handle('writeFile', async (e, p, data) => { await fs.mkdir(path.dirname(p), { recursive: true }); const tmp = p + '.zapis.tmp'; await fs.writeFile(tmp, Buffer.from(data)); await fs.rename(tmp, p); return true; });
ipcMain.handle('argvFile', async () => { const f = pendingFile; pendingFile = null; return f; });
ipcMain.handle('setDirty', async (e, d) => { dirty = !!d; return true; });
ipcMain.handle('openExternal', async (e, u) => { if (!/^(mailto:|https?:)/i.test(String(u))) return false; try { await shell.openExternal(String(u)); return true; } catch (er) { return false; } });
ipcMain.handle('openPath', async (e, p) => shell.openPath(p));
// drukowanie: dokument otwiera się w oknie z wbudowaną przeglądarką PDF (ma przycisk drukowania i podgląd)
ipcMain.handle('print', async (e, data, name) => {
  try {
    const dir = path.join(os.tmpdir(), 'edytor-pdf'); await fs.mkdir(dir, { recursive: true });
    try { for (const n of await fs.readdir(dir)) { const f = path.join(dir, n); const st = await fs.stat(f); if (Date.now() - st.mtimeMs > 2 * 864e5) await fs.rm(f, { force: true }); } } catch (x) {}
    const p = path.join(dir, Date.now() + '-' + String(name || 'dokument.pdf').replace(/[\\/:*?"<>|]+/g, '-'));
    await fs.writeFile(p, Buffer.from(data));
    const pw = new BrowserWindow({ width: 1100, height: 850, title: 'Drukowanie – ' + (name || 'dokument'), autoHideMenuBar: true, parent: win, webPreferences: { plugins: true, contextIsolation: true, sandbox: true } });
    Menu.setApplicationMenu(null);
    await pw.loadURL('file:///' + p.replace(/\\/g, '/'));
    setTimeout(() => { try { pw.webContents.print({ silent: false, printBackground: true }, () => {}); } catch (x) {} }, 900);
    return { ok: true };
  } catch (x) { return { error: 'Nie udało się otworzyć podglądu wydruku: ' + x.message }; }
});
ipcMain.handle('appInfo', async () => ({ version: curVersion(), platform: process.platform, os: (process.getSystemVersion ? process.getSystemVersion() : os.release()), arch: process.arch, docs: app.getPath('documents'), appDir: APP_DIR, updateUrl: updUrl() }));

// ---- Aktualizacje przez internet (identycznie jak w „Certyfikaty i instrukcje”, serwer: …/edytor) ----
const UPDATE_URL_DEFAULT = 'https://aktualizacje.gmarczak.xyz/edytor';
const updUrl = () => String(cfg().updateUrl || UPDATE_URL_DEFAULT).replace(/\/+$/, '');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const nocache = u => u + (u.includes('?') ? '&' : '?') + 't=' + Date.now();
async function getJson(u) { const r = await net.fetch(nocache(u), { cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }
const pyJson = t => '"' + t.replace(/[\\"\u0000-\u001f\u007f-￿]/g, c => ({ '\\': '\\\\', '"': '\\"', '\n': '\\n', '\r': '\\r', '\t': '\\t', '\b': '\\b', '\f': '\\f' })[c] || (c === '\u007f' ? c : '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))) + '"';
const okPath = p => typeof p === 'string' && /^[\w\-. ]+(\/[\w\-. ]+)*$/.test(p) && !p.split('/').some(x => x === '..' || x === '.');
ipcMain.handle('updCheck', async () => {
  try { const info = await getJson(updUrl() + '/wersja.json'); return { ok: true, current: curVersion(), latest: info.version, notes: info.notes || '', date: info.date || '', available: !!info.files && cmpV(info.version, curVersion()) > 0 }; }
  catch (x) { return { ok: false, current: curVersion(), error: 'Brak połączenia z serwerem aktualizacji (' + x.message + '). Sprawdź internet i spróbuj później.' }; }
});
let updBusy = false;
ipcMain.handle('updApply', async (e) => {
  if (updBusy) throw new Error('Aktualizacja już trwa.'); updBusy = true;
  const send = (t, f) => { try { e.sender.send('updProgress', t, f); } catch (x) {} };
  const base = path.join(app.getPath('userData'), 'wersje'); let tmp = null;
  try {
    const info = await getJson(updUrl() + '/wersja.json');
    if (cmpV(info.version, curVersion()) <= 0) throw new Error('Masz już najnowszą wersję.');
    const files = Object.entries(info.files || {});
    if (!files.length || !files.some(([p]) => p === 'core.js') || !files.some(([p]) => p === 'package.json') || files.some(([p]) => !okPath(p))) throw new Error('Nieprawidłowa lista plików aktualizacji.');
    const dest = path.join(base, info.version); tmp = dest + '.pobieranie';
    await fs.rm(tmp, { recursive: true, force: true }); await fs.mkdir(tmp, { recursive: true });
    const plan = [];
    for (const [p, m] of files) { let local = null;
      for (const dir of [...new Set([APP_DIR, BOOT_DIR])]) { try { const b = await fs.readFile(path.join(dir, ...p.split('/'))); if (sha(b) === m.sha256) { local = b; break; } } catch (x) {} }
      plan.push({ p, m, local }); }
    const toGet = plan.filter(x => !x.local), total = toGet.reduce((a, x) => a + (x.m.size || 1), 0) || 1; let got = 0;
    send(`Pobieram wersję ${info.version} (${toGet.length} ${toGet.length === 1 ? 'plik' : 'plików'})…`, 0);
    for (const x of plan) {
      let buf = x.local;
      if (!buf) {
        const z = (info.zrodla || {})[x.p];
        const u = z && z.url ? z.url : nocache(updUrl() + '/pliki/' + info.version + '/' + x.p.split('/').map(encodeURIComponent).join('/') + (z && z.gz ? '.gz' : ''));
        const r = await net.fetch(u, { cache: 'no-store' });
        if (!r.ok) throw new Error(`Nie udało się pobrać pliku ${x.p} (HTTP ${r.status}).`);
        buf = Buffer.from(await r.arrayBuffer());
        if (z && z.gz) buf = require('zlib').gunzipSync(buf);
        if (z && z.wrap) buf = Buffer.from(z.wrap + pyJson(buf.toString('utf8')) + ';\n', 'utf8');
        if (sha(buf) !== x.m.sha256) throw new Error(`Plik ${x.p} pobrał się z błędem (zła suma kontrolna). Spróbuj ponownie.`);
        got += x.m.size || 1; send(`Pobieram wersję ${info.version}…`, got / total);
      }
      const out = path.join(tmp, ...x.p.split('/')); await fs.mkdir(path.dirname(out), { recursive: true }); await fs.writeFile(out, buf);
    }
    const v = JSON.parse(await fs.readFile(path.join(tmp, 'package.json'), 'utf8')).version;
    if (v !== info.version) throw new Error('Paczka aktualizacji jest niespójna (zła wersja).');
    send('Instaluję…', 1);
    await fs.rm(dest, { recursive: true, force: true }); await fs.rename(tmp, dest);
    try { for (const n of await fs.readdir(base)) { const d = path.join(base, n); if (n !== info.version && d !== APP_DIR) await fs.rm(d, { recursive: true, force: true }); } } catch (x) {}
    setTimeout(() => { app.relaunch(); app.exit(0); }, 800); return { ok: true, version: info.version };
  } catch (x) { if (tmp) await fs.rm(tmp, { recursive: true, force: true }).catch(() => {}); throw x; }
  finally { updBusy = false; }
});
ipcMain.handle('restart', async () => { app.relaunch(); app.exit(0); });
