import { App, Modal, Setting } from 'obsidian';
import { getText } from '../i18n';

export type StorageChoice = 'vault' | 'embed' | 'cancel';

export interface IngestionChoiceResult {
	choice: StorageChoice;
	applyToAll: boolean;
}

export class ImageIngestionModal extends Modal {
	private filename: string;
	private remainingCount: number;
	private onChoose: (result: IngestionChoiceResult) => void;
	private resolved = false;

	constructor(
		app: App,
		filename: string,
		remainingCount: number,
		onChoose: (result: IngestionChoiceResult) => void
	) {
		super(app);
		this.filename = filename;
		this.remainingCount = remainingCount;
		this.onChoose = onChoose;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		const t = getText();

		this.titleEl.setText(t.modalTitle);

		const description = t.modalDescription(this.filename);
		contentEl.createEl('p', { text: description });

		let applyAll = false;

		if (this.remainingCount > 1) {
			new Setting(contentEl)
				.setName(t.applyRemaining(this.remainingCount - 1))
				.addToggle((toggle) =>
					toggle.setValue(false).onChange((v) => {
						applyAll = v;
					})
				);
		}

		const btnContainer = contentEl.createDiv({ cls: 'modal-button-container' });

		const vaultBtn = btnContainer.createEl('button', {
			text: t.saveToVault,
			cls: 'mod-cta',
		});
		vaultBtn.addEventListener('click', () => {
			this.resolved = true;
			this.close();
			this.onChoose({ choice: 'vault', applyToAll: applyAll });
		});

		const embedBtn = btnContainer.createEl('button', {
			text: t.embedInCanvas,
		});
		embedBtn.addEventListener('click', () => {
			this.resolved = true;
			this.close();
			this.onChoose({ choice: 'embed', applyToAll: applyAll });
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
		if (!this.resolved) {
			// User dismissed modal (e.g. clicked X or pressed Escape) -> cancel ingestion
			this.onChoose({ choice: 'cancel', applyToAll: false });
		}
	}
}
