import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { airdropApi } from '@/features/airdrop/api';
import type { AirdropResearchDetail } from '@/features/airdrop/types';
import { ResearchDetailClient } from '@/features/airdrop/components/ResearchDetailClient';
import { SITE_URL } from '@/lib/constants';
import { sanitizeForJsonLd } from '@/lib/json-ld';

export const revalidate = 120;

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
    params,
}: {
    params: Params;
}): Promise<Metadata> {
    const { slug } = await params;
    let detail: AirdropResearchDetail | null = null;
    try {
        detail = await airdropApi.getResearchBySlug(slug);
    } catch {
        // fall through
    }

    if (!detail) {
        return {
            title: 'Research Not Found | OnlyAlpha',
            robots: { index: false, follow: false },
        };
    }

    const isUnderReview = detail.tier === 'under_review';
    const title = `${detail.name} Airdrop — Not Recommended Research | OnlyAlpha`;
    const fromBlurb =
        detail.researchBlurb && detail.researchBlurb.trim().length > 40
            ? detail.researchBlurb.trim()
            : null;
    const description = isUnderReview
        ? `${detail.name} airdrop is under review at OnlyAlpha: insufficient independent evidence for a farming recommendation. Educational research only. Not financial advice.`
        : fromBlurb
          ? fromBlurb
          : `${detail.name} airdrop research: ${detail.verdictLabel.replace(/_/g, ' ')}. Failed OnlyAlpha legitimacy or evidence checks. Educational only — not financial advice.`;

    return {
        title: isUnderReview
            ? `${detail.name} Airdrop — Under Review | OnlyAlpha`
            : title,
        description: description.slice(0, 160),
        openGraph: {
            title: detail.headline,
            description: description.slice(0, 160),
            url: `${SITE_URL}/airdrops/research/${detail.slug}`,
            type: 'article',
            siteName: 'OnlyAlpha',
            images: [
                {
                    url: `${SITE_URL}/opengraph-image.png`,
                    width: 1200,
                    height: 630,
                    alt: detail.headline,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title: detail.headline,
            description: description.slice(0, 160),
        },
        alternates: {
            canonical: `${SITE_URL}/airdrops/research/${detail.slug}`,
        },
        robots: isUnderReview
            ? { index: false, follow: true }
            : { index: true, follow: true },
    };
}

export default async function ResearchDetailPage({
    params,
}: {
    params: Params;
}) {
    const { slug } = await params;
    let detail: AirdropResearchDetail | null = null;
    try {
        detail = await airdropApi.getResearchBySlug(slug);
    } catch (error) {
        console.error('[ResearchDetail] load failed:', error);
    }

    if (!detail) {
        notFound();
    }

    const breadcrumb = {
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
            {
                '@type': 'ListItem',
                position: 4,
                name: sanitizeForJsonLd(detail.name),
                item: `${SITE_URL}/airdrops/research/${detail.slug}`,
            },
        ],
    };

    const webPage = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: sanitizeForJsonLd(detail.headline),
        description: sanitizeForJsonLd(detail.summary.slice(0, 300)),
        url: `${SITE_URL}/airdrops/research/${detail.slug}`,
        dateModified: detail.analyzedAt,
        isPartOf: { '@type': 'WebSite', name: 'OnlyAlpha', url: SITE_URL },
        about: {
            '@type': 'Thing',
            name: sanitizeForJsonLd(`${detail.name} airdrop research`),
        },
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(webPage) }}
            />
            <ResearchDetailClient detail={detail} />
        </>
    );
}
