import { getLanguage, moment } from 'obsidian';

export interface TranslationSchema {
	// Settings Tab
	settingsHeading: string;
	hideImageLabelName: string;
	hideImageLabelDesc: string;
	paletteSwatchCountName?: string;
	paletteSwatchCountDesc?: string;
	keyboardPanHeading: string;
	panControlsName: string;
	panControlsDesc: string;
	restoreDefaultTooltip: string;
	updatePanControlsButton: string;
	maxPanSpeedName: string;
	maxPanSpeedDesc: string;
	keyboardZoomHeading: string;
	zoomControlsName: string;
	zoomControlsDesc: string;
	updateZoomControlsButton: string;
	zoomSpeedName: string;
	zoomSpeedDesc: string;
	duplicateKeyNotice: string;

	// Ingestion Modal
	modalTitle: string;
	modalDescription: (filename: string) => string;
	applyRemaining: (count: number) => string;
	saveToVault: string;
	embedInCanvas: string;

	// Convert To Embed Modal
	convertModalTitle: string;
	convertModalDesc: (filename: string) => string;
	applyRemainingConvert: (count: number) => string;
	deleteOriginalFile: string;
	keepOriginalFile: string;

	// Opacity Modal
	opacityModalTitle: string;
	cancelBtn: string;
	applyBtn: string;

	// Folder Suggest Modal
	selectTargetFolderPlaceholder: string;
	vaultRootLabel: string;

	// Context Menu & Hotkeys
	flipHorizontal: string;
	flipVertical: string;
	toggleGrayscale: string;
	togglePalette: string;
	changeOpacity: string;
	awayMode: string;
	copyImageToClipboard: string;
	moveSelectedMedia: string;
	copySelectedMedia: string;
	convertToEmbed: string;
	resetSize: string;
	// Swap Image
	swapImage: string;
	swapModalTitle: string;
	swapFromVault: string;
	swapFromFile: string;
	swapFromClipboard: string;
	swapSearchPlaceholder: string;
	swapDropZoneHint: string;
	swapBrowseBtn: string;
	swapBtn: string;
	swapSuccess: string;
}

const en: TranslationSchema = {
	settingsHeading: 'Display & canvas',
	hideImageLabelName: 'Hide media label',
	hideImageLabelDesc: 'Hide the base64 URL / data label header displayed above embedded canvas media cards.',
	paletteSwatchCountName: 'Color palette swatches',
	paletteSwatchCountDesc: 'Number of dominant colors to display when the color palette is enabled on an image (3–10).',
	keyboardPanHeading: 'Canvas keyboard pan controls',
	panControlsName: 'Pan controls',
	panControlsDesc: 'Which set of keys pan the canvas.',
	restoreDefaultTooltip: 'Restore default',
	updatePanControlsButton: 'Update pan controls',
	maxPanSpeedName: 'Maximum pan speed',
	maxPanSpeedDesc: 'Canvas units to pan by',
	keyboardZoomHeading: 'Canvas keyboard zoom controls',
	zoomControlsName: 'Zoom controls',
	zoomControlsDesc: 'Which set of keys zoom in and out on the canvas.',
	updateZoomControlsButton: 'Update zoom controls',
	zoomSpeedName: 'Zoom speed',
	zoomSpeedDesc: 'Rate of zoom change per frame',
	duplicateKeyNotice: 'Duplicate key bindings are not allowed. Please choose unique keys for each action.',

	modalTitle: 'Add media to canvas file',
	modalDescription: (filename: string) => `How would you like to store "${filename}"?`,
	applyRemaining: (count: number) => `Apply choice to remaining ${count} media`,
	saveToVault: 'Save to vault',
	embedInCanvas: 'Embed in canvas file',

	convertModalTitle: 'Embed media in canvas file',
	convertModalDesc: (filename: string) => `Embedding "${filename}" directly into the canvas file. What would you like to do with the original vault file?`,
	applyRemainingConvert: (count: number) => `Apply choice to remaining ${count} media files`,
	deleteOriginalFile: 'Delete original file',
	keepOriginalFile: 'Keep original file',

	opacityModalTitle: 'Change opacity',
	cancelBtn: 'Cancel',
	applyBtn: 'Apply',

	selectTargetFolderPlaceholder: 'Select target folder...',
	vaultRootLabel: '/ (Vault Root)',

	flipHorizontal: 'Flip horizontal',
	flipVertical: 'Flip vertical',
	toggleGrayscale: 'Toggle grayscale',
	togglePalette: 'Color palette',
	changeOpacity: 'Change opacity',
	awayMode: 'Away mode',
	copyImageToClipboard: 'Copy media to clipboard',
	moveSelectedMedia: 'Move media to...',
	copySelectedMedia: 'Copy media to...',
	convertToEmbed: 'Embed in canvas file...',
	resetSize: 'Reset to original size',
	swapImage: 'Swap media…',
	swapModalTitle: 'Swap media',
	swapFromVault: 'From vault',
	swapFromFile: 'From file',
	swapSearchPlaceholder: 'Search vault for media…',
	swapDropZoneHint: 'Drop a media file here, or',
	swapBrowseBtn: 'Browse…',
	swapFromClipboard: 'Paste from clipboard',
	swapBtn: 'Swap',
	swapSuccess: 'Media swapped!',
};

