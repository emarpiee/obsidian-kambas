import { App, ItemView, Notice, PluginSettingTab, Setting, setIcon } from 'obsidian';

import { getText } from './i18n';
import type KambasPlugin from './main';
import { CanvasItemView } from './canvas/CanvasTypes';

import {
	CanvasKeyboardPanSettings,
	DEFAULT_KEYBOARD_PAN_SETTINGS,
	Direction,
} from './canvas/CanvasKeyboardPan';

export interface FilterPreset {
	id: string;
	name: string;
	includeTags: string[];
	excludeTags: string[];
	includeColors: string[];
	excludeColors: string[];
}

export interface KambasSettings {
	hideImageLabel: boolean;
	enableGifTools?: boolean; // Enable GIF playback and extraction tool
	tagBadgePosition: 'outside' | 'inside';
	tagZoomOnSelect: boolean;
	tagPanelAutoClose: boolean; // Auto-close filter panel when canvas/panel loses focus
	paletteSwatchCount: number; // 3 to 10 swatches
	paletteCopySeparator: string; // Separator for copied hex values
	colorExtractMode: 'auto' | 'manual' | 'disabled'; // Color filter extraction mode
	colorIncludeAccents: boolean; // Include minor accent colors in filter extraction
	colorShowName: boolean; // Display color name text in color filter panel list
	colorIncludeNodeColor: boolean; // Include native canvas node custom border/background color
	filterPresets: FilterPreset[]; // Saved filter panel state presets
	autoOptimizeBase64OnIngest: boolean; // Automatically optimize Base64 strings on paste/drop
	base64MaxDimension: number; // Max resolution for compressed Base64 images
	base64Quality: number; // Quality for WebP compression (0.1 - 1.0)
	loupeHotkey: string; // Hotkey for Loupe Zoom Inspector
	loupeZoomLevel: number; // Magnification factor (1.5x - 10.0x)
	loupeSize: number; // Loupe lens diameter in px (100px - 600px)
	loupeShape: 'circle' | 'square' | 'rounded'; // Loupe lens shape
	loupeSmoothing: number; // Mouse tracking interpolation factor (0.05 - 1.0, lower = smoother/less sensitive)
	selectionZoomToFitHotkey: string; // Hotkey to zoom to fit selected elements
	keyboardPan: CanvasKeyboardPanSettings;
	tagColors?: Record<string, { text?: string; bg?: string }>;
	// LOD Settings
	enableLod?: boolean;
	lodTiers?: number[];
	lodQualityFactor?: number;
	lodMinSourceWidth?: number;
	lodMaxCacheMB?: number;
	lodMaxMemoryMB?: number;
	lodPrewarm?: boolean;
	lodConcurrency?: number;
	lodFastRasterWhileMoving?: boolean;
	lodProxyGifs?: boolean;
	lodQuality?: number;
	lodShowStatusBar?: boolean;
	debug?: boolean;
}

export const DEFAULT_SETTINGS: KambasSettings = {
	hideImageLabel: true,
	enableGifTools: true,
	tagBadgePosition: 'outside',
	tagZoomOnSelect: true,
	tagPanelAutoClose: true,
	paletteSwatchCount: 5,
	paletteCopySeparator: ', ',
	colorExtractMode: 'auto',
	colorIncludeAccents: false,
	colorShowName: true,
	colorIncludeNodeColor: false,
	filterPresets: [],
	autoOptimizeBase64OnIngest: false,
	base64MaxDimension: 2048,
	base64Quality: 0.82,
	loupeHotkey: 'q',
	loupeZoomLevel: 3.0,
	loupeSize: 260,
	loupeShape: 'circle',
	loupeSmoothing: 0.25,
	selectionZoomToFitHotkey: 'Space',
	keyboardPan: DEFAULT_KEYBOARD_PAN_SETTINGS,
	enableLod: true,
	lodTiers: [128, 320, 768, 1600],
	lodQualityFactor: 1.15,
	lodMinSourceWidth: 900,
	lodMaxCacheMB: 300,
	lodMaxMemoryMB: 96,
	lodPrewarm: true,
	lodConcurrency: 2,
	lodFastRasterWhileMoving: false,
	lodProxyGifs: true,
	lodQuality: 0.82,
	lodShowStatusBar: true,
	debug: false,
	tagColors: {},
};

