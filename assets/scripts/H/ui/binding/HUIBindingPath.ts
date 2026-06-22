import { Node } from 'cc';

/**
 * HUIBindingPath 只处理“路径”相关的小工具。
 *
 * 说明：
 * - Store 字段路径统一使用点路径，例如 profile.nickName。
 * - Node 路径统一使用斜杠路径，例如 top/coinLabel。
 * - 这些工具保持无状态，方便排查和单独复用。
 */
export class HUIBindingPath {
    /**
     * 从对象中读取点路径字段。
     *
     * @param data 类型 any，作用是被读取的数据对象。
     * @param path 类型 string，作用是点路径字段，例如 coin 或 profile.nickName。
     * @param defaultValue 类型 T，作用是字段不存在时返回的默认值。
     * @returns 类型 T，返回读取到的字段值或默认值。
     */
    public static read<T = unknown>(data: any, path: string, defaultValue?: T): T {
        const normalizedPath = this.normalizeStorePath(path);
        if (normalizedPath === '*') {
            return (data === undefined ? defaultValue : data) as T;
        }

        const value = normalizedPath.split('.').reduce((current, key) => {
            return current === undefined || current === null ? undefined : current[key];
        }, data);
        return (value === undefined ? defaultValue : value) as T;
    }

    /**
     * 判断 Store 变化路径是否命中某个绑定路径。
     *
     * @param changedPaths 类型 string[]，作用是 Store 本次变化的字段路径列表。
     * @param watchPath 类型 string，作用是绑定关心的字段路径。
     * @param includeChildren 类型 boolean，作用是是否把父子路径都视为命中。
     * @returns 类型 boolean，true 表示命中，需要刷新绑定。
     */
    public static includes(changedPaths: string[], watchPath: string, includeChildren = true): boolean {
        const targetPath = this.normalizeStorePath(watchPath);
        return changedPaths.some((rawPath) => {
            const changedPath = this.normalizeStorePath(rawPath);
            if (changedPath === '*' || targetPath === '*') {
                return true;
            }
            if (changedPath === targetPath) {
                return true;
            }
            if (!includeChildren) {
                return false;
            }

            return changedPath.startsWith(`${targetPath}.`)
                || targetPath.startsWith(`${changedPath}.`);
        });
    }

    /**
     * 解析绑定目标节点。
     *
     * @param root 类型 Node，作用是当前 UI 根节点。
     * @param directNode 类型 Node | null | undefined，作用是配置中直接传入的节点。
     * @param nodePath 类型 string | undefined，作用是斜杠路径查找。
     * @param nodeName 类型 string | undefined，作用是递归名称查找。
     * @returns 类型 Node | null，找不到时返回 null。
     */
    public static resolveNode(
        root: Node,
        directNode?: Node | null,
        nodePath?: string,
        nodeName?: string,
    ): Node | null {
        if (directNode) {
            return directNode;
        }

        if (nodePath) {
            const byPath = this.findByPath(root, nodePath);
            if (byPath) {
                return byPath;
            }
        }

        if (nodeName) {
            return this.findByName(root, nodeName);
        }

        return null;
    }

    /**
     * 按斜杠路径查找子节点。
     *
     * @param root 类型 Node，作用是查找根节点。
     * @param path 类型 string，作用是斜杠路径，例如 top/coinLabel。
     * @returns 类型 Node | null，找不到时返回 null。
     */
    public static findByPath(root: Node, path: string): Node | null {
        const parts = String(path || '')
            .split('/')
            .map((part) => part.trim())
            .filter((part) => !!part);
        if (parts.length <= 0) {
            return root;
        }

        let current: Node | null = root;
        for (const part of parts) {
            current = current?.getChildByName(part) || null;
            if (!current) {
                return null;
            }
        }

        return current;
    }

    /**
     * 按节点名递归查找。
     *
     * @param root 类型 Node，作用是查找根节点。
     * @param name 类型 string，作用是目标节点名。
     * @returns 类型 Node | null，找不到时返回 null。
     */
    public static findByName(root: Node, name: string): Node | null {
        const targetName = String(name || '').trim();
        if (!targetName) {
            return null;
        }
        if (root.name === targetName) {
            return root;
        }

        for (const child of root.children) {
            const found = this.findByName(child, targetName);
            if (found) {
                return found;
            }
        }

        return null;
    }

    /**
     * 规范化 Store 点路径。
     *
     * @param path 类型 string，作用是原始路径。
     * @returns 类型 string，空路径统一返回 *。
     */
    public static normalizeStorePath(path: string): string {
        const normalized = String(path || '*').trim();
        return normalized || '*';
    }
}
