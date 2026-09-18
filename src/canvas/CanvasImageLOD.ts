import { App, Notice, TFile, WorkspaceLeaf, normalizePath } from 'obsidian';
import type KambasPlugin from '../main';

const RASTER_RE = /\.(png|jpe?g|webp|bmp|avif)$/i;
const GIF_RE = /\.gif$/i;

const EXPORT_ACTION_RE = /export|screenshot/i;
const EXPORT_FORMAT_RE = /image|png|svg|jpe?g|webp|screenshot/i;

const DB_NAME = 'canvas-image-lod';
const DB_VERSION = 1;
const STORE_BLOBS = 'blobs';
const STORE_META = 'meta';

export interface LodSettings {
	enabled: boolean;
	tiers: number[];
	qualityFactor: number;
	minSourceWidth: number;
	maxCacheMB: number;
	maxMemoryMB: number;
	prewarm: boolean;
	concurrency: number;
	proxyGifs: boolean;
	fastRasterWhileMoving: boolean;
	quality: number;
	showStatusBar: boolean;
	debug: boolean;
}

export function getLodSettings(plugin: KambasPlugin): LodSettings {
	const s = plugin.settings;
	return {
		enabled: s.enableLod ?? true,
		tiers: s.lodTiers ?? [128, 320, 768, 1600],
		qualityFactor: s.lodQualityFactor ?? 1.15,
		minSourceWidth: s.lodMinSourceWidth ?? 900,
		maxCacheMB: s.lodMaxCacheMB ?? 300,
		maxMemoryMB: s.lodMaxMemoryMB ?? 96,
		prewarm: s.lodPrewarm ?? true,
		concurrency: s.lodConcurrency ?? 2,
		proxyGifs: s.lodProxyGifs ?? true,
		fastRasterWhileMoving: s.lodFastRasterWhileMoving ?? false,
		quality: s.lodQuality ?? 0.82,
		showStatusBar: s.lodShowStatusBar ?? true,
		debug: s.debug ?? false,
	};
}

export const EMBEDDED_BLOB_MAP = new Map<string, string>();
export const RAW_BASE64_REGISTRY = new Map<string, string>();

/* ---------------------------------------------------------------- helpers */

export function fnv1a(str: string): string {
	let h = 0x811c9dc5;
	for (let i = 0; i < str.length; i++) {
		h ^= str.charCodeAt(i);
		h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
	}
	return h.toString(16).padStart(8, '0');
}

export function srcKey(src: string): string {
	if (!src) return 'empty';
	if (src.startsWith('data:image/')) {
		const len = src.length;
		if (len > 512) {
			const sample = src.slice(0, 256) + '_' + len + '_' + src.slice(len - 256);
			return 'b64_' + fnv1a(sample);
		}
		return 'b64_' + fnv1a(src);
	}
	try {
		const u = new URL(src);
		return fnv1a(decodeURIComponent(u.pathname) + u.search);
	} catch {
		return fnv1a(src);
	}
}

export function isProxyable(src: string, settings: LodSettings): boolean {
	if (!src) return false;
	if (src.startsWith('data:image/')) {
		if (src.startsWith('data:image/svg+xml')) return false;
		if (src.startsWith('data:image/gif')) return settings.proxyGifs;
		return true;
	}
	if (src.startsWith('blob:')) return false;
	let path = src;
	try {
		path = new URL(src).pathname;
	} catch {
		/* relative path */
	}
	if (RASTER_RE.test(path)) return true;
	if (settings.proxyGifs && GIF_RE.test(path)) return true;
	return false;
}

export function getOrigSrcFromImg(img: HTMLImageElement): string {
	if (img.dataset.cilOrig) {
		const orig = img.dataset.cilOrig;
		if (RAW_BASE64_REGISTRY.has(orig)) {
			return RAW_BASE64_REGISTRY.get(orig)!;
		}
		return orig;
	}
	const key = img.dataset.cilKey;
	if (key && RAW_BASE64_REGISTRY.has(key)) {
		return RAW_BASE64_REGISTRY.get(key)!;
	}
	const src = img.getAttribute('src') || '';
	if (src && EMBEDDED_BLOB_MAP.has(src)) {
		const b64Key = EMBEDDED_BLOB_MAP.get(src)!;
		if (RAW_BASE64_REGISTRY.has(b64Key)) {
			return RAW_BASE64_REGISTRY.get(b64Key)!;
		}
		return b64Key;
	}
	const nodeEl = img.closest('.canvas-node') as HTMLElement | null;
	if (nodeEl) {
		const nodeUrl = nodeEl.dataset.url || nodeEl.getAttribute('data-url');
		if (nodeUrl && nodeUrl.startsWith('data:image/')) return nodeUrl;
	}
	return src;
}

