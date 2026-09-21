import { App, Notice, TFile, requestUrl } from 'obsidian';

import { getText } from '../i18n';
import { CanvasGifDecoder } from './CanvasGifDecoder';
import { getOrigSrcFromImg } from './CanvasImageLOD';
import { CanvasElement } from './CanvasTypes';

import {
	arrayBufferToBase64DataUrl,
	saveFileToVault,
} from '../utils/imageUtils';
import { CanvasGifToolbar } from '../views/CanvasGifToolbar';

export interface ActiveGifSession {
	nodeId: string;
	nodeEl: HTMLElement;
	imgEl: HTMLImageElement;
	canvasEl: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
	decoder: CanvasGifDecoder;
	isPlaying: boolean;
	currentFrame: number;
	speed: number;
	animFrameId: number | null;
	lastFrameTime: number;
	loopId: number;
	isDisposed: boolean;
	file?: TFile;
	unknownData?: {
		kambasGifPaused?: boolean;
		kambasGifFrame?: number;
		kambasGifSpeed?: number;
	};
}

export class CanvasGifHandler {
	private activeSessions: Map<string, ActiveGifSession> = new Map();
	private pendingSessions: Set<string> = new Set();
	private canceledSessions: Set<string> = new Set();
	private activeToolbar: CanvasGifToolbar | null = null;
	private activeToolbarNodeIds: string[] = [];
	private lastKnownState: Map<
		string,
		{ isPaused: boolean; frame: number; speed: number }
	> = new Map();

	constructor(
		private app: App,
		private plugin: import('../main').default
	) {}

	public saveNodeGifState(
		canvas: CanvasElement | undefined,
		nodeId: string,
		isPaused: boolean,
		frameIndex: number,
		speed?: number
	): void {
		const currentSaved = this.lastKnownState.get(nodeId);
		this.lastKnownState.set(nodeId, {
			isPaused,
			frame: frameIndex,
			speed: speed !== undefined ? speed : (currentSaved?.speed ?? 1.0),
		});

		if (!canvas) return;

		const canvasNode = canvas.nodes?.get(nodeId);
		if (!canvasNode) return;

		const rawN = canvasNode as unknown as {
			id?: string;
			kambasGifPaused?: boolean;
			kambasGifFrame?: number;
			kambasGifSpeed?: number;
			unknownData?: {
				kambasGifPaused?: boolean;
				kambasGifFrame?: number;
				kambasGifSpeed?: number;
			};
		};

		if (!rawN.unknownData) rawN.unknownData = {};
		rawN.unknownData.kambasGifPaused = isPaused;
		rawN.unknownData.kambasGifFrame = frameIndex;
		rawN.kambasGifPaused = isPaused;
		rawN.kambasGifFrame = frameIndex;

		if (speed !== undefined) {
			rawN.unknownData.kambasGifSpeed = speed;
			rawN.kambasGifSpeed = speed;
		}

		const rawCanvas = canvas as unknown as {
			data?: {
				nodes?: Array<{
					id?: string;
					kambasGifPaused?: boolean;
					kambasGifFrame?: number;
					kambasGifSpeed?: number;
				}>;
			};
			requestSave?: () => void;
		};

		const canvasDataNode = rawCanvas.data?.nodes?.find((n) => n.id === nodeId);
		if (canvasDataNode) {
			const cdn = canvasDataNode as unknown as {
				kambasGifPaused?: boolean;
				kambasGifFrame?: number;
				kambasGifSpeed?: number;
				unknownData?: {
					kambasGifPaused?: boolean;
					kambasGifFrame?: number;
					kambasGifSpeed?: number;
				};
			};
			if (!cdn.unknownData) cdn.unknownData = {};
			cdn.unknownData.kambasGifPaused = isPaused;
			cdn.unknownData.kambasGifFrame = frameIndex;
			cdn.kambasGifPaused = isPaused;
			cdn.kambasGifFrame = frameIndex;
			if (speed !== undefined) {
				cdn.unknownData.kambasGifSpeed = speed;
				cdn.kambasGifSpeed = speed;
			}
		}

		if (typeof rawCanvas.requestSave === 'function') {
			try {
				rawCanvas.requestSave();
			} catch (_) {
				// ignore
			}
		}
	}

