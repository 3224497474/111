
export default class Ht1tp {
	/**
	 * 单例
	 */
	private static _instance: Ht1tp;

	public static getInstance(): Ht1tp {
		if (!this._instance) {
			this._instance = new Ht1tp();
		}
		return this._instance;
	}

	/**
	 * post请求
	 * @param {string} url
	 * @param {object} params
	 * @param {function} callback
	 */
	ht1tpPost(url: string, params: any, callback: Function) {
		// cc.myGame.gameUi.onShowLockScreen();
		
	}


}