'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArchiveArticle, ArchiveGroup } from '../types';

interface Props {
  articles: ArchiveArticle[];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function groupByYearMonth(articles: ArchiveArticle[]): ArchiveGroup[] {
  const map = new Map<string, ArchiveArticle[]>();

  for (const article of articles) {
    const date = new Date(article.updatedAt || article.createdAt);
    const year = date.getFullYear();
    const month = date.getMonth();
    const key = `${year}-${month}`;

    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(article);
  }

  const groups: ArchiveGroup[] = [];
  for (const [key, arts] of map) {
    const [yearStr, monthStr] = key.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    groups.push({
      year,
      month,
      label: `${MONTH_NAMES[month]} ${year}`,
      articles: arts.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()),
    });
  }

  return groups.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
}

function estimateReadTime(text: string | null): string {
  if (!text) return '3 min read';
  const words = text.split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

function getSentimentColor(sentiment: string | null): string {
  if (!sentiment) return 'text-[#888]';
  const s = sentiment.toLowerCase();
  if (s === 'bullish' || s === 'positive') return 'text-[var(--color-green)]';
  if (s === 'bearish' || s === 'negative') return 'text-[var(--color-red)]';
  return 'text-[#888]';
}

function getConvictionBadge(score: number | null): { label: string; color: string } {
  if (score === null) return { label: 'N/A', color: 'text-[#555] border-[#333]' };
  if (score >= 80) return { label: 'High', color: 'text-[var(--color-green)] border-[var(--color-green)]/30' };
  if (score >= 50) return { label: 'Medium', color: 'text-amber-400 border-amber-400/30' };
  return { label: 'Low', color: 'text-[var(--color-red)] border-[var(--color-red)]/30' };
}

export function ArchivePageClient({ articles }: Props) {
  const [search, setSearch] = useState('');
  const [selectedCoin, setSelectedCoin] = useState<string | null>(null);

  const uniqueCoins = useMemo(() => {
    const coins = new Set(articles.map(a => a.coinSymbol));
    return Array.from(coins).sort();
  }, [articles]);

  const filteredArticles = useMemo(() => {
    let result = articles;

    if (selectedCoin) {
      result = result.filter(a => a.coinSymbol === selectedCoin);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        a.headline.toLowerCase().includes(q) ||
        a.coinSymbol.toLowerCase().includes(q) ||
        (a.metaDescription && a.metaDescription.toLowerCase().includes(q))
      );
    }

    return result;
  }, [articles, search, selectedCoin]);

  const groups = useMemo(() => groupByYearMonth(filteredArticles), [filteredArticles]);

  const totalCount = filteredArticles.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Article Archive</h1>
        <p className="text-[#888] text-sm">{totalCount} article{totalCount !== 1 ? 's' : ''} across {groups.length} month{groups.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#555] text-[20px]">search</span>
          <input
            type="text"
            placeholder="Search articles by title, coin, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#0A0A0A] border border-[#333] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-[#555] focus:border-[var(--color-primary)] focus:outline-none transition-colors"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCoin(null)}
            className={`px-3 py-1 text-[11px] font-mono rounded-md border transition-colors ${
              !selectedCoin
                ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/30 text-[var(--color-primary)]'
                : 'bg-transparent border-[#333] text-[#888] hover:border-[#555] hover:text-white'
            }`}
          >
            All ({articles.length})
          </button>
          {uniqueCoins.map(coin => {
            const count = articles.filter(a => a.coinSymbol === coin).length;
            return (
              <button
                key={coin}
                onClick={() => setSelectedCoin(selectedCoin === coin ? null : coin)}
                className={`px-3 py-1 text-[11px] font-mono rounded-md border transition-colors ${
                  selectedCoin === coin
                    ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/30 text-[var(--color-primary)]'
                    : 'bg-transparent border-[#333] text-[#888] hover:border-[#555] hover:text-white'
                }`}
              >
                {coin} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-12">
          <span className="material-symbols-outlined text-[#333] text-4xl mb-3 block">article</span>
          <p className="text-[#555] text-sm">No articles found matching your criteria.</p>
        </div>
      ) : (
        groups.map(group => (
          <div key={`${group.year}-${group.month}`}>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-[11px] font-mono uppercase tracking-[0.2em] text-[var(--color-primary)]">
                {group.label}
              </h2>
              <span className="text-[10px] font-mono text-[#555]">({group.articles.length})</span>
              <div className="flex-1 h-px bg-[#222]" />
            </div>

            <div className="space-y-2">
              {group.articles.map(article => {
                const conviction = getConvictionBadge(article.convictionScore);
                const date = new Date(article.updatedAt || article.createdAt);
                const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                return (
                  <Link
                    key={article.id}
                    href={`/terminal/${article.coinSymbol.toLowerCase()}/alpha`}
                    className="block p-3 border border-[#222] rounded-lg bg-[#0A0A0A] hover:border-[var(--color-primary)]/30 hover:bg-[#0A0A0A]/80 transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 w-12 h-12 flex items-center justify-center bg-[#111] border border-[#333] rounded-lg">
                        <span className="text-[11px] font-mono font-bold text-[var(--color-primary)]">
                          {article.coinSymbol}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-white group-hover:text-[var(--color-primary)] transition-colors line-clamp-2 mb-1">
                          {article.headline}
                        </h3>
                        {article.metaDescription && (
                          <p className="text-[12px] text-[#666] line-clamp-1 mb-2">
                            {article.metaDescription}
                          </p>
                        )}
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-[10px] font-mono text-[#555]">{dateStr}</span>
                          <span className="text-[10px] font-mono text-[#555]">
                            {estimateReadTime(article.hook)}
                          </span>
                          {article.sentiment && (
                            <span className={`text-[10px] font-mono uppercase ${getSentimentColor(article.sentiment)}`}>
                              {article.sentiment}
                            </span>
                          )}
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${conviction.color}`}>
                            {conviction.label} Conviction
                          </span>
                          {article.posture && (
                            <span className="text-[10px] font-mono text-[#888] bg-[#111] px-1.5 py-0.5 rounded">
                              {article.posture}
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-[#555]">
                            {article.majorUpdateCount + article.minorUpdateCount} updates
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
