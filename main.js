const { app, BrowserWindow, Menu, nativeTheme, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

class OpenClawApp {
  constructor() {
    this.mainWindow = null;
    this.isDev = process.env.NODE_ENV === 'development';

    app.whenReady().then(() => this.createWindow());
    app.on('window-all-closed', this.handleWindowAllClosed.bind(this));
    app.on('activate', this.handleActivate.bind(this));

    this.setupIPC();
  }

  createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1024,
      minHeight: 768,
      titleBarStyle: 'hiddenInset',
      vibrancy: 'ultra-dark',
      transparent: true,
      frame: true,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true
      }
    });

    const startUrl = this.isDev
      ? 'http://localhost:18789'
      : `file://${path.join(__dirname, 'build/index.html')}`;

    this.mainWindow.loadURL(startUrl);

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
      if (process.platform === 'darwin') {
        app.dock.show();
      }
    });

    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    if (this.isDev) {
      this.mainWindow.webContents.openDevTools();
    }

    this.setupMenu();
  }

  setupMenu() {
    const template = [
      {
        label: 'OpenClaw',
        submenu: [
          { label: 'About OpenClaw', click: () => this.showAboutPanel() },
          { type: 'separator' },
          { label: 'Preferences', accelerator: 'Cmd+,', click: () => this.showPreferences() },
          { type: 'separator' },
          { label: 'Quit OpenClaw', accelerator: 'Cmd+Q', click: () => app.quit() }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
          { role: 'cut' }, { role: 'copy' }, { role: 'paste' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
          { type: 'separator' }, { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Window',
        submenu: [{ role: 'minimize' }, { role: 'close' }]
      }
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  }

  setupIPC() {
    ipcMain.handle('get-system-info', () => ({
      platform: process.platform,
      version: process.getSystemVersion(),
      isDarkMode: nativeTheme.shouldUseDarkColors
    }));
    ipcMain.handle('set-vibrancy', (event, vibrancyType) => {
      this.mainWindow.setVibrancy(vibrancyType);
    });
  }

  handleWindowAllClosed() {
    if (process.platform !== 'darwin') app.quit();
  }

  handleActivate() {
    if (BrowserWindow.getAllWindows().length === 0) this.createWindow();
  }

  showAboutPanel() {
    const aboutWindow = new BrowserWindow({
      width: 400, height: 300, modal: true, parent: this.mainWindow,
      titleBarStyle: 'hiddenInset', vibrancy: 'under-window', transparent: true
    });
    aboutWindow.loadURL(`data:text/html;charset=utf-8,
      <html><head><style>
        body { font-family: -apple-system, sans-serif; background: transparent; color: white; text-align: center; padding: 40px; }
        h1 { font-size: 24px; } p { opacity: 0.7; }
      </style></head><body>
        <h1>OpenClaw</h1>
        <p>Version ${app.getVersion()}</p>
        <p>Mac Fluid Edition</p>
      </body></html>`);
  }

  showPreferences() {
    const prefsWindow = new BrowserWindow({
      width: 600, height: 500, modal: true, parent: this.mainWindow,
      titleBarStyle: 'hiddenInset', vibrancy: 'under-window'
    });
    prefsWindow.loadURL(`file://${path.join(__dirname, 'preferences.html')}`);
  }
}

new OpenClawApp();
