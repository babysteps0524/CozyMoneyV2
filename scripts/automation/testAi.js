import { generateWithRetry, getConfiguredProviders } from "./aiClient.js";

import { logError, logInfo } from "./logger.js";

async function main() {
  console.log("");
  console.log("========================================");
  console.log(" CozyMoney AI Provider 테스트");
  console.log("========================================");
  console.log("");

  const providers = getConfiguredProviders();

  console.log("설정된 Provider:");

  if (providers.length === 0) {
    console.log("없음");
    process.exitCode = 1;
    return;
  }

  for (const provider of providers) {
    console.log(`- ${provider}`);
  }

  console.log("");

  const prompt = `
다음 질문에 아주 짧게 답변해.

질문:
대한민국에서 주식 배당금에 세금이 부과되는 이유를 초보자도 이해할 수 있도록 한 문장으로 설명해.
`;

  try {
    console.log("AI 호출을 시작합니다.");
    console.log("");

    const result = await generateWithRetry(prompt);

    console.log("");
    console.log("========================================");
    console.log(" AI 응답");
    console.log("========================================");
    console.log("");

    console.log(result);

    console.log("");
    console.log("========================================");
    console.log(" 테스트 성공");
    console.log("========================================");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    logError("AI Provider 테스트 실패", message);

    console.error("");
    console.error("테스트 실패:");
    console.error(message);

    process.exitCode = 1;
  }
}

main();
