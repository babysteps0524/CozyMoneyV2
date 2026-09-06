import "virtual:uno.css";
import "@unocss/reset/tailwind-v4.css";
import "./assets/markdown.css";
import "./responsive.js";

import { initBoard, loadPosts } from "./board.js";
import { renderLoanCalculator } from "./calculators/loan.js";
import { renderSavingsCalculator } from "./calculators/savings.js";
import { renderSalaryCalculator } from "./calculators/salary.js";

// ========================================
// DOM
// ========================================

const pageContent = document.querySelector("#page-content");

// ========================================
// 모바일 메뉴
// ========================================

function closeMobileMenu() {
  const nav = document.querySelector(".site-nav");
  const toggle = document.querySelector(".mobile-menu-toggle");

  if (!nav || !toggle) return;

  nav.classList.remove("is-open");
  toggle.setAttribute("aria-expanded", "false");
}

function toggleMobileMenu() {
  const nav = document.querySelector(".site-nav");
  const toggle = document.querySelector(".mobile-menu-toggle");

  if (!nav || !toggle) return;

  const isOpen = nav.classList.toggle("is-open");
  toggle.setAttribute("aria-expanded", String(isOpen));
}

function updateActiveNav(pathname = window.location.pathname) {
  const normalized = normalizePath(pathname);

  document.querySelectorAll(".site-nav-link").forEach((link) => {
    const href = link.getAttribute("href");

    if (!href) return;

    let linkPath;

    try {
      linkPath = normalizePath(new URL(href, window.location.origin).pathname);
    } catch {
      return;
    }

    let active = false;

    /*
      홈은 별도로 처리한다.

      "/"는 모든 경로의 시작이기 때문에
      startsWith("/")를 사용하면 모든 메뉴가
      홈으로 판정되는 문제가 발생한다.
    */
    if (linkPath === "/") {
      active = normalized === "/";
    } else {
      /*
        카테고리 페이지와 해당 카테고리의
        개별 게시글 모두 active 처리한다.

        예:
        /stock/
        /stock/260814-1/
        /stock/260814-2/

        → 모두 주식 메뉴가 active
      */
      active = normalized === linkPath || normalized.startsWith(linkPath);
    }

    link.classList.toggle("is-active", active);

    if (active) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

// ========================================
// 게시판 URL
// ========================================

const BOARD_MAP = {
  "/stock/": "stock",
  "/tax/": "tax",
  "/accounting/": "accounting",
};

const CALC_MAP = {
  "/loan/": {
    title: "대출 계산기",
    description: "원리금균등·원금균등·만기일시 대출 이자 및 상환 스케줄 계산",
    render: renderLoanCalculator,
  },
  "/savings/": {
    title: "예금/적금 계산기",
    description: "거치식 예금과 적립식 적금 만기 수령액·세금 비교 계산",
    render: renderSavingsCalculator,
  },
  "/salary/": {
    title: "연봉/시급 계산기",
    description: "연봉·월급·시급 상호 변환 및 4대보험·세금 추정 실수령액 계산",
    render: renderSalaryCalculator,
  },
};

// ========================================
// 상태
// ========================================

let allPostsLoaded = false;

let homeContent = null;
let homeDocument = null;

let navigationId = 0;
// 브라우저 자체 스크롤 복원 기능은 사용하지 않는다.
// 우리가 history.state의 scrolly를 직접 관리한다.
history.scrollRestoration = "manual";

// ========================================
// 현재 페이지 스크롤 위치 자동 저장
// ========================================

let scrollSaveTimer = null;

window.addEventListener(
  "scroll",
  () => {
    if (scrollSaveTimer) {
      return;
    }

    scrollSaveTimer = requestAnimationFrame(() => {
      const currentState = history.state || {};

      history.replaceState(
        {
          ...currentState,
          path: normalizePath(window.location.pathname),
          scrollY: window.scrollY,
        },
        "",
        window.location.href
      );

      scrollSaveTimer = null;
    });
  },
  { passive: true }
);

// ========================================
// URL 정규화
// ========================================

function normalizePath(pathname) {
  if (!pathname || pathname === "/index.html") {
    return "/";
  }

  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname;
  }

  /*
    확장자가 없는 URL이면
    trailing slash를 붙인다.
  */

  if (!pathname.includes(".")) {
    return `${pathname}/`;
  }

  return pathname;
}

// ========================================
// History 스크롤 위치
// ========================================

function saveCurrentScrollPosition() {
  const currentState = history.state || {};

  history.replaceState(
    {
      ...currentState,
      path: normalizePath(window.location.pathname),
      scrollY: window.scrollY,
    },
    "",
    window.location.href
  );
}

function restoreScrollPosition() {
  const scrollY = Number(history.state?.scrollY ?? 0);

  // DOM 렌더링이 완료된 후 복원
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.scrollTo({
        top: scrollY,
        left: 0,
        behavior: "instant",
      });
    });
  });
}

