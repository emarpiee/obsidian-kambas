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
	hideImageLabelName: 'Hide image label',
	hideImageLabelDesc: 'Hide the base64 URL / data label header displayed above embedded canvas image cards.',

	modalTitle: 'Add image to canvas',
	modalDescription: (filename: string) => `How would you like to store "${filename}"?`,
	applyRemaining: (count: number) => `Apply choice to remaining ${count} images`,
	saveToVault: 'Save to vault',
	embedInCanvas: 'Embed in canvas',

	flipHorizontal: 'Flip horizontal',
	flipVertical: 'Flip vertical',
	toggleGrayscale: 'Toggle grayscale',
	changeOpacity: 'Change opacity',
	copyImageToClipboard: 'Copy image to clipboard',
	moveSelectedMedia: 'Move media to...',
	copySelectedMedia: 'Copy media to...',
	convertToEmbed: 'Embed in canvas...',
	resetSize: 'Reset to original size',
};

const zh: TranslationSchema = {
	settingsHeading: '显示与画布',
	hideImageLabelName: '隐藏图像标签',
	hideImageLabelDesc: '隐藏嵌入式画布图像卡片上方显示的 base64 URL / 数据标签标头。',

	modalTitle: '添加图像到画布',
	modalDescription: (filename: string) => `您希望如何存储 "${filename}"？`,
	applyRemaining: (count: number) => `将选择应用到剩余的 ${count} 张图像`,
	saveToVault: '保存到宝库',
	embedInCanvas: '嵌入到画布',

	flipHorizontal: '水平翻转',
	flipVertical: '垂直翻转',
	toggleGrayscale: '切换灰度',
	changeOpacity: '更改不透明度',
	copyImageToClipboard: '复制图像到剪贴板',
	moveSelectedMedia: '移动媒体到...',
	copySelectedMedia: '复制媒体到...',
	convertToEmbed: '嵌入到画布...',
	resetSize: '重置为原始大小',
};

const zhTW: TranslationSchema = {
	settingsHeading: '顯示與畫布',
	hideImageLabelName: '隱藏影像標籤',
	hideImageLabelDesc: '隱藏嵌入式畫布影像卡片上方顯示的 base64 URL / 資料標籤標頭。',

	modalTitle: '新增影像至畫布',
	modalDescription: (filename: string) => `您希望如何儲存 "${filename}"？`,
	applyRemaining: (count: number) => `將選擇套用至剩餘的 ${count} 張影像`,
	saveToVault: '儲存至寶庫',
	embedInCanvas: '嵌入至畫布',

	flipHorizontal: '水平翻轉',
	flipVertical: '垂直翻轉',
	toggleGrayscale: '切換灰階',
	changeOpacity: '更改不透明度',
	copyImageToClipboard: '複製影像至剪貼簿',
	moveSelectedMedia: '移動媒體到...',
	copySelectedMedia: '複製媒體到...',
	convertToEmbed: '嵌入至畫布...',
	resetSize: '重置為原始大小',
};

const es: TranslationSchema = {
	settingsHeading: 'Visualización y lienzo',
	hideImageLabelName: 'Ocultar etiqueta de imagen',
	hideImageLabelDesc: 'Oculta la cabecera de la etiqueta base64 URL / datos que se muestra sobre las tarjetas de imagen insertadas.',

	modalTitle: 'Añadir imagen al lienzo',
	modalDescription: (filename: string) => `¿Cómo desea guardar "${filename}"?`,
	applyRemaining: (count: number) => `Aplicar opción a las ${count} imágenes restantes`,
	saveToVault: 'Guardar en la bóveda',
	embedInCanvas: 'Incrustar en el lienzo',

	flipHorizontal: 'Voltear horizontalmente',
	flipVertical: 'Voltear verticalmente',
	toggleGrayscale: 'Alternar escala de grises',
	changeOpacity: 'Cambiar opacidad',
	copyImageToClipboard: 'Copiar imagen al portapapeles',
	moveSelectedMedia: 'Mover medios a...',
	copySelectedMedia: 'Copiar medios a...',
	convertToEmbed: 'Incrustar en el lienzo...',
	resetSize: 'Restablecer al tamaño original',
};

