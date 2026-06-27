import { _decorator, Component, Node, find, isValid, Vec3, UIOpacity } from "cc";
import { UtilPub } from "../utils/UtilPub";
import BaseView from "./BaseView";
import { resourceUtil } from "./resourceUtil";
const { ccclass, property } = _decorator;

interface IPanel extends Component {
    show: Function;
    hide: Function;
    zIndex: number;
    dialogPath?: string;
}

@ccclass("uiManager")
export class uiManager {

    dictSharedPanel: { [path: string]: Node } = {}
    dictLoading: { [path: string]: boolean } = {};
    arrPopupDialog: {
        panelPath: string,
        scriptName?: string,
        param: any,
        isShow: boolean
    }[] = [];
    showTipsTime: number = 0
    panelPath: string = ""

    dialogList: string[] = []
    private static _instance: uiManager;

    static get instance() {
        if (this._instance) {
            return this._instance;
        }

        this._instance = new uiManager();
        return this._instance;
    }

    show() {

    }

    hide() {

    }

    close() {

    }

    getDialog(panelPath: string) {
        return this.dictSharedPanel[panelPath]
    }

    async loadDialog(panelPath: string) {
        return new Promise<void>(resolve => {
            let _panelPath = panelPath.split("|")[1]
            let idxSplit = _panelPath.lastIndexOf('/');
            let scriptName = _panelPath.slice(idxSplit + 1);
            resourceUtil.createUIWithBundle(panelPath, (err, node) => {
                this.dictLoading[panelPath] = false;
                if (err) {
                    console.error(err);
                    return;
                }
                // node.zIndex = 100;
                this.dictSharedPanel[panelPath] = node!;
                // node.parent = find("Canvas").getChildByName("panelRoot")
                let script = node!.getComponent(scriptName)! as IPanel;
                //node.setSiblingIndex(script.zIndex)
                script.dialogPath = panelPath
                // //Public.log("scriptName2----", script.dialogPath, script.zIndex, scriptName, this.dictSharedPanel, node.parent)
                node!.active = false
                resolve();
            })
        })
    }


