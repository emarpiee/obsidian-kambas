/**
 * CanvasGifDecoder handles frame-by-frame decoding of animated GIF data.
 * Utilizes the native WebCodecs ImageDecoder API available in Electron/Chromium.
 * Employs direct VideoFrame rendering to 2D Canvas context for zero-leak memory efficiency.
 */

export class CanvasGifDecoder {
	private decoder: ImageDecoder | null = null;
	private frameCount: number = 0;
	private isInitialized: boolean = false;
	private width: number = 0;
	private height: number = 0;
	private defaultDurationMs: number = 100;
	private frameDurationCache: Map<number, number> = new Map();

	public async init(buffer: ArrayBuffer): Promise<boolean> {
		if (typeof ImageDecoder === 'undefined') {
			console.warn('ImageDecoder API is not supported in this environment.');
			return false;
		}

		try {
			// Initialize native ImageDecoder for image/gif
			this.decoder = new ImageDecoder({
				data: buffer,
				type: 'image/gif',
			});

			await this.decoder.tracks.ready;
			const track = this.decoder.tracks.selectedTrack;

			if (!track) {
				return false;
			}

			this.frameCount = track.frameCount;

			// Decode only the first frame to extract dimensions and default frame duration
			const firstFrameResult = await this.decoder.decode({ frameIndex: 0 });
			const videoFrame = firstFrameResult.image;
			try {
				this.width = videoFrame.displayWidth;
				this.height = videoFrame.displayHeight;
				const durationMs = (videoFrame.duration || 100000) / 1000;
				this.defaultDurationMs = durationMs > 0 ? durationMs : 100;
				this.frameDurationCache.set(0, this.defaultDurationMs);
			} finally {
				videoFrame.close(); // Immediately release VideoFrame!
			}

			this.isInitialized = true;
			return true;
		} catch (err) {
			console.error('Failed to initialize CanvasGifDecoder:', err);
			return false;
		}
	}

	public getIsInitialized(): boolean {
		return this.isInitialized;
	}

	public getFrameCount(): number {
		return this.frameCount;
	}

	public getDimensions(): { width: number; height: number } {
		return { width: this.width, height: this.height };
	}

	public getFrameDuration(frameIndex: number): number {
		return this.frameDurationCache.get(frameIndex) || this.defaultDurationMs;
	}

	/**
	 * Renders a specific GIF frame directly onto the canvas 2D context and releases the VideoFrame immediately.
	 */
	private isDecoding: boolean = false;

	public async renderFrameToCanvas(
		frameIndex: number,
		ctx: CanvasRenderingContext2D,
		canvasWidth: number,
		canvasHeight: number
	): Promise<boolean> {
		if (!this.isInitialized || !this.decoder) return false;
		if (this.isDecoding) return false;

		this.isDecoding = true;
		const clampedIndex = Math.max(0, Math.min(frameIndex, this.frameCount - 1));
		let videoFrame: VideoFrame | null = null;

		try {
			const result = await this.decoder.decode({ frameIndex: clampedIndex });
			videoFrame = result.image;

			// Cache frame duration if available
			if (videoFrame.duration) {
				const durationMs = videoFrame.duration / 1000;
				if (durationMs > 0) {
					this.frameDurationCache.set(clampedIndex, durationMs);
				}
			}

			// Draw VideoFrame directly to HTML5 Canvas context
			ctx.clearRect(0, 0, canvasWidth, canvasHeight);
			ctx.drawImage(videoFrame, 0, 0, canvasWidth, canvasHeight);
			return true;
		} catch (err) {
			console.error(
				`Failed to decode & render GIF frame ${clampedIndex}:`,
				err
			);
			return false;
		} finally {
			if (videoFrame) {
				try {
					videoFrame.close();
				} catch (_) {
					// Already closed
				}
			}
			this.isDecoding = false;
		}
	}

	public async extractFrameAsBlob(frameIndex: number): Promise<Blob | null> {
		if (!this.isInitialized || !this.decoder) return null;

		const clampedIndex = Math.max(0, Math.min(frameIndex, this.frameCount - 1));
		let videoFrame: VideoFrame | null = null;
		let offscreen: HTMLCanvasElement | null = null;

		try {
			const result = await this.decoder.decode({ frameIndex: clampedIndex });
			videoFrame = result.image;

			offscreen = createEl('canvas');
			offscreen.width = videoFrame.displayWidth || this.width;
			offscreen.height = videoFrame.displayHeight || this.height;
			const ctx = offscreen.getContext('2d');

			if (!ctx) {
				return null;
			}

			ctx.drawImage(videoFrame, 0, 0);

			return new Promise<Blob | null>((resolve) => {
				offscreen.toBlob((blob) => resolve(blob), 'image/png');
			});
		} catch (err) {
			console.error(`Failed to extract GIF frame ${clampedIndex}:`, err);
			return null;
		} finally {
			if (offscreen) {
				offscreen.width = 0;
				offscreen.height = 0;
			}
			if (videoFrame) {
				try {
					videoFrame.close();
				} catch (_) {
					// ignore
				}
			}
		}
	}

	public destroy(): void {
		this.frameDurationCache.clear();
		if (this.decoder) {
			try {
				this.decoder.close();
			} catch (_) {
				// ignore
			}
			this.decoder = null;
		}
		this.isInitialized = false;
	}
}
