export const FPS = 30;
export const CHAPTER_FRAMES = 720;
export const FILM_FRAMES = CHAPTER_FRAMES * 3;
export const artworks = [
  { id: "starry", number: "01", name: "星夜", subtitle: "The rhythm of night", artist: "Vincent van Gogh", artistZh: "文森特·梵高", year: "1889", medium: "布面油画", title: "The Starry Night", image: "artworks/starry-night.webp", position: "52% 46%", detail: "柏树向上伸展，村庄静静伏在山脚。短促而厚重的笔触，将星辰、月光与夜空连成一股涌动的力量。让目光在旋涡之间停留，看静止的画布如何拥有节奏。", palette: ["#172347", "#32578e", "#859aac", "#d0bc61"], source: "https://www.moma.org/collection/works/79802" },
  { id: "storm", number: "02", name: "风起", subtitle: "A moment before the storm", artist: "Nicolas Poussin", artistZh: "尼古拉·普桑", year: "1651", medium: "布面油画", title: "Landscape with Pyramus and Thisbe", image: "artworks/poussin.jpg", position: "50% 42%", detail: "天地间的风暴，呼应着前景人物的命运。湖面、远山与建筑构成宁静的秩序，奔跑的人和弯曲的树又将它打破。在明与暗之间，风成为画中看不见的叙事者。", palette: ["#22261e", "#505148", "#79725c", "#b1a188"], source: "https://sammlung.staedelmuseum.de/de/werk/gewitterlandschaft-mit-pyramus-und-thisbe" },
  { id: "gold", number: "03", name: "金昼", subtitle: "Where the light gathers", artist: "Giovanni Battista Tiepolo", artistZh: "乔瓦尼·巴蒂斯塔·提埃波罗", year: "", medium: "布面油画", title: "A meeting in golden light", image: "artworks/tiepolo.jpg", position: "54% 44%", detail: "目光从石阶向上，穿过人物的手势，最后停在明亮的拱门下。银白与金黄的衣袍接住了光；深蓝与朱红则将整个场景稳稳托起。人物之间的距离，也是一种优雅的戏剧。", palette: ["#303331", "#b18c49", "#adb0a2", "#4b6887"], source: "" },
] as const;
