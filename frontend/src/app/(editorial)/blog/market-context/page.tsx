import type { Metadata } from 'next';
import Link from 'next/link';
import { apiClient } from '@/features/shared/api/client';
import { SITE_URL } from '@/lib/constants';
import { sanitizeForJsonLd } from '@/lib/json-ld';
import { FaqSchema, type FaqItem } from '@/components/seo/FaqSchema';

export const revalidate = 3600;

type SectionKey =
    | 'overview'
    | 'btcCorrelation'
    | 'liquidity'
    | 'newsSensitivity'
    | 'geopolitics'
    | 'thisWeek'
    | 'outlook'
    | 'faq';

interface MarketContextSection {
    content: string;
    updatedAt: string;
    sourceNewsIds: number[];
}

interface PublicSnapshot {
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

interface PublicMarketContextResponse {
    available: boolean;
    snapshot: PublicSnapshot | null;
}

const SECTION_ORDER: SectionKey[] = [
    'overview',
    'btcCorrelation',
    'liquidity',
    'newsSensitivity',
    'geopolitics',
    'thisWeek',
    'outlook',
    'faq',
];

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

function stripMarkdownNoise(text: string): string {
    return text
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .trim();
}

function extractH2(content: string): string | null {
    const match = content.match(/^##\s+(.+)$/m);
    return match ? match[1].trim() : null;
}

function renderMarkdownToSafeHtml(md: string): string {
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
                `<h3 class="text-lg font-semibold text-white mt-4 mb-2">${inlineFormat(trimmed.slice(4))}</h3>`
            );
            continue;
        }
        if (trimmed.startsWith('## ')) {
            flushList();
            htmlParts.push(
                `<h2 class="text-xl md:text-2xl font-bold text-white mt-8 mb-3 tracking-tight">${inlineFormat(trimmed.slice(3))}</h2>`
            );
            continue;
        }
        if (trimmed.startsWith('# ')) {
            flushList();
            htmlParts.push(
                `<h2 class="text-xl md:text-2xl font-bold text-white mt-8 mb-3 tracking-tight">${inlineFormat(trimmed.slice(2))}</h2>`
            );
            continue;
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            if (!inList) {
                htmlParts.push('<ul class="list-disc pl-5 space-y-1 text-gray-300 mb-3">');
                inList = true;
            }
            htmlParts.push(`<li>${inlineFormat(trimmed.slice(2))}</li>`);
            continue;
        }

        flushList();
        htmlParts.push(
            `<p class="text-gray-300 leading-relaxed mb-3">${inlineFormat(trimmed)}</p>`
        );
    }
    flushList();
    return htmlParts.join('\n');
}

function inlineFormat(text: string): string {
    return text
        .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(
            /`([^`]+)`/g,
            '<code class="text-xs bg-[#111] border border-[#333] px-1 rounded">$1</code>'
        );
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

export default async function MarketContextPublicPage() {
    const data = await fetchPublicMarketContext();
    const snapshot = data.available ? data.snapshot : null;
    const faqItems = parseFaqItems(snapshot?.sections.faq?.content);

    if (!snapshot) {
        return (
            <article className="max-w-3xl mx-auto">
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify(buildBreadcrumbJsonLd()),
                    }}
                />
                <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-4">
                    Why is the crypto market moving today?
                </h1>
                <p className="text-gray-400 mb-6 leading-relaxed">
                    Market Context is OnlyAlpha&apos;s educational, market-wide intelligence layer.
                    A published snapshot is not available yet. Check back after the next editorial
                    publish cycle.
                </p>
                <div className="p-4 border border-[#333] rounded bg-[#0A0A0A] text-sm text-gray-400 mb-8">
                    <strong className="text-white">Not Financial Advice (NFA).</strong> Educational
                    frameworks only — no BUY/SELL recommendations or price targets.
                </div>
                <div className="p-5 border border-[#2a2a2a] rounded-lg bg-[#0A0A0A]">
                    <h2 className="text-base font-semibold text-white mb-1">
                        Need live intelligence?
                    </h2>
                    <p className="text-gray-400 text-sm mb-4">
                        Market Context explains structure. Terminal shows what is happening right
                        now — per-coin AI analysis, radar, and live wire.
                    </p>
                    <Link
                        href="/terminal"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded bg-blue-900/40 text-blue-300 border border-blue-800 hover:bg-blue-900/60 text-sm font-medium"
                    >
                        Open Terminal for live intelligence →
                    </Link>
                </div>
            </article>
        );
    }

    return (
        <article className="max-w-3xl mx-auto">
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

            <header className="mb-8">
                <p className="text-xs uppercase tracking-widest text-blue-400 mb-2">
                    Market Context
                    {snapshot.weekLabel ? ` · ${snapshot.weekLabel}` : ''}
                </p>
                <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-3">
                    Why is the crypto market moving today?
                </h1>
                <p className="text-gray-400 text-sm">
                    Educational market-wide context
                    {snapshot.publishedAt
                        ? ` · Updated ${new Date(snapshot.publishedAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                          })}`
                        : ''}
                    {' · '}
                    English only
                </p>
            </header>

            <div className="p-4 border border-yellow-900/40 bg-yellow-900/10 rounded text-sm text-yellow-200/90 mb-6">
                <strong className="text-yellow-100">Not Financial Advice (NFA).</strong> This page
                explains structural frameworks (liquidity, dominance, macro, news sensitivity). It
                does not provide BUY/SELL signals or price targets.
            </div>

            <div className="mb-10 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <span className="text-[#666] text-xs font-mono uppercase tracking-wider">
                    Live tools
                </span>
                <Link
                    href="/terminal"
                    className="text-blue-400/90 hover:text-blue-300 transition-colors text-sm"
                >
                    Open Terminal for live intelligence →
                </Link>
            </div>

            {SECTION_ORDER.map((key) => {
                const section = snapshot.sections[key];
                if (!section?.content?.trim()) return null;
                const h2 = extractH2(section.content);
                return (
                    <section key={key} id={key} className="mb-2">
                        {!h2 && (
                            <h2 className="text-xl md:text-2xl font-bold text-white mt-8 mb-3">
                                {key}
                            </h2>
                        )}
                        <div
                            className="prose-market-context"
                            dangerouslySetInnerHTML={{
                                __html: renderMarkdownToSafeHtml(section.content),
                            }}
                        />
                    </section>
                );
            })}

            <div className="mt-12 p-6 border border-[#2a2a2a] rounded-lg bg-[#0A0A0A]">
                <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#666] mb-2">
                    Next step
                </p>
                <h2 className="text-lg font-semibold text-white mb-2">
                    Open Terminal for live intelligence
                </h2>
                <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                    This edition is educational and market-wide — why structure, liquidity, and
                    macro matter. For real-time per-coin AI analysis, radar signals, and the live
                    wire, open the Intelligence Platform Terminal.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                    <Link
                        href="/terminal"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded bg-blue-900/40 text-blue-300 border border-blue-800 hover:bg-blue-900/60 text-sm font-medium"
                    >
                        Open Terminal for live intelligence →
                    </Link>
                    <Link
                        href="/terminal"
                        className="text-xs font-mono text-[#666] hover:text-[#aaa] transition-colors"
                    >
                        Live wire &amp; radar
                    </Link>
                </div>
                <p className="text-xs text-gray-600 mt-5">
                    Not financial advice.{' '}
                    <Link href="/disclaimer" className="text-gray-400 underline">
                        Disclaimer
                    </Link>
                    {' · '}
                    <Link href="/about" className="text-gray-400 underline">
                        About
                    </Link>
                    .
                </p>
            </div>
        </article>
    );
}