const zh: TranslationSchema = {
	settingsHeading: '显示与画布',
	hideImageLabelName: '隐藏媒体标签',
	hideImageLabelDesc: '隐藏嵌入式画布媒体卡片上方显示的 base64 URL / 数据标签标头。',
	keyboardPanHeading: '画布键盘平移控制',
	panControlsName: '平移控制',
	panControlsDesc: '用于平移画布按键组合。',
	restoreDefaultTooltip: '恢复默认设置',
	updatePanControlsButton: '更新平移控制按键',
	maxPanSpeedName: '最大平移速度',
	maxPanSpeedDesc: '平移的画布单位数',
	keyboardZoomHeading: '画布键盘缩放控制',
	zoomControlsName: '缩放控制',
	zoomControlsDesc: '用于放大和缩小画布按键组合。',
	updateZoomControlsButton: '更新缩放控制按键',
	zoomSpeedName: '缩放速度',
	zoomSpeedDesc: '每帧缩放变化率',
	duplicateKeyNotice: '不允许重复绑定按键。请为每个操作选择唯一的按键。',

	modalTitle: '添加媒体到画布文件',
	modalDescription: (filename: string) => `您希望如何存储 "${filename}"？`,
	applyRemaining: (count: number) => `将选择应用到剩余的 ${count} 个媒体`,
	saveToVault: '保存到宝库',
	embedInCanvas: '嵌入到画布文件',

	convertModalTitle: '在画布文件中嵌入媒体',
	convertModalDesc: (filename: string) => `将 "${filename}" 直接嵌入画布文件。您希望如何处理原始宝库文件？`,
	applyRemainingConvert: (count: number) => `将选择应用到剩余的 ${count} 个媒体文件`,
	deleteOriginalFile: '删除原始文件',
	keepOriginalFile: '保留原始文件',

	opacityModalTitle: '更改不透明度',
	cancelBtn: '取消',
	applyBtn: '应用',

	selectTargetFolderPlaceholder: '选择目标文件夹...',
	vaultRootLabel: '/ (宝库根目录)',

	flipHorizontal: '水平翻转',
	flipVertical: '垂直翻转',
	toggleGrayscale: '切换灰度',
	togglePalette: '调色板',
	changeOpacity: '更改不透明度',
	awayMode: '离开模式',
	copyImageToClipboard: '复制媒体到剪贴板',
	moveSelectedMedia: '移动媒体到...',
	copySelectedMedia: '复制媒体到...',
	convertToEmbed: '嵌入到画布文件...',
	resetSize: '重置为原始大小',
	swapImage: '替换媒体…',
	swapModalTitle: '替换媒体',
	swapFromVault: '从库中选择',
	swapFromFile: '从文件选择',
	swapSearchPlaceholder: '在库中搜索媒体…',
	swapDropZoneHint: '将媒体文件拖放至此，或',
	swapBrowseBtn: '浏览…',
	swapFromClipboard: '从剪贴板粘贴',
	swapBtn: '替换',
	swapSuccess: '媒体已替换！',
};

const zhTW: TranslationSchema = {
	settingsHeading: '顯示與畫布',
	hideImageLabelName: '隱藏媒體標籤',
	hideImageLabelDesc: '隱藏嵌入式畫布媒體卡片上方顯示的 base64 URL / 資料標籤標頭。',
	keyboardPanHeading: '畫布鍵盤平移控制',
	panControlsName: '平移控制',
	panControlsDesc: '用於平移畫布按鍵組合。',
	restoreDefaultTooltip: '恢復預設設定',
	updatePanControlsButton: '更新平移控制按鍵',
	maxPanSpeedName: '最大平移速度',
	maxPanSpeedDesc: '平移的畫布單位數',
	keyboardZoomHeading: '畫布鍵盤縮放控制',
	zoomControlsName: '縮放控制',
	zoomControlsDesc: '用於放大和縮小畫布按鍵組合。',
	updateZoomControlsButton: '更新縮放控制按鍵',
	zoomSpeedName: '縮放速度',
	zoomSpeedDesc: '每幀縮放變化率',
	duplicateKeyNotice: '不允許重複綁定按鍵。請為每個操作選擇唯一的按鍵。',

	modalTitle: '新增媒體至畫布檔案',
	modalDescription: (filename: string) => `您希望如何儲存 "${filename}"？`,
	applyRemaining: (count: number) => `將選擇套用至剩餘的 ${count} 個媒體`,
	saveToVault: '儲存至寶庫',
	embedInCanvas: '嵌入至畫布檔案',

	convertModalTitle: '在畫布檔案中嵌入媒體',
	convertModalDesc: (filename: string) => `將 "${filename}" 直接嵌入畫布檔案。您希望如何處理原始寶庫檔案？`,
	applyRemainingConvert: (count: number) => `將選擇套用至剩餘的 ${count} 個媒體檔案`,
	deleteOriginalFile: '刪除原始檔案',
	keepOriginalFile: '保留原始檔案',

	opacityModalTitle: '更改不透明度',
	cancelBtn: '取消',
	applyBtn: '套用',

	selectTargetFolderPlaceholder: '選擇目標資料夾...',
	vaultRootLabel: '/ (寶庫根目錄)',

	flipHorizontal: '水平翻轉',
	flipVertical: '垂直翻轉',
	toggleGrayscale: '切換灰階',
	togglePalette: '調色板',
	changeOpacity: '更改不透明度',
	awayMode: '離開模式',
	copyImageToClipboard: '複製媒體至剪貼簿',
	moveSelectedMedia: '移動媒體到...',
	copySelectedMedia: '複製媒體到...',
	convertToEmbed: '嵌入至畫布檔案...',
	resetSize: '重置為原始大小',
	swapImage: '替換媒體…',
	swapModalTitle: '替換媒體',
	swapFromVault: '從庫中選擇',
	swapFromFile: '從檔案選擇',
	swapSearchPlaceholder: '在庫中搜尋媒體…',
	swapDropZoneHint: '將媒體檔案拖放至此，或',
	swapBrowseBtn: '瀏覽…',
	swapFromClipboard: '從剪貼簿貼上',
	swapBtn: '替換',
	swapSuccess: '媒體已替換！',
};

