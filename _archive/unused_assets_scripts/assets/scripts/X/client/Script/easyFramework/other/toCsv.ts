import { _decorator, Component, Node, Prefab, instantiate, Game } from 'cc';
import { Const } from '../../config/Const';
import DataManager from '../../config/DataManager';
import { comm } from '../mgr/comm';
import { poolManager } from '../mgr/poolManager';
import { UtilPub } from '../utils/UtilPub';
const { ccclass, property } = _decorator;

@ccclass('toCsv')
export class toCsv extends comm {

    // @property(Prefab)
    // unitPrefabs: Prefab[] = [];

    onLoad(){
        
    }

    // public findUnit(name:string):Prefab | null{
    //     return resourceUtil.prefabs[name] 
    // }

    //**转换csv为等级数据 */
    public transformCsvToLevelData(level:number, grids:Node[][], parentNode:Node, objgrids:number[][], cb:Function){
        let tab = DataManager.getTable("level"+level)
     
        let keys = Object.keys(tab)
        //收集所有数据
        //同一行的右到左，大到小
        let rows:{[key: string]: any[]} = {} //重新整理
        for(let i=0; i<keys.length; i++){
            let key = keys[i]
            let row = tab[key]
            if(!rows.hasOwnProperty(row.row)){
                rows[row.row] = []
            }
            rows[row.row].push(row)
        }

        //对rows里面的每行进行倒序排序
       
        let rows2 = []
        for(let rowKey in rows){
            let r = rows[rowKey]
            r.sort((a,b)=>{
                return a.col-b.col
            })
            rows2.push(r)
        }
        
        let final = []
        for(let i=0; i<rows2.length; i++){
            for(let j=0; j<rows2[i].length; j++){
                final.push(rows2[i][j])
            }
        }

        //level 3 有bug
        UtilPub.log("-----自定义场景1---", final, level)
        //行要大道小
        let idx = 0 
        for(let i=0; i<final.length; i++){
            let row = final[i]
            UtilPub.log("------row---", row, i, final.length)
            if(row==undefined || row.name==undefined || row.ID==0){
                idx+=1
                if(idx>=final.length-1){
                    cb && cb()
                }
                continue
            } 
            if(row.name=="prerfab_stump"){
                row.name="prefab_stump"
            }

            //是否需要预先加载场景相关的，否则怪物会出现在障碍物里面
            //@ts-ignore
            let pName = Const.Prefabs[row.name]
            UtilPub.getPrefab(pName, (p:Prefab)=>{
                if(p){
                    UtilPub.log(row.name)
                    let node = poolManager.instance.getNode(p, parentNode)
                    // node.parent = parentNode
                    let rowIdx = row.row
                    let colIdx = row.col
                    if(objgrids[rowIdx]==null){
                        objgrids[rowIdx] = []
                    }
                    objgrids[rowIdx][colIdx]=1 //标记这一格放置了障碍物

                    node.worldPosition = grids[rowIdx][colIdx].worldPosition
                    node.setScale(row.ScaX, row.ScaY, row.ScaZ);
                    node.setRotationFromEuler(row.rotX, row.rotY, row.rotZ);
                    node.setWorldPosition(node.worldPosition.x + row.posX, node.worldPosition.y + row.posY, node.worldPosition.z + row.posZ);
                    // Public.log("------------data--", rowIdx, colIdx)
                    if(node.name.includes("prefab_water")){
                        grids[rowIdx][colIdx].active = false 
                    }
                    if(node.name == "prefab_box"){
                        poolManager.instance.putNode(node)
                    }
                }else{
                    UtilPub.log("---------warn---存在未解析的预制体--", row.name)
                }

                //确保回调都执行
                idx +=1 
                if(idx>=final.length-1){
                    cb && cb()
                }
            })
        }
        // Public.log("-----自定义场景2---", objgrids)
    }
    
    public transformLevelDataToCsv(node:Node):string {
        var data1 = '';
        var index = 1;
        var da = '索引,' + '节点名字,' + 'posX,' + 'posY,' + 'posZ,' + 'rotX,' + 'rotY,' + 'rotZ,' + 'ScaX,' + 'ScaY,' + 'ScaZ,' + 'row,'+ 'col,' + '\n' +
            'number,' + 'string,' + 'number,' + 'number,' + 'number,' + 'number,' + 'number,' + 'number,' + 'number,' + 'number,' + 'number,' + 'number,' + 'number,' + '\n' +
            'ID,' + 'name,' + 'posX,' + 'posY,' + 'posZ,' + 'rotX,' + 'rotY,' + 'rotZ,' + 'ScaX,' + 'ScaY,' + 'ScaZ,' + 'row,'+ 'col,' + '\n';
        data1 += da;

        for(let rowIdx=0; rowIdx<node.children.length; rowIdx++ ){
            let row = node.children[rowIdx]
            //解析行
            let cols = row.children
            for(let colIdx=0; colIdx<cols.length; colIdx++){
                let col = cols[colIdx]
                for(let idx=0; idx<col.children.length; idx++){
                    let option = col.children[idx]
                    if(option.name=="prefab_floor") continue
                    da = index + ',' + option.name + "," + option.position.x + "," + option.position.y + "," + option.position.z + "," + option.eulerAngles.x + "," + option.eulerAngles.y + "," + option.eulerAngles.z + "," +
                    option.scale.x + ',' + option.scale.y + "," + option.scale.z + "," + rowIdx + "," + colIdx  +  '\n';
                    data1 += da;
                    index++
                }
            }
        }
        return data1;
    }

}

