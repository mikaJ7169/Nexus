const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nexus', {
  platform: () => ipcRenderer.invoke('platform'),
  defaults: () => ipcRenderer.invoke('defaults'),
  launch: (item) => ipcRenderer.invoke('launch-app', item),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  notify: (title, body) => ipcRenderer.invoke('notify', title, body),
  pickApp: () => ipcRenderer.invoke('pick-app'),
  winMin: () => ipcRenderer.send('win-min'),
  winMax: () => ipcRenderer.send('win-max'),
  winClose: () => ipcRenderer.send('win-close'),
  onMaximized: (cb) => ipcRenderer.on('win-maximized', (_e, v) => cb(v))
});
