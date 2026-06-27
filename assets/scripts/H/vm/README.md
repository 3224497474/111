# HVMVirtualListPackage

这是基于现有 HVM 框架的数据驱动虚拟列表模块。

## 包含内容

```text
layout/HVirtualListLayoutBase.ts      纯布局数学基础类
layout/HVirtualGridLayout.ts          固定尺寸列表/网格布局
layout/index.ts                       layout 导出

components/HVMVirtualList.ts          VM 数据驱动虚拟列表组件
components/HVMVirtualListItem.ts      虚拟列表 item 基类
components/index.ts                   components 导出片段

docs/HVMVirtualList-Design.md         设计文档
docs/HVMVirtualList-Usage.md          使用文档
docs/HVMVirtualList-ExportPatch.md    导出修改说明

examples/                            背包列表示例
```

## 接入方式

把 `layout` 目录复制到：

```text
assets/scripts/H/vm/layout
```

把 `components/HVMVirtualList.ts` 和 `components/HVMVirtualListItem.ts` 复制到：

```text
assets/scripts/H/vm/components
```

然后根据 `docs/HVMVirtualList-ExportPatch.md` 修改导出。

## 核心设计

```text
H.vm / H.store
  -> HVMListPresenter
  -> HVMVirtualList
  -> HVMVirtualListItem
```

`HVMVirtualList` 只监听一个展示数组字段，例如 `bag.viewItems`。复杂的排序、筛选、选中状态、锁定状态都放在 Presenter 里生成展示数据。

## 重要约定

```text
content anchorX = 0
content anchorY = 1
item    anchorX = 0
item    anchorY = 1
```

不要给 content 挂 Layout。
