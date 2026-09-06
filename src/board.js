const postsPerPage = 15;

let allPosts = [];
let currentPage = 1;
let currentBoard = "";
let postsLoaded = false;

// ========================================
// 게시글 데이터
// ========================================

export async function loadPosts() {
  if (postsLoaded) {
    renderLatestPosts();

    return allPosts;
  }

  const response = await fetch("/data/posts.json", {
    cache: "no-cache",
  });

  if (!response.ok) {
    throw new Error("게시글 데이터를 불러올 수 없습니다.");
  }

  allPosts = await response.json();

  postsLoaded = true;

  renderLatestPosts();

  return allPosts;
}

// ========================================
// 게시글 정렬
// ========================================

function comparePosts(a, b) {
  const dateCompare = new Date(b.date) - new Date(a.date);

  if (dateCompare !== 0) {
    return dateCompare;
  }

  return b.id.localeCompare(a.id, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

// ========================================
// 카테고리 게시글
// ========================================

function getPosts(board) {
  return allPosts.filter((post) => post.board === board).sort(comparePosts);
}

// ========================================
// HTML escape
// ========================================

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// ========================================
// 최신글
// ========================================

export function getLatestPosts(limit = 5) {
  return [...allPosts].sort(comparePosts).slice(0, limit);
}

// ========================================
// 최신글 렌더링
// ========================================

export function renderLatestPosts() {
  const latestPosts = document.querySelector("#latestPosts");

  if (!latestPosts) {
    return;
  }

  latestPosts.innerHTML = getLatestPosts(5)
    .map(
      (post) =>
        /* html */
        `
          <li class="latest-post-item">
            <a
              href="${escapeHtml(post.url)}"
              class="latest-post-link"
              data-spa="true"
            >
              ${escapeHtml(post.title)}
            </a>
          </li>
        `,
    )
    .join("");
}

// ========================================
// 게시글 목록
// ========================================

function renderPosts() {
  const postList = document.querySelector("#postList");

  const pagination = document.querySelector("#pagination");

  if (!postList || !pagination) {
    return;
  }

  const posts = getPosts(currentBoard);

  const startIndex = (currentPage - 1) * postsPerPage;

  const currentPosts = posts.slice(startIndex, startIndex + postsPerPage);

  postList.innerHTML = currentPosts
    .map(
      (post) =>
        /* html */
        `
          <article class="post-card">
            <a
              href="${escapeHtml(post.url)}"
              class="post-card-link"
              data-spa="true"
            >
              <div class="post-card-title-row">
                <h2 class="post-card-title">${escapeHtml(post.title)}</h2>

                <time
                  class="post-card-date"
                  datetime="${escapeHtml(post.date)}"
                >
                  ${escapeHtml(post.date)}
                </time>
              </div>

              <p class="post-card-description">
                ${escapeHtml(post.description)}
              </p>
            </a>
          </article>
        `,
    )
    .join("");

  renderPagination(posts.length);
}

// ========================================
// 페이지 네비게이션
// ========================================

function renderPagination(totalPosts) {
  const pagination = document.querySelector("#pagination");

  if (!pagination) {
    return;
  }

  const totalPages = Math.ceil(totalPosts / postsPerPage);

  pagination.innerHTML = "";

  if (totalPages <= 1) {
    return;
  }

  const addButton = (text, className, disabled, handler) => {
    const button = document.createElement("button");

    button.type = "button";

    button.textContent = text;

    button.className = className;

    button.disabled = disabled;

    button.addEventListener("click", handler);

    pagination.appendChild(button);
  };

  // 이전
  addButton("‹", "page-arrow-btn", currentPage === 1, () => {
    if (currentPage <= 1) {
      return;
    }

    currentPage -= 1;

    renderPosts();

    scrollTop();
  });

  // 페이지 번호
  for (let page = 1; page <= totalPages; page += 1) {
    addButton(
      String(page),
      page === currentPage ? "page-btn page-btn-active" : "page-btn",
      false,
      () => {
        currentPage = page;

        renderPosts();

        scrollTop();
      },
    );
  }

  // 다음
  addButton("›", "page-arrow-btn", currentPage === totalPages, () => {
    if (currentPage >= totalPages) {
      return;
    }

    currentPage += 1;

    renderPosts();

    scrollTop();
  });
}

// ========================================
// 스크롤
// ========================================

function scrollTop() {
  window.scrollTo({
    top: 0,
    behavior: "instant",
  });
}

// ========================================
// 게시판 초기화
// ========================================

export async function initBoard(board) {
  currentBoard = board;

  currentPage = 1;

  await loadPosts();

  renderLatestPosts();

  renderPosts();
}
