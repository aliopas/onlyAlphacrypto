import type { Metadata } from 'next';
import Link from 'next/link';
import { apiClient } from '@/features/shared/api/client';
import { SITE_URL } from '@/lib/constants';
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
    ed,
    SECTION_ORDER,
    SECTION_CHAPTER_LABELS,
    stripMarkdownNoise,
    extractH2,
    isMeaningfulSection,
    countVerifiedSources,
    deriveConfidence,
    formatEditionLabel,
    formatDisplayDate,
    sameCalendarDay,
    extractDek,
    extractKeyInsightSentence,
    extractTakeawayFromOutlook,
    renderChapterBodyHtml,
    type PublicSnapshot,
    type SectionKey,
} from '@/features/market-context/editorial';

export const revalidate = 3600;

interface PublicMarketContextResponse {
    available: boolean;
    snapshot: PublicSnapshot | null;
}

const PAGE_PATH = '/blog/market-context';
const CANONICAL = `${SITE_URL}${PAGE_PATH}`;

const DEFAULT_TITLE =
    'Crypto Market Today: Why Markets Move, Liquidity & Macro Context | OnlyAlpha';
const DEFAULT_DESCRIPTION =
    'Educational Market Context: why the crypto market is moving today, Bitcoin dominance, liquidity, news sensitivity, geopolitics, and structural outlook. English only. Not financial advice.';

async function fetchPublicMarketContext(): Promise<PublicMarketContextResponse> {
    try {
        const { data } = await apiClient.get<PublicMarketContextResponse>(
            '/market/market-context'
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

export async function generateMetadata(): Promise<Metadata> {
    const data = await fetchPublicMarketContext();
    const hasPublished = Boolean(data.available && data.snapshot);

    const week = data.snapshot?.weekLabel;
    const title = week
        ? `Crypto Market Today (${week}): Why Markets Move | OnlyAlpha Market Context`
        : DEFAULT_TITLE;
    const description = DEFAULT_DESCRIPTION;

    return {
        title: { absolute: title },
        description,
        keywords: [
            'crypto market today',
            'why is crypto crashing today',
            'crypto market analysis',
            'bitcoin dominance explained',
            'how liquidity affects crypto prices',
            'crypto market this week',
            'Market Context',
            'OnlyAlpha',
        ],
        robots: hasPublished
            ? { index: true, follow: true }
            : { index: false, follow: true },
        openGraph: {
            title,
            description,
            url: CANONICAL,
            type: 'article',
            siteName: 'OnlyAlpha',
            images: [
                {
                    url: `${SITE_URL}/opengraph-image.png`,
                    width: 1200,
                    height: 630,
                    alt: 'Crypto Market Context — OnlyAlpha',
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [`${SITE_URL}/opengraph-image.png`],
        },
        alternates: {
            canonical: CANONICAL,
        },
    };
}

function buildArticleJsonLd(snapshot: PublicSnapshot): Record<string, unknown> {
    const overview = snapshot.sections.overview?.content ?? '';
    const description = stripMarkdownNoise(overview).slice(0, 300);
    const datePublished = snapshot.publishedAt ?? snapshot.generatedAt ?? new Date().toISOString();
    const dateModified =
        snapshot.updatedAt ?? snapshot.publishedAt ?? snapshot.generatedAt ?? datePublished;

    return {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: sanitizeForJsonLd(
            snapshot.weekLabel
                ? `Crypto market today — Market Context ${snapshot.weekLabel}`
                : 'Crypto market today — Market Context'
        ),
        description: sanitizeForJsonLd(description || DEFAULT_DESCRIPTION),
        datePublished,
        dateModified,
        author: {
            '@type': 'Organization',
            name: 'OnlyAlpha',
            url: SITE_URL,
        },
        publisher: {
            '@type': 'Organization',
            name: 'OnlyAlpha',
            url: SITE_URL,
        },
        mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': CANONICAL,
        },
        inLanguage: 'en',
    };
}

function buildBreadcrumbJsonLd(): Record<string, unknown> {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            {
                '@type': 'ListItem',
                position: 1,
                name: 'Home',
                item: SITE_URL,
            },
            {
                '@type': 'ListItem',
                position: 2,
                name: 'Market Context',
                item: CANONICAL,
            },
        ],
    };
}

function EmptyEditionState() {
    return (
        <ReadingMeasure>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(buildBreadcrumbJsonLd()),
                }}
            />
            <p className={`${ed.type.wordmark} mb-6`}>Market Context</p>
            <h1 className={`${ed.type.h1} mb-4`}>The next edition is in progress</h1>
            <p className={`${ed.type.dek} mb-8`}>
                Market Context publishes educational market-wide editions on a regular cycle. No
                edition is live for readers yet — check back after the next editorial publish.
            </p>
            <CalmNfaNotice />
            <p className={`${ed.type.bodySm} mb-8`}>
                When an edition is published, you will find structural context on liquidity,
                Bitcoin correlation, macro, and the week&apos;s narrative — written for understanding,
                not for trading signals.
            </p>
            <p className={ed.type.meta}>
                <Link href="/" className={ed.colors.link}>
                    Return to OnlyAlpha
                </Link>
                <span className="text-[#333] mx-2" aria-hidden>
                    ·
                </span>
                <Link href="/terminal" className={ed.type.exitLink}>
                    Exit to Terminal
                </Link>
            </p>
        </ReadingMeasure>
    );
}

