import { _decorator, Component, game, Node, PhysicsSystem, Pool} from 'cc';
import type { UI } from './UI';
import SoundManager, { SoundType, sm, setSm } from './SoundManager';
import { MainCamera } from './MainCamera';
import { GameController } from '../Tool/GameController';
import { PoolManager } from '../Pool/PoolManager';
import { PoolMember } from '../Pool/PoolMember';
const { ccclass, property, executeInEditMode } = _decorator;

@ccclass('World')
@executeInEditMode(true)
export class World extends Component {

    static instance: World = null!;
    static get ins() {
        if (!this.instance) {
            this.instance = new World();
        }
        return this.instance;
    }
    @property('UI')
    ui: UI = null!;
    
    @property(GameController)
    openStore: GameController = null; 

    @property(PoolManager)
    poolManager: PoolManager = null; 

    @property(MainCamera)
    camera: MainCamera = null; 

    @property(SoundManager)
    soundmanager: SoundManager = null; 

    despawn(node: Node) {
        this.poolManager.despawn(node.getComponent(PoolMember));
    }
    
    onLoad() {
        World.instance = this;
        if (this.soundmanager && !sm) {
            setSm(this.soundmanager);
        }
    }  

    start() {
        // PhysicsSystem.instance.maxSubSteps = 1;
        // game.frameRate = 60;
    }

    update(deltaTime: number) {  
    }
}