export class Semaphore {
	private free: number;
	private queue: Array<() => void> = [];

	constructor(n: number) {
		this.free = n;
	}

	async run<T>(fn: () => Promise<T>): Promise<T> {
		if (this.free > 0) {
			this.free--;
		} else {
			await new Promise<void>((res) => this.queue.push(res));
		}
		try {
			return await fn();
		} finally {
			const next = this.queue.shift();
			if (next) next();
			else this.free++;
		}
	}
}

/* ------------------------------------------------------ persistent storage */

export class ProxyStore {
	private plugin: KambasPlugin;
	private dbPromise: Promise<IDBDatabase> | null = null;
	public available = typeof indexedDB !== 'undefined';

	constructor(plugin: KambasPlugin) {
		this.plugin = plugin;
	}

	open(): Promise<IDBDatabase> {
		if (!this.available) return Promise.reject(new Error('IndexedDB unavailable'));
		if (!this.dbPromise) {
			this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
				const req = indexedDB.open(DB_NAME, DB_VERSION);
				req.onupgradeneeded = () => {
					const db = req.result;
					if (!db.objectStoreNames.contains(STORE_BLOBS)) {
						db.createObjectStore(STORE_BLOBS, { keyPath: 'key' });
					}
					if (!db.objectStoreNames.contains(STORE_META)) {
						const meta = db.createObjectStore(STORE_META, { keyPath: 'key' });
						meta.createIndex('used', 'used');
					}
				};
				req.onsuccess = () => resolve(req.result);
				req.onerror = () => reject(req.error);
				req.onblocked = () => reject(new Error('IndexedDB blocked'));
			}).catch((e) => {
				this.available = false;
				throw e;
			});
		}
		return this.dbPromise;
	}

	async get(key: string): Promise<Blob | null> {
		const db = await this.open();
		return new Promise((res, rej) => {
			const t = db.transaction(STORE_BLOBS, 'readonly');
			const r = t.objectStore(STORE_BLOBS).get(key);
			r.onsuccess = () => res(r.result ? (r.result.blob as Blob) : null);
			r.onerror = () => rej(r.error);
		});
	}

	async put(key: string, tier: number, blob: Blob): Promise<void> {
		const db = await this.open();
		return new Promise((res, rej) => {
			const t = db.transaction([STORE_BLOBS, STORE_META], 'readwrite');
			t.objectStore(STORE_BLOBS).put({ key, blob });
			t.objectStore(STORE_META).put({ key, tier, size: blob.size, used: Date.now() });
			t.oncomplete = () => res();
			t.onerror = () => rej(t.error);
			t.onabort = () => rej(t.error);
		});
	}

	async touch(keys: string[]): Promise<void> {
		if (!keys.length) return;
		const db = await this.open();
		return new Promise((res) => {
			const t = db.transaction(STORE_META, 'readwrite');
			const store = t.objectStore(STORE_META);
			const now = Date.now();
			for (const key of keys) {
				const r = store.get(key);
				r.onsuccess = () => {
					if (r.result) store.put(Object.assign(r.result, { used: now }));
				};
			}
			t.oncomplete = () => res();
			t.onerror = () => res();
			t.onabort = () => res();
		});
	}

	async allMeta(): Promise<Array<{ key: string; tier: number; size: number; used: number }>> {
		const db = await this.open();
		return new Promise((res, rej) => {
			const out: Array<{ key: string; tier: number; size: number; used: number }> = [];
			const t = db.transaction(STORE_META, 'readonly');
			const cur = t.objectStore(STORE_META).openCursor();
			cur.onsuccess = () => {
				const c = cur.result;
				if (!c) {
					res(out);
					return;
				}
				out.push(c.value as { key: string; tier: number; size: number; used: number });
				c.continue();
			};
			cur.onerror = () => rej(cur.error);
		});
	}

	async remove(keys: string[]): Promise<void> {
		if (!keys.length) return;
		const db = await this.open();
		return new Promise((res, rej) => {
			const t = db.transaction([STORE_BLOBS, STORE_META], 'readwrite');
			const blobs = t.objectStore(STORE_BLOBS);
			const meta = t.objectStore(STORE_META);
			for (const k of keys) {
				blobs.delete(k);
				meta.delete(k);
			}
			t.oncomplete = () => res();
			t.onerror = () => rej(t.error);
			t.onabort = () => rej(t.error);
		});
	}

	async sizeBytes(): Promise<number> {
		try {
			const meta = await this.allMeta();
			return meta.reduce((n, m) => n + (m.size || 0), 0);
		} catch {
			return 0;
		}
	}

	async prune(): Promise<number> {
		try {
			const s = getLodSettings(this.plugin);
			const limit = s.maxCacheMB * 1024 * 1024;
			const meta = await this.allMeta();
			let total = meta.reduce((n, m) => n + (m.size || 0), 0);
			if (total <= limit) return 0;
			meta.sort((a, b) => (a.used || 0) - (b.used || 0));
			const doomed: string[] = [];
			for (const m of meta) {
				if (total <= limit) break;
				doomed.push(m.key);
				total -= m.size || 0;
			}
			await this.remove(doomed);
			return doomed.length;
		} catch (e) {
			if (getLodSettings(this.plugin).debug) console.error('[canvas-image-lod] prune', e);
			return 0;
		}
	}

	async clear(): Promise<void> {
		try {
			const db = await this.open();
			await new Promise<void>((res, rej) => {
				const t = db.transaction([STORE_BLOBS, STORE_META], 'readwrite');
				t.objectStore(STORE_BLOBS).clear();
				t.objectStore(STORE_META).clear();
				t.oncomplete = () => res();
				t.onerror = () => rej(t.error);
			});
		} catch {
			/* nothing to clear */
		}
	}
}

