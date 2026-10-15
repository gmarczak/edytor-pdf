// Bezpieczny most między stroną a systemem (tylko te funkcje są dostępne dla strony edytor.html)
const { contextBridge, ipcRenderer, webUtils } = require('electron');
const call = (ch, ...a) => ipcRenderer.invoke(ch, ...a);
contextBridge.exposeInMainWorld('desktop', {
  openDialog: filters => call('openDialog', filters),
  saveDialog: (name, filters, defDir) => call('saveDialog', name, filters, defDir),
  readFile: p => call('readFile', p),
  writeFile: (p, data) => call('writeFile', p, data),
  print: (data, name) => call('print', data, name),
  argvFile: () => call('argvFile'),
  onOpenFile: cb => ipcRenderer.on('openFile', (e, p) => cb(p)),
  setDirty: d => call('setDirty', d),
  openExternal: u => call('openExternal', u),
  openPath: p => call('openPath', p),
  appInfo: () => call('appInfo'),
  updCheck: () => call('updCheck'),
  updApply: () => call('updApply'),
  onUpdProgress: cb => ipcRenderer.on('updProgress', (e, t, f) => cb(t, f)),
  restart: () => call('restart'),
  pathOf: f => { try { return webUtils.getPathForFile(f) || null; } catch (e) { return null; } },
  sep: process.platform === 'win32' ? '\\' : '/'
});
