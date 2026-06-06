"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
Object.defineProperty(exports, "__esModule", { value: true });
exports.methods = void 0;
exports.load = load;
exports.unload = unload;
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const TARGET_TYPE = 'sprite-frame';
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
async function queryAssetInfo(uuid) {
    try {
        const assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', uuid);
        return (assetInfo || null);
    }
    catch (error) {
        console.warn(`[folder-to-spriteframe] query-asset-info failed: ${uuid}`, error);
        return null;
    }
}
async function queryAssetsByPattern(pattern) {
    try {
        const result = await Editor.Message.request('asset-db', 'query-assets', { pattern });
        return Array.isArray(result) ? result : [];
    }
    catch (error) {
        console.warn(`[folder-to-spriteframe] query-assets failed: ${pattern}`, error);
        return [];
    }
}
async function queryAssetMeta(uuid) {
    try {
        const meta = await Editor.Message.request('asset-db', 'query-asset-meta', uuid);
        return (meta || null);
    }
    catch (error) {
        console.warn(`[folder-to-spriteframe] query-asset-meta failed: ${uuid}`, error);
        return null;
    }
}
async function saveAssetMeta(uuid, meta) {
    try {
        const metaString = JSON.stringify(meta, null, 2);
        await Editor.Message.request('asset-db', 'save-asset-meta', uuid, metaString);
        return true;
    }
    catch (error) {
        console.warn(`[folder-to-spriteframe] save-asset-meta failed: ${uuid}`, error);
        return false;
    }
}
async function reimportAsset(url) {
    try {
        await Editor.Message.request('asset-db', 'reimport-asset', url);
        return true;
    }
    catch (error) {
        console.warn(`[folder-to-spriteframe] reimport-asset failed: ${url}`, error);
        return false;
    }
}
async function collectTargetImages(selectedUuids) {
    const imageMap = new Map();
    for (const uuid of selectedUuids) {
        const assetInfo = await queryAssetInfo(uuid);
        if (!assetInfo) {
            continue;
        }
        if (assetInfo.isDirectory) {
            const children = await queryAssetsByPattern(`${assetInfo.url}/**/*`);
            for (const child of children) {
                if (!(child === null || child === void 0 ? void 0 : child.uuid)) {
                    continue;
                }
                if (isImageAsset(child)) {
                    imageMap.set(child.uuid, child);
                }
            }
            continue;
        }
        if (isImageAsset(assetInfo)) {
            imageMap.set(assetInfo.uuid, assetInfo);
        }
    }
    return imageMap;
}
function load() {
    console.log('[folder-to-spriteframe] load');
}
function unload() {
    console.log('[folder-to-spriteframe] unload');
}
exports.methods = {
    async convertFolderImagesToSpriteFrame() {
        try {
            const selectedUuids = Editor.Selection.getSelected('asset');
            if (!Array.isArray(selectedUuids) || selectedUuids.length === 0) {
                console.log('[folder-to-spriteframe] No asset selected.');
                return;
            }
            const imageMap = await collectTargetImages(selectedUuids);
            const imageAssets = Array.from(imageMap.values());
            if (imageAssets.length === 0) {
                console.log('[folder-to-spriteframe] No image assets found in current selection.');
                return;
            }
            let convertedCount = 0;
            let skippedCount = 0;
            let failedCount = 0;
            for (const imageAsset of imageAssets) {
                const meta = await queryAssetMeta(imageAsset.uuid);
                if (!meta) {
                    failedCount++;
                    continue;
                }
                if (!meta.userData) {
                    meta.userData = {};
                }
                if (meta.userData.type === TARGET_TYPE) {
                    skippedCount++;
                    continue;
                }
                meta.userData.type = TARGET_TYPE;
                const saved = await saveAssetMeta(imageAsset.uuid, meta);
                if (!saved) {
                    failedCount++;
                    continue;
                }
                const reimported = await reimportAsset(imageAsset.url);
                if (!reimported) {
                    failedCount++;
                    continue;
                }
                convertedCount++;
            }
            console.log(`[folder-to-spriteframe] Done. converted=${convertedCount}, skipped=${skippedCount}, failed=${failedCount}, total=${imageAssets.length}`);
        }
        catch (error) {
            console.error('[folder-to-spriteframe] convert failed:', error);
        }
    },
};
