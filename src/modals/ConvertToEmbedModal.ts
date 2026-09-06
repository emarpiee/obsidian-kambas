import { App, Modal, Setting } from 'obsidian';
import { getText } from '../i18n';

export type VaultFileAction = 'delete' | 'keep' | 'cancel';

export interface ConvertEmbedChoiceResult {
	action: VaultFileAction;
	applyToAll: boolean;
}

export class ConvertToEmbedModal extends Modal {
	private filename: string;
	private remainingCount: number;
	private onChoose: (result: ConvertEmbedChoiceResult) => void;
	private resolved = false;

	constructor(
		app: App,
		filename: string,
		remainingCount: number,
		onChoose: (result: ConvertEmbedChoiceResult) => void
	) {
		super(app);
		this.filename = filename;
		this.remainingCount = remainingCount;
		this.onChoose = onChoose;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		contentEl.empty();
		const t = getText();

		titleEl.setText(t.convertModalTitle);

		const descP = contentEl.createEl('p');
		descP.setText(t.convertModalDesc(this.filename));

		let applyAll = false;

		if (this.remainingCount > 1) {
			new Setting(contentEl)
				.setName(t.applyRemainingConvert(this.remainingCount - 1))
				.addToggle((toggle) =>
					toggle.setValue(false).onChange((v) => {
						applyAll = v;
					})
				);
		}

		const btnContainer = contentEl.createDiv({ cls: 'modal-button-container' });

		const deleteBtn = btnContainer.createEl('button', {
			text: t.deleteOriginalFile,
			cls: 'mod-warning',
		});
		deleteBtn.addEventListener('click', () => {
			this.resolved = true;
			this.close();
			this.onChoose({ action: 'delete', applyToAll: applyAll });
		});

		const keepBtn = btnContainer.createEl('button', {
			text: t.keepOriginalFile,
			cls: 'mod-cta',
		});
		keepBtn.addEventListener('click', () => {
			this.resolved = true;
			this.close();
			this.onChoose({ action: 'keep', applyToAll: applyAll });
		});
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.resolved) {
			this.onChoose({ action: 'cancel', applyToAll: false });
		}
	}
}
