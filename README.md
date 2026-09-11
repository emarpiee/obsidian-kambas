> [!NOTE]
> **Work in Progress** — Kambas is actively under development. Features and interfaces may refine over time.

# Kambas

**PureRef-inspired visual workspace & image manipulation toolkit for Obsidian Canvas.**

Kambas transforms Obsidian Canvas into an agile, self-contained reference tool. Inspired by **PureRef**, it allows designers, researchers, and creators to gather, organize, transform, and embed visual media directly within `.canvas` files without cluttering vault directories.

---

## 🎯 The Problem Kambas Solves

Obsidian Canvas is fantastic for connecting thoughts, but managing visual reference assets creates pain points for visual creators:

1. **Vault Directory Pollution**: Pasting or dropping images into Canvas auto-generates individual media files in your vault's attachment directory. Over time, hundreds of single-use images clutter file navigation and vault search.
2. **Broken Link Dependencies**: Renaming folders, reorganizing vault directories, or syncing across devices often breaks relative link paths to canvas attachments.
3. **Friction in Portable Sharing**: Sharing or backing up a `.canvas` file requires hunting down and bundling referenced image attachment files alongside the `.canvas` JSON file.
4. **Lack of In-Canvas Image Controls**: Fine-tuning mood boards (flipping references, matching contrast, setting transparency, navigating via keyboard) requires external image editors or cumbersome workarounds.

---

## 💡 PureRef-like Visual Workflow

Like **PureRef** — the industry standard reference viewer for digital artists and designers — **Kambas** focuses on speed, portability, and fluidity:

- **Self-Contained Canvas Files**: Embed images directly into `.canvas` files as inline Base64 data URIs (`url: "data:image/png;base64,..."`). Share, move, or archive your `.canvas` file anywhere as a single portable file without missing dependencies.
- **Clean Ingestion Options**: Ingest media with full control. Choose on paste/drop whether to store images as standard vault attachments or embed them directly inside the canvas file. Existing vault attachments can be converted in-place with an option to clean up original source files.
- **Fast Visual Tweaks**: Flip images horizontally/vertically, apply grayscale filters for value checking, adjust transparency across any node type, and reset dimensions to natural aspect ratios.
- **Keyboard-Driven Canvas Navigation**: Smooth WASD and arrow key panning with precise zoom shortcuts keep your hands on the keyboard during intense visual sessions.

---

## 🛠️ Key Features

### 🖼️ Image & Node Manipulations
- **Horizontal & Vertical Flipping**: Mirror images along X or Y axes for flipping reference poses or checking canvas composition.
- **Grayscale Toggle**: Instantly strip color to evaluate value structure, contrast, and visual hierarchy.
- **Color Palette Extraction**: Extract dominant colors from any image node and display them as a configurable swatch overlay (3–10 swatches) for quick color reference.
- **Node Opacity Control**: Adjust transparency (0% to 100%) for image nodes, text cards, embedded files, and canvas groups.
- **Reset Natural Dimensions**: Restore scaled images to their native pixel dimensions in one click.
- **Clipboard Integration**: Copy clean image data directly from canvas nodes to system clipboard.
- **Swap Media**: Replace any image or video node with another file from your vault, a local file, or directly from your clipboard—preserving position and natural aspect ratio.

### 📥 Storage & Attachment Management
- **Smart Ingestion Modal**: Prompt on paste or drag-and-drop to choose vault attachment storage vs. inline Base64 embedding.
- **Batch Processing**: Handle multi-file drag-and-drop operations effortlessly in one step.
- **In-Place Base64 Conversion**: Convert existing vault attachment nodes into inline data URIs (with optional original file deletion).
- **Media File Relocation**: Move or duplicate linked media files across vault folders using a fast fuzzy-finder folder selector.
- **Clean Card View**: Toggle option to hide technical Base64/Data URI header labels for a minimalist card appearance.

