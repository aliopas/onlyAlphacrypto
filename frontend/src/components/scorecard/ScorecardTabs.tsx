'use client';

import { useState } from 'react';
import TrackRecordTab from './TrackRecordTab';
import ModelPortfolioTab, { type ScorecardData } from './ModelPortfolioTab';

type TabKey = 'trackRecord' | 'modelPortfolio';

interface ScorecardTabsProps {
    portfolioData: ScorecardData | null;
}

interface TabConfig {
    key: TabKey;
    label: string;
    icon: string;
}

const TABS: TabConfig[] = [
    { key: 'trackRecord', label: 'Track Record', icon: 'query_stats' },
    { key: 'modelPortfolio', label: 'Model Portfolio', icon: 'account_balance_wallet' },
];

export default function ScorecardTabs({ portfolioData }: ScorecardTabsProps) {
    const [activeTab, setActiveTab] = useState<TabKey>('trackRecord');

    return (
        <div>
            <div className="border-b border-[#1A1A1A] mb-6">
                <div className="flex gap-1 overflow-x-auto" role="tablist">
                    {TABS.map((tab) => {
                        const isActive = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                role="tab"
                                aria-selected={isActive}
                                onClick={() => setActiveTab(tab.key)}
                                className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                                    isActive
                                        ? 'text-white'
                                        : 'text-[#666] hover:text-[#aaa]'
                                }`}
                            >
                                <span className="material-symbols-outlined text-base">{tab.icon}</span>
                                <span>{tab.label}</span>
                                <span
                                    className={`absolute bottom-0 left-0 right-0 h-0.5 transition-colors ${
                                        isActive ? 'bg-yellow-500' : 'bg-transparent'
                                    }`}
                                />
                            </button>
                        );
                    })}
                </div>
            </div>

            <div>
                {activeTab === 'trackRecord' ? <TrackRecordTab /> : <ModelPortfolioTab data={portfolioData} />}
            </div>
        </div>
    );
}

export type { ScorecardTabsProps, TabKey };
