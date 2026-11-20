/* MD2Post 核心逻辑
 *
 * 复制链路（为什么粘贴到公众号排版不丢）：
 * 1. marked 把 Markdown 解析成 HTML，DOMPurify 过滤掉危险标签；
 * 2. juice.inlineContent 把主题 CSS 内联成每个标签的 style="..." 行内样式
 *    —— 微信公众号/知乎等编辑器粘贴时只保留行内样式；
 * 3. navigator.clipboard.write 同时写入 text/html（富文本）与 text/plain（纯文本兜底）。
 */
(function () {
  'use strict';

  var THEMES = window.MD2POST_THEMES;
  var BASE_CSS = window.MD2POST_BASE_CSS;
  var TOKEN_STYLES = window.MD2POST_TOKEN_STYLES;

  var STORAGE_KEY = 'md2post.content.v1';
  var THEME_KEY = 'md2post.theme.v1';

  var editor = document.getElementById('editor');
  var preview = document.getElementById('preview');
  var previewShell = document.getElementById('preview-shell');
  var previewStyle = document.getElementById('preview-style');
  var themeSwitch = document.getElementById('theme-switch');
  var statChars = document.getElementById('stat-chars');
  var statWords = document.getElementById('stat-words');
  var statMinutes = document.getElementById('stat-minutes');
  var saveHint = document.getElementById('save-hint');
  var btnCopy = document.getElementById('btn-copy');
  var btnImport = document.getElementById('btn-import');
  var btnClear = document.getElementById('btn-clear');
  var fileInput = document.getElementById('file-input');
  var dropOverlay = document.getElementById('drop-overlay');
  var toastEl = document.getElementById('toast');
  var viewButtons = {
    editor: document.getElementById('view-editor'),
    preview: document.getElementById('view-preview')
  };
  var compatToggle = document.getElementById('compat-x');

  var state = { rendered: '', themeId: null, compatX: false };
  var renderTimer = null;
  var saveTimer = null;
  var toastTimer = null;
  var dragDepth = 0;

  /* ---------- 工具函数 ---------- */

  function toast(msg, ms) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    toastEl.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.style.opacity = '0';
      setTimeout(function () { toastEl.hidden = true; }, 260);
    }, ms || 2400);
  }

  function getTheme(id) {
    for (var i = 0; i < THEMES.length; i++) {
      if (THEMES[i].id === id) return THEMES[i];
    }
    return THEMES[0];
  }

  function scopeCss(css, scope) {
    /* 主题 CSS 均为平铺的 `selector{...}` 规则（无嵌套、无 @ 规则），可安全前缀化 */
    return css.replace(/([^{}]+)\{([^{}]*)\}/g, function (m, sel, body) {
      if (sel.trim().charAt(0) === '@') return m;
      var scoped = sel.split(',').map(function (s) {
        s = s.trim();
        return s ? scope + ' ' + s : s;
      }).join(',');
      return scoped + '{' + body + '}';
    });
  }

  function hljsCss() {
    return Object.keys(TOKEN_STYLES).map(function (cls) {
      var props = TOKEN_STYLES[cls];
      var decls = Object.keys(props).map(function (k) { return k + ':' + props[k]; }).join(';');
      return '.' + cls + '{' + decls + '}';
    }).join('\n');
  }

  function htmlToPlain(html) {
    /* 按块级元素补换行，避免纯文本兑底被拼成一整段 */
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var out = [];
    var BLOCK = /^(P|DIV|H[1-6]|UL|OL|LI|BLOCKQUOTE|PRE|TABLE|THEAD|TBODY|TR|HR|SECTION|FIGURE)$/;
    (function walk(node) {
      for (var i = 0; i < node.childNodes.length; i++) {
        var child = node.childNodes[i];
        if (child.nodeType === 3) {
          out.push(child.nodeValue);
        } else if (child.nodeType === 1) {
          if (child.tagName === 'BR') { out.push('\n'); continue; }
          if (BLOCK.test(child.tagName) && out.length && !/\n$/.test(out[out.length - 1])) out.push('\n');
          walk(child);
          if (BLOCK.test(child.tagName)) out.push('\n');
        }
      }
    })(doc.body);
    return out.join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /* X 文章编辑器兼容转换：
     实测（x-article-publisher 项目、pandoc 工作流）可稳定入贴的是
     纯净语义 HTML：无行内样式、无 class，只有语义标签。
     X 正文只支持 H2/H3 标题，表格不支持（转文本行），颜色/背景一律剥离 */
  function transformForStrictEditors(html) {
    var doc = new DOMParser().parseFromString('<div id="r">' + html + '</div>', 'text/html');
    var root = doc.getElementById('r');
    var tables = root.querySelectorAll('table');
    for (var j = 0; j < tables.length; j++) {
      var frag = doc.createDocumentFragment();
      var rows = tables[j].querySelectorAll('tr');
      for (var k = 0; k < rows.length; k++) {
        var cells = rows[k].querySelectorAll('th,td');
        var content = [];
        for (var m = 0; m < cells.length; m++) content.push(cells[m].textContent.trim());
        var line = doc.createElement('p');
        if (rows[k].querySelector('th')) {
          var bb = doc.createElement('strong');
          bb.textContent = content.join(' ｜ ');
          line.appendChild(bb);
        } else {
          line.textContent = content.join(' ｜ ');
        }
        frag.appendChild(line);
      }
      tables[j].parentNode.replaceChild(frag, tables[j]);
    }
    /* X 正文无 H1/H4-H6，收敛到 H2/H3 */
    var remap = { H1: 'H2', H4: 'H3', H5: 'H3', H6: 'H3' };
    var hs = root.querySelectorAll('h1,h2,h3,h4,h5,h6');
    for (var n = 0; n < hs.length; n++) {
      var tag = remap[hs[n].tagName];
      if (tag) {
        var neo = doc.createElement(tag);
        neo.innerHTML = hs[n].innerHTML;
        hs[n].parentNode.replaceChild(neo, hs[n]);
      }
    }
    /* 代码块：去掉高亮 span 碎片，展平为纯文本，并保留语言标记（X 依此识别代码块） */
    var codes = root.querySelectorAll('pre code');
    var langs = [];
    for (var c = 0; c < codes.length; c++) {
      var lang = (codes[c].getAttribute('class') || '').match(/language-([\w-]+)/);
      langs.push(lang ? lang[1] : null);
    }
    /* 剥离全部 style / class / id 属性，输出纯净语义 HTML */
    var all = root.querySelectorAll('*');
    for (var q = 0; q < all.length; q++) {
      all[q].removeAttribute('style');
      all[q].removeAttribute('class');
      all[q].removeAttribute('id');
    }
    for (var d = 0; d < codes.length; d++) {
      var codeEl = codes[d];
      var preEl = codeEl.parentNode;
      var pair = [codeEl, preEl];
      for (var e = 0; e < pair.length; e++) {
        while (pair[e].attributes.length) pair[e].removeAttribute(pair[e].attributes[0].name);
      }
      codeEl.textContent = codeEl.textContent;
      if (langs[d]) codeEl.setAttribute('class', 'language-' + langs[d]);
    }
    return root.innerHTML;
  }

  /* 代码高亮 token 直接落成行内样式：公众号粘贴会剥掉 class，靠类名的颜色会丢 */
  function inlineTokenColors(html) {
    var doc = new DOMParser().parseFromString('<div id="r">' + html + '</div>', 'text/html');
    var root = doc.getElementById('r');
    var els = root.querySelectorAll('[class*="hljs"]');
    for (var i = 0; i < els.length; i++) {
      var merged = {};
      var cls = (els[i].getAttribute('class') || '').split(/\s+/);
      for (var j = 0; j < cls.length; j++) {
        var s = TOKEN_STYLES[cls[j]];
        if (s) for (var k in s) merged[k] = s[k];
      }
      for (var p in merged) els[i].style.setProperty(p, merged[p]);
    }
    return root.innerHTML;
  }

  function countStats(md) {
    var cjk = (md.match(/[\u4E00-\u9FFF\u3400-\u4DBF]/g) || []).length;
    var rest = md.replace(/[\u4E00-\u9FFF\u3400-\u4DBF]/g, ' ');
    var en = (rest.match(/[A-Za-z0-9]+(?:['’\-][A-Za-z0-9]+)*/g) || []).length;
    var chars = md.replace(/\s+/g, '').length;
    statChars.textContent = String(chars);
    statWords.textContent = String(cjk + en);
    var minutes = Math.max(1, Math.ceil(cjk / 300 + en / 200));
    statMinutes.textContent = String(minutes);
  }

  /* ---------- 渲染 ---------- */

  marked.use({ gfm: true, breaks: true });

  function applyPreviewChrome() {
    var t = getTheme(state.themeId);
    previewStyle.textContent = scopeCss(BASE_CSS + '\n' + t.css + '\n' + hljsCss(), '.md2post-preview');
    previewShell.style.background = t.preview.shellBg;
    preview.style.padding = t.preview.pad;
    preview.style.borderRadius = t.preview.radius;
    preview.style.boxShadow = t.preview.shadow;
  }

  function render() {
    var md = editor.value;
    var html = '';
    if (md.replace(/\s/g, '')) {
      html = DOMPurify.sanitize(marked.parse(md));
    }
    preview.innerHTML = html;
    var blocks = preview.querySelectorAll('pre code');
    for (var i = 0; i < blocks.length; i++) {
      try { hljs.highlightElement(blocks[i]); } catch (e) { /* 忽略未知语言 */ }
    }
    state.rendered = preview.innerHTML;
    countStats(md);
  }

  function saveDraft() {
    try {
      localStorage.setItem(STORAGE_KEY, editor.value);
      var t = new Date();
      var hh = ('0' + t.getHours()).slice(-2);
      var mm = ('0' + t.getMinutes()).slice(-2);
      saveHint.textContent = '已自动保存 ' + hh + ':' + mm;
    } catch (e) {
      saveHint.textContent = '';
    }
  }

  function onInput() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 120);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 500);
  }

  /* ---------- 复制富文本 ---------- */

  function legacyCopy(html) {
    var container = document.createElement('div');
    container.setAttribute('contenteditable', 'true');
    container.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
    container.innerHTML = html;
    document.body.appendChild(container);
    var range = document.createRange();
    range.selectNodeContents(container);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    sel.removeAllRanges();
    document.body.removeChild(container);
    return ok;
  }

  async function copyRich() {
    if (!state.rendered) {
      toast('先写点内容，再复制吧');
      return;
    }
    var theme = getTheme(state.themeId);
    var sourceHtml = state.compatX ? transformForStrictEditors(state.rendered) : state.rendered;
    var html;
    var plain;
    if (state.compatX) {
      /* X 兼容模式：纯净语义 HTML，跳过 juice 内联（X 会剥离全部行内样式） */
      html = sourceHtml;
      plain = htmlToPlain(sourceHtml);
    } else {
      var wrapped = '<section class="md2post-root">' + sourceHtml + '</section>';
      html = wrapped;
      try {
        html = window.juice.inlineContent(wrapped, BASE_CSS + '\n' + theme.css);
      } catch (e) {
        console.warn('juice 内联失败，退回未内联 HTML：', e);
      }
      html = inlineTokenColors(html);
      plain = htmlToPlain(wrapped);
    }

    var ok = false;
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' })
        })]);
        ok = true;
      }
    } catch (e) {
      console.warn('Clipboard API 写入失败，尝试 execCommand 兜底：', e);
    }
    if (!ok) ok = legacyCopy(html);

    if (ok) {
      toast(state.compatX
        ? '已复制（X 兼容模式：纯净语义 HTML），直接粘贴到 X 文章编辑器正文'
        : '已复制带排版富文本，去公众号/知乎/飞书直接 Ctrl+V 粘贴');
      btnCopy.textContent = '已复制 ✓';
      btnCopy.classList.add('copied');
      setTimeout(function () {
        btnCopy.textContent = '复制富文本';
        btnCopy.classList.remove('copied');
      }, 2000);
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(plain);
      toast('当前浏览器不支持富文本复制，已复制纯文本');
    } else {
      toast('复制失败：请更换 Chrome / Edge 等现代浏览器');
    }
  }

  /* ---------- 导入 / 清空 ---------- */

  function importFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      editor.value = String(reader.result || '');
      onInput();
      render();
      saveDraft();
      toast('已导入：' + file.name);
    };
    reader.readAsText(file, 'utf-8');
  }

  /* ---------- 主题切换 ---------- */

  function buildThemeSwitch() {
    for (var i = 0; i < THEMES.length; i++) {
      (function (t) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = t.name;
        b.setAttribute('role', 'tab');
        b.addEventListener('click', function () { setTheme(t.id); });
        themeSwitch.appendChild(b);
      })(THEMES[i]);
    }
  }

  function setTheme(id) {
    state.themeId = id;
    try { localStorage.setItem(THEME_KEY, id); } catch (e) { /* 忽略 */ }
    var buttons = themeSwitch.children;
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle('active', THEMES[i].id === id);
    }
    applyPreviewChrome();
  }

  /* ---------- 拖拽导入 ---------- */

  function isTextFile(file) {
    return /\.(md|markdown|txt|mdown|mkd)$/i.test(file.name) || file.type === 'text/plain';
  }

  document.addEventListener('dragenter', function (e) {
    e.preventDefault();
    dragDepth++;
    if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') > -1) {
      dropOverlay.hidden = false;
    }
  });

  document.addEventListener('dragover', function (e) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });

  document.addEventListener('dragleave', function (e) {
    e.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) dropOverlay.hidden = true;
  });

  document.addEventListener('drop', function (e) {
    e.preventDefault();
    dragDepth = 0;
    dropOverlay.hidden = true;
    var files = (e.dataTransfer && e.dataTransfer.files) || [];
    if (files.length) {
      importFile(files[0]);
    }
  });

  /* ---------- 移动端编辑/预览切换 ---------- */

  function setView(view) {
    document.body.setAttribute('data-view', view);
    for (var key in viewButtons) {
      viewButtons[key].classList.toggle('active', key === view);
      viewButtons[key].setAttribute('aria-selected', key === view ? 'true' : 'false');
    }
    if (view === 'preview') previewShell.scrollTop = 0;
  }

  viewButtons.editor.addEventListener('click', function () { setView('editor'); });
  viewButtons.preview.addEventListener('click', function () { setView('preview'); });

  /* ---------- 事件绑定与初始化 ---------- */

  editor.addEventListener('input', onInput);

  /* 编辑区滚动 → 预览区按比例跟随（移动端单栏视图下禁用，避免与触控滚动打架） */
  editor.addEventListener('scroll', function () {
    if (window.matchMedia('(max-width: 900px)').matches) return;
    var ratio = editor.scrollTop / Math.max(1, editor.scrollHeight - editor.clientHeight);
    previewShell.scrollTop = ratio * (previewShell.scrollHeight - previewShell.clientHeight);
  });

  editor.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      copyRich();
    }
  });

  btnCopy.addEventListener('click', copyRich);
  compatToggle.addEventListener('change', function () {
    state.compatX = compatToggle.checked;
    try { localStorage.setItem('md2post.compatX', state.compatX ? '1' : '0'); } catch (e) { /* 忽略 */ }
  });
  btnImport.addEventListener('click', function () { fileInput.click(); });
  fileInput.addEventListener('change', function () {
    importFile(fileInput.files && fileInput.files[0]);
    fileInput.value = '';
  });
  btnClear.addEventListener('click', function () {
    if (!editor.value) return;
    if (window.confirm('确定清空当前内容？此操作不可撤销。')) {
      editor.value = '';
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* 忽略 */ }
      saveHint.textContent = '';
      render();
    }
  });

  window.addEventListener('beforeunload', saveDraft);

  var WELCOME = [
    '# 你好，MD2Post 👋',
    '',
    '**MD2Post** 是一款纯浏览器本地的 Markdown 排版工具：写好 Markdown，一键复制成带行内样式的富文本，直接粘贴到 **微信公众号、知乎、掘金、飞书**，排版不丢。',
    '',
    '## 它能做什么',
    '',
    '- ✂️ **实时预览**：左侧书写，右侧即时渲染',
    '- 🎨 **多套排版主题**：极简黑白 / 微信绿 / 技术博客蓝 / 小红书卡片',
    '- 📋 **一键复制**：CSS 自动内联进标签（juice），粘贴不丢样式',
    '- 💾 **自动保存草稿**：内容只存在你自己的浏览器里',
    '- 📂 **拖拽导入**：把 `.md` 文件直接拖进页面',
    '',
    '## 试试代码块',
    '',
    '```js',
    '// 复制后代码高亮同样保留',
    'function hello(name) {',
    '  console.log(`你好, ${name}!`);',
    '}',
    "hello('MD2Post');",
    '```',
    '',
    '## 试试引用',
    '',
    '> 富文本粘贴的秘密：公众号会过滤 `<style>` 标签和 class，',
    '> 所以要先把样式**内联**到每个标签的 style 属性里。',
    '',
    '| 功能 | 说明 |',
    '| --- | --- |',
    '| 拖拽导入 | 把 .md 文件拖进页面即可 |',
    '| 字数统计 | 左下角实时显示字数与阅读时长 |',
    '',
    '写完点右上角**复制富文本**，去你的编辑器粘贴吧！',
    ''
  ].join('\n');

  function init() {
    buildThemeSwitch();

    /* 小屏默认只显示编辑视图 */
    if (window.matchMedia('(max-width: 900px)').matches) setView('editor');

    try { state.compatX = localStorage.getItem('md2post.compatX') === '1'; } catch (e) { state.compatX = false; }
    compatToggle.checked = state.compatX;

    var saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) { /* 忽略 */ }
    editor.value = saved !== null && saved !== '' ? saved : WELCOME;

    var themeId = null;
    try { themeId = localStorage.getItem(THEME_KEY); } catch (e) { /* 忽略 */ }
    setTheme(themeId && getTheme(themeId) ? themeId : THEMES[0].id);

    render();
    if (saved !== null && saved !== '') saveDraft();
  }

  init();
})();
