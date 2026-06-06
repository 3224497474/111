import { _decorator } from 'cc';
import { resourceUtil } from '../mgr/resourceUtil';
import { UtilPub } from '../utils/UtilPub';
const { ccclass, property } = _decorator;

/**
 * @description 读取resoucres/json下的.json文件
 */
export default class tables {
	private static _instance: tables;

	public static ins(): tables {
		if (!this._instance) {
			this._instance = new tables();
		}
		return this._instance;
	}

	public tables: any = {};

	// 零散数据表
	public config: any = {};

	public async loadTable() {
		return new Promise<void>(resolve => {
			console.log("表格数据处理")
			resourceUtil.loadResDirWithBundle('json', "./", (err, assets) => {
				//表格数据处理
				console.log("table err----------", err)
				console.log("table data----------", assets.length)
				if (err) {
					console.log('加载json文件失败');

					return;
				}
				if (err) {
					console.error('加载bundle错误:', name, err)
					return;
				}
				for (let i = 0; i < assets.length; i++) {
					let asset = assets[i];

					//@ts-ignore
					this.tables[asset.name] = asset.json;
					console.log("xxxxx--------aasset:", asset.name)
					if (asset.name == "config_table") {
						for (let index = 0; index < this.tables[asset.name].length; index++) {
							let row = this.tables[asset.name][index];
							this.config[row.key] = row.value;
							//	UtilPub.log("config_table:",row.key,this.config[row.key])
						}
					}
				}
				resolve()
			})
		})
	}

	public getTable(name: string) {
		return this.tables[name];
	}
	public getTableValueByID(name: string, id: number) {
		let table = this.getTable(name);
		if (!table) return null;
		for (let i = 0; i < table.length; i++) {
			const t = table[i];
			if (t.id == id) {
				return JSON.parse(JSON.stringify(t));
			}
		}
		// UtilPub.error("---配表错误，无法找到ID---", name, id)
	}
	/**
	 * 获得最后一行
	 * @param name 
	 * @returns 
	 */
	public getTableLastOne(name: string) {
		let table = this.getTable(name);
		if (!table || table.length === 0) return null;
		return JSON.parse(JSON.stringify(table[table.length - 1]));
	}
	public getTableValueByKey(name: string, key: string, value: any) {
		let table = this.getTable(name);
		if (!table) return null;
		for (let i = 0; i < table.length; i++) {
			const t = table[i];
			if (t[key] == value) {
				return t;
			}
		}
	}

	public getTableValuesByType(tableName: string, colName: string, colVal: string | number) {
		let table = this.getTable(tableName);
		if (!table) return [];
		let res = []
		for (let i = 0; i < table.length; i++) {
			const row = table[i];
			if (row[colName] == colVal) {
				res.push(row)
			}
		}
		return res
	}

	public getTableValuesNumberByType(tableName: string, colName: string, colVal: string | number, colName2: string) {
		let table = this.getTable(tableName);
		if (!table) return 0;
		let res: any = []
		let num = 0
		for (let i = 0; i < table.length; i++) {
			const row = table[i];
			if (row[colName] == colVal && res[row[colName2]] == null) {
				num++
				res[row[colName2]] = 1
			}
		}
		return num
	}

	public getTableValuesByType2(tableName: string, colName: string, colVal: string, colName2: string, colVal2: string) {
		let table = this.getTable(tableName);
		if (!table) return [];
		let res = []
		for (let i = 0; i < table.length; i++) {
			const row = table[i];
			if (row[colName] == colVal && row[colName2] == colVal2) {
				res.push(row)
			}
		}
		return res
	}

	public getTableValuesByType2ByOne(tableName: string, colName: string, colVal: string, colName2: string, colVal2: string) {
		let table = this.getTable(tableName);
		if (!table) return null;
		let res = []
		for (let i = 0; i < table.length; i++) {
			const row = table[i];
			if (row[colName] == colVal && row[colName2] == colVal2) {
				res.push(row)
			}
		}
		if (res.length > 0)
			return res[0]
		return null
	}

	public getTableValuesByType3(tableName: string, colName: string, colVal: string, colName2: string, colVal2: string, colName3: string, colVal3: string) {
		let table = this.getTable(tableName);
		if (!table) return [];
		let res = []
		for (let i = 0; i < table.length; i++) {
			const row = table[i];
			if (row[colName] == colVal && row[colName2] == colVal2 && row[colName3] == colVal3) {
				res.push(row)
			}
		}
		return res
	}

	public getTableValueByLevel(name: string, id: number) {
		let table = this.getTable(name);
		if (!table) return null;
		for (let i = 0; i < table.length; i++) {
			const t = table[i];
			if (t.level == id) {
				return t;
			}
		}
	}

	public getTableMaxValueByLevel(name: string) {
		let level = 1;
		let tab = null;
		let table = this.getTable(name);
		if (!table) return null;
		for (let i = 0; i < table.length; i++) {
			const t = table[i];
			if (t.level > level) {
				level = t.level;
				tab = t;
			}
		}
		return tab
	}
}
