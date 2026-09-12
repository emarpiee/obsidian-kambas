 > [!NOTE]
> **Work in Progress** — Kambas is actively developed. Features and interfaces may evolve between releases.

# Kambas

**A PureRef-inspired visual workspace and image toolkit for Obsidian Canvas.**

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

A right-click context menu appears on any canvas node. For image nodes, this includes:

| Command | Description |
| :--- | :--- |
| **Flip horizontal / vertical** | Mirror the image along its X or Y axis (persisted across virtualized canvas nodes). |
| **Toggle grayscale** | Apply a CSS grayscale filter to evaluate value structure and contrast without color distraction. |
| **Color palette** | Extract and display dominant color swatches as an overlay on the image (3–10 swatches, configurable) with a one-click **Copy all palette colors** button. |
| **Change opacity** | Set transparency (0–100%) on any node type — images, text cards, file embeds, or groups. |
| **Reset to original size** | Restore a scaled node to its native pixel dimensions. |
| **Copy media to clipboard** | Copy the raw image data from the canvas node to the system clipboard. |
| **Swap media…** | Replace the current image or video with another from your vault, a local file, or the clipboard — preserving position and aspect ratio. |
| **Embed in canvas file…** | Convert a vault-linked file node into an inline Base64 data URI (with optional deletion of the source file). |
| **Move / Copy media to…** | Relocate or duplicate a vault-linked media file to another folder using a fuzzy-finder picker. |

---

### Storage & Ingestion

When you paste from clipboard or drag-and-drop files onto the canvas, Kambas intercepts the action and presents a choice:

- **Embed in canvas** — encode the image as a Base64 data URI stored inside the `.canvas` file.
- **Save to vault** — write the file to a configured attachment folder as a standard Obsidian file link.

Multi-file drops are handled in a single batch operation. The **Hide media label** setting suppresses the technical data URI header that would otherwise appear above embedded image cards, giving a clean card-style appearance.

---

### Filter Panel (Tags & Colors)

The Filter Panel is a floating, draggable, resizable panel accessible from the **Tags** button in the canvas toolbar. It has two tabs — **Tags** and **Colors** — that work together to isolate, explore, and focus on specific subsets of canvas image nodes. Active filter indicators (dot badges) appear on each tab header whenever active filters exist within that tab.

#### How Filtering Works

Kambas uses an **include + exclude** model per tab. Each row in the filter list cycles through three states on repeated click:

| State | Icon | Visual | Behavior |
| :--- | :--- | :--- | :--- |
| **Neutral** | ☐ | Default | Not involved in filtering |
| **Include** ✓ | ☑ | Blue accent background | Node must have this tag or color to be visible |
| **Exclude** ✗ | ✕ | Red background | Node is hidden if it has this tag or color, even if it also matches an include filter |

**Exclude wins over include.** If a node matches an included tag but also has an excluded color, it is hidden. This allows fine-grained refinement: include a broad category, then exclude specific attributes within it.

When any filter is active, nodes that do not match are dimmed rather than removed. The dim opacity is adjustable via a slider in the panel footer (default: 12%).

#### Contextual Awareness — "In View" Intelligence

When a filter is active, the panel automatically surfaces which tags and colors are **co-present in the currently visible nodes** — without any hovering or manual inspection needed.

- **"N in view" badge**: Each row shows a secondary amber badge indicating how many of the currently-visible nodes also carry that tag or color.
- **Related-first sorting**: Rows are sorted by their visible count, so the most co-occurring tags and colors always appear at the top.
- **Divider**: A "Not in current view" section separator groups rows that have zero presence in the visible set, keeping the relevant options immediately accessible.
- **Dimmed unrelated rows**: Tags or colors absent from the current view are displayed at reduced opacity (45%), hoverable to full opacity on demand.

**Example**: You include Gray in the Color tab. The panel immediately shows:
```
☑  Gray        [20 in view]   20 images    ← active include
☐  Red         [3 in view]    3 images     ← 3 visible gray images also contain red
☐  Orange      [2 in view]    17 images    ← 2 visible gray images also contain orange
───────── NOT IN CURRENT VIEW ─────────
☐  White                      14 images    ← dimmed; absent from all visible images
☐  Black                      5 images     ← dimmed
```

You can then click Red once (include) or twice (exclude) to refine without leaving the panel.

#### Cross-Highlighting

Hovering over a color row **outlines the matching canvas images** with an accent-colored glow, letting you preview which nodes would be affected before committing. Hovering over a canvas image node **highlights its corresponding color rows** in the panel and dims unrelated rows, making the relationship bidirectional and instantaneous.

#### Tags Tab

- **Tag assignment**: Right-click any node to open the tag modal. Type multiple comma-separated phrases to auto-format them into kebab-case tags (e.g. `character design, concept art` → `#character-design`, `#concept-art`). Press `Enter` to apply immediately.
- **Tag badges**: Tags render as small badges on canvas nodes. Badge position (outside-below or inside-bottom-left) is configurable in settings.
- **Toggle badge visibility**: The **Toggle tag visibility** command palette action shows or hides all badges on the current canvas.
- **Delete tag**: Each tag row has a trash icon that permanently removes the tag from every node in the canvas.
- **Search**: A search field at the top of the tab filters the list in real time.
- **Clear**: The **×** button inside the search bar clears all active includes and excludes for the Tags tab simultaneously.

#### Colors Tab

