/**
 * Editorial Design System — OnlyAlpha Insights (publication, not Terminal UI).
 */

export const ed = {
    measure: 'max-w-[40rem]',
    measureWide: 'max-w-[46rem]',
    measureIndex: 'max-w-[52rem]',

    font: {
        display: "var(--font-editorial-display), 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif",
        body: "var(--font-editorial-body), Georgia, 'Times New Roman', serif",
        ui: "var(--font-inter), Inter, system-ui, sans-serif",
        mono: "'JetBrains Mono', ui-monospace, monospace",
    },

    colors: {
        bg: 'bg-[#070706]',
        surface: 'bg-[#0c0c0b]',
        border: 'border-[#1c1b19]',
        borderSoft: 'border-[#2a2824]',
        text: 'text-[#ece8e1]',
        textMuted: 'text-[#9c968c]',
        textDim: 'text-[#6e6860]',
        textFaint: 'text-[#4a4640]',
        accent: 'text-[#c9b8a0]',
        accentSoft: 'text-[#a89a88]',
        link: 'text-[#b5a894] hover:text-[#ece8e1] underline-offset-[3px] hover:underline transition-colors',
        ink: 'text-[#f4f0ea]',
        confidenceOk: 'text-[#8a9a7b]',
        confidenceThin: 'text-[#b8a06a]',
        nfa: 'text-[#9c968c]',
        nfaBorder: 'border-[#2a2824]',
        rule: 'border-[#252320]',
    },

    type: {
        mastheadMark: 'text-[13px] font-semibold tracking-tight text-[#f4f0ea]',
        wordmark:
            'text-[11px] uppercase tracking-[0.22em] text-[#7a746a] font-medium',
        navLink:
            'text-[12px] tracking-wide text-[#8a847a] hover:text-[#ece8e1] transition-colors',
        navLinkActive: 'text-[12px] tracking-wide text-[#ece8e1]',
        exitLink:
            'text-[11px] tracking-wide text-[#5c574f] hover:text-[#9c968c] transition-colors',
        editionBadge:
            'text-[10px] uppercase tracking-[0.2em] text-[#a89a88] border border-[#2a2824] px-2.5 py-1 rounded-[2px]',
        meta: 'text-[12px] tracking-wide text-[#6e6860]',
        path: 'text-[12px] tracking-wide text-[#6e6860]',
        h1: 'text-[2rem] md:text-[2.75rem] font-normal tracking-[-0.02em] text-[#f4f0ea] leading-[1.15]',
        dek: 'text-[1.125rem] md:text-[1.2rem] text-[#9c968c] leading-[1.65] font-normal',
        chapterLabel:
            'text-[11px] uppercase tracking-[0.22em] text-[#6e6860] mb-3',
        h2: 'text-[1.4rem] md:text-[1.65rem] font-normal text-[#f4f0ea] tracking-[-0.015em] leading-snug mb-5',
        h3: 'text-[1.15rem] font-normal text-[#f4f0ea] mt-7 mb-2',
        body: 'text-[1.0625rem] md:text-[1.125rem] text-[#d4cfc6] leading-[1.8]',
        bodySm: 'text-[0.95rem] text-[#9c968c] leading-relaxed',
        moduleLabel:
            'text-[10px] uppercase tracking-[0.2em] text-[#6e6860]',
        quote: 'text-[1.2rem] md:text-[1.3rem] text-[#ece8e1] leading-relaxed italic font-normal',
        footer: 'text-[11px] tracking-wide text-[#5c574f]',
        indexTitle: 'text-[1.05rem] md:text-[1.15rem] text-[#f4f0ea] leading-snug',
        indexHook: 'text-[0.95rem] text-[#9c968c] leading-relaxed',
    },

    space: {
        pageY: 'py-12 md:py-20',
        pageX: 'px-5 sm:px-8 md:px-10',
        sectionY: 'py-12 md:py-16',
        chapterGap: 'mb-16 md:mb-24',
        moduleY: 'my-10',
        stripY: 'py-5',
        heroBottom: 'mb-12 md:mb-16',
        bridgeTop: 'mt-20 md:mt-28',
        mastheadH: 'h-[3.75rem] md:h-16',
    },
} as const;
