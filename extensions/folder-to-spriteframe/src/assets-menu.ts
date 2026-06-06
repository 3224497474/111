type AssetInfo = {
    uuid: string;
    url: string;
    file?: string;
    type?: string;
    isDirectory?: boolean;
};

type MenuItem = {
    label?: string;
    enabled?: boolean;
    visible?: boolean;
    click?: () => void | Promise<void>;
};

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

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

export function onAssetMenu(assetInfo: AssetInfo): MenuItem[] {
    const enabled = !!assetInfo && (assetInfo.isDirectory || isImageAsset(assetInfo));

    return [
        {
            label: '\u8f6c\u6362\u76ee\u5f55\u4e0b\u6240\u6709\u56fe\u7247\u4e3a SpriteFrame',
            enabled,
            click: async () => {
                await Editor.Message.request(
                    'folder-to-spriteframe',
                    'convert-folder-images-to-spriteframe'
                );
            },
        },
    ];
}
