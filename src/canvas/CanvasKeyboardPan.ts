import { ItemView, Plugin } from 'obsidian';
import { CanvasElement, CanvasItemView } from './CanvasTypes';

export enum Direction {
	North = 'north',
	West = 'west',
	South = 'south',
	East = 'east',
	ZoomIn = 'zoomIn',
	ZoomOut = 'zoomOut',
}

export interface CanvasKeyboardPanSettings {
	keys: Record<Direction, string>;
	maxSpeed: number;
	zoomSpeed: number;
}

export const DEFAULT_KEYBOARD_PAN_SETTINGS: CanvasKeyboardPanSettings = {
	keys: {
		[Direction.North]: 'w',
		[Direction.West]: 'a',
		[Direction.South]: 's',
		[Direction.East]: 'd',
		[Direction.ZoomIn]: 'r',
		[Direction.ZoomOut]: 'f',
	},
	maxSpeed: 250,
	zoomSpeed: 0.015,
};

export function xor(a: boolean, b: boolean): boolean {
	return (a && !b) || (b && !a);
}

export class CanvasKeyboardPan {
	private plugin: Plugin;
	private getSettings: () => CanvasKeyboardPanSettings;

	PanStart: Date | null = null;
	NorthKeyDown = false;
	EastKeyDown = false;
	SouthKeyDown = false;
	WestKeyDown = false;
	ZoomInKeyDown = false;
	ZoomOutKeyDown = false;
	active = false;
	panInterval: number | undefined = undefined;

	constructor(plugin: Plugin, getSettings: () => CanvasKeyboardPanSettings) {
		this.plugin = plugin;
		this.getSettings = getSettings;
	}

	public registerEvents(): void {
		this.plugin.registerDomEvent(this.plugin.app.workspace.containerEl, 'keydown', (evt: KeyboardEvent) => {
			if (this.isEditingText(evt)) {
				return;
			}

			const settings = this.getSettings();
			const key = evt.key;

			if (Object.values(settings.keys).includes(key)) {
				switch (key) {
					case settings.keys[Direction.North]:
						this.NorthKeyDown = true;
						this.SouthKeyDown = false;
						break;
					case settings.keys[Direction.West]:
						this.WestKeyDown = true;
						this.EastKeyDown = false;
						break;
					case settings.keys[Direction.South]:
						this.SouthKeyDown = true;
						this.NorthKeyDown = false;
						break;
					case settings.keys[Direction.East]:
						this.EastKeyDown = true;
						this.WestKeyDown = false;
						break;
					case settings.keys[Direction.ZoomIn]:
						this.ZoomInKeyDown = true;
						this.ZoomOutKeyDown = false;
						break;
					case settings.keys[Direction.ZoomOut]:
						this.ZoomOutKeyDown = true;
						this.ZoomInKeyDown = false;
						break;
				}
				this.startPan();
			}
		});

		this.plugin.registerDomEvent(this.plugin.app.workspace.containerEl, 'keyup', (evt: KeyboardEvent) => {
			const settings = this.getSettings();
			if (Object.values(settings.keys).includes(evt.key)) {
				switch (evt.key) {
					case settings.keys[Direction.North]:
						this.NorthKeyDown = false;
						break;
					case settings.keys[Direction.West]:
						this.WestKeyDown = false;
						break;
					case settings.keys[Direction.South]:
						this.SouthKeyDown = false;
						break;
					case settings.keys[Direction.East]:
						this.EastKeyDown = false;
						break;
					case settings.keys[Direction.ZoomIn]:
						this.ZoomInKeyDown = false;
						break;
					case settings.keys[Direction.ZoomOut]:
						this.ZoomOutKeyDown = false;
						break;
				}
				this.stopPan();
			}
		});

		this.plugin.registerEvent(
			this.plugin.app.workspace.on('layout-change', () => {
				this.stopPan(true);
				if (this.getActiveCanvas()) {
					this.active = true;
				} else {
					this.active = false;
				}
			})
		);

		const stopPanCallback = (): void => {
			this.stopPan(true);
		};

		this.plugin.registerEvent(this.plugin.app.workspace.on('active-leaf-change', stopPanCallback));
		this.plugin.registerEvent(this.plugin.app.workspace.on('file-open', stopPanCallback));
		this.plugin.registerEvent(this.plugin.app.workspace.on('file-menu', stopPanCallback));
		this.plugin.registerEvent(this.plugin.app.workspace.on('files-menu', stopPanCallback));
	}

