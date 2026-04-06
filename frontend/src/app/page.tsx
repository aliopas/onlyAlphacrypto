import { homeApi } from '@/features/home/api';
import { AlphaFocusCard } from '@/features/home/components/AlphaFocusCard';
import { RadarGrid } from '@/features/home/components/RadarGrid';
import { MarketMoodGauge } from '@/features/home/components/MarketMoodGauge';
import { TopMovers } from '@/features/home/components/TopMovers';
import { AirdropWatchlist } from '@/features/home/components/AirdropWatchlist';

export const revalidate = 60;

export default async function HomePage() {
  const [alpha, signals] = await Promise.all([
    homeApi.getAlphaFocus(),
    homeApi.getRadarSignals(),
  ]);

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Left — 70% */}
      <div className="w-full lg:w-[70%] flex flex-col gap-4">
        <AlphaFocusCard data={alpha} />
        <RadarGrid signals={signals} />
      </div>

      {/* Right — 30% */}
      <div className="w-full lg:w-[30%] flex flex-col gap-4 lg:self-start">
        <MarketMoodGauge />
        <TopMovers />
        <AirdropWatchlist />
      </div>
    </div>
  );
}
