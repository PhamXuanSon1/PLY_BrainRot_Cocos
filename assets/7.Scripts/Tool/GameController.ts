import { _decorator, Component, Node } from "cc";
import playableHelper from "./h5-helper";
const { ccclass, property } = _decorator;

@ccclass("GameController")
export class GameController extends Component {

  public static instance: GameController | null = null;

  onLoad() {
    GameController.instance = this;
  }

  onDestroy() {
    if (GameController.instance === this) {
      GameController.instance = null;
    }
  }

  // <!--https://play.google.com/store/apps/details?id=com.abi.packingdom
  // -->
  // <!--https://apps.apple.com/us/app/packingdom/id6760441822
  // -->

  start() {
    playableHelper.gameStart();
    const androidUrl = "https://play.google.com/store/apps/details?id=com.brainrot.mini.challenge";
    const iosUrl = "";
    playableHelper.setStoreUrl(iosUrl, androidUrl); // this section only needs for Google and Unity channel
  }

  update(deltaTime: number) { }



  redirectToStore() {
    playableHelper.gameEnd();

    playableHelper.redirect();
  }
}