### 🎮 Fluid Canvas Navigation
- **Keyboard Panning**: Pan around large canvases smoothly using `WASD` or directional arrow keys with configurable pan speeds (inspired by [obsidian-canvas-pan](https://github.com/nathonius/obsidian-canvas-pan)).
- **Keyboard Zooming**: Zoom in and out precisely with customizable shortcut keys (`+` / `-`).

---

## 🏗️ Technical Architecture & Data Persistence

Kambas performs visual modifications non-destructively without altering original disk media.

### Node Metadata Persistence

Obsidian Canvas files reserve an `unknownData` JSON object per node for plugin state. Kambas persists node visual transformations directly inside this property:

```json
{
  "id": "node-id-123",
  "type": "file",
  "file": "attachments/image.png",
  "unknownData": {
    "kambasFlipH": true,
    "kambasFlipV": false,
    "kambasGrayscale": true,
    "kambasPalette": false,
    "kambasOpacity": 0.85,
    "originalWidth": 1200,
    "originalHeight": 800
  }
}
```

- **Cross-Session Stability**: Visual settings persist across device syncs, Obsidian restarts, and canvas reloads.
- **Non-Destructive**: Disabling Kambas leaves original image files completely untouched. Visual metadata remains cleanly tucked inside the `.canvas` JSON file.

---

## ⚡ Technical Considerations & Trade-Offs

Inline embedding brings immense portability and vault cleanliness, but keep the following trade-offs in mind:

- **Supported Formats**: Base64 conversion and image transformations are tailored for standard web formats (`PNG`, `JPG`/`JPEG`, `WebP`, `GIF`, `SVG`). Non-image files (`PDF`, Markdown, Audio/Video) cannot be converted to image URIs.
- **File Size Expansion**: Base64 encoding increases binary data size by ~33%. Boards loaded with dozens of high-res images will yield larger `.canvas` JSON files.
- **Performance Thresholds**: Canvases with excessive high-resolution embedded images can increase initial render times and RAM usage.
- **Vault Search & Indexing**: Embedded Base64 strings are stored within `.canvas` raw JSON text and are omitted from standard vault asset indexers.
- **Recommended Usage**: Ideal for mood boards, concept reference boards, visual brainstorming, and portable project notes. For ultra-high-resolution image archives, native vault attachment linking is recommended.

---

## 🎮 Controls Reference

### Context Menu Commands

Right-click any node or selection inside an active Canvas view:

| Command | Target Scope | Description |
| :--- | :--- | :--- |
| **Flip horizontal** | Image nodes | Flips target image horizontally across X axis. |
| **Flip vertical** | Image nodes | Flips target image vertically across Y axis. |
| **Toggle grayscale** | Image nodes | Toggles CSS grayscale value-check filter. |
| **Color palette** | Image nodes | Extracts and displays dominant color swatches on the image. |
| **Change opacity** | All node types | Opens opacity dialog (0% – 100%). |
| **Reset to original size** | Image nodes | Resets node bounds to image natural dimensions. |
| **Swap media…** | Single image/video node | Replaces the current media with another from vault, file, or clipboard. |
| **Embed in canvas file...** | Vault media nodes | Converts vault file link into embedded inline Base64 URI. |
| **Copy media to clipboard** | Image nodes | Copies raw image payload or file to clipboard. |
| **Move / Copy media to...** | Vault media nodes | Launches folder picker to relocate or duplicate vault file. |

### Keyboard Shortcuts

| Action | Default Shortcut | Configuration Path |
| :--- | :--- | :--- |
| **Pan Up / Down / Left / Right** | `W` / `S` / `A` / `D` or `Arrow Keys` | Settings > Kambas > Pan controls |
| **Zoom In / Out** | `+` / `-` | Settings > Kambas > Zoom controls |

---

## ⚙️ Configuration

Manage settings in **Obsidian Settings** > **Kambas**:

- **Hide media label**: Hides raw Base64 Data URI header strings above embedded media cards.
- **Color palette swatches**: Number of dominant colors to display when the color palette is enabled on an image (3–10).
- **Pan controls**: Configure key bindings and set maximum pan speed (units per frame).
- **Zoom controls**: Configure zoom shortcuts and adjust zoom step sensitivity.

---

## 📦 Installation

### Community Plugins
1. Open **Obsidian Settings** > **Community Plugins**.
2. Turn off **Restricted Mode**.
3. Click **Browse**, search for **Kambas**, and click **Install**.
4. Enable **Kambas** once installed.

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the [Latest Release](https://github.com/emarpiee/obsidian-kambas/releases).
2. Create a folder named `kambas` in your plugin folder: `<vault>/.obsidian/plugins/kambas/`.
3. Copy the downloaded release files into the folder.
4. Reload Obsidian and toggle **Kambas** ON in **Community Plugins**.

---

## 💻 Development

```bash
# Install dependencies
npm install

# Start development build watcher
npm run dev

# Run type check and linter
npm run health

# Build production bundle
npm run build
```

---

## 💖 Support & Funding

If Kambas enhances your creative workflow, support its ongoing development:

- **[Ko-fi](https://ko-fi.com/emarpiee)**
- **[PayPal](https://paypal.me/emarpiee)**



