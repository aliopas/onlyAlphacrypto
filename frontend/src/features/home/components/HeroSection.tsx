import { MarketMood } from '../types';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export function HeroSection({ mood }: { mood: MarketMood | null }) {
    if (!mood) return null;

    const isGreed = (mood.finalScore || 0) > 55;
    const isFear = (mood.finalScore || 0) < 45;

    const getGradient = () => {
        if (isGreed) return 'from-green-500/20 via-green-500/5 to-transparent border-green-500/30';
        if (isFear) return 'from-red-500/20 via-red-500/5 to-transparent border-red-500/30';
        return 'from-blue-500/20 via-blue-500/5 to-transparent border-blue-500/30';
    };

    const Icon = isGreed ? TrendingUp : isFear ? TrendingDown : Minus;
    const colorClass = isGreed ? 'text-green-500' : isFear ? 'text-red-500' : 'text-blue-500';

    return (
        <div className={cn("glass-card rounded-2xl p-8 mb-6 relative overflow-hidden bg-gradient-to-br", getGradient())}>
            <div className="absolute top-0 right-0 p-8 opacity-10">
                <Activity className="w-48 h-48" />
            </div>

            <div className="relative z-10">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2 text-glow">
                    Market Intelligence
                </h1>
                <p className="text-muted-foreground mb-8 max-w-xl">
                    Real-time AI analysis of the crypto market. Make data-driven decisions with institutional-grade insights.
                </p>

                <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                    <div>
                        <p className="text-sm text-muted-foreground uppercase tracking-widest font-semibold mb-1">
                            AI Market Mood
                        </p>
                        <div className="flex items-baseline gap-3">
                            <span className={cn("text-5xl font-black tracking-tighter", colorClass)}>
                                {Math.round(mood.finalScore || 0)}
                            </span>
                            <span className="text-xl font-medium text-foreground">/ 100</span>
                        </div>
                    </div>

                    <div className="hidden sm:block h-12 w-px bg-white/10" />

                    <div className="flex items-center gap-4">
                        <div className={cn("p-4 rounded-xl bg-white/5 backdrop-blur-md border border-white/5", colorClass)}>
                            <Icon className="w-8 h-8" />
                        </div>
                        <div>
                            <p className="font-bold text-lg">{mood.label}</p>
                            <p className="text-sm text-muted-foreground">
                                ExtScore: {Math.round(mood.externalScore || 0)} | IntScore: {Math.round(mood.internalScore || 0)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
