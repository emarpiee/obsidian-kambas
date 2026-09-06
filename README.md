# Kambas

Kambas is an Obsidian plugin that extends native Canvas functionality with image manipulations, inline media embedding, file organization tools, and keyboard-driven canvas navigation.

---

## Design Context & Use Case

Kambas was created specifically for **small-scale projects, independent mood boards, visual brainstorming sessions, and portable reference boards**, bringing a **PureRef**-like workflow directly into Obsidian Canvas.

When assembling quick mood boards or short-lived visual notes, standard Obsidian behavior creates permanent media attachment files in your vault for every pasted asset. This rapidly clutters your vault directory with single-use files that outlive the project itself.

Kambas addresses this by providing self-contained canvas options: you can gather references, build a visual canvas, and share or archive the single `.canvas` file cleanly without polluting your attachment folder or leaving orphaned assets behind.

---

## Overview & Scope

By default, Obsidian Canvas treats images as either external linked URLs or separate media files stored in your vault's attachment folder. Kambas enhances how media is stored, rendered, and manipulated inside `.canvas` files.

### Targeted Elements & Scope

- **Canvas Image Nodes**: Applies non-destructive CSS transformations (horizontal flip, vertical flip, grayscale) and aspect ratio resets to native file images and embedded data URI nodes.
- **All Canvas Node Types**: Extends opacity controls across image nodes, text cards, file embeds, and canvas groups.
- **Media Attachments**: Manages media files referenced within canvas nodes, allowing in-place conversion to embedded data URIs or relocation within the vault.
- **Canvas Viewport**: Intercepts canvas keyboard events to provide customizable smooth panning and zooming.

---

## Why Embed Media Directly Inside `.canvas` Files?

Standard Obsidian behavior creates a new PNG, JPG, or WebP file in your vault's attachment directory every time an image is pasted or dropped onto a canvas. For canvas-heavy workflows, this creates several challenges:

1. **Vault Attachment Pollution**: Over time, hundreds of single-use image files accumulate in attachment folders, making vault navigation and file search cluttered.
2. **Broken File Links**: Moving or reorganizing files, renaming folders, or syncing vaults across devices can break relative image links inside `.canvas` files.
3. **Lack of Portability**: Sharing or backing up a canvas requires manually locating and exporting all referenced image attachments alongside the `.canvas` JSON file.

### How Kambas Solves This

Kambas allows you to convert or ingest media directly as inline Base64 Data URIs (`url: "data:image/png;base64,..."`) embedded inside the `.canvas` JSON structure:

- **Self-Contained Canvas Files**: A single `.canvas` file contains all its visual data. You can copy, move, share, or back up the canvas file independently without missing image dependencies.
- **Vault Cleanliness**: Option to bypass vault attachment creation entirely when pasting or dropping web images.
- **Clean Ingestion Options**: Choose on paste/drop whether to save to the vault attachment folder or embed directly into the canvas file. Existing vault attachments can also be converted into embedded data URIs with an option to remove the original source file from disk.

---

## Technical Limitations

While inline embedding offers portability and vault cleanliness, there are trade-offs to consider:

- **File Size Inflation**: Base64 encoding increases binary image data size by approximately 33%. Storing multiple large images directly inside a `.canvas` file will significantly increase the raw file size.
- **Performance Impact on Large Boards**: Loading `.canvas` files containing dozens of high-resolution embedded Base64 images can increase memory consumption and cause latency during initial canvas rendering or JSON parsing.
- **Vault Search & Indexing**: Embedded Base64 strings add long data blocks to `.canvas` text files, which can create noise during global text searches. Embedded images are also invisible to vault asset managers that index file attachments.
- **Recommendation**: Use inline embedding primarily for mood boards, small reference canvases, and portable notes. For massive image libraries or ultra-high-resolution assets, standard vault file storage remains recommended.

---

## Architecture & Data Persistence

Kambas performs all visual modifications non-destructively. Original image files stored on disk are never altered.

### How Settings and Transforms Persist

Obsidian `.canvas` files store node definitions in a JSON array. Each node contains an `unknownData` object reserved for plugin metadata. Kambas stores node-level visual state directly in this property:

```json
{
  "id": "node-id-123",
  "type": "file",
  "file": "attachments/image.png",
  "unknownData": {
    "kambasFlipH": true,
    "kambasFlipV": false,
    "kambasGrayscale": true,
    "kambasOpacity": 0.85,
    "originalWidth": 1200,
    "originalHeight": 800
  }
}
```

