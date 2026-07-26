/**
 * DEC-043 B6 — SEO score checker for coin blog snapshots.
 */
import type {
    CoinBlogSectionKey,
    CoinBlogSections,
    MarketContextSeoMeta,
    MarketContextSeoScore,
    SeoScoreBand,
    SeoScoreCheck,
} from '../models/marketContext.model';

const COIN_SECTION_KEYS: CoinBlogSectionKey[] = [
    'heroWhatIs',
    'historicalStructure',
    'eventTimeline',
    'newsImpact',
    'structuralOutlook',
    'relatedCoins',
    'faq',
];

function stripMd(text: string): string {
    return text
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .trim();
}

function extractH1OrH2(content: string): string {
    const h1 = content.match(/^#\s+(.+)$/m);
    if (h1) return h1[1].trim();
    const h2 = content.match(/^##\s+(.+)$/m);
    if (h2) return h2[1].trim();
    return '';
}

function firstParagraph(content: string): string {
    const plain = stripMd(content);
    const para = plain.split(/\n\n+/)[0] ?? plain;
    return para.replace(/\s+/g, ' ').trim();
}

function countInternalBlogLinks(sections: Partial<CoinBlogSections>): number {
    let count = 0;
    const linkRe = /\]\(\s*(\/blog(?:\/[^)\s]*)?)\s*\)/gi;
    for (const key of COIN_SECTION_KEYS) {
        const content = sections[key]?.content ?? '';
        let m: RegExpExecArray | null;
        const re = new RegExp(linkRe.source, 'gi');
        while ((m = re.exec(content)) !== null) {
            if (m[1]?.startsWith('/blog')) count += 1;
        }
    }
    return count;
}

function isFaqMeaningful(content: string | undefined): boolean {
    if (!content) return false;
    const plain = stripMd(content);
    if (plain.length < 80) return false;
    const qMarks = (plain.match(/\?/g) ?? []).length;
    return qMarks >= 3;
}

function bandFromPassed(passed: number, total: number): SeoScoreBand {
    const ratio = total === 0 ? 0 : passed / total;
    if (ratio >= 0.9) return 'green';
    if (ratio >= 0.6) return 'yellow';
    return 'red';
}

/**
 * Compute SEO score for a coin article draft/publish payload.
 */
export function computeCoinBlogSeoScore(input: {
    symbol: string;
    seoMeta: MarketContextSeoMeta | null | undefined;
    sections: Partial<CoinBlogSections> | Record<string, { content?: string } | undefined>;
}): MarketContextSeoScore {
    const symbol = input.symbol.toUpperCase();
    const meta = input.seoMeta;
    const sections = input.sections as Partial<CoinBlogSections>;

    const primaryKw =
        meta?.seoKeywords?.[0]?.trim() ||
        `${symbol} price analysis`;

    const checks: SeoScoreCheck[] = [];

    const title = meta?.metaTitle?.trim() ?? '';
    const titleOk = title.length > 0 && title.length <= 60;
    checks.push({
        id: 'meta_title_length',
        passed: titleOk,
        detail: titleOk
            ? `metaTitle length ${title.length} ≤ 60`
            : `metaTitle length ${title.length || 0} (need 1–60)`,
    });

    const desc = meta?.metaDescription?.trim() ?? '';
    const descOk = desc.length > 0 && desc.length <= 160;
    checks.push({
        id: 'meta_description_length',
        passed: descOk,
        detail: descOk
            ? `metaDescription length ${desc.length} ≤ 160`
            : `metaDescription length ${desc.length || 0} (need 1–160)`,
    });

    const hero = sections.heroWhatIs?.content ?? '';
    const h1 = extractH1OrH2(hero);
    const firstPara = firstParagraph(hero);
    const kwLower = primaryKw.toLowerCase();
    const kwInH1 = h1.toLowerCase().includes(kwLower) || h1.toLowerCase().includes(symbol.toLowerCase());
    const kwInFirst =
        firstPara.toLowerCase().includes(kwLower) ||
        firstPara.toLowerCase().includes(symbol.toLowerCase());
    const kwOk = kwInH1 || kwInFirst;
    checks.push({
        id: 'primary_kw_in_h1_or_lead',
        passed: kwOk,
        detail: kwOk
            ? `Primary KW / symbol present in H1 or lead ("${primaryKw}")`
            : `Missing primary KW "${primaryKw}" in H1/first paragraph`,
    });

    const noPricePredictionPrimary = !/price\s*prediction/i.test(primaryKw);
    checks.push({
        id: 'no_price_prediction_primary',
        passed: noPricePredictionPrimary,
        detail: noPricePredictionPrimary
            ? 'Primary keyword is not "price prediction"'
            : 'Primary keyword must not be price prediction',
    });

    const linkCount = countInternalBlogLinks(sections);
    const linksOk = linkCount >= 2;
    checks.push({
        id: 'internal_blog_links',
        passed: linksOk,
        detail: linksOk
            ? `Internal /blog links: ${linkCount} ≥ 2`
            : `Internal /blog links: ${linkCount} (need ≥ 2)`,
    });

    const faqOk = isFaqMeaningful(sections.faq?.content);
    checks.push({
        id: 'faq_meaningful',
        passed: faqOk,
        detail: faqOk ? 'FAQ section has multiple Q&A' : 'FAQ section thin or missing',
    });

    const passed = checks.filter((c) => c.passed).length;
    const total = checks.length;
    const score = Math.round((passed / total) * 100);
    const band = bandFromPassed(passed, total);

    return { band, score, checks };
}
