import { MarketMood } from '@/features/home/types';

interface Props { mood: MarketMood | null; }

export function MarketMoodGauge({ mood }: Props) {
    const score = mood?.finalScore ?? mood?.score ?? 50;
    const label = mood?.label ?? 'Neutral';

    // Map 0-100 to gauge rotation: -45deg (fear) to +90deg (greed) = 135deg range
    const rotation = -45 + (score / 100) * 135;

    const labelColor =
        score >= 60 ? 'text-emerald-500' :
            score <= 40 ? 'text-red-500' :
                'text-yellow-500';

    return (
        <div className="bg-[#0A0A0A] border border-[#333] p-6 flex flex-col items-center">
            <h3 className="text-[10px] font-mono text-[#888] uppercase tracking-[0.2em] mb-6 w-full text-center">
                Market Mood
            </h3>
            <div className="gauge-container mb-4">
                <div className="gauge-bg" />
                <div className="gauge-fill" style={{ transform: `rotate(${rotation}deg)` }} />
                <div className="absolute bottom-0 left-0 w-full text-center">
                    <span className="text-3xl font-mono-nums font-bold text-white">{score}</span>
                    <div className={`text-[10px] font-mono font-bold uppercase tracking-widest ${labelColor}`}>{label}</div>
                </div>
            </div>
            <div className="flex justify-between w-full text-[10px] font-mono text-[#555] mt-2">
                <span>FEAR</span>
                <span>GREED</span>
            </div>
        </div>
    );
}