	public async attachGifTools(
		nodeId: string,
		nodeEl: HTMLElement,
		imgEl: HTMLImageElement,
		file?: TFile,
		canvas?: CanvasElement,
		unknownData?: {
			kambasGifPaused?: boolean;
			kambasGifFrame?: number;
			kambasGifSpeed?: number;
		},
		containerEl?: HTMLElement
	): Promise<void> {
		const existingSession = this.activeSessions.get(nodeId);

		if (existingSession && !existingSession.isDisposed) {
			existingSession.nodeEl = nodeEl;
			existingSession.imgEl = imgEl;

			if (existingSession) {
				if (!existingSession.canvasEl.isConnected && imgEl.parentElement) {
					imgEl.parentElement.appendChild(existingSession.canvasEl);
				}

				imgEl.setCssProps({ display: 'none' });

				if (existingSession.isPlaying && existingSession.animFrameId === null) {
					this.startAnimationLoop(existingSession);
				}

				if (containerEl && this.activeToolbarNodeIds.includes(nodeId)) {
					this.syncToolbar(canvas, containerEl, this.activeToolbarNodeIds);
					this.startToolbarPositionLoop(containerEl);
				}
				return;
			}
		}

		if (this.pendingSessions.has(nodeId)) {
			imgEl.setCssProps({ display: 'none' });
			return;
		}

		this.pendingSessions.add(nodeId);
		imgEl.setCssProps({ display: 'none' });

		try {
			// Read binary buffer of GIF
			let buffer: ArrayBuffer | null = null;

			if (file) {
				try {
					buffer = await this.app.vault.readBinary(file);
				} catch (err) {
					console.warn(
						'Failed to read GIF binary from vault file, trying fetch fallback:',
						err
					);
				}
			}

			if (!buffer) {
				const origSrc =
					getOrigSrcFromImg(imgEl) ||
					(
						canvas?.nodes?.get(nodeId) as unknown as {
							url?: string;
							unknownData?: { url?: string };
						}
					)?.url ||
					(
						canvas?.nodes?.get(nodeId) as unknown as {
							url?: string;
							unknownData?: { url?: string };
						}
					)?.unknownData?.url ||
					imgEl.src;

				if (origSrc) {
					try {
						if (origSrc.startsWith('data:image/')) {
							const commaIdx = origSrc.indexOf(',');
							if (commaIdx !== -1) {
								const base64Str = origSrc.slice(commaIdx + 1);
								const binaryStr = atob(base64Str);
								const len = binaryStr.length;
								const bytes = new Uint8Array(len);
								for (let i = 0; i < len; i++) {
									bytes[i] = binaryStr.charCodeAt(i);
								}
								buffer = bytes.buffer;
							}
						} else if (
							origSrc.startsWith('app://') ||
							origSrc.startsWith('http://') ||
							origSrc.startsWith('https://') ||
							origSrc.startsWith('file://')
						) {
							const res = await requestUrl({ url: origSrc });
							buffer = res.arrayBuffer;
						} else {
							const abstractFile =
								this.app.vault.getAbstractFileByPath(origSrc);
							if (abstractFile instanceof TFile) {
								buffer = await this.app.vault.readBinary(abstractFile);
							} else if (imgEl.src) {
								const res = await requestUrl({ url: imgEl.src });
								buffer = res.arrayBuffer;
							}
						}
					} catch (err) {
						console.error('Failed to fetch GIF ArrayBuffer from origSrc:', err);
						imgEl.setCssProps({ display: '' });
						return;
					}
				}
			}

			if (!buffer) {
				imgEl.setCssProps({ display: '' });
				return;
			}

			const decoder = new CanvasGifDecoder();
			const success = await decoder.init(buffer);
			if (!success || decoder.getFrameCount() === 0) {
				decoder.destroy();
				imgEl.setCssProps({ display: '' });
				return;
			}

			// RACE CONDITION & UNMOUNT CHECK: Discard decoder if detached/unmounted during async init!
			if (
				this.canceledSessions.has(nodeId) ||
				!nodeEl.isConnected ||
				!imgEl.isConnected
			) {
				this.canceledSessions.delete(nodeId);
				decoder.destroy();
				imgEl.setCssProps({ display: '' });
				return;
			}

			// Create offscreen/onscreen canvas element over imgEl
			const dimensions = decoder.getDimensions();
			const canvasEl = createEl('canvas');
			canvasEl.width = dimensions.width || imgEl.naturalWidth || 300;
			canvasEl.height = dimensions.height || imgEl.naturalHeight || 300;
			canvasEl.classList.add('kambas-gif-canvas-overlay');

			const ctx = canvasEl.getContext('2d');
			if (!ctx) {
				decoder.destroy();
				return;
			}

			// Hide imgEl and replace visually with canvasEl
			imgEl.setCssProps({ display: 'none' });
			imgEl.parentElement?.appendChild(canvasEl);

			const rawNodeObj = (canvas?.nodes?.get(nodeId) ?? {}) as unknown as {
				kambasGifPaused?: boolean;
				kambasGifFrame?: number;
				kambasGifSpeed?: number;
				unknownData?: {
					kambasGifPaused?: boolean;
					kambasGifFrame?: number;
					kambasGifSpeed?: number;
				};
			};

			const savedState = this.lastKnownState.get(nodeId);

			const isPaused = Boolean(
				savedState?.isPaused ??
				unknownData?.kambasGifPaused ??
				rawNodeObj?.unknownData?.kambasGifPaused ??
				rawNodeObj?.kambasGifPaused ??
				false
			);
			const initialFrame =
				savedState?.frame ??
				unknownData?.kambasGifFrame ??
				rawNodeObj?.unknownData?.kambasGifFrame ??
				rawNodeObj?.kambasGifFrame ??
				0;
			const initialSpeed =
				savedState?.speed ??
				unknownData?.kambasGifSpeed ??
				rawNodeObj?.unknownData?.kambasGifSpeed ??
				rawNodeObj?.kambasGifSpeed ??
				1.0;
			const clampedFrame = Math.max(
				0,
				Math.min(initialFrame, decoder.getFrameCount() - 1)
			);

			const session: ActiveGifSession = {
				nodeId,
				nodeEl,
				imgEl,
				canvasEl,
				ctx,
				decoder,
				isPlaying: !isPaused,
				currentFrame: clampedFrame,
				speed: initialSpeed,
				animFrameId: null,
				lastFrameTime: performance.now(),
				loopId: 0,
				isDisposed: false,
				file,
				unknownData,
			};

			this.activeSessions.set(nodeId, session);
			this.lastKnownState.set(nodeId, {
				isPaused,
				frame: clampedFrame,
				speed: initialSpeed,
			});

			// Render initial frame
			await this.renderFrame(session, clampedFrame);

			if (!isPaused) {
				this.startAnimationLoop(session);
			}

			// Trigger toolbar sync if this node is currently selected
			if (containerEl && this.activeToolbarNodeIds.includes(nodeId)) {
				this.syncToolbar(canvas, containerEl, this.activeToolbarNodeIds);
			}
		} finally {
			this.pendingSessions.delete(nodeId);
		}
	}

