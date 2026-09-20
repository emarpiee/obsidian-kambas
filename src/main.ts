import { ItemView, Menu, Notice, Plugin, TFile, WorkspaceLeaf } from 'obsidian';

import { getText } from './i18n';
import './main.css';
import { DEFAULT_SETTINGS, KambasSettingTab, KambasSettings } from './settings';

import { CanvasImageHandler } from './canvas/CanvasImageHandler';
import {
	CanvasBinder,
	EXPORT_ACTION_RE,
	EXPORT_FORMAT_RE,
	ProxyCache,
	Semaphore,
	getLodSettings,
} from './canvas/CanvasImageLOD';
import { CanvasKeyboardPan } from './canvas/CanvasKeyboardPan';
import { CanvasLoupeInspector } from './canvas/CanvasLoupeInspector';
import { CanvasSelectionZoom } from './canvas/CanvasSelectionZoom';
import { CanvasItemView } from './canvas/CanvasTypes';
import { FolderSuggestModal } from './modals/FolderSuggestModal';
import { OpacityModal } from './modals/OpacityModal';

export default class KambasPlugin extends Plugin {
	public settings!: KambasSettings;
	public canvasImageHandler!: CanvasImageHandler;
	public cache!: ProxyCache;
	public binders = new Map<WorkspaceLeaf, CanvasBinder>();
	private _patched: Array<() => void> = [];
	public statusEl: HTMLElement | null = null;
	private _statusSig = '';
	private _tick = 0;
	public canvasKeyboardPan!: CanvasKeyboardPan;
	private canvasSelectionZoom!: CanvasSelectionZoom;
	private canvasLoupeInspector!: CanvasLoupeInspector;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.cache = new ProxyCache(this);

		if (getLodSettings(this).showStatusBar) {
			this.statusEl = this.addStatusBarItem();
			this.statusEl.addClass('cil-status');
		}

		this.addCommand({
			id: 'toggle-lod',
			name: 'Toggle proxy swapping (canvas image lod)',
			callback: async () => {
				this.settings.enableLod = !(this.settings.enableLod ?? true);
				await this.saveSettings();
				new Notice(
					`Canvas image lod: ${this.settings.enableLod ? 'enabled' : 'disabled'}`
				);
			},
		});

		this.addCommand({
			id: 'prewarm-active-lod',
			name: 'Build proxies for current canvas (canvas image lod)',
			checkCallback: (checking) => {
				const binder = this.activeBinder();
				if (!binder) return false;
				if (!checking) {
					void binder.prewarm();
					new Notice('Canvas image lod: building proxies...');
				}
				return true;
			},
		});

		this.addCommand({
			id: 'clear-lod-cache',
			name: 'Clear proxy cache (canvas image lod)',
			callback: async () => {
				for (const b of this.binders.values()) b.restoreAll();
				await this.cache.clear();
				new Notice('Canvas image lod: cache cleared');
				this.scheduleSyncAll();
			},
		});

		this.addCommand({
			id: 'restore-originals-lod',
			name: 'Restore original images on current canvas (canvas image lod)',
			checkCallback: (checking) => {
				const binder = this.activeBinder();
				if (!binder) return false;
				if (!checking) binder.suspend();
				return true;
			},
		});

		this.addCommand({
			id: 'toggle-embedded-media-labels',
			name:
				getText().toggleMediaLabelsCommand ?? 'Toggle embedded media labels',
			callback: async () => {
				this.settings.showEmbeddedMediaLabel = !(
					this.settings.showEmbeddedMediaLabel ?? true
				);
				await this.saveSettings();
				this.applySettingsCss();
			},
		});

		this.canvasImageHandler = new CanvasImageHandler(this.app, this);
		this.canvasImageHandler.registerEvents();

		this.canvasKeyboardPan = new CanvasKeyboardPan(
			this,
			() => this.settings.keyboardPan
		);
		this.canvasKeyboardPan.registerEvents();

		this.canvasSelectionZoom = new CanvasSelectionZoom(this);
		this.canvasSelectionZoom.registerEvents();

		this.canvasLoupeInspector = new CanvasLoupeInspector(this);

		// Add Settings Tab to Obsidian Settings
		this.addSettingTab(new KambasSettingTab(this.app, this));
		this.applySettingsCss();

