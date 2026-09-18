import { _decorator, Component, Node, Tween, tween, v3, Vec3 } from 'cc';
import { FxType, Ply_SoundManager } from '../ScriptTemplate/Ply_SoundManager';
import { Ply_Pool, PoolType } from '../ScriptTemplate/Ply_Pool';
import { MapManager } from '../Manager/MapManager';
const { ccclass, property } = _decorator;

/**
 * Nhan vat cam sung (Paint Hide n Seek).
 * - Node nay dung yen o vi tri dung; `body` (node con chua sprite) truot vao/ra theo truc x.
 * - enter(): tu offsetX -> 0, exit(): 0 -> offsetX.
 * - shoot(worldPos): tieng sung + giat sung + spawn BulletHole tai worldPos.
 */
@ccclass('Hunter')
export class Hunter extends Component {

    @property({ type: Node, tooltip: 'Node con chua sprite hunter (se truot theo x)' })
    body: Node = null!;

    @property({ tooltip: 'x local cua body khi o ngoai man hinh ben TRAI (vi tri xuat phat)' })
    offsetX: number = -640;

    @property({ tooltip: 'x local cua body khi di ra ngoai man hinh ben PHAI (sau khi quet xong)' })
    exitX: number = 640;

    @property
    enterDuration: number = 0.6;

    @property
    exitDuration: number = 0.6;

    @property({ tooltip: 'Scale cua lo dan khi spawn (prefab BulletHole kha nho)' })
    bulletHoleScale: number = 2;

    // y goc cua Body (dat trong editor, vd: 342 de chan nam o goc node Hunter) - script chi doi x
    private baseY: number = 0;
    private inited: boolean = false;

    /** Doc y goc cua Body dung 1 lan (node Hunter co the inactive luc start nen khong dua vao onLoad). */
    private ensureInit() {
        if (this.inited || !this.body) return;
        this.inited = true;
        this.baseY = this.body.position.y;
    }

    onLoad() {
        this.ensureInit();
        if (this.body) this.body.setPosition(this.offsetX, this.baseY, 0);
    }

    public enter(): Promise<void> {
        return this.slide(0, this.enterDuration, 'backOut', FxType.Whoosh);
    }

    /** Di ra ngoai man hinh ben phai (sau khi quet xong, du ban hay khong). */
    public exit(): Promise<void> {
        return this.slide(this.exitX, this.exitDuration, 'backIn', FxType.Whoosh);
    }

    /** Dua body ve vi tri xuat phat ben trai (goi khi bat dau map moi). */
    public resetToStart() {
        if (!this.body) return;
        this.ensureInit();
        Tween.stopAllByTarget(this.body);
        this.body.setPosition(this.offsetX, this.baseY, 0);
    }

    private slide(toX: number, duration: number, easing: any, fx: FxType): Promise<void> {
        return new Promise<void>((resolve) => {
            if (!this.body) { resolve(); return; }
            this.ensureInit();
            Tween.stopAllByTarget(this.body);
            Ply_SoundManager.Ins?.playFx(fx);
            tween(this.body)
                .to(duration, { position: v3(toX, this.baseY, 0) }, { easing })
                .call(() => resolve())
                .start();
        });
    }

    /** Ban trung actor: tieng sung, giat sung, lo dan tai worldPos. */
    public shoot(worldPos: Vec3) {
        Ply_SoundManager.Ins?.playFx(FxType.Bullet);

        if (this.body) {
            const p = this.body.position.clone();
            Tween.stopAllByTarget(this.body);
            tween(this.body)
                .to(0.05, { position: v3(p.x - 25, p.y, 0) })
                .to(0.15, { position: p }, { easing: 'quadOut' })
                .start();
        }

        if (Ply_Pool.Ins) {
            const hole = Ply_Pool.Ins.spawn(PoolType.Bullet, worldPos, undefined, MapManager.Ins?.getBulletContainer() ?? null);
            if (hole) {
                hole.node.setScale(this.bulletHoleScale, this.bulletHoleScale, 1);
                hole.node.setWorldPosition(worldPos);
            }
        } else {
            console.warn('[Hunter] Ply_Pool chua san sang, khong spawn duoc BulletHole');
        }
    }
}