	private toolbarPositionRafId: number | null = null;

	public startToolbarPositionLoop(containerEl: HTMLElement): void {
		if (this.toolbarPositionRafId !== null) return;

		const loop = (): void => {
			if (this.activeToolbar && this.activeToolbarNodeIds.length > 0) {
				const selectedNodeEls = this.activeToolbarNodeIds
					.map((id) => this.activeSessions.get(id)?.nodeEl)
					.filter((el): el is HTMLElement => Boolean(el) && el.isConnected);

				if (selectedNodeEls.length > 0) {
					const targetContainer =
						containerEl || selectedNodeEls[0].closest('.canvas');
					this.activeToolbar.updatePosition(selectedNodeEls, targetContainer);
					this.toolbarPositionRafId = window.requestAnimationFrame(loop);
					return;
				}
			}
			this.destroyToolbar();
			this.toolbarPositionRafId = null;
		};

		this.toolbarPositionRafId = window.requestAnimationFrame(loop);
	}

	public syncToolbar(
		canvas: CanvasElement | undefined,
		containerEl: HTMLElement,
		selectedNodeIds: string[]
	): void {
		this.garbageCollectStaleSessions(canvas);

		// Filter selectedNodeIds to those that have active sessions (connected in DOM and selected) or are pending initialization
		const validSelectedIds = selectedNodeIds.filter((id) => {
			const session = this.activeSessions.get(id);
			if (session) {
				const el = session.nodeEl;
				if (!el || !el.isConnected) return false;
				const canvasObj = canvas as unknown as {
					selection?: Set<unknown>;
					nodes?: Map<string, unknown>;
				};
				const canvasNode = canvasObj?.nodes?.get(id);
				const hasSelectionObject = Boolean(canvasObj?.selection);
				const isNodeInSelection = Boolean(
					canvasObj?.selection &&
					canvasNode &&
					canvasObj.selection.has(canvasNode)
				);
				const isSel = hasSelectionObject
					? isNodeInSelection
					: el.classList.contains('is-selected') ||
						el.classList.contains('is-focused');
				return isSel;
			}
			return this.pendingSessions.has(id);
		});

		if (validSelectedIds.length === 0) {
			this.destroyToolbar();
			this.purgeOrphanToolbars(containerEl);
			return;
		}

		// Ensure all currently selected sessions that are marked as playing have active RAF loops running
		for (const id of validSelectedIds) {
			const session = this.activeSessions.get(id);
			if (session && session.isPlaying && session.animFrameId === null) {
				this.startAnimationLoop(session);
			}
		}

		const selectedNodeEls = validSelectedIds
			.map((id) => this.activeSessions.get(id)?.nodeEl)
			.filter((el): el is HTMLElement => Boolean(el));

		// Check if current toolbar is already bound to the exact same selected node set
		const isSameSelection =
			this.activeToolbar !== null &&
			this.activeToolbarNodeIds.length === validSelectedIds.length &&
			this.activeToolbarNodeIds.every(
				(id, index) => id === validSelectedIds[index]
			);

		const primaryId = validSelectedIds[0];
		const primarySession = this.activeSessions.get(primaryId);
		const isPrimaryPlaying = primarySession?.isPlaying ?? false;

		if (isSameSelection && this.activeToolbar) {
			this.purgeOrphanToolbars(containerEl);
			if (primarySession) {
				// Update position and state of existing toolbar
				this.activeToolbar.updatePosition(selectedNodeEls, containerEl);
				this.activeToolbar.updateState(
					isPrimaryPlaying,
					primarySession.currentFrame,
					primarySession.decoder.getFrameCount(),
					primarySession.speed
				);
				this.startToolbarPositionLoop(containerEl);
			}
			return;
		}

		if (!primarySession) {
			// Session is still initializing in background — keep toolbar target node tracking without destroying
			this.activeToolbarNodeIds = [...validSelectedIds];
			return;
		}

		// Selection changed: Destroy old toolbar and purge any duplicate DOM elements
		this.destroyToolbar();
		this.purgeOrphanToolbars(containerEl);

		const isMultiSelect = validSelectedIds.length > 1;

		const toolbar = new CanvasGifToolbar(
			containerEl,
			primarySession.decoder.getFrameCount(),
			{
				onTogglePlay: (): void => {
					void this.togglePlayMulti(validSelectedIds, canvas);
				},
				onStepPrev: (): void => {
					void this.stepFrameMulti(validSelectedIds, -1, canvas);
				},
				onStepNext: (): void => {
					void this.stepFrameMulti(validSelectedIds, 1, canvas);
				},
				onSeek: (frameIndex: number): void => {
					void this.seekFrameMulti(validSelectedIds, frameIndex, canvas);
				},
				onChangeSpeed: (speed: number): void => {
					void this.setSpeedMulti(validSelectedIds, speed, canvas);
				},
				onExtractFrame: (): void => {
					if (!isMultiSelect) {
						void this.extractFrame(primaryId, canvas);
					}
				},
			}
		);

		toolbar.setMultiSelect(isMultiSelect);
		toolbar.updateState(
			isPrimaryPlaying,
			primarySession.currentFrame,
			primarySession.decoder.getFrameCount(),
			primarySession.speed
		);
		toolbar.updatePosition(selectedNodeEls, containerEl);

		this.activeToolbar = toolbar;
		this.activeToolbarNodeIds = [...validSelectedIds];
		this.startToolbarPositionLoop(containerEl);
	}

