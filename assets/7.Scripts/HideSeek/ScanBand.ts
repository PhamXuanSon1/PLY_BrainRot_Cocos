import { _decorator, Camera, Color, Component, Graphics, Node, screen, UITransform, v3, Vec3, view } from 'cc';
const { ccclass, property } = _decorator;

export type ScanResult = 'caught' | 'escaped';

/**
 * Dải màu đỏ quét ngang màn hình (Paint Hide n Seek).
 *
 * - Dải cao full màn hình, đi từ mép trái -> mép phải -> mép trái = 1 vòng.
 * - Khi đang quét, nếu actor CHƯA ẩn (isHidden() == false) và tâm dải đi qua x của actor
 *   -> dừng lại ngay tại đó và trả về 'caught'.
 * - Hết số vòng mà không bắt được -> tắt dải, trả về 'escaped'.
 *
 * Cách dùng (từ HideSeekManager):
 *   const r = await scanBand.scan(() => level.isHidden(), () => actor.worldPosition.x, 2);
 *   if (r === 'caught') hunter.shoot(actor.worldPosition); else onEscaped();
 */
@ccclass('ScanBand')
export class ScanBand extends Component {

    @property({ type: Camera, tooltip: 'UICam - dùng để tính mép trái/phải màn hình theo world' })
    uiCam: Camera = null!;

    @property({ tooltip: 'Thời gian (giây) cho 1 lượt quét trái->phải (hoặc phải->trái)' })
    passDuration: number = 1.2;

    @property({ tooltip: 'Số vòng quét mặc định (1 vòng = trái->phải->trái)' })
    loops: number = 2;

    @property({ tooltip: 'Khoảng dư (px world) để dải nằm hẳn ngoài màn hình lúc bắt đầu/kết thúc (chỉ dùng khi quét full màn)' })
    margin: number = 150;

    @property({ tooltip: 'Viền (px world) cộng thêm quanh vùng quét (painting) khi scan() có truyền area' })
    padding: number = 100;

    @property({ tooltip: 'Dùng easing sineInOut cho mỗi lượt (true) hay tuyến tính (false)' })
    smooth: boolean = true;

    @property({ type: Node, tooltip: 'Điểm xuất phát của chùm quét (vd: Muzzle trên Hunter). Để trống = không vẽ tam giác' })
    origin: Node = null!;

    @property({ type: Graphics, tooltip: 'Graphics vẽ tam giác nối origin với đỉnh trên/dưới của dải' })
    cone: Graphics = null!;

    @property({ tooltip: 'Màu tô tam giác' })
    coneFill: Color = new Color(255, 40, 40, 70);

    @property({ tooltip: 'Màu viền 2 cạnh tam giác' })
    coneLine: Color = new Color(255, 90, 90, 200);

    @property({ tooltip: 'Độ dày viền' })
    coneLineWidth: number = 4;

    private running: boolean = false;
    private leftX: number = 0;
    private rightX: number = 0;
    private passIndex: number = 0;
    private totalPasses: number = 0;
    private elapsed: number = 0; // thời gian đã trôi qua trong lượt hiện tại
    private prevX: number = 0; // world x của dải ở frame trước

    private topY: number = 0;    // mép trên màn hình (world)
    private bottomY: number = 0; // mép dưới màn hình (world)

    private isHiddenFn: (() => boolean) | null = null;
    private targetXFn: (() => number) | null = null;
    private resolveFn: ((r: ScanResult) => void) | null = null;

    /**
     * Bắt đầu quét. Trả về Promise resolve 'caught' | 'escaped'.
     * @param isHidden callback: actor đã trốn đúng chỗ chưa
     * @param getTargetWorldX callback: x (world) của actor
     * @param loops số vòng (mặc định this.loops)
     * @param area node có UITransform (vd: Painting) - vùng quét = bbox của node + padding. Null = full màn hình
     */
    public scan(isHidden: () => boolean, getTargetWorldX: () => number, loops: number = this.loops, area: Node | null = null): Promise<ScanResult> {
        // Huỷ lần quét cũ trước khi tạo lần mới, tránh hai Promise cùng điều khiển dải quét.
        this.stop();
        return new Promise<ScanResult>((resolve) => {
            // Lưu resolve để update() gọi finish() và trả kết quả khi bắt được hoặc quét xong.
            this.resolveFn = resolve;

            // Lưu callback thay vì giá trị hiện tại: actor có thể đổi trạng thái ẩn hoặc di chuyển
            // trong khi dải đang quét, nên update() phải lấy dữ liệu mới ở từng frame.
            this.isHiddenFn = isHidden;
            this.targetXFn = getTargetWorldX;

            // Một vòng gồm hai lượt: trái -> phải và phải -> trái.
            // Luôn có ít nhất một lượt ngay cả khi loops truyền vào là 0 hoặc số thập phân nhỏ.
            this.totalPasses = Math.max(1, Math.round(loops * 2));

            // Đặt lại trạng thái tiến độ của lần quét mới.
            this.passIndex = 0;
            this.elapsed = 0;

            // Vùng quét: bbox của area (+padding) hoặc full màn hình theo camera.
            if (area) {
                this.fitToArea(area);
            } else {
                this.updateBounds();
                this.fitHeight();
            }

            // Luôn bắt đầu từ mép trái; prevX dùng để phát hiện thời điểm dải đi qua actor ở frame sau.
            this.setWorldX(this.leftX);
            this.prevX = this.leftX;
            this.drawCone();

            // Hiện node và cho phép update() bắt đầu di chuyển dải quét.
            this.node.active = true;
            this.running = true;
        });
    }

    /** Dừng quét ngay lập tức (không resolve promise đang chờ). */
    public stop() {
        this.running = false;
        this.resolveFn = null;
        this.isHiddenFn = null;
        this.targetXFn = null;
    }

