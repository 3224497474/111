import {
    _decorator,
    Camera,
    Component,
    EventKeyboard,
    EventTouch,
    Input,
    KeyCode,
    Vec2,
    Vec3,
    geometry,
    input,
} from 'cc';
import type { IPoint } from './Types';
import { BattleSceneController } from './BattleSceneController';

const { ccclass, property } = _decorator;

const _uiPoint = new Vec2();
const _worldPoint = new Vec3();
const _ray = geometry.Ray.create();
const _keyboardDirection = new Vec2();
const MOVE_KEY_LEFT = [KeyCode.KEY_A, KeyCode.ARROW_LEFT, 65];
const MOVE_KEY_RIGHT = [KeyCode.KEY_D, KeyCode.ARROW_RIGHT, 68];
const MOVE_KEY_UP = [KeyCode.KEY_W, KeyCode.ARROW_UP, 87];
const MOVE_KEY_DOWN = [KeyCode.KEY_S, KeyCode.ARROW_DOWN, 83];

@ccclass('BattleInputController')
export class BattleInputController extends Component {
    @property(Camera)
    public battleCamera: Camera | null = null;

    @property(BattleSceneController)
    public sceneController: BattleSceneController | null = null;

    @property
    public groundPlaneY = 0;

    @property
    public groundPlaneZ = 0;

    @property
    public enabledInput = true;

    @property
    public enableKeyboardInput = true;

    @property
    public keyboardMoveLeadDistance = 1.4;

    private readonly pressedKeys = new Set<number>();
    private keyboardMoving = false;
    private readonly onDomKeyDown = (event: KeyboardEvent) => {
        this.registerDomKey(event, true);
    };
    private readonly onDomKeyUp = (event: KeyboardEvent) => {
        this.registerDomKey(event, false);
    };
    private readonly onDomBlur = () => {
        this.pressedKeys.clear();
        this.keyboardMoving = false;
    };

    onEnable(): void {
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
        globalThis.addEventListener?.('keydown', this.onDomKeyDown);
        globalThis.addEventListener?.('keyup', this.onDomKeyUp);
        globalThis.addEventListener?.('blur', this.onDomBlur);
    }

    onDisable(): void {
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
        globalThis.removeEventListener?.('keydown', this.onDomKeyDown);
        globalThis.removeEventListener?.('keyup', this.onDomKeyUp);
        globalThis.removeEventListener?.('blur', this.onDomBlur);
        this.pressedKeys.clear();
        this.keyboardMoving = false;
    }

    private onTouchEnd(event: EventTouch): void {
        if (!this.enabledInput || !this.battleCamera || !this.sceneController) {
            return;
        }

        event.getUILocation(_uiPoint);
        const target = this.screenToGround(_uiPoint.x, _uiPoint.y);
        if (!target) {
            return;
        }

        this.sceneController.requestMoveTarget(target);
    }

    update(): void {
        if (!this.enabledInput || !this.enableKeyboardInput || !this.sceneController) {
            return;
        }

        const anchor = this.sceneController.getPlayerAnchorPosition();
        if (!anchor) {
            return;
        }

        _keyboardDirection.set(0, 0);
        if (this.isAnyMoveKeyPressed(MOVE_KEY_LEFT)) {
            _keyboardDirection.x -= 1;
        }
        if (this.isAnyMoveKeyPressed(MOVE_KEY_RIGHT)) {
            _keyboardDirection.x += 1;
        }
        if (this.isAnyMoveKeyPressed(MOVE_KEY_UP)) {
            _keyboardDirection.y += 1;
        }
        if (this.isAnyMoveKeyPressed(MOVE_KEY_DOWN)) {
            _keyboardDirection.y -= 1;
        }

        if (_keyboardDirection.lengthSqr() <= 0) {
            if (this.keyboardMoving) {
                this.sceneController.clearMoveTarget();
                this.keyboardMoving = false;
            }
            return;
        }

        _keyboardDirection.normalize();
        this.sceneController.requestMoveTarget({
            x: anchor.x + _keyboardDirection.x * this.keyboardMoveLeadDistance,
            y: anchor.y + _keyboardDirection.y * this.keyboardMoveLeadDistance,
        });
        this.keyboardMoving = true;
    }

