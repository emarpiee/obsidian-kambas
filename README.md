
> [!NOTE]
> **Work in Progress** — Kambas is actively developed. Features and interfaces may evolve between releases.

# Kambas

**An image toolkit and enhanced visual workspace for Obsidian Canvas.**

Kambas transforms Obsidian Canvas into a self-contained, portable reference environment for designers, researchers, and visual creators. Best suited for focused, small-to-medium scale reference boards and mood boards, its core feature is **embedded image storage** — images are encoded as Base64 data URIs and stored directly inside the `.canvas` file itself, eliminating vault clutter and broken link dependencies entirely.

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
  "type": "link",
  "url": "data:image/png;base64,iVBORw0KGgo...",
  "kambasTags": ["concept", "character-design"],
  "unknownData": {
    "kambasFlipH": false,
    "kambasFlipV": false,
    "kambasGrayscale": false,
    "kambasPalette": false,
    "kambasOpacity": 1,
    "originalWidth": 1920,
    "originalHeight": 1080,
    "kambasMediaLabel": "concept-01.png"
  }
}
```

The result is a **single portable `.canvas` file** — no attachments folder, no broken paths, no extra steps when sharing, archiving, or syncing.

---

## Features

### Image & Node Manipulation

Right-click any canvas node or edge to access enhanced controls:

- **Tag nodes**: Open tag manager modal to add, edit, or reorder node tags (hotkey: `T`).
- **Arrange selected elements**: Organize selected canvas elements into **Grid**, **Row**, or **Column** layouts sorted **By label (A-Z / Z-A)** or **By tag (A-Z / Z-A)**.
- **Set media label…**: Assign custom canvas labels (`node.label`) to selected embedded media with interactive zero-padded counter formatting (`label-##` $\rightarrow$ `01`, `02`; `label-###` $\rightarrow$ `001`, `002`).
- **Flip horizontal / vertical**: Mirror the image along its X or Y axis (persisted across canvas re-renders; hotkeys: `H` / `V`).
  ![obsidian-kambas-flip](https://github.com/user-attachments/assets/0273c5d9-b137-4ef8-ae64-71e66439f6c9)

- **Toggle grayscale**: Apply a CSS grayscale filter to evaluate light values, structure, and contrast without color distraction (hotkey: `G`).
  ![obsidian-kambas-grayscale](https://github.com/user-attachments/assets/c2e95821-92e2-4007-ab3e-c4f2eea08203)

- **Toggle color palette**: Extract and display dominant color swatches overlaying the image (3–10 swatches, configurable) with a one-click **Copy all palette colors** button (hotkey: `P`).
  ![obsidian-kambas-color-palette](https://github.com/user-attachments/assets/ec8c4a50-6441-442f-aab0-dff46fd4fe75)

- **Change opacity**: Set transparency (0–100%) on any canvas element — images, text cards, file embeds, groups, or canvas edges.
  ![obsidian-kambas-opacity](https://github.com/user-attachments/assets/3a1a3b8f-f53a-4211-81b1-e3b0461ebc0d)

- **Reset to original size**: Restore a scaled node to its native pixel dimensions.
- **Move media to…**: Relocate media files using a folder suggest modal with target folder auto-suggest, destination folder badges, naming strategy selector, and 7 numbering formats (`01`, `001`, `1`, `I`, `i`, `A`, `a`).
- **Copy media to…**: Duplicate media files into a target vault folder while preserving canvas links.
- **Embed in canvas file…**: Convert vault-linked image nodes into inline Base64 data URIs (with optional deletion of source vault file).
- **Copy image to clipboard**: Copy raw image data directly to system clipboard.
- **Swap media…**: Replace an existing image or video with another asset from your vault, local disk, or clipboard — preserving node position and aspect ratio.
- **Optimize Base64 size**: Manually optimize and compress Base64 images to WebP data URIs with custom pixel dimension caps and quality targets.

---

### Canvas Element Arrangement

Organize selected cards on the canvas with a 2-tier right-click context menu (**Arrange selected elements**):

- **Layout Modes**:
  - **In grid**: Arranges nodes into an automatically sized grid ($\text{cols} = \lceil \sqrt{N} \rceil$) with dynamic cell dimensions to prevent card overlapping.
  - **In row**: Positions nodes side-by-side in a single horizontal row starting at the selection's origin $(\min X, \min Y)$.
  - **In column**: Stacks nodes top-to-bottom in a single vertical column.
- **Smart Sorting Criteria**:
  - **By label (A-Z / Z-A)**: Sorts alphabetically by custom node header label (`node.label`). For unlabeled cards, it seamlessly falls back to card titles, note headers, or file names.
  - **By tag (A-Z / Z-A)**: Sorts alphabetically by primary canvas tag (`kambasTags[0]`).

---

### Canvas Node Labels & Filename Preservation

Kambas integrates directly with native Obsidian Canvas node header labels (`node.label`), keeping your workspace organized:

- **Show Media Labels Setting**: Toggle native node header label display above embedded media cards.
- **Preserve Filenames on Ingest**: Automatically populates native node labels with original file names when dropping, pasting, or embedding media assets into the canvas.
- **Set Media Label Modal**: Assign custom labels across single or multiple selected nodes with zero-padded counter syntax (`label-##` $\rightarrow$ `label-01`, `label-02`; `label-###` $\rightarrow$ `label-001`, `label-002`).
- **Media Label Naming Strategy**: Includes **"Media label / original filename"** as a selectable naming option in the *Move / Copy media to folder* modal.

---

### GIF Playback & Frame Extraction Controls

![obsidian-kambas-gif-control](https://github.com/user-attachments/assets/2e22fe28-885f-45b0-9d1f-d32b9f1b26d5)

Take complete control over animated GIF files directly on the canvas without external tools:

- **Interactive Timeline & Scrubber**: Play/pause (`Space`), step forward/backward frame-by-frame (`chevron` buttons), scrub through frames via timeline slider, or adjust playback speeds (`0.25x`, `0.5x`, `1.0x`, `1.5x`, `2.0x`, `4.0x`).
- **Frame Extraction**: Extract any single frame from an animated GIF as a static image saved directly to your vault or embedded into the canvas (`camera` button).
- **Multi-Select Synchronization**: Control playback, stepping, or seeking across multiple selected GIF nodes simultaneously.
- **Instant Toggle & Command Palette**: Enable or disable GIF controls at any time via plugin settings or the Command Palette (`Toggle GIF controls on/off`).

---

### Loupe Inspector Tool

![obsidian-kambas-loupe-tool](https://github.com/user-attachments/assets/cd49f976-de5d-4627-920f-b806e5abc8c6)

Inspect fine image details and artwork without changing canvas zoom levels:

- **Hotkey Lens Toggle**: Press `Q` (configurable) over any image node to open an interactive magnifying loupe lens.
- **Smooth Tracking**: Features dampened motion interpolation (`loupeSmoothing`: 0.05–1.0) for smooth, precise cursor movement over image details.
- **Custom Optics**: Adjust magnification power (1.5x–10.0x), lens size (100px–600px), and lens shape (`circle`, `square`, `rounded`) in settings.

---

### Canvas Image Level of Detail (LOD) & Performance Engine

> [!NOTE]
> Canvas image Level of Detail (LOD) functionality is inspired by and based on the [Canvas Image LOD](https://github.com/seadhe/obsidian-canvas-image-lod) plugin.

High-density mood boards containing 100+ high-resolution images can strain system memory and cause viewport zoom stuttering. Kambas includes an adaptive Canvas Image LOD rendering engine supporting both vault file image links and inline Base64 data URIs:

- **Adaptive Multi-Resolution Tiers**: Automatically generates resolution-scaled image proxies (e.g. 128px, 320px, 768px, 1600px) and swaps them seamlessly based on viewport zoom distance.
- **Local IndexedDB Caching**: Image proxies are generated asynchronously in background web workers and cached locally on device without polluting your vault or affecting Obsidian Sync limits.
- **Viewport Culling & Memory Budgeting**: Off-screen images are culled and background memory overhead is continuously managed to eliminate UI flicker, zoom hangs, and RAM leaks.
- **Performance Profiles**: Select from four tailored profiles in settings — **Performance (Fastest)**, **Balanced (Recommended)**, **High Quality**, or **Custom (Advanced)**.
- **Status Bar Diagnostics**: Displays real-time disk cache usage and active memory proxy counts in the Obsidian status bar.
- **Automatic Export Protection**: Intercepts native Obsidian Canvas export actions (e.g., export to image/PNG), automatically restoring full-resolution original images before rendering output to guarantee uncompromised export quality.

---

### Storage & Ingestion

Pasting or dropping files onto the canvas presents an instant choice:

- **Embed in canvas** — encode image as a Base64 data URI stored inside `.canvas`.
- **Save to vault** — save to a configured attachment folder as a standard file link.

Multi-file drops are processed in a single batch. The **Show media labels** setting controls node header label visibility above embedded image cards.

#### Base64 Optimization & Compression

- **Auto-Compress on Ingest**: Automatically compress pasted or dropped Base64 images to WebP data URIs.
- **Resolution & Quality Controls**: Configure maximum pixel dimension caps (default: 2048px) and WebP quality targets (0.10–1.00).
- **Manual Optimization**: Trigger **Optimize Base64 size** on selected embedded images via right-click context menu.

---

### Advanced Media Organization & Naming

When moving or copying media assets within your vault:

- **Target Folder Auto-Suggest**: Interactive folder picker modal with vault root support (`/`).
- **Flexible Naming Strategies**:
  - **Media label / original filename**: Uses custom native node label or original filename.
  - **Default filename**: Uses default structured naming prefix (`canvas_image-01`).
  - **Tag filename**: Names media assets based on assigned canvas tags (`#character-design` $\rightarrow$ `character-design-01`).
  - **Custom filename**: Allows inputting a custom base filename.
- **Flexible Numbering Formats**: Choose from 7 numbering styles:
  - Padded 2 (`01, 02…`)
  - Padded 3 (`001, 002…`)
  - Simple (`1, 2…`)
  - Roman Upper (`I, II…`)
  - Roman Lower (`i, ii…`)
  - Letter Upper (`A, B…`)
  - Letter Lower (`a, b…`)
- **Batch Memory & Badges**: Target destination badges display target paths while remembering numbering choices across operations.

---

### Filter Panel (Tags, Colors & Labels)

![image](https://github.com/user-attachments/assets/d84518d1-d41a-45cc-88dd-76496fab636a)

A floating, resizable, position-remembered panel accessed from the **Tags** button in the canvas toolbar or hotkey `F`.

#### How Filtering Works

Kambas uses a **3-state logic** (Neutral ☐, Include ✓, Exclude ✕) per tab across three tabs (`[ TAGS ]`, `[ COLORS ]`, `[ LABELS ]`):
- **Exclude wins over include**: If a node matches an included tag but also an excluded color or label, it is hidden.
- **Non-matching nodes dim**: Filtered-out nodes dim cleanly (adjustable opacity down to 12%) rather than abruptly disappearing.

#### Contextual "In View" Intelligence

- **"N in view" badges**: Displays how many currently visible nodes co-contain each tag, color, or label.
- **Auto-Sorting**: Rows sort dynamically by visible count to surface relevant co-occurring attributes first.
- **Dimmed Unrelated Rows**: Attributes absent from visible nodes display at reduced opacity.

#### Bidirectional Cross-Highlighting

- Hovering filter rows highlights matching canvas elements with custom borders.
- Hovering canvas image nodes highlights their corresponding tag, color, and label rows in the panel.

#### Tags Tab

- **Tag Assignment**: Right-click nodes or press `T` to open tag modal for comma-separated kebab-case tags (`#character-design`).
- **Custom Tag Colors**: Set individual tag background and text colors directly in the tag modal or filter panel with color presets picker.
- **Tag Badges & Visibility**: Toggle canvas tag badge display (`canvas-toggle-tag-visibility`) or change badge positions (outside-below or inside bottom-left).
- **Tag Management**: Rename tags canvas-wide, set tag colors, or delete tags directly from the panel.
- **Auto-Select Filtered Items**: Command and setting to automatically select all canvas nodes matching active filter selections (`canvas-toggle-auto-select-filtered-items`).

#### Colors Tab

- **Dominant Color Extraction**: HSV color classification into 13 color categories: Black, Gray, White, Red, Orange, Yellow, Green, Teal, Cyan, Blue, Indigo, Purple, Pink.
- **Native Card Color Filtering**: Option to include native Obsidian card custom border/background colors.
- **Minor Accent Colors**: Option to include low-coverage accent colors in HSV extraction.
- **Extraction Modes**: Configurable to **Auto** (on tab open), **Manual** ("Scan canvas colors" button), or **Disabled**.

#### Labels Tab

- **Node Label Filtering**: View and filter canvas elements by their native node header labels (embedded media labels, vault media names, text note headers, or group titles).
- **Live Label Search**: Real-time search filter input to quickly find specific labeled elements on dense canvases.
- **Alphabetical Sorting**: Automatically collects and sorts all canvas labels alphabetically.

---

### Workspace Privacy

- **Away Mode**: Triggered via Command Palette (`Away Mode`). Instantly hides all canvas content by reducing node opacity to 0% and locking interactive controls for quick visual privacy.

---

### Keyboard Navigation & Action Hotkeys

> [!NOTE]
> Keyboard panning functionality is inspired by and based on the [Canvas Keyboard Pan](https://github.com/nathonius/obsidian-canvas-pan) plugin. All navigation and action shortcuts can be customized in plugin settings using interactive key recorders with full single-key and multi-modifier support (`Ctrl`, `Alt`, `Shift`, `Meta`).

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

---

## Command Palette Commands

All features can be triggered directly from Obsidian's Command Palette (`Ctrl+P` / `Cmd+P`):

| Command Name | Description |
| :--- | :--- |
| **Toggle proxy swapping (canvas image lod)** | Enable or disable adaptive LOD image proxy swapping. |
| **Build proxies for current canvas (canvas image lod)** | Prewarm and build image proxy tiers for all images on the active canvas. |
| **Clear proxy cache (canvas image lod)** | Purge all generated LOD image proxies from IndexedDB local storage. |
| **Restore original images on current canvas (canvas image lod)** | Temporarily restore all original full-resolution images on the active canvas. |
| **Toggle embedded media labels** | Show or hide native node labels above embedded Base64 media cards. |
| **Away Mode** | Toggle presentation/focus mode to hide UI overlays. |
| **Tag & Color Filter Panel** | Open or close the floating Tag, Color, and Label filter panel. |
| **Toggle tag visibility** | Hide or show tag badges across all canvas cards. |
| **Toggle auto-zoom on tag selection** | Enable or disable automatic viewport zooming when selecting filter tags. |
| **Toggle auto-select filtered items** | Automatically select canvas nodes matching active filter panel selections. |
| **Toggle GIF controls on/off** | Show or hide interactive GIF playback toolbars and scrubber controls. |

---

## Configuration

Access settings in **Obsidian Settings > Kambas**:

| Setting | Description |
| :--- | :--- |
| **Show media labels** | Display native canvas node labels above embedded media cards. |
| **Preserve media filename on ingest** | Automatically set native canvas node label to original file name when dropping, pasting, or embedding media. |
| **Enable GIF controls** | Show GIF playback toolbar, timeline scrubber, and frame extraction on GIF nodes (default: `true`). |
| **Tag badge position** | Position tag badges outside-below or inside bottom-left (`outside` / `inside`). |
| **Zoom on select** | Auto-zoom viewport to fit visible nodes when filters update. |
| **Auto-select filtered items** | Automatically select canvas elements matching active filter panel selection. |
| **Auto-close filter panel** | Automatically close panel when losing focus or clicking outside. |
| **Color palette swatches** | Number of dominant colors to extract (3–10). |
| **Palette color separator** | Delimiter used when copying palette colors (e.g. `, `, `\n`). |
| **Color extraction mode** | Auto, Manual, or Disabled color extraction. |
| **Auto-optimize Base64** | Automatically compress pasted/dropped Base64 images to WebP URIs. |
| **Base64 max dimension** | Maximum pixel resolution limit for Base64 compression (default: 2048px). |
| **WebP compression quality** | Target compression quality for WebP images (0.10–1.00). |
| **Loupe Optics & Hotkey** | Hotkey (`Q`), magnification (1.5x–10.0x), lens size (100px–600px), shape (`circle`, `square`, `rounded`), and motion smoothing (0.05–1.0). |
| **Media & Canvas Action Hotkeys** | Interactive key recorders for Grayscale (`G`), Flip H (`H`), Flip V (`V`), Palette (`P`), Tag Modal (`T`), Filter Panel (`F`), Loupe (`Q`), and Selection Zoom (`Space`). |
| **Keyboard Pan & Zoom Controls** | Customizable key bindings for WASD / Arrow pan, zoom step speed, and max pan velocity. |
| **Enable image optimization** | Enable adaptive Level of Detail engine for high-density canvas performance. |
| **Performance Profile** | Performance preset selector: Performance (Fastest), Balanced (Recommended), High Quality, or Custom. |
| **Maximum Cache Storage (MB)** | Device cache storage cap in MB (IndexedDB) with direct Clear Cache control. |
| **Advanced LOD Settings** | Fine-tune image sharpness factor, resolution tiers, min source width, quality target, prewarming, concurrency, and fast panning rasterization. |
| **Show in status bar** | Display live LOD storage & proxy status in Obsidian status bar. |
| **Debug logging** | Output LOD performance diagnostics to developer console. |

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
npm run health     # Type-check (tsc) and lint (eslint)
npm run build      # Production bundle with type-check
npm run clean      # Prettier formatting and ESLint auto-fix
```

---

## Support

If Kambas improves your workflow, consider supporting development:

- [Ko-fi](https://ko-fi.com/emarpiee)
- [PayPal](https://paypal.me/emarpiee)