const fr: TranslationSchema = {
	settingsHeading: 'Affichage et canevas',
	hideImageLabelName: 'Masquer l’étiquette de l’image',
	hideImageLabelDesc: 'Masquer l’en-tête de l’étiquette URL / données base64 affiché au-dessus des cartes d’images intégrées.',

	modalTitle: 'Ajouter une image au canevas',
	modalDescription: (filename: string) => `Comment souhaitez-vous stocker « ${filename} » ?`,
	applyRemaining: (count: number) => `Appliquer le choix aux ${count} images restantes`,
	saveToVault: 'Enregistrer dans le coffre',
	embedInCanvas: 'Intégrer dans le canevas',

	flipHorizontal: 'Retourner horizontalement',
	flipVertical: 'Retourner verticalement',
	toggleGrayscale: 'Basculer les niveaux de gris',
	changeOpacity: 'Modifier l’opacité',
	copyImageToClipboard: 'Copier l’image dans le presse-papiers',
	moveSelectedMedia: 'Déplacer les médias vers...',
	copySelectedMedia: 'Copier les médias vers...',
	convertToEmbed: 'Intégrer dans le canevas...',
	resetSize: 'Réinitialiser à la taille d’origine',
};

const de: TranslationSchema = {
	settingsHeading: 'Anzeige & Canvas',
	hideImageLabelName: 'Bildbeschriftung ausblenden',
	hideImageLabelDesc: 'Blendet die Base64-URL-/-Datenbeschriftung aus, die über eingebetteten Bildkarten angezeigt wird.',

	modalTitle: 'Bild zum Canvas hinzufügen',
	modalDescription: (filename: string) => `Wie möchten Sie „${filename}“ speichern?`,
	applyRemaining: (count: number) => `Auswahl auf die verbleibenden ${count} Bilder anwenden`,
	saveToVault: 'Im Tresor speichern',
	embedInCanvas: 'In Canvas einbetten',

	flipHorizontal: 'Horizontal spiegeln',
	flipVertical: 'Vertikal spiegeln',
	toggleGrayscale: 'Graustufen umschalten',
	changeOpacity: 'Deckkraft ändern',
	copyImageToClipboard: 'Bild in Zwischenablage kopieren',
	moveSelectedMedia: 'Medien verschieben nach...',
	copySelectedMedia: 'Medien kopieren nach...',
	convertToEmbed: 'In Canvas einbetten...',
	resetSize: 'Auf Originalgröße zurücksetzen',
};

const ja: TranslationSchema = {
	settingsHeading: '表示とキャンバス',
	hideImageLabelName: '画像ラベルを非表示',
	hideImageLabelDesc: '埋め込まれたキャンバス画像カードの上に表示されるbase64 URL / データラベルヘッダーを非表示にします。',

	modalTitle: 'キャンバスに画像を追加',
	modalDescription: (filename: string) => `「${filename}」をどのように保存しますか？`,
	applyRemaining: (count: number) => `残りの${count}枚の画像にこの選択を適用`,
	saveToVault: '保管庫に保存',
	embedInCanvas: 'キャンバスに埋め込む',

	flipHorizontal: '左右反転',
	flipVertical: '上下反転',
	toggleGrayscale: '白黒切り替え',
	changeOpacity: '不透明度を変更',
	copyImageToClipboard: '画像をクリップボードにコピー',
	moveSelectedMedia: 'メディアを移動...',
	copySelectedMedia: 'メディアをコピー...',
	convertToEmbed: 'キャンバスに埋め込む...',
	resetSize: '元のサイズに戻す',
};