- **Persistence across sessions**: Because metadata is written directly to the `.canvas` file JSON, image flips, grayscale filters, opacity settings, and original dimensions persist across Obsidian restarts, device syncs, and canvas reloads.
- **Non-destructive**: Disabling or uninstalling Kambas leaves original image files untouched. The visual metadata remains in the `.canvas` file and can be restored if Kambas is re-enabled.

---

## Key Functionality

### Image & Node Manipulations
- **Horizontal & Vertical Flipping**: Mirror images along the X or Y axis.
- **Grayscale Toggle**: Apply a grayscale filter for visual contrast or blueprint-style workflows.
- **Node Opacity**: Adjust transparency for any canvas node (images, text cards, file cards, groups) from 0% to 100%.
- **Reset Dimensions**: Restore resized images back to their natural width and height.
- **Clipboard Actions**: Copy image data or files directly from selected canvas nodes to the system clipboard.

### Storage & Media Ingestion
- **Ingestion Modal**: Automatically prompts on image paste/drop to select between vault file storage or inline canvas embedding.
- **Batch Processing**: Apply storage choices across multiple dropped or pasted files at once.
- **Convert File to Embed**: Convert vault file nodes into embedded base64 canvas nodes with options to keep or delete the original vault file.
- **File Management**: Relocate or copy media files referenced by selected canvas nodes to target vault folders using a fuzzy folder suggest modal.
- **Hide Media Label**: Suppress the native base64/URL header text banner displayed above data URI nodes for cleaner canvas cards.

### Keyboard Canvas Navigation
- **Keyboard Panning**: Pan the active canvas using directional key bindings (`WASD` or `Arrow Keys`) with configurable maximum pan speed.
- **Keyboard Zooming**: Zoom in and out using keyboard shortcuts (`+` / `-`) with adjustable zoom speed.

---

## Controls Reference

### Context Menu Actions

Right-click any node or selection inside an active Canvas view to access Kambas commands:

| Command | Target Scope | Description |
| :--- | :--- | :--- |
| Flip horizontal | Image nodes | Flips selected image along horizontal axis. |
| Flip vertical | Image nodes | Flips selected image along vertical axis. |
| Toggle grayscale | Image nodes | Toggles CSS grayscale filter. |
| Change opacity | All canvas nodes | Opens modal to adjust opacity percentage. |
| Reset to original size | Image nodes | Restores node dimensions to image's natural dimensions. |
| Embed in canvas file... | Vault image nodes | Converts vault file link into inline base64 data URI. |
| Copy media to clipboard | Image nodes | Copies image file or data URI to clipboard. |
| Move / Copy media to... | Media file nodes | Opens folder picker to move or duplicate vault file. |

### Keyboard Shortcuts

| Action | Default Binding | Configuration Path |
| :--- | :--- | :--- |
| Pan Up / Down / Left / Right | `W` / `S` / `A` / `D` or `Up` / `Down` / `Left` / `Right` | Settings > Kambas > Pan controls |
| Zoom In / Out | `+` / `-` | Settings > Kambas > Zoom controls |

---

## Configuration

Access settings under **Obsidian Settings** > **Kambas**:

- **Hide media label**: Hides the base64 URL / data label header banner displayed above embedded canvas media cards.
- **Pan controls**: Customize directional keys used for canvas panning and set maximum pan speed (units per frame).
- **Zoom controls**: Customize keys used for canvas zooming and set zoom speed rate.

---

## Installation

### Community Plugins
1. Open **Obsidian Settings** > **Community Plugins**.
2. Disable **Restricted Mode**.
3. Select **Browse**, search for **Kambas**, and click **Install**.
4. Enable the plugin after installation completes.

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
2. Create a folder named `kambas` inside your vault's plugin directory:
   `<vault>/.obsidian/plugins/kambas/`
3. Copy the downloaded files into the `kambas` directory.
4. Reload Obsidian and enable **Kambas** under **Community Plugins**.

---

## Support & Funding

If you find Kambas useful in your workflow, consider supporting ongoing development:

- **[Ko-fi](https://ko-fi.com/emarpiee)**
- **[PayPal](https://paypal.me/emarpiee)**

---

## Development

### Prerequisites
- Node.js (v18+)
- npm

### Setup & Build Commands

```bash
# Install dependencies
npm install

# Start development watcher
npm run dev

# Run typecheck & lint checks
npm run health

# Execute test suite
npm run test

# Build production bundle
npm run build
```

---

## License

Distributed under the [MIT License](LICENSE).
