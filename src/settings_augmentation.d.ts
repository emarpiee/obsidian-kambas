import './settings';

declare module './settings' {
	interface KambasSettingTab {
		update(): void;
	}
}