const KeyLabelOverrides: Record<string, string> = {
	ArrowUp: 'Up',
	ArrowLeft: 'Left',
	ArrowDown: 'Down',
	ArrowRight: 'Right',
};

export class KambasSettingTab extends PluginSettingTab {
	private plugin: KambasPlugin;
	private keySettingsListener: ((evt: KeyboardEvent) => void) | null = null;
	private activeDirection: Direction | null = null;
	private keys: Partial<CanvasKeyboardPanSettings['keys']> = {};

	constructor(app: App, plugin: KambasPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	hide(): void {
		this.cleanupKeyListener();
		super.hide();
	}

	private cleanupKeyListener(): void {
		if (this.keySettingsListener) {
			window.removeEventListener('keydown', this.keySettingsListener, true);
			this.keySettingsListener = null;
		}
		this.activeDirection = null;
	}

	display(): void {
		this.cleanupKeyListener();

		const { containerEl } = this;
		containerEl.empty();
		const t = getText();

		// Display & Canvas Section Header
		new Setting(containerEl).setName(t.settingsHeading).setHeading();

		new Setting(containerEl)
			.setName(t.gifEnableSettingName || 'Enable GIF controls')
			.setDesc(
				t.gifEnableSettingDesc ||
					'Show GIF playback toolbar, timeline scrubber, and frame extraction on GIF nodes.'
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableGifTools ?? true)
					.onChange(async (value) => {
						this.plugin.settings.enableGifTools = value;
						await this.plugin.saveSettings();
						if (value) {
							const activeView = this.app.workspace.getActiveViewOfType(
								ItemView
							) as unknown as CanvasItemView | null;
							if (activeView && activeView.getViewType() === 'canvas') {
								this.plugin.canvasImageHandler.scanAndRestoreTransforms(activeView);
							}
						} else {
							this.plugin.canvasImageHandler.gifHandler.detachAll();
						}
					})
			);

		new Setting(containerEl)
			.setName(t.tagBadgePositionName)
			.setDesc(t.tagBadgePositionDesc)
			.addDropdown((dropdown) =>
				dropdown
					.addOption('outside', t.tagBadgePositionOutside)
					.addOption('inside', t.tagBadgePositionInside)
					.setValue(this.plugin.settings.tagBadgePosition ?? 'outside')
					.onChange(async (value: string) => {
						this.plugin.settings.tagBadgePosition = value as
							| 'outside'
							| 'inside';
						await this.plugin.saveSettings();
						this.plugin.applySettingsCss();
					})
			);

		new Setting(containerEl)
			.setName(t.tagZoomOnSelectName)
			.setDesc(t.tagZoomOnSelectDesc)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.tagZoomOnSelect ?? true)
					.onChange(async (value) => {
						this.plugin.settings.tagZoomOnSelect = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t.tagPanelAutoCloseName)
			.setDesc(t.tagPanelAutoCloseDesc)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.tagPanelAutoClose ?? true)
					.onChange(async (value) => {
						this.plugin.settings.tagPanelAutoClose = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t.paletteSwatchCountName ?? 'Color palette swatches')
			.setDesc(
				t.paletteSwatchCountDesc ??
					'Number of dominant colors to display when the color palette is enabled on an image (3–10).'
			)
			.addSlider((slider) =>
				slider
					.setLimits(3, 10, 1)
					.setValue(this.plugin.settings.paletteSwatchCount ?? 5)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.paletteSwatchCount = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t.paletteCopySeparatorName)
			.setDesc(t.paletteCopySeparatorDesc)
			.addText((text) =>
				text
					.setPlaceholder(', ')
					.setValue(this.plugin.settings.paletteCopySeparator ?? ', ')
					.onChange(async (value) => {
						this.plugin.settings.paletteCopySeparator = value;
						await this.plugin.saveSettings();
					})
			);

		// Color Filter Section
		new Setting(containerEl).setName(t.colorFilterPanel).setHeading();

		new Setting(containerEl)
			.setName(t.colorExtractModeName)
			.setDesc(t.colorExtractModeDesc)
			.addDropdown((dropdown) =>
				dropdown
					.addOption('auto', t.colorModeAuto)
					.addOption('manual', t.colorModeManual)
					.addOption('disabled', t.colorModeDisabled)
					.setValue(this.plugin.settings.colorExtractMode ?? 'auto')
					.onChange(async (value: string) => {
						this.plugin.settings.colorExtractMode = value as
							| 'auto'
							| 'manual'
							| 'disabled';
						await this.plugin.saveSettings();
					})
			);

		// Performance & Base64 Optimization Section
		new Setting(containerEl).setName(t.base64Heading).setHeading();

		new Setting(containerEl)
			.setName(t.autoOptimizeBase64Name)
			.setDesc(t.autoOptimizeBase64Desc)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoOptimizeBase64OnIngest ?? false)
					.onChange(async (value) => {
						this.plugin.settings.autoOptimizeBase64OnIngest = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t.base64MaxDimensionName)
			.setDesc(t.base64MaxDimensionDesc)
			.addText((text) =>
				text
					.setPlaceholder('2048')
					.setValue(String(this.plugin.settings.base64MaxDimension ?? 2048))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num > 0) {
							this.plugin.settings.base64MaxDimension = num;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName(t.base64QualityName ?? 'WebP compression quality')
			.setDesc(
				t.base64QualityDesc ??
					'Quality target for WebP image compression (0.10 to 1.00).'
			)
			.addSlider((slider) =>
				slider
					.setLimits(0.1, 1.0, 0.05)
					.setValue(this.plugin.settings.base64Quality ?? 0.82)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.base64Quality = value;
						await this.plugin.saveSettings();
					})
			);