	private purgeOrphanToolbars(containerEl: HTMLElement): void {
		const activeContainer = this.activeToolbar?.getContainerEl();
		const toolbars = containerEl.querySelectorAll('.kambas-gif-toolbar');
		toolbars.forEach((tb) => {
			if (tb !== activeContainer) {
				tb.remove();
			}
		});
	}

	private destroyToolbar(): void {
		if (this.toolbarPositionRafId !== null) {
			cancelAnimationFrame(this.toolbarPositionRafId);
			this.toolbarPositionRafId = null;
		}
		if (this.activeToolbar) {
			this.activeToolbar.destroy();
			this.activeToolbar = null;
			this.activeToolbarNodeIds = [];
		}
	}

	public updatePositions(containerEl: HTMLElement): void {
		if (this.activeToolbar && this.activeToolbarNodeIds.length > 0) {
			const selectedNodeEls = this.activeToolbarNodeIds
				.map((id) => this.activeSessions.get(id)?.nodeEl)
				.filter((el): el is HTMLElement => Boolean(el) && el.isConnected);

			if (selectedNodeEls.length > 0) {
				const targetContainer =
					containerEl || selectedNodeEls[0].closest('.canvas');
				this.activeToolbar.updatePosition(selectedNodeEls, targetContainer);
			} else {
				this.destroyToolbar();
			}
		}
	}

