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
	optimizeImageSize: string;
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
	// Tags
	tagNodes: string;
	tagModalTitle: string;
	tagPlaceholder: string;
	tagFilterPanel: string;
	tagClearFilter: string;
	tagNodesCount: (count: number) => string;
	tagPublishToVault: string;
	tagPublishToVaultDesc: string;
	tagItemMenuTooltip: string;
	renameTag: string;
	setTagColor: string;
	deleteTag: string;
	renameTagModalTitle: (tag: string) => string;
	renameTagLabel: string;
	renameTagPlaceholder: string;
	setTagColorModalTitle: (tag: string) => string;
	tagColorPreview: string;
	tagColorPresets: string;
	textColorLabel: string;
	bgColorLabel: string;
	clearTagColor: string;
	saveBtn: string;
	// Color filter
	colorFilterTab: string;
	colorFilterPanel: string;
	colorExtractBtn: string;
	colorExtracting: string;
	colorNoImages: string;
	colorClearFilter: string;
	colorNodesCount: (count: number) => string;
	colorSettingHeader: string;
	colorSettingName: string;
	colorSettingDesc: string;
	colorModeAuto: string;
	colorModeManual: string;
	colorModeDisabled: string;
	colorBlack: string;
	colorGray: string;
	colorWhite: string;
	colorRed: string;
	colorOrange: string;
	colorYellow: string;
	colorGreen: string;
	colorTeal: string;
	colorCyan: string;
	colorBlue: string;
	colorIndigo: string;
	colorPurple: string;
	colorPink: string;

	// Palette & Settings translations
	copyHexNotice: (hex: string) => string;
	copyAllColorsNotice: (count: number) => string;
	copyAllColorsTooltip: string;
	tagBadgePositionName: string;
	tagBadgePositionDesc: string;
	tagBadgePositionOutside: string;
	tagBadgePositionInside: string;
	tagZoomOnSelectName: string;
	tagZoomOnSelectDesc: string;
	paletteCopySeparatorName: string;
	paletteCopySeparatorDesc: string;
	colorExtractModeName: string;
	colorExtractModeDesc: string;
	noImageInClipboardNotice: string;
	unableAccessClipboardNotice: string;

	// Base64 Optimization
	base64Heading?: string;
	autoOptimizeBase64Name?: string;
	autoOptimizeBase64Desc?: string;
	base64MaxDimensionName?: string;
	base64MaxDimensionDesc?: string;
	base64QualityName?: string;
	base64QualityDesc?: string;
	optimizedNotice?: (count: number, kbSaved: number) => string;
	noCompressibleNotice?: string;

	// Visual Inspection (Loupe)
	loupeHeading?: string;
	loupeHotkeyName?: string;
	loupeHotkeyDesc?: string;
	loupeZoomLevelName?: string;
	loupeZoomLevelDesc?: string;
	loupeSizeName?: string;
	loupeSizeDesc?: string;
	loupeShapeName?: string;
	loupeShapeDesc?: string;
	loupeShapeCircle?: string;
	loupeShapeRounded?: string;
	loupeShapeSquare?: string;
	loupeSmoothingName?: string;
	loupeSmoothingDesc?: string;

	// Selection Zoom
	selectionZoomHotkeyName?: string;
	selectionZoomHotkeyDesc?: string;

	// Filter panel strings
	dimOpacityLabel?: string;
	resetOpacityTooltip?: string;
	searchColorsPlaceholder?: string;
	searchTagsPlaceholder?: string;
	includeMinorColors?: string;
	includeCardColors?: string;
	displayColorName?: string;
	inViewCount?: (count: number) => string;
	itemCount?: (count: number) => string;
	notInCurrentView?: string;
	deleteTagTooltip?: string;
	noColorsMatch?: string;
	noTagsMatch?: string;
	noTagsOnCanvas?: string;
	extractingOrNoColors?: string;
	clickToExtractColors?: string;
	resetActiveFilter?: string;
	quickTagsHeader?: string;
	doneBtn?: string;
	itemsSelectedTitle?: (title: string, count: number) => string;

	// Media Filename Modal
	namingModalTitleCopy?: string;
	namingModalTitleMove?: string;
	namingModalVaultRoot?: string;
	destinationFolderNotice?: string;
	chooseNamingStrategy?: string;
	defaultFilenameOptTitle?: string;
	tagFilenameOptTitle?: string;
	noTagsFallbackNotice?: string;
	customFilenameOptTitle?: string;
	customFilenamePlaceholder?: string;
	numberingFormatName?: string;
	numberingFormatDesc?: string;
	applyToAllRemaining?: (count: number) => string;
	applyToAllRemainingDesc?: string;
	numberFormatPadded2?: string;
	numberFormatPadded3?: string;
	numberFormatSimple?: string;
	numberFormatRomanUpper?: string;
	numberFormatRomanLower?: string;
	numberFormatLetterUpper?: string;
	numberFormatLetterLower?: string;
}

const en: TranslationSchema = {
	settingsHeading: 'Display & canvas',
	hideImageLabelName: 'Hide media label',
	hideImageLabelDesc:
		'Hide the base64 URL / data label header displayed above embedded canvas media cards.',
	paletteSwatchCountName: 'Color palette swatches',
	paletteSwatchCountDesc:
		'Number of dominant colors to display when the color palette is enabled on an image (3–10).',
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
	duplicateKeyNotice:
		'Duplicate key bindings are not allowed. Please choose unique keys for each action.',

	modalTitle: 'Add media to canvas file',
	modalDescription: (filename: string) =>
		`How would you like to store "${filename}"?`,
	applyRemaining: (count: number) => `Apply choice to remaining ${count} media`,
	saveToVault: 'Save to vault',
	embedInCanvas: 'Embed in canvas file',

	convertModalTitle: 'Embed media in canvas file',
	convertModalDesc: (filename: string) =>
		`Embedding "${filename}" directly into the canvas file. What would you like to do with the original vault file?`,
	applyRemainingConvert: (count: number) =>
		`Apply choice to remaining ${count} media files`,
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
	optimizeImageSize: 'Optimize embedded image size',
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
	tagNodes: 'Add / Edit Tags…',
	tagModalTitle: 'Tags',
	tagPlaceholder: '#tag, press Enter to add',
	tagFilterPanel: 'Filter by tag',
	tagClearFilter: 'Clear filter',
	tagNodesCount: (count: number) => `${count} item${count === 1 ? '' : 's'}`,
	tagPublishToVault: 'Sync tags to vault',
	tagPublishToVaultDesc:
		"When enabled, all canvas tags are written as frontmatter tags on this canvas file, making them visible in Obsidian's tag pane and search.",
	tagItemMenuTooltip: 'Tag options',
	renameTag: 'Rename',
	setTagColor: 'Add color to tag',
	deleteTag: 'Delete tag',
	renameTagModalTitle: (tag: string) => `Rename #${tag}`,
	renameTagLabel: 'New tag name',
	renameTagPlaceholder: 'Enter tag name...',
	setTagColorModalTitle: (tag: string) => `Tag Color: #${tag}`,
	tagColorPreview: 'Preview:',
	tagColorPresets: 'Presets:',
	textColorLabel: 'Text color',
	bgColorLabel: 'Background color',
	clearTagColor: 'Clear color',
	saveBtn: 'Save',
	// Color filter
	colorFilterTab: 'Colors',
	colorFilterPanel: 'Filter by color',
	colorExtractBtn: 'Scan canvas colors',
	colorExtracting: 'Extracting colors…',
	colorNoImages: 'No images with detected colors on this canvas.',
	colorClearFilter: 'Clear color filter',
	colorNodesCount: (count: number) => `${count} image${count === 1 ? '' : 's'}`,
	colorSettingHeader: 'Color Extraction',
	colorSettingName: 'Auto Color Extraction',
	colorSettingDesc:
		'Automatically extract dominant colors from images when canvas opens. Set to Manual or Disabled to improve performance on large canvases.',
	colorModeAuto: 'Auto (extract on canvas open)',
	colorModeManual: 'Manual (extract on button click)',
	colorModeDisabled: 'Disabled',
	colorBlack: 'Black',
	colorGray: 'Gray',
	colorWhite: 'White',
	colorRed: 'Red',
	colorOrange: 'Orange',
	colorYellow: 'Yellow',
	colorGreen: 'Green',
	colorTeal: 'Teal',
	colorCyan: 'Cyan',
	colorBlue: 'Blue',
	colorIndigo: 'Indigo',
	colorPurple: 'Purple',
	colorPink: 'Pink',

	// Palette & Settings translations
	copyHexNotice: (hex: string) => `Copied ${hex} to clipboard!`,
	copyAllColorsNotice: (count: number) =>
		`Copied ${count} color${count === 1 ? '' : 's'} to clipboard!`,
	copyAllColorsTooltip: 'Copy all palette colors',
	tagBadgePositionName: 'Tag badge position',
	tagBadgePositionDesc:
		'Choose whether node tag badges are rendered outside below the element or inside at the bottom-left.',
	tagBadgePositionOutside: 'Outside (below element)',
	tagBadgePositionInside: 'Inside (bottom-left)',
	tagZoomOnSelectName: 'Auto-zoom on tag selection',
	tagZoomOnSelectDesc:
		'Automatically zoom and fit visible elements when selecting or clearing tag filters in the panel.',
	paletteCopySeparatorName: 'Color palette copy separator',
	paletteCopySeparatorDesc:
		'Delimiter used when clicking the copy button on a color palette to copy all hex values to clipboard.',
	colorExtractModeName: 'Color extraction mode',
	colorExtractModeDesc:
		'Controls when dominant colors are extracted from canvas images for the color filter panel.',
	noImageInClipboardNotice: 'No image found in clipboard',
	unableAccessClipboardNotice: 'Unable to access clipboard',

	base64Heading: 'Base64 image optimization',
	autoOptimizeBase64Name: 'Auto-optimize Base64 on paste / drop',
	autoOptimizeBase64Desc:
		'Automatically compress pasted or dropped Base64 images to WebP format (Default: Disabled).',
	base64MaxDimensionName: 'Maximum image dimension (px)',
	base64MaxDimensionDesc:
		'Resize images exceeding this width/height before embedding in canvas (Default: 2048px).',
	base64QualityName: 'WebP compression quality',
	base64QualityDesc:
		'Quality target for WebP image compression (0.10 to 1.00).',
	optimizedNotice: (count: number, kbSaved: number) =>
		`Optimized ${count} embedded image(s), saved ~${kbSaved} KB!`,
	noCompressibleNotice: 'No compressible base64 images selected.',

	loupeHeading: 'Visual inspection (Loupe Tool)',
	loupeHotkeyName: 'Loupe activation hotkey',
	loupeHotkeyDesc:
		'Hold down this key while hovering over an image node to inspect details (Default: Q).',
	loupeZoomLevelName: 'Loupe magnification level',
	loupeZoomLevelDesc:
		'Zoom multiplier for the loupe lens from 1.5x to 10.0x (Default: 3.0x).',
	loupeSizeName: 'Loupe lens diameter (px)',
	loupeSizeDesc:
		'Size of the loupe lens in pixels from 100px to 600px (Default: 260px).',
	loupeShapeName: 'Loupe lens shape',
	loupeShapeDesc:
		'Visual shape of the magnifying lens frame (Default: Circle).',
	loupeShapeCircle: 'Circle',
	loupeShapeRounded: 'Rounded rectangle',
	loupeShapeSquare: 'Square',
	loupeSmoothingName: 'Loupe motion smoothing / dampening',
	loupeSmoothingDesc:
		'Smooths out mouse jitter when panning across images (Lower = smoother & less sensitive, Higher = faster tracking. Default: 0.50).',

	selectionZoomHotkeyName: 'Zoom to fit selection hotkey',
	selectionZoomHotkeyDesc:
		'Press this hotkey when elements are selected to zoom to fit them. Press again to zoom back out (Default: Space).',

	dimOpacityLabel: 'Dim opacity',
	resetOpacityTooltip: 'Reset opacity to default',
	searchColorsPlaceholder: 'Search colors…',
	searchTagsPlaceholder: 'Search tags…',
	includeMinorColors: 'Include minor colors',
	includeCardColors: 'Include card colors',
	displayColorName: 'Display color name',
	inViewCount: (count: number) => `${count} in view`,
	itemCount: (count: number) => `${count} item${count === 1 ? '' : 's'}`,
	notInCurrentView: 'Not in current view',
	deleteTagTooltip: 'Delete tag from all nodes',
	noColorsMatch: 'No colors match.',
	noTagsMatch: 'No tags match.',
	noTagsOnCanvas: 'No tags on this canvas yet.',
	extractingOrNoColors: 'Extracting or no colors found...',
	clickToExtractColors: 'Click button above to extract image colors.',
	resetActiveFilter: 'Reset active filter',
	quickTagsHeader: 'Quick Tags:',
	doneBtn: 'Done',
	itemsSelectedTitle: (title: string, count: number) =>
		`${title} (${count} items selected)`,

	namingModalTitleCopy: 'Copy Media to Vault',
	namingModalTitleMove: 'Move Media to Vault',
	namingModalVaultRoot: '/ (Vault root)',
	destinationFolderNotice: 'Destination Folder: ',
	chooseNamingStrategy:
		'Choose how the media file should be named in your vault:',
	defaultFilenameOptTitle: 'Default Filename',
	tagFilenameOptTitle: 'Tag Filename',
	noTagsFallbackNotice: '(No tags on current media - will fallback to default)',
	customFilenameOptTitle: 'Custom Filename',
	customFilenamePlaceholder: 'e.g. my-image',
	numberingFormatName: 'Numbering format',
	numberingFormatDesc:
		'Format used for incremental counters (e.g., when duplicate names exist or in batch exports).',
	applyToAllRemaining: (count: number) =>
		`Apply to all ${count} remaining items`,
	applyToAllRemainingDesc:
		'Uses the selected naming strategy and numbering format for all remaining items.',
	numberFormatPadded2: '01, 02, 03... (2 Digits)',
	numberFormatPadded3: '001, 002, 003... (3 Digits)',
	numberFormatSimple: '1, 2, 3... (Unpadded)',
	numberFormatRomanUpper: 'I, II, III, IV... (Roman upper)',
	numberFormatRomanLower: 'i, ii, iii, iv... (Roman lower)',
	numberFormatLetterUpper: 'A, B, C... (Alphabet upper)',
	numberFormatLetterLower: 'a, b, c... (Alphabet lower)',
};

