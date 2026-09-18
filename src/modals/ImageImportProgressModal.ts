import { App, Modal } from 'obsidian';

import { getText } from '../i18n';

export class ImageImportProgressModal extends Modal {
	private total: number;
	private current = 0;
	private currentFilename = '';
	private progressBarEl!: HTMLProgressElement;
	private statusEl!: HTMLElement;
	private countEl!: HTMLElement;
	public isCancelled = false;

	constructor(app: App, total: number) {
		super(app);
		this.total = total;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		contentEl.empty();
		const t = getText();

		titleEl.setText(t.importProgressTitle);

		const container = contentEl.createDiv({
			cls: 'kambas-import-progress-container',
		});

		this.countEl = container.createDiv({ cls: 'kambas-import-progress-count' });
		this.countEl.setText(`0 / ${this.total}`);

		this.progressBarEl = container.createEl('progress', {
			cls: 'kambas-import-progress-bar',
		});
		this.progressBarEl.max = this.total;
		this.progressBarEl.value = 0;

		this.statusEl = container.createDiv({
			cls: 'kambas-import-progress-status',
		});

		const btnContainer = contentEl.createDiv({
			cls: 'modal-button-container kambas-import-modal-buttons',
		});

		const cancelBtn = btnContainer.createEl('button', {
			text: t.cancelBtn || 'Cancel',
			cls: 'mod-cancel',
		});
		cancelBtn.addEventListener('click', () => {
			this.isCancelled = true;
			this.close();
		});
	}

	public updateProgress(
		current: number,
		filename: string,
		statusMessage?: string
	): void {
		this.current = current;
		this.currentFilename = filename;
		const t = getText();

		if (this.progressBarEl) {
			this.progressBarEl.value = current;
		}
		if (this.countEl) {
			this.countEl.setText(`${current} / ${this.total}`);
		}
		if (this.statusEl) {
			this.statusEl.setText(
				statusMessage ||
					(filename
						? t.importProgressStatus(current, this.total, filename)
						: '')
			);
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
