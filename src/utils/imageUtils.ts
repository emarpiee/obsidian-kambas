import { App, normalizePath } from 'obsidian';

/**
 * Converts an ArrayBuffer to a Base64 Data URL string given a mime type.
 */
export function arrayBufferToBase64DataUrl(buffer: ArrayBuffer, mimeType: string): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return `data:${mimeType};base64,${window.btoa(binary)}`;
}

/**
 * Converts a Blob or File object into a Base64 Data URL string.
 */
export function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = (): void => {
			if (typeof reader.result === 'string') {
				resolve(reader.result);
			} else {
				reject(new Error('Failed to convert blob to base64 string'));
			}
		};
		reader.onerror = reject;
		reader.readAsDataURL(blob);
	});
}

/**
 * Reads natural pixel dimensions (width & height) from a Blob/File or Data URL.
 */
export function getImageDimensions(src: string | Blob): Promise<{ width: number; height: number }> {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = (): void => {
			resolve({ width: img.naturalWidth || 400, height: img.naturalHeight || 300 });
		};
		img.onerror = (): void => {
			resolve({ width: 400, height: 300 });
		};

		if (typeof src === 'string') {
			img.src = src;
		} else {
			img.src = URL.createObjectURL(src);
		}
	});
}

/**
 * Ensures a directory path exists inside the vault.
 */
export async function ensureFolderExists(app: App, folderPath: string): Promise<void> {
	const normalized = normalizePath(folderPath);
	if (normalized === '' || normalized === '.') return;

	const folder = app.vault.getAbstractFileByPath(normalized);
	if (folder) return;

	const parts = normalized.split('/');
	let currentPath = '';
	for (const part of parts) {
		currentPath = currentPath ? `${currentPath}/${part}` : part;
		const exist = app.vault.getAbstractFileByPath(currentPath);
		if (!exist) {
			await app.vault.createFolder(currentPath);
		}
	}
}

/**
 * Saves a binary buffer into the Obsidian vault under the given folder path with a unique filename.
 * Returns the relative vault path.
 */
export async function saveFileToVault(
	app: App,
	folderPath: string,
	filename: string,
	arrayBuffer: ArrayBuffer
): Promise<string> {
	await ensureFolderExists(app, folderPath);

	let finalName = filename;
	let count = 0;
	let targetPath = normalizePath(`${folderPath}/${finalName}`);

	while (app.vault.getAbstractFileByPath(targetPath)) {
		count++;
		const extIdx = filename.lastIndexOf('.');
		if (extIdx !== -1) {
			const base = filename.substring(0, extIdx);
			const ext = filename.substring(extIdx);
			finalName = `${base} (${count})${ext}`;
		} else {
			finalName = `${filename} (${count})`;
		}
		targetPath = normalizePath(`${folderPath}/${finalName}`);
	}

	await app.vault.createBinary(targetPath, arrayBuffer);
	return targetPath;
}

/**
 * Extracts a balanced color palette (in hex format) from an image source.
 * Uses HSV color space with chroma/saturation weighting to ensure small accent colors (reds, blues, greens)
 * are captured alongside dominant background shades.
 */
