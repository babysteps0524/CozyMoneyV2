import fs from "node:fs";
import path from "node:path";

import { config } from "./config.js";
import { logInfo, logWarning } from "./logger.js";

const sourcesFilePath = path.join(
  config.rootDir,
  "src",
  "data",
  "automationSources.json",
);

const maximumItemsPerSource = 10;
const requestTimeoutMilliseconds = 15_000;
const maximumDescriptionLength = 2_000;
const maximumContentLength = 3_000;

/**
 * XML 문자열의 기본 엔티티와 CDATA를 정리한다.
 */
function decodeXml(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(parseInt(code, 16)),
    )
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * XML 태그명을 정규식에 안전하게 사용한다.
 */
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * RSS XML에서 태그 하나의 값을 가져온다.
 *
 * namespace가 붙은 태그와
 * 일반 태그를 모두 지원한다.
 */
function getXmlTagValue(xml, tagName) {
  const escapedTagName = escapeRegExp(tagName);

  const match = String(xml).match(
    new RegExp(
      `<${escapedTagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapedTagName}\\s*>`,
      "i",
    ),
  );

  return match ? decodeXml(match[1]) : "";
}

/**
 * namespace가 붙어 있을 가능성이 있는 태그를
 * 순서대로 확인한다.
 */
function getFirstXmlTagValue(xml, tagNames) {
  for (const tagName of tagNames) {
    const value = getXmlTagValue(xml, tagName);

    if (value) {
      return value;
    }
  }

  return "";
}

/**
 * RSS item 블록을 추출한다.
 */
function getRssItemBlocks(xml) {
  return String(xml).match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item\s*>/gi) ?? [];
}

/**
 * RSS item 하나를 파싱한다.
 */
function parseRssItem(itemXml, source, index) {
  const title = getFirstXmlTagValue(itemXml, ["title"]);

  const description = getFirstXmlTagValue(itemXml, ["description"]);

  const content =
    getFirstXmlTagValue(itemXml, ["content:encoded", "content_encoded"]) ||
    description;

  const url = getFirstXmlTagValue(itemXml, ["link", "guid"]);

  const publishedAt = getFirstXmlTagValue(itemXml, [
    "pubDate",
    "dc:date",
    "published",
    "updated",
  ]);

  return {
    id: `${source.id}-${index + 1}`,
    sourceId: source.id,
    sourceName: source.name,
    category: source.category,
    title,
    description,
    content,
    url,
    publishedAt,
  };
}

/**
 * RSS XML을 게시글 자료 목록으로 변환한다.
 */
function parseRssItems(xml, source) {
  const itemBlocks = getRssItemBlocks(xml);

  return itemBlocks
    .slice(0, maximumItemsPerSource)
    .map((itemXml, index) => parseRssItem(itemXml, source, index));
}

/**
 * 공식 출처 설정 파일을 읽는다.
 */
