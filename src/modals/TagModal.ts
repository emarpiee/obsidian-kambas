import { App, Modal, setIcon } from 'obsidian';

import { getText } from '../i18n';

export class TagModal extends Modal {
	private initialTags: string[];
	private tags: string[] = [];
	private suggestions: string[] = [];
	private presetTags: string[] = [];
	private selectedCount: number;
	private tagCounts: Map<string, number>;
	// Tracks whether each tag applies to all nodes ('full') or only some nodes ('mixed')
	private tagStates: Map<string, 'full' | 'mixed'> = new Map();
	private onSubmit: (
		tags: string[],
		tagStates: Map<string, 'full' | 'mixed'>
	) => void;

	// DOM refs
	private chipRow!: HTMLElement;
	private input!: HTMLInputElement;
	private dropdownEl!: HTMLElement;
	private presetRow!: HTMLElement;

	constructor(
		app: App,
		initialTags: string[],
		suggestions: string[],
		onSubmit: (
			tags: string[],
			tagStates: Map<string, 'full' | 'mixed'>
		) => void,
		options?: {
			selectedCount?: number;
			presetTags?: string[];
			tagCounts?: Map<string, number>;
		}
	) {
		super(app);
		this.initialTags = [...initialTags];
		this.tags = [...initialTags];
		this.suggestions = suggestions.filter((s) => s.trim().length > 0);
		this.presetTags =
			options?.presetTags?.filter((s) => s.trim().length > 0) ??
			this.suggestions.slice(0, 10);
		this.selectedCount = options?.selectedCount ?? 1;
		this.tagCounts = options?.tagCounts ?? new Map<string, number>();
		this.onSubmit = onSubmit;

		// Initialize tag states based on counts across selected nodes
		for (const tag of this.tags) {
			const count = this.tagCounts.get(tag) ?? this.selectedCount;
			if (this.selectedCount > 1 && count > 0 && count < this.selectedCount) {
				this.tagStates.set(tag, 'mixed');
			} else {
				this.tagStates.set(tag, 'full');
			}
		}
	}

