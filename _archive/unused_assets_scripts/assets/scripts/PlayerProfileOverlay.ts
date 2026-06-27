import {
    _decorator,
    assetManager,
    Color,
    Component,
    Graphics,
    ImageAsset,
    Label,
    Layers,
    Node,
    isValid,
    Sprite,
    SpriteFrame,
    Texture2D,
    UITransform,
    UIOpacity,
    Vec3,
    Widget,
} from 'cc';
import { playerProfileManager } from './X/client/Script/easyFramework/mgr/PlayerProfileManager';

const { ccclass } = _decorator;

@ccclass('PlayerProfileOverlay')
export class PlayerProfileOverlay extends Component {
    private chipNode: Node | null = null;
    private chipNameLabel: Label | null = null;
    private chipAvatarInitialLabel: Label | null = null;
    private chipAvatarSprite: Sprite | null = null;

    private maskNode: Node | null = null;
    private panelNameLabel: Label | null = null;
    private panelTipLabel: Label | null = null;
    private panelAvatarInitialLabel: Label | null = null;
    private panelAvatarSprite: Sprite | null = null;
    private panelStatusLabel: Label | null = null;
    private authorizeButton: Node | null = null;

    protected start(): void {
        this.buildUi();
        this.refreshView();

        if (playerProfileManager.needsInitialPrompt()) {
            this.openPanel();
        }
    }

    private buildUi() {
        if (this.chipNode) {
            return;
        }

        this.chipNode = this.createProfileChip();
        this.node.addChild(this.chipNode);

        this.maskNode = this.createMask();
        this.maskNode.active = false;
        this.node.addChild(this.maskNode);
    }

    private createProfileChip() {
        const chip = new Node('ProfileChip');
        chip.layer = Layers.Enum.UI_2D;
        chip.addComponent(UITransform).setContentSize(236, 76);

        const widget = chip.addComponent(Widget);
        widget.isAlignTop = true;
        widget.top = 28;
        widget.isAlignRight = true;
        widget.right = 24;

        this.drawRect(chip, new Color(17, 24, 39, 220), 236, 76);
        chip.addComponent(UIOpacity).opacity = 240;
        chip.on(Node.EventType.TOUCH_END, this.openPanel, this);

        const avatarHolder = new Node('AvatarHolder');
        avatarHolder.layer = Layers.Enum.UI_2D;
        avatarHolder.setPosition(new Vec3(-74, 0, 0));
        avatarHolder.addComponent(UITransform).setContentSize(52, 52);
        this.drawCircle(avatarHolder, new Color(52, 211, 153, 255), 26);
        chip.addChild(avatarHolder);

        const avatarSpriteNode = new Node('AvatarSprite');
        avatarSpriteNode.layer = Layers.Enum.UI_2D;
        avatarSpriteNode.addComponent(UITransform).setContentSize(52, 52);
        this.chipAvatarSprite = avatarSpriteNode.addComponent(Sprite);
        this.chipAvatarSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        avatarHolder.addChild(avatarSpriteNode);

        const avatarInitialNode = new Node('AvatarInitial');
        avatarInitialNode.layer = Layers.Enum.UI_2D;
        avatarInitialNode.setPosition(new Vec3(0, -1, 0));
        this.chipAvatarInitialLabel = this.createLabel(avatarInitialNode, '游', 24, new Color(255, 255, 255, 255));
        avatarHolder.addChild(avatarInitialNode);

        const titleNode = new Node('ProfileTitle');
        titleNode.layer = Layers.Enum.UI_2D;
        titleNode.setPosition(new Vec3(12, 12, 0));
        this.createLabel(titleNode, '玩家资料', 18, new Color(148, 163, 184, 255));
        chip.addChild(titleNode);

        const nameNode = new Node('ProfileName');
        nameNode.layer = Layers.Enum.UI_2D;
        nameNode.setPosition(new Vec3(10, -12, 0));
        this.chipNameLabel = this.createLabel(nameNode, '游客', 26, new Color(255, 255, 255, 255));
        chip.addChild(nameNode);

        return chip;
    }

