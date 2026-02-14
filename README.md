# OpenClaw Desktop App

A native macOS Electron desktop application for the [OpenClaw](https://github.com/open-claw/openclaw) control dashboard, featuring Apple Vision Pro-inspired glassmorphism and Mac Fluid design language.

---

## Features

- **Native macOS Electron app** with `hiddenInset` title bar, vibrancy, and transparency
- **Glassmorphism everywhere** -- frosted glass cards, sidebars, modals with `backdrop-filter: blur(24px)`
- **Premium font stack** -- Inter (body), Plus Jakarta Sans (display headings), JetBrains Mono (code/terminal)
- **Deep space color system** -- dark navy backgrounds (`#0a0a0f`) with electric cyan (`#00d4ff`) and violet (`#a855f7`) accents
- **Mac Fluid animations** -- spring-based transitions, hover-lift effects, smooth state changes
- **Smart gateway connection** -- auto-detects if the OpenClaw gateway is running, shows a connection screen with retry
- **Context-isolated preload** -- secure IPC bridge between renderer and main process
- **Custom application menu** -- About, Preferences, Edit, View, and Window menus
- **Preferences window** -- Configure gateway URL, vibrancy, and appearance
- **macOS app installer** -- Shell script to build and install as a proper .app bundle
- **CSS injection** -- Apply the Mac Fluid theme to the standard OpenClaw web dashboard
- **Neon status indicators** -- glowing green/red/amber indicators for agent status
- **Accent scrollbars** -- thin, rounded scrollbars matching the theme accent color
- **Accessibility** -- cyan focus rings, reduced-motion support

---

## Directory Structure

```
openclawapp/
├── main.js                 # Electron main process
├── preload.js              # Secure preload script (contextBridge IPC)
├── preferences.html        # Preferences window
├── package.json            # Electron app config + electron-builder
├── build/
│   └── index.html          # Electron entry HTML (gateway connector)
├── css/
│   ├── main.css            # Mac Fluid CSS for the Electron shell
│   └── custom-enhancements.css  # Full theme for the OpenClaw web dashboard
├── scripts/
│   ├── apply.sh            # CSS injection script for the web dashboard
│   └── install-openclaw.sh # macOS .app bundle installer
├── backups/
│   └── index.html.bak      # Backup of modified OpenClaw index.html
├── .gitignore
├── README.md
└── LICENSE                  # MIT
```

---

## Prerequisites

- **macOS** (Apple Silicon or Intel)
- **Node.js** >= 18.x
- **npm** >= 9.x
- [OpenClaw](https://github.com/open-claw/openclaw) installed (`npm i -g openclaw`)

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/bmmateru/openclawapp.git
cd openclawapp

# Install dependencies (Electron)
npm install

# Start the OpenClaw gateway (in another terminal)
openclaw gateway install

# Launch the desktop app
npm start
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Launch the Electron app (production mode) |
| `npm run dev` | Launch in development mode with DevTools (connects to `localhost:18789`) |
| `npm run build` | Build distributable package via electron-builder |
| `npm run build:mac` | Build macOS DMG for Apple Silicon |
| `npm run apply` | Apply the Mac Fluid CSS theme to the installed OpenClaw web dashboard |

---

## Development Mode

In dev mode, the app connects directly to `http://localhost:18789` (the OpenClaw gateway) and opens DevTools automatically:

```bash
npm run dev
```

---

## Production Mode

In production mode, the app loads `build/index.html`, which shows a connection screen and embeds the gateway dashboard in an iframe once connected:

```bash
npm start
```

---

## Building a macOS App Bundle

### Using electron-builder

```bash
npm run build:mac
```

This creates a DMG in the `dist/` directory targeting Apple Silicon (arm64).

### Using the installer script

```bash
bash scripts/install-openclaw.sh
```

This script will:
1. Install npm dependencies if needed
2. Build the .app bundle via electron-builder
3. Copy it to `/Applications/OpenClaw.app`

---

## Applying the Theme to the Web Dashboard

If you also use the OpenClaw web dashboard in a browser, apply the Mac Fluid theme:

```bash
bash scripts/apply.sh
```

This will:
1. Copy `css/custom-enhancements.css` to the OpenClaw UI assets directory
2. Inject Google Fonts preconnect links into `index.html`
3. Inject the custom CSS link into `index.html`
4. Update the viewport meta tag for mobile safe-area support

After applying, restart the gateway:

```bash
openclaw gateway stop && openclaw gateway install
```

---

## Architecture

### Electron Main Process (`main.js`)

The `OpenClawApp` class manages:
- **Window creation** with macOS vibrancy, transparent background, and hidden title bar
- **Application menu** with About, Preferences, Quit, and standard Edit/View/Window menus
- **IPC handlers** for system info and vibrancy control
- **External link handling** -- opens external URLs in the default browser
- **Window lifecycle** -- proper macOS behavior (stays alive when all windows closed)

### Preload Script (`preload.js`)

Securely exposes two IPC methods via `contextBridge`:
- `openclaw.getSystemInfo()` -- returns platform, macOS version, dark mode status
- `openclaw.setVibrancy(type)` -- changes the window vibrancy effect

### Entry HTML (`build/index.html`)

Smart connection screen that:
1. Attempts to connect to the OpenClaw gateway at `localhost:18789`
2. Shows a styled loading/error screen with retry button if offline
3. Loads the full dashboard in an iframe when the gateway responds
4. Includes a draggable titlebar region for macOS window controls

---

## CSS Architecture

### `css/main.css` (Electron Shell)

Styles for the Electron app shell: connection screen, glass cards, buttons, scrollbars, animations, and utility classes.

### `css/custom-enhancements.css` (Dashboard Theme)

The full 3200+ line theme stylesheet organized into numbered **PHASE** sections:

| Phase | Name | Description |
|-------|------|-------------|
| 0 | Premium Font Stack | Google Fonts import, font-family declarations |
| 1 | Color System Override | CSS custom properties: backgrounds, accents, borders |
| 2 | Body & Root Canvas | Base body styles, background gradients |
| 3-4 | Topbar & Navigation | Glassmorphism top bar and sidebar |
| 5-6 | Cards | Glass cards and stat cards with glow effects |
| 7 | Status Indicators | Neon pulsing dots |
| 8 | Buttons | Glass buttons with glow |
| 9-10 | Content & Chat | Main content area and chat interface |
| 11-12 | Chips & Logs | Tags, badges, terminal-aesthetic log viewer |
| 13 | Config Page | Settings/configuration redesign |
| 14-32 | Components | Tables, cron jobs, agents, forms, modals, etc. |
| 33-37 | UX & Accessibility | Animations, reduced-motion, print styles |

---

## Credits

- **Author**: Bernard Materu
- **AI Pair Programming**: Claude (Anthropic)
- **Design Inspiration**: Apple Vision Pro, macOS Sonoma, iOS 17 glassmorphism
- **Fonts**: [Inter](https://rsms.me/inter/), [Plus Jakarta Sans](https://github.com/tokotype/PlusJakartaSans), [JetBrains Mono](https://www.jetbrains.com/lp/mono/)
- **Target Platform**: [OpenClaw](https://github.com/open-claw/openclaw) Dashboard

---

## License

MIT License. See [LICENSE](LICENSE) for details.
