import { App, TFile } from 'obsidian';
import { CanvasFileData } from './CanvasTypes';

/**
 * Collects all unique kambasTags values from all nodes in the canvas file data.
 */
export function collectAllCanvasTags(data: CanvasFileData): string[] {
	const tagSet = new Set<string>();
	for (const node of data.nodes ?? []) {
		for (const tag of node.kambasTags ?? []) {
			if (tag.trim()) tagSet.add(tag.trim().toLowerCase());
		}
	}
	return Array.from(tagSet).sort();
}

/**
 * Writes (or clears) the aggregated canvas tags as YAML frontmatter on the canvas file.
 * Uses app.fileManager.processFrontMatter if available (Obsidian ≥ 1.4).
 * Falls back to a manual prepend/replace approach if the API is unavailable.
 */
export async function syncTagsToFrontmatter(
	app: App,
	canvasFile: TFile,
	data: CanvasFileData
): Promise<void> {
	const isPublic = Boolean(data.kambasTagsPublic);
	const tags = isPublic ? collectAllCanvasTags(data) : [];

	// Try Obsidian's native processFrontMatter API
	const fm = (app.fileManager as unknown as {
		processFrontMatter?: (file: TFile, fn: (fm: Record<string, unknown>) => void) => Promise<void>;
	}).processFrontMatter;

	if (typeof fm === 'function') {
		try {
			await fm.call(app.fileManager, canvasFile, (front: Record<string, unknown>) => {
				if (isPublic && tags.length > 0) {
					front['tags'] = tags;
				} else {
					delete front['tags'];
				}
			});
			return;
		} catch {
			// Fall through to manual approach
		}
	}

	// Manual fallback: read raw content and prepend/replace YAML front matter
	try {
		const raw = await app.vault.read(canvasFile);

		// Strip existing YAML front matter block if present
		const FM_REGEX = /^---\r?\n[\s\S]*?\r?\n---\r?\n/;
		const body = raw.replace(FM_REGEX, '');

		let newContent: string;
		if (isPublic && tags.length > 0) {
			const tagsYaml = tags.map((t) => `  - ${t}`).join('\n');
			newContent = `---\ntags:\n${tagsYaml}\n---\n${body}`;
		} else {
			newContent = body;
		}

		await app.vault.modify(canvasFile, newContent);
	} catch {
		// Best-effort; non-fatal
	}
}

/**
 * Sets kambasTagsPublic on the canvas JSON and syncs tags to vault frontmatter.
 * Reads the canvas file, patches the flag, saves, then syncs frontmatter.
 */
export async function setCanvasTagsPublic(
	app: App,
	canvasFile: TFile,
	enabled: boolean
): Promise<void> {
	try {
		const content = await app.vault.read(canvasFile);
		let data: CanvasFileData;
		try {
			data = JSON.parse(content) as CanvasFileData;
		} catch {
			return;
		}

		data.kambasTagsPublic = enabled || undefined;
		if (!enabled) delete data.kambasTagsPublic;

		await app.vault.modify(canvasFile, JSON.stringify(data, null, 2));
		await syncTagsToFrontmatter(app, canvasFile, data);
	} catch {
		// Non-fatal
	}
}
