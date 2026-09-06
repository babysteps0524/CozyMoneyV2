import path from "node:path";

const rootDir = process.cwd();

function readBoolean(value, defaultValue = false) {
  if (value === undefined || value === "") return defaultValue;
  return String(value).trim().toLowerCase() === "true";
}

function readPositiveNumber(value, defaultValue) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : defaultValue;
}

export const config = {
  rootDir,
  postsDir: path.join(rootDir, "src", "data", "posts"),
  reportsDir: path.join(rootDir, "reports", "automation"),
  logsDir: path.join(rootDir, "logs"),

  dryRun: readBoolean(process.env.DRY_RUN, true),

  categories: {
    stock: { board: "stock", name: "주식", count: 2 },
    tax: { board: "tax", name: "세금", count: 2 },
    accounting: { board: "accounting", name: "재무회계", count: 2 },
  },

  // JavaScript 1차 필터: 카테고리별 4개 → 총 12개
  topicResearchSourcesPerCategory: readPositiveNumber(
    process.env.AUTO_POST_RESEARCH_SOURCES_PER_CATEGORY,
    4,
  ),

  // AI 주제 후보: 카테고리별 4개 → 총 12개
  topicCandidatesPerCategory: readPositiveNumber(
    process.env.AUTO_POST_CANDIDATES_PER_CATEGORY,
    4,
  ),

  duplicateCheck: {
    titleSimilarityThreshold: 0.75,
    keywordSimilarityThreshold: 0.6,
    combinedSimilarityThreshold: 0.5,
  },

  publishing: {
    allowPartialPublishing: true,
  },

  images: {
    maxPerArticle: 2,
    minPerArticle: 1,
    candidateCount: readPositiveNumber(process.env.PEXELS_CANDIDATE_COUNT, 40),
    minCandidateCount: readPositiveNumber(process.env.PEXELS_MIN_CANDIDATES, 8),
  },

  aiFactCheck: {
    enabled: readBoolean(process.env.ENABLE_AI_FACT_CHECK, false),
  },
};

export function validateEnvironment() {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    throw new Error("주제 선정에 필요한 OPENROUTER_API_KEY가 없습니다.");
  }

  const textProviders = [
    process.env.OPENROUTER_API_KEY?.trim(),
    process.env.GROQ_API_KEY?.trim(),
    process.env.GEMINI_API_KEY?.trim(),
  ].filter(Boolean);

  if (textProviders.length === 0) {
    throw new Error(
      "본문 생성용 텍스트 AI API 키가 없습니다. " +
        "OPENROUTER_API_KEY, GROQ_API_KEY, GEMINI_API_KEY 중 하나 이상 필요합니다.",
    );
  }

  if (!process.env.PEXELS_API_KEY?.trim()) {
    throw new Error("이미지 제공 API에 필요한 PEXELS_API_KEY가 없습니다.");
  }
}
