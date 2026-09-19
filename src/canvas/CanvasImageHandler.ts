import {
	App,
	ItemView,
	Menu,
	Notice,
	SliderComponent,
	TFile,
	TFolder,
	setIcon,
} from 'obsidian';

import { getText } from '../i18n';
import { CanvasGifHandler } from './CanvasGifHandler';
import {
	EMBEDDED_BLOB_MAP,
	RAW_BASE64_REGISTRY,
	getOrigSrcFromImg,
	srcKey,
} from './CanvasImageLOD';
import {
	CanvasFileData,
	CanvasItemView,
	CanvasNodeData,
	IMAGE_EXTENSIONS,
} from './CanvasTypes';

import {
	ConvertEmbedChoiceResult,
	ConvertToEmbedModal,
	VaultFileAction,
} from '../modals/ConvertToEmbedModal';
import { ImageImportProgressModal } from '../modals/ImageImportProgressModal';
import {
	ImageIngestionModal,
	StorageChoice,
} from '../modals/ImageIngestionModal';
import { ImageSwapModal } from '../modals/ImageSwapModal';
import { CanvasMediaLabelModal } from '../modals/CanvasMediaLabelModal';
import {
	MediaFilenameModal,
	MediaFilenameResult,
	NamingStrategyOption,
} from '../modals/MediaFilenameModal';
import { TagColorModal } from '../modals/TagColorModal';
import { TagModal } from '../modals/TagModal';
import { TagRenameModal } from '../modals/TagRenameModal';
import {
	arrayBufferToBase64DataUrl,
	blobToBase64,
	canvasNodePresetColorToName,
	compressAndOptimizeBase64,
	extractImagePalette,
	getImageDimensions,
	getNodeDominantColorName,
	hexToGrayscale,
	saveFileToVault,
} from '../utils/imageUtils';
import {
	NumberFormatStyle,
	formatIncrementalNumber,
} from '../utils/numberFormatters';

export interface PendingImage {
	filename: string;
	mimeType: string;
	file?: File;
	arrayBuffer?: ArrayBuffer;
}

export class CanvasImageHandler {
	private app: App;
	private plugin: import('../main').default;
	public gifHandler: CanvasGifHandler;
	private editGuardObserver: MutationObserver | null = null;
	private modifyTimer: number | null = null;
	private lastMousePos: { x: number; y: number } | null = null;

	// Filter panel state (Tag, Color & Label tabs)
	private activeFilterTab: 'tag' | 'color' | 'label' = 'tag';
	private tagFilterPanelEl: HTMLElement | null = null;
	private activeTagFilters: Set<string> = new Set();
	private activeTagExcludes: Set<string> = new Set();
	private activeColorFilters: Set<string> = new Set();
	private activeColorExcludes: Set<string> = new Set();
	private activeLabelFilters: Set<string> = new Set();
	private activeLabelExcludes: Set<string> = new Set();
	private activeTagFiltersFile: string | null = null;
	private nodeColorCache: Map<string, string[] | null> = new Map();
	private dimOpacity = 0.12;
	private tagToolbarBtn: HTMLElement | null = null;
	private tagToolbarClearBtn: HTMLElement | null = null;
	private tagFilterSelectionGuard: (() => void) | null = null;
	private colorHighlightCleanup: (() => void) | null = null;
	private tagHighlightCleanup: (() => void) | null = null;
	private lazyExtractDebounceTimer: number | null = null;

	constructor(app: App, plugin: import('../main').default) {
		this.app = app;
		this.plugin = plugin;
		this.gifHandler = new CanvasGifHandler(app, plugin);
	}

	public registerEvents(): void {
		this.plugin.registerDomEvent(
			window,
			'mousemove',
			(evt: MouseEvent) => {
				if (evt.clientX !== undefined && evt.clientY !== undefined) {
					this.lastMousePos = { x: evt.clientX, y: evt.clientY };
				}
			},
			true
		);
		this.plugin.registerDomEvent(window, 'paste', this.handlePaste, true);
		this.plugin.registerDomEvent(window, 'drop', this.handleDrop, true);
		this.plugin.registerDomEvent(window, 'keydown', this.handleKeyDown, true);
		this.plugin.registerEvent(
			this.app.vault.on('modify', (file) => {
				const activeView = this.app.workspace.getActiveViewOfType(
					ItemView
				) as unknown as CanvasItemView | null;
				if (
					activeView &&
					activeView.getViewType() === 'canvas' &&
					activeView.file === file
				) {
					this.scanAndRestoreTransforms(activeView);
				}
			})
		);
		this.startEditGuard();
	}

	private blobUrlMap: Map<string, string> = new Map();
	private createdBlobUrls: Set<string> = new Set();

	public getOrCreateBlobUrl(dataUrl: string, key?: string): string {
		if (!dataUrl) return '';
		if (!dataUrl.startsWith('data:image/')) return dataUrl;
		const lookupKey = key || srcKey(dataUrl);
		if (this.blobUrlMap.has(lookupKey)) {
			return this.blobUrlMap.get(lookupKey);
		}
		try {
			const parts = dataUrl.split(',');
			if (parts.length < 2) return dataUrl;
			const mimeMatch = parts[0].match(/:(.*?);/);
			const mime = mimeMatch ? mimeMatch[1] : 'image/png';
			const bstr = atob(parts[1]);
			let n = bstr.length;
			const u8arr = new Uint8Array(n);
			while (n--) {
				u8arr[n] = bstr.charCodeAt(n);
			}
			const blob = new Blob([u8arr], { type: mime });
			const blobUrl = URL.createObjectURL(blob);
			this.blobUrlMap.set(lookupKey, blobUrl);
			this.createdBlobUrls.add(blobUrl);
			EMBEDDED_BLOB_MAP.set(blobUrl, lookupKey);
			return blobUrl;
		} catch (err) {
			console.error('Error creating Blob URL from Base64:', err);
			return dataUrl;
		}
	}

	public cleanupCanvasResources(): void {
		for (const blobUrl of Array.from(this.createdBlobUrls)) {
			try {
				URL.revokeObjectURL(blobUrl);
			} catch {
				// ignore
			}
		}
		this.blobUrlMap.clear();
		this.createdBlobUrls.clear();
		this.nodeColorCache.clear();
		if (this.gifHandler) {
			this.gifHandler.cleanupCanvasResources();
		}
	}

	public unregisterEvents(): void {
		if (this.editGuardObserver) {
			this.editGuardObserver.disconnect();
			this.editGuardObserver = null;
		}
		this.cleanupCanvasResources();
	}

	// ──────────────────────────────────────────────────────────────────────────
	// MutationObserver: automatic mounting for link-type image nodes
	// ──────────────────────────────────────────────────────────────────────────

	private rescanTimeoutId: number | null = null;

	private scheduleRescan(activeView: CanvasItemView, delay = 16): void {
		if (this.rescanTimeoutId !== null) return;
		this.rescanTimeoutId = window.setTimeout(() => {
			this.rescanTimeoutId = null;
			this.scanAndRestoreTransforms(activeView);
		}, delay);
	}

