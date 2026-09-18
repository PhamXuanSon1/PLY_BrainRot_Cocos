import { _decorator, Color, Component, Label, Node, Tween, tween, v3 } from 'cc';
import { HideLevel } from './HideLevel';
import { ScanBand } from './ScanBand';
import { Hunter } from './Hunter';
import { MapManager } from '../Manager/MapManager';
import { ui } from '../Manager/UI';
import { ipm } from '../Manager/InputManager';
import { FxType, Ply_SoundManager } from '../ScriptTemplate/Ply_SoundManager';
const { ccclass, property } = _decorator;

enum State {
    Idle,
    WaitFirstTap,
    Hiding,
    Hunting,
    Caught,
    Escaped,
    Ended,
}

/**
 * State machine cua Paint Hide n Seek.
 *
 * Map 1: cho tap -> dem gio + cho keo. Map 2: dem gio ngay khi hien.
 * Het gio (hoac da an som) -> Hunter vao -> ScanBand quet -> caught: ban + Lose | escaped: Win -> map ke.
 * Vao Map 3: khoa gameplay, hand loop, tap bat ky -> store.
 */
@ccclass('HideSeekManager')
export class HideSeekManager extends Component {

    @property(ScanBand)
    scanBand: ScanBand = null!;

    @property(Hunter)
    hunter: Hunter = null!;

    @property({ type: [Node], tooltip: 'Cac node Intro (hand hint, text...), tat het sau tap dau tien' })
    intro: Node[] = [];

    @property({ type: Label, tooltip: 'Label dem nguoc' })
    timerLabel: Label = null!;

    @property({ type: Node, tooltip: 'Node "You win" (bat khi thoat)' })
    winFx: Node = null!;

    @property({ tooltip: 'Thoi gian (giay) de giau nhan vat' })
    hideDuration: number = 8;

    @property({ tooltip: 'Tuy chon: thả đúng chỗ -> cho hunter vào sớm sau x giây. < 0 (mặc định) = luôn chờ hết giờ, vẫn cho kéo lại' })
    earlyHuntDelay: number = -1;

    @property({ tooltip: 'So vong quet cua dai do' })
    scanLoops: number = 2;

    @property({ tooltip: 'Dung hinh (giay) khi bi phat hien truoc khi ban' })
    caughtFreeze: number = 0.2;

    @property({ tooltip: 'Sau khi ban (giay) -> man Lose' })
    shootToLose: number = 0.8;

    @property({ tooltip: 'Hien You win (giay) -> map ke tiep' })
    winToNext: number = 1.5;

    @property({ tooltip: 'Timer chuyen do khi con <= x giay' })
    warnSeconds: number = 3;

    private state: State = State.Idle;
    private level: HideLevel | null = null;
    private timeLeft: number = 0;
    private timerRunning: boolean = false;
    private lastShownSecond: number = -1;

    start() {
        if (this.winFx) this.winFx.active = false;
        if (this.timerLabel) this.timerLabel.node.active = false;
        this.startLevel();
    }

    onDestroy() {
        this.unscheduleAllCallbacks();
    }

    // ---------------------------------------------------------------- level

    private startLevel() {
        const mm = MapManager.Ins;
        this.level = mm?.getCurrentLevel() ?? null;
        if (!this.level) {
            console.warn('[HideSeek] Map hien tai khong co HideLevel');
            return;
        }
        const level = this.level;
        level.reset();
        // Hunter chi active khi het gio (beginHunt)
        if (this.hunter) {
            this.hunter.resetToStart();
            this.hunter.node.active = false;
        }

        const actor = level.actor;
        actor.hintFn = () => level.isHidden();
        actor.onDragStart = () => this.onDragStart();
        actor.onDrop = () => this.onDrop();

        // Hand tutorial: keo tu actor toi diem an
        if (ui) {
            ui.startHand = actor.node;
            ui.endHand = level.hidePoint;
            ui.playHand();
        }

        // Map cuoi: khoa gameplay, tap bat ky -> store
        if (mm!.isLastMap()) {
            this.state = State.Ended;
            actor.lock();
            ui?.bindingToStore();
            return;
        }

        if (mm!.getCurrentIndex() === 0) {
            // Map 1: actor keo duoc ngay; cham/keo vao Actor -> tat Intro + bat dau dem gio
            this.state = State.WaitFirstTap;
            actor.unlock();
        } else {
            this.beginHiding();
        }
    }

    /** Lan dau cham vao Actor (Map 1): tat Intro, bat BGM, bat dau dem gio. */
    private startGame() {
        if (this.state !== State.WaitFirstTap) return;
        Ply_SoundManager.Ins?.playBGM1();
        ui?.firstMove();
        for (const n of this.intro) if (n) n.active = false;
        this.beginHiding();
    }

