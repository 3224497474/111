import { _decorator } from 'cc';

const { ccclass, property } = _decorator;

/**
 * Inspector 配置结构：
 * - bundleName: 远程 Bundle 名称
 * - prefabPaths: 该 Bundle 下需要预加载的 prefab 路径
 */
@ccclass('BundlePrefabConfig')
export class BundlePrefabConfig {
    @property
    bundleName: string = '';

    @property({ type: [String] })
    prefabPaths: string[] = [];
}
