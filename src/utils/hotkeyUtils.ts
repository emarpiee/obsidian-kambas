const KeyLabelOverrides: Record<string, string> = {
	ArrowUp: 'Up',
	ArrowLeft: 'Left',
	ArrowDown: 'Down',
	ArrowRight: 'Right',
};

export function formatKeyLabel(key: string): string {
	if (!key) return '?';
	if (key === ' ' || key.toLowerCase() === 'space') return 'Space';
	if (KeyLabelOverrides[key]) return KeyLabelOverrides[key];
	if (key.length === 1) return key.toUpperCase();
	return key;
}

export function formatRecordedHotkey(evt: KeyboardEvent): string {
	const parts: string[] = [];

	if (evt.ctrlKey && evt.key !== 'Control') parts.push('Ctrl');
	if (evt.altKey && evt.key !== 'Alt') parts.push('Alt');
	if (evt.shiftKey && evt.key !== 'Shift') parts.push('Shift');
	if (evt.metaKey && evt.key !== 'Meta') parts.push('Cmd');

	let keyName = evt.key;
	if (keyName === ' ') {
		keyName = 'Space';
	} else if (keyName === 'Control') {
		keyName = 'Ctrl';
	} else if (keyName === 'Alt') {
		keyName = 'Alt';
	} else if (keyName === 'Shift') {
		keyName = 'Shift';
	} else if (keyName === 'Meta') {
		keyName = 'Cmd';
	} else if (KeyLabelOverrides[keyName]) {
		keyName = KeyLabelOverrides[keyName];
	} else if (keyName.length === 1) {
		keyName = keyName.toUpperCase();
	}

	if (!parts.includes(keyName)) {
		parts.push(keyName);
	}

	return parts.join('+');
}

export function matchHotkeyEvent(
	evt: KeyboardEvent,
	targetHotkey: string
): boolean {
	if (!targetHotkey) return false;

	const parts = targetHotkey.split('+').map((p) => p.trim().toLowerCase());
	const hasCtrl = parts.includes('ctrl') || parts.includes('control');
	const hasAlt = parts.includes('alt') || parts.includes('option');
	const hasShift = parts.includes('shift');
	const hasCmd =
		parts.includes('cmd') || parts.includes('meta') || parts.includes('mod');

	const mainKeys = parts.filter(
		(p) =>
			![
				'ctrl',
				'control',
				'alt',
				'option',
				'shift',
				'cmd',
				'meta',
				'mod',
			].includes(p)
	);

	const isModifierKey = ['control', 'alt', 'shift', 'meta'].includes(
		(evt.key || '').toLowerCase()
	);

	if (mainKeys.length === 0) {
		// Standalone modifier target (e.g. "Alt", "Shift", "Ctrl", "Cmd")
		const pressedKey = (evt.key || '').toLowerCase();
		if (hasAlt && (pressedKey === 'alt' || evt.altKey)) return true;
		if (hasCtrl && (pressedKey === 'control' || evt.ctrlKey)) return true;
		if (hasShift && (pressedKey === 'shift' || evt.shiftKey)) return true;
		if (hasCmd && (pressedKey === 'meta' || evt.metaKey)) return true;
		return false;
	}

	// For modifier + key combinations, verify required modifiers match
	if (evt.ctrlKey !== hasCtrl) return false;
	if (evt.altKey !== hasAlt) return false;
	if (evt.shiftKey !== hasShift) return false;
	if (evt.metaKey !== hasCmd) return false;

	if (isModifierKey) return false;

	const targetKey = mainKeys[mainKeys.length - 1];
	if (targetKey === 'space') {
		return evt.key === ' ' || evt.code === 'Space';
	}

	const pressedKey = (evt.key || '').toLowerCase();
	const pressedCode = (evt.code || '').toLowerCase();
	return pressedKey === targetKey || pressedCode === `key${targetKey}`;
}

/**
 * Returns true if the keyboard event occurred while the user is actively editing text
 * (in an input, textarea, contenteditable element, markdown editor, group name editor, or modal),
 * so that single-key or non-modifier hotkeys (like Space, WASD, G, H, etc.) are NOT intercepted.
 */
export function isEditingText(evt: KeyboardEvent): boolean {
	const target = evt.target as HTMLElement | null;
	const ownerDoc = target?.ownerDocument || document;
	const activeEl = ownerDoc.activeElement as HTMLElement | null;

	const isEditable = (el: HTMLElement | null): boolean => {
		if (!el) return false;
		const tag = el.tagName.toLowerCase();

		// Real form text inputs and textareas (including group title inputs)
		if (tag === 'input' || tag === 'textarea') return true;

		// Contenteditable elements (including inline group title contenteditable headers)
		if (
			el.isContentEditable ||
			el.closest('[contenteditable="true"]') !== null ||
			el.closest('[contenteditable=""]') !== null
		) {
			return true;
		}

		// CodeMirror text editors inside markdown nodes or note views
		if (el.closest('.cm-editor') !== null || el.closest('.cm-content') !== null) {
			return true;
		}

		// Search bars, modals, prompts, dropdown menus
		if (
			el.closest('.modal') !== null ||
			el.closest('.prompt') !== null ||
			el.closest('.menu') !== null ||
			el.closest('.suggestion-container') !== null
		) {
			return true;
		}

		return false;
	};

	if (isEditable(target)) return true;
	if (isEditable(activeEl)) return true;

	// For canvas text/markdown nodes in active edit mode (double-clicked)
	if (ownerDoc.querySelector('.canvas-node.is-editing') !== null) return true;

	return false;
}