    /**
     * 显示单例界面
     * @param {String} panelPath
     * @param {Array} args
     * @param {Function} cb 回调函数，创建完毕后回调
     * @param {Node} parent 父节点，默认是Canvas
     * @param {Node} active 默认为true
     */
    showDialog(panelPath: string, args?: any, cb?: Function, parent?: Node, active: boolean = true) {
        this.panelPath = panelPath
        if (this.dictLoading[panelPath]) {
            return;
        }

        let _panelPath = panelPath.split("|")[1]
        let idxSplit = _panelPath.lastIndexOf('/');
        let scriptName = _panelPath.slice(idxSplit + 1);

        if (!args) {
            args = [];
        }
        // UtilPub.log("---args------------------", args)
        if (this.dictSharedPanel.hasOwnProperty(panelPath)) {
            let panel = this.dictSharedPanel[panelPath];
            if (isValid(panel)) {
                // //Public.log("---parent------------------", parent)
                if (parent == undefined) {
                    // //Public.log("---parent------------------", find("Canvas"))
                    panel.parent = find("Canvas")
                } else {
                    panel.parent = parent
                }

                // panel.position = Public.MainCamera.node.position

                let script = panel.getComponent(scriptName) as IPanel;

                // if (script.show) {
                // //Public.log("scriptName-old2----", scriptName, script.show, args)
                // script.show.apply(script, args);
                script.show(args);
                // }
                //层级待定
                //对子节点的进行zIndx排序
                panel.setSiblingIndex(script.zIndex!)
                script.dialogPath = panelPath

                //设置顺序
                this.setOrder(panel, scriptName)

                // panel.position = new Vec3(Public.MainCamera.node.position.x, Public.MainCamera.node.position.y, 0)
                panel.active = true;

                cb && cb(script);

                return;
            }
        }

        this.dictLoading[panelPath] = true;
        resourceUtil.createUIWithBundle(panelPath, (err, node) => {
            //判断是否有可能在显示前已经被关掉了？
            let isCloseBeforeShow = false;
            if (!this.dictLoading[panelPath]) {
                //已经被关掉
                isCloseBeforeShow = true;
            }

            this.dictLoading[panelPath] = false;
            if (err) {
                console.error(err);
                return;
            }

            // node.zIndex = 100;

            this.dictSharedPanel[panelPath] = node!;
            let script = node!.getComponent(scriptName)! as IPanel;
            // Public.log("scriptName1----", node, script, scriptName, args)
            if (script.show) {
                // //Public.log("scriptName1111----", script, scriptName, args)
                // script.show.apply(script, args);
                script.show(args);
            }
            //TODO 层级控制待定
            //node.setSiblingIndex(script.zIndex)
            script.dialogPath = panelPath
            // //Public.log("scriptName2----", script.dialogPath, script.zIndex, scriptName, this.dictSharedPanel, node.parent)
            // //Public.log(node.parent.children)
            node && (node.active = active)
            // node.getChildByName("Root").getComponent(UIOpacity).opacity=1

            //设置顺序
            this.setOrder(node!, scriptName)

            cb && cb(script);

            //不要使用widget，会导致生成时位置移动失效！！！
            // node.setPosition(new Vec3(Public.MainCamera.node.position.x, Public.MainCamera.node.position.y, 0))
            // Public.log("----node info------", parent)

            // 直接执行不生效
            // setTimeout(()=>{
            //     // this.syncPos(node)
            //     node.setPosition(new Vec3(Public.MainCamera.node.position.x, Public.MainCamera.node.position.y, 0))
            // },50)

            if (isCloseBeforeShow) {
                //Public.log("如果在显示前又被关闭 closeDialog1-----", panelPath)
                //如果在显示前又被关闭，则直接触发关闭掉
                this.hideDialog(panelPath);
            }
        }, parent);
    }

    setOrder(panel: Node, scriptName: string) {
        // UtilPub.log("窗口检查1----", panel.parent)
        // let children = find("Canvas")!.children
        // let arr = []
        
        // for (let i = 0; i < children.length; i++) {
        //     // let script = children[i].getComponent(scriptName) as IPanel;
        //     if (children[i]) {
        //         arr.push(children[i])
        //     }
        // }
        // arr.sort((a, b) => {
        //     let as = a.getComponent(scriptName) as IPanel;
        //     let bs = b.getComponent(scriptName) as IPanel;
        //     let aval = 0
        //     let bval = 0
        //     if (as && as.zIndex != null) aval = as.zIndex
        //     if (bs && bs.zIndex != null) bval = bs.zIndex
        //     return bval - aval
        // })
        // // Public.log("窗口检查mid----", arr)
        // find("Canvas")!.removeAllChildren()
        // for (let i = 0; i < arr.length; i++) {
        //     arr[i] && find("Canvas")!.addChild(arr[i])
        // }
        // Public.log("窗口检查2----", panel.parent)
    }

    // syncPos(dialogNode){
    //     if(dialogNode==undefined) return
    //     if(Public.MainCamera.node.position.x!=dialogNode.position.x || Public.MainCamera.node.position.y!=dialogNode.position.y){
    //         dialogNode.setPosition(new Vec3(Public.MainCamera.node.position.x, Public.MainCamera.node.position.y, 0))
    //         return
    //     }else{
    //         setTimeout(()=>{ this.syncPos(dialogNode)},50)
    //     }
    // }


