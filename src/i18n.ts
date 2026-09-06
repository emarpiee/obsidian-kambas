import { getLanguage, moment } from 'obsidian';

export interface TranslationSchema {
	// Settings Tab
	settingsHeading: string;
	hideImageLabelName: string;
	hideImageLabelDesc: string;

	// Modal
	modalTitle: string;
	modalDescription: (filename: string) => string;
	applyRemaining: (count: number) => string;
	saveToVault: string;
	embedInCanvas: string;

	// Context Menu & Hotkeys
	flipHorizontal: string;
	flipVertical: string;
	toggleGrayscale: string;
	changeOpacity: string;
	copyImageToClipboard: string;
	moveSelectedMedia: string;
	copySelectedMedia: string;
	convertToEmbed: string;
	resetSize: string;
}

const en: TranslationSchema = {
	settingsHeading: 'Display & canvas',
	hideImageLabelName: 'Hide media label',
	hideImageLabelDesc: 'Hide the base64 URL / data label header displayed above embedded canvas media cards.',

	modalTitle: 'Add media to canvas file',
	modalDescription: (filename: string) => `How would you like to store "${filename}"?`,
	applyRemaining: (count: number) => `Apply choice to remaining ${count} media`,
	saveToVault: 'Save to vault',
	embedInCanvas: 'Embed in canvas file',

	flipHorizontal: 'Flip horizontal',
	flipVertical: 'Flip vertical',
	toggleGrayscale: 'Toggle grayscale',
	changeOpacity: 'Change opacity',
	copyImageToClipboard: 'Copy media to clipboard',
	moveSelectedMedia: 'Move media to...',
	copySelectedMedia: 'Copy media to...',
	convertToEmbed: 'Embed in canvas file...',
	resetSize: 'Reset to original size',
};

const zh: TranslationSchema = {
	settingsHeading: '显示与画布',
	hideImageLabelName: '隐藏媒体标签',
	hideImageLabelDesc: '隐藏嵌入式画布媒体卡片上方显示的 base64 URL / 数据标签标头。',

	modalTitle: '添加媒体到画布文件',
	modalDescription: (filename: string) => `您希望如何存储 "${filename}"？`,
	applyRemaining: (count: number) => `将选择应用到剩余的 ${count} 个媒体`,
	saveToVault: '保存到宝库',
	embedInCanvas: '嵌入到画布文件',

	flipHorizontal: '水平翻转',
	flipVertical: '垂直翻转',
	toggleGrayscale: '切换灰度',
	changeOpacity: '更改不透明度',
	copyImageToClipboard: '复制媒体到剪贴板',
	moveSelectedMedia: '移动媒体到...',
	copySelectedMedia: '复制媒体到...',
	convertToEmbed: '嵌入到画布文件...',
	resetSize: '重置为原始大小',
};

const zhTW: TranslationSchema = {
	settingsHeading: '顯示與畫布',
	hideImageLabelName: '隱藏媒體標籤',
	hideImageLabelDesc: '隱藏嵌入式畫布媒體卡片上方顯示的 base64 URL / 資料標籤標頭。',

	modalTitle: '新增媒體至畫布檔案',
	modalDescription: (filename: string) => `您希望如何儲存 "${filename}"？`,
	applyRemaining: (count: number) => `將選擇套用至剩餘的 ${count} 個媒體`,
	saveToVault: '儲存至寶庫',
	embedInCanvas: '嵌入至畫布檔案',

	flipHorizontal: '水平翻轉',
	flipVertical: '垂直翻轉',
	toggleGrayscale: '切換灰階',
	changeOpacity: '更改不透明度',
	copyImageToClipboard: '複製媒體至剪貼簿',
	moveSelectedMedia: '移動媒體到...',
	copySelectedMedia: '複製媒體到...',
	convertToEmbed: '嵌入至畫布檔案...',
	resetSize: '重置為原始大小',
};

const es: TranslationSchema = {
	settingsHeading: 'Visualización y lienzo',
	hideImageLabelName: 'Ocultar etiqueta de medios',
	hideImageLabelDesc: 'Oculta la cabecera de la etiqueta base64 URL / datos que se muestra sobre las tarjetas de medios insertadas.',

	modalTitle: 'Añadir medios al archivo de lienzo',
	modalDescription: (filename: string) => `¿Cómo desea guardar "${filename}"?`,
	applyRemaining: (count: number) => `Aplicar opción a los ${count} medios restantes`,
	saveToVault: 'Guardar en la bóveda',
	embedInCanvas: 'Incrustar en el archivo de lienzo',

	flipHorizontal: 'Voltear horizontalmente',
	flipVertical: 'Voltear verticalmente',
	toggleGrayscale: 'Alternar escala de grises',
	changeOpacity: 'Cambiar opacidad',
	copyImageToClipboard: 'Copiar medios al portapapeles',
	moveSelectedMedia: 'Mover medios a...',
	copySelectedMedia: 'Copiar medios a...',
	convertToEmbed: 'Incrustar en el archivo de lienzo...',
	resetSize: 'Restablecer al tamaño original',
};

