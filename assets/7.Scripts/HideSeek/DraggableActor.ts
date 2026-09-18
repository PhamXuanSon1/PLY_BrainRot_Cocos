import { _decorator, Component, EventTouch, find, Node, Tween, tween, UIOpacity, UITransform, v3, Vec2, Vec3 } from 'cc';
import { FxType, Ply_SoundManager } from '../ScriptTemplate/Ply_SoundManager';
const { ccclass, property } = _decorator;

/**
 * Nhan vat keo tha (Paint Hide n Seek).
 *
 * - Gan tren node Actor (UITransform = vung cham). Sprite nam o node con.
 * - Keo tha tu do, khong snap. Vi tri local (theo parent = Map) duoc HideLevel dung de so voi HidePoint.
 * - Callback cho manager: onDragStart / onDragMove / onDrop.
 * - hintFn: tra ve true khi actor dang nam trong ban kinh an -> giam alpha de bao hieu.
 */
@ccclass('DraggableActor')
export class DraggableActor extends Component {

    @property({ tooltip: 'Scale nhan them khi dang keo' })
    dragScale: number = 1.1;

    @property({ tooltip: 'Alpha (0-255) khi actor nam trong ban kinh an luc dang keo' })
    hintAlpha: number = 170;

    @property({ tooltip: 'Khoang du (px world) cho phep keo ra ngoai mep canvas' })
    clampPadding: number = 40;

    public locked: boolean = true;
    public dragging: boolean = false;

    public onDragStart: (() => void) | null = null;
    public onDragMove: (() => void) | null = null;
    public onDrop: (() => void) | null = null;
    public hintFn: (() => boolean) | null = null;

    private baseScale: Vec3 = v3(1, 1, 1);
    private grabOffset: Vec3 = v3();
    private opacity: UIOpacity | null = null;
    private canvasUT: UITransform | null = null;
    private tmp: Vec3 = v3();

    onLoad() {
        this.baseScale = this.node.scale.clone();
        this.opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
        this.canvasUT = find('UI/Canvas3D')?.getComponent(UITransform) ?? null;

        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    onDestroy() {
        this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    public lock() { this.locked = true; }
    public unlock() { this.locked = false; }

    /** Dua actor ve trang thai ban dau (vi tri start, scale, alpha, goc). */
    public reset(localPos: Vec3) {
        Tween.stopAllByTarget(this.node);
        this.dragging = false;
        this.node.setPosition(localPos);
        this.node.angle = 0;
        this.node.setScale(this.baseScale);
        if (this.opacity) this.opacity.opacity = 255;
    }

    /** Diem cham (screen) co trung actor khong - dung cho tap dau tien cua Map 1. */
    public hitTest(screenPos: Vec2): boolean {
        const ut = this.node.getComponent(UITransform);
        return ut ? ut.hitTest(screenPos) : false;
    }

    /** Bat dau keo tu mot event (dung khi tap dau tien roi trung actor). */
    public beginDrag(event: EventTouch) {
        if (this.dragging) return;
        this.dragging = true;
        const local = this.toParentLocal(event);
        Vec3.subtract(this.grabOffset, this.node.position, local);
        this.node.setScale(this.baseScale.x * this.dragScale, this.baseScale.y * this.dragScale, 1);
        this.node.setSiblingIndex(this.node.parent!.children.length - 1);
        Ply_SoundManager.Ins?.playFx(FxType.Pick);
        this.onDragStart?.();
        this.applyHint();
    }

    /** Tha actor tai cho (het gio hoac nhac tay). */
    public forceDrop() { this.drop(); }

    private onTouchStart(event: EventTouch) {
        if (this.locked || this.dragging) return;
        this.beginDrag(event);
    }

    private onTouchMove(event: EventTouch) {
        if (!this.dragging) return;
        const local = this.toParentLocal(event);
        Vec3.add(this.tmp, local, this.grabOffset);
        this.node.setPosition(this.tmp.x, this.tmp.y, 0);
        this.clampToCanvas();
        this.applyHint();
        this.onDragMove?.();
    }

    private onTouchEnd() {
        if (!this.dragging) return;
        this.drop();
    }

    private drop() {
        if (!this.dragging) return;
        this.dragging = false;
        this.node.setScale(this.baseScale);
        if (this.opacity) this.opacity.opacity = 255;
        this.onDrop?.();
    }

    private applyHint() {
        if (!this.opacity) return;
        const inside = this.hintFn ? this.hintFn() : false;
        this.opacity.opacity = inside ? this.hintAlpha : 255;
    }

    private toParentLocal(event: EventTouch): Vec3 {
        const ui = event.getUILocation();
        const parentUT = this.node.parent!.getComponent(UITransform)!;
        return parentUT.convertToNodeSpaceAR(v3(ui.x, ui.y, 0));
    }

    private clampToCanvas() {
        if (!this.canvasUT) return;
        const c = this.canvasUT.node.worldPosition;
        const hw = this.canvasUT.width / 2 + this.clampPadding;
        const hh = this.canvasUT.height / 2 + this.clampPadding;
        const w = this.node.worldPosition;
        const x = Math.min(c.x + hw, Math.max(c.x - hw, w.x));
        const y = Math.min(c.y + hh, Math.max(c.y - hh, w.y));
        if (x !== w.x || y !== w.y) this.node.setWorldPosition(x, y, w.z);
    }

    /** Bi ban: rung roi do nghieng xuong. */
    public playHit() {
        Tween.stopAllByTarget(this.node);
        const p = this.node.position.clone();
        tween(this.node)
            .to(0.04, { position: v3(p.x + 12, p.y, 0) })
            .to(0.04, { position: v3(p.x - 12, p.y, 0) })
            .to(0.04, { position: v3(p.x + 8, p.y, 0) })
            .to(0.04, { position: v3(p.x, p.y, 0) })
            .to(0.5, { angle: -80, position: v3(p.x + 40, p.y - 120, 0) }, { easing: 'quadIn' })
            .start();
    }
}
