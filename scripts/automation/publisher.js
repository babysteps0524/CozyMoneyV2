import fs from "node:fs";
import path from "node:path";

import { config } from "./config.js";
import { logInfo, logWarning } from "./logger.js";

function getKoreanDateParts() {
  const fullDate = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    dateStyle: "short",
  }).format(new Date());

  return {
    fullDate,
    filePrefix: fullDate.replaceAll("-", "").slice(2),
  };
}

function getArticleCategory(article) {
  const category = article?.topic?.category;

  if (typeof category !== "string" || !category.trim()) {
    throw new Error(
      `게시글 category 값이 없습니다. 제목: ${
        article?.topic?.title ?? "제목 없음"
      }`
    );
  }

  if (!config.categories[category]) {
    throw new Error(`지원하지 않는 게시글 카테고리입니다: ${category}`);
  }

  return category;
}

function getOutputDirectory(article) {
  const category = getArticleCategory(article);

  return path.join(config.postsDir, category);
}

function getNextPostId(directory, filePrefix) {
  if (!fs.existsSync(directory)) {
    return `${filePrefix}-1`;
  }

  const existingNumbers = fs
    .readdirSync(directory)
    .map((fileName) => {
      const matched = fileName.match(new RegExp(`^${filePrefix}-(\\d+)\\.md$`));

      return matched ? Number(matched[1]) : 0;
    })
    .filter((number) => Number.isFinite(number));

  const nextNumber = Math.max(0, ...existingNumbers) + 1;

  return `${filePrefix}-${nextNumber}`;
}

function writeMarkdownFile(directory, fileName, markdown) {
  fs.mkdirSync(directory, {
    recursive: true,
  });

  const filePath = path.join(directory, fileName);

  fs.writeFileSync(filePath, markdown, {
    encoding: "utf8",
    flag: "wx",
  });

  return filePath;
}

/**
 * 게시글 이미지 메타데이터와 외부 URL을 검증한다.
 *
 * 허용 구성:
 * - Pexels 1 + Unsplash 1
 * - Pexels 2
 * - Unsplash 2
 *
 * 이미지를 로컬 파일로 저장하지 않는다.
 */
function prepareArticleImages(article) {
  if (!Array.isArray(article.images) || article.images.length !== 2) {
    throw new Error("게시글 이미지는 정확히 2개여야 합니다.");
  }

  const preparedImages = [];

  for (const image of article.images) {
    if (image?.provider === "pexels") {
      if (
        !image?.publicPath ||
        !/^https:\/\/(?:images\.)?pexels\.com\//i.test(image.publicPath)
      ) {
        throw new Error(
          `허용되지 않은 Pexels 이미지 URL입니다: ${
            image?.publicPath || "없음"
          }`
        );
      }

      if (
        !image?.sourceUrl ||
        !/^https:\/\/www\.pexels\.com\//i.test(image.sourceUrl)
      ) {
        throw new Error(
          `Pexels 원본 URL이 올바르지 않습니다: ${image?.sourceUrl || "없음"}`
        );
      }

      if (!image?.photographer) {
        throw new Error("Pexels 사진가 정보가 없습니다.");
      }
    } else if (image?.provider === "unsplash") {
      if (
        !image?.publicPath ||
        !/^https:\/\/images\.unsplash\.com\//i.test(image.publicPath)
      ) {
        throw new Error(
          `허용되지 않은 Unsplash 이미지 URL입니다: ${
            image?.publicPath || "없음"
          }`
        );
      }

      if (
        !image?.sourceUrl ||
        !/^https:\/\/(?:www\.)?unsplash\.com\//i.test(image.sourceUrl)
      ) {
        throw new Error(
          `Unsplash 원본 URL이 올바르지 않습니다: ${image?.sourceUrl || "없음"}`
        );
      }

      if (!image?.photographer) {
        throw new Error("Unsplash 사진가 정보가 없습니다.");
      }
    } else {
      throw new Error(
        `지원하지 않는 이미지 제공자입니다: ${image?.provider ?? "없음"}`
      );
    }

    preparedImages.push({ ...image });
  }

  return preparedImages;
}

export function publishArticles(articles, options = {}) {
  if (!Array.isArray(articles)) {
    throw new Error("게시할 articles가 배열이 아닙니다.");
  }

  if (articles.length === 0) {
    return { publishedArticles: [], failedArticles: [] };
  }

  const allowPartialPublishing = options.allowPartialPublishing !== false;
  const { filePrefix } = getKoreanDateParts();

  const publishedArticles = [];
  const failedArticles = [];
  const nextIdsByDirectory = new Map();

  for (const article of articles) {
    const title = article?.topic?.title ?? "제목 없음";

    try {
      const outputDirectory = getOutputDirectory(article);

      let postId = nextIdsByDirectory.get(outputDirectory);

      if (!postId) {
        postId = getNextPostId(outputDirectory, filePrefix);
      }

      const currentNumber = Number(postId.split("-").at(-1));
      const nextNumber = currentNumber + 1;
      nextIdsByDirectory.set(outputDirectory, `${filePrefix}-${nextNumber}`);

      const fileName = `${postId}.md`;
      const images = prepareArticleImages(article);
      const markdown = article.markdown;

      const filePath = writeMarkdownFile(outputDirectory, fileName, markdown);
      const relativeFilePath = path
        .relative(config.rootDir, filePath)
        .replaceAll("\\", "/");

      const publishedArticle = {
        ...article,
        postId,
        filePath,
        relativeFilePath,
        images,
        markdown,
      };

      publishedArticles.push(publishedArticle);
      logInfo(`Markdown 파일을 저장했습니다: ${relativeFilePath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      failedArticles.push({
        title,
        error: message,
      });

      logWarning(`게시 실패: ${title}`, message);

      if (!allowPartialPublishing) {
        throw error;
      }
    }
  }

  return {
    publishedArticles,
    failedArticles,
  };
}

export function rollbackPublishedArticles(publishedArticles) {
  if (!Array.isArray(publishedArticles)) {
    return;
  }

  for (const article of publishedArticles) {
    const category = getArticleCategory(article);

    const expectedDirectory = path.resolve(config.postsDir, category);

    const targetPath = path.resolve(article.filePath);

    if (!targetPath.startsWith(expectedDirectory + path.sep)) {
      throw new Error(`롤백 대상 경로가 올바르지 않습니다: ${targetPath}`);
    }

    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);

      logInfo(`빌드 실패 글을 되돌렸습니다: ${article.relativeFilePath}`);
    }
  }
}
