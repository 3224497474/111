// 顺序不敏感时使用 O(1) 删除。
// 通过把末尾元素换到 index，再 pop 末尾，避免 splice 带来的搬移成本。
export function fastRemove<T>(array: T[], index: number): boolean {
    if (index < 0 || index >= array.length) {
        return false;
    }

    const lastIndex = array.length - 1;
    if (index !== lastIndex) {
        array[index] = array[lastIndex];
    }

    array.pop();
    return true;
}
