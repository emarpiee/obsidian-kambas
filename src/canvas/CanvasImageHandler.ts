import { App, ItemView, Notice, SliderComponent, TFile, TFolder, setIcon } from 'obsidian';
import { ConvertEmbedChoiceResult, ConvertToEmbedModal, VaultFileAction } from '../modals/ConvertToEmbedModal';
import { ImageIngestionModal, StorageChoice } from '../modals/ImageIngestionModal';
import { ImageSwapModal } from '../modals/ImageSwapModal';
import { TagModal } from '../modals/TagModal';
import { getText } from '../i18n';
import {
	arrayBufferToBase64DataUrl,
	blobToBase64,
	canvasNodePresetColorToName,
	extractImagePalette,
	getImageDimensions,
	getNodeDominantColorName,
	saveFileToVault,
} from '../utils/imageUtils';
import { CanvasFileData, CanvasItemView, CanvasNodeData, IMAGE_EXTENSIONS } from './CanvasTypes';
// CanvasTagSync imports removed (unused after sync-to-vault feature removal)

export interface PendingImage {
	filename: string;
	mimeType: string;
	file?: File;
	arrayBuffer?: ArrayBuffer;
}

export class CanvasImageHandler {
	private app: App;
	private plugin: import('../main').default;
	private editGuardObserver: MutationObserver | null = null;
	private modifyTimer: number | null = null;
	private lastMousePos: { x: number; y: number } | null = null;

	// Filter panel state (Tag & Color tabs)
	private activeFilterTab: 'tag' | 'color' = 'tag';
	private tagFilterPanelEl: HTMLElement | null = null;
	private activeTagFilters: Set<string> = new Set();
	private activeTagExcludes: Set<string> = new Set();
	private activeColorFilters: Set<string> = new Set();
	private activeColorExcludes: Set<string> = new Set();
	private activeTagFiltersFile: string | null = null;
	private nodeColorCache: Map<string, string[] | null> = new Map();
	private dimOpacity = 0.12;
	private tagToolbarBtn: HTMLElement | null = null;
	private tagFilterSelectionGuard: (() => void) | null = null;
	private colorHighlightCleanup: (() => void) | null = null;
	private lazyExtractDebounceTimer: number | null = null;

	constructor(app: App, plugin: import('../main').default) {
		this.app = app;
		this.plugin = plugin;
	}

	public registerEvents(): void {
		window.addEventListener('mousemove', this.handleMouseMove, true);
		window.addEventListener('pointermove', this.handleMouseMove, true);
		window.addEventListener('paste', this.handlePaste, true);
		window.addEventListener('drop', this.handleDrop, true);
		window.addEventListener('dblclick', this.handleDblClick, true);
		window.addEventListener('keydown', this.handleKeyDown, true);
		this.startEditGuard();
	}

	public unregisterEvents(): void {
		window.removeEventListener('mousemove', this.handleMouseMove, true);
		window.removeEventListener('pointermove', this.handleMouseMove, true);
		window.removeEventListener('paste', this.handlePaste, true);
		window.removeEventListener('drop', this.handleDrop, true);
		window.removeEventListener('dblclick', this.handleDblClick, true);
		window.removeEventListener('scroll', this.handleScrollOrPan, true);
		window.removeEventListener('wheel', this.handleScrollOrPan, true);
		window.removeEventListener('pointerup', this.handleScrollOrPan, true);
		window.removeEventListener('keyup', this.handleKeyUpCheck, true);
		window.removeEventListener('mouseup', this.handleMouseUpCheck, true);
		if (this.editGuardObserver) {
			this.editGuardObserver.disconnect();
			this.editGuardObserver = null;
		}
	}

	private handleMouseMove = (evt: MouseEvent): void => {
		if (evt.clientX !== undefined && evt.clientY !== undefined) {
			this.lastMousePos = { x: evt.clientX, y: evt.clientY };
		}
	};

	// ──────────────────────────────────────────────────────────────────────────
	// MutationObserver: automatic mounting for link-type image nodes
	// ──────────────────────────────────────────────────────────────────────────

	private rescanTimeoutId: number | null = null;

	private scheduleRescan(activeView: CanvasItemView): void {
		if (this.rescanTimeoutId !== null) return;
		this.rescanTimeoutId = window.setTimeout(() => {
			this.rescanTimeoutId = null;
			this.scanAndRestoreTransforms(activeView);
		}, 60);
	}

