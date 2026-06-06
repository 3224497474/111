import { _decorator, Component, Node, Camera, view } from 'cc';
import { UtilPub } from '../easyFramework/utils/UtilPub';
import { Const } from './Const';
const { ccclass, property } = _decorator;

@ccclass('CameraScene')
export class CameraScene extends Component {
    onLoad() {
        
        // Const.CameraScene = this.node

        // // //获得屏幕宽度
        // let size = view.getVisibleSize();
        // // let width = size.width
        // // let diff = size.height - size.width 
        // let cFov = 42
        // let screenH = 1525 
        // let cFovReal = size.height/screenH * cFov
        // let camera = this.node.getChildByName("Camera90")!.getComponent(Camera)!
        // if(camera!=null){
        //     camera.fov = cFovReal
        // }
        // Public.log("-$$$$$$$$$$$--------width height", size.width, size.height, cFovReal)
    }
}

