import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
let katex = null;

try {
  const katexModule = await import("katex");
  katex = katexModule.default ?? katexModule;
} catch (error) {
  console.warn("KaTeX를 찾을 수 없어 수식은 일반 텍스트로 처리합니다.");
}

const ROOT_DIR = path.resolve(".");
const POSTS_DIR = path.resolve("src/data/posts");
const PUBLIC_DIR = path.resolve("public");

const BOARDS = {
  stock: {
    name: "주식",
    description: "주식 투자에 필요한 기본 지식부터 시장 이슈와 투자 상식까지",
  },

  tax: {
    name: "세금",
    description:
      "연말정산부터 다양한 절세 정보까지 세금을 이해하고 관리하는 방법",
  },

  accounting: {
    name: "재무회계",
    description: "기초 회계 원리부터 재무제표 분석까지, 재무·회계의 모든 것",
  },
};

const DOMAIN = "https://cozymoney.kr";
const ADSENSE_CLIENT = "ca-pub-XXXXXXXXXXXXXXXX";
const ADSENSE_SLOT = "XXXXXXXXXXXXXXXX";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value = "") {
  return escapeHtml(value);
}

function formatDate(date) {
  if (!date) return "";

  if (date instanceof Date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  }

  return String(date).slice(0, 10);
}

function getMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  const files = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...getMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

function removeFirstH1(markdown) {
  return markdown.replace(/^\s*#\s+.+?\s*(?:\r?\n)+/, "");
}

function renderMarkdown(markdown) {
  let html = marked.parse(removeFirstH1(markdown));

  html = html.replace(/<img\b([^>]*?)>/gi, (match, attributes) => {
    let result = `<img${attributes}`;

    if (!/\bloading\s*=/i.test(result)) {
      result += ' loading="lazy"';
    }

    if (!/\bdecoding\s*=/i.test(result)) {
      result += ' decoding="async"';
    }

    return `${result}>`;
  });

  // KaTeX가 설치되어 있으면 Markdown 수식을 KaTeX HTML로 변환한다.
  if (!katex) {
    return html;
  }

  // KaTeX가 설치되어 있으면 Markdown 수식을 KaTeX HTML로 변환한다.
  // 설치되지 않은 환경에서도 게시글 빌드 자체는 중단되지 않도록 한다.
  if (!katex) {
    return html;
  }

  html = html.replace(/\\$\\$([\\s\\S]*?)\\$\\$/g, (_, formula) =>
    katex.renderToString(formula.trim(), {
      displayMode: true,
      throwOnError: false,
    })
  );

  html = html.replace(/(?<!\\$)\\$([^$\\n]+)\\$(?!\\$)/g, (_, formula) =>
    katex.renderToString(formula.trim(), {
      displayMode: false,
      throwOnError: false,
    })
  );

  return html;
}

function validatePostImages(markdown, postTitle) {
  const allImageMatches = [
    ...String(markdown).matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g),
  ];

  if (allImageMatches.length !== 2) {
    throw new Error(
      `게시글 이미지가 정확히 2개가 아닙니다: ${postTitle} → ${allImageMatches.length}개`
    );
  }

  const providers = new Set();

  for (const match of allImageMatches) {
    const imageUrl = match[1];

    if (/^https:\/\/(?:images\.)?pexels\.com\//i.test(imageUrl)) {
      providers.add("pexels");
      continue;
    }

    if (/^https:\/\/images\.unsplash\.com\//i.test(imageUrl)) {
      providers.add("unsplash");
      continue;
    }

    throw new Error(
      `게시글 이미지 URL이 허용된 제공자 URL이 아닙니다: ${postTitle} → ${imageUrl}`
    );
  }

  if (providers.size < 2) {
    throw new Error(
      `게시글은 Pexels 1개 + Unsplash 1개 이미지 구성이 필요합니다: ${postTitle}`
    );
  }

  const creditCount = (String(markdown).match(/class="image-credit"/g) || [])
    .length;

  if (creditCount !== 2) {
    throw new Error(
      `게시글 이미지 출처 표시가 2개가 아닙니다: ${postTitle} → ${creditCount}개`
    );
  }
}

