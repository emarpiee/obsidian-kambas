import type KambasPlugin from '../main';

export class CanvasLoupeInspector {
	private plugin: KambasPlugin;
	private loupeEl: HTMLElement | null = null;
	private isKeyDown = false;
	private rafId: number | null = null;
	private lastMousePos: { x: number; y: number } | null = null;
	private currentPos: { x: number; y: number } | null = null;

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
		this.stopLoop();
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
				this.currentPos = { ...this.lastMousePos };
			}
			this.startLoop();
		}
	}

	private onKeyUp(evt: KeyboardEvent): void {
		const configuredKey = (this.plugin.settings.loupeHotkey || 'q').toLowerCase();
		if (evt.key.toLowerCase() === configuredKey) {
			this.isKeyDown = false;
			this.stopLoop();
			this.removeLoupe();
		}
	}

	private onMouseMove(evt: MouseEvent): void {
		this.lastMousePos = { x: evt.clientX, y: evt.clientY };
		if (!this.isKeyDown) return;
		if (!this.currentPos) {
			this.currentPos = { x: evt.clientX, y: evt.clientY };
		}
		this.startLoop();
	}

	private startLoop(): void {
		if (this.rafId !== null) return;
		const loop = (): void => {
			if (!this.isKeyDown || !this.lastMousePos) {
				this.stopLoop();
				return;
			}

			if (!this.currentPos) {
				this.currentPos = { ...this.lastMousePos };
			} else {
				// Lerp interpolation for smooth dampening & lower panning sensitivity
				const smoothing = this.plugin.settings.loupeSmoothing ?? 0.15;
				const dx = this.lastMousePos.x - this.currentPos.x;
				const dy = this.lastMousePos.y - this.currentPos.y;

				if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) {
					this.currentPos.x += dx * smoothing;
					this.currentPos.y += dy * smoothing;
				} else {
					this.currentPos.x = this.lastMousePos.x;
					this.currentPos.y = this.lastMousePos.y;
				}
			}

			this.updateLoupeAtPosition(this.currentPos.x, this.currentPos.y);
			this.rafId = window.requestAnimationFrame(loop);
		};
		this.rafId = window.requestAnimationFrame(loop);
	}

	private stopLoop(): void {
		if (this.rafId !== null) {
			window.cancelAnimationFrame(this.rafId);
			this.rafId = null;
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
		this.currentPos = null;
		this.stopLoop();
	}
}