const zh: TranslationSchema = {
	settingsHeading: '显示与画布',
	hideImageLabelName: '隐藏媒体标签',
	hideImageLabelDesc:
		'隐藏嵌入式画布媒体卡片上方显示的 base64 URL / 数据标签标头。',
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
	convertModalDesc: (filename: string) =>
		`将 "${filename}" 直接嵌入画布文件。您希望如何处理原始宝库文件？`,
	applyRemainingConvert: (count: number) =>
		`将选择应用到剩余的 ${count} 个媒体文件`,
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
	optimizeImageSize: '优化嵌入图片大小',
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
	tagNodes: '添加 / 编辑标签…',
	tagModalTitle: '标签',
	tagPlaceholder: '输入 #标签 后按回车添加',
	tagFilterPanel: '按标签筛选',
	tagClearFilter: '清除筛选',
	tagNodesCount: (count: number) => `${count} 个元素`,
	tagPublishToVault: '同步标签至笔记宝库',
	tagPublishToVaultDesc:
		'启用后，画布中的所有标签都将作为 frontmatter 标签写入该画布文件，使其在 Obsidian 的标签面板和搜索中可见。',
	tagItemMenuTooltip: '标签选项',
	renameTag: '重命名',
	setTagColor: '为标签设置颜色',
	deleteTag: '删除标签',
	renameTagModalTitle: (tag: string) => `重命名 #${tag}`,
	renameTagLabel: '新标签名称',
	renameTagPlaceholder: '输入标签名称...',
	setTagColorModalTitle: (tag: string) => `标签颜色：#${tag}`,
	tagColorPreview: '预览：',
	tagColorPresets: '预设：',
	textColorLabel: '文字颜色',
	bgColorLabel: '背景颜色',
	clearTagColor: '清除颜色',
	saveBtn: '保存',
	colorFilterTab: '颜色',
	colorFilterPanel: '按颜色筛选',
	colorExtractBtn: '扫描画布颜色',
	colorExtracting: '正在提取颜色…',
	colorNoImages: '当前画布中没有检测到含颜色的图片。',
	colorClearFilter: '清除颜色筛选',
	colorNodesCount: (count: number) => `${count} 个元素`,
	colorSettingHeader: '颜色提取',
	colorSettingName: '自动提取颜色',
	colorSettingDesc:
		'打开画布时自动提取图片的代表颜色。在大型画布上可设为手动或禁用以提升性能。',
	colorModeAuto: '自动（打开画布时提取）',
	colorModeManual: '手动（点击按钮时提取）',
	colorModeDisabled: '禁用',
	colorBlack: '黑色',
	colorGray: '灰色',
	colorWhite: '白色',
	colorRed: '红色',
	colorOrange: '橙色',
	colorYellow: '黄色',
	colorGreen: '绿色',
	colorTeal: '水鸭蓝',
	colorCyan: '青色',
	colorBlue: '蓝色',
	colorIndigo: '靛蓝色',
	colorPurple: '紫色',
	colorPink: '粉红色',

	// Palette & Settings translations
	copyHexNotice: (hex: string) => `已复制 ${hex} 到剪贴板！`,
	copyAllColorsNotice: (count: number) => `已复制 ${count} 个颜色到剪贴板！`,
	copyAllColorsTooltip: '复制调色板的所有颜色',
	tagBadgePositionName: '标签徽章位置',
	tagBadgePositionDesc:
		'选择元素标签徽章是渲染在元素下方（外侧）还是左下角（内侧）。',
	tagBadgePositionOutside: '外侧（元素下方）',
	tagBadgePositionInside: '内侧（左下角）',
	tagZoomOnSelectName: '选择标签时自动缩放',
	tagZoomOnSelectDesc: '在面板中选择或清除标签筛选时，自动缩放并适应可见元素。',
	paletteCopySeparatorName: '调色板复制分隔符',
	paletteCopySeparatorDesc:
		'点击调色板复制按钮将所有十六进制颜色复制到剪贴板时使用的分隔符。',
	colorExtractModeName: '颜色提取模式',
	colorExtractModeDesc: '控制何时从画布图片中提取代表颜色以用于颜色筛选面板。',
	noImageInClipboardNotice: '剪贴板中未找到图片',
	unableAccessClipboardNotice: '无法访问剪贴板',

	// Palette Swatches & Base64 Optimization
	paletteSwatchCountName: '调色板色块数量',
	paletteSwatchCountDesc:
		'在图片上启用调色板时显示的代表颜色数量（3–10）。',
	base64Heading: 'Base64 图片优化',
	autoOptimizeBase64Name: '粘贴 / 拖放时自动优化 Base64',
	autoOptimizeBase64Desc:
		'自动将粘贴或拖放的 Base64 图片压缩为 WebP 格式（默认：禁用）。',
	base64MaxDimensionName: '最大图片尺寸 (px)',
	base64MaxDimensionDesc:
		'在嵌入画布前，将超过此宽度/高度的图片调整大小（默认：2048px）。',
	base64QualityName: 'WebP 压缩质量',
	base64QualityDesc: 'WebP 图片压缩质量目标 (0.10 至 1.00)。',
	optimizedNotice: (count: number, kbSaved: number) =>
		`已优化 ${count} 张嵌入图片，节省了约 ${kbSaved} KB！`,
	noCompressibleNotice: '未选择可压缩的 base64 图片。',

	// Visual Inspection (Loupe Tool)
	loupeHeading: '视觉检查（放大镜工具）',
	loupeHotkeyName: '放大镜激活热键',
	loupeHotkeyDesc:
		'悬停在图片节点上时按住此键以检查细节（默认：Q）。',
	loupeZoomLevelName: '放大镜放大倍率',
	loupeZoomLevelDesc:
		'放大镜镜头的缩放倍数，从 1.5x 到 10.0x（默认：3.0x）。',
	loupeSizeName: '放大镜镜头直径 (px)',
	loupeSizeDesc:
		'放大镜镜头的像素大小，从 100px 到 600px（默认：260px）。',
	loupeShapeName: '放大镜镜头形状',
	loupeShapeDesc:
		'放大镜框的视觉形状（默认：圆形）。',
	loupeShapeCircle: '圆形',
	loupeShapeRounded: '圆角矩形',
	loupeShapeSquare: '方形',
	loupeSmoothingName: '放大镜运动平滑 / 缓冲',
	loupeSmoothingDesc:
		'在平移图片时平滑鼠标抖动（越低越平滑且灵敏度越低，越高跟踪越快。默认：0.50）。',

	// Selection Zoom
	selectionZoomHotkeyName: '缩放适应选中项热键',
	selectionZoomHotkeyDesc:
		'选中元素时按下此热键可缩放适应它们。再次按下可缩放回原位（默认：空格）。',

	// Filter panel strings
	dimOpacityLabel: '遮罩不透明度',
	resetOpacityTooltip: '恢复默认不透明度',
	searchColorsPlaceholder: '搜索颜色…',
	searchTagsPlaceholder: '搜索标签…',
	includeMinorColors: '包含次要颜色',
	includeCardColors: '包含卡片颜色',
	displayColorName: '显示颜色名称',
	inViewCount: (count: number) => `当前视图 ${count} 个`,
	itemCount: (count: number) => `${count} 个元素`,
	notInCurrentView: '不在当前视图中',
	deleteTagTooltip: '从所有节点中删除标签',
	noColorsMatch: '没有匹配的颜色。',
	noTagsMatch: '没有匹配的标签。',
	noTagsOnCanvas: '当前画布尚无标签。',
	extractingOrNoColors: '正在提取或未找到颜色…',
	clickToExtractColors: '点击上方按钮提取图片颜色。',
	resetActiveFilter: '重置当前筛选',
	quickTagsHeader: '快捷标签：',
	doneBtn: '完成',
	itemsSelectedTitle: (title: string, count: number) =>
		`${title}（已选择 ${count} 项）`,

	// Media Filename Modal
	namingModalTitleCopy: '复制媒体到宝库',
	namingModalTitleMove: '移动媒体到宝库',
	namingModalVaultRoot: '/ (宝库根目录)',
	destinationFolderNotice: '目标文件夹：',
	chooseNamingStrategy:
		'选择媒体文件在宝库中的命名方式：',
	defaultFilenameOptTitle: '默认文件名',
	tagFilenameOptTitle: '标签文件名',
	noTagsFallbackNotice: '（当前媒体没有标签 - 将回退到默认设置）',
	customFilenameOptTitle: '自定义文件名',
	customFilenamePlaceholder: '例如 my-image',
	numberingFormatName: '编号格式',
	numberingFormatDesc:
		'用于递增计数器的格式（例如，当存在重复名称或批量导出时）。',
	applyToAllRemaining: (count: number) =>
		`应用到剩余的 ${count} 项`,
	applyToAllRemainingDesc:
		'为所有剩余项使用选定的命名策略和编号格式。',
	numberFormatPadded2: '01, 02, 03... (2 位数)',
	numberFormatPadded3: '001, 002, 003... (3 位数)',
	numberFormatSimple: '1, 2, 3... (无补零)',
	numberFormatRomanUpper: 'I, II, III, IV... (大写罗马数字)',
	numberFormatRomanLower: 'i, ii, iii, iv... (小写罗马数字)',
	numberFormatLetterUpper: 'A, B, C... (大写字母)',
	numberFormatLetterLower: 'a, b, c... (小写字母)',
};

const zhTW: TranslationSchema = {
	settingsHeading: '顯示與畫布',
	hideImageLabelName: '隱藏媒體標籤',
	hideImageLabelDesc:
		'隱藏嵌入式畫布媒體卡片上方顯示的 base64 URL / 資料標籤標頭。',
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
	convertModalDesc: (filename: string) =>
		`將 "${filename}" 直接嵌入畫布檔案。您希望如何處理原始寶庫檔案？`,
	applyRemainingConvert: (count: number) =>
		`將選擇套用至剩餘的 ${count} 個媒體檔案`,
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
	optimizeImageSize: '優化嵌入圖片大小',
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
	tagNodes: '新增 / 編輯標籤…',
	tagModalTitle: '標籤',
	tagPlaceholder: '輸入 #標籤 後按 Enter 新增',
	tagFilterPanel: '按標籤篩選',
	tagClearFilter: '清除篩選',
	tagNodesCount: (count: number) => `${count} 個元素`,
	tagPublishToVault: '同步標籤至筆記寶庫',
	tagPublishToVaultDesc:
		'啟用後，畫布中的所有標籤都將作為 frontmatter 標籤寫入該畫布檔案，使其在 Obsidian 的標籤面板和搜尋中可見。',
	tagItemMenuTooltip: '標籤選項',
	renameTag: '重新命名',
	setTagColor: '為標籤設定顏色',
	deleteTag: '刪除標籤',
	renameTagModalTitle: (tag: string) => `重新命名 #${tag}`,
	renameTagLabel: '新標籤名稱',
	renameTagPlaceholder: '輸入標籤名稱...',
	setTagColorModalTitle: (tag: string) => `標籤顏色：#${tag}`,
	tagColorPreview: '預覽：',
	tagColorPresets: '預設：',
	textColorLabel: '文字顏色',
	bgColorLabel: '背景顏色',
	clearTagColor: '清除顏色',
	saveBtn: '儲存',
	colorFilterTab: '顏色',
	colorFilterPanel: '按顏色篩選',
	colorExtractBtn: '掃描畫布顏色',
	colorExtracting: '正在擷取顏色…',
	colorNoImages: '目前畫布中沒有偵測到含顏色的圖片。',
	colorClearFilter: '清除顏色篩選',
	colorNodesCount: (count: number) => `${count} 個元素`,
	colorSettingHeader: '顏色擷取',
	colorSettingName: '自動擷取顏色',
	colorSettingDesc:
		'開啟畫布時自動擷取圖片的代表顏色。在大型畫布上可設為手動或停用以提升效能。',
	colorModeAuto: '自動（開啟畫布時擷取）',
	colorModeManual: '手動（點擊按鈕時擷取）',
	colorModeDisabled: '停用',
	colorBlack: '黑色',
	colorGray: '灰色',
	colorWhite: '白色',
	colorRed: '紅色',
	colorOrange: '橙色',
	colorYellow: '黃色',
	colorGreen: '綠色',
	colorTeal: '水鴨藍',
	colorCyan: '青色',
	colorBlue: '藍色',
	colorIndigo: '靛藍色',
	colorPurple: '紫色',
	colorPink: '粉紅色',

	// Palette & Settings translations
	copyHexNotice: (hex: string) => `已複製 ${hex} 至剪貼簿！`,
	copyAllColorsNotice: (count: number) => `已複製 ${count} 個顏色至剪貼簿！`,
	copyAllColorsTooltip: '複製調色板的所有顏色',
	tagBadgePositionName: '標籤徽章位置',
	tagBadgePositionDesc:
		'選擇元素標籤徽章是渲染在元素下方（外側）還是左下角（內側）。',
	tagBadgePositionOutside: '外側（元素下方）',
	tagBadgePositionInside: '內側（左下角）',
	tagZoomOnSelectName: '選擇標籤時自動縮放',
	tagZoomOnSelectDesc: '在面板中選擇或清除標籤篩選時，自動縮放並適應可見元素。',
	paletteCopySeparatorName: '調色板複製分隔符',
	paletteCopySeparatorDesc:
		'點擊調色板複製按鈕將所有十六進位顏色複製至剪貼簿時使用的分隔符。',
	colorExtractModeName: '顏色擷取模式',
	colorExtractModeDesc: '控制何時從畫布圖片中擷取代表顏色以用於顏色篩選面板。',
	noImageInClipboardNotice: '剪貼簿中未找到圖片',
	unableAccessClipboardNotice: '無法存取剪貼簿',

	paletteSwatchCountName: '調色板色塊數量',
	paletteSwatchCountDesc: '在圖片上啟用調色板時顯示的代表顏色數量（3–10）。',
	base64Heading: 'Base64 圖片優化',
	autoOptimizeBase64Name: '貼上 / 拖放時自動優化 Base64',
	autoOptimizeBase64Desc: '自動將貼上或拖放的 Base64 圖片壓縮為 WebP 格式（預設：停用）。',
	base64MaxDimensionName: '最大圖片尺寸 (px)',
	base64MaxDimensionDesc: '在嵌入畫布前，將超過此寬度/高度的圖片調整大小（預設：2048px）。',
	base64QualityName: 'WebP 壓縮品質',
	base64QualityDesc: 'WebP 圖片壓縮品質目標 (0.10 至 1.00)。',
	optimizedNotice: (count: number, kbSaved: number) => `已優化 ${count} 張嵌入圖片，節省了約 ${kbSaved} KB！`,
	noCompressibleNotice: '未選擇可壓縮的 base64 圖片。',

	loupeHeading: '視覺檢查（放大鏡工具）',
	loupeHotkeyName: '放大鏡啟動熱鍵',
	loupeHotkeyDesc: '懸停在圖片節點上時按住此鍵以檢查細節（預設：Q）。',
	loupeZoomLevelName: '放大鏡放大倍率',
	loupeZoomLevelDesc: '放大鏡鏡頭的縮放倍率，從 1.5x 到 10.0x（預設：3.0x）。',
	loupeSizeName: '放大鏡鏡頭直徑 (px)',
	loupeSizeDesc: '放大鏡鏡頭的像素大小，從 100px 到 600px（預設：260px）。',
	loupeShapeName: '放大鏡鏡頭形狀',
	loupeShapeDesc: '放大鏡框的視覺形狀（預設：圓形）。',
	loupeShapeCircle: '圓形',
	loupeShapeRounded: '圓角矩形',
	loupeShapeSquare: '方形',
	loupeSmoothingName: '放大鏡運動平滑 / 緩衝',
	loupeSmoothingDesc: '在平移圖片時平滑滑鼠抖動（越低越平滑且靈敏度越低，越高追蹤越快。預設：0.50）。',

	selectionZoomHotkeyName: '縮放適應選取項熱鍵',
	selectionZoomHotkeyDesc: '選取元素時按下此熱鍵可縮放適應它們。再次按下可縮放回原位（預設：空白鍵）。',

	dimOpacityLabel: '遮罩不透明度',
	resetOpacityTooltip: '恢復預設不透明度',
	searchColorsPlaceholder: '搜尋顏色…',
	searchTagsPlaceholder: '搜尋標籤…',
	includeMinorColors: '包含次要顏色',
	includeCardColors: '包含卡片顏色',
	displayColorName: '顯示顏色名稱',
	inViewCount: (count: number) => `目前檢視 ${count} 個`,
	itemCount: (count: number) => `${count} 個元素`,
	notInCurrentView: '不在目前檢視中',
	deleteTagTooltip: '從所有節點中刪除標籤',
	noColorsMatch: '沒有符合的顏色。',
	noTagsMatch: '沒有符合的標籤。',
	noTagsOnCanvas: '目前畫布尚無標籤。',
	extractingOrNoColors: '正在擷取或未找到顏色…',
	clickToExtractColors: '點擊上方按鈕擷取圖片顏色。',
	resetActiveFilter: '重置目前篩選',
	quickTagsHeader: '快捷標籤：',
	doneBtn: '完成',
	itemsSelectedTitle: (title: string, count: number) => `${title}（已選擇 ${count} 項）`,

	namingModalTitleCopy: '複製媒體至寶庫',
	namingModalTitleMove: '移動媒體至寶庫',
	namingModalVaultRoot: '/ (寶庫根目錄)',
	destinationFolderNotice: '目標資料夾：',
	chooseNamingStrategy: '選擇媒體檔案在寶庫中的命名方式：',
	defaultFilenameOptTitle: '預設檔案名稱',
	tagFilenameOptTitle: '標籤檔案名稱',
	noTagsFallbackNotice: '（目前媒體沒有標籤 - 將退回至預設設定）',
	customFilenameOptTitle: '自訂檔案名稱',
	customFilenamePlaceholder: '例如 my-image',
	numberingFormatName: '編號格式',
	numberingFormatDesc: '用於遞增計數器的格式（例如，當存在重複名稱或批次匯出時）。',
	applyToAllRemaining: (count: number) => `套用至剩餘的 ${count} 項`,
	applyToAllRemainingDesc: '為所有剩餘項使用選定的命名策略和編號格式。',
	numberFormatPadded2: '01, 02, 03... (2 位數)',
	numberFormatPadded3: '001, 002, 003... (3 位數)',
	numberFormatSimple: '1, 2, 3... (無補零)',
	numberFormatRomanUpper: 'I, II, III, IV... (大寫羅馬數字)',
	numberFormatRomanLower: 'i, ii, iii, iv... (小寫羅馬數字)',
	numberFormatLetterUpper: 'A, B, C... (大寫字母)',
	numberFormatLetterLower: 'a, b, c... (小寫字母)',
};

