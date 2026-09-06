import { config } from "./config.js";

import { logInfo, logWarning } from "./logger.js";

const stopWords = new Set([
  "알아보기",
  "정리",
  "방법",
  "가이드",
  "쉽게",
  "초보자",
  "완벽",
  "최신",
  "대한",
  "에서",
  "으로",
  "하는",
  "하는법",
  "있는",
  "있나요",
  "무엇",
  "이란",
  "이란?",
  "관련",
  "정보",
  "확인",
]);

/**
 * 문자열을 중복 검사에 적합한 형태로 정규화한다.
 */
function normalizeText(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 문자열을 의미 비교용 토큰으로 변환한다.
 */
function toTokens(text = "") {
  return new Set(
    normalizeText(text)
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length > 1 && !stopWords.has(token)),
  );
}

/**
 * 두 문자열의 Jaccard 유사도를 계산한다.
 *
 * 교집합 / 합집합
 */
function calculateJaccardSimilarity(firstText, secondText) {
  const firstTokens = toTokens(firstText);
  const secondTokens = toTokens(secondText);

  if (firstTokens.size === 0 || secondTokens.size === 0) {
    return 0;
  }

  const intersection = [...firstTokens].filter((token) =>
    secondTokens.has(token),
  );

  const union = new Set([...firstTokens, ...secondTokens]);

  return intersection.length / union.size;
}

/**
 * 주제의 키워드를 문자열로 만든다.
 */
function getTopicKeywords(topic) {
  return Array.isArray(topic.keywords) ? topic.keywords.join(" ") : "";
}

/**
 * 기존 게시글의 키워드를 문자열로 만든다.
 */
function getPostKeywords(post) {
  return Array.isArray(post.keywords) ? post.keywords.join(" ") : "";
}

/**
 * 주제의 전체 검색 정보를 하나의 문자열로 만든다.
 */
function getTopicSearchText(topic) {
  return [
    topic.title,
    getTopicKeywords(topic),
    topic.searchIntent,
    Array.isArray(topic.mainQuestions) ? topic.mainQuestions.join(" ") : "",
  ].join(" ");
}

/**
 * 기존 게시글의 전체 검색 정보를 하나의 문자열로 만든다.
 */
function getPostSearchText(post) {
  return [
    post.title,
    getPostKeywords(post),
    post.searchIntent,
    Array.isArray(post.mainQuestions) ? post.mainQuestions.join(" ") : "",
    Array.isArray(post.headings) ? post.headings.join(" ") : "",
    post.summary || "",
  ].join(" ");
}

/**
 * 주제와 기존 게시글의 기본적인 중복 여부를 검사한다.
 *
 * Gemini API를 사용하지 않는다.
 */
function inspectBasicDuplicate(topic, existingPost) {
  const normalizedTopicTitle = normalizeText(topic.title);

  const normalizedPostTitle = normalizeText(existingPost.title);

  /**
   * 1. 제목이 완전히 같으면 확실한 중복
   */
  if (normalizedTopicTitle && normalizedTopicTitle === normalizedPostTitle) {
    return {
      isDuplicate: true,
      similarity: 1,
      level: "HIGH",
      reason: "기존 게시글과 제목이 같습니다.",
    };
  }

  /**
   * 2. 제목 유사도
   */
  const titleSimilarity = calculateJaccardSimilarity(
    topic.title,
    existingPost.title,
  );

  /**
   * 3. 제목 + 키워드 유사도
   */
  const keywordSimilarity = calculateJaccardSimilarity(
    `${topic.title} ${getTopicKeywords(topic)}`,
    `${existingPost.title} ${getPostKeywords(existingPost)}`,
  );

  /**
   * 4. 검색 의도 + 질문 + 제목 + 키워드 등을
   * 종합한 유사도
   */
  const combinedSimilarity = calculateJaccardSimilarity(
    getTopicSearchText(topic),
    getPostSearchText(existingPost),
  );

  const maximumSimilarity = Math.max(
    titleSimilarity,
    keywordSimilarity,
    combinedSimilarity,
  );

  /**
   * 제목 유사도가 매우 높은 경우
   */
  if (titleSimilarity >= config.duplicateCheck.titleSimilarityThreshold) {
    return {
      isDuplicate: true,
      similarity: titleSimilarity,
      level: "HIGH",
      reason: "기존 게시글 제목과 핵심 단어가 매우 비슷합니다.",
    };
  }

  /**
   * 제목 + 키워드가 매우 비슷한 경우
   */
  if (keywordSimilarity >= config.duplicateCheck.keywordSimilarityThreshold) {
    return {
      isDuplicate: true,
      similarity: keywordSimilarity,
      level: "HIGH",
      reason: "기존 게시글과 핵심 키워드가 매우 비슷합니다.",
    };
  }

  /**
   * 종합 유사도가 높은 경우
   *
   * 기존에는 여기서 Gemini 의미 검사를 실행했지만,
   * 현재 자동화에서는 Gemini 호출을 2회로 제한하기 위해
   * 코드 기반으로만 중복 여부를 판단한다.
   */
  if (maximumSimilarity >= 0.5) {
    return {
      isDuplicate: true,
      similarity: maximumSimilarity,
      level: "HIGH",
      reason: "기존 게시글과 제목·키워드·검색 정보의 유사도가 높습니다.",
    };
  }

  /**
   * 중간 정도의 유사도
   *
   * 중복으로 확정하지 않는다.
   */
  if (maximumSimilarity >= 0.25) {
    return {
      isDuplicate: false,
      similarity: maximumSimilarity,
      level: "MEDIUM",
      reason: "일부 유사한 내용이 있지만 중복으로 확정하지 않았습니다.",
    };
  }

  /**
   * 유사도가 낮은 경우
   */
  return {
    isDuplicate: false,
    similarity: maximumSimilarity,
    level: "LOW",
    reason: "",
  };
}

