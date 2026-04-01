import { homeApi } from '@/features/home/api';
import { airdropApi } from '@/features/airdrop/api';
import { AlphaFocusCard } from '@/features/home/components/AlphaFocusCard';
import { RadarGrid } from '@/features/home/components/RadarGrid';
import { MarketMoodGauge } from '@/features/home/components/MarketMoodGauge';
import { TopMovers } from '@/features/home/components/TopMovers';
import { AirdropWatchlist } from '@/features/home/components/AirdropWatchlist';

export const revalidate = 60;

export default async function HomePage() {
  const [mood, alpha, signals, movers, airdrops] = await Promise.all([
    homeApi.getMarketMood(),
    homeApi.getAlphaFocus(),
    homeApi.getRadarSignals(),
    homeApi.getTopMovers(),
    airdropApi.getProjects(),
  ]);

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col lg:flex-row gap-4 h-full">
      {/* Left — 70% */}
      <div className="w-full lg:w-[70%] flex flex-col gap-4">
        <AlphaFocusCard data={alpha} />
        <RadarGrid signals={signals} />
      </div>

      {/* Right — 30% */}
      <div className="w-full lg:w-[30%] flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
        <MarketMoodGauge mood={mood} />
        <TopMovers movers={movers} />
        <AirdropWatchlist projects={airdrops} />
      </div>
    </div>
  );
}
