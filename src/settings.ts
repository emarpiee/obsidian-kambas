import {
	App,
	ItemView,
	Notice,
	PluginSettingTab,
	Setting,
	setIcon,
} from 'obsidian';

import { getText } from './i18n';
import type KambasPlugin from './main';

import {
	CanvasKeyboardPanSettings,
	DEFAULT_KEYBOARD_PAN_SETTINGS,
	Direction,
} from './canvas/CanvasKeyboardPan';
import { CanvasItemView } from './canvas/CanvasTypes';
import { formatKeyLabel, formatRecordedHotkey } from './utils/hotkeyUtils';

export interface FilterPreset {
	id: string;
	name: string;
	includeTags: string[];
	excludeTags: string[];
	includeColors: string[];
	excludeColors: string[];
}

export interface LodPresetValues {
	qualityFactor: number;
	tiers: number[];
	minSourceWidth: number;
	quality: number;
	concurrency: number;
	fastRasterWhileMoving: boolean;
	prewarm: boolean;
}

export const LOD_PRESETS: Record<
	'performance' | 'balanced' | 'high',
	LodPresetValues
> = {
	performance: {
		qualityFactor: 1.0,
		tiers: [128, 256, 512, 1024],
		minSourceWidth: 600,
		quality: 0.7,
		concurrency: 2,
		fastRasterWhileMoving: true,
		prewarm: false,
	},
	balanced: {
		qualityFactor: 1.15,
		tiers: [128, 320, 768, 1600],
		minSourceWidth: 900,
		quality: 0.82,
		concurrency: 3,
		fastRasterWhileMoving: false,
		prewarm: true,
	},
	high: {
		qualityFactor: 1.35,
		tiers: [256, 512, 1024, 2048],
		minSourceWidth: 1200,
		quality: 0.9,
		concurrency: 4,
		fastRasterWhileMoving: false,
		prewarm: true,
	},
};

export interface KambasSettings {
	hideImageLabel: boolean;
	showEmbeddedMediaLabel?: boolean; // Display native node labels on embedded media nodes
	preserveMediaFilenameOnIngest?: boolean; // Save original filename as label on drop/paste/convert
	enableGifTools?: boolean; // Enable GIF playback and extraction tool
	freezeGifOnZoomOut?: boolean; // Pause GIF playback when canvas is zoomed out
	gifZoomThreshold?: number; // Zoom scale threshold to pause GIF playback (0.1 - 1.0)
	tagBadgePosition: 'outside' | 'inside';
	tagZoomOnSelect: boolean;
	autoSelectFilteredItems?: boolean; // Automatically select canvas elements matching active filter panel selection
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
	grayscaleHotkey?: string; // Hotkey for Grayscale toggle
	flipHorizontalHotkey?: string; // Hotkey for Flip Horizontal toggle
	flipVerticalHotkey?: string; // Hotkey for Flip Vertical toggle
	paletteHotkey?: string; // Hotkey for Color Palette toggle
	addTagHotkey?: string; // Hotkey for Add/Edit Tag modal
	filterPanelHotkey?: string; // Hotkey for Tag & Color Filter Panel toggle
	keyboardPan: CanvasKeyboardPanSettings;
	tagColors?: Record<string, { text?: string; bg?: string }>;
	// LOD Settings
	enableLod?: boolean;
	lodPreset?: 'performance' | 'balanced' | 'high' | 'custom';
	lodTiers?: number[];
	lodQualityFactor?: number;
	lodMinSourceWidth?: number;
	lodMaxCacheMB?: number;
	lodMaxMemoryMB?: number;
	lodPrewarm?: boolean;
	lodConcurrency?: number;
	lodFastRasterWhileMoving?: boolean;
	lodQuality?: number;
	lodShowStatusBar?: boolean;
	debug?: boolean;
}

