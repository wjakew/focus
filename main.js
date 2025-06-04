const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');

// Initialize store for app settings
const store = new Store();

// Keep a global reference of the window object
let mainWindow;
let currentFilePath = null;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'src/preload.js')
    },
    icon: path.join(__dirname, 'assets/icons/png/icon.png')
  });

  // Load the index.html file
  mainWindow.loadFile('src/index.html');

  // Build menu from template
  const mainMenu = Menu.buildFromTemplate(menuTemplate);
  // Insert menu
  Menu.setApplicationMenu(mainMenu);

  // Window control event handlers
  ipcMain.on('window-minimize', () => {
    mainWindow.minimize();
  });

  ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.on('window-close', () => {
    mainWindow.close();
  });

  // File operation handlers
  ipcMain.on('new-file', () => {
    newFile();
  });

  ipcMain.on('open-file', () => {
    openFile();
  });

  ipcMain.on('save-file', () => {
    saveFile();
  });

  ipcMain.on('save-as', () => {
    saveFileAs();
  });

  // Send maximize state to renderer
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximized');
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-unmaximized');
  });

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // Save current file path when closing the window
  mainWindow.on('close', () => {
    if (currentFilePath) {
      store.set('lastOpenedFile', currentFilePath);
    }
  });
  
  // Restore last opened file
  const lastOpenedFile = store.get('lastOpenedFile');
  if (lastOpenedFile && fs.existsSync(lastOpenedFile)) {
    currentFilePath = lastOpenedFile;
    fs.readFile(currentFilePath, 'utf8', (err, data) => {
      if (err) {
        console.error('An error occurred reading the file:', err);
        return;
      }
      
      // Add a slight delay to ensure the renderer process is ready
      setTimeout(() => {
        mainWindow.webContents.send('file-opened', { content: data, filePath: currentFilePath });
        mainWindow.setTitle(`Markdown Editor - ${path.basename(currentFilePath)}`);
      }, 500);
    });
  }
}

// Create menu template
const menuTemplate = [
  {
    label: 'File',
    submenu: [
      {
        label: 'New File',
        accelerator: process.platform === 'darwin' ? 'Command+N' : 'Ctrl+N',
        click() {
          if (currentFilePath) {
            const options = {
              type: 'question',
              buttons: ['Yes', 'No', 'Cancel'],
              defaultId: 0,
              title: 'Confirm',
              message: 'Do you want to save the current file before creating a new one?'
            };
            
            dialog.showMessageBox(mainWindow, options).then(result => {
              if (result.response === 0) {
                saveFile();
                newFile();
              } else if (result.response === 1) {
                newFile();
              }
            });
          } else {
            newFile();
          }
        }
      },
      {
        label: 'Open File',
        accelerator: process.platform === 'darwin' ? 'Command+O' : 'Ctrl+O',
        click() {
          openFile();
        }
      },
      {
        label: 'Save',
        accelerator: process.platform === 'darwin' ? 'Command+S' : 'Ctrl+S',
        click() {
          saveFile();
        }
      },
      {
        label: 'Save As',
        accelerator: process.platform === 'darwin' ? 'Command+Shift+S' : 'Ctrl+Shift+S',
        click() {
          saveFileAs();
        }
      },
      { type: 'separator' },
      {
        label: 'Exit',
        accelerator: process.platform === 'darwin' ? 'Command+Q' : 'Ctrl+Q',
        click() {
          app.quit();
        }
      }
    ]
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'delete' },
      { role: 'selectall' }
    ]
  },
  {
    label: 'View',
    submenu: [
      {
        label: 'Toggle Preview',
        accelerator: process.platform === 'darwin' ? 'Command+P' : 'Ctrl+P',
        click() {
          mainWindow.webContents.send('toggle-preview');
        }
      },
      { type: 'separator' },
      { role: 'reload' },
      { role: 'toggledevtools' },
      { type: 'separator' },
      { role: 'resetzoom' },
      { role: 'zoomin' },
      { role: 'zoomout' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  }
];

// Function to create a new file
function newFile() {
  currentFilePath = null;
  mainWindow.webContents.send('file-opened', { content: '', filePath: null });
  mainWindow.setTitle('Markdown Editor - Untitled');
}

// Function to open a file
function openFile() {
  dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Markdown Files', extensions: ['md', 'markdown'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  }).then(result => {
    if (!result.canceled) {
      currentFilePath = result.filePaths[0];
      fs.readFile(currentFilePath, 'utf8', (err, data) => {
        if (err) {
          console.error('An error occurred reading the file:', err);
          return;
        }
        
        mainWindow.webContents.send('file-opened', { content: data, filePath: currentFilePath });
        mainWindow.setTitle(`Markdown Editor - ${path.basename(currentFilePath)}`);
      });
    }
  }).catch(err => {
    console.log(err);
  });
}

// Function to save the current file
function saveFile() {
  if (currentFilePath) {
    mainWindow.webContents.send('save-file');
  } else {
    saveFileAs();
  }
}

// Function to save as a new file
function saveFileAs() {
  dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'Markdown Files', extensions: ['md'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  }).then(result => {
    if (!result.canceled) {
      currentFilePath = result.filePath;
      mainWindow.webContents.send('save-file');
      mainWindow.setTitle(`Markdown Editor - ${path.basename(currentFilePath)}`);
    }
  }).catch(err => {
    console.log(err);
  });
}

// Handle save file event
ipcMain.on('file-content', (event, content) => {
  if (currentFilePath) {
    fs.writeFile(currentFilePath, content, err => {
      if (err) {
        console.error('An error occurred writing the file:', err);
        return;
      }
      console.log('The file has been saved!');
    });
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', createWindow);

// Quit when all windows are closed
app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});