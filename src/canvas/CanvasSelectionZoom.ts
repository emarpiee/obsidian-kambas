import { ItemView } from 'obsidian';

import type KambasPlugin from '../main';
import { CanvasElement, CanvasItemView } from './CanvasTypes';

/** Extended canvas type exposing internal selection set. */
type CanvasEx = CanvasElement & {
	selection?: Set<{
		nodeEl?: HTMLElement;
		x: number;
		y: number;
		width: number;
		height: number;
	}>;
};

export class CanvasSelectionZoom {
	private plugin: KambasPlugin;
	private focusedZoomNodeEl: Element | null = null;
	private focusedZoomNodeId: string | null = null;
	private focusedZoomSelectionKey: string | null = null;

	constructor(plugin: KambasPlugin) {
		this.plugin = plugin;
	}

	public registerEvents(): void {
		this.plugin.registerDomEvent(window, 'keydown', (evt: KeyboardEvent) => {
			this.handleKeyDown(evt);
		});
	}

	/** Blocks the hotkey only when a node is actively being edited, not just selected. */
	private isEditingText(evt: KeyboardEvent): boolean {
		const target = evt.target as HTMLElement | null;
		if (!target) return false;

		const tagName = target.tagName.toLowerCase();

		// Block on real form inputs always
		if (tagName === 'input' || tagName === 'textarea') return true;

		// Block inside CodeMirror editor (markdown notes open in a leaf)
		if (target.closest('.cm-editor')) return true;

		// For canvas: only block when a node is actively in edit mode (double-clicked).
		const ownerDoc = target.ownerDocument || document;
		if (ownerDoc.querySelector('.canvas-node.is-editing')) return true;

		return false;
	}

	private getCanvasViewForEvent(evt: Event): CanvasItemView | null {
		const target = evt.target as HTMLElement | null;
		const doc = target?.ownerDocument ?? document;
		const activeLeaf = this.plugin.app.workspace.getActiveViewOfType(ItemView);
		if (
			activeLeaf &&
			activeLeaf.getViewType() === 'canvas' &&
			activeLeaf.containerEl.ownerDocument === doc
		) {
			return activeLeaf;
		}
		let foundView: CanvasItemView | null = null;
		this.plugin.app.workspace.iterateAllLeaves((leaf) => {
			if (foundView) return;
			if (
				leaf.view?.getViewType() === 'canvas' &&
				leaf.view.containerEl.ownerDocument === doc
			) {
				foundView = leaf.view;
			}
		});
		return (
			foundView ??
			(activeLeaf?.getViewType() === 'canvas'
				? (activeLeaf)
				: null)
		);
	}