	public garbageCollectStaleSessions(canvas?: CanvasElement): void {
		for (const [nodeId, session] of Array.from(this.activeSessions.entries())) {
			const isNodeInCanvas = Boolean(canvas?.nodes && canvas.nodes.has(nodeId));
			const isDomConnected = session.nodeEl.isConnected;

			if (!isNodeInCanvas || !isDomConnected || session.isDisposed) {
				this.detachGifTools(nodeId, false);
			}
		}
	}

	public detachGifTools(nodeId: string, keepPausedFrame = false): void {
		if (this.pendingSessions.has(nodeId)) {
			this.canceledSessions.add(nodeId);
		}
		const session = this.activeSessions.get(nodeId);
		if (!session) return;

		this.lastKnownState.set(nodeId, {
			isPaused: !session.isPlaying,
			frame: session.currentFrame,
			speed: session.speed,
		});

		session.isDisposed = true;
		session.isPlaying = false;

		if (this.activeToolbarNodeIds.includes(nodeId)) {
			this.destroyToolbar();
		}

		if (session.animFrameId !== null) {
			cancelAnimationFrame(session.animFrameId);
			session.animFrameId = null;
		}

		// Only retain overlay if explicitly requested AND elements are still connected in DOM
		const isDomValid =
			session.nodeEl.isConnected && session.canvasEl.isConnected;

		if (keepPausedFrame && isDomValid) {
			session.isDisposed = false;
			return;
		}

		// Full cleanup & disposal
		session.canvasEl.width = 0;
		session.canvasEl.height = 0;
		session.canvasEl.remove();
		session.imgEl.setCssProps({ display: '' });
		session.decoder.destroy();

		this.activeSessions.delete(nodeId);
	}