		// Restore saved transforms & mount embedded link images on active leaf or layout changes
		const updateActiveCanvas = (): void => {
			this.refreshBinders();
			const activeView = this.app.workspace.getActiveViewOfType(ItemView);
			if (activeView?.getViewType() !== 'canvas') {
				for (const b of this.binders.values()) b.suspend();
				this.canvasImageHandler?.gifHandler?.detachAll();
				if (this.cache) this.cache.evictMemory();
				this.updateStatus();
				return;
			}
			const activeLeaf = activeView.leaf;
			for (const [leaf, b] of this.binders.entries()) {
				if (leaf === activeLeaf) {
					b.resume();
				} else {
					b.suspend();
				}
			}
			const canvasView = activeView as unknown as CanvasItemView;
			this.canvasImageHandler.scanAndRestoreTransforms(canvasView);
			this.updateStatus();
		};

		this.registerEvent(
			this.app.workspace.on('active-leaf-change', updateActiveCanvas)
		);
		this.registerEvent(
			this.app.workspace.on('layout-change', updateActiveCanvas)
		);

		this.registerInterval(
			window.setInterval(() => {
				try {
					const activeView = this.app.workspace.getActiveViewOfType(ItemView);
					if (activeView?.getViewType() !== 'canvas') return;

					if (
						this.binders.size !==
						this.app.workspace.getLeavesOfType('canvas').length
					) {
						this.refreshBinders();
					}
					this._tick = (this._tick || 0) + 1;
					const reconcile = this._tick % 5 === 0;
					const activeLeaf = activeView.leaf;
					const activeBinder = this.binders.get(activeLeaf);
					if (activeBinder && !activeBinder.suspended) {
						if (reconcile) activeBinder.reconcile();
						else activeBinder.schedule();
					}
					if (this._tick % 12 === 0) this.patchExportCommands();
				} catch (e) {
					console.error('[canvas-image-lod] periodic check failed', e);
				}
			}, 400)
		);

		this.app.workspace.onLayoutReady(() => {
			window.setTimeout(() => {
				try {
					this.refreshBinders();
					this.patchExportCommands();
					void this.cache.store.prune();
				} catch (e) {
					console.error('[canvas-image-lod] initial setup failed', e);
				}
			}, 0);
		});

