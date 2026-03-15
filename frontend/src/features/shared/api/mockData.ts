import { AirdropProject, ProgressResponse } from '@/features/airdrop/types';
import { MarketMood, AlphaFocus, RadarSignal } from '@/features/home/types';
import { CoinNews, AnalysisStream } from '@/features/terminal/types';

// ─── AIRDROP MOCK DATA ──────────────────────────────────────────────────────

export const MOCK_AIRDROPS: AirdropProject[] = [
    {
        id: 1,
        name: 'LayerZero',
        network: 'LayerZero',
        estValue: '$1,200',
        tgeAt: new Date(Date.now() + 86400000 * 30).toISOString(),
        snapshotAt: new Date(Date.now() + 86400000 * 5).toISOString(),
        riskVerdict: 'SAFE',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tasks: [
            { id: 101, projectId: 1, description: 'Bridge to Aptos via LiquidSwap', isAutoVerifiable: true, orderIndex: 1 },
            { id: 102, projectId: 1, description: 'Stake Stargate Finance token (STG)', isAutoVerifiable: true, orderIndex: 2 },
            { id: 103, projectId: 1, description: 'Join LayerZero official Discord', isAutoVerifiable: false, orderIndex: 3 },
        ],
    },
    {
        id: 2,
        name: 'ZkSync Era',
        network: 'Ethereum L2',
        estValue: '$2,500',
        tgeAt: new Date(Date.now() + 86400000 * 60).toISOString(),
        snapshotAt: undefined,
        riskVerdict: 'SAFE',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tasks: [
            { id: 201, projectId: 2, description: 'Bridge ETH on the official zkSync bridge', isAutoVerifiable: true, orderIndex: 1 },
            { id: 202, projectId: 2, description: 'Perform 10+ swaps on SyncSwap', isAutoVerifiable: true, orderIndex: 2 },
            { id: 203, projectId: 2, description: 'Mint an NFT on the zkSync network', isAutoVerifiable: true, orderIndex: 3 },
        ],
    },
    {
        id: 3,
        name: 'Berachain',
        network: 'Berachain Testnet',
        estValue: 'TBD',
        tgeAt: undefined,
        snapshotAt: undefined,
        riskVerdict: 'MEDIUM_RISK',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tasks: [
            { id: 301, projectId: 3, description: 'Claim BERA tokens from the official faucet', isAutoVerifiable: true, orderIndex: 1 },
            { id: 302, projectId: 3, description: 'Provide liquidity on BEX', isAutoVerifiable: true, orderIndex: 2 },
        ],
    },
    {
        id: 4,
        name: 'Blast L2',
        network: 'Ethereum L2',
        estValue: '$800',
        tgeAt: new Date(Date.now() + 86400000 * 15).toISOString(),
        snapshotAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        riskVerdict: 'HIGH_RISK',
        isActive: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tasks: [
            { id: 401, projectId: 4, description: 'Deposit ETH to Blast L2 via official bridge', isAutoVerifiable: true, orderIndex: 1 },
        ],
    }
];

export const MOCK_AIRDROP_PROGRESS: Record<number, ProgressResponse> = {
    1: {
        projectId: 1, totalTasks: 3, completedTasks: 1, progressPercentage: 33,
        userProgress: [
            { id: 1, userId: 1, projectId: 1, taskId: 101, status: 'VERIFIED', verifiedAt: new Date().toISOString() }
        ]
    },
    2: {
        projectId: 2, totalTasks: 3, completedTasks: 2, progressPercentage: 66,
        userProgress: [
            { id: 2, userId: 1, projectId: 2, taskId: 201, status: 'VERIFIED', verifiedAt: new Date().toISOString() },
            { id: 3, userId: 1, projectId: 2, taskId: 202, status: 'VERIFIED', verifiedAt: new Date().toISOString() }
        ]
    },
    3: { projectId: 3, totalTasks: 2, completedTasks: 0, progressPercentage: 0, userProgress: [] },
    4: {
        projectId: 4, totalTasks: 1, completedTasks: 1, progressPercentage: 100,
        userProgress: [
            { id: 4, userId: 1, projectId: 4, taskId: 401, status: 'VERIFIED', verifiedAt: new Date().toISOString() }
        ]
    }
};

// ─── HOME MOCK DATA ──────────────────────────────────────────────────────────