const es: TranslationSchema = {
	settingsHeading: 'Visualización y lienzo',
	hideImageLabelName: 'Ocultar etiqueta de medios',
	hideImageLabelDesc: 'Oculta la cabecera de la etiqueta base64 URL / datos que se muestra sobre las tarjetas de medios insertadas.',
	keyboardPanHeading: 'Controles de desplazamiento del lienzo por teclado',
	panControlsName: 'Controles de desplazamiento',
	panControlsDesc: 'Conjunto de teclas para desplazar el lienzo.',
	restoreDefaultTooltip: 'Restaurar por defecto',
	updatePanControlsButton: 'Actualizar controles de desplazamiento',
	maxPanSpeedName: 'Velocidad máxima de desplazamiento',
	maxPanSpeedDesc: 'Unidades del lienzo para desplazar',
	keyboardZoomHeading: 'Controles de zoom del lienzo por teclado',
	zoomControlsName: 'Controles de zoom',
	zoomControlsDesc: 'Conjunto de teclas para acercar y alejar el lienzo.',
	updateZoomControlsButton: 'Actualizar controles de zoom',
	zoomSpeedName: 'Velocidad de zoom',
	zoomSpeedDesc: 'Tasa de cambio de zoom por fotograma',
	duplicateKeyNotice: 'No se permiten asignaciones de teclas duplicadas. Por favor, elija teclas únicas para cada acción.',

	modalTitle: 'Añadir medios al archivo de lienzo',
	modalDescription: (filename: string) => `¿Cómo desea guardar "${filename}"?`,
	applyRemaining: (count: number) => `Aplicar opción a los ${count} medios restantes`,
	saveToVault: 'Guardar en la bóveda',
	embedInCanvas: 'Incrustar en el archivo de lienzo',

	convertModalTitle: 'Incrustar medios en el archivo de lienzo',
	convertModalDesc: (filename: string) => `Incrustando "${filename}" directamente en el archivo de lienzo. ¿Qué desea hacer con el archivo original de la bóveda?`,
	applyRemainingConvert: (count: number) => `Aplicar opción a los ${count} archivos de medios restantes`,
	deleteOriginalFile: 'Eliminar archivo original',
	keepOriginalFile: 'Conservar archivo original',

	opacityModalTitle: 'Cambiar opacidad',
	cancelBtn: 'Cancelar',
	applyBtn: 'Aplicar',

	selectTargetFolderPlaceholder: 'Seleccionar carpeta de destino...',
	vaultRootLabel: '/ (Raíz de la bóveda)',

	flipHorizontal: 'Voltear horizontalmente',
	flipVertical: 'Voltear verticalmente',
	toggleGrayscale: 'Alternar escala de grises',
	togglePalette: 'Paleta de colores',
	changeOpacity: 'Cambiar opacidad',
	awayMode: 'Modo ausente',
	copyImageToClipboard: 'Copiar medios al portapapeles',
	moveSelectedMedia: 'Mover medios a...',
	copySelectedMedia: 'Copiar medios a...',
	convertToEmbed: 'Incrustar en el archivo de lienzo...',
	resetSize: 'Restablecer al tamaño original',
	swapImage: 'Cambiar medio…',
	swapModalTitle: 'Cambiar medio',
	swapFromVault: 'Desde el vault',
	swapFromFile: 'Desde archivo',
	swapSearchPlaceholder: 'Buscar medios en el vault…',
	swapDropZoneHint: 'Suelta un archivo multimedia aquí, o',
	swapBrowseBtn: 'Explorar…',
	swapFromClipboard: 'Pegar desde el portapapeles',
	swapBtn: 'Cambiar',
	swapSuccess: '¡Medio cambiado!',
};

const fr: TranslationSchema = {
	settingsHeading: 'Affichage et canevas',
	hideImageLabelName: 'Masquer l’étiquette des médias',
	hideImageLabelDesc: 'Masquer l’en-tête de l’étiquette URL / données base64 affiché au-dessus des cartes de médias intégrées.',
	keyboardPanHeading: 'Commandes de panoramique du canevas au clavier',
	panControlsName: 'Commandes de panoramique',
	panControlsDesc: 'Ensemble de touches pour faire défiler le canevas.',
	restoreDefaultTooltip: 'Rétablir les valeurs par défaut',
	updatePanControlsButton: 'Mettre à jour les commandes de panoramique',
	maxPanSpeedName: 'Vitesse de panoramique maximale',
	maxPanSpeedDesc: 'Unités de canevas pour le défilement',
	keyboardZoomHeading: 'Commandes de zoom du canevas au clavier',
	zoomControlsName: 'Commandes de zoom',
	zoomControlsDesc: 'Ensemble de touches pour zoomer et dézoomer sur le canevas.',
	updateZoomControlsButton: 'Mettre à jour les commandes de zoom',
	zoomSpeedName: 'Vitesse de zoom',
	zoomSpeedDesc: 'Taux de modification du zoom par image',
	duplicateKeyNotice: 'Les raccourcis clavier en double ne sont pas autorisés. Veuillez choisir des touches uniques pour chaque action.',

	modalTitle: 'Ajouter un média au fichier de canevas',
	modalDescription: (filename: string) => `Comment souhaitez-vous stocker « ${filename} » ?`,
	applyRemaining: (count: number) => `Appliquer le choix aux ${count} médias restants`,
	saveToVault: 'Enregistrer dans le coffre',
	embedInCanvas: 'Intégrer dans le fichier de canevas',

	convertModalTitle: 'Intégrer le média dans le fichier de canevas',
	convertModalDesc: (filename: string) => `Intégration directe de « ${filename} » dans le fichier de canevas. Que souhaitez-vous faire du fichier d’origine dans le coffre ?`,
	applyRemainingConvert: (count: number) => `Appliquer le choix aux ${count} fichiers médias restants`,
	deleteOriginalFile: 'Supprimer le fichier d’origine',
	keepOriginalFile: 'Conserver le fichier d’origine',

	opacityModalTitle: 'Modifier l’opacité',
	cancelBtn: 'Annuler',
	applyBtn: 'Appliquer',

	selectTargetFolderPlaceholder: 'Sélectionner le dossier cible...',
	vaultRootLabel: '/ (Racine du coffre)',

	flipHorizontal: 'Retourner horizontalement',
	flipVertical: 'Retourner verticalement',
	toggleGrayscale: 'Basculer les niveaux de gris',
	togglePalette: 'Palette de couleurs',
	changeOpacity: 'Modifier l’opacité',
	awayMode: 'Mode Absent',
	copyImageToClipboard: 'Copier le média dans le presse-papiers',
	moveSelectedMedia: 'Déplacer les médias vers...',
	copySelectedMedia: 'Copier les médias vers...',
	convertToEmbed: 'Intégrer dans le fichier de canevas...',
	resetSize: 'Réinitialiser à la taille d’origine',
	swapImage: 'Remplacer le média…',
	swapModalTitle: 'Remplacer le média',
	swapFromVault: 'Depuis le coffre',
	swapFromFile: 'Depuis un fichier',
	swapSearchPlaceholder: 'Rechercher un média dans le coffre…',
	swapDropZoneHint: 'Déposez un fichier média ici, ou',
	swapBrowseBtn: 'Parcourir…',
	swapFromClipboard: 'Coller depuis le presse-papiers',
	swapBtn: 'Remplacer',
	swapSuccess: 'Média remplacé !',
};

