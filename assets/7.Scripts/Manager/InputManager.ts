import { _decorator, Camera, Component, Enum, EventTouch, Input, input, Layers, PhysicsSystem2D, Vec3, v2 } from 'cc';
import { ui } from './UI';
import { sm } from './SoundManager';
import { Ply_Pool, PoolType } from '../ScriptTemplate/Ply_Pool';
import { MapManager } from './MapManager';
const { ccclass, property } = _decorator;

export var ipm: InputManager = null;

@ccclass('InputManager')
export class InputManager extends Component {

    static instance: InputManager = null;

    @property(Camera)
    camera: Camera = null!;

    @property({ type: Enum(Layers.Enum) })
    playerLayer: number = Layers.Enum.Player;

    @property({ type: Enum(Layers.Enum) })
    bulletHoleLayer: number = Layers.Enum.BG;

    onLoad() {
        InputManager.instance = this;
        ipm = this;
    }

    fisrtTap() {
        if(this.isFirtMove) {
            this.isFirtMove = false;
            sm?.playBgMusic();
            ui?.firstMove();
        }
    }

    isFirtMove: boolean = true;
    onClick(event: EventTouch) {
        this.fisrtTap();
        this.spawnBulletAt(event);
    }

    private spawnBulletAt(event: EventTouch) {
        if (!this.camera) return;

        const location = event.getLocation();
        const worldLocation = this.camera.screenToWorld(new Vec3(location.x, location.y, 0));
        const colliders = PhysicsSystem2D.instance.testPoint(v2(worldLocation.x, worldLocation.y));

        // Ban trung Player -> chuyen sang Map ke tiep
        const hitPlayer = colliders.find(
            (collider) => collider.node.layer === this.playerLayer,
        );
        if (hitPlayer) {
            MapManager.Ins?.nextMap();
            return;
        }

        // Ban trung BG -> spawn BulletHole tai diem cham
        if (!Ply_Pool.Ins) return;
        const hitBulletHoleTarget = colliders.find(
            (collider) => collider.node.layer === this.bulletHoleLayer,
        );
        if (!hitBulletHoleTarget) return;

        Ply_Pool.Ins.spawn(PoolType.Bullet, worldLocation, undefined, MapManager.Ins?.getBulletContainer() ?? null);
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