	public detachAll(): void {
		this.destroyToolbar();
		for (const nodeId of Array.from(this.pendingSessions)) {
			this.canceledSessions.add(nodeId);
		}
		for (const nodeId of Array.from(this.activeSessions.keys())) {
			this.detachGifTools(nodeId, false);
		}
	}

	public cleanupCanvasResources(): void {
		this.detachAll();
		this.pendingSessions.clear();
		this.canceledSessions.clear();
		this.lastKnownState.clear();
		this.activeSessions.clear();
	}

	private togglePlayMulti(nodeIds: string[], canvas?: CanvasElement): void {
		const sessions = nodeIds
			.map((id) => this.activeSessions.get(id))
			.filter((s): s is ActiveGifSession => Boolean(s));

		if (sessions.length === 0) return;

		const primary = sessions[0];
		const targetPlay = !primary.isPlaying;
		const isPaused = !targetPlay;

		for (const session of sessions) {
			session.isPlaying = targetPlay;
			if (session.unknownData) {
				session.unknownData.kambasGifPaused = isPaused;
				session.unknownData.kambasGifFrame = session.currentFrame;
				session.unknownData.kambasGifSpeed = session.speed;
			}
			this.saveNodeGifState(
				canvas,
				session.nodeId,
				isPaused,
				session.currentFrame,
				session.speed
			);

			if (session.isPlaying) {
				session.lastFrameTime = performance.now();
				this.startAnimationLoop(session);
			} else {
				if (session.animFrameId !== null) {
					cancelAnimationFrame(session.animFrameId);
					session.animFrameId = null;
				}
				void this.renderFrame(session, session.currentFrame);
			}
		}

		this.activeToolbar?.updateState(
			targetPlay,
			primary.currentFrame,
			primary.decoder.getFrameCount(),
			primary.speed
		);
	}

	private async stepFrameMulti(
		nodeIds: string[],
		delta: number,
		canvas?: CanvasElement
	): Promise<void> {
		const sessions = nodeIds
			.map((id) => this.activeSessions.get(id))
			.filter((s): s is ActiveGifSession => Boolean(s));

		if (sessions.length === 0) return;

		for (const session of sessions) {
			session.isPlaying = false;
			if (session.animFrameId !== null) {
				cancelAnimationFrame(session.animFrameId);
				session.animFrameId = null;
			}

			const total = session.decoder.getFrameCount();
			const nextFrame = (session.currentFrame + delta + total) % total;
			session.currentFrame = nextFrame;

			if (session.unknownData) {
				session.unknownData.kambasGifPaused = true;
				session.unknownData.kambasGifFrame = nextFrame;
				session.unknownData.kambasGifSpeed = session.speed;
			}
			this.saveNodeGifState(
				canvas,
				session.nodeId,
				true,
				nextFrame,
				session.speed
			);
			await this.renderFrame(session, nextFrame);
		}

		const primary = sessions[0];
		this.activeToolbar?.updateState(
			false,
			primary.currentFrame,
			primary.decoder.getFrameCount(),
			primary.speed
		);
	}

