import { _decorator, Component } from 'cc';
const { ccclass } = _decorator;

/**
 * Lop Singleton co ban cho cac component trong Cocos Creator.
 * Ke thua lop nay de tao cac singleton manager.
 * 
 * Cach dung: class MyManager extends Ply_Singleton { ... }
 * Truy cap qua: MyManager.Ins
 * 
 * Luu y: TypeScript khong ho tro generic static member giong C#,
 * nen moi subclass can tu gan Ins trong onLoad cua chinh me.
 */
@ccclass('Ply_Singleton')
export class Ply_Singleton extends Component {

    // Dung chinh constructor lam key thay vi constructor.name:
    // khi build (release) ten class bi minify thanh cung mot ky tu ngan,
    // khien moi subclass bi coi la trung nhau va bi destroy nham.
    private static _instances: Map<Function, Ply_Singleton> = new Map();

    /**
     * Ghi de phuong thuc nay trong subclass va goi super.onLoad().
     * Cac subclass nen tu gan gian tri cho bien static Ins cua minh.
     */
    onLoad() {
        const key = this.constructor as Function;
        const existed = Ply_Singleton._instances.get(key);
        if (existed && existed !== this && existed.isValid) {
            this.node.destroy();
            return;
        }
        Ply_Singleton._instances.set(key, this);
    }

    onDestroy() {
        const key = this.constructor as Function;
        if (Ply_Singleton._instances.get(key) === this) {
            Ply_Singleton._instances.delete(key);
        }
    }
}