    /**
     * 隐藏单例界面
     * @param {String} panelPath
     * @param {fn} callback
     */
    hideDialog(panelPath: string, callback?: Function) {
        //Public.log("closeDialog-----", panelPath)
        if (this.dictSharedPanel.hasOwnProperty(panelPath)) {
            let panel = this.dictSharedPanel[panelPath];
            if (panel && isValid(panel)) {
                // let ani = panel.getComponent('animationUI');
                // if (ani) {
                //     ani.close(() => {
                //         panel.parent = null;
                //         if (callback && typeof callback === 'function') {
                //             callback();
                //         }
                //     });
                // } else {
                let _panelPath = panelPath.split("|")[1]
                let idxSplit = _panelPath.lastIndexOf('/');
                let scriptName = _panelPath.slice(idxSplit + 1);
                let script = panel!.getComponent(scriptName)! as IPanel;
                // //Public.log("scriptName1----", script, scriptName, args)
                if (script.hide) {
                    // //Public.log("scriptName1111----", script, scriptName, args)
                    // script.show.apply(script, args);
                    script.hide();
                }
                panel.active = false
                panel.parent = null;
                if (callback && typeof callback === 'function') {
                    callback();
                }
                // }
            } else if (callback && typeof callback === 'function') {
                callback();
            }
        }

        this.dictLoading[panelPath] = false;
    }

    pushShowDialog(panelPath: string, args?: any, cb?: Function, parent?: Node, active: boolean = true) {
        let callBack = (script: BaseView) => {
            cb && cb(script)
            this.dialogList.push(script.node.name)
        }

        if (this.dialogList.length > 0) {
            let scp = this.dialogList[this.dialogList.length - 1]
            let dialog = find("Canvas/" + scp)
            if (dialog) {
                dialog.active = false
            }
        }
        this.showDialog(panelPath, args, callBack, parent, active)
    }

    popHideDialog(panelPath: string, cb?: Function) {

        let callBack = (script: BaseView) => {
            cb && cb(script)
            if (this.dialogList.length > 0) {
                let scp = this.dialogList[this.dialogList.length - 1]
                let dialog = find("Canvas/" + scp)!
                if (dialog) {
                    dialog.active = true
                    dialog.getComponent(BaseView)!.updateInfo()
                }
            }
        }
        if (this.dialogList.length > 0) {
            this.dialogList.pop()
        }
        this.hideDialog(panelPath, callBack)
    }

    destroyDialog(panelPath: string) {
        if (this.dictSharedPanel.hasOwnProperty(panelPath)) {
            let panel = this.dictSharedPanel[panelPath];
            delete this.dictSharedPanel[panelPath]
            panel.destroy()
        }
    }

    /**
     * 将弹窗加入弹出窗队列
     * @param {string} panelPath
     * @param {string} scriptName
     * @param {*} param
     */
    pushToPopupSeq(panelPath: string, scriptName: string, param: any) {
        let popupDialog = {
            panelPath: panelPath,
            scriptName: scriptName,
            param: param,
            isShow: false
        };

        this.arrPopupDialog.push(popupDialog);

        this.checkPopupSeq();
    }

    /**
     * 将弹窗加入弹出窗队列
     * @param {number} index
     * @param {string} panelPath
     * @param {string} scriptName
     * @param {*} param
     */
    insertToPopupSeq(index: number, panelPath: string, param: any) {
        let popupDialog = {
            panelPath: panelPath,
            param: param,
            isShow: false
        };

        this.arrPopupDialog.splice(index, 0, popupDialog);
        //this.checkPopupSeq();
    }

    /**
     * 将弹窗从弹出窗队列中移除
     * @param {string} panelPath
     */
    shiftFromPopupSeq(panelPath: string) {
        this.hideDialog(panelPath, () => {
            if (this.arrPopupDialog[0] && this.arrPopupDialog[0].panelPath === panelPath) {
                this.arrPopupDialog.shift();
                this.checkPopupSeq();
            }
        })
    }

    /**
     * 检查当前是否需要弹窗
     */
    checkPopupSeq() {
        if (this.arrPopupDialog.length > 0) {
            let first = this.arrPopupDialog[0];

            if (!first.isShow) {
                this.showDialog(first.panelPath, first.param);
                this.arrPopupDialog[0].isShow = true;
            }
        }
    }


}
