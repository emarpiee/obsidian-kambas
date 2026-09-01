import { App, PluginSettingTab, Setting } from 'obsidian';
import { getText } from './i18n';
import type KambasPlugin from './main';

export interface KambasSettings {
	hideImageLabel: boolean;
}

export const DEFAULT_SETTINGS: KambasSettings = {
	hideImageLabel: true,
};

export class KambasSettingTab extends PluginSettingTab {
	private plugin: KambasPlugin;

	constructor(app: App, plugin: KambasPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		const t = getText();

		// First Group Header using Obsidian native setting heading
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
	}
}
