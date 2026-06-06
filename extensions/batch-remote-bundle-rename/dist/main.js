"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
Object.defineProperty(exports, "__esModule", { value: true });
exports.methods = void 0;
exports.load = load;
exports.unload = unload;
function getAssetName(assetInfo) {
    if (assetInfo.name) {
        return assetInfo.name;
    }
    const url = assetInfo.url || '';
    const parts = url.split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
}
function extractBundleName(folderName) {
    const parts = folderName.split('-');
    return parts[0] || folderName;
}
async function queryAssetInfo(uuid) {
    try {
        const assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', uuid);
        return (assetInfo || null);
    }
    catch (error) {
        console.warn(`[batch-remote-bundle-rename] query-asset-info failed: ${uuid}`, error);
        return null;
    }
}
async function queryAssets(pattern) {
    try {
        const assets = await Editor.Message.request('asset-db', 'query-assets', { pattern });
        return Array.isArray(assets) ? assets : [];
    }
    catch (error) {
        console.warn(`[batch-remote-bundle-rename] query-assets failed: ${pattern}`, error);
        return [];
    }
}
async function queryAssetMeta(uuid) {
    try {
        const meta = await Editor.Message.request('asset-db', 'query-asset-meta', uuid);
        return (meta || null);
    }
    catch (error) {
        console.warn(`[batch-remote-bundle-rename] query-asset-meta failed: ${uuid}`, error);
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
        console.warn(`[batch-remote-bundle-rename] save-asset-meta failed: ${uuid}`, error);
        return false;
    }
}
async function collectTargetFolders(selectedUuids) {
    const folderMap = new Map();
    for (const uuid of selectedUuids) {
        const assetInfo = await queryAssetInfo(uuid);
        if (!assetInfo) {
            continue;
        }
        if (!assetInfo.isDirectory) {
            console.log(`[batch-remote-bundle-rename] 跳过非文件夹资源: ${assetInfo.url}`);
            continue;
        }
        const folderName = getAssetName(assetInfo);
        if (folderName === 'remote_bundles') {
            const childAssets = await queryAssets(`${assetInfo.url}/*`);
            for (const child of childAssets) {
                if (!(child === null || child === void 0 ? void 0 : child.uuid) || !child.isDirectory) {
                    continue;
                }
                folderMap.set(child.uuid, child);
            }
            continue;
        }
        folderMap.set(assetInfo.uuid, assetInfo);
    }
    return folderMap;
}
function load() {
    console.log('[batch-remote-bundle-rename] load');
}
function unload() {
    console.log('[batch-remote-bundle-rename] unload');
}
exports.methods = {
    async batchConfigRemoteBundle() {
        try {
            const selectedUuids = Editor.Selection.getSelected('asset');
            if (!Array.isArray(selectedUuids) || selectedUuids.length === 0) {
                console.log('[batch-remote-bundle-rename] 未选中任何资源。');
                return;
            }
            const folderMap = await collectTargetFolders(selectedUuids);
            const folders = Array.from(folderMap.values());
            if (folders.length === 0) {
                console.log('[batch-remote-bundle-rename] 未找到可处理的文件夹。');
                return;
            }
            let successCount = 0;
            let failedCount = 0;
            for (const folder of folders) {
                const folderName = getAssetName(folder);
                const bundleName = extractBundleName(folderName);
                const meta = await queryAssetMeta(folder.uuid);
                if (!meta) {
                    failedCount++;
                    continue;
                }
                if (!meta.userData) {
                    meta.userData = {};
                }
                meta.userData.isBundle = true;
                meta.userData.bundleName = bundleName;
                meta.userData.isRemoteBundle = true;
                const saved = await saveAssetMeta(folder.uuid, meta);
                if (!saved) {
                    failedCount++;
                    continue;
                }
                successCount++;
                console.log(`成功将目录 ${folderName} 配置为远程 Bundle，包名为: ${bundleName}`);
            }
            console.log(`[batch-remote-bundle-rename] 完成。success=${successCount}, failed=${failedCount}, total=${folders.length}`);
        }
        catch (error) {
            console.error('[batch-remote-bundle-rename] 执行失败:', error);
        }
    },
};
