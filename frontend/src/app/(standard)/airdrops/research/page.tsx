import type { Metadata } from 'next';
import { Suspense } from 'react';
import { airdropApi } from '@/features/airdrop/api';
import type { AirdropResearchListItem } from '@/features/airdrop/types';
import { ResearchArchiveClient } from '@/features/airdrop/components/ResearchArchiveClient';
import { SITE_URL } from '@/lib/constants';
import { FaqSchema, FaqItem } from '@/components/seo/FaqSchema';
import { sanitizeForJsonLd } from '@/lib/json-ld';

export const revalidate = 120;

type SearchParams = Promise<{ tier?: string }>;

export async function generateMetadata({
    searchParams,
}: {
    searchParams: SearchParams;
}): Promise<Metadata> {
    const sp = await searchParams;
    const underReview =
        sp.tier === 'under_review' || sp.tier === 'under-review';

    return {
        title: underReview
            ? 'Airdrop Research — Under Review | OnlyAlpha'
            : 'Airdrop Research Archive — Projects We Did Not Recommend | OnlyAlpha',
        description:
            'Educational research on crypto airdrop candidates that failed OnlyAlpha legitimacy or evidence checks. Not financial advice. Methodology and filter transparency.',
        keywords: [
            'airdrop research',
            'airdrop legit check',
            'crypto airdrop review',
            'airdrop red flags',
            'OnlyAlpha research archive',
        ],
        openGraph: {
            title: 'Airdrop Research Archive — OnlyAlpha',
            description:
                'Projects we did not recommend. Algorithmic legitimacy gates, evidence strength, and NFA research.',
            url: `${SITE_URL}/airdrops/research`,
            siteName: 'OnlyAlpha',
            type: 'website',
            images: [
                {
                    url: `${SITE_URL}/opengraph-image.png`,
                    width: 1200,
                    height: 630,
                    alt: 'Airdrop Research Archive — OnlyAlpha',
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: 'Airdrop Research Archive — OnlyAlpha',
            description:
                'Projects we did not recommend. Algorithmic gates and evidence-based research. NFA.',
        },
        alternates: {
            canonical: `${SITE_URL}/airdrops/research`,
        },
        robots: underReview
            ? { index: false, follow: true }
            : { index: true, follow: true },
    };
}

const RESEARCH_FAQ: FaqItem[] = [
    {
        question: 'Why are projects rejected or not recommended?',
        answer:
            'OnlyAlpha uses algorithmic gates: safety filters for malicious patterns, structural legitimacy checks (team, docs, funding consistency), and an independent-evidence bar. Projects that fail these checks or lack enough proof are not recommended for farming.',
    },
    {
        question: 'Does “Not Recommended” mean the project is a scam?',
        answer:
            'No, not necessarily. Not Recommended means the project failed our algorithmic checks or had insufficient independent evidence. High Risk is used when signals are consistent with malicious patterns. This is educational research, not a legal finding.',
    },
    {
        question: 'What is Under Review?',
        answer:
            'Under Review means the candidate looked plausible but did not yet meet the evidence bar. The pipeline may re-evaluate automatically when new signals arrive. These pages are noindex and never include farm tasks.',
    },
    {
        question: 'Is this financial advice?',
        answer:
            'No. The Research Archive is for education and transparency only. OnlyAlpha does not provide investment advice. Always verify claims on official channels.',
    },
];

function buildBreadcrumbJsonLd(): Record<string, unknown> {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
            {
                '@type': 'ListItem',
                position: 2,
                name: 'Airdrops',
                item: `${SITE_URL}/airdrops`,
            },
            {
                '@type': 'ListItem',
                position: 3,
                name: 'Research Archive',
                item: `${SITE_URL}/airdrops/research`,
            },
        ],
    };
}

export default async function ResearchArchivePage({
    searchParams,
}: {
    searchParams: SearchParams;
}) {
    const sp = await searchParams;
    const tier: 'not_recommended' | 'under_review' =
        sp.tier === 'under_review' || sp.tier === 'under-review'
            ? 'under_review'
            : 'not_recommended';

    let items: AirdropResearchListItem[] = [];
    let total = 0;
    try {
        const res = await airdropApi.getResearchList({
            tier,
            page: 1,
            limit: tier === 'under_review' ? 50 : 30,
        });
        if (res) {
            items = res.items;
            total = res.total;
        }
    } catch (error) {
        console.error('[ResearchArchive] Failed to load:', error);
    }

    const webPageJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Airdrop Research Archive',
        description:
            'Educational research on airdrop candidates OnlyAlpha did not recommend.',
        url: `${SITE_URL}/airdrops/research`,
        isPartOf: { '@type': 'WebSite', name: 'OnlyAlpha', url: SITE_URL },
        about: {
            '@type': 'Thing',
            name: 'Crypto airdrop legitimacy research',
        },
    };

    const itemListJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Not Recommended Airdrop Research',
        url: `${SITE_URL}/airdrops/research`,
        numberOfItems: items.length,
        itemListElement: items.slice(0, 30).map((item, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `${SITE_URL}/airdrops/research/${item.slug}`,
            name: sanitizeForJsonLd(item.name),
        })),
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(buildBreadcrumbJsonLd()),
                }}
            />
            {tier === 'not_recommended' && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify(itemListJsonLd),
                    }}
                />
            )}
            <FaqSchema items={RESEARCH_FAQ} />
            <Suspense
                fallback={
                    <div className="max-w-5xl mx-auto px-4 py-12 text-[12px] font-mono text-[#555]">
                        Loading research archive…
                    </div>
                }
            >
                <ResearchArchiveClient
                    initialItems={items}
                    initialTier={tier}
                    initialTotal={total}
                />
            </Suspense>
        </>
    );
}
