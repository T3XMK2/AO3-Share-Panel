# AO3 Share Panel

> A userscript that adds a fully-featured sharing panel to every [Archive of Our Own](https://archiveofourown.org/) work page.

![Version](https://img.shields.io/badge/version-2.1.1-red)
![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Tampermonkey%20%7C%20Violentmonkey%20%7C%20Greasemonkey-green)

---

## Overview

AO3 Share Panel injects an unobtrusive floating button on AO3 work and chapter pages. Clicking it opens a two-column panel with a live card preview on the left and granular sharing controls on the right — no external services or dependencies required.

---

## Features

| Feature | Description |
|---|---|
| **Live Card Preview** | See the card update in real time as you toggle options, before downloading or copying |
| **Copy Card to Clipboard** | Copy the card as a PNG image directly to the clipboard — no download needed |
| **QR Code** | Fixed-size scannable QR code embedded in the card; links to the work or current chapter |
| **Shareable Card** | Rendered via the Canvas API with title, author, metadata, and optional summary |
| **Formatted Text** | Clean, copy-ready text block for social media or Discord |
| **Granular Field Selection** | Toggle every metadata field individually (rating, word count, fandoms, tags, characters, relationships, warnings, kudos, hits, series, dates, status, summary) |
| **Per-item Sub-selection** | For multi-value fields (fandoms, tags, characters, etc.), pick exactly which individual items appear on the card |
| **Title in Card Header** | The work title is displayed in the card's header band instead of generic site text |
| **Persistent Settings** | All field toggles and sub-selections are saved via `GM_setValue`/`GM_getValue` with automatic `localStorage` fallback |
| **Auto-updates** | Compatible with Tampermonkey/Violentmonkey auto-update via `@updateURL` |
| **No Dependencies** | QR generation and card rendering are fully self-contained |
| **Responsive Panel** | Works on all screen sizes, from 4K monitors down to mobile |

---

## Requirements

- A modern browser (Chrome, Firefox, Edge, Safari)
- One of the following userscript managers:
  - [Tampermonkey](https://www.tampermonkey.net/) — Chrome, Firefox, Safari, Edge *(recommended)*
  - [Violentmonkey](https://violentmonkey.github.io/) — Chrome, Firefox, Edge
  - [Greasemonkey](https://www.greasespot.net/) — Firefox

---

## Installation

### One-click install (recommended)

1. Make sure a userscript manager is installed.
2. Click **[Install Script](https://raw.githubusercontent.com/T3XMK2/AO3-Share-Panel/main/ao3-share.user.js)**.
3. Your userscript manager will prompt you to confirm — click **Install**.

### Manual install

1. Open [`ao3-share.user.js`](ao3-share.user.js) and click **Raw**.
2. Your userscript manager will detect it and prompt you to install.

The share button will appear in the **bottom-right corner** of any AO3 work page.

---

## Usage

1. Go to any work or chapter page on AO3 (`/works/*` or `/chapters/*`).
2. Click the floating **Share** button (or press **S** anywhere on the page).
3. The panel opens with a live card preview on the left and controls on the right:
   - **Work link / Chapter link** — choose what the QR code points to
   - **Card fields** — toggle each metadata field individually; expand multi-value fields (fandoms, tags, etc.) to pick individual items
   - **Copy text** — copy a formatted text snippet to the clipboard
   - **Download card** — save the card as a PNG image
   - **Copy card** — copy the card image directly to the clipboard
   - **Copy link** — copy the work or chapter URL
4. Press **Esc** to close the panel.

---

## Configuration

The following values can be adjusted in the `CONFIG` object at the top of the script:

| Key | Default | Description |
|---|---|---|
| `BUTTON_POSITION` | `bottom: 24px, right: 24px` | Position of the floating button |
| `CARD_DIMENSIONS` | `width: 440 px` | Card width (height is calculated dynamically) |
| `QR_SIZE` | `170 px` | QR code size — fixed regardless of card content |
| `MAX_TAGS_DISPLAY` | `5` | Maximum tags shown in the share text |
| `MAX_SUMMARY_LENGTH` | `220` | Character limit for summary in share text |
| `ANIMATION_DURATION` | `180 ms` | Panel open/close animation speed |

---

## Technical Notes

- **Language**: Vanilla JavaScript (ES6+), no build step required
- **Storage**: `GM_getValue`/`GM_setValue` with transparent `localStorage` fallback
- **QR Code**: Self-contained implementation based on [QRCode.js](https://github.com/kazuhikoarase/qrcode-generator) by Kazuhiko Arase (MIT)
- **Card rendering**: HTML5 Canvas API — dynamic height calculated from visible fields
- **Activation**: `document-idle` — no impact on page load
- **Scope**: Only active on `https://archiveofourown.org/works/*` and `.../chapters/*`

---

## Changelog

### v2.1.1 — 2026-03-16
- **Fix card preview clipping on small screens**: removed `width:100% !important; height:auto !important` CSS overrides that fought with the JS-computed canvas dimensions, causing tall cards (many tags/summary) to be cropped at the bottom. The preview column now scrolls correctly for any card height.

### v2.1.0 — 2026-03-16
- **Per-item sub-selection**: multi-value fields (fandoms, tags, characters, relationships, warnings, categories, series) now expand to show individual checkboxes for each item — pick exactly what appears on the card
- **Scrollable field list**: the card fields checklist scrolls internally so the rest of the panel stays fixed
- **Fully responsive layout**: proper multi-breakpoint CSS covering 4K, 1080p (including 125% scaling), tablets, and mobile; panel no longer breaks on 1080p screens
- **Auto-update support**: added `@updateURL` and `@downloadURL` pointing to this repository
- **Version bump** to 2.1.0

### v2.0.3 — 2026-03-16
- **Fixed QR code size**: QR is now always `CONFIG.QR_SIZE` (170 px) — the card height expands to fit content instead of shrinking the QR
- **Fixed footer clipping**: post-QR content (warnings, characters, tags, summary) was being hidden behind the card footer; fixed by pre-computing all content heights before drawing

### v2.0.2 — 2026-03-16
- **Live card preview**: the card updates in real time as options are changed, shown in the left column of the panel
- **Granular field toggles**: every metadata field now has its own checkbox (rating, word count, chapters, language, fandoms, warnings, categories, relationships, characters, tags, series, status, published date, kudos, hits, summary)
- **Two-column panel layout**: preview on the left, controls on the right
- **Extended metadata extraction**: `DataExtractor` now reads warnings, categories, relationships, characters, series, dates, status, kudos, hits, and bookmarks from the AO3 page

### v2.0.1 — 2026-03-16
- **Work title in card header**: replaced the static "Archive of Our Own" text with the work title (auto-scaled, centered, up to 2 lines)

### v2.0.0 — 2026-03-16
- **Copy card to clipboard**: added a "Copy card" button that copies the PNG image directly to the clipboard via `navigator.clipboard.write()` — no download needed

---

## Contributing

Contributions, bug reports, and feature suggestions are welcome.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

Please keep the code dependency-free and compatible with all major userscript managers.

---

## License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for full terms.
