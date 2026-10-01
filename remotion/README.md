# 当你抬头，看见梵高的《星月夜》

`StarryNight` 是以本地原作为素材的独立 Remotion 短片，1920 × 1080，30 fps，42 秒。新版以一道流光为主线：从星空滑落、穿入窗内、窗景渐隐、完整画作显露，最后呈现左侧介绍。原画始终是同一个图层，使用连续镜头与渐隐衔接。

## 预览与导出

在 `living-gallery` 目录运行：

```powershell
npm run video:studio
npm run video:poster
npm run video:render
```

在 Studio 中选择 `StarryNight`。视频输出到 `out/starry-night.mp4`，封面输出到 `out/starry-night-poster.png`。Windows 自动复用已安装的 Chrome / Edge；其他环境由 Remotion 管理 Chrome Headless Shell。也可通过 `REMOTION_BROWSER_EXECUTABLE` 环境变量或 `--browser-executable` 参数指定浏览器。

原有三幅画的 72 秒影像仍为 `LueurFilm`，使用 `npm run video:render:gallery` 导出。

## 分镜

| 时间 | 画面与文案 |
| --- | --- |
| 00:00–00:07 | 一点星光亮起，拖着金色光尾沿弧线从星空滑落。 |
| 00:07–00:16 | 镜头连续退入室内，窗框逐渐进入视野；同一道流光穿过窗口，掠过窗台。 |
| 00:16–00:19 | 流光在窗内缓缓消散，暖光短暂留在室内。 |
| 00:19–00:28 | 窗框与局部景色慢慢淡出，镜头拉远，完整《星月夜》居中显露。 |
| 00:28–00:33 | 完整画作短暂停留后移向右侧，为介绍留出空间。 |
| 00:33–00:42 | 左侧淡入标题、作者、创作背景、材质、尺寸与 MoMA 馆藏信息。 |

## 素材与实现

- `starry-night.tsx`：构图、中文文案、镜头和时间线。
- `starry-journey.ts`：连续流光轨迹、镜头曲线、穿窗时点与渐隐时点。
- `falling-light.tsx`：逐帧 SVG 流光、细尾迹与微粒。
- `starry-painting.tsx`：基于原画的确定性天空动效。
- `../public/artworks/starry-night.webp`：项目已有原作图像。
- `../public/artworks/starry-window.png`：内置 image_gen 工具生成的透明油画窗景，提示词见 [window-prompt.txt](window-prompt.txt)。窗景是艺术化演绎，不作为历史场景复原。
- `../public/fonts/starry-serif.woff2`：本地 Noto Serif SC 字体子集，避免联网字体影响渲染。
- `../scripts/subset-starry-font.py`：字体子集生成脚本。新增字幕字符后重新运行。

作品资料采用本次提供的文案，馆藏链接：[MoMA · The Starry Night](https://www.moma.org/collection/works/79802)。

上一版导出保留为 `out/starry-night-v1.mp4` 与 `out/starry-night-v1-preview.mp4`，方便比较。
