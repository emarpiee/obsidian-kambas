import { App, TFile } from 'obsidian';

import { CanvasElement, CanvasFileData, CanvasItemView } from './CanvasTypes';

/**
 * Checks whether Away Mode on canvas close is enabled for a given canvas file.
 */
export async function getCanvasAwayModeOnClose(
	app: App,
	file: TFile,
	canvas?: CanvasElement
): Promise<boolean> {
	if (!file) return false;

	// 1. Check in-memory canvas element data if available
	const rawData = (canvas as unknown as { data?: CanvasFileData })?.data;
	if (rawData && typeof rawData.kambasAwayModeOnClose === 'boolean') {
		return rawData.kambasAwayModeOnClose;
	}

	// 2. Check metadata cache for frontmatter
	const cache = app.metadataCache.getFileCache(file);
	if (cache?.frontmatter) {
		if (typeof cache.frontmatter['kambasAwayModeOnClose'] === 'boolean') {
			return cache.frontmatter['kambasAwayModeOnClose'];
		}
		if (typeof cache.frontmatter['awayModeOnClose'] === 'boolean') {
			return cache.frontmatter['awayModeOnClose'];
		}
	}

	// 3. Fallback: read raw file JSON
	try {
		const content = await app.vault.read(file);
		const data = JSON.parse(content) as CanvasFileData;
		return Boolean(data.kambasAwayModeOnClose);
	} catch {
		return false;
	}
}

/**
 * Sets kambasAwayModeOnClose on the canvas JSON and syncs frontmatter if supported.
 */
export async function setCanvasAwayModeOnClose(
	app: App,
	file: TFile,
	enabled: boolean,
	activeView?: CanvasItemView | null
): Promise<void> {
	if (!file) return;

	// 1. Update active view canvas data in memory
	if (activeView?.canvas) {
		const rawData = (
			activeView.canvas as unknown as { data?: CanvasFileData }
		).data;
		if (rawData) {
			rawData.kambasAwayModeOnClose = enabled || undefined;
			if (!enabled) delete rawData.kambasAwayModeOnClose;
		}
	}

	// 2. Update JSON file content
	try {
		const content = await app.vault.read(file);
		let data: CanvasFileData;
		try {
			data = JSON.parse(content) as CanvasFileData;
		} catch {
			return;
		}

		data.kambasAwayModeOnClose = enabled || undefined;
		if (!enabled) delete data.kambasAwayModeOnClose;

		await app.vault.modify(file, JSON.stringify(data, null, 2));
	} catch (e) {
		console.error('[Kambas] Error saving kambasAwayModeOnClose:', e);
	}

	// 3. Try Obsidian's processFrontMatter API
	const fm = (
		app.fileManager as unknown as {
			processFrontMatter?: (
				file: TFile,
				fn: (fm: Record<string, unknown>) => void
			) => Promise<void>;
		}
	).processFrontMatter;

	if (typeof fm === 'function') {
		try {
			await fm.call(app.fileManager, file, (front: Record<string, unknown>) => {
				if (enabled) {
					front['kambasAwayModeOnClose'] = true;
				} else {
					delete front['kambasAwayModeOnClose'];
					delete front['awayModeOnClose'];
				}
			});
		} catch {
			/* Best effort */
		}
	}
}

/**
 * Persists Away Mode (setting kambasOpacity to 0 for all nodes & edges) directly to the canvas file.
 */
export async function persistCanvasAwayMode(
	app: App,
	file: TFile
): Promise<void> {
	if (!file || file.extension !== 'canvas') return;
	try {
		const content = await app.vault.read(file);
		let data: CanvasFileData;
		try {
			data = JSON.parse(content) as CanvasFileData;
		} catch {
			return;
		}

		let modified = false;
		if (data.nodes) {
			for (const node of data.nodes) {
				if (node.kambasOpacity !== 0) {
					node.kambasOpacity = 0;
					modified = true;
				}
			}
		}
		if (data.edges) {
			for (const edge of data.edges) {
				if (edge.kambasOpacity !== 0) {
					edge.kambasOpacity = 0;
					modified = true;
				}
			}
		}

		if (modified) {
			await app.vault.modify(file, JSON.stringify(data, null, 2));
		}
	} catch (e) {
		console.error('[Kambas] Error persisting canvas away mode:', e);
	}
}

/**
 * Checks if a canvas file has kambasAwayModeOnClose enabled, and if so,
 * sets 0% opacity in memory & persists Away Mode to disk.
 */
export async function checkAndPersistCanvasClose(
	app: App,
	file: TFile,
	activeView?: CanvasItemView | null
): Promise<void> {
	if (!file || file.extension !== 'canvas') return;
	if (activeView?.containerEl?.closest('.canvas-node')) return;
	const isAwayOnClose = await getCanvasAwayModeOnClose(
		app,
		file,
		activeView?.canvas
	);
	if (isAwayOnClose) {
		if (activeView && activeView.file === file) {
			try {
				const canvas = activeView.canvas;
				if (canvas?.nodes) {
					canvas.nodes.forEach((node) => {
						const rawNode = node as unknown as {
							unknownData?: { kambasOpacity?: number };
						};
						if (!rawNode.unknownData) rawNode.unknownData = {};
						rawNode.unknownData.kambasOpacity = 0;
					});
				}
				if (canvas?.edges) {
					canvas.edges.forEach((edge) => {
						if (!edge.unknownData) edge.unknownData = {};
						edge.unknownData.kambasOpacity = 0;
					});
				}
			} catch {
				/* ignore */
			}
		}
		await persistCanvasAwayMode(app, file);
	}
}
