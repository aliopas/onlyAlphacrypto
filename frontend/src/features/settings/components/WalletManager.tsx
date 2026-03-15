'use client';

import { useState } from 'react';
import { UserWallet } from '../types';
import { settingsApi } from '../api';

interface Props {
    wallets: UserWallet[];
    onUpdate: () => void;
}

export function WalletManager({ wallets, onUpdate }: Props) {
    const [newWallet, setNewWallet] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        const address = newWallet.trim();
        if (!address || isAdding) return;

        try {
            setIsAdding(true);
            await settingsApi.addWallet(address);
            setNewWallet('');
            onUpdate();
        } catch (err) {
            console.error('Failed to add wallet:', err);
            alert('Failed to add wallet. Max 10 allowed.');
        } finally {
            setIsAdding(false);
        }
    };

    const handleRemove = async (id: number) => {
        if (!confirm('Are you sure you want to stop tracking this wallet?')) return;
        try {
            await settingsApi.deleteWallet(id);
            onUpdate();
        } catch (err) {
            console.error('Failed to remove wallet:', err);
        }
    };

    return (
        <div className="bg-black border border-[#333] p-8">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-[11px] font-mono text-[#888] uppercase tracking-[0.2em]">Public Wallet Tracking</h3>
                <span className="text-[10px] font-mono text-[#555] uppercase">
                    Slot {wallets.length.toString().padStart(2, '0')}/10
                </span>
            </div>

            <div className="space-y-3">
                {wallets.map((w) => (
                    <div key={w.id} className="flex gap-4">
                        <div className="flex-1 relative">
                            <input
                                readOnly
                                value={w.address}
                                className="w-full bg-black border border-[#333] text-white font-mono py-4 px-4 focus:outline-none text-sm"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#555] font-mono text-[10px]">VERIFIED</span>
                        </div>
                        <button
                            onClick={() => handleRemove(w.id)}
                            className="border border-[#333] text-[#888] px-4 py-4 font-mono text-[11px] uppercase hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors"
                        >
                            Remove
                        </button>
                    </div>
                ))}

                {wallets.length < 10 && (
                    <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4 mt-3">
                        <input
                            value={newWallet}
                            onChange={(e) => setNewWallet(e.target.value)}
                            placeholder="0x... wallet address"
                            className="flex-1 bg-black border border-[#333] text-white font-mono py-4 px-4 focus:outline-none focus:border-white text-sm placeholder-[#444]"
                        />
                        <button
                            type="submit"
                            disabled={isAdding}
                            className="bg-[var(--color-primary)] text-black px-8 py-4 font-mono text-[11px] font-bold uppercase tracking-widest hover:opacity-80 transition-all shrink-0 disabled:opacity-50"
                        >
                            {isAdding ? 'Adding...' : '[+ Add Wallet]'}
                        </button>
                    </form>
                )}
            </div>

            <p className="mt-4 text-[10px] text-[#444] font-mono uppercase tracking-wider">
                Automated tracking enabled for Ethereum, Solana, and Cosmos networks.
            </p>
        </div>
    );
}
