import { _decorator, Component, Node, Camera, view, CameraComponent } from 'cc';
import { UtilPub } from '../easyFramework/utils/UtilPub';
import { Const } from './Const';
const { ccclass, property } = _decorator;

@ccclass('Camera3D')
export class Camera3D extends Component {
    onLoad() {
        Const.camera3D = this.node

        // //获得屏幕宽度
        let size = view.getVisibleSize();
        // let width = size.width
        // let diff = size.height - size.width 
        let cHeight = 3.5 
        let screenH = 1525 
        let cHeightReal = size.height/screenH * cHeight
        Const.cameraParam = cHeight/screenH
        let camera = this.node.getChildByName("Camera")!.getComponent(Camera)!
        if(camera!=null){
            camera.orthoHeight = cHeightReal
        }
        UtilPub.log("---------width height", size.width, size.height, cHeightReal)
    }
}

