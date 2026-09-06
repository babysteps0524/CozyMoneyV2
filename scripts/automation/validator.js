import matter from "gray-matter";
import { marked } from "marked";

import { config } from "./config.js";
import { logInfo, logWarning } from "./logger.js";

/*
 * ============================================================
 * 기본 검수 설정
 * ============================================================
 */

const MINIMUM_CONTENT_LENGTH = 1500;

const MAX_DESCRIPTION_LENGTH = 160;

const MINIMUM_KEYWORDS = 2;

/*
 * ============================================================
 * 금지 표현
 * ============================================================
 */

const prohibitedPatterns = [
  {
    pattern: /무조건\s*(오르|상승|수익)/i,
    message: "수익 또는 상승을 보장하는 표현이 있습니다.",
  },
  {
    pattern: /반드시\s*(오르|상승|수익)/i,
    message: "수익 또는 상승을 보장하는 표현이 있습니다.",
  },
  {
    pattern: /지금\s*(사|매수)/i,
    message: "투자 권유 표현이 있습니다.",
  },
  {
    pattern: /수익\s*보장/i,
    message: "수익 보장 표현이 있습니다.",
  },
  {
    pattern: /원금\s*보장/i,
    message: "원금 보장 표현이 있습니다.",
  },
  {
    pattern: /확실히\s*(오른|상승|수익)/i,
    message: "확정적인 투자 수익 표현이 있습니다.",
  },
  {
    pattern: /100%\s*(상승|수익|보장)/i,
    message: "과도한 투자 확정 표현이 있습니다.",
  },
  {
    pattern: /탈세/i,
    message: "탈세 관련 유도 표현이 있습니다.",
  },
];

/*
 * ============================================================
 * URL 추출
 * ============================================================
 */

function extractUrls(markdown) {
  if (!markdown || typeof markdown !== "string") {
    return [];
  }

  return [...markdown.matchAll(/https?:\/\/[^\s)"\]]+/g)].map((match) =>
    match[0].replace(/[.,;:]+$/, ""),
  );
}

/*
 * ============================================================
 * Frontmatter 검수
 * ============================================================
 */

function validateRequiredFrontmatter(data, article, errors) {
  const requiredFields = ["title", "date", "category", "description"];

  for (const field of requiredFields) {
    if (
      data[field] === undefined ||
      data[field] === null ||
      String(data[field]).trim() === ""
    ) {
      errors.push(`frontmatter의 ${field} 값이 없습니다.`);
    }
  }

  /*
   * 제목 검수
   */

  if (
    data.title &&
    String(data.title).trim() !== String(article.topic.title).trim()
  ) {
    errors.push("frontmatter title과 선정된 주제 제목이 다릅니다.");
  }

  /*
   * 카테고리 검수
   */

  const expectedCategory = config.categories?.[article.topic.category]?.name;

  if (!expectedCategory) {
    errors.push(
      `설정 파일에서 카테고리를 찾을 수 없습니다: ${article.topic.category}`,
    );
  } else if (data.category !== expectedCategory) {
    errors.push(`카테고리가 올바르지 않습니다. 기대값: ${expectedCategory}`);
  }

  /*
   * 날짜 검수
   */

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data.date))) {
    errors.push("날짜는 YYYY-MM-DD 형식이어야 합니다.");
  }

  /*
   * description 검수
   */

  const description = String(data.description ?? "").trim();

  if (description.length === 0) {
    errors.push("description이 비어 있습니다.");
  }

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    errors.push(
      `description은 ${MAX_DESCRIPTION_LENGTH}자를 넘으면 안 됩니다.`,
    );
  }

  /*
   * keywords 검수
   */

  if (!Array.isArray(data.keywords)) {
    errors.push("keywords는 배열이어야 합니다.");
  } else if (data.keywords.length < MINIMUM_KEYWORDS) {
    errors.push(`keywords는 최소 ${MINIMUM_KEYWORDS}개 이상 필요합니다.`);
  } else {
    const invalidKeywords = data.keywords.filter(
      (keyword) => typeof keyword !== "string" || keyword.trim().length === 0,
    );

    if (invalidKeywords.length > 0) {
      errors.push("keywords에 비어 있는 값이 있습니다.");
    }
  }
}

/*
 * ============================================================
 * Markdown 구조 검수
 * ============================================================
 */

