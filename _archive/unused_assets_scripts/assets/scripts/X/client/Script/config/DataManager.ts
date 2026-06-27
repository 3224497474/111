
class DataManager{
    data: object  = {}

    public getTable(tableName:string) {
        // //Public.log("---------data---",tableName, this.data, this.data[tableName])
        //@ts-ignore
        return this.data[tableName];
    }

    public handleData (tableName:string, arr: string[]) {
        // 获取首行提示符
        let tips = arr[0].split(',');
        // 获取第二行字段类型
        let types = arr[1].split(',');
        // 获取第三行字段名字
        let names = arr[2].split(',');

        // 处理剩余数据
        let table: {[key: string]: object} = {};
        for (let i = 3; i < arr.length; i++) {
            let single = arr[i].split(/,/g);
            let obj = this.singleData(names, types, single, tableName, single[0]);
            let key = single[0];
            table[key] = obj;
        }

        // 加入表格
        //@ts-ignore
        this.data[tableName] = table;
        //Public.log("---------data---", this.data)
    }

    private singleData(names:string[], types:string[], single: string[], tableName:string, taK:string) {
        let obj = {};
        for (let i = 0; i < single.length; i++) {
            // 如果字段不存在则跳过
            if (!names[i]) {
                continue;
            }
            // 去除空格
            let key = names[i].replace(/\b\s*/g,"");
            let value = single[i].replace(/\b\s*/g,"");
            let typeName = types[i].replace(/\b\s*/g,"");

            // 区分字段类型
            if (typeName == 'string') {
                //@ts-ignore
                obj[key] = value;
            }else if (typeName == "number"){
                //@ts-ignore
                obj[key] = Number(value);
            }
        }
        return obj;
    }

    public GetTableByType(name : any, typename : any, type : any){
        let list = [];
        let table = this.getTable(name);
        for(let i in table){
            //@ts-ignore
            if(table[i][`${typename}`] == type){
                //@ts-ignore
                list.push(table[i]);
            }
        }
        return list;
    }

    public GetTableByID(name : string, id : Number){
        let tabeldata ;
        let table = this.getTable(name);
        for(let i in table){
            //@ts-ignore
            if(table[i].id == id){
                //@ts-ignore
                tabeldata = table[i];
                return tabeldata;
            }
        }
        return tabeldata;
    }
}

export default new DataManager();
