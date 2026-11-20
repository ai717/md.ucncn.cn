/* MD2Post 排版主题库
 *
 * 结构说明：
 * - BASE_CSS：所有主题共用的“重置层”，复制时最先注入，保证各平台粘贴结果一致。
 * - 每个 theme.css：与公众号/知乎兼容的纯标签选择器规则（无 id、无 @ 规则），
 *   复制时交给 juice 内联进每个标签的 style 属性；预览时由 app.js 自动加作用域前缀。
 * - TOKEN_STYLES：代码高亮 token 的“类名 → 行内样式”映射。微信公众号粘贴时会剥掉
 *   class，所以复制链路不靠 CSS 内联高亮，而是直接把颜色写进每个 token 的 style 里。
 */
(function () {
  'use strict';

  var BASE_CSS = [
    'h1,h2,h3,h4,h5,h6,p,blockquote,pre,hr,figure,ul,ol,dl,dd,table{margin:0}',
    'ul,ol{padding:0}',
    'img{max-width:100%}',
    "code,pre{font-family:ui-monospace,'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace}",
    'table{border-collapse:collapse;width:100%}',
    'a{text-decoration:none}',
    "section{font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Helvetica Neue',Arial,sans-serif}"
  ].join('\n');

  /* 代码高亮 token（github-dark 配色，深色代码块底色上通用） */
  var CODE_BG_DARK = '#1f2430';

  var TOKEN_STYLES = {
    'hljs': { 'color': '#c9d1d9' },
    'hljs-comment': { 'color': '#8b949e', 'font-style': 'italic' },
    'hljs-quote': { 'color': '#8b949e', 'font-style': 'italic' },
    'hljs-keyword': { 'color': '#ff7b72' },
    'hljs-selector-tag': { 'color': '#ff7b72' },
    'hljs-doctag': { 'color': '#ff7b72' },
    'hljs-deletion': { 'color': '#ff7b72' },
    'hljs-string': { 'color': '#a5d6ff' },
    'hljs-regexp': { 'color': '#a5d6ff' },
    'hljs-meta': { 'color': '#8b949e' },
    'hljs-number': { 'color': '#79c0ff' },
    'hljs-literal': { 'color': '#79c0ff' },
    'hljs-attr': { 'color': '#79c0ff' },
    'hljs-attribute': { 'color': '#79c0ff' },
    'hljs-variable': { 'color': '#ffa657' },
    'hljs-template-variable': { 'color': '#ffa657' },
    'hljs-selector-attr': { 'color': '#79c0ff' },
    'hljs-selector-class': { 'color': '#79c0ff' },
    'hljs-selector-id': { 'color': '#79c0ff' },
    'hljs-title': { 'color': '#d2a8ff' },
    'hljs-name': { 'color': '#7ee787' },
    'hljs-tag': { 'color': '#7ee787' },
    'hljs-built_in': { 'color': '#ffa657' },
    'hljs-type': { 'color': '#ffa657' },
    'hljs-symbol': { 'color': '#ffa657' },
    'hljs-bullet': { 'color': '#ffa657' },
    'hljs-link': { 'color': '#79c0ff' },
    'hljs-params': { 'color': '#c9d1d9' },
    'hljs-addition': { 'color': '#aff5b4' },
    'hljs-emphasis': { 'font-style': 'italic' },
    'hljs-strong': { 'font-weight': '700' }
  };

  var DARK_CODE_BLOCK =
    'pre{margin:20px 0;padding:16px;border-radius:8px;background:' + CODE_BG_DARK + ';overflow-x:auto}' +
    'pre code{display:block;padding:0;background:transparent;color:#c9d1d9;font-size:13px;line-height:1.65}';

  var THEMES = [
    {
      id: 'minimal',
      name: '极简黑白',
      preview: { shellBg: '#f7f7f8', pad: '40px 44px', radius: '0', shadow: 'none' },
      css: [
        'section{font-size:15px;color:#333;line-height:1.8}',
        'h1{font-size:22px;font-weight:700;color:#111;text-align:center;margin:36px 0 20px}',
        'h2{font-size:19px;font-weight:700;color:#111;border-left:4px solid #111;padding-left:12px;margin:32px 0 16px}',
        'h3{font-size:17px;font-weight:700;color:#111;margin:26px 0 12px}',
        'h4{font-size:15px;font-weight:700;color:#111;margin:20px 0 10px}',
        'p{margin:0 0 16px;line-height:1.8;color:#333}',
        'strong{color:#111;font-weight:700}',
        'blockquote{margin:20px 0;padding:12px 16px;background:#f7f7f7;border-left:3px solid #d9d9d9;color:#666}',
        'blockquote p{margin:0;color:#666}',
        'ul,ol{margin:0 0 16px;padding-left:22px}',
        'li{margin:6px 0;line-height:1.8;color:#333}',
        'a{color:#111;text-decoration:underline}',
        'hr{border:none;border-top:1px solid #e5e5e5;margin:28px 0}',
        'code{font-size:13px;background:#f2f2f2;padding:2px 6px;border-radius:4px;color:#c7254e}',
        DARK_CODE_BLOCK,
        'table{margin:20px 0;font-size:14px}',
        'th{background:#fafafa;font-weight:600;color:#111}',
        'th,td{border:1px solid #e5e5e5;padding:8px 12px;text-align:left}'
      ].join('\n')
    },
    {
      id: 'wechat',
      name: '微信绿',
      preview: { shellBg: '#f7f7f8', pad: '40px 44px', radius: '0', shadow: 'none' },
      css: [
        'section{font-size:15px;color:#333;line-height:1.8}',
        'h1{font-size:21px;font-weight:700;text-align:center;color:#07c160;margin:34px 0 20px}',
        'h2{font-size:18px;font-weight:700;color:#222;border-left:4px solid #07c160;padding-left:10px;margin:32px 0 16px}',
        'h3{font-size:16px;font-weight:700;color:#0f8a43;margin:26px 0 12px}',
        'h4{font-size:15px;font-weight:700;color:#333;margin:20px 0 10px}',
        'p{margin:0 0 16px;line-height:1.8;color:#333}',
        'strong{color:#07c160;font-weight:700}',
        'blockquote{margin:20px 0;padding:12px 16px;background:#f2fbf6;border-left:4px solid #07c160;border-radius:4px;color:#555}',
        'blockquote p{margin:0;color:#555}',
        'ul,ol{margin:0 0 16px;padding-left:24px}',
        'li{margin:8px 0;line-height:1.8;color:#333}',
        'a{color:#1aad19}',
        'hr{border:none;border-top:1px dashed #b7dfc7;margin:28px 0}',
        'code{font-size:13px;background:#eef7f0;color:#0f8a43;padding:2px 6px;border-radius:4px}',
        DARK_CODE_BLOCK,
        'table{margin:20px 0;font-size:14px}',
        'th{background:#f2fbf6;color:#0f8a43;font-weight:600}',
        'th,td{border:1px solid #d5ecdd;padding:8px 12px;text-align:left}'
      ].join('\n')
    },
    {
      id: 'techblue',
      name: '技术博客蓝',
      preview: { shellBg: '#f7f7f8', pad: '40px 44px', radius: '0', shadow: 'none' },
      css: [
        'section{font-size:15px;color:#2d3748;line-height:1.8}',
        'h1{font-size:22px;font-weight:800;color:#1a202c;margin:36px 0 20px}',
        'h2{font-size:19px;font-weight:700;color:#1a202c;border-bottom:2px solid #3182ce;padding-bottom:8px;margin:32px 0 16px}',
        'h3{font-size:16px;font-weight:700;color:#2b6cb0;margin:24px 0 12px}',
        'h4{font-size:15px;font-weight:700;color:#2d3748;margin:20px 0 10px}',
        'p{margin:0 0 16px;line-height:1.8;color:#2d3748}',
        'strong{color:#2b6cb0;font-weight:700}',
        'blockquote{margin:20px 0;padding:12px 16px;background:#ebf4ff;border-left:4px solid #3182ce;border-radius:0 6px 6px 0;color:#4a5568}',
        'blockquote p{margin:0;color:#4a5568}',
        'ul,ol{margin:0 0 16px;padding-left:24px}',
        'li{margin:6px 0;line-height:1.8;color:#2d3748}',
        'a{color:#3182ce;border-bottom:1px solid #a3c3f5}',
        'hr{border:none;border-top:1px solid #e2e8f0;margin:28px 0}',
        'code{font-size:13px;background:#edf2f7;color:#c53030;padding:2px 6px;border-radius:4px}',
        DARK_CODE_BLOCK,
        'table{margin:20px 0;font-size:14px}',
        'th{background:#ebf4ff;color:#2b6cb0;font-weight:600}',
        'th,td{border:1px solid #e2e8f0;padding:8px 12px;text-align:left}'
      ].join('\n')
    },
    {
      id: 'xhs',
      name: '小红书卡片',
      preview: { shellBg: '#f2f2f5', pad: '28px 28px', radius: '16px', shadow: '0 4px 16px rgba(0,0,0,.08)' },
      css: [
        'section{font-size:16px;color:#262626;line-height:2}',
        'h1{font-size:24px;font-weight:800;text-align:center;color:#111;margin:36px 0 22px}',
        'h2{font-size:19px;font-weight:700;text-align:center;color:#ff2442;margin:32px 0 14px}',
        'h3{font-size:16px;font-weight:700;text-align:center;color:#111;margin:24px 0 12px}',
        'h4{font-size:15px;font-weight:700;color:#262626;margin:20px 0 10px}',
        'p{margin:0 0 18px;line-height:2;color:#262626}',
        'strong{color:#ff2442;font-weight:700}',
        'blockquote{margin:20px 0;padding:14px 18px;background:#fff0f1;border-radius:12px;color:#5c5c5c}',
        'blockquote p{margin:0;color:#5c5c5c}',
        'ul,ol{margin:0 0 18px;padding-left:22px}',
        'li{margin:10px 0;line-height:2;color:#262626}',
        'a{color:#ff2442}',
        'hr{border:none;height:1px;background:#ffe3e6;margin:30px 0}',
        'code{font-size:13px;background:#fff0f1;color:#d9305a;padding:2px 6px;border-radius:6px}',
        'pre{margin:20px 0;padding:16px;border-radius:12px;background:' + CODE_BG_DARK + ';overflow-x:auto}',
        'pre code{display:block;padding:0;background:transparent;color:#c9d1d9;font-size:13px;line-height:1.7}',
        'img{border-radius:12px}',
        'table{margin:20px 0;font-size:14px}',
        'th{background:#fff0f1;color:#d9305a;font-weight:600}',
        'th,td{border:1px solid #ffdbe0;padding:8px 12px;text-align:left}'
      ].join('\n')
    }
  ];

  window.MD2POST_THEMES = THEMES;
  window.MD2POST_BASE_CSS = BASE_CSS;
  window.MD2POST_TOKEN_STYLES = TOKEN_STYLES;
})();
