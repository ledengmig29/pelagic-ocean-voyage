# LUEUR · 光的形状

以三幅本地油画为主角的影像展厅。深绿展厅、香槟金细线、中英衬线排版，配合 Remotion 的慢速运镜、光影呼吸和交叉溶解。

## 本地运行

Node.js 22.13 或更高版本。

```powershell
npm install
npm run dev
```

打开 http://localhost:5173/ 。生产构建：`npm run build`。类型检查：`node node_modules/typescript/bin/tsc --noEmit`。

## 影像

Remotion 4.0.529，1920 × 1080，30 fps。每章 24 秒，完整循环 72 秒。

- 星夜：缓慢推近，沿星空笔触轻微横移，月光呼吸。
- 风起：缓慢拉远与平移，让风暴、远山和前景人物逐渐形成联系。
- 金昼：向人物与拱门缓慢推近，暖光轻微变化。

镜头接近章节结尾时进行 50 帧交叉溶解。原图不做生成式修改。点击「走近这幅画」可查看完整原作。

播放/暂停、时间轴拖动、章节选择、上一幅/下一幅、沉浸观看、作品详情均可交互。空格播放或暂停；左右键切换章节；Esc 关闭沉浸模式或弹窗。系统开启减少动态效果时，默认静止并关闭运镜。

```powershell
# 编辑、预览视频时间线
npm run video:studio
# 使用同一画面组件输出 1080p MP4
npm run video:render
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
