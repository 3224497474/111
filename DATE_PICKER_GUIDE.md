# 日期选择器（DateTimePicker）使用说明

## 概述
这是一个月份和日期的竖向滑动选择器，支持独立选择月份（1-12）和日期（1-31），具有回调机制。

## 已创建的文件
- `assets/scripts/ScrollSelector.ts` - 滑动选择器基础组件
- `assets/scripts/DateTimePicker.ts` - 日期选择器主组件

## 在场景中集成步骤

### 1. 创建UI结构
在 `userfirstinput.scene` 的 Canvas 下创建如下节点结构：

```
Canvas
├── DateTimePickerPanel (Node)
│   ├── Background (Sprite - 半透明背景)
│   ├── Container (Node - 选择器容器)
│   │   ├── Title (Label)
│   │   ├── SelectorsContainer (Node)
│   │   │   ├── MonthSelector (ScrollView)
│   │   │   │   └── Content (Node)
│   │   │   │       └── ItemPrefab (Label - 月份项目模板)
│   │   │   ├── DaySelector (ScrollView)
│   │   │   │   └── Content (Node)
│   │   │   │       └── ItemPrefab (Label - 日期项目模板)
│   │   ├── ConfirmButton (Button)
│   │   └── CancelButton (Button)
```

### 2. 配置 ScrollView（月份选择器）
**MonthSelector 节点：**
- 添加 `ScrollView` 组件
- `Content` 设置高度为 250（50高度 × 5 项）
- 只启用竖向滚动

**ItemPrefab 配置：**
- 创建一个包含 Label 的 Prefab
- Label 样式：字体大小20，颜色白色，文字居中
- 节点高度：50

### 3. 配置 ScrollView（日期选择器）
**DaySelector 节点：**
- 配置同 MonthSelector
- `Content` 高度也是 250

### 4. 添加脚本组件

**在 DateTimePickerPanel 节点上添加 DateTimePicker 脚本：**
- `monthSelectorNode`: 指向 MonthSelector 节点
- `daySelectorNode`: 指向 DaySelector 节点
- `confirmButton`: 指向确认按钮
- `cancelButton`: 指向取消按钮
- `titleLabel`: 指向标题

**在 MonthSelector 节点上添加 ScrollSelector 脚本：**
- `itemPrefab`: 月份 Item Prefab
- `scrollView`: MonthSelector 的 ScrollView 组件
- `itemHeight`: 50
- `visibleCount`: 5

**在 DaySelector 节点上添加 ScrollSelector 脚本：**
- 配置同上

### 5. 在代码中使用

```typescript
// 获取 DateTimePicker 组件
const picker = this.node.getComponent(DateTimePicker);

// 打开选择器
picker.open((result) => {
    if (result) {
        console.log(`选择的日期: ${result.month} 月 ${result.day} 日`);
        console.log(`显示文本: ${result.monthStr} ${result.dayStr}`);
        // 处理选择结果
    } else {
        console.log('取消选择');
    }
}, 3, 15); // 可选：初始月份3，初始日期15

// 获取当前选择而不打开选择器
const current = picker.getCurrentSelection();
console.log(current); // { month: 3, day: 15, monthStr: "03 月", dayStr: "15 日" }

// 关闭选择器
picker.close();
```

## API 参考

### DateTimePicker 类

#### 方法
- `open(callback, initialMonth?, initialDay?)` - 打开选择器
  - callback: 回调函数
  - initialMonth: 初始月份(1-12)
  - initialDay: 初始日期(1-31)
  
- `close()` - 关闭选择器

- `getCurrentSelection()` - 获取当前选择，返回 DateTimePickerResult 对象

#### 回调结果格式
```typescript
interface DateTimePickerResult {
    month: number;      // 1-12
    day: number;        // 1-31
    monthStr: string;   // "03 月" 格式
    dayStr: string;     // "15 日" 格式
}
```

### ScrollSelector 类

#### 方法
- `setData(data, selectedIndex?)` - 设置数据
  - data: 字符串数组
  - selectedIndex: 选中的索引

- `getSelectedValue()` - 获取选中的值

- `getSelectedIndex()` - 获取选中的索引

## 样式定制建议

### 颜色方案
- 背景：半透明黑色 (0,0,0,180)
- 文字：白色 (255,255,255,255)
- 选中项：浅蓝色高亮 (173,216,230,255)

### 尺寸建议
- Panel 宽度：300-400
- Panel 高度：400-500
- 选择器高度：250
- 项目高度：50
- 按钮高度：50

## 功能特性
✓ 独立的月份和日期滑动选择
✓ 类似iOS风格的滚轮效果
✓ 自动对齐到最近项目
✓ 选中项自动高亮放大
✓ 回调机制处理选择结果
✓ 取消和确认功能
✓ 初始值设置支持
