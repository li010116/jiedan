# Codex task · MOGUSTACK Hero 右侧素材高保真替换

## 目标

用户对上一版程序化金属丝带的弧线/材质不满意。必须使用 `MoguCopperRibbon.tsx` v2，呈现用户认可的玫瑰铜色丝带和右侧悬浮球体。

## 只允许修改的范围

- 原 Hero 右侧展示容器及其内部组件。
- 可新增组件文件和所需 3 张透明 PNG 资源。
- 不准改写左侧文案、导航、CTA、背景线条和底部弧形衔接。

## 执行步骤

1. 从本项目复制 `src/components/MoguCopperRibbon.tsx` 和 `public/{ribbon,orb,reference-composite}.png`。
2. 用 `<MoguCopperRibbon autoMotion mouseParallax />` 替换旧的白色 M 或重新算法建模的铜色丝带。
3. 容器响应式尺寸：桌面高度 430~470px；手机按页面实际空间缩放，禁止裁切到球体。
4. 保证整个页面没有因 Hero 组件造成水平滚动；Canvas `pointer-events:none`。
5. `npm run build`，在 1440px、1920px 和 390px 视口截图对照 PNG 参考。
6. 检查静态首帧与 `public/reference-composite.png` 在轮廓、翻折、暗部、高光和球体反射方面基本一致。
7. 检查鼠标移动：仅极轻微 3D 视差，既不能大角度旋转，也不能出现假 3D 的白色背面或撕裂。
8. 禁用动画（reduced motion）后仍然显示完整、清晰的图像。

## 重要技术决策

v2 利用 PNG 原图进行**高保真贴图驱动浅景深 Three.js 动效**，不是完全可旋转模型，勿在修复中偷偷换回 PBR 数学生成丝带。用户已多次明确要求视觉优先且只改右侧。