	private isEditingText(evt: KeyboardEvent): boolean {
		if (this.plugin.app.workspace.activeEditor) {
			return true;
		}
		const target = evt.target as HTMLElement | null;
		if (!target) return false;
		const tagName = target.tagName.toLowerCase();
		if (tagName === 'input' || tagName === 'textarea' || target.isContentEditable || target.closest('.cm-editor')) {
			return true;
		}
		return false;
	}

	public startPan(): void {
		if (this.panInterval === undefined) {
			this.panInterval = this.plugin.registerInterval(window.setInterval(() => this.handlePanKeys(), 10));
		}
	}

	public stopPan(force = false): void {
		if (!this.panning || force) {
			window.clearInterval(this.panInterval);
			this.panInterval = undefined;
			this.PanStart = null;
		}
		if (force) {
			this.NorthKeyDown = false;
			this.WestKeyDown = false;
			this.SouthKeyDown = false;
			this.EastKeyDown = false;
			this.ZoomInKeyDown = false;
			this.ZoomOutKeyDown = false;
		}
	}

	public get panning(): boolean {
		return (
			xor(this.EastKeyDown, this.WestKeyDown) ||
			xor(this.NorthKeyDown, this.SouthKeyDown) ||
			xor(this.ZoomInKeyDown, this.ZoomOutKeyDown)
		);
	}

	public getActiveCanvas(): CanvasElement | undefined {
		const activeView = this.plugin.app.workspace.getActiveViewOfType(ItemView) as unknown as CanvasItemView | null;
		if (activeView?.getViewType() !== 'canvas') {
			this.stopPan();
			return undefined;
		}
		const canvas = activeView.canvas;
		if (!canvas) {
			this.stopPan();
		}
		return canvas;
	}

	public handlePanKeys(): void {
		let ms = 0;
		if (this.PanStart === null) {
			this.PanStart = new Date();
		} else {
			ms = new Date().getTime() - this.PanStart.getTime();
		}
		let dx = 0;
		let dy = 0;
		const settings = this.getSettings();

		if (this.NorthKeyDown && !this.SouthKeyDown) {
			dy -= this.getPanDistance(ms, settings.maxSpeed);
		} else if (this.SouthKeyDown && !this.NorthKeyDown) {
			dy += this.getPanDistance(ms, settings.maxSpeed);
		}

		if (this.WestKeyDown && !this.EastKeyDown) {
			dx -= this.getPanDistance(ms, settings.maxSpeed);
		} else if (this.EastKeyDown && !this.WestKeyDown) {
			dx += this.getPanDistance(ms, settings.maxSpeed);
		}

		if (dx !== 0 || dy !== 0) {
			this.pan(dx, dy);
		}

		const zoomSpeed = settings.zoomSpeed ?? 0.015;
		if (this.ZoomInKeyDown && !this.ZoomOutKeyDown) {
			this.zoom(zoomSpeed);
		} else if (this.ZoomOutKeyDown && !this.ZoomInKeyDown) {
			this.zoom(-zoomSpeed);
		}
	}

	public pan(dx: number, dy: number): void {
		const canvas = this.getActiveCanvas();
		if (!canvas) {
			return;
		}
		const zoom = (canvas.zoom ?? -4) + 5;
		dx = dx / zoom;
		dy = dy / zoom;

		const currentTx = canvas.tx ?? 0;
		const currentTy = canvas.ty ?? 0;

		canvas.tx = isNaN(currentTx + dx) ? 0 : currentTx + dx;
		canvas.ty = isNaN(currentTy + dy) ? 0 : currentTy + dy;

		if (canvas.markViewportChanged) {
			canvas.markViewportChanged();
		}
	}

	public zoom(delta: number): void {
		const canvas = this.getActiveCanvas();
		if (!canvas) {
			return;
		}
		if (typeof canvas.zoomBy === 'function') {
			canvas.zoomBy(delta);
		} else if (canvas.zoom !== undefined) {
			canvas.zoom += delta;
			if (canvas.markViewportChanged) {
				canvas.markViewportChanged();
			}
		}
	}

	public getPanDistance(msPanning = 0, max = 250): number {
		if (msPanning < 1) {
			return 0;
		}
		return Math.min((Math.log10(msPanning) * max) / 3, 250);
	}

	public resetCanvas(): void {
		this.getActiveCanvas()?.panTo?.(0, 0);
	}
}
