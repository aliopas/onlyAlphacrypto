'use client';

import { useState } from 'react';
import ScorecardTabs from '@/components/scorecard/ScorecardTabs';
import type { ScorecardData, CoinRow, ScorecardSummary } from '@/components/scorecard/ModelPortfolioTab';

interface Props {
    initialData: ScorecardData | null;
}

export default function ScorecardClient({ initialData }: Props) {
    const [data] = useState<ScorecardData | null>(initialData);

    return (
        <div className="min-h-screen bg-black text-white">
            <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
                <div className="mb-8">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Scorecard</h1>
                    <p className="text-sm text-[#666] mt-1">Track Record & Model Portfolio — Educational Simulation</p>
                </div>

                <ScorecardTabs portfolioData={data} />
            </div>
        </div>
    );
}

export type { ScorecardData, CoinRow, ScorecardSummary };
