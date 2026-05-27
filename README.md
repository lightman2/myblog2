# Personal Blog

A tiny Git-friendly static blog. Write posts in Markdown, generate HTML with a local Node script, and publish the `public/` folder anywhere static files are supported.

## Quick Start

```powershell
node scripts/build.js
```

Open `public/index.html` in your browser.

## Write A New Post

Create a Markdown file in `posts/`:

```markdown
---
title: My New Post
date: 2026-05-27
description: A short summary for the homepage.
tags: life, notes
---

Your post content starts here.
```

Then rebuild:

```powershell
node scripts/build.js
git add .
git commit -m "Add new post"
```

## Publish Options

- GitHub Pages: publish from the `public/` folder or copy generated files to a `gh-pages` branch.
- Netlify/Vercel/Cloudflare Pages: build command `node scripts/build.js`, output directory `public`.

