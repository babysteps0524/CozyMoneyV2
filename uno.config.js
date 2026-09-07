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
        bg: "var(--cm-bg)",
        paper: "var(--cm-paper)",
        text: "var(--cm-text)",
        textSecondary: "var(--cm-text-secondary)",
        textMuted: "var(--cm-text-muted)",
        primary: "var(--cm-primary)",
        primaryStrong: "var(--cm-primary-strong)",
        primaryHover: "var(--cm-primary-hover)",
        accent: "var(--cm-accent)",
        accentHover: "var(--cm-accent-hover)",
        card: "var(--cmCard)",
        cardHover: "var(--cmCard-hover)",
        cardBorder: "var(--cmCard-border)",
        border: "var(--cm-border)",
        footer: "var(--cm-footer)",
        focus: "var(--cm-focus)",
        codeBg: "var(--cm-code-bg)",
        codeText: "var(--cm-code-text)",
      },
    },

    borderRadius: {
      cm: "16px",
      cmSm: "12px",
      cmXs: "8px",
      cmBtn: "6px",
    },

    boxShadow: {
      cm: "var(--cm-shadow)",
      cmHover: "var(--cm-shadow-hover)",
      cmCard: "0 3px 10px rgba(60, 40, 25, 0.06)",
      cmLink: "0 2px 8px rgba(31, 41, 51, 0.04)",
      cmLinkHover: "0 6px 18px rgba(31, 41, 51, 0.09)",
      cmAd: "0 4px 16px rgba(60, 40, 25, 0.06)",
    },

    maxWidth: {
      cm: "1240px",
      cmContent: "920px",
    },
  },

  shortcuts: {
    // =========================================================
    // Layout
    // =========================================================

    siteHeader: `
      sticky top-0 z-100
      w-min(100%,max-w-cm)
      mx-auto
      px-4 pt-2.5 pb-3.5
      bg-cm-bg
      max-md:(px-4 py-3 pb-2.5)
      max-sm:px-3
    `,

    siteHeaderTitle: `
      m-0 p-0 leading-0 text-center
    `,

    siteLogo: `
      inline-block
      max-w-full
    `,

    siteNav: `
      sticky top-14 z-100
      w-min(100%,max-w-cm)
      mx-auto mb-10
      bg-cm-bg
      max-md:(w-full mb-5 backdrop-blur-[8px])
    `,

    siteNavInner: `
      relative
      max-md:px-4
      max-sm:px-3
    `,

    siteNavList: `
      flex items-center justify-center
      gap-10
      m-0
      pt-3 px-5 pb-2.5
      list-none
      border-y-2 border-cm-accent

      max-lg:gap-7

      max-md:(
        hidden
        gap-0
        py-2 px-0
        border-y border-cm-accent
      )
    `,

    siteNavListOpen: `
      max-md:(grid grid-cols-2)
    `,

    siteNavItem: `
      m-0
      max-md:border-b max-md:border-cm-border
    `,

    siteNavLink: `
      inline-block
      px-2 py-1.25
      text-cm-primary text-22px
      font-bold leading-[1.4]
      no-underline
      transition-colors duration-300

      hover:(text-cm-primary-hover scale-105)

      max-lg:text-20px

      max-md:(
        flex items-center justify-center
        min-h-12
        px-1.5 py-2
        text-16px
      )
    `,

    siteNavLinkActive: `
      bg-cm-accent text-white rounded-cm-btn
    `,

    mobileMenuToggle: `
      hidden

      max-md:(
        flex items-center justify-between
        w-full min-h-12
        px-1 py-2
        border-0 border-y border-cm-accent
        bg-transparent
        text-cm-primary text-15px font-bold
        cursor-pointer
      )
    `,

    mobileMenuToggleIcon: `
      relative inline-flex
      flex-col justify-center gap-1
      w-7 h-7
    `,

    mobileMenuToggleLine: `
      block
      w-5 h-0.5
      mx-auto
      bg-current
      rounded
      transition-[transform,opacity] duration-180
    `,

    mobileMenuToggleOpenLine1: `
      translate-y-1.5 rotate-45
    `,

    mobileMenuToggleOpenLine2: `
      opacity-0
    `,

    mobileMenuToggleOpenLine3: `
      -translate-y-1.5 -rotate-45
    `,

    siteMainLayout: `
      flex items-start
      gap-6
      w-min(calc(100%-32px),max-w-cm)
      mx-auto mb-10

      max-md:(
        flex-col
        gap-4
        w-[calc(100%-32px)]
        mb-6
      )

      max-sm:w-[calc(100%-24px)]
    `,

    siteMain: `
      min-w-0 flex-1
      bg-cm-paper
      rounded-cm
      shadow-cm
      py-6 px-18

      max-lg:px-10

      max-md:(
        w-full
        px-4 py-6
        rounded-cm-sm
      )

      max-sm:px-3.5
    `,

    siteSidebar: `
      sticky top-0
      flex-none
      w-71 min-w-0

      max-lg:w-62.5

      max-md:(
        static
        w-full
      )
    `,

    // =========================================================
    // Home / Board
    // =========================================================

    homeIntro: `
      mb-13.5
      max-md:mb-8
    `,

    boardIntro: `
      mb-10
      max-md:mb-7
    `,

    homeEyebrow: `
      m-0 mb-2.5
      text-cm-accent text-14px font-bold

      max-md:(mb-2 text-13px)
    `,

    boardEyebrow: `
      m-0 mb-2.5
      text-cm-accent text-14px font-bold

      max-md:(mb-2 text-13px)
    `,

    homeTitle: `
      m-0 mb-4
      text-cm-text text-38px
      font-bold leading-[1.4]

      max-md:(
        mb-3.5
        text-[clamp(27px,7.2vw,34px)]
        leading-[1.42]
      )

      max-sm:text-26px
    `,

    homeDescription: `
      m-0
      text-cm-text-secondary
      text-18px leading-[1.9]

      max-md:(
        text-15px
        leading-[1.8]
      )
    `,

    boardTitle: `
      m-0 mb-3.5
      text-cm-text text-32px
      font-bold leading-[1.4]

      max-md:(
        mb-2.5
        text-27px
      )
    `,

    boardDescription: `
      m-0
      text-cm-text-secondary
      text-16px leading-[1.8]

      max-md:(
        text-14px
        leading-[1.75]
      )
    `,

    // =========================================================
    // Category cards
    // =========================================================

    categoryGrid: `
      grid grid-cols-2 gap-4
      max-md:(grid-cols-1 gap-3)
    `,

    categoryCard: `
      block min-w-0
      p-7
      bg-cm-card
      border border-cm-card-border
      rounded-cm-sm
      text-inherit no-underline
      shadow-cm-card
      transition-[background-color,box-shadow,border-color] duration-180

      hover:(
        bg-cm-card-hover
        border-cm-border
        shadow-cm-hover
      )

      max-md:(
        p-5
        rounded-10px
      )

      max-sm:p-4.5
    `,

    categoryCardTitle: `
      m-0 mb-2
      text-cm-primary
      text-20px font-bold leading-[1.5]

      max-md:text-19px
    `,

    categoryCardDescription: `
      m-0 mb-3.5
      text-cm-text-secondary
      text-14px leading-[1.75]

      max-md:(
        mb-3
        text-14px
      )
    `,

    categoryCardMore: `
      inline-flex items-center gap-1
      text-cm-accent
      text-13px font-semibold
    `,

    // =========================================================
    // Sidebar / Latest posts / Ads
    // =========================================================

    asideNav: `
      py-6 px-7
      bg-cm-paper
      rounded-cm
      shadow-cm

      max-md:(
        p-5
        rounded-cm-sm
      )
    `,

    asideNavH2: `
      m-0 mb-4.5
      text-cm-primary
      text-22px font-bold

      max-md:(
        mb-3.5
        text-19px
      )
    `,

    latestPostList: `
      m-0 p-0 list-none
    `,

    latestPostItem: `
      m-0 mb-3 list-none
      last:mb-0
    `,

    latestPostLink: `
      block w-full
      min-h-[1.6em]
      text-cm-text-secondary
      text-14px leading-[1.6]
      no-underline
      overflow-wrap-anywhere
      transition-[color,background-color] duration-150

      hover:(
        text-cm-primary
        bg-cm-card-hover
      )
    `,

    adLeft: `
      fixed z-20
      top-35
      left-[max(12px,calc(50%-804px))]
      w-40 h-150
      p-2
      bg-cm-paper
      border border-dashed border-cm-border
      rounded-cm-xs
      shadow-cm-ad
      text-center
      overflow-hidden
    `,

    adRight: `
      block w-full
      min-h-37.5
      mt-6 p-2
      bg-cm-paper
      border border-dashed border-cm-border
      rounded-10px
      shadow-cm-ad
      text-center
      overflow-hidden

      max-md:(
        min-h-20
        mt-4
      )
    `,

    adLabel: `
      mb-1.5
      text-cm-text-muted
      text-10px
    `,

    // =========================================================
    // Post list
    // =========================================================

    postList: `
      block
    `,

    postCard: `
      mb-3
      bg-cm-card
      border border-cm-card-border
      rounded-cm-sm
      transition-[background-color,box-shadow,border-color] duration-180

      hover:(
        bg-cm-card-hover
        border-cm-border
        shadow-cm-hover
      )

      max-md:(
        mb-2.5
        rounded-10px
      )
    `,

    postCardLink: `
      block
      py-4.5 px-5
      text-inherit no-underline
      rounded-inherit
      shadow-cm-link
      transition-[box-shadow,background-color] duration-180

      hover:shadow-cm-link-hover
      focus-visible:shadow-cm-link-hover

      max-md:(
        min-h-11
        p-4
      )

      max-sm:p-3.5
    `,

    postCardTitleRow: `
      flex items-center justify-between
      gap-5

      max-md:block
    `,

    postCardTitle: `
      min-w-0 m-0
      text-cm-text
      text-18px font-bold leading-[1.5]
      overflow-wrap-anywhere

      max-md:(
        text-16px
        leading-[1.55]
      )

      max-sm:text-[15.5px]
    `,

    postCardDate: `
      flex-none
      text-cm-text-muted
      text-13px
      whitespace-nowrap

      max-md:(
        block
        mt-1.75
        text-12px
      )
    `,

    postCardDescription: `
      mt-2 mb-0
      text-cm-text-secondary
      text-14px leading-[1.65]
      overflow-wrap-anywhere

      max-md:(
        mt-2
        text-13px
        leading-[1.65]
      )
    `,
    // =========================================================
    // Pagination
    // =========================================================

    pagination: `
      flex items-center justify-center flex-wrap
      gap-2
      my-10 mb-15

      max-md:(
        gap-1.5
        mt-8 mb-9
      )
    `,

    pageBtn: `
      inline-flex items-center justify-center
      min-w-9 h-9
      px-2.5
      bg-cm-paper
      border border-cm-border
      rounded-cm-btn
      text-cm-primary
      text-14px font-semibold
      cursor-pointer
      transition-[background-color,color,border-color] duration-150

      hover:(
        bg-cm-card-hover
        border-cm-primary
      )

      disabled:(
        opacity-40
        cursor-default
      )

      max-md:(
        min-w-9.5
        min-h-9.5
      )
    `,

    pageArrowBtn: `
      inline-flex items-center justify-center
      min-w-9 h-9
      px-2.5
      bg-cm-paper
      border border-cm-border
      rounded-cm-btn
      text-cm-primary
      text-14px font-semibold
      cursor-pointer
      transition-[background-color,color,border-color] duration-150

      hover:(
        bg-cm-card-hover
        border-cm-primary
      )

      disabled:(
        opacity-40
        cursor-default
      )

      max-md:(
        min-w-9.5
        min-h-9.5
      )
    `,

    pageBtnActive: `
      bg-cm-footer
      border-cm-primary
      text-[oklch(0.94558_0.00861_67.72)]
      hover:bg-cm-footer
    `,

    // =========================================================
    // Individual article / Markdown
    // =========================================================

    postPageContent: `
      flex-1 min-w-0
      p-0
      bg-cm-paper
      rounded-cm
      shadow-cm
      overflow-hidden

      max-md:rounded-cm-sm
    `,

    markdownBody: `
      w-full m-0
      pt-12 px-18 pb-14
      bg-transparent

      max-lg:px-10

      max-md:(
        pt-7
        px-4
        pb-9
      )

      max-sm:px-3.5
    `,

    postHeader: `
      m-0 mb-12
      pb-7
      border-b border-cm-border

      [&_h1]:(
        m-0 mb-4
        text-cm-text
        text-36px font-bold
        leading-[1.45]
        overflow-wrap-anywhere
      )

      [&_time]:(
        text-cm-text-muted
        text-14px
      )

      max-md:(
        mb-8
        pb-5
      )

      max-md:[&_h1]:(
        mb-3
        text-[clamp(24px,6.5vw,29px)]
        leading-[1.45]
      )

      max-md:[&_time]:text-12px
    `,

    postCategory: `
      m-0 mb-2.5
      text-cm-accent
      text-14px font-bold

      max-md:(
        mb-2
        text-13px
      )
    `,

    postContent: `
      w-full m-0 p-0
      text-cm-text
      text-16px leading-[1.9]
      overflow-wrap-anywhere

      [&_p]:(
        m-0
        mb-4.5
      )

      [&_h1]:(
        mt-12 mb-5
        text-30px
        font-bold
        leading-[1.5]
        overflow-wrap-anywhere
      )

      [&_h2]:(
        mt-12 mb-4.5
        text-cm-primary
        text-25px
        font-bold
        leading-[1.5]
        overflow-wrap-anywhere
      )

      [&_h3]:(
        mt-8 mb-3.5
        text-cm-primary
        text-21px
        font-bold
        leading-[1.5]
        overflow-wrap-anywhere
      )

      [&_h4]:(
        mt-7 mb-3
        text-cm-primary
        text-18px
        font-bold
        overflow-wrap-anywhere
      )

      [&_a]:(
        text-cm-primary
        underline
        underline-offset-2
      )

      [&_ul]:(
        m-0 mb-5
        pl-7
      )

      [&_ol]:(
        m-0 mb-5
        pl-7
      )

      [&_li]:mb-1.5

      [&_blockquote]:(
        my-6
        py-4 px-5
        bg-cm-card
        border-l-4 border-cm-accent
        text-cm-text-secondary
      )

      [&_hr]:(
        my-10
        border-0
        border-t border-cm-border
      )

      [&_table]:(
        block
        w-max
        min-w-full
        max-w-full
        my-6
        overflow-x-auto
        border-collapse
        text-15px
      )

      [&_th]:(
        min-w-25
        p-3
        border border-cm-border
        text-left align-top
        bg-cm-card
        font-bold
      )

      [&_td]:(
        min-w-25
        p-3
        border border-cm-border
        text-left align-top
      )

      [&_img]:(
        block
        max-w-full h-auto
        my-7 mx-auto
        rounded
      )

      [&_pre]:(
        max-w-full
        my-6
        p-4.5
        overflow-x-auto
        bg-[oklch(0.22775_0.01213_55.7)]
        rounded-cm-xs
        text-[oklch(0.94558_0.00861_67.72)]
        leading-[1.6]
        [-webkit-overflow-scrolling:touch]
      )

      [&_code]:(
        py-0.5 px-1.25
        bg-cm-code-bg
        rounded
        font-[Consolas,"Courier_New",monospace]
        text-[0.9em]
        overflow-wrap-anywhere
      )

      [&_pre_code]:(
        p-0
        bg-transparent
        text-inherit
        overflow-wrap-normal
      )

      max-md:(
        text-15px
        leading-[1.85]
      )

      max-md:[&_p]:mb-4

      max-md:[&_h1]:(
        mt-9.5 mb-4
        text-25px
      )

      max-md:[&_h2]:(
        mt-9.5 mb-3.5
        text-21px
      )

      max-md:[&_h3]:(
        mt-7 mb-3
        text-18px
      )

      max-md:[&_h4]:text-17px

      max-md:[&_ul]:pl-5.5
      max-md:[&_ol]:pl-5.5

      max-md:[&_blockquote]:(
        my-5
        py-[13px] px-[15px]
        border-l-3
      )

      max-md:[&_table]:(
        my-5
        text-13px
      )

      max-md:[&_th]:(
        min-w-23
        py-[9px] px-[10px]
      )

      max-md:[&_td]:(
        min-w-23
        py-[9px] px-[10px]
      )

      max-md:[&_pre]:(
        mx-0
        p-3.5
        rounded-[7px]
        text-12px
      )

      max-md:[&_img]:(
        my-[22px]
        rounded-[3px]
      )

      max-sm:(
        text-[14.5px]
      )
    `,

    katexDisplay: `
      max-w-full
      my-7 py-1
      overflow-x-auto overflow-y-hidden
      [-webkit-overflow-scrolling:touch]
    `,

    postFooter: `
      mt-15 pt-7
      border-t border-cm-border

      max-md:(
        mt-10.5
        pt-5
      )
    `,

    postBack: `
      inline-flex items-center
      min-h-11
      py-2 px-3.5
      text-cm-primary
      text-15px font-semibold
      no-underline
      rounded-cm-xs
      hover:bg-cm-card

      max-md:text-14px
    `,

    // =========================================================
    // Footer
    // =========================================================

    siteFooter: `
      mt-auto
      pt-6 px-5 pb-4.5
      bg-cm-footer
      text-[oklch(0.94558_0.00861_67.72)]
      text-center

      max-md:(
        pt-5.5 px-4 pb-4
      )
    `,

    siteFooterLinks: `
      flex items-center justify-center
      gap-4
      mb-2.5

      max-md:mb-2
    `,

    siteFooterLink: `
      text-[oklch(0.94558_0.00861_67.72)]
      text-14px
      no-underline
      hover:text-[oklch(0.97057_0.01953_65.15)]
    `,

    siteFooterText: `
      m-0
    `,

    siteFooterSmall: `
      text-12px
    `,

    // =========================================================
    // Privacy
    // =========================================================

    privacyPage: `
      w-min(calc(100%-32px),max-w-cm-content)
      mx-auto my-15
      py-12.5 px-15
      bg-cm-paper
      rounded-cm
      shadow-cm

      [&_h1]:(
        m-0 mb-4
        text-30px
        leading-[1.45]
      )

      [&_section]:mb-8.75

      [&_section_h2]:(
        m-0 mb-3
        text-cm-primary
        text-20px
        leading-[1.5]
      )

      [&_p]:(
        text-cm-text-secondary
        text-15px
        leading-[1.9]
      )

      [&_ul]:(
        pl-6
        text-cm-text-secondary
        text-15px
        leading-[1.9]
      )

      [&_li]:mb-2

      [&_a]:text-cm-primary

      max-md:(
        w-[calc(100%-32px)]
        my-6
        py-7 px-5
        rounded-cm-sm
      )

      max-md:[&_h1]:text-25px
      max-md:[&_section]:mb-7
      max-md:[&_section_h2]:text-18px

      max-md:[&_p]:(
        text-14px
        leading-[1.85]
      )
    `,

    // =========================================================
    // Calculator
    // =========================================================

    calculatorCard: `
      p-5
      bg-cm-card
      border border-cm-card-border
      rounded-cm-sm
      shadow-cm-card
    `,

    calculatorInput: `
      w-full
      px-3 py-2.5
      bg-cm-paper
      border border-cm-border
      rounded-cm-btn
      text-cm-text text-15px
      outline-none

      focus:(
        border-cm-accent
        ring-2 ring-cm-focus/30
      )
    `,

    primaryButton: `
      inline-flex items-center justify-center
      px-4 py-2
      bg-cm-accent
      text-white text-14px font-semibold
      rounded-cm-btn
      cursor-pointer border-none
      transition-colors
      hover:bg-cm-primary-hover
    `,

    secondaryButton: `
      inline-flex items-center justify-center
      px-3 py-1.5
      bg-cm-paper
      border border-cm-border
      text-cm-primary text-13px font-semibold
      rounded-cm-btn
      cursor-pointer
      transition-colors

      hover:(
        bg-cm-card-hover
        border-cm-primary
      )
    `,

    resultCard: `
      p-5
      bg-cm-paper
      border border-cm-border
      rounded-cm-sm
      shadow-cm-card
    `,

    adContainer: `
      w-full
    `,
  },

  safelist: [
    "siteNavListOpen",
    "siteNavLinkActive",
    "mobileMenuToggleOpenLine1",
    "mobileMenuToggleOpenLine2",
    "mobileMenuToggleOpenLine3",
    "pageBtn",
    "pageArrowBtn",
    "pageBtnActive",
    "katexDisplay",
    "postFooter",
    "postBack",
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
          --cm-primary-strong: oklch(0.34688 0.03773 49.68);
          --cm-primary-hover: oklch(0.58122 0.13742 50.18);

          --cm-accent: oklch(0.66796 0.14628 52.09);
          --cm-accent-hover: oklch(0.58122 0.13742 50.18);

          --cmCard: oklch(0.99529 0.00251 48.72);
          --cmCard-hover: oklch(0.97057 0.01953 65.15);
          --cmCard-border: oklch(0.90579 0.0174 67.61);

          --cm-border: oklch(0.90579 0.0174 67.61);
          --cm-focus: oklch(0.66796 0.14628 52.09);

          --cm-code-bg: oklch(0.97057 0.01953 65.15);
          --cm-code-text: oklch(0.22562 0.00849 59.21);

          --cm-footer: oklch(0.34688 0.03773 49.68);

          --cm-shadow: 0 8px 28px rgba(31, 41, 51, 0.09);
          --cm-shadow-hover: 0 10px 26px rgba(31, 41, 51, 0.13);

          --cm-max: 1240px;
          --cmContent: 920px;
          --cm-radius: 16px;
          --cm-mobile-gutter: 16px;
        }

        html[data-theme="dark"] {
          --cm-bg: oklch(0.18504 0.00637 55.96);
          --cm-paper: oklch(0.22775 0.01213 55.7);
          --cm-text: oklch(0.94558 0.00861 67.72);
          --cm-text-secondary: oklch(0.79945 0.01855 59.41);
          --cm-text-muted: oklch(0.70606 0.01827 61.85);

          --cm-primary: oklch(0.94558 0.00861 67.72);
          --cm-primary-strong: oklch(0.94558 0.00861 67.72);
          --cm-primary-hover: oklch(0.80728 0.10155 61.24);

          --cm-accent: oklch(0.76399 0.11354 58.81);
          --cm-accent-hover: oklch(0.80728 0.10155 61.24);

          --cmCard: oklch(0.2505 0.01773 63.07);
          --cmCard-hover: oklch(0.27466 0.02194 57.69);
          --cmCard-border: oklch(0.31781 0.01895 56.95);

          --cm-border: oklch(0.31781 0.01895 56.95);
          --cm-focus: oklch(0.76399 0.11354 58.81);

          --cm-code-bg: oklch(0.2505 0.01773 63.07);
          --cm-code-text: oklch(0.94558 0.00861 67.72);

          --cm-footer: oklch(0.18504 0.00637 55.96);

          --cm-shadow: 0 8px 28px rgba(0, 0, 0, 0.28);
          --cm-shadow-hover: 0 10px 26px rgba(0, 0, 0, 0.38);
        }

        *,
        *::before,
        *::after {
          box-sizing: border-box;
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
          -webkit-text-size-adjust: 100%;
          text-rendering: optimizeLegibility;
        }

        body,
        button,
        input,
        textarea,
        select {
          font-family: inherit;
        }

        img,
        svg,
        video,
        canvas {
          max-width: 100%;
        }

        button,
        a {
          -webkit-tap-highlight-color: transparent;
        }

        a {
          color: inherit;
        }

        :focus-visible {
          outline: 3px solid color-mix(
            in srgb,
            var(--cm-focus) 55%,
            transparent
          );
          outline-offset: 3px;
        }

        .ad-left .adsbygoogle {
          display: block !important;
          width: 160px !important;
          height: 600px !important;
        }

        .ad-right .adsbygoogle {
          display: block !important;
          width: 100% !important;
        }

        .is-tablet .ad-left,
        .is-mobile .ad-left {
          display: none;
        }

        .is-tablet .siteMain {
          padding-inline: 40px;
        }

        .is-tablet .markdownBody {
          padding-inline: 40px;
        }

        .is-tablet .siteSidebar {
          width: 250px;
        }

        .is-tablet .siteNavList {
          gap: 28px;
        }

        .is-tablet .siteNavLink {
          font-size: 20px;
        }

        .is-mobile body {
          font-size: 15px;
        }

        .is-mobile .site-logo {
          width: 154px;
        }

        .is-mobile .siteNav {
          margin-bottom: 20px;
        }

        .is-mobile .siteNavList {
          display: none;
          gap: 0;
          padding: 8px 0 10px;
          border-top: 1px solid var(--cm-accent);
          border-bottom: 1px solid var(--cm-accent);
        }

        .is-mobile .siteNav.is-open .siteNavList {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .is-mobile .siteNav-item {
          border-bottom: 1px solid var(--cm-border);
        }

        .is-mobile .siteNav-item:nth-last-child(-n + 1) {
          border-bottom: 0;
        }

        .is-mobile .siteNavLink {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 48px;
          padding: 8px 6px;
          font-size: 16px;
        }

        .is-mobile .siteMainLayout {
          display: flex;
          flex-direction: column;
          gap: 16px;
          width: calc(100% - 32px);
          margin-bottom: 24px;
        }

        .is-mobile .siteMain {
          width: 100%;
          padding: 24px 16px;
          border-radius: 12px;
        }

        .is-mobile .siteSidebar {
          position: static;
          width: 100%;
          flex: none;
        }

        .is-mobile .siteSidebar .asideNav {
          margin-bottom: 16px;
        }

        .is-mobile .categoryGrid {
          grid-template-columns: 1fr;
          gap: 12px;
        }

        .is-mobile .homeTitle {
          font-size: clamp(27px, 7.2vw, 34px);
          line-height: 1.42;
        }

        .is-mobile .boardTitle {
          font-size: 27px;
        }

        .is-mobile .postCardTitle-row {
          display: block;
        }

        .is-mobile .postCardDate {
          display: block;
          margin-top: 7px;
        }

        .is-mobile #pagination {
          gap: 6px;
          margin: 32px 0 36px;
        }

        .is-mobile .ad-right {
          min-height: 80px;
          margin-top: 16px;
        }

        .is-small .siteMainLayout {
          width: calc(100% - 24px);
        }

        .is-small .siteHeader,
        .is-small .siteNav-inner {
          padding-inline: 12px;
        }

        .is-small .siteMain,
        .is-small .markdownBody {
          padding-inline: 14px;
        }

        .is-small .homeTitle {
          font-size: 26px;
        }

        @media (prefers-reduced-motion: reduce) {
          html {
            scroll-behavior: auto;
          }

          *,
          *::before,
          *::after {
            transition-duration: 0.01ms !important;
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `,
    },
  ],
});
