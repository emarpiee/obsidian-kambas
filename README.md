 > [!NOTE]
> **Work in Progress** — Kambas is actively developed. Features and interfaces may evolve between releases.

# Kambas

**An image toolkit and enhanced visual workspace for Obsidian Canvas.**

Kambas transforms Obsidian Canvas into a self-contained, portable reference environment for designers, researchers, and visual creators. Its core feature is **embedded image storage** — images are encoded as Base64 data URIs and stored directly inside the `.canvas` file itself, eliminating vault clutter and broken link dependencies entirely.



---

## The Problem Kambas Solves

Obsidian Canvas excels at connecting ideas, but managing visual reference assets creates friction for visual creators:

- **Vault pollution**: Pasting or dropping images auto-creates individual attachment files in your vault. Hundreds of single-use images accumulate and contaminate file navigation and search.
- **Broken link dependencies**: Reorganizing vault folders, renaming directories, or syncing across devices frequently breaks the relative paths that Canvas relies on to display images.
- **Portability friction**: Sharing a `.canvas` file requires separately locating and bundling every referenced attachment — defeating the purpose of a self-contained reference board.
- **Limited in-canvas controls**: Adjusting images for mood board use (flipping, desaturating, setting transparency) requires leaving Obsidian entirely.

---

## Core Concept: Embedded Images

The defining feature of Kambas is **inline Base64 image embedding**. When you paste or drop an image, Kambas can encode it as a data URI stored directly in the `.canvas` JSON:

```json
{
  "id": "node-abc123",
  "type": "file",
  "url": "data:image/png;base64,iVBORw0KGgo...",
  "kambasTags": ["concept", "character-design"],
  "unknownData": {
    "kambasFlipH": false,
    "kambasFlipV": false,
    "kambasGrayscale": false,
    "kambasPalette": false,
    "kambasOpacity": 1,
    "originalWidth": 1920,
    "originalHeight": 1080
  }
}
```

The result is a **single portable `.canvas` file** — no attachments folder, no broken paths, no extra steps when sharing, archiving, or syncing.

---

## Features

### Image & Node Manipulation

Right-click any canvas node to access enhanced controls:

- **Flip horizontal / vertical**: Mirror the image along its X or Y axis (persisted across canvas re-renders).
  <img width="800" height="435" alt="obsidian-kambas-flip" src="https://github.com/user-attachments/assets/0273c5d9-b137-4ef8-ae64-71e66439f6c9" />
  
- **Toggle grayscale**: Apply a CSS grayscale filter to evaluate light values, structure, and contrast without color distraction.
  <img width="800" height="435" alt="obsidian-kambas-grayscale" src="https://github.com/user-attachments/assets/c2e95821-92e2-4007-ab3e-c4f2eea08203" />

- **Toggle color palette**: Extract and display dominant color swatches overlaying the image (3–10 swatches, configurable) with a one-click **Copy all palette colors** button.
  <img width="800" height="435" alt="obsidian-kambas-color-palette" src="https://github.com/user-attachments/assets/ec8c4a50-6441-442f-aab0-dff46fd4fe75" />

- **Change opacity**: Set transparency (0–100%) on any node type — images, text cards, file embeds, or groups.
  <img width="800" height="435" alt="obsidian-kambas-opacity" src="https://github.com/user-attachments/assets/3a1a3b8f-f53a-4211-81b1-e3b0461ebc0d" />

- **Reset to original size**: Restore a scaled node to its native pixel dimensions.
- **Arrange selected elements**: Organize selected canvas elements into **Grid**, **Row**, or **Column** layouts sorted **By label** (A-Z / Z-A, with smart content title fallback) or **By tag** (A-Z / Z-A).
- **Set media label…**: Assign custom native canvas header labels (`node.label`) to selected cards with interactive zero-padded counter formatting (`label-##` $\rightarrow$ `01`, `02`).
- **Copy media to clipboard**: Copy raw image data directly to system clipboard.
- **Swap media…**: Replace an existing image or video with another from your vault, local disk, or clipboard — preserving node position and aspect ratio.
- **Embed in canvas file…**: Convert vault-linked image nodes into inline Base64 data URIs (with optional deletion of source vault file).
- **Move / Copy media to…**: Relocate or duplicate vault-linked media files using a modal picker with clean incremental numbering (`canvas_image-01`).

---

### Canvas Element Arrangement

Organize selected cards on the canvas with a 2-tier right-click context menu (**Arrange selected elements**):

