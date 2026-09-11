import { TFile } from 'obsidian';

export interface CanvasNodeData {
	id?: string;
	x: number;
	y: number;
	width: number;
	height: number;
	type: 'text' | 'file' | 'link' | 'group';
	text?: string;
	file?: string;
	url?: string;
	subpath?: string;
	style?: Record<string, unknown>;
	// Kambas transform, dimensions & read-only lock properties
	kambasFlipH?: boolean;
	kambasFlipV?: boolean;
	kambasGrayscale?: boolean;
	kambasPalette?: boolean;
	kambasOpacity?: number; // 0–1, default 1 (fully opaque)
	originalWidth?: number;
	originalHeight?: number;
	isLocked?: boolean;
}

export interface CanvasEdgeData {
	id?: string;
	fromNode?: string;
	toNode?: string;
	kambasOpacity?: number; // 0–1, default 1
	[key: string]: unknown;
}

export interface CanvasFileData {
	nodes?: CanvasNodeData[];
	edges?: CanvasEdgeData[];
}

export interface CanvasElement {
	tx?: number;
	ty?: number;
	zoom?: number;
	markViewportChanged?: () => void;
	panTo?: (x: number, y: number) => void;
	nodes?: Map<string, { nodeEl?: HTMLElement; x: number; y: number; width: number; height: number }>;
	edges?: Map<string, { lineGroupEl?: HTMLElement; lineElement?: HTMLElement; lineEndGroupEl?: HTMLElement; unknownData?: { kambasOpacity?: number } }>;
	zoomToBbox?: (bbox: { x: number; y: number; width: number; height: number }) => void;
	zoomToSelection?: () => void;
	zoomToFit?: () => void;
	zoomBy?: (delta: number) => void;
	zoomIn?: () => void;
	zoomOut?: () => void;
	createMediaNode?: (options: {
		url?: string;
		file?: TFile;
		pos: { x: number; y: number };
		size?: { width: number; height: number };
		save?: boolean;
	}) => void;
	createLinkNode?: (options: {
		url: string;
		pos: { x: number; y: number };
		size?: { width: number; height: number };
		save?: boolean;
	}) => void;
	createTextNode?: (options: {
		text: string;
		pos: { x: number; y: number };
		size?: { width: number; height: number };
		save?: boolean;
	}) => void;
	createFileNode?: (options: {
		file: TFile;
		pos: { x: number; y: number };
		size?: { width: number; height: number };
		save?: boolean;
		subpath?: string;
	}) => void;
	posFromEvent?: (evt: MouseEvent) => { x: number; y: number };
	requestSave?: () => void;
}

export interface CanvasItemView {
	getViewType: () => string;
	canvas?: CanvasElement;
	file?: TFile;
}

/** Image extensions treated as native canvas images */
export const IMAGE_EXTENSIONS = new Set([
	'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'avif', 'tiff', 'tif',
]);
