import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiClient } from '@/features/shared/api/client';
import { SITE_URL } from '@/lib/constants';
import { TRACKED_COINS } from '@/config/coins';
import { sanitizeForJsonLd } from '@/lib/json-ld';
import { FaqSchema, type FaqItem } from '@/components/seo/FaqSchema';
import {
    ReadingMeasure,
    Chapter,
    KeyInsight,
    KeyTakeaway,
    SourceNote,
    CalmNfaNotice,
    EditionIdentity,
    ContinueLiveIntelligence,
    PublicationPath,
    ed,
    COIN_SECTION_ORDER,
    COIN_SECTION_CHAPTER_LABELS,
    stripMarkdownNoise,
    extractH2,
    isMeaningfulSection,
    formatDisplayDate,
    sameCalendarDay,
    extractDek,
    extractKeyInsightSentence,
    extractTakeawayFromOutlook,
    renderChapterBodyHtml,
    type PublicCoinSnapshot,
    type CoinSectionKey,
    type MarketContextSection,
} from '@/features/market-context/editorial';

export const revalidate = 3600;

interface PublicCoinResponse {
    available: boolean;
    snapshot: PublicCoinSnapshot | null;
}

interface PageProps {
    params: Promise<{ coin: string }>;
}

function normalizeCoinParam(raw: string): string | null {
    const s = raw.trim().toUpperCase();
    if (!s || !/^[A-Z0-9]{2,15}$/.test(s)) return null;
    return s;
}

async function fetchCoinSnapshot(symbol: string): Promise<PublicCoinResponse> {
    try {
        const { data } = await apiClient.get<PublicCoinResponse>(
            `/market/market-context/coins/${encodeURIComponent(symbol)}`
        );
        return data;
    } catch {
        return { available: false, snapshot: null };
    }
}

