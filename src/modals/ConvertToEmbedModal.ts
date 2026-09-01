import { App, Modal, Setting } from 'obsidian';

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

		titleEl.setText('Embed image in canvas');

		const descP = contentEl.createEl('p');
		descP.setText(`Converting "${this.filename}" to an embedded canvas image. What would you like to do with the original image file in your vault?`);

		let applyAll = false;

		if (this.remainingCount > 1) {
			new Setting(contentEl)
				.setName(`Apply choice to remaining ${this.remainingCount - 1} images`)
				.addToggle((toggle) =>
					toggle.setValue(false).onChange((v) => {
						applyAll = v;
					})
				);
		}

		const btnContainer = contentEl.createDiv({ cls: 'modal-button-container' });

		const deleteBtn = btnContainer.createEl('button', {
			text: 'Delete original file',
			cls: 'mod-warning',
		});
		deleteBtn.addEventListener('click', () => {
			this.resolved = true;
			this.close();
			this.onChoose({ action: 'delete', applyToAll: applyAll });
		});

		const keepBtn = btnContainer.createEl('button', {
			text: 'Keep original file',
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
