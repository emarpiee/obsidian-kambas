import { App, ItemView, Notice, TFile, TFolder } from 'obsidian';
import { ConvertEmbedChoiceResult, ConvertToEmbedModal, VaultFileAction } from '../modals/ConvertToEmbedModal';
import { ImageIngestionModal, StorageChoice } from '../modals/ImageIngestionModal';
import { ImageSwapModal } from '../modals/ImageSwapModal';
import { getText } from '../i18n';
import {
	arrayBufferToBase64DataUrl,
	blobToBase64,
	extractImagePalette,
	getImageDimensions,
	saveFileToVault,
} from '../utils/imageUtils';
import { CanvasFileData, CanvasItemView, CanvasNodeData, IMAGE_EXTENSIONS } from './CanvasTypes';

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

	private handleScrollOrPan = (): void => {
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

		// Apply CSS class immediately for instant feedback
		const img = this.getNativeImageElement(nodeEl);
		if (img && unknownData) {
			img.classList.toggle('kambas-img-flip-h', Boolean(unknownData.kambasFlipH));
			img.classList.toggle('kambas-img-flip-v', Boolean(unknownData.kambasFlipV));
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
			const unknownData = (canvasNode as unknown as { unknownData?: { type?: string; url?: string; kambasFlipH?: boolean; kambasFlipV?: boolean; kambasGrayscale?: boolean; kambasPalette?: boolean; kambasOpacity?: number } }).unknownData;
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

			const img = this.getNativeImageElement(nodeEl) ?? nodeEl.querySelector<HTMLImageElement>('img');
			if (img && unknownData) {
				img.classList.toggle('kambas-img-flip-h', Boolean(unknownData.kambasFlipH));
				img.classList.toggle('kambas-img-flip-v', Boolean(unknownData.kambasFlipV));
				img.classList.toggle('kambas-img-grayscale', Boolean(unknownData.kambasGrayscale));

				// Handle palette overlay
				let paletteEl = nodeEl.querySelector<HTMLElement>('.kambas-palette-bar');
				if (unknownData.kambasPalette) {
					const count = this.plugin?.settings?.paletteSwatchCount ?? 5;
					if (!paletteEl || paletteEl.dataset.count !== String(count)) {
						if (paletteEl) paletteEl.remove();
						paletteEl = nodeEl.createDiv({ cls: 'kambas-palette-bar' });
						paletteEl.dataset.count = String(count);
						const imgSrc = img.src;
						if (imgSrc) {
							void extractImagePalette(imgSrc, count).then((swatches) => {
								if (!paletteEl || !paletteEl.isConnected) return;
								paletteEl.empty();
								for (const hex of swatches) {
									const swatch = paletteEl.createDiv({ cls: 'kambas-palette-swatch' });
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
			const hasImg = nodeEl.querySelector('.kambas-embedded-img') || this.getNativeImageElement(nodeEl);

			if ((isExplicitlySelected || isTargetNode) && hasImg) {
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

				const img = this.getNativeImageElement(nodeEl) ?? nodeEl.querySelector<HTMLImageElement>('img');
				if (img) {
					img.classList.toggle('kambas-img-flip-h', Boolean(unknownData.kambasFlipH));
					img.classList.toggle('kambas-img-flip-v', Boolean(unknownData.kambasFlipV));
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
					// 1. Preserve position, size & transform data
					const pos = { x: canvasNodeData.x, y: canvasNodeData.y };
					const size = { width: canvasNodeData.width, height: canvasNodeData.height };
					const flipH = canvasNodeData.kambasFlipH;
					const flipV = canvasNodeData.kambasFlipV;
					const grayscale = canvasNodeData.kambasGrayscale;
					const opacity = canvasNodeData.kambasOpacity;

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

					// 4. Find newly created file node and apply preserved transform properties
					const newCanvasNode = Array.from(canvas.nodes?.values() || []).find((n) => {
						const rawN = n as unknown as { file?: TFile | string; unknownData?: { file?: string } };
						return rawN.file === savedFile || rawN.file === savedPath || rawN.unknownData?.file === savedPath;
					});

					if (newCanvasNode) {
						const rawN = newCanvasNode as unknown as { unknownData?: { kambasFlipH?: boolean; kambasFlipV?: boolean; kambasGrayscale?: boolean; kambasOpacity?: number } };
						if (!rawN.unknownData) rawN.unknownData = {};
						if (flipH) rawN.unknownData.kambasFlipH = flipH;
						if (flipV) rawN.unknownData.kambasFlipV = flipV;
						if (grayscale) rawN.unknownData.kambasGrayscale = grayscale;
						if (opacity !== undefined) rawN.unknownData.kambasOpacity = opacity;
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

			// 1. Preserve position, size & transform data
			const pos = { x: canvasNodeData.x, y: canvasNodeData.y };
			const size = { width: canvasNodeData.width, height: canvasNodeData.height };
			const flipH = canvasNodeData.kambasFlipH;
			const flipV = canvasNodeData.kambasFlipV;
			const grayscale = canvasNodeData.kambasGrayscale;
			const opacity = canvasNodeData.kambasOpacity;

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

				// 4. Find newly created link node and apply preserved transform properties
				const newCanvasNode = Array.from(canvas.nodes?.values() || []).find((n) => {
					const rawN = n as unknown as { url?: string; unknownData?: { url?: string } };
					return rawN.url === dataUrl || rawN.unknownData?.url === dataUrl;
				});

				if (newCanvasNode) {
					const rawN = newCanvasNode as unknown as { unknownData?: { kambasFlipH?: boolean; kambasFlipV?: boolean; kambasGrayscale?: boolean; kambasOpacity?: number } };
					if (!rawN.unknownData) rawN.unknownData = {};
					if (flipH) rawN.unknownData.kambasFlipH = flipH;
					if (flipV) rawN.unknownData.kambasFlipV = flipV;
					if (grayscale) rawN.unknownData.kambasGrayscale = grayscale;
					if (opacity !== undefined) rawN.unknownData.kambasOpacity = opacity;
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

		// Transfer kambas transform properties (flip, grayscale, opacity, palette) to newly spawned live node
		const flipH = nodeData.kambasFlipH;
		const flipV = nodeData.kambasFlipV;
		const grayscale = nodeData.kambasGrayscale;
		const palette = nodeData.kambasPalette;
		const opacity = nodeData.kambasOpacity;

		const targetPathOrUrl = newFileOrUrl.file || newFileOrUrl.url;
		const newCanvasNode = Array.from(canvas.nodes?.values() || []).find((n) => {
			const rawN = n as unknown as { file?: { path?: string }; url?: string; unknownData?: { file?: string; url?: string } };
			return rawN.file?.path === targetPathOrUrl || rawN.url === targetPathOrUrl || rawN.unknownData?.file === targetPathOrUrl || rawN.unknownData?.url === targetPathOrUrl;
		});

		if (newCanvasNode) {
			const rawN = newCanvasNode as unknown as { unknownData?: { kambasFlipH?: boolean; kambasFlipV?: boolean; kambasGrayscale?: boolean; kambasPalette?: boolean; kambasOpacity?: number } };
			if (!rawN.unknownData) rawN.unknownData = {};
			if (flipH) rawN.unknownData.kambasFlipH = flipH;
			if (flipV) rawN.unknownData.kambasFlipV = flipV;
			if (grayscale) rawN.unknownData.kambasGrayscale = grayscale;
			if (palette) rawN.unknownData.kambasPalette = palette;
			if (opacity !== undefined) rawN.unknownData.kambasOpacity = opacity;
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