function validateMarkdownStructure(content, errors) {
  if (!content || typeof content !== "string") {
    errors.push("Markdown 본문이 비어 있습니다.");
    return;
  }

  /*
   * H1
   */

  const h1Matches = content.match(/^#\s+.+$/gm) ?? [];

  if (h1Matches.length !== 1) {
    errors.push("H1 제목은 정확히 1개여야 합니다.");
  }

  /*
   * 필수 섹션
   */

  const requiredSections = [
    "핵심 내용",
    "자세히 알아보기",
    "주의할 점",
    "핵심 정리",
    "출처",
  ];

  for (const section of requiredSections) {
    const pattern = new RegExp(`^##\\s+${section}\\s*$`, "m");

    if (!pattern.test(content)) {
      errors.push(`필수 H2 섹션이 없습니다: ${section}`);
    }
  }

  /*
   * 본문 길이
   */

  if (content.length < MINIMUM_CONTENT_LENGTH) {
    errors.push(
      `본문이 너무 짧습니다. 최소 ${MINIMUM_CONTENT_LENGTH}자 이상 필요합니다.`,
    );
  }

  /*
   * Markdown 파싱
   */

  try {
    marked.parse(content);
  } catch (error) {
    errors.push(
      `Markdown 문법을 파싱할 수 없습니다: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/*
 * ============================================================
 * 출처 검수
 * ============================================================
 *
 * 기존 방식:
 *
 * 공식 출처 URL 10개
 * ↓
 * 글에 URL 10개가 모두 있어야 통과
 *
 * 문제:
 * - 글이 불필요하게 길어짐
 * - AI가 URL을 누락할 가능성이 높음
 * - URL을 억지로 모두 넣을 필요가 없음
 *
 * 변경 방식:
 *
 * 공식 출처가 최소 1개 이상 존재해야 함
 * ↓
 * 글에 공식 출처 URL이 최소 1개 이상 있어야 함
 *
 * 모든 URL을 강제로 넣지는 않음.
 */

function validateSources(markdown, article, errors, warnings) {
  const sourceUrls = Array.isArray(article.sources)
    ? article.sources
        .map((source) => source?.url)
        .filter((url) => typeof url === "string" && url.trim().length > 0)
    : [];

  const markdownUrls = extractUrls(markdown);

  /*
   * 공식 출처 자체가 없는 경우
   */

  if (sourceUrls.length === 0) {
    errors.push("검증된 공식 출처가 없습니다.");
    return;
  }

  /*
   * 공식 출처 중 하나라도 본문에 있는지 확인
   */

  const matchedSourceUrls = sourceUrls.filter((sourceUrl) =>
    markdownUrls.includes(sourceUrl),
  );

  if (matchedSourceUrls.length === 0) {
    errors.push("공식 출처 URL이 본문에 포함되어 있지 않습니다.");
  }

  /*
   * 여러 공식 출처 중 일부만 사용한 경우
   *
   * 오류가 아니라 경고로 처리.
   */

  if (sourceUrls.length > 1 && matchedSourceUrls.length < sourceUrls.length) {
    warnings.push(
      `수집된 공식 출처 ${sourceUrls.length}개 중 ` +
        `${matchedSourceUrls.length}개만 본문에 포함되어 있습니다.`,
    );
  }

  /*
   * 공식 출처에 없는 외부 URL
   *
   * 외부 URL은 자동으로 FAIL시키지 않고 WARNING 처리.
   */

  const unknownUrls = markdownUrls.filter((url) => !sourceUrls.includes(url));

  if (unknownUrls.length > 0) {
    warnings.push(
      `검증된 공식 출처가 아닌 외부 URL ${unknownUrls.length}개가 포함되어 있습니다.`,
    );
  }
}

/*
 * ============================================================
 * 금지 표현 검수
 * ============================================================
 */

function validateProhibitedExpressions(content, errors) {
  for (const item of prohibitedPatterns) {
    if (item.pattern.test(content)) {
      errors.push(item.message);
    }
  }
}

/*
 * ============================================================
 * 빈 섹션 검수
 * ============================================================
 */

function validateEmptySections(content, errors) {
  const sections = [
    "핵심 내용",
    "자세히 알아보기",
    "주의할 점",
    "핵심 정리",
    "출처",
  ];

  for (const section of sections) {
    const pattern = new RegExp(
      `##\\s+${section}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`,
      "m",
    );

    const match = content.match(pattern);

    if (!match) {
      continue;
    }

    const sectionContent = match[1]
      .replace(/[-*]\s*/g, "")
      .replace(/\s+/g, "")
      .trim();

    if (sectionContent.length === 0) {
      errors.push(`"${section}" 섹션의 내용이 비어 있습니다.`);
    }
  }
}

/*
 * ============================================================
 * 코드블록 / HTML 검수
 * ============================================================
 */

function validateOutputFormat(content, errors, warnings) {
  /*
   * 코드블록 금지
   */

  if (/```/.test(content)) {
    errors.push("Markdown 코드블록이 포함되어 있습니다.");
  }

  /*
   * HTML 직접 작성 여부
   */

  if (/<\/?[a-z][^>]*>/i.test(content)) {
    warnings.push(
      "본문에 HTML 태그가 포함되어 있습니다. Markdown 중심 작성을 권장합니다.",
    );
  }
}

/*
 * ============================================================
 * 과도한 반복 검수
 * ============================================================
 */

function validateRepeatedContent(content, warnings) {
  const sentences = content
    .split(/[.!?。！？]\s*/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 20);

  const counts = new Map();

  for (const sentence of sentences) {
    counts.set(sentence, (counts.get(sentence) ?? 0) + 1);
  }

  const repeatedSentences = [...counts.entries()].filter(
    ([, count]) => count >= 2,
  );

  if (repeatedSentences.length > 0) {
    warnings.push(
      `동일하거나 유사한 문장이 반복될 가능성이 있습니다: ${repeatedSentences.length}개`,
    );
  }
}

/*
 * ============================================================
 * 최종 Article 검수
 * ============================================================
 */

export function validateArticle(article) {
  const errors = [];
  const warnings = [];

  try {
    if (!article || typeof article !== "object") {
      throw new Error("검수 대상 article이 올바른 객체가 아닙니다.");
    }

    if (!article.topic) {
      throw new Error("article.topic이 없습니다.");
    }

    if (!article.markdown || typeof article.markdown !== "string") {
      throw new Error("article.markdown이 없습니다.");
    }

    /*
     * Frontmatter + 본문 분리
     */

    const { data, content } = matter(article.markdown);

    /*
     * 1. Frontmatter
     */

    validateRequiredFrontmatter(data, article, errors);

    /*
     * 2. Markdown 구조
     */

    validateMarkdownStructure(content, errors);

    /*
     * 3. 출처
     */

    validateSources(article.markdown, article, errors, warnings);

    /*
     * 4. 금지 표현
     */

    validateProhibitedExpressions(content, errors);

    /*
     * 5. 빈 섹션
     */

    validateEmptySections(content, errors);

    /*
     * 6. 출력 형식
     */

    validateOutputFormat(content, errors, warnings);

    /*
     * 7. 반복 문장
     */

    validateRepeatedContent(content, warnings);

    /*
     * 8. 이미지
     */

    validateImages(article, errors);

    /*
     * 최종 상태
     */

    const status =
      errors.length > 0 ? "FAIL" : warnings.length > 0 ? "WARNING" : "PASS";

    const result = {
      ...article,
      status,
      errors,
      warnings,
    };

    if (status === "FAIL") {
      logWarning(`검수 실패: ${article.topic.title}`, errors.join(" / "));
    } else if (status === "WARNING") {
      logWarning(`검수 WARNING: ${article.topic.title}`, warnings.join(" / "));
    } else {
      logInfo(`검수 PASS: ${article.topic.title}`);
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    logWarning(
      `검수 중 오류 발생: ${article?.topic?.title ?? "알 수 없는 글"}`,
      message,
    );

    return {
      ...article,
      status: "FAIL",
      errors: [`검수 처리 오류: ${message}`],
      warnings,
    };
  }
}

/*
 * ============================================================
 * 여러 게시글 검수
 * ============================================================
 */

export function validateArticles(articleDrafts) {
  if (!Array.isArray(articleDrafts)) {
    throw new Error("검수 대상 게시글이 배열이 아닙니다.");
  }

  return articleDrafts.map(validateArticle);
}

function validateImages(article, errors) {
  if (!Array.isArray(article.images)) {
    errors.push("이미지 정보가 없습니다.");
    return;
  }

  if (article.images.length === 0) {
    errors.push("사용할 이미지가 없습니다.");
    return;
  }

  if (article.images.length > 2) {
    errors.push("이미지는 최대 2개까지만 허용됩니다.");
  }

  const seenIds = new Set();

  for (const image of article.images) {
    if (image?.provider !== "pexels") {
      errors.push("이미지 제공자는 Pexels만 허용됩니다.");
    }

    if (!image?.id) {
      errors.push("Pexels 이미지 ID가 없습니다.");
    } else if (seenIds.has(String(image.id))) {
      errors.push("같은 Pexels 이미지를 중복 사용했습니다.");
    } else {
      seenIds.add(String(image.id));
    }

    if (!image?.publicPath || !/^https:\/\/(?:images\.)?pexels\.com\//i.test(image.publicPath)) {
      errors.push("Pexels 이미지 URL이 올바르지 않습니다.");
    }

    if (!image?.sourceUrl || !/^https:\/\/www\.pexels\.com\//i.test(image.sourceUrl)) {
      errors.push("Pexels 원본 사진 URL이 없습니다.");
    }

    if (!image?.photographer) {
      errors.push("Pexels 사진가 정보가 없습니다.");
    }
  }
}