const fr: TranslationSchema = {
	settingsHeading: 'Affichage et canevas',
	hideImageLabelName: 'Masquer l’étiquette des médias',
	hideImageLabelDesc: 'Masquer l’en-tête de l’étiquette URL / données base64 affiché au-dessus des cartes de médias intégrées.',

	modalTitle: 'Ajouter un média au fichier de canevas',
	modalDescription: (filename: string) => `Comment souhaitez-vous stocker « ${filename} » ?`,
	applyRemaining: (count: number) => `Appliquer le choix aux ${count} médias restants`,
	saveToVault: 'Enregistrer dans le coffre',
	embedInCanvas: 'Intégrer dans le fichier de canevas',

	flipHorizontal: 'Retourner horizontalement',
	flipVertical: 'Retourner verticalement',
	toggleGrayscale: 'Basculer les niveaux de gris',
	changeOpacity: 'Modifier l’opacité',
	copyImageToClipboard: 'Copier le média dans le presse-papiers',
	moveSelectedMedia: 'Déplacer les médias vers...',
	copySelectedMedia: 'Copier les médias vers...',
	convertToEmbed: 'Intégrer dans le fichier de canevas...',
	resetSize: 'Réinitialiser à la taille d’origine',
};

const de: TranslationSchema = {
	settingsHeading: 'Anzeige & Canvas',
	hideImageLabelName: 'Medienbeschriftung ausblenden',
	hideImageLabelDesc: 'Blendet die Base64-URL-/-Datenbeschriftung aus, die über eingebetteten Medienkarten angezeigt wird.',

	modalTitle: 'Medien zur Canvas-Datei hinzufügen',
	modalDescription: (filename: string) => `Wie möchten Sie „${filename}“ speichern?`,
	applyRemaining: (count: number) => `Auswahl auf die verbleibenden ${count} Medien anwenden`,
	saveToVault: 'Im Tresor speichern',
	embedInCanvas: 'In Canvas-Datei einbetten',

	flipHorizontal: 'Horizontal spiegeln',
	flipVertical: 'Vertikal spiegeln',
	toggleGrayscale: 'Graustufen umschalten',
	changeOpacity: 'Deckkraft ändern',
	copyImageToClipboard: 'Medien in Zwischenablage kopieren',
	moveSelectedMedia: 'Medien verschieben nach...',
	copySelectedMedia: 'Medien kopieren nach...',
	convertToEmbed: 'In Canvas-Datei einbetten...',
	resetSize: 'Auf Originalgröße zurücksetzen',
};

const ja: TranslationSchema = {
	settingsHeading: '表示とキャンバス',
	hideImageLabelName: 'メディアラベルを非表示',
	hideImageLabelDesc: '埋め込まれたキャンバスメディアカードの上に表示されるbase64 URL / データラベルヘッダーを非表示にします。',

	modalTitle: 'キャンバスファイルにメディアを追加',
	modalDescription: (filename: string) => `「${filename}」をどのように保存しますか？`,
	applyRemaining: (count: number) => `残りの${count}件のメディアにこの選択を適用`,
	saveToVault: '保管庫に保存',
	embedInCanvas: 'キャンバスファイルに埋め込む',

	flipHorizontal: '左右反転',
	flipVertical: '上下反転',
	toggleGrayscale: '白黒切り替え',
	changeOpacity: '不透明度を変更',
	copyImageToClipboard: 'メディアをクリップボードにコピー',
	moveSelectedMedia: 'メディアを移動...',
	copySelectedMedia: 'メディアをコピー...',
	convertToEmbed: 'キャンバスファイルに埋め込む...',
	resetSize: '元のサイズに戻す',
};