export function extractImagePalette(src: string | Blob, colorCount = 5): Promise<string[]> {
	return new Promise((resolve) => {
		const img = new Image();
		img.crossOrigin = 'Anonymous';
		img.onload = () => {
			try {
				const canvas = document.createElement('canvas');
				const ctx = canvas.getContext('2d');
				if (!ctx) {
					resolve([]);
					return;
				}

				// Sample down image to 180x180 for fast processing
				const scale = Math.min(180 / img.naturalWidth, 180 / img.naturalHeight, 1);
				canvas.width = Math.max(1, Math.floor(img.naturalWidth * scale));
				canvas.height = Math.max(1, Math.floor(img.naturalHeight * scale));

				ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
				const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

				interface PixelHSV {
					r: number; g: number; b: number;
					h: number; s: number; v: number;
				}

				const pixels: PixelHSV[] = [];
				for (let i = 0; i < imageData.length; i += 4) {
					const alpha = imageData[i + 3];
					if (alpha < 128) continue; // Skip transparent pixels

					const r = imageData[i];
					const g = imageData[i + 1];
					const b = imageData[i + 2];

					// RGB to HSV
					const rNorm = r / 255, gNorm = g / 255, bNorm = b / 255;
					const max = Math.max(rNorm, gNorm, bNorm);
					const min = Math.min(rNorm, gNorm, bNorm);
					const d = max - min;

					let h = 0;
					if (d !== 0) {
						if (max === rNorm) h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) * 60;
						else if (max === gNorm) h = ((bNorm - rNorm) / d + 2) * 60;
						else h = ((rNorm - gNorm) / d + 4) * 60;
					}
					const s = max === 0 ? 0 : d / max;
					const v = max;

					pixels.push({ r, g, b, h, s, v });
				}

				if (pixels.length === 0) {
					resolve([]);
					return;
				}

				// Bin pixels into 36 Hue buckets (10° each) plus Saturation/Value bins for grays
				interface Bucket {
					rSum: number; gSum: number; bSum: number;
					count: number;
					totalScore: number;
					avgH: number; avgS: number; avgV: number;
				}

				const buckets: Map<string, Bucket> = new Map();

				for (const p of pixels) {
					let key: string;
					if (p.s < 0.12) {
						// Low saturation (Grays/Blacks/Whites): bin by Value (lightness)
						const vBin = Math.floor(p.v * 8); // 8 lightness bins
						key = `gray_${vBin}`;
					} else {
						// Colored: bin by Hue (36 bins) and Saturation (2 bins: muted vs vivid)
						const hBin = Math.floor(p.h / 10); // 36 hue bins
						const sBin = p.s > 0.5 ? 'vivid' : 'muted';
						key = `color_${hBin}_${sBin}`;
					}

					let bucket = buckets.get(key);
					if (!bucket) {
						bucket = { rSum: 0, gSum: 0, bSum: 0, count: 0, totalScore: 0, avgH: 0, avgS: 0, avgV: 0 };
						buckets.set(key, bucket);
					}

					bucket.rSum += p.r;
					bucket.gSum += p.g;
					bucket.bSum += p.b;
					bucket.count++;
					// Boost score of saturated & accent colors so small red/blue/green markers stand out against gray backgrounds
					const saturationBoost = 1 + (p.s * 4); 
					bucket.totalScore += saturationBoost;
				}

				// Finalize bucket color representations
				const candidateClusters: { r: number; g: number; b: number; score: number; count: number; h: number; s: number; v: number }[] = [];
				for (const bucket of buckets.values()) {
					if (bucket.count === 0) continue;
					const r = Math.round(bucket.rSum / bucket.count);
					const g = Math.round(bucket.gSum / bucket.count);
					const b = Math.round(bucket.bSum / bucket.count);

					// Recalculate HSV for candidate
					const rNorm = r / 255, gNorm = g / 255, bNorm = b / 255;
					const max = Math.max(rNorm, gNorm, bNorm);
					const min = Math.min(rNorm, gNorm, bNorm);
					const d = max - min;
					let h = 0;
					if (d !== 0) {
						if (max === rNorm) h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) * 60;
						else if (max === gNorm) h = ((bNorm - rNorm) / d + 2) * 60;
						else h = ((rNorm - gNorm) / d + 4) * 60;
					}
					const s = max === 0 ? 0 : d / max;
					const v = max;

					candidateClusters.push({ r, g, b, score: bucket.totalScore, count: bucket.count, h, s, v });
				}

				// Sort by weighted total score (population + saturation boost)
				candidateClusters.sort((a, b) => b.score - a.score);

				// Perceptual color distance in LAB / Weighted RGB space
				const colorDistance = (
					c1: { r: number; g: number; b: number; h: number; s: number },
					c2: { r: number; g: number; b: number; h: number; s: number }
				): number => {
					// Weighted RGB distance (human eyes are more sensitive to green, less to blue)
					const rmean = (c1.r + c2.r) / 2;
					const r = c1.r - c2.r;
					const g = c1.g - c2.g;
					const b = c1.b - c2.b;
					const rgbDist = Math.sqrt((((512 + rmean) * r * r) >> 8) + 4 * g * g + (((767 - rmean) * b * b) >> 8));

					// Also enforce hue separation for distinct colors (red vs green vs blue)
					if (c1.s > 0.15 && c2.s > 0.15) {
						let hDiff = Math.abs(c1.h - c2.h);
						if (hDiff > 180) hDiff = 360 - hDiff;
						if (hDiff < 25) return Math.min(rgbDist, 20); // Treat close hues as similar
					}
					return rgbDist;
				};

				const selected: { r: number; g: number; b: number; h: number; s: number }[] = [];
				const minDistance = 35; // Distinctness threshold

				for (const cand of candidateClusters) {
					const isDistinct = selected.every((s) => colorDistance(s, cand) >= minDistance);
					if (isDistinct) {
						selected.push(cand);
					}
					if (selected.length >= colorCount) break;
				}

				// Fill up if threshold was slightly too aggressive
				if (selected.length < colorCount) {
					for (const cand of candidateClusters) {
						if (!selected.includes(cand)) {
							selected.push(cand);
						}
						if (selected.length >= colorCount) break;
					}
				}

				const hexColors = selected.map(({ r, g, b }) => `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`);
				resolve(hexColors);
			} catch {
				resolve([]);
			}
		};
		img.onerror = () => resolve([]);

		if (typeof src === 'string') {
			img.src = src;
		} else {
			img.src = URL.createObjectURL(src);
		}
	});
}

