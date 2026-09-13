import { App, Modal, Setting } from 'obsidian';

export type NamingStrategyOption = 'default' | 'tag' | 'custom' | 'cancel';

export interface MediaFilenameResult {
	option: NamingStrategyOption;
	customName?: string;
	applyToAll: boolean;
}

export class MediaFilenameModal extends Modal {
	private defaultName: string;
	private tags: string[];
	private remainingCount: number;
	private isCopy: boolean;
	private onChoose: (result: MediaFilenameResult) => void;
	private resolved = false;

	private selectedOption: NamingStrategyOption = 'default';
	private customNameInput = '';

	constructor(
		app: App,
		defaultName: string,
		tags: string[],
		remainingCount: number,
		isCopy: boolean,
		onChoose: (result: MediaFilenameResult) => void
	) {
		super(app);
		this.defaultName = defaultName;
		this.tags = tags;
		this.remainingCount = remainingCount;
		this.isCopy = isCopy;
		this.onChoose = onChoose;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		contentEl.empty();

		const actionTitle = this.isCopy ? 'Copy Embedded Media to Vault' : 'Move Embedded Media to Vault';
		titleEl.setText(actionTitle);

		const descP = contentEl.createEl('p', { cls: 'kambas-modal-desc' });
		descP.setText('Choose how the exported media file should be named in your vault:');

		let applyAll = false;

		// Tag preview string
		const cleanedTags = this.tags.map((t) => t.replace(/^#+/, '').trim().replace(/[/\\?%*:|"<>]/g, '-')).filter(Boolean);
		const tagPreviewName = cleanedTags.length > 0
			? `${cleanedTags.join('-')}-01`
			: '(No tags on current media - will fallback to default)';

		// 1. Radio / Button group for naming strategy
		const optionsContainer = contentEl.createDiv({ cls: 'kambas-naming-options' });

		// Option 1: Default Name
		const optDefault = optionsContainer.createDiv({ cls: 'kambas-naming-option is-selected' });
		const defaultRadio = optDefault.createEl('input', { type: 'radio', attr: { name: 'naming_opt', id: 'opt_default' } });
		defaultRadio.checked = true;
		const defaultLabel = optDefault.createEl('label', { attr: { for: 'opt_default' } });
		defaultLabel.createDiv({ cls: 'kambas-opt-title', text: 'Default Filename' });
		defaultLabel.createDiv({ cls: 'kambas-opt-subtitle', text: `e.g. ${this.defaultName}` });

		// Option 2: Tag Filename
		const optTag = optionsContainer.createDiv({ cls: 'kambas-naming-option' });
		const tagRadio = optTag.createEl('input', { type: 'radio', attr: { name: 'naming_opt', id: 'opt_tag' } });
		const tagLabel = optTag.createEl('label', { attr: { for: 'opt_tag' } });
		tagLabel.createDiv({ cls: 'kambas-opt-title', text: 'Tag Filename' });
		tagLabel.createDiv({ cls: 'kambas-opt-subtitle', text: tagPreviewName });

		// Option 3: Custom Filename
		const optCustom = optionsContainer.createDiv({ cls: 'kambas-naming-option' });
		const customRadio = optCustom.createEl('input', { type: 'radio', attr: { name: 'naming_opt', id: 'opt_custom' } });
		const customLabel = optCustom.createEl('label', { attr: { for: 'opt_custom' } });
		customLabel.createDiv({ cls: 'kambas-opt-title', text: 'Custom Filename' });
		
		const customInputContainer = optCustom.createDiv({ cls: 'kambas-custom-input-wrap' });
		const customInput = customInputContainer.createEl('input', {
			type: 'text',
			placeholder: 'e.g. my-image',
			cls: 'kambas-custom-filename-input'
		});
		customInput.disabled = true;

		// Radio selection change listener
		const updateSelection = (selected: NamingStrategyOption): void => {
			this.selectedOption = selected;
			defaultRadio.checked = selected === 'default';
			tagRadio.checked = selected === 'tag';
			customRadio.checked = selected === 'custom';

			optDefault.toggleClass('is-selected', selected === 'default');
			optTag.toggleClass('is-selected', selected === 'tag');
			optCustom.toggleClass('is-selected', selected === 'custom');

			customInput.disabled = selected !== 'custom';
			if (selected === 'custom') customInput.focus();
		};

		optDefault.addEventListener('click', () => updateSelection('default'));
		optTag.addEventListener('click', () => updateSelection('tag'));
		optCustom.addEventListener('click', () => updateSelection('custom'));

		customInput.addEventListener('input', (e) => {
			this.customNameInput = (e.target as HTMLInputElement).value;
		});

		// 2. Batch toggle option
		if (this.remainingCount > 1) {
			new Setting(contentEl)
				.setName(`Apply to all ${this.remainingCount} remaining items`)
				.setDesc('Uses the selected naming strategy for all selected media items.')
				.addToggle((toggle) =>
					toggle.setValue(false).onChange((v) => {
						applyAll = v;
					})
				);
		}

		// 3. Action Buttons
		const btnContainer = contentEl.createDiv({ cls: 'modal-button-container' });

		const cancelBtn = btnContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => {
			this.close();
		});

		const confirmBtn = btnContainer.createEl('button', {
			text: 'Confirm',
			cls: 'mod-cta'
		});
		confirmBtn.addEventListener('click', () => {
			this.resolved = true;
			this.close();
			this.onChoose({
				option: this.selectedOption,
				customName: this.customNameInput.trim(),
				applyToAll: applyAll
			});
		});
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.resolved) {
			this.onChoose({ option: 'cancel', applyToAll: false });
		}
	}
}
