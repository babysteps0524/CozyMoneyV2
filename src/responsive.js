// responsive.js
function updateLayout() {
  const width = window.innerWidth;
  const html = document.documentElement;

  html.classList.toggle("is-tablet", width <= 1100);
  html.classList.toggle("is-mobile", width <= 767);
  html.classList.toggle("is-small", width <= 380);
}

function updateTheme() {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const saved = localStorage.getItem("theme"); // 'dark' | 'light' | null

  if (saved === "dark" || (!saved && prefersDark)) {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

// 초기 실행
updateLayout();
updateTheme();

// 이벤트
window.addEventListener("resize", updateLayout);
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", updateTheme);

// 테마 토글 함수 (버튼에서 호출)
window.toggleTheme = () => {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  if (isDark) {
    document.documentElement.removeAttribute("data-theme");
    localStorage.setItem("theme", "light");
  } else {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("theme", "dark");
  }
};