	private startEditGuard(): void {
		this.editGuardObserver = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				const targetEl = (
					mutation.target.nodeType === Node.ELEMENT_NODE
						? mutation.target
						: mutation.target.parentElement
				) as HTMLElement | null;

				if (!targetEl?.closest?.('.canvas-wrapper, .canvas')) continue;

				if (
					targetEl?.closest?.('.kambas-tag-panel') ||
					targetEl?.closest?.('.kambas-gif-toolbar') ||
					targetEl?.closest?.('.kambas-gif-canvas-overlay') ||
					targetEl?.closest?.('.kambas-tag-bar') ||
					targetEl?.closest?.('.kambas-palette-bar') ||
					targetEl?.classList?.contains('kambas-embedded-img')
				) {
					continue;
				}

				if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
					for (let i = 0; i < mutation.addedNodes.length; i++) {
						const added = mutation.addedNodes[i];
						const el = (
							added.nodeType === Node.ELEMENT_NODE ? added : added.parentElement
						) as HTMLElement | null;
						if (!el) continue;
						if (
							el.closest?.('.kambas-tag-panel') ||
							el.classList?.contains('kambas-tag-panel') ||
							el.closest?.('.kambas-gif-toolbar') ||
							el.classList?.contains('kambas-gif-toolbar') ||
							el.closest?.('.kambas-gif-canvas-overlay') ||
							el.closest?.('.kambas-tag-bar') ||
							el.closest?.('.kambas-palette-bar') ||
							el.classList?.contains('kambas-embedded-img')
						)
							continue;
						if (
							el.tagName === 'IMG' ||
							el.classList?.contains('canvas-node') ||
							el.classList?.contains('canvas-node-content') ||
							el.closest?.('.canvas-node')
						) {
							const canvasView = this.getActiveCanvasView();
							if (canvasView) {
								this.scheduleRescan(canvasView);
							}
							break;
						}
					}
				} else if (
					mutation.type === 'attributes' &&
					mutation.attributeName === 'class'
				) {
					const target = mutation.target as HTMLElement;
					if (
						target?.classList?.contains('canvas-node') &&
						!target.classList.contains('kambas-has-embedded-img') &&
						!target.classList.contains('kambas-node-grayscale') &&
						!target.classList.contains('kambas-img-flip-h') &&
						!target.classList.contains('kambas-img-flip-v')
					) {
						const canvasView = this.getActiveCanvasView();
						if (canvasView) {
							this.scheduleRescan(canvasView);
						}
					}
				}
			}
		});

		this.editGuardObserver.observe(document.body, {
			subtree: true,
			childList: true,
			attributes: true,
			attributeFilter: ['class'],
		});

		this.plugin.registerDomEvent(
			window,
			'scroll',
			this.handleScrollOrPan,
			true
		);
		this.plugin.registerDomEvent(window, 'wheel', this.handleScrollOrPan, true);

		// Listen to keyup (Ctrl+V) and mouseup (Alt+Drag duplication) to refresh canvas link nodes
		this.plugin.registerDomEvent(window, 'keyup', this.handleKeyUpCheck, true);
		this.plugin.registerDomEvent(
			window,
			'mouseup',
			this.handleMouseUpCheck,
			true
		);
	}

	private getActiveCanvasView(evt?: Event): CanvasItemView | null {
		if (evt) {
			const viewFromEvt = this.getCanvasViewForEvent(evt);
			if (viewFromEvt) return viewFromEvt;
		}
		const activeLeaf = this.app.workspace.getActiveViewOfType(ItemView);
		if (activeLeaf && activeLeaf.getViewType() === 'canvas') {
			return activeLeaf;
		}
		let foundCanvas: CanvasItemView | null = null;
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (foundCanvas) return;
			if (leaf.view?.getViewType() === 'canvas') {
				foundCanvas = leaf.view;
			}
		});
		return foundCanvas;
	}

	private getCanvasViewForEvent(evt: Event): CanvasItemView | null {
		const target = evt.target as HTMLElement | null;
		const doc = target?.ownerDocument ?? document;
		const activeLeaf = this.app.workspace.getActiveViewOfType(ItemView);
		if (
			activeLeaf &&
			activeLeaf.getViewType() === 'canvas' &&
			activeLeaf.containerEl.ownerDocument === doc
		) {
			return activeLeaf;
		}
		let foundView: CanvasItemView | null = null;
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (foundView) return;
			if (
				leaf.view?.getViewType() === 'canvas' &&
				leaf.view.containerEl.ownerDocument === doc
			) {
				foundView = leaf.view;
			}
		});
		return (
			foundView ?? (activeLeaf?.getViewType() === 'canvas' ? activeLeaf : null)
		);
	}

	public updateZoomScale(activeView: CanvasItemView): void {
		const canvas = activeView.canvas;
		if (!canvas) return;
		const zoom =
			typeof canvas.zoom === 'number' && canvas.zoom > 0 ? canvas.zoom : 1;
		const counterScale = (1 / zoom).toFixed(4);
		activeView.containerEl?.style.setProperty(
			'--kambas-zoom-scale',
			counterScale
		);
		this.gifHandler.updateZoomScale(zoom);
	}

	private positionRafId: number | null = null;
	private positionUpdateUntil: number = 0;

	private triggerSmoothPositionUpdates(activeView: CanvasItemView): void {
		this.positionUpdateUntil = performance.now() + 350;
		if (this.positionRafId !== null) return;

		const loop = (): void => {
			this.gifHandler.updatePositions(activeView.containerEl);
			if (performance.now() < this.positionUpdateUntil) {
				this.positionRafId = window.requestAnimationFrame(loop);
			} else {
				this.positionRafId = null;
			}
		};
		this.positionRafId = window.requestAnimationFrame(loop);
	}

	private scrollPanRafId: number | null = null;
	private handleScrollOrPan = (evt: Event): void => {
		const target = evt.target as HTMLElement | null;
		if (target?.closest?.('.kambas-tag-panel')) return;
		if (this.scrollPanRafId !== null) return;
		this.scrollPanRafId = window.requestAnimationFrame(() => {
			this.scrollPanRafId = null;
			const activeView = this.getCanvasViewForEvent(evt);
			if (activeView?.getViewType() === 'canvas') {
				this.updateZoomScale(activeView);
				this.triggerSmoothPositionUpdates(activeView);
				this.scheduleRescan(activeView);
			}
		});
	};

	private handleKeyUpCheck = (evt: KeyboardEvent): void => {
		if (
			evt.key === 'v' ||
			evt.key === 'V' ||
			evt.key === 'z' ||
			evt.key === 'Z' ||
			evt.key === 'y' ||
			evt.key === 'Y'
		) {
			const activeView = this.getCanvasViewForEvent(evt);
			if (activeView?.getViewType() === 'canvas') {
				this.scheduleRescan(activeView);
			}
		}
	};

	private handleMouseUpCheck = (evt: MouseEvent): void => {
		const activeView = this.getCanvasViewForEvent(evt);
		if (activeView?.getViewType() === 'canvas') {
			this.scheduleRescan(activeView);
		}
	};

	// ──────────────────────────────────────────────────────────────────────────
	// Event handlers
	// ──────────────────────────────────────────────────────────────────────────

	/** Returns the native (non-kambas) image element inside a canvas node, if any. */
	public getNativeImageElement(nodeEl: Element): HTMLImageElement | null {
		// Look for any img that is not our embedded image and not inside a markdown render
		const imgs = nodeEl.querySelectorAll<HTMLImageElement>(
			'img:not(.kambas-embedded-img)'
		);
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
			if (
				node.nodeEl &&
				(node.nodeEl === nodeEl ||
					nodeEl.contains(node.nodeEl) ||
					node.nodeEl.contains(nodeEl))
			) {
				canvasNodeObj = node;
				nodeId = id;
			}
		});
		if (!nodeId || !canvasNodeObj) return;

		const unknownData = (
			canvasNodeObj as {
				unknownData?: {
					kambasFlipH?: boolean;
					kambasFlipV?: boolean;
					kambasGrayscale?: boolean;
				};
			}
		).unknownData;
		if (unknownData) {
			if (key === 'h') unknownData.kambasFlipH = !unknownData.kambasFlipH;
			if (key === 'v') unknownData.kambasFlipV = !unknownData.kambasFlipV;
			if (key === 'g')
				unknownData.kambasGrayscale = !unknownData.kambasGrayscale;
		}

		// Apply CSS class immediately for instant feedback.
		// Flip is set on nodeEl (CSS targets img inside it) so it works even when <img> isn't mounted.
		if (unknownData) {
			nodeEl.classList.toggle(
				'kambas-img-flip-h',
				Boolean(unknownData.kambasFlipH)
			);
			nodeEl.classList.toggle(
				'kambas-img-flip-v',
				Boolean(unknownData.kambasFlipV)
			);
		}
		const img = this.getNativeImageElement(nodeEl);
		if (img && unknownData) {
			img.classList.toggle(
				'kambas-img-grayscale',
				Boolean(unknownData.kambasGrayscale)
			);
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
		this.updateZoomScale(activeView);

		const rawCanvasData = (
			activeView.canvas as unknown as {
				data?: { nodes?: Array<{ id?: string; label?: string; file?: string; url?: string }> };
			}
		)?.data;
		const dataNodesMap = new Map<string, { id?: string; label?: string; file?: string; url?: string }>();
		if (rawCanvasData?.nodes) {
			for (const n of rawCanvasData.nodes) {
				if (n.id) dataNodesMap.set(n.id, n);
			}
		}

		canvas.nodes.forEach((canvasNode) => {
			const nodeEl = canvasNode.nodeEl;
			if (!nodeEl) return;

			// Extract link URL or data directly from canvas node object memory (0ms delay)
			const rawNodeObj = canvasNode as unknown as {
				url?: string;
				type?: string;
				label?: string;
				unknownData?: {
					type?: string;
					url?: string;
					label?: string;
					kambasFlipH?: boolean;
					kambasFlipV?: boolean;
					kambasGrayscale?: boolean;
					kambasPalette?: boolean;
					kambasOpacity?: number;
					kambasTags?: string[];
				};
			};
			if (!rawNodeObj.unknownData) rawNodeObj.unknownData = {};
			const unknownData = rawNodeObj.unknownData;
			const nodeUrl = rawNodeObj.url || unknownData.url;
			const isLinkDataImg = Boolean(
				nodeUrl && nodeUrl.startsWith('data:image/')
			);

			if (isLinkDataImg && nodeUrl) {
				unknownData.type = 'link';
				unknownData.url = nodeUrl;

				const container = nodeEl.querySelector('.canvas-node-content');
				if (!container) {
					this.scheduleRescan(activeView, 16);
					return;
				}
				let existingImg = container.querySelector<HTMLImageElement>(
					'img.kambas-embedded-img'
				);
				const key = srcKey(nodeUrl);
				RAW_BASE64_REGISTRY.set(key, nodeUrl);
				const displayUrl = this.getOrCreateBlobUrl(nodeUrl, key);
				if (!existingImg) {
					const existingCanvas = container.querySelector<HTMLCanvasElement>(
						'canvas.kambas-gif-canvas-overlay'
					);
					Array.from(container.children).forEach((child) => {
						if (child !== existingCanvas) child.remove();
					});
					existingImg = container.createEl('img', {
						cls: 'kambas-embedded-img',
						attr: {
							src: displayUrl,
							'data-cil-key': key,
							draggable: 'false',
							style: `${existingCanvas ? 'display:none;' : ''}position:absolute;top:0;left:0;right:0;bottom:0;width:100%;height:100%;object-fit:contain;margin:0;padding:0;border:none;pointer-events:none;user-select:none;-webkit-user-drag:none;`,
						},
					});
				} else {
					existingImg.dataset.cilKey = key;
					if (!existingImg.dataset.cilTier && existingImg.src !== displayUrl) {
						existingImg.src = displayUrl;
					}
				}

				// Lock parent node aspect ratio to natural image dimensions
				const rawNode = canvasNode as unknown as {
					aspectRatio?: number;
					isAspectPreserved?: boolean;
					width?: number;
					height?: number;
				};
				if (
					existingImg.complete &&
					existingImg.naturalWidth &&
					existingImg.naturalHeight
				) {
					rawNode.aspectRatio =
						existingImg.naturalWidth / existingImg.naturalHeight;
					rawNode.isAspectPreserved = true;
				} else {
					existingImg.addEventListener(
						'load',
						() => {
							if (existingImg?.naturalWidth && existingImg?.naturalHeight) {
								rawNode.aspectRatio =
									existingImg.naturalWidth / existingImg.naturalHeight;
								rawNode.isAspectPreserved = true;
							}
						},
						{ once: true }
					);
				}
			}

			const container = nodeEl.querySelector('.canvas-node-content') ?? nodeEl;
			const nodeContainer =
				nodeEl.querySelector('.canvas-node-container') ?? nodeEl;
			const hasEmbeddedImg = Boolean(
				isLinkDataImg ||
				container.querySelector('img.kambas-embedded-img') ||
				nodeEl.querySelector('img.kambas-embedded-img')
			);
			nodeEl.classList.toggle('kambas-has-embedded-img', hasEmbeddedImg);
			nodeContainer.classList.toggle('kambas-has-embedded-img', hasEmbeddedImg);
			container.classList.toggle('kambas-has-embedded-img', hasEmbeddedImg);

			// Restore node label header state
			const nodeId = (canvasNode as unknown as { id?: string }).id;
			const canvasDataNode = nodeId ? dataNodesMap.get(nodeId) : undefined;
			const explicitLabel = (
				canvasDataNode?.label ||
				rawNodeObj.label ||
				unknownData.label ||
				''
			).trim();

			if (explicitLabel) {
				rawNodeObj.label = explicitLabel;
				if (!rawNodeObj.unknownData) rawNodeObj.unknownData = {};
				rawNodeObj.unknownData.label = explicitLabel;
			}

			const displayLabel = this.getNodeLabel(rawNodeObj, canvasDataNode);

			nodeEl.classList.toggle('kambas-has-label', Boolean(displayLabel));
			let labelEl = nodeEl.querySelector('.canvas-node-label');
			if (displayLabel) {
				if (!labelEl) {
					labelEl = nodeContainer.createDiv({ cls: 'canvas-node-label' });
				}
				if (labelEl.textContent !== displayLabel) {
					labelEl.textContent = displayLabel;
				}
			} else if (labelEl) {
				labelEl.remove();
			}

			// Apply stored transforms & opacity
			if (unknownData) {
				nodeEl.classList.toggle(
					'kambas-node-grayscale',
					Boolean(unknownData.kambasGrayscale)
				);
			}

			// Flip is set on nodeEl; CSS descendant selector targets img inside it.
			if (unknownData) {
				nodeEl.classList.toggle(
					'kambas-img-flip-h',
					Boolean(unknownData.kambasFlipH)
				);
				nodeEl.classList.toggle(
					'kambas-img-flip-v',
					Boolean(unknownData.kambasFlipV)
				);
			}
			const img =
				this.getNativeImageElement(nodeEl) ??
				nodeEl.querySelector<HTMLImageElement>('img');
			if (img && unknownData) {
				img.classList.toggle(
					'kambas-img-grayscale',
					Boolean(unknownData.kambasGrayscale)
				);

				// Handle palette overlay
				let paletteEl = nodeEl.querySelector<HTMLElement>(
					'.kambas-palette-bar'
				);
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

								const getCopiedHex = (rawHex: string): string =>
									unknownData.kambasGrayscale ? hexToGrayscale(rawHex) : rawHex;

								for (const hex of swatches) {
									const swatch = targetPaletteEl.createDiv({
										cls: 'kambas-palette-swatch',
									});
									swatch.style.backgroundColor = hex;
									swatch.setAttribute('aria-label', `${hex} (Click to copy)`);
									swatch.addEventListener('click', (e) => {
										e.stopPropagation();
										e.preventDefault();
										const effectiveHex = getCopiedHex(hex);
										void navigator.clipboard.writeText(effectiveHex);
										const t = getText();
										new Notice(
											t.copyHexNotice
												? t.copyHexNotice(effectiveHex)
												: `Copied ${effectiveHex} to clipboard!`
										);
									});
								}

								// Append copy button at the bottom to copy all palette hex values
								if (swatches.length > 0) {
									const t = getText();
									const copyBtn = targetPaletteEl.createDiv({
										cls: 'kambas-palette-copy-btn',
										attr: {
											'aria-label':
												t.copyAllColorsTooltip ?? 'Copy all palette colors',
										},
									});
									setIcon(copyBtn, 'copy');
									copyBtn.addEventListener('click', (e) => {
										e.stopPropagation();
										e.preventDefault();
										const sep =
											this.plugin?.settings?.paletteCopySeparator ?? ', ';
										const textToCopy = swatches
											.map((h) => getCopiedHex(h))
											.join(sep);
										void navigator.clipboard.writeText(textToCopy);
										const currentT = getText();
										new Notice(
											currentT.copyAllColorsNotice
												? currentT.copyAllColorsNotice(swatches.length)
												: `Copied ${swatches.length} colors to clipboard!`
										);
									});
								}
							});
						};

						if (img.complete && img.naturalWidth > 0 && img.src) {
							loadAndRenderPalette(img.src);
						} else {
							// Image is still loading in browser — extract once image finishes loading
							img.addEventListener(
								'load',
								() => {
									if (img.src) loadAndRenderPalette(img.src);
								},
								{ once: true }
							);
						}
					}
					paletteEl.classList.toggle(
						'kambas-palette-grayscale',
						Boolean(unknownData.kambasGrayscale)
					);
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

		// GIF Controls: sync sessions and single/multi toolbar
		if (this.plugin?.settings?.enableGifTools !== false) {
			const selectedGifNodeIds: string[] = [];

			canvas.nodes.forEach((canvasNode) => {
				const nodeEl = canvasNode.nodeEl;
				if (!nodeEl) return;

				const targetImg =
					this.getNativeImageElement(nodeEl) ??
					nodeEl.querySelector<HTMLImageElement>('img');

				const rawNodeObj = canvasNode as unknown as {
					unknownData?: { kambasGifPaused?: boolean; kambasGifFrame?: number };
				};
				const unknownData = rawNodeObj.unknownData;

				const rawFile = (
					canvasNode as unknown as { file?: TFile | string; url?: string }
				).file;
				const rawUrl = (
					canvasNode as unknown as { file?: TFile | string; url?: string }
				).url;

				const filePath =
					typeof rawFile === 'string' ? rawFile : (rawFile?.path ?? '');
				const fileExt =
					typeof rawFile === 'object' && rawFile?.extension
						? rawFile.extension.toLowerCase()
						: (filePath.split('.').pop()?.toLowerCase() ?? '');

				const origSrc = targetImg
					? getOrigSrcFromImg(targetImg)
					: (rawUrl ?? '');
				const imgSrc = targetImg?.src ?? rawUrl ?? '';
				const isGif =
					fileExt === 'gif' ||
					origSrc.toLowerCase().includes('.gif') ||
					origSrc.startsWith('data:image/gif') ||
					imgSrc.toLowerCase().includes('.gif') ||
					imgSrc.startsWith('data:image/gif') ||
					(targetImg && targetImg.dataset.kambasIsGif === 'true');

				if (isGif && targetImg) {
					targetImg.dataset.kambasIsGif = 'true';
				}

				const nodeId = (canvasNode as unknown as { id?: string }).id;
				const canvasObj = canvas as unknown as { selection?: Set<unknown> };
				const hasSelectionObject = Boolean(canvasObj.selection);
				const isNodeInSelection = Boolean(
					canvasObj.selection && canvasObj.selection.has(canvasNode)
				);
				const isSelected = hasSelectionObject
					? isNodeInSelection
					: nodeEl.classList.contains('is-selected') ||
						nodeEl.classList.contains('is-focused');

				if (isGif && nodeId && targetImg) {
					// Synchronously suppress native <img> immediately to prevent native playback flicker during DOM re-renders!
					targetImg.setCssProps({ display: 'none' });

					let fileObj: TFile | undefined;
					if (rawFile instanceof TFile) {
						fileObj = rawFile;
					} else if (filePath) {
						const abstractFile = this.app.vault.getAbstractFileByPath(filePath);
						if (abstractFile instanceof TFile) {
							fileObj = abstractFile;
						}
					}
					void this.gifHandler.attachGifTools(
						nodeId,
						nodeEl,
						targetImg,
						fileObj,
						canvas,
						unknownData,
						activeView.containerEl
					);
					if (isSelected) {
						selectedGifNodeIds.push(nodeId);
					}
				}
			});

			this.gifHandler.syncToolbar(
				canvas,
				activeView.containerEl,
				selectedGifNodeIds
			);
		} else {
			this.gifHandler.detachAll();
			canvas.nodes.forEach((canvasNode) => {
				const nodeEl = canvasNode.nodeEl;
				if (!nodeEl) return;
				const targetImg =
					this.getNativeImageElement(nodeEl) ??
					nodeEl.querySelector<HTMLImageElement>('img');
				if (targetImg) {
					targetImg.setCssProps({ display: '' });
				}
			});
		}

		// Apply individual edge stored opacity
		if (canvas.edges) {
			canvas.edges.forEach((edge) => {
				const uData = edge.unknownData;
				const op = uData?.kambasOpacity;
				if (op !== undefined) {
					if (edge.lineGroupEl)
						edge.lineGroupEl.setCssProps({ opacity: String(op) });
					else if (edge.lineElement)
						edge.lineElement.setCssProps({ opacity: String(op) });
					if (edge.lineEndGroupEl)
						edge.lineEndGroupEl.setCssProps({ opacity: String(op) });
				}
			});
		}

		// Check if canvas wrapper/edges should be restored or hidden
		const canvasEl =
			(activeView.canvas as unknown as { wrapperEl?: HTMLElement })
				?.wrapperEl ?? activeView.containerEl.querySelector('.canvas-wrapper');
		if (canvasEl) {
			const edgesEl = canvasEl.querySelector<HTMLElement>('.canvas-edges');
			if (edgesEl) {
				// If all nodes are at opacity 0, keep edges hidden
				let allNodesZero = canvas.nodes.size > 0;
				canvas.nodes.forEach((node) => {
					const uData = (
						node as unknown as { unknownData?: { kambasOpacity?: number } }
					).unknownData;
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
				this.activeTagExcludes.clear();
				this.activeColorFilters.clear();
				this.activeColorExcludes.clear();
				this.activeLabelFilters.clear();
				this.activeLabelExcludes.clear();
				this.nodeColorCache.clear();
				this.activeTagFiltersFile = filterFile.path;
				this.restoreFilterState(filterFile, activeView);

				// Auto-extract colors if enabled
				if ((this.plugin.settings.colorExtractMode ?? 'auto') === 'auto') {
					void this.extractAllNodeColors(activeView);
				}
			} else if (
				this.activeTagFilters.size > 0 ||
				this.activeTagExcludes.size > 0 ||
				this.activeColorFilters.size > 0 ||
				this.activeColorExcludes.size > 0 ||
				this.activeLabelFilters.size > 0 ||
				this.activeLabelExcludes.size > 0
			) {
				// Same file, active filters — re-apply (e.g. after badge re-render)
				this.applyTagFilters(activeView);
			} else {
				// Same file, NO active filters — ensure all nodes are visible and interactive!
				canvas.nodes.forEach((node) =>
					node.nodeEl?.classList.remove('kambas-tag-hidden')
				);
				this.removeSelectionGuard();
			}
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
			const uData = (
				node as unknown as { unknownData?: { kambasOpacity?: number } }
			).unknownData;
			if (uData?.kambasOpacity !== 0) {
				currentlyAway = false;
			}
		});

		// Toggle target opacity: if currently away, restore to 1; otherwise set to 0
		const targetOpacity = currentlyAway ? 1 : 0;
		const selectedNodeIds: string[] = [];

		canvas.nodes.forEach((canvasNode, id) => {
			selectedNodeIds.push(id);
			const rawNode = canvasNode as unknown as {
				unknownData?: { kambasOpacity?: number };
			};
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
					canvasEdge.lineGroupEl.setCssProps({
						opacity: String(targetOpacity),
					});
				} else if (canvasEdge.lineElement) {
					canvasEdge.lineElement.setCssProps({
						opacity: String(targetOpacity),
					});
				}
				if (canvasEdge.lineEndGroupEl) {
					canvasEdge.lineEndGroupEl.setCssProps({
						opacity: String(targetOpacity),
					});
				}
			});
		}

		const canvasEl =
			(activeView.canvas as unknown as { wrapperEl?: HTMLElement })
				?.wrapperEl ?? activeView.containerEl.querySelector('.canvas-wrapper');
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

		// Toggle native Obsidian Canvas read-only mode alongside Away Mode
		const isAway = targetOpacity === 0;
		type NativeCanvasEx = {
			readonly?: boolean;
			isReadOnly?: boolean;
			readOnly?: boolean;
			setReadOnly?: (ro: boolean) => void;
			setReadonly?: (ro: boolean) => void;
		};
		const cx = canvas as unknown as NativeCanvasEx;
		if (typeof cx.setReadOnly === 'function') {
			try {
				cx.setReadOnly(isAway);
			} catch {
				/* ignore */
			}
		}
		if (typeof cx.setReadonly === 'function') {
			try {
				cx.setReadonly(isAway);
			} catch {
				/* ignore */
			}
		}
		cx.readonly = isAway;
		cx.isReadOnly = isAway;
		cx.readOnly = isAway;

		const vx = activeView as unknown as NativeCanvasEx;
		if (typeof vx.setReadOnly === 'function') {
			try {
				vx.setReadOnly(isAway);
			} catch {
				/* ignore */
			}
		}
		vx.readonly = isAway;
		vx.isReadOnly = isAway;
		vx.readOnly = isAway;

		if (canvasEl) {
			canvasEl.classList.toggle('is-readonly', isAway);
			canvasEl.classList.toggle('is-read-only', isAway);
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

			const isTargetNode =
				targetNodeEl &&
				(nodeEl === targetNodeEl || nodeEl.contains(targetNodeEl));
			const isExplicitlySelected = nodeEl.classList.contains('is-selected');

			if (isExplicitlySelected || isTargetNode) {
				selectedNodeIds.push(id);

				const rawNode = canvasNode as unknown as {
					unknownData?: { kambasOpacity?: number };
				};
				if (!rawNode.unknownData) rawNode.unknownData = {};
				rawNode.unknownData.kambasOpacity = opacity;

				nodeEl.setCssProps({ opacity: String(opacity) });
			}
		});

		// Check if any edge needs opacity restored
		const canvasEl =
			(activeView.canvas as unknown as { wrapperEl?: HTMLElement })
				?.wrapperEl ?? activeView.containerEl.querySelector('.canvas-wrapper');
		if (canvasEl) {
			const edgesEl = canvasEl.querySelector<HTMLElement>('.canvas-edges');
			if (edgesEl) {
				let allNodesZero = canvas.nodes.size > 0;
				canvas.nodes.forEach((node) => {
					const uData = (
						node as unknown as { unknownData?: { kambasOpacity?: number } }
					).unknownData;
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
			const edgeObj = targetEdgeObj as {
				id?: string;
				unknownData?: { kambasOpacity?: number };
				lineGroupEl?: HTMLElement;
				lineElement?: HTMLElement;
				lineEndGroupEl?: HTMLElement;
			};
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
				const isTargetEdge =
					(targetEdgeEl &&
						edgeContainer &&
						(edgeContainer === targetEdgeEl ||
							edgeContainer.contains(targetEdgeEl) ||
							targetEdgeEl.contains(edgeContainer))) ||
					(targetEdgeObj && canvasEdge === targetEdgeObj);
				const isExplicitlySelected =
					edgeContainer?.classList.contains('is-selected');

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
			const edgeGroup =
				(targetEdgeEl as HTMLElement).closest('.canvas-edge') ?? targetEdgeEl;
			(edgeGroup as HTMLElement).setCssProps?.({ opacity: String(opacity) });
		}

		if (typeof canvas.requestSave === 'function') {
			try {
				canvas.requestSave();
			} catch {
				if (selectedEdgeIds.length > 0)
					void this.persistEdgeOpacity(file, selectedEdgeIds, opacity);
			}
		} else {
			if (selectedEdgeIds.length > 0)
				void this.persistEdgeOpacity(file, selectedEdgeIds, opacity);
		}
	}

	private async persistEdgeOpacity(
		file: TFile,
		selectedEdgeIds: string[],
		opacity: number
	): Promise<void> {
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

	private async persistOpacity(
		file: TFile,
		selectedNodeIds: string[],
		opacity: number
	): Promise<void> {
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
		if (this.plugin.app.workspace.activeEditor) return;
		const target = evt.target as HTMLElement | null;
		if (target) {
			const tag = target.tagName.toLowerCase();
			if (
				tag === 'input' ||
				tag === 'textarea' ||
				target.isContentEditable ||
				target.closest('.cm-editor')
			)
				return;
		}

		const activeView = this.app.workspace.getActiveViewOfType(
			ItemView
		) as unknown as CanvasItemView | null;
		if (!activeView || activeView.getViewType() !== 'canvas') return;

		const lowerKey = evt.key.toLowerCase();
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

		const canvasObj = canvas as unknown as { selection?: Set<unknown> };
		const hasSelectionObject = Boolean(canvasObj.selection);

		canvas.nodes.forEach((node, id) => {
			const nodeEl = node.nodeEl;
			if (!nodeEl) return;

			const isTargetNode =
				targetNodeEl &&
				(nodeEl === targetNodeEl || nodeEl.contains(targetNodeEl));
			const isNodeInSelection = Boolean(
				canvasObj.selection && canvasObj.selection.has(node)
			);
			const isExplicitlySelected = hasSelectionObject
				? isNodeInSelection
				: nodeEl.classList.contains('is-selected') ||
					nodeEl.classList.contains('is-focused');

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
			const isVaultImg =
				rawNodeObj.file instanceof TFile &&
				IMAGE_EXTENSIONS.has((rawNodeObj.file.extension ?? '').toLowerCase());
			const isDataImg = Boolean(
				rawNodeObj.unknownData?.url?.startsWith('data:image/')
			);
			// Also fall back to DOM check for any node already rendered (e.g. kambas-embedded-img)
			const hasDomImg =
				!isVaultImg &&
				!isDataImg &&
				Boolean(
					nodeEl.querySelector('.kambas-embedded-img') ||
					this.getNativeImageElement(nodeEl)
				);

			if (isVaultImg || isDataImg || hasDomImg) {
				selectedNodeEls.push(nodeEl);
				selectedNodeIds.push(id);
			}
		});

		// If nothing explicitly selected, fall back to target node
		if (selectedNodeIds.length === 0 && targetNodeEl) {
			canvas.nodes.forEach((node, id) => {
				const nodeEl = node.nodeEl;
				if (
					nodeEl &&
					(nodeEl === targetNodeEl || nodeEl.contains(targetNodeEl))
				) {
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
			const uData = (
				canvasNode as unknown as {
					unknownData?: {
						kambasFlipH?: boolean;
						kambasFlipV?: boolean;
						kambasGrayscale?: boolean;
					};
				}
			).unknownData;
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

			const rawNode = canvasNode as unknown as {
				unknownData?: {
					kambasFlipH?: boolean;
					kambasFlipV?: boolean;
					kambasGrayscale?: boolean;
					kambasPalette?: boolean;
				};
			};
			if (!rawNode.unknownData) {
				rawNode.unknownData = {};
			}
			const unknownData = rawNode.unknownData;

			if (key === 'h') unknownData.kambasFlipH = targetValue;
			if (key === 'v') unknownData.kambasFlipV = targetValue;
			if (key === 'g') unknownData.kambasGrayscale = targetValue;

			const nodeEl = canvasNode.nodeEl;
			if (nodeEl) {
				nodeEl.classList.toggle(
					'kambas-node-grayscale',
					Boolean(unknownData.kambasGrayscale)
				);
				// Flip on nodeEl; CSS descendant selector targets img inside it.
				nodeEl.classList.toggle(
					'kambas-img-flip-h',
					Boolean(unknownData.kambasFlipH)
				);
				nodeEl.classList.toggle(
					'kambas-img-flip-v',
					Boolean(unknownData.kambasFlipV)
				);

				const img =
					this.getNativeImageElement(nodeEl) ??
					nodeEl.querySelector<HTMLImageElement>('img');
				if (img) {
					img.classList.toggle(
						'kambas-img-grayscale',
						Boolean(unknownData.kambasGrayscale)
					);
				}
				const paletteEl = nodeEl.querySelector<HTMLElement>(
					'.kambas-palette-bar'
				);
				if (paletteEl) {
					paletteEl.classList.toggle(
						'kambas-palette-grayscale',
						Boolean(unknownData.kambasGrayscale)
					);
				}
			}
		});

		// 2. Request native canvas save so undo/redo history stack records the transform state change
		if (typeof canvas.requestSave === 'function') {
			try {
				canvas.requestSave();
			} catch {
				void this.persistImageTransform(
					file,
					selectedNodeIds,
					key,
					targetValue
				);
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

			const isTargetNode =
				targetNodeEl &&
				(nodeEl === targetNodeEl || nodeEl.contains(targetNodeEl));
			const isExplicitlySelected = nodeEl.classList.contains('is-selected');
			const hasImg =
				nodeEl.querySelector('.kambas-embedded-img') ||
				this.getNativeImageElement(nodeEl);

			if ((isExplicitlySelected || isTargetNode) && hasImg) {
				selectedNodeEls.push(nodeEl);
				selectedNodeIds.push(id);
			}
		});

		if (selectedNodeIds.length === 0 && targetNodeEl) {
			canvas.nodes.forEach((node, id) => {
				const nodeEl = node.nodeEl;
				if (
					nodeEl &&
					(nodeEl === targetNodeEl || nodeEl.contains(targetNodeEl))
				) {
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
			const uData = (
				canvasNode as unknown as { unknownData?: { kambasPalette?: boolean } }
			).unknownData;
			if (!uData?.kambasPalette) {
				targetValue = true;
				break;
			}
		}

		canvas.nodes.forEach((canvasNode, id) => {
			if (!selectedNodeIds.includes(id)) return;
			const rawNode = canvasNode as unknown as {
				unknownData?: { kambasPalette?: boolean };
			};
			if (!rawNode.unknownData) rawNode.unknownData = {};
			rawNode.unknownData.kambasPalette = targetValue;
		});

		this.scanAndRestoreTransforms(activeView);

		const file = activeView.file;
		if (typeof canvas.requestSave === 'function') {
			try {
				canvas.requestSave();
			} catch {
				if (file)
					void this.persistImageTransform(
						file,
						selectedNodeIds,
						'palette',
						targetValue
					);
			}
		} else {
			if (file)
				void this.persistImageTransform(
					file,
					selectedNodeIds,
					'palette',
					targetValue
				);
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

			const isTargetNode =
				targetNodeEl &&
				(nodeEl === targetNodeEl || nodeEl.contains(targetNodeEl));
			const isExplicitlySelected = nodeEl.classList.contains('is-selected');

			if (isExplicitlySelected || isTargetNode) {
				const rawNode = nodeObj as unknown as {
					width: number;
					height: number;
					unknownData?: {
						width?: number;
						height?: number;
						originalWidth?: number;
						originalHeight?: number;
					};
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

		const targetNodes: Array<{
			nodeEl: HTMLElement;
			rawNode: { file?: TFile | string; unknownData?: { file?: string } };
		}> = [];

		canvas.nodes.forEach((nodeObj) => {
			const nodeEl = nodeObj.nodeEl;
			if (!nodeEl) return;

			const isTargetNode =
				targetNodeEl &&
				(nodeEl === targetNodeEl || nodeEl.contains(targetNodeEl));
			const isExplicitlySelected = nodeEl.classList.contains('is-selected');

			if (isExplicitlySelected || isTargetNode) {
				targetNodes.push({
					nodeEl,
					rawNode: nodeObj as {
						file?: TFile | string;
						unknownData?: { file?: string };
					},
				});
			}
		});

		if (targetNodes.length === 0) return;

		for (const { nodeEl, rawNode } of targetNodes) {
			try {
				let pngBlob: Blob | null = null;

				// Path A: Check if node is a vault TFile or path
				const filePath =
					(rawNode.file instanceof TFile ? rawNode.file.path : rawNode.file) ||
					rawNode.unknownData?.file;
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
							pngBlob = await new Promise<Blob>((resolve) =>
								canvasEl.toBlob((b) => resolve(b || rawBlob), 'image/png')
							);
						}
					}
				}

				// Path B: Fallback to HTMLImageElement rendering (embedded base64 or rendered <img> element)
				if (!pngBlob) {
					const img =
						nodeEl.querySelector<HTMLImageElement>('.kambas-embedded-img') ??
						this.getNativeImageElement(nodeEl) ??
						nodeEl.querySelector<HTMLImageElement>('img');
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
								pngBlob = await new Promise<Blob>((resolve) =>
									canvasEl.toBlob((b) => resolve(b || rawBlob), 'image/png')
								);
							}
						} else {
							// Draw rendered image onto HTML5 canvas
							const canvasEl = createEl('canvas');
							canvasEl.width = img.naturalWidth || img.width || 400;
							canvasEl.height = img.naturalHeight || img.height || 300;
							const ctx = canvasEl.getContext('2d');
							if (ctx) {
								ctx.drawImage(img, 0, 0);
								pngBlob = await new Promise<Blob | null>((resolve) =>
									canvasEl.toBlob((b) => resolve(b), 'image/png')
								);
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

			const isTargetNode =
				targetNodeEl &&
				(nodeEl === targetNodeEl || nodeEl.contains(targetNodeEl));
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
		let currentNamingStrategy: NamingStrategyOption | null = null;
		let currentNumberFormat: NumberFormatStyle = 'padded_2';
		let currentCustomName = '';
		let applyStrategyToAll = false;

		for (let i = 0; i < selectedNodes.length; i++) {
			const { id, nodeObj } = selectedNodes[i];
			const remainingCount = selectedNodes.length - i;

			const rawNodeObj = nodeObj as {
				file?: TFile | string;
				url?: string;
				nodeEl?: HTMLElement;
				unknownData?: {
					type?: string;
					url?: string;
					file?: string;
					label?: string;
				};
			};

			const canvasNodeData = canvasFileData.nodes.find((n) => n.id === id);
			if (!canvasNodeData) continue;

			// Case 1: Native vault media file node (type === 'file')
			if (canvasNodeData.type === 'file' && canvasNodeData.file) {
				const abstractFile = this.app.vault.getAbstractFileByPath(
					canvasNodeData.file
				);
				if (abstractFile instanceof TFile) {
					const defaultName = abstractFile.name;
					const tags = canvasNodeData.kambasTags || [];
					const nodeLabel: string = (
						canvasNodeData.label ||
						rawNodeObj.unknownData?.label ||
						''
					).trim();

					if (!applyStrategyToAll || !currentNamingStrategy) {
						const result = await new Promise<MediaFilenameResult>((resolve) => {
							const modal = new MediaFilenameModal(
								this.app,
								defaultName,
								targetFolder.path,
								tags,
								remainingCount,
								false,
								currentNumberFormat,
								nodeLabel,
								(res) => resolve(res)
							);
							modal.open();
						});

						currentNamingStrategy = result.option;
						currentNumberFormat = result.numberFormat;
						currentCustomName = result.customName || '';
						applyStrategyToAll = result.applyToAll;
					}

					if (currentNamingStrategy === 'cancel') {
						break;
					}

					const extIdx = abstractFile.name.lastIndexOf('.');
					const ext = extIdx !== -1 ? abstractFile.name.substring(extIdx) : '';

					let targetName = defaultName;
					if (currentNamingStrategy === 'label' && nodeLabel) {
						const cleanLabel = nodeLabel.replace(/[/\\?%*:|"<>]/g, '-').trim();
						let baseName = cleanLabel;
						if (ext && !baseName.toLowerCase().endsWith(ext.toLowerCase())) {
							baseName = `${baseName}${ext}`;
						}
						let counter = 1;
						targetName = baseName;
						let checkPath =
							targetFolder.path === '/'
								? targetName
								: `${targetFolder.path}/${targetName}`;
						while (this.app.vault.getAbstractFileByPath(checkPath)) {
							counter++;
							const nameNoExt =
								ext && baseName.toLowerCase().endsWith(ext.toLowerCase())
									? baseName.substring(0, baseName.length - ext.length)
									: baseName;
							targetName = `${nameNoExt}-${formatIncrementalNumber(counter, currentNumberFormat)}${ext}`;
							checkPath =
								targetFolder.path === '/'
									? targetName
									: `${targetFolder.path}/${targetName}`;
						}
					} else if (currentNamingStrategy === 'custom' && currentCustomName) {
						const cleanCustom = currentCustomName.replace(
							/[/\\?%*:|"<>]/g,
							'-'
						);
						let counter = 1;
						targetName = `${cleanCustom}-${formatIncrementalNumber(counter, currentNumberFormat)}${ext}`;
						let checkPath =
							targetFolder.path === '/'
								? targetName
								: `${targetFolder.path}/${targetName}`;
						while (this.app.vault.getAbstractFileByPath(checkPath)) {
							counter++;
							targetName = `${cleanCustom}-${formatIncrementalNumber(counter, currentNumberFormat)}${ext}`;
							checkPath =
								targetFolder.path === '/'
									? targetName
									: `${targetFolder.path}/${targetName}`;
						}
					} else if (currentNamingStrategy === 'tag') {
						const cleanedTags = tags
							.map((t) =>
								t
									.replace(/^#+/, '')
									.trim()
									.replace(/[/\\?%*:|"<>]/g, '-')
							)
							.filter(Boolean);
						if (cleanedTags.length > 0) {
							const baseTagStr = cleanedTags.join('-');
							let counter = 1;
							targetName = `${baseTagStr}-${formatIncrementalNumber(counter, currentNumberFormat)}${ext}`;
							let checkPath =
								targetFolder.path === '/'
									? targetName
									: `${targetFolder.path}/${targetName}`;
							while (this.app.vault.getAbstractFileByPath(checkPath)) {
								counter++;
								targetName = `${baseTagStr}-${formatIncrementalNumber(counter, currentNumberFormat)}${ext}`;
								checkPath =
									targetFolder.path === '/'
										? targetName
										: `${targetFolder.path}/${targetName}`;
							}
						}
					}

					const newPath =
						targetFolder.path === '/'
							? targetName
							: `${targetFolder.path}/${targetName}`;
					if (abstractFile.path !== newPath) {
						await this.app.fileManager.renameFile(abstractFile, newPath);
						canvasNodeData.file = newPath;
						if (rawNodeObj.unknownData) rawNodeObj.unknownData.file = newPath;
						modified = true;
					}
				}
			}
			// Case 2: Embedded base64 image link node (type === 'link' with data:image/...)
			else if (
				canvasNodeData.type === 'link' &&
				canvasNodeData.url?.startsWith('data:image/')
			) {
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

				const defaultName = `canvas_image_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
				const tags = canvasNodeData.kambasTags || [];
				const nodeLabel: string = (
					canvasNodeData.label ||
					rawNodeObj.unknownData?.label ||
					''
				).trim();

				if (!applyStrategyToAll || !currentNamingStrategy) {
					const result = await new Promise<MediaFilenameResult>((resolve) => {
						const modal = new MediaFilenameModal(
							this.app,
							defaultName,
							targetFolder.path,
							tags,
							remainingCount,
							false,
							currentNumberFormat,
							nodeLabel,
							(res) => resolve(res)
						);
						modal.open();
					});

					currentNamingStrategy = result.option;
					currentNumberFormat = result.numberFormat;
					currentCustomName = result.customName || '';
					applyStrategyToAll = result.applyToAll;
				}

				if (currentNamingStrategy === 'cancel') {
					break;
				}

				let targetFilename = defaultName;
				if (currentNamingStrategy === 'label' && nodeLabel) {
					const cleanLabel = nodeLabel.replace(/[/\\?%*:|"<>]/g, '-').trim();
					let baseName = cleanLabel;
					if (ext && !baseName.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
						baseName = `${baseName}.${ext}`;
					}
					let counter = 1;
					targetFilename = baseName;
					let checkPath =
						targetFolder.path === '/'
							? targetFilename
							: `${targetFolder.path}/${targetFilename}`;
					while (this.app.vault.getAbstractFileByPath(checkPath)) {
						counter++;
						const nameNoExt = baseName
							.toLowerCase()
							.endsWith(`.${ext.toLowerCase()}`)
							? baseName.substring(0, baseName.length - (ext.length + 1))
							: baseName;
						targetFilename = `${nameNoExt}-${formatIncrementalNumber(counter, currentNumberFormat)}.${ext}`;
						checkPath =
							targetFolder.path === '/'
								? targetFilename
								: `${targetFolder.path}/${targetFilename}`;
					}
				} else if (currentNamingStrategy === 'custom' && currentCustomName) {
					const cleanCustom = currentCustomName.replace(/[/\\?%*:|"<>]/g, '-');
					let counter = 1;
					targetFilename = `${cleanCustom}-${formatIncrementalNumber(counter, currentNumberFormat)}.${ext}`;
					let checkPath =
						targetFolder.path === '/'
							? targetFilename
							: `${targetFolder.path}/${targetFilename}`;
					while (this.app.vault.getAbstractFileByPath(checkPath)) {
						counter++;
						targetFilename = `${cleanCustom}-${formatIncrementalNumber(counter, currentNumberFormat)}.${ext}`;
						checkPath =
							targetFolder.path === '/'
								? targetFilename
								: `${targetFolder.path}/${targetFilename}`;
					}
				} else if (currentNamingStrategy === 'tag') {
					const cleanedTags = tags
						.map((t) =>
							t
								.replace(/^#+/, '')
								.trim()
								.replace(/[/\\?%*:|"<>]/g, '-')
						)
						.filter(Boolean);
					if (cleanedTags.length > 0) {
						const baseTagStr = cleanedTags.join('-');
						let counter = 1;
						targetFilename = `${baseTagStr}-${formatIncrementalNumber(counter, currentNumberFormat)}.${ext}`;
						let checkPath =
							targetFolder.path === '/'
								? targetFilename
								: `${targetFolder.path}/${targetFilename}`;
						while (this.app.vault.getAbstractFileByPath(checkPath)) {
							counter++;
							targetFilename = `${baseTagStr}-${formatIncrementalNumber(counter, currentNumberFormat)}.${ext}`;
							checkPath =
								targetFolder.path === '/'
									? targetFilename
									: `${targetFolder.path}/${targetFilename}`;
						}
					}
				}

				const savedPath = await saveFileToVault(
					this.app,
					targetFolder.path,
					targetFilename,
					u8arr.buffer
				);

				const savedFile = this.app.vault.getAbstractFileByPath(savedPath);
				if (
					savedFile instanceof TFile &&
					typeof canvas.createFileNode === 'function'
				) {
					// 1. Preserve position, size, transform & tag data
					const pos = { x: canvasNodeData.x, y: canvasNodeData.y };
					const size = {
						width: canvasNodeData.width,
						height: canvasNodeData.height,
					};
					const flipH =
						canvasNodeData.kambasFlipH ??
						(nodeObj as { unknownData?: { kambasFlipH?: boolean } }).unknownData
							?.kambasFlipH;
					const flipV =
						canvasNodeData.kambasFlipV ??
						(nodeObj as { unknownData?: { kambasFlipV?: boolean } }).unknownData
							?.kambasFlipV;
					const grayscale =
						canvasNodeData.kambasGrayscale ??
						(nodeObj as { unknownData?: { kambasGrayscale?: boolean } })
							.unknownData?.kambasGrayscale;
					const opacity =
						canvasNodeData.kambasOpacity ??
						(nodeObj as { unknownData?: { kambasOpacity?: number } })
							.unknownData?.kambasOpacity;
					const tags =
						canvasNodeData.kambasTags ||
						(nodeObj as { unknownData?: { kambasTags?: string[] } }).unknownData
							?.kambasTags ||
						(nodeObj as { kambasTags?: string[] }).kambasTags;
					const gifPaused =
						(canvasNodeData as { kambasGifPaused?: boolean }).kambasGifPaused ??
						(
							nodeObj as {
								kambasGifPaused?: boolean;
								unknownData?: { kambasGifPaused?: boolean };
							}
						).kambasGifPaused ??
						(nodeObj as { unknownData?: { kambasGifPaused?: boolean } })
							.unknownData?.kambasGifPaused;
					const gifFrame =
						(canvasNodeData as { kambasGifFrame?: number }).kambasGifFrame ??
						(
							nodeObj as {
								kambasGifFrame?: number;
								unknownData?: { kambasGifFrame?: number };
							}
						).kambasGifFrame ??
						(nodeObj as { unknownData?: { kambasGifFrame?: number } })
							.unknownData?.kambasGifFrame;
					const gifSpeed =
						(canvasNodeData as { kambasGifSpeed?: number }).kambasGifSpeed ??
						(
							nodeObj as {
								kambasGifSpeed?: number;
								unknownData?: { kambasGifSpeed?: number };
							}
						).kambasGifSpeed ??
						(nodeObj as { unknownData?: { kambasGifSpeed?: number } })
							.unknownData?.kambasGifSpeed;

					// 2. Remove old link node from canvas
					const rawCanvas = canvas as unknown as {
						removeNode?: (node: unknown) => void;
					};
					if (typeof rawCanvas.removeNode === 'function') {
						try {
							rawCanvas.removeNode(nodeObj);
						} catch {
							// Fallback
						}
					}

					// 3. Create native Obsidian file node
					const existingNodeIds = new Set(
						canvas.nodes ? Array.from(canvas.nodes.keys()) : []
					);
					const createdNode = canvas.createFileNode({
						file: savedFile,
						pos,
						size,
						save: true,
					});

					// 4. Find newly created file node (via return value or newly added node ID)
					let newCanvasNode: unknown = createdNode;
					if (!newCanvasNode && canvas.nodes) {
						for (const [nodeId, n] of canvas.nodes.entries()) {
							if (!existingNodeIds.has(nodeId)) {
								newCanvasNode = n;
								break;
							}
						}
					}
					if (!newCanvasNode && canvas.nodes) {
						newCanvasNode = Array.from(canvas.nodes.values()).find((n) => {
							const rawN = n as unknown as {
								file?: TFile | string;
								unknownData?: { file?: string };
							};
							return (
								rawN.file === savedFile ||
								rawN.file === savedPath ||
								rawN.unknownData?.file === savedPath
							);
						});
					}

					if (newCanvasNode) {
						const rawN = newCanvasNode as {
							id?: string;
							nodeEl?: HTMLElement;
							kambasTags?: string[];
							kambasGifPaused?: boolean;
							kambasGifFrame?: number;
							kambasGifSpeed?: number;
							unknownData?: {
								type?: string;
								file?: string;
								kambasFlipH?: boolean;
								kambasFlipV?: boolean;
								kambasGrayscale?: boolean;
								kambasOpacity?: number;
								kambasTags?: string[];
								kambasGifPaused?: boolean;
								kambasGifFrame?: number;
								kambasGifSpeed?: number;
							};
						};
						if (!rawN.unknownData) rawN.unknownData = {};
						rawN.unknownData.type = 'file';
						rawN.unknownData.file = savedPath;
						if (flipH) rawN.unknownData.kambasFlipH = flipH;
						if (flipV) rawN.unknownData.kambasFlipV = flipV;
						if (grayscale) rawN.unknownData.kambasGrayscale = grayscale;
						if (opacity !== undefined) rawN.unknownData.kambasOpacity = opacity;
						if (Array.isArray(tags) && tags.length > 0) {
							rawN.unknownData.kambasTags = [...tags];
							rawN.kambasTags = [...tags];
						}
						if (gifPaused !== undefined) {
							rawN.unknownData.kambasGifPaused = gifPaused;
							rawN.kambasGifPaused = gifPaused;
						}
						if (gifFrame !== undefined) {
							rawN.unknownData.kambasGifFrame = gifFrame;
							rawN.kambasGifFrame = gifFrame;
						}
						if (gifSpeed !== undefined) {
							rawN.unknownData.kambasGifSpeed = gifSpeed;
							rawN.kambasGifSpeed = gifSpeed;
						}

						// Sync tags and transform data into canvas.data.nodes so canvas.requestSave() persists them
						const rawCanvas = canvas as unknown as {
							data?: { nodes?: Array<{ id?: string; file?: string }> };
						};
						const canvasDataNode = rawCanvas.data?.nodes?.find(
							(n) => (rawN.id && n.id === rawN.id) || n.file === savedPath
						);
						if (canvasDataNode) {
							const rawCDN = canvasDataNode as unknown as {
								kambasFlipH?: boolean;
								kambasFlipV?: boolean;
								kambasGrayscale?: boolean;
								kambasOpacity?: number;
								kambasTags?: string[];
								kambasGifPaused?: boolean;
								kambasGifFrame?: number;
								kambasGifSpeed?: number;
							};
							if (flipH) rawCDN.kambasFlipH = flipH;
							if (flipV) rawCDN.kambasFlipV = flipV;
							if (grayscale) rawCDN.kambasGrayscale = grayscale;
							if (opacity !== undefined) rawCDN.kambasOpacity = opacity;
							if (Array.isArray(tags) && tags.length > 0) {
								rawCDN.kambasTags = [...tags];
							}
							if (gifPaused !== undefined) rawCDN.kambasGifPaused = gifPaused;
							if (gifFrame !== undefined) rawCDN.kambasGifFrame = gifFrame;
							if (gifSpeed !== undefined) rawCDN.kambasGifSpeed = gifSpeed;
						}

						if (rawN.nodeEl && Array.isArray(tags) && tags.length > 0) {
							this.renderTagBadges(rawN.nodeEl, tags);
						}
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

			this.scanAndRestoreTransforms(activeView);
			window.setTimeout(() => {
				this.scanAndRestoreTransforms(activeView);
			}, 50);
			window.setTimeout(() => {
				this.scanAndRestoreTransforms(activeView);
			}, 200);
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

			const isTargetNode =
				targetNodeEl &&
				(nodeEl === targetNodeEl || nodeEl.contains(targetNodeEl));
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

		let currentCopyNamingStrategy: NamingStrategyOption | null = null;
		let currentCopyNumberFormat: NumberFormatStyle = 'padded_2';
		let currentCopyCustomName = '';
		let applyCopyStrategyToAll = false;

		for (let i = 0; i < selectedNodes.length; i++) {
			const { id, nodeObj } = selectedNodes[i];
			const remainingCount = selectedNodes.length - i;

			const rawNodeObj = nodeObj as {
				file?: TFile | string;
				url?: string;
				nodeEl?: HTMLElement;
				unknownData?: {
					type?: string;
					url?: string;
					file?: string;
					label?: string;
				};
			};

			const canvasNodeData = canvasFileData.nodes.find((n) => n.id === id);
			if (!canvasNodeData) continue;

			// Case 1: Native vault media file node (type === 'file') -> copy vault file to target directory
			if (canvasNodeData.type === 'file' && canvasNodeData.file) {
				const abstractFile = this.app.vault.getAbstractFileByPath(
					canvasNodeData.file
				);
				if (abstractFile instanceof TFile) {
					const defaultName = abstractFile.name;
					const tags = canvasNodeData.kambasTags || [];
					const nodeLabel: string = (
						canvasNodeData.label ||
						rawNodeObj.unknownData?.label ||
						''
					).trim();

					if (!applyCopyStrategyToAll || !currentCopyNamingStrategy) {
						const result = await new Promise<MediaFilenameResult>((resolve) => {
							const modal = new MediaFilenameModal(
								this.app,
								defaultName,
								targetFolder.path,
								tags,
								remainingCount,
								true,
								currentCopyNumberFormat,
								nodeLabel,
								(res) => resolve(res)
							);
							modal.open();
						});

						currentCopyNamingStrategy = result.option;
						currentCopyNumberFormat = result.numberFormat;
						currentCopyCustomName = result.customName || '';
						applyCopyStrategyToAll = result.applyToAll;
					}

					if (currentCopyNamingStrategy === 'cancel') {
						break;
					}

					const extIdx = abstractFile.name.lastIndexOf('.');
					const base =
						extIdx !== -1
							? abstractFile.name.substring(0, extIdx)
							: abstractFile.name;
					const ext = extIdx !== -1 ? abstractFile.name.substring(extIdx) : '';

					let counter = 1;
					let targetName = `${base}-${formatIncrementalNumber(counter, currentCopyNumberFormat)}${ext}`;

					if (currentCopyNamingStrategy === 'label' && nodeLabel) {
						const cleanLabel = nodeLabel.replace(/[/\\?%*:|"<>]/g, '-').trim();
						let baseName = cleanLabel;
						if (ext && !baseName.toLowerCase().endsWith(ext.toLowerCase())) {
							baseName = `${baseName}${ext}`;
						}
						targetName = baseName;
						let targetPath =
							targetFolder.path === '/'
								? targetName
								: `${targetFolder.path}/${targetName}`;
						while (this.app.vault.getAbstractFileByPath(targetPath)) {
							counter++;
							const nameNoExt =
								ext && baseName.toLowerCase().endsWith(ext.toLowerCase())
									? baseName.substring(0, baseName.length - ext.length)
									: baseName;
							targetName = `${nameNoExt}-${formatIncrementalNumber(counter, currentCopyNumberFormat)}${ext}`;
							targetPath =
								targetFolder.path === '/'
									? targetName
									: `${targetFolder.path}/${targetName}`;
						}
					} else if (currentCopyNamingStrategy === 'custom' && currentCopyCustomName) {
						const cleanCustom = currentCopyCustomName.replace(
							/[/\\?%*:|"<>]/g,
							'-'
						);
						targetName = `${cleanCustom}-${formatIncrementalNumber(counter, currentCopyNumberFormat)}${ext}`;
						let targetPath =
							targetFolder.path === '/'
								? targetName
								: `${targetFolder.path}/${targetName}`;
						while (this.app.vault.getAbstractFileByPath(targetPath)) {
							counter++;
							targetName = `${cleanCustom}-${formatIncrementalNumber(counter, currentCopyNumberFormat)}${ext}`;
							targetPath =
								targetFolder.path === '/'
									? targetName
									: `${targetFolder.path}/${targetName}`;
						}
					} else if (currentCopyNamingStrategy === 'tag') {
						const cleanedTags = tags
							.map((t) =>
								t
									.replace(/^#+/, '')
									.trim()
									.replace(/[/\\?%*:|"<>]/g, '-')
							)
							.filter(Boolean);
						if (cleanedTags.length > 0) {
							const baseTagStr = cleanedTags.join('-');
							targetName = `${baseTagStr}-${formatIncrementalNumber(counter, currentCopyNumberFormat)}${ext}`;
							let targetPath =
								targetFolder.path === '/'
									? targetName
									: `${targetFolder.path}/${targetName}`;
							while (this.app.vault.getAbstractFileByPath(targetPath)) {
								counter++;
								targetName = `${baseTagStr}-${formatIncrementalNumber(counter, currentCopyNumberFormat)}${ext}`;
								targetPath =
									targetFolder.path === '/'
										? targetName
										: `${targetFolder.path}/${targetName}`;
							}
						} else {
							let targetPath =
								targetFolder.path === '/'
									? targetName
									: `${targetFolder.path}/${targetName}`;
							while (this.app.vault.getAbstractFileByPath(targetPath)) {
								counter++;
								targetName = `${base}-${formatIncrementalNumber(counter, currentCopyNumberFormat)}${ext}`;
								targetPath =
									targetFolder.path === '/'
										? targetName
										: `${targetFolder.path}/${targetName}`;
							}
						}
					} else {
						let targetPath =
							targetFolder.path === '/'
								? targetName
								: `${targetFolder.path}/${targetName}`;
						while (this.app.vault.getAbstractFileByPath(targetPath)) {
							counter++;
							targetName = `${base}-${formatIncrementalNumber(counter, currentCopyNumberFormat)}${ext}`;
							targetPath =
								targetFolder.path === '/'
									? targetName
									: `${targetFolder.path}/${targetName}`;
						}
					}

					const finalPath =
						targetFolder.path === '/'
							? targetName
							: `${targetFolder.path}/${targetName}`;
					await this.app.vault.copy(abstractFile, finalPath);
				}
			}
			// Case 2: Embedded base64 image link node (type === 'link' with data:image/...) -> copy/export base64 to target directory
			else if (
				canvasNodeData.type === 'link' &&
				canvasNodeData.url?.startsWith('data:image/')
			) {
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

				const defaultName = `canvas_image-01.${ext}`;
				const tags = canvasNodeData.kambasTags || [];
				const nodeLabel: string = (
					canvasNodeData.label ||
					rawNodeObj.unknownData?.label ||
					''
				).trim();

				if (!applyCopyStrategyToAll || !currentCopyNamingStrategy) {
					const result = await new Promise<MediaFilenameResult>((resolve) => {
						const modal = new MediaFilenameModal(
							this.app,
							defaultName,
							targetFolder.path,
							tags,
							remainingCount,
							true,
							currentCopyNumberFormat,
							nodeLabel,
							(res) => resolve(res)
						);
						modal.open();
					});

					currentCopyNamingStrategy = result.option;
					currentCopyNumberFormat = result.numberFormat;
					currentCopyCustomName = result.customName || '';
					applyCopyStrategyToAll = result.applyToAll;
				}

				if (currentCopyNamingStrategy === 'cancel') {
					break;
				}

				const base = 'canvas_image';
				let counter = 1;
				let targetName = `${base}-${formatIncrementalNumber(counter, currentCopyNumberFormat)}.${ext}`;

				if (currentCopyNamingStrategy === 'label' && nodeLabel) {
					const cleanLabel = nodeLabel.replace(/[/\\?%*:|"<>]/g, '-').trim();
					let baseName = cleanLabel;
					if (ext && !baseName.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
						baseName = `${baseName}.${ext}`;
					}
					targetName = baseName;
					let targetPath =
						targetFolder.path === '/'
							? targetName
							: `${targetFolder.path}/${targetName}`;
					while (this.app.vault.getAbstractFileByPath(targetPath)) {
						counter++;
						const nameNoExt = baseName
							.toLowerCase()
							.endsWith(`.${ext.toLowerCase()}`)
							? baseName.substring(0, baseName.length - (ext.length + 1))
							: baseName;
						targetName = `${nameNoExt}-${formatIncrementalNumber(counter, currentCopyNumberFormat)}.${ext}`;
						targetPath =
							targetFolder.path === '/'
								? targetName
								: `${targetFolder.path}/${targetName}`;
					}
				} else if (currentCopyNamingStrategy === 'custom' && currentCopyCustomName) {
					const cleanCustom = currentCopyCustomName.replace(
						/[/\\?%*:|"<>]/g,
						'-'
					);
					targetName = `${cleanCustom}-${formatIncrementalNumber(counter, currentCopyNumberFormat)}.${ext}`;
					let targetPath =
						targetFolder.path === '/'
							? targetName
							: `${targetFolder.path}/${targetName}`;
					while (this.app.vault.getAbstractFileByPath(targetPath)) {
						counter++;
						targetName = `${cleanCustom}-${formatIncrementalNumber(counter, currentCopyNumberFormat)}.${ext}`;
						targetPath =
							targetFolder.path === '/'
								? targetName
								: `${targetFolder.path}/${targetName}`;
					}
				} else if (currentCopyNamingStrategy === 'tag') {
					const cleanedTags = tags
						.map((t) =>
							t
								.replace(/^#+/, '')
								.trim()
								.replace(/[/\\?%*:|"<>]/g, '-')
						)
						.filter(Boolean);
					if (cleanedTags.length > 0) {
						const baseTagStr = cleanedTags.join('-');
						targetName = `${baseTagStr}-${formatIncrementalNumber(counter, currentCopyNumberFormat)}.${ext}`;
						let targetPath =
							targetFolder.path === '/'
								? targetName
								: `${targetFolder.path}/${targetName}`;
						while (this.app.vault.getAbstractFileByPath(targetPath)) {
							counter++;
							targetName = `${baseTagStr}-${formatIncrementalNumber(counter, currentCopyNumberFormat)}.${ext}`;
							targetPath =
								targetFolder.path === '/'
									? targetName
									: `${targetFolder.path}/${targetName}`;
						}
					} else {
						let targetPath =
							targetFolder.path === '/'
								? targetName
								: `${targetFolder.path}/${targetName}`;
						while (this.app.vault.getAbstractFileByPath(targetPath)) {
							counter++;
							targetName = `${base}-${formatIncrementalNumber(counter, currentCopyNumberFormat)}.${ext}`;
							targetPath =
								targetFolder.path === '/'
									? targetName
									: `${targetFolder.path}/${targetName}`;
						}
					}
				} else {
					let targetPath =
						targetFolder.path === '/'
							? targetName
							: `${targetFolder.path}/${targetName}`;
					while (this.app.vault.getAbstractFileByPath(targetPath)) {
						counter++;
						targetName = `${base}-${formatIncrementalNumber(counter, currentCopyNumberFormat)}.${ext}`;
						targetPath =
							targetFolder.path === '/'
								? targetName
								: `${targetFolder.path}/${targetName}`;
					}
				}

				const finalPath =
					targetFolder.path === '/'
						? targetName
						: `${targetFolder.path}/${targetName}`;
				await this.app.vault.createBinary(finalPath, u8arr.buffer);
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
		const targetNodes: Array<{
			id: string;
			nodeObj: unknown;
			tfile: TFile;
			filename: string;
		}> = [];

		canvas.nodes.forEach((nodeObj, id) => {
			const nodeEl = (nodeObj as { nodeEl?: HTMLElement }).nodeEl;
			if (!nodeEl) return;

			const isTargetNode =
				targetNodeEl &&
				(nodeEl === targetNodeEl || nodeEl.contains(targetNodeEl));
			const isExplicitlySelected = nodeEl.classList.contains('is-selected');

			if (isExplicitlySelected || isTargetNode) {
				const rawNodeObj = nodeObj as {
					file?: TFile | string;
					unknownData?: { file?: string };
				};
				const filePath =
					(rawNodeObj.file instanceof TFile
						? rawNodeObj.file.path
						: rawNodeObj.file) || rawNodeObj.unknownData?.file;
				if (filePath) {
					const abstractFile = this.app.vault.getAbstractFileByPath(filePath);
					if (
						abstractFile instanceof TFile &&
						IMAGE_EXTENSIONS.has(abstractFile.extension.toLowerCase())
					) {
						targetNodes.push({
							id,
							nodeObj,
							tfile: abstractFile,
							filename: abstractFile.name,
						});
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
			const rawObj = nodeObj as {
				x?: number;
				y?: number;
				width?: number;
				height?: number;
				kambasFlipH?: boolean;
				kambasFlipV?: boolean;
				kambasGrayscale?: boolean;
				kambasOpacity?: number;
				kambasTags?: string[];
				kambasGifPaused?: boolean;
				kambasGifFrame?: number;
				kambasGifSpeed?: number;
				unknownData?: {
					x?: number;
					y?: number;
					width?: number;
					height?: number;
					kambasFlipH?: boolean;
					kambasFlipV?: boolean;
					kambasGrayscale?: boolean;
					kambasOpacity?: number;
					kambasTags?: string[];
					kambasGifPaused?: boolean;
					kambasGifFrame?: number;
					kambasGifSpeed?: number;
				};
			};

			// Read vault image file and encode to base64 data URL
			const arrayBuffer = await this.app.vault.readBinary(tfile);
			const ext = tfile.extension.toLowerCase();
			const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
			let dataUrl = arrayBufferToBase64DataUrl(arrayBuffer, mimeType);

			if (
				this.plugin.settings.autoOptimizeBase64OnIngest &&
				ext !== 'gif' &&
				ext !== 'svg'
			) {
				try {
					const res = await compressAndOptimizeBase64(dataUrl, {
						maxDimension: this.plugin.settings.base64MaxDimension || 2048,
						quality: this.plugin.settings.base64Quality || 0.82,
						mimeType: 'image/webp',
					});
					if (res.dataUrl) dataUrl = res.dataUrl;
				} catch (err) {
					console.warn('Base64 optimization failed during vault convert:', err);
				}
			}

			// 1. Preserve position, size, transform & tag data
			const pos = {
				x: canvasNodeData?.x ?? rawObj.x ?? rawObj.unknownData?.x ?? 0,
				y: canvasNodeData?.y ?? rawObj.y ?? rawObj.unknownData?.y ?? 0,
			};
			const size = {
				width:
					canvasNodeData?.width ??
					rawObj.width ??
					rawObj.unknownData?.width ??
					400,
				height:
					canvasNodeData?.height ??
					rawObj.height ??
					rawObj.unknownData?.height ??
					300,
			};
			const flipH =
				canvasNodeData?.kambasFlipH ??
				rawObj.kambasFlipH ??
				rawObj.unknownData?.kambasFlipH;
			const flipV =
				canvasNodeData?.kambasFlipV ??
				rawObj.kambasFlipV ??
				rawObj.unknownData?.kambasFlipV;
			const grayscale =
				canvasNodeData?.kambasGrayscale ??
				rawObj.kambasGrayscale ??
				rawObj.unknownData?.kambasGrayscale;
			const opacity =
				canvasNodeData?.kambasOpacity ??
				rawObj.kambasOpacity ??
				rawObj.unknownData?.kambasOpacity;
			const tags =
				canvasNodeData?.kambasTags ||
				rawObj.kambasTags ||
				rawObj.unknownData?.kambasTags ||
				[];
			const gifPaused =
				(canvasNodeData as { kambasGifPaused?: boolean })?.kambasGifPaused ??
				(rawObj as { kambasGifPaused?: boolean }).kambasGifPaused ??
				rawObj.unknownData?.kambasGifPaused;
			const gifFrame =
				(canvasNodeData as { kambasGifFrame?: number })?.kambasGifFrame ??
				(rawObj as { kambasGifFrame?: number }).kambasGifFrame ??
				rawObj.unknownData?.kambasGifFrame;
			const gifSpeed =
				(canvasNodeData as { kambasGifSpeed?: number })?.kambasGifSpeed ??
				(rawObj as { kambasGifSpeed?: number }).kambasGifSpeed ??
				rawObj.unknownData?.kambasGifSpeed;

			// 2. Remove old native file node from canvas
			const rawCanvas = canvas as unknown as {
				removeNode?: (node: unknown) => void;
			};
			if (typeof rawCanvas.removeNode === 'function') {
				try {
					rawCanvas.removeNode(nodeObj);
				} catch {
					// Fallback
				}
			}

			// 3. Create link node storing embedded base64 data URL
			if (typeof canvas.createLinkNode === 'function') {
				const existingNodeIds = new Set(
					canvas.nodes ? Array.from(canvas.nodes.keys()) : []
				);
				const createdNode = canvas.createLinkNode({
					url: dataUrl,
					pos,
					size,
					save: true,
				});

				// 4. Find newly created link node (via return value or newly added node ID)
				let newCanvasNode: unknown = createdNode;
				if (!newCanvasNode && canvas.nodes) {
					for (const [nodeId, n] of canvas.nodes.entries()) {
						if (!existingNodeIds.has(nodeId)) {
							newCanvasNode = n;
							break;
						}
					}
				}
				if (!newCanvasNode && canvas.nodes) {
					newCanvasNode = Array.from(canvas.nodes.values()).find((n) => {
						const rawN = n as unknown as {
							url?: string;
							unknownData?: { url?: string };
						};
						return rawN.url === dataUrl || rawN.unknownData?.url === dataUrl;
					});
				}

				if (newCanvasNode) {
					const rawN = newCanvasNode as {
						id?: string;
						nodeEl?: HTMLElement;
						label?: string;
						kambasTags?: string[];
						kambasGifPaused?: boolean;
						kambasGifFrame?: number;
						kambasGifSpeed?: number;
						unknownData?: {
							type?: string;
							url?: string;
							label?: string;
							kambasFlipH?: boolean;
							kambasFlipV?: boolean;
							kambasGrayscale?: boolean;
							kambasOpacity?: number;
							kambasTags?: string[];
							kambasGifPaused?: boolean;
							kambasGifFrame?: number;
							kambasGifSpeed?: number;
						};
					};
					if (!rawN.unknownData) rawN.unknownData = {};
					rawN.unknownData.type = 'link';
					rawN.unknownData.url = dataUrl;
					if (
						this.plugin.settings.preserveMediaFilenameOnIngest &&
						filename
					) {
						rawN.label = filename;
						rawN.unknownData.label = filename;
					}
					if (flipH) rawN.unknownData.kambasFlipH = flipH;
					if (flipV) rawN.unknownData.kambasFlipV = flipV;
					if (grayscale) rawN.unknownData.kambasGrayscale = grayscale;
					if (opacity !== undefined) rawN.unknownData.kambasOpacity = opacity;
					if (Array.isArray(tags) && tags.length > 0) {
						rawN.unknownData.kambasTags = [...tags];
						rawN.kambasTags = [...tags];
					}
					if (gifPaused !== undefined) {
						rawN.unknownData.kambasGifPaused = gifPaused;
						rawN.kambasGifPaused = gifPaused;
					}
					if (gifFrame !== undefined) {
						rawN.unknownData.kambasGifFrame = gifFrame;
						rawN.kambasGifFrame = gifFrame;
					}
					if (gifSpeed !== undefined) {
						rawN.unknownData.kambasGifSpeed = gifSpeed;
						rawN.kambasGifSpeed = gifSpeed;
					}

					// Sync tags and transform data into canvas.data.nodes so canvas.requestSave() persists them cleanly
					const rawCanvasForData = canvas as unknown as {
						data?: { nodes?: Array<{ id?: string; url?: string }> };
					};
					const canvasDataNode = rawCanvasForData.data?.nodes?.find(
						(n) => (rawN.id && n.id === rawN.id) || n.url === dataUrl
					);
					if (canvasDataNode) {
						const rawCDN = canvasDataNode as unknown as {
							kambasFlipH?: boolean;
							kambasFlipV?: boolean;
							kambasGrayscale?: boolean;
							kambasOpacity?: number;
							kambasTags?: string[];
							kambasGifPaused?: boolean;
							kambasGifFrame?: number;
							kambasGifSpeed?: number;
						};
						if (flipH) rawCDN.kambasFlipH = flipH;
						if (flipV) rawCDN.kambasFlipV = flipV;
						if (grayscale) rawCDN.kambasGrayscale = grayscale;
						if (opacity !== undefined) rawCDN.kambasOpacity = opacity;
						if (Array.isArray(tags) && tags.length > 0) {
							rawCDN.kambasTags = [...tags];
						}
						if (gifPaused !== undefined) rawCDN.kambasGifPaused = gifPaused;
						if (gifFrame !== undefined) rawCDN.kambasGifFrame = gifFrame;
						if (gifSpeed !== undefined) rawCDN.kambasGifSpeed = gifSpeed;
					}

					if (rawN.nodeEl && Array.isArray(tags) && tags.length > 0) {
						this.renderTagBadges(rawN.nodeEl, tags);
					}
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

			this.scanAndRestoreTransforms(activeView);
			window.setTimeout(() => {
				this.scanAndRestoreTransforms(activeView);
			}, 50);
			window.setTimeout(() => {
				this.scanAndRestoreTransforms(activeView);
			}, 200);
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

	private async persistImageTransform(
		file: TFile,
		selectedNodeIds: string[],
		key: string,
		targetValue?: boolean
	): Promise<void> {
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
					node.kambasFlipH =
						targetValue !== undefined ? targetValue : !node.kambasFlipH;
					modified = true;
				} else if (key === 'v') {
					node.kambasFlipV =
						targetValue !== undefined ? targetValue : !node.kambasFlipV;
					modified = true;
				} else if (key === 'g') {
					node.kambasGrayscale =
						targetValue !== undefined ? targetValue : !node.kambasGrayscale;
					modified = true;
				} else if (key === 'p' || key === 'palette') {
					node.kambasPalette =
						targetValue !== undefined ? targetValue : !node.kambasPalette;
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
	public renderTagBadges(
		nodeEl: HTMLElement,
		tags: string[],
		forceReRender = false
	): void {
		// Synchronously hide native img inside GIF nodes to prevent playback flicker ONLY if GIF tools are enabled
		if (this.plugin?.settings?.enableGifTools !== false) {
			const targetImg = this.getNativeImageElement(nodeEl);
			if (targetImg && targetImg.src) {
				const srcLower = targetImg.src.toLowerCase();
				if (
					srcLower.includes('.gif') ||
					srcLower.startsWith('data:image/gif')
				) {
					targetImg.setCssProps({ display: 'none' });
				}
			}
		}

		let bar = nodeEl.querySelector<HTMLElement>('.kambas-tag-bar');

		if (!tags || tags.length === 0) {
			bar?.remove();
			return;
		}

		if (!bar) {
			bar = nodeEl.createDiv({ cls: 'kambas-tag-bar' });
		}

		const tagColorsMap = this.plugin.settings.tagColors ?? {};
		const tagKey = tags
			.map((t) => {
				const c = tagColorsMap[t.toLowerCase()];
				return `${t}:${c?.text ?? ''}:${c?.bg ?? ''}`;
			})
			.join(',');

		const existing = bar.dataset.tags;
		if (!forceReRender && existing === tagKey) return;
		bar.dataset.tags = tagKey;
		bar.empty();

		for (const tag of tags) {
			const pill = bar.createSpan({ cls: 'kambas-tag-pill' });
			const colors = tagColorsMap[tag.toLowerCase()];
			if (colors?.bg) pill.style.backgroundColor = colors.bg;
			if (colors?.text) pill.style.color = colors.text;

			const parts = tag.split('/');
			if (parts.length > 1) {
				const ns = parts.slice(0, -1).join('/') + '/';
				const name = parts[parts.length - 1];
				pill.createSpan({ cls: 'kambas-tag-ns', text: `#${ns}` });
				pill.createSpan({ cls: 'kambas-tag-name', text: name });
			} else {
				pill.createSpan({ cls: 'kambas-tag-name', text: `#${tag}` });
			}

			const onTagClick = (ev: MouseEvent | PointerEvent): void => {
				ev.stopPropagation();
				ev.preventDefault();

				const activeView = this.app.workspace.getActiveViewOfType(
					ItemView
				) as unknown as CanvasItemView | null;
				if (!activeView || activeView.getViewType() !== 'canvas') return;

				// If panel is currently open and on 'color' tab, switch tab to 'tag'
				if (
					this.tagFilterPanelEl?.isConnected &&
					this.activeFilterTab !== 'tag'
				) {
					this.activeFilterTab = 'tag';
					const tagTabEl = this.tagFilterPanelEl.querySelector(
						'.kambas-tag-panel-tabs .kambas-tag-panel-tab:nth-child(1)'
					);
					const colorTabEl = this.tagFilterPanelEl.querySelector(
						'.kambas-tag-panel-tabs .kambas-tag-panel-tab:nth-child(2)'
					);
					tagTabEl?.classList.add('is-active');
					colorTabEl?.classList.remove('is-active');
				}

				// Set focus on this specific tag filter
				this.activeTagFilters.clear();
				this.activeTagExcludes.clear();
				this.activeTagFilters.add(tag);

				// Apply filter and zoom to matching nodes
				this.applyTagFilters(activeView, true);
				this.refreshTagFilterPanel(activeView);

				// Scroll the tag item in the filter panel list into view and highlight briefly
				if (this.tagFilterPanelEl?.isConnected) {
					const row = this.tagFilterPanelEl.querySelector<HTMLElement>(
						`[data-tag-name="${CSS.escape(tag)}"]`
					);
					if (row) {
						row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
					}
				}
			};

			pill.addEventListener('mousedown', (ev) => ev.stopPropagation());
			pill.addEventListener('pointerdown', (ev) => ev.stopPropagation());
			pill.addEventListener('click', onTagClick);
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
			const uData = (
				node as unknown as { unknownData?: { kambasTags?: string[] } }
			).unknownData;
			for (const tag of uData?.kambasTags ?? []) {
				if (tag.trim()) tagSet.add(tag.trim());
			}
		});
		return Array.from(tagSet).sort();
	}

	/**
	 * Collects tags from the live canvas as well as the global vault metadata cache.
	 */
	public collectVaultAndCanvasTags(activeView: CanvasItemView): {
		canvasTags: string[];
		suggestions: string[];
	} {
		const canvasTags = this.collectLiveCanvasTags(activeView);
		const tagSet = new Set<string>(canvasTags);

		try {
			const vaultTagCounts = (
				this.app.metadataCache as unknown as {
					getTags?: () => Record<string, number>;
				}
			).getTags?.();
			if (vaultTagCounts) {
				for (const rawTag of Object.keys(vaultTagCounts)) {
					const tag = rawTag.replace(/^#+/, '').trim().toLowerCase();
					if (tag) tagSet.add(tag);
				}
			}
		} catch {
			/* ignore */
		}

		return {
			canvasTags,
			suggestions: Array.from(tagSet).sort(),
		};
	}

	/**
	 * Opens the TagModal for the selected node(s) and applies resulting tags.
	 */
	public openSetMediaLabelModal(
		activeView: CanvasItemView,
		targetNodeEl?: Element | null
	): void {
		const canvas = activeView.canvas;
		if (!canvas?.nodes) return;

		const targetNodes: Array<{ id: string; nodeObj: unknown }> = [];
		canvas.nodes.forEach((nodeObj, id) => {
			const nodeEl = (nodeObj as { nodeEl?: HTMLElement }).nodeEl;
			if (!nodeEl) return;
			const isTarget = Boolean(
				targetNodeEl &&
					(nodeEl === targetNodeEl || nodeEl.contains(targetNodeEl))
			);
			const isSel = nodeEl.classList.contains('is-selected');
			if (targetNodeEl ? isTarget : isSel) {
				targetNodes.push({ id, nodeObj });
			}
		});

		if (targetNodes.length === 0 && targetNodeEl) {
			canvas.nodes.forEach((nodeObj, id) => {
				const nodeEl = (nodeObj as { nodeEl?: HTMLElement }).nodeEl;
				if (
					nodeEl &&
					(nodeEl === targetNodeEl || nodeEl.contains(targetNodeEl))
				) {
					targetNodes.push({ id, nodeObj });
				}
			});
		}

		const embeddedTargetNodes = targetNodes.filter((item) => {
			const nodeObj = item.nodeObj as {
				type?: string;
				url?: string;
				file?: unknown;
				nodeEl?: HTMLElement;
				unknownData?: { type?: string; url?: string };
			};
			const cdn = (
				canvas as {
					data?: {
						nodes?: Array<{
							id?: string;
							type?: string;
							url?: string;
							file?: unknown;
						}>;
					};
				}
			).data?.nodes?.find((n) => n.id === item.id);
			return this.isEmbeddedMediaNode(nodeObj, cdn, nodeObj.nodeEl);
		});

		if (embeddedTargetNodes.length === 0) {
			new Notice(
				getText().noMediaSelectedNotice ??
					'Custom labels can only be applied to embedded media.'
			);
			return;
		}

		interface TypedNode {
			id?: string;
			label?: string;
			unknownData?: { label?: string };
			nodeEl?: HTMLElement;
			renderHeader?: () => void;
			updateHeader?: () => void;
			render?: () => void;
		}
		interface TypedDataNode {
			id?: string;
			label?: string;
		}
		interface TypedCanvas {
			data?: {
				nodes?: TypedDataNode[];
			};
		}

		const primaryEntry = targetNodes[0];
		const primaryNode = primaryEntry.nodeObj as TypedNode;
		const rawCanvas = canvas as TypedCanvas;
		const primaryDataNode = rawCanvas.data?.nodes?.find(
			(n) => n.id === primaryEntry.id
		);

		const currentLabel = (
			primaryNode.label ||
			primaryNode.unknownData?.label ||
			primaryDataNode?.label ||
			''
		).trim();

		new CanvasMediaLabelModal(
			this.app,
			currentLabel,
			(newLabel: string): void => {
				void (async (): Promise<void> => {
					this.pushCanvasUndoHistory(canvas);
					const template = newLabel.trim();
					const nodeLabelsMap = new Map<string, string | undefined>();
					const hasCounterPattern = /#+/.test(template);

					for (let i = 0; i < embeddedTargetNodes.length; i++) {
						const { id, nodeObj } = embeddedTargetNodes[i];
						const rawNode = nodeObj as TypedNode;

						let formattedLabel = template;
						if (template && hasCounterPattern) {
							formattedLabel = template.replace(/#+(\d+)?/g, (match: string, digits?: string) => {
								const hashes = match.replace(/\d+$/, '');
								const hashCount = hashes.length;

								let startNum = 1;
								if (digits) {
									const parsed = parseInt(digits, 10);
									if (!isNaN(parsed)) {
										startNum = parsed;
									}
								}

								const currentVal = startNum + i;
								const valStr = String(currentVal);

								let padLength = hashCount;
								if (digits) {
									if (digits.startsWith('0')) {
										padLength = Math.max(hashCount, digits.length);
									} else {
										padLength = hashCount + digits.length;
									}
								}

								return padLength > 1 ? valStr.padStart(padLength, '0') : valStr;
							});
						}

						rawNode.id = id;
						if (formattedLabel) {
							rawNode.label = formattedLabel;
							if (!rawNode.unknownData) rawNode.unknownData = {};
							rawNode.unknownData.label = formattedLabel;
						} else {
							delete rawNode.label;
							if (rawNode.unknownData) delete rawNode.unknownData.label;
						}

						nodeLabelsMap.set(id, formattedLabel || undefined);

						if (rawCanvas.data?.nodes) {
							const cdn = rawCanvas.data.nodes.find(
								(n) => n.id === id
							);
							if (cdn) {
								if (formattedLabel) {
									cdn.label = formattedLabel;
								} else {
									delete cdn.label;
								}
							}
						}

						if (rawNode.nodeEl) {
							rawNode.nodeEl.classList.toggle(
								'kambas-has-label',
								Boolean(formattedLabel)
							);
							let labelEl = rawNode.nodeEl.querySelector('.canvas-node-label');
							if (formattedLabel) {
							if (!labelEl) {
								const containerEl =
									rawNode.nodeEl.querySelector('.canvas-node-container') ??
									rawNode.nodeEl;
								labelEl = containerEl.createDiv({ cls: 'canvas-node-label' });
							}
							labelEl.textContent = formattedLabel;
						} else if (labelEl) {
							labelEl.remove();
						}
					}

					if (typeof rawNode.renderHeader === 'function') {
						rawNode.renderHeader();
					} else if (typeof rawNode.updateHeader === 'function') {
						rawNode.updateHeader();
					} else if (typeof rawNode.render === 'function') {
						rawNode.render();
					}
				}

				const file = activeView.file;
				if (file && nodeLabelsMap.size > 0) {
					await this.persistNodeLabelsMap(file, nodeLabelsMap);
					window.setTimeout(() => this.scanAndRestoreTransforms(activeView), 100);
				}

				if (typeof canvas.requestSave === 'function') {
					try {
						canvas.requestSave();
					} catch {
						/* ignore */
					}
				}
			})();
		},
		targetNodes.length
	).open();
	}

	private async persistNodeLabelsMap(
		file: TFile,
		nodeLabelsMap: Map<string, string | undefined>
	): Promise<void> {
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
			if (node.id && nodeLabelsMap.has(node.id)) {
				const label = nodeLabelsMap.get(node.id);
				if (label) {
					node.label = label;
				} else {
					delete node.label;
				}
				modified = true;
			}
		});
		if (modified) {
			this.scheduleVaultModify(file, data);
		}
	}

	public openTagModal(
		activeView: CanvasItemView,
		targetNodeEl?: Element | null
	): void {
		const canvas = activeView.canvas;
		if (!canvas?.nodes) return;

		const initialTagSet = new Set<string>();
		const tagCounts = new Map<string, number>();
		let selectedCount = 0;

		canvas.nodes.forEach((node) => {
			const nodeEl = node.nodeEl;
			if (!nodeEl) return;
			const isTarget = Boolean(
				targetNodeEl &&
				(nodeEl === targetNodeEl || nodeEl.contains(targetNodeEl))
			);
			const isSel = nodeEl.classList.contains('is-selected');

			if (targetNodeEl ? isTarget : isSel) {
				selectedCount++;
				const uData = (
					node as unknown as { unknownData?: { kambasTags?: string[] } }
				).unknownData;
				for (const tag of uData?.kambasTags ?? []) {
					const clean = tag.trim().toLowerCase();
					if (clean) {
						initialTagSet.add(clean);
						tagCounts.set(clean, (tagCounts.get(clean) ?? 0) + 1);
					}
				}
			}
		});
		const initialTags = Array.from(initialTagSet);

		const { canvasTags, suggestions } =
			this.collectVaultAndCanvasTags(activeView);

		new TagModal(
			this.app,
			initialTags,
			suggestions,
			(tags, tagStates) => {
				void this.setNodeTags(
					activeView,
					tags,
					initialTags,
					targetNodeEl,
					tagStates
				);
			},
			{
				selectedCount: selectedCount || 1,
				presetTags:
					canvasTags.length > 0 ? canvasTags : suggestions.slice(0, 10),
				tagCounts,
				tagColors: this.plugin.settings.tagColors,
			}
		).open();
	}

	/**
	 * Writes tags to all selected nodes in-memory and persists via canvas save.
	 */
	public async setNodeTags(
		activeView: CanvasItemView,
		tags: string[],
		initialTags: string[] = [],
		targetNodeEl?: Element | null,
		tagStates?: Map<string, 'full' | 'mixed'>
	): Promise<void> {
		const canvas = activeView.canvas;
		if (!canvas?.nodes) return;

		this.pushCanvasUndoHistory(canvas);
		const nodeTagsMap = new Map<string, string[] | undefined>();

		const fullTags = tags.filter(
			(t) => !tagStates || tagStates.get(t) === 'full'
		);
		const removedTags = initialTags.filter((t) => !tags.includes(t));

		canvas.nodes.forEach((node, id) => {
			const nodeEl = node.nodeEl;
			if (!nodeEl) return;
			const isSel =
				nodeEl.classList.contains('is-selected') ||
				(targetNodeEl &&
					(nodeEl === targetNodeEl || nodeEl.contains(targetNodeEl)));
			if (isSel) {
				const rawNode = node as unknown as {
					unknownData?: { kambasTags?: string[] };
				};
				if (!rawNode.unknownData) rawNode.unknownData = {};
				const existingTags = rawNode.unknownData.kambasTags ?? [];

				// Keep existing tags that were not explicitly removed
				let updated = existingTags.filter((t) => !removedTags.includes(t));
				// Add any full tags (tags applied to ALL nodes)
				for (const tag of fullTags) {
					if (!updated.includes(tag)) updated.push(tag);
				}

				rawNode.unknownData.kambasTags =
					updated.length > 0 ? updated : undefined;
				nodeTagsMap.set(id, updated.length > 0 ? updated : undefined);

				// Immediately render badges
				if (nodeEl.instanceOf(HTMLElement))
					this.renderTagBadges(nodeEl, updated);
			}
		});

		if (nodeTagsMap.size === 0) return;

		const file = activeView.file;
		if (file) {
			await this.persistNodeTagsMap(file, nodeTagsMap);
			window.setTimeout(() => this.scanAndRestoreTransforms(activeView), 100);
		}

		if (typeof canvas.requestSave === 'function') {
			try {
				canvas.requestSave();
			} catch {
				/* ignore */
			}
		}

		if (this.tagFilterPanelEl?.isConnected) {
			window.setTimeout(() => this.refreshTagFilterPanel(activeView), 150);
		}
	}

	public pushCanvasUndoHistory(canvas: unknown): void {
		if (!canvas) return;
		try {
			const rawCanvas = canvas as {
				getData?: () => { nodes?: unknown[]; edges?: unknown[] };
				pushHistory?: (data?: unknown) => void;
				requestPush?: (data?: unknown) => void;
				history?: { push?: (data?: unknown) => void };
				data?: { nodes?: unknown[]; edges?: unknown[] };
			};

			let dataSnapshot: { nodes?: unknown[]; edges?: unknown[] } | null = null;
			if (typeof rawCanvas.getData === 'function') {
				try {
					dataSnapshot = rawCanvas.getData();
				} catch {
					/* ignore */
				}
			}
			if (!dataSnapshot && rawCanvas.data) {
				dataSnapshot = rawCanvas.data;
			}

			if (!dataSnapshot || !Array.isArray(dataSnapshot.nodes)) {
				return;
			}

			const snapshotCopy = JSON.parse(JSON.stringify(dataSnapshot)) as {
				nodes?: unknown[];
				edges?: unknown[];
			};

			if (
				rawCanvas.history &&
				typeof rawCanvas.history.push === 'function'
			) {
				rawCanvas.history.push(snapshotCopy);
			} else if (typeof rawCanvas.pushHistory === 'function') {
				rawCanvas.pushHistory(snapshotCopy);
			} else if (typeof rawCanvas.requestPush === 'function') {
				rawCanvas.requestPush(snapshotCopy);
			}
		} catch (err) {
			console.warn('[Kambas] Failed to push canvas undo history:', err);
		}
	}

	private async persistNodeTagsMap(
		file: TFile,
		nodeTagsMap: Map<string, string[] | undefined>
	): Promise<void> {
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
			if (node.id && nodeTagsMap.has(node.id)) {
				const nd = node as unknown as { kambasTags?: string[] };
				const updated = nodeTagsMap.get(node.id);
				if (updated && updated.length > 0) {
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
		const container =
			(activeView as unknown as { containerEl?: HTMLElement }).containerEl ??
			(activeView.canvas as unknown as { wrapperEl?: HTMLElement })?.wrapperEl;
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
		container.style.setProperty(
			'--kambas-dim-opacity',
			String(this.dimOpacity)
		);

		// ── Header (drag handle & tabs) ─────────────────────────────────────────────
		const header = panel.createDiv({ cls: 'kambas-tag-panel-header' });
		const tabsWrap = header.createDiv({ cls: 'kambas-tag-panel-tabs' });

		const hasTagActive =
			this.activeTagFilters.size > 0 || this.activeTagExcludes.size > 0;
		const hasColorActive =
			this.activeColorFilters.size > 0 || this.activeColorExcludes.size > 0;
		const hasLabelActive =
			this.activeLabelFilters.size > 0 || this.activeLabelExcludes.size > 0;

		const tagTab = tabsWrap.createDiv({
			cls:
				'kambas-tag-panel-tab' +
				(this.activeFilterTab === 'tag' ? ' is-active' : '') +
				(hasTagActive ? ' has-filter' : ''),
		});
		tagTab.createSpan({ text: t.tagModalTitle });
		if (hasTagActive) {
			tagTab.createSpan({
				cls: 'kambas-tab-filter-dot',
				attr: { 'aria-label': 'Active tag filter' },
			});
		}

		const colorTab = tabsWrap.createDiv({
			cls:
				'kambas-tag-panel-tab' +
				(this.activeFilterTab === 'color' ? ' is-active' : '') +
				(hasColorActive ? ' has-filter' : ''),
		});
		colorTab.createSpan({ text: t.colorFilterTab ?? 'Color' });
		if (hasColorActive) {
			colorTab.createSpan({
				cls: 'kambas-tab-filter-dot',
				attr: { 'aria-label': 'Active color filter' },
			});
		}

		const labelTab = tabsWrap.createDiv({
			cls:
				'kambas-tag-panel-tab' +
				(this.activeFilterTab === 'label' ? ' is-active' : '') +
				(hasLabelActive ? ' has-filter' : ''),
		});
		labelTab.createSpan({ text: t.labelFilterTab ?? 'Labels' });
		if (hasLabelActive) {
			labelTab.createSpan({
				cls: 'kambas-tab-filter-dot',
				attr: { 'aria-label': 'Active label filter' },
			});
		}

		tagTab.addEventListener('click', () => {
			if (this.activeFilterTab === 'tag') return;
			this.activeFilterTab = 'tag';
			tagTab.addClass('is-active');
			colorTab.removeClass('is-active');
			labelTab.removeClass('is-active');
			this.refreshTagFilterPanel(activeView);
		});

		colorTab.addEventListener('click', () => {
			if (this.activeFilterTab === 'color') return;
			this.activeFilterTab = 'color';
			colorTab.addClass('is-active');
			tagTab.removeClass('is-active');
			labelTab.removeClass('is-active');
			this.refreshTagFilterPanel(activeView);
		});

		labelTab.addEventListener('click', () => {
			if (this.activeFilterTab === 'label') return;
			this.activeFilterTab = 'label';
			labelTab.addClass('is-active');
			tagTab.removeClass('is-active');
			colorTab.removeClass('is-active');
			this.refreshTagFilterPanel(activeView);
		});

		const headerActions = header.createDiv({ cls: 'kambas-tag-panel-actions' });
		const closeBtn = headerActions.createDiv({ cls: 'kambas-tag-panel-close' });
		setIcon(closeBtn, 'x');
		closeBtn.addEventListener('click', () =>
			this.closeTagFilterPanel(activeView)
		);

		this.makePanelDraggable(panel, header, container);

		// ── Filter panel body ───────────────────────────────────────────
		const body = panel.createDiv({ cls: 'kambas-tag-panel-body' });
		(panel as unknown as { _body: HTMLElement })._body = body;
		this.renderFilterPanelBody(body, activeView);

		// ── Opacity slider footer ────────────────────────────────────────────
		const footer = panel.createDiv({ cls: 'kambas-tag-panel-footer' });
		footer.createSpan({
			cls: 'kambas-tag-slider-label-text',
			text: t.dimOpacityLabel ?? 'Dim opacity',
		});

		// Slider + reset icon on one row
		const sliderRow = footer.createDiv({ cls: 'kambas-tag-slider-row' });

		const sliderComp = new SliderComponent(sliderRow);
		sliderComp
			.setLimits(0, 90, 1)
			.setValue(Math.round(this.dimOpacity * 100))
			.setDynamicTooltip()
			.onChange((value: number) => {
				this.dimOpacity = value / 100;
				container.style.setProperty(
					'--kambas-dim-opacity',
					String(this.dimOpacity)
				);
				this.savePanelState(panel);
			});
		sliderComp.sliderEl.addClass('kambas-tag-slider');

		const resetBtn = sliderRow.createEl('button', {
			cls: 'kambas-tag-slider-reset',
		});
		setIcon(resetBtn, 'rotate-ccw');
		resetBtn.setAttribute(
			'aria-label',
			t.resetOpacityTooltip ?? 'Reset opacity to default'
		);
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
		let onOutsidePointerDown: ((evt: PointerEvent) => void) | null = null;

		if (this.plugin.settings.tagPanelAutoClose) {
			onOutsidePointerDown = (evt: PointerEvent): void => {
				const target = evt.target as HTMLElement | null;
				if (!target) return;
				// Ignore clicks inside panel or on tag toolbar buttons
				if (
					panel.contains(target) ||
					target.closest('.kambas-tag-toolbar-group') ||
					target.closest('.kambas-tag-toolbar-btn')
				) {
					return;
				}
				this.closeTagFilterPanel(activeView);
			};
			document.addEventListener('pointerdown', onOutsidePointerDown, true);
		}

		const panelObserver = new MutationObserver(() => {
			if (!panel.isConnected) {
				ro.disconnect();
				containerRo.disconnect();
				panelObserver.disconnect();
				if (onOutsidePointerDown) {
					document.removeEventListener(
						'pointerdown',
						onOutsidePointerDown,
						true
					);
				}
			}
		});
		panelObserver.observe(document.body, { childList: true, subtree: true });
	}

	private clampPanelPosition(panel: HTMLElement, container: HTMLElement): void {
		if (!panel.isConnected || !container.isConnected) return;
		const cRect = container.getBoundingClientRect();
		const pRect = panel.getBoundingClientRect();
		if (cRect.width === 0 || cRect.height === 0) return;

		// Clamp width/height if user resized panel larger than canvas container
		const maxWidth = Math.max(200, cRect.width - 24);
		const maxHeight = Math.max(160, cRect.height - 24);
		if (panel.offsetWidth > maxWidth) {
			panel.style.width = `${maxWidth}px`;
		}
		if (panel.offsetHeight > maxHeight) {
			panel.style.height = `${maxHeight}px`;
		}

		let currentLeft = panel.offsetLeft;
		let currentTop = panel.offsetTop;

		const maxLeft = Math.max(
			0,
			cRect.width - (panel.offsetWidth || pRect.width)
		);
		const maxTop = Math.max(
			0,
			cRect.height - (panel.offsetHeight || pRect.height)
		);

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
			this.app.saveLocalStorage(
				'kambas-tag-panel-state',
				JSON.stringify(state)
			);
		} catch {
			/* ignore */
		}
	}

	private restorePanelState(panel: HTMLElement, container: HTMLElement): void {
		try {
			const raw = this.app.loadLocalStorage('kambas-tag-panel-state') as
				| string
				| null;
			if (raw) {
				const state = JSON.parse(raw) as {
					top?: string;
					left?: string;
					width?: string;
					height?: string;
					dimOpacity?: number;
				};
				if (state.top) panel.style.top = state.top;
				if (state.left) panel.style.left = state.left;
				if (state.width) panel.style.width = state.width;
				if (state.height) panel.style.height = state.height;
				if (typeof state.dimOpacity === 'number')
					this.dimOpacity = state.dimOpacity;
			}
			// Clamp immediately after restoring position
			this.clampPanelPosition(panel, container);
		} catch {
			/* ignore */
		}
	}

	private makePanelDraggable(
		panel: HTMLElement,
		header: HTMLElement,
		container: HTMLElement
	): void {
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
					right: 'auto',
					bottom: 'auto',
					left: `${mouseDownPRect.left - cRect.left}px`,
					top: `${mouseDownPRect.top - cRect.top}px`,
				});
			}
			const panW = panel.offsetWidth;
			const panH = panel.offsetHeight;
			let newLeft = e.clientX - dragOffsetX - cRect.left;
			let newTop = e.clientY - dragOffsetY - cRect.top;
			// Clamp so panel stays fully inside the container
			newLeft = Math.max(0, Math.min(newLeft, cRect.width - panW));
			newTop = Math.max(0, Math.min(newTop, cRect.height - panH));
			panel.style.left = `${newLeft}px`;
			panel.style.top = `${newTop}px`;
		};
		const onUp = (): void => {
			isDragging = false;
			mouseDownPRect = null;
			document.removeEventListener('mousemove', onMove);
			document.removeEventListener('mouseup', onUp);
		};

		header.addEventListener('mousedown', (e: MouseEvent) => {
			if (
				(e.target as HTMLElement).closest('.kambas-tag-panel-close') ||
				(e.target as HTMLElement).closest('.kambas-tag-panel-tabs')
			)
				return;
			isDragging = true;
			positionAnchored = false; // reset — we haven't moved yet
			// Capture panel rect NOW (no DOM writes!) for use on first mousemove
			mouseDownPRect = panel.getBoundingClientRect();
			dragOffsetX = e.clientX - mouseDownPRect.left;
			dragOffsetY = e.clientY - mouseDownPRect.top;
			const ownerDoc = header.ownerDocument || document;
			const cleanupDrag = (): void => {
				ownerDoc.removeEventListener('mousemove', onMove);
				ownerDoc.removeEventListener('mouseup', onUp);
			};
			const onMoveWithCleanup = (moveEvt: MouseEvent): void => {
				onMove(moveEvt);
			};
			const onUpWithCleanup = (): void => {
				cleanupDrag();
				onUp();
			};
			ownerDoc.addEventListener('mousemove', onMoveWithCleanup);
			ownerDoc.addEventListener('mouseup', onUpWithCleanup);
			e.preventDefault();
		});
	}

	private closeTagFilterPanel(activeView: CanvasItemView): void {
		// Do NOT clear filters — they should persist while the panel is closed.
		// The user can clear them explicitly via the × button inside the search bar.
		this.colorHighlightCleanup?.();
		this.colorHighlightCleanup = null;
		this.tagHighlightCleanup?.();
		this.tagHighlightCleanup = null;
		this.tagFilterPanelEl?.remove();
		this.tagFilterPanelEl = null;
		// Keep toolbar button lit when filters are still active
		this.updateToolbarButtonState();
		if (activeView) {
			this.scanAndRestoreTransforms(activeView);
		}
	}

	private refreshTagFilterPanel(activeView: CanvasItemView): void {
		if (!this.tagFilterPanelEl?.isConnected) return;
		const activeEl = document.activeElement;
		let focusedQuery: string | null = null;
		let cursorStart: number | null = null;
		let cursorEnd: number | null = null;

		if (
			activeEl?.instanceOf?.(HTMLInputElement) &&
			activeEl.classList.contains('kambas-tag-search')
		) {
			focusedQuery = activeEl.value;
			cursorStart = activeEl.selectionStart;
			cursorEnd = activeEl.selectionEnd;
		}

		const hasTagActive =
			this.activeTagFilters.size > 0 || this.activeTagExcludes.size > 0;
		const hasColorActive =
			this.activeColorFilters.size > 0 || this.activeColorExcludes.size > 0;
		const hasLabelActive =
			this.activeLabelFilters.size > 0 || this.activeLabelExcludes.size > 0;

		const tagTabEl = this.tagFilterPanelEl.querySelector(
			'.kambas-tag-panel-tabs .kambas-tag-panel-tab:nth-child(1)'
		);
		if (tagTabEl) {
			tagTabEl.classList.toggle('has-filter', hasTagActive);
			let dot = tagTabEl.querySelector('.kambas-tab-filter-dot');
			if (hasTagActive && !dot) {
				tagTabEl.createSpan({
					cls: 'kambas-tab-filter-dot',
					attr: { 'aria-label': 'Active tag filter' },
				});
			} else if (!hasTagActive && dot) {
				dot.remove();
			}
		}

		const colorTabEl = this.tagFilterPanelEl.querySelector(
			'.kambas-tag-panel-tabs .kambas-tag-panel-tab:nth-child(2)'
		);
		if (colorTabEl) {
			colorTabEl.classList.toggle('has-filter', hasColorActive);
			let dot = colorTabEl.querySelector('.kambas-tab-filter-dot');
			if (hasColorActive && !dot) {
				colorTabEl.createSpan({
					cls: 'kambas-tab-filter-dot',
					attr: { 'aria-label': 'Active color filter' },
				});
			} else if (!hasColorActive && dot) {
				dot.remove();
			}
		}

		const labelTabEl = this.tagFilterPanelEl.querySelector(
			'.kambas-tag-panel-tabs .kambas-tag-panel-tab:nth-child(3)'
		);
		if (labelTabEl) {
			labelTabEl.classList.toggle('has-filter', hasLabelActive);
			let dot = labelTabEl.querySelector('.kambas-tab-filter-dot');
			if (hasLabelActive && !dot) {
				labelTabEl.createSpan({
					cls: 'kambas-tab-filter-dot',
					attr: { 'aria-label': 'Active label filter' },
				});
			} else if (!hasLabelActive && dot) {
				dot.remove();
			}
		}

		const body = (this.tagFilterPanelEl as unknown as { _body?: HTMLElement })
			._body;
		const listElBefore = body?.querySelector<HTMLElement>(
			'.kambas-tag-panel-list'
		);
		const savedScrollTop = listElBefore ? listElBefore.scrollTop : 0;

		if (body) this.renderFilterPanelBody(body, activeView);

		const listElAfter = body?.querySelector<HTMLElement>(
			'.kambas-tag-panel-list'
		);
		if (listElAfter) listElAfter.scrollTop = savedScrollTop;

		if (focusedQuery !== null && this.tagFilterPanelEl?.isConnected) {
			const newInput = this.tagFilterPanelEl.querySelector<HTMLInputElement>(
				'input.kambas-tag-search'
			);
			if (newInput) {
				newInput.value = focusedQuery;
				newInput.focus();
				if (cursorStart !== null && cursorEnd !== null) {
					try {
						newInput.setSelectionRange(cursorStart, cursorEnd);
					} catch {
						/* ignore */
					}
				}
				// Trigger input event so list reflects the search query
				newInput.dispatchEvent(new Event('input', { bubbles: true }));
				if (listElAfter) listElAfter.scrollTop = savedScrollTop;
			}
		}
	}

	private renderFilterPanelBody(
		body: HTMLElement,
		activeView: CanvasItemView
	): void {
		if (this.activeFilterTab === 'color') {
			this.renderColorFilterList(body, activeView);
		} else if (this.activeFilterTab === 'label') {
			this.renderLabelFilterList(body, activeView);
		} else {
			this.renderTagFilterList(body, activeView);
		}
	}

	private async extractAllNodeColors(
		activeView: CanvasItemView
	): Promise<void> {
		const canvas = activeView.canvas;
		if (!canvas?.nodes) return;

		const includeAccents = this.plugin.settings.colorIncludeAccents ?? false;

		for (const node of canvas.nodes.values()) {
			const rawNode = node as unknown as { id: string };
			const nodeEl = node.nodeEl;
			if (!nodeEl || !rawNode.id) continue;
			const img =
				this.getNativeImageElement(nodeEl) ??
				nodeEl.querySelector<HTMLImageElement>('img');
			if (!img?.src) continue;
			if (this.nodeColorCache.has(rawNode.id)) continue;

			try {
				const colorName = await getNodeDominantColorName(
					img.src,
					includeAccents
				);
				this.nodeColorCache.set(rawNode.id, colorName);
			} catch {
				this.nodeColorCache.set(rawNode.id, null);
			}
		}

		if (
			this.tagFilterPanelEl?.isConnected &&
			this.activeFilterTab === 'color'
		) {
			this.applyTagFilters(activeView, true);
			this.refreshTagFilterPanel(activeView);
		}
	}

	private renderColorFilterList(
		body: HTMLElement,
		activeView: CanvasItemView
	): void {
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
			btnWrap.setCssProps({
				justifyContent: 'center',
				padding: '4px 8px',
				margin: '4px 8px 2px',
			});
			const extractBtn = btnWrap.createEl('button', {
				cls: 'mod-cta',
				text: t.colorExtractBtn ?? 'Extract Image Colors',
			});
			extractBtn.setCssProps({
				width: '100%',
				fontSize: '11px',
				height: '26px',
			});
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
		const hasAnyFilter =
			this.activeColorFilters.size > 0 ||
			this.activeColorExcludes.size > 0 ||
			this.activeTagFilters.size > 0 ||
			this.activeTagExcludes.size > 0;

		const includeAccents = this.plugin.settings.colorIncludeAccents ?? false;
		const includeNodeColor =
			this.plugin.settings.colorIncludeNodeColor ?? false;

		canvas.nodes.forEach((node) => {
			const rawNode = node as unknown as {
				id: string;
				color?: string;
				unknownData?: { color?: string };
			};
			const nodeEl = node.nodeEl;
			if (!nodeEl || !rawNode.id) return;
			const img =
				this.getNativeImageElement(nodeEl) ??
				nodeEl.querySelector<HTMLImageElement>('img');

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
					void getNodeDominantColorName(img.src, includeAccents).then(
						(names) => {
							this.nodeColorCache.set(rawNode.id, names);
							if (
								this.tagFilterPanelEl?.isConnected &&
								this.activeFilterTab === 'color'
							) {
								if (this.lazyExtractDebounceTimer !== null)
									window.clearTimeout(this.lazyExtractDebounceTimer);
								this.lazyExtractDebounceTimer = window.setTimeout(() => {
									this.lazyExtractDebounceTimer = null;
									this.refreshTagFilterPanel(activeView);
								}, 300);
							}
						}
					);
				} else if (Array.isArray(imageColors)) {
					nodeColorNames.push(...imageColors);
				}
			}

			// Deduplicate colors for this node
			if (nodeColorNames.length > 0) {
				const uniqueColors = Array.from(new Set(nodeColorNames));
				const isVisible =
					hasAnyFilter && !nodeEl.classList.contains('kambas-tag-hidden');
				for (const colorName of uniqueColors) {
					colorCounts.set(colorName, (colorCounts.get(colorName) ?? 0) + 1);
					if (isVisible) {
						visibleColorCounts.set(
							colorName,
							(visibleColorCounts.get(colorName) ?? 0) + 1
						);
					}
				}
			}
		});

		// ── 2. Search box (with embedded 'x' clear filter button) ────────────────
		const searchWrap = controlsWrap.createDiv({
			cls: 'kambas-tag-search-wrap',
		});
		const searchIcon = searchWrap.createSpan({ cls: 'kambas-tag-search-icon' });
		setIcon(searchIcon, 'search');
		const searchInput = searchWrap.createEl('input', {
			cls: 'kambas-tag-search',
			attr: {
				type: 'text',
				placeholder: t.searchColorsPlaceholder ?? 'Search colors…',
			},
		});

		// Clear 'x' button inside search bar (transferred from standalone button)
		const hasColorActivity =
			this.activeColorFilters.size > 0 || this.activeColorExcludes.size > 0;
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
		const togglesWrap = controlsWrap.createDiv({
			cls: 'kambas-color-toggles-wrap',
		});

		// Toggle: Include minor colors
		const minorToggleLabel = togglesWrap.createEl('label', {
			cls: 'kambas-accent-toggle-label',
		});
		const minorCheckbox = minorToggleLabel.createEl('input', {
			attr: { type: 'checkbox' },
		});
		minorCheckbox.checked = includeAccents;
		minorToggleLabel.createSpan({
			text: t.includeMinorColors ?? 'Include minor colors',
		});
		minorCheckbox.addEventListener('change', () => {
			this.plugin.settings.colorIncludeAccents = minorCheckbox.checked;
			void this.plugin.saveSettings();
			this.nodeColorCache.clear();
			void this.extractAllNodeColors(activeView);
		});

		// Toggle: Include node color (text cards, groups, borders)
		const nodeColorToggleLabel = togglesWrap.createEl('label', {
			cls: 'kambas-accent-toggle-label',
		});
		const nodeColorCheckbox = nodeColorToggleLabel.createEl('input', {
			attr: { type: 'checkbox' },
		});
		nodeColorCheckbox.checked = includeNodeColor;
		nodeColorToggleLabel.createSpan({
			text: t.includeCardColors ?? 'Include card colors',
		});
		nodeColorCheckbox.addEventListener('change', () => {
			this.plugin.settings.colorIncludeNodeColor = nodeColorCheckbox.checked;
			void this.plugin.saveSettings();
			this.applyTagFilters(activeView, true);
			this.refreshTagFilterPanel(activeView);
		});

		// Toggle: Display color name
		const showName = this.plugin.settings.colorShowName ?? true;
		const nameToggleLabel = togglesWrap.createEl('label', {
			cls: 'kambas-accent-toggle-label',
		});
		const nameCheckbox = nameToggleLabel.createEl('input', {
			attr: { type: 'checkbox' },
		});
		nameCheckbox.checked = showName;
		nameToggleLabel.createSpan({
			text: t.displayColorName ?? 'Display color name',
		});
		nameCheckbox.addEventListener('change', () => {
			this.plugin.settings.colorShowName = nameCheckbox.checked;
			void this.plugin.saveSettings();
			this.refreshTagFilterPanel(activeView);
		});

		if (canvas.nodes.size === 0) {
			body.createDiv({
				cls: 'kambas-tag-panel-empty',
				text: t.colorNoImages ?? 'No nodes found on canvas.',
			});
			return;
		}

		if (colorCounts.size === 0) {
			const emptyDiv = body.createDiv({
				cls: 'kambas-tag-panel-empty',
				text:
					extractMode === 'auto'
						? (t.extractingOrNoColors ?? 'Extracting or no colors found...')
						: (t.clickToExtractColors ??
							'Click button above to extract image colors.'),
			});
			if (
				this.activeColorFilters.size > 0 ||
				this.activeColorExcludes.size > 0
			) {
				const resetBtn = emptyDiv.createEl('button', {
					cls: 'mod-warning',
					text: t.colorClearFilter ?? 'Clear color filter',
				});
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
			const rawNode = node as unknown as {
				id: string;
				color?: string;
				unknownData?: { color?: string };
			};
			const nodeEl = node.nodeEl;
			if (!nodeEl || !rawNode.id) return;
			const img =
				this.getNativeImageElement(nodeEl) ??
				nodeEl.querySelector<HTMLImageElement>('img');

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
				if (!bucket) {
					bucket = [];
					colorToNodes.set(c, bucket);
				}
				bucket.push(nodeEl);
				// Tag the element so the canvas-node → row direction can read it
				const existing = nodeEl.getAttribute('data-kambas-colors') ?? '';
				if (!existing.split(',').includes(c)) {
					nodeEl.setAttribute(
						'data-kambas-colors',
						existing ? `${existing},${c}` : c
					);
				}
			}
		});

		// Canvas-node hover → highlight matching panel rows (event delegation)
		const canvasContainer = (
			activeView as unknown as { containerEl?: HTMLElement }
		).containerEl;
		const clearRowHighlights = (): void => {
			listEl.querySelectorAll('.is-related, .is-unrelated').forEach((el) => {
				el.classList.remove('is-related', 'is-unrelated');
			});
		};
		const onCanvasMouseOver = (e: Event): void => {
			const target = e.target as HTMLElement;
			const nodeEl = target.closest('[data-kambas-colors]');
			if (!nodeEl) {
				clearRowHighlights();
				return;
			}
			const nodeColors = new Set(
				(nodeEl.getAttribute('data-kambas-colors') ?? '')
					.split(',')
					.filter(Boolean)
			);
			if (nodeColors.size === 0) {
				clearRowHighlights();
				return;
			}
			listEl
				.querySelectorAll<HTMLElement>('[data-color-name]')
				.forEach((row) => {
					const cn = row.getAttribute('data-color-name') ?? '';
					row.classList.toggle('is-related', nodeColors.has(cn));
					row.classList.toggle('is-unrelated', !nodeColors.has(cn));
				});
		};
		const onCanvasMouseLeave = (): void => clearRowHighlights();

		// Tear down previous listeners then install new ones
		this.colorHighlightCleanup?.();
		if (canvasContainer) {
			canvasContainer.addEventListener('mouseover', onCanvasMouseOver);
			canvasContainer.addEventListener('mouseleave', onCanvasMouseLeave);
			this.colorHighlightCleanup = (): void => {
				canvasContainer.removeEventListener('mouseover', onCanvasMouseOver);
				canvasContainer.removeEventListener('mouseleave', onCanvasMouseLeave);
				// Remove all data-kambas-colors attributes on cleanup
				canvasContainer
					.querySelectorAll('[data-kambas-colors]')
					.forEach((el) => {
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
					const localizedColor =
						(t as unknown as Record<string, string>)[`color${colorName}`] ??
						colorName;
					return (
						colorName.toLowerCase().includes(lower) ||
						localizedColor.toLowerCase().includes(lower)
					);
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
				if (
					hasAnyFilter &&
					!dividerInserted &&
					!isRelated &&
					visibleColorCounts.size > 0
				) {
					dividerInserted = true;
					const divider = listEl.createDiv({ cls: 'kambas-color-divider' });
					divider.createSpan({
						text: t.notInCurrentView ?? 'Not in current view',
					});
				}

				const rowCls =
					'kambas-tag-panel-item' +
					(isIncluded ? ' is-active' : '') +
					(isExcluded ? ' is-excluded' : '') +
					(!isRelated && hasAnyFilter ? ' is-not-in-view' : '');
				const row = listEl.createDiv({ cls: rowCls });
				// Tag row for canvas-node → row highlight direction
				row.setAttribute('data-color-name', colorName);

				const checkEl = row.createSpan({ cls: 'kambas-tag-panel-check' });
				setIcon(
					checkEl,
					isIncluded ? 'check-square' : isExcluded ? 'x-square' : 'square'
				);

				const dot = row.createSpan({ cls: 'kambas-color-dot' });
				if (colorHexMap[colorName]) {
					dot.style.backgroundColor = colorHexMap[colorName];
				}

				if (showName) {
					const localizedColor =
						(t as unknown as Record<string, string>)[`color${colorName}`] ??
						colorName;
					row.createSpan({
						cls: 'kambas-tag-panel-pill',
						text: localizedColor,
					});
				}

				// Right-aligned counts wrapper for consistent alignment
				const countsWrap = row.createDiv({ cls: 'kambas-tag-panel-counts' });

				// Show "N in view" badge alongside the total when a filter is active
				if (isRelated) {
					countsWrap.createSpan({
						cls: 'kambas-tag-panel-count kambas-in-view-count',
						text: t.inViewCount
							? t.inViewCount(visibleCount)
							: `${visibleCount} in view`,
					});
				}
				// Single general term: "12 items" / "1 item"
				const countText = t.itemCount
					? t.itemCount(count)
					: `${count} ${count === 1 ? 'item' : 'items'}`;
				countsWrap.createSpan({
					cls: 'kambas-tag-panel-count',
					text: countText,
				});

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
				listEl.createDiv({
					cls: 'kambas-tag-panel-empty',
					text: t.noColorsMatch ?? 'No colors match.',
				});
			}
		};

		renderColorList('');
		searchInput.addEventListener('input', () =>
			renderColorList(searchInput.value)
		);
	}

	private renderTagFilterList(
		body: HTMLElement,
		activeView: CanvasItemView
	): void {
		body.empty();
		const t = getText();
		const canvas = activeView.canvas;
		if (!canvas?.nodes) return;

		const hasAnyFilter =
			this.activeTagFilters.size > 0 ||
			this.activeTagExcludes.size > 0 ||
			this.activeColorFilters.size > 0 ||
			this.activeColorExcludes.size > 0;

		// Build tag → total count, and tag → visible count maps
		const tagMap = new Map<string, number>();
		const visibleTagCounts = new Map<string, number>();
		canvas.nodes.forEach((node) => {
			const uData = (
				node as unknown as { unknownData?: { kambasTags?: string[] } }
			).unknownData;
			const isVisible =
				hasAnyFilter && !node.nodeEl?.classList.contains('kambas-tag-hidden');
			for (const tag of uData?.kambasTags ?? []) {
				if (!tag.trim()) continue;
				tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
				if (isVisible) {
					visibleTagCounts.set(tag, (visibleTagCounts.get(tag) ?? 0) + 1);
				}
			}
		});

		if (tagMap.size === 0) {
			const emptyDiv = body.createDiv({
				cls: 'kambas-tag-panel-empty',
				text: t.noTagsOnCanvas ?? 'No tags on this canvas yet.',
			});
			if (this.activeTagFilters.size > 0) {
				const resetBtn = emptyDiv.createEl('button', {
					cls: 'mod-warning',
					text: t.resetActiveFilter ?? 'Reset active filter',
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
			attr: {
				type: 'text',
				placeholder: t.searchTagsPlaceholder ?? 'Search tags…',
			},
		});
		// Clear × lives inside the search bar — always in the DOM, no layout shift
		const hasTagActivity =
			this.activeTagFilters.size > 0 || this.activeTagExcludes.size > 0;
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

		// ── Cross-highlight setup ─────────────────────────────────────────────────
		// Build tag → nodeEl[] map so row-hover can outline matching elements
		const tagToNodes = new Map<string, HTMLElement[]>();
		canvas.nodes.forEach((node) => {
			const uData = (
				node as unknown as { unknownData?: { kambasTags?: string[] } }
			).unknownData;
			const nodeEl = node.nodeEl;
			if (!nodeEl) return;
			const tags = uData?.kambasTags ?? [];
			if (tags.length === 0) return;

			for (const tag of new Set(tags)) {
				if (!tag.trim()) continue;
				let bucket = tagToNodes.get(tag);
				if (!bucket) {
					bucket = [];
					tagToNodes.set(tag, bucket);
				}
				bucket.push(nodeEl);
				const existing = nodeEl.getAttribute('data-kambas-tags') ?? '';
				const tagList = existing ? existing.split(',') : [];
				if (!tagList.includes(tag)) {
					tagList.push(tag);
					nodeEl.setAttribute('data-kambas-tags', tagList.join(','));
				}
			}
		});

		// Canvas-node hover → highlight matching panel tag rows
		const canvasContainer = (
			activeView as unknown as { containerEl?: HTMLElement }
		).containerEl;
		const clearTagRowHighlights = (): void => {
			listEl.querySelectorAll('.is-related, .is-unrelated').forEach((el) => {
				el.classList.remove('is-related', 'is-unrelated');
			});
		};
		const onCanvasTagMouseOver = (e: Event): void => {
			const target = e.target as HTMLElement;
			const nodeEl = target.closest('[data-kambas-tags]');
			if (!nodeEl) {
				clearTagRowHighlights();
				return;
			}
			const nodeTags = new Set(
				(nodeEl.getAttribute('data-kambas-tags') ?? '')
					.split(',')
					.filter(Boolean)
			);
			if (nodeTags.size === 0) {
				clearTagRowHighlights();
				return;
			}
			listEl.querySelectorAll<HTMLElement>('[data-tag-name]').forEach((row) => {
				const tn = row.getAttribute('data-tag-name') ?? '';
				row.classList.toggle('is-related', nodeTags.has(tn));
				row.classList.toggle('is-unrelated', !nodeTags.has(tn));
			});
		};
		const onCanvasTagMouseLeave = (): void => clearTagRowHighlights();

		this.tagHighlightCleanup?.();
		if (canvasContainer) {
			canvasContainer.addEventListener('mouseover', onCanvasTagMouseOver);
			canvasContainer.addEventListener('mouseleave', onCanvasTagMouseLeave);
			this.tagHighlightCleanup = (): void => {
				canvasContainer.removeEventListener('mouseover', onCanvasTagMouseOver);
				canvasContainer.removeEventListener(
					'mouseleave',
					onCanvasTagMouseLeave
				);
				canvasContainer.querySelectorAll('[data-kambas-tags]').forEach((el) => {
					el.removeAttribute('data-kambas-tags');
				});
			};
		}

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
				if (
					hasAnyFilter &&
					!dividerInserted &&
					!isRelated &&
					visibleTagCounts.size > 0
				) {
					dividerInserted = true;
					const divider = listEl.createDiv({ cls: 'kambas-color-divider' });
					divider.createSpan({
						text: t.notInCurrentView ?? 'Not in current view',
					});
				}

				const rowCls =
					'kambas-tag-panel-item' +
					(isIncluded ? ' is-active' : '') +
					(isExcluded ? ' is-excluded' : '') +
					(!isRelated && hasAnyFilter ? ' is-not-in-view' : '');
				const row = listEl.createDiv({ cls: rowCls });
				row.setAttribute('data-tag-name', tag);

				// Row hover → outline matching canvas nodes
				row.addEventListener('mouseenter', () => {
					const nodes = tagToNodes.get(tag) ?? [];
					nodes.forEach((el) => el.classList.add('kambas-color-highlight'));
				});
				row.addEventListener('mouseleave', () => {
					const nodes = tagToNodes.get(tag) ?? [];
					nodes.forEach((el) => el.classList.remove('kambas-color-highlight'));
				});

				const checkEl = row.createSpan({ cls: 'kambas-tag-panel-check' });
				setIcon(
					checkEl,
					isIncluded ? 'check-square' : isExcluded ? 'x-square' : 'square'
				);
				const tagPill = row.createSpan({
					cls: 'kambas-tag-panel-pill',
					text: `#${tag}`,
				});
				const tagColorsMap = this.plugin.settings.tagColors ?? {};
				const customColor = tagColorsMap[tag.toLowerCase()];
				if (customColor?.bg || customColor?.text) {
					tagPill.addClass('has-custom-color');
					if (customColor.bg) tagPill.style.backgroundColor = customColor.bg;
					if (customColor.text) tagPill.style.color = customColor.text;
				}

				// Right-aligned counts wrapper for consistent alignment
				const countsWrap = row.createDiv({ cls: 'kambas-tag-panel-counts' });

				// "N in view" badge when a filter is active
				if (isRelated) {
					countsWrap.createSpan({
						cls: 'kambas-tag-panel-count kambas-in-view-count',
						text: t.inViewCount
							? t.inViewCount(visibleCount)
							: `${visibleCount} in view`,
					});
				}
				countsWrap.createSpan({
					cls: 'kambas-tag-panel-count',
					text: t.tagNodesCount(count),
				});

				// Native Obsidian menu button (Rename, Add color to tags, Delete)
				const menuBtn = row.createSpan({
					cls: 'kambas-tag-panel-menu-btn',
				});
				setIcon(menuBtn, 'ellipsis-vertical');
				menuBtn.setAttribute(
					'aria-label',
					t.tagItemMenuTooltip ?? 'Tag options'
				);
				menuBtn.addEventListener('click', (ev) => {
					ev.stopPropagation();
					ev.preventDefault();

					const menu = new Menu();

					// 1. Rename
					menu.addItem((item) => {
						item
							.setTitle(t.renameTag ?? 'Rename')
							.setIcon('pencil')
							.onClick(() => {
								new TagRenameModal(this.app, tag, (newTag) => {
									void this.renameTagOnCanvas(activeView, tag, newTag);
								}).open();
							});
					});

					// 2. Add color to tags
					menu.addItem((item) => {
						item
							.setTitle(t.setTagColor ?? 'Add color to tag')
							.setIcon('palette')
							.onClick(() => {
								this.promptSetTagColor(activeView, tag);
							});
					});

					// 3. Trash / Delete
					menu.addItem((item) => {
						item
							.setTitle(t.deleteTag ?? 'Delete tag')
							.setIcon('trash-2')
							.setWarning(true)
							.onClick(() => {
								void this.deleteTagFromCanvas(activeView, tag);
							});
					});

					menu.showAtMouseEvent(ev);
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
				listEl.createDiv({
					cls: 'kambas-tag-panel-empty',
					text: t.noTagsMatch ?? 'No tags match.',
				});
			}
		};

		renderList('');
		searchInput.addEventListener('input', () => renderList(searchInput.value));
	}

	private isEmbeddedMediaNode(
		rawNode: {
			type?: string;
			url?: string;
			file?: unknown;
			unknownData?: { type?: string; url?: string };
		},
		canvasDataNode?: { type?: string; url?: string; file?: unknown },
		nodeEl?: HTMLElement
	): boolean {
		// Vault file nodes (type === 'file' or has file property) are NEVER embedded media
		const isFile =
			canvasDataNode?.type === 'file' ||
			rawNode.type === 'file' ||
			Boolean(canvasDataNode?.file) ||
			Boolean(rawNode.file);
		if (isFile) return false;

		const isLink =
			canvasDataNode?.type === 'link' ||
			rawNode.type === 'link' ||
			rawNode.unknownData?.type === 'link';
		const hasUrl = Boolean(
			canvasDataNode?.url || rawNode.url || rawNode.unknownData?.url
		);

		const hasEmbeddedImg = nodeEl
			? Boolean(
					nodeEl.classList.contains('kambas-has-embedded-img') ||
					nodeEl.querySelector('img.kambas-embedded-img') ||
					nodeEl.querySelector('.canvas-node-content img')
			  )
			: false;

		return isLink || hasUrl || hasEmbeddedImg;
	}

	private getNodeLabel(
		rawNode: {
			id?: string;
			type?: string;
			label?: string;
			file?: unknown;
			url?: string;
			unknownData?: { label?: string; type?: string; url?: string };
		},
		canvasDataNode?: { id?: string; type?: string; label?: string; file?: string; url?: string }
	): string {
		const explicitLabel = (
			canvasDataNode?.label ||
			rawNode.label ||
			rawNode.unknownData?.label ||
			''
		).trim();
		if (explicitLabel) return explicitLabel;

		const rawFile = rawNode.file;
		const filePath =
			canvasDataNode?.file ||
			(typeof rawFile === 'string'
				? rawFile
				: (rawFile as { path?: string; name?: string; basename?: string } | null)?.basename ||
					(rawFile as { path?: string; name?: string; basename?: string } | null)?.name ||
					(rawFile as { path?: string; name?: string; basename?: string } | null)?.path);
		if (filePath && typeof filePath === 'string') {
			if (filePath.startsWith('data:') || filePath.includes('base64,')) {
				return '';
			}
			const parts = filePath.split('/');
			const filename = parts[parts.length - 1] || filePath;
			return filename.trim();
		}

		const url = (
			canvasDataNode?.url ||
			rawNode.url ||
			rawNode.unknownData?.url ||
			''
		).trim();
		if (url) {
			if (
				url.startsWith('data:') ||
				url.includes('base64,') ||
				url.length > 200
			) {
				return '';
			}
			const parts = url.split('/');
			const filename = parts[parts.length - 1] || url;
			return filename.trim();
		}

		return '';
	}

	private renderLabelFilterList(
		body: HTMLElement,
		activeView: CanvasItemView
	): void {
		body.empty();
		const t = getText();
		const canvas = activeView.canvas;
		if (!canvas?.nodes) return;

		const rawCanvasData = (
			canvas as unknown as {
				data?: { nodes?: Array<{ id?: string; label?: string; file?: string; url?: string }> };
			}
		)?.data;
		const dataNodesMap = new Map<string, { id?: string; label?: string; file?: string; url?: string }>();
		if (rawCanvasData?.nodes) {
			for (const n of rawCanvasData.nodes) {
				if (n.id) dataNodesMap.set(n.id, n);
			}
		}

		const hasAnyFilter =
			this.activeTagFilters.size > 0 ||
			this.activeTagExcludes.size > 0 ||
			this.activeColorFilters.size > 0 ||
			this.activeColorExcludes.size > 0 ||
			this.activeLabelFilters.size > 0 ||
			this.activeLabelExcludes.size > 0;

		const labelMap = new Map<string, number>();
		const visibleLabelCounts = new Map<string, number>();
		const labelToNodes = new Map<string, HTMLElement[]>();

		canvas.nodes.forEach((node) => {
			const rawNode = node as unknown as {
				id?: string;
				label?: string;
				file?: string | { path?: string; name?: string; basename?: string };
				url?: string;
				unknownData?: { label?: string };
			};
			const nodeEl = node.nodeEl;
			if (!nodeEl || !rawNode.id) return;

			const canvasDataNode = dataNodesMap.get(rawNode.id);
			const nodeLabel = this.getNodeLabel(rawNode, canvasDataNode);

			if (!nodeLabel) return;

			const isVisible =
				hasAnyFilter && !nodeEl.classList.contains('kambas-tag-hidden');

			labelMap.set(nodeLabel, (labelMap.get(nodeLabel) ?? 0) + 1);
			if (isVisible) {
				visibleLabelCounts.set(
					nodeLabel,
					(visibleLabelCounts.get(nodeLabel) ?? 0) + 1
				);
			}

			let bucket = labelToNodes.get(nodeLabel);
			if (!bucket) {
				bucket = [];
				labelToNodes.set(nodeLabel, bucket);
			}
			bucket.push(nodeEl);
		});

		if (labelMap.size === 0) {
			const emptyDiv = body.createDiv({
				cls: 'kambas-tag-panel-empty',
				text: t.noLabelsFound ?? 'No labels found on canvas.',
			});
			if (
				this.activeLabelFilters.size > 0 ||
				this.activeLabelExcludes.size > 0
			) {
				const resetBtn = emptyDiv.createEl('button', {
					cls: 'mod-warning',
					text: t.labelClearFilter ?? 'Clear label filter',
				});
				resetBtn.setCssProps({ marginTop: '10px' });
				resetBtn.addEventListener('click', () => {
					this.activeLabelFilters.clear();
					this.activeLabelExcludes.clear();
					this.applyTagFilters(activeView, true);
					this.refreshTagFilterPanel(activeView);
				});
			}
			return;
		}

		// ── Controls / Search Wrap ────────────────────────────────────────────
		const controlsWrap = body.createDiv({ cls: 'kambas-color-controls' });
		const searchWrap = controlsWrap.createDiv({
			cls: 'kambas-tag-search-wrap',
		});
		const searchIcon = searchWrap.createSpan({ cls: 'kambas-tag-search-icon' });
		setIcon(searchIcon, 'search');
		const searchInput = searchWrap.createEl('input', {
			cls: 'kambas-tag-search',
			attr: {
				type: 'text',
				placeholder: t.searchLabelsPlaceholder ?? 'Search labels…',
			},
		});

		const hasLabelActivity =
			this.activeLabelFilters.size > 0 || this.activeLabelExcludes.size > 0;
		const clearInSearch = searchWrap.createEl('button', {
			cls: 'kambas-tag-search-clear' + (hasLabelActivity ? '' : ' is-hidden'),
			attr: { 'aria-label': t.labelClearFilter ?? 'Clear label filter' },
		});
		setIcon(clearInSearch, 'x');
		clearInSearch.addEventListener('click', () => {
			this.activeLabelFilters.clear();
			this.activeLabelExcludes.clear();
			this.applyTagFilters(activeView, true);
			this.refreshTagFilterPanel(activeView);
		});

		// ── Scrollable Label List ─────────────────────────────────────────────
		const listEl = body.createDiv({ cls: 'kambas-tag-panel-list' });

		// Sort labels alphabetically (case-insensitive)
		const sortedLabels = Array.from(labelMap.keys()).sort((a, b) =>
			a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })
		);

		const renderLabelList = (query: string): void => {
			listEl.empty();
			const cleanQuery = query.trim().toLowerCase();

			for (const labelName of sortedLabels) {
				if (cleanQuery && !labelName.toLowerCase().includes(cleanQuery)) {
					continue;
				}
				const count = labelMap.get(labelName) ?? 0;
				const visibleCount = visibleLabelCounts.get(labelName) ?? 0;
				const isIncluded = this.activeLabelFilters.has(labelName);
				const isExcluded = this.activeLabelExcludes.has(labelName);
				const isRelated = hasAnyFilter && visibleCount > 0;

				const rowCls =
					'kambas-tag-panel-item' +
					(isIncluded ? ' is-active' : '') +
					(isExcluded ? ' is-excluded' : '') +
					(isRelated ? ' is-related' : '') +
					(!isRelated && hasAnyFilter ? ' is-not-in-view' : '');
				const row = listEl.createDiv({ cls: rowCls });
				row.setAttribute('data-label-name', labelName);

				const checkEl = row.createSpan({ cls: 'kambas-tag-panel-check' });
				setIcon(
					checkEl,
					isIncluded ? 'check-square' : isExcluded ? 'x-square' : 'square'
				);

				row.createSpan({
					cls: 'kambas-tag-panel-pill kambas-label-panel-pill',
					text: labelName,
					attr: { title: labelName },
				});

				const countsWrap = row.createDiv({ cls: 'kambas-tag-panel-counts' });

				if (isRelated) {
					countsWrap.createSpan({
						cls: 'kambas-tag-panel-count kambas-in-view-count',
						text: t.inViewCount
							? t.inViewCount(visibleCount)
							: `${visibleCount} in view`,
					});
				}

				const countText = t.labelNodesCount
					? t.labelNodesCount(count)
					: `${count} ${count === 1 ? 'item' : 'items'}`;
				countsWrap.createSpan({
					cls: 'kambas-tag-panel-count',
					text: countText,
				});

				// Hover effect
				row.addEventListener('mouseenter', () => {
					const nodes = labelToNodes.get(labelName) ?? [];
					nodes.forEach((el) => el.classList.add('kambas-color-highlight'));
				});
				row.addEventListener('mouseleave', () => {
					const nodes = labelToNodes.get(labelName) ?? [];
					nodes.forEach((el) => el.classList.remove('kambas-color-highlight'));
				});

				// 3-state cycle: neutral → include → exclude → neutral
				row.addEventListener('click', () => {
					if (this.activeLabelFilters.has(labelName)) {
						this.activeLabelFilters.delete(labelName);
						this.activeLabelExcludes.add(labelName);
					} else if (this.activeLabelExcludes.has(labelName)) {
						this.activeLabelExcludes.delete(labelName);
					} else {
						this.activeLabelFilters.add(labelName);
					}
					this.applyTagFilters(activeView, true);
					this.refreshTagFilterPanel(activeView);
				});
			}

			if (sortedLabels.length === 0 || listEl.children.length === 0) {
				listEl.createDiv({
					cls: 'kambas-tag-panel-empty',
					text: t.noLabelsFound ?? 'No labels match.',
				});
			}
		};

		renderLabelList('');
		searchInput.addEventListener('input', () =>
			renderLabelList(searchInput.value)
		);
	}

	public async deleteTagFromCanvas(
		activeView: CanvasItemView,
		tagToDelete: string
	): Promise<void> {
		const canvas = activeView.canvas;
		if (!canvas?.nodes) return;

		canvas.nodes.forEach((node) => {
			const rawNode = node as unknown as {
				unknownData?: { kambasTags?: string[] };
			};
			const tags = rawNode.unknownData?.kambasTags ?? [];
			if (!tags.includes(tagToDelete)) return;
			const newTags = tags.filter((tg) => tg !== tagToDelete);
			if (rawNode.unknownData) {
				rawNode.unknownData.kambasTags =
					newTags.length > 0 ? newTags : undefined;
			}
			if (node.nodeEl.instanceOf(HTMLElement))
				this.renderTagBadges(node.nodeEl, newTags);
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

	private async persistDeleteTag(
		file: TFile,
		tagToDelete: string
	): Promise<void> {
		const content = await this.app.vault.read(file);
		let data: CanvasFileData;
		try {
			data = JSON.parse(content) as CanvasFileData;
		} catch {
			return;
		}
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

	public promptSetTagColor(activeView: CanvasItemView, tag: string): void {
		const currentColors = this.plugin.settings.tagColors?.[tag.toLowerCase()];
		new TagColorModal(this.app, tag, currentColors, (newColors) => {
			if (!this.plugin.settings.tagColors) {
				this.plugin.settings.tagColors = {};
			}
			const tagKey = tag.toLowerCase();
			if (newColors && (newColors.text || newColors.bg)) {
				this.plugin.settings.tagColors[tagKey] = newColors;
			} else {
				delete this.plugin.settings.tagColors[tagKey];
			}
			void this.plugin.saveSettings().then(() => {
				const canvas = activeView.canvas;
				if (canvas?.nodes) {
					canvas.nodes.forEach((node) => {
						const uData = (
							node as unknown as { unknownData?: { kambasTags?: string[] } }
						).unknownData;
						const tags = uData?.kambasTags ?? [];
						if (node.nodeEl?.instanceOf(HTMLElement)) {
							this.renderTagBadges(node.nodeEl, tags, true);
						}
					});
				}
				this.refreshTagFilterPanel(activeView);
			});
		}).open();
	}

	public async renameTagOnCanvas(
		activeView: CanvasItemView,
		oldTag: string,
		newTag: string
	): Promise<void> {
		const canvas = activeView.canvas;
		if (!canvas?.nodes || !newTag || oldTag === newTag) return;

		let modifiedAny = false;

		canvas.nodes.forEach((node) => {
			const rawNode = node as unknown as {
				unknownData?: { kambasTags?: string[] };
			};
			const tags = rawNode.unknownData?.kambasTags ?? [];
			if (!tags.includes(oldTag)) return;

			const nextTags: string[] = [];
			for (const t of tags) {
				if (t === oldTag) {
					if (!nextTags.includes(newTag)) nextTags.push(newTag);
				} else {
					if (!nextTags.includes(t)) nextTags.push(t);
				}
			}

			if (rawNode.unknownData) {
				rawNode.unknownData.kambasTags = nextTags;
			}
			modifiedAny = true;

			if (node.nodeEl.instanceOf(HTMLElement)) {
				this.renderTagBadges(node.nodeEl, nextTags, true);
			}
		});

		if (this.activeTagFilters.has(oldTag)) {
			this.activeTagFilters.delete(oldTag);
			this.activeTagFilters.add(newTag);
		}
		if (this.activeTagExcludes.has(oldTag)) {
			this.activeTagExcludes.delete(oldTag);
			this.activeTagExcludes.add(newTag);
		}

		const tagColorsMap = this.plugin.settings.tagColors;
		if (tagColorsMap && tagColorsMap[oldTag.toLowerCase()]) {
			tagColorsMap[newTag.toLowerCase()] = tagColorsMap[oldTag.toLowerCase()];
			delete tagColorsMap[oldTag.toLowerCase()];
			void this.plugin.saveSettings();
		}

		const file = activeView.file;
		if (file) this.saveFilterState(file);

		if (file && modifiedAny) {
			await this.persistRenameTag(file, oldTag, newTag);
		}

		window.setTimeout(() => {
			this.applyTagFilters(activeView);
			this.refreshTagFilterPanel(activeView);
		}, 80);
	}

	private async persistRenameTag(
		file: TFile,
		oldTag: string,
		newTag: string
	): Promise<void> {
		const content = await this.app.vault.read(file);
		let data: CanvasFileData;
		try {
			data = JSON.parse(content) as CanvasFileData;
		} catch {
			return;
		}
		if (!Array.isArray(data.nodes)) return;
		let modified = false;
		for (const node of data.nodes) {
			const nd = node as unknown as { kambasTags?: string[] };
			const tags = nd.kambasTags;
			if (!tags?.includes(oldTag)) continue;

			const next: string[] = [];
			for (const t of tags) {
				if (t === oldTag) {
					if (!next.includes(newTag)) next.push(newTag);
				} else {
					if (!next.includes(t)) next.push(t);
				}
			}
			nd.kambasTags = next;
			modified = true;
		}
		if (modified) this.scheduleVaultModify(file, data);
	}

	private updateToolbarButtonState(): void {
		if (!this.tagToolbarBtn) return;
		const filtersActive =
			this.activeTagFilters.size > 0 ||
			this.activeTagExcludes.size > 0 ||
			this.activeColorFilters.size > 0 ||
			this.activeColorExcludes.size > 0 ||
			this.activeLabelFilters.size > 0 ||
			this.activeLabelExcludes.size > 0;
		const panelOpen = this.tagFilterPanelEl?.isConnected ?? false;
		this.tagToolbarBtn.classList.toggle(
			'is-active',
			filtersActive || panelOpen
		);
		this.tagToolbarBtn.classList.toggle('has-filter', filtersActive);

		if (this.tagToolbarClearBtn) {
			this.tagToolbarClearBtn.style.display = filtersActive ? '' : 'none';
		}
	}

	private saveFilterState(file: TFile): void {
		try {
			this.activeTagFiltersFile = file.path;
			const key = `kambas-filters:${file.path}`;
			const hasAny =
				this.activeTagFilters.size > 0 ||
				this.activeTagExcludes.size > 0 ||
				this.activeColorFilters.size > 0 ||
				this.activeColorExcludes.size > 0 ||
				this.activeLabelFilters.size > 0 ||
				this.activeLabelExcludes.size > 0;
			if (hasAny) {
				this.app.saveLocalStorage(
					key,
					JSON.stringify({
						include: [...this.activeTagFilters],
						exclude: [...this.activeTagExcludes],
						colorInclude: [...this.activeColorFilters],
						colorExclude: [...this.activeColorExcludes],
						labelInclude: [...this.activeLabelFilters],
						labelExclude: [...this.activeLabelExcludes],
					})
				);
			} else {
				this.app.saveLocalStorage(key, null);
			}
		} catch {
			/* ignore */
		}
	}

	private restoreFilterState(file: TFile, activeView: CanvasItemView): void {
		try {
			this.activeTagFiltersFile = file.path;
			const key = `kambas-filters:${file.path}`;
			const raw = this.app.loadLocalStorage(key) as string | null;
			if (!raw) {
				this.activeTagFilters.clear();
				this.activeTagExcludes.clear();
				this.activeColorFilters.clear();
				this.activeColorExcludes.clear();
				this.activeLabelFilters.clear();
				this.activeLabelExcludes.clear();
				this.applyTagFilters(activeView);
				return;
			}
			const parsed = JSON.parse(raw) as
				| string[]
				| {
						include?: string[];
						exclude?: string[];
						colorInclude?: string[];
						colorExclude?: string[];
						labelInclude?: string[];
						labelExclude?: string[];
				  };
			if (Array.isArray(parsed)) {
				this.activeTagFilters = new Set(parsed);
				this.activeTagExcludes.clear();
				this.activeColorFilters.clear();
				this.activeColorExcludes.clear();
				this.activeLabelFilters.clear();
				this.activeLabelExcludes.clear();
			} else {
				this.activeTagFilters = new Set(parsed.include ?? []);
				this.activeTagExcludes = new Set(parsed.exclude ?? []);
				this.activeColorFilters = new Set(parsed.colorInclude ?? []);
				this.activeColorExcludes = new Set(parsed.colorExclude ?? []);
				this.activeLabelFilters = new Set(parsed.labelInclude ?? []);
				this.activeLabelExcludes = new Set(parsed.labelExclude ?? []);
			}

			this.applyTagFilters(activeView);
			this.updateToolbarButtonState();
		} catch {
			/* ignore */
		}
	}

	private installSelectionGuard(activeView: CanvasItemView): void {
		this.removeSelectionGuard();
		const canvas = activeView.canvas;
		if (!canvas) return;
		const container = (activeView as unknown as { containerEl?: HTMLElement })
			.containerEl;
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
				const isNodeSelected =
					el.classList.contains('is-selected') || cx.selection?.has(node);
				if (!isNodeSelected) return;

				deselectedAny = true;
				el.classList.remove('is-selected');

				const nu = node as unknown as { unselect?: () => void };
				if (typeof nu.unselect === 'function') {
					try {
						nu.unselect();
					} catch {
						/* ignore */
					}
				}
				try {
					cx.selection?.delete(node);
				} catch {
					/* ignore */
				}
			});

			if (deselectedAny && typeof cx.updateSelection === 'function') {
				try {
					cx.updateSelection();
				} catch {
					/* ignore */
				}
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
		type CanvasProto = {
			selectAll?: (nodes?: Set<object>) => void;
			select?: (node: object) => void;
		};
		const origCanvas = canvas as unknown as CanvasProto;
		let origSelectAll: ((nodes?: Set<object>) => void) | undefined = undefined;

		if (typeof origCanvas.selectAll === 'function') {
			origSelectAll = origCanvas.selectAll;
			origCanvas.selectAll = function (nodes?: Set<object>): void {
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
			if (
				(evt.ctrlKey || evt.metaKey) &&
				(evt.key === 'a' || evt.key === 'A')
			) {
				const target = evt.target as HTMLElement | null;
				if (
					target &&
					(target.tagName === 'INPUT' ||
						target.tagName === 'TEXTAREA' ||
						target.isContentEditable)
				) {
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

		mo.observe(container, {
			attributes: true,
			subtree: true,
			attributeFilter: ['class'],
		});
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

	private applyTagFilters(
		activeView: CanvasItemView,
		performZoom = false
	): void {
		const canvas = activeView.canvas;
		if (!canvas?.nodes) return;
		const allowZoom =
			performZoom && (this.plugin.settings.tagZoomOnSelect ?? true);
		const hasTagIncludes = this.activeTagFilters.size > 0;
		const hasTagExcludes = this.activeTagExcludes.size > 0;
		const hasColorIncludes = this.activeColorFilters.size > 0;
		const hasColorExcludes = this.activeColorExcludes.size > 0;
		const hasLabelIncludes = this.activeLabelFilters.size > 0;
		const hasLabelExcludes = this.activeLabelExcludes.size > 0;

		const hasAnyFilter =
			hasTagIncludes ||
			hasTagExcludes ||
			hasColorIncludes ||
			hasColorExcludes ||
			hasLabelIncludes ||
			hasLabelExcludes;

		if (!hasAnyFilter) {
			canvas.nodes.forEach((node) =>
				node.nodeEl?.classList.remove('kambas-tag-hidden')
			);
			this.removeSelectionGuard();
			if (allowZoom) {
				window.setTimeout(() => this.zoomToVisibleNodes(activeView), 80);
			}
			this.scanAndRestoreTransforms(activeView);
		} else {
			const rawCanvasData = (
				canvas as unknown as {
					data?: { nodes?: Array<{ id?: string; label?: string; file?: string; url?: string }> };
				}
			)?.data;
			const dataNodesMap = new Map<string, { id?: string; label?: string; file?: string; url?: string }>();
			if (rawCanvasData?.nodes) {
				for (const n of rawCanvasData.nodes) {
					if (n.id) dataNodesMap.set(n.id, n);
				}
			}

			canvas.nodes.forEach((node) => {
				const rawNode = node as unknown as {
					id: string;
					label?: string;
					file?: string | { path?: string; name?: string; basename?: string };
					url?: string;
					unknownData?: { kambasTags?: string[]; label?: string };
				};
				const nodeTags = rawNode.unknownData?.kambasTags ?? [];

				// ── Include checks: node must satisfy ALL active include criteria ──
				const tagIncludeOk =
					!hasTagIncludes ||
					nodeTags.some((tag) => this.activeTagFilters.has(tag));

				const includeNodeColor =
					this.plugin.settings.colorIncludeNodeColor ?? false;
				const rawNodeWithColor = node as unknown as {
					id: string;
					color?: string;
					unknownData?: { color?: string; kambasTags?: string[] };
				};
				const cachedColors = this.nodeColorCache.get(rawNodeWithColor.id);
				const nodeColors: string[] = Array.isArray(cachedColors)
					? [...cachedColors]
					: [];

				if (includeNodeColor) {
					const customColor =
						rawNodeWithColor.color ?? rawNodeWithColor.unknownData?.color;
					if (typeof customColor === 'string' && customColor) {
						const namedColor = canvasNodePresetColorToName(customColor);
						if (namedColor && !nodeColors.includes(namedColor)) {
							nodeColors.push(namedColor);
						}
					}
				}

				const colorIncludeOk =
					!hasColorIncludes ||
					nodeColors.some((c) => this.activeColorFilters.has(c));

				const canvasDataNode = dataNodesMap.get(rawNode.id);
				const nodeLabel = this.getNodeLabel(rawNode, canvasDataNode);

				const labelIncludeOk =
					!hasLabelIncludes ||
					(Boolean(nodeLabel) && this.activeLabelFilters.has(nodeLabel));

				// ── Exclude checks: hide if node has ANY excluded tag, color, or label ──
				const tagExcluded =
					hasTagExcludes &&
					nodeTags.some((tag) => this.activeTagExcludes.has(tag));
				const colorExcluded =
					hasColorExcludes &&
					nodeColors.some((c) => this.activeColorExcludes.has(c));
				const labelExcluded =
					hasLabelExcludes &&
					Boolean(nodeLabel) &&
					this.activeLabelExcludes.has(nodeLabel);

				// Visible = passes all includes AND passes all excludes
				const matches =
					tagIncludeOk &&
					colorIncludeOk &&
					labelIncludeOk &&
					!tagExcluded &&
					!colorExcluded &&
					!labelExcluded;
				node.nodeEl?.classList.toggle('kambas-tag-hidden', !matches);
			});
			this.installSelectionGuard(activeView);
			if (allowZoom) {
				window.setTimeout(() => this.zoomToVisibleNodes(activeView), 80);
			}
		}
		const file = activeView.file;
		if (file) this.saveFilterState(file);
		this.updateToolbarButtonState();
	}

	/** Zoom / pan the canvas to fit all nodes that are not hidden by tag filter. */
	private zoomToVisibleNodes(activeView: CanvasItemView): void {
		const canvas = activeView.canvas;
		if (!canvas?.nodes) return;

		let minX = Infinity,
			minY = Infinity,
			maxX = -Infinity,
			maxY = -Infinity;
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
			this.triggerSmoothPositionUpdates(activeView);
			window.setTimeout(() => {
				this.scanAndRestoreTransforms(activeView);
			}, 350);
			return;
		}

		// Manual fallback: compute pan+zoom from canvas transform formula
		// screen_pos = canvas_pos * zoom + (viewport_center + translation)
		const container = (activeView as unknown as { containerEl?: HTMLElement })
			.containerEl;
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
		const container = (activeView as unknown as { containerEl?: HTMLElement })
			.containerEl;
		if (!container) return;

		if (container.querySelector('.kambas-tag-toolbar-btn')) return;

		const controls = container.querySelector<HTMLElement>('.canvas-controls');
		if (!controls) return;

		const newGroup = controls.createDiv({
			cls: 'canvas-control-group kambas-tag-toolbar-group',
		});

		const btn = newGroup.createDiv({
			cls: 'canvas-control-item kambas-tag-toolbar-btn',
			attr: { 'aria-label': getText().tagFilterPanel },
		});
		setIcon(btn, 'tag');
		this.tagToolbarBtn = btn;

		btn.addEventListener('click', () => {
			this.openTagFilterPanel(activeView);
		});

		const clearBtn = newGroup.createDiv({
			cls: 'canvas-control-item kambas-tag-toolbar-clear-btn',
			attr: { 'aria-label': getText().tagClearFilter ?? 'Clear filter' },
		});
		setIcon(clearBtn, 'x');
		this.tagToolbarClearBtn = clearBtn;

		clearBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.activeTagFilters.clear();
			this.activeTagExcludes.clear();
			this.activeColorFilters.clear();
			this.activeColorExcludes.clear();
			this.activeLabelFilters.clear();
			this.activeLabelExcludes.clear();
			this.applyTagFilters(activeView, true);
			this.refreshTagFilterPanel(activeView);
		});

		// Reflect current filter state immediately after injection
		this.updateToolbarButtonState();
	}

	// ──────────────────────────────────────────────────────────────────────────
	// Paste / Drop handlers
	// ──────────────────────────────────────────────────────────────────────────

	private handlePaste = (evt: ClipboardEvent): void => {
		const activeView = this.app.workspace.getActiveViewOfType(
			ItemView
		) as unknown as CanvasItemView | null;
		if (!activeView || activeView.getViewType() !== 'canvas') return;

		const clipboardData = evt.clipboardData;
		if (!clipboardData) return;

		const pendingImages: PendingImage[] = [];

		for (let i = 0; i < clipboardData.files.length; i++) {
			const file = clipboardData.files[i];
			if (file.type.startsWith('image/')) {
				pendingImages.push({
					filename:
						file.name ||
						`pasted_image_${Date.now()}.${file.type.split('/')[1] || 'png'}`,
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
		const activeView = this.app.workspace.getActiveViewOfType(
			ItemView
		) as unknown as CanvasItemView | null;
		if (!activeView || activeView.getViewType() !== 'canvas') return;

		const dataTransfer = evt.dataTransfer;
		if (!dataTransfer) return;

		const pendingImages: PendingImage[] = [];

		for (let i = 0; i < dataTransfer.files.length; i++) {
			const file = dataTransfer.files[i];
			if (file.type.startsWith('image/')) {
				pendingImages.push({
					filename:
						file.name ||
						`dropped_image_${Date.now()}.${file.type.split('/')[1] || 'png'}`,
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
		if (images.length === 0) return;
		const initialMousePos = this.lastMousePos ? { ...this.lastMousePos } : null;

		let currentChoice: StorageChoice | null = null;
		let applyToAllRemaining = false;

		// 1. Get ingestion choice modal
		for (let i = 0; i < images.length; i++) {
			const item = images[i];
			const remainingCount = images.length - i;

			if (!applyToAllRemaining || !currentChoice) {
				const res = await new Promise<{
					choice: StorageChoice;
					applyToAll: boolean;
				}>((resolve) => {
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

			if (currentChoice === 'cancel') return;
			if (applyToAllRemaining) break;
		}

		if (!currentChoice || currentChoice === 'cancel') return;

		// 2. Open progress modal if batch import
		let progressModal: ImageImportProgressModal | null = null;
		if (images.length > 1) {
			progressModal = new ImageImportProgressModal(this.app, images.length);
			progressModal.open();
		}

		// Center drop position on canvas
		const centerPos = this.getCanvasPosition(
			canvasView,
			evt,
			0,
			400,
			300,
			initialMousePos
		);

		// 3. Measure dimensions for all images asynchronously
		const imageDimensions: Array<{ width: number; height: number }> = [];
		const validImages: PendingImage[] = [];

		if (progressModal) {
			progressModal.updateProgress(
				0,
				images[0]?.filename || '',
				'Analyzing image dimensions...'
			);
		}

		for (let i = 0; i < images.length; i++) {
			if (progressModal?.isCancelled) break;
			const item = images[i];

			let dims = { width: 400, height: 300 };
			try {
				if (item.file) {
					dims = await getImageDimensions(item.file);
				} else if (item.arrayBuffer) {
					const tempUrl = arrayBufferToBase64DataUrl(
						item.arrayBuffer,
						item.mimeType
					);
					dims = await getImageDimensions(tempUrl);
				}
			} catch {
				dims = { width: 400, height: 300 };
			}

			imageDimensions.push(dims);
			validImages.push(item);
		}

		if (validImages.length === 0) {
			progressModal?.close();
			return;
		}

		// 4. Calculate PureRef-style grid layout
		const layoutPositions = this.calculatePureRefGridLayout(
			imageDimensions,
			centerPos
		);

		// 5. Construct batch nodes (Heavy processing & WebP optimization step)
		const nodesToInsert: CanvasNodeData[] = [];

		for (let i = 0; i < validImages.length; i++) {
			if (progressModal?.isCancelled) break;
			const item = validImages[i];
			const pos = layoutPositions[i];
			const dims = imageDimensions[i];

			if (progressModal) {
				progressModal.updateProgress(i + 1, item.filename);
			}

			if (currentChoice === 'embed') {
				let dataUrl = '';
				if (item.file) {
					dataUrl = await blobToBase64(item.file);
				} else if (item.arrayBuffer) {
					dataUrl = arrayBufferToBase64DataUrl(item.arrayBuffer, item.mimeType);
				}

				if (this.plugin.settings.autoOptimizeBase64OnIngest && dataUrl) {
					const ext = item.filename?.split('.').pop()?.toLowerCase() || '';
					const mime = item.mimeType?.toLowerCase() || '';
					if (
						ext !== 'gif' &&
						ext !== 'svg' &&
						mime !== 'image/gif' &&
						mime !== 'image/svg+xml'
					) {
						try {
							const res = await compressAndOptimizeBase64(dataUrl, {
								maxDimension: this.plugin.settings.base64MaxDimension || 2048,
								quality: this.plugin.settings.base64Quality || 0.82,
								mimeType: 'image/webp',
							});
							if (res.dataUrl) dataUrl = res.dataUrl;
						} catch (err) {
							console.warn(
								'Base64 optimization failed during image ingest:',
								err
							);
						}
					}
				}

				if (dataUrl) {
					const nodeObj: CanvasNodeData = {
						type: 'link',
						url: dataUrl,
						x: pos.x,
						y: pos.y,
						width: dims.width,
						height: dims.height,
						originalWidth: dims.width,
						originalHeight: dims.height,
					};
					if (
						this.plugin.settings.preserveMediaFilenameOnIngest &&
						item.filename
					) {
						nodeObj.label = item.filename;
					}
					nodesToInsert.push(nodeObj);
				}
			} else {
				let buffer: ArrayBuffer | null = null;
				if (item.file) {
					buffer = await item.file.arrayBuffer();
				} else if (item.arrayBuffer) {
					buffer = item.arrayBuffer;
				}

				if (buffer) {
					const vaultWithConfig = this.app.vault as unknown as {
						getConfig?: (key: string) => string;
					};
					const attachmentFolder =
						vaultWithConfig.getConfig?.('attachmentFolderPath') || '';
					const vaultPath = await saveFileToVault(
						this.app,
						attachmentFolder,
						item.filename,
						buffer
					);
					nodesToInsert.push({
						type: 'file',
						file: vaultPath,
						x: pos.x,
						y: pos.y,
						width: dims.width,
						height: dims.height,
						originalWidth: dims.width,
						originalHeight: dims.height,
					});
				}
			}
		}

		// 6. Write all nodes to `.canvas` file in 1 single atomic disk update
		if (canvasView.file && nodesToInsert.length > 0) {
			await this.appendBatchNodesToCanvasFile(
				canvasView.file.path,
				nodesToInsert
			);
			window.setTimeout(() => {
				this.scanAndRestoreTransforms(canvasView);
			}, 30);
		}

		if (progressModal) {
			progressModal.close();
		}

		const t = getText();
		if (nodesToInsert.length === images.length) {
			new Notice(t.importCompleteNotice(nodesToInsert.length));
		} else if (nodesToInsert.length > 0) {
			new Notice(t.importCancelledNotice(nodesToInsert.length));
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
		if (
			typeof mouseEvt?.clientX === 'number' &&
			typeof mouseEvt?.clientY === 'number' &&
			(mouseEvt.clientX !== 0 || mouseEvt.clientY !== 0)
		) {
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
				posFromEvent?: (evt: { clientX: number; clientY: number }) => {
					x: number;
					y: number;
				};
				posFromClient?: (pos: { x: number; y: number }) => {
					x: number;
					y: number;
				};
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
					if (
						typeof cPos?.x === 'number' &&
						typeof cPos?.y === 'number' &&
						!Number.isNaN(cPos.x) &&
						!Number.isNaN(cPos.y)
					) {
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
					if (
						typeof cPos?.x === 'number' &&
						typeof cPos?.y === 'number' &&
						!Number.isNaN(cPos.x) &&
						!Number.isNaN(cPos.y)
					) {
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
			const containerEl =
				rawCanvas.wrapperEl ??
				rawCanvas.containerEl ??
				document.querySelector('.canvas-wrapper') ??
				document.querySelector('.canvas');
			if (
				containerEl &&
				typeof rawCanvas.tx === 'number' &&
				typeof rawCanvas.ty === 'number' &&
				typeof rawCanvas.zoom === 'number' &&
				rawCanvas.zoom > 0
			) {
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
			const rawCanvas = canvas as unknown as {
				getViewportBBox?: () => {
					minX: number;
					maxX: number;
					minY: number;
					maxY: number;
				};
			};
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

	private calculatePureRefGridLayout(
		items: Array<{ width: number; height: number }>,
		centerPos: { x: number; y: number }
	): Array<{ x: number; y: number }> {
		if (items.length === 0) return [];
		if (items.length === 1) {
			return [
				{
					x: Math.round(centerPos.x - items[0].width / 2),
					y: Math.round(centerPos.y - items[0].height / 2),
				},
			];
		}

		const count = items.length;
		const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
		const gap = 30;

		const rows: Array<{
			items: Array<{
				index: number;
				width: number;
				height: number;
				relX: number;
			}>;
			rowWidth: number;
			rowHeight: number;
		}> = [];

		let currentRowItems: Array<{
			index: number;
			width: number;
			height: number;
			relX: number;
		}> = [];
		let currentRowWidth = 0;
		let currentRowMaxHeight = 0;

		for (let i = 0; i < count; i++) {
			const item = items[i];
			const w = item.width || 400;
			const h = item.height || 300;

			if (currentRowItems.length >= cols) {
				rows.push({
					items: currentRowItems,
					rowWidth: currentRowWidth - gap,
					rowHeight: currentRowMaxHeight,
				});
				currentRowItems = [];
				currentRowWidth = 0;
				currentRowMaxHeight = 0;
			}

			currentRowItems.push({
				index: i,
				width: w,
				height: h,
				relX: currentRowWidth,
			});
			currentRowWidth += w + gap;
			if (h > currentRowMaxHeight) currentRowMaxHeight = h;
		}

		if (currentRowItems.length > 0) {
			rows.push({
				items: currentRowItems,
				rowWidth: currentRowWidth - gap,
				rowHeight: currentRowMaxHeight,
			});
		}

		const totalGridWidth = Math.max(...rows.map((r) => r.rowWidth));
		const totalGridHeight =
			rows.reduce((acc, r) => acc + r.rowHeight, 0) + (rows.length - 1) * gap;

		const startX = centerPos.x - totalGridWidth / 2;
		const startY = centerPos.y - totalGridHeight / 2;

		const result: Array<{ x: number; y: number }> = [];

		let currentY = startY;
		for (const row of rows) {
			for (const item of row.items) {
				result[item.index] = {
					x: Math.round(startX + item.relX),
					y: Math.round(currentY),
				};
			}
			currentY += row.rowHeight + gap;
		}

		return result;
	}

	private async appendBatchNodesToCanvasFile(
		canvasFilePath: string,
		nodesData: CanvasNodeData[]
	): Promise<void> {
		if (nodesData.length === 0) return;
		const file = this.app.vault.getAbstractFileByPath(canvasFilePath);
		if (!file || !(file instanceof TFile) || file.extension !== 'canvas')
			return;

		const content = await this.app.vault.read(file);
		let data: CanvasFileData;
		try {
			data =
				content && content.trim().length > 0
					? (JSON.parse(content) as CanvasFileData)
					: { nodes: [], edges: [] };
		} catch {
			data = { nodes: [], edges: [] };
		}

		if (!data.nodes) data.nodes = [];
		for (const node of nodesData) {
			if (!node.id) {
				node.id = Math.random().toString(36).substring(2, 16);
			}
			data.nodes.push(node);
		}

		try {
			await this.app.vault.modify(file, JSON.stringify(data, null, 2));
		} catch (err) {
			console.error('Error saving updated batch nodes to canvas file:', err);
		}
	}

	private async appendNodeToCanvasFile(
		canvasFilePath: string,
		nodeData: CanvasNodeData
	): Promise<void> {
		await this.appendBatchNodesToCanvasFile(canvasFilePath, [nodeData]);
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
			const isTargetNode =
				targetNodeEl &&
				(nodeEl === targetNodeEl || nodeEl.contains(targetNodeEl));
			const isExplicitlySelected = nodeEl.classList.contains('is-selected');
			const hasImg =
				nodeEl.querySelector('.kambas-embedded-img') ||
				this.getNativeImageElement(nodeEl);
			if ((isExplicitlySelected || isTargetNode) && hasImg) {
				targetId = id;
				targetNodeObj = node;
			}
		});

		if (!targetId || !targetNodeObj) return;

		// Open swap modal
		const result = await new Promise<
			import('../modals/ImageSwapModal').SwapResult | null
		>((resolve) => {
			new ImageSwapModal(this.app, (r) => resolve(r)).open();
		});

		if (!result) return; // cancelled

		// Read new media dimensions to update aspect ratio
		let newDims: { width: number; height: number } | null = null;
		let newFileOrUrl: {
			type: 'file' | 'link';
			file?: string;
			url?: string;
		} | null = null;

		if (result.source === 'vault' && result.tfile) {
			const resourceUrl = this.app.vault.getResourcePath(result.tfile);
			newDims = await getImageDimensions(resourceUrl);
			newFileOrUrl = { type: 'file', file: result.tfile.path };
		} else if (result.source === 'file' && result.file) {
			newDims = await getImageDimensions(result.file);
			if (result.storageChoice === 'embed') {
				const buffer = await result.file.arrayBuffer();
				const mimeType =
					result.file.type ||
					`image/${result.file.name.split('.').pop()?.toLowerCase() || 'png'}`;
				let dataUrl = arrayBufferToBase64DataUrl(buffer, mimeType);

				if (this.plugin.settings.autoOptimizeBase64OnIngest && dataUrl) {
					const ext = result.file.name.split('.').pop()?.toLowerCase() || '';
					const mime = mimeType.toLowerCase();
					if (
						ext !== 'gif' &&
						ext !== 'svg' &&
						mime !== 'image/gif' &&
						mime !== 'image/svg+xml'
					) {
						try {
							const res = await compressAndOptimizeBase64(dataUrl, {
								maxDimension: this.plugin.settings.base64MaxDimension || 2048,
								quality: this.plugin.settings.base64Quality || 0.82,
								mimeType: 'image/webp',
							});
							if (res.dataUrl) dataUrl = res.dataUrl;
						} catch (err) {
							console.warn(
								'Base64 optimization failed during image replace:',
								err
							);
						}
					}
				}

				newFileOrUrl = { type: 'link', url: dataUrl };
			} else {
				const vaultWithConfig = this.app.vault as unknown as {
					getConfig?: (key: string) => string;
				};
				const attachmentFolder =
					vaultWithConfig.getConfig?.('attachmentFolderPath') || '';
				const buffer = await result.file.arrayBuffer();
				const vaultPath = await saveFileToVault(
					this.app,
					attachmentFolder,
					result.file.name,
					buffer
				);
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
		const rawCanvas = canvas as unknown as {
			removeNode?: (node: unknown) => void;
		};
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
			if (
				tfile &&
				tfile instanceof TFile &&
				typeof canvas.createFileNode === 'function'
			) {
				canvas.createFileNode({
					file: tfile,
					pos: { x: nodeData.x, y: nodeData.y },
					size: { width: currentWidth, height: newHeight },
					save: false,
				});
			}
		} else if (
			newFileOrUrl.type === 'link' &&
			newFileOrUrl.url &&
			typeof canvas.createLinkNode === 'function'
		) {
			canvas.createLinkNode({
				url: newFileOrUrl.url,
				pos: { x: nodeData.x, y: nodeData.y },
				size: { width: currentWidth, height: newHeight },
				save: false,
			});
		}

		// Transfer kambas transform properties, GIF state & tags to newly spawned live node
		const flipH = nodeData.kambasFlipH;
		const flipV = nodeData.kambasFlipV;
		const grayscale = nodeData.kambasGrayscale;
		const palette = nodeData.kambasPalette;
		const opacity = nodeData.kambasOpacity;
		const tags = nodeData.kambasTags;
		const gifPaused = nodeData.kambasGifPaused;
		const gifFrame = nodeData.kambasGifFrame;
		const gifSpeed = nodeData.kambasGifSpeed;

		const targetPathOrUrl = newFileOrUrl.file || newFileOrUrl.url;
		const newCanvasNode = Array.from(canvas.nodes?.values() || []).find((n) => {
			const rawN = n as unknown as {
				file?: { path?: string };
				url?: string;
				unknownData?: { file?: string; url?: string };
			};
			return (
				rawN.file?.path === targetPathOrUrl ||
				rawN.url === targetPathOrUrl ||
				rawN.unknownData?.file === targetPathOrUrl ||
				rawN.unknownData?.url === targetPathOrUrl
			);
		});

		if (newCanvasNode) {
			const rawN = newCanvasNode as unknown as {
				kambasGifPaused?: boolean;
				kambasGifFrame?: number;
				kambasGifSpeed?: number;
				unknownData?: {
					kambasFlipH?: boolean;
					kambasFlipV?: boolean;
					kambasGrayscale?: boolean;
					kambasPalette?: boolean;
					kambasOpacity?: number;
					kambasTags?: string[];
					kambasGifPaused?: boolean;
					kambasGifFrame?: number;
					kambasGifSpeed?: number;
				};
			};
			if (!rawN.unknownData) rawN.unknownData = {};
			if (flipH) rawN.unknownData.kambasFlipH = flipH;
			if (flipV) rawN.unknownData.kambasFlipV = flipV;
			if (grayscale) rawN.unknownData.kambasGrayscale = grayscale;
			if (palette) rawN.unknownData.kambasPalette = palette;
			if (opacity !== undefined) rawN.unknownData.kambasOpacity = opacity;
			if (Array.isArray(tags) && tags.length > 0)
				rawN.unknownData.kambasTags = [...tags];
			if (gifPaused !== undefined) {
				rawN.unknownData.kambasGifPaused = gifPaused;
				rawN.kambasGifPaused = gifPaused;
			}
			if (gifFrame !== undefined) {
				rawN.unknownData.kambasGifFrame = gifFrame;
				rawN.kambasGifFrame = gifFrame;
			}
			if (gifSpeed !== undefined) {
				rawN.unknownData.kambasGifSpeed = gifSpeed;
				rawN.kambasGifSpeed = gifSpeed;
			}
		}

		if (typeof canvas.requestSave === 'function') {
			try {
				canvas.requestSave();
			} catch {
				/* Handled */
			}
		}

		window.setTimeout(() => {
			this.scanAndRestoreTransforms(activeView);
		}, 60);

		new Notice(getText().swapSuccess);
	}

	/**
	 * Re-encodes high-resolution Base64 data URLs for selected canvas image nodes using WebP compression.
	 */
	public async optimizeSelectedEmbeddedImages(
		activeView: CanvasItemView,
		targetNodeEl?: HTMLElement
	): Promise<void> {
		const canvas = activeView.canvas;
		if (!canvas?.nodes) return;

		let totalBytesSaved = 0;
		let optimizedCount = 0;

		const maxDim = this.plugin.settings.base64MaxDimension || 2048;
		const quality = this.plugin.settings.base64Quality || 0.82;

		for (const canvasNode of canvas.nodes.values()) {
			const el = canvasNode.nodeEl;
			if (!el) continue;
			const isSel =
				el.classList.contains('is-selected') ||
				(targetNodeEl && (el === targetNodeEl || el.contains(targetNodeEl)));
			if (!isSel) continue;

			const rawNode = canvasNode as unknown as {
				url?: string;
				unknownData?: { url?: string };
			};
			const dataUrl = rawNode.url || rawNode.unknownData?.url;

			if (dataUrl && dataUrl.startsWith('data:image/')) {
				const lowerUrl = dataUrl.toLowerCase();
				if (
					lowerUrl.startsWith('data:image/gif') ||
					lowerUrl.startsWith('data:image/svg')
				) {
					continue;
				}
				try {
					const res = await compressAndOptimizeBase64(dataUrl, {
						maxDimension: maxDim,
						quality,
						mimeType: 'image/webp',
					});
					if (res.bytesSaved > 0) {
						if (rawNode.url) rawNode.url = res.dataUrl;
						if (rawNode.unknownData) rawNode.unknownData.url = res.dataUrl;

						const imgEl = el.querySelector<HTMLImageElement>('img');
						if (imgEl) imgEl.src = res.dataUrl;

						totalBytesSaved += res.bytesSaved;
						optimizedCount++;
					}
				} catch (err) {
					console.error('Failed to optimize embedded image:', err);
				}
			}
		}

		if (typeof canvas.requestSave === 'function') {
			try {
				canvas.requestSave();
			} catch {
				/* Handled */
			}
		}

		const t = getText();
		if (optimizedCount > 0) {
			const kbSaved = Math.round(totalBytesSaved / 1024);
			new Notice(t.optimizedNotice(optimizedCount, kbSaved));
		} else {
			new Notice(t.noCompressibleNotice);
		}
	}
}