export const MOCK_MARKET_MOOD: MarketMood = {
    score: 72,
    label: 'GREED',
    externalScore: 68,
    internalScore: 76,
    finalScore: 72,
};

export const MOCK_ALPHA_FOCUS: AlphaFocus = {
    coinSymbol: 'SOL',
    coinName: 'Solana',
    verdict: 'STRONG_BUY',
    confidenceScore: 87,
    compositeScore: 91,
    executiveSummary: 'Solana showing 4,000+ TPS. Institutional accumulation at $140-$148. Breakout above $155 targets $175.',
    // mapped UI fields
    coin: 'SOL',
    confidence: 87,
    summary: 'Solana showing 4,000+ TPS. Institutional accumulation at $140-$148. Breakout above $155 targets $175.',
    price: 145.20,
    priceChange24h: 4.21,
};

export const MOCK_RADAR_SIGNALS: RadarSignal[] = [
    { id: 1, coin: 'ETH', signal: 'Ethereum spot ETF sees $320M inflow in single session', sentiment: 'BULLISH', impactScore: 92, createdAt: new Date(Date.now() - 120000).toISOString() },
    { id: 2, coin: 'BTC', signal: 'Bitcoin miner capitulation ending — hash rate recovering to ATH', sentiment: 'BULLISH', impactScore: 85, createdAt: new Date(Date.now() - 900000).toISOString() },
    { id: 3, coin: 'DOGE', signal: 'Dogecoin network upgrade proposal raises spam-filtering concerns', sentiment: 'BEARISH', impactScore: 55, createdAt: new Date(Date.now() - 1800000).toISOString() },
    { id: 4, coin: 'ARB', signal: 'Arbitrum DAO passes $35M grant program for DeFi builders', sentiment: 'BULLISH', impactScore: 78, createdAt: new Date(Date.now() - 3600000).toISOString() },
    { id: 5, coin: 'SOL', signal: 'Solana validator set record 4,200 TPS during peak load test', sentiment: 'BULLISH', impactScore: 88, createdAt: new Date(Date.now() - 7200000).toISOString() },
];

// ─── TERMINAL MOCK DATA ──────────────────────────────────────────────────────

export const MOCK_COIN_NEWS: CoinNews[] = [
    { id: 1, coin: 'ETH', headline: 'SEC delays final decision on Ethereum Spot ETF applications to July.', sentiment: 'NEUTRAL', createdAt: new Date(Date.now() - 120000).toISOString() },
    { id: 2, coin: 'SOL', headline: 'Solana network v1.18 upgrade goes live on mainnet beta with improved validator performance.', sentiment: 'BULLISH', createdAt: new Date(Date.now() - 900000).toISOString() },
    { id: 3, coin: 'DEFI', headline: 'Uniswap V4 hooks trigger new wave of liquidity pool innovation across EVM chains.', sentiment: 'BULLISH', createdAt: new Date(Date.now() - 2520000).toISOString() },
    { id: 4, coin: 'BTC', headline: 'Miners accumulating aggressively ahead of halving event next month.', sentiment: 'BULLISH', createdAt: new Date(Date.now() - 3600000).toISOString() },
    { id: 5, coin: 'USDT', headline: 'Tether publishes quarterly attestation confirming 100% USD reserve backing.', sentiment: 'NEUTRAL', createdAt: new Date(Date.now() - 7200000).toISOString() },
];

export const MOCK_ANALYSIS_STREAM: AnalysisStream = {
    id: 'OA-9921-X',
    coinPair: 'SOL-USDT',
    analysisId: 'OA-9921-X',
    title: 'SOL/USDT — Institutional Buying Confirmed',
    verdict: 'STRONG_BUY',
    confidenceScore: 87,
    executiveSummary: [
        'Buying pressure absorbing 65% of sell volume at $144 support.',
        'On-chain data shows wallets >1000 SOL accumulating aggressively.',
        'Key resistance at $148.50 — a breakout targets $158 within 48 hours.',
    ],
    detailedAnalysis: 'Technical analysis suggests a strong bullish continuation pattern. The RSI on the 4h chart has reset from overbought territory to 58, providing room for another leg up. MACD crossover is imminent on the daily chart. The overall market structure remains bullish above $138 support.',
    updatedAt: new Date().toISOString(),
};
