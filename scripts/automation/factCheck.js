import { logInfo, logWarning } from "./logger.js";
import { generateWithRetry } from "./aiClient.js";

function removeCodeFence(text) {
  return String(text)
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseJson(text) {
  const cleanedText = removeCodeFence(text);

  try {
    return JSON.parse(cleanedText);
  } catch (error) {
    throw new Error(
      `사실 검증 JSON 파싱에 실패했습니다: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function createSourceContext(sources = []) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return "제공된 공식 자료가 없습니다.";
  }

  return sources
    .map((source) =>
      [
        `[출처 ID: ${source.id}]`,
        `기관: ${source.sourceName}`,
        `제목: ${source.title}`,
        `내용: ${source.description || "내용 없음"}`,
        `URL: ${source.url}`,
        `게시일: ${source.publishedAt || "확인 필요"}`,
      ].join("\n"),
    )
    .join("\n\n---\n\n");
}

/**
 * 여러 게시글을 한 번의 AI 요청으로 검증하기 위한 프롬프트
 */
function createBatchPrompt(articles) {
  const articlesContext = articles
    .map((article, index) =>
      [
        `===== 게시글 ${index + 1} =====`,
        `검증 ID: ${index}`,
        `카테고리: ${article.topic.category}`,
        `제목: ${article.topic.title}`,
        "",
        article.markdown,
      ].join("\n"),
    )
    .join("\n\n========================================\n\n");

  const sources = [];

  for (const article of articles) {
    if (!Array.isArray(article.sources)) {
      continue;
    }

    for (const source of article.sources) {
      if (!source?.id) {
        continue;
      }

      if (!sources.some((item) => item.id === source.id)) {
        sources.push(source);
      }
    }
  }

  return `
너는 대한민국 금융·세금·재무회계 정보글의 엄격한 사실 검증자다.

아래 여러 개의 Markdown 게시글을 한 번에 검증한다.

중요한 규칙:

1. 반드시 아래에 제공된 공식 자료만 근거로 판단한다.
2. 외부 지식이나 인터넷 검색을 사용하지 않는다.
3. 공식 자료에 명시되지 않은 내용을 임의로 보완하지 않는다.
4. 확인되지 않은 숫자나 통계를 사실처럼 인정하지 않는다.
5. 날짜, 금액, 세율, 주가, 수익률, 기업 실적 등을 임의로 인정하지 않는다.
6. 법령, 정책, 회계기준, 신고기한 등의 내용도 공식 자료에 근거가 없으면 검증할 수 없는 주장으로 판단한다.
7. 투자 수익을 보장하는 표현이 있는지 확인한다.
8. 핵심 사실에 문제가 있는 경우 FAIL로 판단한다.
9. 단순한 표현상의 문제는 가능한 한 지적하지 않는다.
10. 각 게시글을 독립적으로 판단한다.
11. 반드시 JSON 하나만 반환한다.
12. Markdown이나 설명문을 JSON 앞뒤에 추가하지 않는다.

[공식 자료]

${createSourceContext(sources)}

[검증할 게시글]

${articlesContext}

[판정 기준]

PASS:
핵심 사실 주장에 문제가 없고 제공된 공식 자료와 충돌하지 않는다.

WARNING:
사실 오류라고 단정하기 어렵지만 표현이나 근거에 주의가 필요하다.

FAIL:
핵심 사실이 공식 자료와 다르거나,
공식 자료 없이 중요한 사실을 단정적으로 작성했다.

[출력 형식]

{
  "results": [
    {
      "articleIndex": 0,
      "status": "PASS | WARNING | FAIL",
      "issues": [
        {
          "level": "WARNING | FAIL",
          "claim": "검증한 문장 또는 주장",
          "reason": "검증 결과와 근거",
          "sourceId": "관련 출처 ID 또는 null"
        }
      ]
    }
  ]
}

반드시 articleIndex를 0부터 순서대로 모든 게시글에 대해 하나씩 반환한다.

issues가 없다면 빈 배열을 반환한다.

다른 설명은 출력하지 않는다.
`.trim();
}

function validateSingleResult(result, articleIndex) {
  const validStatuses = ["PASS", "WARNING", "FAIL"];

  if (!result || typeof result !== "object") {
    throw new Error(
      `게시글 ${articleIndex + 1}의 사실 검증 결과가 객체가 아닙니다.`,
    );
  }

  if (!validStatuses.includes(result.status)) {
    throw new Error(
      `게시글 ${articleIndex + 1}의 사실 검증 status가 올바르지 않습니다.`,
    );
  }

  if (!Array.isArray(result.issues)) {
    throw new Error(
      `게시글 ${articleIndex + 1}의 사실 검증 issues가 배열이 아닙니다.`,
    );
  }

  return result;
}

/**
 * AI가 반환한 전체 검증 결과를 검사한다.
 */
function validateBatchResult(result, articleCount) {
  if (!result || typeof result !== "object") {
    throw new Error("사실 검증 결과가 객체가 아닙니다.");
  }

  if (!Array.isArray(result.results)) {
    throw new Error("사실 검증 결과의 results가 배열이 아닙니다.");
  }

  if (result.results.length !== articleCount) {
    throw new Error(
      `사실 검증 결과 개수가 올바르지 않습니다. ` +
        `필요: ${articleCount}개, 반환: ${result.results.length}개`,
    );
  }

  const validatedResults = [];

  for (let index = 0; index < articleCount; index++) {
    const item = result.results.find(
      (candidate) => Number(candidate?.articleIndex) === index,
    );

    if (!item) {
      throw new Error(`게시글 ${index + 1}의 사실 검증 결과가 없습니다.`);
    }

    validatedResults.push(validateSingleResult(item, index));
  }

  return validatedResults;
}

/**
 * AI 검증 결과를 게시글 객체에 붙인다.
 */
function applyFactCheckResult(article, result) {
  return {
    ...article,

    factCheck: result,

    status: result.status,

    errors: result.issues
      .filter((issue) => issue.level === "FAIL")
      .map((issue) => issue.reason),

    warnings: result.issues
      .filter((issue) => issue.level === "WARNING")
      .map((issue) => issue.reason),
  };
}

/**
 * 게시글 1개만 검증해야 하는 경우를 위한 함수.
 *
 * 일반적인 자동 포스팅에서는 factCheckArticles()를 사용한다.
 */
export async function factCheckArticle(article) {
  if (!article || typeof article !== "object") {
    throw new Error("사실 검증 대상 article이 올바르지 않습니다.");
  }

  const results = await factCheckArticles([article]);

  return results[0];
}

/**
 * 모든 게시글을 한 번의 AI 요청으로 사실 검증한다.
 *
 * 핵심:
 *
 * 기존 방식:
 * 게시글 1 → AI
 * 게시글 2 → AI
 * 게시글 3 → AI
 * 게시글 4 → AI
 * 게시글 5 → AI
 * 게시글 6 → AI
 *
 * 총 6회
 *
 * 변경 방식:
 * 게시글 1
 * 게시글 2
 * 게시글 3
 * 게시글 4
 * 게시글 5
 * 게시글 6
 *       ↓
 *      AI 1회
 */
export async function factCheckArticles(articles) {
  if (!Array.isArray(articles)) {
    throw new Error("사실 검증 대상 게시글이 배열이 아닙니다.");
  }

  if (articles.length === 0) {
    return [];
  }

  logInfo(`게시글 ${articles.length}개를 한 번에 사실 검증합니다.`);

  try {
    const prompt = createBatchPrompt(articles);

    /*
     * AI 호출은 딱 한 번만 한다.
     *
     * aiClient.js에서 이미 Provider 선택을 담당하므로
     * 여기서 Gemini → Groq → OpenRouter를 직접 처리하지 않는다.
     */
    const response = await generateWithRetry(prompt, { responseFormat: "json", preferredProviders: ["groq", "openrouter", "gemini"] });

    const parsedResult = parseJson(response);

    const validatedResults = validateBatchResult(parsedResult, articles.length);

    const checkedArticles = articles.map((article, index) => {
      const checkedArticle = applyFactCheckResult(
        article,
        validatedResults[index],
      );

      if (checkedArticle.status === "FAIL") {
        logWarning(
          `사실 검증 실패: ${article.topic.title}`,
          checkedArticle.errors.join(" / "),
        );
      } else {
        logInfo(`사실 검증 ${checkedArticle.status}: ${article.topic.title}`);
      }

      return checkedArticle;
    });

    logInfo(`사실 검증 완료: ${checkedArticles.length}개 게시글`);

    return checkedArticles;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logWarning("일괄 사실 검증 처리 오류", message);
    throw error;
  }
}
