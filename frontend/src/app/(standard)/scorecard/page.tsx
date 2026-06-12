import ScorecardClient from './ScorecardClient';
import { apiClient } from '@/features/shared/api/client';
import { SITE_URL } from '@/lib/constants';

interface CoinRow {
    id: number;
    symbol: string;
    entryPrice: string;
    currentPrice: string | null;
    priceMovementAtEntry: string | null;
    status: string;
    signalClassification: string | null;
    cexListings: string | null;
    allocatedBudget: string;
    tp1: string | null;
    tp2: string | null;
    tp3: string | null;
    stopLoss: string | null;
    qualityScore: number | null;
    createdAt: string;
    updatedAt: string;
}

interface ScorecardSummary {
    totalBudget: number;
    currentValue: number;
    totalPnl: number;
    totalPnlPercent: number;
    activeCoins: number;
    watchlistCoins: number;
}

interface ScorecardData {
    summary: ScorecardSummary;
    active: CoinRow[];
    watchlist: CoinRow[];
}

function buildBreadcrumbJsonLd(): Record<string, unknown> {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
            { '@type': 'ListItem', position: 2, name: 'Scorecard', item: `${SITE_URL}/scorecard` },
        ],
    };
}

export default async function ScorecardPage() {
    let initialData: ScorecardData | null = null;

    try {
        const { data } = await apiClient.get<ScorecardData>('/scorecard');
        initialData = data;
    } catch {
        initialData = null;
    }

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBreadcrumbJsonLd()) }}
            />
            <ScorecardClient initialData={initialData} />
        </>
    );
}