	onOpen(): void {
		const t = getText();
		this.modalEl.addClass('kambas-tag-modal');

		const titleText =
			this.selectedCount > 1
				? `${t.tagModalTitle ?? 'Tags'} (${this.selectedCount} items selected)`
				: (t.tagModalTitle ?? 'Tags');
		this.titleEl.setText(titleText);

		const { contentEl } = this;
		contentEl.empty();

		// ── Chip input wrapper ────────────────────────────────────────────────
		const chipWrap = contentEl.createDiv({ cls: 'kambas-tag-chip-wrap' });

		// Applied tag chips on top
		this.chipRow = chipWrap.createDiv({ cls: 'kambas-tag-chip-row' });

		// Input field below chips
		const inputRow = chipWrap.createDiv({ cls: 'kambas-tag-input-row' });
		this.input = inputRow.createEl('input', {
			cls: 'kambas-tag-input',
			attr: { type: 'text', placeholder: t.tagPlaceholder },
		});

		// Suggestion dropdown
		this.dropdownEl = contentEl.createDiv({
			cls: 'kambas-tag-dropdown is-hidden',
		});

		// Preset / Recent tags bar
		this.presetRow = contentEl.createDiv({ cls: 'kambas-tag-preset-row' });
		this.renderPresets();

		// Render existing chips
		this.renderChips();

		// ── Input event handlers ──────────────────────────────────────────────
		this.input.addEventListener('keydown', (e: KeyboardEvent) => {
			if ((e.key === 'Enter' || e.key === ',') && this.input.value.trim()) {
				e.preventDefault();
				this.commitInputValue();
			} else if (
				e.key === 'Backspace' &&
				!this.input.value &&
				this.tags.length > 0
			) {
				this.removeTag(this.tags[this.tags.length - 1]);
			} else if (e.key === 'Escape') {
				if (!this.dropdownEl.hasClass('is-hidden')) {
					e.stopPropagation();
					this.hideDropdown();
				}
			} else if (e.key === 'ArrowDown') {
				e.preventDefault();
				const first = this.dropdownEl.querySelector<HTMLElement>(
					'.kambas-tag-suggest-item'
				);
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

		const doneBtn = btnRow.createEl('button', {
			cls: 'mod-cta kambas-tag-done-btn',
			text: 'Done',
		});
		doneBtn.addEventListener('click', () => {
			if (this.input.value.trim()) this.commitInputValue();
			this.close();
		});

		// Focus input on open
		window.setTimeout(() => this.input.focus(), 50);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	// ── Helpers ──────────────────────────────────────────────────────────────

	private normalizeTag(raw: string): string {
		return raw
			.replace(/^#+/, '')
			.trim()
			.toLowerCase()
			.replace(/\s+/g, '-')
			.replace(/[.,;!?]+$/, '')
			.trim();
	}

	private addOrUpgradeTag(rawTag: string): boolean {
		const tag = this.normalizeTag(rawTag);
		if (!tag) return false;

		const existingState = this.tagStates.get(tag);
		if (!this.tags.includes(tag)) {
			this.tags.push(tag);
			this.tagStates.set(tag, 'full');
			return true;
		} else if (existingState === 'mixed') {
			// Upgrade partial tag to apply to ALL selected items
			this.tagStates.set(tag, 'full');
			return true;
		}
		return false;
	}

	private commitInputValue(): void {
		const parts = this.input.value.split(',');
		let changed = false;
		for (const part of parts) {
			if (this.addOrUpgradeTag(part)) changed = true;
		}
		this.input.value = '';
		this.hideDropdown();
		this.renderChips();
		this.renderPresets();
		if (changed) this.onSubmit(this.tags, this.tagStates);
	}

	private addTagFromSuggestion(tag: string): void {
		this.addOrUpgradeTag(tag);
		this.onSubmit(this.tags, this.tagStates);
		this.input.value = '';
		this.hideDropdown();
		this.renderChips();
		this.renderPresets();
		this.input.focus();
	}

	private removeTag(tag: string): void {
		this.tags = this.tags.filter((t) => t !== tag);
		this.tagStates.delete(tag);
		this.renderChips();
		this.renderPresets();
		this.onSubmit(this.tags, this.tagStates);
	}

	private renderChips(): void {
		this.chipRow.empty();
		for (const tag of this.tags) {
			const state = this.tagStates.get(tag) ?? 'full';
			const isMixed = state === 'mixed';
			const count = this.tagCounts.get(tag);

			const chip = this.chipRow.createSpan({
				cls: `kambas-tag-chip ${isMixed ? 'is-mixed' : ''}`,
			});
			if (isMixed) {
				chip.title = `Partial tag (${count}/${this.selectedCount} items). Click chip to apply to all selected items.`;
			}

			const labelSpan = chip.createSpan({ cls: 'kambas-tag-chip-label' });
			this.formatTagLabel(labelSpan, tag, isMixed ? count : undefined);

			// Clicking on chip body upgrades mixed tag -> full tag
			if (isMixed) {
				labelSpan.addEventListener('mousedown', (e) => {
					e.preventDefault();
					this.tagStates.set(tag, 'full');
					this.renderChips();
					this.renderPresets();
					this.onSubmit(this.tags, this.tagStates);
				});
			}

			const removeBtn = chip.createSpan({ cls: 'kambas-tag-chip-remove' });
			setIcon(removeBtn, 'x');
			removeBtn.addEventListener('mousedown', (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.removeTag(tag);
			});
		}
	}

	private renderPresets(): void {
		this.presetRow.empty();
		if (!this.presetTags || this.presetTags.length === 0) return;

		// Only show presets that are not already active in the chip list
		const availablePresets = this.presetTags.filter(
			(pTag) => !this.tags.includes(this.normalizeTag(pTag))
		);

		if (availablePresets.length === 0) return;

		this.presetRow.createDiv({
			cls: 'kambas-tag-preset-header',
			text: 'Quick Tags:',
		});
		const container = this.presetRow.createDiv({
			cls: 'kambas-tag-preset-container',
		});

		for (const pTag of availablePresets.slice(0, 10)) {
			const normalized = this.normalizeTag(pTag);
			if (!normalized) continue;

			const pill = container.createSpan({ cls: 'kambas-tag-preset-pill' });
			this.formatTagLabel(pill, normalized);

			pill.addEventListener('mousedown', (e) => {
				e.preventDefault();
				this.addTagFromSuggestion(normalized);
			});
		}
	}

	private formatTagLabel(
		container: HTMLElement,
		tag: string,
		count?: number
	): void {
		const parts = tag.split('/');
		if (parts.length > 1) {
			const ns = parts.slice(0, -1).join('/') + '/';
			const name = parts[parts.length - 1];
			container.createSpan({ cls: 'kambas-tag-ns', text: `#${ns}` });
			container.createSpan({ cls: 'kambas-tag-name', text: name });
		} else {
			container.createSpan({ cls: 'kambas-tag-name', text: `#${tag}` });
		}
		if (count !== undefined && this.selectedCount > 1) {
			container.createSpan({
				cls: 'kambas-tag-count-badge',
				text: ` (${count}/${this.selectedCount})`,
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

		// Filter suggestions: allow if not in tags OR if tag is currently mixed (to upgrade it)
		const filtered = this.suggestions.filter(
			(s) =>
				s.includes(normalized) &&
				(!this.tags.includes(s) || this.tagStates.get(s) === 'mixed')
		);

		if (filtered.length === 0) {
			this.hideDropdown();
			return;
		}

		this.dropdownEl.empty();
		this.dropdownEl.classList.remove('is-hidden');

		for (const s of filtered.slice(0, 10)) {
			const isMixed = this.tagStates.get(s) === 'mixed';
			const item = this.dropdownEl.createDiv({
				cls: 'kambas-tag-suggest-item',
				attr: { tabindex: '0' },
			});

			const label = item.createSpan({ cls: 'kambas-tag-suggest-label' });
			this.formatTagLabel(label, s);
			if (isMixed) {
				item.createSpan({
					cls: 'kambas-tag-suggest-badge',
					text: 'Apply to all',
				});
			}

			const onSelect = (): void => this.addTagFromSuggestion(s);
			item.addEventListener('mousedown', (e) => {
				e.preventDefault();
				onSelect();
			});
			item.addEventListener('keydown', (e: KeyboardEvent) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					onSelect();
				}
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