    private beginHiding() {
        this.state = State.Hiding;
        this.level!.actor.unlock();
        this.startTimer(this.hideDuration);
    }

    private onDragStart() {
        ui?.stopHand();
        this.startGame();
    }

    private onDrop() {
        if (this.state !== State.Hiding || !this.level) return;
        if (this.earlyHuntDelay >= 0 && this.level.isHidden()) {
            // Da an dung cho -> khong can cho het gio
            this.level.actor.lock();
            this.stopTimer();
            this.scheduleOnce(() => this.beginHunt(), this.earlyHuntDelay);
        }
    }

    private onTimeUp() {
        if (this.state !== State.Hiding || !this.level) return;
        const actor = this.level.actor;
        actor.forceDrop();
        actor.lock();
        ui?.stopHand();
        this.beginHunt();
    }

    // ---------------------------------------------------------------- hunt

    private async beginHunt() {
        if (!this.level || this.state === State.Hunting) return;
        this.state = State.Hunting;
        this.stopTimer();
        ui?.stopHand();

        const level = this.level;
        this.hunter.node.active = true;
        await this.hunter.enter();
        if (this.state !== State.Hunting) return;

        Ply_SoundManager.Ins?.playLoopFx(FxType.Scan);
        // Vung quet = Painting + padding (ScanBand.padding)
        const result = await this.scanBand.scan(() => level.isHidden(), () => level.actorWorldX(), this.scanLoops, level.painting);
        Ply_SoundManager.Ins?.stopFx(FxType.Scan);
        if (this.state !== State.Hunting) return;

        if (result === 'caught') this.onCaught();
        else this.onEscaped();
    }

    private onCaught() {
        this.state = State.Caught;
        const level = this.level!;
        this.scheduleOnce(() => {
            this.hunter.shoot(level.actor.node.worldPosition.clone());
            level.actor.playHit();
            Ply_SoundManager.Ins?.playFx(FxType.Lose);
            this.scheduleOnce(() => {
                this.scanBand.hide();
                // Ban xong -> hunter di ra ben phai, roi hien man Lose
                this.hunter.exit().then(() => {
                    this.state = State.Ended;
                    ipm?.showLose();
                });
            }, this.shootToLose);
        }, this.caughtFreeze);
    }

    private async onEscaped() {
        this.state = State.Escaped;
        await this.hunter.exit();

        this.showWinFx();
        this.scheduleOnce(() => {
            this.hideWinFx();
            MapManager.Ins?.nextMap();
            this.startLevel();
        }, this.winToNext);
    }

    private showWinFx() {
        Ply_SoundManager.Ins?.playFx(FxType.Win);
        ipm?.playConfetti();
        if (!this.winFx) return;
        this.winFx.active = true;
        this.winFx.setScale(0, 0, 1);
        tween(this.winFx).to(0.4, { scale: v3(1, 1, 1) }, { easing: 'backOut' }).start();
    }

    private hideWinFx() {
        ipm?.stopConfetti();
        if (this.winFx) {
            Tween.stopAllByTarget(this.winFx);
            this.winFx.active = false;
        }
    }

    // ---------------------------------------------------------------- timer

    private startTimer(seconds: number) {
        this.timeLeft = seconds;
        this.timerRunning = true;
        this.lastShownSecond = -1;
        if (this.timerLabel) {
            this.timerLabel.node.active = true;
            this.timerLabel.color = Color.WHITE.clone();
        }
        this.renderTimer();
    }

    private stopTimer() {
        this.timerRunning = false;
        if (this.timerLabel) this.timerLabel.node.active = false;
    }

    private renderTimer() {
        if (!this.timerLabel) return;
        const sec = Math.max(0, Math.ceil(this.timeLeft));
        if (sec === this.lastShownSecond) return;
        this.lastShownSecond = sec;
        this.timerLabel.string = sec.toString();
        if (sec <= this.warnSeconds) this.timerLabel.color = new Color(255, 60, 60, 255);
        // nhip dap moi giay
        const n = this.timerLabel.node;
        Tween.stopAllByTarget(n);
        n.setScale(1.25, 1.25, 1);
        tween(n).to(0.2, { scale: v3(1, 1, 1) }, { easing: 'quadOut' }).start();
    }

    update(dt: number) {
        if (!this.timerRunning) return;
        this.timeLeft -= dt;
        this.renderTimer();
        if (this.timeLeft <= 0) {
            this.stopTimer();
            this.onTimeUp();
        }
    }
}
