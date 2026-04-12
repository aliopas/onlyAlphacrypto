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

    // Pagination state for Wire
    const [wireNews, setWireNews] = useState<CoinNews[]>(initialNews);
    const [wireOffset, setWireOffset] = useState(initialNews.length);
    const [hasMoreWire, setHasMoreWire] = useState(initialNews.length >= 20);
    const [isLoadingMoreWire, setIsLoadingMoreWire] = useState(false);

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

    const handleLoadMoreWire = async () => {
        if (isLoadingMoreWire || !hasMoreWire) return;
        setIsLoadingMoreWire(true);
        try {
            const coinFilter = selectedCoin !== 'SOL' ? selectedCoin : undefined;
            const url = coinFilter ? `/market/wire?coin=${coinFilter}&offset=${wireOffset}&limit=20` : `/market/wire?offset=${wireOffset}&limit=20`;
            const { data } = await apiClient.get<CoinNews[]>(url);
            if (Array.isArray(data)) {
                if (data.length < 20) setHasMoreWire(false);
                if (data.length > 0) {
                    const existingIds = new Set(wireNews.map(n => n.id));
                    const fresh = data.filter((n: CoinNews) => !existingIds.has(n.id));
                    setWireNews(prev => [...prev, ...fresh]);
                    setWireOffset(prev => prev + fresh.length);
                }
            } else {
                setHasMoreWire(false);
            }
        } catch (err) {
            console.error('Failed to load more wire:', err);
        } finally {
            setIsLoadingMoreWire(false);
        }
    };

    const activeArticle = wireNews.find(n => n.id === selectedNewsId);
    const activeRadar = signals.find(r => r.id === selectedRadarId);

    const activeItemCoin = activeTab === 'WIRE' ? activeArticle?.coin : activeRadar?.coin;
    const selectedCoin = coin || activeItemCoin || 'SOL';

    return (
        <div className="flex-1 flex flex-col lg:flex-row gap-4 h-full lg:overflow-hidden pb-0">
            <TerminalMobileNav activeTab={activeMobileTab} onTabChange={setActiveMobileTab} hasStreamContent={!!(selectedNewsId || selectedRadarId)} />

            {/* Left — AI Radar Stream Sidebar */}
            <div className={`flex flex-col h-full min-h-0 flex-1 lg:flex-none ${activeMobileTab === 'wire' ? 'w-full lg:w-[22%] lg:min-w-[280px]' : 'hidden lg:flex lg:w-[22%] lg:min-w-[280px]'}`}>
                <TerminalWire
                    news={wireNews}
                    radarSignals={signals}
                    targetedCoin={selectedCoin}
                    onSelectNews={(id) => { setSelectedNewsId(id); setActiveTab('WIRE'); setActiveMobileTab('stream'); }}
                    onSelectRadar={(id) => { setSelectedRadarId(id); setActiveTab('RADAR'); setActiveMobileTab('stream'); }}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    selectedRadarId={selectedRadarId}
                    selectedNewsId={selectedNewsId}
                    onLoadMore={handleLoadMoreRadar}
                    hasMore={hasMoreRadar}
                    isLoadingMore={isLoadingMoreRadar}
                    hasSignals={hasSignals}
                    onLoadMoreWire={handleLoadMoreWire}
                    hasMoreWire={hasMoreWire}
                    isLoadingMoreWire={isLoadingMoreWire}
                />
            </div>

            {/* Center — Alpha Stream / Analysis */}
            <section className={`flex-1 flex flex-col min-h-0 h-full border border-[#333] bg-[#0A0A0A] overflow-hidden transition-all duration-200 ${activeMobileTab === 'stream' ? 'w-full lg:w-auto' : 'hidden lg:flex'}`}>
                <AlphaStream
                    newsId={activeTab === 'WIRE' ? selectedNewsId : null}
                    radarSignal={activeTab === 'RADAR' ? activeRadar : undefined}
                />
            </section>

            {/* Right — Chat + Price */}
            <div className={`flex flex-col h-full min-h-0 flex-1 lg:flex-none ${activeMobileTab === 'chat' ? 'w-full lg:w-[28%] lg:min-w-[320px]' : 'hidden lg:flex lg:w-[28%] lg:min-w-[320px]'}`}>
                <TerminalChat coin={selectedCoin} articleId={activeTab === 'WIRE' ? selectedNewsId : selectedRadarId} articleType={activeTab} />
            </div>

        </div>
    );
}
