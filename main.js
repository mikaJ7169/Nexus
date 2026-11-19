const { app, BrowserWindow, ipcMain, Notification, shell, dialog, Menu, webUtils, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, spawnSync } = require('child_process');

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';
let win = null;

/* ---------- Dossier de fichiers partagés ---------- */
function filesDir() { return path.join(app.getPath('documents'), 'NEXUS'); }
function ensureFilesDir() { fs.mkdirSync(filesDir(), { recursive: true }); }
function safeFilesPath(name) {
  const p = path.join(filesDir(), path.basename(String(name || '')));
  if (!p.startsWith(filesDir() + path.sep)) throw new Error('Nom de fichier invalide');
  return p;
}

/* ---------- Mode auto-masqué (bandeau haut d'écran, couvre la barre des tâches) ---------- */
let autohideOn = false;
let pollTimer = null, hideTimer = null, slideTimer = null;

function stopSlide() { if (slideTimer) { clearInterval(slideTimer); slideTimer = null; } }
function stopHide() { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } }

function slideTo(targetY) {
  if (!win) return;
  stopSlide();
  const b = win.getBounds();
  const from = b.y, steps = 14, dur = 240;
  let i = 0;
  slideTimer = setInterval(() => {
    i++;
    const e = 1 - Math.pow(1 - i / steps, 3);
    const bb = win.getBounds();
    win.setBounds({ x: bb.x, y: Math.round(from + (targetY - from) * e), width: bb.width, height: bb.height });
    if (i >= steps) stopSlide();
  }, dur / steps);
}

function poll() {
  if (!win || !autohideOn) return;
  const p = screen.getCursorScreenPoint();
  const d = screen.getDisplayNearestPoint(p);
  const b = win.getBounds();
  const shown = b.y <= d.bounds.y;
  if (!shown) {
    if (p.y <= d.bounds.y + 8) slideTo(d.bounds.y);
  } else {
    const inside = p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;
    if (!inside) {
      if (!hideTimer) hideTimer = setTimeout(() => {
        hideTimer = null;
        if (!win) return;
        const dd = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
        const bb = win.getBounds();
        slideTo(dd.bounds.y - (bb.height - 12));
      }, 700);
    } else stopHide();
  }
}

function setAutohide(on) {
  autohideOn = !!on;
  if (!win) return autohideOn;
  stopSlide(); stopHide();
  if (autohideOn) {
    const d = screen.getPrimaryDisplay();
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setResizable(false);
    win.setBounds({ x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height });
    if (!pollTimer) pollTimer = setInterval(poll, 120);
  } else {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    win.setAlwaysOnTop(false);
    win.setResizable(true);
    win.setBounds({ width: 1280, height: 800 });
    win.center();
  }
  win.webContents.send('autohide-changed', autohideOn);
  return autohideOn;
}

/* ---------- Tuiles par défaut ---------- */
function defaultApps() {
  const vibe = { name: 'Vibe · Mistral', kind: 'url', cat: 'lien', target: 'https://vibe.mistral.ai', icon: '🟠' };
  if (isWin) {
    return [
      vibe,
      { name: 'Steam', kind: 'app', cat: 'jeu', target: 'steam', icon: '🎮' },
      { name: 'Explorateur de fichiers', kind: 'app', cat: 'app', target: 'explorer', icon: '🗂️' },
      { name: 'Bloc-notes', kind: 'app', cat: 'app', target: 'notepad', icon: '📝' },
      { name: 'Calculatrice', kind: 'app', cat: 'app', target: 'calc', icon: '🧮' },
      { name: 'Invite de commandes', kind: 'app', cat: 'app', target: 'cmd', icon: '⌨️' },
      { name: 'PowerShell', kind: 'app', cat: 'app', target: 'powershell', icon: '💠' },
      { name: 'Paint', kind: 'app', cat: 'app', target: 'mspaint', icon: '🎨' },
      { name: 'Microsoft Edge', kind: 'app', cat: 'app', target: 'msedge', icon: '🌐' },
      { name: 'VS Code', kind: 'app', cat: 'app', target: 'code', icon: '💻' },
      { name: 'Paramètres Windows', kind: 'link', cat: 'lien', target: 'ms-settings:', icon: '⚙️' },
      { name: 'Microsoft Store', kind: 'link', cat: 'lien', target: 'ms-windows-store:', icon: '🛍️' },
      { name: 'Gmail', kind: 'url', cat: 'lien', target: 'https://mail.google.com', icon: '📧' },
      { name: 'YouTube', kind: 'url', cat: 'lien', target: 'https://www.youtube.com', icon: '▶️' },
      { name: 'GitHub', kind: 'url', cat: 'lien', target: 'https://github.com', icon: '🐙' },
      { name: 'Google Drive', kind: 'url', cat: 'lien', target: 'https://drive.google.com', icon: '☁️' }
    ];
  }
  if (isMac) {
    return [
      vibe,
      { name: 'Steam', kind: 'app', cat: 'jeu', target: 'Steam', icon: '🎮' },
      { name: 'Finder', kind: 'app', cat: 'app', target: 'Finder', icon: '🗂️' },
      { name: 'Terminal', kind: 'app', cat: 'app', target: 'Terminal', icon: '⌨️' },
      { name: 'Safari', kind: 'app', cat: 'app', target: 'Safari', icon: '🧭' },
      { name: 'VS Code', kind: 'app', cat: 'app', target: 'Visual Studio Code', icon: '💻' },
      { name: 'Gmail', kind: 'url', cat: 'lien', target: 'https://mail.google.com', icon: '📧' },
      { name: 'YouTube', kind: 'url', cat: 'lien', target: 'https://www.youtube.com', icon: '▶️' },
      { name: 'GitHub', kind: 'url', cat: 'lien', target: 'https://github.com', icon: '🐙' }
    ];
  }
  return [
    vibe,
    { name: 'Steam', kind: 'app', cat: 'jeu', target: 'steam', icon: '🎮' },
    { name: 'Gestionnaire de fichiers', kind: 'app', cat: 'app', target: 'nautilus', icon: '🗂️' },
    { name: 'Terminal', kind: 'app', cat: 'app', target: 'gnome-terminal', icon: '⌨️' },
    { name: 'VS Code', kind: 'app', cat: 'app', target: 'code', icon: '💻' },
    { name: 'Gmail', kind: 'url', cat: 'lien', target: 'https://mail.google.com', icon: '📧' },
    { name: 'YouTube', kind: 'url', cat: 'lien', target: 'https://www.youtube.com', icon: '▶️' },
    { name: 'GitHub', kind: 'url', cat: 'lien', target: 'https://github.com', icon: '🐙' }
  ];
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    frame: false,
    backgroundColor: '#f2f2f4',
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
  win.on('closed', () => { win = null; stopSlide(); stopHide(); if (pollTimer) clearInterval(pollTimer); });
}