const es: TranslationSchema = {
	settingsHeading: 'Visualización y lienzo',
	hideImageLabelName: 'Ocultar etiqueta de medios',
	hideImageLabelDesc:
		'Oculta la cabecera de la etiqueta base64 URL / datos que se muestra sobre las tarjetas de medios insertadas.',
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
	duplicateKeyNotice:
		'No se permiten asignaciones de teclas duplicadas. Por favor, elija teclas únicas para cada acción.',

	modalTitle: 'Añadir medios al archivo de lienzo',
	modalDescription: (filename: string) => `¿Cómo desea guardar "${filename}"?`,
	applyRemaining: (count: number) =>
		`Aplicar opción a los ${count} medios restantes`,
	saveToVault: 'Guardar en la bóveda',
	embedInCanvas: 'Incrustar en el archivo de lienzo',

	convertModalTitle: 'Incrustar medios en el archivo de lienzo',
	convertModalDesc: (filename: string) =>
		`Incrustando "${filename}" directamente en el archivo de lienzo. ¿Qué desea hacer con el archivo original de la bóveda?`,
	applyRemainingConvert: (count: number) =>
		`Aplicar opción a los ${count} archivos de medios restantes`,
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
	optimizeImageSize: 'Optimizar tamaño de imagen incrustada',
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
	tagNodes: 'Añadir / Editar etiquetas…',
	tagModalTitle: 'Etiquetas',
	tagPlaceholder: '#etiqueta, presione Enter para añadir',
	tagFilterPanel: 'Filtrar por etiqueta',
	tagClearFilter: 'Borrar filtro',
	tagNodesCount: (count: number) =>
		`${count} elemento${count === 1 ? '' : 's'}`,
	tagPublishToVault: 'Sincronizar etiquetas con la bóveda',
	tagPublishToVaultDesc:
		'Al activarlo, todas las etiquetas del lienzo se escribirán como etiquetas de frontmatter en este archivo de lienzo, haciéndolas visibles en el panel de etiquetas y la búsqueda de Obsidian.',
	tagItemMenuTooltip: 'Opciones de etiqueta',
	renameTag: 'Renombrar',
	setTagColor: 'Añadir color a etiqueta',
	deleteTag: 'Eliminar etiqueta',
	renameTagModalTitle: (tag: string) => `Renombrar #${tag}`,
	renameTagLabel: 'Nuevo nombre de etiqueta',
	renameTagPlaceholder: 'Nombre de etiqueta...',
	setTagColorModalTitle: (tag: string) => `Color de etiqueta: #${tag}`,
	tagColorPreview: 'Vista previa:',
	tagColorPresets: 'Ajustes preestablecidos:',
	textColorLabel: 'Color de texto',
	bgColorLabel: 'Color de fondo',
	clearTagColor: 'Limpiar color',
	saveBtn: 'Guardar',
	colorFilterTab: 'Color',
	colorFilterPanel: 'Filtrar por color',
	colorExtractBtn: 'Escanear colores del lienzo',
	colorExtracting: 'Extrayendo colores…',
	colorNoImages:
		'No se encontraron imágenes con colores detectados en este lienzo.',
	colorClearFilter: 'Borrar filtro de color',
	colorNodesCount: (count: number) =>
		`${count} elemento${count === 1 ? '' : 's'}`,
	colorSettingHeader: 'Extracción de color',
	colorSettingName: 'Extracción automática de color',
	colorSettingDesc:
		'Extrae automáticamente los colores dominantes de las imágenes al abrir el lienzo. Establézcalo en Manual o Desactivado para mejorar el rendimiento en lienzos grandes.',
	colorModeAuto: 'Automático (extraer al abrir lienzo)',
	colorModeManual: 'Manual (extraer al hacer clic)',
	colorModeDisabled: 'Desactivado',
	colorBlack: 'Negro',
	colorGray: 'Gris',
	colorWhite: 'Blanco',
	colorRed: 'Rojo',
	colorOrange: 'Naranja',
	colorYellow: 'Amarillo',
	colorGreen: 'Verde',
	colorTeal: 'Azul verdoso',
	colorCyan: 'Cian',
	colorBlue: 'Azul',
	colorIndigo: 'Índigo',
	colorPurple: 'Púrpura',
	colorPink: 'Rosa',

	// Palette & Settings translations
	copyHexNotice: (hex: string) => `¡Copiado ${hex} al portapapeles!`,
	copyAllColorsNotice: (count: number) =>
		`¡Copiados ${count} color${count === 1 ? '' : 'es'} al portapapeles!`,
	copyAllColorsTooltip: 'Copiar todos los colores de la paleta',
	tagBadgePositionName: 'Posición de la insignia de etiqueta',
	tagBadgePositionDesc:
		'Elija si las insignias de etiqueta se muestran fuera (debajo del elemento) o dentro (abajo a la izquierda).',
	tagBadgePositionOutside: 'Fuera (debajo del elemento)',
	tagBadgePositionInside: 'Dentro (abajo a la izquierda)',
	tagZoomOnSelectName: 'Zoom automático al seleccionar etiqueta',
	tagZoomOnSelectDesc:
		'Ajusta y hace zoom automáticamente en los elementos visibles al seleccionar o limpiar filtros de etiquetas.',
	paletteCopySeparatorName: 'Separador al copiar paleta de colores',
	paletteCopySeparatorDesc:
		'Delimitador usado al hacer clic en el botón de copiar paleta para copiar todos los valores hex al portapapeles.',
	colorExtractModeName: 'Modo de extracción de color',
	colorExtractModeDesc:
		'Controla cuándo se extraen los colores dominantes de las imágenes del lienzo para el panel de filtro de color.',
	noImageInClipboardNotice: 'No se encontró ninguna imagen en el portapapeles',
	unableAccessClipboardNotice: 'No se puede acceder al portapapeles',

	paletteSwatchCountName: 'Muestras de la paleta de colores',
	paletteSwatchCountDesc:
		'Número de colores dominantes para mostrar cuando la paleta de colores está activada en una imagen (3–10).',
	base64Heading: 'Optimización de imágenes Base64',
	autoOptimizeBase64Name: 'Auto-optimizar Base64 al pegar / soltar',
	autoOptimizeBase64Desc:
		'Comprime automáticamente imágenes Base64 pegadas o soltadas a formato WebP (Predeterminado: Desactivado).',
	base64MaxDimensionName: 'Dimensión máxima de imagen (px)',
	base64MaxDimensionDesc:
		'Redimensiona imágenes que superen este ancho/alto antes de incrustarlas en el lienzo (Predeterminado: 2048px).',
	base64QualityName: 'Calidad de compresión WebP',
	base64QualityDesc:
		'Objetivo de calidad para la compresión de imágenes WebP (0,10 a 1,00).',
	optimizedNotice: (count: number, kbSaved: number) =>
		`¡${count} imagen(es) incrustada(s) optimizada(s), ~${kbSaved} KB guardados!`,
	noCompressibleNotice: 'No se seleccionaron imágenes base64 compresibles.',

	loupeHeading: 'Inspección visual (Herramienta Lupa)',
	loupeHotkeyName: 'Atajo para activar la lupa',
	loupeHotkeyDesc:
		'Mantenga presionada esta tecla sobre un nodo de imagen para inspeccionar detalles (Predeterminado: Q).',
	loupeZoomLevelName: 'Nivel de magnificación de la lupa',
	loupeZoomLevelDesc:
		'Multiplicador de zoom para la lupa de 1.5x a 10.0x (Predeterminado: 3.0x).',
	loupeSizeName: 'Diámetro de la lente de la lupa (px)',
	loupeSizeDesc:
		'Tamaño de la lente de la lupa en píxeles de 100px a 600px (Predeterminado: 260px).',
	loupeShapeName: 'Forma de la lente de la lupa',
	loupeShapeDesc:
		'Forma visual del marco de la lupa (Predeterminado: Círculo).',
	loupeShapeCircle: 'Círculo',
	loupeShapeRounded: 'Rectángulo redondeado',
	loupeShapeSquare: 'Cuadrado',
	loupeSmoothingName: 'Suavizado / amortiguación de movimiento de la lupa',
	loupeSmoothingDesc:
		'Suaviza el temblor del ratón al desplazarse por las imágenes (Menor = más suave, Mayor = seguimiento más rápido. Predeterminado: 0.50).',

	selectionZoomHotkeyName: 'Atajo para ajustar zoom a la selección',
	selectionZoomHotkeyDesc:
		'Presione este atajo cuando haya elementos seleccionados para ajustar el zoom a ellos (Predeterminado: Espacio).',

	dimOpacityLabel: 'Opacidad del atenuado',
	resetOpacityTooltip: 'Restablecer opacidad predeterminada',
	searchColorsPlaceholder: 'Buscar colores…',
	searchTagsPlaceholder: 'Buscar etiquetas…',
	includeMinorColors: 'Incluir colores secundarios',
	includeCardColors: 'Incluir colores de tarjeta',
	displayColorName: 'Mostrar nombre del color',
	inViewCount: (count: number) => `${count} en vista`,
	itemCount: (count: number) => `${count} elemento${count === 1 ? '' : 's'}`,
	notInCurrentView: 'No está en la vista actual',
	deleteTagTooltip: 'Eliminar etiqueta de todos los nodos',
	noColorsMatch: 'No coinciden colores.',
	noTagsMatch: 'No coinciden etiquetas.',
	noTagsOnCanvas: 'Aún no hay etiquetas en este lienzo.',
	extractingOrNoColors: 'Extrayendo o no se encontraron colores…',
	clickToExtractColors: 'Haga clic en el botón de arriba para extraer colores.',
	resetActiveFilter: 'Restablecer filtro activo',
	quickTagsHeader: 'Etiquetas rápidas:',
	doneBtn: 'Listo',
	itemsSelectedTitle: (title: string, count: number) =>
		`${title} (${count} elementos seleccionados)`,

	namingModalTitleCopy: 'Copiar archivo multimedia a la bóveda',
	namingModalTitleMove: 'Mover archivo multimedia a la bóveda',
	namingModalVaultRoot: '/ (Raíz de la bóveda)',
	destinationFolderNotice: 'Carpeta de destino: ',
	chooseNamingStrategy:
		'Elija cómo nombrar el archivo multimedia en su bóveda:',
	defaultFilenameOptTitle: 'Nombre predeterminado',
	tagFilenameOptTitle: 'Nombre por etiqueta',
	noTagsFallbackNotice:
		'(Sin etiquetas en el medio actual: se usará el predeterminado)',
	customFilenameOptTitle: 'Nombre personalizado',
	customFilenamePlaceholder: 'ej. mi-imagen',
	numberingFormatName: 'Formato de numeración',
	numberingFormatDesc:
		'Formato utilizado para contadores incrementales (ej. duplicados o exportaciones en lote).',
	applyToAllRemaining: (count: number) =>
		`Aplicar a los ${count} elementos restantes`,
	applyToAllRemainingDesc:
		'Utiliza la estrategia de nombre y formato seleccionados para todos los elementos restantes.',
	numberFormatPadded2: '01, 02, 03... (2 dígitos)',
	numberFormatPadded3: '001, 002, 003... (3 dígitos)',
	numberFormatSimple: '1, 2, 3... (Sin relleno)',
	numberFormatRomanUpper: 'I, II, III, IV... (Romano mayúscula)',
	numberFormatRomanLower: 'i, ii, iii, iv... (Romano minúscula)',
	numberFormatLetterUpper: 'A, B, C... (Alfabeto mayúscula)',
	numberFormatLetterLower: 'a, b, c... (Alfabeto minúscula)',
};

const fr: TranslationSchema = {
	settingsHeading: 'Affichage et canevas',
	hideImageLabelName: 'Masquer l’étiquette des médias',
	hideImageLabelDesc:
		'Masquer l’en-tête de l’étiquette URL / données base64 affiché au-dessus des cartes de médias intégrées.',
	keyboardPanHeading: 'Commandes de panoramique du canevas au clavier',
	panControlsName: 'Commandes de panoramique',
	panControlsDesc: 'Ensemble de touches pour faire défiler le canevas.',
	restoreDefaultTooltip: 'Rétablir les valeurs par défaut',
	updatePanControlsButton: 'Mettre à jour les commandes de panoramique',
	maxPanSpeedName: 'Vitesse de panoramique maximale',
	maxPanSpeedDesc: 'Unités de canevas pour le défilement',
	keyboardZoomHeading: 'Commandes de zoom du canevas au clavier',
	zoomControlsName: 'Commandes de zoom',
	zoomControlsDesc:
		'Ensemble de touches pour zoomer et dézoomer sur le canevas.',
	updateZoomControlsButton: 'Mettre à jour les commandes de zoom',
	zoomSpeedName: 'Vitesse de zoom',
	zoomSpeedDesc: 'Taux de modification du zoom par image',
	duplicateKeyNotice:
		'Les raccourcis clavier en double ne sont pas autorisés. Veuillez choisir des touches uniques pour chaque action.',

	modalTitle: 'Ajouter un média au fichier de canevas',
	modalDescription: (filename: string) =>
		`Comment souhaitez-vous stocker « ${filename} » ?`,
	applyRemaining: (count: number) =>
		`Appliquer le choix aux ${count} médias restants`,
	saveToVault: 'Enregistrer dans le coffre',
	embedInCanvas: 'Intégrer dans le fichier de canevas',

	convertModalTitle: 'Intégrer le média dans le fichier de canevas',
	convertModalDesc: (filename: string) =>
		`Intégration directe de « ${filename} » dans le fichier de canevas. Que souhaitez-vous faire du fichier d’origine dans le coffre ?`,
	applyRemainingConvert: (count: number) =>
		`Appliquer le choix aux ${count} fichiers médias restants`,
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
	optimizeImageSize: 'Optimiser la taille de l’image intégrée',
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
	tagNodes: 'Ajouter / Modifier les étiquettes…',
	tagModalTitle: 'Étiquettes',
	tagPlaceholder: '#étiquette, appuyez sur Entrée pour ajouter',
	tagFilterPanel: 'Filtrer par étiquette',
	tagClearFilter: 'Effacer le filtre',
	tagNodesCount: (count: number) => `${count} élément${count === 1 ? '' : 's'}`,
	tagPublishToVault: 'Synchroniser les étiquettes avec le coffre',
	tagPublishToVaultDesc:
		'Lorsqu’elle est activée, toutes les étiquettes du canevas sont inscrites en tant qu’étiquettes frontmatter sur ce fichier de canevas, les rendant visibles dans le panneau d’étiquettes et la recherche d’Obsidian.',
	tagItemMenuTooltip: 'Options de tag',
	renameTag: 'Renommer',
	setTagColor: 'Ajouter une couleur au tag',
	deleteTag: 'Supprimer le tag',
	renameTagModalTitle: (tag: string) => `Renommer #${tag}`,
	renameTagLabel: 'Nouveau nom de tag',
	renameTagPlaceholder: 'Entrez le nom du tag...',
	setTagColorModalTitle: (tag: string) => `Couleur du tag : #${tag}`,
	tagColorPreview: 'Aperçu :',
	tagColorPresets: 'Préréglages :',
	textColorLabel: 'Couleur du texte',
	bgColorLabel: "Couleur d'arrière-plan",
	clearTagColor: 'Effacer la couleur',
	saveBtn: 'Enregistrer',
	colorFilterTab: 'Couleur',
	colorFilterPanel: 'Filtrer par couleur',
	colorExtractBtn: 'Analyser les couleurs du canevas',
	colorExtracting: 'Extraction des couleurs…',
	colorNoImages: 'Aucune image avec des couleurs détectées sur ce canevas.',
	colorClearFilter: 'Effacer le filtre de couleur',
	colorNodesCount: (count: number) =>
		`${count} élément${count === 1 ? '' : 's'}`,
	colorSettingHeader: 'Extraction de couleur',
	colorSettingName: 'Extraction automatique des couleurs',
	colorSettingDesc:
		'Extrait automatiquement les couleurs dominantes des images à l’ouverture du canevas. Réglez sur Manuel ou Désactivé pour améliorer les performances sur les grands canevas.',
	colorModeAuto: 'Automatique (extraire à l’ouverture)',
	colorModeManual: 'Manuel (extraire sur clic)',
	colorModeDisabled: 'Désactivé',
	colorBlack: 'Noir',
	colorGray: 'Gris',
	colorWhite: 'Blanc',
	colorRed: 'Rouge',
	colorOrange: 'Orange',
	colorYellow: 'Jaune',
	colorGreen: 'Vert',
	colorTeal: 'Sarcelle',
	colorCyan: 'Cyan',
	colorBlue: 'Bleu',
	colorIndigo: 'Indigo',
	colorPurple: 'Violet',
	colorPink: 'Rose',

	// Palette & Settings translations
	copyHexNotice: (hex: string) => `${hex} copié dans le presse-papiers !`,
	copyAllColorsNotice: (count: number) =>
		`${count} couleur${count === 1 ? '' : 's'} copiée${count === 1 ? '' : 's'} dans le presse-papiers !`,
	copyAllColorsTooltip: 'Copier toutes les couleurs de la palette',
	tagBadgePositionName: 'Position du badge d’étiquette',
	tagBadgePositionDesc:
		'Choisissez si les badges d’étiquette sont affichés à l’extérieur (sous l’élément) ou à l’intérieur (en bas à gauche).',
	tagBadgePositionOutside: 'Extérieur (sous l’élément)',
	tagBadgePositionInside: 'Intérieur (en bas à gauche)',
	tagZoomOnSelectName: 'Zoom automatique lors de la sélection d’étiquette',
	tagZoomOnSelectDesc:
		'Zoome et ajuste automatiquement les éléments visibles lors de la sélection ou de l’effacement des filtres d’étiquettes.',
	paletteCopySeparatorName: 'Séparateur de copie de la palette de couleurs',
	paletteCopySeparatorDesc:
		'Délimiteur utilisé lors du clic sur le bouton de copie de la palette pour copier toutes les valeurs hexadécimales dans le presse-papiers.',
	colorExtractModeName: 'Mode d’extraction de couleur',
	colorExtractModeDesc:
		'Contrôle le moment où les couleurs dominantes sont extraites des images du canevas pour le panneau de filtre de couleur.',
	noImageInClipboardNotice: 'Aucune image trouvée dans le presse-papiers',
	unableAccessClipboardNotice: 'Impossible d’accéder au presse-papiers',

	paletteSwatchCountName: 'Échantillons de la palette de couleurs',
	paletteSwatchCountDesc:
		'Nombre de couleurs dominantes à afficher lorsque la palette de couleurs est activée sur une image (3–10).',
	base64Heading: 'Optimisation des images Base64',
	autoOptimizeBase64Name:
		'Optimiser automatiquement le Base64 au coller / déposer',
	autoOptimizeBase64Desc:
		'Compresse automatiquement les images Base64 collées ou déposées au format WebP (Par défaut : Désactivé).',
	base64MaxDimensionName: 'Dimension maximale de l\'image (px)',
	base64MaxDimensionDesc:
		'Redimensionne les images dépassant cette largeur/hauteur avant l\'intégration sur le canevas (Par défaut : 2048px).',
	base64QualityName: 'Qualité de compression WebP',
	base64QualityDesc:
		'Objectif de qualité pour la compression d’image WebP (0,10 à 1,00).',
	optimizedNotice: (count: number, kbSaved: number) =>
		`${count} image(s) intégrée(s) optimisée(s), ~${kbSaved} KO économisés !`,
	noCompressibleNotice: 'Aucune image base64 compressible sélectionnée.',

	loupeHeading: 'Inspection visuelle (Outil Loupe)',
	loupeHotkeyName: 'Raccourci d\'activation de la loupe',
	loupeHotkeyDesc:
		'Maintenez cette touche enfoncée en survolant un nœud d\'image pour l\'inspecter (Par défaut : Q).',
	loupeZoomLevelName: 'Niveau de grossissement de la loupe',
	loupeZoomLevelDesc:
		'Multiplicateur de zoom pour la loupe de 1.5x à 10.0x (Par défaut : 3.0x).',
	loupeSizeName: 'Diamètre de la loupe (px)',
	loupeSizeDesc:
		'Taille de la loupe en pixels de 100px à 600px (Par défaut : 260px).',
	loupeShapeName: 'Forme de la loupe',
	loupeShapeDesc:
		'Forme visuelle du cadre de la loupe (Par défaut : Cercle).',
	loupeShapeCircle: 'Cercle',
	loupeShapeRounded: 'Rectangle arrondi',
	loupeShapeSquare: 'Carré',
	loupeSmoothingName: 'Lissage / amortissement du mouvement de la loupe',
	loupeSmoothingDesc:
		'Lisse les tremblements de la souris lors du déplacement (Plus bas = plus lisse, Plus haut = suivi plus rapide. Par défaut : 0.50).',

	selectionZoomHotkeyName: 'Raccourci pour ajuster le zoom à la sélection',
	selectionZoomHotkeyDesc:
		'Appuyez sur ce raccourci lorsque des éléments sont sélectionnés pour faire un zoom ajusté (Par défaut : Espace).',

	dimOpacityLabel: 'Opacité d\'atténuation',
	resetOpacityTooltip: 'Réinitialiser l\'opacité par défaut',
	searchColorsPlaceholder: 'Rechercher des couleurs…',
	searchTagsPlaceholder: 'Rechercher des étiquettes…',
	includeMinorColors: 'Inclure les couleurs secondaires',
	includeCardColors: 'Inclure les couleurs de carte',
	displayColorName: 'Afficher le nom de la couleur',
	inViewCount: (count: number) => `${count} visibles`,
	itemCount: (count: number) => `${count} élément${count === 1 ? '' : 's'}`,
	notInCurrentView: 'Pas dans la vue actuelle',
	deleteTagTooltip: 'Supprimer l\'étiquette de tous les nœuds',
	noColorsMatch: 'Aucune couleur ne correspond.',
	noTagsMatch: 'Aucune étiquette ne correspond.',
	noTagsOnCanvas: 'Aucune étiquette sur ce canevas pour le moment.',
	extractingOrNoColors: 'Extraction en cours ou aucune couleur trouvée…',
	clickToExtractColors:
		'Cliquez sur le bouton ci-dessus pour extraire les couleurs.',
	resetActiveFilter: 'Réinitialiser le filtre actif',
	quickTagsHeader: 'Étiquettes rapides :',
	doneBtn: 'Terminé',
	itemsSelectedTitle: (title: string, count: number) =>
		`${title} (${count} éléments sélectionnés)`,

	namingModalTitleCopy: 'Copier le fichier média dans le coffre',
	namingModalTitleMove: 'Déplacer le fichier média dans le coffre',
	namingModalVaultRoot: '/ (Racine du coffre)',
	destinationFolderNotice: 'Dossier de destination : ',
	chooseNamingStrategy:
		'Choisissez comment le fichier média doit être nommé dans votre coffre :',
	defaultFilenameOptTitle: 'Nom de fichier par défaut',
	tagFilenameOptTitle: 'Nom de fichier par étiquette',
	noTagsFallbackNotice:
		'(Aucune étiquette sur le média - retour à la valeur par défaut)',
	customFilenameOptTitle: 'Nom de fichier personnalisé',
	customFilenamePlaceholder: 'ex. mon-image',
	numberingFormatName: 'Format de numérotation',
	numberingFormatDesc:
		'Format utilisé pour les compteurs incrémentiels (ex. doublons ou exportations par lots).',
	applyToAllRemaining: (count: number) =>
		`Appliquer aux ${count} éléments restants`,
	applyToAllRemainingDesc:
		'Utilise la stratégie de nommage et le format de numérotation sélectionnés pour les éléments restants.',
	numberFormatPadded2: '01, 02, 03... (2 chiffres)',
	numberFormatPadded3: '001, 002, 003... (3 chiffres)',
	numberFormatSimple: '1, 2, 3... (Non complété)',
	numberFormatRomanUpper: 'I, II, III, IV... (Romain majuscule)',
	numberFormatRomanLower: 'i, ii, iii, iv... (Romain minuscule)',
	numberFormatLetterUpper: 'A, B, C... (Alphabet majuscule)',
	numberFormatLetterLower: 'a, b, c... (Alphabet minuscule)',
};

