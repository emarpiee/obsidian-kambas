declare module '*.css' {
	const content: Record<string, string>;
	export default content;
}

declare global {
	interface KambasSettingTab {
		update(): void;
	}
}