- **Dominant color extraction**: Kambas analyses each image's pixel data using HSV color buckling and classifies it into up to 13 named chromatic and neutral color categories: Black, Gray, White, Red, Orange, Yellow, Green, Teal, Cyan, Blue, Indigo, Purple, Pink.
- **Canvas Card Color Filtering**: Optionally filter by native Obsidian canvas node colors (Red, Orange, Yellow, Green, Cyan, Purple, Gray).
- **Multi-color per image**: An image can belong to multiple color buckets (e.g. a landscape with a red tree on a gray sky belongs to both Red and Gray).
- **Extraction modes** (configurable in settings):
  - **Auto** — colors are extracted lazily in the background when the Colors tab is opened.
  - **Manual** — extraction runs only when the "Scan canvas colors" button is clicked.
  - **Disabled** — color extraction is turned off entirely.
- **Accent & Name Customization**: Configurable settings to include/ignore minor accent colors and show/hide text color names next to swatches.
- **Search**: Filter the color list by name in real time.
- **Clear**: The **×** button inside the search bar clears all active color includes and excludes.

#### Shared Filter Behaviours

- **Auto zoom-to-fit**: Toggling any filter automatically pans and zooms the viewport to frame all matching visible nodes. Toggle **Zoom on select** in settings to enable or disable this.
- **Persistent filters**: Active includes and excludes survive panel close, canvas reopen, and Obsidian restart — stored per canvas file path in local storage.
- **Toolbar indicator**: The toolbar button remains lit (accent color) whenever any filter is active, even with the panel closed.
- **Selection guard**: Hidden nodes are automatically deselected during rubber-band selection and `Ctrl+A`, preventing accidental batch operations on filtered-out content.
- **Drag & resize**: The panel header can be dragged to any position. A plain click on the header never moves the panel — dragging requires actual mouse movement. The panel size is also resizable and persisted.

---

### Internationalization (i18n)

Kambas includes complete native localization for **13 languages**, matching your Obsidian UI language setting automatically:

- **English**, **Deutsch**, **Français**, **Español**, **日本語**, **简体中文**, **繁體中文**, **한국어**, **Русский**, **Italiano**, **Português**, **Nederlands**.

---

### Keyboard Navigation

| Action | Default Shortcut |
| :--- | :--- |
| Pan Up / Down / Left / Right | `W` / `S` / `A` / `D` or Arrow Keys |
| Zoom In / Out | `+` / `-` |
| Toggle tag visibility | Command Palette |

Pan speed and zoom sensitivity are configurable in **Settings > Kambas**.

---

## Configuration

Open **Obsidian Settings > Kambas** to configure:

| Setting | Description |
| :--- | :--- |
| **Hide media label** | Hides the raw data URI header above embedded image cards for a cleaner appearance. |
| **Color palette swatches** | Number of dominant colors to extract and display per image (3–10). |
| **Palette color separator** | Custom delimiter used when copying all palette colors to clipboard (e.g. `, `, `\n`, ` `). |
| **Pan speed** | Maximum canvas pan speed per frame (WASD / arrow keys). |
| **Zoom sensitivity** | Step size for each zoom increment. |
| **Tag filter dim opacity** | Opacity of hidden nodes while a filter is active (default: 12%). |
| **Tag badge position** | Outside-below the node, or inside at the bottom-left. |
| **Zoom on select** | Auto-zoom to fit visible nodes when a filter is toggled. |
| **Color extraction mode** | Auto, Manual ("Scan canvas colors"), or Disabled. |
| **Include accent colors** | Include low-coverage minor accent colors in HSV filter extraction. |
| **Display color names** | Display color name text labels alongside swatches in the color filter list. |
| **Include card colors** | Include native Obsidian canvas card/node border and background colors in filtering. |

---

## Technical Notes

### Data Persistence

Kambas stores all node state inside the `.canvas` JSON without touching original image files:

- **`kambasTags`** — array of tag strings, stored as a top-level node property.
- **`unknownData.kambasFlipH/V`** — horizontal and vertical flip state.
- **`unknownData.kambasGrayscale`** — grayscale filter toggle.
- **`unknownData.kambasPalette`** — palette swatch overlay toggle.
- **`unknownData.kambasOpacity`** — node transparency value.
- **`unknownData.originalWidth/Height`** — cached native dimensions for reset-to-size.

Filter state (active includes and excludes per canvas file) is stored in Obsidian's local storage, separate from the `.canvas` file itself.

### Trade-offs of Inline Embedding

| Consideration | Detail |
| :--- | :--- |
| **Supported formats** | PNG, JPG/JPEG, WebP, GIF, SVG. Non-image files (PDF, audio, video) cannot be Base64-embedded. |
| **File size** | Base64 encoding adds ~33% to binary size. Large boards with many high-resolution images will produce larger `.canvas` files. |
| **Performance** | Canvases with dozens of high-resolution embedded images may increase initial render times and memory usage. For ultra-high-resolution archives, native vault attachment linking is recommended. |
| **Vault indexing** | Embedded Base64 strings inside `.canvas` JSON are not indexed by Obsidian's standard asset search. |

---

## Installation

### Community Plugins

1. Open **Settings > Community Plugins** and disable Restricted Mode.
2. Click **Browse**, search for **Kambas**, and install.
3. Enable **Kambas** in the installed plugins list.

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/emarpiee/obsidian-kambas/releases).
2. Create `<vault>/.obsidian/plugins/obsidian-kambas/` and copy the files inside.
3. Reload Obsidian and enable **Kambas** under **Community Plugins**.

---

## Development

```bash
npm install        # Install dependencies
npm run dev        # Start dev build watcher
npm run health     # Type-check and lint
npm run build      # Production bundle
```

---

## Support

If Kambas improves your workflow, consider supporting its development:

- [Ko-fi](https://ko-fi.com/emarpiee)
- [PayPal](https://paypal.me/emarpiee)