const de: TranslationSchema = {
	settingsHeading: 'Anzeige & Canvas',
	hideImageLabelName: 'Medienbeschriftung ausblenden',
	hideImageLabelDesc:
		'Blendet die Base64-URL-/-Datenbeschriftung aus, die über eingebetteten Medienkarten angezeigt wird.',
	keyboardPanHeading: 'Canvas Tastatur-Schwenksteuerung',
	panControlsName: 'Schwenksteuerung',
	panControlsDesc: 'Tastenkombination zum Schwenken des Canvas.',
	restoreDefaultTooltip: 'Standard wiederherstellen',
	updatePanControlsButton: 'Schwenksteuerung aktualisieren',
	maxPanSpeedName: 'Maximale Schwenkgeschwindigkeit',
	maxPanSpeedDesc: 'Zu schwenkende Canvas-Einheiten',
	keyboardZoomHeading: 'Canvas Tastatur-Zoomsteuerung',
	zoomControlsName: 'Zoomsteuerung',
	zoomControlsDesc:
		'Tastenkombination zum Vergrößern und Verkleinern des Canvas.',
	updateZoomControlsButton: 'Zoomsteuerung aktualisieren',
	zoomSpeedName: 'Zoomgeschwindigkeit',
	zoomSpeedDesc: 'Rate der Zoomänderung pro Frame',
	duplicateKeyNotice:
		'Doppelte Tastenbelegungen sind nicht erlaubt. Bitte wählen Sie eindeutige Tasten für jede Aktion.',

	modalTitle: 'Medien zur Canvas-Datei hinzufügen',
	modalDescription: (filename: string) =>
		`Wie möchten Sie „${filename}“ speichern?`,
	applyRemaining: (count: number) =>
		`Auswahl auf die verbleibenden ${count} Medien anwenden`,
	saveToVault: 'Im Tresor speichern',
	embedInCanvas: 'In Canvas-Datei einbetten',

	convertModalTitle: 'Medien in Canvas-Datei einbetten',
	convertModalDesc: (filename: string) =>
		`„${filename}“ wird direkt in die Canvas-Datei eingebettet. Was möchten Sie mit der ursprünglichen Tresordatei tun?`,
	applyRemainingConvert: (count: number) =>
		`Auswahl auf die verbleibenden ${count} Mediendateien anwenden`,
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
	optimizeImageSize: 'Größe eingebetteter Bilder optimieren',
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
	tagNodes: 'Tags hinzufügen / bearbeiten…',
	tagModalTitle: 'Tags',
	tagPlaceholder: '#tag eingeben und Eingabe drücken',
	tagFilterPanel: 'Nach Tag filtern',
	tagClearFilter: 'Filter zurücksetzen',
	tagNodesCount: (count: number) => `${count} Element${count === 1 ? '' : 'e'}`,
	tagPublishToVault: 'Tags mit Tresor synchronisieren',
	tagPublishToVaultDesc:
		'Wenn aktiviert, werden alle Canvas-Tags als Frontmatter-Tags in diese Canvas-Datei geschrieben, sodass sie in der Tag-Leiste und Suche von Obsidian sichtbar sind.',
	tagItemMenuTooltip: 'Tag-Optionen',
	renameTag: 'Umbenennen',
	setTagColor: 'Farbe zu Tag hinzufügen',
	deleteTag: 'Tag löschen',
	renameTagModalTitle: (tag: string) => `#${tag} umbenennen`,
	renameTagLabel: 'Neuer Tag-Name',
	renameTagPlaceholder: 'Tag-Namen eingeben...',
	setTagColorModalTitle: (tag: string) => `Tag-Farbe: #${tag}`,
	tagColorPreview: 'Vorschau:',
	tagColorPresets: 'Voreinstellungen:',
	textColorLabel: 'Textfarbe',
	bgColorLabel: 'Hintergrundfarbe',
	clearTagColor: 'Farbe zurücksetzen',
	saveBtn: 'Speichern',
	colorFilterTab: 'Farbe',
	colorFilterPanel: 'Nach Farbe filtern',
	colorExtractBtn: 'Canvas-Farben scannen',
	colorExtracting: 'Farben werden extrahiert…',
	colorNoImages:
		'Keine Bilder mit erkannten Farben auf diesem Canvas vorhanden.',
	colorClearFilter: 'Farbfilter zurücksetzen',
	colorNodesCount: (count: number) =>
		`${count} Element${count === 1 ? '' : 'e'}`,
	colorSettingHeader: 'Farbenextraktion',
	colorSettingName: 'Automatische Farbenextraktion',
	colorSettingDesc:
		'Extrahiert beim Öffnen des Canvas automatisch dominante Farben aus Bildern. Auf Manuell oder Deaktiviert stellen, um die Leistung bei großen Canvas-Dateien zu verbessern.',
	colorModeAuto: 'Automatisch (beim Öffnen des Canvas extrahieren)',
	colorModeManual: 'Manuell (per Schaltfläche extrahieren)',
	colorModeDisabled: 'Deaktiviert',
	colorBlack: 'Schwarz',
	colorGray: 'Grau',
	colorWhite: 'Weiß',
	colorRed: 'Rot',
	colorOrange: 'Orange',
	colorYellow: 'Gelb',
	colorGreen: 'Grün',
	colorTeal: 'Teal',
	colorCyan: 'Cyan',
	colorBlue: 'Blau',
	colorIndigo: 'Indigo',
	colorPurple: 'Violett',
	colorPink: 'Rosa',

	// Palette & Settings translations
	copyHexNotice: (hex: string) => `${hex} in die Zwischenablage kopiert!`,
	copyAllColorsNotice: (count: number) =>
		`${count} Farbe${count === 1 ? '' : 'n'} in die Zwischenablage kopiert!`,
	copyAllColorsTooltip: 'Alle Farben der Palette kopieren',
	tagBadgePositionName: 'Position des Tag-Badges',
	tagBadgePositionDesc:
		'Wählen Sie, ob Tag-Badges von Elementen außerhalb (unterhalb des Elements) oder innerhalb (unten links) gerendert werden.',
	tagBadgePositionOutside: 'Außerhalb (unterhalb des Elements)',
	tagBadgePositionInside: 'Innerhalb (unten links)',
	tagZoomOnSelectName: 'Automatischer Zoom bei Tag-Auswahl',
	tagZoomOnSelectDesc:
		'Zoomt und passt sichtbare Elemente automatisch an, wenn Tag-Filter im Panel ausgewählt oder zurückgesetzt werden.',
	paletteCopySeparatorName: 'Trennzeichen für Farbpaletten-Kopie',
	paletteCopySeparatorDesc:
		'Trennzeichen beim Klicken auf die Paletten-Kopierschaltfläche zum Kopieren aller Hex-Werte in die Zwischenablage.',
	colorExtractModeName: 'Farbenextraktionsmodus',
	colorExtractModeDesc:
		'Steuert, wann dominante Farben aus Canvas-Bildern für das Farbfilter-Panel extrahiert werden.',
	noImageInClipboardNotice: 'Kein Bild in der Zwischenablage gefunden',
	unableAccessClipboardNotice: 'Zugriff auf die Zwischenablage nicht möglich',

	paletteSwatchCountName: 'Farbpaletten-Muster',
	paletteSwatchCountDesc:
		'Anzahl der zu angezeigten dominanten Farben, wenn die Farbpalette auf einem Bild aktiviert ist (3–10).',
	base64Heading: 'Base64-Bildoptimierung',
	autoOptimizeBase64Name:
		'Base64 beim Einfügen / Ablegen automatisch optimieren',
	autoOptimizeBase64Desc:
		'Komprimiert eingefügte oder abgelegte Base64-Bilder automatisch in das WebP-Format (Standard: Deaktiviert).',
	base64MaxDimensionName: 'Maximale Bildabmessung (px)',
	base64MaxDimensionDesc:
		'Skaliert Bilder neu, die diese Breite/Höhe überschreiten, bevor sie auf dem Canvas eingebettet werden (Standard: 2048px).',
	base64QualityName: 'WebP-Komprimierungsqualität',
	base64QualityDesc:
		'Zielqualität für die WebP-Bildkomprimierung (0,10 bis 1,00).',
	optimizedNotice: (count: number, kbSaved: number) =>
		`${count} eingebettete(s) Bild(er) optimiert, ~${kbSaved} KB gespart!`,
	noCompressibleNotice: 'Keine komprimierbaren Base64-Bilder ausgewählt.',

	loupeHeading: 'Visuelle Inspektion (Lupe-Werkzeug)',
	loupeHotkeyName: 'Aktivierungs-Hot-Key für Lupe',
	loupeHotkeyDesc:
		'Halten Sie diese Taste gedrückt, während Sie über einen Bild-Knoten fahren, um Details zu prüfen (Standard: Q).',
	loupeZoomLevelName: 'Vergrößerungsstufe der Lupe',
	loupeZoomLevelDesc:
		'Zoom-Multiplikator für die Lupe von 1,5x bis 10,0x (Standard: 3,0x).',
	loupeSizeName: 'Linsendurchmesser der Lupe (px)',
	loupeSizeDesc:
		'Größe der Lupenlinse in Pixel von 100px bis 600px (Standard: 260px).',
	loupeShapeName: 'Form der Lupenlinse',
	loupeShapeDesc: 'Visuelle Form des Lupenrahmens (Standard: Kreis).',
	loupeShapeCircle: 'Kreis',
	loupeShapeRounded: 'Abgerundetes Rechteck',
	loupeShapeSquare: 'Quadrat',
	loupeSmoothingName: 'Lupen-Glättung / Dämpfung',
	loupeSmoothingDesc:
		'Glättet Mauszeiger-Ruckeln beim Bewegen über Bilder (Niedriger = glatter, Höher = schneller. Standard: 0,50).',

	selectionZoomHotkeyName:
		'Hot-Key zum Anpassen des Zooms an die Auswahl',
	selectionZoomHotkeyDesc:
		'Drücken Sie diesen Hot-Key bei ausgewählten Elementen, um sie einzupassen (Standard: Leertaste).',

	dimOpacityLabel: 'Abdunkelungs-Deckkraft',
	resetOpacityTooltip: 'Deckkraft auf Standard zurücksetzen',
	searchColorsPlaceholder: 'Farben suchen…',
	searchTagsPlaceholder: 'Tags suchen…',
	includeMinorColors: 'Nebenfarben einschließen',
	includeCardColors: 'Kartenfarben einschließen',
	displayColorName: 'Farbnamen anzeigen',
	inViewCount: (count: number) => `${count} sichtbar`,
	itemCount: (count: number) => `${count} Element${count === 1 ? '' : 'e'}`,
	notInCurrentView: 'Nicht in aktueller Ansicht',
	deleteTagTooltip: 'Tag von allen Knoten löschen',
	noColorsMatch: 'Keine passenden Farben.',
	noTagsMatch: 'Keine passenden Tags.',
	noTagsOnCanvas: 'Noch keine Tags auf diesem Canvas.',
	extractingOrNoColors: 'Extrahiere oder keine Farben gefunden…',
	clickToExtractColors:
		'Klicken Sie auf die Schaltfläche oben, um Bildfarben zu extrahieren.',
	resetActiveFilter: 'Aktiven Filter zurücksetzen',
	quickTagsHeader: 'Schnell-Tags:',
	doneBtn: 'Fertig',
	itemsSelectedTitle: (title: string, count: number) =>
		`${title} (${count} Elemente ausgewählt)`,

	namingModalTitleCopy: 'Medien in den Vault kopieren',
	namingModalTitleMove: 'Medien in den Vault verschieben',
	namingModalVaultRoot: '/ (Vault-Stammverzeichnis)',
	destinationFolderNotice: 'Zielordner: ',
	chooseNamingStrategy:
		'Wählen Sie, wie die Mediendatei in Ihrem Vault benannt werden soll:',
	defaultFilenameOptTitle: 'Standard-Dateiname',
	tagFilenameOptTitle: 'Tag-Dateiname',
	noTagsFallbackNotice:
		'(Keine Tags beim aktuellen Medium vorhanden - Standard wird verwendet)',
	customFilenameOptTitle: 'Benutzerdefinierter Dateiname',
	customFilenamePlaceholder: 'z.B. mein-bild',
	numberingFormatName: 'Nummerierungsformat',
	numberingFormatDesc:
		'Format für fortlaufende Zähler (z.B. bei Duplikaten oder Staperexporten).',
	applyToAllRemaining: (count: number) =>
		`Auf alle verbleibenden ${count} Elemente anwenden`,
	applyToAllRemainingDesc:
		'Verwendet die gewählte Benennungsstrategie und das Nummerierungsformat für alle verbleibenden Elemente.',
	numberFormatPadded2: '01, 02, 03... (2 Stellen)',
	numberFormatPadded3: '001, 002, 003... (3 Stellen)',
	numberFormatSimple: '1, 2, 3... (Ungefüllt)',
	numberFormatRomanUpper: 'I, II, III, IV... (Römisch groß)',
	numberFormatRomanLower: 'i, ii, iii, iv... (Römisch klein)',
	numberFormatLetterUpper: 'A, B, C... (Alphabet groß)',
	numberFormatLetterLower: 'a, b, c... (Alphabet klein)',
};

