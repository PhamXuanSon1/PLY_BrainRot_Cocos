import { _decorator, Component, Node, Tween, tween, UIOpacity, v3, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

/**
 * Bàn tay gợi ý kéo thả (Paint Hide n Seek).
 *
 * Mô phỏng thao tác kéo: xuất hiện tại A -> nhấn xuống (thu nhỏ) -> kéo tới B -> thả ra (phóng lại)
 * -> mờ dần -> nghỉ một chút -> lặp lại.
 *
 * Cách dùng:
 *   - Gán pointA / pointB trên Inspector rồi gọi handHint.play() (hoặc bật autoPlay).
 *   - Hoặc truyền tọa độ world: handHint.play(actor.worldPosition, hidePoint.worldPosition).
 *   - handHint.stop() để ẩn khi user bắt đầu chạm.
 */
@ccclass('HandHint')
export class HandHint extends Component {

    @property({ type: Node, tooltip: 'Điểm bắt đầu kéo (A). Dùng khi play() không truyền tham số' })
    pointA: Node | null = null;

    @property({ type: Node, tooltip: 'Điểm kết thúc kéo (B). Dùng khi play() không truyền tham số' })
    pointB: Node | null = null;

    @property({ tooltip: 'Tự động chạy loop ngay khi start (cần gán pointA / pointB)' })
    autoPlay: boolean = false;

    @property({ tooltip: 'Thời gian (giây) hiện bàn tay tại điểm A trước khi nhấn' })
    appearTime: number = 0.25;

    @property({ tooltip: 'Thời gian (giây) mô phỏng nhấn xuống / thả ra (co giãn scale)' })
    pressTime: number = 0.15;

    @property({ tooltip: 'Thời gian (giây) kéo từ A tới B' })
    moveTime: number = 0.8;

    @property({ tooltip: 'Thời gian (giây) giữ tại B rồi mờ dần' })
    fadeTime: number = 0.3;

    @property({ tooltip: 'Thời gian (giây) nghỉ giữa hai vòng lặp' })
    restTime: number = 0.4;

    @property({ tooltip: 'Scale khi nhấn xuống (so với scale gốc)' })
    pressScale: number = 0.85;

    @property({ tooltip: 'Offset (world) cộng thêm vào cả A và B, ví dụ để đầu ngón tay trỏ đúng tâm' })
    offset: Vec3 = v3(0, 0, 0);

    private baseScale: Vec3 = v3(1, 1, 1);
    private opacity: UIOpacity | null = null;
    private from: Vec3 = v3();
    private to: Vec3 = v3();
    private playing: boolean = false;

    onLoad() {
        this.baseScale = this.node.scale.clone();
        this.opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
        // Tắt node ở onLoad sẽ khiến start() không được gọi -> chỉ ẩn khi không autoPlay
        if (!this.autoPlay) this.node.active = false;
    }

    start() {
        if (this.autoPlay) this.play();
    }

    onDestroy() {
        this.stop();
    }

    /**
     * Bắt đầu loop kéo từ A tới B. Gọi lại sẽ restart với điểm mới.
     * Không truyền tham số -> lấy worldPosition của pointA / pointB.
     */
    public play(fromWorld?: Vec3, toWorld?: Vec3) {
        this.stop();
        const a = fromWorld ?? this.pointA?.worldPosition;
        const b = toWorld ?? this.pointB?.worldPosition;
        if (!a || !b) {
            console.warn('[HandHint] Thiếu điểm A/B: gán pointA / pointB hoặc truyền tọa độ vào play()');
            return;
        }
        Vec3.add(this.from, a, this.offset);
        Vec3.add(this.to, b, this.offset);
        this.playing = true;
        this.node.active = true;
        this.runCycle();
    }

    /** Dừng và ẩn bàn tay ngay lập tức. */
    public stop() {
        this.playing = false;
        Tween.stopAllByTarget(this.node);
        if (this.opacity) Tween.stopAllByTarget(this.opacity);
        this.node.active = false;
    }

    /** Một vòng: hiện tại A -> nhấn -> kéo tới B -> thả -> mờ -> nghỉ -> lặp. */
    private runCycle() {
        if (!this.playing || !this.opacity) return;

        // Trạng thái đầu vòng: tại A, scale gốc, trong suốt
        this.node.setWorldPosition(this.from);
        this.node.setScale(this.baseScale);
        this.opacity.opacity = 0;

        const pressed = v3(
            this.baseScale.x * this.pressScale,
            this.baseScale.y * this.pressScale,
            this.baseScale.z,
        );

        // Alpha chạy riêng trên UIOpacity, vị trí/scale chạy trên node
        tween(this.opacity)
            .to(this.appearTime, { opacity: 255 })
            .delay(this.pressTime + this.moveTime + this.pressTime)
            .to(this.fadeTime, { opacity: 0 })
            .start();

        tween(this.node)
            .delay(this.appearTime)
            .to(this.pressTime, { scale: pressed }, { easing: 'quadOut' })           // nhấn xuống
            .to(this.moveTime, { worldPosition: this.to }, { easing: 'sineInOut' })  // kéo tới B
            .to(this.pressTime, { scale: this.baseScale }, { easing: 'quadOut' })    // thả ra
            .delay(this.fadeTime + this.restTime)
            .call(() => this.runCycle())
            .start();
    }
}
