import axios from 'axios';
import { env } from '../config/env';

const MORALIS_BASE = 'https://deep-index.moralis.io/api/v2.2';
const HEADERS = { 'X-API-Key': env.MORALIS_API_KEY };

// Supported chains
export const SUPPORTED_CHAINS = ['eth', 'zksync', 'linea', 'arbitrum', 'base', 'optimism', 'bsc'];

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WalletTransaction {
    hash: string;
    chain: string;
    fromAddress: string;
    toAddress: string;
    value: string;   // in native token units
    tokenSymbol?: string;
    contractAddress?: string;
    blockTimestamp: string;
    category: string; // 'transfer' | 'swap' | 'nft_transfer' | ...
    summary: string;  // Human-readable from Moralis
}

export interface WalletStats {
    totalTxCount: number;
    activeWallets: number;
    chainsActive: string[];
    firstTxDate: string | null;
}

// ─── Get Transactions ─────────────────────────────────────────────────────────

export async function getWalletTransactions(
    address: string,
    chains: string[] = SUPPORTED_CHAINS,
    limit = 50
): Promise<WalletTransaction[]> {
    const allTxs: WalletTransaction[] = [];

    await Promise.allSettled(
        chains.map(async (chain) => {
            try {
                const { data } = await axios.get(`${MORALIS_BASE}/${address}`, {
                    headers: HEADERS,
                    params: {
                        chain,
                        limit,
                        order: 'DESC',
                        include: 'internal_transactions',
                    },
                    timeout: 10000,
                });

                const txs: WalletTransaction[] = (data.result || []).map((tx: Record<string, unknown>) => ({
                    hash: tx.hash as string,
                    chain,
                    fromAddress: tx.from_address as string,
                    toAddress: tx.to_address as string,
                    value: tx.value as string,
                    contractAddress: tx.to_address as string,
                    blockTimestamp: tx.block_timestamp as string,
                    category: tx.category as string || 'transfer',
                    summary: tx.summary as string || `Transaction on ${chain}`,
                }));

                allTxs.push(...txs);
            } catch {
                // Skip failing chains silently
            }
        })
    );

    return allTxs.sort(
        (a, b) => new Date(b.blockTimestamp).getTime() - new Date(a.blockTimestamp).getTime()
    );
}

// ─── Compute Wallet Stats ────────────────────────────────────────────────────

export function computeWalletStats(txs: WalletTransaction[]): WalletStats {
    const chainsActive = [...new Set(txs.map((t) => t.chain))];
    const dates = txs.map((t) => t.blockTimestamp).sort();

    return {
        totalTxCount: txs.length,
        activeWallets: 1,
        chainsActive,
        firstTxDate: dates.length > 0 ? dates[0] : null,
    };
}

// ─── Check if TX matches task contract ────────────────────────────────────────

export function doesTxMatchTask(
    tx: WalletTransaction,
    task: {
        contractAddress?: string | null;
        chain?: string | null;
        minAmount?: number | null;
        tokenSymbol?: string | null;
    }
): boolean {
    // Must match chain if specified
    if (task.chain && tx.chain !== task.chain) return false;

    // Must interact with the contract address
    if (task.contractAddress) {
        const contractLower = task.contractAddress.toLowerCase();
        if (tx.toAddress?.toLowerCase() !== contractLower && tx.contractAddress?.toLowerCase() !== contractLower) {
            return false;
        }
    }

    // Must meet minimum amount if specified
    if (task.minAmount && task.tokenSymbol === 'ETH') {
        const valueInEth = parseInt(tx.value || '0', 10) / 1e18;
        if (valueInEth < task.minAmount) return false;
    }

    return true;
}