/* ------------------------------------------------------------ memory cache */

export class MemoryCache {
	private plugin: KambasPlugin;
	public entries = new Map<string, { url: string; size: number; used: number }>();
	public bytes = 0;
	private tick = 0;

	constructor(plugin: KambasPlugin) {
		this.plugin = plugin;
	}

	get(key: string): { url: string; size: number; used: number } | null {
		const e = this.entries.get(key);
		if (e) e.used = ++this.tick;
		return e || null;
	}

	has(key: string): boolean {
		return this.entries.has(key);
	}

	set(key: string, blob: Blob): string {
		const existing = this.entries.get(key);
		if (existing) {
			URL.revokeObjectURL(existing.url);
			this.bytes -= existing.size;
		}
		const url = URL.createObjectURL(blob);
		this.entries.set(key, { url, size: blob.size, used: ++this.tick });
		this.bytes += blob.size;
		return url;
	}

	evict(pinnedUrls: Set<string>): number {
		const s = getLodSettings(this.plugin);
		const limit = s.maxMemoryMB * 1024 * 1024;
		if (this.bytes <= limit) return 0;
		const candidates = Array.from(this.entries.entries())
			.filter(([, e]) => !pinnedUrls.has(e.url))
			.sort((a, b) => a[1].used - b[1].used);
		let dropped = 0;
		for (const [key, e] of candidates) {
			if (this.bytes <= limit) break;
			URL.revokeObjectURL(e.url);
			this.entries.delete(key);
			this.bytes -= e.size;
			dropped++;
		}
		return dropped;
	}

	clear(): void {
		for (const e of this.entries.values()) URL.revokeObjectURL(e.url);
		this.entries.clear();
		this.bytes = 0;
	}
}

/* -------------------------------------------------------------- proxy cache */

export class ProxyCache {
	public plugin: KambasPlugin;
	public app: App;
	public store: ProxyStore;
	public mem: MemoryCache;
	public inflight = new Map<string, Promise<void>>();
	public failed = new Set<string>();
	public noProxy = new Set<string>();
	public natWidths = new Map<string, number>();
	public sem: Semaphore;
	public stats = { generated: 0, restored: 0, failed: 0, pending: 0 };
	public touchQueue = new Set<string>();

	constructor(plugin: KambasPlugin) {
		this.plugin = plugin;
		this.app = plugin.app;
		this.store = new ProxyStore(plugin);
		this.mem = new MemoryCache(plugin);
		const s = getLodSettings(plugin);
		this.sem = new Semaphore(s.concurrency);
	}

	getNaturalWidth(src: string): number | undefined {
		if (!src) return undefined;
		const k = srcKey(src);
		return this.natWidths.get(k) ?? this.natWidths.get(src);
	}

	peekBest(src: string, tier: number): { url: string; tier: number } | null {
		const k = srcKey(src);
		const s = getLodSettings(this.plugin);
		for (const t of s.tiers) {
			if (t < tier) continue;
			const e = this.mem.get(`${k}_${t}`);
			if (e) {
				this.touchQueue.add(`${k}_${t}`);
				return { url: e.url, tier: t };
			}
		}
		return null;
	}

	hasTierInMemory(src: string, targetTier?: number): boolean {
		const k = srcKey(src);
		const s = getLodSettings(this.plugin);
		const reqTier = targetTier ?? 128;
		return s.tiers.some((t) => t >= reqTier && this.mem.has(`${k}_${t}`));
	}

