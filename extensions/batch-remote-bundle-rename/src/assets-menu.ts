type AssetInfo = {
    uuid: string;
    isDirectory?: boolean;
};

type MenuItem = {
    label?: string;
    enabled?: boolean;
    visible?: boolean;
    click?: () => void | Promise<void>;
};

export function onAssetMenu(assetInfo: AssetInfo): MenuItem[] {
    return [
        {
            label: '\u4e00\u952e\u914d\u7f6e\u8fdc\u7a0b Bundle (\u81ea\u52a8\u622a\u53d6\u5305\u540d)',
            enabled: !!assetInfo && !!assetInfo.isDirectory,
            click: async () => {
                await Editor.Message.request(
                    'batch-remote-bundle-rename',
                    'batch-config-remote-bundle'
                );
            },
        },
    ];
}
