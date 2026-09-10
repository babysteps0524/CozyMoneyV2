import { GoogleGenerativeAI } from "@google/generative-ai";
import { logInfo, logWarning } from "./logger.js";

const PROVIDERS = {
  OPENROUTER: "openrouter",
  GROQ: "groq",
  GEMINI: "gemini",
};

const DEFAULT_PROVIDER_ORDER = [
  PROVIDERS.GEMINI,
  PROVIDERS.GROQ,
  PROVIDERS.OPENROUTER,
];

const disabledProviders = new Set();

const usageStats = Object.fromEntries(
  Object.values(PROVIDERS).map((provider) => [
    provider,
    {
      calls: 0,
      successes: 0,
      failures: 0,
      quotaErrors: 0,
    },
  ])
);

// OpenRouter에서 사용할 모델
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openrouter/free";

const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function getErrorStatus(error) {
  return error?.status ?? error?.statusCode ?? error?.response?.status ?? null;
}

function isQuotaError(error) {
  const message = getErrorMessage(error).toLowerCase();
  const status = getErrorStatus(error);

  if (status === 429) return true;

  return [
    "quota",
    "rate limit",
    "ratelimit",
    "too many requests",
    "free_tier",
    "free tier",
    "tokens per minute",
    "tokens_per_minute",
    "requests per day",
    "requests_per_day",
    "limit exceeded",
    "limit reached",
  ].some((keyword) => message.includes(keyword));
}

function isConfigured(provider) {
  if (provider === PROVIDERS.OPENROUTER)
    return Boolean(process.env.OPENROUTER_API_KEY?.trim());
  if (provider === PROVIDERS.GROQ)
    return Boolean(process.env.GROQ_API_KEY?.trim());
  if (provider === PROVIDERS.GEMINI)
    return Boolean(process.env.GEMINI_API_KEY?.trim());
  return false;
}

function providerName(provider) {
  return provider[0].toUpperCase() + provider.slice(1);
}

async function fetchJson(response) {
  return response.json().catch(() => null);
}

async function generateWithOpenRouter(prompt, responseFormat) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY 환경변수가 없습니다.");

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  if (process.env.OPENROUTER_SITE_URL?.trim()) {
    headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL.trim();
  }
  if (process.env.OPENROUTER_SITE_NAME?.trim()) {
    headers["X-OpenRouter-Title"] = process.env.OPENROUTER_SITE_NAME.trim();
  }

  const body = {
    model: OPENROUTER_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: Number(process.env.OPENROUTER_MAX_TOKENS || 6000),
  };

  if (responseFormat === "json") {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }
  );

  const data = await fetchJson(response);

  if (!response.ok) {
    const error = new Error(
      data?.error?.message || `OpenRouter API 오류: HTTP ${response.status}`
    );
    error.status = response.status;
    throw error;
  }

  const text = data?.choices?.[0]?.message?.content;
  if (!text || !String(text).trim()) {
    throw new Error("OpenRouter API가 빈 응답을 반환했습니다.");
  }

  return String(text).trim();
}

async function generateWithGroq(prompt, responseFormat) {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) throw new Error("GROQ_API_KEY 환경변수가 없습니다.");

  const body = {
    model: GROQ_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: Number(process.env.GROQ_MAX_TOKENS || 6000),
  };

  if (responseFormat === "json") {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const data = await fetchJson(response);

  if (!response.ok) {
    const error = new Error(
      data?.error?.message || `Groq API 오류: HTTP ${response.status}`
    );
    error.status = response.status;
    throw error;
  }

  const text = data?.choices?.[0]?.message?.content;
  if (!text || !String(text).trim()) {
    throw new Error("Groq API가 빈 응답을 반환했습니다.");
  }

  return String(text).trim();
}

async function generateWithGemini(prompt, responseFormat) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY 환경변수가 없습니다.");

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      temperature: 0.2,
      ...(responseFormat === "json"
        ? { responseMimeType: "application/json" }
        : {}),
    },
  });

  const response = await model.generateContent(prompt);
  const text = response?.response?.text?.();

  if (!text || !text.trim()) {
    throw new Error("Gemini API가 빈 응답을 반환했습니다.");
  }

  return text.trim();
}

const generators = {
  [PROVIDERS.OPENROUTER]: generateWithOpenRouter,
  [PROVIDERS.GROQ]: generateWithGroq,
  [PROVIDERS.GEMINI]: generateWithGemini,
};

async function tryProvider(provider, prompt, responseFormat) {
  usageStats[provider].calls++;
  logInfo(`${providerName(provider)} API 호출`);

  try {
    const text = await generators[provider](prompt, responseFormat);
    usageStats[provider].successes++;
    logInfo(`${providerName(provider)} API 호출 성공`);
    return text;
  } catch (error) {
    usageStats[provider].failures++;
    if (isQuotaError(error)) usageStats[provider].quotaErrors++;

    disabledProviders.add(provider);

    logWarning(
      `${providerName(provider)} 사용 불가. 이번 실행에서는 다시 호출하지 않습니다.`,
      getErrorMessage(error)
    );

    throw error;
  }
}

export async function generateWithRetry(
  prompt,
  { responseFormat = "text", preferredProviders = DEFAULT_PROVIDER_ORDER } = {}
) {
  if (typeof prompt !== "string" || !prompt.trim()) {
    throw new Error("AI 프롬프트가 올바른 문자열이 아닙니다.");
  }

  if (!["text", "json"].includes(responseFormat)) {
    throw new Error("responseFormat은 text 또는 json이어야 합니다.");
  }

  let lastError = null;

  for (const provider of preferredProviders) {
    if (!generators[provider]) continue;
    if (!isConfigured(provider)) continue;
    if (disabledProviders.has(provider)) continue;

    try {
      return await tryProvider(provider, prompt, responseFormat);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `사용 가능한 AI Provider가 없습니다. 마지막 오류: ${getErrorMessage(lastError)}`
  );
}

export function getConfiguredProviders() {
  return DEFAULT_PROVIDER_ORDER.filter(
    (provider) => isConfigured(provider) && !disabledProviders.has(provider)
  );
}

export function getAIUsageStats() {
  return JSON.parse(JSON.stringify(usageStats));
}

export function resetAIUsageStats() {
  disabledProviders.clear();
  for (const provider of Object.values(PROVIDERS)) {
    usageStats[provider].calls = 0;
    usageStats[provider].successes = 0;
    usageStats[provider].failures = 0;
    usageStats[provider].quotaErrors = 0;
  }
}