		// Helper to append image transform items to a menu if any image node is selected
		const addTransformItemsToMenu = (
			menu: Menu,
			targetNodeEl?: HTMLElement
		): void => {
			const activeView = this.app.workspace.getActiveViewOfType(
				ItemView
			) as unknown as CanvasItemView | null;
			if (!activeView || activeView.getViewType() !== 'canvas') return;

			const canvas = activeView.canvas;
			if (!canvas?.nodes) return;

			let hasAnyImage = false;
			let hasAnyMedia = false;
			let hasAnyEmbeddedMedia = false;
			let hasNativeImage = false;
			let selectedImageCount = 0;
			let isFlippedH = false;
			let isFlippedV = false;
			let isGrayscaled = false;
			let isPaletteOn = false;
			let isResized = false;
			let currentOpacity = 1;

			canvas.nodes.forEach((canvasNode) => {
				const el = canvasNode.nodeEl;
				if (!el) return;
				const isSel =
					el.classList.contains('is-selected') ||
					(targetNodeEl && (el === targetNodeEl || el.contains(targetNodeEl)));
				if (isSel) {
					if (
						el.querySelector('.kambas-embedded-img') ||
						this.canvasImageHandler.getNativeImageElement(el)
					) {
						hasAnyImage = true;
						hasAnyMedia = true;
						selectedImageCount++;
					}

					const rawNodeObj = canvasNode as unknown as {
						file?: TFile | string | { path?: string };
						filePath?: string;
						url?: string;
						type?: string;
						unknownData?: {
							type?: string;
							url?: string;
							file?: string;
							kambasFlipH?: boolean;
							kambasFlipV?: boolean;
							kambasGrayscale?: boolean;
							kambasPalette?: boolean;
							kambasOpacity?: number;
							originalWidth?: number;
							originalHeight?: number;
						};
					};
					const unknownData = rawNodeObj.unknownData;

					const nodeUrl = rawNodeObj.url || unknownData?.url;
					let extractedPath: string | undefined;
					if (rawNodeObj.file instanceof TFile) {
						extractedPath = rawNodeObj.file.path;
					} else if (typeof rawNodeObj.file === 'string') {
						extractedPath = rawNodeObj.file;
					} else if (
						rawNodeObj.file &&
						typeof rawNodeObj.file === 'object' &&
						'path' in rawNodeObj.file
					) {
						extractedPath = (rawNodeObj.file as { path: string }).path;
					} else if (rawNodeObj.filePath) {
						extractedPath = rawNodeObj.filePath;
					} else if (unknownData?.file) {
						extractedPath = unknownData.file;
					}

					const isEmbeddedLink = Boolean(
						nodeUrl && nodeUrl.startsWith('data:image/')
					);
					const ext = extractedPath
						? extractedPath.split('.').pop()?.toLowerCase() || ''
						: '';
					const isVaultImageFile = Boolean(
						extractedPath &&
						[
							'png',
							'jpg',
							'jpeg',
							'gif',
							'bmp',
							'webp',
							'svg',
							'avif',
							'tiff',
							'tif',
						].includes(ext)
					);

					const isEmbedded = Boolean(
						(rawNodeObj.type === 'link' || unknownData?.type === 'link' || nodeUrl) &&
						!extractedPath
					) || Boolean(el?.querySelector('.kambas-embedded-img'));
					if (isEmbedded) hasAnyEmbeddedMedia = true;

					if (isEmbeddedLink || isVaultImageFile) {
						hasAnyMedia = true;
					}

					if (isVaultImageFile) {
						hasNativeImage = true;
					}

					if (unknownData?.kambasFlipH) isFlippedH = true;
					if (unknownData?.kambasFlipV) isFlippedV = true;
					if (unknownData?.kambasGrayscale) isGrayscaled = true;
					if (unknownData?.kambasPalette) isPaletteOn = true;
					if (unknownData?.kambasOpacity !== undefined)
						currentOpacity = unknownData.kambasOpacity;

					const rawNode = canvasNode as unknown as {
						width?: number;
						height?: number;
					};
					const img = el.querySelector<HTMLImageElement>('img');
					const origW = unknownData?.originalWidth ?? img?.naturalWidth;
					const origH = unknownData?.originalHeight ?? img?.naturalHeight;

					if (rawNode.width && rawNode.height && origW && origH) {
						if (
							Math.abs(rawNode.width - origW) > 2 ||
							Math.abs(rawNode.height - origH) > 2
						) {
							isResized = true;
						}
					}
				}
			});

			if (!hasAnyImage && targetNodeEl) {
				hasAnyImage = Boolean(
					targetNodeEl.querySelector('.kambas-embedded-img') ||
					this.canvasImageHandler.getNativeImageElement(targetNodeEl)
				);
				if (hasAnyImage) hasAnyMedia = true;
			}
			if (!hasAnyEmbeddedMedia && targetNodeEl) {
				hasAnyEmbeddedMedia = Boolean(
					targetNodeEl.querySelector('.kambas-embedded-img')
				);
			}

			const t = getText();
			menu.addSeparator();

			// ── Group 1: General Node Options (available on all canvas nodes) ─────────
			menu.addItem((item: import('obsidian').MenuItem) => {
				item
					.setTitle(t.tagNodes)
					.setIcon('tag')
					.onClick(() => {
						this.canvasImageHandler.openTagModal(activeView, targetNodeEl);
					});
			});

			if (hasAnyEmbeddedMedia) {
				menu.addItem((item: import('obsidian').MenuItem) => {
					item
						.setTitle(t.setMediaLabel ?? 'Set media label...')
						.setIcon('type')
						.onClick(() => {
							this.canvasImageHandler.openSetMediaLabelModal(
								activeView,
								targetNodeEl
							);
						});
				});
			}

			// ── Group 2: Image Filters & Transformations ─────────────────────────────
			if (hasAnyImage) {
				menu.addSeparator();

				menu.addItem((item: import('obsidian').MenuItem) => {
					item
						.setTitle(t.flipHorizontal)
						.setIcon('flip-horizontal')
						.setChecked(isFlippedH)
						.onClick(() => {
							void this.canvasImageHandler.toggleSelectedImageTransform(
								activeView,
								'h',
								targetNodeEl
							);
						});
				});

				menu.addItem((item: import('obsidian').MenuItem) => {
					item
						.setTitle(t.flipVertical)
						.setIcon('flip-vertical')
						.setChecked(isFlippedV)
						.onClick(() => {
							void this.canvasImageHandler.toggleSelectedImageTransform(
								activeView,
								'v',
								targetNodeEl
							);
						});
				});

				menu.addItem((item: import('obsidian').MenuItem) => {
					item
						.setTitle(t.toggleGrayscale)
						.setIcon('contrast')
						.setChecked(isGrayscaled)
						.onClick(() => {
							void this.canvasImageHandler.toggleSelectedImageTransform(
								activeView,
								'g',
								targetNodeEl
							);
						});
				});

				menu.addItem((item: import('obsidian').MenuItem) => {
					item
						.setTitle(t.togglePalette)
						.setIcon('palette')
						.setChecked(isPaletteOn)
						.onClick(() => {
							void this.canvasImageHandler.toggleSelectedImagePalette(
								activeView,
								targetNodeEl
							);
						});
				});

				menu.addItem((item: import('obsidian').MenuItem) => {
					const opacityPct = Math.round(currentOpacity * 100);
					item
						.setTitle(`${t.changeOpacity} (${opacityPct}%)`)
						.setIcon('droplet')
						.setChecked(currentOpacity < 1)
						.onClick(() => {
							new OpacityModal(this.app, currentOpacity, (opacity) => {
								this.canvasImageHandler.setSelectedNodeOpacity(
									activeView,
									opacity,
									targetNodeEl
								);
							}).open();
						});
				});

				if (isResized) {
					menu.addItem((item: import('obsidian').MenuItem) => {
						item
							.setTitle(t.resetSize)
							.setIcon('rotate-ccw')
							.onClick(() => {
								this.canvasImageHandler.resetSelectedImageSize(
									activeView,
									targetNodeEl
								);
							});
					});
				}
			} else {
				// If not an image node, show opacity under general options
				menu.addItem((item: import('obsidian').MenuItem) => {
					const opacityPct = Math.round(currentOpacity * 100);
					item
						.setTitle(`${t.changeOpacity} (${opacityPct}%)`)
						.setIcon('droplet')
						.setChecked(currentOpacity < 1)
						.onClick(() => {
							new OpacityModal(this.app, currentOpacity, (opacity) => {
								this.canvasImageHandler.setSelectedNodeOpacity(
									activeView,
									opacity,
									targetNodeEl
								);
							}).open();
						});
				});
			}

			// ── Group 3: File & Vault Actions ─────────────────────────────────────────
			if (hasAnyMedia || hasNativeImage) {
				menu.addSeparator();
			}

			if (hasAnyMedia) {
				menu.addItem((item: import('obsidian').MenuItem) => {
					item
						.setTitle(t.moveSelectedMedia)
						.setIcon('folder-output')
						.onClick(() => {
							new FolderSuggestModal(this.app, (folder) => {
								void this.canvasImageHandler.moveSelectedMediaToFolder(
									activeView,
									folder,
									targetNodeEl
								);
							}).open();
						});
				});

				menu.addItem((item: import('obsidian').MenuItem) => {
					item
						.setTitle(t.copySelectedMedia)
						.setIcon('folder-input')
						.onClick(() => {
							new FolderSuggestModal(this.app, (folder) => {
								void this.canvasImageHandler.copySelectedMediaToFolder(
									activeView,
									folder,
									targetNodeEl
								);
							}).open();
						});
				});
			}

			if (hasNativeImage) {
				menu.addItem((item: import('obsidian').MenuItem) => {
					item
						.setTitle(t.convertToEmbed)
						.setIcon('file-input')
						.onClick(() => {
							void this.canvasImageHandler.convertSelectedVaultImagesToEmbed(
								activeView,
								targetNodeEl
							);
						});
				});
			}

			if (selectedImageCount === 1) {
				menu.addItem((item: import('obsidian').MenuItem) => {
					item
						.setTitle(t.copyImageToClipboard)
						.setIcon('copy')
						.onClick(() => {
							void this.canvasImageHandler.copySelectedImagesToClipboard(
								activeView,
								targetNodeEl
							);
						});
				});

				menu.addItem((item: import('obsidian').MenuItem) => {
					item
						.setTitle(t.swapImage)
						.setIcon('image')
						.onClick(() => {
							void this.canvasImageHandler.swapSelectedImage(
								activeView,
								targetNodeEl
							);
						});
				});
			}

			if (hasAnyImage) {
				menu.addItem((item: import('obsidian').MenuItem) => {
					item
						.setTitle(t.optimizeImageSize)
						.setIcon('minimize-2')
						.onClick(() => {
							void this.canvasImageHandler.optimizeSelectedEmbeddedImages(
								activeView,
								targetNodeEl
							);
						});
				});
			}
		};

