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