export default async function MarketContextPublicPage() {
    const data = await fetchPublicMarketContext();
    const snapshot = data.available ? data.snapshot : null;
    const faqItems = parseFaqItems(snapshot?.sections.faq?.content);

    if (!snapshot) {
        return <EmptyEditionState />;
    }

    const meaningfulKeys = SECTION_ORDER.filter((key) =>
        isMeaningfulSection(snapshot.sections[key]?.content)
    );
    const sourceCount = countVerifiedSources(snapshot.sections);
    const confidence = deriveConfidence(sourceCount, meaningfulKeys.length);
    const editionLabel = formatEditionLabel(snapshot);
    const publishedLabel = formatDisplayDate(snapshot.publishedAt ?? snapshot.generatedAt);
    const updatedLabel = formatDisplayDate(snapshot.updatedAt);
    const showUpdated = Boolean(
        snapshot.updatedAt &&
            !sameCalendarDay(snapshot.updatedAt, snapshot.publishedAt ?? snapshot.generatedAt)
    );
    const dek = extractDek(snapshot.sections.overview?.content);
    const insight = extractKeyInsightSentence(snapshot.sections.overview?.content);
    const takeaway = extractTakeawayFromOutlook(snapshot.sections.outlook?.content);

    return (
        <article className={ed.measure + ' mx-auto w-full'}>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(buildArticleJsonLd(snapshot)),
                }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(buildBreadcrumbJsonLd()),
                }}
            />
            {faqItems.length > 0 && <FaqSchema items={faqItems} />}

            {/* MC-ED-11 Edition Identity */}
            <EditionIdentity
                editionLabel={editionLabel}
                publishedLabel={publishedLabel}
                updatedLabel={updatedLabel}
                showUpdated={showUpdated}
                sourceCount={sourceCount}
                confidenceLabel={confidence.label}
                confidenceBand={confidence.band}
                confidenceDetail={confidence.detail}
            />

            {/* MC-ED-2 Edition hero */}
            <header className={ed.space.heroBottom}>
                <h1 className={`${ed.type.h1} mb-4`}>
                    Why is the crypto market moving today?
                </h1>
                <p className={ed.type.dek}>{dek}</p>
            </header>

            <CalmNfaNotice />

            {/* MC-ED-5 sparse modules before chapters */}
            {insight && <KeyInsight>{insight}</KeyInsight>}

            {/* MC-ED-4 Chapters — ER-1 omit empty */}
            {meaningfulKeys.map((key: SectionKey) => {
                const section = snapshot.sections[key];
                if (!section?.content?.trim()) return null;
                const h2 = extractH2(section.content);
                const title = h2 ?? SECTION_CHAPTER_LABELS[key];
                const thinChapter =
                    confidence.band === 'limited' &&
                    (section.sourceNewsIds?.length ?? 0) === 0 &&
                    key !== 'overview';

                return (
                    <Chapter
                        key={key}
                        id={key}
                        label={SECTION_CHAPTER_LABELS[key]}
                        title={title}
                    >
                        {thinChapter && (
                            <p className={`${ed.type.bodySm} mb-4 italic text-[#8a8680]`}>
                                Evidence for this chapter is limited in the current verified window.
                            </p>
                        )}
                        <div
                            dangerouslySetInnerHTML={{
                                __html: renderChapterBodyHtml(section.content),
                            }}
                        />
                    </Chapter>
                );
            })}

            {takeaway && <KeyTakeaway>{takeaway}</KeyTakeaway>}

            {sourceCount > 0 && (
                <SourceNote>
                    This edition synthesizes {sourceCount} verified source
                    {sourceCount === 1 ? '' : 's'} from the OnlyAlpha intake pipeline (trusted news
                    only). Operational tooling lives in Terminal — this page is educational context.
                </SourceNote>
            )}

            {/* MC-ED-6 — only after body */}
            <ContinueLiveIntelligence />
        </article>
    );
}