	private startEditGuard(): void {
		this.editGuardObserver = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
					for (let i = 0; i < mutation.addedNodes.length; i++) {
						const added = mutation.addedNodes[i];
						if (added.nodeType !== Node.ELEMENT_NODE) continue;
						const el = added as HTMLElement;
						if (el.closest?.('.kambas-tag-panel') || el.classList?.contains('kambas-tag-panel')) continue;
						if (el.tagName === 'IMG' || el.classList?.contains('canvas-node') || el.classList?.contains('canvas-node-content') || el.closest?.('.canvas-node')) {
							const activeView = this.app.workspace.getActiveViewOfType(ItemView) as unknown as CanvasItemView | null;
							if (activeView?.getViewType() === 'canvas') {
								this.scheduleRescan(activeView);
							}
							break;
						}
					}
				}
			}
		});

		this.editGuardObserver.observe(document.body, {
			subtree: true,
			childList: true,
		});

		// Listen to viewport scrolling/panning so virtualized nodes coming into view retain transforms
		window.addEventListener('scroll', this.handleScrollOrPan, true);
		window.addEventListener('wheel', this.handleScrollOrPan, true);
		window.addEventListener('pointerup', this.handleScrollOrPan, true);

		// Listen to keyup (Ctrl+V) and mouseup (Alt+Drag duplication) to refresh canvas link nodes
		window.addEventListener('keyup', this.handleKeyUpCheck, true);
		window.addEventListener('mouseup', this.handleMouseUpCheck, true);
	}

	private handleScrollOrPan = (evt: Event): void => {
		const target = evt.target as HTMLElement | null;
		if (target?.closest?.('.kambas-tag-panel')) return;
		const activeView = this.app.workspace.getActiveViewOfType(ItemView) as unknown as CanvasItemView | null;
		if (activeView?.getViewType() === 'canvas') {
			this.scheduleRescan(activeView);
		}
	};

	private handleKeyUpCheck = (evt: KeyboardEvent): void => {
		if (evt.key === 'v' || evt.key === 'V' || evt.key === 'z' || evt.key === 'Z' || evt.key === 'y' || evt.key === 'Y') {
			const activeView = this.app.workspace.getActiveViewOfType(ItemView) as unknown as CanvasItemView | null;
			if (activeView?.getViewType() === 'canvas') {
				this.scheduleRescan(activeView);
			}
		}
	};

	private handleMouseUpCheck = (): void => {
		const activeView = this.app.workspace.getActiveViewOfType(ItemView) as unknown as CanvasItemView | null;
		if (activeView?.getViewType() === 'canvas') {
			this.scheduleRescan(activeView);
		}
	};

	// ──────────────────────────────────────────────────────────────────────────
	// Event handlers
	// ──────────────────────────────────────────────────────────────────────────

	private focusedZoomNodeEl: Element | null = null;

	private handleDblClick = (evt: MouseEvent): void => {
		const activeView = this.app.workspace.getActiveViewOfType(ItemView) as unknown as CanvasItemView | null;
		if (!activeView || activeView.getViewType() !== 'canvas') return;

		const target = evt.target as HTMLElement | null;
		if (!target) return;

		const nodeEl = target.closest('.canvas-node');
		if (!nodeEl) return;

		const isKambas = Boolean(nodeEl.querySelector('.kambas-embedded-img'));
		const hasNativeImg = Boolean(this.getNativeImageElement(nodeEl));

		if (!isKambas && !hasNativeImg) return;

		// Block Obsidian from entering text-edit mode / raw markdown
		evt.preventDefault();
		evt.stopPropagation();
		evt.stopImmediatePropagation();

		const canvas = activeView.canvas;
		if (!canvas) return;

		// If this node is already focused from a previous double-click, unfocus & fit to view
		if (this.focusedZoomNodeEl === nodeEl) {
			this.focusedZoomNodeEl = null;
			if (typeof canvas.zoomToFit === 'function') {
				try {
					canvas.zoomToFit();
					return;
				} catch {
					// Fallback
				}
			}
		}

		// First double-click: focus and zoom into image node
		this.focusedZoomNodeEl = nodeEl;
		if (typeof canvas.zoomToSelection === 'function') {
			try {
				canvas.zoomToSelection();
			} catch {
				// Ignore zoom errors
			}
		}
	};



	/** Returns the native (non-kambas) image element inside a canvas node, if any. */
	public getNativeImageElement(nodeEl: Element): HTMLImageElement | null {
		// Look for any img that is not our embedded image and not inside a markdown render
		const imgs = nodeEl.querySelectorAll<HTMLImageElement>('img:not(.kambas-embedded-img)');
		for (const img of Array.from(imgs)) {
			// Skip images that are inside a markdown preview (inline content images)
			if (img.closest('.markdown-preview-view')) continue;
			return img;
		}
		return null;
	}

	/** Toggle flip/grayscale on a native canvas file image node. */
	public toggleNativeImageTransform(
		activeView: CanvasItemView,
		nodeEl: Element,
		key: string
	): void {
		const file = activeView.file;
		if (!file) return;

		const canvas = activeView.canvas;
		if (!canvas?.nodes) return;

		// Find the node ID by matching nodeEl in the canvas map
		let canvasNodeObj: unknown = null;
		let nodeId: string | null = null;
		canvas.nodes.forEach((node, id) => {
			if (node.nodeEl && (node.nodeEl === nodeEl || nodeEl.contains(node.nodeEl) || node.nodeEl.contains(nodeEl))) {
				canvasNodeObj = node;
				nodeId = id;
			}
		});
		if (!nodeId || !canvasNodeObj) return;

		const unknownData = (canvasNodeObj as { unknownData?: { kambasFlipH?: boolean; kambasFlipV?: boolean; kambasGrayscale?: boolean } }).unknownData;
		if (unknownData) {
			if (key === 'h') unknownData.kambasFlipH = !unknownData.kambasFlipH;
			if (key === 'v') unknownData.kambasFlipV = !unknownData.kambasFlipV;
			if (key === 'g') unknownData.kambasGrayscale = !unknownData.kambasGrayscale;
		}

		// Apply CSS class immediately for instant feedback.
		// Flip is set on nodeEl (CSS targets img inside it) so it works even when <img> isn't mounted.
		if (unknownData) {
			nodeEl.classList.toggle('kambas-img-flip-h', Boolean(unknownData.kambasFlipH));
			nodeEl.classList.toggle('kambas-img-flip-v', Boolean(unknownData.kambasFlipV));
		}
		const img = this.getNativeImageElement(nodeEl);
		if (img && unknownData) {
			img.classList.toggle('kambas-img-grayscale', Boolean(unknownData.kambasGrayscale));
		}

		if (typeof canvas.requestSave === 'function') {
			try {
				canvas.requestSave();
			} catch {
				void this.persistImageTransform(file, [nodeId], key);
			}
		} else {
			void this.persistImageTransform(file, [nodeId], key);
		}
	}

	private scheduleVaultModify(file: TFile, data: CanvasFileData): void {
		if (this.modifyTimer !== null) {
			window.clearTimeout(this.modifyTimer);
		}
		this.modifyTimer = window.setTimeout(() => {
			this.modifyTimer = null;
			void this.app.vault.modify(file, JSON.stringify(data, null, 2));
		}, 400);
	}

	/** Mount base64 link images instantly from in-memory canvas data and apply CSS classes. */
	public scanAndRestoreTransforms(activeView: CanvasItemView): void {
		const canvas = activeView.canvas;
		if (!canvas?.nodes) return;

		canvas.nodes.forEach((canvasNode) => {
			const nodeEl = canvasNode.nodeEl;
			if (!nodeEl) return;

			// Extract link URL or data directly from canvas node object memory (0ms delay)
			const unknownData = (canvasNode as unknown as { unknownData?: { type?: string; url?: string; kambasFlipH?: boolean; kambasFlipV?: boolean; kambasGrayscale?: boolean; kambasPalette?: boolean; kambasOpacity?: number; kambasTags?: string[] } }).unknownData;
			const nodeUrl = unknownData?.url;
			const isLinkDataImg = unknownData?.type === 'link' && nodeUrl?.startsWith('data:image/');

			if (isLinkDataImg && nodeUrl) {
				const container = nodeEl.querySelector('.canvas-node-content') ?? nodeEl;
				let existingImg = container.querySelector<HTMLImageElement>('img.kambas-embedded-img');
				if (!existingImg) {
					container.empty();
					existingImg = container.createEl('img', {
						cls: 'kambas-embedded-img',
						attr: {
							src: nodeUrl,
							draggable: 'false',
							style: 'position:absolute;top:0;left:0;right:0;bottom:0;width:100%;height:100%;object-fit:contain;display:block;margin:0;padding:0;border:none;pointer-events:none;user-select:none;-webkit-user-drag:none;',
						},
					});
				}

				// Lock parent node aspect ratio to natural image dimensions
				const rawNode = canvasNode as unknown as { aspectRatio?: number; isAspectPreserved?: boolean; width?: number; height?: number };
				if (existingImg.complete && existingImg.naturalWidth && existingImg.naturalHeight) {
					rawNode.aspectRatio = existingImg.naturalWidth / existingImg.naturalHeight;
					rawNode.isAspectPreserved = true;
				} else {
					existingImg.addEventListener('load', () => {
						if (existingImg?.naturalWidth && existingImg?.naturalHeight) {
							rawNode.aspectRatio = existingImg.naturalWidth / existingImg.naturalHeight;
							rawNode.isAspectPreserved = true;
						}
					}, { once: true });
				}
			}

			// Apply stored transforms & opacity
			if (unknownData) {
				nodeEl.classList.toggle('kambas-node-grayscale', Boolean(unknownData.kambasGrayscale));
			}

			// Flip is set on nodeEl; CSS descendant selector targets img inside it.
			if (unknownData) {
				nodeEl.classList.toggle('kambas-img-flip-h', Boolean(unknownData.kambasFlipH));
				nodeEl.classList.toggle('kambas-img-flip-v', Boolean(unknownData.kambasFlipV));
			}
			const img = this.getNativeImageElement(nodeEl) ?? nodeEl.querySelector<HTMLImageElement>('img');
			if (img && unknownData) {
				img.classList.toggle('kambas-img-grayscale', Boolean(unknownData.kambasGrayscale));

				// Handle palette overlay
				let paletteEl = nodeEl.querySelector<HTMLElement>('.kambas-palette-bar');
				if (unknownData.kambasPalette) {
					const count = this.plugin?.settings?.paletteSwatchCount ?? 5;
					if (!paletteEl || paletteEl.dataset.count !== String(count)) {
						if (paletteEl) paletteEl.remove();
						paletteEl = nodeEl.createDiv({ cls: 'kambas-palette-bar' });
						paletteEl.dataset.count = String(count);
						
						const targetPaletteEl = paletteEl;
						const loadAndRenderPalette = (src: string): void => {
							void extractImagePalette(src, count).then((swatches) => {
								if (!targetPaletteEl || !targetPaletteEl.isConnected) return;
								targetPaletteEl.empty();

								// Prepend copy button to copy all palette hex values
								if (swatches.length > 0) {
									const copyBtn = targetPaletteEl.createDiv({
										cls: 'kambas-palette-copy-btn',
										attr: { 'aria-label': 'Copy all palette colors' },
									});
									copyBtn.setAttribute('title', 'Copy all palette colors');
									setIcon(copyBtn, 'copy');
									copyBtn.addEventListener('click', (e) => {
										e.stopPropagation();
										e.preventDefault();
										const sep = this.plugin?.settings?.paletteCopySeparator ?? ', ';
										const textToCopy = swatches.join(sep);
										void navigator.clipboard.writeText(textToCopy);
										new Notice(`Copied ${swatches.length} colors to clipboard!`);
									});
								}

								for (const hex of swatches) {
									const swatch = targetPaletteEl.createDiv({ cls: 'kambas-palette-swatch' });
									swatch.style.backgroundColor = hex;
									swatch.setAttribute('title', `${hex} (Click to copy)`);
									swatch.addEventListener('click', (e) => {
										e.stopPropagation();
										e.preventDefault();
										void navigator.clipboard.writeText(hex);
										new Notice(`Copied ${hex} to clipboard!`);
									});
								}
							});
						};

						if (img.complete && img.naturalWidth > 0 && img.src) {
							loadAndRenderPalette(img.src);
						} else {
							// Image is still loading in browser — extract once image finishes loading
							img.addEventListener('load', () => {
								if (img.src) loadAndRenderPalette(img.src);
							}, { once: true });
						}
					}
					paletteEl.classList.toggle('kambas-palette-grayscale', Boolean(unknownData.kambasGrayscale));
				} else if (paletteEl) {
					paletteEl.remove();
				}
			}

			// Apply opacity to any canvas node element (images, text, cards, groups, files)
			if (unknownData?.kambasOpacity !== undefined) {
				nodeEl.setCssProps({ opacity: String(unknownData.kambasOpacity) });
			} else {
				nodeEl.setCssProps({ opacity: '' });
			}

			// Render tag badges
			const tags = unknownData?.kambasTags ?? [];
			this.renderTagBadges(nodeEl, tags);
		});

		// Apply individual edge stored opacity
		if (canvas.edges) {
			canvas.edges.forEach((edge) => {
				const uData = edge.unknownData;
				const op = uData?.kambasOpacity;
				if (op !== undefined) {
					if (edge.lineGroupEl) edge.lineGroupEl.setCssProps({ opacity: String(op) });
					else if (edge.lineElement) edge.lineElement.setCssProps({ opacity: String(op) });
					if (edge.lineEndGroupEl) edge.lineEndGroupEl.setCssProps({ opacity: String(op) });
				}
			});
		}

		// Check if canvas wrapper/edges should be restored or hidden
		const canvasEl = (activeView.canvas as unknown as { wrapperEl?: HTMLElement })?.wrapperEl ?? document.querySelector('.canvas-wrapper');
		if (canvasEl) {
			const edgesEl = canvasEl.querySelector<HTMLElement>('.canvas-edges');
			if (edgesEl) {
				// If all nodes are at opacity 0, keep edges hidden
				let allNodesZero = canvas.nodes.size > 0;
				canvas.nodes.forEach((node) => {
					const uData = (node as unknown as { unknownData?: { kambasOpacity?: number } }).unknownData;
					if (uData?.kambasOpacity !== 0) {
						allNodesZero = false;
					}
				});
				if (allNodesZero) {
					edgesEl.setCssProps({ opacity: '0' });
					canvasEl.classList.add('kambas-away-mode');
				} else {
					edgesEl.setCssProps({ opacity: '' });
					canvasEl.classList.remove('kambas-away-mode');
				}
			}
		}

		// Re-apply / restore tag & color filters after scan
		const filterFile = activeView.file;
		if (filterFile) {
			if (this.activeTagFiltersFile !== filterFile.path) {
				// Canvas file changed! Close panel if open, clear previous file's selection guard & filters
				if (this.tagFilterPanelEl) {
					this.closeTagFilterPanel(activeView);
				}
				this.removeSelectionGuard();
				this.activeTagFilters.clear();
				this.activeColorFilters.clear();
				this.nodeColorCache.clear();
				this.activeTagFiltersFile = filterFile.path;
				this.restoreFilterState(filterFile, activeView);

				// Auto-extract colors if enabled
				if ((this.plugin.settings.colorExtractMode ?? 'auto') === 'auto') {
					void this.extractAllNodeColors(activeView);
				}
			} else if (this.activeTagFilters.size > 0 || this.activeColorFilters.size > 0) {
				// Same file, active filters — re-apply (e.g. after badge re-render)
				this.applyTagFilters(activeView);
			} else {
				// Same file, NO active filters — ensure all nodes are visible and interactive!
				canvas.nodes.forEach((node) => node.nodeEl?.classList.remove('kambas-tag-hidden'));
				this.removeSelectionGuard();
			}
		}

		// Refresh tag filter panel if open (e.g. after undo/redo or node tag modifications)
		if (this.tagFilterPanelEl?.isConnected) {
			this.refreshTagFilterPanel(activeView);
		}

		// Inject tag filter button into canvas toolbar (idempotent)
		window.setTimeout(() => this.injectTagFilterButton(activeView), 200);
	}

	public setAwayMode(activeView: CanvasItemView): void {
		const file = activeView.file;
		if (!file) return;

		const canvas = activeView.canvas;
		if (!canvas?.nodes) return;

		// Determine if currently in Away Mode (i.e. all nodes are opacity 0)
		let currentlyAway = canvas.nodes.size > 0;
		canvas.nodes.forEach((node) => {
			const uData = (node as unknown as { unknownData?: { kambasOpacity?: number } }).unknownData;
			if (uData?.kambasOpacity !== 0) {
				currentlyAway = false;
			}
		});

		// Toggle target opacity: if currently away, restore to 1; otherwise set to 0
		const targetOpacity = currentlyAway ? 1 : 0;
		const selectedNodeIds: string[] = [];

		canvas.nodes.forEach((canvasNode, id) => {
			selectedNodeIds.push(id);
			const rawNode = canvasNode as unknown as { unknownData?: { kambasOpacity?: number } };
			if (!rawNode.unknownData) rawNode.unknownData = {};
			rawNode.unknownData.kambasOpacity = targetOpacity;

			if (canvasNode.nodeEl) {
				canvasNode.nodeEl.setCssProps({ opacity: String(targetOpacity) });
			}
		});

		// Also toggle all edges/paths and arrows inside canvas container
		if (canvas.edges) {
			canvas.edges.forEach((canvasEdge) => {
				if (!canvasEdge.unknownData) canvasEdge.unknownData = {};
				canvasEdge.unknownData.kambasOpacity = targetOpacity;

				if (canvasEdge.lineGroupEl) {
					canvasEdge.lineGroupEl.setCssProps({ opacity: String(targetOpacity) });
				} else if (canvasEdge.lineElement) {
					canvasEdge.lineElement.setCssProps({ opacity: String(targetOpacity) });
				}
				if (canvasEdge.lineEndGroupEl) {
					canvasEdge.lineEndGroupEl.setCssProps({ opacity: String(targetOpacity) });
				}
			});
		}

		const canvasEl = (activeView.canvas as unknown as { wrapperEl?: HTMLElement })?.wrapperEl ?? document.querySelector('.canvas-wrapper');
		if (canvasEl) {
			const edgesEl = canvasEl.querySelector<HTMLElement>('.canvas-edges');
			if (edgesEl) {
				edgesEl.setCssProps({ opacity: String(targetOpacity) });
			}
			if (targetOpacity === 0) {
				canvasEl.classList.add('kambas-away-mode');
			} else {
				canvasEl.classList.remove('kambas-away-mode');
			}
		}

		if (selectedNodeIds.length === 0) return;

		if (typeof canvas.requestSave === 'function') {
			try {
				canvas.requestSave();
			} catch {
				void this.persistOpacity(file, selectedNodeIds, targetOpacity);
			}
		} else {
			void this.persistOpacity(file, selectedNodeIds, targetOpacity);
		}
	}

	public setSelectedNodeOpacity(
		activeView: CanvasItemView,
		opacity: number,
		targetNodeEl?: Element | null
	): void {
		const file = activeView.file;
		if (!file) return;

		const canvas = activeView.canvas;
		if (!canvas?.nodes) return;

		const selectedNodeIds: string[] = [];

		canvas.nodes.forEach((canvasNode, id) => {
			const nodeEl = canvasNode.nodeEl;
			if (!nodeEl) return;

			const isTargetNode = targetNodeEl && (nodeEl === targetNodeEl || nodeEl.contains(targetNodeEl));
			const isExplicitlySelected = nodeEl.classList.contains('is-selected');

			if (isExplicitlySelected || isTargetNode) {
				selectedNodeIds.push(id);

				const rawNode = canvasNode as unknown as { unknownData?: { kambasOpacity?: number } };
				if (!rawNode.unknownData) rawNode.unknownData = {};
				rawNode.unknownData.kambasOpacity = opacity;

				nodeEl.setCssProps({ opacity: String(opacity) });
			}
		});

		// Check if any edge needs opacity restored
		const canvasEl = (activeView.canvas as unknown as { wrapperEl?: HTMLElement })?.wrapperEl ?? document.querySelector('.canvas-wrapper');
		if (canvasEl) {
			const edgesEl = canvasEl.querySelector<HTMLElement>('.canvas-edges');
			if (edgesEl) {
				let allNodesZero = canvas.nodes.size > 0;
				canvas.nodes.forEach((node) => {
					const uData = (node as unknown as { unknownData?: { kambasOpacity?: number } }).unknownData;
					if (uData?.kambasOpacity !== 0) {
						allNodesZero = false;
					}
				});
				if (!allNodesZero) {
					edgesEl.setCssProps({ opacity: '' });
					canvasEl.classList.remove('kambas-away-mode');
				}
			}
		}

		if (selectedNodeIds.length === 0) return;

		if (typeof canvas.requestSave === 'function') {
			try {
				canvas.requestSave();
			} catch {
				void this.persistOpacity(file, selectedNodeIds, opacity);
			}
		} else {
			void this.persistOpacity(file, selectedNodeIds, opacity);
		}
	}

	public setSelectedEdgeOpacity(
		activeView: CanvasItemView,
		opacity: number,
		targetEdgeEl?: Element | null,
		targetEdgeObj?: unknown
	): void {
		const file = activeView.file;
		if (!file) return;

		const canvas = activeView.canvas;
		if (!canvas) return;

		const selectedEdgeIds: string[] = [];

		if (targetEdgeObj) {
			const edgeObj = targetEdgeObj as { id?: string; unknownData?: { kambasOpacity?: number }; lineGroupEl?: HTMLElement; lineElement?: HTMLElement; lineEndGroupEl?: HTMLElement };
			if (!edgeObj.unknownData) edgeObj.unknownData = {};
			edgeObj.unknownData.kambasOpacity = opacity;

			if (edgeObj.id) selectedEdgeIds.push(edgeObj.id);

			if (edgeObj.lineGroupEl) {
				edgeObj.lineGroupEl.setCssProps({ opacity: String(opacity) });
			} else if (edgeObj.lineElement) {
				edgeObj.lineElement.setCssProps({ opacity: String(opacity) });
			}
			if (edgeObj.lineEndGroupEl) {
				edgeObj.lineEndGroupEl.setCssProps({ opacity: String(opacity) });
			}
		}

		// Target matching edges or all selected edges in canvas.edges
		const edges = canvas.edges;
		if (edges) {
			edges.forEach((canvasEdge, id) => {
				const edgeContainer = canvasEdge.lineGroupEl ?? canvasEdge.lineElement;
				const isTargetEdge = (targetEdgeEl && edgeContainer && (edgeContainer === targetEdgeEl || edgeContainer.contains(targetEdgeEl) || targetEdgeEl.contains(edgeContainer))) || (targetEdgeObj && canvasEdge === targetEdgeObj);
				const isExplicitlySelected = edgeContainer?.classList.contains('is-selected');

				if (isExplicitlySelected || isTargetEdge) {
					if (!selectedEdgeIds.includes(id)) selectedEdgeIds.push(id);
					if (!canvasEdge.unknownData) canvasEdge.unknownData = {};
					canvasEdge.unknownData.kambasOpacity = opacity;

					if (canvasEdge.lineGroupEl) {
						canvasEdge.lineGroupEl.setCssProps({ opacity: String(opacity) });
					} else if (canvasEdge.lineElement) {
						canvasEdge.lineElement.setCssProps({ opacity: String(opacity) });
					}
					if (canvasEdge.lineEndGroupEl) {
						canvasEdge.lineEndGroupEl.setCssProps({ opacity: String(opacity) });
					}
				}
			});
		}

		// Also check DOM elements if edges map is unavailable or target specified
		if (targetEdgeEl) {
			const edgeGroup = (targetEdgeEl as HTMLElement).closest('.canvas-edge') ?? (targetEdgeEl);
			(edgeGroup as HTMLElement).setCssProps?.({ opacity: String(opacity) });
		}

		if (typeof canvas.requestSave === 'function') {
			try {
				canvas.requestSave();
			} catch {
				if (selectedEdgeIds.length > 0) void this.persistEdgeOpacity(file, selectedEdgeIds, opacity);
			}
		} else {
			if (selectedEdgeIds.length > 0) void this.persistEdgeOpacity(file, selectedEdgeIds, opacity);
		}
	}

	private async persistEdgeOpacity(file: TFile, selectedEdgeIds: string[], opacity: number): Promise<void> {
		const content = await this.app.vault.read(file);
		let data: CanvasFileData;
		try {
			data = JSON.parse(content) as CanvasFileData;
		} catch {
			return;
		}
		if (!data.edges) return;
		let modified = false;
		data.edges.forEach((edge) => {
			if (edge.id && selectedEdgeIds.includes(edge.id)) {
				edge.kambasOpacity = opacity;
				modified = true;
			}
		});
		if (modified) this.scheduleVaultModify(file, data);
	}

	private async persistOpacity(file: TFile, selectedNodeIds: string[], opacity: number): Promise<void> {
		const content = await this.app.vault.read(file);
		let data: CanvasFileData;
		try {
			data = JSON.parse(content) as CanvasFileData;
		} catch {
			return;
		}
		if (!data.nodes) return;
		let modified = false;
		data.nodes.forEach((node) => {
			if (node.id && selectedNodeIds.includes(node.id)) {
				node.kambasOpacity = opacity;
				modified = true;
			}
		});
		if (modified) this.scheduleVaultModify(file, data);
	}

	private handleKeyDown = (evt: KeyboardEvent): void => {
		const activeView = this.app.workspace.getActiveViewOfType(ItemView) as unknown as CanvasItemView | null;
		if (!activeView || activeView.getViewType() !== 'canvas') return;

		const activeEl = document.activeElement as HTMLElement | null;
		if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
			return;
		}

		const key = evt.key;
		const lowerKey = key.toLowerCase();

		if (lowerKey === 'h' || lowerKey === 'v' || lowerKey === 'g') {
			void this.toggleSelectedImageTransform(activeView, lowerKey);
		}
	};

	// ──────────────────────────────────────────────────────────────────────────
	// Transform logic
	// ──────────────────────────────────────────────────────────────────────────

	public async toggleSelectedImageTransform(
		activeView: CanvasItemView,
		key: string,
		targetNodeEl?: Element | null
	): Promise<void> {
		const file = activeView.file;
		if (!file) return;

		const canvas = activeView.canvas;
		if (!canvas || !canvas.nodes) return;

		const selectedNodeEls: HTMLElement[] = [];
		const selectedNodeIds: string[] = [];

		canvas.nodes.forEach((node, id) => {
			const nodeEl = node.nodeEl;
			if (!nodeEl) return;

			const isTargetNode = targetNodeEl && (nodeEl === targetNodeEl || nodeEl.contains(targetNodeEl));
			const isExplicitlySelected = nodeEl.classList.contains('is-selected');

			if (!(isExplicitlySelected || isTargetNode)) return;

			// Detect image/media nodes via the live canvas node object properties so
			// off-screen (virtualized) nodes are not silently skipped when their <img>
			// hasn't been rendered into the DOM yet.
			//   • Vault file nodes:   rawNode.file is a TFile instance
			//   • Embedded b64 nodes: rawNode.unknownData.url starts with 'data:image/'
			const rawNodeObj = node as unknown as {
				file?: import('obsidian').TFile;
				unknownData?: { url?: string; file?: string };
			};
			const isVaultImg = rawNodeObj.file instanceof TFile &&
				IMAGE_EXTENSIONS.has((rawNodeObj.file.extension ?? '').toLowerCase());
			const isDataImg = Boolean(rawNodeObj.unknownData?.url?.startsWith('data:image/'));
			// Also fall back to DOM check for any node already rendered (e.g. kambas-embedded-img)
			const hasDomImg = !isVaultImg && !isDataImg &&
				Boolean(nodeEl.querySelector('.kambas-embedded-img') || this.getNativeImageElement(nodeEl));

			if (isVaultImg || isDataImg || hasDomImg) {
				selectedNodeEls.push(nodeEl);
				selectedNodeIds.push(id);
			}
		});

		// If nothing explicitly selected, fall back to target node
		if (selectedNodeIds.length === 0 && targetNodeEl) {
			canvas.nodes.forEach((node, id) => {
				const nodeEl = node.nodeEl;
				if (nodeEl && (nodeEl === targetNodeEl || nodeEl.contains(targetNodeEl))) {
					selectedNodeIds.push(id);
				}
			});
		}

		if (selectedNodeIds.length === 0) return;

		// Determine target state: if ANY selected node is NOT active for key, set all to true; otherwise turn all off
		let targetValue = false;
		for (const id of selectedNodeIds) {
			const canvasNode = canvas.nodes.get(id);
			if (!canvasNode) continue;
			const uData = (canvasNode as unknown as { unknownData?: { kambasFlipH?: boolean; kambasFlipV?: boolean; kambasGrayscale?: boolean } }).unknownData;
			let isCurrentActive = false;
			if (key === 'h') isCurrentActive = Boolean(uData?.kambasFlipH);
			if (key === 'v') isCurrentActive = Boolean(uData?.kambasFlipV);
			if (key === 'g') isCurrentActive = Boolean(uData?.kambasGrayscale);

			if (!isCurrentActive) {
				targetValue = true;
				break;
			}
		}

		// 1. Apply DOM class changes & update in-memory unknownData immediately
		canvas.nodes.forEach((canvasNode, id) => {
			if (!selectedNodeIds.includes(id)) return;

			const rawNode = canvasNode as unknown as { unknownData?: { kambasFlipH?: boolean; kambasFlipV?: boolean; kambasGrayscale?: boolean; kambasPalette?: boolean } };
			if (!rawNode.unknownData) {
				rawNode.unknownData = {};
			}
			const unknownData = rawNode.unknownData;

			if (key === 'h') unknownData.kambasFlipH = targetValue;
			if (key === 'v') unknownData.kambasFlipV = targetValue;
			if (key === 'g') unknownData.kambasGrayscale = targetValue;

			const nodeEl = canvasNode.nodeEl;
			if (nodeEl) {
				nodeEl.classList.toggle('kambas-node-grayscale', Boolean(unknownData.kambasGrayscale));
				// Flip on nodeEl; CSS descendant selector targets img inside it.
				nodeEl.classList.toggle('kambas-img-flip-h', Boolean(unknownData.kambasFlipH));
				nodeEl.classList.toggle('kambas-img-flip-v', Boolean(unknownData.kambasFlipV));

				const img = this.getNativeImageElement(nodeEl) ?? nodeEl.querySelector<HTMLImageElement>('img');
				if (img) {
					img.classList.toggle('kambas-img-grayscale', Boolean(unknownData.kambasGrayscale));
				}
				const paletteEl = nodeEl.querySelector<HTMLElement>('.kambas-palette-bar');
				if (paletteEl) {
					paletteEl.classList.toggle('kambas-palette-grayscale', Boolean(unknownData.kambasGrayscale));
				}
			}
		});

		// 2. Request native canvas save so undo/redo history stack records the transform state change
		if (typeof canvas.requestSave === 'function') {
			try {
				canvas.requestSave();
			} catch {
				void this.persistImageTransform(file, selectedNodeIds, key, targetValue);
			}
		} else {
			void this.persistImageTransform(file, selectedNodeIds, key, targetValue);
		}

		// 3. Rescan to sync any other state (palette, opacity) that may be pending.
		this.scheduleRescan(activeView);
	}

	public async toggleSelectedImagePalette(
		activeView: CanvasItemView,
		targetNodeEl?: Element | null
	): Promise<void> {
		const canvas = activeView.canvas;
		if (!canvas || !canvas.nodes) return;

		const selectedNodeEls: HTMLElement[] = [];
		const selectedNodeIds: string[] = [];

		canvas.nodes.forEach((node, id) => {
			const nodeEl = node.nodeEl;
			if (!nodeEl) return;

			const isTargetNode = targetNodeEl && (nodeEl === targetNodeEl || nodeEl.contains(targetNodeEl));
			const isExplicitlySelected = nodeEl.classList.contains('is-selected');
			const hasImg = nodeEl.querySelector('.kambas-embedded-img') || this.getNativeImageElement(nodeEl);

			if ((isExplicitlySelected || isTargetNode) && hasImg) {
				selectedNodeEls.push(nodeEl);
				selectedNodeIds.push(id);
			}
		});

		if (selectedNodeIds.length === 0 && targetNodeEl) {
			canvas.nodes.forEach((node, id) => {
				const nodeEl = node.nodeEl;
				if (nodeEl && (nodeEl === targetNodeEl || nodeEl.contains(targetNodeEl))) {
					selectedNodeIds.push(id);
				}
			});
		}

		if (selectedNodeIds.length === 0) return;

		// Determine target state for palette
		let targetValue = false;
		for (const id of selectedNodeIds) {
			const canvasNode = canvas.nodes.get(id);
			if (!canvasNode) continue;
			const uData = (canvasNode as unknown as { unknownData?: { kambasPalette?: boolean } }).unknownData;
			if (!uData?.kambasPalette) {
				targetValue = true;
				break;
			}
		}

		canvas.nodes.forEach((canvasNode, id) => {
			if (!selectedNodeIds.includes(id)) return;
			const rawNode = canvasNode as unknown as { unknownData?: { kambasPalette?: boolean } };
			if (!rawNode.unknownData) rawNode.unknownData = {};
			rawNode.unknownData.kambasPalette = targetValue;
		});

		this.scanAndRestoreTransforms(activeView);

		const file = activeView.file;
		if (typeof canvas.requestSave === 'function') {
			try {
				canvas.requestSave();
			} catch {
				if (file) void this.persistImageTransform(file, selectedNodeIds, 'palette', targetValue);
			}
		} else {
			if (file) void this.persistImageTransform(file, selectedNodeIds, 'palette', targetValue);
		}
	}

	public resetSelectedImageSize(
		activeView: CanvasItemView,
		targetNodeEl?: Element | null
	): void {
		const canvas = activeView.canvas;
		if (!canvas || !canvas.nodes) return;

		canvas.nodes.forEach((nodeObj) => {
			const nodeEl = nodeObj.nodeEl;
			if (!nodeEl) return;

			const isTargetNode = targetNodeEl && (nodeEl === targetNodeEl || nodeEl.contains(targetNodeEl));
			const isExplicitlySelected = nodeEl.classList.contains('is-selected');

			if (isExplicitlySelected || isTargetNode) {
				const rawNode = nodeObj as unknown as {
					width: number;
					height: number;
					unknownData?: { width?: number; height?: number; originalWidth?: number; originalHeight?: number };
					resize?: (size: { width: number; height: number }) => void;
				};

				const img = nodeEl.querySelector<HTMLImageElement>('img');
				const origW = rawNode.unknownData?.originalWidth ?? img?.naturalWidth;
				const origH = rawNode.unknownData?.originalHeight ?? img?.naturalHeight;

				if (origW && origH) {
					if (typeof rawNode.resize === 'function') {
						try {
							rawNode.resize({ width: origW, height: origH });
						} catch {
							rawNode.width = origW;
							rawNode.height = origH;
						}
					} else {
						rawNode.width = origW;
						rawNode.height = origH;
					}

					if (rawNode.unknownData) {
						rawNode.unknownData.width = origW;
						rawNode.unknownData.height = origH;
					}
				}
			}
		});

		if (typeof canvas.requestSave === 'function') {
			try {
				canvas.requestSave();
			} catch {
				// Save requested
			}
		}
	}

	public async copySelectedImagesToClipboard(
		activeView: CanvasItemView,
		targetNodeEl?: Element | null
	): Promise<void> {
		const canvas = activeView.canvas;
		if (!canvas || !canvas.nodes) return;

		const targetNodes: Array<{ nodeEl: HTMLElement; rawNode: { file?: TFile | string; unknownData?: { file?: string } } }> = [];

		canvas.nodes.forEach((nodeObj) => {
			const nodeEl = nodeObj.nodeEl;
			if (!nodeEl) return;

			const isTargetNode = targetNodeEl && (nodeEl === targetNodeEl || nodeEl.contains(targetNodeEl));
			const isExplicitlySelected = nodeEl.classList.contains('is-selected');

			if (isExplicitlySelected || isTargetNode) {
				targetNodes.push({ nodeEl, rawNode: nodeObj as { file?: TFile | string; unknownData?: { file?: string } } });
			}
		});

		if (targetNodes.length === 0) return;

		for (const { nodeEl, rawNode } of targetNodes) {
			try {
				let pngBlob: Blob | null = null;

				// Path A: Check if node is a vault TFile or path
				const filePath = (rawNode.file instanceof TFile ? rawNode.file.path : rawNode.file) || rawNode.unknownData?.file;
				if (filePath) {
					const abstractFile = this.app.vault.getAbstractFileByPath(filePath);
					if (abstractFile instanceof TFile) {
						const arrayBuffer = await this.app.vault.readBinary(abstractFile);
						const mime = `image/${abstractFile.extension.toLowerCase() === 'jpg' ? 'jpeg' : abstractFile.extension.toLowerCase()}`;
						const rawBlob = new Blob([arrayBuffer], { type: mime });

						if (mime.includes('png')) {
							pngBlob = rawBlob;
						} else {
							const bitmap = await createImageBitmap(rawBlob);
							const canvasEl = createEl('canvas');
							canvasEl.width = bitmap.width;
							canvasEl.height = bitmap.height;
							const ctx = canvasEl.getContext('2d');
							ctx?.drawImage(bitmap, 0, 0);
							pngBlob = await new Promise<Blob>((resolve) => canvasEl.toBlob((b) => resolve(b || rawBlob), 'image/png'));
						}
					}
				}

				// Path B: Fallback to HTMLImageElement rendering (embedded base64 or rendered <img> element)
				if (!pngBlob) {
					const img = nodeEl.querySelector<HTMLImageElement>('.kambas-embedded-img') ?? this.getNativeImageElement(nodeEl) ?? nodeEl.querySelector<HTMLImageElement>('img');
					if (img) {
						const src = img.src;
						if (src.startsWith('data:')) {
							const parts = src.split(',');
							const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
							const bstr = atob(parts[1]);
							let n = bstr.length;
							const u8arr = new Uint8Array(n);
							while (n--) {
								u8arr[n] = bstr.charCodeAt(n);
							}
							const rawBlob = new Blob([u8arr], { type: mime });
							if (mime.includes('png')) {
								pngBlob = rawBlob;
							} else {
								const bitmap = await createImageBitmap(rawBlob);
								const canvasEl = createEl('canvas');
								canvasEl.width = bitmap.width;
								canvasEl.height = bitmap.height;
								const ctx = canvasEl.getContext('2d');
								ctx?.drawImage(bitmap, 0, 0);
								pngBlob = await new Promise<Blob>((resolve) => canvasEl.toBlob((b) => resolve(b || rawBlob), 'image/png'));
							}
						} else {
							// Draw rendered image onto HTML5 canvas
							const canvasEl = createEl('canvas');
							canvasEl.width = img.naturalWidth || img.width || 400;
							canvasEl.height = img.naturalHeight || img.height || 300;
							const ctx = canvasEl.getContext('2d');
							if (ctx) {
								ctx.drawImage(img, 0, 0);
								pngBlob = await new Promise<Blob | null>((resolve) => canvasEl.toBlob((b) => resolve(b), 'image/png'));
							}
						}
					}
				}

				if (pngBlob) {
					await navigator.clipboard.write([
						new ClipboardItem({ 'image/png': pngBlob }),
					]);
				}
			} catch {
				// Continue to next image if one fails
			}
		}
	}

	public async moveSelectedMediaToFolder(
		activeView: CanvasItemView,
		targetFolder: TFolder,
		targetNodeEl?: Element | null
	): Promise<void> {
		const canvas = activeView.canvas;
		if (!canvas || !canvas.nodes) return;

		const file = activeView.file;
		if (!file) return;

		const selectedNodes: Array<{ id: string; nodeObj: unknown }> = [];

		canvas.nodes.forEach((nodeObj, id) => {
			const nodeEl = (nodeObj as { nodeEl?: HTMLElement }).nodeEl;
			if (!nodeEl) return;

			const isTargetNode = targetNodeEl && (nodeEl === targetNodeEl || nodeEl.contains(targetNodeEl));
			const isExplicitlySelected = nodeEl.classList.contains('is-selected');

			if (isExplicitlySelected || isTargetNode) {
				selectedNodes.push({ id, nodeObj });
			}
		});

		if (selectedNodes.length === 0) return;

		const content = await this.app.vault.read(file);
		let canvasFileData: CanvasFileData;
		try {
			canvasFileData = JSON.parse(content) as CanvasFileData;
		} catch {
			return;
		}
		if (!canvasFileData.nodes) return;

		let modified = false;

		for (const { id, nodeObj } of selectedNodes) {
			const rawNodeObj = nodeObj as {
				file?: TFile | string;
				url?: string;
				nodeEl?: HTMLElement;
				unknownData?: { type?: string; url?: string; file?: string };
			};

			const canvasNodeData = canvasFileData.nodes.find((n) => n.id === id);
			if (!canvasNodeData) continue;

			// Case 1: Native vault media file node (type === 'file')
			if (canvasNodeData.type === 'file' && canvasNodeData.file) {
				const abstractFile = this.app.vault.getAbstractFileByPath(canvasNodeData.file);
				if (abstractFile instanceof TFile) {
					const newPath = targetFolder.path === '/' ? abstractFile.name : `${targetFolder.path}/${abstractFile.name}`;
					if (abstractFile.path !== newPath) {
						await this.app.fileManager.renameFile(abstractFile, newPath);
						canvasNodeData.file = newPath;
						if (rawNodeObj.unknownData) rawNodeObj.unknownData.file = newPath;
						modified = true;
					}
				}
			}
			// Case 2: Embedded base64 image link node (type === 'link' with data:image/...)
			else if (canvasNodeData.type === 'link' && canvasNodeData.url?.startsWith('data:image/')) {
				const dataUrl = canvasNodeData.url;
				const parts = dataUrl.split(',');
				const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
				const ext = mime.split('/')[1] || 'png';
				const bstr = atob(parts[1]);
				let n = bstr.length;
				const u8arr = new Uint8Array(n);
				while (n--) {
					u8arr[n] = bstr.charCodeAt(n);
				}
				const filename = `embedded_image_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
				const savedPath = await saveFileToVault(this.app, targetFolder.path, filename, u8arr.buffer);

				const savedFile = this.app.vault.getAbstractFileByPath(savedPath);
				if (savedFile instanceof TFile && typeof canvas.createFileNode === 'function') {
					// 1. Preserve position, size, transform & tag data
					const pos = { x: canvasNodeData.x, y: canvasNodeData.y };
					const size = { width: canvasNodeData.width, height: canvasNodeData.height };
					const flipH = canvasNodeData.kambasFlipH;
					const flipV = canvasNodeData.kambasFlipV;
					const grayscale = canvasNodeData.kambasGrayscale;
					const opacity = canvasNodeData.kambasOpacity;
					const tags = canvasNodeData.kambasTags;

					// 2. Remove old link node from canvas
					const rawCanvas = canvas as unknown as { removeNode?: (node: unknown) => void };
					if (typeof rawCanvas.removeNode === 'function') {
						try {
							rawCanvas.removeNode(nodeObj);
						} catch {
							// Fallback
						}
					}

					// 3. Create native Obsidian file node
					canvas.createFileNode({
						file: savedFile,
						pos,
						size,
						save: true,
					});

					// 4. Find newly created file node and apply preserved transform & tag properties
					const newCanvasNode = Array.from(canvas.nodes?.values() || []).find((n) => {
						const rawN = n as unknown as { file?: TFile | string; unknownData?: { file?: string } };
						return rawN.file === savedFile || rawN.file === savedPath || rawN.unknownData?.file === savedPath;
					});

					if (newCanvasNode) {
						const rawN = newCanvasNode as unknown as { unknownData?: { kambasFlipH?: boolean; kambasFlipV?: boolean; kambasGrayscale?: boolean; kambasOpacity?: number; kambasTags?: string[] } };
						if (!rawN.unknownData) rawN.unknownData = {};
						if (flipH) rawN.unknownData.kambasFlipH = flipH;
						if (flipV) rawN.unknownData.kambasFlipV = flipV;
						if (grayscale) rawN.unknownData.kambasGrayscale = grayscale;
						if (opacity !== undefined) rawN.unknownData.kambasOpacity = opacity;
						if (Array.isArray(tags) && tags.length > 0) rawN.unknownData.kambasTags = [...tags];
					}

					modified = true;
				}
			}
		}

		if (modified) {
			if (typeof canvas.requestSave === 'function') {
				try {
					canvas.requestSave();
				} catch {
					// Save requested
				}
			}

			window.setTimeout(() => {
				this.scanAndRestoreTransforms(activeView);
			}, 100);
		}
	}

	public async copySelectedMediaToFolder(
		activeView: CanvasItemView,
		targetFolder: TFolder,
		targetNodeEl?: Element | null
	): Promise<void> {
		const canvas = activeView.canvas;
		if (!canvas || !canvas.nodes) return;

		const file = activeView.file;
		if (!file) return;

		const selectedNodes: Array<{ id: string; nodeObj: unknown }> = [];

		canvas.nodes.forEach((nodeObj, id) => {
			const nodeEl = (nodeObj as { nodeEl?: HTMLElement }).nodeEl;
			if (!nodeEl) return;

			const isTargetNode = targetNodeEl && (nodeEl === targetNodeEl || nodeEl.contains(targetNodeEl));
			const isExplicitlySelected = nodeEl.classList.contains('is-selected');

			if (isExplicitlySelected || isTargetNode) {
				selectedNodes.push({ id, nodeObj });
			}
		});

		if (selectedNodes.length === 0) return;

		const content = await this.app.vault.read(file);
		let canvasFileData: CanvasFileData;
		try {
			canvasFileData = JSON.parse(content) as CanvasFileData;
		} catch {
			return;
		}
		if (!canvasFileData.nodes) return;

		for (const { id } of selectedNodes) {
			const canvasNodeData = canvasFileData.nodes.find((n) => n.id === id);
			if (!canvasNodeData) continue;

			// Case 1: Native vault media file node (type === 'file') -> copy vault file to target directory with -copy-NN formatting
			if (canvasNodeData.type === 'file' && canvasNodeData.file) {
				const abstractFile = this.app.vault.getAbstractFileByPath(canvasNodeData.file);
				if (abstractFile instanceof TFile) {
					const extIdx = abstractFile.name.lastIndexOf('.');
					const base = extIdx !== -1 ? abstractFile.name.substring(0, extIdx) : abstractFile.name;
					const ext = extIdx !== -1 ? abstractFile.name.substring(extIdx) : '';

					let counter = 1;
					let targetName = `${base}-copy-${String(counter).padStart(2, '0')}${ext}`;
					let targetPath = targetFolder.path === '/' ? targetName : `${targetFolder.path}/${targetName}`;

					while (this.app.vault.getAbstractFileByPath(targetPath)) {
						counter++;
						targetName = `${base}-copy-${String(counter).padStart(2, '0')}${ext}`;
						targetPath = targetFolder.path === '/' ? targetName : `${targetFolder.path}/${targetName}`;
					}

					await this.app.vault.copy(abstractFile, targetPath);
				}
			}
			// Case 2: Embedded base64 image link node (type === 'link' with data:image/...) -> copy/export base64 to target directory
			else if (canvasNodeData.type === 'link' && canvasNodeData.url?.startsWith('data:image/')) {
				const dataUrl = canvasNodeData.url;
				const parts = dataUrl.split(',');
				const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
				const ext = mime.split('/')[1] || 'png';
				const bstr = atob(parts[1]);
				let n = bstr.length;
				const u8arr = new Uint8Array(n);
				while (n--) {
					u8arr[n] = bstr.charCodeAt(n);
				}

				const base = 'embedded_image';
				let counter = 1;
				let targetName = `${base}-copy-${String(counter).padStart(2, '0')}.${ext}`;
				let targetPath = targetFolder.path === '/' ? targetName : `${targetFolder.path}/${targetName}`;

				while (this.app.vault.getAbstractFileByPath(targetPath)) {
					counter++;
					targetName = `${base}-copy-${String(counter).padStart(2, '0')}.${ext}`;
					targetPath = targetFolder.path === '/' ? targetName : `${targetFolder.path}/${targetName}`;
				}

				await this.app.vault.createBinary(targetPath, u8arr.buffer);
			}
		}
	}

	public async convertSelectedVaultImagesToEmbed(
		activeView: CanvasItemView,
		targetNodeEl?: Element | null
	): Promise<void> {
		const canvas = activeView.canvas;
		if (!canvas || !canvas.nodes) return;

		const file = activeView.file;
		if (!file) return;

		// Collect all selected native file nodes that represent images
		const targetNodes: Array<{ id: string; nodeObj: unknown; tfile: TFile; filename: string }> = [];

		canvas.nodes.forEach((nodeObj, id) => {
			const nodeEl = (nodeObj as { nodeEl?: HTMLElement }).nodeEl;
			if (!nodeEl) return;

			const isTargetNode = targetNodeEl && (nodeEl === targetNodeEl || nodeEl.contains(targetNodeEl));
			const isExplicitlySelected = nodeEl.classList.contains('is-selected');

			if (isExplicitlySelected || isTargetNode) {
				const rawNodeObj = nodeObj as { file?: TFile | string; unknownData?: { file?: string } };
				const filePath = (rawNodeObj.file instanceof TFile ? rawNodeObj.file.path : rawNodeObj.file) || rawNodeObj.unknownData?.file;
				if (filePath) {
					const abstractFile = this.app.vault.getAbstractFileByPath(filePath);
					if (abstractFile instanceof TFile && IMAGE_EXTENSIONS.has(abstractFile.extension.toLowerCase())) {
						targetNodes.push({ id, nodeObj, tfile: abstractFile, filename: abstractFile.name });
					}
				}
			}
		});

		if (targetNodes.length === 0) return;

		let currentAction: VaultFileAction | null = null;
		let applyToAllRemaining = false;

		const filesToDelete: TFile[] = [];

		const content = await this.app.vault.read(file);
		let canvasFileData: CanvasFileData;
		try {
			canvasFileData = JSON.parse(content) as CanvasFileData;
		} catch {
			return;
		}
		if (!canvasFileData.nodes) return;

		let modified = false;

		for (let i = 0; i < targetNodes.length; i++) {
			const { id, nodeObj, tfile, filename } = targetNodes[i];
			const remainingCount = targetNodes.length - i;

			if (!applyToAllRemaining || !currentAction) {
				const res = await new Promise<ConvertEmbedChoiceResult>((resolve) => {
					const modal = new ConvertToEmbedModal(
						this.app,
						filename,
						remainingCount,
						(result) => resolve(result)
					);
					modal.open();
				});
				currentAction = res.action;
				applyToAllRemaining = res.applyToAll;
			}

			if (currentAction === 'cancel') {
				break;
			}

			const canvasNodeData = canvasFileData.nodes.find((n) => n.id === id);
			if (!canvasNodeData) continue;

			// Read vault image file and encode to base64 data URL
			const arrayBuffer = await this.app.vault.readBinary(tfile);
			const mimeType = `image/${tfile.extension.toLowerCase() === 'jpg' ? 'jpeg' : tfile.extension.toLowerCase()}`;
			const dataUrl = arrayBufferToBase64DataUrl(arrayBuffer, mimeType);

			// 1. Preserve position, size, transform & tag data
			const pos = { x: canvasNodeData.x, y: canvasNodeData.y };
			const size = { width: canvasNodeData.width, height: canvasNodeData.height };
			const flipH = canvasNodeData.kambasFlipH;
			const flipV = canvasNodeData.kambasFlipV;
			const grayscale = canvasNodeData.kambasGrayscale;
			const opacity = canvasNodeData.kambasOpacity;
			const tags = canvasNodeData.kambasTags;

			// 2. Remove old native file node from canvas
			const rawCanvas = canvas as unknown as { removeNode?: (node: unknown) => void };
			if (typeof rawCanvas.removeNode === 'function') {
				try {
					rawCanvas.removeNode(nodeObj);
				} catch {
					// Fallback
				}
			}

			// 3. Create link node storing embedded base64 data URL
			if (typeof canvas.createLinkNode === 'function') {
				canvas.createLinkNode({
					url: dataUrl,
					pos,
					size,
					save: true,
				});

				// 4. Find newly created link node and apply preserved transform & tag properties
				const newCanvasNode = Array.from(canvas.nodes?.values() || []).find((n) => {
					const rawN = n as unknown as { url?: string; unknownData?: { url?: string } };
					return rawN.url === dataUrl || rawN.unknownData?.url === dataUrl;
				});

				if (newCanvasNode) {
					const rawN = newCanvasNode as unknown as { unknownData?: { kambasFlipH?: boolean; kambasFlipV?: boolean; kambasGrayscale?: boolean; kambasOpacity?: number; kambasTags?: string[] } };
					if (!rawN.unknownData) rawN.unknownData = {};
					if (flipH) rawN.unknownData.kambasFlipH = flipH;
					if (flipV) rawN.unknownData.kambasFlipV = flipV;
					if (grayscale) rawN.unknownData.kambasGrayscale = grayscale;
					if (opacity !== undefined) rawN.unknownData.kambasOpacity = opacity;
					if (Array.isArray(tags) && tags.length > 0) rawN.unknownData.kambasTags = [...tags];
				}

				modified = true;
			}

			if (currentAction === 'delete') {
				filesToDelete.push(tfile);
			}
		}

		if (modified) {
			if (typeof canvas.requestSave === 'function') {
				try {
					canvas.requestSave();
				} catch {
					// Save requested
				}
			}

			window.setTimeout(() => {
				this.scanAndRestoreTransforms(activeView);
			}, 100);
		}

		// Delete original files if requested
		for (const fileToDelete of filesToDelete) {
			try {
				await this.app.fileManager.trashFile(fileToDelete);
			} catch {
				// Continue if trash fails
			}
		}
	}

	private async persistImageTransform(file: TFile, selectedNodeIds: string[], key: string, targetValue?: boolean): Promise<void> {
		const content = await this.app.vault.read(file);
		let data: CanvasFileData;
		try {
			data = JSON.parse(content) as CanvasFileData;
		} catch {
			return;
		}

		if (!data.nodes) return;

		let modified = false;

		data.nodes.forEach((node) => {
			if (node.id && selectedNodeIds.includes(node.id)) {
				if (key === 'h') {
					node.kambasFlipH = targetValue !== undefined ? targetValue : !node.kambasFlipH;
					modified = true;
				} else if (key === 'v') {
					node.kambasFlipV = targetValue !== undefined ? targetValue : !node.kambasFlipV;
					modified = true;
				} else if (key === 'g') {
					node.kambasGrayscale = targetValue !== undefined ? targetValue : !node.kambasGrayscale;
					modified = true;
				} else if (key === 'p' || key === 'palette') {
					node.kambasPalette = targetValue !== undefined ? targetValue : !node.kambasPalette;
					modified = true;
				}
			}
		});

		if (modified) {
			this.scheduleVaultModify(file, data);
		}
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Tag methods
	// ──────────────────────────────────────────────────────────────────────────

	/**
	 * Renders (or updates) tag badge pills in the bottom-left of a node element.
	 */
	public renderTagBadges(nodeEl: HTMLElement, tags: string[]): void {
		let bar = nodeEl.querySelector<HTMLElement>('.kambas-tag-bar');

		if (!tags || tags.length === 0) {
			bar?.remove();
			return;
		}

		if (!bar) {
			bar = nodeEl.createDiv({ cls: 'kambas-tag-bar' });
		}

		// Only re-render if tags changed
		const existing = bar.dataset.tags;
		const tagKey = tags.join(',');
		if (existing === tagKey) return;
		bar.dataset.tags = tagKey;
		bar.empty();

		for (const tag of tags) {
			bar.createSpan({ cls: 'kambas-tag-pill', text: `#${tag}` });
		}
	}

	/**
	 * Collects all unique tags used in the current canvas in-memory nodes.
	 */
	public collectLiveCanvasTags(activeView: CanvasItemView): string[] {
		const canvas = activeView.canvas;
		if (!canvas?.nodes) return [];
		const tagSet = new Set<string>();
		canvas.nodes.forEach((node) => {
			const uData = (node as unknown as { unknownData?: { kambasTags?: string[] } }).unknownData;
			for (const tag of uData?.kambasTags ?? []) {
				if (tag.trim()) tagSet.add(tag.trim());
			}
		});
		return Array.from(tagSet).sort();
	}

	/**
	 * Opens the TagModal for the selected node(s) and applies resulting tags.
	 */
	public openTagModal(
		activeView: CanvasItemView,
		targetNodeEl?: Element | null
	): void {
		const canvas = activeView.canvas;
		if (!canvas?.nodes) return;

		// Collect initial tags:
		// If right-clicked on a specific target node, use that target node's tags.
		// Otherwise (bulk multi-select context menu / toolbar), collect the union of tags across ALL selected nodes.
		const initialTagSet = new Set<string>();
		canvas.nodes.forEach((node) => {
			const nodeEl = node.nodeEl;
			if (!nodeEl) return;
			const isTarget = Boolean(targetNodeEl && (nodeEl === targetNodeEl || nodeEl.contains(targetNodeEl)));
			const isSel = nodeEl.classList.contains('is-selected');
			
			if (targetNodeEl ? isTarget : isSel) {
				const uData = (node as unknown as { unknownData?: { kambasTags?: string[] } }).unknownData;
				for (const tag of uData?.kambasTags ?? []) {
					if (tag.trim()) initialTagSet.add(tag);
				}
			}
		});
		const initialTags = Array.from(initialTagSet);

		const suggestions = this.collectLiveCanvasTags(activeView);

		new TagModal(this.app, initialTags, suggestions, (tags) => {
			void this.setNodeTags(activeView, tags, initialTags, targetNodeEl);
		}).open();
	}

	/**
	 * Writes tags to all selected nodes in-memory and persists via canvas save.
	 */
	public async setNodeTags(
		activeView: CanvasItemView,
		tags: string[],
		initialTags: string[] = [],
		targetNodeEl?: Element | null
	): Promise<void> {
		const canvas = activeView.canvas;
		if (!canvas?.nodes) return;

		const selectedNodeIds: string[] = [];

		// Collect initial tags that were passed into the modal (to calculate added vs removed tags)
		const addedTags = tags.filter((t) => !initialTags.includes(t));
		const removedTags = initialTags.filter((t) => !tags.includes(t));

		canvas.nodes.forEach((node, id) => {
			const nodeEl = node.nodeEl;
			if (!nodeEl) return;
			const isSel = nodeEl.classList.contains('is-selected') || (targetNodeEl && (nodeEl === targetNodeEl || nodeEl.contains(targetNodeEl)));
			if (isSel) {
				selectedNodeIds.push(id);
				const rawNode = node as unknown as { unknownData?: { kambasTags?: string[] } };
				if (!rawNode.unknownData) rawNode.unknownData = {};
				const existingTags = rawNode.unknownData.kambasTags ?? [];
				// Keep existing tags not explicitly removed, plus any newly added tags
				let updated = existingTags.filter((t) => !removedTags.includes(t));
				for (const tag of addedTags) {
					if (!updated.includes(tag)) updated.push(tag);
				}
				rawNode.unknownData.kambasTags = updated.length > 0 ? updated : undefined;

				// Immediately render badges
				if (nodeEl.instanceOf(HTMLElement)) this.renderTagBadges(nodeEl, updated);
			}
		});

		if (selectedNodeIds.length === 0) return;

		// Always write directly to the JSON file — requestSave() alone strips custom unknownData fields.
		const file = activeView.file;
		if (file) {
			await this.persistTagsDiff(file, selectedNodeIds, addedTags, removedTags);
			// Re-stamp badges from saved state to confirm persistence
			window.setTimeout(() => this.scanAndRestoreTransforms(activeView), 100);
		}

		// Also nudge the canvas so it refreshes internal rendering
		if (typeof canvas.requestSave === 'function') {
			try { canvas.requestSave(); } catch { /* ignore */ }
		}

		// Refresh filter panel if open
		if (this.tagFilterPanelEl?.isConnected) {
			window.setTimeout(() => this.refreshTagFilterPanel(activeView), 150);
		}
	}

	private async persistTagsDiff(
		file: TFile,
		selectedNodeIds: string[],
		addedTags: string[],
		removedTags: string[]
	): Promise<void> {
		const content = await this.app.vault.read(file);
		let data: CanvasFileData;
		try {
			data = JSON.parse(content) as CanvasFileData;
		} catch { return; }
		if (!data.nodes) return;
		let modified = false;
		data.nodes.forEach((node) => {
			if (node.id && selectedNodeIds.includes(node.id)) {
				const nd = node as unknown as { kambasTags?: string[] };
				const existing = nd.kambasTags ?? [];
				let updated = existing.filter((t) => !removedTags.includes(t));
				for (const tag of addedTags) {
					if (!updated.includes(tag)) updated.push(tag);
				}
				if (updated.length > 0) {
					nd.kambasTags = updated;
				} else {
					delete nd.kambasTags;
				}
				modified = true;
			}
		});
		if (modified) this.scheduleVaultModify(file, data);
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Tag filter panel
	// ──────────────────────────────────────────────────────────────────────────

	/**
	 * Opens (or focuses) the in-canvas tag filter sidebar panel.
	 */
	public openTagFilterPanel(activeView: CanvasItemView): void {
		const container = (activeView as unknown as { containerEl?: HTMLElement }).containerEl
			?? (activeView.canvas as unknown as { wrapperEl?: HTMLElement })?.wrapperEl;
		if (!container) return;

		// Toggle: close if already open
		if (this.tagFilterPanelEl?.isConnected) {
			this.closeTagFilterPanel(activeView);
			return;
		}

		const t = getText();
		const panel = container.createDiv({ cls: 'kambas-tag-panel' });
		this.tagFilterPanelEl = panel;

		// Stop mouse & scroll events from reaching Obsidian Canvas (which zooms/pans canvas or triggers rescans)
		panel.addEventListener('mousedown', (e) => e.stopPropagation());
		panel.addEventListener('pointerdown', (e) => e.stopPropagation());
		panel.addEventListener('click', (e) => e.stopPropagation());
		panel.addEventListener('wheel', (e) => e.stopPropagation());
		panel.addEventListener('scroll', (e) => e.stopPropagation());

		// Set dim-opacity CSS var on the container
		container.style.setProperty('--kambas-dim-opacity', String(this.dimOpacity));

		// ── Header (drag handle & tabs) ─────────────────────────────────────────────
		const header = panel.createDiv({ cls: 'kambas-tag-panel-header' });
		const tabsWrap = header.createDiv({ cls: 'kambas-tag-panel-tabs' });

		const hasTagActive = this.activeTagFilters.size > 0 || this.activeTagExcludes.size > 0;
		const hasColorActive = this.activeColorFilters.size > 0 || this.activeColorExcludes.size > 0;

		const tagTab = tabsWrap.createDiv({
			cls: 'kambas-tag-panel-tab' + (this.activeFilterTab === 'tag' ? ' is-active' : '') + (hasTagActive ? ' has-filter' : ''),
		});
		tagTab.createSpan({ text: t.tagModalTitle });
		if (hasTagActive) {
			tagTab.createSpan({ cls: 'kambas-tab-filter-dot', attr: { 'aria-label': 'Active tag filter' } });
		}

		const colorTab = tabsWrap.createDiv({
			cls: 'kambas-tag-panel-tab' + (this.activeFilterTab === 'color' ? ' is-active' : '') + (hasColorActive ? ' has-filter' : ''),
		});
		colorTab.createSpan({ text: t.colorFilterTab ?? 'Color' });
		if (hasColorActive) {
			colorTab.createSpan({ cls: 'kambas-tab-filter-dot', attr: { 'aria-label': 'Active color filter' } });
		}

		tagTab.addEventListener('click', () => {
			if (this.activeFilterTab === 'tag') return;
			this.activeFilterTab = 'tag';
			tagTab.addClass('is-active');
			colorTab.removeClass('is-active');
			this.refreshTagFilterPanel(activeView);
		});

		colorTab.addEventListener('click', () => {
			if (this.activeFilterTab === 'color') return;
			this.activeFilterTab = 'color';
			colorTab.addClass('is-active');
			tagTab.removeClass('is-active');
			this.refreshTagFilterPanel(activeView);
		});

		const headerActions = header.createDiv({ cls: 'kambas-tag-panel-actions' });
		const closeBtn = headerActions.createDiv({ cls: 'kambas-tag-panel-close' });
		setIcon(closeBtn, 'x');
		closeBtn.addEventListener('click', () => this.closeTagFilterPanel(activeView));

		this.makePanelDraggable(panel, header, container);

		// ── Filter panel body ───────────────────────────────────────────
		const body = panel.createDiv({ cls: 'kambas-tag-panel-body' });
		(panel as unknown as { _body: HTMLElement })._body = body;
		this.renderFilterPanelBody(body, activeView);

		// ── Opacity slider footer ────────────────────────────────────────────
		const footer = panel.createDiv({ cls: 'kambas-tag-panel-footer' });
		footer.createSpan({ cls: 'kambas-tag-slider-label-text', text: 'Dim opacity' });

		// Slider + reset icon on one row
		const sliderRow = footer.createDiv({ cls: 'kambas-tag-slider-row' });

		const sliderComp = new SliderComponent(sliderRow);
		sliderComp
			.setLimits(0, 90, 1)
			.setValue(Math.round(this.dimOpacity * 100))
			.setDynamicTooltip()
			.onChange((value: number) => {
				this.dimOpacity = value / 100;
				container.style.setProperty('--kambas-dim-opacity', String(this.dimOpacity));
				this.savePanelState(panel);
			});
		sliderComp.sliderEl.addClass('kambas-tag-slider');

		const resetBtn = sliderRow.createEl('button', { cls: 'kambas-tag-slider-reset' });
		setIcon(resetBtn, 'rotate-ccw');
		resetBtn.setAttribute('aria-label', 'Reset opacity to default');
		resetBtn.addEventListener('click', () => {
			this.dimOpacity = 0.12;
			sliderComp.setValue(12);
			container.setCssProps({ '--kambas-dim-opacity': '0.12' });
			this.savePanelState(panel);
		});

		this.tagToolbarBtn?.classList.add('is-active');

		// ── Restore saved position / size ────────────────────────────────────
		this.restorePanelState(panel, container);

		// ── Persist position on drag end & keep panel clamped inside container on window/container resize ──
		const origOnUp = (): void => {
			this.clampPanelPosition(panel, container);
			this.savePanelState(panel);
		};
		document.addEventListener('mouseup', origOnUp, { once: false });

		// Observe container resize to automatically pull panel back inside if viewport shrinks
		const containerRo = new ResizeObserver(() => {
			this.clampPanelPosition(panel, container);
		});
		containerRo.observe(container);

		// Use ResizeObserver to persist size changes
		const ro = new ResizeObserver(() => {
			this.clampPanelPosition(panel, container);
			this.savePanelState(panel);
		});
		ro.observe(panel);

		// Clean up when panel is removed
		const panelObserver = new MutationObserver(() => {
			if (!panel.isConnected) {
				ro.disconnect();
				containerRo.disconnect();
				panelObserver.disconnect();
			}
		});
		panelObserver.observe(document.body, { childList: true, subtree: true });
	}

	private clampPanelPosition(panel: HTMLElement, container: HTMLElement): void {
		if (!panel.isConnected || !container.isConnected) return;
		const cRect = container.getBoundingClientRect();
		const pRect = panel.getBoundingClientRect();
		if (cRect.width === 0 || cRect.height === 0) return;

		let currentLeft = panel.offsetLeft;
		let currentTop = panel.offsetTop;

		const maxLeft = Math.max(0, cRect.width - (panel.offsetWidth || pRect.width));
		const maxTop = Math.max(0, cRect.height - (panel.offsetHeight || pRect.height));

		const clampedLeft = Math.max(0, Math.min(currentLeft, maxLeft));
		const clampedTop = Math.max(0, Math.min(currentTop, maxTop));

		if (currentLeft !== clampedLeft || currentTop !== clampedTop) {
			panel.style.left = `${clampedLeft}px`;
			panel.style.top = `${clampedTop}px`;
			this.savePanelState(panel);
		}
	}

	private savePanelState(panel: HTMLElement): void {
		if (!panel.isConnected) return;
		try {
			const state = {
				top: panel.style.top,
				left: panel.style.left,
				width: panel.style.width || panel.offsetWidth + 'px',
				height: panel.style.height || panel.offsetHeight + 'px',
				dimOpacity: this.dimOpacity,
			};
			this.app.saveLocalStorage('kambas-tag-panel-state', JSON.stringify(state));
		} catch { /* ignore */ }
	}

	private restorePanelState(panel: HTMLElement, container: HTMLElement): void {
		try {
			const raw = this.app.loadLocalStorage('kambas-tag-panel-state') as string | null;
			if (raw) {
				const state = JSON.parse(raw) as { top?: string; left?: string; width?: string; height?: string; dimOpacity?: number };
				if (state.top)    panel.style.top    = state.top;
				if (state.left)   panel.style.left   = state.left;
				if (state.width)  panel.style.width  = state.width;
				if (state.height) panel.style.height = state.height;
				if (typeof state.dimOpacity === 'number') this.dimOpacity = state.dimOpacity;
			}
			// Clamp immediately after restoring position
			this.clampPanelPosition(panel, container);
		} catch { /* ignore */ }
	}

	private makePanelDraggable(panel: HTMLElement, header: HTMLElement, container: HTMLElement): void {
		let isDragging = false;
		// positionAnchored: true once we've converted right/bottom → left/top on first move
		let positionAnchored = false;
		let dragOffsetX = 0;
		let dragOffsetY = 0;
		let mouseDownPRect: DOMRect | null = null;

		const onMove = (e: MouseEvent): void => {
			if (!isDragging) return;
			const cRect = container.getBoundingClientRect();
			// On the very first mousemove after mousedown, convert any right/bottom
			// positioning to explicit left/top so the panel never jumps on a bare click.
			if (!positionAnchored && mouseDownPRect) {
				positionAnchored = true;
				panel.setCssProps({
					right:  'auto',
					bottom: 'auto',
					left:   `${mouseDownPRect.left - cRect.left}px`,
					top:    `${mouseDownPRect.top  - cRect.top}px`,
				});
			}
			const panW = panel.offsetWidth;
			const panH = panel.offsetHeight;
			let newLeft = e.clientX - dragOffsetX - cRect.left;
			let newTop  = e.clientY - dragOffsetY - cRect.top;
			// Clamp so panel stays fully inside the container
			newLeft = Math.max(0, Math.min(newLeft, cRect.width  - panW));
			newTop  = Math.max(0, Math.min(newTop,  cRect.height - panH));
			panel.style.left = `${newLeft}px`;
			panel.style.top  = `${newTop}px`;
		};
		const onUp = (): void => {
			isDragging = false;
			mouseDownPRect = null;
			document.removeEventListener('mousemove', onMove);
			document.removeEventListener('mouseup', onUp);
		};

		header.addEventListener('mousedown', (e: MouseEvent) => {
			if ((e.target as HTMLElement).closest('.kambas-tag-panel-close') || (e.target as HTMLElement).closest('.kambas-tag-panel-tabs')) return;
			isDragging = true;
			positionAnchored = false; // reset — we haven't moved yet
			// Capture panel rect NOW (no DOM writes!) for use on first mousemove
			mouseDownPRect = panel.getBoundingClientRect();
			dragOffsetX = e.clientX - mouseDownPRect.left;
			dragOffsetY = e.clientY - mouseDownPRect.top;
			document.addEventListener('mousemove', onMove);
			document.addEventListener('mouseup', onUp);
			e.preventDefault();
		});
	}

	private closeTagFilterPanel(_activeView: CanvasItemView): void {
		// Do NOT clear filters — they should persist while the panel is closed.
		// The user can clear them explicitly via the × button inside the search bar.
		this.colorHighlightCleanup?.();
		this.colorHighlightCleanup = null;
		this.tagFilterPanelEl?.remove();
		this.tagFilterPanelEl = null;
		// Keep toolbar button lit when filters are still active
		this.updateToolbarButtonState();
	}

	private refreshTagFilterPanel(activeView: CanvasItemView): void {
		if (!this.tagFilterPanelEl?.isConnected) return;
		const activeEl = document.activeElement;
		let focusedQuery: string | null = null;
		let cursorStart: number | null = null;
		let cursorEnd: number | null = null;

		if (activeEl?.instanceOf?.(HTMLInputElement) && activeEl.classList.contains('kambas-tag-search')) {
			focusedQuery = activeEl.value;
			cursorStart = activeEl.selectionStart;
			cursorEnd = activeEl.selectionEnd;
		}

		const hasTagActive = this.activeTagFilters.size > 0 || this.activeTagExcludes.size > 0;
		const hasColorActive = this.activeColorFilters.size > 0 || this.activeColorExcludes.size > 0;

		const tagTabEl = this.tagFilterPanelEl.querySelector('.kambas-tag-panel-tabs .kambas-tag-panel-tab:nth-child(1)');
		if (tagTabEl) {
			tagTabEl.classList.toggle('has-filter', hasTagActive);
			let dot = tagTabEl.querySelector('.kambas-tab-filter-dot');
			if (hasTagActive && !dot) {
				tagTabEl.createSpan({ cls: 'kambas-tab-filter-dot', attr: { 'aria-label': 'Active tag filter' } });
			} else if (!hasTagActive && dot) {
				dot.remove();
			}
		}

		const colorTabEl = this.tagFilterPanelEl.querySelector('.kambas-tag-panel-tabs .kambas-tag-panel-tab:nth-child(2)');
		if (colorTabEl) {
			colorTabEl.classList.toggle('has-filter', hasColorActive);
			let dot = colorTabEl.querySelector('.kambas-tab-filter-dot');
			if (hasColorActive && !dot) {
				colorTabEl.createSpan({ cls: 'kambas-tab-filter-dot', attr: { 'aria-label': 'Active color filter' } });
			} else if (!hasColorActive && dot) {
				dot.remove();
			}
		}

		const body = (this.tagFilterPanelEl as unknown as { _body?: HTMLElement })._body;
		const listElBefore = body?.querySelector<HTMLElement>('.kambas-tag-panel-list');
		const savedScrollTop = listElBefore ? listElBefore.scrollTop : 0;

		if (body) this.renderFilterPanelBody(body, activeView);

		const listElAfter = body?.querySelector<HTMLElement>('.kambas-tag-panel-list');
		if (listElAfter) listElAfter.scrollTop = savedScrollTop;

		if (focusedQuery !== null && this.tagFilterPanelEl?.isConnected) {
			const newInput = this.tagFilterPanelEl.querySelector<HTMLInputElement>('input.kambas-tag-search');
			if (newInput) {
				newInput.value = focusedQuery;
				newInput.focus();
				if (cursorStart !== null && cursorEnd !== null) {
					try { newInput.setSelectionRange(cursorStart, cursorEnd); } catch { /* ignore */ }
				}
				// Trigger input event so list reflects the search query
				newInput.dispatchEvent(new Event('input', { bubbles: true }));
				if (listElAfter) listElAfter.scrollTop = savedScrollTop;
			}
		}
	}

	private renderFilterPanelBody(body: HTMLElement, activeView: CanvasItemView): void {
		if (this.activeFilterTab === 'color') {
			this.renderColorFilterList(body, activeView);
		} else {
			this.renderTagFilterList(body, activeView);
		}
	}

	private async extractAllNodeColors(activeView: CanvasItemView): Promise<void> {
		const canvas = activeView.canvas;
		if (!canvas?.nodes) return;

		const includeAccents = this.plugin.settings.colorIncludeAccents ?? false;

		for (const node of canvas.nodes.values()) {
			const rawNode = node as unknown as { id: string };
			const nodeEl = node.nodeEl;
			if (!nodeEl || !rawNode.id) continue;
			const img = this.getNativeImageElement(nodeEl) ?? nodeEl.querySelector<HTMLImageElement>('img');
			if (!img?.src) continue;
			if (this.nodeColorCache.has(rawNode.id)) continue;

			try {
				const colorName = await getNodeDominantColorName(img.src, includeAccents);
				this.nodeColorCache.set(rawNode.id, colorName);
			} catch {
				this.nodeColorCache.set(rawNode.id, null);
			}
		}

		if (this.tagFilterPanelEl?.isConnected && this.activeFilterTab === 'color') {
			this.applyTagFilters(activeView, true);
			this.refreshTagFilterPanel(activeView);
		}
	}

	private renderColorFilterList(body: HTMLElement, activeView: CanvasItemView): void {
		body.empty();
		const t = getText();
		const canvas = activeView.canvas;
		if (!canvas?.nodes) return;

		// Hex map for color swatch dots
		const colorHexMap: Record<string, string> = {
			Black: '#212121',
			Gray: '#808080',
			White: '#f5f5f5',
			Red: '#e53935',
			Orange: '#fb8c00',
			Yellow: '#fdd835',
			Green: '#43a047',
			Teal: '#00897b',
			Cyan: '#00acc1',
			Blue: '#1e88e5',
			Indigo: '#3949ab',
			Purple: '#8e24aa',
			Pink: '#d81b60',
		};

		// ── 1. Sticky controls wrap (Extract button + Search bar) ────────────────
		const controlsWrap = body.createDiv({ cls: 'kambas-color-controls' });

		const extractMode = this.plugin.settings.colorExtractMode ?? 'auto';
		if (extractMode !== 'disabled') {
			const btnWrap = controlsWrap.createDiv({ cls: 'kambas-tag-search-wrap' });
			btnWrap.setCssProps({ justifyContent: 'center', padding: '4px 8px', margin: '4px 8px 2px' });
			const extractBtn = btnWrap.createEl('button', {
				cls: 'mod-cta',
				text: t.colorExtractBtn ?? 'Extract Image Colors',
			});
			extractBtn.setCssProps({ width: '100%', fontSize: '11px', height: '26px' });
			extractBtn.addEventListener('click', () => {
				extractBtn.setText(t.colorExtracting ?? 'Extracting colors...');
				extractBtn.setAttribute('disabled', 'true');
				this.nodeColorCache.clear();
				void this.extractAllNodeColors(activeView);
			});
		}

		// Count chromatic & neutral colors across canvas image nodes
		const colorCounts = new Map<string, number>();
		// Also count colors only among currently-visible (non-hidden) nodes
		const visibleColorCounts = new Map<string, number>();
		const hasAnyFilter = this.activeColorFilters.size > 0 || this.activeColorExcludes.size > 0 ||
		                     this.activeTagFilters.size > 0   || this.activeTagExcludes.size > 0;

		const includeAccents = this.plugin.settings.colorIncludeAccents ?? false;
		const includeNodeColor = this.plugin.settings.colorIncludeNodeColor ?? false;

		canvas.nodes.forEach((node) => {
			const rawNode = node as unknown as { id: string; color?: string; unknownData?: { color?: string } };
			const nodeEl = node.nodeEl;
			if (!nodeEl || !rawNode.id) return;
			const img = this.getNativeImageElement(nodeEl) ?? nodeEl.querySelector<HTMLImageElement>('img');

			let nodeColorNames: string[] = [];

			// Native canvas custom color set by user via node context menu
			if (includeNodeColor) {
				const customColor = rawNode.color ?? rawNode.unknownData?.color;
				if (typeof customColor === 'string' && customColor) {
					const namedColor = canvasNodePresetColorToName(customColor);
					if (namedColor) nodeColorNames.push(namedColor);
				}
			}

			if (img?.src) {
				let imageColors = this.nodeColorCache.get(rawNode.id);
				if (imageColors === undefined && extractMode === 'auto') {
					void getNodeDominantColorName(img.src, includeAccents).then((names) => {
						this.nodeColorCache.set(rawNode.id, names);
						if (this.tagFilterPanelEl?.isConnected && this.activeFilterTab === 'color') {
							if (this.lazyExtractDebounceTimer !== null) window.clearTimeout(this.lazyExtractDebounceTimer);
							this.lazyExtractDebounceTimer = window.setTimeout(() => {
								this.lazyExtractDebounceTimer = null;
								this.refreshTagFilterPanel(activeView);
							}, 300);
						}
					});
				} else if (Array.isArray(imageColors)) {
					nodeColorNames.push(...imageColors);
				}
			}

			// Deduplicate colors for this node
			if (nodeColorNames.length > 0) {
				const uniqueColors = Array.from(new Set(nodeColorNames));
				const isVisible = hasAnyFilter && !nodeEl.classList.contains('kambas-tag-hidden');
				for (const colorName of uniqueColors) {
					colorCounts.set(colorName, (colorCounts.get(colorName) ?? 0) + 1);
					if (isVisible) {
						visibleColorCounts.set(colorName, (visibleColorCounts.get(colorName) ?? 0) + 1);
					}
				}
			}
		});

		// ── 2. Search box (with embedded 'x' clear filter button) ────────────────
		const searchWrap = controlsWrap.createDiv({ cls: 'kambas-tag-search-wrap' });
		const searchIcon = searchWrap.createSpan({ cls: 'kambas-tag-search-icon' });
		setIcon(searchIcon, 'search');
		const searchInput = searchWrap.createEl('input', {
			cls: 'kambas-tag-search',
			attr: { type: 'text', placeholder: 'Search colors…' },
		});

		// Clear 'x' button inside search bar (transferred from standalone button)
		const hasColorActivity = this.activeColorFilters.size > 0 || this.activeColorExcludes.size > 0;
		const clearInSearch = searchWrap.createEl('button', {
			cls: 'kambas-tag-search-clear' + (hasColorActivity ? '' : ' is-hidden'),
			attr: { 'aria-label': t.colorClearFilter ?? 'Clear color filter' },
		});
		setIcon(clearInSearch, 'x');
		clearInSearch.addEventListener('click', () => {
			this.activeColorFilters.clear();
			this.activeColorExcludes.clear();
			this.applyTagFilters(activeView, true);
			this.refreshTagFilterPanel(activeView);
		});

		// ── 3. Controls toggles: Minor colors, Display color names & Include node colors ──────
		const togglesWrap = controlsWrap.createDiv({ cls: 'kambas-color-toggles-wrap' });

		// Toggle: Include minor colors
		const minorToggleLabel = togglesWrap.createEl('label', { cls: 'kambas-accent-toggle-label' });
		const minorCheckbox = minorToggleLabel.createEl('input', { attr: { type: 'checkbox' } });
		minorCheckbox.checked = includeAccents;
		minorToggleLabel.createSpan({ text: 'Include minor colors' });
		minorCheckbox.addEventListener('change', () => {
			this.plugin.settings.colorIncludeAccents = minorCheckbox.checked;
			void this.plugin.saveSettings();
			this.nodeColorCache.clear();
			void this.extractAllNodeColors(activeView);
		});

		// Toggle: Include node color (text cards, groups, borders)
		const nodeColorToggleLabel = togglesWrap.createEl('label', { cls: 'kambas-accent-toggle-label' });
		const nodeColorCheckbox = nodeColorToggleLabel.createEl('input', { attr: { type: 'checkbox' } });
		nodeColorCheckbox.checked = includeNodeColor;
		nodeColorToggleLabel.createSpan({ text: 'Include card colors' });
		nodeColorCheckbox.addEventListener('change', () => {
			this.plugin.settings.colorIncludeNodeColor = nodeColorCheckbox.checked;
			void this.plugin.saveSettings();
			this.applyTagFilters(activeView, true);
			this.refreshTagFilterPanel(activeView);
		});

		// Toggle: Display color name
		const showName = this.plugin.settings.colorShowName ?? true;
		const nameToggleLabel = togglesWrap.createEl('label', { cls: 'kambas-accent-toggle-label' });
		const nameCheckbox = nameToggleLabel.createEl('input', { attr: { type: 'checkbox' } });
		nameCheckbox.checked = showName;
		nameToggleLabel.createSpan({ text: 'Display color name' });
		nameCheckbox.addEventListener('change', () => {
			this.plugin.settings.colorShowName = nameCheckbox.checked;
			void this.plugin.saveSettings();
			this.refreshTagFilterPanel(activeView);
		});

		if (canvas.nodes.size === 0) {
			body.createDiv({ cls: 'kambas-tag-panel-empty', text: t.colorNoImages ?? 'No nodes found on canvas.' });
			return;
		}

		if (colorCounts.size === 0) {
			const emptyDiv = body.createDiv({
				cls: 'kambas-tag-panel-empty',
				text: extractMode === 'auto' ? 'Extracting or no colors found...' : 'Click button above to extract image colors.',
			});
			if (this.activeColorFilters.size > 0 || this.activeColorExcludes.size > 0) {
				const resetBtn = emptyDiv.createEl('button', { cls: 'mod-warning', text: 'Clear color filter' });
				resetBtn.setCssProps({ marginTop: '10px' });
				resetBtn.addEventListener('click', () => {
					this.activeColorFilters.clear();
					this.activeColorExcludes.clear();
					this.applyTagFilters(activeView, true);
					this.refreshTagFilterPanel(activeView);
				});
			}
			return;
		}

		// ── 3. Scrollable color list ─────────────────────────────────────────────
		const listEl = body.createDiv({ cls: 'kambas-tag-panel-list' });

		// ── Cross-highlight setup ─────────────────────────────────────────────────
		// Build colorName → nodeEl[] map so row-hover can outline matching elements
		const colorToNodes = new Map<string, HTMLElement[]>();
		canvas.nodes.forEach((node) => {
			const rawNode = node as unknown as { id: string; color?: string; unknownData?: { color?: string } };
			const nodeEl = node.nodeEl;
			if (!nodeEl || !rawNode.id) return;
			const img = this.getNativeImageElement(nodeEl) ?? nodeEl.querySelector<HTMLImageElement>('img');
			
			const combinedColors: string[] = [];
			if (includeNodeColor) {
				const customColor = rawNode.color ?? rawNode.unknownData?.color;
				if (typeof customColor === 'string' && customColor) {
					const namedColor = canvasNodePresetColorToName(customColor);
					if (namedColor) combinedColors.push(namedColor);
				}
			}
			if (img?.src) {
				const cached = this.nodeColorCache.get(rawNode.id);
				if (Array.isArray(cached)) combinedColors.push(...cached);
			}

			if (combinedColors.length === 0) return;

			for (const c of new Set(combinedColors)) {
				let bucket = colorToNodes.get(c);
				if (!bucket) { bucket = []; colorToNodes.set(c, bucket); }
				bucket.push(nodeEl);
				// Tag the element so the canvas-node → row direction can read it
				const existing = nodeEl.getAttribute('data-kambas-colors') ?? '';
				if (!existing.split(',').includes(c)) {
					nodeEl.setAttribute('data-kambas-colors', existing ? `${existing},${c}` : c);
				}
			}
		});

		// Canvas-node hover → highlight matching panel rows (event delegation)
		const canvasContainer = (activeView as unknown as { containerEl?: HTMLElement }).containerEl;
		const clearRowHighlights = (): void => {
			listEl.querySelectorAll('.is-related, .is-unrelated').forEach((el) => {
				el.classList.remove('is-related', 'is-unrelated');
			});
		};
		const onCanvasMouseOver = (e: Event): void => {
			const target = e.target as HTMLElement;
			const nodeEl = target.closest('[data-kambas-colors]');
			if (!nodeEl) { clearRowHighlights(); return; }
			const nodeColors = new Set((nodeEl.getAttribute('data-kambas-colors') ?? '').split(',').filter(Boolean));
			if (nodeColors.size === 0) { clearRowHighlights(); return; }
			listEl.querySelectorAll<HTMLElement>('[data-color-name]').forEach((row) => {
				const cn = row.getAttribute('data-color-name') ?? '';
				row.classList.toggle('is-related',   nodeColors.has(cn));
				row.classList.toggle('is-unrelated', !nodeColors.has(cn));
			});
		};
		const onCanvasMouseLeave = (): void => clearRowHighlights();

		// Tear down previous listeners then install new ones
		this.colorHighlightCleanup?.();
		if (canvasContainer) {
			canvasContainer.addEventListener('mouseover',   onCanvasMouseOver);
			canvasContainer.addEventListener('mouseleave',  onCanvasMouseLeave);
			this.colorHighlightCleanup = (): void => {
				canvasContainer.removeEventListener('mouseover',  onCanvasMouseOver);
				canvasContainer.removeEventListener('mouseleave', onCanvasMouseLeave);
				// Remove all data-kambas-colors attributes on cleanup
				canvasContainer.querySelectorAll('[data-kambas-colors]').forEach((el) => {
					el.removeAttribute('data-kambas-colors');
				});
			};
		}

		const renderColorList = (query: string): void => {
			listEl.empty();
			const lower = query.toLowerCase();
			const sortedColors = Array.from(colorCounts.entries())
				.filter(([colorName]) => {
					if (!lower) return true;
					const localizedColor = (t as unknown as Record<string, string>)[`color${colorName}`] ?? colorName;
					return colorName.toLowerCase().includes(lower) || localizedColor.toLowerCase().includes(lower);
				})
				// When a filter is active, sort related (visible) colors to the top,
				// then by total count. When no filter, sort by total count only.
				.sort((a, b) => {
					if (hasAnyFilter) {
						const visA = visibleColorCounts.get(a[0]) ?? 0;
						const visB = visibleColorCounts.get(b[0]) ?? 0;
						if (visB !== visA) return visB - visA;
					}
					return b[1] - a[1];
				});

			// When filter is active and there are related colors, show a divider
			// before the first row with 0 visible count.
			let dividerInserted = false;

			for (const [colorName, count] of sortedColors) {
				const visibleCount = visibleColorCounts.get(colorName) ?? 0;
				const isRelated = hasAnyFilter && visibleCount > 0;
				const isIncluded = this.activeColorFilters.has(colorName);
				const isExcluded = this.activeColorExcludes.has(colorName);

				// Insert divider between related and unrelated groups
				if (hasAnyFilter && !dividerInserted && !isRelated && visibleColorCounts.size > 0) {
					dividerInserted = true;
					const divider = listEl.createDiv({ cls: 'kambas-color-divider' });
					divider.createSpan({ text: 'Not in current view' });
				}

				const rowCls = 'kambas-tag-panel-item'
					+ (isIncluded ? ' is-active'   : '')
					+ (isExcluded ? ' is-excluded' : '')
					+ (!isRelated && hasAnyFilter ? ' is-not-in-view' : '');
				const row = listEl.createDiv({ cls: rowCls });
				// Tag row for canvas-node → row highlight direction
				row.setAttribute('data-color-name', colorName);

				const checkEl = row.createSpan({ cls: 'kambas-tag-panel-check' });
				setIcon(checkEl, isIncluded ? 'check-square' : isExcluded ? 'x-square' : 'square');

				const dot = row.createSpan({ cls: 'kambas-color-dot' });
				if (colorHexMap[colorName]) {
					dot.style.backgroundColor = colorHexMap[colorName];
				}

				if (showName) {
					const localizedColor = (t as unknown as Record<string, string>)[`color${colorName}`] ?? colorName;
					row.createSpan({ cls: 'kambas-tag-panel-pill', text: localizedColor });
				}

				// Show "N in view" badge alongside the total when a filter is active
				if (isRelated) {
					row.createSpan({
						cls: 'kambas-tag-panel-count kambas-in-view-count',
						text: `${visibleCount} in view`,
					});
				}
				// Single general term: "12 items" / "1 item"
				const unitText = count === 1 ? 'item' : 'items';
				row.createSpan({ cls: 'kambas-tag-panel-count', text: `${count} ${unitText}` });

				// Row hover → outline matching canvas image nodes
				row.addEventListener('mouseenter', () => {
					const nodes = colorToNodes.get(colorName) ?? [];
					nodes.forEach((el) => el.classList.add('kambas-color-highlight'));
				});
				row.addEventListener('mouseleave', () => {
					const nodes = colorToNodes.get(colorName) ?? [];
					nodes.forEach((el) => el.classList.remove('kambas-color-highlight'));
				});

				// 3-state cycle: neutral → include → exclude → neutral
				row.addEventListener('click', () => {
					if (this.activeColorFilters.has(colorName)) {
						// include → exclude
						this.activeColorFilters.delete(colorName);
						this.activeColorExcludes.add(colorName);
					} else if (this.activeColorExcludes.has(colorName)) {
						// exclude → neutral
						this.activeColorExcludes.delete(colorName);
					} else {
						// neutral → include
						this.activeColorFilters.add(colorName);
					}
					this.applyTagFilters(activeView, true);
					this.refreshTagFilterPanel(activeView);
				});
			}

			if (sortedColors.length === 0) {
				listEl.createDiv({ cls: 'kambas-tag-panel-empty', text: 'No colors match.' });
			}
		};

		renderColorList('');
		searchInput.addEventListener('input', () => renderColorList(searchInput.value));
	}

	private renderTagFilterList(body: HTMLElement, activeView: CanvasItemView): void {
		body.empty();
		const t = getText();
		const canvas = activeView.canvas;
		if (!canvas?.nodes) return;

		const hasAnyFilter = this.activeTagFilters.size > 0 || this.activeTagExcludes.size > 0 ||
		                     this.activeColorFilters.size > 0 || this.activeColorExcludes.size > 0;

		// Build tag → total count, and tag → visible count maps
		const tagMap = new Map<string, number>();
		const visibleTagCounts = new Map<string, number>();
		canvas.nodes.forEach((node) => {
			const uData = (node as unknown as { unknownData?: { kambasTags?: string[] } }).unknownData;
			const isVisible = hasAnyFilter && !node.nodeEl?.classList.contains('kambas-tag-hidden');
			for (const tag of uData?.kambasTags ?? []) {
				if (!tag.trim()) continue;
				tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
				if (isVisible) {
					visibleTagCounts.set(tag, (visibleTagCounts.get(tag) ?? 0) + 1);
				}
			}
		});

		if (tagMap.size === 0) {
			const emptyDiv = body.createDiv({ cls: 'kambas-tag-panel-empty', text: 'No tags on this canvas yet.' });
			if (this.activeTagFilters.size > 0) {
				const resetBtn = emptyDiv.createEl('button', {
					cls: 'mod-warning',
					text: 'Reset active filter',
				});
				resetBtn.setCssProps({ marginTop: '10px' });
				resetBtn.addEventListener('click', () => {
					this.activeTagFilters.clear();
					this.applyTagFilters(activeView, true);
					this.refreshTagFilterPanel(activeView);
				});
			}
			return;
		}

		// ── Search box ──────────────────────────────────────────────────────────
		const searchWrap = body.createDiv({ cls: 'kambas-tag-search-wrap' });
		const searchIcon = searchWrap.createSpan({ cls: 'kambas-tag-search-icon' });
		setIcon(searchIcon, 'search');
		const searchInput = searchWrap.createEl('input', {
			cls: 'kambas-tag-search',
			attr: { type: 'text', placeholder: 'Search tags…' },
		});
		// Clear × lives inside the search bar — always in the DOM, no layout shift
		const hasTagActivity = this.activeTagFilters.size > 0 || this.activeTagExcludes.size > 0;
		const clearInSearch = searchWrap.createEl('button', {
			cls: 'kambas-tag-search-clear' + (hasTagActivity ? '' : ' is-hidden'),
			attr: { 'aria-label': t.tagClearFilter },
		});
		setIcon(clearInSearch, 'x');
		clearInSearch.addEventListener('click', () => {
			this.activeTagFilters.clear();
			this.activeTagExcludes.clear();
			// Route through applyTagFilters with performZoom=true on explicit clear click
			this.applyTagFilters(activeView, true);
			this.refreshTagFilterPanel(activeView);
		});

		// ── Tag list ────────────────────────────────────────────────────────────
		const listEl = body.createDiv({ cls: 'kambas-tag-panel-list' });

		const renderList = (query: string): void => {
			listEl.empty();
			const lower = query.toLowerCase();
			const sorted = Array.from(tagMap.entries())
				.filter(([tag]) => !lower || tag.toLowerCase().includes(lower))
				// Related tags (in current view) bubble to top; ties broken alphabetically
				.sort(([a, _countA], [b, _countB]) => {
					if (hasAnyFilter) {
						const visA = visibleTagCounts.get(a) ?? 0;
						const visB = visibleTagCounts.get(b) ?? 0;
						if (visB !== visA) return visB - visA;
					}
					return a.localeCompare(b);
				});

			let dividerInserted = false;

			for (const [tag, count] of sorted) {
				const visibleCount = visibleTagCounts.get(tag) ?? 0;
				const isRelated = hasAnyFilter && visibleCount > 0;
				const isIncluded = this.activeTagFilters.has(tag);
				const isExcluded = this.activeTagExcludes.has(tag);

				// Divider before first tag with 0 visible count
				if (hasAnyFilter && !dividerInserted && !isRelated && visibleTagCounts.size > 0) {
					dividerInserted = true;
					const divider = listEl.createDiv({ cls: 'kambas-color-divider' });
					divider.createSpan({ text: 'Not in current view' });
				}

				const rowCls = 'kambas-tag-panel-item'
					+ (isIncluded ? ' is-active'   : '')
					+ (isExcluded ? ' is-excluded' : '')
					+ (!isRelated && hasAnyFilter ? ' is-not-in-view' : '');
				const row = listEl.createDiv({ cls: rowCls });

				const checkEl = row.createSpan({ cls: 'kambas-tag-panel-check' });
				setIcon(checkEl, isIncluded ? 'check-square' : isExcluded ? 'x-square' : 'square');
				row.createSpan({ cls: 'kambas-tag-panel-pill', text: `#${tag}` });

				// "N in view" badge when a filter is active
				if (isRelated) {
					row.createSpan({
						cls: 'kambas-tag-panel-count kambas-in-view-count',
						text: `${visibleCount} in view`,
					});
				}
				row.createSpan({ cls: 'kambas-tag-panel-count', text: t.tagNodesCount(count) });

				// Delete tag from all nodes
				const deleteBtn = row.createSpan({ cls: 'kambas-tag-panel-delete' });
				setIcon(deleteBtn, 'trash-2');
				deleteBtn.setAttribute('aria-label', 'Delete tag from all nodes');
				deleteBtn.addEventListener('click', (ev) => {
					ev.stopPropagation();
					void this.deleteTagFromCanvas(activeView, tag);
				});

				// 3-state cycle: neutral → include → exclude → neutral
				row.addEventListener('click', () => {
					if (this.activeTagFilters.has(tag)) {
						// include → exclude
						this.activeTagFilters.delete(tag);
						this.activeTagExcludes.add(tag);
					} else if (this.activeTagExcludes.has(tag)) {
						// exclude → neutral
						this.activeTagExcludes.delete(tag);
					} else {
						// neutral → include
						this.activeTagFilters.add(tag);
					}
					this.applyTagFilters(activeView, true);
					this.refreshTagFilterPanel(activeView);
				});
			}

			if (sorted.length === 0) {
				listEl.createDiv({ cls: 'kambas-tag-panel-empty', text: 'No tags match.' });
			}
		};

		renderList('');
		searchInput.addEventListener('input', () => renderList(searchInput.value));
	}


	public async deleteTagFromCanvas(activeView: CanvasItemView, tagToDelete: string): Promise<void> {
		const canvas = activeView.canvas;
		if (!canvas?.nodes) return;

		canvas.nodes.forEach((node) => {
			const rawNode = node as unknown as { unknownData?: { kambasTags?: string[] } };
			const tags = rawNode.unknownData?.kambasTags ?? [];
			if (!tags.includes(tagToDelete)) return;
			const newTags = tags.filter((tg) => tg !== tagToDelete);
			if (rawNode.unknownData) {
				rawNode.unknownData.kambasTags = newTags.length > 0 ? newTags : undefined;
			}
			if (node.nodeEl.instanceOf(HTMLElement)) this.renderTagBadges(node.nodeEl, newTags);
		});

		this.activeTagFilters.delete(tagToDelete);
		this.activeTagExcludes.delete(tagToDelete);

		// ⚠️ Save filter state to localStorage NOW — before persistDeleteTag triggers
		// a vault modify event → scanAndRestoreTransforms → restoreFilterState, which
		// would re-read stale localStorage and re-apply the deleted tag as an active
		// filter, keeping hidden nodes dimmed despite the deletion.
		const file = activeView.file;
		if (file) this.saveFilterState(file);

		if (file) await this.persistDeleteTag(file, tagToDelete);

		window.setTimeout(() => {
			this.applyTagFilters(activeView);
			this.refreshTagFilterPanel(activeView);
		}, 80);
	}

	private async persistDeleteTag(file: TFile, tagToDelete: string): Promise<void> {
		const content = await this.app.vault.read(file);
		let data: CanvasFileData;
		try { data = JSON.parse(content) as CanvasFileData; } catch { return; }
		if (!Array.isArray(data.nodes)) return;
		let modified = false;
		for (const node of data.nodes) {
			// kambasTags is stored as a direct node property in the JSON (not under unknownData)
			const nd = node as unknown as { kambasTags?: string[] };
			const tags = nd.kambasTags;
			if (!tags?.includes(tagToDelete)) continue;
			const next = tags.filter((tg) => tg !== tagToDelete);
			nd.kambasTags = next.length > 0 ? next : undefined;
			if (!nd.kambasTags) delete nd.kambasTags;
			modified = true;
		}
		if (modified) this.scheduleVaultModify(file, data);
	}

	private updateToolbarButtonState(): void {
		if (!this.tagToolbarBtn) return;
		const filtersActive =
			this.activeTagFilters.size > 0 || this.activeTagExcludes.size > 0 ||
			this.activeColorFilters.size > 0 || this.activeColorExcludes.size > 0;
		const panelOpen = this.tagFilterPanelEl?.isConnected ?? false;
		this.tagToolbarBtn.classList.toggle('is-active', filtersActive || panelOpen);
	}

	private saveFilterState(file: TFile): void {
		try {
			this.activeTagFiltersFile = file.path;
			const key = `kambas-filters:${file.path}`;
			const hasAny = this.activeTagFilters.size > 0 || this.activeTagExcludes.size > 0;
			if (hasAny) {
				this.app.saveLocalStorage(key, JSON.stringify({
					include: [...this.activeTagFilters],
					exclude: [...this.activeTagExcludes],
				}));
			} else {
				this.app.saveLocalStorage(key, null);
			}
		} catch { /* ignore */ }
	}

	private restoreFilterState(file: TFile, activeView: CanvasItemView): void {
		try {
			this.activeTagFiltersFile = file.path;
			const key = `kambas-filters:${file.path}`;
			const raw = this.app.loadLocalStorage(key) as string | null;
			if (!raw) {
				this.activeTagFilters.clear();
				this.activeTagExcludes.clear();
				this.applyTagFilters(activeView);
				return;
			}
			// Support both old plain-array format and new { include, exclude } format
			const parsed = JSON.parse(raw) as string[] | { include?: string[]; exclude?: string[] };
			if (Array.isArray(parsed)) {
				// Legacy format: treat as plain include list
				this.activeTagFilters = new Set(parsed);
				this.activeTagExcludes.clear();
			} else {
				this.activeTagFilters = new Set(parsed.include ?? []);
				this.activeTagExcludes = new Set(parsed.exclude ?? []);
			}

			// Prune filter entries that no longer exist on ANY node
			const canvas = activeView.canvas;
			if (canvas?.nodes) {
				const liveTags = new Set<string>();
				canvas.nodes.forEach((node) => {
					const uData = (node as unknown as { unknownData?: { kambasTags?: string[] } }).unknownData;
					for (const tag of uData?.kambasTags ?? []) {
						if (tag.trim()) liveTags.add(tag);
					}
				});
				for (const activeTag of this.activeTagFilters) {
					if (!liveTags.has(activeTag)) this.activeTagFilters.delete(activeTag);
				}
				for (const excludeTag of this.activeTagExcludes) {
					if (!liveTags.has(excludeTag)) this.activeTagExcludes.delete(excludeTag);
				}
			}

			this.applyTagFilters(activeView);
			this.updateToolbarButtonState();
		} catch { /* ignore */ }
	}

	private installSelectionGuard(activeView: CanvasItemView): void {
		this.removeSelectionGuard();
		const canvas = activeView.canvas;
		if (!canvas) return;
		const container = (activeView as unknown as { containerEl?: HTMLElement }).containerEl;
		if (!container) return;

		type CvEx = { selection?: Set<object>; updateSelection?: () => void };
		const cx = canvas as unknown as CvEx;

		let rafPending = false;
		const enforceSelectionGuard = (): void => {
			if (!canvas.nodes) return;
			let deselectedAny = false;
			canvas.nodes.forEach((node) => {
				const el = node.nodeEl;
				if (!el?.classList.contains('kambas-tag-hidden')) return;
				const isNodeSelected = el.classList.contains('is-selected') || cx.selection?.has(node);
				if (!isNodeSelected) return;

				deselectedAny = true;
				el.classList.remove('is-selected');

				const nu = node as unknown as { unselect?: () => void };
				if (typeof nu.unselect === 'function') {
					try { nu.unselect(); } catch { /* ignore */ }
				}
				try { cx.selection?.delete(node); } catch { /* ignore */ }
			});

			if (deselectedAny && typeof cx.updateSelection === 'function') {
				try { cx.updateSelection(); } catch { /* ignore */ }
			}
		};

		const mo = new MutationObserver(() => {
			if (rafPending) return;
			rafPending = true;
			window.requestAnimationFrame(() => {
				rafPending = false;
				enforceSelectionGuard();
			});
		});

		// Directly intercept canvas.selectAll if present on canvas instance
		type CanvasProto = { selectAll?: (nodes?: Set<object>) => void; select?: (node: object) => void };
		const origCanvas = canvas as unknown as CanvasProto;
		let origSelectAll: ((nodes?: Set<object>) => void) | undefined = undefined;

		if (typeof origCanvas.selectAll === 'function') {
			origSelectAll = origCanvas.selectAll;
			origCanvas.selectAll = function(nodes?: Set<object>): void {
				// If nodes is passed (e.g. from selectAll command), filter out hidden ones
				const visibleSet = new Set<object>();
				if (nodes instanceof Set) {
					nodes.forEach((n) => {
						const el = (n as { nodeEl?: HTMLElement }).nodeEl;
						if (!el?.classList.contains('kambas-tag-hidden')) {
							visibleSet.add(n);
						}
					});
				} else if (canvas.nodes) {
					canvas.nodes.forEach((node) => {
						if (!node.nodeEl?.classList.contains('kambas-tag-hidden')) {
							visibleSet.add(node);
						}
					});
				}
				origSelectAll?.call(this, visibleSet);
			};
		}

		// Intercept Ctrl+A / Cmd+A so selectAll only selects visible (non-hidden) nodes
		const handleKeyGuard = (evt: KeyboardEvent): void => {
			if ((evt.ctrlKey || evt.metaKey) && (evt.key === 'a' || evt.key === 'A')) {
				const target = evt.target as HTMLElement | null;
				if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
					return; // standard text input select-all
				}
				// Force explicit select of visible nodes only
				if (typeof origCanvas.selectAll === 'function') {
					evt.preventDefault();
					evt.stopPropagation();
					origCanvas.selectAll();
					return;
				}
				window.setTimeout(() => enforceSelectionGuard(), 0);
				window.requestAnimationFrame(() => enforceSelectionGuard());
			}
		};

		window.addEventListener('keydown', handleKeyGuard, true);

		mo.observe(container, { attributes: true, subtree: true, attributeFilter: ['class'] });
		this.tagFilterSelectionGuard = (): void => {
			mo.disconnect();
			window.removeEventListener('keydown', handleKeyGuard, true);
			if (origSelectAll && typeof origCanvas.selectAll === 'function') {
				origCanvas.selectAll = origSelectAll;
			}
		};
	}

	private removeSelectionGuard(): void {
		this.tagFilterSelectionGuard?.();
		this.tagFilterSelectionGuard = null;
	}

	private applyTagFilters(activeView: CanvasItemView, performZoom = false): void {
		const canvas = activeView.canvas;
		if (!canvas?.nodes) return;
		const allowZoom = performZoom && (this.plugin.settings.tagZoomOnSelect ?? true);
		const hasTagIncludes  = this.activeTagFilters.size > 0;
		const hasTagExcludes  = this.activeTagExcludes.size > 0;
		const hasColorIncludes = this.activeColorFilters.size > 0;
		const hasColorExcludes = this.activeColorExcludes.size > 0;

		if (!hasTagIncludes && !hasTagExcludes && !hasColorIncludes && !hasColorExcludes) {
			canvas.nodes.forEach((node) => node.nodeEl?.classList.remove('kambas-tag-hidden'));
			this.removeSelectionGuard();
			// Zoom to fit all nodes once when explicitly clearing/unselecting filters
			if (allowZoom) {
				window.setTimeout(() => this.zoomToVisibleNodes(activeView), 80);
			}
		} else {
			canvas.nodes.forEach((node) => {
				const rawNode = node as unknown as { id: string; unknownData?: { kambasTags?: string[] } };
				const nodeTags = rawNode.unknownData?.kambasTags ?? [];

				// ── Include checks: node must satisfy ALL active include criteria ──
				const tagIncludeOk = !hasTagIncludes || nodeTags.some((tag) => this.activeTagFilters.has(tag));

				const includeNodeColor = this.plugin.settings.colorIncludeNodeColor ?? false;
				const rawNodeWithColor = node as unknown as { id: string; color?: string; unknownData?: { color?: string; kambasTags?: string[] } };
				const cachedColors = this.nodeColorCache.get(rawNodeWithColor.id);
				const nodeColors: string[] = Array.isArray(cachedColors) ? [...cachedColors] : [];

				if (includeNodeColor) {
					const customColor = rawNodeWithColor.color ?? rawNodeWithColor.unknownData?.color;
					if (typeof customColor === 'string' && customColor) {
						const namedColor = canvasNodePresetColorToName(customColor);
						if (namedColor && !nodeColors.includes(namedColor)) {
							nodeColors.push(namedColor);
						}
					}
				}

				const colorIncludeOk = !hasColorIncludes || nodeColors.some((c) => this.activeColorFilters.has(c));

				// ── Exclude checks: hide if node has ANY excluded tag or color ──
				const tagExcluded   = hasTagExcludes   && nodeTags.some((tag) => this.activeTagExcludes.has(tag));
				const colorExcluded = hasColorExcludes && nodeColors.some((c)  => this.activeColorExcludes.has(c));

				// Visible = passes all includes AND passes all excludes
				const matches = tagIncludeOk && colorIncludeOk && !tagExcluded && !colorExcluded;
				node.nodeEl?.classList.toggle('kambas-tag-hidden', !matches);
			});
			// Guard prevents rubber-band selection from picking up hidden nodes
			this.installSelectionGuard(activeView);
			// Zoom canvas to fit visible nodes ONCE when user explicitly toggles a filter
			if (allowZoom) {
				window.setTimeout(() => this.zoomToVisibleNodes(activeView), 80);
			}
		}
		// Persist filter state so it survives panel close / canvas reopen
		const file = activeView.file;
		if (file) this.saveFilterState(file);
		this.updateToolbarButtonState();
	}

	/** Zoom / pan the canvas to fit all nodes that are not hidden by tag filter. */
	private zoomToVisibleNodes(activeView: CanvasItemView): void {
		const canvas = activeView.canvas;
		if (!canvas?.nodes) return;

		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		let hasVisible = false;

		canvas.nodes.forEach((node) => {
			if (node.nodeEl?.classList.contains('kambas-tag-hidden')) return;
			hasVisible = true;
			minX = Math.min(minX, node.x);
			minY = Math.min(minY, node.y);
			maxX = Math.max(maxX, node.x + node.width);
			maxY = Math.max(maxY, node.y + node.height);
		});

		if (!hasVisible) return;

		const PADDING = 80;
		const bMinX = minX - PADDING;
		const bMinY = minY - PADDING;
		const bMaxX = maxX + PADDING;
		const bMaxY = maxY + PADDING;

		// Use Obsidian's built-in zoomToBbox if available (correct format: minX/minY/maxX/maxY)
		if (canvas.zoomToBbox) {
			canvas.zoomToBbox({ minX: bMinX, minY: bMinY, maxX: bMaxX, maxY: bMaxY });
			return;
		}

		// Manual fallback: compute pan+zoom from canvas transform formula
		// screen_pos = canvas_pos * zoom + (viewport_center + translation)
		const container = (activeView as unknown as { containerEl?: HTMLElement }).containerEl;
		if (!container) return;
		const vpW = container.offsetWidth;
		const vpH = container.offsetHeight;
		const bboxW = bMaxX - bMinX;
		const bboxH = bMaxY - bMinY;
		if (bboxW <= 0 || bboxH <= 0) return;

		const newZoom = Math.min(vpW / bboxW, vpH / bboxH, 2); // cap at 2×
		const centerX = (bMinX + bMaxX) / 2;
		const centerY = (bMinY + bMaxY) / 2;

		// tx/ty such that canvas center maps to viewport center
		canvas.tx = vpW / 2 - centerX * newZoom;
		canvas.ty = vpH / 2 - centerY * newZoom;
		canvas.zoom = newZoom;
		canvas.markViewportChanged?.();
	}

	/**
	 * Injects a tag-filter button into the canvas right toolbar.
	 * Safe to call repeatedly — skips if already injected.
	 */
	public injectTagFilterButton(activeView: CanvasItemView): void {
		const container = (activeView as unknown as { containerEl?: HTMLElement }).containerEl;
		if (!container) return;

		if (container.querySelector('.kambas-tag-toolbar-btn')) return;

		const controls = container.querySelector<HTMLElement>('.canvas-controls');
		if (!controls) return;

		const groups = controls.querySelectorAll<HTMLElement>('.canvas-control-group');
		const targetGroup = groups.length > 0 ? groups[groups.length - 1] : controls;

		const btn = targetGroup.createDiv({
			cls: 'canvas-control-item kambas-tag-toolbar-btn',
			attr: { 'aria-label': getText().tagFilterPanel },
		});
		setIcon(btn, 'tag');
		this.tagToolbarBtn = btn;

		btn.addEventListener('click', () => {
			this.openTagFilterPanel(activeView);
		});
		// Reflect current filter state immediately after injection
		this.updateToolbarButtonState();
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Paste / Drop handlers
	// ──────────────────────────────────────────────────────────────────────────

	private handlePaste = (evt: ClipboardEvent): void => {
		const activeView = this.app.workspace.getActiveViewOfType(ItemView) as unknown as CanvasItemView | null;
		if (!activeView || activeView.getViewType() !== 'canvas') return;

		const clipboardData = evt.clipboardData;
		if (!clipboardData) return;

		const pendingImages: PendingImage[] = [];

		for (let i = 0; i < clipboardData.files.length; i++) {
			const file = clipboardData.files[i];
			if (file.type.startsWith('image/')) {
				pendingImages.push({
					filename: file.name || `pasted_image_${Date.now()}.${file.type.split('/')[1] || 'png'}`,
					mimeType: file.type,
					file,
				});
			}
		}

		if (pendingImages.length > 0) {
			evt.preventDefault();
			evt.stopPropagation();
			void this.processImages(activeView, pendingImages, evt);
		}
	};

	private handleDrop = (evt: DragEvent): void => {
		const activeView = this.app.workspace.getActiveViewOfType(ItemView) as unknown as CanvasItemView | null;
		if (!activeView || activeView.getViewType() !== 'canvas') return;

		const dataTransfer = evt.dataTransfer;
		if (!dataTransfer) return;

		const pendingImages: PendingImage[] = [];

		for (let i = 0; i < dataTransfer.files.length; i++) {
			const file = dataTransfer.files[i];
			if (file.type.startsWith('image/')) {
				pendingImages.push({
					filename: file.name || `dropped_image_${Date.now()}.${file.type.split('/')[1] || 'png'}`,
					mimeType: file.type,
					file,
				});
			}
		}

		if (pendingImages.length > 0) {
			evt.preventDefault();
			evt.stopPropagation();
			void this.processImages(activeView, pendingImages, evt);
		}
	};

	private async processImages(
		canvasView: CanvasItemView,
		images: PendingImage[],
		evt: MouseEvent | ClipboardEvent | DragEvent
	): Promise<void> {
		// Capture exact position at the moment of paste/drop BEFORE opening modal or async loading
		const initialMousePos = this.lastMousePos ? { ...this.lastMousePos } : null;

		let currentChoice: StorageChoice | null = null;
		let applyToAllRemaining = false;

		for (let i = 0; i < images.length; i++) {
			const item = images[i];
			const remainingCount = images.length - i;

			if (!applyToAllRemaining || !currentChoice) {
				const res = await new Promise<{ choice: StorageChoice; applyToAll: boolean }>((resolve) => {
					const modal = new ImageIngestionModal(
						this.app,
						item.filename,
						remainingCount,
						(result) => resolve(result)
					);
					modal.open();
				});
				currentChoice = res.choice;
				applyToAllRemaining = res.applyToAll;
			}

			if (currentChoice === 'cancel') {
				break;
			}

			let dims = { width: 400, height: 300 };
			if (item.file) {
				dims = await getImageDimensions(item.file);
			} else if (item.arrayBuffer) {
				const tempUrl = arrayBufferToBase64DataUrl(item.arrayBuffer, item.mimeType);
				dims = await getImageDimensions(tempUrl);
			}

			const pos = this.getCanvasPosition(canvasView, evt, i, dims.width, dims.height, initialMousePos);

			if (currentChoice === 'embed') {
				let dataUrl = '';

				if (item.file) {
					dataUrl = await blobToBase64(item.file);
				} else if (item.arrayBuffer) {
					dataUrl = arrayBufferToBase64DataUrl(item.arrayBuffer, item.mimeType);
				}

				if (dataUrl) {
					await this.addEmbeddedImageToCanvas(canvasView, dataUrl, item.filename, pos.x, pos.y, dims.width, dims.height);
				}
			} else {
				let buffer: ArrayBuffer | null = null;

				if (item.file) {
					buffer = await item.file.arrayBuffer();
				} else if (item.arrayBuffer) {
					buffer = item.arrayBuffer;
				}

				if (buffer) {
					const vaultWithConfig = this.app.vault as unknown as { getConfig?: (key: string) => string };
					const attachmentFolder = vaultWithConfig.getConfig?.('attachmentFolderPath') || '';
					const vaultPath = await saveFileToVault(this.app, attachmentFolder, item.filename, buffer);
					await this.addVaultImageToCanvas(canvasView, vaultPath, pos.x, pos.y, dims.width, dims.height);
				}
			}
		}
	}

	private getCanvasPosition(
		canvasView: CanvasItemView,
		evt: MouseEvent | ClipboardEvent | DragEvent,
		indexOffset: number,
		nodeWidth = 400,
		nodeHeight = 300,
		initialMousePos?: { x: number; y: number } | null
	): { x: number; y: number } {
		const canvas = canvasView.canvas;
		let clientX: number | null = null;
		let clientY: number | null = null;

		// 1. Try event coordinates if MouseEvent / DragEvent
		const mouseEvt = evt as MouseEvent;
		if (typeof mouseEvt?.clientX === 'number' && typeof mouseEvt?.clientY === 'number' && (mouseEvt.clientX !== 0 || mouseEvt.clientY !== 0)) {
			clientX = mouseEvt.clientX;
			clientY = mouseEvt.clientY;
		}

		// 2. Fall back to initial mouse position captured when paste was triggered
		if ((clientX === null || clientY === null) && initialMousePos) {
			clientX = initialMousePos.x;
			clientY = initialMousePos.y;
		}

		// 3. Fall back to current last mouse position
		if ((clientX === null || clientY === null) && this.lastMousePos) {
			clientX = this.lastMousePos.x;
			clientY = this.lastMousePos.y;
		}

		// Convert screen coordinates (clientX, clientY) to Canvas internal coordinates
		if (canvas && clientX !== null && clientY !== null) {
			const rawCanvas = canvas as unknown as {
				posFromEvent?: (evt: { clientX: number; clientY: number }) => { x: number; y: number };
				posFromClient?: (pos: { x: number; y: number }) => { x: number; y: number };
				tx?: number;
				ty?: number;
				zoom?: number;
				wrapperEl?: HTMLElement;
				containerEl?: HTMLElement;
			};

			// Method A: posFromEvent
			if (typeof rawCanvas.posFromEvent === 'function') {
				try {
					const cPos = rawCanvas.posFromEvent({ clientX, clientY });
					if (typeof cPos?.x === 'number' && typeof cPos?.y === 'number' && !Number.isNaN(cPos.x) && !Number.isNaN(cPos.y)) {
						return {
							x: Math.round(cPos.x - nodeWidth / 2 + indexOffset * 40),
							y: Math.round(cPos.y - nodeHeight / 2 + indexOffset * 40),
						};
					}
				} catch {
					// Fallthrough
				}
			}

			// Method B: posFromClient
			if (typeof rawCanvas.posFromClient === 'function') {
				try {
					const cPos = rawCanvas.posFromClient({ x: clientX, y: clientY });
					if (typeof cPos?.x === 'number' && typeof cPos?.y === 'number' && !Number.isNaN(cPos.x) && !Number.isNaN(cPos.y)) {
						return {
							x: Math.round(cPos.x - nodeWidth / 2 + indexOffset * 40),
							y: Math.round(cPos.y - nodeHeight / 2 + indexOffset * 40),
						};
					}
				} catch {
					// Fallthrough
				}
			}

			// Method C: Canvas viewport math: (mouseClient - containerRect - tx) / zoom
			const containerEl = rawCanvas.wrapperEl ?? rawCanvas.containerEl ?? document.querySelector('.canvas-wrapper') ?? document.querySelector('.canvas');
			if (containerEl && typeof rawCanvas.tx === 'number' && typeof rawCanvas.ty === 'number' && typeof rawCanvas.zoom === 'number' && rawCanvas.zoom > 0) {
				try {
					const rect = containerEl.getBoundingClientRect();
					const worldX = (clientX - rect.left - rawCanvas.tx) / rawCanvas.zoom;
					const worldY = (clientY - rect.top - rawCanvas.ty) / rawCanvas.zoom;
					if (!Number.isNaN(worldX) && !Number.isNaN(worldY)) {
						return {
							x: Math.round(worldX - nodeWidth / 2 + indexOffset * 40),
							y: Math.round(worldY - nodeHeight / 2 + indexOffset * 40),
						};
					}
				} catch {
					// Fallthrough
				}
			}
		}

		// 4. Fall back to canvas viewport center if cursor coordinates cannot be determined
		if (canvas) {
			const rawCanvas = canvas as unknown as { getViewportBBox?: () => { minX: number; maxX: number; minY: number; maxY: number } };
			if (typeof rawCanvas.getViewportBBox === 'function') {
				try {
					const bbox = rawCanvas.getViewportBBox();
					const centerX = (bbox.minX + bbox.maxX) / 2;
					const centerY = (bbox.minY + bbox.maxY) / 2;
					return {
						x: Math.round(centerX - nodeWidth / 2 + indexOffset * 40),
						y: Math.round(centerY - nodeHeight / 2 + indexOffset * 40),
					};
				} catch {
					// Fallback
				}
			}
		}

		return { x: indexOffset * 40, y: indexOffset * 40 };
	}

	private async addEmbeddedImageToCanvas(
		canvasView: CanvasItemView,
		dataUrl: string,
		altText: string,
		x: number,
		y: number,
		width: number,
		height: number
	): Promise<void> {
		const file = canvasView.file;
		if (file) {
			await this.appendNodeToCanvasFile(file.path, {
				type: 'link',
				url: dataUrl,
				x,
				y,
				width,
				height,
				originalWidth: width,
				originalHeight: height,
			});
			window.setTimeout(() => {
				this.scanAndRestoreTransforms(canvasView);
			}, 10);
		}
	}

	private async addVaultImageToCanvas(
		canvasView: CanvasItemView,
		vaultPath: string,
		x: number,
		y: number,
		width: number,
		height: number
	): Promise<void> {
		const file = canvasView.file;
		if (file) {
			await this.appendNodeToCanvasFile(file.path, {
				type: 'file',
				file: vaultPath,
				x,
				y,
				width,
				height,
				originalWidth: width,
				originalHeight: height,
			});
		}
	}

	private async appendNodeToCanvasFile(
		canvasFilePath: string,
		nodeData: CanvasNodeData
	): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(canvasFilePath);
		if (!file || !(file instanceof TFile) || file.extension !== 'canvas') return;

		const content = await this.app.vault.read(file);
		let data: CanvasFileData;
		try {
			data = (content && content.trim().length > 0) ? JSON.parse(content) as CanvasFileData : { nodes: [], edges: [] };
		} catch {
			data = { nodes: [], edges: [] };
		}

		if (!data.nodes) data.nodes = [];
		nodeData.id = Math.random().toString(36).substring(2, 16);
		data.nodes.push(nodeData);

		try {
			await this.app.vault.modify(file, JSON.stringify(data, null, 2));
		} catch (err) {
			console.error('Error saving updated node to canvas file:', err);
		}
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Image Swap
	// ──────────────────────────────────────────────────────────────────────────

	public async swapSelectedImage(
		activeView: CanvasItemView,
		targetNodeEl?: Element | null
	): Promise<void> {
		const canvasFile = activeView.file;
		if (!canvasFile) return;

		const canvas = activeView.canvas;
		if (!canvas || !canvas.nodes) return;

		// Identify the single target node
		let targetId: string | null = null;
		let targetNodeObj: unknown = null;

		canvas.nodes.forEach((node, id) => {
			const nodeEl = node.nodeEl;
			if (!nodeEl) return;
			const isTargetNode = targetNodeEl && (nodeEl === targetNodeEl || nodeEl.contains(targetNodeEl));
			const isExplicitlySelected = nodeEl.classList.contains('is-selected');
			const hasImg = nodeEl.querySelector('.kambas-embedded-img') || this.getNativeImageElement(nodeEl);
			if ((isExplicitlySelected || isTargetNode) && hasImg) {
				targetId = id;
				targetNodeObj = node;
			}
		});

		if (!targetId || !targetNodeObj) return;

		// Open swap modal
		const result = await new Promise<import('../modals/ImageSwapModal').SwapResult | null>((resolve) => {
			new ImageSwapModal(this.app, (r) => resolve(r)).open();
		});

		if (!result) return; // cancelled

		// Read new media dimensions to update aspect ratio
		let newDims: { width: number; height: number } | null = null;
		let newFileOrUrl: { type: 'file' | 'link'; file?: string; url?: string } | null = null;

		if (result.source === 'vault' && result.tfile) {
			const resourceUrl = this.app.vault.getResourcePath(result.tfile);
			newDims = await getImageDimensions(resourceUrl);
			newFileOrUrl = { type: 'file', file: result.tfile.path };
		} else if (result.source === 'file' && result.file) {
			newDims = await getImageDimensions(result.file);
			if (result.storageChoice === 'embed') {
				const buffer = await result.file.arrayBuffer();
				const mimeType = result.file.type || `image/${result.file.name.split('.').pop()?.toLowerCase() || 'png'}`;
				const dataUrl = arrayBufferToBase64DataUrl(buffer, mimeType);
				newFileOrUrl = { type: 'link', url: dataUrl };
			} else {
				const vaultWithConfig = this.app.vault as unknown as { getConfig?: (key: string) => string };
				const attachmentFolder = vaultWithConfig.getConfig?.('attachmentFolderPath') || '';
				const buffer = await result.file.arrayBuffer();
				const vaultPath = await saveFileToVault(this.app, attachmentFolder, result.file.name, buffer);
				newFileOrUrl = { type: 'file', file: vaultPath };
			}
		}

		if (!newFileOrUrl) return;

		// Read canvas JSON
		const content = await this.app.vault.read(canvasFile);
		let data: CanvasFileData;
		try {
			data = JSON.parse(content) as CanvasFileData;
		} catch {
			return;
		}
		if (!data.nodes) return;

		const nodeData = data.nodes.find((n) => n.id === targetId);
		if (!nodeData) return;

		// Preserve position, transforms, and calculate new height based on new image aspect ratio
		const currentWidth = nodeData.width;
		let newHeight = nodeData.height;

		if (newDims && newDims.width > 0 && newDims.height > 0) {
			const aspectRatio = newDims.height / newDims.width;
			newHeight = Math.round(currentWidth * aspectRatio);
			nodeData.originalWidth = newDims.width;
			nodeData.originalHeight = newDims.height;
		}

		nodeData.height = newHeight;

		if (newFileOrUrl.type === 'file' && newFileOrUrl.file) {
			nodeData.type = 'file';
			nodeData.file = newFileOrUrl.file;
			delete nodeData.url;
		} else if (newFileOrUrl.type === 'link' && newFileOrUrl.url) {
			nodeData.type = 'link';
			nodeData.url = newFileOrUrl.url;
			delete nodeData.file;
		}

		// Save patched JSON to vault file
		await this.app.vault.modify(canvasFile, JSON.stringify(data, null, 2));

		// Remove old canvas node from live view in-memory so Obsidian re-renders instantly
		const rawCanvas = canvas as unknown as { removeNode?: (node: unknown) => void };
		if (typeof rawCanvas.removeNode === 'function') {
			try {
				rawCanvas.removeNode(targetNodeObj);
			} catch {
				// Fallback
			}
		}

		// Re-create node live in memory
		if (newFileOrUrl.type === 'file' && newFileOrUrl.file) {
			const tfile = this.app.vault.getAbstractFileByPath(newFileOrUrl.file);
			if (tfile && tfile instanceof TFile && typeof canvas.createFileNode === 'function') {
				canvas.createFileNode({
					file: tfile,
					pos: { x: nodeData.x, y: nodeData.y },
					size: { width: currentWidth, height: newHeight },
					save: false,
				});
			}
		} else if (newFileOrUrl.type === 'link' && newFileOrUrl.url && typeof canvas.createLinkNode === 'function') {
			canvas.createLinkNode({
				url: newFileOrUrl.url,
				pos: { x: nodeData.x, y: nodeData.y },
				size: { width: currentWidth, height: newHeight },
				save: false,
			});
		}

		// Transfer kambas transform properties & tags to newly spawned live node
		const flipH = nodeData.kambasFlipH;
		const flipV = nodeData.kambasFlipV;
		const grayscale = nodeData.kambasGrayscale;
		const palette = nodeData.kambasPalette;
		const opacity = nodeData.kambasOpacity;
		const tags = nodeData.kambasTags;

		const targetPathOrUrl = newFileOrUrl.file || newFileOrUrl.url;
		const newCanvasNode = Array.from(canvas.nodes?.values() || []).find((n) => {
			const rawN = n as unknown as { file?: { path?: string }; url?: string; unknownData?: { file?: string; url?: string } };
			return rawN.file?.path === targetPathOrUrl || rawN.url === targetPathOrUrl || rawN.unknownData?.file === targetPathOrUrl || rawN.unknownData?.url === targetPathOrUrl;
		});

		if (newCanvasNode) {
			const rawN = newCanvasNode as unknown as { unknownData?: { kambasFlipH?: boolean; kambasFlipV?: boolean; kambasGrayscale?: boolean; kambasPalette?: boolean; kambasOpacity?: number; kambasTags?: string[] } };
			if (!rawN.unknownData) rawN.unknownData = {};
			if (flipH) rawN.unknownData.kambasFlipH = flipH;
			if (flipV) rawN.unknownData.kambasFlipV = flipV;
			if (grayscale) rawN.unknownData.kambasGrayscale = grayscale;
			if (palette) rawN.unknownData.kambasPalette = palette;
			if (opacity !== undefined) rawN.unknownData.kambasOpacity = opacity;
			if (Array.isArray(tags) && tags.length > 0) rawN.unknownData.kambasTags = [...tags];
		}

		if (typeof canvas.requestSave === 'function') {
			try { canvas.requestSave(); } catch { /* Handled */ }
		}

		window.setTimeout(() => {
			this.scanAndRestoreTransforms(activeView);
		}, 60);

		new Notice(getText().swapSuccess);
	}
}

