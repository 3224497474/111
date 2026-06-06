# 对话系统 — 预制体 & 代码接入流程

---

## 一、创建 DialogView Prefab

### 1. 节点结构

```
DialogView (Node)
├── Mask (Node)                  ← 全屏透明遮罩，接收点击推进
└── Panel (Node)                 ← 对话面板主体
    ├── Avatar (Sprite)          ← 角色头像
    ├── NameLabel (Label)        ← 角色名称
    ├── ContentArea (Node)       ← 点击区域，接收点击推进
    │   └── ContentLabel (Label) ← 对话内容（开启 useRichText）
    └── ChoiceContainer (Node)   ← 选项按钮容器（Layout 组件）
```

### 2. 节点配置

| 节点 | 组件 | 关键设置 |
|------|------|----------|
| DialogView | `DialogView` 脚本 | — |
| Mask | `UITransform` | 宽高撑满屏幕；Color 透明度 0 |
| Avatar | `Sprite` | 按需设置尺寸 |
| NameLabel | `Label` | 字体/颜色自定 |
| ContentLabel | `Label` | **useRichText = true** |
| ChoiceContainer | `Layout` | Type: Vertical，间距自定 |

### 3. 绑定脚本属性

在 DialogView 组件 Inspector 中拖入：

- `nameLabel` ← NameLabel 节点
- `contentLabel` ← ContentLabel 节点
- `avatarSprite` ← Avatar 节点
- `maskNode` ← Mask 节点
- `contentClickArea` ← ContentArea 节点
- `choiceContainer` ← ChoiceContainer 节点
- `choiceButtonPrefab` ← 选项按钮 Prefab（见下方第二步）

### 4. 保存 Prefab

对话面板属于游戏内 UI，放入远程分包：

```
assets/home-remote/prefab/DialogView.prefab
```

加载时使用 bundle 名 `home-remote`：

```ts
// DialogSystem.ts 默认 panelPath 改为：
panelPath: 'home-remote|prefab/DialogView',
```

> 如果项目有专门的 UI 分包（如 `ui-remote`），放对应目录即可，格式统一为 `bundleName|prefab/xxx`。

---

## 二、创建选项按钮 Prefab（ChoiceButton）

### 节点结构

```
ChoiceButton (Node)
└── Label (Label)   ← 显示选项文字
```

### 配置

- 根节点加 `Button` 组件
- Label 居中对齐
- 保存为 `assets/resources/prefab/ui/ChoiceButton.prefab`
- 将此 Prefab 拖入 DialogView 的 `choiceButtonPrefab` 属性

---

## 三、配置对话数据

在 `DialogConfig.ts` 的 `_dialogs` 中添加，或通过 JSON 外部加载：

```ts
// 线性对话
DialogConfig.registerDialog({
    id: 'scene_1',
    locale: 'zh',
    lines: [
        { name: '主角', text: '你好！', avatarPath: 'avatar/hero' },
        { name: 'NPC',  text: '欢迎来到这里。', avatarPath: 'avatar/npc' },
    ],
});

// 带分支的对话
DialogConfig.registerDialog({
    id: 'scene_2',
    locale: 'zh',
    lines: [
        {
            name: 'NPC',
            text: '你要接受任务吗？',
            choices: [
                { text: '接受', targetDialogId: 'scene_2_accept' },
                { text: '拒绝', targetDialogId: 'scene_2_reject' },
            ],
        },
    ],
});
```

---

## 四、触发对话

在任意脚本中：

```ts
import { DialogSystem } from '../Dialog/DialogSystem';

// 基础用法
DialogSystem.show('scene_1', () => {
    console.log('对话结束');
});

// 带参数（文本中用 {{playerName}} 占位）
DialogSystem.show('scene_1', () => {}, {
    params: { playerName: '小明' },
    autoPlay: false,
});
```

---

## 五、语言切换

在设置界面调用一次，全局生效：

```ts
import { LocaleManager } from '../client/Script/mgr/LocaleManager';

LocaleManager.setLocale('en'); // 切换为英文
LocaleManager.setLocale('zh'); // 切换为中文
```

`DialogConfig.getDialog()` 和 `localText` 会自动读取当前语言。

---

## 六、外部 JSON 加载（热更新）

```ts
// 从 bundle 内 JSON 资源加载
DialogConfig.loadFromJson('resources|dialog/chapter1', (ok) => {
    if (ok) DialogSystem.show('chapter1_intro');
});

// 从远端 URL 加载
DialogConfig.loadFromRemote('https://your-cdn.com/dialog.json', (ok) => {
    if (ok) DialogSystem.show('chapter1_intro');
});
```

JSON 格式：
```json
{
    "dialogs": [
        {
            "id": "chapter1_intro",
            "locale": "zh",
            "lines": [
                { "name": "主角", "text": "剧情开始了。" }
            ]
        }
    ]
}
```
