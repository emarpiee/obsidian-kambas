import { App, Modal, Setting, setIcon } from 'obsidian';

import { getText } from '../i18n';

export interface TagColorConfig {
	text?: string;
	bg?: string;
}

export class TagColorModal extends Modal {
	private tag: string;
	private initialColors: TagColorConfig;
	private textColor: string;
	private bgColor: string;
	private onSave: (colors: TagColorConfig | null) => void;

	// DOM refs for preview update
	private previewPill!: HTMLElement;

	constructor(
		app: App,
		tag: string,
		initialColors: TagColorConfig | undefined,
		onSave: (colors: TagColorConfig | null) => void
	) {
		super(app);
		this.tag = tag;
		this.initialColors = initialColors ?? {};
		this.textColor = this.initialColors.text ?? '';
		this.bgColor = this.initialColors.bg ?? '';
		this.onSave = onSave;
	}

	onOpen(): void {
		const { contentEl, titleEl } = this;
		contentEl.empty();
		this.modalEl.addClass('kambas-tag-color-modal');

		const t = getText();
		const titleText = t.setTagColorModalTitle
			? t.setTagColorModalTitle(this.tag)
			: `Tag Color: #${this.tag}`;
		titleEl.setText(titleText);

		// ── Preview Section ──────────────────────────────────────────────────
		const previewWrap = contentEl.createDiv({
			cls: 'kambas-tag-color-preview-wrap',
		});
		previewWrap.createSpan({
			cls: 'kambas-tag-color-preview-label',
			text: t.tagColorPreview ?? 'Preview:',
		});

		this.previewPill = previewWrap.createSpan({
			cls: 'kambas-tag-pill kambas-tag-color-preview-pill',
			text: `#${this.tag}`,
		});
		this.updatePreview();

		// ── Color Presets Row ────────────────────────────────────────────────
		const presetHeader = contentEl.createDiv({
			cls: 'kambas-tag-preset-header',
			text: t.tagColorPresets ?? 'Presets:',
		});
		presetHeader.setCssProps({
			marginTop: '12px',
			marginBottom: '6px',
			fontSize: '12px',
			fontWeight: '500',
		});

		const presetRow = contentEl.createDiv({
			cls: 'kambas-tag-color-preset-row',
		});
		const colorPresets: Array<{ name: string; bg: string; text: string }> = [
			{ name: 'Red', bg: '#fee2e2', text: '#991b1b' },
			{ name: 'Orange', bg: '#ffedd5', text: '#9a3412' },
			{ name: 'Yellow', bg: '#fef9c3', text: '#854d0e' },
			{ name: 'Green', bg: '#dcfce7', text: '#166534' },
			{ name: 'Teal', bg: '#ccfbf1', text: '#115e59' },
			{ name: 'Blue', bg: '#dbeafe', text: '#1e40af' },
			{ name: 'Purple', bg: '#f3e8ff', text: '#6b21a8' },
			{ name: 'Pink', bg: '#fce7f3', text: '#9d174d' },
			{ name: 'Dark Gray', bg: '#374151', text: '#f9fafb' },
		];

		for (const p of colorPresets) {
			const swatch = presetRow.createDiv({
				cls: 'kambas-tag-color-swatch',
				title: p.name,
			});
			swatch.setCssProps({
				backgroundColor: p.bg,
				color: p.text,
				border: '1px solid rgba(0,0,0,0.12)',
				borderRadius: '10px',
				padding: '2px 8px',
				fontSize: '11px',
				cursor: 'pointer',
				userSelect: 'none',
			});
			swatch.setText(`#${this.tag}`);

			swatch.addEventListener('click', () => {
				this.bgColor = p.bg;
				this.textColor = p.text;
				this.updateInputs();
				this.updatePreview();
			});
		}

		// ── Color Settings Inputs ───────────────────────────────────────────
		let textInputEl: HTMLInputElement;
		let textColorPickerEl: HTMLInputElement;
		let bgInputEl: HTMLInputElement;
		let bgColorPickerEl: HTMLInputElement;

		// Text Color Setting
		const textSetting = new Setting(contentEl)
			.setName(t.textColorLabel ?? 'Text color')
			.addText((text) => {
				textInputEl = text.inputEl;
				text
					.setPlaceholder('#000000')
					.setValue(this.textColor)
					.onChange((val) => {
						this.textColor = val;
						if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
							textColorPickerEl.value = val;
						}
						this.updatePreview();
					});
			});