const ja: TranslationSchema = {
	settingsHeading: '表示とキャンバス',
	hideImageLabelName: 'メディアラベルを非表示',
	hideImageLabelDesc:
		'埋め込まれたキャンバスメディアカードの上に表示されるbase64 URL / データラベルヘッダーを非表示にします。',
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
	duplicateKeyNotice:
		'重複したキー割り当ては許可されていません。各操作に一意のキーを選択してください。',

	modalTitle: 'キャンバスファイルにメディアを追加',
	modalDescription: (filename: string) =>
		`「${filename}」をどのように保存しますか？`,
	applyRemaining: (count: number) =>
		`残りの${count}件のメディアにこの選択を適用`,
	saveToVault: '保管庫に保存',
	embedInCanvas: 'キャンバスファイルに埋め込む',

	convertModalTitle: 'キャンバスファイルにメディアを埋め込む',
	convertModalDesc: (filename: string) =>
		`「${filename}」をキャンバスファイルに直接埋め込みます。元の保管庫ファイルはどうしますか？`,
	applyRemainingConvert: (count: number) =>
		`残りの${count}件のメディアファイルにこの選択を適用`,
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
	optimizeImageSize: '埋め込み画像のサイズを最適化',
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
	tagNodes: 'タグの追加 / 編集…',
	tagModalTitle: 'タグ',
	tagPlaceholder: '#タグ を入力してEnterを押す',
	tagFilterPanel: 'タグで絞り込み',
	tagClearFilter: 'フィルターを解除',
	tagNodesCount: (count: number) => `${count} 個の要素`,
	tagPublishToVault: 'タグをVaultと同期',
	tagPublishToVaultDesc:
		'有効にすると、キャンバス内のすべてのタグがキャンバスファイルのフロントマタータグとして書き込まれ、Obsidianのタグペインや検索で利用可能になります。',
	tagItemMenuTooltip: 'タグのオプション',
	renameTag: '名前を変更',
	setTagColor: 'タグに色を追加',
	deleteTag: 'タグを削除',
	renameTagModalTitle: (tag: string) => `#${tag} の名前を変更`,
	renameTagLabel: '新しいタグ名',
	renameTagPlaceholder: 'タグ名を入力...',
	setTagColorModalTitle: (tag: string) => `タグの色: #${tag}`,
	tagColorPreview: 'プレビュー:',
	tagColorPresets: 'プリセット:',
	textColorLabel: '文字色',
	bgColorLabel: '背景色',
	clearTagColor: '色をクリア',
	saveBtn: '保存',
	colorFilterTab: 'カラー',
	colorFilterPanel: 'カラーで絞り込み',
	colorExtractBtn: 'キャンバスの色をスキャン',
	colorExtracting: '色を抽出中…',
	colorNoImages: 'キャンバス内に色が検出された画像はありません。',
	colorClearFilter: 'カラーフィルターを解除',
	colorNodesCount: (count: number) => `${count} 個の要素`,
	colorSettingHeader: '色抽出',
	colorSettingName: '自動色抽出',
	colorSettingDesc:
		'キャンバスを開いたときに画像から主要な色を自動的に抽出します。大規模なキャンバスのパフォーマンスを向上させるには「手動」または「無効」に設定してください。',
	colorModeAuto: '自動 (キャンバス起動時に抽出)',
	colorModeManual: '手動 (ボタンクリックで抽出)',
	colorModeDisabled: '無効',
	colorBlack: 'ブラック',
	colorGray: 'グレー',
	colorWhite: 'ホワイト',
	colorRed: 'レッド',
	colorOrange: 'オレンジ',
	colorYellow: 'イエロー',
	colorGreen: 'グリーン',
	colorTeal: 'ティール',
	colorCyan: 'シアン',
	colorBlue: 'ブルー',
	colorIndigo: 'インディゴ',
	colorPurple: 'パープル',
	colorPink: 'ピンク',

	// Palette & Settings translations
	copyHexNotice: (hex: string) => `${hex} をクリップボードにコピーしました！`,
	copyAllColorsNotice: (count: number) =>
		`${count} 個の色をクリップボードにコピーしました！`,
	copyAllColorsTooltip: 'すべてのパレットの色をコピー',
	tagBadgePositionName: 'タグバッジの表示位置',
	tagBadgePositionDesc:
		'要素のタグバッジを要素下部（外側）に表示するか、左下（内側）に表示するかを選択します。',
	tagBadgePositionOutside: '外側 (要素の下)',
	tagBadgePositionInside: '内側 (左下)',
	tagZoomOnSelectName: 'タグ選択時の自動ズーム',
	tagZoomOnSelectDesc:
		'パネルでタグフィルターを選択または解除したときに、表示要素に合わせて自動的にズーム・フィットさせます。',
	paletteSwatchCountName: 'カラーパレットのスウォッチ数',
	paletteSwatchCountDesc:
		'画像でカラーパレットを有効にした際に表示する主要な色の数（3～10）。',
	paletteCopySeparatorName: 'カラーパレットコピーの区切り文字',
	paletteCopySeparatorDesc:
		'カラーパレットのコピーボタンを押してすべてのHEX値をクリップボードにコピーする際の区切り文字。',
	colorExtractModeName: '色抽出モード',
	colorExtractModeDesc:
		'カラーフィルターパネル用にキャンバス画像から主要な色を抽出するタイミングを制御します。',
	noImageInClipboardNotice: 'クリップボードに画像が見つかりません',
	unableAccessClipboardNotice: 'クリップボードにアクセスできません',

	// Base64 Optimization
	base64Heading: 'Base64画像の最適化',
	autoOptimizeBase64Name: '貼り付け / ドロップ時にBase64を自動最適化',
	autoOptimizeBase64Desc:
		'貼り付けまたはドロップされたBase64画像を自動的にWebP形式に圧縮します（デフォルト: 無効）。',
	base64MaxDimensionName: '最大画像寸法 (px)',
	base64MaxDimensionDesc:
		'キャンバスに埋め込む前に、この幅/高さを超える画像をリサイズします（デフォルト: 2048px）。',
	base64QualityName: 'WebP圧縮品質',
	base64QualityDesc: 'WebP画像圧縮の品質目標（0.10〜1.00）。',
	optimizedNotice: (count: number, kbSaved: number) =>
		`${count}件の埋め込み画像を最適化し、約${kbSaved}KB削減しました！`,
	noCompressibleNotice: '圧縮可能なBase64画像が選択されていません。',

	// Visual Inspection (Loupe Tool)
	loupeHeading: '視覚検査 (ルーペツール)',
	loupeHotkeyName: 'ルーペ起動ホットキー',
	loupeHotkeyDesc:
		'画像ノードの上にホバーしながらこのキーを押し続けると詳細を検査できます（デフォルト: Q）。',
	loupeZoomLevelName: 'ルーペ拡大倍率',
	loupeZoomLevelDesc:
		'ルーペレンズのズーム倍率を1.5倍から10.0倍まで設定します（デフォルト: 3.0倍）。',
	loupeSizeName: 'ルーペレンズの直径 (px)',
	loupeSizeDesc:
		'ルーペレンズのサイズを100pxから600pxの間で設定します（デフォルト: 260px）。',
	loupeShapeName: 'ルーペレンズの形状',
	loupeShapeDesc:
		'拡大レンズフレームの視覚形状（デフォルト: 円形）。',
	loupeShapeCircle: '円形',
	loupeShapeRounded: '角丸長方形',
	loupeShapeSquare: '正方形',
	loupeSmoothingName: 'ルーペ移動のスムージング / 減衰',
	loupeSmoothingDesc:
		'画像上をパン移動する際のマウスのブレを滑らかにします（低い値 = より滑らか & 低感度、高い値 = 高速追従。デフォルト: 0.50）。',

	// Selection Zoom
	selectionZoomHotkeyName: '選択要素へのズームフィットホットキー',
	selectionZoomHotkeyDesc:
		'要素が選択されている時にこのホットキーを押すと全体にフィットするようズームします。再度押すと元に戻ります（デフォルト: Space）。',

	// Filter panel strings
	dimOpacityLabel: '減衰不透明度',
	resetOpacityTooltip: '不透明度をデフォルトに戻す',
	searchColorsPlaceholder: '色を検索…',
	searchTagsPlaceholder: 'タグを検索…',
	includeMinorColors: 'サブカラーを含める',
	includeCardColors: 'カードカラーを含める',
	displayColorName: '色名を表示',
	inViewCount: (count: number) => `表示中 ${count} 件`,
	itemCount: (count: number) => `${count} 件の要素`,
	notInCurrentView: '現在のビュー外',
	deleteTagTooltip: 'すべてのノードからタグを削除',
	noColorsMatch: '一致する色がありません。',
	noTagsMatch: '一致するタグがありません。',
	noTagsOnCanvas: 'このキャンバスにはまだタグがありません。',
	extractingOrNoColors: '抽出中または色が見つかりません…',
	clickToExtractColors: '上のボタンをクリックして画像の色を抽出してください。',
	resetActiveFilter: 'アクティブなフィルターを解除',
	quickTagsHeader: 'クイックタグ:',
	doneBtn: '完了',
	itemsSelectedTitle: (title: string, count: number) =>
		`${title} (${count}件の要素を選択中)`,

	// Media Filename Modal
	namingModalTitleCopy: 'メディアをVaultにコピー',
	namingModalTitleMove: 'メディアをVaultに移動',
	namingModalVaultRoot: '/ (Vault ルート)',
	destinationFolderNotice: '保存先フォルダ: ',
	chooseNamingStrategy:
		'Vault内でのメディアファイルの命名方法を選択してください:',
	defaultFilenameOptTitle: 'デフォルトファイル名',
	tagFilenameOptTitle: 'タグファイル名',
	noTagsFallbackNotice: '(現在のメディアにタグがありません - デフォルトに戻ります)',
	customFilenameOptTitle: 'カスタムファイル名',
	customFilenamePlaceholder: '例: my-image',
	numberingFormatName: '連番フォーマット',
	numberingFormatDesc:
		'同名ファイルが存在する場合や一括エクスポート時に使用される連番カウンターの形式。',
	applyToAllRemaining: (count: number) =>
		`残りの${count}件すべてに適用`,
	applyToAllRemainingDesc:
		'選択した命名戦略と連番フォーマットを残りのすべてのアイテムに適用します。',
	numberFormatPadded2: '01, 02, 03... (2桁)',
	numberFormatPadded3: '001, 002, 003... (3桁)',
	numberFormatSimple: '1, 2, 3... (パディングなし)',
	numberFormatRomanUpper: 'I, II, III, IV... (ローマ数字大文字)',
	numberFormatRomanLower: 'i, ii, iii, iv... (ローマ数字小文字)',
	numberFormatLetterUpper: 'A, B, C... (アルファベット大文字)',
	numberFormatLetterLower: 'a, b, c... (アルファベット小文字)',
};

