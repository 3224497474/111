# Dialog 已读快进使用示例

本文说明 `DialogView` 的已读快进功能如何接入、如何绑定，以及当前实现的行为边界。

## 相关文件

- `assets/scripts/X/Dialog/DialogView.ts`
- `assets/scripts/X/Dialog/DialogSystem.ts`
- `assets/scripts/X/core/globalProgress/GlobalProgressionSystem.ts`

## 功能概述

当前快进逻辑基于：

- `GlobalProgressionSystem.instance.isDialogRead(dialogId)`
- `DialogView.toggleSkip()`

行为规则：

- 只有当前 `dialogId` 已读时，`Skip` 才会持续生效
- 遇到未读对话时，自动退出 `Skip`
- 遇到选项时，自动退出 `Skip`
- `Skip` 开启后，当前句会瞬时完成打字机，并在 `0.1s` 后自动推进

## Prefab 绑定

在对话 prefab 上，`DialogView` 需要正常绑定这些节点：

- `nameLabel`
- `contentLabel`
- `avatarSprite`
- `maskNode`
- `contentClickArea`
- `choiceContainer`
- `choiceButtonPrefab`
- `skipButton`

其中 `skipButton` 是这次新增的按钮属性，对应 `DialogView` 上的：

```ts
@property(Button)
skipButton: Button | null = null;
```

按钮点击事件绑定到：

```ts
DialogView.toggleSkip
```

## 最小使用示例

正常播放对话仍然使用：

```ts
DialogSystem.show('intro_1', () => {
    console.log('dialog finished');
});
```

如果玩家点击了 `Skip` 按钮，`DialogView` 内部会执行：

```ts
public toggleSkip(): void {
    this.isSkipping = !this.isSkipping;
    this.updateSkipButtonState();

    if (!this.isSkipping) {
        this.unschedule(this.advanceAfterSkip);
        return;
    }

    if (!this.canSkipCurrentDialog()) {
        this.isSkipping = false;
        this.updateSkipButtonState();
        return;
    }

    if (this._isTyping) {
        this.finishTypingImmediately();
        return;
    }

    if (!this._choiceActive) {
        this.scheduleOnce(this.advanceAfterSkip, this._skipAutoAdvanceDelay);
    }
}
```

## 已读判定示例

`DialogView` 当前按整个 `dialogId` 做已读判断：

```ts
private canSkipCurrentDialog(): boolean {
    return !!this._currentDialogId
        && GlobalProgressionSystem.instance.isDialogRead(this._currentDialogId);
}
```

这意味着：

- `intro_1` 这段对话只要被标记为已读，整个 `intro_1` 段内的句子都会允许快进
- 当前不是“逐句已读”，而是“逐段已读”

## 打字机与自动推进示例

每句开始时会判断是否允许快进：

```ts
const canSkipCurrentLine = this.isSkipping && this.canSkipCurrentDialog();
if (this.isSkipping && !canSkipCurrentLine) {
    this.isSkipping = false;
    this.updateSkipButtonState();
}

this.startTypewriter(line.text ?? '', () => {
    if (line.choices && line.choices.length > 0) {
        this.isSkipping = false;
        this.updateSkipButtonState();
        this.showChoices(line.choices);
        return;
    }

    if (this.isSkipping) {
        this.scheduleOnce(this.advanceAfterSkip, this._skipAutoAdvanceDelay);
        return;
    }
}, canSkipCurrentLine);
```

`canSkipCurrentLine === true` 时，本句直接瞬时显示：

```ts
private startTypewriter(text: string, onComplete?: () => void, instant = false) {
    this._fullText = text;
    this._shownLength = 0;
    this._isTyping = true;
    this._typewriterComplete = onComplete ?? null;

    this.unschedule(this.updateTypewriter);

    if (instant) {
        this.finishTypingImmediately();
        return;
    }

    this.schedule(this.updateTypewriter, this._normalTypewriterInterval);
}
```

## 选项中断示例

当出现选项时，快进会被强制关闭：

```ts
private showChoices(choices: DialogChoice[]) {
    this.isSkipping = false;
    this.updateSkipButtonState();
    this.unschedule(this.advanceAfterSkip);

    // 原有选项生成逻辑
}
```

这样可以避免玩家在分支点被自动跳过。

## 手动点击行为

当前设计是：

- 玩家手动点击屏幕时，不自动关闭 `Skip`
- 这样玩家可以一边手动点一边保持快进状态

对应代码注释：

```ts
// Design choice: manual taps do not cancel skip mode.
```

如果后续想改成“玩家手动点击即退出快进”，只需要在 `onClickNext()` 开头补：

```ts
this.isSkipping = false;
this.updateSkipButtonState();
```

## 接入检查清单

- 对话 prefab 已绑定 `skipButton`
- `skipButton` 点击事件已指向 `DialogView.toggleSkip`
- `DialogSystem.show(dialogId)` 仍是唯一打开入口
- `GlobalProgressionSystem` 已在游戏启动时 `load()`

## 当前实现注意点

当前 `DialogSystem.show(dialogId)` 会在打开对话时立即执行：

```ts
GlobalProgressionSystem.instance.markDialogRead(dialogId);
```

因此现在的“已读”语义更接近：

- 该段对话已经进入过播放流程

如果你后面想改成更严格的“完整看完才算已读”，建议把 `markDialogRead(dialogId)` 从 `DialogSystem.show()` 移到对话真正结束的位置。