	private async seekFrameMulti(
		nodeIds: string[],
		frameIndex: number,
		canvas?: CanvasElement
	): Promise<void> {
		const sessions = nodeIds
			.map((id) => this.activeSessions.get(id))
			.filter((s): s is ActiveGifSession => Boolean(s));

		if (sessions.length === 0) return;

		for (const session of sessions) {
			const total = session.decoder.getFrameCount();
			const clampedFrame = Math.max(0, Math.min(frameIndex, total - 1));
			session.currentFrame = clampedFrame;
			const isPaused = !session.isPlaying;

			if (session.unknownData) {
				session.unknownData.kambasGifPaused = isPaused;
				session.unknownData.kambasGifFrame = clampedFrame;
				session.unknownData.kambasGifSpeed = session.speed;
			}
			this.saveNodeGifState(
				canvas,
				session.nodeId,
				isPaused,
				clampedFrame,
				session.speed
			);
			await this.renderFrame(session, clampedFrame);
		}

		const primary = sessions[0];
		this.activeToolbar?.updateState(
			primary.isPlaying,
			primary.currentFrame,
			primary.decoder.getFrameCount(),
			primary.speed
		);
	}

	private setSpeedMulti(
		nodeIds: string[],
		speed: number,
		canvas?: CanvasElement
	): void {
		const sessions = nodeIds
			.map((id) => this.activeSessions.get(id))
			.filter((s): s is ActiveGifSession => Boolean(s));

		for (const session of sessions) {
			session.speed = speed;
			if (session.unknownData) {
				session.unknownData.kambasGifSpeed = speed;
			}
			this.saveNodeGifState(
				canvas,
				session.nodeId,
				!session.isPlaying,
				session.currentFrame,
				speed
			);
		}

		const primary = sessions[0];
		this.activeToolbar?.updateState(
			primary.isPlaying,
			primary.currentFrame,
			primary.decoder.getFrameCount(),
			primary.speed
		);
	}

	public updateZoomScale(_scale: number, _selectedNodeIds: string[] = []): void {
		// Zoom scale update handler reserved for future canvas gif scale adjustments
	}

	private startAnimationLoop(session: ActiveGifSession): void {
		if (session.isDisposed) return;

		session.loopId = (session.loopId || 0) + 1;
		const currentLoopId = session.loopId;

		if (session.animFrameId !== null) {
			cancelAnimationFrame(session.animFrameId);
			session.animFrameId = null;
		}

		const loop = async (now: number): Promise<void> => {
			if (
				session.isDisposed ||
				!session.isPlaying ||
				session.loopId !== currentLoopId
			) {
				session.animFrameId = null;
				return;
			}

			const delay =
				session.decoder.getFrameDuration(session.currentFrame) / session.speed;
			const elapsed = now - session.lastFrameTime;

			if (elapsed >= delay) {
				session.lastFrameTime = now - (elapsed % delay);
				const total = session.decoder.getFrameCount();
				session.currentFrame = (session.currentFrame + 1) % total;

				try {
					await this.renderFrame(session, session.currentFrame);
				} catch (err) {
					console.error('Error rendering GIF frame:', err);
				}

				if (
					session.isDisposed ||
					!session.isPlaying ||
					session.loopId !== currentLoopId
				) {
					session.animFrameId = null;
					return;
				}

				if (this.activeToolbarNodeIds[0] === session.nodeId) {
					const isAnyPlaying = this.activeToolbarNodeIds.some(
						(id) => this.activeSessions.get(id)?.isPlaying ?? false
					);
					this.activeToolbar?.updateState(
						isAnyPlaying,
						session.currentFrame,
						total,
						session.speed
					);
				}
			}

			if (
				!session.isDisposed &&
				session.isPlaying &&
				session.loopId === currentLoopId
			) {
				session.animFrameId = window.requestAnimationFrame((time) => {
					void loop(time);
				});
			} else {
				session.animFrameId = null;
			}
		};

		session.animFrameId = window.requestAnimationFrame((time) => {
			void loop(time);
		});
	}