const de: TranslationSchema = {
	settingsHeading: 'Anzeige & Canvas',
	hideImageLabelName: 'Medienbeschriftung ausblenden',
	hideImageLabelDesc: 'Blendet die Base64-URL-/-Datenbeschriftung aus, die über eingebetteten Medienkarten angezeigt wird.',
	keyboardPanHeading: 'Canvas Tastatur-Schwenksteuerung',
	panControlsName: 'Schwenksteuerung',
	panControlsDesc: 'Tastenkombination zum Schwenken des Canvas.',
	restoreDefaultTooltip: 'Standard wiederherstellen',
	updatePanControlsButton: 'Schwenksteuerung aktualisieren',
	maxPanSpeedName: 'Maximale Schwenkgeschwindigkeit',
	maxPanSpeedDesc: 'Zu schwenkende Canvas-Einheiten',
	keyboardZoomHeading: 'Canvas Tastatur-Zoomsteuerung',
	zoomControlsName: 'Zoomsteuerung',
	zoomControlsDesc: 'Tastenkombination zum Vergrößern und Verkleinern des Canvas.',
	updateZoomControlsButton: 'Zoomsteuerung aktualisieren',
	zoomSpeedName: 'Zoomgeschwindigkeit',
	zoomSpeedDesc: 'Rate der Zoomänderung pro Frame',
	duplicateKeyNotice: 'Doppelte Tastenbelegungen sind nicht erlaubt. Bitte wählen Sie eindeutige Tasten für jede Aktion.',

	modalTitle: 'Medien zur Canvas-Datei hinzufügen',
	modalDescription: (filename: string) => `Wie möchten Sie „${filename}“ speichern?`,
	applyRemaining: (count: number) => `Auswahl auf die verbleibenden ${count} Medien anwenden`,
	saveToVault: 'Im Tresor speichern',
	embedInCanvas: 'In Canvas-Datei einbetten',

	convertModalTitle: 'Medien in Canvas-Datei einbetten',
	convertModalDesc: (filename: string) => `„${filename}“ wird direkt in die Canvas-Datei eingebettet. Was möchten Sie mit der ursprünglichen Tresordatei tun?`,
	applyRemainingConvert: (count: number) => `Auswahl auf die verbleibenden ${count} Mediendateien anwenden`,
	deleteOriginalFile: 'Originaldatei löschen',
	keepOriginalFile: 'Originaldatei behalten',

	opacityModalTitle: 'Deckkraft ändern',
	cancelBtn: 'Abbrechen',
	applyBtn: 'Übernehmen',

	selectTargetFolderPlaceholder: 'Zielordner auswählen...',
	vaultRootLabel: '/ (Tresor-Stammverzeichnis)',

	flipHorizontal: 'Horizontal spiegeln',
	flipVertical: 'Vertikal spiegeln',
	toggleGrayscale: 'Graustufen umschalten',
	togglePalette: 'Farbpalette',
	changeOpacity: 'Deckkraft ändern',
	awayMode: 'Abwesend-Modus',
	copyImageToClipboard: 'Medien in Zwischenablage kopieren',
	moveSelectedMedia: 'Medien verschieben nach...',
	copySelectedMedia: 'Medien kopieren nach...',
	convertToEmbed: 'In Canvas-Datei einbetten...',
	resetSize: 'Auf Originalgröße zurücksetzen',
	swapImage: 'Medien austauschen…',
	swapModalTitle: 'Medien austauschen',
	swapFromVault: 'Aus dem Vault',
	swapFromFile: 'Aus Datei',
	swapSearchPlaceholder: 'Medien im Vault suchen…',
	swapDropZoneHint: 'Mediendatei hier ablegen, oder',
	swapBrowseBtn: 'Durchsuchen…',
	swapFromClipboard: 'Aus Zwischenablage einfügen',
	swapBtn: 'Austauschen',
	swapSuccess: 'Medien ausgetauscht!',
};

