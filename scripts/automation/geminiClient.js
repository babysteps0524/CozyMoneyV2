import { GoogleGenerativeAI } from "@google/generative-ai";

import { logError, logWarning } from "./logger.js";

const modelName = process.env.GEMINI_MODEL || "gemini-3.6-flash";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 5000;

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY 환경변수가 없습니다.");
  }

  return new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.2,
    },
  });
}

/**
 * 일일/월간 quota를 초과한 오류인지 확인한다.
 */
function isQuotaExceededError(error) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes("Quota exceeded") ||
    message.includes("quota exceeded") ||
    message.includes("free_tier_requests") ||
    message.includes("GenerateRequestsPerDayPerModel-FreeTier") ||
    message.includes("GenerateRequestsPerDay")
  );
}

/**
 * 일시적인 오류인지 확인한다.
 */
function isRetryableError(error) {
  if (isQuotaExceededError(error)) {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error);

  const status =
    error?.status ?? error?.statusCode ?? error?.response?.status ?? null;

  // 일시적인 Rate Limit
  if (status === 429 || message.includes("429")) {
    return true;
  }

  // 서버 오류
  if ([500, 502, 503, 504].includes(status)) {
    return true;
  }

  if (
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504")
  ) {
    return true;
  }

  // 네트워크 오류
  if (
    message.includes("ECONNRESET") ||
    message.includes("ETIMEDOUT") ||
    message.includes("ECONNREFUSED") ||
    message.includes("fetch failed") ||
    message.includes("network")
  ) {
    return true;
  }

  return false;
}

/**
 * 재시도 간격
 *
 * 1회 실패 → 5초
 * 2회 실패 → 10초
 * 3회 실패 → 20초
 */
function getRetryDelay(attempt) {
  return BASE_DELAY_MS * 2 ** (attempt - 1);
}

export async function generateWithRetry(prompt, maxRetries = MAX_RETRIES) {
  const model = getModel();

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await model.generateContent(prompt);

      return response.response.text();
    } catch (error) {
      lastError = error;

      const message = error instanceof Error ? error.message : String(error);

      /*
       * 일일 quota 초과
       *
       * 재시도해도 quota가 회복되지 않으므로
       * 즉시 중단한다.
       */
      if (isQuotaExceededError(error)) {
        logError("Gemini API 일일 quota 초과", message);

        throw error;
      }

      /*
       * 재시도할 필요가 없는 오류
       */
      if (!isRetryableError(error)) {
        logError("Gemini API 재시도 불가능한 오류", message);

        throw error;
      }

      /*
       * 마지막 시도까지 실패
       */
      if (attempt >= maxRetries) {
        logError(`Gemini API 최종 실패 (${attempt}/${maxRetries})`, message);

        throw error;
      }

      const delayMs = getRetryDelay(attempt);

      logWarning(
        `Gemini API 일시 오류 (${attempt}/${maxRetries}). ` +
          `${delayMs / 1000}초 후 재시도`,
        message,
      );

      await new Promise((resolve) => {
        setTimeout(resolve, delayMs);
      });
    }
  }

  throw lastError;
}
