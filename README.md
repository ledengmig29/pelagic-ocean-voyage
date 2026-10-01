# PELAGIC · 瓶中之海

首页现在是 Three.js / WebGL 实时海洋叙事：宁静海面 → 白色三桅帆船驶入风暴 → 镜头拉远揭示玻璃瓶 → GPT 6.1 Sol 署名。滚轮或触屏滑动控制连续镜头，顶部章节可直接跳转；右下角声音按钮开启 Runway 生成的海浪与风雨环境音。原 LUEUR 展厅保留在 `/gallery`，既有 Remotion 作品保持可用。

海面采用 4000 × 4000 的 512² 网格，近场集中采样、12 条 Gerstner 波（70–140 / 28–48 / 16–24 三组）、FBM 顶点扰动、tanh 压缩、5 层法线、Schlick Fresnel 与天空 CubeMap、次表面透光、3 重太阳高光、4 层各向异性泡沫和距离雾。Gerstner 传播使用深水色散关系；这是物理启发的视觉模型，未模拟流体求解、破碎波或真实船体流体阻力。

`app/ocean/ocean-engine.ts` 是网页、Remotion 和 HyperFrames 共用的可寻址渲染器。帆船依据参考图演绎修长的白色船体、三根桅杆、分层象牙白横帆、船首三角帆与密集索具；船身、瓶身和海面均由本地几何与着色器构建，无需加载外部 3D 模型。支持减少动态效果、后台暂停渲染与 WebGL 初始化失败提示。

网页将滚动平滑后的同一进度交给场景、字幕、章节与声音。`app/ocean/ocean-transition.ts` 定义共用转场：风暴收束、外海淡入雾中，玻璃与瓶内水体渐显；第三幕文字等瓶身建立后出现。两种影片沿用这套转场，保持 36 秒，并在约 33 秒进入署名。

帆船在船首、船尾与两舷采样波高，计算升沉、纵摇与横摇；水面使用船体遮罩，减少海水穿入舱内的视觉问题。瓶内水体沿瓶壁轮廓形成有侧壁与底部的体积，装水量至少覆盖半瓶，波面随水位和瓶壁边界裁切。船只运动与水体表现采用几何约束和波高近似。

```powershell
npm run dev                 # http://localhost:5173/
npm run video:studio        # 选择 OceanVoyage，36 秒 / 1080p / 30 fps
npm run video:poster:ocean  # 导出海面静帧
npm run video:render:ocean  # 导出 out/ocean-voyage.mp4
npm run ocean:bundle        # 构建 HyperFrames 的共享 WebGL 引擎
npm run ocean:hyperframes   # 打开 HyperFrames Studio
```

网页预览需要支持 WebGL 2 的浏览器，建议开启硬件加速。视频帧由指定时间确定性渲染；完整视频需运行上面的导出命令。

## 原 LUEUR 展厅

以三幅本地油画为主角的影像展厅。深绿展厅、香槟金细线、中英衬线排版，配合 Remotion 的慢速运镜、光影呼吸和交叉溶解。

## 本地运行

Node.js 22.13 或更高版本。

```powershell
npm install
npm run dev
```

打开 http://localhost:5173/ 。生产构建：`npm run build`。类型检查：`node node_modules/typescript/bin/tsc --noEmit`。水体容量、甲板净空和船瓶几何回归：`npm run ocean:check`。

## 影像

《星月夜》独立短片：42 秒、1080p、30 fps。一道金色流光从星空滑落，连续穿过敞开的窗户；窗景随后淡出、镜头拉回完整原作，最后在左侧呈现中文作品介绍。在 Studio 中选择 `StarryNight`，运行 `npm run video:render` 导出 `out/starry-night.mp4`；`npm run video:poster` 生成封面。详见 [短片分镜与渲染说明](remotion/README.md)。

Remotion 4.0.529，1920 × 1080，30 fps。每章 24 秒，完整循环 72 秒。

- 星夜：缓慢推近，沿星空笔触轻微横移，月光呼吸。
- 风起：缓慢拉远与平移，让风暴、远山和前景人物逐渐形成联系。
- 金昼：向人物与拱门缓慢推近，暖光轻微变化。

镜头接近章节结尾时进行 50 帧交叉溶解。原图不做生成式修改。点击「走近这幅画」可查看完整原作。

播放/暂停、时间轴拖动、章节选择、上一幅/下一幅、沉浸观看、作品详情均可交互。空格播放或暂停；左右键切换章节；Esc 关闭沉浸模式或弹窗。系统开启减少动态效果时，默认静止并关闭运镜。

```powershell
# 编辑、预览视频时间线
npm run video:studio
# 导出《星月夜》独立短片
npm run video:render
# 导出三幅画作的原版影像
npm run video:render:gallery
```

首次命令行渲染时 Remotion 可能需要下载 Chrome Headless Shell。网页播放直接使用 Remotion Player，不依赖预先渲染的视频文件。

## 主要文件

- `app/gallery.tsx`：网页、播放器及控制交互。
- `app/art-film.tsx`：逐帧影像组件，网页与视频渲染共用。
- `app/artworks.ts`：章节顺序、作品文案和素材路径。
- `app/globals.css`：视觉系统和响应式布局。
- `remotion/root.tsx`：可独立渲染的视频合成。
- `public/artworks/`：浏览器使用的优化图片。

## 素材记录

原文件保留在上级目录。三幅油画使用 `start.jpg!webp`、`Nicolas Poussin .png`、`Giovanni Battista Tiepolo.png`。`Brassaï.png` 是黑白摄影，因此未列入本次油画展。

《星月夜》与普桑作品分别参考 MoMA 和施泰德博物馆资料，页面详情提供来源链接。提埃波罗作品的作者沿用用户文件名；具体馆藏题名与创作年份尚未独立核实，页面使用原创章节名，不填推测年份。英文 “A meeting in golden light” 是描述性文案。

字体使用 Cormorant Garamond 与 Noto Serif SC；无法连接字体服务时自动使用系统衬线字体。
