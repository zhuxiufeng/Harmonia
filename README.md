# Harmonia (Chrome Manifest V3 Edition)

> **Tabs? Where we're listening, we don't need tabs.**
> A modern, elegant, lightweight Pandora internet radio player extension rebuilt from the ground up for **Google Chrome Manifest V3**.

[![License: GPL-2.0](https://img.shields.io/badge/License-GPL_v2-blue.svg)](./LICENSE)
[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-brightgreen.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Release](https://img.shields.io/github/v/release/zhuxiufeng/Harmonia?color=orange)](https://github.com/zhuxiufeng/Harmonia/releases/latest)

---

## ⚖️ Disclaimer

- **Educational & Interoperability Research Only**: This project is developed solely for technical study, reverse-engineering interoperability research, and educational purposes.
- **No Official Affiliation**: Harmonia is an independent third-party Web client and is not affiliated with, endorsed, sponsored, or certified by Pandora Media, LLC or SiriusXM.
- **Intellectual Property**: All music streams, artist names, album art, trademarks, and service marks belong to their respective copyright holders.

---

## 🌟 Modern MV3 Architecture & Technical Highlights

As Google Chrome phases out Manifest V2, legacy extensions relying on persistent background pages (`background.htm`) and synchronous DOM access (`chrome.extension.getBackgroundPage()`) no longer function. 

**Harmonia** re-architects the entire runtime to fully comply with **Chrome Manifest V3 specifications** while preserving a seamless, low-latency audio experience:

| Feature / Mechanism | Legacy (MV2) | Harmonia (MV3) |
| :--- | :--- | :--- |
| **Manifest Spec** | `manifest_version: 2` (Deprecated) | **`manifest_version: 3`** (Active standard) |
| **Background Host** | Persistent DOM (`background.htm`) | **Service Worker** (`sw.js`) + **Chrome Offscreen Document** (`offscreen.html`) |
| **Media Playback** | `<audio>` in persistent background DOM | Dedicated sandboxed **`chrome.offscreen`** (`AUDIO_PLAYBACK` reason) |
| **Cross-Context Comms** | Synchronous `getBackgroundPage()` calls | **Transparent Async RPC Bridge (`bridge.js` & `offscreen_bridge.js`)** providing zero-friction shims |
| **Request Header Spoofing** | Blocking `webRequest` API (Forbidden in MV3) | Declarative **`declarativeNetRequest`** engine seamlessly setting `User-Agent: libcurl` |
| **Action & Shortcuts** | `browserAction` API | Unified **`action`** / **`_execute_action`** routed through Service Worker |
| **Permissions** | Broad wildcard host permissions | Minimalist scoped `permissions` (`offscreen`, `storage`, `declarativeNetRequest`, `commands`) |

---

## 🚀 Features

1. **Full Pandora Core Capabilities**:
   - Native Blowfish decryption (ECB mode) for API telemetry.
   - Account authentication & persistent session management.
   - Station browsing, switching, QuickMix playback, station search, and station creation/deletion.
   - Thumbs Up, Thumbs Down, Tired of Song (Sleep track), and "Why is this song playing" explanations.
2. **Obsidian Aesthetic & Immersive Dual Views**:
   - **Modern Obsidian Visual Identity**: Crafted with dark frosted glassmorphism and radiant coral-to-amber gold glowing vector glyphs.
   - **Cozy Mode**: Large interactive card UI featuring dynamic album art backdrop, smooth navigation tabs, track history, and account manager.
   - **Compact Mode**: Ultra-slim toolbar strip view ideal for side-by-side work and multitasking.
3. **Synchronized Lyrics Integration**:
   - Deeply integrated with [LRCLIB](https://lrclib.net/) to automatically query, sync, and smoothly scroll lyrics in real-time.
4. **Preconnect & Fast Start Optimizations**:
   - Network DNS-Prefetch and TCP/TLS Preconnect for Pandora CDN endpoints, achieving near-zero latency track buffering and gapless switching.
5. **System-Level OS Media Integration**:
   - **MediaSession API**: Shows rich metadata (song title, artist, album art) in Windows / macOS / Linux OS Media Control Centers and Chrome Global Media Controls, with full keyboard hardware media keys support.
   - **Chrome Global Shortcuts**:
     - `Ctrl+Space`: Toggle player popup;
     - Global Play/Pause, Next Track, and Previous Track hotkeys.
6. **Customizable Options**:
   - Theme presets: Dark, Light, or follow System Preferences.
   - Granular CSS palette variables editor with live custom stylesheet injection.
   - Inactivity auto-pause threshold, rewind durations, and history capacity controls.

---

## 🛠️ Installation & Setup (Developer Mode)

Loading Harmonia into Google Chrome takes less than 30 seconds with no build tools or package managers required:

1. Download the latest pre-packaged release zip (**`Harmonia-v3.1.0-chrome.zip`**) from [Releases](https://github.com/zhuxiufeng/Harmonia/releases/latest) and unzip it (or clone this repository directly).
2. Open Google Chrome and navigate to:
   ```text
   chrome://extensions/
   ```
3. Enable the **Developer mode** toggle in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select the `anesidora-mv3` folder (or the unzipped folder).
6. Click the **Harmonia** icon in your Chrome toolbar, log in with your Pandora credentials, and enjoy!

---

## 📦 Building & Packaging

A build script `package.bash` is included at the project root:

```bash
chmod +x package.bash
./package.bash
```

The script generates:
- `../anesidora_mv3_dist/`: Clean deployment directory ready for distribution.
- `../anesidora_mv3.zip`: Packaged zip archive ready for distribution or offline installation.

---

## 📂 Project Architecture

```text
Harmonia/
├── manifest.json            # MV3 extension manifest configuration
├── declarativeNetRules.json # DeclarativeNetRequest headers rule
├── offscreen.html           # Offscreen audio playback sandbox with <audio> DOM
├── cozy.htm                 # Cozy theme popup view
├── compact.htm              # Compact mini-player popup view
├── options.htm              # Extension preferences & styling configuration
├── package.bash             # Automated distribution packaging script
├── css/
│   ├── common.css           # Global foundational stylesheets
│   ├── cozypopup.css        # Cozy card player styling
│   ├── reworked_oldpopup.css# Compact toolbar player styling
│   ├── options.css          # Preferences page styling
│   └── *.woff2              # Bundled variable font assets (Inter)
├── images/                  # Vector squircle icons & placeholder graphics
└── js/
    ├── sw.js                # Background Service Worker (lifecycle & shortcuts)
    ├── offscreen_bridge.js  # Offscreen audio RPC gateway & state broadcaster
    ├── bridge.js            # Transparent client bridge providing zero-friction shims
    ├── anesidora.js         # Pandora core API communication layer
    ├── background.js        # Core playback engine & MediaSession controller
    ├── config.js            # Configuration store & proxy-based sync engine
    ├── common.js            # Shared utility functions & theme engine
    ├── crypt.js             # Blowfish ECB cryptographic cipher
    ├── keys.js              # Cryptographic key schedule tables
    ├── lyrics.js            # LRCLIB real-time lyrics query & parser
    ├── jscolor.js           # Lightweight colorpicker component
    ├── newpopup.js          # Player interaction & DOM render engine
    ├── options.js           # Settings controller & custom CSS persistence
    ├── platform_specific.js # Cross-platform chrome.action API compatibility shim
    └── collect_errors.js    # Runtime diagnostics & error collector
```

---

## 🙏 Acknowledgements & Upstream Projects

This project was built upon and inspired by the wonderful work of the open-source community:

1. **[Anesidora (Legacy MV2)](https://github.com/pvrs12/Anesidora)**: The foundational prototype. Sincere thanks to original author `pvrs12` and contributors for crafting the delightful UI and Pandora client during the MV2 era.
2. **[Pandora JSON API Documentation](https://6xq.net/pandora-apidoc/json/)**: Thanks to the community for documenting the unofficial Pandora API specs.
3. **[LRCLIB](https://lrclib.net/)**: Providing free, open, and high-quality synchronized lyrics lookup API.

---

## 🤖 AI-Assisted Engineering

This project was modernized and optimized through full-lifecycle **AI Pair Programming**:
- **MV3 Asynchronous Refactoring**: AI-assisted architecture design transforming legacy persistent DOM backgrounds into a robust Chrome MV3 (Service Worker + Offscreen Audio Sandbox) transparent RPC bridge;
- **Obsidian Dark Aesthetic & Dynamic Layouts**: AI-assisted visual design for adaptive full-screen artwork viewports and radiant glowing vector icon assets;
- **Real-Time Lyrics & Network Acceleration**: Implemented LRCLIB rolling lyrics synchronization and DNS-Prefetch / Preconnect optimizations for sub-second startup latency;
- **Code Cleanliness & Governance**: AI-assisted auditing and removal of legally ambiguous ripping routines and 330KB+ of obsolete third-party dependencies.

---

## 📄 License

This project is licensed under the [GNU General Public License v2.0 (GPL-2.0)](./LICENSE).
