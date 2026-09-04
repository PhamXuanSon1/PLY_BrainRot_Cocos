import { _decorator, Node } from 'cc';
import { Ply_Singleton } from '../ScriptTemplate/Ply_Singleton';
import { Ply_Pool, PoolType } from '../ScriptTemplate/Ply_Pool';
import { Ply_GameUnit } from '../ScriptTemplate/Ply_GameUnit';
const { ccclass, property } = _decorator;

/**
 * Quan ly viec chuyen doi giua cac Map trong game.
 *
 * Cach dung:
 * - Keo cac Node Map (Map1, Map2, Map3, ...) vao mang `maps` theo dung thu tu.
 * - Khi ban trung Player (xem InputManager) se tu dong tat Map hien tai va bat Map ke tiep.
 */
@ccclass('MapManager')
export class MapManager extends Ply_Singleton {

    public static Ins: MapManager | null = null;

    @property([Node])
    maps: Node[] = [];

    // Node cha de chua cac BulletHole duoc spawn ra cho tung Map (theo dung thu tu voi `maps`),
    // giup bullet hole nam dung trong Map tuong ung va de nhin trong Hierarchy.
    @property([Node])
    bulletContainers: Node[] = [];

    // Dung khi Map hien tai khong co bulletContainer rieng (phan tu tuong ung trong `bulletContainers` de trong)
    @property(Node)
    defaultBulletContainer: Node = null!;

    // Chi so cua Map dang active
    private currentIndex: number = 0;

    onLoad() {
        super.onLoad();
        MapManager.Ins = this;
        this.showMap(this.currentIndex);
    }

    /**
     * Thu hoi (despawn) toan bo bullet da ban ve lai pool.
     */
    public despawnAllBullets() {
        if (Ply_Pool.Ins) {
            Ply_Pool.Ins.despawnAll(PoolType.Bullet);
        }

        // Quet phong ve (fallback) cac container de dam bao khong con bullet nao bi sot lai
        const containersToClean: Node[] = [];
        if (this.bulletContainers && this.bulletContainers.length > 0) {
            for (const container of this.bulletContainers) {
                if (container && container.isValid) {
                    containersToClean.push(container);
                }
            }
        }
        if (this.defaultBulletContainer && this.defaultBulletContainer.isValid) {
            containersToClean.push(this.defaultBulletContainer);
        }

        for (const container of containersToClean) {
            const children = [...container.children];
            for (const child of children) {
                const gameUnit = child.getComponent(Ply_GameUnit);
                if (gameUnit && Ply_Pool.Ins) {
                    Ply_Pool.Ins.despawn(PoolType.Bullet, gameUnit);
                } else {
                    child.active = false;
                }
            }
        }
    }

    /**
     * Bat Map tai index chi dinh, tat tat ca cac Map con lai.
     * Despawn toan bo bullet truoc khi chuyen sang Map moi.
     */
    public showMap(index: number) {
        if (index < 0 || index >= this.maps.length) return;

        this.despawnAllBullets();

        this.maps.forEach((map, i) => {
            if (map) map.active = (i === index);
        });
        this.currentIndex = index;
    }

    /**
     * Chuyen sang Map ke tiep (goi khi ban trung Player).
     * Neu da la Map cuoi cung thi goi onAllMapsCleared().
     */
    public nextMap() {
        const nextIndex = this.currentIndex + 1;
        if (nextIndex >= this.maps.length) {
            this.despawnAllBullets();
            this.onAllMapsCleared();
            return;
        }
        this.showMap(nextIndex);
    }

    public getCurrentIndex(): number {
        return this.currentIndex;
    }

    /**
     * Lay Node cha de spawn BulletHole cho Map dang active.
     * Fallback ve defaultBulletContainer neu Map hien tai chua gan rieng.
     */
    public getBulletContainer(): Node | null {
        return this.bulletContainers[this.currentIndex] ?? this.defaultBulletContainer;
    }

    public isLastMap(): boolean {
        return this.currentIndex >= this.maps.length - 1;
    }

    /**
     * Duoc goi khi nguoi choi da vuot qua Map cuoi cung.
     * TODO: hook vao ui.onWin() hoac logic thang game o day.
     */
    protected onAllMapsCleared() {
        // vi du: ui?.onWin();
    }

    onDestroy() {
        super.onDestroy();
        if (MapManager.Ins === this) {
            MapManager.Ins = null;
        }
    }
}