- **Layout Modes**:
  - **In grid**: Arranges nodes into an automatically sized square/rectangular grid ($\text{cols} = \lceil \sqrt{N} \rceil$) with dynamic cell widths and heights to prevent card overlapping.
  - **In row**: Positions nodes side-by-side in a single horizontal row starting at the selection's top-left origin $(\min X, \min Y)$.
  - **In column**: Stacks nodes top-to-bottom in a single vertical column.
- **Smart Sorting Criteria**:
  - **By label (A-Z / Z-A)**: Sorts by custom node header label (`node.label`). For unlabeled cards, it seamlessly falls back to card titles, note headers, or file names.
  - **By tag (A-Z / Z-A)**: Sorts alphabetically by primary canvas tag (`kambasTags[0]`).
- **Interactive Features**:
  - **Misfire-Free 2-Tier Submenus**: Hovering over layout options (`In grid`, `In row`, `In column`) immediately presents direct click actions, auto-closing sibling submenus when hover changes.
  - **Full Undo / Redo**: Integrated with native canvas undo stack (`Ctrl+Z` / `Ctrl+Y`) and saved synchronously to `.canvas` file JSON.

---

### Native Canvas Node Labels & Filename Preservation

Kambas integrates directly with native Obsidian Canvas node header labels (`node.label`), keeping your workspace organized:

- **Preserve Filenames on Ingest**: Automatically populates native node labels with original file names when dropping, pasting, or embedding media assets into the canvas.
- **Set Media Label Modal**: Assign custom labels across single or multiple selected nodes with zero-padded counter syntax (`label-##` $\rightarrow$ `label-01`, `label-02`; `label-###` $\rightarrow$ `label-001`, `label-002`).
- **Embedded Media Indicator**: Embedded Base64 media cards display a distinct visual indicator icon (`cpu`) alongside their label header to distinguish embedded media from vault file links.
- **Media Label Naming Strategy**: Includes **"Media label / original filename"** as a selectable naming option in the *Move / Copy media to folder* modal.

---

### GIF Playback & Frame Extraction Controls

<img width="800" height="529" alt="obsidian-kambas-gif-control" src="https://github.com/user-attachments/assets/2e22fe28-885f-45b0-9d1f-d32b9f1b26d5" />


Take complete control over animated GIF files directly on the canvas without external tools:

- **Interactive Timeline & Scrubber**: Play/pause, step forward/backward frame-by-frame, scrub through frames, or adjust playback speeds (`0.25x`, `0.5x`, `1.0x`, `1.5x`, `2.0x`).
- **Frame Extraction**: Extract any single frame from an animated GIF as a static image saved directly to your vault or embedded in the canvas.
- **Multi-Select Synchronization**: Control playback, stepping, or seeking across multiple selected GIF nodes simultaneously.
- **Zoom-Out Performance Freeze**: Automatically pauses heavy GIF animations when zooming out past a configurable threshold (default: `0.4x` scale) to conserve CPU and memory on large canvases, automatically resuming when zooming back in.
- **Instant Toggle & Command Palette**: Enable or disable GIF controls at any time via plugin settings or the Command Palette (`Toggle GIF controls on/off`).

---

### Loupe Inspector Tool

<img width="800" height="435" alt="obsidian-kambas-loupe-tool" src="https://github.com/user-attachments/assets/cd49f976-de5d-4627-920f-b806e5abc8c6" />


Inspect fine image details and artwork without changing canvas zoom levels:

- **Hotkey Lens Toggle**: Press `Q` (configurable) over any image node to open an interactive magnifying loupe lens.
- **Smooth Tracking**: Features dampened motion interpolation for smooth, precise cursor movement over image details.
- **Custom Optics**: Adjust magnification power (1.5x–10.0x), lens size (100px–600px), and lens shape (`circle`, `square`, `rounded`) in settings.

---

### Canvas Image Level of Detail (LOD) & Performance Engine

High-density mood boards containing 100+ high-resolution images can strain system memory and cause viewport zoom stuttering. Kambas includes a 1:1 Canvas Image LOD rendering engine supporting both vault file image links and inline Base64 data URIs:

- **Adaptive Multi-Resolution Tiers**: Automatically generates resolution-scaled image proxies (e.g. 128px, 320px, 768px, 1600px) and swaps them seamlessly based on viewport zoom distance.
- **Local IndexedDB Caching**: Image proxies are generated asynchronously in background web workers and cached locally on device without polluting your vault or affecting Obsidian Sync limits.
- **Viewport Culling & Memory Management**: Off-screen images are culled and background memory overhead is continuously managed to eliminate UI flicker, zoom hangs, and RAM leaks.
- **Performance Profiles**: Select from four tailored profiles in settings — **Performance (Fastest)**, **Balanced (Recommended)**, **High Quality**, or **Custom (Advanced)**.
- **Status Bar Diagnostics**: Displays real-time disk cache usage and active memory proxy counts in the Obsidian status bar.