		// Single node context menu
		this.registerEvent(
			(
				this.app.workspace as unknown as {
					on(
						event: 'canvas:node-menu',
						handler: (menu: Menu, node: unknown) => void
					): import('obsidian').EventRef;
				}
			).on('canvas:node-menu', (menu: Menu, node: unknown) => {
				const canvasNode = node as { nodeEl?: HTMLElement };
				addTransformItemsToMenu(menu, canvasNode.nodeEl);
			})
		);

		// Multi-selection context menu
		this.registerEvent(
			(
				this.app.workspace as unknown as {
					on(
						event: 'canvas:selection-menu',
						handler: (menu: Menu) => void
					): import('obsidian').EventRef;
				}
			).on('canvas:selection-menu', (menu: Menu) => {
				addTransformItemsToMenu(menu);
			})
		);

		// Canvas edge right-click context menu
		this.registerEvent(
			(
				this.app.workspace as unknown as {
					on(
						event: 'canvas:edge-menu',
						handler: (menu: Menu, edge: unknown) => void
					): import('obsidian').EventRef;
				}
			).on('canvas:edge-menu', (menu: Menu, edge: unknown) => {
				const activeView = this.app.workspace.getActiveViewOfType(
					ItemView
				) as unknown as CanvasItemView | null;
				if (!activeView || activeView.getViewType() !== 'canvas') return;
				const t = getText();

				const canvasEdge = edge as {
					lineGroupEl?: HTMLElement;
					lineElement?: HTMLElement;
					unknownData?: { kambasOpacity?: number };
				};
				const targetEl = canvasEdge.lineGroupEl ?? canvasEdge.lineElement;
				const currentOpacity = canvasEdge.unknownData?.kambasOpacity ?? 1;
				const opacityPct = Math.round(currentOpacity * 100);

				menu.addSeparator();
				menu.addItem((item: import('obsidian').MenuItem) => {
					item
						.setTitle(`${t.changeOpacity} (${opacityPct}%)`)
						.setIcon('droplet')
						.setChecked(currentOpacity < 1)
						.onClick(() => {
							new OpacityModal(this.app, currentOpacity, (opacity) => {
								this.canvasImageHandler.setSelectedEdgeOpacity(
									activeView,
									opacity,
									targetEl,
									canvasEdge
								);
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
				const activeView = this.app.workspace.getActiveViewOfType(
					ItemView
				) as unknown as CanvasItemView | null;
				if (activeView && activeView.getViewType() === 'canvas') {
					if (!checking) {
						this.canvasImageHandler.setAwayMode(activeView);
					}
					return true;
				}
				return false;
			},
		});

		// Register command: Filter by tag (opens / closes the tag filter panel)
		this.addCommand({
			id: 'canvas-filter-by-tag',
			name: getText().tagFilterPanel,
			icon: 'tag',
			checkCallback: (checking: boolean) => {
				const activeView = this.app.workspace.getActiveViewOfType(
					ItemView
				) as unknown as CanvasItemView | null;
				if (activeView && activeView.getViewType() === 'canvas') {
					if (!checking) {
						this.canvasImageHandler.openTagFilterPanel(activeView);
					}
					return true;
				}
				return false;
			},
		});

		// Register command: Toggle tag visibility on canvas
		this.addCommand({
			id: 'canvas-toggle-tag-visibility',
			name: 'Toggle tag visibility',
			icon: 'tag',
			checkCallback: (checking: boolean) => {
				const activeView = this.app.workspace.getActiveViewOfType(
					ItemView
				) as unknown as CanvasItemView | null;
				if (activeView && activeView.getViewType() === 'canvas') {
					if (!checking) {
						document.body.classList.toggle('kambas-hide-all-tags');
					}
					return true;
				}
				return false;
			},
		});

		// Register command: Toggle auto-zoom on tag selection
		this.addCommand({
			id: 'canvas-toggle-auto-zoom',
			name: 'Toggle auto-zoom on tag selection',
			icon: 'zoom-in',
			checkCallback: (checking: boolean) => {
				const activeView = this.app.workspace.getActiveViewOfType(
					ItemView
				) as unknown as CanvasItemView | null;
				if (activeView && activeView.getViewType() === 'canvas') {
					if (!checking) {
						this.settings.tagZoomOnSelect = !this.settings.tagZoomOnSelect;
						void this.saveSettings();
					}
					return true;
				}
				return false;
			},
		});

		// Register command: Toggle GIF controls on/off
		this.addCommand({
			id: 'toggle-gif-controls',
			name: getText().gifToggleCommandName || 'Toggle GIF controls on/off',
			icon: 'film',
			callback: async () => {
				const newValue = !(this.settings.enableGifTools ?? true);
				this.settings.enableGifTools = newValue;
				await this.saveSettings();

				const t = getText();
				const msg = newValue
					? t.gifControlsEnabledNotice || 'GIF controls enabled'
					: t.gifControlsDisabledNotice || 'GIF controls disabled';
				new Notice(msg);

				const activeView = this.app.workspace.getActiveViewOfType(
					ItemView
				) as unknown as CanvasItemView | null;

				if (newValue) {
					if (activeView && activeView.getViewType() === 'canvas') {
						this.canvasImageHandler.scanAndRestoreTransforms(activeView);
					}
				} else {
					this.canvasImageHandler.gifHandler.detachAll();
				}
			},
		});
	}

	public getAllObsidianDocuments(): Document[] {
		const docs: Document[] = [document];
		this.app.workspace.iterateAllLeaves((leaf) => {
			const doc = leaf.view?.containerEl?.ownerDocument;
			if (doc && !docs.includes(doc)) {
				docs.push(doc);
			}
		});
		return docs;
	}

	onunload(): void {
		for (const revert of this._patched) {
			try {
				revert();
			} catch {
				/* nothing */
			}
		}
		this._patched = [];
		for (const b of this.binders.values()) b.stop();
		this.binders.clear();
		if (this.cache) this.cache.dispose();

		this.getAllObsidianDocuments().forEach((doc) => {
			doc.body.classList.remove('kambas-hide-labels');
			doc.body.classList.remove('kambas-hide-all-tags');
			doc.body.classList.remove('kambas-tag-position-inside');
		});
		if (this.canvasImageHandler) {
			this.canvasImageHandler.cleanupCanvasResources();
			this.canvasImageHandler.unregisterEvents();
		}
		if (this.canvasKeyboardPan) {
			this.canvasKeyboardPan.stopPan(true);
		}
		if (this.canvasLoupeInspector) {
			this.canvasLoupeInspector.destroy();
		}
	}

	patchExportCommands(): void {
		const appWithCommands = this.app as unknown as {
			commands?: { commands?: Record<string, Record<string, unknown>> };
		};
		const commands = appWithCommands.commands?.commands || {};
		for (const id of Object.keys(commands)) {
			if (!EXPORT_ACTION_RE.test(id) || !EXPORT_FORMAT_RE.test(id)) continue;
			this.wrapCommand(commands[id], id);
		}
	}

	wrapCommand(cmdObj: unknown, id: string): void {
		const cmd = cmdObj as {
			_cilPatched?: boolean;
			callback?: (...args: unknown[]) => unknown;
			checkCallback?: (checking: boolean, ...args: unknown[]) => unknown;
		} | null;
		if (!cmd || cmd._cilPatched) return;
		const self = this;
		cmd._cilPatched = true;

		if (typeof cmd.callback === 'function') {
			const orig = cmd.callback;
			cmd.callback = function (...args: unknown[]): unknown {
				return self.beforeExport(() => orig.apply(this, args));
			};
			this._patched.push(() => {
				cmd.callback = orig;
				delete cmd._cilPatched;
			});
		} else if (typeof cmd.checkCallback === 'function') {
			const orig = cmd.checkCallback;
			cmd.checkCallback = function (
				checking: boolean,
				...args: unknown[]
			): unknown {
				if (checking) return orig.call(this, true, ...args);
				self.beforeExport(() => orig.call(this, false, ...args));
				return true;
			};
			this._patched.push(() => {
				cmd.checkCallback = orig;
				delete cmd._cilPatched;
			});
		}
		if (getLodSettings(this).debug) {
			console.debug('[canvas-image-lod] wrapped export command', id);
		}
	}

	beforeExport(run: () => void): void {
		const binder = this.activeBinder();
		if (!binder || !binder.hasProxies()) return run();
		binder.suspend();
		void binder.waitForImages(8000).then(run, run);
	}

	activeBinder(): CanvasBinder | null {
		const leaf = (
			this.app.workspace as unknown as { activeLeaf?: WorkspaceLeaf }
		).activeLeaf;
		const direct = leaf ? this.binders.get(leaf) : null;
		if (direct) return direct;
		return this.binders.size === 1
			? this.binders.values().next().value || null
			: null;
	}

	refreshBinders(): void {
		let leaves: Set<WorkspaceLeaf>;
		try {
			leaves = new Set(this.app.workspace.getLeavesOfType('canvas'));
		} catch (e) {
			console.error('[canvas-image-lod] could not list canvas leaves', e);
			return;
		}

		for (const [leaf, binder] of Array.from(this.binders.entries())) {
			if (leaves.has(leaf)) continue;
			try {
				binder.stop();
			} catch (e) {
				console.error('[canvas-image-lod] failed to unbind from a canvas', e);
			}
			this.binders.delete(leaf);
		}

		for (const leaf of Array.from(leaves)) {
			if (this.binders.has(leaf)) continue;
			try {
				const binder = new CanvasBinder(this, leaf.view);
				if (binder.start()) this.binders.set(leaf, binder);
			} catch (e) {
				console.error('[canvas-image-lod] failed to bind to a canvas', e);
			}
		}
		this.updateStatus();
	}

	collectPinnedUrls(): Set<string> {
		const pinned = new Set<string>();
		for (const b of this.binders.values()) {
			if (!b.canvasEl) continue;
			for (const img of Array.from(b.canvasEl.querySelectorAll('img'))) {
				const src = img.getAttribute('src');
				if (src && src.startsWith('blob:')) pinned.add(src);
			}
		}
		return pinned;
	}

	scheduleSyncAll(): void {
		for (const b of this.binders.values()) {
			b.dirty = true;
			b.lastScale = -1;
			b.schedule();
		}
	}

	updateStatus(): void {
		if (!this.statusEl) return;

		const activeView = this.app.workspace.getActiveViewOfType(ItemView);
		const hasActiveCanvas = activeView?.getViewType() === 'canvas';

		if (!hasActiveCanvas) {
			this.statusEl.hide();
			this._statusSig = '';
			return;
		}

		this.statusEl.show();

		const s = getLodSettings(this);
		const st = this.cache.stats;
		const sig = `${s.enabled}|${st.pending}|${this.cache.mem.entries.size}|${st.failed}`;
		if (sig === this._statusSig) return;
		this._statusSig = sig;

		if (!s.enabled) {
			this.statusEl.setText('Lod off');
			this.statusEl.className = 'status-bar-item cil-status cil-status-off';
			return;
		}
		if (st.pending > 0) {
			this.statusEl.setText(`LOD ${st.pending}`);
			this.statusEl.className = 'status-bar-item cil-status cil-status-working';
			return;
		}
		const ready = this.cache.mem.entries.size;
		this.statusEl.setText(ready ? `LOD ${ready}` : 'LOD');
		this.statusEl.className = 'status-bar-item cil-status';
		this.statusEl.title =
			`Proxies in memory: ${ready} (${(this.cache.mem.bytes / 1024 / 1024).toFixed(1)} MB)\n` +
			`Built: ${st.generated}, reused from cache: ${st.restored}, failed: ${st.failed}`;
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
				maxSpeed:
					data?.keyboardPan?.maxSpeed ?? DEFAULT_SETTINGS.keyboardPan.maxSpeed,
			},
		};
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		const s = getLodSettings(this);
		if (this.cache && this.cache.inflight.size === 0) {
			this.cache.sem = new Semaphore(s.concurrency);
		}
		if (!s.enabled) {
			for (const b of this.binders.values()) b.restoreAll();
		} else {
			this.scheduleSyncAll();
		}
		if (this.cache) {
			this.cache.evictMemory();
		}
		this.updateStatus();
	}

	applySettingsCss(): void {
		const updateDoc = (doc: Document): void => {
			const showLabels = this.settings.showEmbeddedMediaLabel ?? true;
			doc.body.classList.toggle('kambas-hide-labels', !showLabels);

			if (this.settings.tagBadgePosition === 'inside') {
				doc.body.classList.add('kambas-tag-position-inside');
			} else {
				doc.body.classList.remove('kambas-tag-position-inside');
			}
		};
		this.getAllObsidianDocuments().forEach(updateDoc);
	}
}
