# 云上花火 (yunyanhua.top) 静态资源清单

> 抓取自 `https://yunyanhua.top/` ， 抓取时间 2026-05-02 。
> 站点为 Vite 打包的 Vue3 SPA ， 主要资源由首页 HTML 引用的 `index-*.css` 和 `index-*.js` 间接装载 。
> 字体均来自 Google Fonts （ `Noto Serif SC` 、 `Inter` ）， 未本地化 。

## 1 . 入口与构建产物

| 文件 | 用途 | 原始 URL | 大小 / 维度 |
|---|---|---|---|
| `index.html` | 首页入口 HTML | `https://yunyanhua.top/` | 1 . 7 KB |
| `index-CB0tQY-z.css` | 主 CSS bundle | `https://yunyanhua.top/assets/index-CB0tQY-z.css` | 39 . 6 KB |
| `index-DmhOTLh_.js` | 主 JS bundle | `https://yunyanhua.top/assets/index-DmhOTLh_.js` | 1 . 30 MB |
| `vite.svg` | 网站 favicon （ SVG ） | `https://yunyanhua.top/vite.svg` | 3 . 1 KB ， 矢量 |
| `robots.txt` | 爬虫协议 | `https://yunyanhua.top/robots.txt` | 70 B |
| `sitemap.xml` | 站点地图 | `https://yunyanhua.top/sitemap.xml` | 68 KB |

## 2 . 主图

| 文件 | 用途 | 原始 URL | 像素尺寸 |
|---|---|---|---|
| `img/Image_Preview.png` | CSS 引用的主预览图 （ Hero / OG ） | `https://yunyanhua.top/img/Image_Preview.png` | 1920 x 1080 PNG |

## 3 . 场景背景图 （ 8 张 ）

> 站点把同一张 `_bg.png` 同时作为 _ 主题切换器右下角缩略图 _ 和 _ 全屏背景 _ 使用 ：JS 里 `theme-thumb` 元素的 `thumb-preview` div 通过 `background-image: url('/backgrounds/${key}_bg.png')` 渲染 ， 所以 _ 缩略图 与 全屏背景 是同一文件 _ 。
> 实际 MIME / 编码为 JPEG （ 服务端误标为 .png 扩展名 ）， 已保留原始文件名 。

| 文件 | 主题 Key | 主题中文名 | 原始 URL | 像素尺寸 |
|---|---|---|---|---|
| `scenes/realistic_bg.png` | realistic | 写实城市 | `https://yunyanhua.top/backgrounds/realistic_bg.png` | 1024 x 1024 |
| `scenes/cyberpunk_bg.png` | cyberpunk | 赛博朋克 | `https://yunyanhua.top/backgrounds/cyberpunk_bg.png` | 1024 x 1024 |
| `scenes/aurora_bg.png` | aurora | 极光雪原 | `https://yunyanhua.top/backgrounds/aurora_bg.png` | 1024 x 1024 |
| `scenes/starry_bg.png` | starry | 极简星空 | `https://yunyanhua.top/backgrounds/starry_bg.png` | 1024 x 1024 |
| `scenes/gradient_bg.png` | gradient | 暗夜渐变 | `https://yunyanhua.top/backgrounds/gradient_bg.png` | 1024 x 1024 |
| `scenes/moon_bg.png` | moon | 海上明月 | `https://yunyanhua.top/backgrounds/moon_bg.png` | 1024 x 1024 |
| `scenes/papercut_bg.png` | papercut | 新年窗花 | `https://yunyanhua.top/backgrounds/papercut_bg.png` | 1024 x 1024 |
| `scenes/ink_bg.png` | ink | 水墨山水 （ 任务清单未列出 ， 实际站点存在 ） | `https://yunyanhua.top/backgrounds/ink_bg.png` | 1024 x 1024 |

## 4 . 音频 （ 烟花音效 ）

| 文件 | 用途 | 原始 URL |
|---|---|---|
| `audio/lift1.mp3` `lift2.mp3` `lift3.mp3` | 升空音效 | `https://yunyanhua.top/audio/lift{1..3}.mp3` |
| `audio/burst1.mp3` `burst2.mp3` | 主炸响音效 | `https://yunyanhua.top/audio/burst{1,2}.mp3` |
| `audio/burst-sm-1.mp3` `burst-sm-2.mp3` | 小型炸响音效 | `https://yunyanhua.top/audio/burst-sm-{1,2}.mp3` |
| `audio/crackle1.mp3` | 余烬噼啪声 | `https://yunyanhua.top/audio/crackle1.mp3` |
| `audio/crackle-sm-1.mp3` | 小型余烬声 | `https://yunyanhua.top/audio/crackle-sm-1.mp3` |

## 5 . 地图数据 （ 地理可视化 ）

| 文件 | 用途 | 原始 URL |
|---|---|---|
| `map/china_full.json` | 中国全图 GeoJSON | `https://yunyanhua.top/map/china_full.json` |
| `map/city_coords_v2.json` | 城市坐标 （ v2 ） | `https://yunyanhua.top/map/city_coords_v2.json` |
| `map/city_province_map.json` | 城市 -> 省份 映射 | `https://yunyanhua.top/map/city_province_map.json` |

## 6 . 失败 / 缺失 资源

| URL | 状态 | 说明 |
|---|---|---|
| `https://yunyanhua.top/favicon.ico` | 404 | 站点不使用 .ico ， 实际 favicon 为 `/vite.svg` |
| `https://yunyanhua.top/og-image.png` | 404 | JS 中存在常量 `https://www.yunyanhua.top/og-image.png` 但服务端未部署该文件 |
| `https://www.yunyanhua.top/og-image.png` | 404 | 同上 ， www 子域亦无 |
| `https://yunyanhua.top/apple-touch-icon.png` | 404 | 未提供 |
| `https://yunyanhua.top/logo.png` 、 `/logo.svg` | 404 | 站内未单独提供 logo 资源 |
| `https://yunyanhua.top/manifest.json` 、 `/site.webmanifest` | 200 但内容为 SPA fallback HTML | 无真实 manifest ， 已删除 |
| `https://yunyanhua.top/map/city_coords.json` | 200 但内容为 SPA fallback HTML | 该文件已被 `city_coords_v2.json` 替代 ， 已删除 |
| `https://yunyanhua.top/geo-proxy/areas_v3/bound/100000_full.json` | 未抓取 | 这是 `geo-proxy` 反向代理路径 ， 真实数据由后端动态获取 ， 非静态资源 |
| Google Fonts （ `Noto Serif SC` ， `Inter` ） | 未抓取 | CSS 中通过 `<link rel="preconnect">` 引用 ， 字体文件由 Google CDN 动态发放 |
| `/api/action` `/api/fire` `/api/fire/recent` `/api/geo/ip` `/api/regions` `/api/stats/map` | 未抓取 | 服务端 API ， 非静态资源 |