const ja: TranslationSchema = {
	settingsHeading: '表示とキャンバス',
	hideImageLabelName: 'メディアラベルを非表示',
	hideImageLabelDesc: '埋め込まれたキャンバスメディアカードの上に表示されるbase64 URL / データラベルヘッダーを非表示にします。',
	keyboardPanHeading: 'キャンバスキーボードパン操作',
	panControlsName: 'パン操作',
	panControlsDesc: 'キャンバスをパン移動するキーのセット。',
	restoreDefaultTooltip: 'デフォルトに戻す',
	updatePanControlsButton: 'パン操作を更新',
	maxPanSpeedName: '最大パン速度',
	maxPanSpeedDesc: '移動するキャンバス単位数',
	keyboardZoomHeading: 'キャンバスキーボードズーム操作',
	zoomControlsName: 'ズーム操作',
	zoomControlsDesc: 'キャンバスを拡大・縮小するキーのセット。',
	updateZoomControlsButton: 'ズーム操作を更新',
	zoomSpeedName: 'ズーム速度',
	zoomSpeedDesc: 'フレームあたりのズーム変化率',
	duplicateKeyNotice: '重複したキー割り当ては許可されていません。各操作に一意のキーを選択してください。',

	modalTitle: 'キャンバスファイルにメディアを追加',
	modalDescription: (filename: string) => `「${filename}」をどのように保存しますか？`,
	applyRemaining: (count: number) => `残りの${count}件のメディアにこの選択を適用`,
	saveToVault: '保管庫に保存',
	embedInCanvas: 'キャンバスファイルに埋め込む',

	convertModalTitle: 'キャンバスファイルにメディアを埋め込む',
	convertModalDesc: (filename: string) => `「${filename}」をキャンバスファイルに直接埋め込みます。元の保管庫ファイルはどうしますか？`,
	applyRemainingConvert: (count: number) => `残りの${count}件のメディアファイルにこの選択を適用`,
	deleteOriginalFile: '元のファイルを削除',
	keepOriginalFile: '元のファイルを保持',

	opacityModalTitle: '不透明度を変更',
	cancelBtn: 'キャンセル',
	applyBtn: '適用',

	selectTargetFolderPlaceholder: '対象フォルダを選択...',
	vaultRootLabel: '/ (保管庫ルート)',

	flipHorizontal: '左右反転',
	flipVertical: '上下反転',
	toggleGrayscale: '白黒切り替え',
	togglePalette: 'カラーパレット',
	changeOpacity: '不透明度を変更',
	awayMode: 'アウェイモード',
	copyImageToClipboard: 'メディアをクリップボードにコピー',
	moveSelectedMedia: 'メディアを移動...',
	copySelectedMedia: 'メディア를 コピー...',
	convertToEmbed: 'キャンバスファイルに埋め込む...',
	resetSize: '元のサイズに戻す',
	swapImage: 'メディアを差し替え…',
	swapModalTitle: 'メディアを差し替え',
	swapFromVault: 'Vaultから選択',
	swapFromFile: 'ファイルから選択',
	swapSearchPlaceholder: 'Vault内のメディアを検索…',
	swapDropZoneHint: 'メディアファイルをここにドロップ、または',
	swapBrowseBtn: '参照…',
	swapFromClipboard: 'クリップボードから貼り付け',
	swapBtn: '差し替え',
	swapSuccess: 'メディアを差し替えました！',
};

const ko: TranslationSchema = {
	settingsHeading: '표시 및 캔버스',
	hideImageLabelName: '미디어 레이블 숨기기',
	hideImageLabelDesc: '임베디드 캔버스 미디어 카드 위에 표시되는 base64 URL / 데이터 레이블 헤더를 숨깁니다.',
	keyboardPanHeading: '캔버스 키보드 이동 조작',
	panControlsName: '이동 조작',
	panControlsDesc: '캔버스를 이동할 키 설정입니다.',
	restoreDefaultTooltip: '기본값으로 복원',
	updatePanControlsButton: '이동 조작 업데이트',
	maxPanSpeedName: '최대 이동 속도',
	maxPanSpeedDesc: '이동할 캔버스 단위',
	keyboardZoomHeading: '캔버스 키보드 확대/축소 조작',
	zoomControlsName: '확대/축소 조작',
	zoomControlsDesc: '캔버스를 확대 및 축소할 키 설정입니다.',
	updateZoomControlsButton: '확대/축소 조작 업데이트',
	zoomSpeedName: '확대/축소 속도',
	zoomSpeedDesc: '프레임당 확대/축소 변화율',
	duplicateKeyNotice: '중복된 키 바인딩은 허용되지 않습니다. 각 작업에 고유한 키를 선택하세요.',

	modalTitle: '캔버스 파일에 미디어 추가',
	modalDescription: (filename: string) => `"${filename}"을(를) 어떻게 저장하시겠습니까?`,
	applyRemaining: (count: number) => `남은 미디어 ${count}개에 선택 적용`,
	saveToVault: '보관함에 저장',
	embedInCanvas: '캔버스 파일에 임베드',

	convertModalTitle: '캔버스 파일에 미디어 임베드',
	convertModalDesc: (filename: string) => `"${filename}"을(를) 캔버스 파일에 직접 임베드합니다. 원본 보관함 파일을 어떻게 하시겠습니까?`,
	applyRemainingConvert: (count: number) => `남은 미디어 파일 ${count}개에 선택 적용`,
	deleteOriginalFile: '원본 파일 삭제',
	keepOriginalFile: '원본 파일 유지',

	opacityModalTitle: '불투명도 변경',
	cancelBtn: '취소',
	applyBtn: '적용',

	selectTargetFolderPlaceholder: '대상 폴더 선택...',
	vaultRootLabel: '/ (보관함 루트)',

	flipHorizontal: '좌우 반전',
	flipVertical: '상하 반전',
	toggleGrayscale: '흑백 전환',
	togglePalette: '색상 팔레트',
	changeOpacity: '불투명도 변경',
	awayMode: '자리 비움 모드',
	copyImageToClipboard: '미디어를 클립보드에 복사',
	moveSelectedMedia: '미디어 이동...',
	copySelectedMedia: '미디어 복사...',
	convertToEmbed: '캔버스 파일에 임베드...',
	resetSize: '원래 크기로 복원',
	swapImage: '미디어 교체…',
	swapModalTitle: '미디어 교체',
	swapFromVault: '볼트에서 선택',
	swapFromFile: '파일에서 선택',
	swapSearchPlaceholder: '볼트에서 미디어 검색…',
	swapDropZoneHint: '여기에 미디어 파일을 놓거나',
	swapBrowseBtn: '찾아보기…',
	swapFromClipboard: '클립보드에서 붙여넣기',
	swapBtn: '교체',
	swapSuccess: '미디어가 교체되었습니다!',
};

