import { config } from "./config.js";

import { logInfo, logWarning } from "./logger.js";

import { isRecentlyUsedImage } from "./imageHistory.js";

const CATEGORY_SEARCH_TERMS = {
  stock: "stock market investment finance",
  tax: "tax personal finance government",
  accounting: "accounting financial statements business finance",
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

/*
 * 인물/얼굴 이미지 차단용 키워드
 *
 * Pexels / Unsplash API가 얼굴 감지 결과를 제공하지 않기 때문에
 * alt / description / tags / photographer 등의 메타데이터를 이용하여
 * 인물 사진 후보를 최대한 제거한다.
 */
const PERSON_BLOCKED_TERMS = [
  // 영어
  "person",
  "people",
  "human",
  "man",
  "men",
  "woman",
  "women",
  "boy",
  "boys",
  "girl",
  "girls",
  "child",
  "children",
  "baby",
  "portrait",
  "face",
  "faces",
  "headshot",
  "selfie",
  "model",
  "actor",
  "actress",
  "employee",
  "employees",
  "worker",
  "workers",
  "customer",
  "customers",
  "client",
  "clients",
  "student",
  "students",
  "teacher",
  "teachers",
  "doctor",
  "doctors",
  "lawyer",
  "lawyers",
  "accountant",
  "accountants",
  "investor",
  "investors",
  "trader",
  "traders",
  "businessman",
  "businessmen",
  "businesswoman",
  "businesswomen",
  "executive",
  "executives",
  "professional",
  "professionals",
  "speaker",
  "speakers",
  "politician",
  "politicians",
  "celebrity",
  "celebrities",
  "influencer",
  "influencers",
  "crowd",
  "audience",
  "family",
  "couple",
  "group",
  "team",
  "staff",
  "colleague",
  "colleagues",

  // 한국어
  "사람",
  "인물",
  "남성",
  "여성",
  "남자",
  "여자",
  "아이",
  "어린이",
  "아기",
  "얼굴",
  "초상",
  "초상화",
  "셀카",
  "모델",
  "배우",
  "직원",
  "근로자",
  "고객",
  "손님",
  "학생",
  "교사",
  "선생님",
  "의사",
  "변호사",
  "회계사",
  "투자자",
  "트레이더",
  "사업가",
  "임원",
  "전문가",
  "강연자",
  "정치인",
  "연예인",
  "인플루언서",
  "군중",
  "관중",
  "가족",
  "커플",
  "부부",
  "그룹",
  "팀",
  "직장동료",
];

const PROVIDERS = {
  PEXELS: "pexels",
  UNSPLASH: "unsplash",
};

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

/*
 * 인물 이미지를 피하기 위해 검색어에
 * "no people / no person" 조건을 추가한다.
 *
 * API가 이 조건을 강제로 보장하는 것은 아니므로
 * 이후 메타데이터 필터도 함께 적용한다.
 */
function getSearchQuery(article) {
  const topic = article?.topic || {};

  const categoryTerms =
    CATEGORY_SEARCH_TERMS[topic.category] || "finance business";

  const keywords = getTopicKeywords(article).slice(0, 3).join(" ");

  return `${keywords} ${categoryTerms} no people no person`
    .replace(/\s+/g, " ")
    .trim();
}

/*
 * 사진 메타데이터를 하나의 문자열로 만든다.
 */
function getPhotoMetadataText(photo) {
  return normalizeText(
    [
      photo?.alt,
      photo?.alt_description,
      photo?.description,
      photo?.photographer,
      photo?.user?.name,

      ...(Array.isArray(photo?.tags)
        ? photo.tags.map((tag) => {
            if (typeof tag === "string") return tag;
            return tag?.title || tag?.name || "";
          })
        : []),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

/*
 * 기존 위험 이미지 필터
 */
function isBlockedPhoto(photo) {
  const haystack = normalizeText(
    [
      photo?.alt,
      photo?.alt_description,
      photo?.description,
      photo?.url,
      photo?.photographer,
      photo?.user?.name,

      ...(Array.isArray(photo?.tags)
        ? photo.tags.map((tag) => {
            if (typeof tag === "string") return tag;
            return tag?.title || tag?.name || "";
          })
        : []),
    ]
      .filter(Boolean)
      .join(" "),
  );

  return BLOCKED_TERMS.some((term) => {
    return haystack.includes(normalizeText(term));
  });
}

/*
 * 인물 이미지 필터
 *
 * 사진의 alt / description / tags 등에
 * 인물과 관련된 단어가 하나라도 있으면 제외한다.
 */
function isPersonPhoto(photo) {
  const haystack = getPhotoMetadataText(photo);

  if (!haystack) {
    return false;
  }

  return PERSON_BLOCKED_TERMS.some((term) => {
    const normalizedTerm = normalizeText(term);

    if (!normalizedTerm) return false;

    /*
     * 한국어는 포함 여부,
     * 영어는 단어 단위에 가까운 방식으로 검사한다.
     */
    if (/^[a-z0-9 -]+$/i.test(normalizedTerm)) {
      const words = new Set(
        haystack
          .split(/\s+/)
          .map((word) => word.trim())
          .filter(Boolean),
      );

      return words.has(normalizedTerm);
    }

    return haystack.includes(normalizedTerm);
  });
}

/*
 * 최종 이미지 사용 가능 여부
 */
function isUsablePhoto(photo) {
  if (!photo) return false;

  if (isBlockedPhoto(photo)) {
    return false;
  }

  if (isPersonPhoto(photo)) {
    return false;
  }

  const imageUrl = getImageUrl(photo);

  if (!imageUrl) {
    return false;
  }

  return true;
}

function scorePhoto(photo, article, selectedIds) {
  const id = photo?.id ? String(photo.id) : "";

  if (!id || selectedIds.has(id)) {
    return Number.NEGATIVE_INFINITY;
  }

  if (!isUsablePhoto(photo)) {
    return Number.NEGATIVE_INFINITY;
  }

  const imageUrl = getImageUrl(photo);

  if (!imageUrl) {
    return Number.NEGATIVE_INFINITY;
  }

  const topicTerms = tokenize(getTopicKeywords(article).join(" "));

  const photoTerms = tokenize(getPhotoMetadataText(photo));

  let score = 0;

  for (const term of topicTerms) {
    if (photoTerms.has(term)) {
      score += 12;
    }
  }

  const width = Number(photo.width) || 0;
  const height = Number(photo.height) || 0;

  const ratio = width / Math.max(height, 1);

  if (width >= 1200) {
    score += 8;
  }

  if (ratio >= 1.5) {
    score += 8;
  }

  if (ratio >= 1.7) {
    score += 4;
  }

  const position = Number(photo.__searchPosition) || 0;

  score += Math.max(0, 10 - position * 0.25);

  /*
   * 인물 차단을 통과한 이미지에는 추가 점수를 주지 않는다.
   * 실제 얼굴 유무는 API 메타데이터만으로 100% 판단할 수 없기 때문이다.
   */

  return score;
}

async function fetchJson(response) {
  return response.json().catch(() => null);
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

  const data = await fetchJson(response);

  if (!response.ok) {
    throw new Error(data?.error || `Pexels API 오류: HTTP ${response.status}`);
  }

  return Array.isArray(data?.photos)
    ? data.photos.map((photo, index) => ({
        ...photo,
        provider: PROVIDERS.PEXELS,
        __searchPosition: index,
      }))
    : [];
}

async function searchUnsplash(query) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY?.trim();

  if (!accessKey) {
    throw new Error("UNSPLASH_ACCESS_KEY 환경변수가 없습니다.");
  }

  const params = new URLSearchParams({
    query,
    orientation: "landscape",
    content_filter: "high",
    order_by: "relevant",
    page: "1",
    per_page: String(config.images.candidateCount),
  });

  const response = await fetch(
    `https://api.unsplash.com/search/photos?${params.toString()}`,
    {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
        "Accept-Version": "v1",
      },
    },
  );

  const data = await fetchJson(response);

  if (!response.ok) {
    throw new Error(
      data?.errors?.join(", ") || `Unsplash API 오류: HTTP ${response.status}`,
    );
  }

  return Array.isArray(data?.results)
    ? data.results.map((photo, index) => ({
        ...photo,
        provider: PROVIDERS.UNSPLASH,
        __searchPosition: index,
      }))
    : [];
}

function createImageAlt(article, index, photo) {
  const title = article?.topic?.title || "CozyMoney 정보글";

  const providerAlt =
    photo?.alt || photo?.alt_description || photo?.description || "";

  return `${title} 관련 이미지 ${index + 1}${
    providerAlt ? ` - ${providerAlt}` : ""
  }`.slice(0, 180);
}

function createPexelsCredit(photo) {
  const photographer = escapeMarkdownText(
    photo?.photographer || "Pexels 사진가",
  );

  const sourceUrl = photo?.url || "https://www.pexels.com/";

  return `<small class="image-credit">Photo by [${photographer}](${sourceUrl}) on [Pexels](https://www.pexels.com/)</small>`;
}

function createUnsplashCredit(photo) {
  const photographer = escapeMarkdownText(
    photo?.user?.name || "Unsplash 사진가",
  );

  const username = photo?.user?.username || "";

  const profileUrl = username
    ? `https://unsplash.com/@${encodeURIComponent(
        username,
      )}?utm_source=cozymoney&utm_medium=referral`
    : photo?.user?.links?.html
      ? `${photo.user.links.html}?utm_source=cozymoney&utm_medium=referral`
      : "https://unsplash.com/?utm_source=cozymoney&utm_medium=referral";

  const unsplashUrl =
    "https://unsplash.com/?utm_source=cozymoney&utm_medium=referral";

  return `<small class="image-credit">Photo by [${photographer}](${profileUrl}) on [Unsplash](${unsplashUrl})</small>`;
}

function escapeMarkdownText(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]")
    .replaceAll("<", "")
    .replaceAll(">", "")
    .trim();
}

function getImageUrl(photo) {
  if (photo.provider === PROVIDERS.PEXELS) {
    return photo?.src?.landscape || photo?.src?.large2x || photo?.src?.large;
  }

  return photo?.urls?.regular || photo?.urls?.full;
}

function getSourceUrl(photo) {
  if (photo.provider === PROVIDERS.PEXELS) {
    return photo?.url || "https://www.pexels.com/";
  }

  return photo?.links?.html || "https://unsplash.com/";
}

function createImageMarkdown(article, photos) {
  return photos
    .map((photo, index) => {
      const imageUrl = getImageUrl(photo);

      const alt = createImageAlt(article, index, photo);

      const credit =
        photo.provider === PROVIDERS.PEXELS
          ? createPexelsCredit(photo)
          : createUnsplashCredit(photo);

      return [`![${alt}](${imageUrl})`, "", credit].join("\n");
    })
    .join("\n\n");
}

function splitBlocks(markdown) {
  return String(markdown)
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function isSourceBlock(block) {
  return /^##\s+출처\s*$/m.test(block) || /^[-*]\s+.*https?:\/\//.test(block);
}

function isImageBlock(block) {
  return /^!\[[\s\S]*?\]\([\s\S]*?\)/.test(block);
}

function isHeadingBlock(block) {
  return /^#{1,6}\s+/.test(block);
}

function isUsableInsertionBlock(block) {
  if (
    !block ||
    isSourceBlock(block) ||
    isImageBlock(block) ||
    isHeadingBlock(block)
  ) {
    return false;
  }

  /*
   * 표 / 코드 / 인용문 / 리스트 내부에는 삽입하지 않는다.
   */
  if (/^```/.test(block) || /^>\s/.test(block) || /^\|/.test(block)) {
    return false;
  }

  return block.length >= 80;
}

function findInsertionIndex(blocks, ratio, excludedIndexes = new Set()) {
  const candidates = [];

  for (let index = 1; index < blocks.length - 1; index++) {
    if (excludedIndexes.has(index)) continue;

    if (!isUsableInsertionBlock(blocks[index])) continue;

    const precedingLength = blocks
      .slice(0, index + 1)
      .reduce((sum, block) => sum + block.length, 0);

    candidates.push({
      index,
      distance: Math.abs(
        precedingLength /
          Math.max(
            1,
            blocks.reduce((sum, block) => sum + block.length, 0),
          ) -
          ratio,
      ),
    });
  }

  candidates.sort((a, b) => a.distance - b.distance);

  return candidates[0]?.index ?? -1;
}

function insertImagesIntoMarkdown(markdown, article, photos) {
  if (!Array.isArray(photos) || photos.length !== 2) {
    throw new Error(
      `이미지 삽입에는 정확히 2개의 이미지가 필요합니다. 현재: ${
        photos?.length ?? 0
      }개`,
    );
  }

  const blocks = splitBlocks(markdown);

  if (blocks.length === 0) {
    throw new Error("이미지를 삽입할 Markdown 본문이 없습니다.");
  }

  /*
   * 출처 섹션을 찾는다.
   *
   * 이미지 2개는 출처 섹션보다 앞에 들어간다.
   */
  let sourceIndex = blocks.findIndex((block) => /^##\s+출처\s*$/m.test(block));

  /*
   * 출처 섹션이 없으면 마지막에 삽입한다.
   */
  if (sourceIndex < 0) {
    sourceIndex = blocks.length;
  }

  /*
   * 이미지 1
   *
   * 본문의 약 1/3 지점
   */
  const firstTarget = Math.max(1, Math.floor(sourceIndex * 0.35));

  const firstIndex = Math.min(firstTarget, sourceIndex);

  blocks.splice(firstIndex, 0, createImageMarkdown(article, [photos[0]]));

  /*
   * 이미지 2를 삽입하기 위해
   * 출처 섹션 위치를 다시 계산한다.
   */
  sourceIndex = blocks.findIndex((block) => /^##\s+출처\s*$/m.test(block));

  if (sourceIndex < 0) {
    sourceIndex = blocks.length;
  }

  /*
   * 본문의 약 2/3 지점
   */
  const secondTarget = Math.max(firstIndex + 2, Math.floor(sourceIndex * 0.7));

  const secondIndex = Math.min(secondTarget, sourceIndex);

  blocks.splice(secondIndex, 0, createImageMarkdown(article, [photos[1]]));

  const result = blocks.join("\n\n").trim();

  /*
   * 최종 이미지 개수 검증
   */
  const imageCount =
    result.match(
      /!\[[^\]]*\]\((https:\/\/(?:images\.)?pexels\.com\/[^)\s]+|https:\/\/images\.unsplash\.com\/[^)\s]+)\)/gi,
    ) || [];

  if (imageCount.length !== 2) {
    throw new Error(
      `이미지 삽입 후 Markdown 이미지가 정확히 2개가 아닙니다. 현재: ${imageCount.length}개`,
    );
  }

  return result;
}

async function triggerUnsplashDownload(photo) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY?.trim();

  const downloadLocation = photo?.links?.download_location;

  if (!accessKey || !downloadLocation) {
    return;
  }

  try {
    await fetch(downloadLocation, {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
        "Accept-Version": "v1",
      },
    });
  } catch (error) {
    logWarning(
      `Unsplash 다운로드 추적 호출 실패: ${photo?.id || "unknown"}`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

function selectPhotos(
  photos,
  article,
  preferredProviders = null,
  usedImages = new Set(),
) {
  const maxImages = 2;

  /*
   * 가장 먼저 인물/금지 이미지와
   * 최근 사용 이미지를 제거한다.
   */
  const filteredPhotos = photos.filter((photo) => {
    const imageUrl = getImageUrl(photo);

    if (!imageUrl) {
      return false;
    }

    if (isRecentlyUsedImage(imageUrl, usedImages)) {
      return false;
    }

    if (isPersonPhoto(photo)) {
      logInfo(
        `인물 이미지 후보 제외: ${photo?.id || "unknown"} / ${
          photo?.alt || photo?.alt_description || "메타데이터 없음"
        }`,
      );

      return false;
    }

    if (isBlockedPhoto(photo)) {
      logInfo(`차단 이미지 후보 제외: ${photo?.id || "unknown"}`);

      return false;
    }

    return true;
  });

  const scored = filteredPhotos
    .map((photo) => ({
      photo,
      score: scorePhoto(photo, article, new Set()),
    }))
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => b.score - a.score);

  const selected = [];
  const selectedIds = new Set();

  /*
   * 두 제공자를 모두 사용할 수 있으면
   * Pexels 1개 + Unsplash 1개를 우선 선택한다.
   */
  if (!preferredProviders) {
    for (const preferredProvider of [PROVIDERS.PEXELS, PROVIDERS.UNSPLASH]) {
      const candidate = scored.find(
        (item) =>
          item.photo.provider === preferredProvider &&
          !selectedIds.has(`${preferredProvider}:${String(item.photo.id)}`),
      );

      if (candidate) {
        selected.push(candidate.photo);

        selectedIds.add(`${preferredProvider}:${String(candidate.photo.id)}`);
      }

      if (selected.length === maxImages) {
        break;
      }
    }
  } else {
    /*
     * 한 제공자만 사용할 수 있는 경우
     * 해당 제공자의 상위 2개를 사용한다.
     */
    const provider = preferredProviders[0];

    for (const item of scored) {
      if (item.photo.provider !== provider) {
        continue;
      }

      const id = `${provider}:${String(item.photo.id)}`;

      if (selectedIds.has(id)) {
        continue;
      }

      selected.push(item.photo);
      selectedIds.add(id);

      if (selected.length === maxImages) {
        break;
      }
    }
  }

  /*
   * 정상적인 1+1 조합이 2개가 되지 않았을 때
   * 남은 후보로 채운다.
   */
  for (const item of scored) {
    if (selected.length === maxImages) {
      break;
    }

    const provider = item.photo.provider;

    const id = `${provider}:${String(item.photo.id)}`;

    if (selectedIds.has(id)) {
      continue;
    }

    if (preferredProviders && provider !== preferredProviders[0]) {
      continue;
    }

    selected.push(item.photo);
    selectedIds.add(id);
  }

  /*
   * 최종적으로 한 번 더 인물 이미지를 검증한다.
   */
  return selected
    .filter((photo) => {
      if (isPersonPhoto(photo)) {
        logWarning(
          `최종 이미지 선택 단계에서 인물 이미지 제거: ${
            photo?.id || "unknown"
          }`,
        );

        return false;
      }

      return true;
    })
    .slice(0, maxImages);
}

export async function generateArticleImages(article, usedImages = new Set()) {
  if (!article || typeof article !== "object") {
    throw new Error("이미지를 검색할 article이 올바르지 않습니다.");
  }

  const title = article.topic?.title || "제목 없음";

  const query = getSearchQuery(article);

  const providerResults = new Map();

  const providerErrors = [];

  /*
   * Pexels / Unsplash를 각각 검색한다.
   *
   * 한쪽이 실패해도 다른 쪽으로 계속 진행한다.
   */
  for (const provider of [PROVIDERS.PEXELS, PROVIDERS.UNSPLASH]) {
    try {
      logInfo(`${provider} 이미지 검색: ${title} / "${query}"`);

      const photos =
        provider === PROVIDERS.PEXELS
          ? await searchPexels(query)
          : await searchUnsplash(query);

      const uniquePhotos = [];

      const seenIds = new Set();

      for (const photo of photos) {
        const id = String(photo.id || "");

        if (!id || seenIds.has(id)) {
          continue;
        }

        seenIds.add(id);

        uniquePhotos.push(photo);
      }

      /*
       * 인물 이미지 후보 개수를 로그로 기록한다.
       */
      const personPhotos = uniquePhotos.filter(isPersonPhoto);

      if (personPhotos.length > 0) {
        logInfo(
          `${provider} 인물 이미지 후보 ${personPhotos.length}개 자동 제외: ${title}`,
        );
      }

      /*
       * 실제 선택 가능한 후보만 남긴다.
       */
      const usablePhotos = uniquePhotos.filter((photo) => {
        if (isPersonPhoto(photo)) {
          return false;
        }

        if (isBlockedPhoto(photo)) {
          return false;
        }

        return Boolean(getImageUrl(photo));
      });

      providerResults.set(provider, usablePhotos);

      logInfo(
        `${provider} 사용 가능 후보 ${usablePhotos.length}개 확보: ${title}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      providerErrors.push(`${provider}: ${message}`);

      providerResults.set(provider, []);

      logWarning(`${provider} 이미지 검색 실패: ${title}`, message);
    }
  }

  const pexelsPhotos = providerResults.get(PROVIDERS.PEXELS) || [];

  const unsplashPhotos = providerResults.get(PROVIDERS.UNSPLASH) || [];

  let selectedPhotos = [];

  let selectionMode = "mixed";

  /*
   * 1순위:
   *
   * Pexels 1개 + Unsplash 1개
   */
  if (pexelsPhotos.length >= 1 && unsplashPhotos.length >= 1) {
    selectedPhotos = selectPhotos(
      [...pexelsPhotos, ...unsplashPhotos],
      article,
      null,
      usedImages,
    );
  }

  /*
   * 2순위:
   *
   * Unsplash 2개
   */
  if (
    selectedPhotos.length < config.images.minPerArticle &&
    unsplashPhotos.length >= 2
  ) {
    selectionMode = "unsplash_only";

    selectedPhotos = selectPhotos(
      unsplashPhotos,
      article,
      [PROVIDERS.UNSPLASH],
      usedImages,
    );
  }

  /*
   * 3순위:
   *
   * Pexels 2개
   */
  if (
    selectedPhotos.length < config.images.minPerArticle &&
    pexelsPhotos.length >= 2
  ) {
    selectionMode = "pexels_only";

    selectedPhotos = selectPhotos(
      pexelsPhotos,
      article,
      [PROVIDERS.PEXELS],
      usedImages,
    );
  }

  /*
   * 이미지 2개를 확보하지 못하면
   * 게시하지 않는다.
   */
  if (selectedPhotos.length < config.images.minPerArticle) {
    const details = providerErrors.length
      ? ` ${providerErrors.join(" | ")}`
      : " 두 제공자에서 인물이 없는 이미지 2개를 확보하지 못했습니다.";

    throw new Error(
      `게시글에 사용할 인물이 없는 이미지 2개를 확보하지 못했습니다: ${title}.${details}`,
    );
  }

  /*
   * 최종 안전 검사
   *
   * 여기서 하나라도 인물 이미지로 판정되면
   * 해당 게시글 전체의 이미지 처리를 실패시킨다.
   */
  const finalPersonCheck = selectedPhotos.some((photo) => isPersonPhoto(photo));

  if (finalPersonCheck) {
    throw new Error(
      `인물 이미지가 최종 선택 단계에서 감지되었습니다. 게시글을 게시하지 않습니다: ${title}`,
    );
  }

  /*
   * Unsplash 이미지를 실제 게시글에 사용했을 때만
   * 다운로드 추적을 호출한다.
   */
  await Promise.all(
    selectedPhotos
      .filter((photo) => photo.provider === PROVIDERS.UNSPLASH)
      .map(triggerUnsplashDownload),
  );

  const images = selectedPhotos.map((photo, index) => ({
    provider: photo.provider,
    id: String(photo.id),
    url: getImageUrl(photo),
    publicPath: getImageUrl(photo),
    sourceUrl: getSourceUrl(photo),

    photographer:
      photo.provider === PROVIDERS.PEXELS
        ? photo.photographer || "Pexels 사진가"
        : photo.user?.name || "Unsplash 사진가",

    photographerUrl:
      photo.provider === PROVIDERS.UNSPLASH
        ? photo.user?.links?.html || null
        : null,

    alt: createImageAlt(article, index, photo),

    width: Number(photo.width) || null,
    height: Number(photo.height) || null,
  }));

  logInfo(
    `인물 없는 이미지 2개 선택 완료: ${title} (${images
      .map((item) => item.provider)
      .join(", ")}, ${selectionMode})`,
  );

  const markdownWithImages = insertImagesIntoMarkdown(
    article.markdown,
    article,
    selectedPhotos,
  );

  const markdownImageCount =
    markdownWithImages.match(
      /!\[[^\]]*\]\((https:\/\/(?:images\.)?pexels\.com\/[^)\s]+|https:\/\/images\.unsplash\.com\/[^)\s]+)\)/gi,
    ) || [];

  if (markdownImageCount.length !== 2) {
    throw new Error(
      `이미지 2개는 확보했지만 Markdown 삽입에 실패했습니다. 현재 Markdown 이미지: ${markdownImageCount.length}개`,
    );
  }

  /*
   * 이미지 출처 표시도 정확히 2개인지 검증한다.
   */
  const creditCount = (markdownWithImages.match(/class="image-credit"/g) || [])
    .length;

  if (creditCount !== 2) {
    throw new Error(
      `이미지 출처 표시 2개 삽입에 실패했습니다. 현재 출처 표시: ${creditCount}개`,
    );
  }

  return {
    ...article,

    markdown: markdownWithImages,

    images,
  };
}
