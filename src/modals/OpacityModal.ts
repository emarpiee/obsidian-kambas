import { App, Modal, Setting } from 'obsidian';
import { getText } from '../i18n';

export class OpacityModal extends Modal {
	private currentOpacity: number;
	private onApply: (opacity: number) => void;

	constructor(app: App, currentOpacity: number, onApply: (opacity: number) => void) {
		super(app);
		this.currentOpacity = currentOpacity;
		this.onApply = onApply;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		contentEl.empty();
		const t = getText();

		titleEl.setText(t.opacityModalTitle);

		let selectedOpacity = this.currentOpacity;

		new Setting(contentEl)
			.addSlider((slider) => {
				slider
					.setLimits(0, 100, 1)
					.setValue(Math.round(this.currentOpacity * 100))
					.setDynamicTooltip()
					.onChange((value) => {
						selectedOpacity = value / 100;
					});
			});

		// Buttons
		const btnRow = contentEl.createDiv({ cls: 'kambas-opacity-buttons' });

		const cancelBtn = btnRow.createEl('button', { text: t.cancelBtn });
		cancelBtn.addEventListener('click', () => this.close());

		const applyBtn = btnRow.createEl('button', {
			text: t.applyBtn,
			cls: 'mod-cta',
		});
		applyBtn.addEventListener('click', () => {
			this.onApply(selectedOpacity);
			this.close();
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