	request(src: string, targetTier?: number): Promise<void> | null {
		const s = getLodSettings(this.plugin);
		if (!s.enabled) return null;
		const k = srcKey(src);
		if (this.failed.has(k) || this.noProxy.has(k)) return null;
		if (this.inflight.has(k)) return this.inflight.get(k) || null;
		if (this.hasTierInMemory(src, targetTier)) return null;

		this.stats.pending++;
		this.plugin.updateStatus();

		const task = this.sem
			.run(() => this._prepare(src, k))
			.catch((err) => {
				this.failed.add(k);
				this.stats.failed++;
				if (getLodSettings(this.plugin).debug) console.error('[canvas-image-lod]', src, err);
			})
			.finally(() => {
				this.inflight.delete(k);
				this.stats.pending--;
				this.evictMemory();
				this.plugin.updateStatus();
				this.plugin.scheduleSyncAll();
			});

		this.inflight.set(k, task);
		return task;
	}

	private async _prepare(src: string, k: string): Promise<void> {
		if (await this._hydrate(k)) {
			this.stats.restored++;
			return;
		}
		await this._generate(src, k);
		this.stats.generated++;
	}

	private async _hydrate(k: string): Promise<boolean> {
		if (!this.store.available) return false;
		let loaded = 0;
		const s = getLodSettings(this.plugin);
		for (const t of s.tiers) {
			const key = `${k}_${t}`;
			try {
				const blob = await this.store.get(key);
				if (!blob) continue;
				this.mem.set(key, blob);
				loaded++;
			} catch {
				return loaded > 0;
			}
		}
		return loaded > 0;
	}

	resolveFile(src: string): TFile | null {
		try {
			const u = new URL(src);
			let p = decodeURIComponent(u.pathname);
			if (/^\/[A-Za-z]:/.test(p)) p = p.slice(1);
			const adapter = this.app.vault.adapter as any;
			const base = adapter.getBasePath && adapter.getBasePath();
			if (!base) return null;
			const nb = base.replace(/\\/g, '/');
			if (p.toLowerCase().startsWith(nb.toLowerCase() + '/')) {
				const rel = normalizePath(p.slice(nb.length + 1));
				const f = this.app.vault.getAbstractFileByPath(rel);
				if (f instanceof TFile) return f;
			}
		} catch {
			/* external URL or unusual path */
		}
		return null;
	}

