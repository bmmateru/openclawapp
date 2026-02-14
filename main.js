const { app, BrowserWindow, Menu, nativeTheme, ipcMain, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { execFile, exec } = require('child_process');

class OpenClawApp {
  constructor() {
    this.mainWindow = null;
    this.isDev = process.env.NODE_ENV === 'development';
    this.gatewayConfig = null;
    this.retryTimer = null;
    this.customCssPath = null;

    this.loadOpenClawConfig();

    app.whenReady().then(() => this.createWindow());
    app.on('window-all-closed', this.handleWindowAllClosed.bind(this));
    app.on('activate', this.handleActivate.bind(this));

    this.setupIPC();
  }

  /**
   * Read ~/.openclaw/openclaw.json to get gateway URL, port, and auth token
   */
  loadOpenClawConfig() {
    const configPaths = [
      path.join(process.env.HOME || '', '.openclaw', 'openclaw.json'),
      path.join(process.env.HOME || '', '.config', 'openclaw', 'openclaw.json')
    ];

    for (const configPath of configPaths) {
      try {
        const raw = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(raw);
        const gw = config.gateway || {};
        this.gatewayConfig = {
          port: gw.port || 18789,
          bind: gw.bind || 'loopback',
          mode: (gw.auth && gw.auth.mode) || 'none',
          token: (gw.auth && gw.auth.token) || ''
        };
        console.log(`[OpenClaw] Config loaded from ${configPath}`);
        console.log(`[OpenClaw] Gateway: localhost:${this.gatewayConfig.port} (auth: ${this.gatewayConfig.mode})`);
        break;
      } catch (e) {
        // Try next path
      }
    }

    if (!this.gatewayConfig) {
      console.log('[OpenClaw] No config found, using defaults (localhost:18789, no auth)');
      this.gatewayConfig = { port: 18789, bind: 'loopback', mode: 'none', token: '' };
    }

    // Locate custom CSS
    const cssPath = path.join(process.env.HOME || '', '.openclaw', 'custom-ui', 'custom-enhancements.css');
    if (fs.existsSync(cssPath)) {
      this.customCssPath = cssPath;
      console.log(`[OpenClaw] Custom CSS found: ${cssPath}`);
    }
  }

  /**
   * Build the gateway URL with auth token
   */
  getGatewayUrl() {
    const base = `http://127.0.0.1:${this.gatewayConfig.port}`;
    if (this.gatewayConfig.mode === 'token' && this.gatewayConfig.token) {
      return `${base}?token=${this.gatewayConfig.token}`;
    }
    return base;
  }

  /**
   * Check if the gateway is reachable
   */
  checkGateway() {
    return new Promise((resolve) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: this.gatewayConfig.port,
        path: '/',
        method: 'HEAD',
        timeout: 3000,
        headers: this.gatewayConfig.mode === 'token'
          ? { 'Authorization': `Bearer ${this.gatewayConfig.token}` }
          : {}
      }, (res) => {
        resolve(res.statusCode < 500);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end();
    });
  }

  createWindow() {
    const windowOpts = {
      width: 1400,
      height: 900,
      minWidth: 800,
      minHeight: 600,
      show: false,
      backgroundColor: '#0a0a0f',
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 16 },
      fullscreenable: true,
      fullscreen: false,
      simpleFullscreen: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true
      }
    };

    // macOS-specific native features
    if (process.platform === 'darwin') {
      windowOpts.vibrancy = 'sidebar';
      windowOpts.visualEffectState = 'active';
      windowOpts.roundedCorners = true;
    }

    this.mainWindow = new BrowserWindow(windowOpts);

    // Inject drag region + custom CSS after every page load
    this.mainWindow.webContents.on('did-finish-load', () => {
      this.injectDragRegion();
      this.injectCustomCSS();
    });

    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
      if (process.platform === 'darwin') {
        app.dock.show();
      }
    });

    // Native macOS window state events
    this.mainWindow.on('enter-full-screen', () => {
      console.log('[OpenClaw] Entered fullscreen');
    });
    this.mainWindow.on('leave-full-screen', () => {
      console.log('[OpenClaw] Left fullscreen');
    });

    if (this.isDev) {
      this.mainWindow.webContents.openDevTools();
    }

    this.setupMenu();
    this.connectToGateway();
  }

  /**
   * Inject a native macOS drag region into the top of any loaded page
   */
  async injectDragRegion() {
    try {
      await this.mainWindow.webContents.executeJavaScript(`
        (function() {
          // Remove any existing drag region
          const existing = document.getElementById('openclaw-drag-region');
          if (existing) existing.remove();

          // Create drag region overlay
          const drag = document.createElement('div');
          drag.id = 'openclaw-drag-region';
          drag.style.cssText = [
            'position: fixed',
            'top: 0',
            'left: 0',
            'right: 0',
            'height: 38px',
            'z-index: 99999',
            '-webkit-app-region: drag',
            'pointer-events: auto',
            'background: transparent'
          ].join(';');

          // Make buttons/links inside the drag region clickable (no-drag)
          drag.addEventListener('mousedown', function(e) {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' ||
                e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' ||
                e.target.closest('button') || e.target.closest('a') ||
                e.target.closest('[role="button"]')) {
              e.stopPropagation();
            }
          });

          document.body.appendChild(drag);

          // Add padding to body so content isn't hidden behind traffic lights
          document.body.style.paddingTop = '38px';
        })();
      `);
      console.log('[OpenClaw] Drag region injected');
    } catch (e) {
      console.log('[OpenClaw] Could not inject drag region:', e.message);
    }
  }

  /**
   * Try to start the OpenClaw gateway automatically
   */
  startGateway() {
    return new Promise((resolve) => {
      // Find openclaw binary
      const openclawPaths = [
        '/opt/homebrew/bin/openclaw',
        '/usr/local/bin/openclaw',
        path.join(process.env.HOME || '', '.local', 'bin', 'openclaw')
      ];

      let openclawBin = null;
      for (const p of openclawPaths) {
        if (fs.existsSync(p)) { openclawBin = p; break; }
      }

      if (!openclawBin) {
        // Try PATH lookup
        exec('which openclaw', (err, stdout) => {
          if (!err && stdout.trim()) {
            openclawBin = stdout.trim();
          }
          if (!openclawBin) {
            console.log('[OpenClaw] openclaw binary not found, cannot auto-start gateway');
            return resolve(false);
          }
          this._execGatewayStart(openclawBin, resolve);
        });
        return;
      }

      this._execGatewayStart(openclawBin, resolve);
    });
  }

  _execGatewayStart(bin, resolve) {
    console.log(`[OpenClaw] Starting gateway via: ${bin} gateway install`);
    const child = execFile(bin, ['gateway', 'install'], {
      timeout: 15000,
      env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` }
    }, (err, stdout, stderr) => {
      if (err) {
        console.log(`[OpenClaw] Gateway start returned: ${err.message}`);
        // Not necessarily an error — gateway may already be running
      }
      if (stdout) console.log(`[OpenClaw] Gateway stdout: ${stdout.trim()}`);
      resolve(true);
    });
    // Don't wait for it to fully finish — it may daemonize
    setTimeout(() => resolve(true), 5000);
  }

  /**
   * Attempt to connect to the gateway, auto-start if offline, show connection screen while waiting
   */
  async connectToGateway() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    const isUp = await this.checkGateway();

    if (isUp) {
      console.log('[OpenClaw] Gateway is up, loading dashboard...');
      const url = this.getGatewayUrl();
      this.mainWindow.loadURL(url);
    } else {
      console.log('[OpenClaw] Gateway offline, attempting auto-start...');
      this.showConnectionScreen('Starting gateway...');
      await this.startGateway();
      // Give gateway a moment to initialize, then retry
      this.retryTimer = setTimeout(() => this.connectToGateway(), 3000);
    }
  }

  /**
   * Show the offline/connecting screen
   */
  showConnectionScreen(statusMsg) {
    const port = this.gatewayConfig.port;
    const message = statusMsg || `Waiting for gateway on port ${port}...`;
    this.mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="color-scheme" content="dark" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%; height: 100%; overflow: hidden;
      background: #0a0a0f;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
      -webkit-font-smoothing: antialiased;
      color: #c8c8d8;
    }
    .titlebar {
      -webkit-app-region: drag;
      height: 38px; width: 100%; position: fixed; top: 0; left: 0; z-index: 9999;
    }
    .container {
      width: 100%; height: 100%;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 24px; padding: 40px;
      background:
        radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0, 212, 255, 0.05) 0%, transparent 60%),
        radial-gradient(ellipse 60% 40% at 80% 100%, rgba(168, 85, 247, 0.03) 0%, transparent 50%),
        #0a0a0f;
      text-align: center;
    }
    .logo-glow {
      width: 100px; height: 100px; border-radius: 28px;
      background: rgba(14, 14, 24, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(24px) saturate(180%);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 40px rgba(0, 212, 255, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.02) inset;
      animation: logoPulse 3s ease-in-out infinite;
    }
    @keyframes logoPulse {
      0%, 100% { box-shadow: 0 0 30px rgba(0, 212, 255, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.02) inset; }
      50% { box-shadow: 0 0 50px rgba(0, 212, 255, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.04) inset; }
    }
    .logo-glow svg { width: 52px; height: 52px; }
    h1 {
      font-size: 32px; font-weight: 800; letter-spacing: -0.03em;
      background: linear-gradient(135deg, #00d4ff, #a855f7);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .subtitle { font-size: 15px; color: #5a5a7a; max-width: 420px; }
    .status-card {
      background: rgba(14, 14, 24, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(16px) saturate(150%);
      border-radius: 14px; padding: 24px 32px;
      display: flex; flex-direction: column; align-items: center; gap: 16px;
      min-width: 360px;
    }
    .status-row { display: flex; align-items: center; gap: 12px; font-size: 14px; }
    .spinner {
      width: 24px; height: 24px;
      border: 2px solid rgba(255, 255, 255, 0.06);
      border-top-color: #00d4ff; border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .hint {
      font-size: 12px; color: #44446a;
      font-family: "SF Mono", monospace;
    }
    .hint code {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 6px; padding: 2px 8px; color: #00d4ff;
    }
    .config-info {
      font-size: 11px; color: #33335a;
      font-family: "SF Mono", monospace;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="titlebar"></div>
  <div class="container">
    <div class="logo-glow">
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M24 4C12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20S35.05 4 24 4z" fill="none" stroke="url(#grad)" stroke-width="2"/>
        <path d="M16 18c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H18c-1.1 0-2-.9-2-2V18z" fill="none" stroke="url(#grad)" stroke-width="1.5"/>
        <circle cx="21" cy="23" r="2" fill="#00d4ff"/>
        <circle cx="27" cy="23" r="2" fill="#a855f7"/>
        <path d="M20 28s1.5 2 4 2 4-2 4-2" stroke="#00d4ff" stroke-width="1.5" stroke-linecap="round"/>
        <defs><linearGradient id="grad" x1="4" y1="4" x2="44" y2="44"><stop stop-color="#00d4ff"/><stop offset="1" stop-color="#a855f7"/></linearGradient></defs>
      </svg>
    </div>
    <h1>OpenClaw</h1>
    <p class="subtitle">Mac Fluid Edition — Connecting to gateway...</p>
    <div class="status-card">
      <div class="status-row">
        <div class="spinner"></div>
        <span>${message}</span>
      </div>
    </div>
    <p class="hint">Gateway not running? Start it with <code>openclaw gateway install</code></p>
    <p class="config-info">Config: ~/.openclaw/openclaw.json &bull; Auth: token &bull; Auto-retry: 3s</p>
  </div>
</body>
</html>`)}`);
  }

  /**
   * Inject custom CSS into the loaded page
   */
  async injectCustomCSS() {
    if (!this.customCssPath) return;
    try {
      const css = fs.readFileSync(this.customCssPath, 'utf-8');
      await this.mainWindow.webContents.insertCSS(css);
      console.log('[OpenClaw] Custom CSS injected');
    } catch (e) {
      console.log('[OpenClaw] Could not inject custom CSS:', e.message);
    }
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
          { label: 'Reload Config', accelerator: 'Cmd+Shift+R', click: () => {
            this.loadOpenClawConfig();
            this.connectToGateway();
          }},
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
        role: 'windowMenu',
        submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'close' }
        ]
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
    ipcMain.handle('get-gateway-config', () => ({
      port: this.gatewayConfig.port,
      mode: this.gatewayConfig.mode,
      hasToken: !!this.gatewayConfig.token
    }));
    ipcMain.handle('reconnect-gateway', () => {
      this.loadOpenClawConfig();
      this.connectToGateway();
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
      width: 420, height: 320, modal: true, parent: this.mainWindow,
      titleBarStyle: 'hiddenInset',
      backgroundColor: '#0a0a0f',
      resizable: false,
      minimizable: false,
      maximizable: false
    });
    aboutWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
<html><head><meta name="color-scheme" content="dark"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    background: #0a0a0f; color: #c8c8d8;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 100vh; gap: 12px; text-align: center;
  }
  .drag { -webkit-app-region: drag; position: fixed; top: 0; left: 0; right: 0; height: 38px; }
  h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.02em;
    background: linear-gradient(135deg, #00d4ff, #a855f7);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .version { font-size: 14px; color: #5a5a7a; }
  .edition { font-size: 12px; color: #44446a; margin-top: 4px; }
</style></head><body>
  <div class="drag"></div>
  <h1>OpenClaw</h1>
  <p class="version">Version ${app.getVersion()}</p>
  <p class="edition">Mac Fluid Edition</p>
  <p class="edition">Electron ${process.versions.electron} &bull; Node ${process.versions.node}</p>
</body></html>`)}`);
  }

  showPreferences() {
    const prefsWindow = new BrowserWindow({
      width: 600, height: 500, modal: true, parent: this.mainWindow,
      titleBarStyle: 'hiddenInset', vibrancy: 'under-window',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true
      }
    });
    prefsWindow.loadURL(`file://${path.join(__dirname, 'preferences.html')}`);
  }
}

new OpenClawApp();