function sortPosts(a, b) {
  const dateCompare = new Date(b.date) - new Date(a.date);
  if (dateCompare !== 0) return dateCompare;

  return b.id.localeCompare(a.id, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function collectPosts() {
  const posts = [];

  for (const filePath of getMarkdownFiles(POSTS_DIR)) {
    const markdown = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(markdown);

    const relativePath = path.relative(POSTS_DIR, filePath);
    const pathParts = relativePath.split(path.sep);
    const board = pathParts[0];
    const id = path.basename(filePath, path.extname(filePath));

    if (!BOARDS[board]) {
      console.warn(`알 수 없는 게시판을 건너뜁니다: ${board}/${id}`);
      continue;
    }

    posts.push({
      filePath,
      sourceDir: path.dirname(filePath),
      id,
      board,
      title: data.title || "제목 없음",
      description: data.description || "",
      category: data.category || BOARDS[board].name,
      date: formatDate(data.date),
      content,
      url: `/${board}/${id}/`,
    });
  }

  return posts.sort(sortPosts);
}

function latestPostsHtml(posts, limit = 5) {
  return posts
    .slice(0, limit)
    .map(
      (post) =>
        /* html */
        `
        <li class="latest-post-item">
            <a
              href="${escapeAttribute(post.url)}"
              class="latestPostLink"
              data-spa="true"
            >
              ${escapeHtml(post.title)}
            </a>
          </li>`
    )
    .join("\n");
}

function categoryPostsHtml(posts) {
  return posts
    .map(
      (post) =>
        /* html */
        `
        <article class="postCard">
            <a
              href="${escapeAttribute(post.url)}"
              class="postCardLink"
              data-spa="true"
            >
              <div class="postCardTitle-row">
                <h2 class="postCardTitle">${escapeHtml(post.title)}</h2>
                <time
                  class="postCardDate"
                  datetime="${escapeAttribute(post.date)}"
                >
                  ${escapeHtml(post.date)}
                </time>
              </div>
              <p class="postCardDescription">${escapeHtml(post.description)}</p>
            </a>
          </article>`
    )
    .join("\n");
}

function navHtml() {
  return /* html */ `
    <div class="siteNav-inner">
      <button
        type="button"
        class="mobile-menu-toggle"
        aria-expanded="false"
        aria-controls="primary-navigation"
      >
        <span>메뉴</span>
        <span class="mobile-menu-toggle-icon" aria-hidden="true">
          <span></span><span></span><span></span>
        </span>
      </button>

      <ul id="primary-navigation" class="siteNavList">
        ${Object.entries(BOARDS)
          .map(
            ([board, info]) => `
              <li class="siteNav-item">
                <a
                  href="/${board}/"
                  class="siteNavLink"
                  data-page="${board}"
                  data-spa="true"
                >${info.name}</a>
              </li>`
          )
          .join("")}
      </ul>
    </div>`;
}

function footerHtml() {
  return /* html */ `
    <footer class="siteFooter">
      <div class="siteFooter-links">
        <a href="/pages/privacy.html" data-spa="true">개인정보처리방침</a>
      </div>
      <p>
        <small>Copyright © 2026.CozyMoney All rights reserved.</small>
      </p>
    </footer>`;
}

function adsenseScriptHtml() {
  return /* html */ `
    <script
      async
      src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}"
      crossorigin="anonymous"
    ></script>`;
}

function leftAdHtml() {
  return /* html */ `
    <aside
      class="ad-left"
      aria-label="Google AdSense 광고 영역"
    >
      <div class="adLabel">Google AdSense</div>
      <ins
        class="adsbygoogle"
        data-ad-client="${ADSENSE_CLIENT}"
        data-ad-slot="${ADSENSE_SLOT}"
        data-ad-format="auto"
        data-full-width-responsive="true"
      ></ins>
    </aside>`;
}

function rightAdHtml() {
  return /* html */ `
    <div
      class="ad-right"
      aria-label="Google AdSense 광고 영역"
    >
      <div class="adLabel">Google AdSense</div>
      <ins
        class="adsbygoogle"
        data-ad-client="${ADSENSE_CLIENT}"
        data-ad-slot="${ADSENSE_SLOT}"
        data-ad-format="auto"
        data-full-width-responsive="true"
      ></ins>
    </div>`;
}

function commonHead({ title, description, canonical, ogType = "website" }) {
  return /* html */ `
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${escapeAttribute(description)}" />
    <link rel="canonical" href="${escapeAttribute(canonical)}" />
    <meta property="og:site_name" content="CozyMoney" />
    <meta property="og:title" content="${escapeAttribute(title)}" />
    <meta property="og:description" content="${escapeAttribute(description)}" />
    <meta property="og:type" content="${escapeAttribute(ogType)}" />
    <meta property="og:url" content="${escapeAttribute(canonical)}" />
    <title>${escapeHtml(title)}</title>`;
}

function shellStart({ title, description, canonical, ogType = "website" }) {
  return /* html */ `<!doctype html>
    <html lang="ko">
      <head>
        ${commonHead({ title, description, canonical, ogType })}
        ${adsenseScriptHtml()}
        ${ogType === "article"
          ? `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.18.0/dist/katex.min.css" />`
          : ""}
        <script type="module" src="/src/main.js"></script>
      </head>
      <body class="bodyText">
        ${leftAdHtml()}

        <header class="siteHeader">
          <h1>
            <a href="/" data-spa="true" aria-label="CozyMoney 홈">
              <img
                class="site-logo"
                src="/images/logo/cozymoney_01.svg"
                alt="CozyMoney 로고"
                w="240px"
                h="60px"
              />
            </a>
          </h1>
        </header>

        <nav class="siteNav" aria-label="주요 메뉴">${navHtml()}</nav>
      </body>
    </html>
`;
}

function createCategoryHtml({ board, posts, allPosts }) {
  const info = BOARDS[board];
  const title = `${info.name} | CozyMoney`;
  const canonical = `${DOMAIN}/${board}/`;

  return /* html */ `${shellStart({
    title,
    description: info.description,
    canonical,
  })}
    <div class="siteMainLayout">
      <main id="page-content" class="siteMain">
        <section class="boardIntro">
          <p class="boardEyebrow">CozyMoney</p>
          <h1 class="boardTitle">${escapeHtml(info.name)}</h1>
          <p class="boardDescription">${escapeHtml(info.description)}</p>
        </section>

        <section id="postList" class="post-list">
          ${categoryPostsHtml(posts.slice(0, 15))}
        </section>

        <nav id="pagination" aria-label="게시글 페이지"></nav>
      </main>

      <aside class="siteSidebar">
        <nav class="asideNav" aria-label="최신 글">
          <h2 class="asideNavH2">최신 글</h2>
          <ul id="latestPosts" class="latest-post-list">
            ${latestPostsHtml(allPosts)}
          </ul>
        </nav>
        ${rightAdHtml()}
      </aside>
    </div>

    ${footerHtml()}
  </body>
</html>
`;
}

function createPostHtml(post, allPosts) {
  const title = `${post.title} | CozyMoney`;
  const canonical = `${DOMAIN}${post.url}`;

  validatePostImages(post.content, post.title);

  const contentHtml = renderMarkdown(post.content);

  return /* html */ `${shellStart({
    title,
    description: post.description,
    canonical,
    ogType: "article",
  })}
    <div class="siteMainLayout">
      <main id="page-content" class="postPageContent">
        <article class="markdownBody">
          <header class="postHeader">
            <p class="postCategory">${escapeHtml(post.category)}</p>
            <h1>${escapeHtml(post.title)}</h1>
            <time datetime="${escapeAttribute(post.date)}">${escapeHtml(post.date)}</time>
          </header>

          <div class="postContent">
            ${contentHtml}
          </div>

          <div class="post-footer">
            <a
              href="/${escapeAttribute(post.board)}/"
              class="post-back"
              data-spa="true"
            >
              ← ${escapeHtml(post.category)} 게시판 돌아가기
            </a>
          </div>
        </article>
      </main>

      <aside class="siteSidebar">
        <nav class="asideNav" aria-label="최신 글">
          <h2 class="asideNavH2">최신 글</h2>
          <ul id="latestPosts" class="latest-post-list">
            ${latestPostsHtml(allPosts)}
          </ul>
        </nav>
        ${rightAdHtml()}
      </aside>
    </div>

    ${footerHtml()}
  </body>
</html>
`;
}

function removeGeneratedBoardDirs() {
  for (const board of Object.keys(BOARDS)) {
    fs.rmSync(path.join(ROOT_DIR, board), {
      recursive: true,
      force: true,
    });

    fs.rmSync(path.join(PUBLIC_DIR, board), {
      recursive: true,
      force: true,
    });
  }
}

function removeGeneratedCategoryPages() {
  for (const board of Object.keys(BOARDS)) {
    fs.rmSync(path.join(ROOT_DIR, "pages", `${board}.html`), {
      force: true,
    });
  }
}

// ========================================
// RSS
// ========================================

function escapeXml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatRssDate(date) {
  if (!date) {
    return new Date().toUTCString();
  }

  /*
    현재 게시글 날짜는 YYYY-MM-DD 형태이므로
    한국 시간 기준 자정으로 해석한다.
  */

  const parsed = new Date(`${date}T00:00:00+09:00`);

  if (Number.isNaN(parsed.getTime())) {
    return new Date().toUTCString();
  }

  return parsed.toUTCString();
}

function markdownToPlainText(markdown = "") {
  return (
    String(markdown)
      // 이미지
      .replace(/!\[.*?\]\(.*?\)/g, "")
      // 링크
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // HTML 태그
      .replace(/<[^>]*>/g, "")
      // 코드 블록
      .replace(/```[\s\S]*?```/g, "")
      // 인라인 코드
      .replace(/`([^`]+)`/g, "$1")
      // 제목
      .replace(/^#{1,6}\s+/gm, "")
      // 강조
      .replace(/[*_~]/g, "")
      // 여러 줄바꿈
      .replace(/\s+/g, " ")
      .trim()
  );
}

function createRss(posts) {
  const rssItems = posts
    .slice(0, 50)
    .map((post) => {
      const url = `${DOMAIN}${post.url}`;

      const description =
        post.description || markdownToPlainText(post.content).slice(0, 300);

      return /* html */ `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <description>${escapeXml(description)}</description>
      <pubDate>${escapeXml(formatRssDate(post.date))}</pubDate>
      <category>${escapeXml(post.category)}</category>
    </item>`;
    })
    .join("\n");

  return /* html */ `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
    xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <atom:link
      href="${DOMAIN}/rss.xml"
      rel="self"
      type="application/rss+xml"
    />
    <title>CozyMoney</title>
    <link>${DOMAIN}/</link>
    <description>주식, 부동산, 세테크, 보험, 전산세무 정보를 제공하는 코지머니(CozyMoney)</description>
    <language>ko</language>
    <copyright>Copyright © 2026 CozyMoney</copyright>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <ttl>60</ttl>
${rssItems}
  </channel>
</rss>
`;
}

function writeRss(posts) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  const rss = createRss(posts);

  fs.writeFileSync(path.join(PUBLIC_DIR, "rss.xml"), rss, "utf-8");
}

function writePostsJson(posts) {
  const dataDir = path.join(PUBLIC_DIR, "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const postList = posts.map(
    ({ id, board, title, description, category, date, url }) => ({
      id,
      board,
      title,
      description,
      category,
      date,
      url,
    })
  );

  fs.writeFileSync(
    path.join(dataDir, "posts.json"),
    JSON.stringify(postList, null, 2),
    "utf-8"
  );
}

const posts = collectPosts();

removeGeneratedBoardDirs();
removeGeneratedCategoryPages();

for (const post of posts) {
  const outputDir = path.join(ROOT_DIR, post.board, post.id);

  fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(
    path.join(outputDir, "index.html"),
    createPostHtml(post, posts),
    "utf-8"
  );
}

for (const board of Object.keys(BOARDS)) {
  const boardPosts = posts
    .filter((post) => post.board === board)
    .sort(sortPosts);

  const outputDir = path.join(ROOT_DIR, board);

  fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(
    path.join(outputDir, "index.html"),
    createCategoryHtml({
      board,
      posts: boardPosts,
      allPosts: posts,
    }),
    "utf-8"
  );
}

writePostsJson(posts);
writeRss(posts);

console.log(`Markdown 게시글 ${posts.length}개 발견`);
console.log(`게시글 HTML ${posts.length}개 생성 완료`);
console.log(`카테고리 HTML ${Object.keys(BOARDS).length}개 생성 완료`);
console.log("posts.json 생성 완료");
console.log("rss.xml 생성 완료");
