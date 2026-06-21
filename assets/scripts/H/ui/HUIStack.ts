/**
 * HUIStack 只记录页面和弹窗的打开顺序，不直接操作节点。
 * 返回键、关闭栈顶弹窗、排查当前 UI 历史时都通过这里拿顺序。
 */
export class HUIStack {
    private readonly pageStack: string[] = [];
    private readonly dialogStack: string[] = [];

    // 同一个页面重新入栈前先移除旧位置，保证栈里不会重复出现同一个 id。
    public pushPage(id: string): void {
        this.remove(id);
        this.pageStack.push(id);
    }

    public pushDialog(id: string): void {
        this.remove(id);
        this.dialogStack.push(id);
    }

    // 不传 id 表示弹出栈顶；传 id 表示从栈中移除指定 UI。
    public popPage(id?: string): string | null {
        return this.popFromStack(this.pageStack, id);
    }

    public popDialog(id?: string): string | null {
        return this.popFromStack(this.dialogStack, id);
    }

    public peekPage(): string | null {
        return this.pageStack.length > 0 ? this.pageStack[this.pageStack.length - 1] : null;
    }

    public peekDialog(): string | null {
        return this.dialogStack.length > 0 ? this.dialogStack[this.dialogStack.length - 1] : null;
    }

    public getPageStack(): readonly string[] {
        return this.pageStack;
    }

    public getDialogStack(): readonly string[] {
        return this.dialogStack;
    }

    public remove(id: string): void {
        this.removeFromStack(this.pageStack, id);
        this.removeFromStack(this.dialogStack, id);
    }

    // 只清理栈记录，节点销毁由 HUIFacade.close/remove 负责。
    public clear(): void {
        this.pageStack.length = 0;
        this.dialogStack.length = 0;
    }

    private popFromStack(stack: string[], id?: string): string | null {
        if (!id) {
            return stack.pop() ?? null;
        }

        const index = stack.lastIndexOf(id);
        if (index < 0) {
            return null;
        }

        stack.splice(index, 1);
        return id;
    }

    private removeFromStack(stack: string[], id: string): void {
        const index = stack.lastIndexOf(id);
        if (index >= 0) {
            stack.splice(index, 1);
        }
    }
}
