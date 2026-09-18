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
		this.stopLoop();
		this.removeLoupe();
	}

	private isLoupeKeyMatch(evt: KeyboardEvent): boolean {
		const configuredKey = (
			this.plugin.settings.loupeHotkey || 'q'
		).toLowerCase();
		if (configuredKey === 'space' || configuredKey === ' ') {
			return evt.key === ' ' || evt.code === 'Space';
		}
		const pressedKey = (evt.key || '').toLowerCase();
		const pressedCode = (evt.code || '').toLowerCase();
		return (
			pressedKey === configuredKey ||
			pressedCode === `key${configuredKey}` ||
			evt.key === this.plugin.settings.loupeHotkey
		);
	}

	private onKeyDown(evt: KeyboardEvent): void {
		if (this.isLoupeKeyMatch(evt) && !evt.repeat) {
			const activeTag = (document.activeElement?.tagName || '').toLowerCase();
			const isEditable = (document.activeElement as HTMLElement | null)
				?.isContentEditable;
			if (activeTag === 'input' || activeTag === 'textarea' || isEditable) {
				return;
			}
			this.isKeyDown = true;
			if (!this.lastMousePos) {
				this.lastMousePos = {
					x: window.innerWidth / 2,
					y: window.innerHeight / 2,
				};
			}
			// Re-clone on keydown to capture fresh DOM snapshot
			if (this.loupeEl) {
				this.removeLoupe();
			}
			this.updateLoupeAtPosition(this.lastMousePos.x, this.lastMousePos.y);
		}
	}

	private onKeyUp(evt: KeyboardEvent): void {
		if (this.isLoupeKeyMatch(evt)) {
			this.isKeyDown = false;
			this.stopLoop();
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

	private stopLoop(): void {
		if (this.rafId !== null) {
			window.cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
	}

	private updateLoupeAtPosition(clientX: number, clientY: number): void {
		const activeLeaf = document.querySelector('.workspace-leaf.mod-active');
		const canvasEl =
			activeLeaf?.querySelector<HTMLElement>('.canvas-wrapper') ||
			activeLeaf?.querySelector<HTMLElement>('.canvas') ||
			document.querySelector<HTMLElement>('.canvas-wrapper') ||
			document.querySelector<HTMLElement>('.canvas');

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

			// Target .canvas-content which holds Obsidian's transformed canvas surface
			const innerContent = (canvasEl.querySelector('.canvas-content') ||
				canvasEl.querySelector('.canvas-nodes') ||
				canvasEl);

			let innerWrapper = this.loupeEl.querySelector<HTMLElement>(
				'.kambas-loupe-inner'
			);
			if (!innerWrapper) {
				innerWrapper = createDiv({ cls: 'kambas-loupe-inner' });
				this.loupeEl.appendChild(innerWrapper);
				const clone = innerContent.cloneNode(true) as HTMLElement;
				innerWrapper.appendChild(clone);
			}

			// Copy pixel context buffer from original HTML <canvas> elements (GIF overlays) to cloned elements
			this.syncClonedCanvases(innerContent as HTMLElement, innerWrapper);

			const canvasRect = innerContent.getBoundingClientRect();
			const offsetX = clientX - canvasRect.left;
			const offsetY = clientY - canvasRect.top;

			const translateX = halfSize - offsetX * zoomLevel;
			const translateY = halfSize - offsetY * zoomLevel;

			innerWrapper.setCssProps({
				'--kambas-loupe-width': `${canvasRect.width}px`,
				'--kambas-loupe-height': `${canvasRect.height}px`,
				'--kambas-loupe-transform': `translate3d(${translateX.toFixed(2)}px, ${translateY.toFixed(2)}px, 0) scale(${zoomLevel})`,
			});
		}
	}

	private syncClonedCanvases(
		sourceEl: HTMLElement,
		targetEl: HTMLElement
	): void {
		const origCanvases = sourceEl.querySelectorAll<HTMLCanvasElement>('canvas');
		const clonedCanvases =
			targetEl.querySelectorAll<HTMLCanvasElement>('canvas');
		for (let i = 0; i < origCanvases.length; i++) {
			const orig = origCanvases[i];
			const cloned = clonedCanvases[i];
			if (orig && cloned && orig.width > 0 && orig.height > 0) {
				if (cloned.width !== orig.width || cloned.height !== orig.height) {
					cloned.width = orig.width;
					cloned.height = orig.height;
				}
				const ctx = cloned.getContext('2d');
				if (ctx) {
					ctx.drawImage(orig, 0, 0);
				}
			}
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
		this.stopLoop();
	}
}
