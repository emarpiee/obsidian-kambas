import { App, Modal, Notice, TFile } from 'obsidian';
import { getText } from '../i18n';
import { MEDIA_EXTENSIONS } from '../canvas/CanvasTypes';
import { ImageIngestionModal, StorageChoice } from './ImageIngestionModal';

export interface SwapResult {
	source: 'vault' | 'file';
	tfile?: TFile;
	file?: File;
	storageChoice: StorageChoice; // 'embed' | 'vault' (cancel means modal was dismissed)
}

export class ImageSwapModal extends Modal {
	private onChoose: (result: SwapResult | null) => void;
	private resolved = false;
	private activeTab: 'vault' | 'file' = 'vault';

	// Vault tab state
	private vaultSearchInput: HTMLInputElement | null = null;
	private vaultResultsEl: HTMLElement | null = null;
	private vaultPreviewEl: HTMLElement | null = null;
	private selectedVaultFile: TFile | null = null;

	// File tab state
	private selectedOsFile: File | null = null;
	private filePreviewEl: HTMLElement | null = null;
	private fileDropZoneEl: HTMLElement | null = null;

	// Shared
	private swapBtn: HTMLButtonElement | null = null;

	constructor(app: App, onChoose: (result: SwapResult | null) => void) {
		super(app);
		this.onChoose = onChoose;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		const t = getText();

		this.titleEl.setText(t.swapModalTitle);
		contentEl.addClass('kambas-swap-modal');

		// ── Tab bar ──────────────────────────────────────────────────
		const tabBar = contentEl.createDiv({ cls: 'kambas-swap-tabs' });

		const vaultTabBtn = tabBar.createEl('button', {
			text: t.swapFromVault,
			cls: 'kambas-swap-tab kambas-swap-tab--active',
		});
		const fileTabBtn = tabBar.createEl('button', {
			text: t.swapFromFile,
			cls: 'kambas-swap-tab',
		});

		// ── Tab panels ───────────────────────────────────────────────
		const vaultPanel = contentEl.createDiv({ cls: 'kambas-swap-panel kambas-swap-panel--active' });
		const filePanel = contentEl.createDiv({ cls: 'kambas-swap-panel' });

		this.buildVaultPanel(vaultPanel, t);
		this.buildFilePanel(filePanel, t);

		// ── Action buttons ───────────────────────────────────────────
		const btnRow = contentEl.createDiv({ cls: 'kambas-swap-btn-row' });

		const cancelBtn = btnRow.createEl('button', { text: t.cancelBtn, cls: 'kambas-swap-cancel-btn' });
		cancelBtn.addEventListener('click', () => {
			this.resolved = true;
			this.close();
			this.onChoose(null);
		});

		this.swapBtn = btnRow.createEl('button', { text: t.swapBtn, cls: 'mod-cta kambas-swap-action-btn' });
		this.swapBtn.disabled = true;
		this.swapBtn.addEventListener('click', () => this.doSwap());

		// ── Tab switching ─────────────────────────────────────────────
		vaultTabBtn.addEventListener('click', () => {
			this.activeTab = 'vault';
			vaultTabBtn.classList.add('kambas-swap-tab--active');
			fileTabBtn.classList.remove('kambas-swap-tab--active');
			vaultPanel.classList.add('kambas-swap-panel--active');
			filePanel.classList.remove('kambas-swap-panel--active');
			this.updateSwapBtn();
		});

		fileTabBtn.addEventListener('click', () => {
			this.activeTab = 'file';
			fileTabBtn.classList.add('kambas-swap-tab--active');
			vaultTabBtn.classList.remove('kambas-swap-tab--active');
			filePanel.classList.add('kambas-swap-panel--active');
			vaultPanel.classList.remove('kambas-swap-panel--active');
			this.updateSwapBtn();
		});

		// Listen for paste event anywhere while modal is open
		window.addEventListener('paste', this.handlePasteEvent);

		// Focus search input
		window.setTimeout(() => this.vaultSearchInput?.focus(), 50);
	}

	private handlePasteEvent = (evt: ClipboardEvent): void => {
		const items = evt.clipboardData?.files;
		if (items && items.length > 0) {
			for (let i = 0; i < items.length; i++) {
				const file = items[i];
				if (file.type.startsWith('image/')) {
					evt.preventDefault();
					evt.stopPropagation();
					this.activeTab = 'file';
					const vaultTabBtn = this.contentEl.querySelector('.kambas-swap-tab:nth-child(1)');
					const fileTabBtn = this.contentEl.querySelector('.kambas-swap-tab:nth-child(2)');
					const vaultPanel = this.contentEl.querySelector('.kambas-swap-panel:nth-child(2)');
					const filePanel = this.contentEl.querySelector('.kambas-swap-panel:nth-child(3)');
					vaultTabBtn?.classList.remove('kambas-swap-tab--active');
					fileTabBtn?.classList.add('kambas-swap-tab--active');
					vaultPanel?.classList.remove('kambas-swap-panel--active');
					filePanel?.classList.add('kambas-swap-panel--active');
					this.handleOsFile(file);
					break;
				}
			}
		}
	};

