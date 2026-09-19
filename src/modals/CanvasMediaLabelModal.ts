import { App, Modal, Setting, TextComponent } from 'obsidian';

import { getText } from '../i18n';

export class CanvasMediaLabelModal extends Modal {
	private currentLabel: string;
	private onSubmitLabel: (newLabel: string) => void;
	private labelValue: string;
	private selectedCount: number;
	private textComponent: TextComponent | null = null;

	constructor(
		app: App,
		currentLabel: string,
		onSubmitLabel: (newLabel: string) => void,
		selectedCount = 1
	) {
		super(app);
		this.currentLabel = currentLabel || '';
		this.labelValue = this.currentLabel;
		this.onSubmitLabel = onSubmitLabel;
		this.selectedCount = selectedCount;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		contentEl.empty();
		const t = getText();

		const baseTitle = t.setMediaLabelModalTitle ?? 'Set media label';
		const title =
			this.selectedCount > 1
				? `${baseTitle} (${this.selectedCount})`
				: baseTitle;
		titleEl.setText(title);

		new Setting(contentEl)
			.setName(t.mediaLabelFieldLabel ?? 'Media label / filename')
			.setDesc(
				t.mediaLabelFieldDesc ??
					'Display label stored in native canvas node header.'
			)
			.addText((text) => {
				this.textComponent = text;
				text
					.setPlaceholder(
						t.mediaLabelPlaceholder ?? 'e.g. architecture-diagram.png'
					)
					.setValue(this.currentLabel)
					.onChange((value) => {
						this.labelValue = value;
					});
				text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						this.submit();
					}
				});
				window.setTimeout(() => {
					text.inputEl.focus();
				}, 50);
			});

		const btnContainer = contentEl.createDiv({
			cls: 'modal-button-container',
		});

		const cancelBtn = btnContainer.createEl('button', {
			text: t.cancelBtn ?? 'Cancel',
		});
		cancelBtn.addEventListener('click', () => this.close());

		const saveBtn = btnContainer.createEl('button', {
			cls: 'mod-cta',
			text: t.saveBtn ?? 'Save',
		});
		saveBtn.addEventListener('click', () => this.submit());
	}

	private submit(): void {
		const val = this.textComponent !== null
			? this.textComponent.getValue()
			: this.labelValue;
		this.onSubmitLabel(val.trim());
		this.close();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
