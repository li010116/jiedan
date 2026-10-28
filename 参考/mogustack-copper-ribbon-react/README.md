# MOGUSTACK — Copper Ribbon Hero / React + Three.js

> 根据你第二张参考图实现：一条连续起伏的玫瑰铜色金属丝带，右侧一颗独立的铜色球。**取代旧的白色 M**。只负责原 Hero 的右侧视觉，不重新设计其它模块。

## 文件

- `src/components/MoguCopperRibbon.tsx` — 唯一需要迁入你现有 React 项目的组件，无 CSS 依赖。
- `public/ribbon-fallback.webp` — 取自你提供的透明参考图，用于 WebGL 不可用时兜底（可选）。
- `src/App.tsx` / `src/styles.css` — 独立演示页面，模拟你当前网站布局；不必复制到现有项目。
- `CODEX_TASK.md` — 在原网站中替换的精确实施要求。

## 本地运行

```bash
npm install
npm run dev
```

## 接入现有 React 网站（推荐）

1. 安装 `three`，若使用 TS 再安装类型声明：

```bash
npm i three
npm i -D @types/three
```

2. 将 `src/components/MoguCopperRibbon.tsx` 复制到你的 `src/components/`。
3. 替换旧白色 M 组件：

```tsx
import MoguCopperRibbon from '@/components/MoguCopperRibbon'

<div className="hero-visual">
  <MoguCopperRibbon autoMotion mouseParallax />
</div>
```

```css
.hero-visual {
  position: relative;
  width: 100%;
  height: 450px;
  min-width: 0;
}
```

如想在 WebGL 异常时显示**与你的参考图完全相同的剪裁静态图**，再把 `public/ribbon-fallback.webp` 复制到网站的 public 目录，然后加 `fallbackSrc="/ribbon-fallback.webp"`。

## 视觉调参

- 弧度：修改 `PATH_POINTS`（连续 Catmull-Rom 控制点）。
- 丝带宽度：修改 `createRibbonGeometry()` 内的 `fullWidth`。
- 铜色梯度：修改 `COPPER_STOPS`。
- 金属明暗：调整 `ribbonMaterial` 中 `metalness` / `roughness`。
- 球位置与尺寸：修改 `sphere.position.set()`、`SphereGeometry(0.44, ...)`。
- 动画速度幅度：调整 `draw()` 中的三角函数系数。动画不会无限快速旋转。
- `maxPixelRatio={1.75}` 可降低高 DPI GPU 负担。

## 交互/性能

- 轻微 Y/X 轴跟随鼠标的 3D 视差和丝带轻微悬浮。
- 球单独以不同相位缓慢漂浮。
- 透明 WebGL 画布叠加原网站斜线背景。
- 限制像素比，支持 ResizeObserver 自适应。
- 非可见区域/切出标签页暂停渲染。
- 系统设置减少动态效果时停止自动动画。
- 组件卸载时释放 geometry、material、renderer、PMREM 资源。
- 无 WebGL 时显示静态 fallback。

## 说明

这是**根据参考图曲线用 Three.js 程序化重建的 3D 几何体**，不是把参考图片贴到一个平面上。参考图的准确高光与轮廓依赖原始 3D 源文件，程序化版本可做高度接近但不保证逐像素一致。

构建依赖因环境 DNS 无法访问 npm Registry，因此未宣称已完成实机浏览器渲染或完整 Vite build。请在有 npm 网络的环境执行 `npm install && npm run build`。
