export interface CoinSeoData {
    symbol: string;
    name: string;
    rank: number;
    category: string;
    consensus: string;
    activationDate: string;
    whatIs: string;
    coverage: string;
    metaTitle: string;
    metaDescription: string;
    keywords: string[];
}

export const COIN_SEO_DATA: Record<string, CoinSeoData> = {
    BTC: {
        symbol: 'BTC',
        name: 'Bitcoin',
        rank: 1,
        category: 'Store of Value / Payments',
        consensus: 'Proof of Work',
        activationDate: '2009-01-03',
        whatIs:
            'Bitcoin (BTC) is the first decentralized cryptocurrency, designed to operate as a digital store of value and peer-to-peer payment network without intermediaries.',
        coverage:
            'OnlyAlpha tracks Bitcoin across multiple timeframes, monitoring trend posture, volatility regime, momentum shifts, and key technical levels to surface BULLISH or BEARISH intelligence.',
        metaTitle: 'Bitcoin (BTC) Live AI Analysis — Market Intelligence & Signals | OnlyAlpha',
        metaDescription:
            'Real-time AI analysis and market intelligence for Bitcoin (BTC). Track trend regime, momentum, and algorithmic signals on OnlyAlpha.',
        keywords: [
            'Bitcoin AI analysis',
            'BTC market intelligence',
            'Bitcoin live analysis',
            'BTC signals',
            'real-time Bitcoin analysis',
            'OnlyAlpha Bitcoin',
        ],
    },
    ETH: {
        symbol: 'ETH',
        name: 'Ethereum',
        rank: 2,
        category: 'Smart Contract Platform',
        consensus: 'Proof of Stake',
        activationDate: '2015-07-30',
        whatIs:
            'Ethereum (ETH) is a programmable blockchain that powers smart contracts, decentralized applications, and the broader DeFi and NFT ecosystems.',
        coverage:
            'OnlyAlpha monitors Ethereum for network sentiment, technical trend alignment, and regime changes, producing BULLISH or BEARISH directional context across timeframes.',
        metaTitle: 'Ethereum (ETH) Live AI Analysis — Market Intelligence & Signals | OnlyAlpha',
        metaDescription:
            'Real-time AI analysis and market intelligence for Ethereum (ETH). Track trend regime, momentum, and algorithmic signals on OnlyAlpha.',
        keywords: [
            'Ethereum AI analysis',
            'ETH market intelligence',
            'Ethereum live analysis',
            'ETH signals',
            'real-time Ethereum analysis',
            'OnlyAlpha Ethereum',
        ],
    },
    SOL: {
        symbol: 'SOL',
        name: 'Solana',
        rank: 5,
        category: 'Smart Contract Platform',
        consensus: 'Proof of History + Proof of Stake',
        activationDate: '2020-03-16',
        whatIs:
            'Solana (SOL) is a high-throughput Layer-1 blockchain optimized for fast, low-cost decentralized applications and payments.',
        coverage:
            'OnlyAlpha tracks Solana for momentum, trend strength, and volatility regime to deliver BULLISH or BEARISH market intelligence.',
        metaTitle: 'Solana (SOL) Live AI Analysis — Market Intelligence & Signals | OnlyAlpha',
        metaDescription:
            'Real-time AI analysis and market intelligence for Solana (SOL). Track trend regime, momentum, and algorithmic signals on OnlyAlpha.',
        keywords: [
            'Solana AI analysis',
            'SOL market intelligence',
            'Solana live analysis',
            'SOL signals',
            'real-time Solana analysis',
            'OnlyAlpha Solana',
        ],
    },
    BNB: {
        symbol: 'BNB',
        name: 'BNB',
        rank: 4,
        category: 'Exchange Token / Layer-1',
        consensus: 'Proof of Staked Authority',
        activationDate: '2017-09-01',
        whatIs:
            'BNB is the native asset of the BNB Chain ecosystem, originally launched by Binance and used for fee discounts, staking, and on-chain transactions.',
        coverage:
            'OnlyAlpha follows BNB across technical timeframes, identifying trend posture, support/resistance dynamics, and BULLISH or BEARISH regime signals.',
        metaTitle: 'BNB Live AI Analysis — Market Intelligence & Signals | OnlyAlpha',
        metaDescription:
            'Real-time AI analysis and market intelligence for BNB. Track trend regime, momentum, and algorithmic signals on OnlyAlpha.',
        keywords: [
            'BNB AI analysis',
            'BNB market intelligence',
            'BNB live analysis',
            'BNB signals',
            'real-time BNB analysis',
            'OnlyAlpha BNB',
        ],
    },
    XRP: {
        symbol: 'XRP',
        name: 'XRP',
        rank: 6,
        category: 'Payments / Cross-Border',
        consensus: 'XRP Ledger Consensus',
        activationDate: '2012-01-01',
        whatIs:
            'XRP is a digital asset built for fast, low-cost cross-border payments and liquidity provisioning on the XRP Ledger.',
        coverage:
            'OnlyAlpha tracks XRP for trend alignment, momentum exhaustion, and volatility regime to surface BULLISH or BEARISH intelligence.',
        metaTitle: 'XRP Live AI Analysis — Market Intelligence & Signals | OnlyAlpha',
        metaDescription:
            'Real-time AI analysis and market intelligence for XRP. Track trend regime, momentum, and algorithmic signals on OnlyAlpha.',
        keywords: [
            'XRP AI analysis',
            'XRP market intelligence',
            'XRP live analysis',
            'XRP signals',
            'real-time XRP analysis',
            'OnlyAlpha XRP',
        ],
    },
    DOGE: {
        symbol: 'DOGE',
        name: 'Dogecoin',
        rank: 8,
        category: 'Meme / Payments',
        consensus: 'Proof of Work',
        activationDate: '2013-12-06',
        whatIs:
            'Dogecoin (DOGE) is a peer-to-peer cryptocurrency that started as a meme and evolved into one of the most widely recognized digital payment tokens.',
        coverage:
            'OnlyAlpha monitors Dogecoin for momentum bursts, trend strength, and sentiment-driven volatility, translating data into BULLISH or BEARISH context.',
        metaTitle: 'Dogecoin (DOGE) Live AI Analysis — Market Intelligence & Signals | OnlyAlpha',
        metaDescription:
            'Real-time AI analysis and market intelligence for Dogecoin (DOGE). Track trend regime, momentum, and algorithmic signals on OnlyAlpha.',
        keywords: [
            'Dogecoin AI analysis',
            'DOGE market intelligence',
            'Dogecoin live analysis',
            'DOGE signals',
            'real-time Dogecoin analysis',
            'OnlyAlpha DOGE',
        ],
    },
    ADA: {
        symbol: 'ADA',
        name: 'Cardano',
        rank: 9,
        category: 'Smart Contract Platform',
        consensus: 'Proof of Stake (Ouroboros)',
        activationDate: '2017-09-23',
        whatIs:
            'Cardano (ADA) is a research-driven proof-of-stake blockchain focused on scalability, sustainability, and peer-reviewed protocol development.',
        coverage:
            'OnlyAlpha tracks Cardano for trend posture, multi-timeframe alignment, and momentum shifts, generating BULLISH or BEARISH market intelligence.',
        metaTitle: 'Cardano (ADA) Live AI Analysis — Market Intelligence & Signals | OnlyAlpha',
        metaDescription:
            'Real-time AI analysis and market intelligence for Cardano (ADA). Track trend regime, momentum, and algorithmic signals on OnlyAlpha.',
        keywords: [
            'Cardano AI analysis',
            'ADA market intelligence',
            'Cardano live analysis',
            'ADA signals',
            'real-time Cardano analysis',
            'OnlyAlpha ADA',
        ],
    },
    AVAX: {
        symbol: 'AVAX',
        name: 'Avalanche',
        rank: 10,
        category: 'Smart Contract Platform',
        consensus: 'Avalanche Consensus',
        activationDate: '2020-09-21',
        whatIs:
            'Avalanche (AVAX) is a Layer-1 blockchain platform designed for high throughput, low latency, and customizable subnet architectures.',
        coverage:
            'OnlyAlpha follows Avalanche for trend alignment, volatility regime, and momentum signals to produce BULLISH or BEARISH directional context.',
        metaTitle: 'Avalanche (AVAX) Live AI Analysis — Market Intelligence & Signals | OnlyAlpha',
        metaDescription:
            'Real-time AI analysis and market intelligence for Avalanche (AVAX). Track trend regime, momentum, and algorithmic signals on OnlyAlpha.',
        keywords: [
            'Avalanche AI analysis',
            'AVAX market intelligence',
            'Avalanche live analysis',
            'AVAX signals',
            'real-time Avalanche analysis',
            'OnlyAlpha AVAX',
        ],
    },
    LINK: {
        symbol: 'LINK',
        name: 'Chainlink',
        rank: 11,
        category: 'Oracle / Infrastructure',
        consensus: 'Proof of Stake',
        activationDate: '2017-09-19',
        whatIs:
            'Chainlink (LINK) is a decentralized oracle network that connects smart contracts with real-world data, events, and computations.',
        coverage:
            'OnlyAlpha monitors Chainlink for trend strength, momentum, and market regime to deliver BULLISH or BEARISH intelligence across timeframes.',
        metaTitle: 'Chainlink (LINK) Live AI Analysis — Market Intelligence & Signals | OnlyAlpha',
        metaDescription:
            'Real-time AI analysis and market intelligence for Chainlink (LINK). Track trend regime, momentum, and algorithmic signals on OnlyAlpha.',
        keywords: [
            'Chainlink AI analysis',
            'LINK market intelligence',
            'Chainlink live analysis',
            'LINK signals',
            'real-time Chainlink analysis',
            'OnlyAlpha LINK',
        ],
    },
    SUI: {
        symbol: 'SUI',
        name: 'Sui',
        rank: 15,
        category: 'Smart Contract Platform',
        consensus: 'Proof of Stake (Mysticeti)',
        activationDate: '2023-05-03',
        whatIs:
            'Sui (SUI) is a high-performance Layer-1 blockchain built for object-centric digital asset ownership and low-latency transactions.',
        coverage:
            'OnlyAlpha tracks Sui for momentum, volatility regime, and trend alignment to surface BULLISH or BEARISH market intelligence.',
        metaTitle: 'Sui (SUI) Live AI Analysis — Market Intelligence & Signals | OnlyAlpha',
        metaDescription:
            'Real-time AI analysis and market intelligence for Sui (SUI). Track trend regime, momentum, and algorithmic signals on OnlyAlpha.',
        keywords: [
            'Sui AI analysis',
            'SUI market intelligence',
            'Sui live analysis',
            'SUI signals',
            'real-time Sui analysis',
            'OnlyAlpha SUI',
        ],
    },
    GRAM: {
        symbol: 'GRAM',
        name: 'Gram',
        rank: 16,
        category: 'Smart Contract Platform / Messaging',
        consensus: 'Proof of Stake',
        activationDate: '2021-12-23',
        whatIs:
            'Gram (GRAM), formerly Toncoin (TON), is the native asset of The Open Network — a scalable blockchain originally designed by Telegram for high-speed payments and decentralized services.',
        coverage:
            'OnlyAlpha follows Gram for trend posture, momentum shifts, and volatility regime, translating data into BULLISH or BEARISH signals.',
        metaTitle: 'Gram (GRAM) Live AI Analysis — Market Intelligence & Signals | OnlyAlpha',
        metaDescription:
            'Real-time AI analysis and market intelligence for Gram (GRAM, formerly TON). Track trend regime, momentum, and algorithmic signals on OnlyAlpha.',
        keywords: [
            'Gram AI analysis',
            'GRAM market intelligence',
            'Toncoin AI analysis',
            'GRAM signals',
            'real-time Gram analysis',
            'OnlyAlpha GRAM',
        ],
    },
};