---

### Storage & Ingestion

Pasting or dropping files onto the canvas presents an instant choice:

- **Embed in canvas** — encode image as a Base64 data URI stored inside `.canvas`.
- **Save to vault** — save to a configured attachment folder as a standard file link.

Multi-file drops are processed in a single batch. The **Hide media label** setting suppresses technical data URI headers above embedded image cards for a clean visual presentation.

#### Base64 Optimization & Compression

- **Auto-Compress on Ingest**: Automatically compress pasted or dropped Base64 images to WebP data URIs.
- **Resolution & Quality Controls**: Configure maximum pixel dimension caps (default: 2048px) and WebP quality targets (0.1–1.0).

---

### Advanced Media Organization & Naming

When moving or copying media assets within your vault:

- **Standardized Naming**: Default naming format (`canvas_image-01`) eliminates irregular filenames.
- **Flexible Numbering Formats**: Choose from Zero-Padding (`01, 02...`), Roman Numerals (`I, II...` / `i, ii...`), Letters (`A, B...` / `a, b...`), or Arabic Numerals (`1, 2...`).
- **Batch Memory & Badges**: Target destination badges display target paths while remembering numbering choices across operations.

---

### Filter Panel (Tags, Colors & Labels)

<img width="1106" height="877" alt="image" src="https://github.com/user-attachments/assets/d84518d1-d41a-45cc-88dd-76496fab636a" />


A floating, resizable, position-remembered panel accessed from the **Tags** button in the canvas toolbar.

#### How Filtering Works

Kambas uses a **3-state logic** (Neutral ☐, Include ✓, Exclude ✕) per tab across three tabs (`[ TAGS ]`, `[ COLORS ]`, `[ LABELS ]`):
- **Exclude wins over include**: If a node matches an included tag but also an excluded color or label, it is hidden.
- **Non-matching nodes dim**: Filtered-out nodes dim cleanly (adjustable opacity down to 12%) rather than abruptly disappearing.

#### Contextual "In View" Intelligence

- **"N in view" badges**: Displays how many currently visible nodes co-contain each tag, color, or label.
- **Auto-Sorting**: Rows sort dynamically by visible count to surface relevant co-occurring attributes first.
- **Dimmed Unrelated Rows**: Attributes absent from visible nodes display at reduced opacity (45%).

#### Bidirectional Cross-Highlighting

- Hovering filter rows highlights matching canvas elements with custom borders.
- Hovering canvas image nodes highlights their corresponding tag, color, and label rows in the panel.

#### Tags Tab

- **Tag Assignment**: Right-click nodes or use tag modal to add comma-separated kebab-case tags (`#character-design`).
- **Custom Tag Colors**: Set individual tag background and text colors directly in the tag modal or plugin settings.
- **Tag Badges & Visibility**: Toggle canvas tag badge display or change badge positions (outside-below or inside bottom-left).
- **Tag Management**: Rename tags canvas-wide, change tag colors, or delete tags directly from the panel.
- **Search & Clear**: Search tags or clear active filter configurations.

#### Colors Tab

- **Dominant Color Extraction**: HSV color classification into up to 13 color categories: Black, Gray, White, Red, Orange, Yellow, Green, Teal, Cyan, Blue, Indigo, Purple, Pink.
- **Canvas Card Color Filtering**: Filter by Obsidian node border/background colors.
- **Extraction Modes**: Configurable to **Auto** (on tab open), **Manual** ("Scan canvas colors" button), or **Disabled**.

#### Labels Tab

- **Node Label Filtering**: View and filter canvas elements by their native node header labels (embedded media labels, vault media names, text note headers, or group titles).
- **Live Label Search**: Real-time search filter input to quickly find specific labeled elements on dense canvases.
- **Alphabetical Sorting**: Automatically collects and sorts all canvas labels alphabetically.

---

### Keyboard Navigation & Hotkeys

