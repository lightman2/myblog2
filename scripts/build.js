const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const postsDir = path.join(rootDir, "posts");
const publicDir = path.join(rootDir, "public");
const site = {
  title: "个人博客",
  description: "用 Git 管理、用 Markdown 更新的个人空间。",
  author: "Louis",
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugify(filename) {
  return filename.replace(/\.md$/i, "");
}

function parseFrontMatter(source, filename) {
  if (!source.startsWith("---")) {
    throw new Error(`${filename} is missing front matter`);
  }

  const end = source.indexOf("\n---", 3);
  if (end === -1) {
    throw new Error(`${filename} has invalid front matter`);
  }

  const raw = source.slice(3, end).trim();
  const body = source.slice(end + 4).trim();
  const meta = {};

  raw.split(/\r?\n/).forEach((line) => {
    const index = line.indexOf(":");
    if (index === -1) return;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    meta[key] = value;
  });

  if (!meta.title || !meta.date) {
    throw new Error(`${filename} needs title and date`);
  }

  return { meta, body };
}

function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function markdownToHtml(markdown) {
  const lines = markdown.split(/\r?\n/);
  const html = [];
  let paragraph = [];
  let list = [];
  let inCode = false;
  let codeLang = "";
  let codeLines = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (!list.length) return;
    html.push(`<ul>${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
    list = [];
  }

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCode) {
        html.push(`<pre><code class="language-${escapeHtml(codeLang)}">${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        inCode = false;
        codeLang = "";
        codeLines = [];
      } else {
        flushParagraph();
        flushList();
        inCode = true;
        codeLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length + 1;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const item = line.match(/^[-*]\s+(.+)$/);
    if (item) {
      flushParagraph();
      list.push(item[1]);
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();

  return html.join("\n");
}

function layout({ title, description, content, base = "." }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} - ${escapeHtml(site.title)}</title>
  <meta name="description" content="${escapeHtml(description || site.description)}">
  <link rel="stylesheet" href="${base}/assets/style.css">
</head>
<body>
  <header class="site-header">
    <a class="brand" href="${base}/index.html">${escapeHtml(site.title)}</a>
    <nav>
      <a href="${base}/archive.html">归档</a>
      <a href="${base}/feed.xml">RSS</a>
    </nav>
  </header>
  <main>${content}</main>
  <footer class="site-footer">© ${new Date().getFullYear()} ${escapeHtml(site.author)} · Built from Markdown and Git.</footer>
</body>
</html>`;
}

function readPosts() {
  if (!fs.existsSync(postsDir)) return [];

  return fs.readdirSync(postsDir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const source = fs.readFileSync(path.join(postsDir, file), "utf8");
      const { meta, body } = parseFrontMatter(source, file);
      const slug = slugify(file);
      return {
        ...meta,
        slug,
        url: `posts/${slug}.html`,
        tags: (meta.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean),
        html: markdownToHtml(body),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function renderPost(post) {
  const tags = post.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
  const content = `<article class="post">
  <a class="back-link" href="../index.html">← 首页</a>
  <h1>${escapeHtml(post.title)}</h1>
  <p class="meta">${escapeHtml(post.date)}</p>
  <div class="tags">${tags}</div>
  <section class="content">${post.html}</section>
</article>`;

  writeFile(path.join(publicDir, "posts", `${post.slug}.html`), layout({
    title: post.title,
    description: post.description,
    content,
    base: "..",
  }));
}

function renderIndex(posts) {
  const latest = posts.map((post) => `<article class="post-card">
  <p class="meta">${escapeHtml(post.date)}</p>
  <h2><a href="${post.url}">${escapeHtml(post.title)}</a></h2>
  <p>${escapeHtml(post.description || "")}</p>
</article>`).join("\n");

  const content = `<section class="hero">
  <p class="eyebrow">Markdown · Git · Static</p>
  <h1>${escapeHtml(site.title)}</h1>
  <p>${escapeHtml(site.description)}</p>
</section>
<section class="post-list">
  ${latest || "<p>还没有文章。</p>"}
</section>`;

  writeFile(path.join(publicDir, "index.html"), layout({
    title: "首页",
    description: site.description,
    content,
  }));
}

function renderArchive(posts) {
  const rows = posts.map((post) => `<li>
  <time>${escapeHtml(post.date)}</time>
  <a href="${post.url}">${escapeHtml(post.title)}</a>
</li>`).join("\n");

  const content = `<section class="page">
  <h1>归档</h1>
  <ul class="archive">${rows}</ul>
</section>`;

  writeFile(path.join(publicDir, "archive.html"), layout({
    title: "归档",
    description: "文章归档",
    content,
    base: ".",
  }));
}

function renderFeed(posts) {
  const items = posts.map((post) => `<item>
  <title>${escapeHtml(post.title)}</title>
  <link>${post.url}</link>
  <guid>${post.url}</guid>
  <pubDate>${new Date(`${post.date}T00:00:00+08:00`).toUTCString()}</pubDate>
  <description>${escapeHtml(post.description || "")}</description>
</item>`).join("\n");

  writeFile(path.join(publicDir, "feed.xml"), `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
<channel>
  <title>${escapeHtml(site.title)}</title>
  <description>${escapeHtml(site.description)}</description>
  <link>/</link>
  ${items}
</channel>
</rss>`);
}

function renderStyles() {
  writeFile(path.join(publicDir, "assets", "style.css"), `:root {
  color-scheme: light;
  --bg: #f7f4ef;
  --panel: #fffdf9;
  --text: #242424;
  --muted: #6c6f75;
  --line: #ded8cf;
  --accent: #0f766e;
  --accent-strong: #134e4a;
  --code: #edf5f3;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.7;
}

a {
  color: var(--accent-strong);
  text-decoration-thickness: 1px;
  text-underline-offset: 4px;
}

.site-header,
.site-footer,
main {
  width: min(920px, calc(100% - 32px));
  margin: 0 auto;
}

.site-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28px 0;
}

.brand {
  color: var(--text);
  font-weight: 800;
  text-decoration: none;
}

nav {
  display: flex;
  gap: 18px;
  font-size: 14px;
}

.hero {
  padding: 72px 0 52px;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.eyebrow,
.meta {
  color: var(--muted);
  font-size: 14px;
}

h1 {
  max-width: 760px;
  margin: 8px 0 14px;
  font-size: clamp(38px, 7vw, 76px);
  line-height: 1.05;
  letter-spacing: 0;
}

h2 {
  margin: 8px 0;
  font-size: 26px;
  line-height: 1.25;
}

.hero p {
  max-width: 620px;
  font-size: 18px;
}

.post-list {
  display: grid;
  gap: 16px;
  padding: 36px 0 20px;
}

.post-card {
  padding: 22px 0;
  border-bottom: 1px solid var(--line);
}

.post-card p {
  max-width: 680px;
  margin: 8px 0 0;
  color: var(--muted);
}

.post,
.page {
  padding: 36px 0 64px;
}

.post h1,
.page h1 {
  font-size: clamp(34px, 6vw, 58px);
}

.back-link {
  display: inline-block;
  margin-bottom: 24px;
  font-size: 14px;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 16px 0 34px;
}

.tags span {
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--muted);
  font-size: 13px;
  padding: 3px 10px;
}

.content {
  max-width: 720px;
  font-size: 18px;
}

.content h2,
.content h3,
.content h4 {
  margin-top: 36px;
}

code {
  background: var(--code);
  border-radius: 6px;
  padding: 2px 5px;
  font-size: 0.92em;
}

pre {
  overflow: auto;
  background: #17211f;
  border-radius: 8px;
  color: #eef8f5;
  padding: 18px;
}

pre code {
  background: transparent;
  padding: 0;
}

.archive {
  list-style: none;
  margin: 0;
  padding: 0;
}

.archive li {
  display: grid;
  grid-template-columns: 128px 1fr;
  gap: 20px;
  padding: 14px 0;
  border-bottom: 1px solid var(--line);
}

.archive time,
.site-footer {
  color: var(--muted);
}

.site-footer {
  padding: 36px 0;
  font-size: 14px;
}

@media (max-width: 620px) {
  .site-header {
    align-items: flex-start;
    gap: 14px;
    flex-direction: column;
  }

  .hero {
    padding: 48px 0 38px;
  }

  .archive li {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}`);
}

function cleanPublic() {
  fs.rmSync(publicDir, { recursive: true, force: true });
  fs.mkdirSync(publicDir, { recursive: true });
}

function build() {
  cleanPublic();
  const posts = readPosts();
  posts.forEach(renderPost);
  renderIndex(posts);
  renderArchive(posts);
  renderFeed(posts);
  renderStyles();
  console.log(`Built ${posts.length} post(s) into public/`);
}

build();
