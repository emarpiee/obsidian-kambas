import type KambasPlugin from '../main';

export class CanvasLoupeInspector {
	private plugin: KambasPlugin;
	private loupeEl: HTMLElement | null = null;
	private isKeyDown = false;
	private rafId: number | null = null;
	private lastMousePos: { x: number; y: number } | null = null;

	private keydownHandler: (evt: KeyboardEvent) => void;
	private keyupHandler: (evt: KeyboardEvent) => void;
	private mousemoveHandler: (evt: MouseEvent) => void;

	constructor(plugin: KambasPlugin) {
		this.plugin = plugin;

		this.keydownHandler = this.onKeyDown.bind(this);
		this.keyupHandler = this.onKeyUp.bind(this);
		this.mousemoveHandler = this.onMouseMove.bind(this);

		window.addEventListener('keydown', this.keydownHandler, true);
		window.addEventListener('keyup', this.keyupHandler, true);
		window.addEventListener('mousemove', this.mousemoveHandler, true);
	}

	public destroy(): void {
		window.removeEventListener('keydown', this.keydownHandler, true);
		window.removeEventListener('keyup', this.keyupHandler, true);
		window.removeEventListener('mousemove', this.mousemoveHandler, true);
		if (this.rafId !== null) {
			window.cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
		this.removeLoupe();
	}

	private onKeyDown(evt: KeyboardEvent): void {
		const configuredKey = (this.plugin.settings.loupeHotkey || 'q').toLowerCase();
		if (evt.key.toLowerCase() === configuredKey && !evt.repeat) {
			const activeTag = (document.activeElement?.tagName || '').toLowerCase();
			const isEditable = (document.activeElement as HTMLElement | null)?.isContentEditable;
			if (activeTag === 'input' || activeTag === 'textarea' || isEditable) {
				return;
			}
			this.isKeyDown = true;
			if (this.lastMousePos) {
				this.updateLoupeAtPosition(this.lastMousePos.x, this.lastMousePos.y);
			}
		}
	}

	private onKeyUp(evt: KeyboardEvent): void {
		const configuredKey = (this.plugin.settings.loupeHotkey || 'q').toLowerCase();
		if (evt.key.toLowerCase() === configuredKey) {
			this.isKeyDown = false;
			this.removeLoupe();
		}
	}

	private onMouseMove(evt: MouseEvent): void {
		this.lastMousePos = { x: evt.clientX, y: evt.clientY };
		if (!this.isKeyDown) return;

		if (this.rafId === null) {
			this.rafId = window.requestAnimationFrame(() => {
				this.rafId = null;
				if (this.lastMousePos && this.isKeyDown) {
					this.updateLoupeAtPosition(this.lastMousePos.x, this.lastMousePos.y);
				}
			});
		}
	}

	private updateLoupeAtPosition(clientX: number, clientY: number): void {
		// Verify mouse cursor is within active canvas container
		const activeLeaf = document.querySelector('.workspace-leaf.mod-active');
		const canvasEl = activeLeaf?.querySelector('.canvas-wrapper') || activeLeaf?.querySelector('.canvas');
		if (!canvasEl) {
			this.removeLoupe();
			return;
		}

		const canvasBounds = canvasEl.getBoundingClientRect();
		const isOverCanvas =
			clientX >= canvasBounds.left &&
			clientX <= canvasBounds.right &&
			clientY >= canvasBounds.top &&
			clientY <= canvasBounds.bottom;

		if (!isOverCanvas) {
			this.removeLoupe();
			return;
		}

		const loupeSize = this.plugin.settings.loupeSize || 260;
		const zoomLevel = this.plugin.settings.loupeZoomLevel || 3.0;
		const shape = this.plugin.settings.loupeShape || 'circle';

		if (!this.loupeEl) {
			this.createLoupe();
		}

		if (this.loupeEl) {
			const halfSize = loupeSize / 2;
			this.loupeEl.className = `kambas-loupe-inspector kambas-loupe-shape-${shape}`;
			this.loupeEl.setCssProps({
				'--kambas-loupe-size': `${loupeSize}px`,
				'--kambas-loupe-left': `${clientX - halfSize}px`,
				'--kambas-loupe-top': `${clientY - halfSize}px`,
			});

			const innerContent = (canvasEl.querySelector('.canvas-content') || canvasEl.querySelector('.canvas-nodes') || canvasEl);

			let innerWrapper = this.loupeEl.querySelector<HTMLElement>('.kambas-loupe-inner');
			if (!innerWrapper) {
				innerWrapper = createDiv({ cls: 'kambas-loupe-inner' });
				this.loupeEl.appendChild(innerWrapper);
				const clone = innerContent.cloneNode(true) as HTMLElement;
				innerWrapper.appendChild(clone);
			}

			const canvasRect = innerContent.getBoundingClientRect();
			const offsetX = clientX - canvasRect.left;
			const offsetY = clientY - canvasRect.top;

			const translateX = halfSize - offsetX * zoomLevel;
			const translateY = halfSize - offsetY * zoomLevel;

			innerWrapper.setCssProps({
				'--kambas-loupe-width': `${canvasRect.width}px`,
				'--kambas-loupe-height': `${canvasRect.height}px`,
				'--kambas-loupe-transform': `translate3d(${translateX}px, ${translateY}px, 0) scale(${zoomLevel})`,
			});
		}
	}

	private createLoupe(): void {
		if (this.loupeEl) return;
		this.loupeEl = createDiv({ cls: 'kambas-loupe-inspector' });
		document.body.appendChild(this.loupeEl);
	}

	private removeLoupe(): void {
		if (this.loupeEl) {
			this.loupeEl.remove();
			this.loupeEl = null;
		}
		if (this.rafId !== null) {
			window.cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
	}
}