const ko: TranslationSchema = {
	settingsHeading: '표시 및 캔버스',
	hideImageLabelName: '미디어 레이블 숨기기',
	hideImageLabelDesc:
		'임베디드 캔버스 미디어 카드 위에 표시되는 base64 URL / 데이터 레이블 헤더를 숨깁니다.',
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
	duplicateKeyNotice:
		'중복된 키 바인딩은 허용되지 않습니다. 각 작업에 고유한 키를 선택하세요.',

	modalTitle: '캔버스 파일에 미디어 추가',
	modalDescription: (filename: string) =>
		`"${filename}"을(를) 어떻게 저장하시겠습니까?`,
	applyRemaining: (count: number) => `남은 미디어 ${count}개에 선택 적용`,
	saveToVault: '보관함에 저장',
	embedInCanvas: '캔버스 파일에 임베드',

	convertModalTitle: '캔버스 파일에 미디어 임베드',
	convertModalDesc: (filename: string) =>
		`"${filename}"을(를) 캔버스 파일에 직접 임베드합니다. 원본 보관함 파일을 어떻게 하시겠습니까?`,
	applyRemainingConvert: (count: number) =>
		`남은 미디어 파일 ${count}개에 선택 적용`,
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
	optimizeImageSize: '임베드된 이미지 크기 최적화',
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
	tagNodes: '태그 추가 / 편집…',
	tagModalTitle: '태그',
	tagPlaceholder: '#태그 입력 후 Enter 키 누르기',
	tagFilterPanel: '태그로 필터링',
	tagClearFilter: '필터 해제',
	tagNodesCount: (count: number) => `${count}개 요소`,
	tagPublishToVault: '태그를 보관함에 동기화',
	tagPublishToVaultDesc:
		'활성화하면 캔버스 내 모든 태그가 캔버스 파일의 프론트매터 태그로 기록되어 Obsidian 태그 패널 및 검색에 표시됩니다.',
	tagItemMenuTooltip: '태그 옵션',
	renameTag: '이름 변경',
	setTagColor: '태그 색상 추가',
	deleteTag: '태그 삭제',
	renameTagModalTitle: (tag: string) => `#${tag} 이름 변경`,
	renameTagLabel: '새 태그 이름',
	renameTagPlaceholder: '태그 이름 입력...',
	setTagColorModalTitle: (tag: string) => `태그 색상: #${tag}`,
	tagColorPreview: '미리보기:',
	tagColorPresets: '프리셋:',
	textColorLabel: '텍스트 색상',
	bgColorLabel: '배경 색상',
	clearTagColor: '색상 초기화',
	saveBtn: '저장',
	colorFilterTab: '색상',
	colorFilterPanel: '색상으로 필터링',
	colorExtractBtn: '캔버스 색상 스캔',
	colorExtracting: '색상 추출 중…',
	colorNoImages: '이 캔버스에 감지된 색상이 포함된 이미지가 없습니다.',
	colorClearFilter: '색상 필터 해제',
	colorNodesCount: (count: number) => `${count}개 요소`,
	colorSettingHeader: '색상 추출',
	colorSettingName: '자동 색상 추출',
	colorSettingDesc:
		'캔버스를 열 때 이미지에서 대표 색상을 자동으로 추출합니다. 대형 캔버스의 성능을 향상시키려면 수동 또는 비활성화로 설정하세요.',
	colorModeAuto: '자동 (캔버스 열 때 추출)',
	colorModeManual: '수동 (버튼 클릭 시 추출)',
	colorModeDisabled: '비활성화',
	colorBlack: '블랙',
	colorGray: '그레이',
	colorWhite: '화이트',
	colorRed: '레드',
	colorOrange: '오렌지',
	colorYellow: '옐로우',
	colorGreen: '그린',
	colorTeal: '틸',
	colorCyan: '시안',
	colorBlue: '블루',
	colorIndigo: '인디고',
	colorPurple: '퍼플',
	colorPink: '핑크',

	// Palette & Settings translations
	copyHexNotice: (hex: string) => `${hex} 코드가 클립보드에 복사되었습니다!`,
	copyAllColorsNotice: (count: number) =>
		`${count}개 색상이 클립보드에 복사되었습니다!`,
	copyAllColorsTooltip: '모든 팔레트 색상 복사',
	tagBadgePositionName: '태그 배지 위치',
	tagBadgePositionDesc:
		'요소 태그 배지를 요소 하단(외부)에 표시할지, 좌측 하단(내부)에 표시할지 선택합니다.',
	tagBadgePositionOutside: '외부 (요소 아래)',
	tagBadgePositionInside: '내부 (좌측 하단)',
	tagZoomOnSelectName: '태그 선택 시 자동 확대/축소',
	tagZoomOnSelectDesc:
		'패널에서 태그 필터를 선택하거나 해제할 때 표시되는 요소에 맞춰 자동으로 확대/축소합니다.',
	paletteCopySeparatorName: '색상 팔레트 복사 구분자',
	paletteCopySeparatorDesc:
		'색상 팔레트 복사 버튼을 눌러 모든 HEX 값을 클립보드에 복사할 때 사용할 구분자입니다.',
	colorExtractModeName: '색상 추출 모드',
	colorExtractModeDesc:
		'색상 필터 패널용으로 캔버스 이미지에서 대표 색상을 추출할 시점을 제어합니다.',
	noImageInClipboardNotice: '클립보드에서 이미지를 찾을 수 없습니다',
	unableAccessClipboardNotice: '클립보드에 접근할 수 없습니다',

	paletteSwatchCountName: '색상 팔레트 스와치',
	paletteSwatchCountDesc:
		'이미지에 색상 팔레트가 활성화되었을 때 표시할 주요 색상 수입니다 (3–10).',
	base64Heading: 'Base64 이미지 최적화',
	autoOptimizeBase64Name: '붙여넣기 / 드롭 시 Base64 자동 최적화',
	autoOptimizeBase64Desc:
		'붙여넣거나 드롭한 Base64 이미지를 WebP 형식으로 자동 압축합니다 (기본값: 비활성화).',
	base64MaxDimensionName: '최대 이미지 크기 (px)',
	base64MaxDimensionDesc:
		'캔버스에 임베드하기 전에 이 너비/높이를 초과하는 이미지의 크기를 조정합니다 (기본값: 2048px).',
	base64QualityName: 'WebP 압축 품질',
	base64QualityDesc: 'WebP 이미지 압축 품질 목표 (0.10 ~ 1.00).',
	optimizedNotice: (count: number, kbSaved: number) =>
		`${count}개의 임베디드 이미지가 최적화되었으며, 약 ${kbSaved} KB를 절약했습니다!`,
	noCompressibleNotice: '압축 가능한 base64 이미지가 선택되지 않았습니다.',

	loupeHeading: '시각적 검사 (돋보기 도구)',
	loupeHotkeyName: '돋보기 활성화 단축키',
	loupeHotkeyDesc:
		'이미지 노드 위에 마우스를 올린 상태에서 이 키를 누르고 있으면 세부 정보를 검사합니다 (기본값: Q).',
	loupeZoomLevelName: '돋보기 확대 배율',
	loupeZoomLevelDesc:
		'돋보기 렌즈의 확대 배율을 1.5x에서 10.0x까지 설정합니다 (기본값: 3.0x).',
	loupeSizeName: '돋보기 렌즈 직경 (px)',
	loupeSizeDesc: '돋보기 렌즈의 픽셀 크기 (100px ~ 600px, 기본값: 260px).',
	loupeShapeName: '돋보기 렌즈 모양',
	loupeShapeDesc: '돋보기 프레임의 시각적 모양입니다 (기본값: 원형).',
	loupeShapeCircle: '원형',
	loupeShapeRounded: '둥근 사각형',
	loupeShapeSquare: '정사각형',
	loupeSmoothingName: '돋보기 이동 부드럽게하기 / 감쇄',
	loupeSmoothingDesc:
		'이미지를 이동할 때 마우스 떨림을 부드럽게 합니다 (낮음 = 더 부드럽고 둔감함, 높음 = 빠른 추적. 기본값: 0.50).',

	selectionZoomHotkeyName: '선택 영역 맞춤 확대 단축키',
	selectionZoomHotkeyDesc:
		'요소가 선택되었을 때 이 단축키를 누르면 전체 화면에 맞게 확대됩니다 (기본값: 스페이스바).',

	dimOpacityLabel: '어둡게 불투명도',
	resetOpacityTooltip: '불투명도 기본값으로 복원',
	searchColorsPlaceholder: '색상 검색…',
	searchTagsPlaceholder: '태그 검색…',
	includeMinorColors: '보조 색상 포함',
	includeCardColors: '카드 색상 포함',
	displayColorName: '색상 이름 표시',
	inViewCount: (count: number) => `현재 화면에 ${count}개`,
	itemCount: (count: number) => `${count}개 항목`,
	notInCurrentView: '현재 화면에 없음',
	deleteTagTooltip: '모든 노드에서 태그 삭제',
	noColorsMatch: '일치하는 색상이 없습니다.',
	noTagsMatch: '일치하는 태그가 없습니다.',
	noTagsOnCanvas: '이 캔버스에는 아직 태그가 없습니다.',
	extractingOrNoColors: '색상 추출 중이거나 발견되지 않았습니다…',
	clickToExtractColors: '위 버튼을 클릭하여 이미지 색상을 추출하세요.',
	resetActiveFilter: '활성 필터 초기화',
	quickTagsHeader: '빠른 태그:',
	doneBtn: '완료',
	itemsSelectedTitle: (title: string, count: number) =>
		`${title} (${count}개 항목 선택됨)`,

	namingModalTitleCopy: '보관함으로 미디어 복사',
	namingModalTitleMove: '보관함으로 미디어 이동',
	namingModalVaultRoot: '/ (보관함 루트)',
	destinationFolderNotice: '대상 폴더: ',
	chooseNamingStrategy:
		'보관함에 저장할 미디어 파일의 이름 지정 방법을 선택하세요:',
	defaultFilenameOptTitle: '기본 파일 이름',
	tagFilenameOptTitle: '태그 파일 이름',
	noTagsFallbackNotice: '(현재 미디어에 태그가 없음 - 기본값으로 설정됨)',
	customFilenameOptTitle: '사용자 지정 파일 이름',
	customFilenamePlaceholder: '예: my-image',
	numberingFormatName: '번호 지정 형식',
	numberingFormatDesc:
		'중복 이름이 있거나 일괄 내보내기를 할 때 사용되는 카운터 형식입니다.',
	applyToAllRemaining: (count: number) => `남은 ${count}개 항목 전체에 적용`,
	applyToAllRemainingDesc:
		'선택한 이름 지정 전략 및 번호 형식을 모든 남은 항목에 사용합니다.',
	numberFormatPadded2: '01, 02, 03... (2자리)',
	numberFormatPadded3: '001, 002, 003... (3자리)',
	numberFormatSimple: '1, 2, 3... (패딩 없음)',
	numberFormatRomanUpper: 'I, II, III, IV... (로마자 대문자)',
	numberFormatRomanLower: 'i, ii, iii, iv... (로마자 소문자)',
	numberFormatLetterUpper: 'A, B, C... (알파벳 대문자)',
	numberFormatLetterLower: 'a, b, c... (알파벳 소문자)',
};

const ru: TranslationSchema = {
	settingsHeading: 'Отображение и холст',
	hideImageLabelName: 'Скрыть метку медиа',
	hideImageLabelDesc:
		'Скрыть заголовок метки base64 URL / данных над встроенными карточками медиа.',
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
	duplicateKeyNotice:
		'Дублирование привязок клавиш не допускается. Пожалуйста, выберите уникальные клавиши для каждого действия.',

	modalTitle: 'Добавить медиа в файл холста',
	modalDescription: (filename: string) =>
		`Как вы хотите сохранить «${filename}»?`,
	applyRemaining: (count: number) =>
		`Применить выбор к оставшимся ${count} медиа`,
	saveToVault: 'Сохранить в хранилище',
	embedInCanvas: 'Встроить в файл холста',

	convertModalTitle: 'Встроить медиа в файл холста',
	convertModalDesc: (filename: string) =>
		`Встраивание «${filename}» непосредственно в файл холста. Что вы хотите сделать с исходным файлом хранилища?`,
	applyRemainingConvert: (count: number) =>
		`Применить выбор к оставшимся ${count} медиафайлам`,
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
	optimizeImageSize: 'Оптимизировать размер встроенного изображения',
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
	tagNodes: 'Добавить / редактировать теги…',
	tagModalTitle: 'Теги',
	tagPlaceholder: '#тег, нажмите Enter для добавления',
	tagFilterPanel: 'Фильтр по тегам',
	tagClearFilter: 'Сбросить фильтр',
	tagNodesCount: (count: number) => `${count} элем.`,
	tagPublishToVault: 'Синхронизировать теги с хранилищем',
	tagPublishToVaultDesc:
		'При включении все теги холста записываются как теги frontmatter в этот файл холста, делая их видимыми на панели тегов и в поиске Obsidian.',
	tagItemMenuTooltip: 'Параметры тега',
	renameTag: 'Переименовать',
	setTagColor: 'Добавить цвет тегу',
	deleteTag: 'Удалить тег',
	renameTagModalTitle: (tag: string) => `Переименовать #${tag}`,
	renameTagLabel: 'Новое имя тега',
	renameTagPlaceholder: 'Введите имя тега...',
	setTagColorModalTitle: (tag: string) => `Цвет тега: #${tag}`,
	tagColorPreview: 'Предпросмотр:',
	tagColorPresets: 'Пресеты:',
	textColorLabel: 'Цвет текста',
	bgColorLabel: 'Цвет фона',
	clearTagColor: 'Сбросить цвет',
	saveBtn: 'Сохранить',
	colorFilterTab: 'Цвет',
	colorFilterPanel: 'Фильтр по цвету',
	colorExtractBtn: 'Сканировать цвета холста',
	colorExtracting: 'Извлечение цветов…',
	colorNoImages:
		'На этом холсте не найдено изображений с распознанными цветами.',
	colorClearFilter: 'Сбросить фильтр цвета',
	colorNodesCount: (count: number) => `${count} элем.`,
	colorSettingHeader: 'Извлечение цвета',
	colorSettingName: 'Автоматическое извлечение цвета',
	colorSettingDesc:
		'Автоматически извлекать преобладающие цвета из изображений при открытии холста. Установите значение «Вручную» или «Отключено» для повышения производительности на больших холстах.',
	colorModeAuto: 'Автоматически (при открытии холста)',
	colorModeManual: 'Вручную (по нажатию кнопки)',
	colorModeDisabled: 'Отключено',
	colorBlack: 'Чёрный',
	colorGray: 'Серый',
	colorWhite: 'Белый',
	colorRed: 'Красный',
	colorOrange: 'Оранжевый',
	colorYellow: 'Жёлтый',
	colorGreen: 'Зелёный',
	colorTeal: 'Бирюзовый',
	colorCyan: 'Голубой',
	colorBlue: 'Синий',
	colorIndigo: 'Индиго',
	colorPurple: 'Фиолетовый',
	colorPink: 'Розовый',

	// Palette & Settings translations
	copyHexNotice: (hex: string) => `${hex} скопирован в буфер обмена!`,
	copyAllColorsNotice: (count: number) =>
		`Скопировано цветов: ${count} в буфер обмена!`,
	copyAllColorsTooltip: 'Скопировать все цвета палитры',
	tagBadgePositionName: 'Расположение значка тега',
	tagBadgePositionDesc:
		'Выберите, отображаются ли значки тегов элементов снаружи (под элементом) или внутри (снизу слева).',
	tagBadgePositionOutside: 'Снаружи (под элементом)',
	tagBadgePositionInside: 'Внутри (снизу слева)',
	tagZoomOnSelectName: 'Автомасштабирование при выборе тега',
	tagZoomOnSelectDesc:
		'Автоматически приближает и подгоняет видимые элементы при выборе или сбросе фильтров тегов.',
	paletteCopySeparatorName: 'Разделитель копирования цветовой палитры',
	paletteCopySeparatorDesc:
		'Разделитель, используемый при нажатии кнопки копирования палитры для копирования всех HEX-значений в буфер обмена.',
	colorExtractModeName: 'Режим извлечения цвета',
	colorExtractModeDesc:
		'Управляет тем, когда преобладающие цвета извлекаются из изображений холста для панели фильтрации цветов.',
	noImageInClipboardNotice: 'Изображение в буфере обмена не найдено',
	unableAccessClipboardNotice: 'Не удалось получить доступ к буферу обмена',

	paletteSwatchCountName: 'Образцы палитры цветов',
	paletteSwatchCountDesc:
		'Количество доминирующих цветов для отображения на изображении (3–10).',
	base64Heading: 'Оптимизация изображений Base64',
	autoOptimizeBase64Name:
		'Авто-оптимизация Base64 при вставке / перетаскивании',
	autoOptimizeBase64Desc:
		'Автоматически сжимает вставленные изображения Base64 в формат WebP (По умолчанию: Отключено).',
	base64MaxDimensionName: 'Максимальный размер изображения (px)',
	base64MaxDimensionDesc:
		'Изменяет размер изображений, превышающих эту ширину/высоту, перед внедрением (По умолчанию: 2048px).',
	optimizedNotice: (count: number, kbSaved: number) =>
		`Оптимизировано ${count} встроенных изображений, сэкономлено ~${kbSaved} КБ!`,
	noCompressibleNotice: 'Не выбраны сжимаемые изображения base64.',

	loupeHeading: 'Визуальный осмотр (Инструмент Лупа)',
	loupeHotkeyName: 'Горячая клавиша активации лупы',
	loupeHotkeyDesc:
		'Удерживайте эту клавишу при наведении на узел изображения (По умолчанию: Q).',
	loupeZoomLevelName: 'Уровень увеличения лупы',
	loupeZoomLevelDesc:
		'Коэффициент увеличения для лупы от 1.5x до 10.0x (По умолчанию: 3.0x).',
	loupeSizeName: 'Диаметр линзы лупы (px)',
	loupeSizeDesc:
		'Размер линзы лупы в пикселях от 100px до 600px (По умолчанию: 260px).',
	loupeShapeName: 'Форма линзы лупы',
	loupeShapeDesc: 'Форма рамки лупы (По умолчанию: Круг).',
	loupeShapeCircle: 'Круг',
	loupeShapeRounded: 'Закругленный прямоугольник',
	loupeShapeSquare: 'Квадрат',
	loupeSmoothingName: 'Сглаживание / затухание движения лупы',
	loupeSmoothingDesc:
		'Сглаживает дрожание мыши при перемещении (Ниже = глаже, Выше = быстрее. По умолчанию: 0.50).',

	selectionZoomHotkeyName:
		'Горячая клавиша масштабирования к выделенному',
	selectionZoomHotkeyDesc:
		'Нажмите эту клавишу при выделении элементов, чтобы приблизить их (По умолчанию: Пробел).',

	dimOpacityLabel: 'Прозрачность затемнения',
	resetOpacityTooltip: 'Сбросить прозрачность по умолчанию',
	searchColorsPlaceholder: 'Поиск цветов…',
	searchTagsPlaceholder: 'Поиск тегов…',
	includeMinorColors: 'Включать второстепенные цвета',
	includeCardColors: 'Включать цвета карточек',
	displayColorName: 'Отображать название цвета',
	inViewCount: (count: number) => `${count} в области видимости`,
	itemCount: (count: number) => `${count} элемент${count === 1 ? '' : 'ов'}`,
	notInCurrentView: 'Вне текущей области видимости',
	deleteTagTooltip: 'Удалить тег со всех узлов',
	noColorsMatch: 'Совпадающих цветов не найдено.',
	noTagsMatch: 'Совпадающих тегов не найдено.',
	noTagsOnCanvas: 'На этом холсте пока нет тегов.',
	extractingOrNoColors: 'Извлечение или цвета не найдены…',
	clickToExtractColors:
		'Нажмите кнопку выше, чтобы извлечь цвета.',
	resetActiveFilter: 'Сбросить активный фильтр',
	quickTagsHeader: 'Быстрые теги:',
	doneBtn: 'Готово',
	itemsSelectedTitle: (title: string, count: number) =>
		`${title} (выбрано элементов: ${count})`,

	namingModalTitleCopy: 'Копировать медиафайл в хранилище',
	namingModalTitleMove: 'Переместить медиафайл в хранилище',
	namingModalVaultRoot: '/ (Корень хранилища)',
	destinationFolderNotice: 'Целевая папка: ',
	chooseNamingStrategy:
		'Выберите способ именования медиафайла в хранилище:',
	defaultFilenameOptTitle: 'Имя по умолчанию',
	tagFilenameOptTitle: 'Имя на основе тегов',
	noTagsFallbackNotice:
		'(У файла нет тегов - будет использовано имя по умолчанию)',
	customFilenameOptTitle: 'Пользовательское имя',
	customFilenamePlaceholder: 'напр. моё-изображение',
	numberingFormatName: 'Формат нумерации',
	numberingFormatDesc:
		'Формат для счетчиков при дубликатах или пакетном экспорте.',
	applyToAllRemaining: (count: number) =>
		`Применить ко всем оставшимся (${count})`,
	applyToAllRemainingDesc:
		'Использует выбранную стратегию именования и формат нумерации для всех оставшихся файлов.',
	numberFormatPadded2: '01, 02, 03... (2 цифры)',
	numberFormatPadded3: '001, 002, 003... (3 цифры)',
	numberFormatSimple: '1, 2, 3... (Без дополнения)',
	numberFormatRomanUpper: 'I, II, III, IV... (Римские заглавные)',
	numberFormatRomanLower: 'i, ii, iii, iv... (Римские строчные)',
	numberFormatLetterUpper: 'A, B, C... (Алфавит заглавные)',
	numberFormatLetterLower: 'a, b, c... (Алфавит строчные)',
};

