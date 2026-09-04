import { _decorator, Node } from 'cc';
import { Ply_Singleton } from '../ScriptTemplate/Ply_Singleton';
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
     * Bat Map tai index chi dinh, tat tat ca cac Map con lai.
     */
    public showMap(index: number) {
        if (index < 0 || index >= this.maps.length) return;

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
