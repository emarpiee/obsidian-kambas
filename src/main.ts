import { ItemView, Menu, Plugin } from 'obsidian';
import { CanvasImageHandler } from './canvas/CanvasImageHandler';
import { CanvasItemView } from './canvas/CanvasTypes';
import { getText } from './i18n';
import { DEFAULT_SETTINGS, KambasSettings, KambasSettingTab } from './settings';

export default class KambasPlugin extends Plugin {
	public settings!: KambasSettings;
	private canvasImageHandler!: CanvasImageHandler;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.canvasImageHandler = new CanvasImageHandler(this.app);
		this.canvasImageHandler.registerEvents();

		// Add Settings Tab to Obsidian Settings
		this.addSettingTab(new KambasSettingTab(this.app, this));
		this.applySettingsCss();

		// Restore saved transforms & mount embedded link images on active leaf or layout changes
		const updateActiveCanvas = (): void => {
			const activeView = this.app.workspace.getActiveViewOfType(ItemView);
			if (activeView?.getViewType() !== 'canvas') return;
			const canvasView = activeView as unknown as CanvasItemView;
			window.setTimeout(() => {
				this.canvasImageHandler.scanAndRestoreTransforms(canvasView);
			}, 10);
		};

		this.registerEvent(this.app.workspace.on('active-leaf-change', updateActiveCanvas));
		this.registerEvent(this.app.workspace.on('layout-change', updateActiveCanvas));

		// Append our image options to Obsidian's native canvas node context menu
		this.registerEvent(
			(this.app.workspace as unknown as {
				on(event: 'canvas:node-menu', handler: (menu: Menu, node: unknown) => void): import('obsidian').EventRef;
			}).on('canvas:node-menu', (menu: Menu, node: unknown) => {
				const canvasNode = node as { nodeEl?: HTMLElement };
				const nodeEl = canvasNode.nodeEl;
				if (!nodeEl) return;

				const isKambas = Boolean(nodeEl.querySelector('.kambas-embedded-img'));
				const nativeImg = this.canvasImageHandler.getNativeImageElement(nodeEl);
				if (!isKambas && !nativeImg) return;

				const activeView = this.app.workspace.getActiveViewOfType(ItemView) as unknown as CanvasItemView | null;
				if (!activeView) return;

				const t = getText();

				menu.addSeparator();

				menu.addItem((item) => {
					item.setTitle(t.flipHorizontal)
						.setIcon('flip-horizontal')
						.onClick(() => {
							if (isKambas) void this.canvasImageHandler.toggleSelectedImageTransform(activeView, 'h', nodeEl);
							else void this.canvasImageHandler.toggleNativeImageTransform(activeView, nodeEl, 'h');
						});
				});

				menu.addItem((item) => {
					item.setTitle(t.flipVertical)
						.setIcon('flip-vertical')
						.onClick(() => {
							if (isKambas) void this.canvasImageHandler.toggleSelectedImageTransform(activeView, 'v', nodeEl);
							else void this.canvasImageHandler.toggleNativeImageTransform(activeView, nodeEl, 'v');
						});
				});

				menu.addItem((item) => {
					item.setTitle(t.toggleGrayscale)
						.setIcon('contrast')
						.onClick(() => {
							if (isKambas) void this.canvasImageHandler.toggleSelectedImageTransform(activeView, 'g', nodeEl);
							else void this.canvasImageHandler.toggleNativeImageTransform(activeView, nodeEl, 'g');
						});
				});
			})
		);
	}

	onunload(): void {
		document.body.classList.remove('kambas-hide-labels');
		if (this.canvasImageHandler) {
			this.canvasImageHandler.unregisterEvents();
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<KambasSettings>);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	applySettingsCss(): void {
		if (this.settings.hideImageLabel) {
			document.body.classList.add('kambas-hide-labels');
		} else {
			document.body.classList.remove('kambas-hide-labels');
		}
	}
}