const ko: TranslationSchema = {
	settingsHeading: '표시 및 캔버스',
	hideImageLabelName: '이미지 레이블 숨기기',
	hideImageLabelDesc: '임베디드 캔버스 이미지 카드 위에 표시되는 base64 URL / 데이터 레이블 헤더를 숨깁니다.',

	modalTitle: '캔버스에 이미지 추가',
	modalDescription: (filename: string) => `"${filename}"을(를) 어떻게 저장하시겠습니까?`,
	applyRemaining: (count: number) => `남은 이미지 ${count}개에 선택 적용`,
	saveToVault: '보관함에 저장',
	embedInCanvas: '캔버스에 임베드',

	flipHorizontal: '좌우 반전',
	flipVertical: '상하 반전',
	toggleGrayscale: '흑백 전환',
	changeOpacity: '불투명도 변경',
	copyImageToClipboard: '이미지를 클립보드에 복사',
	moveSelectedMedia: '미디어 이동...',
	copySelectedMedia: '미디어 복사...',
	convertToEmbed: '캔버스에 임베드...',
	resetSize: '원래 크기로 복원',
};

const ru: TranslationSchema = {
	settingsHeading: 'Отображение и холст',
	hideImageLabelName: 'Скрыть метку изображения',
	hideImageLabelDesc: 'Скрыть заголовок метки base64 URL / данных над встроенными карточками изображений.',

	modalTitle: 'Добавить изображение на холст',
	modalDescription: (filename: string) => `Как вы хотите сохранить «${filename}»?`,
	applyRemaining: (count: number) => `Применить выбор к оставшимся ${count} изображениям`,
	saveToVault: 'Сохранить в хранилище',
	embedInCanvas: 'Встроить в холст',

	flipHorizontal: 'Отразить по горизонтали',
	flipVertical: 'Отразить по вертикали',
	toggleGrayscale: 'Переключить оттенки серого',
	changeOpacity: 'Изменить прозрачность',
	copyImageToClipboard: 'Скопировать изображение в буфер обмена',
	moveSelectedMedia: 'Переместить медиа в...',
	copySelectedMedia: 'Скопировать медиа в...',
	convertToEmbed: 'Встроить в холст...',
	resetSize: 'Сбросить до исходного размера',
};

const pt: TranslationSchema = {
	settingsHeading: 'Exibição e tela',
	hideImageLabelName: 'Ocultar rótulo da imagem',
	hideImageLabelDesc: 'Ocultar o cabeçalho do rótulo de dados / URL base64 exibido acima dos cartões de imagem incorporados.',

	modalTitle: 'Adicionar imagem à tela',
	modalDescription: (filename: string) => `Como você gostaria de armazenar "${filename}"?`,
	applyRemaining: (count: number) => `Aplicar escolha às ${count} imagens restantes`,
	saveToVault: 'Salvar no cofre',
	embedInCanvas: 'Incorporar na tela',

	flipHorizontal: 'Inverter horizontalmente',
	flipVertical: 'Inverter verticalmente',
	toggleGrayscale: 'Alternar escala de cinza',
	changeOpacity: 'Alterar opacidade',
	copyImageToClipboard: 'Copiar imagem para a área de transferência',
	moveSelectedMedia: 'Mover mídia para...',
	copySelectedMedia: 'Copiar mídia para...',
	convertToEmbed: 'Incorporar na tela...',
	resetSize: 'Redefinir para o tamanho original',
};

const it: TranslationSchema = {
	settingsHeading: 'Visualizzazione e tela',
	hideImageLabelName: 'Nascondi etichetta immagine',
	hideImageLabelDesc: 'Nasconde l’intestazione dell’etichetta dati / URL base64 visualizzata sopra le schede immagine incorporate.',

	modalTitle: 'Aggiungi immagine alla tela',
	modalDescription: (filename: string) => `Come desideri memorizzare "${filename}"?`,
	applyRemaining: (count: number) => `Applica scelta alle restanti ${count} immagini`,
	saveToVault: 'Salva nella cassaforte',
	embedInCanvas: 'Incorpora nella tela',

	flipHorizontal: 'Capovolgi orizzontalmente',
	flipVertical: 'Capovolgi verticalmente',
	toggleGrayscale: 'Attiva/disattiva scala di grigi',
	changeOpacity: 'Cambia opacità',
	copyImageToClipboard: 'Copia immagine negli appunti',
	moveSelectedMedia: 'Sposta media in...',
	copySelectedMedia: 'Copia media in...',
	convertToEmbed: 'Incorpora nella tela...',
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
