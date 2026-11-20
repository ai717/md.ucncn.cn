# MD2Post — 极简 Markdown 实时预览与一键富文本排版工具

线上地址：<https://md.ucncn.cn/>

在左侧写 Markdown，右侧实时预览，点「复制富文本」即可把**带行内样式的富文本**粘贴到
微信公众号、知乎、掘金、飞书等编辑器，排版不丢。

## 原理

整个过程 **100% 在浏览器本地运行，无任何后端**：

1. **解析渲染**：[marked](https://github.com/markedjs/marked) 实时把 Markdown 转成 HTML，
   [DOMPurify](https://github.com/cure53/DOMPurify) 做安全过滤。
2. **样式内联**：公众号/知乎等富文本编辑器粘贴时会过滤 `<style>` 标签和 class，
   只保留标签上的行内样式。用 [juice](https://github.com/Automattic/juice)
   把主题 CSS 自动内联进每个标签的 `style="..."` 属性。
3. **写入富文本剪贴板**：`navigator.clipboard.write()` 同时写入
   `text/html`（带内联样式的富文本）与 `text/plain`（纯文本兜底）；
   不支持 Clipboard API 的浏览器自动退回 `execCommand('copy')` 方案。

代码块高亮基于 [highlight.js](https://highlightjs.org/)。由于公众号会剥掉 class，
高亮颜色在复制时被直接写进每个 token 的行内样式，粘贴后依然保留。

## 功能

- 实时预览 + 编辑区/预览区滚动跟随
- 4 套排版主题：极简黑白、微信绿、技术博客蓝、小红书卡片
- 一键复制富文本（`Ctrl/Cmd + Enter`）
- `.md` 文件拖拽导入 / 点击导入
- `localStorage` 自动保存草稿，刷新不丢
- 实时字数（字符/字词）与预计阅读时长统计

## 本地运行

无构建步骤，纯静态站点，两种方式任选：

- **双击打开** `index.html` 即可（所有依赖已本地化，离线可用）；
- 或起一个静态服务：

  ```bash
  python -m http.server 8080
  # 或 npx serve .
  ```

## 部署

### Cloudflare Pages（推荐）

1. 把本目录推送到 GitHub；
2. Cloudflare 控制台 → Pages → Create a project → 连接该仓库；
3. 构建命令留空，输出目录填 `/`（根目录即站点）；
4. 部署完成后在项目 → Custom domains 里绑定 `md.ucncn.cn`，
   并在 Cloudflare DNS 给该域名加一条指向 Pages 服务的 CNAME 记录。

### GitHub Pages

1. 推送到 GitHub 仓库，Settings → Pages → Source 选分支根目录；
2. 仓库里已包含 `CNAME` 文件（内容为 `md.ucncn.cn`），
   并在 DNS 给 `md.ucncn.cn` 添加指向 GitHub Pages 的 CNAME 记录。

## 目录结构

```
index.html              入口页面（含 SEO meta）
assets/
  css/app.css           站点自身 UI 样式（不参与导出排版）
  js/themes.js          4 套排版主题 + 代码高亮 token 颜色表
  js/app.js             核心逻辑（渲染 / juice 内联 / 富文本剪贴板 / 草稿）
  vendor/               本地化依赖：marked、DOMPurify、highlight.js、juice
CNAME                   GitHub Pages 自定义域名
```

## 如何新增一套主题

编辑 `assets/js/themes.js`，向 `THEMES` 数组追加一项：

```js
{
  id: 'my-theme',          // 唯一 id
  name: '我的主题',          // 切换按钮文案
  preview: { shellBg: '#f7f7f8', pad: '40px 44px', radius: '0', shadow: 'none' }, // 预览区外观
  css: 'h2{color:#c00} p{margin:0 0 16px;line-height:1.8;}' // 仅用平铺的 标签选择器{...} 规则
}
```

注意事项：

- CSS 必须是**平铺的标签/类选择器规则**（不要 `@media`、不要嵌套），才能被正确内联；
- 代码块底色建议用深色（复制链路的高亮配色是按深色底设计的）；
- 代码高亮 token 颜色如需调整，改 `TOKEN_STYLES`（同时作用于预览与复制）。

## 依赖版本

| 库 | 版本 | 用途 |
| --- | --- | --- |
| marked | 12.0.2 | Markdown → HTML |
| DOMPurify | 3.1.6 | HTML 安全过滤 |
| highlight.js | 11.9.0 | 代码高亮 |
| juice | 10.0.0 | CSS 内联（esbuild 打包的浏览器 IIFE 版） |
