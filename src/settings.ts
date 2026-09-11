import { App, Notice, PluginSettingTab, Setting, setIcon } from 'obsidian';
import { CanvasKeyboardPanSettings, DEFAULT_KEYBOARD_PAN_SETTINGS, Direction } from './canvas/CanvasKeyboardPan';
import { getText } from './i18n';
import type KambasPlugin from './main';

export interface KambasSettings {
	hideImageLabel: boolean;
	paletteSwatchCount: number; // 3 to 10 swatches
	keyboardPan: CanvasKeyboardPanSettings;
}

export const DEFAULT_SETTINGS: KambasSettings = {
	hideImageLabel: true,
	paletteSwatchCount: 5,
	keyboardPan: { ...DEFAULT_KEYBOARD_PAN_SETTINGS },
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
		new Setting(containerEl)
			.setName(t.settingsHeading)
			.setHeading();

		new Setting(containerEl)
			.setName(t.hideImageLabelName)
			.setDesc(t.hideImageLabelDesc)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.hideImageLabel)
					.onChange(async (value) => {
						this.plugin.settings.hideImageLabel = value;
						await this.plugin.saveSettings();
						this.plugin.applySettingsCss();
					})
			);

		new Setting(containerEl)
			.setName(t.paletteSwatchCountName ?? 'Color palette swatches')
			.setDesc(t.paletteSwatchCountDesc ?? 'Number of dominant colors to display when the color palette is enabled on an image (3–10).')
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

		// Canvas Keyboard Pan Controls Section
		new Setting(containerEl)
			.setName(t.keyboardPanHeading)
			.setHeading();

		const keyboardPanViewContainer = containerEl.createDiv();
		keyboardPanViewContainer.appendChild(this.renderPanView(this.plugin.settings.keyboardPan.keys, null));

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
						[Direction.North]: DEFAULT_KEYBOARD_PAN_SETTINGS.keys[Direction.North],
						[Direction.West]: DEFAULT_KEYBOARD_PAN_SETTINGS.keys[Direction.West],
						[Direction.South]: DEFAULT_KEYBOARD_PAN_SETTINGS.keys[Direction.South],
						[Direction.East]: DEFAULT_KEYBOARD_PAN_SETTINGS.keys[Direction.East],
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
					keyboardPanViewContainer.appendChild(this.renderPanView(this.keys, this.activeDirection));

					const listener = (evt: KeyboardEvent): void => {
						if (evt.repeat || ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(evt.key)) {
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
						keyboardPanViewContainer.appendChild(this.renderPanView(this.keys, this.activeDirection));

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
					this.plugin.settings.keyboardPan.maxSpeed = DEFAULT_KEYBOARD_PAN_SETTINGS.maxSpeed;
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
		new Setting(containerEl)
			.setName(t.keyboardZoomHeading)
			.setHeading();

		const keyboardZoomViewContainer = containerEl.createDiv();
		keyboardZoomViewContainer.appendChild(this.renderZoomView(this.plugin.settings.keyboardPan.keys, null));

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
						[Direction.ZoomIn]: DEFAULT_KEYBOARD_PAN_SETTINGS.keys[Direction.ZoomIn],
						[Direction.ZoomOut]: DEFAULT_KEYBOARD_PAN_SETTINGS.keys[Direction.ZoomOut],
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
					keyboardZoomViewContainer.appendChild(this.renderZoomView(this.keys, this.activeDirection));

					const listener = (evt: KeyboardEvent): void => {
						if (evt.repeat || ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(evt.key)) {
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
						keyboardZoomViewContainer.appendChild(this.renderZoomView(this.keys, this.activeDirection));

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
					this.plugin.settings.keyboardPan.zoomSpeed = DEFAULT_KEYBOARD_PAN_SETTINGS.zoomSpeed;
					await this.plugin.saveSettings();
					this.display();
				});
			})
			.addSlider((slider) => {
				slider
					.setLimits(1, 50, 1)
					.setValue(Math.round((this.plugin.settings.keyboardPan.zoomSpeed ?? DEFAULT_KEYBOARD_PAN_SETTINGS.zoomSpeed) * 1000))
					.onChange((value) => {
						this.plugin.settings.keyboardPan.zoomSpeed = value / 1000;
						void this.plugin.saveSettings();
					});
			});
	}

	public async saveKeys(keys: Partial<CanvasKeyboardPanSettings['keys']>): Promise<void> {
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
			{ dir: Direction.North, icon: 'arrow-up', keyArea: 'pan-key-north', labelArea: 'pan-label-north' },
			{ dir: Direction.West, icon: 'arrow-left', keyArea: 'pan-key-west', labelArea: 'pan-label-west' },
			{ dir: Direction.South, icon: 'arrow-down', keyArea: 'pan-key-south', labelArea: 'pan-label-south' },
			{ dir: Direction.East, icon: 'arrow-right', keyArea: 'pan-key-east', labelArea: 'pan-label-east' },
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

	public getKeyLabel(keys: Partial<CanvasKeyboardPanSettings['keys']>, direction: Direction): string {
		const key = keys[direction] ?? '?';
		return KeyLabelOverrides[key] ?? key;
	}
}