const ko: TranslationSchema = {
	settingsHeading: '표시 및 캔버스',
	hideImageLabelName: '미디어 레이블 숨기기',
	hideImageLabelDesc: '임베디드 캔버스 미디어 카드 위에 표시되는 base64 URL / 데이터 레이블 헤더를 숨깁니다.',

	modalTitle: '캔버스 파일에 미디어 추가',
	modalDescription: (filename: string) => `"${filename}"을(를) 어떻게 저장하시겠습니까?`,
	applyRemaining: (count: number) => `남은 미디어 ${count}개에 선택 적용`,
	saveToVault: '보관함에 저장',
	embedInCanvas: '캔버스 파일에 임베드',

	flipHorizontal: '좌우 반전',
	flipVertical: '상하 반전',
	toggleGrayscale: '흑백 전환',
	changeOpacity: '불투명도 변경',
	copyImageToClipboard: '미디어를 클립보드에 복사',
	moveSelectedMedia: '미디어 이동...',
	copySelectedMedia: '미디어 복사...',
	convertToEmbed: '캔버스 파일에 임베드...',
	resetSize: '원래 크기로 복원',
};

const ru: TranslationSchema = {
	settingsHeading: 'Отображение и холст',
	hideImageLabelName: 'Скрыть метку медиа',
	hideImageLabelDesc: 'Скрыть заголовок метки base64 URL / данных над встроенными карточками медиа.',

	modalTitle: 'Добавить медиа в файл холста',
	modalDescription: (filename: string) => `Как вы хотите сохранить «${filename}»?`,
	applyRemaining: (count: number) => `Применить выбор к оставшимся ${count} медиа`,
	saveToVault: 'Сохранить в хранилище',
	embedInCanvas: 'Встроить в файл холста',

	flipHorizontal: 'Отразить по горизонтали',
	flipVertical: 'Отразить по вертикали',
	toggleGrayscale: 'Переключить оттенки серого',
	changeOpacity: 'Изменить прозрачность',
	copyImageToClipboard: 'Скопировать медиа в буфер обмена',
	moveSelectedMedia: 'Переместить медиа в...',
	copySelectedMedia: 'Скопировать медиа в...',
	convertToEmbed: 'Встроить в файл холста...',
	resetSize: 'Сбросить до исходного размера',
};

const pt: TranslationSchema = {
	settingsHeading: 'Exibição e tela',
	hideImageLabelName: 'Ocultar rótulo de mídia',
	hideImageLabelDesc: 'Ocultar o cabeçalho do rótulo de dados / URL base64 exibido acima dos cartões de mídia incorporados.',

	modalTitle: 'Adicionar mídia ao arquivo de tela',
	modalDescription: (filename: string) => `Como você gostaria de armazenar "${filename}"?`,
	applyRemaining: (count: number) => `Aplicar escolha às ${count} mídias restantes`,
	saveToVault: 'Salvar no cofre',
	embedInCanvas: 'Incorporar no arquivo de tela',

	flipHorizontal: 'Inverter horizontalmente',
	flipVertical: 'Inverter verticalmente',
	toggleGrayscale: 'Alternar escala de cinza',
	changeOpacity: 'Alterar opacidade',
	copyImageToClipboard: 'Copiar mídia para a área de transferência',
	moveSelectedMedia: 'Mover mídia para...',
	copySelectedMedia: 'Copiar mídia para...',
	convertToEmbed: 'Incorporar no arquivo de tela...',
	resetSize: 'Redefinir para o tamanho original',
};

const it: TranslationSchema = {
	settingsHeading: 'Visualizzazione e tela',
	hideImageLabelName: 'Nascondi etichetta media',
	hideImageLabelDesc: 'Nasconde l’intestazione dell’etichetta dati / URL base64 visualizzata sopra le schede media incorporate.',

	modalTitle: 'Aggiungi media al file della tela',
	modalDescription: (filename: string) => `Come desideri memorizzare "${filename}"?`,
	applyRemaining: (count: number) => `Applica scelta ai restanti ${count} media`,
	saveToVault: 'Salva nella cassaforte',
	embedInCanvas: 'Incorpora nel file della tela',

	flipHorizontal: 'Capovolgi orizzontalmente',
	flipVertical: 'Capovolgi verticalmente',
	toggleGrayscale: 'Attiva/disattiva scala di grigi',
	changeOpacity: 'Cambia opacità',
	copyImageToClipboard: 'Copia media negli appunti',
	moveSelectedMedia: 'Sposta media in...',
	copySelectedMedia: 'Copia media in...',
	convertToEmbed: 'Incorpora nel file della tela...',
	resetSize: 'Ripristina dimensione originale',
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
};

export function getText(): TranslationSchema {
	const lang = getLanguage() || moment.locale() || 'en';
	const normalizedLang = lang.toLowerCase();
	return localeMap[normalizedLang] || localeMap[normalizedLang.split('-')[0]] || en;
}