const pt: TranslationSchema = {
	settingsHeading: 'Exibição e tela',
	hideImageLabelName: 'Ocultar rótulo de mídia',
	hideImageLabelDesc:
		'Ocultar o cabeçalho do rótulo de dados / URL base64 exibido acima dos cartões de mídia incorporados.',
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
	duplicateKeyNotice:
		'Teclas duplicadas não são permitidas. Por favor, escolha teclas únicas para cada ação.',

	modalTitle: 'Adicionar mídia ao arquivo de tela',
	modalDescription: (filename: string) =>
		`Como você gostaria de armazenar "${filename}"?`,
	applyRemaining: (count: number) =>
		`Aplicar escolha às ${count} mídias restantes`,
	saveToVault: 'Salvar no cofre',
	embedInCanvas: 'Incorporar no arquivo de tela',

	convertModalTitle: 'Incorporar mídia no arquivo de tela',
	convertModalDesc: (filename: string) =>
		`Incorporando "${filename}" diretamente no arquivo de tela. O que você deseja fazer com o arquivo original do cofre?`,
	applyRemainingConvert: (count: number) =>
		`Aplicar escolha aos ${count} arquivos de mídia restantes`,
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
	optimizeImageSize: 'Otimizar tamanho da imagem incorporada',
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
	tagNodes: 'Adicionar / Editar Tags…',
	tagModalTitle: 'Tags',
	tagPlaceholder: '#tag, pressione Enter para adicionar',
	tagFilterPanel: 'Filtrar por tag',
	tagClearFilter: 'Limpar filtro',
	tagNodesCount: (count: number) =>
		`${count} elemento${count === 1 ? '' : 's'}`,
	tagPublishToVault: 'Sincronizar tags com o cofre',
	tagPublishToVaultDesc:
		'Quando ativado, todas as tags da tela são gravadas como tags frontmatter neste arquivo de tela, tornando-as visíveis no painel de tags e na pesquisa do Obsidian.',
	tagItemMenuTooltip: 'Opções de tag',
	renameTag: 'Renomear',
	setTagColor: 'Adicionar cor à tag',
	deleteTag: 'Excluir tag',
	renameTagModalTitle: (tag: string) => `Renomear #${tag}`,
	renameTagLabel: 'Novo nome da tag',
	renameTagPlaceholder: 'Digite o nome da tag...',
	setTagColorModalTitle: (tag: string) => `Cor da tag: #${tag}`,
	tagColorPreview: 'Visualização:',
	tagColorPresets: 'Predefinições:',
	textColorLabel: 'Cor do texto',
	bgColorLabel: 'Cor de fundo',
	clearTagColor: 'Limpar cor',
	saveBtn: 'Salvar',
	colorFilterTab: 'Cor',
	colorFilterPanel: 'Filtrar por cor',
	colorExtractBtn: 'Escanear cores da tela',
	colorExtracting: 'Extraindo cores…',
	colorNoImages: 'Nenhuma imagem com cores detectadas nesta tela.',
	colorClearFilter: 'Limpar filtro de cor',
	colorNodesCount: (count: number) =>
		`${count} elemento${count === 1 ? '' : 's'}`,
	colorSettingHeader: 'Extração de cor',
	colorSettingName: 'Extração automática de cor',
	colorSettingDesc:
		'Extrai automaticamente as cores dominantes das imagens ao abrir a tela. Defina como Manual ou Desativado para melhorar o desempenho em telas grandes.',
	colorModeAuto: 'Automático (extrair ao abrir a tela)',
	colorModeManual: 'Manual (extrair ao clicar no botão)',
	colorModeDisabled: 'Desativado',
	colorBlack: 'Preto',
	colorGray: 'Cinza',
	colorWhite: 'Branco',
	colorRed: 'Vermelho',
	colorOrange: 'Laranja',
	colorYellow: 'Amarelo',
	colorGreen: 'Verde',
	colorTeal: 'Azul-petróleo',
	colorCyan: 'Ciano',
	colorBlue: 'Azul',
	colorIndigo: 'Índigo',
	colorPurple: 'Roxo',
	colorPink: 'Rosa',

	// Palette & Settings translations
	copyHexNotice: (hex: string) =>
		`Copiado ${hex} para a área de transferência!`,
	copyAllColorsNotice: (count: number) =>
		`Copiadas ${count} cor${count === 1 ? '' : 'es'} para a área de transferência!`,
	copyAllColorsTooltip: 'Copiar todas as cores da paleta',
	tagBadgePositionName: 'Posição do selo de tag',
	tagBadgePositionDesc:
		'Escolha se os selos de tag são renderizados fora (abaixo do elemento) ou dentro (inferior esquerdo).',
	tagBadgePositionOutside: 'Fora (abaixo do elemento)',
	tagBadgePositionInside: 'Dentro (inferior esquerdo)',
	tagZoomOnSelectName: 'Zoom automático ao selecionar tag',
	tagZoomOnSelectDesc:
		'Aproxima e ajusta automaticamente os elementos visíveis ao selecionar ou limpar filtros de tag.',
	paletteCopySeparatorName: 'Separador de cópia da paleta de cores',
	paletteCopySeparatorDesc:
		'Delimitador usado ao clicar no botão de copiar da paleta para copiar todos os valores hexadecimais para a área de transferência.',
	colorExtractModeName: 'Modo de extração de cor',
	colorExtractModeDesc:
		'Controla quando as cores dominantes são extraídas das imagens da tela para o painel de filtro de cor.',
	noImageInClipboardNotice:
		'Nenhuma imagem encontrada na área de transferência',
	unableAccessClipboardNotice:
		'Não foi possível acessar a área de transferência',

	paletteSwatchCountName: 'Amostras da paleta de cores',
	paletteSwatchCountDesc:
		'Número de cores dominantes a exibir quando a paleta de cores está ativada numa imagem (3–10).',
	base64Heading: 'Otimização de imagem Base64',
	autoOptimizeBase64Name: 'Otimizar automaticamente Base64 ao colar / arrastar',
	autoOptimizeBase64Desc:
		'Comprime automaticamente imagens Base64 coladas ou arrastadas para formato WebP (Padrão: Desativado).',
	base64MaxDimensionName: 'Dimensão máxima da imagem (px)',
	base64MaxDimensionDesc:
		'Redimensiona imagens que excedam esta largura/altura antes de incorporar na tela (Padrão: 2048 px).',
	optimizedNotice: (count: number, kbSaved: number) =>
		`${count} imagem(ns) incorporada(s) otimizada(s), economizando ~${kbSaved} KB!`,
	noCompressibleNotice: 'Nenhuma imagem base64 compressível selecionada.',

	loupeHeading: 'Inspeção visual (ferramenta de lupa)',
	loupeHotkeyName: 'Atalho de ativação da lupa',
	loupeHotkeyDesc:
		'Mantenha pressionada esta tecla ao passar o mouse sobre uma imagem para inspecionar detalhes (Padrão: Q).',
	loupeZoomLevelName: 'Nível de zoom da lupa',
	loupeZoomLevelDesc:
		'Multiplicador de zoom da lupa de 1.5x a 10.0x (Padrão: 3.0x).',
	loupeSizeName: 'Diâmetro da lupa (px)',
	loupeSizeDesc:
		'Tamanho da lente da lupa em pixels de 100px a 600px (Padrão: 260px).',
	loupeShapeName: 'Formato da lupa',
	loupeShapeDesc: 'Formato visual do quadro da lupa (Padrão: Círculo).',
	loupeShapeCircle: 'Círculo',
	loupeShapeRounded: 'Retângulo arredondado',
	loupeShapeSquare: 'Quadrado',
	loupeSmoothingName: 'Suavização / amortecimento da lupa',
	loupeSmoothingDesc:
		'Suaviza o movimento do mouse ao rastrear imagens (menor = mais suave/menos sensível, maior = rastreamento mais rápido. Padrão: 0.50).',

	selectionZoomHotkeyName: 'Atalho de zoom na seleção',
	selectionZoomHotkeyDesc:
		'Pressione esta tecla com elementos selecionados para dar zoom e ajustá-los à tela (Padrão: Espaço).',

	dimOpacityLabel: 'Opacidade do escurecimento',
	resetOpacityTooltip: 'Restaurar opacidade padrão',
	searchColorsPlaceholder: 'Pesquisar cores…',
	searchTagsPlaceholder: 'Pesquisar tags…',
	includeMinorColors: 'Incluir cores secundárias',
	includeCardColors: 'Incluir cores dos cartões',
	displayColorName: 'Exibir nome da cor',
	inViewCount: (count: number) => `${count} na exibição`,
	itemCount: (count: number) => `${count} item(ns)`,
	notInCurrentView: 'Não está na exibição atual',
	deleteTagTooltip: 'Excluir tag de todos os nós',
	noColorsMatch: 'Nenhuma cor correspondente.',
	noTagsMatch: 'Nenhuma tag correspondente.',
	noTagsOnCanvas: 'Nenhuma tag nesta tela ainda.',
	extractingOrNoColors: 'Extraindo ou nenhuma cor encontrada…',
	clickToExtractColors: 'Clique para extrair cores dominantes das imagens da tela',
	resetActiveFilter: 'Redefinir filtro ativo',
	namingModalTitleCopy: 'Copiar mídia para o cofre',
	namingModalTitleMove: 'Mover mídia para o cofre',
	namingModalVaultRoot: '/ (Raiz do cofre)',
	destinationFolderNotice: 'Pasta de destino: ',
	chooseNamingStrategy: 'Escolha como nomear o arquivo de mídia no cofre:',
	defaultFilenameOptTitle: 'Nome de arquivo padrão',
	tagFilenameOptTitle: 'Nome de arquivo por tag',
	noTagsFallbackNotice:
		'(Nenhuma tag na mídia - usará o padrão)',
	customFilenameOptTitle: 'Nome de arquivo personalizado',
	customFilenamePlaceholder: 'ex. minha-imagem',
	numberingFormatName: 'Formato de numeração',
	numberingFormatDesc:
		'Formato usado para contadores incrementais (ex. duplicatas ou exportações em lote).',
	applyToAllRemaining: (count: number) =>
		`Aplicar a todos os ${count} itens restantes`,
	applyToAllRemainingDesc:
		'Usar estratégia de nomenclatura e formato selecionados para todos os itens restantes.',
	numberFormatPadded2: '01, 02, 03... (2 dígitos)',
	numberFormatPadded3: '001, 002, 003... (3 dígitos)',
	numberFormatSimple: '1, 2, 3... (Sem zeros)',
	numberFormatRomanUpper: 'I, II, III, IV... (Romano maiúsculo)',
	numberFormatRomanLower: 'i, ii, iii, iv... (Romano minúsculo)',
	numberFormatLetterUpper: 'A, B, C... (Alfabeto maiúsculo)',
	numberFormatLetterLower: 'a, b, c... (Alfabeto minúsculo)',
};

const it: TranslationSchema = {
	settingsHeading: 'Visualizzazione e Tela',
	hideImageLabelName: 'Nascondi etichetta media',
	hideImageLabelDesc:
		'Nascondi l’intestazione dell’etichetta del data / URL base64 mostrata sopra le schede media incorporate.',
	keyboardPanHeading: 'Controlli di panoramica da tastiera',
	panControlsName: 'Controlli di panoramica',
	panControlsDesc: 'Insieme di tasti per scorrere la tela.',
	restoreDefaultTooltip: 'Ripristina predefiniti',
	updatePanControlsButton: 'Aggiorna controlli di panoramica',
	maxPanSpeedName: 'Velocità massima di panoramica',
	maxPanSpeedDesc: 'Unità della tela da spostare',
	keyboardZoomHeading: 'Controlli di zoom da tastiera',
	zoomControlsName: 'Controlli di zoom',
	zoomControlsDesc: 'Insieme di tasti per ingrandire o rimpicciolire la tela.',
	updateZoomControlsButton: 'Aggiorna controlli di zoom',
	zoomSpeedName: 'Velocità dello zoom',
	zoomSpeedDesc: 'Tasso di modifica dello zoom per fotogramma',
	duplicateKeyNotice:
		'I tasti duplicati non sono consentiti. Scegli tasti univoci per ciascuna azione.',

	modalTitle: 'Aggiungi media al file della tela',
	modalDescription: (filename: string) =>
		`Come desideri archiviare "${filename}"?`,
	applyRemaining: (count: number) =>
		`Applica scelta ai rimanenti ${count} elementi media`,
	saveToVault: 'Salva nel vault',
	embedInCanvas: 'Incorpora nel file della tela',

	convertModalTitle: 'Incorpora media nel file della tela',
	convertModalDesc: (filename: string) =>
		`Incorporazione di "${filename}" direttamente nel file della tela. Cosa desideri fare con il file originale nel vault?`,
	applyRemainingConvert: (count: number) =>
		`Applica scelta ai rimanenti ${count} file media`,
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
	optimizeImageSize: 'Ottimizza dimensioni immagine incorporata',
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
	tagNodes: 'Aggiungi / Modifica Tag…',
	tagModalTitle: 'Tag',
	tagPlaceholder: '#tag, premi Invio per aggiungere',
	tagFilterPanel: 'Filtra per tag',
	tagClearFilter: 'Rimuovi filtro',
	tagNodesCount: (count: number) =>
		`${count} elemento${count === 1 ? '' : 'i'}`,
	tagPublishToVault: 'Sincronizza tag nella cassaforte',
	tagPublishToVaultDesc:
		'Se abilitato, tutti i tag della tela vengono scritti come tag frontmatter in questo file della tela, rendendoli visibili nel pannello tag e nella ricerca di Obsidian.',
	tagItemMenuTooltip: 'Opzioni tag',
	renameTag: 'Rinomina',
	setTagColor: 'Aggiungi colore al tag',
	deleteTag: 'Elimina tag',
	renameTagModalTitle: (tag: string) => `Rinomina #${tag}`,
	renameTagLabel: 'Nuovo nome tag',
	renameTagPlaceholder: 'Inserisci nome tag...',
	setTagColorModalTitle: (tag: string) => `Colore tag: #${tag}`,
	tagColorPreview: 'Anteprima:',
	tagColorPresets: 'Preset:',
	textColorLabel: 'Colore testo',
	bgColorLabel: 'Colore di sfondo',
	clearTagColor: 'Rimuovi colore',
	saveBtn: 'Salva',
	colorFilterTab: 'Colore',
	colorFilterPanel: 'Filtra per colore',
	colorExtractBtn: 'Scansiona colori della tela',
	colorExtracting: 'Estrazione colori…',
	colorNoImages: 'Nessuna immagine con colori rilevati in questa tela.',
	colorClearFilter: 'Rimuovi filtro colore',
	colorNodesCount: (count: number) =>
		`${count} elemento${count === 1 ? '' : 'i'}`,
	colorSettingHeader: 'Estrazione colore',
	colorSettingName: 'Estrazione automatica colore',
	colorSettingDesc:
		'Estrae automaticamente i colori dominanti dalle immagini all’apertura della tela. Imposta su Manuale o Disattivato per migliorare le prestazioni su tele di grandi dimensioni.',
	colorModeAuto: 'Automatico (estrai all’apertura)',
	colorModeManual: 'Manuale (estrai su clic del pulsante)',
	colorModeDisabled: 'Disattivato',
	colorBlack: 'Nero',
	colorGray: 'Grigio',
	colorWhite: 'Bianco',
	colorRed: 'Rosso',
	colorOrange: 'Arancione',
	colorYellow: 'Giallo',
	colorGreen: 'Verde',
	colorTeal: 'Tottora',
	colorCyan: 'Ciano',
	colorBlue: 'Blu',
	colorIndigo: 'Indaco',
	colorPurple: 'Viola',
	colorPink: 'Rosa',

	// Palette & Settings translations
	copyHexNotice: (hex: string) => `Copiato ${hex} negli appunti!`,
	copyAllColorsNotice: (count: number) =>
		`Copiati ${count} color${count === 1 ? 'e' : 'i'} negli appunti!`,
	copyAllColorsTooltip: 'Copia tutti i colori della tavolozza',
	tagBadgePositionName: 'Posizione del badge tag',
	tagBadgePositionDesc:
		'Scegli se i badge tag vengono mostrati all’esterno (sotto l’elemento) o all’interno (in basso a sinistra).',
	tagBadgePositionOutside: 'Esterno (sotto l’elemento)',
	tagBadgePositionInside: 'Interno (in basso a sinistra)',
	tagZoomOnSelectName: 'Zoom automatico alla selezione tag',
	tagZoomOnSelectDesc:
		'Ingrandisce e adatta automaticamente gli elementi visibili quando si selezionano o rimuovono i filtri tag.',
	paletteCopySeparatorName: 'Separatore di copia tavolozza colori',
	paletteCopySeparatorDesc:
		'Delimitatore utilizzato quando si fa clic sul pulsante di copia della tavolozza per copiare tutti i valori esadecimali negli appunti.',
	colorExtractModeName: 'Modalità estrazione colore',
	colorExtractModeDesc:
		'Controlla quando i colori dominanti vengono estratti dalle immagini della tela per il pannello di filtraggio colore.',
	noImageInClipboardNotice: 'Nessuna immagine trovata negli appunti',
	unableAccessClipboardNotice: 'Impossibile accedere agli appunti',

	paletteSwatchCountName: 'Campioni della tavolozza colori',
	paletteSwatchCountDesc:
		'Numero di colori dominanti da mostrare quando la tavolozza colori è abilitata su un\'immagine (3–10).',
	base64Heading: 'Ottimizzazione immagini Base64',
	autoOptimizeBase64Name:
		'Ottimizza automaticamente Base64 all\'incolla / rilascia',
	autoOptimizeBase64Desc:
		'Comprime automaticamente le immagini Base64 incollate o rilasciate nel formato WebP (Predefinito: Disabilitato).',
	base64MaxDimensionName: 'Dimensione massima immagine (px)',
	base64MaxDimensionDesc:
		'Ridimensiona le immagini che superano questa larghezza/altezza prima di incorporarle nella tela (Predefinito: 2048px).',
	optimizedNotice: (count: number, kbSaved: number) =>
		`${count} immagine/i incorporata/e ottimizzata/e, ~${kbSaved} KB risparmiati!`,
	noCompressibleNotice: 'Nessuna immagine base64 comprimibile selezionata.',

	loupeHeading: 'Ispezione visiva (Strumento Lente)',
	loupeHotkeyName: 'Scorciatoia attivazione lente',
	loupeHotkeyDesc:
		'Tieni premuto questo tasto mentre passi sopra un nodo immagine per ispezionarlo (Predefinito: Q).',
	loupeZoomLevelName: 'Livello d\'ingrandimento della lente',
	loupeZoomLevelDesc:
		'Moltiplicatore di zoom per la lente da 1.5x a 10.0x (Predefinito: 3.0x).',
	loupeSizeName: 'Diametro lente (px)',
	loupeSizeDesc:
		'Dimensione della lente in pixel da 100px a 600px (Predefinito: 260px).',
	loupeShapeName: 'Forma della lente',
	loupeShapeDesc:
		'Forma visiva della lente d\'ingrandimento (Predefinito: Cerchio).',
	loupeShapeCircle: 'Cerchio',
	loupeShapeRounded: 'Rettangolo arrotondato',
	loupeShapeSquare: 'Quadrato',
	loupeSmoothingName: 'Smorzamento movimento lente',
	loupeSmoothingDesc:
		'Attenua i tremolii del mouse durante lo scorrimento (Più basso = più fluido, Più alto = tracciamento più rapido. Predefinito: 0.50).',

	selectionZoomHotkeyName: 'Scorciatoia zoom adatta alla selezione',
	selectionZoomHotkeyDesc:
		'Premi questa scorciatoia quando ci sono elementi selezionati per me adattarli allo schermo (Predefinito: Spazio).',

	dimOpacityLabel: 'Opacità oscuramento',
	resetOpacityTooltip: 'Ripristina opacità predefinita',
	searchColorsPlaceholder: 'Cerca colori…',
	searchTagsPlaceholder: 'Cerca tag…',
	includeMinorColors: 'Includi colori secondari',
	includeCardColors: 'Includi colori scheda',
	displayColorName: 'Mostra nome del colore',
	inViewCount: (count: number) => `${count} in vista`,
	itemCount: (count: number) => `${count} elemento${count === 1 ? '' : 'i'}`,
	notInCurrentView: 'Non nella vista attuale',
	deleteTagTooltip: 'Elimina tag da tutti i nodi',
	noColorsMatch: 'Nessun colore corrispondente.',
	noTagsMatch: 'Nessun tag corrispondente.',
	noTagsOnCanvas: 'Nessun tag su questa tela al momento.',
	extractingOrNoColors: 'Estrazione in corso o nessun colore trovato…',
	clickToExtractColors: 'Clicca sul pulsante sopra per estrarre i colori.',
	resetActiveFilter: 'Ripristina filtro attivo',
	quickTagsHeader: 'Tag rapidi:',
	doneBtn: 'Fatto',
	itemsSelectedTitle: (title: string, count: number) =>
		`${title} (${count} elementi selezionati)`,

	namingModalTitleCopy: 'Copia media nel vault',
	namingModalTitleMove: 'Sposta media nel vault',
	namingModalVaultRoot: '/ (Radice della cassaforte)',
	destinationFolderNotice: 'Cartella di destinazione: ',
	chooseNamingStrategy:
		'Scegli come nominare il file multimediale nel vault:',
	defaultFilenameOptTitle: 'Nome file predefinito',
	tagFilenameOptTitle: 'Nome file per tag',
	noTagsFallbackNotice:
		'(Nessun tag sul file multimediale - userà il predefinito)',
	customFilenameOptTitle: 'Nome file personalizzato',
	customFilenamePlaceholder: 'es. mia-immagine',
	numberingFormatName: 'Formato numerazione',
	numberingFormatDesc:
		'Formato usato per i contatori incrementali (es. duplicati o esportazioni in blocco).',
	applyToAllRemaining: (count: number) =>
		`Applica a tutti i ${count} elementi rimanenti`,
	applyToAllRemainingDesc:
		'Utilizza la strategia di denominazione e il formato selezionati per tutti gli elementi rimanenti.',
	numberFormatPadded2: '01, 02, 03... (2 cifre)',
	numberFormatPadded3: '001, 002, 003... (3 cifre)',
	numberFormatSimple: '1, 2, 3... (Senza zeri)',
	numberFormatRomanUpper: 'I, II, III, IV... (Romano maiuscolo)',
	numberFormatRomanLower: 'i, ii, iii, iv... (Romano minuscolo)',
	numberFormatLetterUpper: 'A, B, C... (Alfabeto maiuscolo)',
	numberFormatLetterLower: 'a, b, c... (Alfabeto minuscolo)',
};

