# MOGUSTACK — React + Three.js 3D Hero

> **仅替换首页右侧红框的视觉主体。** 不改左侧标题、导航、按钮、黑色斜线背景或底部曲线。

## 技术栈

- React 19 + TypeScript
- Three.js WebGLRenderer（直接在 `useEffect` 中维护生命周期，**不依赖 React Three Fiber**）
- Vite：仅用于提供本地演示页面
- 不依赖外部 3D 模型、材质贴图、图片或字体资源

## 运行演示

需要 Node.js 20.19+ / 22.12+：

```bash
npm install
npm run dev
```

浏览器打开控制台打印的地址。检查构建：

```bash
npm run build
```

## 接入已有 React 项目

1. 安装 `three` 与类型声明（React/TypeScript 已存在无需重复安装）：

   ```bash
   npm install three
   npm install -D @types/three
   ```

2. 将 `src/components/MoguHero3D.tsx` 复制到现有项目的组件目录。

3. 只替换原红框位置里原来的 WEB / APP / AI 视觉：

   ```tsx
   import MoguHero3D from './components/MoguHero3D'

   // 现有 Hero JSX 的右侧位置
   <div className="hero-visual">
     <MoguHero3D accent="#D4FF56" autoMotion mouseParallax />
   </div>
   ```

   ```css
   .hero-visual { position: relative; width: 100%; height: 469px; }
   @media (max-width: 768px) { .hero-visual { height: 300px; } }
   ```

**请保留你的 Hero 原有父容器的位置、背景层、标题和底部衔接；红框只是截图标注，不应出现在生产页面。**

## Props

| Prop | 类型 | 默认 | 含义 |
| --- | --- | --- | --- |
| `accent` | `string` | `#D4FF56` | 品牌绿色节点 |
| `autoMotion` | `boolean` | `true` | 轻微悬浮、极小角度旋转 |
| `mouseParallax` | `boolean` | `true` | 鼠标跟随的微视差 |
| `maxPixelRatio` | `number` | `1.8` | 限制 DPR 减少 GPU 压力 |

静态版本：`<MoguHero3D autoMotion={false} mouseParallax={false} />`。

## 视觉组成

- 低饱和金属 `M`：通过二维中心线生成连续几何，再挤出成为真实 3D 几何。
- 一条低透明度椭圆轨道，在主体后方。
- 一个小型荧光绿方块节点，与原 CTA 同色。
- 透明 Three.js 画布，叠在现有的深色斜线背景上。
- 没有设备框、仪表盘、彩色渐变卡片或额外文案。

## 生命周期 / 降级

- 支持 React StrictMode effect 重入及组件卸载清理。
- `ResizeObserver` 自动自适应尺寸。
- `IntersectionObserver` / 页面隐藏时暂停动画。
- 尊重 `prefers-reduced-motion`，降低动态效果。
- WebGL 无法启用或 context lost 时显示 SVG 静态图形。
- 显式销毁 geometries、materials、renderer 与事件监听器。

## 关于演示页

`src/App.tsx` 与 `src/styles/demo.css` 仅用于模拟原网站首页布局，方便本地查看。**不要覆盖你现有网站的布局与文案。**实际接入仅需要组件文件。
