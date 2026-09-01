import { App, FuzzySuggestModal, TFolder } from 'obsidian';

export class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
	private onChoose: (folder: TFolder) => void;

	constructor(app: App, onChoose: (folder: TFolder) => void) {
		super(app);
		this.onChoose = onChoose;
		this.setPlaceholder('Select target folder...');
	}

	getItems(): TFolder[] {
		const folders: TFolder[] = [];
		const root = this.app.vault.getRoot();

		const collectFolders = (folder: TFolder): void => {
			folders.push(folder);
			for (const child of folder.children) {
				if (child instanceof TFolder) {
					collectFolders(child);
				}
			}
		};

		collectFolders(root);
		return folders;
	}

	getItemText(folder: TFolder): string {
		return folder.path === '/' ? '/ (Vault Root)' : folder.path;
	}

	onChooseItem(folder: TFolder): void {
		this.onChoose(folder);
	}
}
