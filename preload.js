const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nexus', {
  platform: () => ipcRenderer.invoke('platform'),
  defaults: () => ipcRenderer.invoke('defaults'),
  setAutohide: (on) => ipcRenderer.invoke('autohide:set', on),
  launch: (item) => ipcRenderer.invoke('launch-app', item),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  notify: (title, body) => ipcRenderer.invoke('notify', title, body),
  pickApp: () => ipcRenderer.invoke('pick-app'),
  appIcon: (item) => ipcRenderer.invoke('app:icon', item),
  filesDir: () => ipcRenderer.invoke('files:dir'),
  filesList: () => ipcRenderer.invoke('files:list'),
  filesOpen: (n) => ipcRenderer.invoke('files:open', n),
  filesReveal: (n) => ipcRenderer.invoke('files:reveal', n),
  filesDelete: (n) => ipcRenderer.invoke('files:delete', n),
  filesPick: () => ipcRenderer.invoke('files:pick'),
  dropFiles: (files) => ipcRenderer.invoke('files:drop', files),
  openFilesDir: () => ipcRenderer.invoke('files:open-dir'),
  readAppFile: (n) => ipcRenderer.invoke('app:read-file', n),
  winMin: () => ipcRenderer.send('win-min'),
  winMax: () => ipcRenderer.send('win-max'),
  winClose: () => ipcRenderer.send('win-close'),
  onMaximized: (cb) => ipcRenderer.on('win-maximized', (_e, v) => cb(v)),
  onAutohide: (cb) => ipcRenderer.on('autohide-changed', (_e, v) => cb(v))
});
