import { App, ItemView, TFile } from 'obsidian';
import { ImageIngestionModal, StorageChoice } from '../modals/ImageIngestionModal';
import {
	arrayBufferToBase64DataUrl,
	blobToBase64,
	getImageDimensions,
	saveFileToVault,
} from '../utils/imageUtils';
import { CanvasFileData, CanvasItemView, CanvasNodeData } from './CanvasTypes';

export interface PendingImage {
	filename: string;
	mimeType: string;
	file?: File;
	arrayBuffer?: ArrayBuffer;
}

export class CanvasImageHandler {
	private app: App;
	private editGuardObserver: MutationObserver | null = null;
	private modifyTimer: number | null = null;

	constructor(app: App) {
		this.app = app;
	}

	public registerEvents(): void {
		window.addEventListener('paste', this.handlePaste, true);
		window.addEventListener('drop', this.handleDrop, true);
		window.addEventListener('dblclick', this.handleDblClick, true);
		window.addEventListener('keydown', this.handleKeyDown, true);
		this.startEditGuard();
	}

	public unregisterEvents(): void {
		window.removeEventListener('paste', this.handlePaste, true);
		window.removeEventListener('drop', this.handleDrop, true);
		window.removeEventListener('dblclick', this.handleDblClick, true);
		window.removeEventListener('keyup', this.handleKeyUpCheck, true);
		window.removeEventListener('mouseup', this.handleMouseUpCheck, true);
		if (this.editGuardObserver) {
			this.editGuardObserver.disconnect();
			this.editGuardObserver = null;
		}
	}

	// ──────────────────────────────────────────────────────────────────────────
	// MutationObserver: automatic mounting for link-type image nodes
	// ──────────────────────────────────────────────────────────────────────────