    private createMask() {
        const mask = new Node('ProfileMask');
        mask.layer = Layers.Enum.UI_2D;
        mask.addComponent(UITransform).setContentSize(720, 1280);

        const widget = mask.addComponent(Widget);
        widget.isAlignTop = true;
        widget.top = 0;
        widget.isAlignBottom = true;
        widget.bottom = 0;
        widget.isAlignLeft = true;
        widget.left = 0;
        widget.isAlignRight = true;
        widget.right = 0;

        this.drawRect(mask, new Color(3, 7, 18, 185), 720, 1280);
        mask.on(Node.EventType.TOUCH_END, () => undefined, this);

        const panel = new Node('ProfilePanel');
        panel.layer = Layers.Enum.UI_2D;
        panel.addComponent(UITransform).setContentSize(560, 520);
        panel.setPosition(new Vec3(0, 24, 0));
        this.drawRect(panel, new Color(245, 247, 250, 255), 560, 520);
        mask.addChild(panel);

        const titleNode = new Node('PanelTitle');
        titleNode.layer = Layers.Enum.UI_2D;
        titleNode.setPosition(new Vec3(0, 195, 0));
        this.createLabel(titleNode, '完善资料', 34, new Color(15, 23, 42, 255));
        panel.addChild(titleNode);

        const descNode = new Node('PanelDesc');
        descNode.layer = Layers.Enum.UI_2D;
        descNode.setPosition(new Vec3(0, 146, 0));
        const descLabel = this.createLabel(
            descNode,
            '点击授权后，才会在设置界面展示你的微信头像和昵称',
            22,
            new Color(71, 85, 105, 255),
        );
        descLabel.overflow = Label.Overflow.SHRINK;
        descLabel.enableWrapText = true;
        descNode.getComponent(UITransform)?.setContentSize(470, 72);
        panel.addChild(descNode);

        const previewAvatar = new Node('PanelAvatar');
        previewAvatar.layer = Layers.Enum.UI_2D;
        previewAvatar.setPosition(new Vec3(0, 44, 0));
        previewAvatar.addComponent(UITransform).setContentSize(116, 116);
        this.drawCircle(previewAvatar, new Color(59, 130, 246, 255), 58);
        panel.addChild(previewAvatar);

        const previewSpriteNode = new Node('PanelAvatarSprite');
        previewSpriteNode.layer = Layers.Enum.UI_2D;
        previewSpriteNode.addComponent(UITransform).setContentSize(116, 116);
        this.panelAvatarSprite = previewSpriteNode.addComponent(Sprite);
        this.panelAvatarSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        previewAvatar.addChild(previewSpriteNode);

        const previewInitialNode = new Node('PanelAvatarInitial');
        previewInitialNode.layer = Layers.Enum.UI_2D;
        this.panelAvatarInitialLabel = this.createLabel(previewInitialNode, '游', 44, new Color(255, 255, 255, 255));
        previewAvatar.addChild(previewInitialNode);

        const nameNode = new Node('PanelName');
        nameNode.layer = Layers.Enum.UI_2D;
        nameNode.setPosition(new Vec3(0, -58, 0));
        this.panelNameLabel = this.createLabel(nameNode, '游客', 30, new Color(15, 23, 42, 255));
        panel.addChild(nameNode);

        const tipNode = new Node('PanelTip');
        tipNode.layer = Layers.Enum.UI_2D;
        tipNode.setPosition(new Vec3(0, -106, 0));
        this.panelTipLabel = this.createLabel(tipNode, '未授权时将显示默认资料', 22, new Color(100, 116, 139, 255));
        panel.addChild(tipNode);

        const statusNode = new Node('PanelStatus');
        statusNode.layer = Layers.Enum.UI_2D;
        statusNode.setPosition(new Vec3(0, -154, 0));
        this.panelStatusLabel = this.createLabel(statusNode, '', 20, new Color(220, 38, 38, 255));
        panel.addChild(statusNode);

        this.authorizeButton = this.createActionButton('WechatAuthorizeButton', '使用微信资料', 0, -228, new Color(16, 185, 129, 255));
        this.authorizeButton.on(Node.EventType.TOUCH_END, this.onAuthorizeWechatProfile, this);
        panel.addChild(this.authorizeButton);

        const laterButton = this.createActionButton('LaterButton', '先用默认资料', 0, -308, new Color(71, 85, 105, 255));
        laterButton.on(Node.EventType.TOUCH_END, this.onUseDefaultProfile, this);
        panel.addChild(laterButton);

        const closeButton = this.createActionButton('CloseButton', '关闭', 206, 210, new Color(148, 163, 184, 255), 88, 44, 18);
        closeButton.on(Node.EventType.TOUCH_END, this.closePanel, this);
        panel.addChild(closeButton);

        return mask;
    }

