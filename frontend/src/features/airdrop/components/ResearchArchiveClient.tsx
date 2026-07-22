'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { airdropApi } from '@/features/airdrop/api';
import type { AirdropResearchListItem } from '@/features/airdrop/types';
import { ResearchArchiveCard } from './ResearchArchiveCard';

type TierTab = 'not_recommended' | 'under_review';

function parseTier(raw: string | null, fallback: TierTab): TierTab {
    if (raw === 'under_review' || raw === 'under-review') return 'under_review';
    if (raw === 'not_recommended') return 'not_recommended';
    return fallback;
}

export function ResearchArchiveClient({
    initialItems,
    initialTier,
    initialTotal,
}: {
    initialItems: AirdropResearchListItem[];
    initialTier: TierTab;
    initialTotal: number;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const tier = parseTier(searchParams.get('tier'), initialTier);

    const [items, setItems] = useState(initialItems);
    const [total, setTotal] = useState(initialTotal);
    const [loading, setLoading] = useState(false);
    const [loadedTier, setLoadedTier] = useState<TierTab>(initialTier);

    const load = useCallback(async (t: TierTab) => {
        setLoading(true);
        try {
            const res = await airdropApi.getResearchList({
                tier: t,
                page: 1,
                limit: t === 'under_review' ? 50 : 30,
            });
            if (res) {
                setItems(res.items);
                setTotal(res.total);
            } else {
                setItems([]);
                setTotal(0);
            }
            setLoadedTier(t);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (tier === loadedTier) return;
        void load(tier);
    }, [tier, loadedTier, load]);

    useEffect(() => {
        setItems(initialItems);
        setTotal(initialTotal);
        setLoadedTier(initialTier);
    }, [initialItems, initialTotal, initialTier]);

    const setTier = (t: TierTab) => {
        const q = t === 'under_review' ? '?tier=under_review' : '';
        router.push(`/airdrops/research${q}`);
    };

    return (
        <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
            <div className="mb-8">
                <Link
                    href="/airdrops"
                    className="text-[10px] font-mono text-[#555] hover:text-[#888] uppercase tracking-widest"
                >
                    ← Active Farm Grid
                </Link>
                <h1 className="mt-4 text-2xl md:text-3xl font-bold text-[#eaeaea] tracking-tight">
                    Research Archive
                </h1>
                <p className="mt-2 text-[13px] font-mono text-[#666] leading-relaxed max-w-2xl">
                    Projects we did not recommend for farming. Algorithmic gates evaluate safety
                    patterns, structural legitimacy, and independent evidence — social hype alone
                    never qualifies. Educational research only. Not financial advice.
                </p>
            </div>

            <div className="bg-[#0A0A0A] border border-[#222] p-4 mb-6">
                <h2 className="text-[10px] font-mono text-[#666] uppercase tracking-[0.15em] mb-2">
                    Methodology
                </h2>
                <p className="text-[12px] font-mono text-[#777] leading-relaxed">
                    Gate-1 filters malicious and phishing-like source patterns. Gate-2 checks team,
                    docs, and funding consistency on an evidence pack. Multi-source discovery or a
                    DeFiLlama match is required for recommendation. “Not recommended” means failed
                    our checks or insufficient evidence — not a legal finding that a project is a
                    scam.
                </p>
            </div>

            <div className="flex gap-2 mb-6 border-b border-[#1f1f1f] pb-3">
                <button
                    type="button"
                    onClick={() => setTier('not_recommended')}
                    className={`text-[10px] font-mono uppercase tracking-widest px-3 py-1.5 border transition-colors ${
                        tier === 'not_recommended'
                            ? 'border-rose-500/30 text-rose-300/90 bg-rose-500/5'
                            : 'border-[#2a2a2a] text-[#666] hover:text-[#999]'
                    }`}
                >
                    Not Recommended
                </button>
                <button
                    type="button"
                    onClick={() => setTier('under_review')}
                    className={`text-[10px] font-mono uppercase tracking-widest px-3 py-1.5 border transition-colors ${
                        tier === 'under_review'
                            ? 'border-amber-500/30 text-amber-300/90 bg-amber-500/5'
                            : 'border-[#2a2a2a] text-[#666] hover:text-[#999]'
                    }`}
                >
                    Under Review
                </button>
                <span className="ml-auto text-[10px] font-mono text-[#444] self-center">
                    {total} shown
                </span>
            </div>

            {tier === 'under_review' && (
                <p className="text-[11px] font-mono text-amber-500/70 mb-4 leading-relaxed">
                    Under Review entries are held for more independent evidence. No farming tasks or
                    claim CTAs. These pages are not indexed for search.
                </p>
            )}

            {loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div
                            key={i}
                            className="h-36 bg-[#0A0A0A] border border-[#1a1a1a] animate-pulse"
                        />
                    ))}
                </div>
            )}

            {!loading && items.length === 0 && (
                <div className="border border-[#222] bg-[#0A0A0A] p-10 text-center">
                    <p className="text-[13px] font-mono text-[#666]">
                        No research entries in this tier yet.
                    </p>
                    <Link
                        href="/airdrops"
                        className="inline-block mt-4 text-[10px] font-mono text-slate-400 uppercase tracking-widest border border-[#333] px-4 py-2 hover:bg-[#141414]"
                    >
                        View Active Farm Grid
                    </Link>
                </div>
            )}

            {!loading && items.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {items.map((item) => (
                        <ResearchArchiveCard key={item.id} item={item} />
                    ))}
                </div>
            )}

            <p className="mt-10 text-[10px] font-mono text-[#444] leading-relaxed max-w-2xl">
                Not financial advice. Archive pages never include farm task lists or claim
                instructions. Always verify URLs on official channels before interacting with any
                protocol.
            </p>
        </div>
    );
}
