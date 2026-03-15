'use client';

import { useState, useEffect } from 'react';
import { ApiKey } from '../types';
import { settingsApi } from '../api';

interface Props {
    plan: string;
}

export function ApiKeyManager({ plan }: Props) {
    const [keys, setKeys] = useState<ApiKey[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [newKeySnippet, setNewKeySnippet] = useState<string | null>(null);

    const loadKeys = async () => {
        const data = await settingsApi.listApiKeys();
        setKeys(data);
    };

    useEffect(() => {
        loadKeys();
    }, []);

    const handleCreate = async () => {
        if (isGenerating) return;
        try {
            setIsGenerating(true);
            const key = await settingsApi.createApiKey('Default Key');
            if (key.key) {
                setNewKeySnippet(key.key);
            }
            loadKeys();
        } catch (err) {
            console.error('Failed to create API key:', err);
            alert('Requires PRO or INSTITUTIONAL plan.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleRevoke = async (id: number) => {
        if (!confirm('Are you sure you want to revoke this API key? Applications using it will stop working.')) return;
        try {
            await settingsApi.revokeApiKey(id);
            loadKeys();
        } catch (err) {
            console.error('Failed to revoke API key:', err);
        }
    };

    const isPro = plan === 'pro' || plan === 'institutional';

    return (
        <div className="bg-black border border-[#333] p-8">
            <h3 className="text-[11px] font-mono text-[#888] uppercase tracking-[0.2em] mb-6">Developer API</h3>

            {newKeySnippet && (
                <div className="mb-6 p-4 border border-emerald-500/30 bg-emerald-500/5">
                    <p className="text-[10px] font-mono text-emerald-500 uppercase mb-2 font-bold italic">New API Key Created — Save it now, it won't be shown again:</p>
                    <code className="text-white font-mono text-xs break-all truncate block bg-black p-2 border border-[#222]">{newKeySnippet}</code>
                    <button onClick={() => setNewKeySnippet(null)} className="mt-2 text-[9px] text-emerald-500 underline font-mono uppercase">I have saved it</button>
                </div>
            )}

            <div className="space-y-4">
                {keys.map(k => (
                    <div key={k.id} className="flex items-center justify-between gap-6 p-4 border border-[#222] bg-[#050505]">
                        <div className="flex-1 overflow-hidden">
                            <p className="text-[10px] text-[#888] font-mono uppercase truncate mb-1">{k.name} (ID: {k.id})</p>
                            <div className="flex gap-4 text-[9px] text-[#555] font-mono uppercase">
                                <span>Limit: {k.rateLimit} req/hr</span>
                                <span>Used: {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}</span>
                            </div>
                        </div>
                        <button onClick={() => handleRevoke(k.id)} className="text-[10px] font-mono text-red-500 hover:underline uppercase">Revoke</button>
                    </div>
                ))}
            </div>

            <div className="mt-6 flex items-center justify-between gap-6">
                {!isPro ? (
                    <div className="flex-1 p-4 border border-[#333] bg-[#111]/50 text-center">
                        <p className="text-[10px] font-mono text-[#555] uppercase tracking-wide">Developer API access requires PRO plan or higher</p>
                    </div>
                ) : (
                    <>
                        <div className="flex-1 opacity-50">
                            <div className="bg-black border border-[#333] p-4 font-mono text-sm overflow-hidden whitespace-nowrap relative">
                                <span className="blur-[6px] select-none text-[#555]">oa_live_sk_XXXXXXXXXXXXXXXXXXXXXXXXX</span>
                            </div>
                        </div>
                        <button
                            onClick={handleCreate}
                            disabled={isGenerating}
                            className="border border-[#333] text-white px-8 py-4 font-mono text-[11px] uppercase tracking-widest hover:bg-white hover:text-black transition-colors shrink-0 disabled:opacity-50"
                        >
                            {isGenerating ? 'Generating...' : 'Generate New Key'}
                        </button>
                    </>
                )}
            </div>

            <div className="mt-6 flex gap-12">
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-[#555] font-mono uppercase">Status</span>
                    <span className={`text-[11px] font-mono font-bold uppercase ${isPro ? 'text-emerald-500' : 'text-[#333]'}`}>
                        {isPro ? 'Connected' : 'Restricted'}
                    </span>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-[#555] font-mono uppercase">Account Quota</span>
                    <span className="text-[11px] text-white font-mono uppercase font-bold">
                        {plan === 'institutional' ? '5,000' : plan === 'pro' ? '500' : '60'} req / hr
                    </span>
                </div>
            </div>
        </div>
    );
}