/**
 * 하나의 주제를 기존 게시글 전체와 비교한다.
 *
 * 같은 카테고리의 게시글만 비교한다.
 */
function inspectAgainstExistingPosts(topic, existingPosts) {
  const sameCategoryPosts = existingPosts.filter(
    (post) => post.board === topic.category,
  );

  let matchedPost = null;

  for (const post of sameCategoryPosts) {
    const result = inspectBasicDuplicate(topic, post);

    if (!result.isDuplicate) {
      continue;
    }

    if (!matchedPost || result.similarity > matchedPost.result.similarity) {
      matchedPost = {
        post,
        result,
      };
    }
  }

  return matchedPost;
}

/**
 * 이번 자동화 실행에서 이미 채택된 주제와
 * 중복되는지 검사한다.
 *
 * Gemini API를 사용하지 않는다.
 */
function inspectAgainstAcceptedTopics(topic, acceptedTopics) {
  let matchedTopic = null;

  for (const acceptedTopic of acceptedTopics) {
    /**
     * 카테고리가 다르면 이번 검사에서는
     * 중복으로 처리하지 않는다.
     */
    if (acceptedTopic.category !== topic.category) {
      continue;
    }

    const result = inspectBasicDuplicate(topic, acceptedTopic);

    if (!result.isDuplicate) {
      continue;
    }

    if (!matchedTopic || result.similarity > matchedTopic.result.similarity) {
      matchedTopic = {
        topic: acceptedTopic,
        result,
      };
    }
  }

  return matchedTopic;
}

/**
 * 중복으로 판정된 주제를
 * 탈락 목록에 저장할 형태로 만든다.
 */
function createRejectedTopic(topic, duplicateOf) {
  return {
    ...topic,
    duplicateOf,
  };
}

/**
 * Gemini 후보 주제 목록에서
 * 기존 게시글 및 현재 후보끼리의 중복을 제거한다.
 *
 * 중요:
 *
 * 이 함수에서는 Gemini API를 호출하지 않는다.
 */
export async function checkDuplicates(candidateTopics, existingPosts) {
  const acceptedTopics = [];
  const rejectedTopics = [];

  if (!Array.isArray(candidateTopics)) {
    throw new Error("중복 검사 대상 주제가 배열이 아닙니다.");
  }

  if (!Array.isArray(existingPosts)) {
    throw new Error("기존 게시글 목록이 배열이 아닙니다.");
  }

  /**
   * 후보 주제를 하나씩 검사한다.
   */
  for (const topic of candidateTopics) {
    /**
     * 1단계
     *
     * 기존 게시글과 중복 검사
     */
    const matchedPost = inspectAgainstExistingPosts(topic, existingPosts);

    if (matchedPost) {
      const rejectedTopic = createRejectedTopic(topic, {
        type: "existing-post",
        title: matchedPost.post.title,
        filePath: matchedPost.post.filePath,
        similarity: matchedPost.result.similarity,
        level: matchedPost.result.level,
        reason: matchedPost.result.reason,
      });

      rejectedTopics.push(rejectedTopic);

      logWarning(
        `기존 게시글과 중복되어 제외했습니다: ${topic.title}`,
        `기존 글: ${matchedPost.post.title} / ${matchedPost.result.reason}`,
      );

      continue;
    }

    /**
     * 2단계
     *
     * 이번 실행에서 이미 채택된
     * 주제와 중복 검사
     */
    const matchedTopic = inspectAgainstAcceptedTopics(topic, acceptedTopics);

    if (matchedTopic) {
      const rejectedTopic = createRejectedTopic(topic, {
        type: "current-run-topic",
        title: matchedTopic.topic.title,
        similarity: matchedTopic.result.similarity,
        level: matchedTopic.result.level,
        reason:
          matchedTopic.result.reason ||
          "이번 실행에서 이미 선택된 주제와 중복됩니다.",
      });

      rejectedTopics.push(rejectedTopic);

      logWarning(
        `이번 실행의 다른 주제와 중복되어 제외했습니다: ${topic.title}`,
        `중복 주제: ${matchedTopic.topic.title}`,
      );

      continue;
    }

    /**
     * 모든 중복 검사를 통과한 경우
     * 최종 후보로 채택한다.
     */
    acceptedTopics.push(topic);

    logInfo(`중복 검사를 통과했습니다: ${topic.title}`);
  }

  logInfo(
    `중복 검사 완료: 통과 ${acceptedTopics.length}개 / 제외 ${rejectedTopics.length}개`,
  );

  return {
    acceptedTopics,
    rejectedTopics,
  };
}