	private startEditGuard(): void {
		this.editGuardObserver = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type === 'childList') {
					for (const added of Array.from(mutation.addedNodes)) {
						if (added.nodeType !== Node.ELEMENT_NODE) continue;
						const el = added as HTMLElement;

						const canvasNodeEl = el.classList?.contains('canvas-node') ? el : el.closest?.('.canvas-node');
						if (canvasNodeEl || el.classList?.contains('canvas') || el.closest?.('.canvas')) {
							const activeView = this.app.workspace.getActiveViewOfType(ItemView) as unknown as CanvasItemView | null;
							if (activeView?.getViewType() === 'canvas') {
								window.setTimeout(() => {
									this.scanAndRestoreTransforms(activeView);
								}, 10);
								window.setTimeout(() => {
									this.scanAndRestoreTransforms(activeView);
								}, 100);
							}
						}
					}
				}
			}
		});

		this.editGuardObserver.observe(document.body, {
			subtree: true,
			attributes: true,
			attributeFilter: ['class'],
			childList: true,
		});

		// Listen to keyup (Ctrl+V) and mouseup (Alt+Drag duplication) to immediately refresh canvas link nodes
		window.addEventListener('keyup', this.handleKeyUpCheck, true);
		window.addEventListener('mouseup', this.handleMouseUpCheck, true);
	}

	private handleKeyUpCheck = (evt: KeyboardEvent): void => {
		if (evt.key === 'v' || evt.key === 'V' || evt.key === 'z' || evt.key === 'Z' || evt.key === 'y' || evt.key === 'Y') {
			const activeView = this.app.workspace.getActiveViewOfType(ItemView) as unknown as CanvasItemView | null;
			if (activeView?.getViewType() === 'canvas') {
				window.setTimeout(() => {
					this.scanAndRestoreTransforms(activeView);
				}, 10);
				window.setTimeout(() => {
					this.scanAndRestoreTransforms(activeView);
				}, 100);
			}
		}
	};

	private handleMouseUpCheck = (): void => {
		const activeView = this.app.workspace.getActiveViewOfType(ItemView) as unknown as CanvasItemView | null;
		if (activeView?.getViewType() === 'canvas') {
			window.setTimeout(() => {
				this.scanAndRestoreTransforms(activeView);
			}, 10);
			window.setTimeout(() => {
				this.scanAndRestoreTransforms(activeView);
			}, 100);
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
	public async toggleNativeImageTransform(
		activeView: CanvasItemView,
		nodeEl: Element,
		key: string
	): Promise<void> {
		const file = activeView.file;
		if (!file) return;

		const canvas = activeView.canvas;
		if (!canvas?.nodes) return;

		// Find the node ID by matching nodeEl in the canvas map
		let nodeId: string | null = null;
		canvas.nodes.forEach((node, id) => {
			if (node.nodeEl && (node.nodeEl === nodeEl || nodeEl.contains(node.nodeEl) || node.nodeEl.contains(nodeEl))) {
				nodeId = id;
			}
		});
		if (!nodeId) return;

		// Apply CSS class immediately for instant feedback
		const img = this.getNativeImageElement(nodeEl);
		if (img) {
			if (key === 'h') img.classList.toggle('kambas-img-flip-h');
			if (key === 'v') img.classList.toggle('kambas-img-flip-v');
			if (key === 'g') img.classList.toggle('kambas-img-grayscale');
		}

		// Persist to canvas JSON (debounced)
		const content = await this.app.vault.read(file);
		let data: CanvasFileData;
		try {
			data = JSON.parse(content) as CanvasFileData;
		} catch {
			return;
		}

		if (!data.nodes) return;
		const foundNodeId = nodeId;
		data.nodes.forEach((node) => {
			if (node.id !== foundNodeId) return;
			if (key === 'h') node.kambasFlipH = !node.kambasFlipH;
			if (key === 'v') node.kambasFlipV = !node.kambasFlipV;
			if (key === 'g') node.kambasGrayscale = !node.kambasGrayscale;
		});

		this.scheduleVaultModify(file, data);
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
			const unknownData = (canvasNode as unknown as { unknownData?: { type?: string; url?: string; kambasFlipH?: boolean; kambasFlipV?: boolean; kambasGrayscale?: boolean } }).unknownData;
			const nodeUrl = unknownData?.url;
			const isLinkDataImg = unknownData?.type === 'link' && nodeUrl?.startsWith('data:image/');

			if (isLinkDataImg && nodeUrl) {
				const container = nodeEl.querySelector('.canvas-node-content') ?? nodeEl;
				const existingImg = container.querySelector<HTMLImageElement>('img.kambas-embedded-img');
				if (!existingImg) {
					container.empty();
					container.createEl('img', {
						cls: 'kambas-embedded-img',
						attr: {
							src: nodeUrl,
							draggable: 'false',
							style: 'position:absolute;top:0;left:0;right:0;bottom:0;width:100%;height:100%;object-fit:fill;display:block;margin:0;padding:0;border:none;pointer-events:none;user-select:none;-webkit-user-drag:none;',
						},
					});
				}
			}

			// Apply stored transforms
			if (unknownData?.kambasFlipH || unknownData?.kambasFlipV || unknownData?.kambasGrayscale) {
				const img = this.getNativeImageElement(nodeEl) ?? nodeEl.querySelector<HTMLImageElement>('img');
				if (img) {
					img.classList.toggle('kambas-img-flip-h', Boolean(unknownData.kambasFlipH));
					img.classList.toggle('kambas-img-flip-v', Boolean(unknownData.kambasFlipV));
					img.classList.toggle('kambas-img-grayscale', Boolean(unknownData.kambasGrayscale));
				}
			}
		});
	}

	private handleKeyDown = (evt: KeyboardEvent): void => {
		const activeView = this.app.workspace.getActiveViewOfType(ItemView) as unknown as CanvasItemView | null;
		if (!activeView || activeView.getViewType() !== 'canvas') return;

		const activeEl = document.activeElement as HTMLElement | null;
		if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
			return;
		}

		const key = evt.key.toLowerCase();
		if (key === 'h' || key === 'v' || key === 'g') {
			void this.toggleSelectedImageTransform(activeView, key);
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

			if ((isExplicitlySelected || isTargetNode) && nodeEl.querySelector('.kambas-embedded-img')) {
				selectedNodeEls.push(nodeEl);
				selectedNodeIds.push(id);
			}
		});

		// 1. Apply DOM class changes immediately for instant UI responsiveness
		selectedNodeEls.forEach((nodeEl) => {
			const img = nodeEl.querySelector('img');
			if (img) {
				if (key === 'h') img.classList.toggle('kambas-img-flip-h');
				if (key === 'v') img.classList.toggle('kambas-img-flip-v');
				if (key === 'g') img.classList.toggle('kambas-img-grayscale');
			}
		});

		// 2. Perform in-memory data update and debounce disk persistence asynchronously
		void this.persistImageTransform(file, selectedNodeIds, key);
	}

	private async persistImageTransform(file: TFile, selectedNodeIds: string[], key: string): Promise<void> {
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
					node.kambasFlipH = !node.kambasFlipH;
					modified = true;
				} else if (key === 'v') {
					node.kambasFlipV = !node.kambasFlipV;
					modified = true;
				} else if (key === 'g') {
					node.kambasGrayscale = !node.kambasGrayscale;
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

			const pos = this.getCanvasPosition(canvasView, evt, i);

			if (currentChoice === 'embed') {
				let dataUrl = '';
				let dims = { width: 400, height: 300 };

				if (item.file) {
					dataUrl = await blobToBase64(item.file);
					dims = await getImageDimensions(item.file);
				} else if (item.arrayBuffer) {
					dataUrl = arrayBufferToBase64DataUrl(item.arrayBuffer, item.mimeType);
					dims = await getImageDimensions(dataUrl);
				}

				if (dataUrl) {
					await this.addEmbeddedImageToCanvas(canvasView, dataUrl, item.filename, pos.x, pos.y, dims.width, dims.height);
				}
			} else {
				let buffer: ArrayBuffer | null = null;
				let dims = { width: 400, height: 300 };

				if (item.file) {
					buffer = await item.file.arrayBuffer();
					dims = await getImageDimensions(item.file);
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
		indexOffset: number
	): { x: number; y: number } {
		const basePos = { x: indexOffset * 40, y: indexOffset * 40 };

		const canvas = canvasView.canvas;
		if (canvas && typeof canvas.posFromEvent === 'function') {
			try {
				const mouseEvt = evt as MouseEvent;
				if (mouseEvt.clientX !== undefined && mouseEvt.clientY !== undefined) {
					const cPos = canvas.posFromEvent(mouseEvt);
					if (typeof cPos.x === 'number' && typeof cPos.y === 'number' && !Number.isNaN(cPos.x) && !Number.isNaN(cPos.y)) {
						return { x: cPos.x + indexOffset * 40, y: cPos.y + indexOffset * 40 };
					}
				}
			} catch {
				// Fallback to default position
			}
		}

		return basePos;
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
}

