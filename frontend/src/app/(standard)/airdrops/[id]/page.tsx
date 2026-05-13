import type { Metadata } from 'next';
import { airdropApi } from '@/features/airdrop/api';
import { AirdropProject, ProgressResponse } from '@/features/airdrop/types';
import { AirdropDetailClient } from '@/features/airdrop/components/AirdropDetailClient';
import { notFound } from 'next/navigation';
import { SITE_URL } from '@/lib/constants';
import { sanitizeForJsonLd } from '@/lib/json-ld';

export const revalidate = 60;

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { id } = await params;
    const numId = Number(id);

    if (isNaN(numId)) {
        return { title: 'Airdrop Not Found', robots: { index: false, follow: false } };
    }

    let project: AirdropProject | null = null;
    try {
        project = await airdropApi.getProjectById(numId);
    } catch {
        // fall through
    }

    if (!project) {
        return { title: 'Airdrop Not Found', robots: { index: false, follow: false } };
    }

    return {
        title: `${project.name} — Airdrop Details & Tasks`,
        description: `Complete airdrop guide for ${project.name}. View tasks, farming progress, estimated value, and AI risk assessment on ${project.network}.`,
        openGraph: {
            title: `${project.name} — OnlyAlpha`,
            description: `Complete airdrop guide for ${project.name}. Tasks, progress, and AI risk assessment.`,
            url: `${SITE_URL}/airdrops/${id}`,
            type: 'article',
            images: project.logoUrl
                ? [{ url: project.logoUrl, width: 1200, height: 630, alt: `${project.name} logo` }]
                : [{ url: `${SITE_URL}/opengraph-image.png`, width: 1200, height: 630, alt: `${project.name} — OnlyAlpha` }],
        },
        twitter: {
            card: 'summary_large_image',
            title: `${project.name} — OnlyAlpha`,
            description: `Complete airdrop guide for ${project.name}.`,
        },
        alternates: {
            canonical: `${SITE_URL}/airdrops/${id}`,
        },
    };
}

export default async function AirdropDetailsPage({ params }: { params: Params }) {
    const { id } = await params;
    const numId = Number(id);

    if (isNaN(numId)) {
        notFound();
    }

    let project: AirdropProject | null = null;
    let progress: ProgressResponse | null = null;

    try {
        const [projData, progData] = await Promise.all([
            airdropApi.getProjectById(numId),
            airdropApi.getProjectProgress(numId),
        ]);
        project = projData;
        progress = progData;
    } catch (error) {
        console.error('[AirdropDetail] Failed to load on server:', error);
    }

    if (!project) {
        notFound();
    }

    const airdropJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: sanitizeForJsonLd(project.name),
        description: project.aiReport
            ? sanitizeForJsonLd(project.aiReport).substring(0, 160)
            : sanitizeForJsonLd(`${project.name} free airdrop on ${project.network || 'multiple networks'}`),
        image: project.logoUrl ? sanitizeForJsonLd(project.logoUrl) : undefined,
        brand: { '@type': 'Brand', name: sanitizeForJsonLd(project.name) },
        offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
            description: `Free airdrop on ${project.network || 'multiple networks'}`,
        },
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(airdropJsonLd) }}
            />
            <AirdropDetailClient project={project} progress={progress} />
        </>
    );
}
