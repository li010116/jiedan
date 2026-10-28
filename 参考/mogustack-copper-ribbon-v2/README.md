# MOGUSTACK · Copper Ribbon Hero v2 (React + Three.js)

## 这次修复了什么

原版尝试用 Catmull-Rom 曲线和 PBR 材质**重新生成参考图**，结果出现：
- 造型近似而不是原图的翻折造型；
- 白色高光冲得太亮，暗部没有层次；
- 球体反射太硬，像塑料珠。

v2 改为**参考图驱动的浅景深 Three.js 场景**：直接保留用户给出的 PNG 中的轮廓和明暗，把金属丝带与球拆分成两张 RGBA 纹理，映射到独立的、轻度弯曲的 3D 网格上。两者有不同的微幅悬浮和鼠标视差。这让默认视角与参考图高度一致。

> 注意：v2 是「有真实空间网格与动画的参考图贴图方案」，**不是**从零建模、可 360° 旋转的完整金属雕塑。为了保持原图忠实度，交互转角故意限制在约 2°。如果需要真正大角度旋转，应在 Blender 中先人工建模并烘焙/调校金属反射，再导入 glTF。

## 直接运行

```bash
npm install
npm run dev
```

## 集成现有 React 网站

1. 将 `src/components/MoguCopperRibbon.tsx` 复制到现有项目。
2. 将 `public/ribbon.png`、`public/orb.png`、`public/reference-composite.png` 放到网站的 `public/` 目录，三张图片必须一起拷贝。
3. 运行 `npm install three && npm install -D @types/three`。
4. 在**原 Hero 的右侧容器内**替换原有组件：

```tsx
import MoguCopperRibbon from './components/MoguCopperRibbon'

<div className="hero-art" aria-label="MOGUSTACK 品牌动效">
  <MoguCopperRibbon autoMotion mouseParallax />
</div>
```

```css
.hero-art {
  width: 100%;
  height: clamp(310px, 31vw, 470px);
  position: relative;
  min-width: 0;
}
```

不要用 `position: absolute` 把 Hero 改成全屏组件；不要改左侧文字、导航、按钮、底部曲线；不要给 `canvas` 叠背景色。

## 调参建议

```tsx
<MoguCopperRibbon
  autoMotion             // 缓慢上浮；false 禁止时间动画
  mouseParallax          // 轻微指针视差；false 禁用
  scale={1}              // 0.9-1.08；1 为原图比例
  maxPixelRatio={1.75}   // 防止 Retina 像素开销过高
/>
```

如果你的项目部署在非根路径，给 `ribbonSrc`、`orbSrc`、`fallbackSrc` 传入基于 `import.meta.env.BASE_URL` 组合的路径，或将贴图作为模块导入。

## 约束与边界

- Canvas 完全透明，页面原斜线背景由现有代码显示。
- 滚出视窗或切换标签停止绘制，组件销毁时释放纹理/几何体/renderer。
- 尊重系统 `prefers-reduced-motion`；无 WebGL/贴图错误展示静态参考图。
- 当前环境无法连接 npm registry，本包已做 TSX 语法解析和视觉源图的 RGBA 重组校验，尚未实机进行 Vite 构建与 WebGL 渲染截图。你的本地需要运行 `npm run build` 复核。
