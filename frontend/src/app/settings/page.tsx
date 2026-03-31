'use client';

import { useEffect, useState, useCallback } from 'react';
import { settingsApi } from '@/features/settings/api';
import { UserProfile } from '@/features/settings/types';
import { WalletManager, PreferencesPanel, ApiKeyManager, PricingCards, OgBadge } from '@/features/settings/components';

export default function SettingsPage() {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    const loadProfile = useCallback(async () => {
        try {
            const p = await settingsApi.getMe();
            setProfile(p);
        } catch (err) {
            console.error('Failed to load profile:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-black">
                <div className="font-mono text-[#555] animate-pulse uppercase tracking-[0.5em]">Initializing Neural Link...</div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col lg:flex-row gap-6 h-full bg-black">
            {/* Left 70% */}
            <div className="w-full lg:w-[70%] flex flex-col gap-6">

                {/* Identity Profile */}
                <div className="bg-black border border-[#333] p-8">
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="text-[10px] font-mono text-[#555] uppercase tracking-[0.2em] mb-4">Identity Profile</div>
                            <h2 className="text-3xl font-mono text-white mb-2 uppercase tracking-tighter">
                                USER ID: {profile ? `OA-${profile.id.toString().padStart(4, '0')}-X` : 'UNKNOWN'}
                            </h2>
                            <p className="text-[#888] font-mono text-sm mb-6 lowercase">{profile?.email || 'N/A'}</p>

                            <OgBadge isOgGenesis={profile?.isOgGenesis ?? false} plan={profile?.plan ?? 'free'} />
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] font-mono text-[#333] uppercase mb-1">Status</div>
                            <div className="text-[11px] font-mono text-emerald-500 uppercase font-bold tracking-widest">Authorized</div>
                        </div>
                    </div>
                </div>

                {/* Wallet Management */}
                <WalletManager
                    wallets={profile?.wallets || []}
                    onUpdate={loadProfile}
                />

                {/* Developer API Keys */}
                <ApiKeyManager plan={profile?.plan || 'free'} />

                {/* Pricing Cards */}
                <PricingCards currentPlan={profile?.plan || 'free'} isOgGenesis={profile?.isOgGenesis ?? false} />
            </div>

            {/* Right 30% */}
            <div className="w-full lg:w-[30%] flex flex-col gap-6">
                {/* Alerts & Notifications */}
                {profile?.preferences && (
                    <PreferencesPanel
                        preferences={profile.preferences}
                        onUpdate={loadProfile}
                    />
                )}

                {/* Active Sessions */}
                <div className="bg-black border border-[#333] p-8 flex-1">
                    <h3 className="text-[11px] font-mono text-[#888] uppercase tracking-[0.2em] mb-6">Active Sessions</h3>
                    <div className="space-y-4">
                        <div className="p-4 border border-[#333] bg-black">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-mono font-bold text-white uppercase">MacOS / Chrome</span>
                                <span className="text-[9px] font-mono text-emerald-500 border border-emerald-500/30 px-1">ACTIVE</span>
                            </div>
                            <p className="text-[10px] font-mono text-[#555] uppercase">Current Session</p>
                            <p className="text-[9px] font-mono text-[#333] uppercase mt-2">{new Date().toLocaleDateString()} — GLOBAL NODE 01</p>
                        </div>
                    </div>
                    <button className="w-full mt-8 py-4 border border-[#333] text-[#888] hover:text-white hover:border-white transition-colors font-mono text-[10px] uppercase tracking-[0.2em]">
                        Terminate All Other Sessions
                    </button>
                    <div className="mt-8 pt-8 border-t border-[#111]">
                        <p className="text-[9px] font-mono text-[#222] uppercase leading-relaxed">
                            Security Protocol: RSA-4096 / SHA-256 <br />
                            Last Audit: {new Date().toLocaleDateString()}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

