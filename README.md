# OpenClaw Dashboard -- Mac Fluid Modernization Theme

A premium dark theme for the [OpenClaw](https://github.com/open-claw/openclaw) control dashboard, inspired by Apple Vision Pro glassmorphism and macOS Fluid design language.

![Theme Preview](screenshots/preview.png)
<!-- Add screenshots to a screenshots/ directory -->

---

## Features

- **Glassmorphism everywhere** -- frosted glass cards, sidebars, modals, and popovers with `backdrop-filter: blur(24px)`
- **Premium font stack** -- Inter (body), Plus Jakarta Sans (display headings), JetBrains Mono (code/terminal)
- **Deep space color system** -- dark navy backgrounds (`#0a0a0f`) with electric cyan (`#00d4ff`) and violet (`#a855f7`) accents
- **Mac Fluid animations** -- spring-based transitions, hover-lift effects, and smooth state changes
- **Neon status indicators** -- glowing green/red/amber indicators for agent status, cron jobs, and health checks
- **Terminal-aesthetic log stream** -- monospace log viewer with syntax-highlighted severity levels
- **Animated gradient borders** -- subtle cyan-to-violet animated borders on the shell container
- **Accent scrollbars** -- thin, rounded scrollbars matching the theme accent color
- **Mobile-first responsive** -- bottom tab bar on mobile, collapsible sidebar, touch-friendly targets
- **Accessibility** -- cyan focus rings, reduced-motion support, print-friendly styles
- **Claw marks** -- decorative animated gradient accents on active navigation items

---

## Screenshots

> Add screenshots to a `screenshots/` directory and update the paths above.

---

## Installation

### Prerequisites

- [OpenClaw](https://github.com/open-claw/openclaw) installed via Homebrew (`brew install openclaw` or `npm i -g openclaw`)
- macOS (the apply script uses `sed -i ''` which is macOS-specific)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/bmmateru/openclawapp.git
cd openclawapp

# Apply the theme
bash scripts/apply.sh

# Restart the gateway
openclaw gateway stop && openclaw gateway install
```

### Manual Installation

1. Copy `css/custom-enhancements.css` to your OpenClaw UI assets directory:
   ```bash
   cp css/custom-enhancements.css /opt/homebrew/lib/node_modules/openclaw/dist/control-ui/assets/
   ```

2. Edit `/opt/homebrew/lib/node_modules/openclaw/dist/control-ui/index.html` and add before `</head>`:
   ```html
   <link rel="stylesheet" href="./assets/custom-enhancements.css">
   ```

3. Add Google Fonts (optional, the CSS also imports them via `@import`):
   ```html
   <link rel="preconnect" href="https://fonts.googleapis.com" />
   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
   <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500;600&display=swap" rel="stylesheet" />
   ```

---

## Usage

### Applying the Theme

Run the apply script whenever OpenClaw updates (updates overwrite `index.html`):

```bash
bash scripts/apply.sh
```

The script will:
1. Copy the CSS to the OpenClaw UI assets directory
2. Sync the CSS to `~/.openclaw/custom-ui/` for backward compatibility
3. Inject Google Fonts preconnect links into `index.html`
4. Inject the custom CSS `<link>` into `index.html`
5. Update the viewport meta tag for mobile safe-area support

### After Applying

Restart the OpenClaw gateway to pick up changes:

```bash
openclaw gateway stop && openclaw gateway install
```

Then open the dashboard in your browser (default: `http://localhost:3080`).

---

## CSS Architecture

The stylesheet is organized into a numbered **PHASE system** for maintainability and logical layering:

| Phase | Name | Description |
|-------|------|-------------|
| **0** | Premium Font Stack | Google Fonts import, font-family declarations |
| **1** | Color System Override | CSS custom properties: backgrounds, accents, borders, shadows |
| **2** | Body & Root Canvas | Base body styles, background gradients, font rendering |
| **3** | Glassmorphism Topbar | Frosted glass top navigation bar |
| **4** | Navigation -- Glass Sidebar | Sidebar with glass effect, nav items, claw marks |
| **5** | Glass Cards | Generic card component glassmorphism |
| **6** | Stat Cards -- Futuristic | Dashboard metric cards with glow effects |
| **7** | Status Indicators -- Neon Glow | Pulsing neon dots for online/offline/error states |
| **8** | Buttons -- Glass with Glow | Primary, secondary, destructive button styles |
| **9** | Content Area | Main content panel layout and spacing |
| **10** | Chat -- Premium Experience | Chat interface with glass bubbles and typing indicators |
| **11** | Chips & Pills -- Glass Variants | Tags, badges, and status pills |
| **12** | Log Stream -- Terminal Aesthetic | Monospace log viewer with severity coloring |
| **13** | Config Page -- Complete Premium Overhaul | Settings/configuration page redesign |
| **14** | Lists & Tables -- Glass Rows | Table and list styles with hover effects |
| **15** | Cron Jobs -- Complete Redesign | Cron job management interface |
| **16** | Agent Cards -- Premium | AI agent cards with status indicators |
| **17** | Theme Toggle -- Glass | Dark/light theme toggle button |
| **18** | Form Fields -- Glass Inputs | Input, select, textarea with glass styling |
| **19** | Callouts -- Glass Variants | Info/warning/error callout boxes |
| **20** | Code Blocks -- Deep Terminal | Syntax-highlighted code blocks |
| **21** | Exec Approval -- Glass Modal | Execution approval modal dialog |
| **22** | QR Code -- Glass Card | QR code display card |
| **23** | Focus/Accessibility -- Cyan Ring | Focus indicators for keyboard navigation |
| **24** | Link Styles | Anchor tag styling with accent colors |
| **25** | Compaction Indicator -- Glass | Memory compaction status indicator |
| **27** | Agents Overview -- Glass Grid | Agent overview grid layout |
| **28** | Skills -- Glass Cards | Skill/tool cards |
| **31** | Mobile Bottom Tab Bar | Responsive mobile navigation |
| **32** | Animated Gradient Border on Shell | Animated cyan-to-violet border |
| **33** | UX & Usability Enhancements | Scrollbars, tooltips, transitions |
| **35** | Mac Fluid Modernization | Spring animations, fluid motion |
| **36** | Reduced Motion | `prefers-reduced-motion` support |
| **37** | Print | Print-friendly styles |

### Editing Guidelines

- Each phase is self-contained and clearly commented
- Use the CSS custom properties defined in Phase 1 for consistency
- Test with `prefers-reduced-motion` for accessibility
- The `!important` flags are necessary to override OpenClaw's built-in styles

---

## File Structure

```
openclawapp/
+-- scripts/
|   +-- apply.sh              # Theme application script
+-- css/
|   +-- custom-enhancements.css  # Main theme stylesheet (~3200 lines)
+-- backups/
|   +-- index.html.bak        # Backup of modified index.html
+-- .gitignore
+-- README.md
+-- LICENSE                    # MIT License
+-- package.json               # Project metadata and version
```

---

## Backup & Recovery

A backup of the modified `index.html` is stored in `backups/index.html.bak`. To restore the original OpenClaw dashboard:

```bash
# Reinstall OpenClaw to get a fresh index.html
npm i -g openclaw

# Or manually remove the custom CSS
rm /opt/homebrew/lib/node_modules/openclaw/dist/control-ui/assets/custom-enhancements.css
```

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
