import { _decorator, Camera, Color, Component, Graphics, Label, Node, ProgressBar, UITransform, Vec3 } from 'cc';
import { BattleUnit } from './BattleUnit';

const { ccclass, property } = _decorator;

const _world = new Vec3();
const _ui = new Vec3();
const _textPosition = new Vec3();

interface IBarLayout {
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
}

type HudReuseArgs = {
    unit: BattleUnit;
    targetNode: Node;
    battleCamera: Camera;
    hudRoot: Node;
    sharedTextRoot: Node;
};

@ccclass('BattleUnitHudView')
export class BattleUnitHudView extends Component {
    private static readonly HP_BAR_BACKGROUND = new Color(24, 18, 18, 220);
    private static readonly HP_BAR_FILL = new Color(210, 62, 62, 255);

    @property(Label)
    public nameLabel: Label | null = null;

    @property(ProgressBar)
    public hpBar: ProgressBar | null = null;

    @property(ProgressBar)
    public mpBar: ProgressBar | null = null;

    @property(Label)
    public hpLabel: Label | null = null;

    @property(Label)
    public mpLabel: Label | null = null;

    @property
    public followHeight = 2.2;

    private unitId = '';
    private targetNode: Node | null = null;
    private battleCamera: Camera | null = null;
    private hudRoot: Node | null = null;
    private sharedTextRoot: Node | null = null;
    private hpRatio = 0;
    private visible = true;
    private readonly hpBarLayout: IBarLayout = { offsetX: 0, offsetY: 0, width: 72, height: 10 };
    private readonly nameOffset = new Vec3();
    private readonly hpLabelOffset = new Vec3();
    private layoutCaptured = false;

    public bind(
        unit: BattleUnit,
        targetNode: Node,
        battleCamera: Camera,
        hudRoot: Node,
        sharedTextRoot: Node,
    ): void {
        this.unitId = unit.unitId;
        this.targetNode = targetNode;
        this.battleCamera = battleCamera;
        this.hudRoot = hudRoot;
        this.sharedTextRoot = sharedTextRoot;
        this.ensureHudLayoutPrepared();
        this.refresh(unit);
    }

    public reuse(args: HudReuseArgs): void {
        this.node.active = true;
        this.unitId = args.unit.unitId;
        this.targetNode = args.targetNode;
        this.battleCamera = args.battleCamera;
        this.hudRoot = args.hudRoot;
        this.sharedTextRoot = args.sharedTextRoot;
        this.ensureHudLayoutPrepared();
        this.refresh(args.unit);
    }

    public unuse(): void {
        this.visible = false;
        this.hpRatio = 0;
        this.unitId = '';
        this.targetNode = null;
        this.battleCamera = null;
        this.hudRoot = null;
        this.sharedTextRoot = null;
        this.node.active = false;

        if (this.nameLabel) {
            this.nameLabel.string = '';
        }
        if (this.hpLabel) {
            this.hpLabel.string = '';
        }
        if (this.mpLabel) {
            this.mpLabel.string = '';
        }
        if (this.hpBar) {
            this.hpBar.progress = 1;
        }

        this.setTextNodesActive(false);
    }

    public getUnitId(): string {
        return this.unitId;
    }

    public refresh(unit: BattleUnit): void {
        this.hpRatio = unit.maxHp > 0 ? unit.hp / unit.maxHp : 0;
        this.visible = unit.isAlive();

        if (this.nameLabel) {
            this.nameLabel.string = unit.name;
        }
        if (this.hpBar) {
            this.hpBar.progress = this.hpRatio;
        }

        if (this.hpLabel) {
            this.hpLabel.string = `${Math.ceil(unit.hp)}/${Math.ceil(unit.maxHp)}`;
        }
        if (this.mpLabel) {
            this.mpLabel.string = '';
        }

        this.node.active = this.visible;
        this.setTextNodesActive(this.visible);
    }

    public syncPosition(): void {
        if (!this.targetNode || !this.battleCamera || !this.hudRoot) {
            return;
        }

        _world.set(this.targetNode.worldPosition);
        _world.y += this.followHeight;
        this.battleCamera.convertToUINode(_world, this.hudRoot, _ui);
        this.node.setPosition(_ui);

        this.syncTextPosition(this.nameLabel, this.nameOffset);
        this.syncTextPosition(this.hpLabel, this.hpLabelOffset);
    }

    public drawBars(graphics: Graphics): void {
        if (!this.visible) {
            return;
        }

        this.drawBar(
            graphics,
            this.hpBarLayout,
            this.hpRatio,
            BattleUnitHudView.HP_BAR_BACKGROUND,
            BattleUnitHudView.HP_BAR_FILL,
        );
    }

    public dispose(): void {
        this.unuse();
    }

    private drawBar(
        graphics: Graphics,
        layout: IBarLayout,
        ratio: number,
        backgroundColor: Color,
        fillColor: Color,
    ): void {
        const x = this.node.position.x + layout.offsetX - layout.width * 0.5;
        const y = this.node.position.y + layout.offsetY - layout.height * 0.5;
        const clampedRatio = Math.max(0, Math.min(1, ratio));

        graphics.fillColor = backgroundColor;
        graphics.rect(x, y, layout.width, layout.height);
        graphics.fill();

        if (clampedRatio <= 0) {
            return;
        }

        graphics.fillColor = fillColor;
        graphics.rect(x, y, layout.width * clampedRatio, layout.height);
        graphics.fill();
    }

    private captureBarLayout(progressBar: ProgressBar | null, layout: IBarLayout): void {
        if (!progressBar) {
            return;
        }

        const transform = progressBar.node.getComponent(UITransform);
        if (transform) {
            layout.width = transform.width;
            layout.height = transform.height;
        }
        layout.offsetX = progressBar.node.position.x;
        layout.offsetY = progressBar.node.position.y;
    }

    private captureTextOffset(label: Label | null, offset: Vec3): void {
        if (!label) {
            return;
        }

        offset.set(label.node.position);
    }

    private ensureHudLayoutPrepared(): void {
        if (!this.layoutCaptured) {
            this.captureBarLayout(this.hpBar, this.hpBarLayout);
            this.captureTextOffset(this.nameLabel, this.nameOffset);
            this.captureTextOffset(this.hpLabel, this.hpLabelOffset);
            this.layoutCaptured = true;
        }

        this.registerTextNode(this.nameLabel);
        this.registerTextNode(this.hpLabel);

        if (this.hpBar?.node) {
            this.hpBar.node.active = false;
        }
        if (this.mpBar?.node) {
            this.mpBar.node.active = false;
        }
    }

    private registerTextNode(label: Label | null): void {
        if (!label || !this.sharedTextRoot || !label.node.isValid) {
            return;
        }

        label.cacheMode = Label.CacheMode.CHAR;
        label.node.parent = this.sharedTextRoot;
        label.node.setSiblingIndex(this.sharedTextRoot.children.length - 1);
    }

    private syncTextPosition(label: Label | null, offset: Vec3): void {
        if (!label || !label.node.isValid || !this.visible) {
            return;
        }

        _textPosition.set(
            this.node.position.x + offset.x,
            this.node.position.y + offset.y,
            0,
        );
        label.node.setPosition(_textPosition);
    }

    private setTextNodesActive(active: boolean): void {
        if (this.nameLabel?.node) {
            this.nameLabel.node.active = active;
        }
        if (this.hpLabel?.node) {
            this.hpLabel.node.active = active;
        }
        if (this.mpLabel?.node) {
            this.mpLabel.node.active = false;
        }
    }

}
