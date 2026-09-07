import {
  defineConfig,
  presetUno,
  presetAttributify,
  presetWind4,
  transformerDirectives,
  transformerVariantGroup,
} from "unocss";

export default defineConfig({
  presets: [presetUno(), presetWind4(), presetAttributify()],
  transformers: [transformerDirectives(), transformerVariantGroup()],
  darkMode: ["class", '[data-theme="dark"]'],
  content: {
    pipeline: {
      include: ["./**/*.html", "./**/*.js"],
    },
  },

  theme: {
    fontFamily: {
      bodyText: ["Noto Sans KR", "sans-serif"],
    },
    colors: {
      cm: {
        bg: "oklch(0.97209 0.01073 76.6)",
        paper: "oklch(1 0 0)",
        text: "oklch(0.22562 0.00849 59.21)",
        textSecondary: "oklch(0.4733 0.0141 59.32)",
        textMuted: "oklch(0.60912 0.01514 60.42)",
        primary: "oklch(0.34688 0.03773 49.68)",
        primaryHover: "oklch(0.58122 0.13742 50.18)",
        accent: "oklch(0.66796 0.14628 52.09)",
        card: "oklch(0.99529 0.00251 48.72)",
        cardHover: "oklch(0.97057 0.01953 65.15)",
        cardBorder: "oklch(0.90579 0.0174 67.61)",
        border: "oklch(0.90579 0.0174 67.61)",
        footer: "oklch(0.34688 0.03773 49.68)",
        focus: "oklch(0.66796 0.14628 52.09)",
      },
    },
    borderRadius: {
      cm: "16px",
      cmSm: "12px",
      cmXs: "8px",
      cmBtn: "6px",
    },
    boxShadow: {
      cm: "0 8px 28px rgba(31, 41, 51, 0.09)",
      cmHover: "0 10px 26px rgba(31, 41, 51, 0.13)",
      cmCard: "0 3px 10px rgba(60, 40, 25, 0.06)",
    },
    maxWidth: {
      cm: "1240px",
      cmContent: "920px",
    },
  },

  shortcuts: {
    // ===== 레이아웃 =====
    siteHeader: `
    sticky
    z-100
    w-min(100%,max-w-cm)
    mx-auto
    px-4
    py-2.5
    pb-3.5
    bg-cm-bg
    `,
    siteNav: `
    sticky
    top-[56px]
    z-100
    w-min(100%,max-w-cm)
    mx-auto
    mb-10
    bg-cm-bg
    `,
    siteNavList: `
    flex
    items-center
    justify-center
    gap-10
    m-0
    py-3
    px-5
    list-none
    border-y-2
    border-cm-accent
    `,
    siteNavLink: `
    inline-block
    px-2
    py-1.25
    text-cm-primary
    text-22px
    font-bold
    leading-tight
    no-underline
    transition-colors
    duration-300
    hover:scale-110
    hover:text-cm-primary-hover
    `,
    siteNavLinkActive: `
    bg-cm-accent
    text-white
    rounded-cm-btn
    `,
    siteMainLayout: `
    flex
    items-start
    gap-6
    w-min(calc(100%-32px),max-w-cm)
    mx-auto
    mb-10
    `,
    siteMain: `
    min-w-0
    flex-1
    bg-cm-paper
    rounded-cm
    shadow-cm
    p-6
    px-18
    `,
    siteSidebar: `
    flex-none
    w-71
    sticky
    top-25
    `,

    // ===== 홈/보드 =====
    boardIntro: `
    mb-10
    `,
    boardEyebrow: `m-0
    mb-2.5
    text-cm-accent
    text-14px
    font-bold
    `,
    boardTitle: `
    m-0
    mb-3.5
    text-cm-text
    text-32px
    font-bold
    leading-snug
    `,
    boardDescription: `
    m-0
    text-cm-text-secondary
    text-16px
    leading-relaxed
    `,
    homeTitle: `
    m-0
    mb-4
    text-cm-text
    text-38px
    font-bold
    leading-snug
    `,
    homeDescription: `
    m-0
    text-cm-text-secondary
    text-18px
    leading-relaxed
    `,

    // ===== 카드 =====
    categoryGrid: `
    grid
    grid-cols-2
    gap-4
    `,
    categoryCard: `
    block
    min-w-0
    p-7
    bg-cmCard
    border
    border-cmCard-border
    rounded-cm-sm
    text-inherit
    no-underline
    shadow-cmCard
    transition-all
    hover:(bg-cmCard-hover border-cm-border shadow-cmHover)
    `,
    postCard: `\
    mb-3
    bg-cmCard
    border
    border-cmCard-border
    rounded-cm-sm
    transition-all
    hover:(bg-cmCard-hover border-cm-border shadow-cmHover)
    `,
    postCardLink: `
    block
    p-4.5
    px-5
    text-inherit
    no-underline
    rounded-inherit
    `,
    postCardTitle: `
    m-0
    text-cm-text
    text-18px
    font-bold
    leading-normal
    overflow-wrap-anywhere
    `,
    postCardDate: `
    flex-none
    text-cm-text-muted
    text-13px
    whitespace-nowrap
    `,
    postCardDescription: `
    mt-2
    m-0
    text-cm-text-secondary
    text-14px
    leading-normal
    overflow-wrap-anywhere
    `,

    // ===== 사이드바 / 광고 =====
    asideNav: `
    p-6
    px-7
    bg-cm-paper
    rounded-cm
    shadow-cm
    `,
    asideNavH2: `
    m-0
    mb-4.5
    text-cm-primary
    text-22px
    font-bold
    `,
    latestPostLink: `
    block
    w-full
    min-h-1.6em
    text-cm-text-secondary
    text-14px
    leading-normal
    no-underline
    overflow-wrap-anywhere
    transition-colors
    hover:(text-cm-primary bg-cmCard-hover)
    `,
    adLabel: `
    mb-1.5
    text-cm-text-muted
    text-10px
    `,

    // ===== 포스트 본문 =====
    postPageContent: `flex-1
    min-w-0
    p-0
    bg-cm-paper
    rounded-cm
    shadow-cm
    overflow-hidden
    `,
    markdownBody: `
    w-full
    m-0
    p-12
    px-18
    bg-transparent
    `,
    postHeader: `
    m-0
    mb-12
    pb-7
    border-b
    border-cm-border
    `,
    postCategory: `
    m-0
    mb-2.5
    text-cm-accent
    text-14px
    font-bold
    `,
    postContent: `
    w-full
    m-0
    p-0
    text-cm-text
    text-16px
    leading-loose
    overflow-wrap-anywhere
    `,

    // ===== 페이지네이션 / 푸터 =====
    pageBtn: `
    inline-flex
    items-center
    justify-center
    min-w-9
    h-9
    px-2.5
    bg-cm-paper
    border
    border-cm-border
    rounded-cm-btn
    text-cm-primary
    text-14px
    font-semibold
    cursor-pointer
    transition-all
    hover:(bg-cmCard-hover border-cm-primary)
    `,
    pageBtnActive: `
    bg-cm-footer
    border-cm-primary
    text-oklch(0.94558 0.00861 67.72)
    `,
    siteFooter: `
    mt-auto
    py-6
    px-5
    bg-cm-footer
    text-oklch(0.94558 0.00861 67.72)
    text-center
    `,

    // ===== 계산기 =====
    calculatorCard: `
    p-5
    bg-cmCard
    border
    border-cmCard-border
    rounded-cm-sm
    shadow-cmCard
    `,
    calculatorInput: `
    w-full
    px-3
    py-2.5
    bg-cm-paper
    border
    border-cm-border
    rounded-cm-btn
    text-cm-text
    text-15px
    outline-none
    focus:border-cm-accent
    focus:ring-2
    focus:ring-cm-focus/30
    `,
    primaryButton: `
    inline-flex
    items-center
    justify-center
    px-4
    py-2
    bg-cm-accent
    text-white
    text-14px
    font-semibold
    rounded-cm-btn
    cursor-pointer
    border-none
    hover:bg-cm-primary-hover
    transition-colors
    `,
    secondaryButton: `
    inline-flex
    items-center
    justify-center
    px-3
    py-1.5
    bg-cm-paper
    border
    border-cm-border
    text-cm-primary
    text-13px
    font-semibold
    rounded-cm-btn
    cursor-pointer
    hover:(bg-cmCard-hover border-cm-primary)
    transition-colors
    `,
    resultCard: `
    p-5
    bg-cm-paper
    border
    border-cm-border
    rounded-cm-sm
    shadow-cmCard
    `,
    adContainer: `
    w-full
    `,
  },

  safelist: [
    "pageBtn",
    "pageBtnActive",
    "pageArrowBtn",
    "calculatorCard",
    "calculatorInput",
    "primaryButton",
    "secondaryButton",
    "resultCard",
  ],

  preflights: [
    {
      getCSS: () => `
        :root {
          --cm-bg: oklch(0.97209 0.01073 76.6);
          --cm-paper: oklch(1 0 0);
          --cm-text: oklch(0.22562 0.00849 59.21);
          --cm-text-secondary: oklch(0.4733 0.0141 59.32);
          --cm-text-muted: oklch(0.60912 0.01514 60.42);
          --cm-primary: oklch(0.34688 0.03773 49.68);
          --cm-primary-hover: oklch(0.58122 0.13742 50.18);
          --cm-accent: oklch(0.66796 0.14628 52.09);
          --cmCard: oklch(0.99529 0.00251 48.72);
          --cmCard-hover: oklch(0.97057 0.01953 65.15);
          --cmCard-border: oklch(0.90579 0.0174 67.61);
          --cm-border: oklch(0.90579 0.0174 67.61);
          --cm-footer: oklch(0.34688 0.03773 49.68);
          --cm-shadow: 0 8px 28px rgba(31, 41, 51, 0.09);
          --cm-radius: 16px;
        }

        html[data-theme="dark"] {
          --cm-bg: oklch(0.18504 0.00637 55.96);
          --cm-paper: oklch(0.22775 0.01213 55.7);
          --cm-text: oklch(0.94558 0.00861 67.72);
          --cm-text-secondary: oklch(0.79945 0.01855 59.41);
          --cm-text-muted: oklch(0.70606 0.01827 61.85);
          --cm-primary: oklch(0.94558 0.00861 67.72);
          --cm-primary-hover: oklch(0.80728 0.10155 61.24);
          --cm-accent: oklch(0.76399 0.11354 58.81);
          --cmCard: oklch(0.2505 0.01773 63.07);
          --cmCard-hover: oklch(0.27466 0.02194 57.69);
          --cmCard-border: oklch(0.31781 0.01895 56.95);
          --cm-border: oklch(0.31781 0.01895 56.95);
          --cm-footer: oklch(0.18504 0.00637 55.96);
          --cm-shadow: 0 8px 28px rgba(0, 0, 0, 0.28);
        }

        html {
          margin: 0;
          padding: 0;
          overflow-x: hidden;
          overflow-y: scroll;
          scroll-behavior: smooth;
          background: var(--cm-bg);
        }

        body {
          margin: 0;
          min-width: 320px;
          color: var(--cm-text);
          background: var(--cm-bg);
          font-family: "Noto Sans KR", sans-serif;
          font-size: 16px;
          line-height: 1.7;
        }

        *, *::before, *::after {
          box-sizing: border-box;
        }

        /* 왼쪽 광고 */
        .ad-left {
        position: fixed;
        z-index: 20;
        top: 140px;
        left: max(12px, calc(50% - 804px));
        width: 160px;
        height: 600px;
        padding: 8px;
        background: var(--cm-paper);
        border: 1px dashed var(--cm-border);
        border-radius: 8px;
        boxShadow: 0 4px 16px rgba(60, 40, 25, 0.06);
        text-align: center;
        overflow: hidden;
        }

        .ad-left .adsbygoogle {
        display: block !important;
        width: 160px !important;
        height: 600px !important;
        }

        /* 반응형에서 숨김 */
        .is-tablet .ad-left,
        .is-mobile .ad-left {
          display: none;
        }

        /* Tablet (responsive.js → .is-tablet) */
        .is-tablet .siteMain { padding-inline: 40px; }
        .is-tablet .siteSidebar { width: 250px; }
        .is-tablet .siteNavList { gap: 28px; }
        .is-tablet .siteNavLink { font-size: 20px; }

        /* Mobile (responsive.js → .is-mobile) */
        .is-mobile body { font-size: 15px; }
        .is-mobile .site-logo { width: 154px; }
        .is-mobile .siteNav { margin-bottom: 20px; }
        .is-mobile .siteNavList { display: none; }
        .is-mobile .siteNav.is-open .siteNavList {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .is-mobile .siteMainLayout {
          flex-direction: column;
          gap: 16px;
          width: calc(100% - 32px);
        }
        .is-mobile .siteMain {
          width: 100%;
          padding: 24px 16px;
          border-radius: 12px;
        }
        .is-mobile .siteSidebar {
          position: static;
          width: 100%;
        }
        .is-mobile .categoryGrid { grid-template-columns: 1fr; }
        .is-mobile .homeTitle { font-size: clamp(27px, 7.2vw, 34px); }
        .is-mobile .boardTitle { font-size: 27px; }
        .is-mobile .postCardTitle-row { display: block; }
        .is-mobile .postCardDate {
          display: block;
          margin-top: 7px;
        }

        /* Small (responsive.js → .is-small) */
        .is-small .siteMainLayout { width: calc(100% - 24px); }
        .is-small .siteMain { padding-inline: 14px; }
        .is-small .homeTitle { font-size: 26px; }
      `,
    },
  ],
});