	private async renderFrame(
		session: ActiveGifSession,
		frameIndex: number
	): Promise<void> {
		await session.decoder.renderFrameToCanvas(
			frameIndex,
			session.ctx,
			session.canvasEl.width,
			session.canvasEl.height
		);
	}

	private async extractFrame(
		nodeId: string,
		canvas?: CanvasElement
	): Promise<void> {
		const session = this.activeSessions.get(nodeId);
		if (!session) return;

		const t = getText();
		const blob = await session.decoder.extractFrameAsBlob(session.currentFrame);
		if (!blob) {
			new Notice(t.gifExtractError || 'Failed to extract GIF frame');
			return;
		}

		try {
			const canvasNode = canvas?.nodes?.get(nodeId);
			const rawNode = canvasNode as unknown as {
				file?: TFile | string;
				url?: string;
				unknownData?: { type?: string; file?: string; url?: string };
			};
			const isEmbedded = Boolean(
				(rawNode?.url && rawNode.url.startsWith('data:image/')) ||
				(rawNode?.unknownData?.url &&
					rawNode.unknownData.url.startsWith('data:image/')) ||
				rawNode?.unknownData?.type === 'link' ||
				(session.imgEl?.src && session.imgEl.src.startsWith('data:image/'))
			);
			const isVaultFile =
				!isEmbedded &&
				Boolean(
					session.file ||
					rawNode?.file ||
					rawNode?.unknownData?.file ||
					rawNode?.unknownData?.type === 'file'
				);

			const posX = (canvasNode?.x ?? 0) + (canvasNode?.width ?? 300) + 40;
			const posY = canvasNode?.y ?? 0;
			const size = {
				width: canvasNode?.width ?? 300,
				height: canvasNode?.height ?? 300,
			};

			if (isVaultFile) {
				// Save extracted frame as PNG into vault file
				const baseName = session.file
					? session.file.basename
					: 'extracted_frame';
				const fileName = `${baseName}_frame_${session.currentFrame + 1}_${Date.now()}.png`;
				const arrayBuffer = await blob.arrayBuffer();
				const folderPath =
					(
						this.app.vault as unknown as {
							config?: { attachmentFolderPath?: string };
						}
					).config?.attachmentFolderPath || '';
				const targetPath = await saveFileToVault(
					this.app,
					folderPath,
					fileName,
					arrayBuffer
				);
				const savedFile = this.app.vault.getAbstractFileByPath(targetPath);

				if (
					canvas &&
					savedFile instanceof TFile &&
					typeof canvas.createFileNode === 'function'
				) {
					canvas.createFileNode({
						file: savedFile,
						pos: { x: posX, y: posY },
						size,
						save: true,
					});
				}
				new Notice(
					t.gifExtractSuccess?.(session.currentFrame + 1) ||
						`Extracted frame ${session.currentFrame + 1} to vault!`
				);
			} else {
				// Save extracted frame as embedded base64 Data URL inside .canvas file
				const arrayBuffer = await blob.arrayBuffer();
				const dataUrl = arrayBufferToBase64DataUrl(arrayBuffer, 'image/png');

				if (canvas && typeof canvas.createLinkNode === 'function') {
					const createdNode = canvas.createLinkNode({
						url: dataUrl,
						pos: { x: posX, y: posY },
						size,
						save: true,
					});

					const rawN = createdNode as unknown as {
						unknownData?: { type?: string; url?: string };
					};
					if (rawN) {
						if (!rawN.unknownData) rawN.unknownData = {};
						rawN.unknownData.type = 'link';
						rawN.unknownData.url = dataUrl;
					}
				}
				new Notice(
					t.gifExtractSuccessEmbed?.(session.currentFrame + 1) ||
						`Extracted frame ${session.currentFrame + 1} into canvas file!`
				);
			}
		} catch (err) {
			console.error('Failed to save extracted frame:', err);
			new Notice(t.gifExtractError || 'Failed to extract GIF frame');
		}
	}
}