    private createActionButton(
        name: string,
        text: string,
        x: number,
        y: number,
        color: Color,
        width: number = 356,
        height: number = 58,
        fontSize: number = 24,
    ) {
        const button = new Node(name);
        button.layer = Layers.Enum.UI_2D;
        button.setPosition(new Vec3(x, y, 0));
        button.addComponent(UITransform).setContentSize(width, height);
        this.drawRect(button, color, width, height);

        const labelNode = new Node(`${name}Label`);
        labelNode.layer = Layers.Enum.UI_2D;
        this.createLabel(labelNode, text, fontSize, new Color(255, 255, 255, 255));
        button.addChild(labelNode);
        return button;
    }

    private createLabel(node: Node, text: string, fontSize: number, color: Color) {
        node.addComponent(UITransform);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 8;
        label.color = color;
        label.useSystemFont = true;
        label.fontFamily = 'Arial';
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        return label;
    }

    private drawRect(node: Node, color: Color, width: number, height: number) {
        const graphics = node.addComponent(Graphics);
        graphics.clear();
        graphics.fillColor = color;
        graphics.roundRect(-width / 2, -height / 2, width, height, 18);
        graphics.fill();
    }

    private drawCircle(node: Node, color: Color, radius: number) {
        const graphics = node.addComponent(Graphics);
        graphics.clear();
        graphics.fillColor = color;
        graphics.circle(0, 0, radius);
        graphics.fill();
    }

    private refreshView() {
        const profile = playerProfileManager.getProfile();
        const initial = playerProfileManager.getInitial(profile.nickname);

        if (this.chipNameLabel) {
            this.chipNameLabel.string = profile.nickname;
        }
        if (this.chipAvatarInitialLabel) {
            this.chipAvatarInitialLabel.string = initial;
        }
        if (this.panelNameLabel) {
            this.panelNameLabel.string = profile.nickname;
        }
        if (this.panelAvatarInitialLabel) {
            this.panelAvatarInitialLabel.string = initial;
        }
        if (this.panelTipLabel) {
            this.panelTipLabel.string = profile.authorized
                ? '已获得你的头像昵称授权，可在这里再次查看'
                : '未授权时将显示默认资料';
        }
        if (this.panelStatusLabel) {
            this.panelStatusLabel.string = '';
        }
        if (this.authorizeButton) {
            this.authorizeButton.active = playerProfileManager.canUseWechatProfile();
        }

        this.applyAvatar(profile.avatarUrl, this.chipAvatarSprite, this.chipAvatarInitialLabel);
        this.applyAvatar(profile.avatarUrl, this.panelAvatarSprite, this.panelAvatarInitialLabel);
    }

    private applyAvatar(avatarUrl: string, sprite: Sprite | null, initialLabel: Label | null) {
        if (!sprite || !initialLabel) {
            return;
        }

        if (!avatarUrl) {
            sprite.spriteFrame = null;
            sprite.node.active = false;
            initialLabel.node.active = true;
            return;
        }

        initialLabel.node.active = false;
        sprite.node.active = true;
        this.loadRemoteAvatar(avatarUrl, sprite, initialLabel);
    }

    private loadRemoteAvatar(avatarUrl: string, sprite: Sprite, initialLabel: Label) {
        assetManager.loadRemote<ImageAsset>(avatarUrl, (err, imageAsset) => {
            if (err || !imageAsset || !isValid(sprite) || !sprite.node || !isValid(sprite.node)) {
                sprite.spriteFrame = null;
                sprite.node.active = false;
                initialLabel.node.active = true;
                return;
            }

            const texture = new Texture2D();
            texture.image = imageAsset;
            const spriteFrame = new SpriteFrame();
            spriteFrame.texture = texture;
            sprite.spriteFrame = spriteFrame;
            sprite.node.active = true;
            initialLabel.node.active = false;
        });
    }

    private openPanel = () => {
        if (!this.maskNode) {
            return;
        }

        this.refreshView();
        if (this.panelStatusLabel && !playerProfileManager.canUseWechatProfile()) {
            this.panelStatusLabel.string = '当前环境可先使用默认资料，微信环境下再授权头像昵称';
        }
        this.maskNode.active = true;
    };

    private closePanel = () => {
        if (!this.maskNode) {
            return;
        }

        this.maskNode.active = false;
    };

    private async onAuthorizeWechatProfile() {
        if (this.panelStatusLabel) {
            this.panelStatusLabel.string = '正在获取微信资料...';
        }

        try {
            await playerProfileManager.requestWechatProfile();
            this.refreshView();
            this.closePanel();
        } catch (error: any) {
            if (this.panelStatusLabel) {
                this.panelStatusLabel.string = error?.errMsg || error?.message || '获取微信资料失败';
            }
        }
    }

    private onUseDefaultProfile() {
        playerProfileManager.markPromptDismissed();
        this.refreshView();
        this.closePanel();
    }
}
