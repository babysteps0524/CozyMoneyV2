import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

function getKoreanDateTime() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    dateStyle: "short",
    timeStyle: "medium",
    hour12: false,
  })
    .format(new Date())
    .replace(" ", "T");
}

function getReportFileName() {
  return getKoreanDateTime().replaceAll(":", "-");
}

function createMarkdownReport(result) {
  const lines = [
    "# CozyMoney 자동 포스팅 실행 보고서",
    "",
    `- 시작 시각: ${result.startedAt}`,
    `- 종료 시각: ${result.finishedAt}`,
    `- 실행 모드: ${config.dryRun ? "DRY_RUN" : "실제 게시"}`,
    `- 기존 글 수: ${result.existingPosts.length}개`,
    `- 공식 자료 수집: ${result.sourceItems.length}건`,
    `- JavaScript 1차 필터: ${result.filteredSourceItems.length}건`,
    `- AI 주제 후보: ${result.candidateTopics.length}개`,
    `- 중복 제외: ${result.rejectedTopics.length}개`,
    `- 최종 주제: ${result.selectedTopics.length}개`,
    `- 본문 생성 성공: ${result.articleDrafts.length}개`,
    `- Pexels 이미지 검색 성공 글: ${result.imageResults.filter((item) => item.status === "PASS").length}개`,
    `- 코드 검증 통과: ${result.validationResults.filter((item) => item.status === "PASS").length}개`,
    `- 실제 게시 성공: ${result.publishedArticles.length}개`,
    `- 실제 게시 실패: ${result.publishFailures.length}개`,
    `- 사이트 빌드: ${result.buildSucceeded ? "성공" : "실패 또는 실행 안 됨"}`,
    "",
  ];

  lines.push("## AI API 사용량", "");
  for (const [provider, stats] of Object.entries(result.aiUsage || {})) {
    lines.push(
      `- ${provider}: 호출 ${stats.calls}회 / 성공 ${stats.successes}회 / 실패 ${stats.failures}회 / 한도초과 ${stats.quotaErrors}회`,
    );
  }

  lines.push("", "## 최종 주제", "");
  for (const topic of result.selectedTopics) {
    lines.push(`- [${topic.category}] ${topic.title}`);
  }

  lines.push("", "## Pexels 이미지 결과", "");
  for (const item of result.imageResults) {
    lines.push(`- ${item.status}: ${item.title} (${item.count}개)`);
    if (item.error) lines.push(`  - 오류: ${item.error}`);
  }

  if (result.factCheckResults.length > 0) {
    lines.push("", "## AI 사실 검증 결과", "");
    for (const item of result.factCheckResults) {
      lines.push(`- ${item.status}: ${item.title}`);
      for (const error of item.errors || []) lines.push(`  - 오류: ${error}`);
      for (const warning of item.warnings || []) lines.push(`  - 주의: ${warning}`);
    }
  } else {
    lines.push("", "## AI 사실 검증 결과", "", "- 비활성화됨");
  }

  lines.push("", "## 코드 검증 결과", "");
  for (const item of result.validationResults) {
    lines.push(`- ${item.status}: ${item.topic?.title ?? "제목 없음"}`);
    for (const error of item.errors || []) lines.push(`  - 오류: ${error}`);
    for (const warning of item.warnings || []) lines.push(`  - 주의: ${warning}`);
  }

  lines.push("", "## 게시 결과", "");
  for (const article of result.publishedArticles) {
    lines.push(`- 성공: ${article.relativeFilePath}`);
  }
  for (const failure of result.publishFailures) {
    lines.push(`- 실패: ${failure.title} — ${failure.error}`);
  }

  if (result.error) {
    lines.push("", "## 실행 오류", "", result.error);
  }

  return `${lines.join("\n")}\n`;
}

export function createAutomationReport(result) {
  const reportDirectory = path.join(
    config.reportsDir,
    getKoreanDateTime().slice(0, 10),
  );

  fs.mkdirSync(reportDirectory, { recursive: true });

  const fileName = getReportFileName();
  const jsonPath = path.join(reportDirectory, `${fileName}.json`);
  const markdownPath = path.join(reportDirectory, `${fileName}.md`);

  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), "utf8");
  fs.writeFileSync(markdownPath, createMarkdownReport(result), "utf8");

  return { jsonPath, markdownPath };
}
