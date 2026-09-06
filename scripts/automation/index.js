import { publishArticles, rollbackPublishedArticles } from "./publisher.js";
import { buildSite } from "./siteBuilder.js";
import { validateArticles } from "./validator.js";
import { generateArticles } from "./articleGenerator.js";
import { checkDuplicates } from "./duplicateCheck.js";
import { loadExistingPosts } from "./existingPosts.js";
import { researchKeywords } from "./keywordResearch.js";
import { config, validateEnvironment } from "./config.js";
import { logError, logInfo, logWarning } from "./logger.js";
import {
  collectOfficialSources,
  selectSourcesForTopicResearch,
  createTopicResearchSummaries,
} from "./sourceResearch.js";
import { createAutomationReport } from "./reportGenerator.js";
import { getAIUsageStats, resetAIUsageStats } from "./aiClient.js";
import { generateArticleImages } from "./imageGenerator.js";
import { factCheckArticles } from "./factCheck.js";

function getRequiredArticleCount() {
  return Object.values(config.categories).reduce(
    (total, category) => total + category.count,
    0,
  );
}

function validateSelectedTopics(selectedTopics) {
  const requiredArticleCount = getRequiredArticleCount();

  if (!Array.isArray(selectedTopics) || selectedTopics.length !== requiredArticleCount) {
    throw new Error(
      `최종 주제 수가 올바르지 않습니다. 필요: ${requiredArticleCount}개, 실제: ${selectedTopics?.length ?? 0}개`,
    );
  }

  for (const [categoryKey, category] of Object.entries(config.categories)) {
    const count = selectedTopics.filter((topic) => topic.category === categoryKey).length;
    if (count !== category.count) {
      throw new Error(
        `${category.name} 최종 주제 수가 올바르지 않습니다. 필요: ${category.count}개, 실제: ${count}개`,
      );
    }
  }
}

function selectTopicsByCategory(acceptedTopics) {
  const selectedTopics = [];

  for (const [categoryKey, category] of Object.entries(config.categories)) {
    const categoryTopics = acceptedTopics.filter((topic) => topic.category === categoryKey);

    if (categoryTopics.length < category.count) {
      throw new Error(
        `중복 검사 후 ${category.name} 주제가 부족합니다. ` +
          `필요: ${category.count}개, 확보: ${categoryTopics.length}개`,
      );
    }

    selectedTopics.push(...categoryTopics.slice(0, category.count));
  }

  validateSelectedTopics(selectedTopics);
  return selectedTopics;
}

async function selectFinalTopics(candidateTopics, existingPosts) {
  const { acceptedTopics, rejectedTopics } = await checkDuplicates(
    candidateTopics,
    existingPosts,
  );

  const selectedTopics = selectTopicsByCategory(acceptedTopics);

  return { selectedTopics, rejectedTopics };
}

