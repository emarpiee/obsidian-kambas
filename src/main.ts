import { ItemView, Menu, Plugin } from 'obsidian';
import { CanvasImageHandler } from './canvas/CanvasImageHandler';
import { CanvasKeyboardPan } from './canvas/CanvasKeyboardPan';
import { CanvasItemView } from './canvas/CanvasTypes';
import { getText } from './i18n';
import { FolderSuggestModal } from './modals/FolderSuggestModal';
import { OpacityModal } from './modals/OpacityModal';
import { DEFAULT_SETTINGS, KambasSettings, KambasSettingTab } from './settings';

export default class KambasPlugin extends Plugin {
	public settings!: KambasSettings;
	private canvasImageHandler!: CanvasImageHandler;
	public canvasKeyboardPan!: CanvasKeyboardPan;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.canvasImageHandler = new CanvasImageHandler(this.app);
		this.canvasImageHandler.registerEvents();

		this.canvasKeyboardPan = new CanvasKeyboardPan(this, () => this.settings.keyboardPan);
		this.canvasKeyboardPan.registerEvents();

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

			let hasAnyImage = false;
			let hasAnyMedia = false;
			let hasNativeImage = false;
			let selectedImageCount = 0;
			let isFlippedH = false;
			let isFlippedV = false;
			let isGrayscaled = false;
			let isResized = false;
			let currentOpacity = 1;

