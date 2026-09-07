class H5Playable {
  private iosUrl: string = "";
  private androidUrl: string = "";

  redirect() {
    try {
      //@ts-ignore
      if (typeof redirectStore !== "undefined") {
        //@ts-ignore
        redirectStore();
        return;
      }
    } catch (e) {
      // Khi test local (file://) thi mraid.js khong load duoc -> mraid is not defined.
      // Tren mang quang cao that thi SDK se cung cap mraid, nhanh nay khong chay.
      console.warn("redirectStore failed, fallback to window.open:", e);
    }

    this.openStoreFallback();
  }

  private openStoreFallback() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const url = (isIOS ? this.iosUrl : this.androidUrl) || this.androidUrl || this.iosUrl;
    if (url) {
      window.open(url, "_blank");
    }
  }

  /**
   * Game start method for Mintegral channel.
   */
  gameStart() {
    //@ts-ignore
    if (typeof onGameReady !== "undefined") onGameReady();

    //@ts-ignore
    if (typeof startGame !== "undefined") startGame();
  }

  /**
   * Game end method when game is over, adapt for Mintegral channel.
   */
  gameEnd() {
    //@ts-ignore
    if (typeof onGameEnd !== "undefined") onGameEnd();
  }

  /**
   * Set store url for redirect store action when user tap on CTA button.
   * Needed channel: Unity, Google
   * @param iosUrl: string
   * @param androidUrl: string
   */
  setStoreUrl(iosUrl: string, androidUrl: string) {
    this.iosUrl = iosUrl;
    this.androidUrl = androidUrl;

    //@ts-ignore
    if (typeof setStoreUrl !== "undefined") setStoreUrl(iosUrl, androidUrl);
  }
}

const playableHelper = new H5Playable();
export default playableHelper;
