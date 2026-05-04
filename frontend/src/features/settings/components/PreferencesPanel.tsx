'use client';

import { UserPreferences } from '../types';
import { settingsApi } from '../api';

interface Props {
    preferences: UserPreferences;
    onUpdate: () => void;
}

export function PreferencesPanel({ preferences, onUpdate }: Props) {

    const toggle = async (key: keyof UserPreferences) => {
        const currentVal = preferences[key];
        if (typeof currentVal !== 'boolean') return;

        try {
            await settingsApi.updatePreferences({ [key]: !currentVal });
            onUpdate();
        } catch (err) {
            console.error('Failed to update preference:', err);
        }
    };

    const options = [
        { key: 'airdropDeadlineAlerts' as const, label: 'Airdrop Alerts', sub: 'Real-time snapshot detection' },
        { key: 'breakingNewsAlerts' as const, label: 'AI Scenarios', sub: 'Sentiment & Volume spikes' },
        { key: 'alphaFocusAlerts' as const, label: 'Alpha Focus', sub: 'Daily top-ranked pick alerts' },
        { key: 'emailAlerts' as const, label: 'Newsletter', sub: 'Weekly ecosystem alpha' },
    ];

    return (
        <div className="bg-black border border-[#333] p-8">
            <h3 className="text-[11px] font-mono text-[#888] uppercase tracking-[0.2em] mb-8">Alerts & Notifications</h3>
            <div className="space-y-8">
                {options.map(({ key, label, sub }) => (
                    <div key={key} className="flex items-center justify-between">
                        <div>
                            <p className="text-[12px] font-mono font-bold text-white uppercase">{label}</p>
                            <p className="text-[10px] font-mono text-[#555] uppercase mt-1">{sub}</p>
                        </div>
                        <button
                            onClick={() => toggle(key)}
                            className={`relative inline-block w-8 h-4 border transition-colors ${preferences[key] ? 'bg-white border-white' : 'bg-[#111] border-[#333]'}`}
                        >
                            <span className={`absolute top-0 w-4 h-4 bg-black border border-[#333] transition-all ${preferences[key] ? 'left-4' : 'left-0'}`} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
