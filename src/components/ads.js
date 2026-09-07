export function createAdSlot({
  size = "content",
  label = "광고",
  className = "",
} = {}) {
  const minH =
    size === "leaderboard"
      ? "min-h-[90px]"
      : size === "banner"
        ? "min-h-[50px]"
        : size === "sidebar"
          ? "min-h-[600px]"
          : "min-h-[250px]";

  return /* html */ `
    <div
      class="adContainer ${minH} ${className}"
      aria-label="${label}"
    >
      <div class="adLabel text-cm-text-muted text-10px mb-1.5">${label}</div>
      <div
        class="adPlaceholder min-h-inherit bg-cmCard border-cm-border rounded-cmXs text-cm-text-muted text-12px flex h-full w-full items-center justify-center border border-dashed"
      >
        AdSense 영역
      </div>
    </div>
  `;
}

export function TopAd() {
  return createAdSlot({
    size: "leaderboard",
    label: "상단 광고",
    className: "mb-4",
  });
}

export function InContentAd() {
  return createAdSlot({
    size: "content",
    label: "콘텐츠 광고",
    className: "my-6",
  });
}

export function SidebarAd() {
  return createAdSlot({ size: "sidebar", label: "사이드바 광고" });
}