    private onKeyDown(event: EventKeyboard): void {
        console.log('[BattleInputController] key down', event.keyCode);
        this.pressedKeys.add(event.keyCode);
    }

    private onKeyUp(event: EventKeyboard): void {
        this.pressedKeys.delete(event.keyCode);
    }

    private isAnyMoveKeyPressed(keyCodes: readonly number[]): boolean {
        return keyCodes.some((keyCode) => this.pressedKeys.has(keyCode));
    }

    private registerDomKey(event: KeyboardEvent, pressed: boolean): void {
        const mappedKeyCodes = this.mapDomKeyToCodes(event);
        if (mappedKeyCodes.length === 0) {
            return;
        }

        for (const keyCode of mappedKeyCodes) {
            if (pressed) {
                this.pressedKeys.add(keyCode);
            } else {
                this.pressedKeys.delete(keyCode);
            }
        }
    }

    private mapDomKeyToCodes(event: KeyboardEvent): number[] {
        const codes: number[] = [];
        const key = event.key.toLowerCase();
        switch (event.code) {
        case 'KeyW':
            codes.push(KeyCode.KEY_W, 87);
            break;
        case 'KeyA':
            codes.push(KeyCode.KEY_A, 65);
            break;
        case 'KeyS':
            codes.push(KeyCode.KEY_S, 83);
            break;
        case 'KeyD':
            codes.push(KeyCode.KEY_D, 68);
            break;
        case 'ArrowUp':
            codes.push(KeyCode.ARROW_UP);
            break;
        case 'ArrowLeft':
            codes.push(KeyCode.ARROW_LEFT);
            break;
        case 'ArrowDown':
            codes.push(KeyCode.ARROW_DOWN);
            break;
        case 'ArrowRight':
            codes.push(KeyCode.ARROW_RIGHT);
            break;
        default:
            break;
        }

        if (codes.length > 0) {
            return codes;
        }

        if (key === 'w') return [KeyCode.KEY_W, 87];
        if (key === 'a') return [KeyCode.KEY_A, 65];
        if (key === 's') return [KeyCode.KEY_S, 83];
        if (key === 'd') return [KeyCode.KEY_D, 68];
        if (key === 'arrowup') return [KeyCode.ARROW_UP];
        if (key === 'arrowleft') return [KeyCode.ARROW_LEFT];
        if (key === 'arrowdown') return [KeyCode.ARROW_DOWN];
        if (key === 'arrowright') return [KeyCode.ARROW_RIGHT];

        return [];
    }

    private screenToGround(screenX: number, screenY: number): IPoint | null {
        if (!this.battleCamera) {
            return null;
        }

        this.battleCamera.screenPointToRay(screenX, screenY, _ray);

        if (this.sceneController?.useXZPlane ?? true) {
            const dy = _ray.d.y;
            if (Math.abs(dy) <= 0.00001) {
                return null;
            }

            const distance = (this.groundPlaneY - _ray.o.y) / dy;
            if (distance < 0) {
                return null;
            }

            Vec3.scaleAndAdd(_worldPoint, _ray.o, _ray.d, distance);
            return {
                x: _worldPoint.x,
                y: _worldPoint.z,
            };
        }

        const dz = _ray.d.z;
        if (Math.abs(dz) <= 0.00001) {
            return null;
        }

        const distance = (this.groundPlaneZ - _ray.o.z) / dz;
        if (distance < 0) {
            return null;
        }

        Vec3.scaleAndAdd(_worldPoint, _ray.o, _ray.d, distance);
        const coordinateScale = Math.max(1, this.sceneController?.coordinateScale2D ?? 1);
        return {
            x: _worldPoint.x / coordinateScale,
            y: _worldPoint.y / coordinateScale,
        };
    }
}
