/**
 * MC-ED-0 — Editorial Design System tokens
 * Reading-first scale distinct from Terminal ops UI.
 */

export const ed = {
    measure: 'max-w-[72ch]',
    measureWide: 'max-w-[75ch]',

    colors: {
        bg: 'bg-[#050505]',
        surface: 'bg-[#0A0A0A]',
        border: 'border-[#1e1e1e]',
        borderSoft: 'border-[#2a2a2a]',
        text: 'text-[#e8e6e3]',
        textMuted: 'text-[#9a9690]',
        textDim: 'text-[#6b6760]',
        textFaint: 'text-[#4a4742]',
        accent: 'text-[#c4b5a0]',
        accentSoft: 'text-[#a89f91]',
        link: 'text-[#a89f91] hover:text-[#e8e6e3]',
        ink: 'text-white',
        confidenceOk: 'text-[#8a9a7b]',
        confidenceThin: 'text-[#b8a06a]',
        nfa: 'text-[#9a9690]',
        nfaBorder: 'border-[#2a2a2a]',
    },

    type: {
        mastheadMark: 'text-sm font-bold tracking-tighter text-white',
        wordmark: 'text-[11px] font-mono uppercase tracking-[0.18em] text-[#6b6760]',
        exitLink: 'text-[11px] font-mono text-[#555] hover:text-[#888] transition-colors',
        editionBadge:
            'text-[10px] font-mono uppercase tracking-[0.16em] text-[#a89f91] border border-[#2a2a2a] px-2 py-0.5 rounded-sm',
        meta: 'text-[12px] font-mono text-[#6b6760] tracking-wide',
        h1: 'text-[1.75rem] md:text-[2.25rem] font-semibold text-white tracking-tight leading-[1.2]',
        dek: 'text-[1.05rem] md:text-[1.125rem] text-[#9a9690] leading-relaxed',
        chapterLabel:
            'text-[11px] font-mono uppercase tracking-[0.2em] text-[#6b6760] mb-3',
        h2: 'text-[1.35rem] md:text-[1.5rem] font-semibold text-white tracking-tight leading-snug mb-4',
        h3: 'text-[1.1rem] font-semibold text-white mt-6 mb-2',
        body: 'text-[1.0625rem] md:text-[1.125rem] text-[#c8c4be] leading-[1.75]',
        bodySm: 'text-[0.9375rem] text-[#9a9690] leading-relaxed',
        moduleLabel:
            'text-[10px] font-mono uppercase tracking-[0.18em] text-[#6b6760]',
        quote: 'text-[1.15rem] md:text-[1.25rem] text-[#e8e6e3] leading-relaxed italic font-normal',
        footer: 'text-[11px] font-mono text-[#555]',
    },

    space: {
        pageY: 'py-10 md:py-16',
        pageX: 'px-5 md:px-8',
        sectionY: 'py-10 md:py-14',
        chapterGap: 'mb-14 md:mb-20',
        moduleY: 'my-8',
        stripY: 'py-4',
        heroBottom: 'mb-10 md:mb-14',
        bridgeTop: 'mt-16 md:mt-24',
    },
} as const;