    /** Ẩn dải (gọi sau khi 'escaped', hoặc sau khi bắn xong lúc 'caught'). */
    public hide() {
        this.stop();
        this.cone?.clear();
        this.node.active = false;
    }

    update(dt: number) {
        if (!this.running) return;

        this.elapsed += dt;
        let t = Math.min(1, this.elapsed / this.passDuration);
        if (this.smooth) t = 0.5 - 0.5 * Math.cos(Math.PI * t); // sineInOut

        // lượt chẵn: trái -> phải, lượt lẻ: phải -> trái
        const goingRight = (this.passIndex % 2) === 0;
        const from = goingRight ? this.leftX : this.rightX;
        const to = goingRight ? this.rightX : this.leftX;
        const x = from + (to - from) * t;

        // Kiểm tra dải đi qua actor (chỉ khi actor chưa ẩn)
        if (this.isHiddenFn && this.targetXFn && !this.isHiddenFn()) {
            // Clamp x của actor vào vùng quét: actor nằm ngoài vùng (chưa ẩn) vẫn bị bắt khi dải chạm mép gần nhất
            const tx = Math.min(this.rightX, Math.max(this.leftX, this.targetXFn()));
            const crossed = goingRight
                ? (this.prevX < tx && x >= tx)
                : (this.prevX > tx && x <= tx);
            if (crossed) {
                this.setWorldX(tx);
                this.drawCone();
                this.finish('caught');
                return;
            }
        }

        this.setWorldX(x);
        this.prevX = x;
        this.drawCone();

        if (t >= 1) {
            this.passIndex++;
            this.elapsed = 0;
            if (this.passIndex >= this.totalPasses) {
                this.cone?.clear();
                this.node.active = false;
                this.finish('escaped');
            }
        }
    }

    /** Vẽ tam giác: origin (hunter) -> đỉnh trên dải -> đỉnh dưới dải. */
    private drawCone() {
        if (!this.cone || !this.origin) return;
        const ut = this.node.getComponent(UITransform);
        if (!ut) return;
        const g = this.cone;
        const p = this.node.worldPosition;
        // Đổi 3 điểm về local của dải (Cone là con của dải, đặt ở (0,0), scale 1)
        const o = ut.convertToNodeSpaceAR(this.origin.worldPosition);
        const top = ut.convertToNodeSpaceAR(v3(p.x, this.topY, p.z));
        const bot = ut.convertToNodeSpaceAR(v3(p.x, this.bottomY, p.z));

        g.clear();
        g.moveTo(o.x, o.y);
        g.lineTo(top.x, top.y);
        g.lineTo(bot.x, bot.y);
        g.close();
        g.fillColor = this.coneFill;
        g.fill();
        g.lineWidth = this.coneLineWidth;
        g.strokeColor = this.coneLine;
        g.stroke();
    }

    private finish(result: ScanResult) {
        const resolve = this.resolveFn;
        this.running = false;
        this.resolveFn = null;
        this.isHiddenFn = null;
        this.targetXFn = null;
        resolve?.(result);
    }

    private setWorldX(x: number) {
        const p = this.node.worldPosition;
        this.node.setWorldPosition(x, p.y, p.z);
    }

    /** Vùng quét = bbox world của area + padding: đặt dải cao bằng vùng, quét từ mép trái tới mép phải vùng. */
    private fitToArea(area: Node) {
        const aut = area.getComponent(UITransform);
        const ut = this.node.getComponent(UITransform);
        if (!aut || !ut) { this.updateBounds(); this.fitHeight(); return; }
        const r = aut.getBoundingBoxToWorld();
        const pad = this.padding;
        this.leftX = r.xMin - pad;
        this.rightX = r.xMax + pad;
        this.topY = r.yMax + pad;
        this.bottomY = r.yMin - pad;
        const ws = this.node.worldScale.y || 1;
        ut.height = (this.topY - this.bottomY) / ws;
        const p = this.node.worldPosition;
        this.node.setWorldPosition(p.x, (this.topY + this.bottomY) / 2, p.z);
    }

    /** Tính mép trái / phải màn hình theo world (cộng thêm margin). */
    private updateBounds() {
        if (this.uiCam) {
            const size = screen.windowSize;
            const l = this.uiCam.screenToWorld(new Vec3(0, 0, 0));
            const r = this.uiCam.screenToWorld(new Vec3(size.width, 0, 0));
            this.leftX = Math.min(l.x, r.x) - this.margin;
            this.rightX = Math.max(l.x, r.x) + this.margin;
        } else {
            // fallback: canvas 1080 design width, node đặt ở giữa
            const half = view.getVisibleSize().width / 2;
            const cx = this.node.worldPosition.x;
            this.leftX = cx - half - this.margin;
            this.rightX = cx + half + this.margin;
        }
    }

    /** Kéo dài chiều cao dải cho phủ hết màn hình (theo world), bất kể scale của parent. */
    private fitHeight() {
        const ut = this.node.getComponent(UITransform);
        if (!ut || !this.uiCam) return;
        const size = screen.windowSize;
        const b = this.uiCam.screenToWorld(new Vec3(0, 0, 0));
        const t = this.uiCam.screenToWorld(new Vec3(0, size.height, 0));
        this.topY = Math.max(t.y, b.y);
        this.bottomY = Math.min(t.y, b.y);
        const worldH = Math.abs(t.y - b.y) * 1.3;
        const ws = this.node.worldScale.y || 1;
        ut.height = worldH / ws;
        const p = this.node.worldPosition;
        this.node.setWorldPosition(p.x, (t.y + b.y) / 2, p.z);
    }
}
