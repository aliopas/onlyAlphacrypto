/**
 * Shared content helpers for Market Context editorial rendering (MC-ED).
 * Pure functions — no React dependency for testability.
 */

export type SectionKey =
    | 'overview'
    | 'btcCorrelation'
    | 'liquidity'
    | 'newsSensitivity'
    | 'geopolitics'
    | 'thisWeek'
    | 'outlook'
    | 'faq';

export interface MarketContextSection {
    content: string;
    updatedAt: string;
    sourceNewsIds: number[];
}

export interface PublicSnapshot {
    id: number;
    snapshotKey: string;
    kind: string;
    weekLabel: string | null;
    status: 'published';
    sections: Partial<Record<SectionKey, MarketContextSection>>;
    marketDataVersion: string | null;
    generatorVersion: string;
    generatedAt: string | null;
    publishedAt: string | null;
    updatedAt: string | null;
}

export const SECTION_ORDER: SectionKey[] = [
    'overview',
    'btcCorrelation',
    'liquidity',
    'newsSensitivity',
    'geopolitics',
    'thisWeek',
    'outlook',
    'faq',
];

/** Fallback chapter labels when markdown has no H2 (search-intent friendly, not stuffed). */
export const SECTION_CHAPTER_LABELS: Record<SectionKey, string> = {
    overview: 'Overview',
    btcCorrelation: 'Bitcoin & Correlation',
    liquidity: 'Liquidity',
    newsSensitivity: 'News Sensitivity',
    geopolitics: 'Macro & Geopolitics',
    thisWeek: 'This Week',
    outlook: 'Outlook',
    faq: 'Questions',
};

const PLACEHOLDER_PATTERNS = [
    /^tbd\.?$/i,
    /^n\/?a\.?$/i,
    /^todo\.?$/i,
    /^coming soon\.?$/i,
    /^placeholder/i,
    /^\[.*\]$/,
    /^lorem ipsum/i,
    /^section (content )?pending/i,
    /^no (data|content|analysis)/i,
    /^not (available|enough)/i,
];

export function stripMarkdownNoise(text: string): string {
    return text
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .trim();
}

