'use client';

import { useState } from 'react';
import { TerminalWire } from '@/features/terminal/components/TerminalWire';
import { TerminalChat } from '@/features/terminal/components/TerminalChat';
import { AlphaStream } from '@/features/terminal/components/AlphaStream';
import { CoinNews } from '@/features/terminal/types';
import { RadarSignal } from '@/features/home/types';

interface Props {
    initialNews: CoinNews[];
    coin?: string;
    radarSignals?: RadarSignal[];
    initialRadarId?: number;
    isAlphaFocus?: boolean;
}

export function TerminalPageClient({ initialNews, coin, radarSignals = [], initialRadarId, isAlphaFocus }: Props) {
    const defaultTab = initialRadarId || isAlphaFocus ? 'RADAR' : 'WIRE';
    const latestRadarForCoin = radarSignals.find(r => r.coin.toUpperCase() === coin?.toUpperCase())?.id;
    const defaultRadarId = initialRadarId || (isAlphaFocus ? latestRadarForCoin : null);

    const [activeTab, setActiveTab] = useState<'WIRE' | 'RADAR'>(defaultTab);
    const [selectedNewsId, setSelectedNewsId] = useState<number | null>(null);
    const [selectedRadarId, setSelectedRadarId] = useState<number | null>(defaultRadarId || null);

    const activeArticle = initialNews.find(n => n.id === selectedNewsId);
    const activeRadar = radarSignals.find(r => r.id === selectedRadarId);

    const activeItemCoin = activeTab === 'WIRE' ? activeArticle?.coin : activeRadar?.coin;
    const selectedCoin = coin || activeItemCoin || 'SOL';

    return (
        <div className="flex-1 flex flex-col xl:flex-row overflow-y-auto xl:overflow-hidden p-4 gap-4 h-full">
            {/* Left — Latest Wire & AI Radar */}
            <TerminalWire
                news={initialNews}
                radarSignals={radarSignals}
                targetedCoin={selectedCoin}
                onSelectNews={(id) => { setSelectedNewsId(id); setActiveTab('WIRE'); }}
                onSelectRadar={(id) => { setSelectedRadarId(id); setActiveTab('RADAR'); }}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                selectedRadarId={selectedRadarId}
                selectedNewsId={selectedNewsId}
            />

            {/* Center — Alpha Stream / Analysis */}
            <section className="flex-1 flex flex-col border border-[#333] bg-[#0A0A0A] overflow-y-auto">
                <AlphaStream
                    newsId={activeTab === 'WIRE' ? selectedNewsId : null}
                    radarSignal={activeTab === 'RADAR' ? activeRadar : undefined}
                />
            </section>

            {/* Right — Chat + Price */}
            <TerminalChat coin={selectedCoin} />
        </div>
    );
}
