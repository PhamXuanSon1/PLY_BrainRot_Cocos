import { _decorator, Animation, Camera, Component, Enum, EventTouch, Input, input, Layers, Node, PhysicsSystem2D, Vec3, v2, view } from 'cc';
import { ui } from './UI';
import { sm } from './SoundManager';
import { Ply_Pool, PoolType } from '../ScriptTemplate/Ply_Pool';
import { FxType, Ply_SoundManager } from '../ScriptTemplate/Ply_SoundManager';
import { MapManager } from './MapManager';
const { ccclass, property } = _decorator;
const PLAYER_HIT_DELAY = 3 / 60;

export var ipm: InputManager = null;

@ccclass('InputManager')
export class InputManager extends Component {

    static instance: InputManager = null;

    @property(Camera)
    camera: Camera = null!;

    @property(Animation)
    introMovement: Animation = null!;

    @property(Node)
    warning: Node = null!;

    @property({ type: Enum(Layers.Enum) })
    playerLayer: number = Layers.Enum.DEFAULT;

    @property({ type: Enum(Layers.Enum) })
    bulletHoleLayer: number = Layers.Enum.DEFAULT;

    @property
    maxBgHits: number = 3;

    onLoad() {
        InputManager.instance = this;
        ipm = this;
        this.warning?.active && (this.warning.active = false);
        this.warningAnimation = this.warning?.getComponent(Animation) ?? null;
    }

    fisrtTap() {
        if(this.isFirtMove) {
            this.isFirtMove = false;
            sm?.playBgMusic();
            ui?.firstMove();
            this.playIntroMovement();
        }
    }

    isFirtMove: boolean = true;
    private isIntroPlaying: boolean = false;
    private isWarningPlaying: boolean = false;
    private isChangingMap: boolean = false;
    private warningAnimation: Animation | null = null;
    private bgHitCount: number = 0;
    private isGameEnded: boolean = false;

    private playIntroMovement() {
        if (!this.introMovement || this.isIntroPlaying) return;

        this.isIntroPlaying = true;
        this.introMovement.play();
    }

    private onIntroMovementFinished() {
        this.isIntroPlaying = false;
    }

    private playWarning() {
        if (!this.warning || !this.warningAnimation || this.isWarningPlaying) return;

        this.isWarningPlaying = true;
        this.warning.active = true;
        this.warningAnimation.play();
    }

    private onWarningFinished() {
        this.warning?.active && (this.warning.active = false);
        this.isWarningPlaying = false;
    }

    private onPlayerHitDelayFinished() {
        this.isChangingMap = false;
        if (!this.isValid || this.isGameEnded) return;

        const mapManager = MapManager.Ins;
        if (!mapManager) return;

        if (mapManager.isLastMap()) {
            this.isGameEnded = true;
            Ply_SoundManager.Ins?.playFx(FxType.Confetti);
            ui?.onWin();
            return;
        }

        mapManager.nextMap();
        this.playIntroMovement();
    }

    onClick(event: EventTouch) {
        if (this.isIntroPlaying || this.isWarningPlaying || this.isChangingMap || this.isGameEnded) return;

        const location = event.getLocation();
        if (!view.getViewportRect().contains(location)) return;

        if (this.isFirtMove) {
            this.fisrtTap();
            return;
        }

        this.spawnBulletAt(event);
    }

    private spawnBulletAt(event: EventTouch) {
        if (!this.camera) return;

        Ply_SoundManager.Ins?.playFx(FxType.Bullet);

        const location = event.getLocation();
        const worldLocation = this.camera.screenToWorld(new Vec3(location.x, location.y, 0));
        const colliders = PhysicsSystem2D.instance.testPoint(v2(worldLocation.x, worldLocation.y));

        // Ban trung Player -> chuyen sang Map ke tiep
        const hitPlayer = colliders.find(
            (collider) => collider.node.layer === this.playerLayer,
        );
        if (hitPlayer) {
            if (!Ply_Pool.Ins) return;

            Ply_Pool.Ins.spawn(PoolType.Bullet, worldLocation, undefined, MapManager.Ins?.getBulletContainer() ?? null);
            this.isChangingMap = true;
            this.scheduleOnce(this.onPlayerHitDelayFinished, PLAYER_HIT_DELAY);
            return;
        }

        // Ban trung BG -> spawn BulletHole tai diem cham
        if (!Ply_Pool.Ins) return;
        const hitBulletHoleTarget = colliders.find(
            (collider) => collider.node.layer === this.bulletHoleLayer,
        );
        if (!hitBulletHoleTarget) return;

        Ply_Pool.Ins.spawn(PoolType.Bullet, worldLocation, undefined, MapManager.Ins?.getBulletContainer() ?? null);
        this.bgHitCount += 1;
        this.playWarning();
        if (this.bgHitCount >= this.maxBgHits) {
            this.isGameEnded = true;
            ui?.onLose();
        }
    }

    binding() {
        input.on(Input.EventType.TOUCH_END, this.onClick, this);
    }

    offBinding() {
        input.off(Input.EventType.TOUCH_END, this.onClick, this);
    }

    start() {
        this.introMovement?.on(Animation.EventType.FINISHED, this.onIntroMovementFinished, this);
        this.warningAnimation?.on(Animation.EventType.FINISHED, this.onWarningFinished, this);
        this.binding();
    }

    onDestroy() {
        this.introMovement?.off(Animation.EventType.FINISHED, this.onIntroMovementFinished, this);
        this.warningAnimation?.off(Animation.EventType.FINISHED, this.onWarningFinished, this);
        this.unscheduleAllCallbacks();
        this.offBinding();
    }
}
