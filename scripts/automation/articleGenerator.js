import { generateWithRetry } from "./aiClient.js";
import { logInfo, logWarning } from "./logger.js";

/**
 * AI가 Markdown을 코드블록으로 감싸서 반환한 경우 제거한다.
 */
function removeCodeFence(text) {
  return String(text)
    .replace(/^```markdown\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/**
 * 생성된 Markdown을 검증한다.
 *
 * 여기서 실패해도 AI를 다시 호출하지 않는다.
 */
function removeExistingFrontmatter(markdown) {
  return String(markdown)
    .replace(/^---\s*\n[\s\S]*?\n---\s*\n?/m, "")
    .trim();
}

function removeFirstH1(markdown) {
  return String(markdown)
    .replace(/^#\s+.+?\s*(?:\r?\n)+/, "")
    .trim();
}

function stripMarkdownForDescription(text) {
  return String(text)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function createDescription(markdown) {
  const lines = String(markdown).split(/\r?\n/);
  const paragraph = lines
    .map((line) => line.trim())
    .find(
      (line) =>
        line &&
        !line.startsWith("#") &&
        !line.startsWith("-") &&
        !line.startsWith(">") &&
        !line.startsWith("|") &&
        !line.startsWith("![")
    );

  const description = stripMarkdownForDescription(
    paragraph || "CozyMoney 금융·세금·재무회계 정보글입니다."
  );
  return description.slice(0, 157).replace(/[.!?]?$/, "...");
}

function createFrontmatter(topic, description) {
  const categoryName =
    {
      stock: "주식",
      tax: "세금",
      accounting: "재무회계",
    }[topic.category] || topic.category;

  const keywords = Array.isArray(topic.keywords)
    ? [...new Set(topic.keywords)]
        .filter(
          (keyword) => typeof keyword === "string" && keyword.trim().length > 0
        )
        .slice(0, 6)
        .map((keyword) => JSON.stringify(String(keyword).trim()))
    : [];

  const tags = [
    ...new Set([
      topic.category,
      ...(Array.isArray(topic.keywords) ? topic.keywords : []),
    ]),
  ]
    .filter(Boolean)
    .slice(0, 6)
    .map((tag) => JSON.stringify(String(tag).trim()));

  const date = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
  }).format(new Date());

  return [
    "---",
    `title: ${JSON.stringify(topic.title)}`,
    `description: ${JSON.stringify(description)}`,
    `date: ${JSON.stringify(date)}`,
    `category: ${JSON.stringify(categoryName)}`,
    `keywords: [${keywords.join(", ")}]`,
    `tags: [${tags.join(", ")}]`,
    "---",
    "",
  ].join("\n");
}

function validateMarkdown(markdown, topic, relatedSources) {
  if (!markdown || typeof markdown !== "string") {
    throw new Error("AI가 Markdown을 반환하지 않았습니다.");
  }

  let cleaned = removeCodeFence(markdown);
  cleaned = removeExistingFrontmatter(cleaned);
  cleaned = removeFirstH1(cleaned);

  if (cleaned.length < 500) {
    throw new Error(`생성된 글의 길이가 너무 짧습니다: ${cleaned.length}자`);
  }

  const description = createDescription(cleaned);
  const sourceSection = createSourceSection(relatedSources);

  return `${createFrontmatter(topic, description)}# ${topic.title}\n\n${cleaned}\n\n${sourceSection}`.trim();
}

function createSourceSection(sources) {
  const lines = ["## 출처", ""];
  for (const source of sources) {
    lines.push(`- [${source.sourceName}] ${source.title}: ${source.url}`);
  }
  return lines.join("\n");
}

/**
 * 게시글 주제에 연결된 공식 자료만 선택한다.
 *
 * topic.sourceIds에 존재하는 자료만 사용한다.
 */
function getRelatedSources(topic, sourceItems) {
  if (!Array.isArray(sourceItems)) {
    throw new Error("공식 자료 목록이 배열이 아닙니다.");
  }

  if (!Array.isArray(topic.sourceIds) || topic.sourceIds.length === 0) {
    throw new Error(
      `게시글 "${topic.title}"에 연결된 공식 자료 ID가 없습니다.`
    );
  }

  const sourceMap = new Map(
    sourceItems.map((source) => [String(source.id).trim(), source])
  );

  const relatedSources = [];

  for (const sourceId of topic.sourceIds) {
    const source = sourceMap.get(String(sourceId).trim());

    if (!source) {
      throw new Error(
        `게시글 "${topic.title}"의 공식 자료를 찾을 수 없습니다: ${sourceId}`
      );
    }

    relatedSources.push(source);
  }

  return relatedSources;
}

/**
 * 공식 자료를 AI 프롬프트에 넣을 문자열로 변환한다.
 */
function createSourceContext(sources) {
  return sources
    .map((source, index) => {
      return [
        `### 공식 자료 ${index + 1}`,
        `[자료 ID: ${source.id}]`,
        `기관: ${source.sourceName}`,
        `분야: ${source.category}`,
        `제목: ${source.title}`,
        `게시일: ${source.publishedAt || "확인 필요"}`,
        `요약: ${source.description || "없음"}`,
        `핵심 내용: ${source.content || "없음"}`,
        `원문 URL: ${source.url}`,
      ].join("\n");
    })
    .join("\n\n---\n\n");
}

/**
 * 게시글 생성 프롬프트
 *
 * topic에 연결된 공식 자료만 AI에게 전달한다.
 */
/**
 * 게시글 생성 프롬프트
 *
 * topic에 연결된 공식 자료만 AI에게 전달한다.
 */
function createArticlePrompt(topic, sourceItems) {
  const relatedSources = getRelatedSources(topic, sourceItems);
  const sourceContext = createSourceContext(relatedSources);

  return `
너는 대한민국 금융·세금·재무회계 전문 정보 블로그인 CozyMoney의 콘텐츠 작성자다.

아래 주제와 제공된 공식 자료를 바탕으로 초보자도 이해하기 쉬운 정보성 Markdown 글을 작성한다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[카테고리]
${topic.category}

[주제]
${topic.title}

[핵심 키워드]
${Array.isArray(topic.keywords) ? topic.keywords.join(", ") : topic.title}

[검색 의도]
${topic.searchIntent || "정보 탐색"}

[독자가 궁금해할 질문]
${
  Array.isArray(topic.mainQuestions)
    ? topic.mainQuestions.map((question) => `- ${question}`).join("\n")
    : "- 주제의 핵심 내용을 이해할 수 있는 질문"
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 공식 자료

아래 공식 자료만 사실의 근거로 사용한다.

${sourceContext}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 가장 중요한 사실 작성 원칙

1. 반드시 위에 제공된 공식 자료를 사실 확인의 최우선 근거로 사용한다.

2. 공식 자료에서 확인할 수 없는 최신 수치, 통계, 날짜, 정책, 법령,
   세율, 주가, 기업 실적 등의 정보를 임의로 만들지 않는다.

3. 공식 자료에서 확인되지 않는 내용을 사실처럼 단정하지 않는다.

4. 공식 자료의 내용을 왜곡하거나 과장하지 않는다.

5. 공식 자료에 없는 내용을 설명해야 하는 경우
   일반적인 개념 설명 수준으로 작성한다.

6. 공식 자료에 없는 구체적인 최신 사실이나 수치를 추측해서 작성하지 않는다.

7. 원문 URL을 임의로 생성하지 않는다.

8. 제공된 공식 자료의 URL을 변경하지 않는다.

9. 존재하지 않는 URL을 만들어내지 않는다.

10. 투자 수익을 보장하는 표현을 사용하지 않는다.

11. 특정 종목의 매수 또는 매도를 직접적으로 유도하지 않는다.

12. 불법적인 세금 회피 방법을 설명하지 않는다.

13. 확인되지 않은 회계 정보를 사실처럼 작성하지 않는다.

14. 출처에 없는 내용을 출처가 있는 것처럼 표현하지 않는다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 글 작성 규칙

1. 초보자가 이해할 수 있도록 쉽게 작성한다.

2. 자연스러운 한국어를 사용한다.

3. 짧고 명확한 문단을 사용한다.

4. 제목과 소제목을 명확하게 구성한다.

5. 필요한 경우 Markdown 표를 사용한다.

6. 중요한 내용은 Markdown bullet list로 정리한다.

7. 핵심 키워드를 부자연스럽게 반복하지 않는다.

8. 같은 문장이나 내용을 반복하지 않는다.

9. 다른 사이트의 글을 복사하지 않는다.

10. 충분한 설명이 있는 완성된 정보성 글을 작성한다.

11. 불필요한 인사말을 작성하지 않는다.

12. "안녕하세요"와 같은 인사말을 사용하지 않는다.

13. 작성 과정이나 AI에 대한 설명을 작성하지 않는다.

14. 독자에게 불필요한 광고성 문구를 작성하지 않는다.

15. 확인되지 않은 내용을 추측해서 글의 분량을 늘리지 않는다.

16. 글 마지막에는 핵심 내용을 간단하게 정리한다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## Markdown 전용 출력 규칙

이 규칙은 매우 중요하다.

AI의 출력은 반드시 "순수 Markdown 본문"이어야 한다.

### 허용

다음 Markdown 문법만 사용한다.

- 일반 문단
- ## H2
- ### H3
- #### H4
- **굵게**
- *기울임*
- 순서 없는 목록
- 순서 있는 목록
- Markdown 표
- Markdown 인용문
- Markdown 수평선
- 인라인 코드
- 필요한 경우 Markdown 링크

### 절대 금지

HTML을 절대로 출력하지 않는다.

다음과 같은 HTML 태그를 사용하지 않는다.

<h1>
<h2>
<h3>
<h4>
<h5>
<h6>
<p>
<div>
<span>
<section>
<article>
<header>
<footer>
<main>
<nav>
<table>
<thead>
<tbody>
<tr>
<th>
<td>
<ul>
<ol>
<li>
<a>
<img>
<br>
<hr>
<strong>
<em>

위 목록에 없는 HTML 태그도 모두 금지한다.

Markdown 내부에 HTML을 삽입하지 않는다.

### React / JSX 금지

다음도 절대로 출력하지 않는다.

- JSX
- React 컴포넌트
- React 코드
- JavaScript
- TypeScript
- CSS
- JSON
- YAML
- XML

코드블록도 사용하지 않는다.

특히 다음 형태를 절대로 생성하지 않는다.

\`\`\`html
\`\`\`

\`\`\`jsx
\`\`\`

\`\`\`javascript
\`\`\`

\`\`\`css
\`\`\`

### 이미지 금지

AI는 이미지를 생성하거나 삽입하지 않는다.

다음 형식을 사용하지 않는다.

![이미지](URL)

<img src="URL">

이미지는 자동 포스팅 시스템이 별도로 처리한다.

### URL 규칙

제공된 공식 자료에 실제 존재하는 URL만 사용한다.

URL을 추측하거나 생성하지 않는다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 제목 규칙

게시글 제목은 시스템이 별도로 관리한다.

따라서 본문에 H1 제목을 작성하지 않는다.

다음과 같이 시작하지 않는다.

# ${topic.title}

본문은 도입부 또는 H2부터 시작한다.

올바른 예:

도입부 내용입니다.

## 핵심 내용

본문 내용입니다.

## 자세히 알아보기

본문 내용입니다.

잘못된 예:

# ${topic.title}

도입부 내용입니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 권장 본문 구조

도입부

## 핵심 내용

주제의 핵심 내용을 설명한다.

## 자세히 알아보기

세부 내용을 설명한다.

### 세부 내용

필요한 경우 추가 설명을 작성한다.

## 주의할 점

독자가 주의해야 할 사항을 설명한다.

## 핵심 정리

핵심 내용을 간단하게 정리한다.

단, 주제에 따라 불필요한 섹션은 생략할 수 있다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 최종 출력 검증

출력하기 전에 내부적으로 반드시 확인한다.

1. HTML 태그가 없는가?
2. Markdown 내부 HTML이 없는가?
3. JSX가 없는가?
4. JavaScript가 없는가?
5. CSS가 없는가?
6. JSON이 없는가?
7. YAML이 없는가?
8. 코드블록이 없는가?
9. H1이 없는가?
10. 이미지 Markdown이 없는가?
11. 존재하지 않는 URL을 만들지 않았는가?
12. 제공된 공식 자료를 벗어난 최신 사실이나 수치를 만들지 않았는가?
13. AI에 대한 설명이나 작성 과정 설명이 없는가?
14. 완성된 Markdown 본문만 출력하는가?

하나라도 위반하면 출력하기 전에 스스로 수정한다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 최종 출력

다른 설명 없이 완성된 순수 Markdown 본문만 출력한다.
`.trim();
}

/**
 * 게시글 1개 생성
 *
 * AI 요청은 이 함수에서 1회만 발생한다.
 * 생성 실패 후 같은 주제로 재생성하지 않는다.
 */
async function generateArticle(topic, sourceItems) {
  if (!topic || typeof topic !== "object") {
    throw new Error("게시글 주제 정보가 올바르지 않습니다.");
  }

  if (!topic.title || typeof topic.title !== "string") {
    throw new Error("게시글 제목이 없습니다.");
  }

  logInfo(`게시글 생성 시작: ${topic.title}`);

  const prompt = createArticlePrompt(topic, sourceItems);

  /**
   * AI API 요청
   *
   * 정상적인 경우 게시글 1개당 1회.
   *
   * 재생성은 하지 않는다.
   */
  const response = await generateWithRetry(prompt, { responseFormat: "text" });

  const relatedSources = getRelatedSources(topic, sourceItems);
  const markdown = validateMarkdown(response, topic, relatedSources);

  logInfo(`게시글 생성 완료: ${topic.title}`);

  return {
    topic,
    board: topic.category,
    markdown,
    sources: relatedSources,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 여러 게시글 생성
 *
 * 반드시 순차적으로 실행한다.
 *
 * 게시글 1 → AI 1회
 * 게시글 2 → AI 1회
 * 게시글 3 → AI 1회
 * ...
 *
 * Promise.all()을 사용하지 않는다.
 */
export async function generateArticles(topics, sourceItems) {
  if (!Array.isArray(topics)) {
    throw new Error("게시글 생성 대상 topics가 배열이 아닙니다.");
  }

  if (topics.length === 0) {
    throw new Error("게시글 생성 대상 주제가 없습니다.");
  }

  if (!Array.isArray(sourceItems) || sourceItems.length === 0) {
    throw new Error("게시글 생성에 사용할 공식 자료가 없습니다.");
  }

  const articles = [];

  for (let index = 0; index < topics.length; index++) {
    const topic = topics[index];

    logInfo(`게시글 ${index + 1}/${topics.length} 생성 시작`);

    try {
      const article = await generateArticle(topic, sourceItems);

      articles.push(article);

      logInfo(`게시글 ${index + 1}/${topics.length} 생성 완료`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      logWarning(`게시글 생성 실패: ${topic?.title ?? "제목 없음"}`, message);

      /**
       * 실패한 글을 다시 AI에게 요청하지 않는다.
       */
    }
  }

  logInfo(`게시글 생성 종료: ${articles.length}/${topics.length}개`);

  return articles;
}