const ru: TranslationSchema = {
	settingsHeading: 'Отображение и холст',
	hideImageLabelName: 'Скрыть метку медиа',
	hideImageLabelDesc: 'Скрыть заголовок метки base64 URL / данных над встроенными карточками медиа.',
	keyboardPanHeading: 'Управление панорамированием холста с клавиатуры',
	panControlsName: 'Управление панорамированием',
	panControlsDesc: 'Клавиши для перемещения по холсту.',
	restoreDefaultTooltip: 'Восстановить по умолчанию',
	updatePanControlsButton: 'Обновить управление панорамированием',
	maxPanSpeedName: 'Максимальная скорость панорамирования',
	maxPanSpeedDesc: 'Единицы холста для перемещения',
	keyboardZoomHeading: 'Управление масштабированием холста с клавиатуры',
	zoomControlsName: 'Управление масштабированием',
	zoomControlsDesc: 'Клавиши для приближения и отдаления холста.',
	updateZoomControlsButton: 'Обновить управление масштабированием',
	zoomSpeedName: 'Скорость масштабирования',
	zoomSpeedDesc: 'Скорость изменения масштаба за кадр',
	duplicateKeyNotice: 'Дублирование привязок клавиш не допускается. Пожалуйста, выберите уникальные клавиши для каждого действия.',

	modalTitle: 'Добавить медиа в файл холста',
	modalDescription: (filename: string) => `Как вы хотите сохранить «${filename}»?`,
	applyRemaining: (count: number) => `Применить выбор к оставшимся ${count} медиа`,
	saveToVault: 'Сохранить в хранилище',
	embedInCanvas: 'Встроить в файл холста',

	convertModalTitle: 'Встроить медиа в файл холста',
	convertModalDesc: (filename: string) => `Встраивание «${filename}» непосредственно в файл холста. Что вы хотите сделать с исходным файлом хранилища?`,
	applyRemainingConvert: (count: number) => `Применить выбор к оставшимся ${count} медиафайлам`,
	deleteOriginalFile: 'Удалить исходный файл',
	keepOriginalFile: 'Сохранить исходный файл',

	opacityModalTitle: 'Изменить прозрачность',
	cancelBtn: 'Отмена',
	applyBtn: 'Применить',

	selectTargetFolderPlaceholder: 'Выберите целевую папку...',
	vaultRootLabel: '/ (Корень хранилища)',

	flipHorizontal: 'Отразить по горизонтали',
	flipVertical: 'Отразить по вертикали',
	toggleGrayscale: 'Переключить оттенки серого',
	togglePalette: 'Цветовая палитра',
	changeOpacity: 'Изменить прозрачность',
	awayMode: 'Режим «Отсутствие»',
	copyImageToClipboard: 'Скопировать медиа в буфер обмена',
	moveSelectedMedia: 'Переместить медиа в...',
	copySelectedMedia: 'Скопировать медиа в...',
	convertToEmbed: 'Встроить в файл холста...',
	resetSize: 'Сбросить до исходного размера',
	swapImage: 'Заменить медиа…',
	swapModalTitle: 'Заменить медиа',
	swapFromVault: 'Из хранилища',
	swapFromFile: 'Из файла',
	swapSearchPlaceholder: 'Поиск медиафайлов в хранилище…',
	swapDropZoneHint: 'Перетащите медиафайл сюда или',
	swapBrowseBtn: 'Обзор…',
	swapFromClipboard: 'Вставить из буфера обмена',
	swapBtn: 'Заменить',
	swapSuccess: 'Медиа заменено!',
};

const pt: TranslationSchema = {
	settingsHeading: 'Exibição e tela',
	hideImageLabelName: 'Ocultar rótulo de mídia',
	hideImageLabelDesc: 'Ocultar o cabeçalho do rótulo de dados / URL base64 exibido acima dos cartões de mídia incorporados.',
	keyboardPanHeading: 'Controles de navegação na tela por teclado',
	panControlsName: 'Controles de navegação',
	panControlsDesc: 'Conjunto de teclas para navegar pela tela.',
	restoreDefaultTooltip: 'Restaurar padrão',
	updatePanControlsButton: 'Atualizar controles de navegação',
	maxPanSpeedName: 'Velocidade máxima de navegação',
	maxPanSpeedDesc: 'Unidades de tela para mover',
	keyboardZoomHeading: 'Controles de zoom na tela por teclado',
	zoomControlsName: 'Controles de zoom',
	zoomControlsDesc: 'Conjunto de teclas para aproximar e afastar a tela.',
	updateZoomControlsButton: 'Atualizar controles de zoom',
	zoomSpeedName: 'Velocidade do zoom',
	zoomSpeedDesc: 'Taxa de alteração do zoom por quadro',
	duplicateKeyNotice: 'Teclas duplicadas não são permitidas. Por favor, escolha teclas únicas para cada ação.',

	modalTitle: 'Adicionar mídia ao arquivo de tela',
	modalDescription: (filename: string) => `Como você gostaria de armazenar "${filename}"?`,
	applyRemaining: (count: number) => `Aplicar escolha às ${count} mídias restantes`,
	saveToVault: 'Salvar no cofre',
	embedInCanvas: 'Incorporar no arquivo de tela',

	convertModalTitle: 'Incorporar mídia no arquivo de tela',
	convertModalDesc: (filename: string) => `Incorporando "${filename}" diretamente no arquivo de tela. O que você deseja fazer com o arquivo original do cofre?`,
	applyRemainingConvert: (count: number) => `Aplicar escolha aos ${count} arquivos de mídia restantes`,
	deleteOriginalFile: 'Excluir arquivo original',
	keepOriginalFile: 'Manter arquivo original',

	opacityModalTitle: 'Alterar opacidade',
	cancelBtn: 'Cancelar',
	applyBtn: 'Aplicar',

	selectTargetFolderPlaceholder: 'Selecionar pasta de destino...',
	vaultRootLabel: '/ (Raiz do cofre)',

	flipHorizontal: 'Inverter horizontalmente',
	flipVertical: 'Inverter verticalmente',
	toggleGrayscale: 'Alternar escala de cinza',
	togglePalette: 'Paleta de cores',
	changeOpacity: 'Alterar opacidade',
	awayMode: 'Modo ausente',
	copyImageToClipboard: 'Copiar mídia para a área de transferência',
	moveSelectedMedia: 'Mover mídia para...',
	copySelectedMedia: 'Copiar mídia para...',
	convertToEmbed: 'Incorporar no arquivo de tela...',
	resetSize: 'Redefinir para o tamanho original',
	swapImage: 'Trocar mídia…',
	swapModalTitle: 'Trocar mídia',
	swapFromVault: 'Do vault',
	swapFromFile: 'Do arquivo',
	swapSearchPlaceholder: 'Pesquisar mídia no vault…',
	swapDropZoneHint: 'Solte um arquivo de mídia aqui, ou',
	swapBrowseBtn: 'Procurar…',
	swapFromClipboard: 'Colar da área de transferência',
	swapBtn: 'Trocar',
	swapSuccess: 'Mídia trocada!',
};