ipcMain.handle('platform', () => process.platform);
ipcMain.handle('defaults', () => defaultApps());
ipcMain.handle('autohide:set', (_e, on) => setAutohide(on));

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

/* ---------- Icônes réelles des applis / sites ---------- */
function domainOf(url) {
  try { return new URL(String(url)).hostname.replace(/^www\./, ''); } catch { return null; }
}
ipcMain.handle('app:icon', async (_e, item) => {
  if (!item) return null;
  if (item.kind === 'url' || item.kind === 'link') {
    const d = domainOf(item.target);
    return d ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=128` : null;
  }
  let p = String(item.target || '').trim();
  try {
    if (isWin && !/\.(exe|lnk)$/i.test(p) && !p.includes('\\')) {
      const r = spawnSync('cmd.exe', ['/c', 'where', p], { encoding: 'utf8' });
      if (r.status === 0) { const first = String(r.stdout || '').split(/\r?\n/)[0].trim(); if (first) p = first; }
    } else if (isMac && !p.endsWith('.app')) {
      const cand = `/Applications/${p}.app`;
      if (fs.existsSync(cand)) p = cand;
    } else if (!isWin && !isMac && !p.includes('/')) {
      const r = spawnSync('which', [p], { encoding: 'utf8' });
      if (r.status === 0) p = String(r.stdout || '').trim();
    }
    if (!p || !fs.existsSync(p)) return null;
    const img = await app.getFileIcon(p, { size: 'large' });
    if (img && !img.isEmpty()) return img.toDataURL();
  } catch { /* icon indisponible */ }
  return null;
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

/* ---------- Fichiers partagés (Documents/NEXUS) ---------- */
ipcMain.handle('files:dir', () => { ensureFilesDir(); return filesDir(); });
ipcMain.handle('files:list', () => {
  ensureFilesDir();
  return fs.readdirSync(filesDir()).map((n) => {
    const st = fs.statSync(path.join(filesDir(), n));
    return { name: n, size: st.size, mtime: st.mtimeMs, isDir: st.isDirectory() };
  }).sort((a, b) => b.mtime - a.mtime);
});
ipcMain.handle('files:open', async (_e, name) => { const err = await shell.openPath(safeFilesPath(name)); return err ? { ok: false, error: err } : { ok: true }; });
ipcMain.handle('files:reveal', (_e, name) => { shell.showItemInFolder(safeFilesPath(name)); return { ok: true }; });
ipcMain.handle('files:delete', (_e, name) => { fs.unlinkSync(safeFilesPath(name)); return { ok: true }; });
ipcMain.handle('files:open-dir', async () => { ensureFilesDir(); const err = await shell.openPath(filesDir()); return err ? { ok: false, error: err } : { ok: true }; });
ipcMain.handle('files:pick', async () => {
  if (!win) return [];
  const r = await dialog.showOpenDialog(win, {
    title: 'Choisir des fichiers à déposer dans NEXUS',
    properties: ['openFile', 'multiSelections']
  });
  if (r.canceled) return [];
  ensureFilesDir();
  const copied = [];
  for (const f of r.filePaths) {
    const dest = path.join(filesDir(), path.basename(f));
    fs.copyFileSync(f, dest);
    copied.push(path.basename(f));
  }
  return copied;
});
ipcMain.handle('files:drop', (_e, files) => {
  ensureFilesDir();
  const copied = [];
  for (const f of Array.isArray(files) ? files : []) {
    const p = webUtils.getPathForFile(f);
    if (!p) continue;
    const dest = path.join(filesDir(), path.basename(p));
    fs.copyFileSync(p, dest);
    copied.push(path.basename(p));
  }
  return copied;
});

ipcMain.handle('app:read-file', (_e, name) => {
  const p = path.join(__dirname, path.basename(String(name || '')));
  return fs.readFileSync(p, 'utf8');
});

ipcMain.on('win-min', () => { if (win) win.minimize(); });
ipcMain.on('win-max', () => { if (win && !autohideOn) win.isMaximized() ? win.unmaximize() : win.maximize(); });
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
    ensureFilesDir();
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
  app.on('window-all-closed', () => { if (!isMac) app.quit(); });
}