async function generateImagesForArticles(articles, result) {
  const successful = [];

  for (let index = 0; index < articles.length; index++) {
    const article = articles[index];
    const title = article.topic?.title ?? "제목 없음";

    try {
      logInfo(`Pexels 이미지 검색 시작 ${index + 1}/${articles.length}: ${title}`);
      const articleWithImages = await generateArticleImages(article);

      if (!articleWithImages.images?.length) {
        throw new Error("이미지가 1개도 생성되지 않았습니다.");
      }

      successful.push(articleWithImages);
      result.imageResults.push({
        title,
        status: "PASS",
        count: articleWithImages.images.length,
      });

      logInfo(`Pexels 이미지 검색 완료: ${title} (${articleWithImages.images.length}개)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.imageResults.push({ title, status: "FAIL", count: 0, error: message });
      logWarning(`Pexels 이미지 검색 실패로 게시 제외: ${title}`, message);
    }
  }

  return successful;
}

function filterValidArticles(articles, validationResults) {
  const passByTitle = new Map(
    validationResults.map((item) => [item.topic?.title, item.status === "PASS"]),
  );

  return articles.filter((article) => passByTitle.get(article.topic?.title) === true);
}

async function runAutoPost() {
  resetAIUsageStats();
  const startedAt = new Date();
  const requiredArticleCount = getRequiredArticleCount();

  const result = {
    startedAt: startedAt.toISOString(),
    finishedAt: "",
    existingPosts: [],
    sourceItems: [],
    filteredSourceItems: [],
    topicResearchSummaries: "",
    candidateTopics: [],
    rejectedTopics: [],
    selectedTopics: [],
    articleDrafts: [],
    factCheckResults: [],
    imageResults: [],
    validationResults: [],
    publishedArticles: [],
    publishFailures: [],
    buildSucceeded: false,
    error: "",
    aiUsage: null,
  };

  logInfo("자동 포스팅 작업을 시작합니다.");
  logInfo(config.dryRun ? "DRY_RUN 모드입니다." : "실제 게시 모드입니다.");

  try {
    // 1. 환경 검사
    validateEnvironment();

    // 2. 기존 글 로드
    result.existingPosts = loadExistingPosts();
    logInfo(`기존 게시글 ${result.existingPosts.length}개를 불러왔습니다.`);

    const existingTitles = result.existingPosts
      .map((post) => post.title)
      .filter((title) => typeof title === "string" && title.trim())
      .map((title) => title.trim());

    // 3. 공식 자료 약 70~80개 수집
    result.sourceItems = await collectOfficialSources();
    logInfo(`공식 자료 수집 완료: ${result.sourceItems.length}건`);

    // 4. JavaScript 1차 필터: 카테고리별 4개 → 총 12개
    result.filteredSourceItems = selectSourcesForTopicResearch(result.sourceItems);

    const expectedResearchSources = Object.keys(config.categories).length *
      config.topicResearchSourcesPerCategory;

    if (result.filteredSourceItems.length !== expectedResearchSources) {
      throw new Error(
        `JavaScript 1차 필터 결과가 12개가 아닙니다. ` +
          `필요: ${expectedResearchSources}개, 실제: ${result.filteredSourceItems.length}개`,
      );
    }

    // 5. 자료 크기 압축/요약
    result.topicResearchSummaries = createTopicResearchSummaries(
      result.filteredSourceItems,
    );
    logInfo(`AI 전달용 자료 압축 완료: ${result.filteredSourceItems.length}개`);

    // 6. OpenRouter 주제 선정 AI 1회 → 12개 후보
    result.candidateTopics = await researchKeywords(result.topicResearchSummaries, {
      excludeTitles: existingTitles,
    });

    // 7. 중복 검사 → 최종 6개
    const topicSelection = await selectFinalTopics(
      result.candidateTopics,
      result.existingPosts,
    );

    result.selectedTopics = topicSelection.selectedTopics;
    result.rejectedTopics = topicSelection.rejectedTopics;

    logInfo(`최종 주제 확정: ${result.selectedTopics.length}개`);

    // 8. 본문 생성: 글별 1회, 실패한 글만 제외
    result.articleDrafts = await generateArticles(
      result.selectedTopics,
      result.sourceItems,
    );

    logInfo(
      `본문 생성 완료: ${result.articleDrafts.length}/${requiredArticleCount}개`,
    );

    if (result.articleDrafts.length === 0) {
      throw new Error("본문 생성에 성공한 게시글이 없습니다.");
    }

    // 9. AI 사실 검증: 기본 OFF, 켜면 Groq → OpenRouter → Gemini 1회 배치
    let factCheckedArticles = result.articleDrafts;

    if (config.aiFactCheck.enabled) {
      logInfo("AI 사실 검증을 시작합니다.");

      try {
        factCheckedArticles = await factCheckArticles(result.articleDrafts);
        result.factCheckResults = factCheckedArticles.map((article) => ({
          title: article.topic?.title,
          status: article.status,
          errors: article.errors ?? [],
          warnings: article.warnings ?? [],
        }));

        factCheckedArticles = factCheckedArticles.filter(
          (article) => article.status !== "FAIL",
        );

        logInfo(`AI 사실 검증 통과: ${factCheckedArticles.length}개`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logWarning(
          "AI 사실 검증 API 자체가 실패했습니다. 해당 단계는 건너뛰고 코드 검증으로 진행합니다.",
          message,
        );
        factCheckedArticles = result.articleDrafts;
      }
    } else {
      logInfo("AI 사실 검증은 비활성화되어 있습니다.");
    }

    if (factCheckedArticles.length === 0) {
      throw new Error("AI 사실 검증 후 게시 가능한 글이 없습니다.");
    }

    // 10. Pexels 이미지 검색: 글별 최대 2개, 1개 이상이면 게시 가능
    const articlesWithImages = await generateImagesForArticles(
      factCheckedArticles,
      result,
    );

    if (articlesWithImages.length === 0) {
      throw new Error("Pexels 이미지 검색에 성공한 게시글이 없습니다.");
    }

    result.articleDrafts = articlesWithImages;

    // 11. 코드 기반 validator: 실패 글만 제외
    result.validationResults = validateArticles(articlesWithImages);

    const validArticles = filterValidArticles(
      articlesWithImages,
      result.validationResults,
    );

    for (const validation of result.validationResults) {
      if (validation.status === "FAIL") {
        logWarning(
          `코드 검증 실패로 게시 제외: ${validation.topic?.title ?? "제목 없음"}`,
          validation.errors?.join(" / ") || "검증 실패",
        );
      }
    }

    if (validArticles.length === 0) {
      throw new Error("코드 검증을 통과한 게시글이 없습니다.");
    }

    logInfo(`최종 게시 대상: ${validArticles.length}/${requiredArticleCount}개`);

    // 12. 부분 게시: 한 글의 저장 실패가 다른 글을 막지 않음
    const publishResult = publishArticles(validArticles, {
      allowPartialPublishing: config.publishing.allowPartialPublishing,
    });

    result.publishedArticles = publishResult.publishedArticles;
    result.publishFailures = publishResult.failedArticles;

    for (const failure of result.publishFailures) {
      logWarning(`게시 실패: ${failure.title}`, failure.error);
    }

    if (result.publishedArticles.length === 0) {
      throw new Error("게시된 게시글이 없습니다.");
    }

    logInfo(
      `부분 게시 완료: ${result.publishedArticles.length}/${requiredArticleCount}개`,
    );

    // 13. 성공한 글만 사이트 빌드
    await buildSite(result.publishedArticles);
    result.buildSucceeded = true;

    logInfo(
      config.dryRun
        ? `DRY_RUN 완료: ${result.publishedArticles.length}개 게시글 파일을 생성했습니다.`
        : `자동 게시 완료: ${result.publishedArticles.length}개`,
    );
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    logError("자동 포스팅 작업 오류", result.error);

    // 빌드 실패처럼 이미 파일을 만든 뒤 전체 작업을 계속할 수 없는 경우에만 롤백한다.
    if (result.publishedArticles.length > 0 && !result.buildSucceeded) {
      try {
        rollbackPublishedArticles(result.publishedArticles);
        result.publishedArticles = [];
        logWarning("사이트 빌드 실패로 게시된 Markdown을 롤백했습니다.");
      } catch (rollbackError) {
        logError(
          "게시글 롤백 실패",
          rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
        );
      }
    }

    process.exitCode = 1;
  } finally {
    result.finishedAt = new Date().toISOString();
    result.aiUsage = getAIUsageStats();

    try {
      const reportPaths = createAutomationReport(result);
      logInfo(`보고서 저장: ${reportPaths.markdownPath}`);
    } catch (error) {
      logError(
        "자동화 보고서 저장 실패",
        error instanceof Error ? error.message : String(error),
      );
    }

    const elapsed = ((Date.now() - startedAt.getTime()) / 1000).toFixed(1);
    logInfo(`자동 포스팅 종료. 소요 시간: ${elapsed}초`);
  }
}

runAutoPost();
