import { CCInteger, Node, Prefab, _decorator } from "cc";
import { PoolMember } from "./PoolMember";

const { ccclass, property } = _decorator;

// Tach ra file rieng de PoolControl khong phai import nguoc lai PoolManager
// (circular dependency lam mot trong hai module bi undefined khi build).
// Ten ccclass phai khac 'PoolAmount' cua Ply_Pool.ts, neu trung ten thi
// scene se deserialize nham class.
@ccclass('PoolManagerAmount')
export class PoolAmount {
  @property(Node)
  public root: Node = null;

  @property(Prefab)
  public prefab: PoolMember = null;

  @property(CCInteger)
  public amount: number = 0;
}
