import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { logError, logInfo } from "./logger.js";

function getReportDirectory() {
  const date = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    dateStyle: "short",
  }).format(new Date());

  return path.join(config.reportsDir, date);
}

function saveBuildLog(output) {
  const reportDirectory = getReportDirectory();

  fs.mkdirSync(reportDirectory, { recursive: true });

  fs.writeFileSync(path.join(reportDirectory, "build.log"), output, "utf8");
}

function verifyGeneratedPages(publishedArticles) {
  if (!Array.isArray(publishedArticles)) {
    throw new Error("빌드 결과를 검사할 게시글 목록이 없습니다.");
  }

  if (publishedArticles.length === 0) {
    throw new Error("빌드 결과를 검사할 게시글이 없습니다.");
  }

  /*
   * 실제 게시 모드에서는 build-posts.js가 생성한
   * 게시글 HTML을 검사한다.
   */
  if (!config.dryRun) {
    for (const article of publishedArticles) {
      const generatedPagePath = path.join(
        config.rootDir,
        article.board,
        article.postId,
        "index.html",
      );

      if (!fs.existsSync(generatedPagePath)) {
        throw new Error(
          `생성된 HTML 페이지를 찾을 수 없습니다: ${article.board}/${article.postId}`,
        );
      }

      const html = fs.readFileSync(generatedPagePath, "utf8");

      if (!html.trim()) {
        throw new Error(
          `생성된 HTML 파일이 비어 있습니다: ${article.board}/${article.postId}`,
        );
      }

      if (!/<title>[\s\S]*<\/title>/i.test(html)) {
        throw new Error(
          `HTML title이 없습니다: ${article.board}/${article.postId}`,
        );
      }

      if (!/<h1\b[^>]*>[\s\S]*<\/h1>/i.test(html)) {
        throw new Error(
          `HTML H1이 없습니다: ${article.board}/${article.postId}`,
        );
      }
    }
  }
}

export async function buildSite(publishedArticles) {
  logInfo("사이트 빌드를 시작합니다.");

  const process = Bun.spawn(["bun", "run", "build"], {
    cwd: config.rootDir,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [standardOutput, standardError] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);

  const exitCode = await process.exited;

  const output = [standardOutput, standardError].filter(Boolean).join("\n");

  saveBuildLog(output);

  if (exitCode !== 0) {
    logError("사이트 빌드에 실패했습니다.", output);

    throw new Error(`사이트 빌드 실패(exit code: ${exitCode})`);
  }

  verifyGeneratedPages(publishedArticles);

  logInfo("사이트 빌드와 생성 페이지 기본 검사가 완료됐습니다.");
}