const ar: TranslationSchema = {
	settingsHeading: 'العرض واللوحة',
	hideImageLabelName: 'إخفاء تسمية الوسائط',
	hideImageLabelDesc:
		'إخفاء رأس تسمية عنوان URL / البيانات base64 المعروض فوق بطاقات وسائط اللوحة المضمنة.',
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
	duplicateKeyNotice:
		'غير مسموح بتكرار تعيين المفاتيح. يرجى اختيار مفاتيح فريدة لكل إجراء.',

	modalTitle: 'إضافة وسائط إلى ملف اللوحة',
	modalDescription: (filename: string) => `كيف ترغب في تخزين "${filename}"؟`,
	applyRemaining: (count: number) =>
		`تطبيق الخيار على الوسائط المتبقية وعددها ${count}`,
	saveToVault: 'حفظ في الخزنة',
	embedInCanvas: 'تضمين في ملف اللوحة',

	convertModalTitle: 'تضمين الوسائط في ملف اللوحة',
	convertModalDesc: (filename: string) =>
		`تضمين "${filename}" مباشرة في ملف اللوحة. ماذا تريد أن تفعل بملف الخزنة الأصلي؟`,
	applyRemainingConvert: (count: number) =>
		`تطبيق الخيار على ملفات الوسائط المتبقية وعددها ${count}`,
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
	optimizeImageSize: 'تحسين حجم الصورة المضمنة',
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
	tagNodes: 'إضافة / تعديل الوسوم…',
	tagModalTitle: 'الوسوم',
	tagPlaceholder: 'اكتب #وسم ثم اضغط Enter للإضافة',
	tagFilterPanel: 'تصفية حسب الوسم',
	tagClearFilter: 'مسح التصفية',
	tagNodesCount: (count: number) => `${count} عنصر`,
	tagPublishToVault: 'مزامنة الوسوم مع الخزنة',
	tagPublishToVaultDesc:
		'عند التمكين، يتم كتابة جميع وسوم اللوحة كوسوم frontmatter على ملف اللوحة هذا، مما يجعلها مرئية في جزء الوسوم والبحث في Obsidian.',
	tagItemMenuTooltip: 'خيارات الوسم',
	renameTag: 'إعادة تسمية',
	setTagColor: 'إضافة لون للوسم',
	deleteTag: 'حذف الوسم',
	renameTagModalTitle: (tag: string) => `إعادة تسمية #${tag}`,
	renameTagLabel: 'اسم الوسم الجديد',
	renameTagPlaceholder: 'أدخل اسم الوسم...',
	setTagColorModalTitle: (tag: string) => `لون الوسم: #${tag}`,
	tagColorPreview: 'معاينة:',
	tagColorPresets: 'الإعدادات المسبقة:',
	textColorLabel: 'لون النص',
	bgColorLabel: 'لون الخلفية',
	clearTagColor: 'مسح اللون',
	saveBtn: 'حفظ',
	colorFilterTab: 'اللون',
	colorFilterPanel: 'تصفية حسب اللون',
	colorExtractBtn: 'مسح ألوان اللوحة',
	colorExtracting: 'جاري استخراج الألوان…',
	colorNoImages: 'لا توجد صور تحتوي على ألوان مكتشفة في هذه اللوحة.',
	colorClearFilter: 'مسح تصفية الألوان',
	colorNodesCount: (count: number) => `${count} عنصر`,
	colorSettingHeader: 'استخراج الألوان',
	colorSettingName: 'استخراج الألوان التلقائي',
	colorSettingDesc:
		'استخراج الألوان السائدة تلقائيًا من الصور عند فتح اللوحة. اضبط على يدوي أو معطل لتحسين الأداء في اللوحات الكبيرة.',
	colorModeAuto: 'تلقائي (استخراج عند فتح اللوحة)',
	colorModeManual: 'يدوي (استخراج عند النقر)',
	colorModeDisabled: 'معطل',
	colorBlack: 'أسود',
	colorGray: 'رمادي',
	colorWhite: 'أبيض',
	colorRed: 'أحمر',
	colorOrange: 'برتقالي',
	colorYellow: 'أصفر',
	colorGreen: 'أخضر',
	colorTeal: 'أزرق مخضر',
	colorCyan: 'سماوي',
	colorBlue: 'أزرق',
	colorIndigo: 'نيلي',
	colorPurple: 'أرجواني',
	colorPink: 'وردي',

	// Palette & Settings translations
	copyHexNotice: (hex: string) => `تم نسخ ${hex} إلى الحافظة!`,
	copyAllColorsNotice: (count: number) => `تم نسخ ${count} ألوان إلى الحافظة!`,
	copyAllColorsTooltip: 'نسخ جميع ألوان اللوحة',
	tagBadgePositionName: 'موقع شارة الوسم',
	tagBadgePositionDesc:
		'اختر ما إذا كانت شارات الوسم تعرض بالخارج (أسفل العنصر) أم بالداخل (أسفل اليسار).',
	tagBadgePositionOutside: 'بالخارج (أسفل العنصر)',
	tagBadgePositionInside: 'بالداخل (أسفل اليسار)',
	tagZoomOnSelectName: 'التكبير التلقائي عند تحديد الوسم',
	tagZoomOnSelectDesc:
		'تكبير وملاءمة العناصر المرئية تلقائيًا عند تحديد تصفية الوسوم أو مسحها.',
	paletteCopySeparatorName: 'فاصل نسخ لوحة الألوان',
	paletteCopySeparatorDesc:
		'الفاصل المستخدم عند النقر فوق زر نسخ لوحة الألوان لنسخ جميع قيم hex إلى الحافظة.',
	colorExtractModeName: 'وضع استخراج الألوان',
	colorExtractModeDesc:
		'يتحكم في وقت استخراج الألوان السائدة من صور اللوحة للوحة تصفية الألوان.',
	noImageInClipboardNotice: 'لم يتم العثور على صورة في الحافظة',
	unableAccessClipboardNotice: 'تعذر الوصول إلى الحافظة',
};

const he: TranslationSchema = {
	settingsHeading: 'תצוגה וקנבס',
	hideImageLabelName: 'הסתר תווית מדיה',
	hideImageLabelDesc:
		'הסתר את כותרת התווית של base64 URL / נתונים המוצגת מעל כרטיסי המדיה המוטמעים בקנבס.',
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
	applyRemaining: (count: number) =>
		`החל בחירה על ${count} פריטי המדיה הנותרים`,
	saveToVault: 'שמור בכספת',
	embedInCanvas: 'הטמע בקובץ הקנבס',

	convertModalTitle: 'הטמעת מדיה בקובץ הקנבס',
	convertModalDesc: (filename: string) =>
		`מטמיע את "${filename}" ישירות בקובץ הקנבס. מה ברצונך לעשות עם קובץ הכספת המקורי?`,
	applyRemainingConvert: (count: number) =>
		`החל בחירה على ${count} קובצי המדיה הנותרים`,
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
	optimizeImageSize: 'אופטימיזציית גודל תמונה מוטמעת',
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
	tagNodes: 'הוסף / ערוך תגיות…',
	tagModalTitle: 'תגיות',
	tagPlaceholder: 'הקלד #תגית ולחץ Enter להוספה',
	tagFilterPanel: 'סינון לפי תגית',
	tagClearFilter: 'נקה מסנן',
	tagNodesCount: (count: number) => `${count} רכיבים`,
	tagPublishToVault: 'סנכרן תגיות לכספת',
	tagPublishToVaultDesc:
		'כאשר מופעל, כל תגיות הקנבס ייכתבו כתגיות frontmatter בקובץ קנבס זה, ויגרמו להן להיות גלויות בחלונית התגיות ובחיפוש של Obsidian.',
	tagItemMenuTooltip: 'אפשרויות תגית',
	renameTag: 'שנה שם',
	setTagColor: 'הוסף צבע לתגית',
	deleteTag: 'מחק תגית',
	renameTagModalTitle: (tag: string) => `שנה שם של #${tag}`,
	renameTagLabel: 'שם תגית חדש',
	renameTagPlaceholder: 'הזן שם תגית...',
	setTagColorModalTitle: (tag: string) => `צבע תגית: #${tag}`,
	tagColorPreview: 'תצוגה מקדימה:',
	tagColorPresets: 'ערכות מוגדרות מראש:',
	textColorLabel: 'צבע טקסט',
	bgColorLabel: 'צבע רקע',
	clearTagColor: 'נקה צבע',
	saveBtn: 'שמור',
	colorFilterTab: 'צבע',
	colorFilterPanel: 'סינון לפי צבע',
	colorExtractBtn: 'סרוק צבעי קנבס',
	colorExtracting: 'מחלץ צבעים…',
	colorNoImages: 'לא נמצאו תמונות עם צבעים מזוהים בקנבס זה.',
	colorClearFilter: 'נקה מסנן צבע',
	colorNodesCount: (count: number) => `${count} רכיבים`,
	colorSettingHeader: 'חילוץ צבעים',
	colorSettingName: 'חילוץ צבעים אוטומטי',
	colorSettingDesc:
		'מחלץ אוטומטית צבעים שולטים מתמונות בעת פתיחת הקנבס. הגדר לידני או למופעל כדי לשפר ביצועים בקנבסים גדולים.',
	colorModeAuto: 'אוטומטי (חילוץ בעת פתיחת הקנבס)',
	colorModeManual: 'ידני (חילוץ בלחיצה על כפתור)',
	colorModeDisabled: 'מופעל',
	colorBlack: 'שחור',
	colorGray: 'אפור',
	colorWhite: 'לבן',
	colorRed: 'אדום',
	colorOrange: 'כתום',
	colorYellow: 'צהוב',
	colorGreen: 'ירוק',
	colorTeal: 'כחול-ירוק',
	colorCyan: 'ציאן',
	colorBlue: 'כחול',
	colorIndigo: 'אינדיגו',
	colorPurple: 'סגול',
	colorPink: 'ורוד',

	// Palette & Settings translations
	copyHexNotice: (hex: string) => `${hex} הועתק ללוח הגזירים!`,
	copyAllColorsNotice: (count: number) => `${count} צבעים הועתקו ללוח הגזירים!`,
	copyAllColorsTooltip: 'העתק את כל צבעי הפלטה',
	tagBadgePositionName: 'מיקום תגית התג',
	tagBadgePositionDesc:
		'בחר אם תגיות התגית יוצגו מחוץ לרכיב (מתחת לרכיב) או בתוכו (למטה משמאל).',
	tagBadgePositionOutside: 'מחוץ (מתחת לרכיב)',
	tagBadgePositionInside: 'בתוך (למטה משמאל)',
	tagZoomOnSelectName: 'תקריב אוטומטי בעת בחירת תגית',
	tagZoomOnSelectDesc:
		'מבצע תקריב ומתאים אוטומטית רכיבים גלויים בעת בחירה או ניקוי מסנני תגיות.',
	paletteCopySeparatorName: 'מפריד העתקת פלטת צבעים',
	paletteCopySeparatorDesc:
		'המפריד המשמש בעת לחיצה על כפתור העתקת הפלטה להעתקת כל ערכי ה-HEX ללוח הגזירים.',
	colorExtractModeName: 'מצב חילוץ צבעים',
	colorExtractModeDesc:
		'שולט מתי צבעים שולטים מחולצים מתמונות הקנבס עבור חלונית מסנן הצבעים.',
	noImageInClipboardNotice: 'לא נמצאה תמונה בלוח הגזירים',
	unableAccessClipboardNotice: 'לא ניתן לגשת ללוח הגזירים',
};

const localeMap: Record<string, TranslationSchema> = {
	en,
	'zh-cn': zh,
	zh,
	'zh-tw': zhTW,
	zhTW,
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
	const locale =
		localeMap[normalizedLang] || localeMap[normalizedLang.split('-')[0]];
	// Merge with English so any missing keys fall back to English
	return locale ? { ...en, ...locale } : en;
}