// ========================================
// 외부 링크 새 탭 열기
// ========================================

function openExternalLinkInNewTab(link) {
  if (!link) {
    return false;
  }

  const href = link.getAttribute("href");

  if (!href) {
    return false;
  }

  let url;

  try {
    url = new URL(href, window.location.origin);
  } catch {
    return false;
  }

  // 외부 사이트가 아니면 처리하지 않는다.
  if (url.origin === window.location.origin) {
    return false;
  }

  // mailto, tel 등은 기존 브라우저 동작을 사용한다.
  if (/^(mailto:|tel:|javascript:|data:|blob:)/i.test(href)) {
    return false;
  }

  // 이미 target="_blank"라면 그대로 둔다.
  if (link.target === "_blank") {
    return false;
  }

  // 외부 링크만 새 탭으로 연다.
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  return true;
}

// ========================================
// 내부 SPA 링크인지 확인
// ========================================

function getSpaUrl(link) {
  if (!link) {
    return null;
  }

  const href = link.getAttribute("href");

  if (!href) {
    return null;
  }

  /*
    외부 프로토콜
  */

  if (/^(mailto:|tel:|javascript:|data:|blob:)/i.test(href)) {
    return null;
  }

  /*
    target="_blank"
  */

  if (link.target && link.target !== "_self") {
    return null;
  }

  /*
    다운로드 링크
  */

  if (link.hasAttribute("download")) {
    return null;
  }

  let url;

  try {
    url = new URL(href, window.location.origin);
  } catch {
    return null;
  }

  /*
    외부 사이트
  */

  if (url.origin !== window.location.origin) {
    return null;
  }

  const pathname = url.pathname.toLowerCase();

  /*
    정적 리소스는 SPA 이동하지 않는다.
  */

  const excludedExtensions = [
    ".xml",
    ".txt",
    ".json",
    ".js",
    ".css",
    ".svg",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".pdf",
    ".ico",
    ".woff",
    ".woff2",
    ".ttf",
  ];

  if (excludedExtensions.some((extension) => pathname.endsWith(extension))) {
    return null;
  }

  return url;
}

// ========================================
// 페이지 HTML 캐시
// ========================================

const pageDocumentCache = new Map();

function getPageCacheKey(url) {
  const targetUrl = new URL(url, window.location.origin);

  return targetUrl.pathname + targetUrl.search;
}

// ========================================
// 정적 HTML 가져오기
// ========================================

