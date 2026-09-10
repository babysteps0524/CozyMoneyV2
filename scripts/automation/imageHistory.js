import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

import { config } from "./config.js";

function getKoreanToday() {
  return new Date(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
  );
}

function getCutoffDate(days) {
  const today = getKoreanToday();

  today.setDate(today.getDate() - days);

  return today;
}

function normalizeImageUrl(url) {
  if (!url) return "";

  try {
    const parsed = new URL(String(url));

    /*
     * 이미지 자체를 식별하는 핵심 pathname만 사용한다.
     *
     * Pexels:
     * /photos/123456/...
     *
     * Unsplash:
     * /photo-xxxxxxxx
     *
     * query string은 크기, 품질 등의 값이므로 제거한다.
     */
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return "";
  }
}

function extractImageUrls(markdown) {
  const urls = [];

  const regex = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g;

  let match;

  while ((match = regex.exec(markdown)) !== null) {
    const normalized = normalizeImageUrl(match[1]);

    if (normalized) {
      urls.push(normalized);
    }
  }

  return urls;
}

function walkMarkdownFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const files = [];

  for (const entry of fs.readdirSync(directory, {
    withFileTypes: true,
  })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkMarkdownFiles(fullPath));
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

function parsePostDate(filePath, markdown) {
  try {
    const { data } = matter(markdown);

    if (data?.date) {
      const date = new Date(`${data.date}T00:00:00+09:00`);

      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }
  } catch {
    // frontmatter 파싱 실패 시 파일명 날짜 사용
  }

  /*
   * 파일명 예:
   *
   * 260831-1.md
   */
  const fileName = path.basename(filePath);

  const matched = fileName.match(/^(\d{2})(\d{2})(\d{2})-\d+\.md$/);

  if (!matched) {
    return null;
  }

  const [, year, month, day] = matched;

  const date = new Date(`20${year}-${month}-${day}T00:00:00+09:00`);

  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * 최근 N일 동안 사용된 이미지 목록을 가져온다.
 */
export function loadRecentUsedImages(days = config.images.historyDays) {
  const cutoffDate = getCutoffDate(days);

  const files = walkMarkdownFiles(config.postsDir);

  const usedImages = new Set();

  for (const filePath of files) {
    try {
      const markdown = fs.readFileSync(filePath, "utf8");

      const postDate = parsePostDate(filePath, markdown);

      if (!postDate) {
        continue;
      }

      if (postDate < cutoffDate) {
        continue;
      }

      const imageUrls = extractImageUrls(markdown);

      for (const imageUrl of imageUrls) {
        usedImages.add(imageUrl);
      }
    } catch {
      /*
       * 특정 게시글 파일 읽기 실패는
       * 전체 자동 포스팅을 중단하지 않는다.
       */
    }
  }

  return usedImages;
}

export function isRecentlyUsedImage(imageUrl, usedImages) {
  if (!(usedImages instanceof Set)) {
    return false;
  }

  const normalized = normalizeImageUrl(imageUrl);

  if (!normalized) {
    return false;
  }

  return usedImages.has(normalized);
}

export function addUsedImage(imageUrl, usedImages) {
  if (!(usedImages instanceof Set)) {
    return;
  }

  const normalized = normalizeImageUrl(imageUrl);

  if (normalized) {
    usedImages.add(normalized);
  }
}
