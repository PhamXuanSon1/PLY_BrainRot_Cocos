import { _decorator, Animation, Camera, Color, Component, Enum, EventTouch, find, Input, input, Layers, Node, ParticleSystem2D, PhysicsSystem2D, Sprite, tween, UIOpacity, Vec3, v2, view } from 'cc';
import { ui } from './UI';
import { sm } from './SoundManager';
import { Ply_Pool, PoolType } from '../ScriptTemplate/Ply_Pool';
import { FxType, Ply_SoundManager } from '../ScriptTemplate/Ply_SoundManager';
import { MapManager } from './MapManager';
import { GameController } from '../Tool/GameController';
const { ccclass, property } = _decorator;
const PLAYER_HIT_DELAY = 3;

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

    @property({ tooltip: 'Thời gian chờ (giây) sau khi bắn trúng Player trước khi chuyển map' })
    playerHitDelay: number = PLAYER_HIT_DELAY;

    @property({ tooltip: 'Thời gian chờ (giây) sau khi bắn trúng Player trước khi bật Confetti và phát âm thanh' })
    confettiDelay: number = 0.5;

    @property(Node)
    confetti: Node = null!;

    @property({ type: Node, tooltip: 'Màn hình hiển thị khi Thắng (Win)' })
    winCard: Node = null!;

    @property({ type: Node, tooltip: 'Màn hình hiển thị khi Thua (Lose/Loss)' })
    loseCard: Node = null!;

    @property([Node])
    darkenTarget: Node[] = [];

    @property({ tooltip: 'Độ tối khi Thua (từ 0 đến 1: 0 = đen hoàn toàn, 0.3 = tối 70%, 1 = giữ nguyên)' })
    darkFactor: number = 0.3;

    @property({ tooltip: 'Thời gian chuyển sang màu tối (giây)' })
    darkenDuration: number = 0.6;

    onLoad() {
        InputManager.instance = this;
        ipm = this;
        this.warning?.active && (this.warning.active = false);
        this.warningAnimation = this.warning?.getComponent(Animation) ?? null;
        if (!this.confetti) {
            this.confetti = find('Canvas2D/Scenes/ScaleGameplay/Scene/Confetti') ?? find('Confetti') ?? null!;
        }
        this.stopConfetti();
        if (this.winCard) this.winCard.active = false;
        if (this.loseCard) this.loseCard.active = false;
    }

    fisrtTap() {
        if (this.isFirtMove) {
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

    /**
     * Fade alpha cua Player (va cac Sprite/UIOpacity con) tu gia tri hien tai len 255 trong 1 giay.
     */
    private fadeInPlayer(playerNode: Node, duration: number = 1.0) {
        if (!playerNode || !playerNode.isValid) return;

        let sprites = playerNode.getComponentsInChildren(Sprite);
        if (sprites.length === 0 && playerNode.parent) {
            sprites = playerNode.parent.getComponentsInChildren(Sprite);
        }

        for (const sprite of sprites) {
            if (!sprite || !sprite.isValid) continue;

            const startColor = sprite.color.clone();
            const startAlpha = startColor.a;
            const targetAlpha = 255;
            if (startAlpha >= targetAlpha) continue;

            const tempColor = new Color(startColor);
            const state = { a: startAlpha };
            tween(state)
                .to(duration, { a: targetAlpha }, {
                    onUpdate: (target: { a: number }) => {
                        if (sprite.isValid) {
                            tempColor.a = Math.round(target.a);
                            sprite.color = tempColor;
                        }
                    },
                })
                .start();
        }

        let uiOpacities = playerNode.getComponentsInChildren(UIOpacity);
        if (uiOpacities.length === 0 && playerNode.parent) {
            uiOpacities = playerNode.parent.getComponentsInChildren(UIOpacity);
        }

        for (const uio of uiOpacities) {
            if (!uio || !uio.isValid) continue;

            const startOpacity = uio.opacity;
            const targetOpacity = 255;
            if (startOpacity >= targetOpacity) continue;

            const state = { opacity: startOpacity };
            tween(state)
                .to(duration, { opacity: targetOpacity }, {
                    onUpdate: (target: { opacity: number }) => {
                        if (uio.isValid) {
                            uio.opacity = Math.round(target.opacity);
                        }
                    },
                })
                .start();
        }
    }

    /**
     * Bat Confetti va chay animation + particle.
     */
    public playConfetti() {
        if (!this.confetti) return;
        this.confetti.active = true;
        const anims = this.confetti.getComponentsInChildren(Animation);
        for (const a of anims) {
            a.stop();
            a.play();
        }
        const particles = this.confetti.getComponentsInChildren(ParticleSystem2D);
        for (const pt of particles) {
            pt.resetSystem();
        }
        Ply_SoundManager.Ins?.playFx(FxType.Confetti);
    }

    /**
     * Tat Confetti khi chuyen sang Map khac.
     */
    public stopConfetti() {
        this.unschedule(this.onConfettiDelayFinished);
        if (!this.confetti) return;
        this.confetti.active = false;
        const particles = this.confetti.getComponentsInChildren(ParticleSystem2D);
        for (const pt of particles) {
            pt.stopSystem();
        }
    }

    private onConfettiDelayFinished() {
        if (!this.isValid || this.isGameEnded) return;
        this.playConfetti();
    }

    /**
     * Xu ly khi Win (tam thoi bo man hinh win)
     */
    public showWin() {
        this.isGameEnded = true;
        this.offBinding();
        // Tam thoi bo bat man hinh win:
        // if (this.winCard) {
        //     this.winCard.active = true;
        // }
        ui?.onWin();
        this.bindStoreClick();
    }

    /**
     * Lam toi tat ca cac Sprite ben trong mot Node cha khi Thua (Loss).
     */
    public darkenNode(targetParent: Node, duration: number = 0.6, factor: number = 0.3) {
        if (!targetParent || !targetParent.isValid) return;

        const sprites = targetParent.getComponentsInChildren(Sprite);
        for (const sprite of sprites) {
            if (!sprite || !sprite.isValid) continue;

            const startColor = sprite.color.clone();
            const targetR = Math.round(startColor.r * factor);
            const targetG = Math.round(startColor.g * factor);
            const targetB = Math.round(startColor.b * factor);

            const tempColor = new Color(startColor);
            const state = { t: 0 };
            tween(state)
                .to(duration, { t: 1 }, {
                    easing: 'smooth',
                    onUpdate: (target: { t: number }) => {
                        if (sprite.isValid) {
                            tempColor.r = Math.round(startColor.r + (targetR - startColor.r) * target.t);
                            tempColor.g = Math.round(startColor.g + (targetG - startColor.g) * target.t);
                            tempColor.b = Math.round(startColor.b + (targetB - startColor.b) * target.t);
                            sprite.color = tempColor;
                        }
                    },
                })
                .start();
        }
    }

    /**
     * Hien thi man hinh Lose/Loss
     */
    public showLose() {
        this.isGameEnded = true;
        this.offBinding();

        // Lam toi tat ca obj con cua darkenTarget
        for (const target of this.darkenTarget) {
            this.darkenNode(target, this.darkenDuration, this.darkFactor);
        }

        if (this.loseCard) {
            this.loseCard.active = true;
        }
        ui?.onLose();
        this.bindStoreClick();
    }

    private isStoreBound: boolean = false;

    /**
     * Dang ky su kien click toan man hinh sau khi Win hoac Loss de chuyen huong vao Store
     */
    private bindStoreClick() {
        if (ui) return; // UI.ts da tu dang ky su kien trong bindingToStore()
        if (this.isStoreBound) return;
        this.isStoreBound = true;

        this.scheduleOnce(() => {
            input.on(Input.EventType.TOUCH_END, this.onStoreClicked, this);
        }, 0.15);
    }

    private onStoreClicked(event?: EventTouch) {
        if (ui) {
            ui.openStore();
        } else if (GameController.instance) {
            GameController.instance.redirectToStore();
        } else {
            find('OpenStore')?.getComponent(GameController)?.redirectToStore();
        }
    }

    private onPlayerHitDelayFinished() {
        this.isChangingMap = false;
        if (!this.isValid) return;

        const mapManager = MapManager.Ins;
        if (!mapManager) return;

        this.stopConfetti();
        mapManager.nextMap();

        // Khi vua chuyen sang Map cuoi cung (Map 3) -> ngat choi game, nhan click ra store
        if (mapManager.isLastMap()) {
            this.isGameEnded = true;
            this.offBinding();
            mapManager.despawnAllBullets();
            this.showWin();
            return;
        }

        if (this.isGameEnded) return;

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
            this.fadeInPlayer(hitPlayer.node, 1.0);
            this.isChangingMap = true;
            if (this.confettiDelay > 0) {
                this.scheduleOnce(this.onConfettiDelayFinished, this.confettiDelay);
            } else {
                this.playConfetti();
            }
            this.scheduleOnce(this.onPlayerHitDelayFinished, this.playerHitDelay ?? PLAYER_HIT_DELAY);
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
            this.showLose();
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
        input.off(Input.EventType.TOUCH_END, this.onStoreClicked, this);
    }
}
