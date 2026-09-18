import { _decorator, Animation, Color, Component, EventTouch, find, Input, input, Node, ParticleSystem, ParticleSystem2D, Sprite, tween } from 'cc';
import { ui } from './UI';
import { FxType, Ply_SoundManager } from '../ScriptTemplate/Ply_SoundManager';
import { GameController, gc } from '../Tool/GameController';
const { ccclass, property } = _decorator;

export var ipm: InputManager = null;

/**
 * Giu lai cac tien ich ket thuc game (Win / Lose / Confetti / lam toi) cho Paint Hide n Seek.
 * Logic gameplay (keo tha, dem gio, quet) nam o HideSeek/HideSeekManager.
 */
@ccclass('InputManager')
export class InputManager extends Component {

    static instance: InputManager = null;

    @property({ tooltip: 'Thời gian chờ (giây) trước khi bật Confetti' })
    confettiDelay: number = 0;

    @property(Node)
    confetti: Node = null!;

    @property({ tooltip: 'So dot phao hoa ban lien tiep' })
    confettiBursts: number = 1;

    @property({ tooltip: 'Khoang cach giua cac dot (giay)' })
    confettiBurstInterval: number = 0.45;

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

    private isGameEnded: boolean = false;

    onLoad() {
        InputManager.instance = this;
        ipm = this;
        if (!this.confetti) {
            this.confetti = find('UI/Canvas3D/Scenes/ScaleGameplay/Scene/Confetti') ?? find('Confetti') ?? null!;
        }
        this.stopConfetti();
        if (this.winCard) this.winCard.active = false;
        if (this.loseCard) this.loseCard.active = false;
    }

    /**
     * Bat Confetti va chay animation + particle.
     */
    public playConfetti() {
        if (!this.confetti) return;
        this.unschedule(this.fireConfettiBurst);
        this.confetti.active = true;
        const anims = this.confetti.getComponentsInChildren(Animation);
        for (const a of anims) {
            a.stop();
            a.play();
        }
        this.fireConfettiBurst();
        // Ban them cac dot tiep theo
        const extra = Math.max(0, Math.floor(this.confettiBursts) - 1);
        if (extra > 0) {
            this.schedule(this.fireConfettiBurst, this.confettiBurstInterval, extra - 1, this.confettiBurstInterval);
        }
    }

    private fireConfettiBurst() {
        if (!this.confetti || !this.confetti.activeInHierarchy) return;
        const particles = this.confetti.getComponentsInChildren(ParticleSystem2D);
        for (const pt of particles) {
            pt.resetSystem();
        }
        // Particle 3D (vd: prefab import tu Unity - ConfettiDirectionalRainbow)
        const particles3d = this.confetti.getComponentsInChildren(ParticleSystem);
        for (const ps of particles3d) {
            ps.stop();
            ps.play();
        }
        Ply_SoundManager.Ins?.playFx(FxType.Confetti);
    }

    /**
     * Tat Confetti.
     */
    public stopConfetti() {
        this.unschedule(this.fireConfettiBurst);
        if (!this.confetti) return;
        this.confetti.active = false;
        const particles = this.confetti.getComponentsInChildren(ParticleSystem2D);
        for (const pt of particles) {
            pt.stopSystem();
        }
        const particles3d = this.confetti.getComponentsInChildren(ParticleSystem);
        for (const ps of particles3d) {
            ps.stop();
            ps.clear();
        }
    }

    /**
     * Xu ly khi Win (tam thoi bo man hinh win)
     */
    public showWin() {
        if (this.isGameEnded) return;
        this.isGameEnded = true;
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
        if (this.isGameEnded) return;
        this.isGameEnded = true;

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
        } else if (gc) {
            gc.redirectToStore();
        } else {
            find('OpenStore')?.getComponent(GameController)?.redirectToStore();
        }
    }

    /** Giu API cu cho UI.bindingToStore() */
    public offBinding() {}

    onDestroy() {
        this.unscheduleAllCallbacks();
        input.off(Input.EventType.TOUCH_END, this.onStoreClicked, this);
    }
}