function loadSources() {
  if (!fs.existsSync(sourcesFilePath)) {
    throw new Error(`공식 출처 설정 파일이 없습니다: ${sourcesFilePath}`);
  }

  let sources;

  try {
    sources = JSON.parse(fs.readFileSync(sourcesFilePath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(`공식 출처 설정 파일을 읽을 수 없습니다: ${message}`);
  }

  if (!Array.isArray(sources) || sources.length === 0) {
    throw new Error("공식 출처가 하나 이상 필요합니다.");
  }

  return sources;
}

/**
 * 공식 출처 설정 하나의 기본 형식을 검사한다.
 */
function validateSource(source) {
  if (!source || typeof source !== "object") {
    return false;
  }

  if (typeof source.id !== "string" || !source.id.trim()) {
    return false;
  }

  if (typeof source.category !== "string" || !source.category.trim()) {
    return false;
  }

  if (typeof source.name !== "string" || !source.name.trim()) {
    return false;
  }

  if (typeof source.url !== "string" || !source.url.trim()) {
    return false;
  }

  if (!Object.hasOwn(config.categories, source.category)) {
    return false;
  }

  if (source.type !== "rss") {
    return false;
  }

  try {
    const url = new URL(source.url);

    return url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * URL에서 RSS/XML 텍스트를 가져온다.
 */
async function fetchText(url) {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    requestTimeoutMilliseconds,
  );

  try {
    const response = await fetch(url, {
      headers: {
        Accept:
          "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.1",
        "User-Agent": "CozyMoney-AutoPost/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        `요청 시간이 초과되었습니다. (${requestTimeoutMilliseconds}ms)`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * 텍스트를 Gemini에 전달하기 좋은 길이로 제한한다.
 */
function truncateText(text = "", maximumLength = 3_000) {
  const normalized = String(text).replace(/\s+/g, " ").trim();

  if (normalized.length <= maximumLength) {
    return normalized;
  }

  return normalized.slice(0, maximumLength) + "…";
}

/**
 * RSS 자료 하나를 정규화한다.
 */
function normalizeSourceItem(item) {
  return {
    id: String(item.id ?? "").trim(),

    sourceId: String(item.sourceId ?? "").trim(),

    sourceName: String(item.sourceName ?? "").trim(),

    category: String(item.category ?? "").trim(),

    title: String(item.title ?? "").trim(),

    description: truncateText(item.description, maximumDescriptionLength),

    content: truncateText(
      item.content || item.description,
      maximumContentLength,
    ),

    url: String(item.url ?? "").trim(),

    publishedAt: String(item.publishedAt ?? "").trim(),
  };
}

/**
 * 수집된 자료 하나의 필수 항목을 확인한다.
 */
function validateSourceItem(item) {
  if (
    !item.id ||
    !item.sourceId ||
    !item.sourceName ||
    !item.category ||
    !item.title ||
    !item.url
  ) {
    return false;
  }

  try {
    const url = new URL(item.url);

    return url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * 공식 자료를 수집한다.
 *
 * Gemini API 호출은 하지 않는다.
 */
export async function collectOfficialSources() {
  const configuredSources = loadSources();

  const validSources = configuredSources.filter(validateSource);

  if (validSources.length === 0) {
    throw new Error("사용 가능한 공식 출처가 없습니다.");
  }

  const collectedItems = [];

  for (const source of validSources) {
    try {
      logInfo(`공식 자료를 수집합니다: ${source.name}`);

      const xml = await fetchText(source.url);

      if (!xml.trim()) {
        throw new Error("빈 응답을 받았습니다.");
      }

      const items = parseRssItems(xml, source)
        .map(normalizeSourceItem)
        .filter(validateSourceItem);

      collectedItems.push(...items);

      logInfo(`${source.name} 자료 ${items.length}건을 수집했습니다.`);

      if (items.length === 0) {
        logWarning(
          `${source.name}에서 유효한 RSS 자료를 찾지 못했습니다.`,
          source.url,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      logWarning(`자료 수집에 실패했습니다: ${source.name}`, message);
    }
  }

  /**
   * 자료가 하나도 없으면
   * 자동 포스팅을 계속 진행하지 않는다.
   */
  if (collectedItems.length === 0) {
    throw new Error("수집된 공식 자료가 없습니다. 자동 포스팅을 중단합니다.");
  }

  /**
   * 동일 URL이 여러 번 수집되는 경우 제거한다.
   */
  const uniqueItems = [];
  const seenUrls = new Set();

  for (const item of collectedItems) {
    if (seenUrls.has(item.url)) {
      continue;
    }

    seenUrls.add(item.url);
    uniqueItems.push(item);
  }

  logInfo(`공식 자료 ${uniqueItems.length}건을 최종 사용합니다.`);

  return uniqueItems;
}

/**
 * ============================================================
 * AI 주제 선정용 공식 자료 1차 선별
 * ============================================================
 *
 * 중요:
 *
 * 공식 자료 전체를 AI에 보내지 않는다.
 *
 * 예:
 *
 * 수집 결과
 * stock      30개
 * tax        25개
 * accounting 22개
 *
 *          ↓
 *
 * JavaScript 1차 선별
 *
 * stock       4개
 * tax         4개
 * accounting  4개
 *
 *          ↓
 *
 * AI에는 총 12개만 전달
 *
 * 이 단계에서는 AI API를 호출하지 않는다.
 */

/**
 * 문자열을 검색용으로 정규화한다.
 */
function normalizeSearchText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 날짜를 timestamp로 변환한다.
 *
 * 날짜를 정확하게 해석하지 못하면 0을 반환한다.
 */
function getPublishedTimestamp(value) {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(String(value));

  return Number.isFinite(timestamp) ? timestamp : 0;
}

/**
 * 자료의 최신성 점수를 계산한다.
 *
 * 최근 자료일수록 높은 점수를 준다.
 */
function getRecencyScore(item) {
  const publishedTimestamp = getPublishedTimestamp(item.publishedAt);

  if (!publishedTimestamp) {
    return 0;
  }

  const now = Date.now();
  const ageMilliseconds = Math.max(0, now - publishedTimestamp);

  const ageDays = ageMilliseconds / (1000 * 60 * 60 * 24);

  if (ageDays <= 1) {
    return 100;
  }

  if (ageDays <= 3) {
    return 90;
  }

  if (ageDays <= 7) {
    return 80;
  }

  if (ageDays <= 14) {
    return 65;
  }

  if (ageDays <= 30) {
    return 50;
  }

  if (ageDays <= 60) {
    return 30;
  }

  return 10;
}

/**
 * 정보성 키워드가 포함되어 있는지 검사한다.
 *
 * 뉴스 제목을 그대로 선택하기보다
 * 정보글로 발전시키기 좋은 자료를 우선한다.
 */
const INFORMATION_KEYWORDS = [
  "변경",
  "개정",
  "시행",
  "공시",
  "제도",
  "정책",
  "세금",
  "세율",
  "공제",
  "신고",
  "납부",
  "계산",
  "조건",
  "방법",
  "기준",
  "회계",
  "재무제표",
  "실적",
  "자사주",
  "배당",
  "기업",
  "산업",
  "반도체",
  "주식",
  "증권",
  "투자",
  "금리",
  "물가",
  "부동산",
  "법령",
  "지원",
  "신청",
  "절차",
  "주의",
];

/**
 * 자료의 정보글 적합도 점수를 계산한다.
 */
function getInformationScore(item) {
  const text = normalizeSearchText(
    [item.title, item.description, item.content].join(" "),
  );

  let score = 0;

  for (const keyword of INFORMATION_KEYWORDS) {
    if (text.includes(keyword)) {
      score += 5;
    }
  }

  return Math.min(score, 50);
}

/**
 * 제목의 길이가 지나치게 짧거나 긴 자료를
 * 약간 낮게 평가한다.
 */
function getTitleQualityScore(item) {
  const title = String(item.title ?? "").trim();

  if (!title) {
    return 0;
  }

  if (title.length >= 15 && title.length <= 100) {
    return 20;
  }

  if (title.length >= 10 && title.length <= 120) {
    return 10;
  }

  return 5;
}

/**
 * URL과 제목이 정상적인 자료인지 확인한다.
 */
function getValidityScore(item) {
  let score = 0;

  if (item.id) {
    score += 5;
  }

  if (item.title) {
    score += 5;
  }

  if (item.description || item.content) {
    score += 5;
  }

  if (item.url) {
    score += 5;
  }

  return score;
}

/**
 * 공식 자료 하나의 최종 1차 선별 점수.
 *
 * 최대 점수:
 *
 * 최신성      100
 * 정보성       50
 * 제목 품질    20
 * 자료 완성도  20
 *
 * 총 190점
 */
function calculateSourceScore(item) {
  const recencyScore = getRecencyScore(item);
  const informationScore = getInformationScore(item);
  const titleQualityScore = getTitleQualityScore(item);
  const validityScore = getValidityScore(item);

  return recencyScore + informationScore + titleQualityScore + validityScore;
}

/**
 * 동일한 제목을 가진 자료를 제거한다.
 */
function removeDuplicateSourceItems(items) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const normalizedTitle = normalizeSearchText(item.title);

    if (!normalizedTitle) {
      continue;
    }

    if (seen.has(normalizedTitle)) {
      continue;
    }

    seen.add(normalizedTitle);
    result.push(item);
  }

  return result;
}

/**
 * 카테고리별로 AI에 전달할 자료를 선별한다.
 *
 * 기본:
 *
 * stock      4
 * tax        4
 * accounting 4
 *
 * 총 12개
 */
export function selectSourcesForTopicResearch(sourceItems) {
  if (!Array.isArray(sourceItems)) {
    throw new Error("공식 자료 목록이 배열이 아닙니다.");
  }

  if (sourceItems.length === 0) {
    throw new Error("선별할 공식 자료가 없습니다.");
  }

  const selectedItems = [];

  const perCategory = Math.max(
    1,
    Number(config.topicResearchSourcesPerCategory) || 4,
  );

  for (const [categoryKey, category] of Object.entries(config.categories)) {
    const categoryItems = sourceItems.filter(
      (item) => item.category === categoryKey,
    );

    if (categoryItems.length === 0) {
      logWarning(`${category.name} 공식 자료가 없습니다.`, categoryKey);

      continue;
    }

    /**
     * 동일 제목 제거
     */
    const uniqueItems = removeDuplicateSourceItems(categoryItems);

    /**
     * JavaScript에서 점수 계산
     *
     * AI 호출 없음
     */
    const scoredItems = uniqueItems.map((item) => ({
      item,
      score: calculateSourceScore(item),
    }));

    /**
     * 높은 점수부터 정렬
     *
     * 점수가 같으면 최신 자료를 우선한다.
     */
    scoredItems.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return (
        getPublishedTimestamp(b.item.publishedAt) -
        getPublishedTimestamp(a.item.publishedAt)
      );
    });

    const selectedCategoryItems = scoredItems
      .slice(0, perCategory)
      .map(({ item }) => item);

    selectedItems.push(...selectedCategoryItems);

    logInfo(
      `${category.name} 주제 연구용 자료 선별: ` +
        `${selectedCategoryItems.length}/${categoryItems.length}개`,
    );
  }

  if (selectedItems.length === 0) {
    throw new Error(
      "AI 주제 연구에 사용할 공식 자료가 하나도 선별되지 않았습니다.",
    );
  }

  logInfo(
    `AI 주제 연구용 공식 자료 ${selectedItems.length}개를 선별했습니다. ` +
      `(전체 ${sourceItems.length}개)`,
  );

  return selectedItems;
}

/**
 * AI 주제 선정 단계용으로
 * 공식 자료의 정보를 압축한다.
 *
 * 여기서는 게시글 작성용 전체 자료가 아니라
 * "주제 선정"에 필요한 정보만 전달한다.
 *
 * 따라서 content를 길게 보내지 않는다.
 */
function truncateForTopicResearch(value, maximumLength) {
  const normalized = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length <= maximumLength) {
    return normalized;
  }

  return `${normalized.slice(0, maximumLength)}…`;
}

/**
 * AI 주제 선정용 공식 자료 요약을 생성한다.
 */
export function createTopicResearchSummaries(sourceItems) {
  if (!Array.isArray(sourceItems)) {
    throw new Error("공식 자료 목록이 배열이 아닙니다.");
  }

  if (sourceItems.length === 0) {
    throw new Error("AI 주제 선정에 사용할 공식 자료가 없습니다.");
  }

  return sourceItems
    .map((item) =>
      [
        `[자료 ID: ${item.id}]`,
        `카테고리: ${item.category}`,
        `기관: ${item.sourceName}`,
        `제목: ${truncateForTopicResearch(item.title, 120)}`,
        `게시일: ${item.publishedAt || "확인 필요"}`,
        `요약: ${truncateForTopicResearch(item.description, 350)}`,
        `핵심 내용: ${truncateForTopicResearch(item.content, 500)}`,
      ].join("\n"),
    )
    .join("\n\n---\n\n");
}

/**
 * 수집된 자료를 Gemini 주제 선정 단계에 전달할
 * 문자열로 만든다.
 *
 * 자료 ID는 반드시 유지해야 한다.
 */
export function createSourceSummaries(sourceItems) {
  if (!Array.isArray(sourceItems)) {
    throw new Error("공식 자료 목록이 배열이 아닙니다.");
  }

  if (sourceItems.length === 0) {
    throw new Error("AI에 전달할 공식 자료가 없습니다.");
  }

  return sourceItems
    .map((item) =>
      [
        `[자료 ID: ${item.id}]`,
        `출처: ${item.sourceName || "확인 필요"}`,
        `분야: ${item.category || "확인 필요"}`,
        `제목: ${item.title || "제목 없음"}`,
        `날짜: ${item.publishedAt || "확인 필요"}`,
        `요약: ${item.description || "없음"}`,
      ].join("\n"),
    )
    .join("\n\n---\n\n");
}