const it: TranslationSchema = {
	settingsHeading: 'Visualizzazione e tela',
	hideImageLabelName: 'Nascondi etichetta media',
	hideImageLabelDesc: 'Nasconde l’intestazione dell’etichetta dati / URL base64 visualizzata sopra le schede media incorporate.',
	keyboardPanHeading: 'Controlli di panoramica della tela da tastiera',
	panControlsName: 'Controlli di panoramica',
	panControlsDesc: 'Insieme di tasti per spostare la tela.',
	restoreDefaultTooltip: 'Ripristina predefiniti',
	updatePanControlsButton: 'Aggiorna controlli di panoramica',
	maxPanSpeedName: 'Velocità massima di panoramica',
	maxPanSpeedDesc: 'Unità della tela per lo spostamento',
	keyboardZoomHeading: 'Controlli di zoom della tela da tastiera',
	zoomControlsName: 'Controlli di zoom',
	zoomControlsDesc: 'Insieme di tasti per ingrandire e rimpicciolire la tela.',
	updateZoomControlsButton: 'Aggiorna controlli di zoom',
	zoomSpeedName: 'Velocità di zoom',
	zoomSpeedDesc: 'Tasso di modifica dello zoom per fotogramma',
	duplicateKeyNotice: 'Le scorciatoie da tastiera duplicate non sono consentite. Scegli tasti univoci per ogni azione.',

	modalTitle: 'Aggiungi media al file della tela',
	modalDescription: (filename: string) => `Come desideri memorizzare "${filename}"?`,
	applyRemaining: (count: number) => `Applica scelta ai restanti ${count} media`,
	saveToVault: 'Salva nella cassaforte',
	embedInCanvas: 'Incorpora nel file della tela',

	convertModalTitle: 'Incorpora media nel file della tela',
	convertModalDesc: (filename: string) => `Incorporamento di "${filename}" direttamente nel file della tela. Cosa desideri fare con il file originale della cassaforte?`,
	applyRemainingConvert: (count: number) => `Applica scelta ai restanti ${count} file media`,
	deleteOriginalFile: 'Elimina file originale',
	keepOriginalFile: 'Conserva file originale',

	opacityModalTitle: 'Cambia opacità',
	cancelBtn: 'Annulla',
	applyBtn: 'Applica',

	selectTargetFolderPlaceholder: 'Seleziona cartella di destinazione...',
	vaultRootLabel: '/ (Radice della cassaforte)',

	flipHorizontal: 'Capovolgi orizzontalmente',
	flipVertical: 'Capovolgi verticalmente',
	toggleGrayscale: 'Attiva/disattiva scala di grigi',
	togglePalette: 'Tavolozza dei colori',
	changeOpacity: 'Cambia opacità',
	awayMode: 'Modalità assente',
	copyImageToClipboard: 'Copia media negli appunti',
	moveSelectedMedia: 'Sposta media in...',
	copySelectedMedia: 'Copia media in...',
	convertToEmbed: 'Incorpora nel file della tela...',
	resetSize: 'Ripristina dimensione originale',
	swapImage: 'Sostituisci media…',
	swapModalTitle: 'Sostituisci media',
	swapFromVault: 'Dal vault',
	swapFromFile: 'Da file',
	swapSearchPlaceholder: 'Cerca media nel vault…',
	swapDropZoneHint: 'Trascina un file multimediale qui, o',
	swapBrowseBtn: 'Sfoglia…',
	swapFromClipboard: 'Incolla dagli appunti',
	swapBtn: 'Sostituisci',
	swapSuccess: 'Media sostituito!',
};

const ar: TranslationSchema = {
	settingsHeading: 'العرض واللوحة',
	hideImageLabelName: 'إخفاء تسمية الوسائط',
	hideImageLabelDesc: 'إخفاء رأس تسمية عنوان URL / البيانات base64 المعروض فوق بطاقات وسائط اللوحة المضمنة.',
	keyboardPanHeading: 'عناصر التحكم في التمرير بلوحة المفاتيح',
	panControlsName: 'عناصر تحكم التمرير',
	panControlsDesc: 'مجموعة المفاتيح المستخدمة لتمرير اللوحة.',
	restoreDefaultTooltip: 'استعادة الإعدادات الافتراضية',
	updatePanControlsButton: 'تحديث عناصر تحكم التمرير',
	maxPanSpeedName: 'السرعة القصوى للتمرير',
	maxPanSpeedDesc: 'وحدات اللوحة للتمرير بها',
	keyboardZoomHeading: 'عناصر التحكم في التكبير/التصغير بلوحة المفاتيح',
	zoomControlsName: 'عناصر تحكم التكبير/التصغير',
	zoomControlsDesc: 'مجموعة المفاتيح المستخدمة للتكبير والتصغير على اللوحة.',
	updateZoomControlsButton: 'تحديث عناصر تحكم التكبير/التصغير',
	zoomSpeedName: 'سرعة التكبير/التصغير',
	zoomSpeedDesc: 'معدل تغيير التكبير/التصغير لكل إطار',
	duplicateKeyNotice: 'غير مسموح بتكرار تعيين المفاتيح. يرجى اختيار مفاتيح فريدة لكل إجراء.',

	modalTitle: 'إضافة وسائط إلى ملف اللوحة',
	modalDescription: (filename: string) => `كيف ترغب في تخزين "${filename}"؟`,
	applyRemaining: (count: number) => `تطبيق الخيار على الوسائط المتبقية وعددها ${count}`,
	saveToVault: 'حفظ في الخزنة',
	embedInCanvas: 'تضمين في ملف اللوحة',

	convertModalTitle: 'تضمين الوسائط في ملف اللوحة',
	convertModalDesc: (filename: string) => `تضمين "${filename}" مباشرة في ملف اللوحة. ماذا تريد أن تفعل بملف الخزنة الأصلي؟`,
	applyRemainingConvert: (count: number) => `تطبيق الخيار على ملفات الوسائط المتبقية وعددها ${count}`,
	deleteOriginalFile: 'حذف الملف الأصلي',
	keepOriginalFile: 'الاحتفاظ بالملف الأصلي',

	opacityModalTitle: 'تغيير الشفافية',
	cancelBtn: 'إلغاء',
	applyBtn: 'تطبيق',

	selectTargetFolderPlaceholder: 'اختر المجلد الهدف...',
	vaultRootLabel: '/ (جذر الخزنة)',

	flipHorizontal: 'قلب أفقي',
	flipVertical: 'قلب رأسي',
	toggleGrayscale: 'تبديل التدرج الرمادي',
	togglePalette: 'لوحة الألوان',
	changeOpacity: 'تغيير الشفافية',
	awayMode: 'وضع الابتعاد',
	copyImageToClipboard: 'نسخ الوسائط إلى الحافظة',
	moveSelectedMedia: 'نقل الوسائط إلى...',
	copySelectedMedia: 'نسخ الوسائط إلى...',
	convertToEmbed: 'تضمين في ملف اللوحة...',
	resetSize: 'إعادة الضبط إلى الحجم الأصلي',
	swapImage: 'استبدال الوسائط…',
	swapModalTitle: 'استبدال الوسائط',
	swapFromVault: 'من الخزنة',
	swapFromFile: 'من ملف',
	swapSearchPlaceholder: 'ابحث عن وسائط في الخزنة…',
	swapDropZoneHint: 'أسقط ملف وسائط هنا، أو',
	swapBrowseBtn: 'استعراض…',
	swapFromClipboard: 'لصق من الحافظة',
	swapBtn: 'استبدال',
	swapSuccess: 'تم استبدال الوسائط!',
};

