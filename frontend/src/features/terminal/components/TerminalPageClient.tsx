'use client';

import { useState, useEffect } from 'react';
import { TerminalWire } from '@/features/terminal/components/TerminalWire';
import { TerminalChat } from '@/features/terminal/components/TerminalChat';
import { AlphaStream } from '@/features/terminal/components/AlphaStream';
import { TerminalMobileNav } from '@/features/terminal/components/TerminalMobileNav';
import { CoinNews } from '@/features/terminal/types';
import { RadarSignal } from '@/features/home/types';
import { apiClient } from '@/features/shared/api/client';

interface Props {
    initialNews: CoinNews[];
    coin?: string;
    radarSignals?: RadarSignal[];
    initialRadarId?: number;
    isAlphaFocus?: boolean;
}

export function TerminalPageClient({ initialNews, coin, radarSignals = [], initialRadarId, isAlphaFocus }: Props) {
    const validSignals = radarSignals.filter(r => r.coin);
    const defaultTab = (initialRadarId ?? null) !== null || isAlphaFocus ? 'RADAR' : 'WIRE';
    const latestRadarForCoin = validSignals.find(r => r.coin?.toUpperCase() === coin?.toUpperCase())?.id;
    const defaultRadarId = initialRadarId ?? (isAlphaFocus ? latestRadarForCoin : null);
    const finalDefaultRadarId = defaultRadarId ?? validSignals[0]?.id ?? null;

    const [activeTab, setActiveTab] = useState<'WIRE' | 'RADAR'>(defaultTab);
    const [selectedNewsId, setSelectedNewsId] = useState<number | null>(null);
    const [selectedRadarId, setSelectedRadarId] = useState<number | null>(finalDefaultRadarId);
    const [activeMobileTab, setActiveMobileTab] = useState<'wire' | 'stream' | 'chat'>('wire');
    const hasSignals = validSignals.length > 0;

    useEffect(() => {
        if (selectedRadarId === null && hasSignals && !finalDefaultRadarId) {
            setSelectedRadarId(validSignals[0]?.id ?? null);
        }
    }, [selectedRadarId, hasSignals, finalDefaultRadarId, validSignals]);

    // Pagination state for Radar
    const [signals, setSignals] = useState<RadarSignal[]>(validSignals);
    const [radarOffset, setRadarOffset] = useState(validSignals.length);
    const [hasMoreRadar, setHasMoreRadar] = useState(validSignals.length >= 20);
    const [isLoadingMoreRadar, setIsLoadingMoreRadar] = useState(false);

    const handleLoadMoreRadar = async () => {
        if (isLoadingMoreRadar || !hasMoreRadar) return;
        setIsLoadingMoreRadar(true);
        try {
            const { data } = await apiClient.get<RadarSignal[]>(`/market/radar?offset=${radarOffset}&limit=20`);
            if (Array.isArray(data)) {
                if (data.length < 20) setHasMoreRadar(false);
                if (data.length > 0) {
                    setSignals(prev => [...prev, ...data]);
                    setRadarOffset(prev => prev + data.length);
                }
            } else {
                setHasMoreRadar(false);
            }
        } catch (err) {
            console.error('Failed to load more radar:', err);
        } finally {
            setIsLoadingMoreRadar(false);
        }
    };

    const activeArticle = initialNews.find(n => n.id === selectedNewsId);
    const activeRadar = signals.find(r => r.id === selectedRadarId);

    const activeItemCoin = activeTab === 'WIRE' ? activeArticle?.coin : activeRadar?.coin;
    const selectedCoin = coin || activeItemCoin || 'SOL';

    return (
        <div className="flex-1 flex flex-col xl:flex-row overflow-y-auto xl:overflow-hidden p-4 gap-4 h-full pb-14 xl:pb-0">
            {/* Left — AI Radar Stream Sidebar */}
            <div className={activeMobileTab === 'wire' ? 'flex w-full xl:w-auto' : 'hidden xl:flex'}>
                <TerminalWire
                    news={initialNews}
                    radarSignals={signals}
                    targetedCoin={selectedCoin}
                    onSelectNews={(id) => { setSelectedNewsId(id); setActiveTab('WIRE'); }}
                    onSelectRadar={(id) => { setSelectedRadarId(id); setActiveTab('RADAR'); }}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    selectedRadarId={selectedRadarId}
                    selectedNewsId={selectedNewsId}
                    onLoadMore={handleLoadMoreRadar}
                    hasMore={hasMoreRadar}
                    isLoadingMore={isLoadingMoreRadar}
                    hasSignals={hasSignals}
                />
            </div>

            {/* Center — Alpha Stream / Analysis */}
            <section className={`flex-1 flex flex-col border border-[#333] bg-[#0A0A0A] overflow-y-auto transition-all duration-200 ${activeMobileTab === 'stream' ? 'flex w-full xl:w-auto' : 'hidden xl:flex'}`}>
                <AlphaStream
                    newsId={activeTab === 'WIRE' ? selectedNewsId : null}
                    radarSignal={activeTab === 'RADAR' ? activeRadar : undefined}
                />
            </section>

            {/* Right — Chat + Price */}
            <div className={activeMobileTab === 'chat' ? 'flex w-full xl:w-auto' : 'hidden xl:flex'}>
                <TerminalChat coin={selectedCoin} articleId={activeTab === 'WIRE' ? selectedNewsId : selectedRadarId} articleType={activeTab} />
            </div>

            <TerminalMobileNav activeTab={activeMobileTab} onTabChange={setActiveMobileTab} />
        </div>
    );
}
