import { generateArticleImages } from "./imageGenerator.js";

const article = {
  topic: {
    category: "stock",
    title: "기업 실적 발표와 영업이익률을 이해하는 방법",
    keywords: ["기업 실적", "영업이익률", "재무제표"],
  },
  markdown: "# 테스트 글\n\n## 핵심 내용\n\n테스트 본문입니다.",
};

const result = await generateArticleImages(article);

console.log(JSON.stringify(result.images, null, 2));
