const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const isDev = !app.isPackaged;
const pty = require('node-pty');

let mainWindow;
const REPO_ROOT = path.join(__dirname, '..');
const ptySessions = new Map();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'Istio PM Mastery Lab',
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Cleanup PTY sessions
    ptySessions.forEach(p => {
      try { p.kill(); } catch (_) {}
    });
    ptySessions.clear();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// File system operations
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return content;
  } catch (error) {
    throw new Error(`Failed to read file: ${error.message}`);
  }
});

ipcMain.handle('list-directory', async (event, dirPath) => {
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    return items.map(item => ({
      name: item.name,
      isDirectory: item.isDirectory(),
      path: path.join(dirPath, item.name)
    }));
  } catch (error) {
    throw new Error(`Failed to list directory: ${error.message}`);
  }
});

ipcMain.handle('get-modules-path', () => {
  return path.join(__dirname, '..', 'modules');
});

// PTY session management
ipcMain.handle('pty-start', async (_e, sessionId, options = {}) => {
  console.log('[pty-start] sessionId=', sessionId, 'options=', options);
  if (ptySessions.has(sessionId)) return { ok: true };
  const defaultShell = process.platform === 'win32' ? 'pwsh.exe' : (process.env.SHELL || '/bin/zsh');
  const shell = defaultShell;
  const args = process.platform === 'win32' ? [] : ['-l'];
  const cwd = options.cwd || REPO_ROOT;
  const env = { ...process.env, TERM: 'xterm-256color' };

  try {
    console.log('[pty-start] spawning shell=', shell, 'args=', args, 'cwd=', cwd);
    const p = pty.spawn(shell, args, { name: 'xterm-color', cols: 120, rows: 34, cwd, env });
    // On first data, log a small preview
    let firstChunk = true;
    p.onData(data => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pty:data', sessionId, data);
      }
      if (isDev && firstChunk) {
        firstChunk = false;
        console.log('[pty:data:first]', JSON.stringify(String(data).slice(0, 80)));
      }
    });
    p.onExit(code => {
      console.log('[pty-exit] sessionId=', sessionId, 'code=', code?.exitCode);
      ptySessions.delete(sessionId);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pty:exit', sessionId);
      }
    });
    ptySessions.set(sessionId, p);
    return { ok: true };
  } catch (err) {
    console.error('[pty-start] failed:', err);
    throw err;
  }
});

ipcMain.handle('pty-write', async (_e, sessionId, data) => {
  // Avoid spamming logs; log short preview
  if (isDev) console.log('[pty-write]', sessionId, JSON.stringify(String(data).slice(0, 80)));
  const p = ptySessions.get(sessionId);
  if (p) p.write(data);
});

ipcMain.handle('pty-resize', async (_e, sessionId, cols, rows) => {
  if (isDev) console.log('[pty-resize]', sessionId, cols, rows);
  const p = ptySessions.get(sessionId);
  if (p) p.resize(cols, rows);
});

ipcMain.handle('pty-kill', async (_e, sessionId) => {
  if (isDev) console.log('[pty-kill]', sessionId);
  const p = ptySessions.get(sessionId);
  if (p) p.kill();
  ptySessions.delete(sessionId);
});

ipcMain.handle('get-repo-root', () => REPO_ROOT);