const he: TranslationSchema = {
	settingsHeading: 'תצוגה וקנבס',
	hideImageLabelName: 'הסתר תווית מדיה',
	hideImageLabelDesc: 'הסתר את כותרת התווית של base64 URL / נתונים המוצגת מעל כרטיסי המדיה המוטמעים בקנבס.',
	keyboardPanHeading: 'פקדי הזזת קנבס באמצעות המקלדת',
	panControlsName: 'פקדי הזזה',
	panControlsDesc: 'אילו מקשים מזיזים את הקנבס.',
	restoreDefaultTooltip: 'שחזר ברירת מחדל',
	updatePanControlsButton: 'עדכן פקדי הזזה',
	maxPanSpeedName: 'מהירות הזזה מרבית',
	maxPanSpeedDesc: 'יחידות קנבס להזזה בכל שלב',
	keyboardZoomHeading: 'פקדי תקריב קנבס באמצעות המקלדת',
	zoomControlsName: 'פקדי תקריב',
	zoomControlsDesc: 'אילו מקשים מגדילים ומקטינים את התצוגה בקנבס.',
	updateZoomControlsButton: 'עדכן פקדי תקריב',
	zoomSpeedName: 'מהירות תקריב',
	zoomSpeedDesc: 'קצב שינוי התקריב לכל פריים',
	duplicateKeyNotice: 'כפילות מקשים אינה מותרת. נא לבחור מקש ייחודי לכל פעולה.',

	modalTitle: 'הוספת מדיה לקובץ הקנבס',
	modalDescription: (filename: string) => `כיצד ברצונך לאחסן את "${filename}"?`,
	applyRemaining: (count: number) => `החל בחירה על ${count} פריטי המדיה הנותרים`,
	saveToVault: 'שמור בכספת',
	embedInCanvas: 'הטמע בקובץ הקנבס',

	convertModalTitle: 'הטמעת מדיה בקובץ הקנבס',
	convertModalDesc: (filename: string) => `מטמיע את "${filename}" ישירות בקובץ הקנבס. מה ברצונך לעשות עם קובץ הכספת המקורי?`,
	applyRemainingConvert: (count: number) => `החל בחירה على ${count} קובצי המדיה הנותרים`,
	deleteOriginalFile: 'מחק קובץ מקורי',
	keepOriginalFile: 'שמור קובץ מקורי',

	opacityModalTitle: 'שנה אטימות',
	cancelBtn: 'ביטול',
	applyBtn: 'החל',

	selectTargetFolderPlaceholder: 'בחר תיקיית יעד...',
	vaultRootLabel: '/ (שורש הכספת)',

	flipHorizontal: 'הפוך אופקית',
	flipVertical: 'הפוך אנכית',
	toggleGrayscale: 'גווני אפור',
	togglePalette: 'פלטת צבעים',
	changeOpacity: 'שנה אטימות',
	awayMode: 'מצב היעדרות',
	copyImageToClipboard: 'העתק מדיה ללוח',
	moveSelectedMedia: 'העבר מדיה אל...',
	copySelectedMedia: 'העתק מדיה אל...',
	convertToEmbed: 'הטמע בקובץ הקנבس...',
	resetSize: 'אפס לגודל המקורי',
	swapImage: 'החלף מדיה…',
	swapModalTitle: 'החלף מדיה',
	swapFromVault: 'מהכספת',
	swapFromFile: 'מקובץ',
	swapSearchPlaceholder: 'חפש מדיה בכספת…',
	swapDropZoneHint: 'שחרר קובץ מדיה כאן, או',
	swapBrowseBtn: 'עיון…',
	swapFromClipboard: 'הדבק מלוח הגזירים',
	swapBtn: 'החלף',
	swapSuccess: 'המדיה הוחלפה!',
};

const localeMap: Record<string, TranslationSchema> = {
	en,
	'zh-cn': zh,
	zh,
	'zh-tw': zhTW,
	es,
	fr,
	de,
	ja,
	ko,
	ru,
	pt,
	'pt-br': pt,
	it,
	ar,
	he,
};

export function getText(): TranslationSchema {
	const lang = getLanguage() || moment.locale() || 'en';
	const normalizedLang = lang.toLowerCase();
	return localeMap[normalizedLang] || localeMap[normalizedLang.split('-')[0]] || en;
}


