import { _decorator, Animation, Component, isValid, Node } from 'cc';
import { PanelType } from './PanelType';

const { ccclass, property } = _decorator;
const DEFERRED_DECORATION_REVEAL_DELAY = 0.45;
const DEFERRED_DECORATION_REVEAL_STEP = 0.08;
const MENU_ANIMATION_DELAY = 1.1;
const CORE_VISUAL_REVEAL_DELAY = 0.05;
const FRAME_NODE_NAME = 'frame';
const CORE_VISUAL_NODE_NAMES = [
    FRAME_NODE_NAME,
    'Button',
    'Button-001',
];
const DEFERRED_FRAME_CHILD_NAMES = [
    '\u5e95\u5c42',
    '\u672a\u547d\u540d\u4f5c\u54c1(15)',
    '\u672a\u547d\u540d\u4f5c\u54c1(13)',
    'dining-table',
    '\u5e8a',
    '\u706f',
    '\u957f\u67dc\u5b50\u88c5\u9970',
    '\u6c99\u53d1',
    '\u672a\u547d\u540d\u4f5c\u54c1(14)',
];

@ccclass
export class HomeUI extends Component {
    @property(Animation)
    menuAnim: Animation = null!;

    public curPanel = PanelType.Home;
    private readonly coreVisualNodes: Node[] = [];
    private readonly deferredDecorationNodes: Node[] = [];

    onLoad() {
        this.curPanel = PanelType.Home;
        this.prepareCoreVisualNodes();
        this.prepareDeferredDecorations();
        console.log('HomeUI onLoad');
    }

    start() {
        this.scheduleCoreVisualReveal();
        this.scheduleDeferredDecorationsReveal();
        this.scheduleMenuAnimation();
    }

    gotoHome() {
        this.curPanel = PanelType.Home;
    }

    gotoShop() {
        this.curPanel = PanelType.Home;
    }

    private prepareCoreVisualNodes(): void {
        this.coreVisualNodes.length = 0;

        for (const nodeName of CORE_VISUAL_NODE_NAMES) {
            const childNode = this.node.getChildByName(nodeName);
            if (!childNode || !childNode.active) {
                continue;
            }

            childNode.active = false;
            this.coreVisualNodes.push(childNode);
        }
    }

    private prepareDeferredDecorations(): void {
        this.deferredDecorationNodes.length = 0;

        const frameNode = this.node.getChildByName(FRAME_NODE_NAME);
        if (!frameNode) {
            return;
        }

        for (const childName of DEFERRED_FRAME_CHILD_NAMES) {
            const childNode = frameNode.getChildByName(childName);
            if (!childNode || !childNode.active) {
                continue;
            }

            childNode.active = false;
            this.deferredDecorationNodes.push(childNode);
        }
    }

    private scheduleCoreVisualReveal(): void {
        this.scheduleOnce(() => {
            for (const childNode of this.coreVisualNodes) {
                if (!childNode || !isValid(childNode)) {
                    continue;
                }

                childNode.active = true;
            }
        }, CORE_VISUAL_REVEAL_DELAY);
    }

    private scheduleDeferredDecorationsReveal(): void {
        this.deferredDecorationNodes.forEach((childNode, index) => {
            this.scheduleOnce(() => {
                if (!childNode || !isValid(childNode)) {
                    return;
                }

                childNode.active = true;
            }, DEFERRED_DECORATION_REVEAL_DELAY + index * DEFERRED_DECORATION_REVEAL_STEP);
        });
    }

    private scheduleMenuAnimation(): void {
        if (!this.menuAnim) {
            return;
        }

        this.scheduleOnce(() => {
            if (!this.menuAnim || !isValid(this.menuAnim)) {
                return;
            }

            this.menuAnim.play('menu_intro');
        }, MENU_ANIMATION_DELAY);
    }
}
