'use client';

import { Flame, Award, Zap, Clock, Rocket } from 'lucide-react';

interface Achievement {
    id: string;
    label: string;
    icon: React.ReactNode;
    unlocked: boolean;
    description: string;
}

interface Props {
    streakDays: number;
    completedProjects: number;
    totalProjects: number;
}

function resolveAchievements(props: Props): Achievement[] {
    return [
        {
            id: 'early_bird',
            label: 'Early Bird',
            icon: <Rocket className="w-3.5 h-3.5" />,
            unlocked: props.totalProjects > 0,
            description: 'Joined your first farm',
        },
        {
            id: 'completionist',
            label: 'Completionist',
            icon: <Award className="w-3.5 h-3.5" />,
            unlocked: props.completedProjects >= 1,
            description: 'Completed a full project',
        },
        {
            id: 'degen',
            label: 'Degen',
            icon: <Zap className="w-3.5 h-3.5" />,
            unlocked: props.totalProjects >= 5,
            description: 'Active in 5+ projects',
        },
    ];
}

export function FarmingStreak({ streakDays, completedProjects, totalProjects }: Props) {
    const achievements = resolveAchievements({ streakDays, completedProjects, totalProjects });
    const unlockedCount = achievements.filter((a) => a.unlocked).length;
    const hasActivity = streakDays > 0 || completedProjects > 0 || totalProjects > 0;

    return (
        <div className="bg-[#0A0A0A] border border-[#333] p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-mono text-[#888] uppercase tracking-[0.2em]">
                    Farming Streak
                </h3>
                <span className="text-[8px] font-mono text-[#555]">
                    {unlockedCount}/{achievements.length} badges
                </span>
            </div>

            {!hasActivity ? (
                <div className="flex flex-col items-center py-4 gap-2">
                    <Flame className="w-6 h-6 text-[#333]" />
                    <span className="text-[10px] font-mono text-[#555] text-center">
                        Start your first farm to begin your streak
                    </span>
                </div>
            ) : (
                <>
                    <div className="flex items-center gap-3 mb-4">
                        <Flame className={`w-5 h-5 ${streakDays >= 7 ? 'text-orange-400' : streakDays > 0 ? 'text-yellow-400' : 'text-[#555]'}`} />
                        <div>
                            <span className="text-lg font-mono-nums font-bold text-white">
                                {streakDays}
                            </span>
                            <span className="text-[10px] font-mono text-[#888] ml-1">
                                -day farming streak
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                        {achievements.map((a) => (
                            <div
                                key={a.id}
                                className={`flex items-center gap-1.5 px-2 py-1 border text-[9px] font-mono ${
                                    a.unlocked
                                        ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
                                        : 'border-[#222] bg-[#080808] text-[#444]'
                                }`}
                                title={a.description}
                            >
                                {a.icon}
                                <span className="uppercase">{a.label}</span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
