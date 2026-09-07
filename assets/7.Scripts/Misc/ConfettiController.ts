import { _decorator, Component, ParticleSystem2D } from 'cc';
const { ccclass } = _decorator;

@ccclass('ConfettiController')
export class ConfettiController extends Component {
    onEnable() {
        this.playParticles();
    }

    public playParticles() {
        const particles = this.node.getComponentsInChildren(ParticleSystem2D);
        particles.forEach((pt) => {
            pt.resetSystem();
        });
    }

    public stopParticles() {
        const particles = this.node.getComponentsInChildren(ParticleSystem2D);
        particles.forEach((pt) => {
            pt.stopSystem();
        });
    }
}
