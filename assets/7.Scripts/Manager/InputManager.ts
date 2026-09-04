import { _decorator, Camera, Component, EventTouch, Input, input, Layers, PhysicsSystem2D, Vec3, v2 } from 'cc';
import { ui } from './UI';
import { sm } from './SoundManager';
import { Ply_Pool, PoolType } from '../ScriptTemplate/Ply_Pool';
const { ccclass, property } = _decorator;

export var ipm: InputManager = null;

@ccclass('InputManager')
export class InputManager extends Component {

    static instance: InputManager = null;

    @property(Camera)
    camera: Camera = null!;

    onLoad() {
        InputManager.instance = this;
        ipm = this;
    }

    fisrtTap() {
        if(this.isFirtMove) {
            this.isFirtMove = false;
            sm.playBgMusic();
            ui.firstMove();
        }
    }

    isFirtMove: boolean = true;
    onClick(event: EventTouch) {
        this.fisrtTap();
        this.spawnBulletAt(event);
    }

    private spawnBulletAt(event: EventTouch) {
        if (!this.camera || !Ply_Pool.Ins) return;

        const location = event.getLocation();
        const worldLocation = this.camera.screenToWorld(new Vec3(location.x, location.y, 0));
        const colliders = PhysicsSystem2D.instance.testPoint(v2(worldLocation.x, worldLocation.y));

        const bgLayer = (Layers.Enum as Record<string, number>).BG;
        const hit = colliders.find(
            (collider) => collider.node.layer === bgLayer,
        );
        if (!hit) return;

        Ply_Pool.Ins.spawn(PoolType.Bullet, worldLocation);
    }

    binding() {
        input.on(Input.EventType.TOUCH_END, this.onClick, this);
    }

    offBinding() {
        input.off(Input.EventType.TOUCH_END, this.onClick, this);
    }

    start() {
        this.binding();
    }

    onDestroy() {
        this.offBinding();
    }
}


