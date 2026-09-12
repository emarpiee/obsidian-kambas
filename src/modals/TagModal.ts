import { App, Modal, setIcon } from 'obsidian';
import { getText } from '../i18n';

export class TagModal extends Modal {
	private initialTags: string[];
	private tags: string[] = [];
	private suggestions: string[] = [];
	private onSubmit: (tags: string[]) => void;

	// DOM refs
	private chipRow!: HTMLElement;
	private input!: HTMLInputElement;
	private dropdownEl!: HTMLElement;

	constructor(
		app: App,
		initialTags: string[],
		suggestions: string[],
		onSubmit: (tags: string[]) => void
	) {
		super(app);
		this.initialTags = [...initialTags];
		this.tags = [...initialTags];
		this.suggestions = suggestions.filter((s) => s.trim().length > 0);
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const t = getText();
		this.modalEl.addClass('kambas-tag-modal');
		this.titleEl.setText(t.tagModalTitle);

		const { contentEl } = this;
		contentEl.empty();

		// ── Chip input row ────────────────────────────────────────────────────
		const chipWrap = contentEl.createDiv({ cls: 'kambas-tag-chip-wrap' });
		// Input field on top
		const inputRow = chipWrap.createDiv({ cls: 'kambas-tag-input-row' });
		this.input = inputRow.createEl('input', {
			cls: 'kambas-tag-input',
			attr: { type: 'text', placeholder: t.tagPlaceholder },
		});
		// Tag chips below input
		this.chipRow = chipWrap.createDiv({ cls: 'kambas-tag-chip-row' });

		// Suggestion dropdown
		this.dropdownEl = contentEl.createDiv({ cls: 'kambas-tag-dropdown is-hidden' });

		// Render existing chips
		this.renderChips();

		// ── Input event handlers ──────────────────────────────────────────────
		this.input.addEventListener('keydown', (e: KeyboardEvent) => {
			if ((e.key === 'Enter' || e.key === ',') && this.input.value.trim()) {
				e.preventDefault();
				this.commitInputValue();
			} else if (e.key === 'Backspace' && !this.input.value && this.tags.length > 0) {
				this.removeTag(this.tags[this.tags.length - 1]);
			} else if (e.key === 'Escape') {
				if (!this.dropdownEl.hasClass('is-hidden')) {
					e.stopPropagation();
					this.hideDropdown();
				}
			} else if (e.key === 'ArrowDown') {
				e.preventDefault();
				const first = this.dropdownEl.querySelector<HTMLElement>('.kambas-tag-suggest-item');
				first?.focus();
			}
		});

		this.input.addEventListener('input', () => {
			this.updateDropdown(this.input.value);
		});

		this.input.addEventListener('blur', (_e: FocusEvent) => {
			// Delay hide so click on dropdown item fires first
			window.setTimeout(() => {
				if (!this.dropdownEl.contains(document.activeElement)) {
					this.hideDropdown();
				}
			}, 150);
		});

		// ── Buttons ───────────────────────────────────────────────────────────
		const btnRow = contentEl.createDiv({ cls: 'kambas-tag-btn-row' });

		const cancelBtn = btnRow.createEl('button', {
			cls: 'kambas-tag-cancel-btn',
			text: t.cancelBtn,
		});
		cancelBtn.addEventListener('click', () => this.close());

		const applyBtn = btnRow.createEl('button', {
			cls: 'mod-cta kambas-tag-apply-btn',
			text: t.applyBtn,
		});
		applyBtn.addEventListener('click', () => {
			// Commit any pending input before applying
			if (this.input.value.trim()) this.commitInputValue();
			this.onSubmit(this.tags);
			this.close();
		});

		// Focus input on open
		window.setTimeout(() => this.input.focus(), 50);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	// ── Chip helpers ─────────────────────────────────────────────────────────

	private normalizeTag(raw: string): string {
		// Strip leading # and trim; lowercase
		return raw.replace(/^#+/, '').trim().toLowerCase().replace(/\s+/g, '-');
	}

	private commitInputValue(): void {
		const parts = this.input.value.split(',');
		for (const part of parts) {
			const tag = this.normalizeTag(part);
			if (tag && !this.tags.includes(tag)) {
				this.tags.push(tag);
			}
		}
		this.input.value = '';
		this.hideDropdown();
		this.renderChips();
	}

	private addTagFromSuggestion(tag: string): void {
		const normalized = this.normalizeTag(tag);
		if (normalized && !this.tags.includes(normalized)) {
			this.tags.push(normalized);
		}
		this.input.value = '';
		this.hideDropdown();
		this.renderChips();
		this.input.focus();
	}

	private removeTag(tag: string): void {
		this.tags = this.tags.filter((t) => t !== tag);
		this.renderChips();
	}

	private renderChips(): void {
		this.chipRow.empty();
		for (const tag of this.tags) {
			const chip = this.chipRow.createSpan({ cls: 'kambas-tag-chip' });
			chip.createSpan({ cls: 'kambas-tag-chip-label', text: `#${tag}` });
			const removeBtn = chip.createSpan({ cls: 'kambas-tag-chip-remove' });
			setIcon(removeBtn, 'x');
			removeBtn.addEventListener('mousedown', (e) => {
				e.preventDefault();
				this.removeTag(tag);
			});
		}
	}

	// ── Dropdown ─────────────────────────────────────────────────────────────

	private updateDropdown(query: string): void {
		const normalized = this.normalizeTag(query);
		if (!normalized) {
			this.hideDropdown();
			return;
		}

		const filtered = this.suggestions.filter(
			(s) => s.includes(normalized) && !this.tags.includes(s)
		);

		if (filtered.length === 0) {
			this.hideDropdown();
			return;
		}

		this.dropdownEl.empty();
		this.dropdownEl.classList.remove('is-hidden');

		for (const s of filtered.slice(0, 8)) {
			const item = this.dropdownEl.createDiv({ cls: 'kambas-tag-suggest-item', attr: { tabindex: '0' } });
			item.createSpan({ text: `#${s}` });

			const onSelect = (): void => this.addTagFromSuggestion(s);
			item.addEventListener('mousedown', (e) => {
				e.preventDefault();
				onSelect();
			});
			item.addEventListener('keydown', (e: KeyboardEvent) => {
				if (e.key === 'Enter') { e.preventDefault(); onSelect(); }
				if (e.key === 'ArrowDown') {
					e.preventDefault();
					(item.nextElementSibling as HTMLElement | null)?.focus();
				}
				if (e.key === 'ArrowUp') {
					e.preventDefault();
					const prev = item.previousElementSibling as HTMLElement | null;
					prev ? prev.focus() : this.input.focus();
				}
			});
		}
	}

	private hideDropdown(): void {
		this.dropdownEl.addClass('is-hidden');
		this.dropdownEl.empty();
	}
}
