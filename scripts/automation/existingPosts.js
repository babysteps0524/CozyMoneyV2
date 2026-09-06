import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { config } from "./config.js";

function findMarkdownFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const files = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...findMarkdownFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

function toText(value) {
  if (Array.isArray(value)) {
    return value.map(String).join(", ");
  }

  return String(value ?? "").trim();
}

function extractHeadings(markdown) {
  return [...markdown.matchAll(/^#{2,3}\s+(.+)$/gm)]
    .map((match) => match[1].trim())
    .filter(Boolean);
}

function createSummary(markdown, maximumLength = 500) {
  return markdown
    .replace(/^#{1,6}\s+.+$/gm, "")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_>#|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximumLength);
}

function normalizeKeywords(keywords) {
  if (Array.isArray(keywords)) {
    return keywords
      .map(String)
      .map((keyword) => keyword.trim())
      .filter(Boolean);
  }

  return String(keywords ?? "")
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function parsePost(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);

  const relativePath = path.relative(config.postsDir, filePath);
  const pathParts = relativePath.split(path.sep);
  const board = pathParts[0];
  const slug = path.basename(filePath, ".md");

  return {
    title: toText(data.title) || slug,
    category: toText(data.category) || config.categories[board]?.name || board,

    slug: toText(data.slug) || slug,

    keywords: normalizeKeywords(data.keywords),

    summary: toText(data.summary) || createSummary(content),

    headings: extractHeadings(content),

    searchIntent: toText(data.searchIntent) || toText(data.search_intent),

    mainQuestions: Array.isArray(data.mainQuestions)
      ? data.mainQuestions
          .map(String)
          .map((item) => item.trim())
          .filter(Boolean)
      : Array.isArray(data.main_questions)
        ? data.main_questions
            .map(String)
            .map((item) => item.trim())
            .filter(Boolean)
        : [],

    publishedDate:
      toText(data.publishedDate) ||
      toText(data.published_date) ||
      toText(data.date),

    date: toText(data.date),

    board,

    filePath: relativePath.replaceAll("\\", "/"),
  };
}

export function loadExistingPosts() {
  return findMarkdownFiles(config.postsDir)
    .map(parsePost)
    .sort((first, second) => second.date.localeCompare(first.date));
}

export function createExistingPostsContext(posts) {
  return posts
    .map((post) =>
      [
        `[${post.board}] ${post.title}`,
        `slug: ${post.slug}`,
        `키워드: ${post.keywords.join(", ") || "없음"}`,
        `검색 의도: ${post.searchIntent || "정보 없음"}`,
        `주요 질문: ${post.mainQuestions.join(" / ") || "정보 없음"}`,
        `소제목: ${post.headings.join(" / ") || "없음"}`,
        `요약: ${post.summary}`,
        `게시일: ${post.publishedDate || "정보 없음"}`,
      ].join("\n"),
    )
    .join("\n\n---\n\n");
}