	private handleKeyDown(evt: KeyboardEvent): void {
		if (this.isEditingText(evt)) return;

		const activeView = this.getCanvasViewForEvent(evt);
		if (!activeView || activeView.getViewType() !== 'canvas') return;

		const canvas = activeView.canvas as CanvasEx | undefined;
		if (!canvas) return;

		const configuredKey =
			this.plugin.settings.selectionZoomToFitHotkey || 'Space';
		const isSpace = configuredKey.toLowerCase() === 'space';
		const matched = isSpace
			? evt.key === ' ' || evt.code === 'Space'
			: evt.key === configuredKey ||
				evt.key.toLowerCase() === configuredKey.toLowerCase();

		if (!matched) return;

		// Get selected nodes from canvas.selection (internal Set) — works for single AND multi select.
		// Fallback: DOM query for is-selected (used when rubber-band selecting).
		const selectedNodes = this.getSelectedNodes(canvas, activeView.containerEl);
		const currentFirstEl = selectedNodes[0]?.nodeEl ?? null;

		// Build selection key based on current selected node objects
		const currentSelectionKey =
			selectedNodes.length > 0
				? selectedNodes
						.map((n) => (n as unknown as { id?: string }).id ?? n.x + ',' + n.y)
						.sort()
						.join('|')
				: null;

		// Only intercept if there's a selection or we're already zoomed in
		if (!currentFirstEl && !this.focusedZoomNodeEl) return;

		evt.preventDefault();
		evt.stopPropagation();

		// Add smooth transition class briefly
		const win = activeView.containerEl?.ownerDocument?.defaultView || window;
		const wrapperEl =
			(canvas as unknown as { wrapperEl?: HTMLElement }).wrapperEl ??
			activeView.containerEl.querySelector('.canvas-wrapper');
		if (wrapperEl) {
			wrapperEl.classList.add('kambas-smooth-zoom');
			win.setTimeout(
				() => wrapperEl.classList.remove('kambas-smooth-zoom'),
				350
			);
		}

		// Determine if same selection as last zoom-in
		const isSameSelection =
			(this.focusedZoomNodeEl !== null ||
				this.focusedZoomSelectionKey !== null) &&
			(this.focusedZoomSelectionKey === currentSelectionKey ||
				(this.focusedZoomSelectionKey === null &&
					this.focusedZoomNodeEl === currentFirstEl));

		if (isSameSelection) {
			// Same selection pressed again — ZOOM OUT to fit whole canvas
			this.focusedZoomNodeId = null;
			this.focusedZoomNodeEl = null;
			this.focusedZoomSelectionKey = null;
			if (typeof canvas.zoomToFit === 'function') {
				try {
					canvas.zoomToFit();
				} catch {
					/* ignore */
				}
			}
			return;
		}

		// New selection or first press — ZOOM IN to selection
		this.focusedZoomNodeId = null;
		this.focusedZoomNodeEl = currentFirstEl;
		this.focusedZoomSelectionKey = currentSelectionKey;

		this.zoomToNodes(canvas, selectedNodes);
	}

	/** Get selected canvas node objects via internal selection Set, falling back to DOM query. */
	private getSelectedNodes(
		canvas: CanvasEx,
		containerEl?: HTMLElement
	): Array<{
		nodeEl?: HTMLElement;
		x: number;
		y: number;
		width: number;
		height: number;
	}> {
		// Prefer canvas.selection — the internal Set Obsidian uses for ALL selection types
		if (canvas.selection && canvas.selection.size > 0) {
			return Array.from(canvas.selection);
		}

		// Fallback: match via DOM is-selected class → canvas.nodes map
		if (!canvas.nodes) return [];
		const result: Array<{
			nodeEl?: HTMLElement;
			x: number;
			y: number;
			width: number;
			height: number;
		}> = [];
		const rootEl = containerEl ?? this.plugin.app.workspace.containerEl;
		const selectedEls = Array.from(
			rootEl.querySelectorAll<HTMLElement>('.canvas-node.is-selected')
		);
		if (selectedEls.length === 0) return [];

		canvas.nodes.forEach((node) => {
			if (!node.nodeEl) return;
			const nodeEl = node.nodeEl;
			const isSelected = selectedEls.some(
				(el) => el === nodeEl || el.contains(nodeEl) || nodeEl.contains(el)
			);
			if (isSelected) result.push(node);
		});
		return result;
	}

	/** Zooms to fit the given canvas node objects using zoomToBbox for accuracy. */
	private zoomToNodes(
		canvas: CanvasEx,
		nodes: Array<{
			nodeEl?: HTMLElement;
			x: number;
			y: number;
			width: number;
			height: number;
		}>
	): void {
		if (nodes.length === 0) return;

		if (typeof canvas.zoomToBbox === 'function') {
			let minX = Infinity,
				minY = Infinity,
				maxX = -Infinity,
				maxY = -Infinity;

			for (const node of nodes) {
				minX = Math.min(minX, node.x);
				minY = Math.min(minY, node.y);
				maxX = Math.max(maxX, node.x + node.width);
				maxY = Math.max(maxY, node.y + node.height);
			}

			try {
				canvas.zoomToBbox({ minX, minY, maxX, maxY });
				return;
			} catch {
				/* fall through */
			}
		}

		// Fallback chain
		if (typeof canvas.zoomToSelection === 'function') {
			try {
				canvas.zoomToSelection();
				return;
			} catch {
				/* fall through */
			}
		}
		if (typeof canvas.zoomToFit === 'function') {
			canvas.zoomToFit();
		}
	}
}
