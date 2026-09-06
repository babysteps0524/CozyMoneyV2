import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const DOMAIN = "https://cozymoney.kr";
const POSTS_DIR = path.resolve("src/data/posts");

const SITEMAP_FILE = path.resolve("public/sitemap.xml");
const RSS_FILE = path.resolve("public/rss.xml");

const BOARD_NAMES = ["stock", "tax", "fanancialAccounting"];

/* =========================================================
  XML 특수문자 처리
========================================================= */

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/* =========================================================
  Markdown 파일 찾기
========================================================= */

async function getMarkdownFiles(directory) {
  const files = [];

  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await getMarkdownFiles(fullPath)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

/* =========================================================
  Markdown front matter 읽기
========================================================= */

function parseFrontMatter(markdown) {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---/);

  if (!match) {
    return {};
  }

  const frontMatter = match[1];
  const data = {};

  for (const line of frontMatter.split("\n")) {
    const match = line.match(/^([^:]+):\s*(.*)$/);

    if (!match) continue;

    const key = match[1].trim();
    let value = match[2].trim();

    // 앞뒤 따옴표 제거
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    data[key] = value;
  }

  return data;
}

/* =========================================================
  게시글 정보 수집
========================================================= */

const markdownFiles = await getMarkdownFiles(POSTS_DIR);

const posts = [];

for (const filePath of markdownFiles) {
  const relativePath = path.relative(POSTS_DIR, filePath);
  const parts = relativePath.split(path.sep);

  const board = parts[0];
  const postId = path.basename(filePath, ".md");

  if (!BOARD_NAMES.includes(board)) continue;

  const markdown = await readFile(filePath, "utf-8");
  const frontMatter = parseFrontMatter(markdown);

  const title = frontMatter.title || postId;
  const date = frontMatter.date || "";
  const category = frontMatter.category || "";
  const description = frontMatter.description || "";

  const url = `${DOMAIN}/${board}/${postId}/`;

  posts.push({
    board,
    postId,
    title,
    date,
    category,
    description,
    url,
  });
}

/* =========================================================
  날짜순 정렬
  최신 글이 먼저 오도록 정렬
========================================================= */

posts.sort((a, b) => {
  return new Date(b.date) - new Date(a.date);
});

/* =========================================================
  Sitemap 생성
========================================================= */

const urls = [
  { loc: `${DOMAIN}/`, priority: "1.0" },

  ...BOARD_NAMES.map((board) => ({
    loc: `${DOMAIN}/${board}/`,
    priority: "0.8",
  })),

  {
    loc: `${DOMAIN}/pages/privacy.html`,
    priority: "0.3",
  },

  ...posts.map((post) => ({
    loc: post.url,
    priority: "0.6",
  })),
];

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    ({ loc, priority }) => `  <url>
    <loc>${escapeXml(loc)}</loc>
    <priority>${priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;

/* =========================================================
  RSS 날짜 변환
========================================================= */

function formatRssDate(dateString) {
  if (!dateString) return "";

  // YYYY-MM-DD 형식이라고 가정하고 한국 시간 기준으로 처리
  const date = new Date(`${dateString}T00:00:00+09:00`);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toUTCString();
}

/* =========================================================
  RSS Item 생성
========================================================= */

const rssItems = posts
  .map((post) => {
    const pubDate = formatRssDate(post.date);

    return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(post.url)}</link>
      <guid isPermaLink="true">${escapeXml(post.url)}</guid>
      <description>${escapeXml(post.description)}</description>
      ${post.category ? `<category>${escapeXml(post.category)}</category>` : ""}
      ${pubDate ? `<pubDate>${pubDate}</pubDate>` : ""}
    </item>`;
  })
  .join("\n");

/* =========================================================
  RSS 생성
========================================================= */

const latestPostDate = posts.find((post) => post.date)?.date || "";

const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>CozyMoney</title>
    <link>${DOMAIN}/</link>
    <description>주식, 세금, 재무회계 정보를 쉽고 편하게 정리하는 CozyMoney</description>
    <language>ko</language>
    ${
      latestPostDate
        ? `<lastBuildDate>${formatRssDate(latestPostDate)}</lastBuildDate>`
        : ""
    }
${rssItems}
  </channel>
</rss>
`;

/* =========================================================
  파일 저장
========================================================= */

await mkdir(path.dirname(SITEMAP_FILE), { recursive: true });

await writeFile(SITEMAP_FILE, sitemapXml, "utf-8");
await writeFile(RSS_FILE, rssXml, "utf-8");

/* =========================================================
  결과 출력
========================================================= */

console.log(`sitemap.xml 생성 완료: ${urls.length}개 URL`);
console.log(`rss.xml 생성 완료: ${posts.length}개 게시글`);
console.log(`게시글 ${markdownFiles.length}개 발견`);