			canvas.nodes.forEach((canvasNode) => {
				const el = canvasNode.nodeEl;
				if (!el) return;
				const isSel = el.classList.contains('is-selected') || (targetNodeEl && (el === targetNodeEl || el.contains(targetNodeEl)));
				if (isSel) {
					if (el.querySelector('.kambas-embedded-img') || this.canvasImageHandler.getNativeImageElement(el)) {
						hasAnyImage = true;
						hasAnyMedia = true;
						selectedImageCount++;
					}

					const unknownData = (canvasNode as unknown as { unknownData?: { type?: string; url?: string; file?: string; kambasFlipH?: boolean; kambasFlipV?: boolean; kambasGrayscale?: boolean; kambasOpacity?: number; originalWidth?: number; originalHeight?: number } }).unknownData;
					if (unknownData?.type === 'file' || (unknownData?.type === 'link' && unknownData?.url?.startsWith('data:image/'))) {
						hasAnyMedia = true;
					}

					if (unknownData?.type === 'file' && unknownData?.file) {
						const ext = unknownData.file.split('.').pop()?.toLowerCase() || '';
						if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'avif', 'tiff', 'tif'].includes(ext)) {
							hasNativeImage = true;
						}
					}

					if (unknownData?.kambasFlipH) isFlippedH = true;
					if (unknownData?.kambasFlipV) isFlippedV = true;
					if (unknownData?.kambasGrayscale) isGrayscaled = true;
					if (unknownData?.kambasOpacity !== undefined) currentOpacity = unknownData.kambasOpacity;

					const rawNode = canvasNode as unknown as { width?: number; height?: number };
					const img = el.querySelector<HTMLImageElement>('img');
					const origW = unknownData?.originalWidth ?? img?.naturalWidth;
					const origH = unknownData?.originalHeight ?? img?.naturalHeight;

					if (rawNode.width && rawNode.height && origW && origH) {
						if (Math.abs(rawNode.width - origW) > 2 || Math.abs(rawNode.height - origH) > 2) {
							isResized = true;
						}
					}
				}
			});

			if (!hasAnyImage && targetNodeEl) {
				hasAnyImage = Boolean(targetNodeEl.querySelector('.kambas-embedded-img') || this.canvasImageHandler.getNativeImageElement(targetNodeEl));
				if (hasAnyImage) hasAnyMedia = true;
			}

			const t = getText();
			menu.addSeparator();

			if (hasAnyImage) {
				menu.addItem((item: import('obsidian').MenuItem) => {
					item.setTitle(t.flipHorizontal)
						.setIcon('flip-horizontal')
						.setChecked(isFlippedH)
						.onClick(() => {
							void this.canvasImageHandler.toggleSelectedImageTransform(activeView, 'h', targetNodeEl);
						});
				});

				menu.addItem((item: import('obsidian').MenuItem) => {
					item.setTitle(t.flipVertical)
						.setIcon('flip-vertical')
						.setChecked(isFlippedV)
						.onClick(() => {
							void this.canvasImageHandler.toggleSelectedImageTransform(activeView, 'v', targetNodeEl);
						});
				});

				menu.addItem((item: import('obsidian').MenuItem) => {
					item.setTitle(t.toggleGrayscale)
						.setIcon('contrast')
						.setChecked(isGrayscaled)
						.onClick(() => {
							void this.canvasImageHandler.toggleSelectedImageTransform(activeView, 'g', targetNodeEl);
						});
				});
			}

			// Opacity is supported on any canvas element (text cards, images, files, groups)
			menu.addItem((item: import('obsidian').MenuItem) => {
				const opacityPct = Math.round(currentOpacity * 100);
				item.setTitle(`${t.changeOpacity} (${opacityPct}%)`)
					.setIcon('droplet')
					.setChecked(currentOpacity < 1)
					.onClick(() => {
						new OpacityModal(this.app, currentOpacity, (opacity) => {
							this.canvasImageHandler.setSelectedNodeOpacity(activeView, opacity, targetNodeEl);
						}).open();
					});
			});

			if (isResized) {
				menu.addItem((item: import('obsidian').MenuItem) => {
					item.setTitle(t.resetSize)
						.setIcon('rotate-ccw')
						.onClick(() => {
							this.canvasImageHandler.resetSelectedImageSize(activeView, targetNodeEl);
						});
				});
			}

			if (hasAnyMedia || hasNativeImage) {
				menu.addSeparator();
			}

			if (hasAnyMedia) {
				menu.addItem((item: import('obsidian').MenuItem) => {
					item.setTitle(t.moveSelectedMedia)
						.setIcon('folder-output')
						.onClick(() => {
							new FolderSuggestModal(this.app, (folder) => {
								void this.canvasImageHandler.moveSelectedMediaToFolder(activeView, folder, targetNodeEl);
							}).open();
						});
				});

				menu.addItem((item: import('obsidian').MenuItem) => {
					item.setTitle(t.copySelectedMedia)
						.setIcon('folder-input')
						.onClick(() => {
							new FolderSuggestModal(this.app, (folder) => {
								void this.canvasImageHandler.copySelectedMediaToFolder(activeView, folder, targetNodeEl);
							}).open();
						});
				});
			}

			if (hasNativeImage) {
				menu.addItem((item: import('obsidian').MenuItem) => {
					item.setTitle(t.convertToEmbed)
						.setIcon('file-input')
						.onClick(() => {
							void this.canvasImageHandler.convertSelectedVaultImagesToEmbed(activeView, targetNodeEl);
						});
				});
			}

			if (selectedImageCount === 1) {
				menu.addItem((item: import('obsidian').MenuItem) => {
					item.setTitle(t.copyImageToClipboard)
						.setIcon('copy')
						.onClick(() => {
							void this.canvasImageHandler.copySelectedImagesToClipboard(activeView, targetNodeEl);
						});
				});
			}
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

		// Canvas edge right-click context menu
		this.registerEvent(
			(this.app.workspace as unknown as {
				on(event: 'canvas:edge-menu', handler: (menu: Menu, edge: unknown) => void): import('obsidian').EventRef;
			}).on('canvas:edge-menu', (menu: Menu, edge: unknown) => {
				const activeView = this.app.workspace.getActiveViewOfType(ItemView) as unknown as CanvasItemView | null;
				if (!activeView || activeView.getViewType() !== 'canvas') return;
				const t = getText();

				const canvasEdge = edge as { lineGroupEl?: HTMLElement; lineElement?: HTMLElement; unknownData?: { kambasOpacity?: number } };
				const targetEl = canvasEdge.lineGroupEl ?? canvasEdge.lineElement;
				const currentOpacity = canvasEdge.unknownData?.kambasOpacity ?? 1;
				const opacityPct = Math.round(currentOpacity * 100);

				menu.addSeparator();
				menu.addItem((item: import('obsidian').MenuItem) => {
					item.setTitle(`${t.changeOpacity} (${opacityPct}%)`)
						.setIcon('droplet')
						.setChecked(currentOpacity < 1)
						.onClick(() => {
							new OpacityModal(this.app, currentOpacity, (opacity) => {
								this.canvasImageHandler.setSelectedEdgeOpacity(activeView, opacity, targetEl, canvasEdge);
							}).open();
						});
				});
			})
		);

		// Register native Obsidian command for Away Mode (only visible when focused in canvas)
		this.addCommand({
			id: 'toggle-away-mode',
			name: getText().awayMode,
			icon: 'eye-off',
			checkCallback: (checking: boolean) => {
				const activeView = this.app.workspace.getActiveViewOfType(ItemView) as unknown as CanvasItemView | null;
				if (activeView && activeView.getViewType() === 'canvas') {
					if (!checking) {
						this.canvasImageHandler.setAwayMode(activeView);
					}
					return true;
				}
				return false;
			},
		});
	}

	onunload(): void {
		document.body.classList.remove('kambas-hide-labels');
		if (this.canvasImageHandler) {
			this.canvasImageHandler.unregisterEvents();
		}
		if (this.canvasKeyboardPan) {
			this.canvasKeyboardPan.stopPan(true);
		}
	}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as Partial<KambasSettings> | null;
		this.settings = {
			...DEFAULT_SETTINGS,
			...data,
			keyboardPan: {
				...DEFAULT_SETTINGS.keyboardPan,
				...(data?.keyboardPan || {}),
				keys: {
					...DEFAULT_SETTINGS.keyboardPan.keys,
					...(data?.keyboardPan?.keys || {}),
				},
				maxSpeed: data?.keyboardPan?.maxSpeed ?? DEFAULT_SETTINGS.keyboardPan.maxSpeed,
			},
		};
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