function parseFaqItems(faqContent: string | undefined): FaqItem[] {
    if (!faqContent) return [];
    const items: FaqItem[] = [];
    const lines = faqContent.split('\n');
    let q: string | null = null;
    let a: string[] = [];

    const push = () => {
        if (q && a.length > 0) {
            items.push({
                question: stripMarkdownNoise(q),
                answer: stripMarkdownNoise(a.join(' ')),
            });
        }
        q = null;
        a = [];
    };

    for (const line of lines) {
        const t = line.trim();
        if (!t || t.startsWith('## ')) continue;
        const qMatch = t.match(/^(?:#{3,4}\s+|Q[:.]?\s*|\*\*Q[:.]?\s*)(.+?)(?:\*\*)?$/i);
        const boldQ = t.match(/^\*\*(.+?)\?\*\*$/);
        if (qMatch || boldQ || (t.endsWith('?') && t.length < 200 && !t.startsWith('-'))) {
            push();
            q = boldQ ? boldQ[1] + '?' : qMatch ? qMatch[1] : t;
            continue;
        }
        if (q) {
            a.push(t.replace(/^(?:A[:.]?\s*|\*\*A[:.]?\s*)/i, ''));
        }
    }
    push();
    return items.filter((i) => i.question && i.answer).slice(0, 12);
}

function countSources(
    sections: Partial<Record<CoinSectionKey, MarketContextSection>>
): number {
    const ids = new Set<number>();
    for (const key of COIN_SECTION_ORDER) {
        const sec = sections[key];
        if (!sec?.sourceNewsIds) continue;
        for (const id of sec.sourceNewsIds) {
            if (typeof id === 'number' && Number.isFinite(id)) ids.add(id);
        }
    }
    return ids.size;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { coin: raw } = await params;
    const symbol = normalizeCoinParam(raw);
    if (!symbol) {
        return { title: 'Not found', robots: { index: false, follow: false } };
    }

    const data = await fetchCoinSnapshot(symbol);
    const snap = data.available ? data.snapshot : null;
    const path = `/blog/${symbol.toLowerCase()}`;
    const canonical = `${SITE_URL}${path}`;

    const title =
        snap?.seoMeta?.metaTitle ||
        `${symbol} price analysis | OnlyAlpha Insights`;
    const description =
        snap?.seoMeta?.metaDescription ||
        `Educational ${symbol} market structure, historical performance, and news context. Not financial advice.`;
    const keywords = snap?.seoMeta?.seoKeywords ?? [
        `${symbol} price analysis`,
        `${symbol} news today`,
        `${symbol} historical performance`,
    ];

    return {
        title: { absolute: title },
        description,
        keywords,
        robots: snap
            ? { index: true, follow: true }
            : { index: false, follow: true },
        openGraph: {
            title,
            description,
            url: canonical,
            type: 'article',
            siteName: 'OnlyAlpha',
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
        },
        alternates: { canonical },
    };
}

function buildArticleJsonLd(
    snapshot: PublicCoinSnapshot,
    symbol: string,
    canonical: string
): Record<string, unknown> {
    const hero = snapshot.sections.heroWhatIs?.content ?? '';
    const description =
        snapshot.seoMeta?.metaDescription ||
        stripMarkdownNoise(hero).slice(0, 300) ||
        `${symbol} educational market context`;
    const datePublished =
        snapshot.publishedAt ?? snapshot.generatedAt ?? new Date().toISOString();
    const dateModified =
        snapshot.updatedAt ?? snapshot.publishedAt ?? snapshot.generatedAt ?? datePublished;

    return {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: sanitizeForJsonLd(
            snapshot.seoMeta?.metaTitle || `${symbol} price analysis`
        ),
        description: sanitizeForJsonLd(description),
        datePublished,
        dateModified,
        author: { '@type': 'Organization', name: 'OnlyAlpha', url: SITE_URL },
        publisher: { '@type': 'Organization', name: 'OnlyAlpha', url: SITE_URL },
        mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
        inLanguage: 'en',
    };
}

function buildBreadcrumbJsonLd(symbol: string, canonical: string): Record<string, unknown> {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
            { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
            { '@type': 'ListItem', position: 3, name: symbol, item: canonical },
        ],
    };
}

function EmptyCoinState({ symbol }: { symbol: string }) {
    return (
        <ReadingMeasure>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(
                        buildBreadcrumbJsonLd(symbol, `${SITE_URL}/blog/${symbol.toLowerCase()}`)
                    ),
                }}
            />
            <PublicationPath
                items={[
                    { label: 'Insights', href: '/blog' },
                    { label: 'Assets', href: '/blog#assets' },
                    { label: symbol },
                ]}
            />
            <p
                className={`${ed.type.wordmark} mb-6`}
                style={{ fontFamily: ed.font.ui }}
            >
                Asset brief
            </p>
            <h1
                className={`${ed.type.h1} mb-5`}
                style={{ fontFamily: ed.font.display }}
            >
                {symbol} is not published yet
            </h1>
            <p className={`${ed.type.dek} mb-8`} style={{ fontFamily: ed.font.body }}>
                An educational {symbol} brief will appear here after editorial publish. Browse other
                Insights pages meanwhile.
            </p>
            <CalmNfaNotice />
            <p className={ed.type.meta} style={{ fontFamily: ed.font.ui }}>
                <Link href="/blog#assets" className={ed.colors.link}>
                    All asset briefs
                </Link>
                <span className="text-[#3a3630] mx-2">·</span>
                <Link href="/blog/market-context" className={ed.colors.link}>
                    Market Context
                </Link>
            </p>
        </ReadingMeasure>
    );
}

