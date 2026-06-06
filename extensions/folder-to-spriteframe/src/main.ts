/* eslint-disable @typescript-eslint/no-explicit-any */

type AssetInfo = {
    uuid: string;
    url: string;
    name?: string;
    file?: string;
    importer?: string;
    type?: string;
    isDirectory?: boolean;
};

type AssetMeta = {
    userData?: {
        type?: string;
        [key: string]: any;
    };
    [key: string]: any;
};

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const TARGET_TYPE = 'sprite-frame';

function normalizeExtension(pathOrUrl: string): string {
    const clean = pathOrUrl.split('?')[0].toLowerCase();
    const dotIndex = clean.lastIndexOf('.');
    if (dotIndex === -1) {
        return '';
    }

    return clean.slice(dotIndex);
}

function isImageAsset(assetInfo: AssetInfo | null | undefined): boolean {
    if (!assetInfo) {
        return false;
    }

    const ext = normalizeExtension(assetInfo.url || assetInfo.file || '');
    if (IMAGE_EXTENSIONS.has(ext)) {
        return true;
    }

    return assetInfo.type === 'cc.ImageAsset';
}

async function queryAssetInfo(uuid: string): Promise<AssetInfo | null> {
    try {
        const assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', uuid);
        return (assetInfo || null) as AssetInfo | null;
    } catch (error) {
        console.warn(`[folder-to-spriteframe] query-asset-info failed: ${uuid}`, error);
        return null;
    }
}

async function queryAssetsByPattern(pattern: string): Promise<AssetInfo[]> {
    try {
        const result = await Editor.Message.request('asset-db', 'query-assets', { pattern });
        return Array.isArray(result) ? (result as AssetInfo[]) : [];
    } catch (error) {
        console.warn(`[folder-to-spriteframe] query-assets failed: ${pattern}`, error);
        return [];
    }
}

async function queryAssetMeta(uuid: string): Promise<AssetMeta | null> {
    try {
        const meta = await Editor.Message.request('asset-db', 'query-asset-meta', uuid);
        return (meta || null) as AssetMeta | null;
    } catch (error) {
        console.warn(`[folder-to-spriteframe] query-asset-meta failed: ${uuid}`, error);
        return null;
    }
}

async function saveAssetMeta(uuid: string, meta: AssetMeta): Promise<boolean> {
    try {
        const metaString = JSON.stringify(meta, null, 2);
        await Editor.Message.request('asset-db', 'save-asset-meta', uuid, metaString);
        return true;
    } catch (error) {
        console.warn(`[folder-to-spriteframe] save-asset-meta failed: ${uuid}`, error);
        return false;
    }
}

async function reimportAsset(url: string): Promise<boolean> {
    try {
        await Editor.Message.request('asset-db', 'reimport-asset', url);
        return true;
    } catch (error) {
        console.warn(`[folder-to-spriteframe] reimport-asset failed: ${url}`, error);
        return false;
    }
}

async function collectTargetImages(selectedUuids: string[]): Promise<Map<string, AssetInfo>> {
    const imageMap = new Map<string, AssetInfo>();

    for (const uuid of selectedUuids) {
        const assetInfo = await queryAssetInfo(uuid);
        if (!assetInfo) {
            continue;
        }

        if (assetInfo.isDirectory) {
            const children = await queryAssetsByPattern(`${assetInfo.url}/**/*`);

            for (const child of children) {
                if (!child?.uuid) {
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

export function load() {
    console.log('[folder-to-spriteframe] load');
}

export function unload() {
    console.log('[folder-to-spriteframe] unload');
}

export const methods = {
    async convertFolderImagesToSpriteFrame() {
        try {
            const selectedUuids = Editor.Selection.getSelected('asset') as string[];

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

            console.log(
                `[folder-to-spriteframe] Done. converted=${convertedCount}, skipped=${skippedCount}, failed=${failedCount}, total=${imageAssets.length}`,
            );
        } catch (error) {
            console.error('[folder-to-spriteframe] convert failed:', error);
        }
    },
};
