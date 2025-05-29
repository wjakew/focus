const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', {
    // From main to renderer
    onFileOpened: (callback) => ipcRenderer.on('file-opened', callback),
    onSaveFile: (callback) => ipcRenderer.on('save-file', callback),
    onWindowMaximized: (callback) => ipcRenderer.on('window-maximized', callback),
    onWindowUnmaximized: (callback) => ipcRenderer.on('window-unmaximized', callback),
    
    // From renderer to main
    saveFileContent: (content) => ipcRenderer.send('file-content', content),
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    maximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),
    
    // File operations
    newFile: () => ipcRenderer.send('new-file'),
    openFile: () => ipcRenderer.send('open-file'),
    saveFile: () => ipcRenderer.send('save-file'),
    saveFileAs: () => ipcRenderer.send('save-as')
  }
);