	private buildVaultPanel(panel: HTMLElement, t: ReturnType<typeof getText>): void {
		// Search input
		const searchWrap = panel.createDiv({ cls: 'kambas-swap-search-wrap' });
		const searchIcon = searchWrap.createSpan({ cls: 'kambas-swap-search-icon' });
		searchIcon.setText('🔍');

		this.vaultSearchInput = searchWrap.createEl('input', {
			type: 'text',
			cls: 'kambas-swap-search-input',
			attr: { placeholder: t.swapSearchPlaceholder },
		});

		// Results list
		this.vaultResultsEl = panel.createDiv({ cls: 'kambas-swap-results' });

		// Preview area
		this.vaultPreviewEl = panel.createDiv({ cls: 'kambas-swap-preview kambas-swap-preview--vault' });

		// Populate results with all vault media files initially
		this.populateVaultResults('');

		this.vaultSearchInput.addEventListener('input', () => {
			const query = this.vaultSearchInput?.value.trim().toLowerCase() || '';
			this.populateVaultResults(query);
		});
	}

	private populateVaultResults(query: string): void {
		if (!this.vaultResultsEl) return;
		this.vaultResultsEl.empty();

		const allFiles = this.app.vault.getFiles();
		const mediaFiles = allFiles.filter((f) => MEDIA_EXTENSIONS.has(f.extension.toLowerCase()));

		const filtered = query
			? mediaFiles.filter((f) => f.path.toLowerCase().includes(query) || f.name.toLowerCase().includes(query))
			: mediaFiles;

		const sorted = filtered.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 80);

		if (sorted.length === 0) {
			this.vaultResultsEl.createDiv({ cls: 'kambas-swap-no-results', text: 'No media files found' });
			return;
		}

