import { App, Modal, Setting } from 'obsidian';

import { getText } from '../i18n';

export class TagRenameModal extends Modal {
	private currentTag: string;
	private onRename: (newTag: string) => void;
	private newTagValue: string;

	constructor(app: App, currentTag: string, onRename: (newTag: string) => void) {
		super(app);
		this.currentTag = currentTag;
		this.newTagValue = currentTag;
		this.onRename = onRename;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		contentEl.empty();
		const t = getText();

		const titleText = t.renameTagModalTitle
			? t.renameTagModalTitle(this.currentTag)
			: `Rename #${this.currentTag}`;
		titleEl.setText(titleText);

		new Setting(contentEl)
			.setName(t.renameTagLabel ?? 'New tag name')
			.addText((text) => {
				text
					.setPlaceholder(t.renameTagPlaceholder ?? 'Enter tag name...')
					.setValue(this.currentTag)
					.onChange((value) => {
						this.newTagValue = value;
					});
				text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						this.submit();
					}
				});
				// Select all text when focused
				window.setTimeout(() => {
					text.inputEl.focus();
					text.inputEl.select();
				}, 50);
			});

		const btnRow = contentEl.createDiv({ cls: 'kambas-tag-btn-row' });
		btnRow.setCssProps({ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' });

		const cancelBtn = btnRow.createEl('button', {
			text: t.cancelBtn ?? 'Cancel',
		});
		cancelBtn.addEventListener('click', () => this.close());

		const saveBtn = btnRow.createEl('button', {
			cls: 'mod-cta',
			text: t.saveBtn ?? 'Save',
		});
		saveBtn.addEventListener('click', () => this.submit());
	}

	private submit(): void {
		const normalized = this.newTagValue
			.replace(/^#+/, '')
			.trim()
			.toLowerCase()
			.replace(/\s+/g, '-')
			.replace(/[.,;!?]+$/, '')
			.trim();

		if (normalized && normalized !== this.currentTag) {
			this.onRename(normalized);
		}
		this.close();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