export function extractH2(content: string): string | null {
    const match = content.match(/^##\s+(.+)$/m);
    return match ? match[1].trim() : null;
}

/** ER-1: omit schema slots with nothing meaningful this edition. */
export function isMeaningfulSection(content: string | undefined | null): boolean {
    if (!content) return false;
    const plain = stripMarkdownNoise(content).replace(/\s+/g, ' ').trim();
    if (plain.length < 48) return false;
    if (PLACEHOLDER_PATTERNS.some((re) => re.test(plain))) return false;
    const words = plain.split(/\s+/).filter(Boolean);
    if (words.length < 12) return false;
    return true;
}

export function countVerifiedSources(
    sections: Partial<Record<SectionKey, MarketContextSection>>
): number {
    const ids = new Set<number>();
    for (const key of SECTION_ORDER) {
        const sec = sections[key];
        if (!sec?.sourceNewsIds) continue;
        for (const id of sec.sourceNewsIds) {
            if (typeof id === 'number' && Number.isFinite(id)) ids.add(id);
        }
    }
    return ids.size;
}

export type ConfidenceBand = 'solid' | 'moderate' | 'limited';

export function deriveConfidence(
    sourceCount: number,
    meaningfulChapterCount: number
): { band: ConfidenceBand; label: string; detail: string } {
    if (sourceCount === 0 || meaningfulChapterCount <= 1) {
        return {
            band: 'limited',
            label: 'Limited evidence',
            detail:
                'Evidence this edition is limited. Interpretation rests on a thin verified-news window — read with caution.',
        };
    }
    if (sourceCount < 4 || meaningfulChapterCount < 4) {
        return {
            band: 'moderate',
            label: 'Moderate confidence',
            detail:
                'A partial verified-news set supports this edition. Some structural angles may be thinner than usual.',
        };
    }
    return {
        band: 'solid',
        label: 'Well supported',
        detail: 'This edition draws on multiple verified sources across the covered chapters.',
    };
}

export function formatEditionLabel(snapshot: PublicSnapshot): string {
    if (snapshot.weekLabel?.trim()) {
        const w = snapshot.weekLabel.trim();
        if (/^edition/i.test(w)) return w;
        return `Edition ${w}`;
    }
    const kind = snapshot.kind?.replace(/_/g, ' ') ?? 'market';
    const pretty = kind.charAt(0).toUpperCase() + kind.slice(1);
    return `${pretty} edition`;
}

export function formatDisplayDate(iso: string | null | undefined): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

export function sameCalendarDay(a: string | null | undefined, b: string | null | undefined): boolean {
    if (!a || !b) return true;
    const da = new Date(a);
    const db = new Date(b);
    if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return true;
    return (
        da.getUTCFullYear() === db.getUTCFullYear() &&
        da.getUTCMonth() === db.getUTCMonth() &&
        da.getUTCDate() === db.getUTCDate()
    );
}

/** Pull a short dek from overview first paragraph. */
export function extractDek(overviewContent: string | undefined, maxLen = 220): string {
    if (!overviewContent) {
        return 'A calm, educational reading of why crypto markets are behaving as they are — structure before noise.';
    }
    const plain = stripMarkdownNoise(overviewContent);
    const para = plain.split(/\n\n+/)[0] ?? plain;
    const oneLine = para.replace(/\s+/g, ' ').trim();
    if (oneLine.length <= maxLen) return oneLine;
    const cut = oneLine.slice(0, maxLen);
    const lastSpace = cut.lastIndexOf(' ');
    return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

/** First substantial sentence for Key Insight module (sparse). */
export function extractKeyInsightSentence(content: string | undefined): string | null {
    if (!content || !isMeaningfulSection(content)) return null;
    const plain = stripMarkdownNoise(content).replace(/\s+/g, ' ').trim();
    const match = plain.match(/^(.{40,200}?[.!?])\s/);
    if (match) return match[1].trim();
    if (plain.length >= 40 && plain.length <= 240) return plain;
    return plain.slice(0, 180).trim() + (plain.length > 180 ? '…' : '');
}

export function extractTakeawayFromOutlook(content: string | undefined): string | null {
    if (!content || !isMeaningfulSection(content)) return null;
    const plain = stripMarkdownNoise(content).replace(/\s+/g, ' ').trim();
    const sentences = plain.match(/[^.!?]+[.!?]+/g);
    if (!sentences || sentences.length === 0) return plain.slice(0, 200);
    const last = sentences[sentences.length - 1]?.trim();
    if (last && last.length >= 40) return last;
    return sentences[0]?.trim() ?? null;
}

export function renderMarkdownToSafeHtml(md: string): string {
    const escaped = md
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const lines = escaped.split('\n');
    const htmlParts: string[] = [];
    let inList = false;

    const flushList = () => {
        if (inList) {
            htmlParts.push('</ul>');
            inList = false;
        }
    };

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
            flushList();
            continue;
        }

        if (trimmed.startsWith('### ')) {
            flushList();
            htmlParts.push(
                `<h3 class="text-[1.1rem] font-semibold text-white mt-6 mb-2">${inlineFormat(trimmed.slice(4))}</h3>`
            );
            continue;
        }
        if (trimmed.startsWith('## ')) {
            flushList();
            // H2 rendered by Chapter chrome when extractH2 used; still allow inline H2s deeper in body
            htmlParts.push(
                `<h2 class="text-[1.35rem] md:text-[1.5rem] font-semibold text-white tracking-tight leading-snug mt-8 mb-4">${inlineFormat(trimmed.slice(3))}</h2>`
            );
            continue;
        }
        if (trimmed.startsWith('# ')) {
            flushList();
            htmlParts.push(
                `<h2 class="text-[1.35rem] md:text-[1.5rem] font-semibold text-white tracking-tight leading-snug mt-8 mb-4">${inlineFormat(trimmed.slice(2))}</h2>`
            );
            continue;
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            if (!inList) {
                htmlParts.push(
                    '<ul class="list-disc pl-5 space-y-2 text-[#c8c4be] mb-4 marker:text-[#4a4742]">'
                );
                inList = true;
            }
            htmlParts.push(`<li class="leading-[1.75]">${inlineFormat(trimmed.slice(2))}</li>`);
            continue;
        }

        flushList();
        htmlParts.push(
            `<p class="text-[1.0625rem] md:text-[1.125rem] text-[#c8c4be] leading-[1.75] mb-4">${inlineFormat(trimmed)}</p>`
        );
    }
    flushList();
    return htmlParts.join('\n');
}

/** Body HTML without the first H2 (chapter title handled separately). */
export function renderChapterBodyHtml(md: string): string {
    const withoutFirstH2 = md.replace(/^##\s+.+$/m, '').trim();
    return renderMarkdownToSafeHtml(withoutFirstH2 || md);
}

function inlineFormat(text: string): string {
    return text
        .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-[#e8e6e3] font-semibold">$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(
            /`([^`]+)`/g,
            '<code class="text-[0.85em] bg-[#111] border border-[#2a2a2a] px-1 rounded text-[#c8c4be]">$1</code>'
        );
}