		for (const tfile of sorted) {
			const item = this.vaultResultsEl.createDiv({ cls: 'kambas-swap-result-item' });

			// Small icon based on extension type
			const isVideo = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v', 'ogv'].includes(tfile.extension.toLowerCase());
			const iconEl = item.createSpan({ cls: 'kambas-swap-result-icon' });
			iconEl.setText(isVideo ? '🎬' : '🖼️');

			const nameEl = item.createSpan({ cls: 'kambas-swap-result-name', text: tfile.name });
			const pathEl = item.createSpan({ cls: 'kambas-swap-result-path', text: tfile.parent?.path || '' });

			if (this.selectedVaultFile === tfile) {
				item.classList.add('kambas-swap-result-item--selected');
			}

			item.addEventListener('click', () => {
				this.selectedVaultFile = tfile;
				this.vaultResultsEl?.querySelectorAll('.kambas-swap-result-item--selected').forEach((el) =>
					el.classList.remove('kambas-swap-result-item--selected')
				);
				item.classList.add('kambas-swap-result-item--selected');
				this.showVaultPreview(tfile);
				this.updateSwapBtn();
			});

			// Suppress unused variable warnings
			void nameEl;
			void pathEl;
		}
	}

	private showVaultPreview(tfile: TFile): void {
		if (!this.vaultPreviewEl) return;
		this.vaultPreviewEl.empty();

		const isVideo = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v', 'ogv'].includes(tfile.extension.toLowerCase());
		const resourcePath = this.app.vault.getResourcePath(tfile);

		if (isVideo) {
			const video = this.vaultPreviewEl.createEl('video', {
				cls: 'kambas-swap-preview-media',
				attr: { src: resourcePath, controls: 'true' },
			});
			video.muted = true;
		} else {
			this.vaultPreviewEl.createEl('img', {
				cls: 'kambas-swap-preview-media',
				attr: { src: resourcePath },
			});
		}

		this.vaultPreviewEl.createSpan({ cls: 'kambas-swap-preview-name', text: tfile.name });
	}

	private buildFilePanel(panel: HTMLElement, t: ReturnType<typeof getText>): void {
		// Hidden file input
		const fileInput = createEl('input', {
			type: 'file',
			attr: {
				accept: 'image/*,video/*',
				style: 'display:none',
			},
		});
		panel.appendChild(fileInput);

		// Drop zone
		this.fileDropZoneEl = panel.createDiv({ cls: 'kambas-swap-dropzone' });

		const dropIcon = this.fileDropZoneEl.createSpan({ cls: 'kambas-swap-dropzone-icon' });
		dropIcon.setText('📁');

		this.fileDropZoneEl.createEl('p', { cls: 'kambas-swap-dropzone-hint', text: t.swapDropZoneHint });

		const btnContainer = this.fileDropZoneEl.createDiv({ cls: 'kambas-swap-dropzone-btns' });

		const browseBtn = btnContainer.createEl('button', {
			cls: 'kambas-swap-browse-btn',
			text: t.swapBrowseBtn,
		});

		const clipboardBtn = btnContainer.createEl('button', {
			cls: 'kambas-swap-browse-btn',
			text: t.swapFromClipboard,
		});

		// File preview area
		this.filePreviewEl = panel.createDiv({ cls: 'kambas-swap-preview kambas-swap-preview--file' });

		browseBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			fileInput.click();
		});

		clipboardBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			void (async (): Promise<void> => {
				try {
					const items = await navigator.clipboard.read();
					for (const item of items) {
						const imageType = item.types.find((t) => t.startsWith('image/'));
						if (imageType) {
							const blob = await item.getType(imageType);
							const ext = imageType.split('/')[1] || 'png';
							const file = new File([blob], `pasted_image_${Date.now()}.${ext}`, { type: imageType });
							this.handleOsFile(file);
							return;
						}
					}
					new Notice('No image found in clipboard');
				} catch (err) {
					console.error('Failed to read clipboard:', err);
					new Notice('Unable to access clipboard');
				}
			})();
		});

		fileInput.addEventListener('change', () => {
			const file = fileInput.files?.[0];
			if (file) this.handleOsFile(file);
		});

		// Drag and drop
		this.fileDropZoneEl.addEventListener('dragover', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.fileDropZoneEl?.classList.add('kambas-swap-dropzone--over');
		});

		this.fileDropZoneEl.addEventListener('dragleave', () => {
			this.fileDropZoneEl?.classList.remove('kambas-swap-dropzone--over');
		});

		this.fileDropZoneEl.addEventListener('drop', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.fileDropZoneEl?.classList.remove('kambas-swap-dropzone--over');
			const file = e.dataTransfer?.files?.[0];
			if (file) this.handleOsFile(file);
		});

		this.fileDropZoneEl.addEventListener('click', () => fileInput.click());
	}

	private handleOsFile(file: File): void {
		this.selectedOsFile = file;
		this.showOsFilePreview(file);
		this.updateSwapBtn();
	}

	private showOsFilePreview(file: File): void {
		if (!this.filePreviewEl) return;
		this.filePreviewEl.empty();
		this.fileDropZoneEl?.classList.add('kambas-swap-dropzone--has-file');

		const objectUrl = URL.createObjectURL(file);
		const isVideo = file.type.startsWith('video/');

		if (isVideo) {
			const video = this.filePreviewEl.createEl('video', {
				cls: 'kambas-swap-preview-media',
				attr: { src: objectUrl, controls: 'true' },
			});
			video.muted = true;
		} else {
			const img = this.filePreviewEl.createEl('img', {
				cls: 'kambas-swap-preview-media',
				attr: { src: objectUrl },
			});
			img.addEventListener('load', () => URL.revokeObjectURL(objectUrl), { once: true });
		}

		this.filePreviewEl.createSpan({ cls: 'kambas-swap-preview-name', text: file.name });
	}

	private updateSwapBtn(): void {
		if (!this.swapBtn) return;
		const hasSelection =
			(this.activeTab === 'vault' && this.selectedVaultFile !== null) ||
			(this.activeTab === 'file' && this.selectedOsFile !== null);
		this.swapBtn.disabled = !hasSelection;
	}

	private doSwap(): void {
		if (this.activeTab === 'vault' && this.selectedVaultFile) {
			this.resolved = true;
			this.close();
			this.onChoose({
				source: 'vault',
				tfile: this.selectedVaultFile,
				storageChoice: 'embed', // vault files are referenced directly
			});
		} else if (this.activeTab === 'file' && this.selectedOsFile) {
			const file = this.selectedOsFile;
			this.resolved = true;
			this.close();

			// Open existing ImageIngestionModal for storage choice
			new ImageIngestionModal(
				this.app,
				file.name,
				1,
				(ingestRes) => {
					if (ingestRes.choice === 'cancel') {
						this.onChoose(null);
					} else {
						this.onChoose({
							source: 'file',
							file,
							storageChoice: ingestRes.choice,
						});
					}
				}
			).open();
		}
	}

	onClose(): void {
		window.removeEventListener('paste', this.handlePasteEvent);
		const { contentEl } = this;
		contentEl.empty();
		if (!this.resolved) {
			this.onChoose(null);
		}
	}
}