	private async _readBlob(src: string): Promise<Blob> {
		if (RAW_BASE64_REGISTRY.has(src)) {
			src = RAW_BASE64_REGISTRY.get(src)!;
		}

		if (src.startsWith('data:image/')) {
			const commaIdx = src.indexOf(',');
			if (commaIdx !== -1) {
				const header = src.slice(0, commaIdx);
				const base64Str = src.slice(commaIdx + 1);
				const mimeMatch = header.match(/data:(image\/[^;]+)/);
				const mime = mimeMatch ? mimeMatch[1] : 'image/png';
				const binaryStr = atob(base64Str);
				const len = binaryStr.length;
				const bytes = new Uint8Array(len);
				for (let i = 0; i < len; i++) {
					bytes[i] = binaryStr.charCodeAt(i);
				}
				return new Blob([bytes], { type: mime });
			}
		}

		const file = this.resolveFile(src);
		if (file) {
			const buf = await this.app.vault.readBinary(file);
			const ext = (file.extension || '').toLowerCase();
			const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext || 'png'}`;
			return new Blob([buf], { type: mime });
		}
		const resp = await fetch(src);
		if (!resp.ok) throw new Error(`fetch ${resp.status}`);
		return await resp.blob();
	}

	private async _generate(src: string, k: string): Promise<void> {
		const blob = await this._readBlob(src);
		let bmp: ImageBitmap | HTMLCanvasElement | OffscreenCanvas | null = null;
		const isGifBlob =
			(blob.type && blob.type.includes('gif')) ||
			src.startsWith('data:image/gif') ||
			/\.gif($|\?)/i.test(src);

		try {
			if (isGifBlob && typeof ImageDecoder !== 'undefined') {
				let frame0VideoFrame: VideoFrame | null = null;
				try {
					const arrayBuf = await blob.arrayBuffer();
					const dec = new ImageDecoder({ data: arrayBuf, type: 'image/gif' });
					await dec.tracks.ready;
					const frameRes = await dec.decode({ frameIndex: 0 });
					frame0VideoFrame = frameRes.image;
					const w = frame0VideoFrame.displayWidth || 300;
					const h = frame0VideoFrame.displayHeight || 300;
					const frameCanvas = this._makeCanvas(w, h);
					const ctx = frameCanvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
					if (ctx) {
						ctx.drawImage(frame0VideoFrame as unknown as CanvasImageSource, 0, 0);
					}
					bmp = frameCanvas;
					dec.close();
				} catch (e) {
					if (getLodSettings(this.plugin).debug) console.warn('[canvas-image-lod] ImageDecoder fallback for GIF:', e);
				} finally {
					if (frame0VideoFrame) {
						try {
							frame0VideoFrame.close();
						} catch (_) {
							/* ignore */
						}
					}
				}
			}

			if (!bmp) {
				bmp = await createImageBitmap(blob);
			}

			const natW = bmp.width;
			const natH = bmp.height;
			this.natWidths.set(k, natW);
			this.natWidths.set(src, natW);
			const s = getLodSettings(this.plugin);

			if (natW < s.minSourceWidth) {
				this.noProxy.add(k);
				return;
			}

			const tiers = s.tiers
				.filter((t) => t < natW * 0.9)
				.sort((a, b) => b - a);

			if (!tiers.length) {
				this.noProxy.add(k);
				return;
			}

			let source: ImageBitmap | HTMLCanvasElement | OffscreenCanvas = bmp;
			for (const t of tiers) {
				const h = Math.max(1, Math.round(natH * (t / natW)));
				const canvas = this._makeCanvas(t, h);
				const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
				if (ctx) {
					ctx.imageSmoothingEnabled = true;
					ctx.imageSmoothingQuality = 'high';
					ctx.drawImage(source as CanvasImageSource, 0, 0, t, h);
				}

				const out = await this._toBlob(canvas);
				const key = `${k}_${t}`;
				this.mem.set(key, out);
				if (this.store.available) {
					this.store.put(key, t, out).catch(() => {});
				}
				if (source !== bmp && 'width' in source) {
					(source as any).width = 0;
					(source as any).height = 0;
				}
				source = canvas;
			}
			if (source !== bmp && 'width' in source) {
				(source as any).width = 0;
				(source as any).height = 0;
			}
		} finally {
			if (bmp) {
				if ('close' in bmp && typeof (bmp as ImageBitmap).close === 'function') {
					try {
						(bmp as ImageBitmap).close();
					} catch {
						/* ignore */
					}
				} else if ('width' in bmp) {
					(bmp as any).width = 0;
					(bmp as any).height = 0;
				}
			}
		}
	}

	private _makeCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
		if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
		const c = document.createElement('canvas');
		c.width = w;
		c.height = h;
		return c;
	}

	private async _toBlob(canvas: HTMLCanvasElement | OffscreenCanvas): Promise<Blob> {
		const q = getLodSettings(this.plugin).quality;
		const encode = (type: string): Promise<Blob> => {
			if ('convertToBlob' in canvas) {
				return (canvas as OffscreenCanvas).convertToBlob({ type, quality: q });
			}
			return new Promise((res, rej) => {
				(canvas as HTMLCanvasElement).toBlob(
					(b) => (b ? res(b) : rej(new Error('toBlob failed'))),
					type,
					q
				);
			});
		};

		const out = await encode('image/webp');
		if (out.type === 'image/webp') return out;
		try {
			return await encode('image/jpeg');
		} catch {
			return out;
		}
	}

	async flushTouches(): Promise<void> {
		if (!this.touchQueue.size || !this.store.available) return;
		const keys = Array.from(this.touchQueue);
		this.touchQueue.clear();
		try {
			await this.store.touch(keys);
		} catch {
			/* bookkeeping only */
		}
	}

	evictMemory(): number {
		return this.mem.evict(this.plugin.collectPinnedUrls());
	}

	async clear(): Promise<void> {
		this.mem.clear();
		this.failed.clear();
		this.noProxy.clear();
		this.touchQueue.clear();
		this.stats = { generated: 0, restored: 0, failed: 0, pending: 0 };
		await this.store.clear();
	}

	dispose(): void {
		this.mem.clear();
	}
}

/* ------------------------------------------------- one canvas view binding */

export class CanvasBinder {
	public plugin: KambasPlugin;
	public view: any;
	public wrapperEl: HTMLElement | null = null;
	public canvasEl: HTMLElement | null = null;
	public lastScale = -1;
	public dirty = true;
	public moving = false;
	public suspended = false;
	public moveTimer: number | null = null;
	public resumeTimer: number | null = null;
	public rafId = 0;
	public deferredUpgrade = false;
	public widths = new WeakMap<HTMLImageElement, number>();
	public cleanups: Array<() => void> = [];
	public zoomSettleTimer: number | null = null;
	private mo: MutationObserver | null = null;
	private ro: ResizeObserver | null = null;
	private _moveOff: (() => void) | null = null;

	constructor(plugin: KambasPlugin, view: any) {
		this.plugin = plugin;
		this.view = view;
	}

	start(): boolean {
		const root = this.view && this.view.contentEl;
		if (!root || typeof root.querySelector !== 'function') return false;
		this.wrapperEl = root.querySelector('.canvas-wrapper');
		this.canvasEl = root.querySelector('.canvas-wrapper .canvas') || root.querySelector('.canvas');
		if (!this.canvasEl) return false;

		this.attachMoveListeners();
		this.cleanups.push(() => {
			if (this._moveOff) this._moveOff();
		});

		this.mo = new MutationObserver(() => {
			this.dirty = true;
			this.schedule();
		});
		this.mo.observe(this.canvasEl, { childList: true, subtree: true });
		this.cleanups.push(() => this.mo?.disconnect());

		if (typeof ResizeObserver !== 'undefined') {
			this.ro = new ResizeObserver((entries) => {
				for (const e of entries) {
					if (e.target instanceof HTMLImageElement) {
						this.widths.set(e.target, e.target.offsetWidth);
					}
				}
				this.dirty = true;
				this.schedule();
			});
			this.cleanups.push(() => this.ro?.disconnect());
		}

		if (getLodSettings(this.plugin).prewarm) this.prewarm();
		this.schedule();
		return true;
	}

	stop(): void {
		for (const fn of this.cleanups) {
			try {
				fn();
			} catch {
				/* nothing */
			}
		}
		this.cleanups = [];
		if (this.rafId) cancelAnimationFrame(this.rafId);
		if (this.moveTimer) window.clearTimeout(this.moveTimer);
		if (this.resumeTimer) window.clearTimeout(this.resumeTimer);
		if (this.zoomSettleTimer) window.clearTimeout(this.zoomSettleTimer);
		this.restoreAll();
	}

	attachMoveListeners(): void {
		if (this._moveOff) this._moveOff();
		const target = this.wrapperEl || this.canvasEl;
		if (!target || typeof target.addEventListener !== 'function') return;
		const onMove = () => this.markMoving();
		const onTransitionEnd = () => {
			this.dirty = true;
			this.schedule();
			if (this.zoomSettleTimer) window.clearTimeout(this.zoomSettleTimer);
			this.zoomSettleTimer = window.setTimeout(() => this.sync(true), 150);
		};
		const evs = ['wheel', 'pointerdown', 'touchstart', 'keydown'];
		for (const ev of evs) target.addEventListener(ev, onMove, { passive: true, capture: true });
		target.addEventListener('transitionend', onTransitionEnd, { passive: true, capture: true });
		target.addEventListener('animationend', onTransitionEnd, { passive: true, capture: true });

		this._moveOff = () => {
			for (const ev of evs) target.removeEventListener(ev, onMove, { capture: true });
			target.removeEventListener('transitionend', onTransitionEnd, { capture: true });
			target.removeEventListener('animationend', onTransitionEnd, { capture: true });
			this._moveOff = null;
		};
	}

	revalidate(): boolean {
		if (this.canvasEl && (this.canvasEl as any).isConnected !== false) return true;
		const root = this.view && this.view.contentEl;
		if (!root || typeof root.querySelector !== 'function') return false;
		const canvas = root.querySelector('.canvas-wrapper .canvas') || root.querySelector('.canvas');
		if (!canvas) return false;
		this.wrapperEl = root.querySelector('.canvas-wrapper') || this.wrapperEl;
		this.canvasEl = canvas;
		if (this.mo) {
			this.mo.disconnect();
			this.mo.observe(this.canvasEl, { childList: true, subtree: true });
		}
		this.attachMoveListeners();
		this.widths = new WeakMap();
		this.dirty = true;
		return true;
	}

	reconcile(): void {
		if (this.suspended || this.moving) return this.schedule();
		if (!this.canvasEl || (this.canvasEl as any).isConnected === false) {
			if (!this.revalidate()) return;
		}
		if (!this.hasProxies()) return this.schedule();
		this.deferredUpgrade = false;
		this.sync(true);
	}

	markMoving(): void {
		if (this.suspended) this.resume();
		this.moving = true;
		const s = getLodSettings(this.plugin);
		if (s.fastRasterWhileMoving && this.wrapperEl) {
			this.wrapperEl.classList.add('cil-fast');
		}
		if (this.moveTimer) window.clearTimeout(this.moveTimer);
		this.moveTimer = window.setTimeout(() => {
			this.moving = false;
			if (this.wrapperEl) this.wrapperEl.classList.remove('cil-fast');
			if (this.deferredUpgrade) {
				this.deferredUpgrade = false;
				this.sync(true);
			}
			this.plugin.cache.flushTouches();
			this.plugin.cache.evictMemory();
		}, 200);
		this.schedule();
	}

	suspend(): void {
		this.suspended = true;
		this.restoreAll();
		if (this.resumeTimer) window.clearTimeout(this.resumeTimer);
		this.resumeTimer = window.setTimeout(() => this.resume(), 120000);
	}

	resume(): void {
		if (!this.suspended) return;
		this.suspended = false;
		if (this.resumeTimer) window.clearTimeout(this.resumeTimer);
		this.dirty = true;
		this.schedule();
	}

	hasProxies(): boolean {
		if (!this.canvasEl) return false;
		return this.canvasEl.querySelector('img[data-cil-tier]') !== null;
	}

	waitForImages(timeoutMs?: number): Promise<void> {
		if (!this.canvasEl) return Promise.resolve();
		const pending = Array.from(this.canvasEl.querySelectorAll('img')).filter((img) => !img.complete);
		if (!pending.length) return Promise.resolve();
		const loaded = Promise.all(
			pending.map(
				(img) =>
					new Promise<void>((res) => {
						const done = () => {
							img.removeEventListener('load', done);
							img.removeEventListener('error', done);
							res();
						};
						img.addEventListener('load', done);
						img.addEventListener('error', done);
					})
			)
		);
		return Promise.race([
			loaded.then(() => {}),
			new Promise<void>((res) => window.setTimeout(res, timeoutMs || 8000)),
		]);
	}

	schedule(): void {
		if (this.rafId) return;
		this.rafId = requestAnimationFrame(() => {
			this.rafId = 0;
			this.sync(false);
		});
	}

	readScale(): number {
		if (this.view && this.view.canvas && typeof this.view.canvas.zoom === 'number' && this.view.canvas.zoom > 0) {
			return this.view.canvas.zoom;
		}
		if (!this.canvasEl) return 1;
		const stop = this.wrapperEl ? this.wrapperEl.parentElement : null;
		let el: HTMLElement | null = this.canvasEl;
		for (let depth = 0; el && el !== stop && depth < 6; el = el.parentElement, depth++) {
			let t: string;
			try {
				t = getComputedStyle(el).transform;
			} catch {
				break;
			}
			if (!t || t === 'none') continue;
			try {
				const m = new DOMMatrixReadOnly(t);
				const a = Math.sqrt(m.a * m.a + m.b * m.b) || m.a;
				if (a) return a;
			} catch {
				/* not a matrix we understand */
			}
		}
		return 1;
	}

	widthOf(img: HTMLImageElement): number {
		const swapped = !!img.dataset.cilTier;
		let w = this.widths.get(img);
		if (!swapped || w === undefined || w === 0) {
			const m = img.offsetWidth || (img.parentElement && img.parentElement.offsetWidth) || 0;
			if (m) {
				w = m;
				this.widths.set(img, m);
				if (this.ro) this.ro.observe(img);
			}
		}
		return w || 0;
	}

	sync(force?: boolean): void {
		const s = getLodSettings(this.plugin);
		if (!s.enabled || this.suspended) return;
		if (!this.canvasEl || (this.canvasEl as any).isConnected === false) {
			if (!this.revalidate()) return;
		}

		const scale = this.readScale();
		if (Math.abs(scale - this.lastScale) > 0.005) {
			if (this.zoomSettleTimer) window.clearTimeout(this.zoomSettleTimer);
			this.zoomSettleTimer = window.setTimeout(() => {
				this.sync(true);
			}, 250);
		}
		if (!force && !this.dirty && Math.abs(scale - this.lastScale) < 1e-4) return;
		this.lastScale = scale;
		this.dirty = false;

		const dpr = window.devicePixelRatio || 1;
		const imgs = this.canvasEl.querySelectorAll('img');

		const containerRect = this.wrapperEl
			? this.wrapperEl.getBoundingClientRect()
			: this.canvasEl.getBoundingClientRect();
		const marginW = containerRect.width || 1200;
		const marginH = containerRect.height || 800;
		const viewMinX = containerRect.left - marginW;
		const viewMaxX = containerRect.right + marginW;
		const viewMinY = containerRect.top - marginH;
		const viewMaxY = containerRect.bottom + marginH;

		const plan: Array<{
			img: HTMLImageElement;
			orig: string;
			nat: number;
			tier: number | null;
		}> = [];

		for (const img of Array.from(imgs)) {
			const orig = getOrigSrcFromImg(img as HTMLImageElement);
			if (!orig || !isProxyable(orig, s)) continue;

			const htmlImg = img as HTMLImageElement;
			const imgRect = htmlImg.getBoundingClientRect();
			const isNearView =
				imgRect.right >= viewMinX &&
				imgRect.left <= viewMaxX &&
				imgRect.bottom >= viewMinY &&
				imgRect.top <= viewMaxY;

			let nat = 0;
			if (htmlImg.dataset.cilNat) {
				nat = Number(htmlImg.dataset.cilNat);
			} else {
				const knownNat = this.plugin.cache.getNaturalWidth(orig);
				if (knownNat) {
					nat = knownNat;
					htmlImg.dataset.cilNat = String(nat);
				} else if (!htmlImg.dataset.cilTier && htmlImg.naturalWidth > 0) {
					nat = htmlImg.naturalWidth;
					htmlImg.dataset.cilNat = String(nat);
				} else if (orig) {
					this.plugin.cache.request(orig);
				}
			}

			if (!isNearView) {
				// Off-screen image: if un-proxied, assign lowest tier (128px) to conserve RAM
				if (!htmlImg.dataset.cilTier) {
					const lowestTier = s.tiers[0] || 128;
					const best = this.plugin.cache.peekBest(orig, lowestTier);
					if (best) {
						if (!htmlImg.dataset.cilOrig) htmlImg.dataset.cilOrig = orig;
						if (nat > 0) htmlImg.dataset.cilNat = String(nat);
						htmlImg.dataset.cilTier = String(best.tier);
						htmlImg.src = best.url;
					} else {
						this.plugin.cache.request(orig, lowestTier);
					}
				}
				continue;
			}

			if (!nat) {
				this.dirty = true;
				continue;
			}
			if (nat < s.minSourceWidth) continue;

			const layoutW = this.widthOf(htmlImg);
			if (!layoutW) {
				this.dirty = true;
				continue;
			}

			const need = layoutW * scale * dpr * s.qualityFactor;
			let tier: number | null = null;
			if (need < nat * 0.9) {
				const found = s.tiers.find((t) => t >= need);
				tier = found === undefined ? null : found;
			}

			plan.push({ img: htmlImg, orig, nat, tier });
		}

		let swapped = 0;
		for (const item of plan) {
			const cur = item.img.dataset.cilTier ? Number(item.img.dataset.cilTier) : 0;

			if (item.tier === null) {
				let fullResUrl = item.orig;
				if (item.orig.startsWith('data:image/') && this.plugin.canvasImageHandler) {
					fullResUrl = this.plugin.canvasImageHandler.getOrCreateBlobUrl(item.orig);
				}
				if (cur !== 0 || item.img.src !== fullResUrl) {
					if (this.moving) {
						this.deferredUpgrade = true;
						continue;
					}
					if (item.img.src !== fullResUrl) {
						item.img.src = fullResUrl;
						swapped++;
					}
					delete item.img.dataset.cilTier;
				}
				continue;
			}

			if (cur === item.tier) continue;
			if (cur !== 0 && item.tier > cur && this.moving) {
				this.deferredUpgrade = true;
				continue;
			}

			const best = this.plugin.cache.peekBest(item.orig, item.tier);
			if (!best) {
				this.plugin.cache.request(item.orig, item.tier);
				continue;
			}
			if (!item.img.dataset.cilOrig) item.img.dataset.cilOrig = item.orig;
			item.img.dataset.cilNat = String(item.nat);
			item.img.dataset.cilTier = String(best.tier);
			item.img.src = best.url;
			swapped++;
		}

		if (swapped && s.debug) {
			console.log(`[canvas-image-lod] scale=${scale.toFixed(3)} swapped=${swapped}`);
		}
		this.plugin.updateStatus();
	}

	restoreAll(): void {
		if (!this.canvasEl) return;
		for (const img of Array.from(this.canvasEl.querySelectorAll('img[data-cil-orig]'))) {
			const htmlImg = img as HTMLImageElement;
			if (htmlImg.dataset.cilOrig) {
				htmlImg.src = htmlImg.dataset.cilOrig;
				delete htmlImg.dataset.cilOrig;
				delete htmlImg.dataset.cilTier;
				delete htmlImg.dataset.cilNat;
			}
		}
	}

	async prewarm(): Promise<void> {
		const file = this.view && this.view.file;
		if (!file) return;
		try {
			const data = JSON.parse(await this.plugin.app.vault.cachedRead(file));
			const s = getLodSettings(this.plugin);
			for (const node of data.nodes || []) {
				if (node.type === 'file' && node.file) {
					if (!RASTER_RE.test(node.file) && !(s.proxyGifs && GIF_RE.test(node.file))) continue;
					const tf = this.plugin.app.vault.getAbstractFileByPath(normalizePath(node.file));
					if (!(tf instanceof TFile)) continue;
					this.plugin.cache.request(this.plugin.app.vault.getResourcePath(tf));
				} else if (node.type === 'link' && node.url && node.url.startsWith('data:image/')) {
					if (isProxyable(node.url, s)) {
						this.plugin.cache.request(node.url);
					}
				}
			}
		} catch (e) {
			if (getLodSettings(this.plugin).debug) console.error('[canvas-image-lod] prewarm', e);
		}
	}
}