export default async function CoinBlogPage({ params }: PageProps) {
    const { coin: raw } = await params;
    const symbol = normalizeCoinParam(raw);
    if (!symbol) notFound();

    // Public URL allows any valid ticker shape; empty pages for non-published
    const data = await fetchCoinSnapshot(symbol);
    const snapshot = data.available ? data.snapshot : null;
    const path = `/blog/${symbol.toLowerCase()}`;
    const canonical = `${SITE_URL}${path}`;

    if (!snapshot) {
        return <EmptyCoinState symbol={symbol} />;
    }

    const sections = snapshot.sections ?? {};
    const faqItems = parseFaqItems(sections.faq?.content);
    const meaningfulKeys = COIN_SECTION_ORDER.filter((key) =>
        isMeaningfulSection(sections[key]?.content)
    );
    const sourceCount = countSources(sections);
    const publishedLabel = formatDisplayDate(snapshot.publishedAt ?? snapshot.generatedAt);
    const updatedLabel = formatDisplayDate(snapshot.updatedAt);
    const showUpdated = Boolean(
        snapshot.updatedAt &&
            !sameCalendarDay(snapshot.updatedAt, snapshot.publishedAt ?? snapshot.generatedAt)
    );
    const dek = extractDek(sections.heroWhatIs?.content);
    const insight = extractKeyInsightSentence(sections.heroWhatIs?.content);
    const takeaway = extractTakeawayFromOutlook(sections.structuralOutlook?.content);
    const related = TRACKED_COINS.filter((c) => c !== symbol).slice(0, 4);

    return (
        <article
            className={ed.measure + ' mx-auto w-full'}
            style={{ fontFamily: ed.font.body }}
        >
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(buildArticleJsonLd(snapshot, symbol, canonical)),
                }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(buildBreadcrumbJsonLd(symbol, canonical)),
                }}
            />
            {faqItems.length > 0 && <FaqSchema items={faqItems} />}

            <PublicationPath
                items={[
                    { label: 'Insights', href: '/blog' },
                    { label: 'Assets', href: '/blog#assets' },
                    { label: symbol },
                ]}
            />

            <EditionIdentity
                editionLabel={`${symbol} brief`}
                publishedLabel={publishedLabel}
                updatedLabel={updatedLabel}
                showUpdated={showUpdated}
                sourceCount={sourceCount}
                confidenceLabel={sourceCount >= 3 ? 'Well supported' : 'Moderate confidence'}
                confidenceBand={sourceCount >= 3 ? 'solid' : 'moderate'}
                confidenceDetail={
                    sourceCount > 0
                        ? `This brief draws on ${sourceCount} verified news item${sourceCount === 1 ? '' : 's'}.`
                        : 'Limited verified news window for this asset.'
                }
            />

            <header className={ed.space.heroBottom}>
                <h1
                    className={`${ed.type.h1} mb-5`}
                    style={{ fontFamily: ed.font.display }}
                >
                    {extractH2(sections.heroWhatIs?.content ?? '') ||
                        `${symbol} price analysis`}
                </h1>
                <p className={ed.type.dek}>{dek}</p>
            </header>

            <CalmNfaNotice />

            {insight && <KeyInsight>{insight}</KeyInsight>}

            {meaningfulKeys.map((key: CoinSectionKey) => {
                const section = sections[key];
                if (!section?.content?.trim()) return null;
                const h2 = extractH2(section.content);
                const title = h2 ?? COIN_SECTION_CHAPTER_LABELS[key];
                return (
                    <Chapter
                        key={key}
                        id={key}
                        label={COIN_SECTION_CHAPTER_LABELS[key]}
                        title={title}
                    >
                        <div
                            dangerouslySetInnerHTML={{
                                __html: renderChapterBodyHtml(section.content),
                            }}
                        />
                    </Chapter>
                );
            })}

            {takeaway && <KeyTakeaway>{takeaway}</KeyTakeaway>}

            <section
                className="mt-14 mb-4 border-t border-[#1c1b19] pt-10"
                aria-labelledby="related-reading"
            >
                <h2
                    id="related-reading"
                    className={`${ed.type.chapterLabel}`}
                    style={{ fontFamily: ed.font.ui }}
                >
                    Related reading
                </h2>
                <ul className="mt-2 divide-y divide-[#1c1b19] border-t border-b border-[#1c1b19]">
                    <li>
                        <Link
                            href="/blog/market-context"
                            className="flex items-baseline justify-between gap-4 py-4 group"
                        >
                            <span
                                className="text-[#d4cfc6] group-hover:text-white transition-colors"
                                style={{ fontFamily: ed.font.display }}
                            >
                                Market Context edition
                            </span>
                            <span className="text-[#5c574f] text-sm" aria-hidden>
                                →
                            </span>
                        </Link>
                    </li>
                    {related.slice(0, 3).map((c) => (
                        <li key={c}>
                            <Link
                                href={`/blog/${c.toLowerCase()}`}
                                className="flex items-baseline justify-between gap-4 py-4 group"
                            >
                                <span
                                    className="text-[#d4cfc6] group-hover:text-white transition-colors"
                                    style={{ fontFamily: ed.font.display }}
                                >
                                    {c} brief
                                </span>
                                <span className="text-[#5c574f] text-sm" aria-hidden>
                                    →
                                </span>
                            </Link>
                        </li>
                    ))}
                    <li>
                        <Link
                            href="/blog#assets"
                            className="flex items-baseline justify-between gap-4 py-4 group"
                        >
                            <span
                                className="text-[#9c968c] group-hover:text-[#ece8e1] transition-colors"
                                style={{ fontFamily: ed.font.ui }}
                            >
                                All asset briefs
                            </span>
                            <span className="text-[#5c574f] text-sm" aria-hidden>
                                →
                            </span>
                        </Link>
                    </li>
                </ul>
            </section>

            {sourceCount > 0 && (
                <SourceNote>
                    This {symbol} brief synthesizes {sourceCount} verified source
                    {sourceCount === 1 ? '' : 's'} from the OnlyAlpha intake pipeline.
                </SourceNote>
            )}

            <ContinueLiveIntelligence />
        </article>
    );
}
