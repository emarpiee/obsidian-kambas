export type NumberFormatStyle =
	| 'padded_2'
	| 'padded_3'
	| 'simple'
	| 'roman_upper'
	| 'roman_lower'
	| 'letter_upper'
	| 'letter_lower';

/**
 * Converts a positive integer to Roman Numerals (1 -> I, 4 -> IV, 9 -> IX, 14 -> XIV).
 */
export function toRoman(num: number): string {
	let n = Math.max(1, Math.floor(num));
	const lookup: Array<[number, string]> = [
		[1000, 'M'],
		[900, 'CM'],
		[500, 'D'],
		[400, 'CD'],
		[100, 'C'],
		[90, 'XC'],
		[50, 'L'],
		[40, 'XL'],
		[10, 'X'],
		[9, 'IX'],
		[5, 'V'],
		[4, 'IV'],
		[1, 'I'],
	];

	let result = '';
	for (const [val, letter] of lookup) {
		while (n >= val) {
			result += letter;
			n -= val;
		}
	}
	return result;
}

/**
 * Converts a positive integer to Excel-style alphabetical columns (1 -> A, 26 -> Z, 27 -> AA).
 */
export function toAlpha(num: number): string {
	let n = Math.max(1, Math.floor(num));
	let result = '';
	while (n > 0) {
		const rem = (n - 1) % 26;
		result = String.fromCharCode(65 + rem) + result;
		n = Math.floor((n - 1) / 26);
	}
	return result;
}

/**
 * Formats a 1-indexed counter number according to the chosen style.
 */
export function formatIncrementalNumber(num: number, style: NumberFormatStyle = 'padded_2'): string {
	const val = Math.max(1, Math.floor(num));
	switch (style) {
		case 'padded_3':
			return String(val).padStart(3, '0');
		case 'simple':
			return String(val);
		case 'roman_upper':
			return toRoman(val);
		case 'roman_lower':
			return toRoman(val).toLowerCase();
		case 'letter_upper':
			return toAlpha(val);
		case 'letter_lower':
			return toAlpha(val).toLowerCase();
		case 'padded_2':
		default:
			return String(val).padStart(2, '0');
	}
}