		// Canvas Image Level of Detail (LOD) Section Header
		new Setting(containerEl).setName(t.lodHeading).setHeading();

		new Setting(containerEl)
			.setName(t.enableLodName)
			.setDesc(t.enableLodDesc)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableLod ?? true)
					.onChange(async (value) => {
						this.plugin.settings.enableLod = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl).setName(t.lodQualityHeading || 'Quality').setHeading();

		new Setting(containerEl)
			.setName(t.lodQualityFactorName || 'Quality headroom')
			.setDesc(
				t.lodQualityFactorDesc ||
					'How much larger than strictly needed each proxy is. Lower is faster and softer, higher is sharper. 1.15 is usually indistinguishable from the original.'
			)
			.addSlider((sl) =>
				sl
					.setLimits(0.75, 2, 0.05)
					.setValue(this.plugin.settings.lodQualityFactor ?? 1.15)
					.setDynamicTooltip()
					.onChange(async (v) => {
						this.plugin.settings.lodQualityFactor = v;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t.lodTiersName || 'Detail levels')
			.setDesc(t.lodTiersDesc || 'Proxy widths in pixels, comma separated, ascending.')
			.addText((tx) =>
				tx.setValue((this.plugin.settings.lodTiers ?? [128, 320, 768, 1600]).join(', ')).onChange(async (v) => {
					const tiers = v
						.split(',')
						.map((x) => parseInt(x.trim(), 10))
						.filter((x) => Number.isFinite(x) && x > 16)
						.sort((a, b) => a - b);
					if (!tiers.length) return;
					this.plugin.settings.lodTiers = tiers;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName(t.lodMinSourceWidthName || 'Minimum source width')
			.setDesc(t.lodMinSourceWidthDesc || 'Images narrower than this are left alone; the swap would not pay off.')
			.addText((tx) =>
				tx.setValue(String(this.plugin.settings.lodMinSourceWidth ?? 900)).onChange(async (v) => {
					const n = parseInt(v, 10);
					if (Number.isFinite(n) && n > 0) {
						this.plugin.settings.lodMinSourceWidth = n;
						await this.plugin.saveSettings();
					}
				})
			);

		new Setting(containerEl)
			.setName(t.lodQualityName || 'Proxy compression')
			.setDesc(t.lodQualityDesc || '0.6 is noticeably lighter, 0.9 is near lossless.')
			.addSlider((sl) =>
				sl
					.setLimits(0.5, 0.95, 0.01)
					.setValue(this.plugin.settings.lodQuality ?? 0.82)
					.setDynamicTooltip()
					.onChange(async (v) => {
						this.plugin.settings.lodQuality = v;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl).setName(t.lodPerfHeading || 'Performance').setHeading();

		new Setting(containerEl)
			.setName(t.lodPrewarmName || 'Build proxies ahead of time')
			.setDesc(t.lodPrewarmDesc || 'When a board opens, prepare every image in the background, including offscreen ones.')
			.addToggle((tgl) =>
				tgl.setValue(this.plugin.settings.lodPrewarm ?? true).onChange(async (v) => {
					this.plugin.settings.lodPrewarm = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName(t.lodConcurrencyName || 'Concurrent decodes')
			.setDesc(t.lodConcurrencyDesc || 'Each one briefly costs the full size of the image. Higher is faster but heavier.')
			.addSlider((sl) =>
				sl
					.setLimits(1, 6, 1)
					.setValue(this.plugin.settings.lodConcurrency ?? 2)
					.setDynamicTooltip()
					.onChange(async (v) => {
						this.plugin.settings.lodConcurrency = v;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t.lodFastRasterName || 'Cheap rasterization while moving')
			.setDesc(
				t.lodFastRasterDesc ||
					'For 200 ms during a zoom, images are drawn the quick way. Helps on the heaviest boards, but movement looks blockier.'
			)
			.addToggle((tgl) =>
				tgl.setValue(this.plugin.settings.lodFastRasterWhileMoving ?? false).onChange(async (v) => {
					this.plugin.settings.lodFastRasterWhileMoving = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName(t.lodProxyGifsName || 'Freeze GIFs when zoomed out')
			.setDesc(t.lodProxyGifsDesc || 'Animated GIFs show their first frame while small. Animation returns up close.')
			.addToggle((tgl) =>
				tgl.setValue(this.plugin.settings.lodProxyGifs ?? true).onChange(async (v) => {
					this.plugin.settings.lodProxyGifs = v;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl).setName(t.lodCacheHeading || 'Cache').setHeading();

		const where = containerEl.createEl('p', { cls: 'setting-item-description' });
		where.setText(
			t.lodCacheWhereDesc ||
				'Proxies are stored in the browser database inside your Obsidian profile, not in your vault. They never sync and never count against Obsidian Sync storage.'
		);

		new Setting(containerEl)
			.setName(t.lodMaxCacheMBName)
			.setDesc(t.lodMaxCacheMBDesc)
			.addText((tx) =>
				tx.setValue(String(this.plugin.settings.lodMaxCacheMB ?? 300)).onChange(async (v) => {
					const n = parseInt(v, 10);
					if (Number.isFinite(n) && n > 0) {
						this.plugin.settings.lodMaxCacheMB = n;
						await this.plugin.saveSettings();
					}
				})
			);

		new Setting(containerEl)
			.setName(t.lodMaxMemoryMBName)
			.setDesc(t.lodMaxMemoryMBDesc)
			.addText((tx) =>
				tx.setValue(String(this.plugin.settings.lodMaxMemoryMB ?? 96)).onChange(async (v) => {
					const n = parseInt(v, 10);
					if (Number.isFinite(n) && n > 0) {
						this.plugin.settings.lodMaxMemoryMB = n;
						await this.plugin.saveSettings();
					}
				})
			);

		const sizeSetting = new Setting(containerEl)
			.setName(t.lodCacheSizeLabel || 'Cache size')
			.setDesc('measuring...');

		if (this.plugin.cache && this.plugin.cache.store) {
			this.plugin.cache.store.sizeBytes().then((b) => {
				const mem = this.plugin.cache.mem;
				sizeSetting.setDesc(
					`${(b / 1024 / 1024).toFixed(1)} MB stored, ` +
						`${mem.entries.size} proxies in memory (${(mem.bytes / 1024 / 1024).toFixed(1)} MB)`
				);
			});
		}

		sizeSetting.addButton((btn) =>
			btn
				.setButtonText(t.clearLodCacheBtn || 'Clear')
				.setWarning()
				.onClick(async () => {
					if (this.plugin.cache) {
						await this.plugin.cache.clear();
					}
					new Notice(t.lodCacheClearedNotice || 'Cache cleared');
					this.display();
				})
		);

		new Setting(containerEl).setName(t.lodOtherHeading || 'Other').setHeading();

		new Setting(containerEl)
			.setName(t.lodShowStatusBarName || 'Show in status bar')
			.addToggle((tgl) =>
				tgl.setValue(this.plugin.settings.lodShowStatusBar ?? true).onChange(async (v) => {
					this.plugin.settings.lodShowStatusBar = v;
					await this.plugin.saveSettings();
					new Notice(t.lodShowStatusBarNotice || 'Reload the plugin to apply');
				})
			);

		new Setting(containerEl)
			.setName(t.debugName || 'Debug logging')
			.setDesc(t.debugDesc || 'Writes zoom level and swap counts to the developer console (Ctrl+Shift+I).')
			.addToggle((tgl) =>
				tgl.setValue(this.plugin.settings.debug ?? false).onChange(async (v) => {
					this.plugin.settings.debug = v;
					await this.plugin.saveSettings();
				})
			);

		// Visual Inspection Section
		new Setting(containerEl).setName(t.loupeHeading).setHeading();

		new Setting(containerEl)
			.setName(t.loupeHotkeyName)
			.setDesc(t.loupeHotkeyDesc)
			.addText((text) =>
				text
					.setPlaceholder('q')
					.setValue(this.plugin.settings.loupeHotkey ?? 'q')
					.onChange(async (value) => {
						this.plugin.settings.loupeHotkey =
							value.trim().toLowerCase() || 'q';
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t.loupeZoomLevelName)
			.setDesc(t.loupeZoomLevelDesc)
			.addSlider((slider) =>
				slider
					.setLimits(1.5, 10.0, 0.5)
					.setValue(this.plugin.settings.loupeZoomLevel ?? 3.0)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.loupeZoomLevel = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t.loupeSizeName)
			.setDesc(t.loupeSizeDesc)
			.addSlider((slider) =>
				slider
					.setLimits(100, 600, 20)
					.setValue(this.plugin.settings.loupeSize ?? 260)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.loupeSize = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t.loupeShapeName)
			.setDesc(t.loupeShapeDesc)
			.addDropdown((dropdown) =>
				dropdown
					.addOption('circle', t.loupeShapeCircle)
					.addOption('rounded', t.loupeShapeRounded)
					.addOption('square', t.loupeShapeSquare)
					.setValue(this.plugin.settings.loupeShape ?? 'circle')
					.onChange(async (value: string) => {
						this.plugin.settings.loupeShape = value as
							| 'circle'
							| 'square'
							| 'rounded';
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t.loupeSmoothingName)
			.setDesc(t.loupeSmoothingDesc)
			.addSlider((slider) =>
				slider
					.setLimits(0.05, 1.0, 0.05)
					.setValue(this.plugin.settings.loupeSmoothing ?? 0.5)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.loupeSmoothing = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t.selectionZoomHotkeyName)
			.setDesc(t.selectionZoomHotkeyDesc)
			.addText((text) =>
				text
					.setPlaceholder('Space')
					.setValue(this.plugin.settings.selectionZoomToFitHotkey ?? 'Space')
					.onChange(async (value) => {
						this.plugin.settings.selectionZoomToFitHotkey =
							value.trim() || 'Space';
						await this.plugin.saveSettings();
					})
			);

		// Canvas Keyboard Pan Controls Section
		new Setting(containerEl).setName(t.keyboardPanHeading).setHeading();

		const keyboardPanViewContainer = containerEl.createDiv();
		keyboardPanViewContainer.appendChild(
			this.renderPanView(this.plugin.settings.keyboardPan.keys, null)
		);

		new Setting(containerEl)
			.setName(t.panControlsName)
			.setDesc(t.panControlsDesc)
			.addExtraButton((button) => {
				button.setIcon('rotate-ccw');
				button.setTooltip(t.restoreDefaultTooltip);
				button.onClick(async () => {
					this.cleanupKeyListener();
					this.plugin.settings.keyboardPan.keys = {
						...this.plugin.settings.keyboardPan.keys,
						[Direction.North]:
							DEFAULT_KEYBOARD_PAN_SETTINGS.keys[Direction.North],
						[Direction.West]:
							DEFAULT_KEYBOARD_PAN_SETTINGS.keys[Direction.West],
						[Direction.South]:
							DEFAULT_KEYBOARD_PAN_SETTINGS.keys[Direction.South],
						[Direction.East]:
							DEFAULT_KEYBOARD_PAN_SETTINGS.keys[Direction.East],
					};
					await this.plugin.saveSettings();
					this.display();
				});
			})
			.addButton((button) => {
				button.setButtonText(t.updatePanControlsButton);
				button.onClick(() => {
					this.cleanupKeyListener();
					this.activeDirection = Direction.North;
					this.keys = { ...this.plugin.settings.keyboardPan.keys };

					keyboardPanViewContainer.empty();
					keyboardPanViewContainer.appendChild(
						this.renderPanView(this.keys, this.activeDirection)
					);

					const listener = (evt: KeyboardEvent): void => {
						if (
							evt.repeat ||
							['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(evt.key)
						) {
							return;
						}

						evt.preventDefault();
						evt.stopPropagation();

						if (this.activeDirection === null) {
							return;
						}

						this.keys[this.activeDirection] = evt.key;

						switch (this.activeDirection) {
							case Direction.North:
								this.activeDirection = Direction.West;
								break;
							case Direction.West:
								this.activeDirection = Direction.South;
								break;
							case Direction.South:
								this.activeDirection = Direction.East;
								break;
							case Direction.East:
								this.activeDirection = null;
								break;
						}

						keyboardPanViewContainer.empty();
						keyboardPanViewContainer.appendChild(
							this.renderPanView(this.keys, this.activeDirection)
						);

						if (this.activeDirection === null) {
							void this.saveKeys(this.keys);
						}
					};

					this.keySettingsListener = listener;
					window.addEventListener('keydown', listener, true);
				});
			});

		new Setting(containerEl)
			.setName(t.maxPanSpeedName)
			.setDesc(t.maxPanSpeedDesc)
			.addExtraButton((button) => {
				button.setIcon('rotate-ccw');
				button.setTooltip(t.restoreDefaultTooltip);
				button.onClick(async () => {
					this.plugin.settings.keyboardPan.maxSpeed =
						DEFAULT_KEYBOARD_PAN_SETTINGS.maxSpeed;
					await this.plugin.saveSettings();
					this.display();
				});
			})
			.addSlider((slider) => {
				slider
					.setLimits(50, 500, 10)
					.setValue(this.plugin.settings.keyboardPan.maxSpeed)
					.onChange((value) => {
						this.plugin.settings.keyboardPan.maxSpeed = value;
						void this.plugin.saveSettings();
					});
			});

		// Canvas Keyboard Zoom Controls Section
		new Setting(containerEl).setName(t.keyboardZoomHeading).setHeading();

		const keyboardZoomViewContainer = containerEl.createDiv();
		keyboardZoomViewContainer.appendChild(
			this.renderZoomView(this.plugin.settings.keyboardPan.keys, null)
		);

		new Setting(containerEl)
			.setName(t.zoomControlsName)
			.setDesc(t.zoomControlsDesc)
			.addExtraButton((button) => {
				button.setIcon('rotate-ccw');
				button.setTooltip(t.restoreDefaultTooltip);
				button.onClick(async () => {
					this.cleanupKeyListener();
					this.plugin.settings.keyboardPan.keys = {
						...this.plugin.settings.keyboardPan.keys,
						[Direction.ZoomIn]:
							DEFAULT_KEYBOARD_PAN_SETTINGS.keys[Direction.ZoomIn],
						[Direction.ZoomOut]:
							DEFAULT_KEYBOARD_PAN_SETTINGS.keys[Direction.ZoomOut],
					};
					await this.plugin.saveSettings();
					this.display();
				});
			})
			.addButton((button) => {
				button.setButtonText(t.updateZoomControlsButton);
				button.onClick(() => {
					this.cleanupKeyListener();
					this.activeDirection = Direction.ZoomIn;
					this.keys = { ...this.plugin.settings.keyboardPan.keys };

					keyboardZoomViewContainer.empty();
					keyboardZoomViewContainer.appendChild(
						this.renderZoomView(this.keys, this.activeDirection)
					);

					const listener = (evt: KeyboardEvent): void => {
						if (
							evt.repeat ||
							['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(evt.key)
						) {
							return;
						}

						evt.preventDefault();
						evt.stopPropagation();

						if (this.activeDirection === null) {
							return;
						}

						this.keys[this.activeDirection] = evt.key;

						switch (this.activeDirection) {
							case Direction.ZoomIn:
								this.activeDirection = Direction.ZoomOut;
								break;
							case Direction.ZoomOut:
								this.activeDirection = null;
								break;
						}

						keyboardZoomViewContainer.empty();
						keyboardZoomViewContainer.appendChild(
							this.renderZoomView(this.keys, this.activeDirection)
						);

						if (this.activeDirection === null) {
							void this.saveKeys(this.keys);
						}
					};

					this.keySettingsListener = listener;
					window.addEventListener('keydown', listener, true);
				});
			});

		new Setting(containerEl)
			.setName(t.zoomSpeedName)
			.setDesc(t.zoomSpeedDesc)
			.addExtraButton((button) => {
				button.setIcon('rotate-ccw');
				button.setTooltip(t.restoreDefaultTooltip);
				button.onClick(async () => {
					this.plugin.settings.keyboardPan.zoomSpeed =
						DEFAULT_KEYBOARD_PAN_SETTINGS.zoomSpeed;
					await this.plugin.saveSettings();
					this.display();
				});
			})
			.addSlider((slider) => {
				slider
					.setLimits(1, 50, 1)
					.setValue(
						Math.round(
							(this.plugin.settings.keyboardPan.zoomSpeed ??
								DEFAULT_KEYBOARD_PAN_SETTINGS.zoomSpeed) * 1000
						)
					)
					.onChange((value) => {
						this.plugin.settings.keyboardPan.zoomSpeed = value / 1000;
						void this.plugin.saveSettings();
					});
			});
	}

	public async saveKeys(
		keys: Partial<CanvasKeyboardPanSettings['keys']>
	): Promise<void> {
		if (
			!keys[Direction.North] ||
			!keys[Direction.West] ||
			!keys[Direction.South] ||
			!keys[Direction.East] ||
			!keys[Direction.ZoomIn] ||
			!keys[Direction.ZoomOut]
		) {
			return;
		}

		// Check for duplicate key assignments across pan and zoom controls
		const assignedValues = Object.values(keys);
		const uniqueValues = new Set(assignedValues);
		if (uniqueValues.size < assignedValues.length) {
			const t = getText();
			new Notice(t.duplicateKeyNotice);
			this.cleanupKeyListener();
			this.display();
			return;
		}

		this.plugin.settings.keyboardPan = {
			...this.plugin.settings.keyboardPan,
			keys: { ...(keys as Required<CanvasKeyboardPanSettings['keys']>) },
		};
		await this.plugin.saveSettings();
		this.cleanupKeyListener();
		this.display();
	}

	public renderPanView(
		keys: Partial<CanvasKeyboardPanSettings['keys']>,
		activeKey: Direction | null
	): HTMLElement {
		const container = createDiv({ cls: 'pan-kb-container' });

		const panGrid = container.createDiv({ cls: 'pan-kb-cross-grid' });

		const panDirs = [
			{
				dir: Direction.North,
				icon: 'arrow-up',
				keyArea: 'pan-key-north',
				labelArea: 'pan-label-north',
			},
			{
				dir: Direction.West,
				icon: 'arrow-left',
				keyArea: 'pan-key-west',
				labelArea: 'pan-label-west',
			},
			{
				dir: Direction.South,
				icon: 'arrow-down',
				keyArea: 'pan-key-south',
				labelArea: 'pan-label-south',
			},
			{
				dir: Direction.East,
				icon: 'arrow-right',
				keyArea: 'pan-key-east',
				labelArea: 'pan-label-east',
			},
		];

		for (const item of panDirs) {
			const labelEl = panGrid.createDiv({
				cls: ['pan-kb-label', item.labelArea],
				text: this.getKeyLabel(keys, item.dir),
			});
			const keyEl = panGrid.createDiv({ cls: ['pan-kb', item.keyArea] });
			setIcon(keyEl, item.icon);

			if (activeKey === item.dir) {
				keyEl.classList.add('active');
				labelEl.classList.add('active');
			}
		}

		return container;
	}

	public renderZoomView(
		keys: Partial<CanvasKeyboardPanSettings['keys']>,
		activeKey: Direction | null
	): HTMLElement {
		const container = createDiv({ cls: 'pan-kb-container' });

		const zoomStack = container.createDiv({ cls: 'pan-kb-zoom-stack' });

		const zoomDirs = [
			{ dir: Direction.ZoomIn, icon: 'zoom-in' },
			{ dir: Direction.ZoomOut, icon: 'zoom-out' },
		];

		for (const item of zoomDirs) {
			const row = zoomStack.createDiv({ cls: 'pan-kb-zoom-row' });
			const labelEl = row.createDiv({
				cls: ['pan-kb-label', 'pan-kb-zoom-label'],
				text: this.getKeyLabel(keys, item.dir),
			});
			const keyEl = row.createDiv({ cls: ['pan-kb', 'pan-kb-zoom-icon'] });
			setIcon(keyEl, item.icon);

			if (activeKey === item.dir) {
				keyEl.classList.add('active');
				labelEl.classList.add('active');
			}
		}

		return container;
	}

	public getKeyLabel(
		keys: Partial<CanvasKeyboardPanSettings['keys']>,
		direction: Direction
	): string {
		const key = keys[direction] ?? '?';
		return KeyLabelOverrides[key] ?? key;
	}
}
