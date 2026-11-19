const { app, BrowserWindow, ipcMain, Notification, shell, dialog, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';
let win = null;

function defaultApps() {
  if (isWin) {
    return [
      { name: 'Explorateur de fichiers', kind: 'app', target: 'explorer', icon: '🗂️' },
      { name: 'Bloc-notes', kind: 'app', target: 'notepad', icon: '📝' },
      { name: 'Calculatrice', kind: 'app', target: 'calc', icon: '🧮' },
      { name: 'Invite de commandes', kind: 'app', target: 'cmd', icon: '⌨️' },
      { name: 'PowerShell', kind: 'app', target: 'powershell', icon: '💠' },
      { name: 'Paint', kind: 'app', target: 'mspaint', icon: '🎨' },
      { name: 'Microsoft Edge', kind: 'app', target: 'msedge', icon: '🌐' },
      { name: 'VS Code', kind: 'app', target: 'code', icon: '💻' },
      { name: 'Paramètres Windows', kind: 'link', target: 'ms-settings:', icon: '⚙️' },
      { name: 'Microsoft Store', kind: 'link', target: 'ms-windows-store:', icon: '🛍️' },
      { name: 'Gmail', kind: 'url', target: 'https://mail.google.com', icon: '📧' },
      { name: 'YouTube', kind: 'url', target: 'https://www.youtube.com', icon: '▶️' },
      { name: 'GitHub', kind: 'url', target: 'https://github.com', icon: '🐙' },
      { name: 'Google Drive', kind: 'url', target: 'https://drive.google.com', icon: '☁️' }
    ];
  }
  if (isMac) {
    return [
      { name: 'Finder', kind: 'app', target: 'Finder', icon: '🗂️' },
      { name: 'Terminal', kind: 'app', target: 'Terminal', icon: '⌨️' },
      { name: 'Safari', kind: 'app', target: 'Safari', icon: '🧭' },
      { name: 'Mail', kind: 'app', target: 'Mail', icon: '📧' },
      { name: 'Notes', kind: 'app', target: 'Notes', icon: '📝' },
      { name: 'Calendrier', kind: 'app', target: 'Calendar', icon: '📅' },
      { name: 'VS Code', kind: 'app', target: 'Visual Studio Code', icon: '💻' },
      { name: 'Spotify', kind: 'app', target: 'Spotify', icon: '🎧' },
      { name: 'Gmail', kind: 'url', target: 'https://mail.google.com', icon: '📧' },
      { name: 'YouTube', kind: 'url', target: 'https://www.youtube.com', icon: '▶️' },
      { name: 'GitHub', kind: 'url', target: 'https://github.com', icon: '🐙' }
    ];
  }
  return [
    { name: 'Gestionnaire de fichiers', kind: 'app', target: 'nautilus', icon: '🗂️' },
    { name: 'Terminal', kind: 'app', target: 'gnome-terminal', icon: '⌨️' },
    { name: 'Navigateur', kind: 'app', target: 'xdg-open', icon: '🌐', args: ['https://www.google.com'] },
    { name: 'VS Code', kind: 'app', target: 'code', icon: '💻' },
    { name: 'Gmail', kind: 'url', target: 'https://mail.google.com', icon: '📧' },
    { name: 'YouTube', kind: 'url', target: 'https://www.youtube.com', icon: '▶️' },
    { name: 'GitHub', kind: 'url', target: 'https://github.com', icon: '🐙' }
  ];
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    frame: false,
    backgroundColor: '#05060f',
    title: 'NEXUS',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.on('maximize', () => win.webContents.send('win-maximized', true));
  win.on('unmaximize', () => win.webContents.send('win-maximized', false));
  if (process.env.NEXUS_DEV) win.webContents.openDevTools();
  win.on('closed', () => { win = null; });
}

ipcMain.handle('platform', () => process.platform);
ipcMain.handle('defaults', () => defaultApps());

ipcMain.handle('notify', (_e, title, body) => {
  if (!Notification.isSupported()) return false;
  const n = new Notification({
    title: String(title || 'NEXUS'),
    body: String(body || ''),
    icon: path.join(__dirname, 'assets', 'icon.png')
  });
  n.show();
  return true;
});

ipcMain.handle('pick-app', async () => {
  if (!win) return null;
  const exts = isWin ? ['exe', 'lnk', 'bat', 'cmd'] : isMac ? ['app'] : ['desktop', 'AppImage', 'sh'];
  const r = await dialog.showOpenDialog(win, {
    title: 'Choisir une application',
    properties: ['openFile'],
    filters: [{ name: 'Applications', extensions: exts }, { name: 'Tous les fichiers', extensions: ['*'] }]
  });
  if (r.canceled || !r.filePaths.length) return null;
  return r.filePaths[0];
});

ipcMain.handle('open-url', async (_e, url) => {
  const u = String(url || '').trim();
  if (!/^(https?|ms-settings|ms-windows-store|mailto|tel):/i.test(u)) {
    return { ok: false, error: 'Adresse non autorisée (http/https ou protocole système uniquement).' };
  }
  try {
    await shell.openExternal(u);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
});

ipcMain.handle('launch-app', async (_e, item) => {
  const target = String((item && item.target) || '').trim();
  if (!target) return { ok: false, error: 'Aucune cible définie.' };
  const args = Array.isArray(item && item.args) ? item.args.map(String) : [];
  try {
    if (isWin) {
      if (/\.(exe|lnk|bat|cmd)$/i.test(target) || target.includes('\\') || target.includes('/')) {
        const err = await shell.openPath(target);
        return err ? { ok: false, error: err } : { ok: true };
      }
      const child = spawn('cmd.exe', ['/c', 'start', '""', target, ...args], {
        detached: true, stdio: 'ignore', windowsHide: true
      });
      child.on('error', () => {});
      child.unref();
      return { ok: true };
    }
    if (isMac) {
      const child = spawn('open', ['-a', target, ...args], { detached: true, stdio: 'ignore' });
      child.on('error', () => {});
      child.unref();
      return { ok: true };
    }
    const child = spawn(target, args, { detached: true, stdio: 'ignore' });
    child.on('error', () => {});
    child.unref();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
});

ipcMain.on('win-min', () => { if (win) win.minimize(); });
ipcMain.on('win-max', () => { if (win) win.isMaximized() ? win.unmaximize() : win.maximize(); });
ipcMain.on('win-close', () => { if (win) win.close(); });

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
  app.whenReady().then(() => {
    app.setAppUserModelId('com.nexus.hub');
    if (!process.env.NEXUS_DEV) Menu.setApplicationMenu(null);
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
  app.on('window-all-closed', () => { if (!isMac) app.quit(); });
}
