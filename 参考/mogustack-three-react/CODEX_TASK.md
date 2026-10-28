# Codex 任务书：将 React Three.js 3D M 接入 MOGUSTACK Hero 右侧

## 任务目标

现有项目是 React 项目（如是 Next.js App Router，请在使用 WebGL 的组件顶端添加 `'use client'`，并在需要时关闭 SSR 动态导入）。**严格只修改主页 Hero 原红框内的右侧视觉，不得重做全页。**

## 输入资源

- `src/components/MoguHero3D.tsx`：可复用组件
- `src/App.tsx`、`src/styles/demo.css`：只用于独立预览，**禁止直接覆盖现有项目的同名文件**

## 操作步骤

1. 浏览现有 React 项目的首页 Hero JSX 和相关 CSS，找到右侧 WEB / APP / AI 三张卡片的容器。
2. 安装 `three` 与 `@types/three`；不要在现有项目中另装 Vue。
3. 复制 `MoguHero3D.tsx` 至现有组件目录。
4. 用 `<MoguHero3D accent="#D4FF56" />` 替换原右侧卡片内部结构，并确保右侧容器有非零高度。
5. 保留导航、左侧全部中文文案、CTA、黑色背景斜线、底部弧线、向下探索组件、响应式网格。
6. 确保 `canvas` 透明且没有覆盖导航或按钮的点击区域。
7. 运行类型检查、生产构建、桌面及移动端检查。

## 验收标准

- 右侧主视觉为一个立体 M、低对比细轨道和绿色节点，无花哨光效。
- 左侧标题/导航/CTA 位置不变；底部曲线及上下衔接不变。
- 鼠标移动时仅发生轻微视差，静止时慢速浮动。
- 隐藏页面与离屏时暂停帧循环；prefers-reduced-motion 下静止。
- WebGL 不可用时有静态 SVG，UI 不出现空白。
- React StrictMode 下 mount/unmount 不留下 WebGL 上下文或监听器。
- TS 检查与生产构建无错误。

## 限制

不要改为 Vue；不要自动替换整个 Hero，不得新增虚构业务数据、代码编辑器、手机、电脑、流程卡片、辉光粒子、后处理 Bloom 或 3D 文件依赖。
