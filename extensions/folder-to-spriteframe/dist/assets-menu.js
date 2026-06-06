"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onAssetMenu = onAssetMenu;
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
function normalizeExtension(pathOrUrl) {
    const clean = pathOrUrl.split('?')[0].toLowerCase();
    const dotIndex = clean.lastIndexOf('.');
    if (dotIndex === -1) {
        return '';
    }
    return clean.slice(dotIndex);
}
function isImageAsset(assetInfo) {
    if (!assetInfo) {
        return false;
    }
    const ext = normalizeExtension(assetInfo.url || assetInfo.file || '');
    if (IMAGE_EXTENSIONS.has(ext)) {
        return true;
    }
    return assetInfo.type === 'cc.ImageAsset';
}
function onAssetMenu(assetInfo) {
    const enabled = !!assetInfo && (assetInfo.isDirectory || isImageAsset(assetInfo));
    return [
        {
            label: '\u8f6c\u6362\u76ee\u5f55\u4e0b\u6240\u6709\u56fe\u7247\u4e3a SpriteFrame',
            enabled,
            click: async () => {
                await Editor.Message.request('folder-to-spriteframe', 'convert-folder-images-to-spriteframe');
            },
        },
    ];
}
