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

		// Helper to append image transform items to a menu if any image node is selected
		const addTransformItemsToMenu = (menu: Menu, targetNodeEl?: HTMLElement): void => {
			const activeView = this.app.workspace.getActiveViewOfType(ItemView) as unknown as CanvasItemView | null;
			if (!activeView || activeView.getViewType() !== 'canvas') return;

			const canvas = activeView.canvas;
			if (!canvas?.nodes) return;

			// Check if any selected node (or target node) is a kambas image or native image
			let hasAnyImage = false;
			canvas.nodes.forEach((canvasNode) => {
				const el = canvasNode.nodeEl;
				if (!el) return;
				const isSel = el.classList.contains('is-selected') || (targetNodeEl && (el === targetNodeEl || el.contains(targetNodeEl)));
				if (isSel) {
					if (el.querySelector('.kambas-embedded-img') || this.canvasImageHandler.getNativeImageElement(el)) {
						hasAnyImage = true;
					}
				}
			});

			if (!hasAnyImage && targetNodeEl) {
				hasAnyImage = Boolean(targetNodeEl.querySelector('.kambas-embedded-img') || this.canvasImageHandler.getNativeImageElement(targetNodeEl));
			}

			if (!hasAnyImage) return;

			const t = getText();
			menu.addSeparator();

			menu.addItem((item) => {
				item.setTitle(t.flipHorizontal)
					.setIcon('flip-horizontal')
					.onClick(() => {
						void this.canvasImageHandler.toggleSelectedImageTransform(activeView, 'h', targetNodeEl);
					});
			});

			menu.addItem((item) => {
				item.setTitle(t.flipVertical)
					.setIcon('flip-vertical')
					.onClick(() => {
						void this.canvasImageHandler.toggleSelectedImageTransform(activeView, 'v', targetNodeEl);
					});
			});

			menu.addItem((item) => {
				item.setTitle(t.toggleGrayscale)
					.setIcon('contrast')
					.onClick(() => {
						void this.canvasImageHandler.toggleSelectedImageTransform(activeView, 'g', targetNodeEl);
					});
			});
		};

		// Single node context menu
		this.registerEvent(
			(this.app.workspace as unknown as {
				on(event: 'canvas:node-menu', handler: (menu: Menu, node: unknown) => void): import('obsidian').EventRef;
			}).on('canvas:node-menu', (menu: Menu, node: unknown) => {
				const canvasNode = node as { nodeEl?: HTMLElement };
				addTransformItemsToMenu(menu, canvasNode.nodeEl);
			})
		);

		// Multi-selection context menu
		this.registerEvent(
			(this.app.workspace as unknown as {
				on(event: 'canvas:selection-menu', handler: (menu: Menu) => void): import('obsidian').EventRef;
			}).on('canvas:selection-menu', (menu: Menu) => {
				addTransformItemsToMenu(menu);
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
