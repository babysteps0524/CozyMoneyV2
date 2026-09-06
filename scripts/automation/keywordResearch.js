import { config } from "./config.js";
import { logInfo } from "./logger.js";
import { generateWithRetry } from "./aiClient.js";

/**
 * ============================================================
 * JSON 파싱
 * ============================================================
 */
function parseJson(text) {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("AI 응답이 비어 있습니다.");
  }

  let cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<analysis>[\s\S]*?<\/analysis>/gi, "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // 1차: 응답 전체가 JSON인 경우
  try {
    return JSON.parse(cleaned);
  } catch {
    // 계속 진행
  }

  // 2차: 응답 안에서 JSON 객체 추출
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error(
      "AI 응답에서 JSON 객체를 찾을 수 없습니다. " +
        `응답 앞부분: ${cleaned.slice(0, 500)}`,
    );
  }

  const jsonText = cleaned.slice(start, end + 1);

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    throw new Error(
      "AI 주제 JSON 파싱에 실패했습니다. " +
        `응답 앞부분: ${cleaned.slice(0, 500)} | ` +
        `오류: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function compressSourceSummaries(sourceSummaries) {
  if (typeof sourceSummaries !== "string" || !sourceSummaries.trim()) {
    throw new Error("압축할 공식 자료가 없습니다.");
  }

  const blocks = sourceSummaries
    .split(/\n(?=\[자료 ID:)/g)
    .map((block) => block.trim())
    .filter(Boolean);

  const compressed = blocks.map((block) => {
    const sourceId = block.match(/\[자료 ID:\s*([^\]]+)\]/)?.[1]?.trim() || "";

    const title = block.match(/(?:제목|title):\s*(.+)/i)?.[1]?.trim() || "";

    const source = block.match(/(?:출처|source):\s*(.+)/i)?.[1]?.trim() || "";

    const date =
      block.match(/(?:날짜|작성일|발행일|date):\s*(.+)/i)?.[1]?.trim() || "";

    const summary =
      block
        .match(
          /(?:요약|summary|설명):\s*([\s\S]*?)(?=\n(?:\[|제목|출처|날짜|작성일|발행일|요약|summary|$))/i,
        )?.[1]
        ?.trim() || "";

    return [
      `[자료 ID: ${sourceId}]`,
      `제목: ${title}`,
      `출처: ${source}`,
      `날짜: ${date}`,
      `요약: ${summary.slice(0, 400)}`,
    ].join("\n");
  });

  return compressed.join("\n\n");
}

/**
 * ============================================================
 * 배열 정규화
 * ============================================================
 */
function normalizeArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean)),
  ];
}

/**
 * ============================================================
 * 주제 정규화
 * ============================================================
 */
function normalizeTopics(topics) {
  if (!Array.isArray(topics)) {
    return [];
  }

  return topics.map((topic) => {
    const category = String(topic?.category ?? "").trim();

    return {
      category,
      board: config.categories[category]?.board || category,
      title: String(topic?.title ?? "").trim(),
      keywords: normalizeArray(topic?.keywords),
      searchIntent: String(topic?.searchIntent ?? "").trim(),
      mainQuestions: normalizeArray(topic?.mainQuestions),
      sourceIds: normalizeArray(topic?.sourceIds),
    };
  });
}

/**
 * ============================================================
 * 중복 주제 제거
 * ============================================================
 */
function removeDuplicateTopics(topics) {
  const seen = new Set();

  return topics.filter((topic) => {
    const key = topic.title.toLowerCase().replace(/\s+/g, " ").trim();

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

/**
 * ============================================================
 * 주제 유효성 검사
 * ============================================================
 */
function validateTopics(topics, sourceIds) {
  const validSourceIds = new Set(sourceIds);

  const validIntents = new Set([
    "정보 탐색",
    "방법 확인",
    "조건 확인",
    "비교",
    "계산",
    "일정 확인",
    "변경사항 확인",
    "초보자 학습",
  ]);

  return topics.filter((topic) => {
    // 존재하는 카테고리인지 확인
    if (!config.categories[topic.category]) {
      return false;
    }

    // 제목 확인
    if (!topic.title) {
      return false;
    }

    // 키워드 최소 2개
    if (topic.keywords.length < 2) {
      return false;
    }

    // 검색 의도 확인
    if (!validIntents.has(topic.searchIntent)) {
      return false;
    }

    // 질문 최소 1개
    if (topic.mainQuestions.length < 1) {
      return false;
    }

    // 공식 자료 ID 최소 1개
    if (topic.sourceIds.length < 1) {
      return false;
    }

    // 실제 제공된 sourceId인지 확인
    if (!topic.sourceIds.every((id) => validSourceIds.has(id))) {
      return false;
    }

    return true;
  });
}

/**
 * ============================================================
 * 카테고리별 후보 개수 검사
 * ============================================================
 */
function validateCandidateCounts(topics) {
  const requiredPerCategory = config.topicCandidatesPerCategory;

  for (const [key, category] of Object.entries(config.categories)) {
    const count = topics.filter((topic) => topic.category === key).length;

    if (count !== requiredPerCategory) {
      throw new Error(
        `${category.name} AI 후보가 부족하거나 초과되었습니다. ` +
          `필요: ${requiredPerCategory}개 / 생성: ${count}개`,
      );
    }
  }

  const expectedCandidates =
    Object.keys(config.categories).length * requiredPerCategory;

  if (topics.length !== expectedCandidates) {
    throw new Error(
      `AI 주제 후보 수가 올바르지 않습니다. ` +
        `필요: ${expectedCandidates}개 / 생성: ${topics.length}개`,
    );
  }

  return topics.length;
}

/**
 * ============================================================
 * AI 프롬프트 생성
 * ============================================================
 */
function createPrompt(sourceSummaries, excludeTitles = []) {
  const existing = excludeTitles.length
    ? excludeTitles.map((title) => `- ${title}`).join("\n")
    : "- 없음";

  const plan = Object.entries(config.categories)
    .map(
      ([key, category]) =>
        `- ${key}: 정확히 ${config.topicCandidatesPerCategory}개`,
    )
    .join("\n");

  return `
너는 CozyMoney의 콘텐츠 기획자다.

아래 공식 자료만 근거로 SEO 정보글 주제 후보를 선정한다.
이번 AI 호출은 정확히 1회이며, 추가 호출을 하지 않는다.

## 반드시 지킬 조건

1. 총 12개 후보를 반환한다.
2. 주식 4개, 세금 4개, 재무회계 4개를 정확히 반환한다.
3. 각 주제는 제공된 공식 자료의 실제 sourceId를 최소 1개 사용한다.
4. 존재하지 않는 sourceId를 만들지 않는다.
5. 공식 자료에 없는 최신 수치·날짜·세율·주가·정책을 추측하지 않는다.
6. 기존 글과 사실상 같은 주제를 만들지 않는다.
7. 투자 매수·매도 권유나 수익 보장 표현을 사용하지 않는다.
8. 불법적인 세금 회피 방법을 주제로 만들지 않는다.
9. 모든 제목·키워드·질문은 한국어로 작성한다.
10. JSON 객체 하나만 반환한다.

## 카테고리별 후보 수

${plan}

## 기존 게시글 제목

${existing}

## 공식 자료

${sourceSummaries}

## 검색 의도 허용값

정보 탐색 / 방법 확인 / 조건 확인 / 비교 / 계산 / 일정 확인 / 변경사항 확인 / 초보자 학습

## 출력 규칙

반드시 아래 JSON 객체 하나만 출력한다.

설명하지 않는다.
인사말을 출력하지 않는다.
Markdown을 출력하지 않는다.
코드 펜스를 사용하지 않는다.
<think>를 출력하지 않는다.
<analysis>를 출력하지 않는다.

응답의 첫 글자는 반드시 { 이어야 한다.
응답의 마지막 글자는 반드시 } 이어야 한다.

다음 JSON 구조를 정확하게 따른다.

{
  "topics": [
    {
      "category": "stock",
      "title": "검색 의도가 분명한 제목",
      "keywords": [
        "키워드1",
        "키워드2",
        "키워드3"
      ],
      "searchIntent": "정보 탐색",
      "mainQuestions": [
        "독자가 궁금해할 질문 1",
        "독자가 궁금해할 질문 2"
      ],
      "sourceIds": [
        "실제 자료 ID"
      ]
    }
  ]
}
`.trim();
}

/**
 * ============================================================
 * 주제 연구
 * ============================================================
 */
export async function researchKeywords(sourceSummaries, options = {}) {
  if (typeof sourceSummaries !== "string" || !sourceSummaries.trim()) {
    throw new Error("AI 주제 선정에 사용할 공식 자료가 없습니다.");
  }

  /**
   * sourceSummaries에서 실제 sourceId 추출
   *
   * 예:
   * [자료 ID: abc123]
   */
  const sourceIds = [
    ...new Set(
      [...sourceSummaries.matchAll(/\[자료 ID:\s*([^\]]+)\]/g)].map((match) =>
        match[1].trim(),
      ),
    ),
  ];

  const expectedSourceCount =
    Object.keys(config.categories).length *
    config.topicResearchSourcesPerCategory;

  if (sourceIds.length !== expectedSourceCount) {
    throw new Error(
      `AI 주제 선정용 자료 수가 올바르지 않습니다. ` +
        `필요: ${expectedSourceCount}개 / 실제: ${sourceIds.length}개`,
    );
  }

  logInfo("OpenRouter로 주제 후보를 1회 선정합니다.");

  const compressedSources = compressSourceSummaries(sourceSummaries);

  logInfo(`AI 전달용 공식 자료 압축 완료: ${compressedSources.length}자`);

  const prompt = createPrompt(compressedSources, options.excludeTitles || []);

  const response = await generateWithRetry(prompt, {
    responseFormat: "json",
    preferredProviders: ["openrouter", "groq", "gemini"],
  });

  const data = parseJson(response);

  const normalized = removeDuplicateTopics(normalizeTopics(data?.topics));

  const validated = validateTopics(normalized, sourceIds);

  validateCandidateCounts(validated);

  logInfo(`AI 주제 후보 선정 완료: ${validated.length}개`);

  return validated;
}