		// Add color picker control alongside text input
		const textColorPicker = textSetting.controlEl.createEl('input', {
			type: 'color',
			cls: 'kambas-color-picker-input',
			value: /^#[0-9A-Fa-f]{6}$/.test(this.textColor)
				? this.textColor
				: '#1e88e5',
		});
		textColorPickerEl = textColorPicker;
		textColorPicker.addEventListener('input', () => {
			this.textColor = textColorPicker.value;
			textInputEl.value = textColorPicker.value;
			this.updatePreview();
		});

		// Background Color Setting
		const bgSetting = new Setting(contentEl)
			.setName(t.bgColorLabel ?? 'Background color')
			.addText((text) => {
				bgInputEl = text.inputEl;
				text
					.setPlaceholder('#Ffffff')
					.setValue(this.bgColor)
					.onChange((val) => {
						this.bgColor = val;
						if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
							bgColorPickerEl.value = val;
						}
						this.updatePreview();
					});
			});

		const bgColorPicker = bgSetting.controlEl.createEl('input', {
			type: 'color',
			cls: 'kambas-color-picker-input',
			value: /^#[0-9A-Fa-f]{6}$/.test(this.bgColor) ? this.bgColor : '#e3f2fd',
		});
		bgColorPickerEl = bgColorPicker;
		bgColorPicker.addEventListener('input', () => {
			this.bgColor = bgColorPicker.value;
			bgInputEl.value = bgColorPicker.value;
			this.updatePreview();
		});

		this.updateInputs = (): void => {
			if (textInputEl) textInputEl.value = this.textColor;
			if (textColorPickerEl && /^#[0-9A-Fa-f]{6}$/.test(this.textColor)) {
				textColorPickerEl.value = this.textColor;
			}
			if (bgInputEl) bgInputEl.value = this.bgColor;
			if (bgColorPickerEl && /^#[0-9A-Fa-f]{6}$/.test(this.bgColor)) {
				bgColorPickerEl.value = this.bgColor;
			}
		};

		// ── Buttons ───────────────────────────────────────────────────────────
		const btnRow = contentEl.createDiv({ cls: 'kambas-tag-btn-row' });
		btnRow.setCssProps({
			display: 'flex',
			justify: 'space-between',
			alignItems: 'center',
			marginTop: '20px',
		});

		const resetBtn = btnRow.createEl('button', {
			cls: 'mod-warning',
			text: t.clearTagColor ?? 'Clear color',
		});
		setIcon(resetBtn, 'rotate-ccw');
		resetBtn.setAttribute('title', t.clearTagColor ?? 'Clear color');
		resetBtn.addEventListener('click', () => {
			this.textColor = '';
			this.bgColor = '';
			this.updateInputs();
			this.updatePreview();
		});

		const rightBtns = btnRow.createDiv({ cls: 'kambas-tag-color-right-btns' });
		rightBtns.setCssProps({ display: 'flex', gap: '8px' });

		const cancelBtn = rightBtns.createEl('button', {
			text: t.cancelBtn ?? 'Cancel',
		});
		cancelBtn.addEventListener('click', () => this.close());

		const saveBtn = rightBtns.createEl('button', {
			cls: 'mod-cta',
			text: t.saveBtn ?? 'Save',
		});
		saveBtn.addEventListener('click', () => {
			const config: TagColorConfig = {};
			if (this.textColor.trim()) config.text = this.textColor.trim();
			if (this.bgColor.trim()) config.bg = this.bgColor.trim();

			if (!config.text && !config.bg) {
				this.onSave(null);
			} else {
				this.onSave(config);
			}
			this.close();
		});
	}

	private updateInputs: () => void = () => {};

	private updatePreview(): void {
		if (!this.previewPill) return;
		if (this.bgColor.trim()) {
			this.previewPill.style.backgroundColor = this.bgColor.trim();
		} else {
			this.previewPill.style.removeProperty('background-color');
		}

		if (this.textColor.trim()) {
			this.previewPill.style.color = this.textColor.trim();
		} else {
			this.previewPill.style.removeProperty('color');
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