export const DEFAULT_SETTINGS: KambasSettings = {
	hideImageLabel: true,
	showEmbeddedMediaLabel: true,
	preserveMediaFilenameOnIngest: true,
	enableGifTools: true,
	freezeGifOnZoomOut: true,
	gifZoomThreshold: 0.4,
	tagBadgePosition: 'outside',
	tagZoomOnSelect: true,
	autoSelectFilteredItems: false,
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
	grayscaleHotkey: 'G',
	flipHorizontalHotkey: 'H',
	flipVerticalHotkey: 'V',
	paletteHotkey: 'P',
	addTagHotkey: 'T',
	filterPanelHotkey: 'F',
	keyboardPan: DEFAULT_KEYBOARD_PAN_SETTINGS,
	enableLod: true,
	lodPreset: 'balanced',
	lodTiers: [128, 320, 768, 1600],
	lodQualityFactor: 1.15,
	lodMinSourceWidth: 900,
	lodMaxCacheMB: 300,
	lodMaxMemoryMB: 96,
	lodPrewarm: true,
	lodConcurrency: 3,
	lodFastRasterWhileMoving: false,
	lodQuality: 0.82,
	lodShowStatusBar: true,
	debug: false,
	tagColors: {},
};

export type SingleHotkeyKey =
	| 'loupeHotkey'
	| 'selectionZoomToFitHotkey'
	| 'grayscaleHotkey'
	| 'flipHorizontalHotkey'
	| 'flipVerticalHotkey'
	| 'paletteHotkey'
	| 'addTagHotkey'
	| 'filterPanelHotkey';