> [!NOTE]
> Keyboard panning functionality is inspired by and based on the [Canvas Keyboard Pan](https://github.com/nathonius/obsidian-canvas-pan) plugin. All navigation and action shortcuts can be customized in plugin settings using interactive key recorders with full modifier key support (`Ctrl`, `Alt`, `Shift`, `Meta`).

- **Pan Canvas (Up / Down / Left / Right)**: `W` / `S` / `A` / `D` or `Arrow Keys` (configurable)
- **Zoom In / Out**: `+` / `-` (configurable)
- **Selection Zoom to Fit**: `Space` (configurable, features smooth cubic-bezier camera transition)
- **Loupe Inspector Lens**: `Q` (configurable)
- **Toggle Grayscale Filter**: `G` (configurable)
- **Flip Horizontal**: `H` (configurable)
- **Flip Vertical**: `V` (configurable)
- **Toggle Color Palette Swatches**: `P` (configurable)
- **Add / Edit Node Tag Modal**: `T` (configurable)
- **Toggle Filter Panel (Tags / Colors / Labels)**: `F` (configurable)
- **Set Media Label**: Command Palette (`Set media label for selected node`)
- **Toggle Media Labels**: Command Palette (`Toggle embedded media labels`)
- **Toggle GIF Controls**: Command Palette (`Toggle GIF controls on/off`)
- **Toggle Tag Visibility**: Command Palette (`Toggle tag visibility`)
- **Toggle Auto-Zoom on Tag Select**: Command Palette (`Toggle auto-zoom on tag selection`)
- **Away Mode**: Command Palette (`Away Mode`)

---

## Configuration

Access settings in **Obsidian Settings > Kambas**:

| Setting | Description |
| :--- | :--- |
| **Enable GIF controls** | Show or hide the GIF playback toolbar, timeline scrubber, and frame extraction on GIF nodes (default: `true`). |
| **Freeze GIF on zoom-out** | Pause GIF playback when canvas is zoomed out past threshold (default: `true`). |
| **GIF zoom threshold** | Zoom scale threshold to pause GIF playback (0.1–1.0, default: `0.4`). |
| **Show media labels** | Display native canvas node labels above embedded media cards. |
| **Preserve media filename on ingest** | Automatically set native canvas node label to original file name when dropping, pasting, or embedding media. |
| **Hide media label** | Hides raw data URI header text above embedded image cards. |
| **Color palette swatches** | Number of dominant colors to extract (3–10). |
| **Palette color separator** | Delimiter used when copying palette colors (e.g. `, `, `\n`). |
| **Pan speed & Zoom sensitivity** | Adjust WASD/Arrow pan speeds and viewport zoom step sizes. |
| **Tag filter dim opacity** | Opacity of non-matching nodes during active filtering (default: 12%). |
| **Tag badge position** | Position tag badges outside-below or inside bottom-left. |
| **Zoom on select** | Auto-zoom viewport to fit visible nodes when filters update. |
| **Auto-close filter panel** | Automatically close panel when losing focus or clicking outside. |
| **Color extraction mode** | Auto, Manual, or Disabled color extraction. |
| **Include accent colors** | Include low-coverage minor accent colors in HSV extraction. |
| **Display color names** | Show color name labels alongside swatches in color filter list. |
| **Include card colors** | Include native Obsidian canvas card colors in filtering. |
| **Auto-optimize Base64** | Automatically compress pasted/dropped Base64 images to WebP URIs. |
| **Base64 max dimension** | Maximum pixel resolution limit for Base64 compression (default: 2048px). |
| **Base64 quality** | WebP compression quality slider (0.1–1.0). |
| **Loupe optics** | Hotkey (`Q`), magnification (1.5x–10.0x), lens size (100px–600px), shape, and motion smoothing. |
| **Action Hotkeys** | Interactive key recorders for Grayscale (`G`), Flip H (`H`), Flip V (`V`), Palette (`P`), Tag Modal (`T`), Filter Panel (`F`), Loupe (`Q`), and Selection Zoom (`Space`). |
| **Enable Canvas LOD** | Enable adaptive Level of Detail engine for high-density canvas performance. |
| **Performance Profile** | Performance preset selector: Performance (Fastest), Balanced (Recommended), High Quality, or Custom. |
| **Maximum Cache Storage** | Device cache storage cap in MB (IndexedDB) with direct Clear Cache control. |
| **Show in status bar** | Display live LOD storage & proxy status in Obsidian status bar. |
| **Advanced LOD Settings** | Fine-tune image sharpness factor, resolution tiers, min source width, quality, prewarming, concurrency, and fast panning rasterization. |

---

## Installation

### Community Plugins
1. Open **Settings > Community Plugins** and turn off Restricted Mode.
2. Search for **Kambas** and install.
3. Enable **Kambas** in installed plugins.

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/emarpiee/obsidian-kambas/releases).
2. Create folder `<vault>/.obsidian/plugins/obsidian-kambas/`.
3. Copy downloaded files inside, reload Obsidian, and enable plugin.

---

## Development

```bash
npm install        # Install dependencies
npm run dev        # Dev build watcher
npm run health     # Type-check and lint
npm run build      # Production bundle
```

---

## Support

If Kambas improves your workflow, consider supporting development:

- [Ko-fi](https://ko-fi.com/emarpiee)
- [PayPal](https://paypal.me/emarpiee)
