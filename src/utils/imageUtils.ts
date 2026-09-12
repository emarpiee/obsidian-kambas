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
 * Uses HSV color space with minimum pixel coverage thresholds to prevent noise/false positives,
 * while maintaining accent color capture for genuine distinct colors.
 */
export function extractImagePalette(src: string | Blob, maxColorCount = 6): Promise<string[]> {
	return new Promise((resolve) => {
		const img = new Image();
		img.crossOrigin = 'Anonymous';
		img.onload = (): void => {
			try {
				const canvas = createEl('canvas');
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

				const totalPixels = pixels.length;
				if (totalPixels === 0) {
					resolve([]);
					return;
				}

				// Bin pixels into 36 Hue buckets (10° each) plus Saturation/Value bins for grays
				interface Bucket {
					rSum: number; gSum: number; bSum: number;
					count: number;
					totalScore: number;
				}

				const buckets: Map<string, Bucket> = new Map();

				for (const p of pixels) {
					let key: string;
					if (p.s < 0.15) {
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
						bucket = { rSum: 0, gSum: 0, bSum: 0, count: 0, totalScore: 0 };
						buckets.set(key, bucket);
					}

					bucket.rSum += p.r;
					bucket.gSum += p.g;
					bucket.bSum += p.b;
					bucket.count++;
					// Boost score of vivid saturated pixels (like red dots/markers on grayscale diagrams)
					const saturationBoost = p.s > 0.35 ? 1 + (p.s * 8) : p.s > 0.15 ? 1 + (p.s * 3) : 1;
					bucket.totalScore += saturationBoost;
				}

				// Finalize bucket color representations
				const candidateClusters: { r: number; g: number; b: number; score: number; count: number; h: number; s: number; v: number }[] = [];
				for (const bucket of buckets.values()) {
					// Average saturation of bucket
					const r = Math.round(bucket.rSum / bucket.count);
					const g = Math.round(bucket.gSum / bucket.count);
					const b = Math.round(bucket.bSum / bucket.count);

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

					// Allow tiny clusters if vivid (e.g., at least 2 vivid red pixels like red dots/markers)
					const minRequired = s > 0.35 ? 2 : Math.max(8, Math.floor(totalPixels * 0.01));
					if (bucket.count < minRequired) continue;

					candidateClusters.push({ r, g, b, score: bucket.totalScore, count: bucket.count, h, s, v });
				}

				// Sort by weighted total score (population + saturation boost)
				candidateClusters.sort((a, b) => b.score - a.score);

				// Perceptual color distance
				const colorDistance = (
					c1: { r: number; g: number; b: number; h: number; s: number },
					c2: { r: number; g: number; b: number; h: number; s: number }
				): number => {
					const rmean = (c1.r + c2.r) / 2;
					const r = c1.r - c2.r;
					const g = c1.g - c2.g;
					const b = c1.b - c2.b;
					const rgbDist = Math.sqrt((((512 + rmean) * r * r) >> 8) + 4 * g * g + (((767 - rmean) * b * b) >> 8));

					if (c1.s > 0.15 && c2.s > 0.15) {
						let hDiff = Math.abs(c1.h - c2.h);
						if (hDiff > 180) hDiff = 360 - hDiff;
						if (hDiff < 30) return Math.min(rgbDist, 20); // Treat close hues as similar
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
					if (selected.length >= maxColorCount) break;
				}

				// Fill up swatches if distinctness filter was slightly too strict
				if (selected.length < maxColorCount) {
					for (const cand of candidateClusters) {
						if (!selected.includes(cand)) {
							selected.push(cand);
						}
						if (selected.length >= maxColorCount) break;
					}
				}

				const hexColors = selected.map(({ r, g, b }) => `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`);
				resolve(hexColors);
			} catch {
				resolve([]);
			}
		};
		img.onerror = (): void => resolve([]);

		if (typeof src === 'string') {
			img.src = src;
		} else {
			img.src = URL.createObjectURL(src);
		}
	});
}


/**
 * Maps HSV values directly to human-readable named colors.
 * Refined hue boundaries & saturation requirements prevent false positives (like warm lighting/browns being Red).
 */
export function hsvToNamedColor(h: number, s: number, v: number): string | null {
	// Handle neutral colors (Black, Gray, White)
	if (s < 0.15) {
		if (v < 0.20) return 'Black';
		if (v > 0.85) return 'White';
		return 'Gray';
	}
	if (v < 0.12) return 'Black';

	// Red: Hues 348°-360° and 0°-12°. Requires decent saturation/brightness so warm browns aren't Red.
	if (h >= 348 || h < 12) {
		if (s < 0.22 || v < 0.20) return 'Gray';
		return 'Red';
	}

	// Orange: Hues 12°-38°
	if (h >= 12 && h < 38) {
		if (s < 0.20) return 'Gray';
		return 'Orange';
	}

	// Yellow: Hues 38°-68°
	if (h >= 38 && h < 68) {
		if (s < 0.18) return 'Gray';
		return 'Yellow';
	}

	// Green: Hues 68°-155°
	if (h >= 68 && h < 155) return 'Green';

	// Teal: Hues 155°-175°
	if (h >= 155 && h < 175) return 'Teal';

	// Cyan: Hues 175°-200°
	if (h >= 175 && h < 200) return 'Cyan';

	// Blue: Hues 200°-255°
	if (h >= 200 && h < 255) return 'Blue';

	// Indigo: Hues 255°-270°
	if (h >= 255 && h < 270) return 'Indigo';

	// Purple: Hues 270°-310°
	if (h >= 270 && h < 310) return 'Purple';

	// Pink: Hues 310°-348°
	if (h >= 310 && h < 348) return 'Pink';

	return null;
}

/**
 * Maps a hex color string to a human-readable named color based on HSV analysis.
 */
export function hexToNamedColor(hex: string): string | null {
	const cleaned = hex.replace('#', '');
	if (cleaned.length !== 6) return null;
	const r = parseInt(cleaned.substring(0, 2), 16) / 255;
	const g = parseInt(cleaned.substring(2, 4), 16) / 255;
	const b = parseInt(cleaned.substring(4, 6), 16) / 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const d = max - min;

	const v = max;
	const s = max === 0 ? 0 : d / max;

	let h = 0;
	if (d !== 0) {
		if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
		else if (max === g) h = ((b - r) / d + 2) * 60;
		else h = ((r - g) / d + 4) * 60;
	}

	return hsvToNamedColor(h, s, v);
}

/**
 * Maps Obsidian native canvas preset color strings ('1'..'6') or custom hex codes to named colors.
 * Obsidian preset colors:
 *  '1' => Red (#e05050 / #e03e3e)
 *  '2' => Orange (#d9753b)
 *  '3' => Yellow (#d4a72c)
 *  '4' => Green (#4da664)
 *  '5' => Cyan (#389eb3)
 *  '6' => Purple (#8e54e9)
 */
export function canvasNodePresetColorToName(colorStr: string): string | null {
	if (!colorStr) return null;
	const presetMap: Record<string, string> = {
		'1': 'Red',
		'2': 'Orange',
		'3': 'Yellow',
		'4': 'Green',
		'5': 'Cyan',
		'6': 'Purple',
	};
	if (presetMap[colorStr]) return presetMap[colorStr];
	if (colorStr.startsWith('#')) return hexToNamedColor(colorStr);
	return null;
}

/**
 * Directly analyzes image pixels to extract all significant named colors present in the image.
 * If includeAccents is false (default): extracts ONLY main/dominant colors (>= 4.0% coverage).
 * If includeAccents is true: also includes minor vivid accent colors (>= 0.5% coverage for vivid pixels, e.g. stems/icons).
 */
export async function getNodeDominantColorName(src: string, includeAccents = false): Promise<string[] | null> {
	return new Promise((resolve) => {
		const img = new Image();
		img.crossOrigin = 'Anonymous';
		img.onload = (): void => {
			try {
				const canvas = createEl('canvas');
				const ctx = canvas.getContext('2d');
				if (!ctx) {
					resolve(null);
					return;
				}

				// Sample down image to 160x160 for fast pixel scanning
				const scale = Math.min(160 / img.naturalWidth, 160 / img.naturalHeight, 1);
				canvas.width = Math.max(1, Math.floor(img.naturalWidth * scale));
				canvas.height = Math.max(1, Math.floor(img.naturalHeight * scale));

				ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
				const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

				const colorPixelCounts = new Map<string, number>();
				const vividPixelCounts = new Map<string, number>();
				let totalValidPixels = 0;

				for (let i = 0; i < imageData.length; i += 4) {
					const alpha = imageData[i + 3];
					if (alpha < 128) continue; // Ignore transparent background pixels

					const r = imageData[i] / 255;
					const g = imageData[i + 1] / 255;
					const b = imageData[i + 2] / 255;

					const max = Math.max(r, g, b);
					const min = Math.min(r, g, b);
					const d = max - min;

					let h = 0;
					if (d !== 0) {
						if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
						else if (max === g) h = ((b - r) / d + 2) * 60;
						else h = ((r - g) / d + 4) * 60;
					}
					const s = max === 0 ? 0 : d / max;
					const v = max;

					const colorName = hsvToNamedColor(h, s, v);
					if (colorName) {
						totalValidPixels++;
						colorPixelCounts.set(colorName, (colorPixelCounts.get(colorName) ?? 0) + 1);

						// Track vivid pixels separately (S > 0.35)
						if (s > 0.35) {
							vividPixelCounts.set(colorName, (vividPixelCounts.get(colorName) ?? 0) + 1);
						}
					}
				}

				if (totalValidPixels === 0) {
					resolve(null);
					return;
				}

				const detectedColors = new Set<string>();

				// Thresholds:
				// Dominant-only mode: requires >= 4.0% of total image pixels
				// Accent mode: requires >= 2.0% general OR >= 0.5% for vivid accents
				const dominantThreshold = totalValidPixels * (includeAccents ? 0.020 : 0.040);
				const vividThreshold = Math.max(12, totalValidPixels * 0.005);

				for (const [colorName, count] of colorPixelCounts.entries()) {
					const vividCount = vividPixelCounts.get(colorName) ?? 0;
					if (count >= dominantThreshold) {
						detectedColors.add(colorName);
					} else if (includeAccents && vividCount >= vividThreshold) {
						// Only include minor accent colors when accent mode toggle is ON
						detectedColors.add(colorName);
					}
				}

				resolve(detectedColors.size > 0 ? Array.from(detectedColors) : null);
			} catch {
				resolve(null);
			}
		};
		img.onerror = (): void => resolve(null);

		if (typeof src === 'string') {
			img.src = src;
		} else {
			img.src = URL.createObjectURL(src);
		}
	});
}


