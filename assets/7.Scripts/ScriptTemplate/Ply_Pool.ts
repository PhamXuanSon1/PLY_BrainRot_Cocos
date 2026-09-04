import { _decorator, Component, Node, Prefab, instantiate, Vec3, Quat, CCInteger, Enum } from 'cc';
import { Ply_Singleton } from './Ply_Singleton';
import { Ply_GameUnit } from './Ply_GameUnit';
const { ccclass, property } = _decorator;

/**
 * Enum cac loai Pool - them cac loai khac neu can.
 */
export enum PoolType {
    Heart = 0,
    CorrectEffect = 1,
    BreakHeart = 2,
    Bullet = 3,
}
// Dang ky enum de hien thi tren inspector cua Cocos Creator
Enum(PoolType);

/**
 * Quan ly Object Pool duoc chuyen tu Unity Ply_Pool.
 * 
 * Diem khac biệt so voi Unity:
 * - Dung Prefab thay vi tham chieu gameUnit truc tiep de khoi tao
 * - Dung node.active thay vi gameObject.SetActive()
 * - Dung instantiate() tu 'cc' thay vi UnityEngine.Object.Instantiate()
 * - Dat vi tri/goi quay qua node.setPosition() va node.setRotation()
 */
@ccclass('PoolAmount')
class PoolAmount {
    @property({ type: PoolType })
    type: PoolType = PoolType.Heart;

    @property(CCInteger)
    amount: number = 0;

    @property(Prefab)
    prefab: Prefab | null = null;
}

@ccclass('Ply_Pool')
export class Ply_Pool extends Ply_Singleton {

    public static Ins: Ply_Pool | null = null;

    @property([PoolAmount])
    poolAmounts: PoolAmount[] = [];

    private dict: Map<PoolType, Ply_GameUnit[]> = new Map();
    private activeDict: Map<PoolType, Ply_GameUnit[]> = new Map();


    // onLoad() la ham duoc goi khi component duoc khoi tao, truoc khi bat dau scene
    onLoad() {
        super.onLoad();
        Ply_Pool.Ins = this;
        this.onInit();
    }


    // Ham khoi tao pool, tao cac game unit va luu vao dict
    private onInit() {
        for (let i = 0; i < this.poolAmounts.length; i++) {
            const poolAmount = this.poolAmounts[i];


            // Neu chua co danh sach cho loai pool nay, tao mot danh sach moi
            if (!this.dict.has(poolAmount.type)) {
                this.dict.set(poolAmount.type, []);
            }


            // Khoi tao cac game unit va them vao danh sach
            for (let j = 0; j < poolAmount.amount; j++) {
                if (!poolAmount.prefab) continue;

                const unitNode = instantiate(poolAmount.prefab);
                unitNode.active = false;
                unitNode.setParent(this.node);

                const gameUnit = unitNode.getComponent(Ply_GameUnit);
                if (gameUnit) {
                    this.dict.get(poolAmount.type)!.push(gameUnit);
                }
            }
        }
    }

    /**
     * Lay mot game unit ra tu pool (spawn).
     * @param poolType - Loai doi tuong can spawn
     * @param pos - Vi tri the gioi
     * @param rot - Goc quay (Quat), mac dinh la identity
     * @param parent - Node cha muon gan vao (mac dinh la node cua Pool)
     * @returns Ply_GameUnit duoc spawn
     */
    public spawn(poolType: PoolType, pos: Vec3, rot: Quat = new Quat(), parent: Node | null = null): Ply_GameUnit | null {
        const queue = this.dict.get(poolType); // Lay danh sach game unit tu pool
        let gameUnit: Ply_GameUnit | null = null; // Khai bao bien gameUnit de luu ket qua

        // Neu co game unit trong pool, lay mot cai ra va xoa khoi danh sach
        if (queue && queue.length > 0) {
            gameUnit = queue.shift()!; // queue.shift() lay phan tu dau tien va xoa khoi danh sach
        } else {
            // Neu khong co san trong pool, khoi tao mot cai moi
            const prefab = this.getPrefab(poolType);
            if (!prefab) return null;

            // Khoi tao mot node moi tu prefab va lay component Ply_GameUnit
            const unitNode = instantiate(prefab);
            unitNode.setParent(this.node);
            gameUnit = unitNode.getComponent(Ply_GameUnit);
        }

        if (gameUnit) {
            // Neu co chi dinh parent rieng (vd: de nhin thay bullet hole tren mot Node cu the) thi gan vao do
            gameUnit.node.setParent(parent ?? this.node, true);
            gameUnit.node.setWorldPosition(pos);
            gameUnit.node.setWorldRotation(rot);
            gameUnit.node.active = true;

            let activeList = this.activeDict.get(poolType);
            if (!activeList) {
                activeList = [];
                this.activeDict.set(poolType, activeList);
            }
            activeList.push(gameUnit);
        }

        return gameUnit;
    }

    /**
     * Tra game unit ve lai pool (despawn).
     * @param poolType - Loai doi tuong
     * @param gameUnit - Game unit can thu hoi
     */
    public despawn(poolType: PoolType, gameUnit: Ply_GameUnit) {
        if (!gameUnit || !gameUnit.isValid || !gameUnit.node || !gameUnit.node.isValid) return;

        // Xoa khoi danh sach active neu co
        const activeList = this.activeDict.get(poolType);
        if (activeList) {
            const idx = activeList.indexOf(gameUnit);
            if (idx !== -1) {
                activeList.splice(idx, 1);
            }
        }

        const queue = this.dict.get(poolType);
        // Tranh truong hop despawn 2 lan mot unit vao queue
        if (queue && queue.indexOf(gameUnit) !== -1) {
            return;
        }

        gameUnit.node.active = false;

        // Tra node ve lai Pool node de lan spawn tiep theo setPosition() hoat dong dung
        // (tranh truong hop node van la con cua parent cu, dan den toa do local bi sai)
        if (gameUnit.node.parent !== this.node) {
            gameUnit.node.setParent(this.node, false);
        }

        if (!queue) {
            this.dict.set(poolType, [gameUnit]);
        } else {
            queue.push(gameUnit);
        }
    }

    /**
     * Thu hoi tat ca game unit dang active ve lai pool.
     * Neu truyen poolType thi chi thu hoi cac unit cua loai do.
     */
    public despawnAll(poolType?: PoolType) {
        if (poolType !== undefined) {
            const activeList = this.activeDict.get(poolType);
            if (!activeList || activeList.length === 0) return;

            const list = [...activeList];
            for (let i = 0; i < list.length; i++) {
                const unit = list[i];
                if (unit && unit.isValid) {
                    this.despawn(poolType, unit);
                }
            }
            return;
        }

        this.activeDict.forEach((_, type) => {
            this.despawnAll(type);
        });
    }

    /**
     * Lay prefab tuong ung voi loai pool.
     */
    public getPrefab(poolType: PoolType): Prefab | null {
        for (let i = 0; i < this.poolAmounts.length; i++) {
            if (this.poolAmounts[i].type === poolType) {
                return this.poolAmounts[i].prefab;
            }
        }
        return null;
    }

    onDestroy() {
        super.onDestroy();
        this.dict.clear();
        this.activeDict.clear();
        if (Ply_Pool.Ins === this) {
            Ply_Pool.Ins = null;
        }
    }
}
