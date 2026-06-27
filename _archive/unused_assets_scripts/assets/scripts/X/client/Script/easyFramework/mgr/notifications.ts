
export class notifications {
	public static readonly _instance: notifications = new notifications();
	private _eventMap: any = {};

	/**
	 * 取消所有的事件
	 */
	public clear(){
		this._eventMap = {}
	}

	/**
	 * @description 事件注册
	 * @param {string} type
	 * @param callback
	 * @param target
	 */
	public on(type: string, callback: Function, target: Object) {
		if (!callback || !type) {
			console.error(`${type}事件注册失败...`);
			return null;
		}
		if (!this._eventMap[type]) {
			this._eventMap[type] = [];
		}
		// 以type为key
		this._eventMap[type].push({callback, target});
		// //Public.log('============================>注册事件',this._eventMap[type].length);
	}

	/**
	 * @description 注册事件目标的特定事件类型回调，回调会在第一时间被触发后删除自身。
	 * @param {string} type
	 * @param {Function} callback
	 * @param {Object} target
	 */
	public once(type: string, callback: Function, target: Object) {
		this.on(type, (parameters: any) => {
			this.off(type, target);
			callback.call(target, parameters);
		}, target);
	}

	/**
	 * @description 派发事件
	 * @param {string} type
	 * @param parameters
	 */
	public emit(type: string, ...parameters: any[]) {
		let eventList = this._eventMap[type];
		if (!eventList) {
			// console.error(`派发${type}失败...`);
			return;
		}
		for (let key in eventList) {
			if (eventList.hasOwnProperty(key)) {
				let element = eventList[key];
				if (element && element.target) {
					let a = element.callback.call(element.target, ...parameters);
					if(a){
						return a;
					}
					// Public.log('============================>派发事件：' + type + ',parameters:' + parameters);
				}
			}
		}
	}

	/**
	 * @description 注销事件
	 * @param type
	 * @param target
	 */
	public off(type: string, target: Object) {
		let eventList: Array<Object> = this._eventMap[type];
		if (!eventList) return;
		for (let key in eventList) {
			if (eventList.hasOwnProperty(key)) {
				let element: any = eventList[key];
				if (element && element.target === target) {
					eventList[key] = null!;
					eventList.splice(Number(key), 1);
					// //Public.log('============================>注销事件：' + type);
				}
			}
		}
		if (eventList.length === 0) {
			delete this._eventMap[type];
		}
	}

	/**
	 * @description 注销该对象的所有事件，（不推荐使用，在事件多的情况下O(n^2)是很消耗计算的）
	 * @param target
	 */
	public offTarget(target: Object) {
		for (let type in this._eventMap) {
			if (this._eventMap.hasOwnProperty(type)) {
				let eventList: Array<any> = this._eventMap[type];
				for (let index = 0; index < eventList.length; index++) {
					let obj: { callback: Function; target: Object } = eventList[index];
					// 找到对象
					if (obj && obj.target && obj.target === target) {
						eventList.splice(index, 1);
					}
				}
			}
			if (this._eventMap.hasOwnProperty(type) && this._eventMap[type].length === 0) {
				delete this._eventMap[type];
			}
		}
	}
}

export const Notifications = notifications._instance;
