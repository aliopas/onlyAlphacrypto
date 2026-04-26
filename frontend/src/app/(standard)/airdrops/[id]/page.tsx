import type { Metadata } from 'next';
import { airdropApi } from '@/features/airdrop/api';
import { AirdropProject, ProgressResponse } from '@/features/airdrop/types';
import { AirdropDetailClient } from '@/features/airdrop/components/AirdropDetailClient';
import { notFound } from 'next/navigation';

export const revalidate = 60;

const SITE_URL = 'https://onlyalphacrypto.com';

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { id } = await params;
    const numId = Number(id);

    if (isNaN(numId)) {
        return { title: 'Airdrop Not Found' };
    }

    let project: AirdropProject | null = null;
    try {
        project = await airdropApi.getProjectById(numId);
    } catch {
        // fall through
    }

    if (!project) {
        return { title: 'Airdrop Not Found' };
    }

    return {
        title: `${project.name} — Airdrop Details & Tasks`,
        description: `Complete airdrop guide for ${project.name}. View tasks, farming progress, estimated value, and AI risk assessment on ${project.network}.`,
        openGraph: {
            title: `${project.name} — OnlyAlpha`,
            description: `Complete airdrop guide for ${project.name}. Tasks, progress, and AI risk assessment.`,
            url: `${SITE_URL}/airdrops/${id}`,
            type: 'article',
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

    return <AirdropDetailClient project={project} progress={progress} />;
}
