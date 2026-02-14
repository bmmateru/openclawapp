const { app, BrowserWindow, Menu, nativeTheme, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { execFile, exec } = require('child_process');

// ─── Theme Definitions ───────────────────────────────────────────────
const THEMES = {
  'deep-space': {
    name: 'Deep Space',
    description: 'Cyan & violet on deep black',
    bg: '#0a0a0f', bgAccent: '#0d0d14', bgElevated: '#12121c',
    text: '#c8c8d8', textStrong: '#f0f0f8', muted: '#5a5a7a',
    accent: '#00d4ff', accentHover: '#33ddff', accent2: '#a855f7',
    border: 'rgba(255,255,255,0.06)', borderStrong: 'rgba(255,255,255,0.12)',
    cardBg: 'rgba(18,18,30,0.7)', glass: 'rgba(14,14,24,0.6)',
    ok: '#00e676', warn: '#ffab00', danger: '#ff3d71',
    scrollThumb: 'rgba(0,212,255,0.25)', scrollThumbHover: 'rgba(0,212,255,0.4)'
  },
  'arctic-frost': {
    name: 'Arctic Frost',
    description: 'Ice blue on slate — high contrast',
    bg: '#0c1117', bgAccent: '#0f1922', bgElevated: '#131f2e',
    text: '#d4e4f7', textStrong: '#f0f6ff', muted: '#6b8aab',
    accent: '#58b4ff', accentHover: '#7cc8ff', accent2: '#b48eff',
    border: 'rgba(88,180,255,0.10)', borderStrong: 'rgba(88,180,255,0.20)',
    cardBg: 'rgba(15,25,34,0.8)', glass: 'rgba(12,17,23,0.7)',
    ok: '#45d483', warn: '#f5a623', danger: '#f45d6b',
    scrollThumb: 'rgba(88,180,255,0.3)', scrollThumbHover: 'rgba(88,180,255,0.5)'
  },
  'ember-glow': {
    name: 'Ember Glow',
    description: 'Warm amber & crimson on charcoal',
    bg: '#110c08', bgAccent: '#1a120a', bgElevated: '#221810',
    text: '#e0d0c0', textStrong: '#f8f0e4', muted: '#8a7a6a',
    accent: '#ff8c38', accentHover: '#ffa45c', accent2: '#ff4466',
    border: 'rgba(255,140,56,0.10)', borderStrong: 'rgba(255,140,56,0.20)',
    cardBg: 'rgba(26,18,10,0.8)', glass: 'rgba(17,12,8,0.7)',
    ok: '#6dd58c', warn: '#ffd060', danger: '#ff4466',
    scrollThumb: 'rgba(255,140,56,0.3)', scrollThumbHover: 'rgba(255,140,56,0.5)'
  },
  'forest-canopy': {
    name: 'Forest Canopy',
    description: 'Emerald & gold on deep green-black',
    bg: '#080e0a', bgAccent: '#0c1610', bgElevated: '#111e16',
    text: '#c0d8c8', textStrong: '#e8f5ec', muted: '#5a8a6a',
    accent: '#3ddc84', accentHover: '#66e6a0', accent2: '#ffd54f',
    border: 'rgba(61,220,132,0.10)', borderStrong: 'rgba(61,220,132,0.20)',
    cardBg: 'rgba(12,22,16,0.8)', glass: 'rgba(8,14,10,0.7)',
    ok: '#3ddc84', warn: '#ffd54f', danger: '#ff6b6b',
    scrollThumb: 'rgba(61,220,132,0.3)', scrollThumbHover: 'rgba(61,220,132,0.5)'
  }
};

class OpenClawApp {
  constructor() {
    this.mainWindow = null;
    this.isDev = process.env.NODE_ENV === 'development';
    this.gatewayConfig = null;
    this.retryTimer = null;
    this.customCssPath = null;
    this.currentTheme = 'deep-space';
    this.settingsPath = path.join(process.env.HOME || '', '.openclaw', 'app-settings.json');
    this.injectedCssKeys = []; // Track CSS keys for removal on theme switch

    this.loadSettings();
    this.loadOpenClawConfig();

    app.whenReady().then(() => this.createWindow());
    app.on('window-all-closed', this.handleWindowAllClosed.bind(this));
    app.on('activate', this.handleActivate.bind(this));

    this.setupIPC();
  }

  // ─── Settings Persistence ──────────────────────────────────────────

  loadSettings() {
    try {
      const raw = fs.readFileSync(this.settingsPath, 'utf-8');
      const settings = JSON.parse(raw);
      if (settings.theme && THEMES[settings.theme]) {
        this.currentTheme = settings.theme;
      }
    } catch (e) {
      // First run — defaults are fine
    }
  }

  saveSettings() {
    try {
      const dir = path.dirname(this.settingsPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.settingsPath, JSON.stringify({ theme: this.currentTheme }, null, 2));
    } catch (e) {
      console.log('[OpenClaw] Could not save settings:', e.message);
    }
  }

  // ─── OpenClaw Config ───────────────────────────────────────────────

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
        break;
      } catch (e) { /* try next */ }
    }

    if (!this.gatewayConfig) {
      this.gatewayConfig = { port: 18789, bind: 'loopback', mode: 'none', token: '' };
    }

    const cssPath = path.join(process.env.HOME || '', '.openclaw', 'custom-ui', 'custom-enhancements.css');
    if (fs.existsSync(cssPath)) {
      this.customCssPath = cssPath;
    }
  }

  getGatewayUrl() {
    const base = `http://127.0.0.1:${this.gatewayConfig.port}`;
    if (this.gatewayConfig.mode === 'token' && this.gatewayConfig.token) {
      return `${base}?token=${this.gatewayConfig.token}`;
    }
    return base;
  }

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
      }, (res) => resolve(res.statusCode < 500));
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end();
    });
  }

  // ─── Theme CSS Generation ─────────────────────────────────────────

  getThemeCSS(themeId) {
    const t = THEMES[themeId || this.currentTheme] || THEMES['deep-space'];
    return `
      :root {
        --bg: ${t.bg} !important;
        --bg-accent: ${t.bgAccent} !important;
        --bg-elevated: ${t.bgElevated} !important;
        --bg-hover: ${t.bgElevated} !important;
        --bg-muted: ${t.bgAccent} !important;
        --text: ${t.text} !important;
        --text-strong: ${t.textStrong} !important;
        --chat-text: ${t.text} !important;
        --muted: ${t.muted} !important;
        --muted-foreground: ${t.muted} !important;
        --accent: ${t.accent} !important;
        --accent-hover: ${t.accentHover} !important;
        --accent-2: ${t.accent2} !important;
        --primary: ${t.accent} !important;
        --primary-foreground: ${t.bg} !important;
        --accent-foreground: ${t.bg} !important;
        --ring: ${t.accent} !important;
        --border: ${t.border} !important;
        --border-strong: ${t.borderStrong} !important;
        --input: ${t.border} !important;
        --card: ${t.cardBg} !important;
        --card-foreground: ${t.textStrong} !important;
        --popover: ${t.cardBg} !important;
        --popover-foreground: ${t.textStrong} !important;
        --panel: ${t.bg} !important;
        --panel-strong: ${t.bgElevated} !important;
        --chrome: ${t.glass} !important;
        --ok: ${t.ok} !important;
        --warn: ${t.warn} !important;
        --danger: ${t.danger} !important;
        --destructive: ${t.danger} !important;
      }
    `;
  }

  // ─── Main Window ──────────────────────────────────────────────────

  createWindow() {
    const t = THEMES[this.currentTheme];
    const windowOpts = {
      width: 1400, height: 900,
      minWidth: 800, minHeight: 600,
      show: false,
      backgroundColor: t.bg,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 16 },
      fullscreenable: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true
      }
    };

    if (process.platform === 'darwin') {
      windowOpts.vibrancy = 'sidebar';
      windowOpts.visualEffectState = 'active';
      windowOpts.roundedCorners = true;
    }

    this.mainWindow = new BrowserWindow(windowOpts);

    this.mainWindow.webContents.on('did-finish-load', () => {
      this.injectAppShell();
      this.injectCustomCSS();
      this.injectSoundEffects();
    });

    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
      if (process.platform === 'darwin') app.dock.show();
    });

    if (this.isDev) this.mainWindow.webContents.openDevTools();

    this.setupMenu();
    this.connectToGateway();
  }

  // ─── App Shell Injection ──────────────────────────────────────────

  async injectAppShell() {
    try {
      const t = THEMES[this.currentTheme];

      // Remove previously injected CSS to avoid stacking themes
      for (const key of this.injectedCssKeys) {
        try { await this.mainWindow.webContents.removeInsertedCSS(key); } catch (e) {}
      }
      this.injectedCssKeys = [];

      // 1. Theme + scroll-fix + layout CSS
      const cssKey = await this.mainWindow.webContents.insertCSS(`
        /* === OpenClaw Theme: ${t.name} === */
        ${this.getThemeCSS()}

        /* === Scroll & Layout Fixes === */
        html, body {
          overflow-x: hidden !important;
          max-width: 100vw !important;
          width: 100% !important;
          scrollbar-width: none !important;
        }
        body {
          padding-top: 38px !important;
          box-sizing: border-box !important;
          background: ${t.bg} !important;
        }
        html::-webkit-scrollbar, body::-webkit-scrollbar {
          display: none !important;
        }

        .shell, [class*="shell"], #app, #root, main, [role="main"],
        .content, .main-content, [class*="content"],
        .layout, [class*="layout"], .app-layout {
          max-width: 100vw !important;
          overflow-x: hidden !important;
        }

        pre, code, table, .table-wrapper {
          max-width: 100% !important;
          overflow-x: auto !important;
        }

        /* Thin elegant scrollbars for inner containers */
        *::-webkit-scrollbar {
          width: 5px !important;
          height: 5px !important;
        }
        *::-webkit-scrollbar-track {
          background: transparent !important;
        }
        *::-webkit-scrollbar-thumb {
          background: ${t.scrollThumb} !important;
          border-radius: 3px !important;
          transition: background 0.2s !important;
        }
        *::-webkit-scrollbar-thumb:hover {
          background: ${t.scrollThumbHover} !important;
        }

        .chat-thread, .messages, [class*="message-list"] {
          overflow-x: hidden !important;
          overflow-y: auto !important;
          max-width: 100% !important;
        }

        nav, .nav, .sidebar, [class*="sidebar"],
        .config-content, .settings, [class*="config"] {
          overflow-x: hidden !important;
          max-width: 100% !important;
        }

        .chat-thread, .content, .config-content, .log-stream {
          scroll-behavior: smooth !important;
          -webkit-overflow-scrolling: touch !important;
        }

        :fullscreen body, :-webkit-full-screen body {
          padding-top: 0 !important;
        }
      `);
      this.injectedCssKeys.push(cssKey);

      // 2. Drag region
      await this.mainWindow.webContents.executeJavaScript(`
        (function() {
          let d = document.getElementById('openclaw-drag-region');
          if (d) d.remove();
          d = document.createElement('div');
          d.id = 'openclaw-drag-region';
          d.style.cssText = 'position:fixed;top:0;left:0;right:0;height:38px;z-index:99999;-webkit-app-region:drag;pointer-events:auto;background:transparent';
          d.addEventListener('mousedown', function(e) {
            const el = e.target;
            if (['BUTTON','A','INPUT','SELECT','TEXTAREA'].includes(el.tagName) ||
                el.closest('button,a,input,textarea,select,[role="button"]')) {
              e.stopPropagation();
            }
          });
          document.body.appendChild(d);
        })();
      `);

      // 3. Fullscreen transitions
      this.mainWindow.removeAllListeners('enter-full-screen');
      this.mainWindow.removeAllListeners('leave-full-screen');
      this.mainWindow.on('enter-full-screen', () => {
        this.mainWindow.webContents.executeJavaScript(`
          document.body.style.paddingTop='0';
          var dr=document.getElementById('openclaw-drag-region');
          if(dr) dr.style.display='none';
        `).catch(() => {});
      });
      this.mainWindow.on('leave-full-screen', () => {
        this.mainWindow.webContents.executeJavaScript(`
          document.body.style.paddingTop='38px';
          var dr=document.getElementById('openclaw-drag-region');
          if(dr) dr.style.display='block';
        `).catch(() => {});
      });

      console.log(`[OpenClaw] App shell injected (theme: ${t.name})`);
    } catch (e) {
      console.log('[OpenClaw] Could not inject app shell:', e.message);
    }
  }

  async applyTheme(themeId) {
    if (!THEMES[themeId]) return;
    this.currentTheme = themeId;
    this.saveSettings();

    const t = THEMES[themeId];
    this.mainWindow.setBackgroundColor(t.bg);

    // Re-inject everything
    await this.injectAppShell();
    await this.injectCustomCSS();
  }

  // ─── Gateway Auto-Start ───────────────────────────────────────────

  startGateway() {
    return new Promise((resolve) => {
      const paths = [
        '/opt/homebrew/bin/openclaw',
        '/usr/local/bin/openclaw',
        path.join(process.env.HOME || '', '.local', 'bin', 'openclaw')
      ];

      let bin = null;
      for (const p of paths) {
        if (fs.existsSync(p)) { bin = p; break; }
      }

      if (!bin) {
        exec('which openclaw', (err, stdout) => {
          if (!err && stdout.trim()) bin = stdout.trim();
          if (!bin) return resolve(false);
          this._execGatewayStart(bin, resolve);
        });
        return;
      }

      this._execGatewayStart(bin, resolve);
    });
  }

  _execGatewayStart(bin, resolve) {
    console.log(`[OpenClaw] Starting gateway: ${bin} gateway install`);
    execFile(bin, ['gateway', 'install'], {
      timeout: 15000,
      env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` }
    }, (err, stdout) => {
      if (stdout) console.log(`[OpenClaw] Gateway: ${stdout.trim()}`);
      resolve(true);
    });
    setTimeout(() => resolve(true), 5000);
  }

  async connectToGateway() {
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }

    const isUp = await this.checkGateway();
    if (isUp) {
      console.log('[OpenClaw] Gateway is up, loading dashboard...');
      this.mainWindow.loadURL(this.getGatewayUrl());
    } else {
      console.log('[OpenClaw] Gateway offline, auto-starting...');
      this.showConnectionScreen('Starting gateway...');
      await this.startGateway();
      this.retryTimer = setTimeout(() => this.connectToGateway(), 3000);
    }
  }

  // ─── Connection Screen ────────────────────────────────────────────

  showConnectionScreen(statusMsg) {
    const t = THEMES[this.currentTheme];
    const msg = statusMsg || `Waiting for gateway on port ${this.gatewayConfig.port}...`;
    this.mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="color-scheme" content="dark">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:${t.bg};
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;color:${t.text}}
.drag{-webkit-app-region:drag;height:38px;width:100%;position:fixed;top:0;left:0;z-index:9999}
.c{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:24px;padding:40px;
  background:radial-gradient(ellipse 80% 50% at 50% -20%,${t.accent}08,transparent 60%),
    radial-gradient(ellipse 60% 40% at 80% 100%,${t.accent2}06,transparent 50%),${t.bg};
  text-align:center}
.logo{width:88px;height:88px;border-radius:24px;background:${t.glass};
  border:1px solid ${t.border};display:flex;align-items:center;justify-content:center;
  box-shadow:0 0 40px ${t.accent}20;animation:pulse 3s ease-in-out infinite}
@keyframes pulse{0%,100%{box-shadow:0 0 30px ${t.accent}15}50%{box-shadow:0 0 50px ${t.accent}30}}
.logo svg{width:48px;height:48px}
h1{font-size:30px;font-weight:800;letter-spacing:-0.03em;
  background:linear-gradient(135deg,${t.accent},${t.accent2});
  -webkit-background-clip:text;-webkit-text-fill-color:transparent}
.sub{font-size:14px;color:${t.muted}}
.card{background:${t.glass};border:1px solid ${t.border};
  backdrop-filter:blur(16px);border-radius:14px;padding:20px 28px;
  display:flex;align-items:center;gap:12px;font-size:14px}
.spin{width:20px;height:20px;border:2px solid ${t.border};
  border-top-color:${t.accent};border-radius:50%;animation:sp .8s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
.hint{font-size:12px;color:${t.muted};font-family:"SF Mono",monospace}
.hint code{background:${t.border};border:1px solid ${t.borderStrong};
  border-radius:6px;padding:2px 8px;color:${t.accent}}
</style></head><body>
<div class="drag"></div>
<div class="c">
  <div class="logo">
    <svg viewBox="0 0 48 48" fill="none"><path d="M24 4C12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20S35.05 4 24 4z" fill="none" stroke="url(#g)" stroke-width="2"/><path d="M16 18c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H18c-1.1 0-2-.9-2-2V18z" fill="none" stroke="url(#g)" stroke-width="1.5"/><circle cx="21" cy="23" r="2" fill="${t.accent}"/><circle cx="27" cy="23" r="2" fill="${t.accent2}"/><path d="M20 28s1.5 2 4 2 4-2 4-2" stroke="${t.accent}" stroke-width="1.5" stroke-linecap="round"/><defs><linearGradient id="g" x1="4" y1="4" x2="44" y2="44"><stop stop-color="${t.accent}"/><stop offset="1" stop-color="${t.accent2}"/></linearGradient></defs></svg>
  </div>
  <h1>OpenClaw</h1>
  <p class="sub">Mac Fluid Edition</p>
  <div class="card"><div class="spin"></div><span>${msg}</span></div>
  <p class="hint">Start manually: <code>openclaw gateway install</code></p>
</div></body></html>`)}`);
  }

  // ─── Custom CSS ───────────────────────────────────────────────────

  async injectCustomCSS() {
    if (!this.customCssPath) return;
    try {
      const css = fs.readFileSync(this.customCssPath, 'utf-8');
      const key = await this.mainWindow.webContents.insertCSS(css);
      this.injectedCssKeys.push(key);
    } catch (e) {
      console.log('[OpenClaw] Could not inject custom CSS:', e.message);
    }
  }

  // ─── Sound Effects ─────────────────────────────────────────────────

  async injectSoundEffects() {
    try {
      await this.mainWindow.webContents.executeJavaScript(`
        (function() {
          if (window.__openclawSounds) return;
          window.__openclawSounds = true;

          const ctx = new (window.AudioContext || window.webkitAudioContext)();

          // Subtle chime — two soft sine tones
          function playChime(type) {
            if (ctx.state === 'suspended') ctx.resume();
            const now = ctx.currentTime;
            const gain = ctx.createGain();
            gain.connect(ctx.destination);

            if (type === 'send') {
              // Message sent: short ascending double-tap
              gain.gain.setValueAtTime(0, now);
              gain.gain.linearRampToValueAtTime(0.06, now + 0.02);
              gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
              const o1 = ctx.createOscillator();
              o1.type = 'sine';
              o1.frequency.setValueAtTime(880, now);
              o1.connect(gain);
              o1.start(now);
              o1.stop(now + 0.15);
              const o2 = ctx.createOscillator();
              o2.type = 'sine';
              o2.frequency.setValueAtTime(1100, now + 0.08);
              const g2 = ctx.createGain();
              g2.gain.setValueAtTime(0, now);
              g2.gain.linearRampToValueAtTime(0.04, now + 0.1);
              g2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
              g2.connect(ctx.destination);
              o2.connect(g2);
              o2.start(now + 0.08);
              o2.stop(now + 0.3);

            } else if (type === 'receive') {
              // Response arrived: soft descending bell
              gain.gain.setValueAtTime(0, now);
              gain.gain.linearRampToValueAtTime(0.07, now + 0.01);
              gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
              const o1 = ctx.createOscillator();
              o1.type = 'sine';
              o1.frequency.setValueAtTime(1320, now);
              o1.frequency.exponentialRampToValueAtTime(880, now + 0.3);
              o1.connect(gain);
              o1.start(now);
              o1.stop(now + 0.5);
              // Harmonic overtone
              const o2 = ctx.createOscillator();
              o2.type = 'sine';
              o2.frequency.setValueAtTime(1760, now);
              o2.frequency.exponentialRampToValueAtTime(1320, now + 0.2);
              const g2 = ctx.createGain();
              g2.gain.setValueAtTime(0.02, now);
              g2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
              g2.connect(ctx.destination);
              o2.connect(g2);
              o2.start(now);
              o2.stop(now + 0.4);

            } else if (type === 'thinking') {
              // Thinking: very soft low hum pulse
              gain.gain.setValueAtTime(0, now);
              gain.gain.linearRampToValueAtTime(0.025, now + 0.1);
              gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
              gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
              const o1 = ctx.createOscillator();
              o1.type = 'sine';
              o1.frequency.setValueAtTime(440, now);
              o1.connect(gain);
              o1.start(now);
              o1.stop(now + 0.6);
            }
          }

          // Watch for chat activity via DOM mutations
          let wasThinking = false;
          let thinkingTimeout = null;

          const observer = new MutationObserver(function(mutations) {
            for (const m of mutations) {
              // Detect new nodes added
              for (const node of m.addedNodes) {
                if (!(node instanceof HTMLElement)) continue;
                const text = (node.className || '') + ' ' + (node.textContent || '');
                const lower = text.toLowerCase();

                // Detect thinking/loading indicators
                if (lower.includes('thinking') || lower.includes('loading') ||
                    lower.includes('spinner') || node.querySelector && node.querySelector('.spinner, [class*=loading], [class*=thinking]')) {
                  if (!wasThinking) {
                    wasThinking = true;
                    playChime('thinking');
                  }
                  clearTimeout(thinkingTimeout);
                  thinkingTimeout = setTimeout(function() { wasThinking = false; }, 3000);
                }

                // Detect assistant/bot response messages
                if ((node.className || '').match(/assistant|bot|response|ai-message|reply/i) ||
                    (node.getAttribute && (node.getAttribute('data-role') === 'assistant' ||
                     node.getAttribute('data-sender') === 'bot'))) {
                  if (wasThinking) {
                    wasThinking = false;
                    clearTimeout(thinkingTimeout);
                  }
                  playChime('receive');
                }
              }
            }
          });

          // Watch for form submissions (user sending messages)
          document.addEventListener('submit', function() {
            playChime('send');
          }, true);

          // Also watch for Enter key in chat inputs
          document.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
              const tag = e.target.tagName;
              const role = e.target.getAttribute('role') || '';
              if (tag === 'TEXTAREA' || tag === 'INPUT' || role === 'textbox' ||
                  e.target.contentEditable === 'true') {
                // Small delay to let the form submit
                setTimeout(function() { playChime('send'); }, 50);
              }
            }
          }, true);

          // Start observing
          observer.observe(document.body, {
            childList: true,
            subtree: true
          });

          console.log('[OpenClaw] Sound effects enabled (send/receive/thinking chimes)');
        })();
      `);
      console.log('[OpenClaw] Sound effects injected');
    } catch (e) {
      console.log('[OpenClaw] Could not inject sound effects:', e.message);
    }
  }

  // ─── Menu ─────────────────────────────────────────────────────────

  setupMenu() {
    const themeSubmenu = Object.entries(THEMES).map(([id, theme]) => ({
      label: theme.name,
      type: 'radio',
      checked: id === this.currentTheme,
      click: () => this.applyTheme(id)
    }));

    const template = [
      {
        label: 'OpenClaw',
        submenu: [
          { label: 'About OpenClaw', click: () => this.showAboutPanel() },
          { type: 'separator' },
          { label: 'Preferences...', accelerator: 'Cmd+,', click: () => this.showPreferences() },
          { type: 'separator' },
          { label: 'Reload Config', accelerator: 'Cmd+Shift+R', click: () => {
            this.loadOpenClawConfig();
            this.connectToGateway();
          }},
          { type: 'separator' },
          { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
          { type: 'separator' },
          { label: 'Quit OpenClaw', accelerator: 'Cmd+Q', click: () => app.quit() }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
          { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
          { role: 'selectAll' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
          { type: 'separator' },
          { label: 'Theme', submenu: themeSubmenu },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Window',
        role: 'windowMenu',
        submenu: [
          { role: 'minimize' }, { role: 'zoom' },
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

  // ─── IPC ──────────────────────────────────────────────────────────

  setupIPC() {
    ipcMain.handle('get-system-info', () => ({
      platform: process.platform,
      version: process.getSystemVersion(),
      isDarkMode: nativeTheme.shouldUseDarkColors
    }));
    ipcMain.handle('set-vibrancy', (_, type) => this.mainWindow.setVibrancy(type));
    ipcMain.handle('get-gateway-config', () => ({
      port: this.gatewayConfig.port,
      mode: this.gatewayConfig.mode,
      hasToken: !!this.gatewayConfig.token
    }));
    ipcMain.handle('reconnect-gateway', () => {
      this.loadOpenClawConfig();
      this.connectToGateway();
    });
    ipcMain.handle('get-themes', () => {
      return { themes: THEMES, current: this.currentTheme };
    });
    ipcMain.handle('set-theme', (_, themeId) => {
      this.applyTheme(themeId);
      this.setupMenu(); // Update radio checks
    });
  }

  handleWindowAllClosed() {
    if (process.platform !== 'darwin') app.quit();
  }

  handleActivate() {
    if (BrowserWindow.getAllWindows().length === 0) this.createWindow();
  }

  // ─── About Panel ──────────────────────────────────────────────────

  showAboutPanel() {
    const t = THEMES[this.currentTheme];
    const about = new BrowserWindow({
      width: 400, height: 300,
      parent: this.mainWindow,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 14, y: 14 },
      backgroundColor: t.bg,
      resizable: false,
      minimizable: true,
      maximizable: false,
      fullscreenable: false
    });
    if (process.platform === 'darwin') about.setVibrancy('under-window');

    about.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
<html><head><meta name="color-scheme" content="dark"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;background:${t.bg};color:${t.text}}
body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center}
.drag{-webkit-app-region:drag;position:fixed;top:0;left:0;right:0;height:38px;z-index:10}
.logo{width:56px;height:56px;border-radius:14px;background:${t.glass};
  border:1px solid ${t.border};display:flex;align-items:center;justify-content:center;
  box-shadow:0 0 24px ${t.accent}15}
.logo svg{width:32px;height:32px}
h1{font-size:22px;font-weight:800;letter-spacing:-0.02em;
  background:linear-gradient(135deg,${t.accent},${t.accent2});
  -webkit-background-clip:text;-webkit-text-fill-color:transparent}
.ver{font-size:13px;color:${t.muted}}
.meta{font-size:11px;color:${t.muted};font-family:"SF Mono",monospace;opacity:0.7}
</style></head><body>
<div class="drag"></div>
<div class="logo">
  <svg viewBox="0 0 48 48" fill="none"><path d="M24 4C12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20S35.05 4 24 4z" fill="none" stroke="url(#g)" stroke-width="2"/><path d="M16 18c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H18c-1.1 0-2-.9-2-2V18z" fill="none" stroke="url(#g)" stroke-width="1.5"/><circle cx="21" cy="23" r="2" fill="${t.accent}"/><circle cx="27" cy="23" r="2" fill="${t.accent2}"/><path d="M20 28s1.5 2 4 2 4-2 4-2" stroke="${t.accent}" stroke-width="1.5" stroke-linecap="round"/><defs><linearGradient id="g" x1="4" y1="4" x2="44" y2="44"><stop stop-color="${t.accent}"/><stop offset="1" stop-color="${t.accent2}"/></linearGradient></defs></svg>
</div>
<h1>OpenClaw</h1>
<p class="ver">Version ${app.getVersion()} — Mac Fluid Edition</p>
<p class="meta">Electron ${process.versions.electron} · Node ${process.versions.node} · Chromium ${process.versions.chrome}</p>
</body></html>`)}`);
  }

  // ─── Preferences ──────────────────────────────────────────────────

  showPreferences() {
    const t = THEMES[this.currentTheme];
    const prefs = new BrowserWindow({
      width: 560, height: 540,
      parent: this.mainWindow,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 14, y: 14 },
      backgroundColor: t.bg,
      resizable: true,
      minimizable: true,
      maximizable: false,
      fullscreenable: false,
      minWidth: 420,
      minHeight: 400,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true
      }
    });
    if (process.platform === 'darwin') prefs.setVibrancy('under-window');
    prefs.loadURL(`file://${path.join(__dirname, 'preferences.html')}`);
  }
}

new OpenClawApp();
