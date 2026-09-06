import { config } from "./config.js";
import { logInfo, logWarning } from "./logger.js";

const CATEGORY_SEARCH_TERMS = {
  stock: ["stock market", "investment", "financial market"],
  tax: ["tax", "tax filing", "personal finance"],
  accounting: ["accounting", "financial statements", "business finance"],
};

const BLOCKED_TERMS = [
  "weapon",
  "gun",
  "casino",
  "gambling",
  "betting",
  "porn",
  "nude",
  "sexual",
  "alcohol",
  "beer",
  "wine",
  "whisky",
  "marijuana",
  "cigarette",
  "smoking",
  "politician",
  "celebrity",
  "violence",
];

function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value = "") {
  return new Set(
    normalizeText(value)
      .split(/[\s-]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2),
  );
}

function getTopicKeywords(article) {
  const topic = article?.topic || {};
  const keywords = Array.isArray(topic.keywords) ? topic.keywords : [];

  return [topic.title, ...keywords]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function getSearchQueries(article) {
  const topic = article?.topic || {};
  const category = topic.category || "stock";
  const keywords = getTopicKeywords(article);
  const categoryTerms = CATEGORY_SEARCH_TERMS[category] || ["finance"];

  const title = String(topic.title || "").trim();
  const keywordQuery = keywords.slice(0, 3).join(" ").trim();

  const queries = [
    title,
    keywordQuery,
    `${categoryTerms[0]} ${categoryTerms[1] || "finance"}`,
  ];

  return [...new Set(queries.map((query) => query.trim()).filter(Boolean))].slice(
    0,
    2,
  );
}

function isBlockedPhoto(photo) {
  const haystack = normalizeText(
    [photo.alt, photo.url, photo.photographer].filter(Boolean).join(" "),
  );

  return BLOCKED_TERMS.some((term) => haystack.includes(term));
}

function scorePhoto(photo, article, selectedIds) {
  if (!photo?.id || !photo?.src?.landscape || isBlockedPhoto(photo)) {
    return Number.NEGATIVE_INFINITY;
  }

  if (selectedIds.has(String(photo.id))) {
    return Number.NEGATIVE_INFINITY;
  }

  const topicTerms = tokenize(getTopicKeywords(article).join(" "));
  const photoTerms = tokenize(`${photo.alt || ""} ${photo.photographer || ""}`);

  let score = 0;

  for (const term of topicTerms) {
    if (photoTerms.has(term)) {
      score += 12;
    }
  }

  const width = Number(photo.width) || 0;
  const height = Number(photo.height) || 0;

  if (width > height && width >= 1200) score += 8;
  if (width / Math.max(height, 1) >= 1.5) score += 5;

  // Pexels 검색 자체가 relevance 정렬을 제공하므로 결과 순서도 반영한다.
  const position = Number(photo.__searchPosition) || 0;
  score += Math.max(0, 8 - position * 0.2);

  return score;
}

async function searchPexels(query) {
  const apiKey = process.env.PEXELS_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("PEXELS_API_KEY 환경변수가 없습니다.");
  }

  const params = new URLSearchParams({
    query,
    orientation: "landscape",
    size: "large",
    locale: "ko-KR",
    page: "1",
    per_page: String(config.images.candidateCount),
  });

  const response = await fetch(
    `https://api.pexels.com/v1/search?${params.toString()}`,
    {
      headers: {
        Authorization: apiKey,
      },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Pexels 이미지 검색 실패: ${response.status} ${text}`);
  }

  const data = await response.json();

  return Array.isArray(data?.photos)
    ? data.photos.map((photo, index) => ({
        ...photo,
        __searchPosition: index,
      }))
    : [];
}

function selectPhotos(photos, article) {
  const maxImages = Math.min(
    2,
    Math.max(1, Number(config.images.maxPerArticle) || 2),
  );

  const selected = [];
  const selectedIds = new Set();

  while (selected.length < maxImages) {
    const candidates = photos
      .map((photo) => ({
        photo,
        score: scorePhoto(photo, article, selectedIds),
      }))
      .filter((item) => Number.isFinite(item.score))
      .sort((a, b) => b.score - a.score);

    const best = candidates[0]?.photo;

    if (!best) break;

    selected.push(best);
    selectedIds.add(String(best.id));
  }

  return selected;
}

function createImageAlt(article, index, photo) {
  const title = article?.topic?.title || "CozyMoney 정보글";
  const photoAlt = String(photo?.alt || "").trim();

  if (photoAlt) {
    return `${title} 관련 이미지 ${index + 1} - ${photoAlt}`.slice(0, 180);
  }

  return `${title} 관련 이미지 ${index + 1}`;
}

function createImageMarkdown(article, photos) {
  const title = article?.topic?.title || "CozyMoney 정보글";

  return photos
    .map((photo, index) => {
      const imageUrl = photo.src.landscape;
      const photoUrl = photo.url;
      const photographer = photo.photographer || "Pexels 사진가";
      const alt = createImageAlt(article, index, photo);

      return [
        `![${alt}](${imageUrl})`,
        "",
        `<small>Photo by [${photographer}](${photoUrl}) on [Pexels](https://www.pexels.com/)</small>`,
      ].join("\n");
    })
    .join("\n\n");
}

function insertImagesIntoMarkdown(markdown, article, photos) {
  if (!photos.length) return markdown;

  const imageMarkdown = createImageMarkdown(article, photos);
  const lines = String(markdown).split("\n");
  const firstH2Index = lines.findIndex((line) => /^##\s+/.test(line));

  if (firstH2Index === -1) {
    return `${markdown.trim()}\n\n${imageMarkdown}`;
  }

  lines.splice(firstH2Index, 0, imageMarkdown, "");
  return lines.join("\n");
}

export async function generateArticleImages(article) {
  if (!article || typeof article !== "object") {
    throw new Error("이미지를 검색할 article이 올바르지 않습니다.");
  }

  const title = article.topic?.title || "제목 없음";
  const queries = getSearchQueries(article);
  const allPhotos = [];
  const seenIds = new Set();

  for (const query of queries) {
    try {
      logInfo(`Pexels 이미지 검색: ${title} / "${query}"`);
      const photos = await searchPexels(query);

      for (const photo of photos) {
        const id = String(photo.id);
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        allPhotos.push(photo);
      }

      if (allPhotos.length >= config.images.minCandidateCount) {
        break;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logWarning(`Pexels 검색 실패: ${title} / "${query}"`, message);
    }
  }

  const selectedPhotos = selectPhotos(allPhotos, article);

  if (selectedPhotos.length < config.images.minPerArticle) {
    throw new Error(
      `게시글에 사용할 Pexels 이미지를 충분히 찾지 못했습니다: ${title}`,
    );
  }

  const images = selectedPhotos.map((photo, index) => ({
    provider: "pexels",
    id: String(photo.id),
    url: photo.src.landscape,
    publicPath: photo.src.landscape,
    sourceUrl: photo.url,
    photographer: photo.photographer || "Pexels 사진가",
    alt: createImageAlt(article, index, photo),
    width: Number(photo.width) || null,
    height: Number(photo.height) || null,
  }));

  logInfo(`Pexels 이미지 선택 완료: ${title} (${images.length}개)`);

  return {
    ...article,
    markdown: insertImagesIntoMarkdown(article.markdown, article, selectedPhotos),
    images,
  };
}
