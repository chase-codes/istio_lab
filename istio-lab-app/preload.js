const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File system operations
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  listDirectory: (dirPath) => ipcRenderer.invoke('list-directory', dirPath),
  getModulesPath: () => ipcRenderer.invoke('get-modules-path'),
  
  // PTY terminal operations
  startPty: (id, opts) => ipcRenderer.invoke('pty-start', id, opts),
  writePty: (id, data) => ipcRenderer.invoke('pty-write', id, data),
  resizePty: (id, cols, rows) => ipcRenderer.invoke('pty-resize', id, cols, rows),
  killPty: (id) => ipcRenderer.invoke('pty-kill', id),
  onPtyData: (id, cb) => {
    const h = (_e, sid, data) => { if (sid === id) cb(data); };
    ipcRenderer.on('pty:data', h);
    return () => ipcRenderer.off('pty:data', h);
  },
  onPtyExit: (id, cb) => {
    const h = (_e, sid) => { if (sid === id) cb(); };
    ipcRenderer.on('pty:exit', h);
    return () => ipcRenderer.off('pty:exit', h);
  },
  getRepoRoot: () => ipcRenderer.invoke('get-repo-root'),

  // Platform info
  platform: process.platform
});