async function fetchPageDocument(url) {
  const cacheKey = getPageCacheKey(url);

  // 이미 요청 중이거나 받아온 페이지가 있으면 재사용
  const cached = pageDocumentCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const promise = fetch(cacheKey, {
    method: "GET",
    headers: {
      Accept: "text/html",
    },
    cache: "force-cache",
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${cacheKey}`);
      }

      return response.text();
    })
    .then((html) => {
      return new DOMParser().parseFromString(html, "text/html");
    })
    .catch((error) => {
      // 실패한 요청은 캐시에서 제거
      pageDocumentCache.delete(cacheKey);
      throw error;
    });

  // Promise 자체를 캐시
  pageDocumentCache.set(cacheKey, promise);

  return promise;
}

// ========================================
// 게시글 사전 로딩
// ========================================

function prefetchPost(url) {
  if (!url) {
    return;
  }

  const targetUrl = new URL(url, window.location.origin);

  // 같은 사이트의 HTML 페이지만
  if (targetUrl.origin !== window.location.origin) {
    return;
  }

  // 게시글/페이지가 아닌 정적 파일은 제외
  const pathname = targetUrl.pathname.toLowerCase();

  const excludedExtensions = [
    ".xml",
    ".txt",
    ".json",
    ".js",
    ".css",
    ".svg",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".pdf",
    ".ico",
    ".woff",
    ".woff2",
    ".ttf",
  ];

  if (excludedExtensions.some((extension) => pathname.endsWith(extension))) {
    return;
  }

  // 이미 캐시됐거나 요청 중이면 아무것도 하지 않음
  const cacheKey = getPageCacheKey(targetUrl.href);

  if (pageDocumentCache.has(cacheKey)) {
    return;
  }

  fetchPageDocument(targetUrl.href).catch(() => {
    // prefetch 실패는 사용자에게 표시하지 않음
  });
}

// ========================================
// PC 게시글 마우스 오버 prefetch
// ========================================

document.addEventListener(
  "pointerover",
  (event) => {
    const link = event.target.closest("a.post-card-link, a.latest-post-link");

    if (!link) {
      return;
    }

    // 이미 해당 링크 내부에서 이동한 경우 무시
    if (event.relatedTarget && link.contains(event.relatedTarget)) {
      return;
    }

    prefetchPost(link.href);
  },
  true
);

// ========================================
// 모바일 게시글 prefetch
// ========================================

let postPrefetchObserver = null;

function setupPostPrefetchObserver() {
  if (!("IntersectionObserver" in window)) {
    return;
  }

  if (postPrefetchObserver) {
    postPrefetchObserver.disconnect();
  }

  postPrefetchObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }

        const link = entry.target;

        prefetchPost(link.href);

        postPrefetchObserver.unobserve(link);
      }
    },
    {
      // 화면보다 500px 위에서 미리 요청
      rootMargin: "500px 0px",
      threshold: 0,
    }
  );

  document
    .querySelectorAll("a.post-card-link, a.latest-post-link")
    .forEach((link) => {
      postPrefetchObserver.observe(link);
    });
}

// ========================================
// HEAD 업데이트
// ========================================

function updateMeta(doc, selector, attribute, value) {
  const source = doc.querySelector(selector);

  let target = document.head.querySelector(selector);

  if (!source) {
    return;
  }

  if (!target) {
    target = document.createElement("meta");

    target.setAttribute(attribute, source.getAttribute(attribute));

    document.head.appendChild(target);
  }

  target.setAttribute("content", source.getAttribute("content") || "");
}

function updateHead(doc) {
  /*
    title
  */

  if (doc.title) {
    document.title = doc.title;
  }

  /*
    description
  */

  const sourceDescription = doc.querySelector('meta[name="description"]');

  let targetDescription = document.querySelector('meta[name="description"]');

  if (sourceDescription) {
    if (!targetDescription) {
      targetDescription = document.createElement("meta");

      targetDescription.name = "description";

      document.head.appendChild(targetDescription);
    }

    targetDescription.content = sourceDescription.content;
  }

  /*
    canonical
  */

  const sourceCanonical = doc.querySelector('link[rel="canonical"]');

  let targetCanonical = document.querySelector('link[rel="canonical"]');

  if (sourceCanonical) {
    if (!targetCanonical) {
      targetCanonical = document.createElement("link");

      targetCanonical.rel = "canonical";

      document.head.appendChild(targetCanonical);
    }

    targetCanonical.href = sourceCanonical.href;
  }

  /*
    Open Graph
  */

  updateMeta(doc, 'meta[property="og:title"]', "property");

  updateMeta(doc, 'meta[property="og:description"]', "property");

  updateMeta(doc, 'meta[property="og:type"]', "property");

  updateMeta(doc, 'meta[property="og:url"]', "property");

  updateMeta(doc, 'meta[property="article:published_time"]', "property");
}

// ========================================
// 게시글 데이터
// ========================================

async function ensurePostsLoaded() {
  if (allPostsLoaded) {
    return;
  }

  await loadPosts();

  allPostsLoaded = true;
}

// ========================================
// 현재 페이지 초기화
// ========================================

async function initializePage(pathname) {
  await ensurePostsLoaded();

  const board = BOARD_MAP[pathname];

  if (board) {
    await initBoard(board);
  }
}

// ========================================
// Home 캐시
// ========================================

async function prepareHomeCache() {
  if (homeContent !== null && homeDocument !== null) {
    return;
  }

  try {
    const doc = await fetchPageDocument("/");

    const content = doc.querySelector("#page-content");

    if (!content) {
      return;
    }

    homeContent = content.innerHTML;

    homeDocument = doc;
  } catch (error) {
    console.error("Home 캐시 생성 실패:", error);
  }
}

// ========================================
// AdSense
// ========================================

let adsenseRefreshScheduled = false;

function refreshAds() {
  window.adsbygoogle = window.adsbygoogle || [];

  /*
    같은 이벤트 사이클에서 여러 번 호출되는 경우
    한 번만 처리한다.
  */
  if (adsenseRefreshScheduled) {
    return;
  }

  adsenseRefreshScheduled = true;

  requestAnimationFrame(() => {
    adsenseRefreshScheduled = false;

    const ads = document.querySelectorAll(
      "ins.adsbygoogle[data-ad-client][data-ad-slot]"
    );

    ads.forEach((ad) => {
      /*
        AdSense가 이미 처리한 광고
      */
      if (ad.getAttribute("data-adsbygoogle-status")) {
        return;
      }

      /*
        우리 코드가 이미 초기화 요청을 보낸 광고
      */
      if (ad.dataset.adsInitialized === "true") {
        return;
      }

      /*
        필수 광고 정보 확인
      */
      const client = ad.getAttribute("data-ad-client");
      const slot = ad.getAttribute("data-ad-slot");

      if (!client || !slot) {
        console.warn("AdSense 광고 슬롯 정보가 없습니다.", ad);

        return;
      }

      /*
        중복 초기화 방지 상태 기록
      */
      ad.dataset.adsInitialized = "true";

      try {
        window.adsbygoogle.push({});
      } catch (error) {
        /*
          초기화 실패 시 재시도 가능하도록
          상태를 제거한다.
        */
        delete ad.dataset.adsInitialized;

        console.warn("AdSense 초기화 실패:", error);
      }
    });
  });
}

// ========================================
// 실제 SPA 페이지 렌더링
// ========================================

async function renderRoute(url, { scroll = true } = {}) {
  const currentNavigation = ++navigationId;

  const targetUrl = new URL(url, window.location.origin);

  const targetPath = normalizePath(targetUrl.pathname);

  closeMobileMenu();
  updateActiveNav(targetPath);

  /*
    계산기 페이지 (SPA 렌더)
  */
  if (CALC_MAP[targetPath]) {
    const calc = CALC_MAP[targetPath];
    document.title = `${calc.title} | cozymoney.kr`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", calc.description);
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical)
      canonical.setAttribute("href", `https://cozymoney.kr${targetPath}`);

    pageContent.innerHTML = `<div id="calculator-root" class="w-full"></div>`;
    calc.render(pageContent.querySelector("#calculator-root"));

    await ensurePostsLoaded();
    if (currentNavigation !== navigationId) return;
    refreshAds();
    if (scroll) {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    return;
  }

  /*
    Home
  */

  if (targetPath === "/" && homeContent !== null) {
    pageContent.innerHTML = homeContent;

    if (homeDocument) {
      updateHead(homeDocument);
    }

    await ensurePostsLoaded();

    if (currentNavigation !== navigationId) {
      return;
    }

    refreshAds();

    if (scroll) {
      window.scrollTo({
        top: 0,
        behavior: "instant",
      });
    }

    return;
  }

  /*
    정적 HTML 가져오기
  */

  const requestUrl = targetUrl.pathname + targetUrl.search;

  const doc = await fetchPageDocument(requestUrl);

  /*
    더 최신 navigation이 발생했다면
    이전 요청 결과를 무시한다.
  */

  if (currentNavigation !== navigationId) {
    return;
  }

  const nextContent = doc.querySelector("#page-content");

  if (!nextContent) {
    throw new Error(`#page-content를 찾을 수 없습니다: ${requestUrl}`);
  }

  /*
    Header / Navigation / Footer는
    절대 건드리지 않는다.
  */

  pageContent.innerHTML = nextContent.innerHTML;

  updateHead(doc);

  /*
    Home 캐시
  */

  if (targetPath === "/") {
    homeContent = nextContent.innerHTML;

    homeDocument = doc;
  }

  /*
    게시판 초기화
  */

  await initializePage(targetPath);

  if (currentNavigation !== navigationId) {
    return;
  }

  // 게시글 목록이 새로 렌더링된 후 prefetch 설정
  setupPostPrefetchObserver();

  refreshAds();

  if (scroll) {
    window.scrollTo({
      top: 0,
      behavior: "instant",
    });
  }
}

// ========================================
// SPA 이동
// ========================================

async function navigate(url, { push = true, scroll = true } = {}) {
  const targetUrl = new URL(url, window.location.origin);

  const targetPath = normalizePath(targetUrl.pathname);

  const currentPath = normalizePath(window.location.pathname);

  const targetFullUrl = targetUrl.pathname + targetUrl.search + targetUrl.hash;

  const currentFullUrl =
    window.location.pathname + window.location.search + window.location.hash;

  /*
    같은 URL이면 아무것도 하지 않는다.
  */

  if (targetFullUrl === currentFullUrl) {
    return;
  }

  /*
    ====================================
    현재 페이지의 스크롤 위치 저장
    ====================================

    현재 history entry에 저장한다.

    예:
    주식 게시판
    scrollY = 1200

    → 게시글 클릭
    → 기존 주식 게시판 history에
      scrollY: 1200 저장
  */

  if (push) {
    saveCurrentScrollPosition();

    /*
      새 페이지 history entry 생성

      새 페이지는 처음 표시될 때
      맨 위에서 시작한다.
    */

    history.pushState(
      {
        path: targetPath,
        scrollY: 0,
      },
      "",
      targetFullUrl
    );
  }

  try {
    await renderRoute(targetUrl.href, {
      scroll,
    });
  } catch (error) {
    console.error("SPA navigation 실패:", error);

    /*
      SPA 처리 실패 시
      방금 추가한 history를 제거한다.
    */

    if (push) {
      history.replaceState(
        {
          path: normalizePath(window.location.pathname),
          scrollY: 0,
        },
        "",
        window.location.href
      );
    }

    /*
      실패한 경우에만
      일반 브라우저 이동
    */

    window.location.assign(targetUrl.href);
  }
}

// ========================================
// ★ 모든 내부 링크 클릭 처리
// ========================================
//
// capture phase(true)에서 실행한다.
//
// 브라우저가 링크를 실제로 이동시키기 전에
// preventDefault()를 먼저 실행한다.
// ========================================

document.addEventListener("click", (event) => {
  const toggle = event.target.closest(".mobile-menu-toggle");

  if (toggle) {
    event.preventDefault();
    toggleMobileMenu();
    return;
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMobileMenu();
  }
});

document.addEventListener(
  "click",
  (event) => {
    /*
      마우스 왼쪽 버튼만
      SPA로 처리한다.
    */

    if (event.button !== 0) {
      return;
    }

    const link = event.target.closest("a");

    if (!link) {
      return;
    }

    // 외부 링크는 새 탭에서 연다.
    if (openExternalLinkInNewTab(link)) {
      return;
    }

    const url = getSpaUrl(link);

    if (!url) {
      return;
    }

    /*
      같은 페이지의 #anchor는
      일반 anchor 동작을 허용한다.
    */

    const currentPath = normalizePath(window.location.pathname);

    const board = BOARD_MAP[currentPath];

    updateActiveNav(currentPath);

    const targetPath = normalizePath(url.pathname);

    if (currentPath === targetPath && url.hash) {
      return;
    }

    /*
      ====================================
      ★ 여기서 즉시 기본 브라우저 이동 차단
      ====================================
    */

    event.preventDefault();
    event.stopPropagation();
    closeMobileMenu();

    /*
      SPA 이동
    */

    navigate(url.href, {
      push: true,
      scroll: true,
    });
  },
  true
);

// ========================================
// 뒤로가기 / 앞으로가기
// ========================================

window.addEventListener("popstate", async () => {
  /*
    popstate에서는 절대로
    pushState를 다시 호출하지 않는다.

    history.state에 저장되어 있는
    scrollY를 그대로 사용한다.
  */

  try {
    /*
      페이지를 렌더링할 때
      scrollTo(0)을 실행하지 않는다.
    */

    await renderRoute(window.location.href, {
      scroll: false,
    });

    /*
      렌더링이 완료된 후
      해당 history entry의
      스크롤 위치를 복원한다.
    */

    restoreScrollPosition();
  } catch (error) {
    console.error("뒤로가기/앞으로가기 처리 실패:", error);

    /*
      SPA 처리 자체가 실패했을 때만
      일반 브라우저 이동을 사용한다.
    */

    window.location.reload();
  }
});

// ========================================
// 초기 실행
// ========================================

async function boot() {
  /*
    현재 URL을 첫 history 상태로 등록
  */

  history.replaceState(
    {
      path: normalizePath(window.location.pathname),
      scrollY: window.scrollY,
    },
    "",
    window.location.href
  );

  /*
    게시글 데이터 로딩
  */

  try {
    await ensurePostsLoaded();
  } catch (error) {
    console.error("게시글 데이터 로딩 실패:", error);
  }

  const currentPath = normalizePath(window.location.pathname);

  updateActiveNav(currentPath);

  /*
    현재가 Home
  */

  if (currentPath === "/") {
    homeContent = pageContent?.innerHTML ?? "";

    homeDocument = document;

    refreshAds();

    return;
  }

  if (CALC_MAP[currentPath]) {
    const calc = CALC_MAP[currentPath];
    document.title = `${calc.title} | cozymoney.kr`;
    pageContent.innerHTML = `<div id="calculator-root" class="w-full"></div>`;
    calc.render(pageContent.querySelector("#calculator-root"));
    refreshAds();
    prepareHomeCache();
    return;
  }

  /*
    현재가 게시판이면 초기화
  */

  const board = BOARD_MAP[currentPath];

  if (board) {
    await initBoard(board);

    // 초기 게시글 목록 prefetch
    setupPostPrefetchObserver();
  }

  refreshAds();

  /*
    Home을 백그라운드에서 미리 캐시
  */

  prepareHomeCache();
}

// ========================================
// 시작
// ========================================

boot();
