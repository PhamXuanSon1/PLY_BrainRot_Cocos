import { _decorator, Component, Node, UITransform, v3, Vec3 } from 'cc';
import { DraggableActor } from './DraggableActor';
const { ccclass, property } = _decorator;

/**
 * Du lieu 1 man (gan tren MapN).
 * - actor: nhan vat keo tha (con truc tiep cua Map).
 * - painting: node tranh.
 * - hidePoint: diem an (con cua Painting) - actor tha trong ban kinh `radius` quanh diem nay = an.
 */
@ccclass('HideLevel')
export class HideLevel extends Component {

    @property(DraggableActor)
    actor: DraggableActor = null!;

    @property(Node)
    painting: Node = null!;

    @property(Node)
    hidePoint: Node = null!;

    @property({ tooltip: 'Ban kinh (px, theo local cua Map) quanh HidePoint duoc tinh la an' })
    radius: number = 90;

    private startPos: Vec3 = v3();
    private tmp: Vec3 = v3();

    onLoad() {
        if (this.actor) this.startPos = this.actor.node.position.clone();
    }

    /** Actor ve vi tri xuat phat, khoa keo. */
    public reset() {
        if (!this.actor) return;
        this.actor.reset(this.startPos);
        this.actor.lock();
    }

    /** HidePoint doi ra local cua Map (cung he voi actor.node.position). */
    public hidePointLocal(out: Vec3 = this.tmp): Vec3 {
        const ut = this.node.getComponent(UITransform)!;
        return ut.convertToNodeSpaceAR(this.hidePoint.worldPosition, out);
    }

    /** Khoang cach tam actor -> HidePoint (px local Map). */
    public distToHidePoint(): number {
        const hp = this.hidePointLocal();
        const a = this.actor.node.position;
        const dx = a.x - hp.x, dy = a.y - hp.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    public isHidden(): boolean {
        return this.distToHidePoint() <= this.radius;
    }

    public actorWorldX(): number {
        return this.actor.node.worldPosition.x;
    }
}