interface CoinSeoContentProps {
    symbol: string;
    /** When true, renders a compact visible block under the terminal UI */
    visible?: boolean;
}

export function CoinSeoContent({ symbol, visible = true }: CoinSeoContentProps) {
    const data = COIN_SEO_DATA[symbol.toUpperCase()];
    if (!data) return null;

    if (!visible) {
        return (
            <section className="sr-only" aria-label={`${data.name} overview`}>
                <h1>{data.name} ({data.symbol}) Live AI Analysis</h1>
                <p>{data.whatIs}</p>
                <h2>What OnlyAlpha tracks for {data.name}</h2>
                <p>{data.coverage}</p>
                <p>
                    Not Financial Advice. OnlyAlpha provides algorithmic and AI-generated market intelligence for educational purposes only.
                </p>
            </section>
        );
    }

    return (
        <section
            className="mt-4 shrink-0 border border-[#222] bg-[#0A0A0A] rounded-md p-4 md:p-5 max-h-[40vh] overflow-y-auto"
            aria-label={`${data.name} market intelligence overview`}
        >
            <h2 className="text-base md:text-lg font-semibold text-white tracking-tight">
                {data.name} Market Intelligence Overview
            </h2>
            <p className="mt-2 text-sm text-[#aaa] leading-relaxed">{data.whatIs}</p>

            <h3 className="mt-4 text-sm font-medium text-white">
                What OnlyAlpha tracks for {data.name}
            </h3>
            <p className="mt-1.5 text-sm text-[#aaa] leading-relaxed">{data.coverage}</p>

            <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-[#777] font-mono">
                <li>Category: {data.category}</li>
                <li>Consensus: {data.consensus}</li>
                <li>Market cap rank (approx.): #{data.rank}</li>
                <li>Symbol: {data.symbol}</li>
            </ul>

            <p className="mt-3 text-[11px] text-[#555] leading-relaxed">
                Not Financial Advice. OnlyAlpha provides algorithmic and AI-generated market intelligence for educational purposes only.
            </p>
        </section>
    );
}
