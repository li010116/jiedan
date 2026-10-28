# Codex 实施任务：MOGUSTACK 右侧 3D 视觉替换

## 目标

将当前网站 Hero 右侧的白色立体 M（以及周围圆形轨道/绿色小方块）替换为用户第二张参考图中的 3D 玫瑰铜色连续丝带 + 独立铜球。真实 Three.js 渲染，支持轻微互动。

## 源码

直接使用 `src/components/MoguCopperRibbon.tsx`。如要无 WebGL 的图片兜底，把 `public/ribbon-fallback.webp` 拷贝到项目 public 目录。

## 不可修改

- `MOGUSTACK.` 导航、服务能力 / 精选作品 / 合作流程、联系按钮；
- 左侧「让你的想法，真正上线。」以及副标题和 CTA；
- 黑色斜线背景；
- 页面底部圆润凹槽、EXPLORE MORE 探索按钮；
- Hero 高度、容器网格与响应式机制（除为右侧适配而做的最小变动）。

## 任务步骤

1. 在现有 React/TypeScript 项目安装 `three` 和 `@types/three`（若缺少）。
2. 将组件移入 `src/components/MoguCopperRibbon.tsx`。
3. 在原 Hero 右侧容器中删除旧的 M Three.js canvas / canvas 生成逻辑，替换为 `<MoguCopperRibbon autoMotion mouseParallax />`。
4. 保持右侧容器原宽度和约 `450px` 高度；组件本身是 100% 宽高、透明背景。
5. 若使用 Next.js App Router，组件自带 `'use client'`；如需进一步优化可动态导入并设 `ssr: false`。
6. 删除原红框调试 border，不能显示新的红框。
7. 确保没有额外黑色矩形背景；Three.js canvas alpha 透明，原有斜线背景必须透出。
8. 验证：桌面鼠标轻微旋转 / 球体漂浮；移动端无裁剪；Safari/Chrome; 减少动态效果设置；卸载后无资源泄漏。

## 视觉验收

- 只有一条连续、柔和起伏的**铜色丝带**和一个右下方**独立球体**。
- **禁止**退回字母 M、霓虹玻璃卡、笔记本/手机、数据大屏、轨道圈/光环、粒子雨、彩色渐变、装饰文字。
- 金属是低饱和玫瑰铜/香槟铜；不出现原白色 M 与荧光绿块。
- 真实 3D 曲面着色（不是一个图片贴片）。
- 左侧以及整页其它视觉不改变。