export class KambasSettingTab extends PluginSettingTab {
	private plugin: KambasPlugin;
	private keySettingsListener: ((evt: KeyboardEvent) => void) | null = null;
	private activeDirection: Direction | null = null;
	private activeSingleKeyTarget: SingleHotkeyKey | null = null;
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
		this.activeSingleKeyTarget = null;
	}

	display(): void {
		this.cleanupKeyListener();

		const { containerEl } = this;
		containerEl.empty();
		const t = getText();

		// ==========================================
		// SECTION 1: 🎨 Display & Tags
		// ==========================================
		new Setting(containerEl).setName(t.settingsHeading).setHeading();

		new Setting(containerEl)
			.setName(t.showEmbeddedMediaLabelName ?? 'Show embedded media labels')
			.setDesc(
				t.showEmbeddedMediaLabelDesc ??
					'Display native canvas node labels when custom names or original filenames are set on embedded media nodes.'
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showEmbeddedMediaLabel ?? true)
					.onChange(async (value) => {
						this.plugin.settings.showEmbeddedMediaLabel = value;
						await this.plugin.saveSettings();
						this.plugin.applySettingsCss();
					})
			);

		new Setting(containerEl)
			.setName(
				t.preserveMediaFilenameName ?? 'Preserve original filename on ingest'
			)
			.setDesc(
				t.preserveMediaFilenameDesc ??
					'Automatically save original filenames as canvas node labels when dragging, dropping, or converting media files.'
			)
			.addToggle((toggle) =>
				toggle
					.setValue(
						this.plugin.settings.preserveMediaFilenameOnIngest ?? true
					)
					.onChange(async (value) => {
						this.plugin.settings.preserveMediaFilenameOnIngest = value;
						await this.plugin.saveSettings();
					})
			);

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
								this.plugin.canvasImageHandler.scanAndRestoreTransforms(
									activeView
								);
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
			.setName(t.autoSelectFilteredItemsName ?? 'Auto-select filtered items')
			.setDesc(
				t.autoSelectFilteredItemsDesc ??
					'Automatically select canvas elements matching active filter panel selection.'
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoSelectFilteredItems ?? false)
					.onChange(async (value) => {
						this.plugin.settings.autoSelectFilteredItems = value;
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

		// ==========================================
		// SECTION 2: 🔍 Inspection & Visual Tools
		// ==========================================
		new Setting(containerEl).setName(t.loupeHeading).setHeading();

		this.renderSingleKeyRecorderSetting(
			containerEl,
			t.loupeHotkeyName,
			t.loupeHotkeyDesc,
			this.plugin.settings.loupeHotkey ?? 'q',
			'q',
			'loupeHotkey'
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
			.setName(t.imageHotkeysHeading ?? 'Media & Canvas Action Hotkeys')
			.setHeading();

		this.renderSingleKeyRecorderSetting(
			containerEl,
			t.selectionZoomHotkeyName,
			t.selectionZoomHotkeyDesc,
			this.plugin.settings.selectionZoomToFitHotkey ?? 'Space',
			'Space',
			'selectionZoomToFitHotkey'
		);

		this.renderSingleKeyRecorderSetting(
			containerEl,
			t.grayscaleHotkeyName ?? 'Toggle grayscale hotkey',
			t.grayscaleHotkeyDesc ??
				'Hotkey to toggle grayscale effect on selected media nodes (Default: G).',
			this.plugin.settings.grayscaleHotkey ?? 'G',
			'G',
			'grayscaleHotkey'
		);

		this.renderSingleKeyRecorderSetting(
			containerEl,
			t.flipHorizontalHotkeyName ?? 'Flip horizontal hotkey',
			t.flipHorizontalHotkeyDesc ??
				'Hotkey to flip selected media nodes horizontally (Default: H).',
			this.plugin.settings.flipHorizontalHotkey ?? 'H',
			'H',
			'flipHorizontalHotkey'
		);

		this.renderSingleKeyRecorderSetting(
			containerEl,
			t.flipVerticalHotkeyName ?? 'Flip vertical hotkey',
			t.flipVerticalHotkeyDesc ??
				'Hotkey to flip selected media nodes vertically (Default: V).',
			this.plugin.settings.flipVerticalHotkey ?? 'V',
			'V',
			'flipVerticalHotkey'
		);

		this.renderSingleKeyRecorderSetting(
			containerEl,
			t.paletteHotkeyName ?? 'Color palette hotkey',
			t.paletteHotkeyDesc ??
				'Hotkey to toggle color palette swatches on selected image nodes (Default: P).',
			this.plugin.settings.paletteHotkey ?? 'P',
			'P',
			'paletteHotkey'
		);

		this.renderSingleKeyRecorderSetting(
			containerEl,
			t.addTagHotkeyName ?? 'Add tag hotkey',
			t.addTagHotkeyDesc ??
				'Hotkey to open tag manager for selected canvas nodes (Default: T).',
			this.plugin.settings.addTagHotkey ?? 'T',
			'T',
			'addTagHotkey'
		);

		this.renderSingleKeyRecorderSetting(
			containerEl,
			t.filterPanelHotkeyName ?? 'Filter panel hotkey',
			t.filterPanelHotkeyDesc ??
				'Hotkey to toggle tag & color filter panel (Default: F).',
			this.plugin.settings.filterPanelHotkey ?? 'F',
			'F',
			'filterPanelHotkey'
		);

		// ==========================================
		// SECTION 3: ⌨️ Keyboard Navigation Controls
		// ==========================================
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

		// ==========================================
		// SECTION 4: ⚡ Canvas Performance & Optimization (LOD)
		// ==========================================
		new Setting(containerEl)
			.setName(t.performanceHeading || 'Canvas Performance & Optimization')
			.setHeading();

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

		let isApplyingPreset = false;
		let dropdownComponent: any = null;
		let qualityFactorSlider: any = null;
		let tiersText: any = null;
		let minWidthText: any = null;
		let qualitySlider: any = null;
		let prewarmToggle: any = null;
		let concurrencySlider: any = null;
		let fastRasterToggle: any = null;

		let advancedContainer: HTMLElement | null = null;

		new Setting(containerEl)
			.setName(t.lodPresetName || 'Performance Profile')
			.setDesc(
				t.lodPresetDesc ||
					'Choose a preset that matches your computer speed and canvas size.'
			)
			.addDropdown((dropdown) => {
				dropdownComponent = dropdown;
				dropdown
					.addOption(
						'performance',
						t.lodPresetPerformance || 'Performance (Fastest)'
					)
					.addOption(
						'balanced',
						t.lodPresetBalanced || 'Balanced (Recommended)'
					)
					.addOption('high', t.lodPresetHigh || 'High Quality')
					.addOption('custom', t.lodPresetCustom || 'Custom (Advanced)')
					.setValue(this.plugin.settings.lodPreset ?? 'balanced')
					.onChange(async (v: string) => {
						const value = v as 'performance' | 'balanced' | 'high' | 'custom';
						this.plugin.settings.lodPreset = value;
						if (value !== 'custom' && LOD_PRESETS[value]) {
							const p = LOD_PRESETS[value];
							this.plugin.settings.lodQualityFactor = p.qualityFactor;
							this.plugin.settings.lodTiers = [...p.tiers];
							this.plugin.settings.lodMinSourceWidth = p.minSourceWidth;
							this.plugin.settings.lodQuality = p.quality;
							this.plugin.settings.lodConcurrency = p.concurrency;
							this.plugin.settings.lodFastRasterWhileMoving =
								p.fastRasterWhileMoving;
							this.plugin.settings.lodPrewarm = p.prewarm;

							isApplyingPreset = true;
							try {
								qualityFactorSlider?.setValue(p.qualityFactor);
								tiersText?.setValue(p.tiers.join(', '));
								minWidthText?.setValue(String(p.minSourceWidth));
								qualitySlider?.setValue(p.quality);
								prewarmToggle?.setValue(p.prewarm);
								concurrencySlider?.setValue(p.concurrency);
								fastRasterToggle?.setValue(p.fastRasterWhileMoving);
							} finally {
								isApplyingPreset = false;
							}

							if (advancedContainer) advancedContainer.style.display = 'none';
						} else {
							if (advancedContainer) advancedContainer.style.display = 'block';
						}
						await this.plugin.saveSettings();
					});
			});

		advancedContainer = containerEl.createDiv({
			cls: 'kambas-advanced-lod-container',
		});

		const where = containerEl.createEl('p', {
			cls: 'setting-item-description',
		});
		where.setText(
			t.lodCacheWhereDesc ||
				'Image proxies are cached locally in your Obsidian application database (IndexedDB). They are isolated to this device and will not count against Obsidian Sync limits.'
		);

		new Setting(containerEl)
			.setName(t.lodMaxCacheMBName || 'Maximum Cache Storage (MB)')
			.setDesc(
				t.lodMaxCacheMBDesc ||
					'Maximum disk space used to save small image copies on your device.'
			)
			.addText((tx) =>
				tx
					.setValue(String(this.plugin.settings.lodMaxCacheMB ?? 300))
					.onChange(async (v) => {
						const n = parseInt(v, 10);
						if (Number.isFinite(n) && n > 0) {
							this.plugin.settings.lodMaxCacheMB = n;
							await this.plugin.saveSettings();
						}
					})
			);

		const sizeSetting = new Setting(containerEl)
			.setName(t.lodCacheSizeLabel || 'Cache size')
			.setDesc('measuring...');

		const updateCacheSizeLabel = async () => {
			if (this.plugin.cache && this.plugin.cache.store) {
				const b = await this.plugin.cache.store.sizeBytes();
				const mem = this.plugin.cache.mem;
				sizeSetting.setDesc(
					`${(b / 1024 / 1024).toFixed(1)} MB stored, ` +
						`${mem.entries.size} proxies in memory (${(mem.bytes / 1024 / 1024).toFixed(1)} MB)`
				);
			}
		};
		void updateCacheSizeLabel();

		sizeSetting.addButton((btn) =>
			btn
				.setButtonText(t.clearLodCacheBtn || 'Clear')
				.setWarning()
				.onClick(async () => {
					if (this.plugin.cache) {
						await this.plugin.cache.clear();
					}
					new Notice(t.lodCacheClearedNotice || 'Cache cleared');
					await updateCacheSizeLabel();
				})
		);

		advancedContainer.style.display =
			this.plugin.settings.lodPreset === 'custom' ? 'block' : 'none';

		new Setting(advancedContainer)
			.setName(t.lodAdvancedHeading || 'Advanced Level of Detail Settings')
			.setDesc(
				t.lodAdvancedDesc ||
					'Fine-tune image sharpness, resolution tiers, thread limits, and preloading behaviors.'
			)
			.setHeading();

		const markCustom = async () => {
			if (isApplyingPreset) return;
			if (this.plugin.settings.lodPreset !== 'custom') {
				this.plugin.settings.lodPreset = 'custom';
				if (dropdownComponent) {
					dropdownComponent.setValue('custom');
				}
				advancedContainer.style.display = 'block';
				await this.plugin.saveSettings();
			}
		};

		new Setting(advancedContainer)
			.setName(t.lodQualityFactorName || 'Image Sharpness')
			.setDesc(
				t.lodQualityFactorDesc ||
					'Higher values make images sharper when zooming in. Lower values save computer memory.'
			)
			.addSlider((sl) => {
				qualityFactorSlider = sl;
				sl.setLimits(0.75, 2, 0.05)
					.setValue(this.plugin.settings.lodQualityFactor ?? 1.15)
					.setDynamicTooltip()
					.onChange(async (v) => {
						this.plugin.settings.lodQualityFactor = v;
						await markCustom();
						await this.plugin.saveSettings();
					});
			});

		new Setting(advancedContainer)
			.setName(t.lodTiersName || 'Image Size Tiers (px)')
			.setDesc(
				t.lodTiersDesc ||
					'Step sizes in pixels for creating smaller image copies. Separate numbers with commas (e.g. 128, 320, 768, 1600).'
			)
			.addText((tx) => {
				tiersText = tx;
				tx.setValue(
					(this.plugin.settings.lodTiers ?? [128, 320, 768, 1600]).join(', ')
				).onChange(async (v) => {
					const tiers = v
						.split(',')
						.map((x) => parseInt(x.trim(), 10))
						.filter((x) => Number.isFinite(x) && x > 16)
						.sort((a, b) => a - b);
					if (!tiers.length) return;
					this.plugin.settings.lodTiers = tiers;
					await markCustom();
					await this.plugin.saveSettings();
				});
			});

		new Setting(advancedContainer)
			.setName(t.lodMinSourceWidthName || 'Smallest Image to Optimize (px)')
			.setDesc(
				t.lodMinSourceWidthDesc ||
					'Images smaller than this width will not be changed because they already load quickly.'
			)
			.addText((tx) => {
				minWidthText = tx;
				tx.setValue(
					String(this.plugin.settings.lodMinSourceWidth ?? 900)
				).onChange(async (v) => {
					const n = parseInt(v, 10);
					if (Number.isFinite(n) && n > 0) {
						this.plugin.settings.lodMinSourceWidth = n;
						await markCustom();
						await this.plugin.saveSettings();
					}
				});
			});

		new Setting(advancedContainer)
			.setName(t.lodQualityName || 'Image Quality & Storage Size')
			.setDesc(
				t.lodQualityDesc ||
					'Higher values make images clearer. Lower values save disk space.'
			)
			.addSlider((sl) => {
				qualitySlider = sl;
				sl.setLimits(0.5, 0.95, 0.01)
					.setValue(this.plugin.settings.lodQuality ?? 0.82)
					.setDynamicTooltip()
					.onChange(async (v) => {
						this.plugin.settings.lodQuality = v;
						await markCustom();
						await this.plugin.saveSettings();
					});
			});

		new Setting(advancedContainer)
			.setName(t.lodPrewarmName || 'Preload Hidden Images')
			.setDesc(
				t.lodPrewarmDesc ||
					'Prepare images outside your screen view as soon as you open a canvas.'
			)
			.addToggle((tgl) => {
				prewarmToggle = tgl;
				tgl
					.setValue(this.plugin.settings.lodPrewarm ?? true)
					.onChange(async (v) => {
						this.plugin.settings.lodPrewarm = v;
						await markCustom();
						await this.plugin.saveSettings();
					});
			});

		new Setting(advancedContainer)
			.setName(t.lodConcurrencyName || 'Simultaneous Image Loading')
			.setDesc(
				t.lodConcurrencyDesc ||
					'How many images to process at the same time. Higher values load boards faster on strong computers.'
			)
			.addSlider((sl) => {
				concurrencySlider = sl;
				sl.setLimits(1, 6, 1)
					.setValue(this.plugin.settings.lodConcurrency ?? 2)
					.setDynamicTooltip()
					.onChange(async (v) => {
						this.plugin.settings.lodConcurrency = v;
						await markCustom();
						await this.plugin.saveSettings();
					});
			});

		new Setting(advancedContainer)
			.setName(t.lodFastRasterName || 'Fast Pan & Zooming')
			.setDesc(
				t.lodFastRasterDesc ||
					'Temporarily lowers image quality while panning or zooming so screen movement stays smooth.'
			)
			.addToggle((tgl) => {
				fastRasterToggle = tgl;
				tgl
					.setValue(this.plugin.settings.lodFastRasterWhileMoving ?? false)
					.onChange(async (v) => {
						this.plugin.settings.lodFastRasterWhileMoving = v;
						await markCustom();
						await this.plugin.saveSettings();
					});
			});

		// Status Bar & Diagnostics Sub-heading in Performance section
		new Setting(containerEl)
			.setName(t.lodOtherHeading || 'Status Bar & Diagnostics')
			.setHeading();

		new Setting(containerEl)
			.setName(t.lodShowStatusBarName || 'Show in status bar')
			.setDesc(
				t.lodShowStatusBarDesc ||
					'Display live LOD cache storage usage and active image proxy counts in the status bar.'
			)
			.addToggle((tgl) =>
				tgl
					.setValue(this.plugin.settings.lodShowStatusBar ?? true)
					.onChange(async (v) => {
						this.plugin.settings.lodShowStatusBar = v;
						await this.plugin.saveSettings();
						new Notice(
							t.lodShowStatusBarNotice || 'Reload the plugin to apply'
						);
					})
			);

		new Setting(containerEl)
			.setName(t.debugName || 'Debug logging')
			.setDesc(
				t.debugDesc ||
					'Writes zoom level and swap counts to the developer console (Ctrl+Shift+I).'
			)
			.addToggle((tgl) =>
				tgl
					.setValue(this.plugin.settings.debug ?? false)
					.onChange(async (v) => {
						this.plugin.settings.debug = v;
						await this.plugin.saveSettings();
					})
			);
	}

	private getAllConfiguredHotkeys(): Record<string, string> {
		return {
			panNorth: this.plugin.settings.keyboardPan.keys[Direction.North],
			panWest: this.plugin.settings.keyboardPan.keys[Direction.West],
			panSouth: this.plugin.settings.keyboardPan.keys[Direction.South],
			panEast: this.plugin.settings.keyboardPan.keys[Direction.East],
			zoomIn: this.plugin.settings.keyboardPan.keys[Direction.ZoomIn],
			zoomOut: this.plugin.settings.keyboardPan.keys[Direction.ZoomOut],
			loupeHotkey: this.plugin.settings.loupeHotkey ?? 'q',
			selectionZoomToFitHotkey:
				this.plugin.settings.selectionZoomToFitHotkey ?? 'Space',
			grayscaleHotkey: this.plugin.settings.grayscaleHotkey ?? 'G',
			flipHorizontalHotkey: this.plugin.settings.flipHorizontalHotkey ?? 'H',
			flipVerticalHotkey: this.plugin.settings.flipVerticalHotkey ?? 'V',
			paletteHotkey: this.plugin.settings.paletteHotkey ?? 'P',
			addTagHotkey: this.plugin.settings.addTagHotkey ?? 'T',
			filterPanelHotkey: this.plugin.settings.filterPanelHotkey ?? 'F',
		};
	}

	private hasDuplicateHotkeys(
		hotkeysMap: Record<string, string>,
		targetKey?: string
	): boolean {
		if (targetKey && hotkeysMap[targetKey] !== undefined) {
			const targetVal = (
				hotkeysMap[targetKey] === ' ' ? 'space' : hotkeysMap[targetKey]
			).toLowerCase();
			for (const [key, val] of Object.entries(hotkeysMap)) {
				if (key === targetKey) continue;
				const norm = (val === ' ' ? 'space' : val).toLowerCase();
				if (norm === targetVal) {
					return true;
				}
			}
			return false;
		}

		const normalizedKeys = Object.values(hotkeysMap).map((k) =>
			(k === ' ' ? 'space' : k).toLowerCase()
		);
		return new Set(normalizedKeys).size < normalizedKeys.length;
	}

	private async saveSingleHotkey(
		targetKey: SingleHotkeyKey,
		newKey: string
	): Promise<boolean> {
		const formattedKey = newKey === ' ' ? 'Space' : newKey;
		const currentHotkeys = this.getAllConfiguredHotkeys();
		currentHotkeys[targetKey] = formattedKey;

		if (this.hasDuplicateHotkeys(currentHotkeys, targetKey)) {
			const t = getText();
			new Notice(t.duplicateKeyNotice);
			this.cleanupKeyListener();
			return false;
		}

		this.plugin.settings[targetKey] = formattedKey;

		await this.plugin.saveSettings();
		this.cleanupKeyListener();
		return true;
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

		const currentHotkeys = {
			...this.getAllConfiguredHotkeys(),
			panNorth: keys[Direction.North],
			panWest: keys[Direction.West],
			panSouth: keys[Direction.South],
			panEast: keys[Direction.East],
			zoomIn: keys[Direction.ZoomIn],
			zoomOut: keys[Direction.ZoomOut],
		};

		if (this.hasDuplicateHotkeys(currentHotkeys)) {
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

	private getHotkeySetting(targetKey: SingleHotkeyKey): string {
		return (
			this.plugin.settings[targetKey] ??
			(DEFAULT_SETTINGS[targetKey] as string) ??
			''
		);
	}

	private renderSingleKeyRecorderSetting(
		containerEl: HTMLElement,
		name: string,
		desc: string,
		currentKey: string,
		defaultKey: string,
		targetKey: SingleHotkeyKey
	): void {
		const wrapper = containerEl.createDiv();

		const render = (isRecording: boolean, activeKeyVal: string) => {
			wrapper.empty();
			const t = getText();

			const badgeContainer = wrapper.createDiv({ cls: 'pan-kb-container' });
			const row = badgeContainer.createDiv({ cls: 'pan-kb-zoom-row' });
			const labelEl = row.createDiv({
				cls: ['pan-kb-label', 'pan-kb-zoom-label'],
				text: formatKeyLabel(activeKeyVal),
			});
			const keyEl = row.createDiv({ cls: ['pan-kb', 'pan-kb-zoom-icon'] });

			let icon = 'keyboard';
			switch (targetKey) {
				case 'loupeHotkey':
					icon = 'search';
					break;
				case 'selectionZoomToFitHotkey':
					icon = 'maximize-2';
					break;
				case 'grayscaleHotkey':
					icon = 'contrast';
					break;
				case 'flipHorizontalHotkey':
					icon = 'flip-horizontal';
					break;
				case 'flipVerticalHotkey':
					icon = 'flip-vertical';
					break;
				case 'paletteHotkey':
					icon = 'palette';
					break;
				case 'addTagHotkey':
					icon = 'tag';
					break;
				case 'filterPanelHotkey':
					icon = 'filter';
					break;
			}
			setIcon(keyEl, icon);

			if (isRecording) {
				keyEl.classList.add('active');
				labelEl.classList.add('active');
			}

			const setting = new Setting(wrapper).setName(name).setDesc(desc);

			setting
				.addExtraButton((button) => {
					button.setIcon('rotate-ccw');
					button.setTooltip(t.restoreDefaultTooltip);
					button.onClick(async () => {
						this.cleanupKeyListener();
						await this.saveSingleHotkey(targetKey, defaultKey);
						render(false, defaultKey);
					});
				})
				.addButton((button) => {
					button.setButtonText(
						isRecording
							? t.pressAnyKeyPrompt || 'Press key...'
							: t.changeHotkeyButton || 'Change hotkey'
					);
					button.onClick(() => {
						if (this.activeSingleKeyTarget === targetKey) {
							this.cleanupKeyListener();
							render(false, activeKeyVal);
							return;
						}

						this.cleanupKeyListener();
						this.activeSingleKeyTarget = targetKey;
						render(true, activeKeyVal);

						let recordedCombo = '';
						let isModifierOnly = false;

						const keydownListener = (evt: KeyboardEvent): void => {
							if (evt.repeat || evt.key === 'CapsLock') return;

							evt.preventDefault();
							evt.stopPropagation();

							const isModifier = ['Shift', 'Control', 'Alt', 'Meta'].includes(
								evt.key
							);
							const combo = formatRecordedHotkey(evt);

							if (isModifier) {
								isModifierOnly = true;
								recordedCombo = combo;
								render(true, combo);
							} else {
								cleanup();
								void this.saveSingleHotkey(targetKey, combo).then((success) => {
									render(
										false,
										success ? combo : this.getHotkeySetting(targetKey)
									);
								});
							}
						};

						const keyupListener = (evt: KeyboardEvent): void => {
							const isModifier = ['Shift', 'Control', 'Alt', 'Meta'].includes(
								evt.key
							);
							if (isModifier && isModifierOnly && recordedCombo) {
								cleanup();
								void this.saveSingleHotkey(targetKey, recordedCombo).then(
									(success) => {
										render(
											false,
											success ? recordedCombo : this.getHotkeySetting(targetKey)
										);
									}
								);
							}
						};

						const cleanup = () => {
							window.removeEventListener('keydown', keydownListener, true);
							window.removeEventListener('keyup', keyupListener, true);
							if (this.keySettingsListener === keydownListener) {
								this.keySettingsListener = null;
							}
							this.activeSingleKeyTarget = null;
						};

						this.keySettingsListener = keydownListener;
						window.addEventListener('keydown', keydownListener, true);
						window.addEventListener('keyup', keyupListener, true);
					});
				});
		};

		render(false, currentKey);
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
		return formatKeyLabel(key);
	}
}
