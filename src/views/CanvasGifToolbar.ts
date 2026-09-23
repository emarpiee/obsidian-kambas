import { setIcon } from 'obsidian';

import { getText } from '../i18n';

export interface GifToolbarCallbacks {
	onTogglePlay: () => void;
	onStepPrev: () => void;
	onStepNext: () => void;
	onSeek: (frameIndex: number) => void;
	onChangeSpeed: (speed: number) => void;
	onExtractFrame: () => void;
}

export class CanvasGifToolbar {
	private containerEl: HTMLElement;
	private playPauseBtn: HTMLElement | null = null;
	private scrubberInput: HTMLInputElement | null = null;
	private frameCountEl: HTMLElement | null = null;
	private speedSelectEl: HTMLSelectElement | null = null;
	private extractBtn: HTMLElement | null = null;

	constructor(
		parentEl: HTMLElement,
		private totalFrames: number,
		private callbacks: GifToolbarCallbacks
	) {
		this.containerEl = parentEl.createDiv({ cls: 'kambas-gif-toolbar' });
		this.buildToolbar();
	}

	private buildToolbar(): void {
		const t = getText();

		// Play/Pause button
		this.playPauseBtn = this.containerEl.createDiv({
			cls: 'kambas-gif-toolbar-btn kambas-gif-play-btn',
			attr: { 'aria-label': t.gifPlayPauseTooltip || 'Play / Pause (Space)' },
		});
		setIcon(this.playPauseBtn, 'pause');
		this.playPauseBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.callbacks.onTogglePlay();
		});

		// Step Previous button
		const prevBtn = this.containerEl.createDiv({
			cls: 'kambas-gif-toolbar-btn',
			attr: { 'aria-label': t.gifStepPrevTooltip || 'Previous frame' },
		});
		setIcon(prevBtn, 'chevron-left');
		prevBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.callbacks.onStepPrev();
		});

		// Step Next button
		const nextBtn = this.containerEl.createDiv({
			cls: 'kambas-gif-toolbar-btn',
			attr: { 'aria-label': t.gifStepNextTooltip || 'Next frame' },
		});
		setIcon(nextBtn, 'chevron-right');
		nextBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.callbacks.onStepNext();
		});

		// Timeline Scrubber Slider
		this.scrubberInput = this.containerEl.createEl('input', {
			cls: 'kambas-gif-scrubber',
			attr: {
				type: 'range',
				min: '0',
				max: Math.max(0, this.totalFrames - 1).toString(),
				value: '0',
			},
		});
		this.scrubberInput.addEventListener('input', (e) => {
			e.stopPropagation();
			const val = parseInt(this.scrubberInput?.value || '0', 10);
			this.callbacks.onSeek(val);
		});
		this.scrubberInput.addEventListener('mousedown', (e) =>
			e.stopPropagation()
		);
		this.scrubberInput.addEventListener('click', (e) => e.stopPropagation());

		// Frame Counter label
		this.frameCountEl = this.containerEl.createSpan({
			cls: 'kambas-gif-frame-counter',
			text: `1 / ${this.totalFrames}`,
		});

		// Speed selector dropdown
		this.speedSelectEl = this.containerEl.createEl('select', {
			cls: 'kambas-gif-speed-select',
			attr: { 'aria-label': t.gifSpeedLabel || 'Playback Speed' },
		});

		const speeds = [0.25, 0.5, 1, 1.5, 2, 4];
		for (const speed of speeds) {
			const opt = this.speedSelectEl.createEl('option', {
				value: speed.toString(),
				text: `${speed}x`,
			});
			if (speed === 1) opt.selected = true;
		}

		this.speedSelectEl.addEventListener('change', (e) => {
			e.stopPropagation();
			const speed = parseFloat(this.speedSelectEl?.value || '1');
			this.callbacks.onChangeSpeed(speed);
		});
		this.speedSelectEl.addEventListener('click', (e) => e.stopPropagation());

		// Extract Frame button
		this.extractBtn = this.containerEl.createDiv({
			cls: 'kambas-gif-toolbar-btn kambas-gif-extract-btn',
			attr: {
				'aria-label':
					t.gifExtractFrameTooltip || 'Extract current frame to canvas',
			},
		});
		setIcon(this.extractBtn, 'camera');
		this.extractBtn.createSpan({
			cls: 'kambas-gif-btn-text',
			text: t.gifExtractFrameLabel || 'Extract',
		});
		this.extractBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.callbacks.onExtractFrame();
		});

		// Stop canvas drag events on toolbar interaction
		this.containerEl.addEventListener('mousedown', (e) => e.stopPropagation());
		this.containerEl.addEventListener('pointerdown', (e) =>
			e.stopPropagation()
		);
	}

	public setMultiSelect(isMultiSelect: boolean): void {
		if (this.extractBtn) {
			this.extractBtn.style.display = isMultiSelect ? 'none' : '';
		}
	}

	public getContainerEl(): HTMLElement {
		return this.containerEl;
	}

	public updateState(
		isPlaying: boolean,
		currentFrame: number,
		totalFrames: number,
		speed?: number
	): void {
		if (this.playPauseBtn) {
			setIcon(this.playPauseBtn, isPlaying ? 'pause' : 'play');
		}

		if (this.scrubberInput) {
			this.scrubberInput.max = Math.max(0, totalFrames - 1).toString();
			this.scrubberInput.value = currentFrame.toString();
		}

		if (this.frameCountEl) {
			this.frameCountEl.setText(`${currentFrame + 1} / ${totalFrames}`);
		}

		if (this.speedSelectEl && speed !== undefined) {
			this.speedSelectEl.value = speed.toString();
		}
	}

	public updatePosition(
		nodeEls: HTMLElement | HTMLElement[],
		containerEl: HTMLElement
	): void {
		if (!this.containerEl) return;

		const elements = Array.isArray(nodeEls) ? nodeEls : [nodeEls];
		const validElements = elements.filter((el) => el && el.isConnected);
		if (validElements.length === 0) return;

		const parent = this.containerEl.parentElement || containerEl;
		const parentRect = parent.getBoundingClientRect();
		if (parentRect.width === 0 && parentRect.height === 0) return;

		let minLeft = Infinity;
		let maxRight = -Infinity;
		let maxBottom = -Infinity;

		for (const el of validElements) {
			const rect = el.getBoundingClientRect();
			if (rect.width === 0 || rect.height === 0) continue;

			minLeft = Math.min(minLeft, rect.left);
			maxRight = Math.max(maxRight, rect.right);

			let elBottom = rect.bottom;
			const tagBar = el.querySelector('.kambas-tag-bar');
			if (
				tagBar &&
				!document.body.classList.contains('kambas-tag-position-inside')
			) {
				const tagRect = tagBar.getBoundingClientRect();
				if (tagRect.height > 0) {
					elBottom = Math.max(elBottom, tagRect.bottom);
				}
			}
			maxBottom = Math.max(maxBottom, elBottom);
		}

		if (
			minLeft === Infinity ||
			maxRight === -Infinity ||
			maxBottom === -Infinity
		)
			return;

		const leftPx = (minLeft + maxRight) / 2 - parentRect.left;
		const topPx = maxBottom - parentRect.top + 8;

		this.containerEl.style.transform = `translate3d(${leftPx.toFixed(2)}px, ${topPx.toFixed(2)}px, 0) translateX(-50%)`;
	}

	public destroy(): void {
		this.containerEl.remove();
	}
}
