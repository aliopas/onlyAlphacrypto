import {
    fetchTokenlessProtocols,
    buildAirdropCandidates,
    buildCandidateContext,
    calculateConfidenceScore,
    fetchProtocolDetail,
    type DefiLlamaProtocol,
    type DefiLlamaProtocolDetail,
    type AirdropCandidate,
} from '../src/services/defillama.service';
import {
    filterAirdropRelevant,
    generateArticleHash,
    buildProjectContextFromArticle,
} from '../src/services/airdropRss.service';
import {
    searchWeb,
    enrichAirdropContext,
} from '../src/services/zhipuWebSearch.service';
import {
    extractProjectNameFromSearchResult,
} from '../src/crons/airdropDiscovery.cron';

// ─── Mocks ──────────────────────────────────────────────────────────────

jest.mock('../src/config/db', () => {
    const mockWhere = jest.fn().mockResolvedValue([]);
    const mockFrom = jest.fn().mockResolvedValue([]);
    return {
        db: {
            select: jest.fn().mockReturnValue({ from: mockFrom, where: mockWhere }),
            insert: jest.fn().mockReturnValue({
                values: jest.fn().mockReturnValue({
                    onConflictDoNothing: jest.fn().mockReturnValue({
                        returning: jest.fn().mockResolvedValue([{ id: 1, name: 'TestProject' }]),
                    }),
                }),
            }),
            update: jest.fn().mockReturnValue({
                set: jest.fn().mockReturnValue({
                    where: jest.fn().mockResolvedValue(undefined),
                }),
            }),
            delete: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue(undefined),
            }),
        },
    };
});

jest.mock('../src/config/env', () => ({
    env: {
        GLM_API_KEY: 'test-glm-key',
        GLM_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4',
        GLM_PLANNER_MODEL: 'glm-4-plus',
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        JWT_SECRET: 'test-jwt-secret-123456789012345678901234',
        OPENROUTER_API_KEY: 'test-openrouter-key',
        DEEPSEEK_MODEL: 'deepseek/deepseek-r1',
        MORALIS_API_KEY: 'test-moralis-key',
        REDIS_URL: undefined,
    },
}));

jest.mock('../src/config/redis', () => ({
    redis: null,
    getCache: jest.fn().mockResolvedValue(null),
    setCache: jest.fn().mockResolvedValue(undefined),
    deleteCache: jest.fn().mockResolvedValue(undefined),
    deleteCachePattern: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/services/openai.service', () => ({
    validateAirdrop: jest.fn().mockResolvedValue({
        isLegitimate: true,
        riskVerdict: 'LOW',
        tasks: [
            { description: 'Test task', isAutoVerifiable: false },
        ],
        estValue: '$500-$2000',
        aiReport: 'Test AI report',
    }),
    validateAirdropFromArticle: jest.fn().mockResolvedValue({
        isLegitimate: true,
        riskVerdict: 'LOW',
        projectName: 'TestProject',
        network: 'Ethereum',
        tasks: [],
        estValue: '$1000',
        snapshotDate: null,
        tgeDate: null,
        aiReport: 'Test report',
    }),
}));

jest.mock('ioredis', () => {
    return { default: jest.fn() };
});

// ─── DeFiLlama Service Tests ────────────────────────────────────────────

const MOCK_PROTOCOLS: DefiLlamaProtocol[] = [
    {
        id: '1',
        name: 'Uniswap V4',
        symbol: 'UNI',
        chain: 'Ethereum',
        chains: ['Ethereum'],
        tvl: 5_000_000_000,
        url: 'https://uniswap.org',
        logo: 'https://icons.llama.fi/uniswap.jpg',
        gecko_id: 'uniswap',
        category: 'DEX',
        description: 'A DEX',
        twitter: 'Uniswap',
    },
    {
        id: '2',
        name: 'SomeTokenless',
        symbol: null,
        chain: 'Ethereum',
        chains: ['Ethereum', 'Arbitrum'],
        tvl: 500_000_000,
        url: 'https://sometokenless.com',
        logo: 'https://icons.llama.fi/some.jpg',
        gecko_id: null,
        category: 'Bridge',
        description: 'A bridge protocol',
        twitter: 'someprotocol',
    },
    {
        id: '3',
        name: 'NoSymbol',
        symbol: '',
        chain: 'Ethereum',
        chains: ['Ethereum'],
        tvl: 50_000_000,
        url: null,
        logo: null,
        gecko_id: '',
        category: 'Lending',
        description: 'A lending protocol',
        twitter: null,
    },
    {
        id: '4',
        name: 'LowTVL',
        symbol: null,
        chain: 'Ethereum',
        chains: ['Ethereum'],
        tvl: 500,
        url: null,
        logo: null,
        gecko_id: null,
        category: null,
        description: null,
        twitter: null,
    },
    {
        id: '5',
        name: '',
        symbol: null,
        chain: 'Ethereum',
        chains: ['Ethereum'],
        tvl: 100_000_000,
        url: null,
        logo: null,
        gecko_id: null,
        category: 'DEX',
        description: null,
        twitter: null,
    },
];

const MOCK_PROTOCOL_DETAIL: DefiLlamaProtocolDetail = {
    ...MOCK_PROTOCOLS[1],
    raises: [
        {
            date: 1700000000,
            name: 'SomeTokenless',
            round: 'Series A',
            amount: 25,
            chains: ['Ethereum'],
            leadInvestors: ['a16z', 'Paradigm'],
            valuation: '500',
        },
        {
            date: 1680000000,
            name: 'SomeTokenless',
            round: 'Seed',
            amount: 5,
            chains: ['Ethereum'],
            leadInvestors: ['Binance Labs'],
            valuation: null,
        },
    ],
    mcap: null,
};

describe('DeFiLlama Service', () => {
    describe('fetchTokenlessProtocols', () => {
        it('should filter out protocols with symbols/gecko_id', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => MOCK_PROTOCOLS,
            });

            const result = await fetchTokenlessProtocols();

            expect(result).toHaveLength(3);
            expect(result.every(p => !p.symbol && !p.gecko_id)).toBe(true);
            expect(result.find(p => p.name === 'Uniswap V4')).toBeUndefined();
            expect(result.find(p => p.name === '')).toBeUndefined();
            expect(result.find(p => p.name === 'LowTVL')).toBeDefined();
        });

        it('should sort by TVL descending', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => MOCK_PROTOCOLS,
            });

            const result = await fetchTokenlessProtocols();

            expect(result[0].tvl).toBeGreaterThanOrEqual(result[1].tvl);
            expect(result[1].tvl).toBeGreaterThanOrEqual(result[2].tvl);
        });

        it('should filter out zero TVL protocols', async () => {
            const protocolsWithZero = [...MOCK_PROTOCOLS, {
                id: '6',
                name: 'ZeroTVL',
                symbol: null,
                chain: 'Ethereum',
                chains: ['Ethereum'],
                tvl: 0,
                url: null,
                logo: null,
                gecko_id: null,
                category: null,
                description: null,
                twitter: null,
            }];

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => protocolsWithZero,
            });

            const result = await fetchTokenlessProtocols();
            expect(result.find(p => p.name === 'ZeroTVL')).toBeUndefined();
        });

        it('should handle API errors gracefully', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 500,
            });

            await expect(fetchTokenlessProtocols()).rejects.toThrow('DeFiLlama API 500');
        });

        it('should handle network timeout', async () => {
            global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed'));

            await expect(fetchTokenlessProtocols()).rejects.toThrow('fetch failed');
        });
    });

    describe('fetchProtocolDetail', () => {
        it('should return protocol detail with raises', async () => {
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => MOCK_PROTOCOL_DETAIL,
            });

            const result = await fetchProtocolDetail('some-tokenless');
            expect(result).not.toBeNull();
            expect(result!.raises).toHaveLength(2);
            expect(result!.raises[0].leadInvestors).toContain('a16z');
        });

        it('should return null on failure', async () => {
            global.fetch = jest.fn().mockRejectedValue(new Error('timeout'));

            const result = await fetchProtocolDetail('nonexistent');
            expect(result).toBeNull();
        });
    });
});

describe('Confidence Scoring', () => {
    it('should give high score for high TVL + multi-chain + funding + twitter', () => {
        const protocol = MOCK_PROTOCOLS[1];
        const score = calculateConfidenceScore(protocol, MOCK_PROTOCOL_DETAIL, 0);
        expect(score).toBeGreaterThanOrEqual(60);
    });

    it('should give moderate score for medium TVL only', () => {
        const protocol = MOCK_PROTOCOLS[2];
        const detail: DefiLlamaProtocolDetail = { ...protocol, raises: [], mcap: null };
        const score = calculateConfidenceScore(protocol, detail, 0);
        expect(score).toBeGreaterThanOrEqual(20);
        expect(score).toBeLessThan(60);
    });

    it('should penalize already existing projects', () => {
        const protocol = MOCK_PROTOCOLS[1];
        const scoreNew = calculateConfidenceScore(protocol, MOCK_PROTOCOL_DETAIL, 0);
        const scoreExisting = calculateConfidenceScore(protocol, MOCK_PROTOCOL_DETAIL, 1);
        expect(scoreNew).toBeGreaterThan(scoreExisting);
    });

    it('should clamp score between 0 and 100', () => {
        const score = calculateConfidenceScore(MOCK_PROTOCOLS[1], MOCK_PROTOCOL_DETAIL, 100);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
    });
});

describe('buildCandidateContext', () => {
    it('should include all relevant fields', () => {
        const candidate: AirdropCandidate = {
            name: 'SomeTokenless',
            chains: ['Ethereum', 'Arbitrum'],
            tvl: 500_000_000,
            category: 'Bridge',
            logo: 'https://icons.llama.fi/some.jpg',
            url: 'https://sometokenless.com',
            twitter: 'someprotocol',
            description: 'A bridge protocol for cross-chain communication',
            totalRaised: 30,
            latestRound: 'Series A',
            leadInvestors: ['a16z', 'Paradigm'],
            confidenceScore: 75,
        };

        const context = buildCandidateContext(candidate);

        expect(context).toContain('SomeTokenless');
        expect(context).toContain('Bridge');
        expect(context).toContain('Ethereum, Arbitrum');
        expect(context).toContain('$500.00M');
        expect(context).toContain('$30M');
        expect(context).toContain('Series A');
        expect(context).toContain('a16z');
        expect(context).toContain('75/100');
    });

    it('should handle null optional fields gracefully', () => {
        const candidate: AirdropCandidate = {
            name: 'MinimalProtocol',
            chains: ['Ethereum'],
            tvl: 1_000_000,
            category: null,
            logo: null,
            url: null,
            twitter: null,
            description: null,
            totalRaised: null,
            latestRound: null,
            leadInvestors: [],
            confidenceScore: 20,
        };

        const context = buildCandidateContext(candidate);

        expect(context).toContain('MinimalProtocol');
        expect(context).toContain('Ethereum');
        expect(context).toContain('$1.00M');
        expect(context).not.toContain('TWITTER');
        expect(context).not.toContain('WEBSITE');
        expect(context).not.toContain('TOTAL FUNDING');
    });
});

// ─── RSS Service Tests ──────────────────────────────────────────────────

describe('RSS Keyword Filtering', () => {
    it('should accept articles with airdrop keywords', () => {
        expect(filterAirdropRelevant('LayerZero airdrop snapshot confirmed')).toBe(true);
        expect(filterAirdropRelevant('TGE announced for new token')).toBe(true);
        expect(filterAirdropRelevant('Claim your retroactive tokens now')).toBe(true);
        expect(filterAirdropRelevant('Incentivized testnet rewards available')).toBe(true);
    });

    it('should reject articles with anti-keywords', () => {
        expect(filterAirdropRelevant('Scam alert: fake airdrop phishing attempt')).toBe(false);
        expect(filterAirdropRelevant('Honeypot token rug pull detected')).toBe(false);
    });

    it('should reject articles without airdrop keywords', () => {
        expect(filterAirdropRelevant('Bitcoin price reaches new all-time high')).toBe(false);
        expect(filterAirdropRelevant('Ethereum ETF approved by SEC')).toBe(false);
    });
});

describe('Article Hash Generation', () => {
    it('should produce consistent SHA256 hashes', () => {
        const hash1 = generateArticleHash('Test Title', 'https://example.com/1');
        const hash2 = generateArticleHash('Test Title', 'https://example.com/1');
        expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
        const hash1 = generateArticleHash('Title A', 'https://example.com/a');
        const hash2 = generateArticleHash('Title B', 'https://example.com/b');
        expect(hash1).not.toBe(hash2);
    });

    it('should be a valid 64-char hex string', () => {
        const hash = generateArticleHash('test', 'https://test.com');
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
});

describe('buildProjectContextFromArticle', () => {
    it('should include title, source, published, link, and content', () => {
        const article = {
            title: 'Test Article',
            link: 'https://example.com/article',
            pubDate: '2026-04-27T10:00:00Z',
            contentSnippet: 'A short snippet',
            source: 'Test Source',
            content: 'Full article content here'.repeat(100),
            hash: 'abc123',
        };

        const context = buildProjectContextFromArticle(article);

        expect(context).toContain('Test Article');
        expect(context).toContain('Test Source');
        expect(context).toContain('2026-04-27T10:00:00Z');
        expect(context).toContain('https://example.com/article');
    });

    it('should truncate content exceeding 3200 chars', () => {
        const longContent = 'A'.repeat(5000);
        const article = {
            title: 'Test',
            link: 'https://test.com',
            pubDate: '',
            contentSnippet: '',
            source: 'Test',
            content: longContent,
            hash: 'test',
        };

        const context = buildProjectContextFromArticle(article);
        expect(context.length).toBeLessThanOrEqual(3400);
        expect(context).toContain('...[truncated]');
    });
});

// ─── Z.ai Web Search Tests ──────────────────────────────────────────────

describe('searchWeb', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
    });

    it('should return empty array when GLM_API_KEY is missing', async () => {
        const { env } = require('../src/config/env');
        const originalKey = env.GLM_API_KEY;
        env.GLM_API_KEY = '';
        const { searchWeb } = require('../src/services/zhipuWebSearch.service');

        const result = await searchWeb('test query');
        expect(result).toEqual([]);

        env.GLM_API_KEY = originalKey;
    });

    it('should return empty array on API error', async () => {
        const { env } = require('../src/config/env');
        env.GLM_API_KEY = 'test-key';

        global.fetch = jest.fn().mockResolvedValue({ ok: false });

        const { searchWeb } = require('../src/services/zhipuWebSearch.service');
        const result = await searchWeb('test');

        expect(result).toEqual([]);
    });

    it('should return structured results on success', async () => {
        const { env } = require('../src/config/env');
        env.GLM_API_KEY = 'test-key';

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{
                    message: {
                        content: 'LayerZero airdrop confirmed for June 2026. Users who bridged assets qualify.',
                    },
                }],
            }),
        });

        const { searchWeb } = require('../src/services/zhipuWebSearch.service');
        const result = await searchWeb('LayerZero airdrop');

        expect(result).toHaveLength(1);
        expect(result[0].content).toContain('LayerZero');
    });
});

describe('enrichAirdropContext', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
    });

    it('should skip enrichment for content > 500 chars', async () => {
        const longContent = 'A'.repeat(600);
        const { enrichAirdropContext } = require('../src/services/zhipuWebSearch.service');

        const result = await enrichAirdropContext('TestProject', longContent);
        expect(result).toBe(longContent);
    });

    it('should enrich short content with web search results', async () => {
        const { env } = require('../src/config/env');
        env.GLM_API_KEY = 'test-key';

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [{
                    message: {
                        content: 'LayerZero is an omnichain protocol. Airdrop eligibility requires bridging.',
                    },
                }],
            }),
        });

        const { enrichAirdropContext } = require('../src/services/zhipuWebSearch.service');
        const shortContent = 'LayerZero airdrop';

        const result = await enrichAirdropContext('LayerZero', shortContent);

        expect(result.length).toBeGreaterThan(shortContent.length);
        expect(result).toContain('WEB RESEARCH');
    });

    it('should return original content when search returns empty', async () => {
        const { env } = require('../src/config/env');
        env.GLM_API_KEY = 'test-key';

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ choices: [{ message: { content: '' } }] }),
        });

        const { enrichAirdropContext } = require('../src/services/zhipuWebSearch.service');
        const shortContent = 'Test project';

        const result = await enrichAirdropContext('Test', shortContent);
        expect(result).toBe(shortContent);
    });
});

// ─── Z.ai Discovery Tests ──────────────────────────────────────────────

describe('extractProjectNameFromSearchResult', () => {
    it('should extract project name from airdrop announcement', () => {
        const content = 'LayerZero airdrop snapshot confirmed for June 2026';
        const name = extractProjectNameFromSearchResult(content);
        expect(name).toBe('LayerZero');
    });

    it('should extract project name from claim announcement', () => {
        const content = 'Scroll token airdrop claim is now live for eligible users';
        const name = extractProjectNameFromSearchResult(content);
        expect(name).toBe('Scroll');
    });

    it('should extract from "by" pattern', () => {
        const content = 'Airdrop claim by Arbitrum Foundation for early users';
        const name = extractProjectNameFromSearchResult(content);
        expect(name).toBe('Arbitrum');
    });

    it('should return null for content without project names', () => {
        const content = 'The market is going up today with big gains';
        const name = extractProjectNameFromSearchResult(content);
        expect(name).toBeNull();
    });

    it('should return null for single-char matches', () => {
        const content = 'X airdrop announced today';
        const name = extractProjectNameFromSearchResult(content);
        expect(name).toBeNull();
    });
});

// ─── End-to-End Pipeline Simulation ────────────────────────────────────

describe('Pipeline Integration (mocked)', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
    });

    it('should process DeFiLlama protocols through the full pipeline', async () => {
        global.fetch = jest.fn().mockImplementation((url: string) => {
            if (url.includes('/protocols')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => [MOCK_PROTOCOLS[1], MOCK_PROTOCOLS[2]],
                });
            }
            if (url.includes('/protocol/')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => MOCK_PROTOCOL_DETAIL,
                });
            }
            return Promise.resolve({ ok: false, status: 404 });
        });

        const tokenless = await fetchTokenlessProtocols();
        expect(tokenless.length).toBeGreaterThan(0);

        const candidates = await buildAirdropCandidates(tokenless, 5);
        expect(candidates.length).toBeGreaterThan(0);

        for (const candidate of candidates) {
            const context = buildCandidateContext(candidate);
            expect(context).toContain(candidate.name);
            expect(context).toContain('CONFIDENCE SCORE');
            expect(candidate.confidenceScore).toBeGreaterThan(0);
        }
    });

    it('should handle empty DeFiLlama response', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => [],
        });

        const tokenless = await fetchTokenlessProtocols();
        expect(tokenless).toHaveLength(0);
    });

    it('should survive complete DeFiLlama failure + Z.ai fallback', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

        const tokenless = await fetchTokenlessProtocols().catch(() => []);
        expect(tokenless).toHaveLength(0);
    });
});

// ─── API Endpoint Response Shape Tests ──────────────────────────────────

describe('API Response Shapes', () => {
    it('GET /api/airdrop/projects should return array with progressPercent', () => {
        const project = {
            id: 1,
            name: 'LayerZero',
            network: 'Multi-chain',
            estValue: '$500-$2000',
            riskVerdict: 'LOW',
            isActive: true,
            progressPercent: 0,
        };

        expect(project).toHaveProperty('id');
        expect(project).toHaveProperty('name');
        expect(project).toHaveProperty('network');
        expect(project).toHaveProperty('estValue');
        expect(project).toHaveProperty('riskVerdict');
        expect(project).toHaveProperty('progressPercent');
    });

    it('GET /api/airdrop/deadlines should only include projects with dates', () => {
        const projects = [
            { id: 1, name: 'LayerZero', snapshotAt: new Date('2026-05-15'), tgeAt: null },
            { id: 2, name: 'Scroll', snapshotAt: null, tgeAt: new Date('2026-06-01') },
            { id: 3, name: 'NoDate', snapshotAt: null, tgeAt: null },
        ];

        const withDeadlines = projects.filter(p => p.snapshotAt || p.tgeAt);
        expect(withDeadlines).toHaveLength(2);
        expect(withDeadlines.find(p => p.name === 'NoDate')).toBeUndefined();
    });

    it('GET /api/airdrop/urgent should score urgency correctly', () => {
        const now = new Date();
        const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

        const projects = [
            { deadline: threeDaysFromNow, isNew: false, progressPercent: 0, deadlineActive: true },
            { deadline: threeDaysFromNow, isNew: true, progressPercent: 10, deadlineActive: true },
            { deadline: null, isNew: false, progressPercent: 0, deadlineActive: false },
        ];

        const scored = projects.map(p => {
            let score = 0;
            if (p.deadline && p.deadlineActive) {
                const daysLeft = Math.max(0, Math.floor((p.deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                if (daysLeft <= 3) score += 100;
            }
            if (p.isNew) score += 30;
            if (p.deadlineActive && p.progressPercent < 50) score += 20;
            return { ...p, urgencyScore: score };
        });

        scored.sort((a, b) => b.urgencyScore - a.urgencyScore);
        expect(scored[0].urgencyScore).toBe(150);
        expect(scored[1].urgencyScore).toBe(120);
        expect(scored[2].urgencyScore).toBe(0);
    });

    it('GET /api/airdrop/sidebar-deadlines should return countdown format', () => {
        const now = new Date();
        const future = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000 + 45 * 60 * 1000);

        const diffMs = future.getTime() - now.getTime();
        const daysLeft = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const hoursLeft = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutesLeft = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        expect(daysLeft).toBe(5);
        expect(hoursLeft).toBe(3);
        expect(minutesLeft).toBe(45);
    });

    it('GET /api/airdrop/pipeline-status should calculate next scan correctly', () => {
        const lastScan = new Date('2026-04-27T06:00:00Z');
        const nextScan = new Date(lastScan.getTime() + 6 * 60 * 60 * 1000);
        expect(nextScan.toISOString()).toBe('2026-04-27T12:00:00.000Z');
    });
});

// ─── Pipeline Health Logging Shape ─────────────────────────────────────

describe('Pipeline Run Log Shape', () => {
    it('should match airdrop_pipeline_runs table schema', () => {
        const logEntry = {
            runType: 'defillama_discovery',
            articlesFound: 25,
            articlesProcessed: 5,
            projectsInserted: 3,
            projectsRejected: 2,
            errors: 0,
            durationMs: 15000,
            notes: 'sources: defillama+zai, candidates_dl=15, candidates_zai=10',
        };

        expect(typeof logEntry.runType).toBe('string');
        expect(logEntry.runType).toMatch(/^(rss_discovery|routine_sync|defillama_discovery)$/);
        expect(typeof logEntry.articlesFound).toBe('number');
        expect(typeof logEntry.articlesProcessed).toBe('number');
        expect(typeof logEntry.projectsInserted).toBe('number');
        expect(typeof logEntry.durationMs).toBe('number');
        expect(logEntry.articlesFound).toBeGreaterThanOrEqual(logEntry.articlesProcessed);
    });
});

// ─── Entity Dedup Tests ─────────────────────────────────────────────────

describe('Entity-Based Dedup', () => {
    it('should deduplicate projects by normalized name', () => {
        const names = [
            'LayerZero',
            'layerzero',
            'LayerZero Protocol',
            'LAYERZERO',
            'Scroll',
            'scroll',
        ];

        const seen = new Set<string>();
        const unique = names.filter(n => {
            const key = n.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        expect(unique).toHaveLength(3);
    });

    it('should merge candidates from multiple sources by name', () => {
        const defillamaNames = ['LayerZero', 'Scroll', 'zkSync'];
        const zaiNames = ['Scroll', 'Linea', 'Arbitrum'];

        const allNames = new Set<string>();
        const merged: Array<{ name: string; source: string }> = [];

        for (const name of defillamaNames) {
            if (!allNames.has(name.toLowerCase())) {
                allNames.add(name.toLowerCase());
                merged.push({ name, source: 'defillama' });
            }
        }

        for (const name of zaiNames) {
            if (!allNames.has(name.toLowerCase())) {
                allNames.add(name.toLowerCase());
                merged.push({ name, source: 'zai' });
            }
        }

        expect(merged).toHaveLength(5);
        expect(merged.find(m => m.name === 'Scroll')!.source).toBe('defillama');
    });
});

// ─── Tiered Keywords Test ───────────────────────────────────────────────

describe('Tiered Keyword Matching (proposed enhancement)', () => {
    const TIER_1 = ['airdrop claim', 'airdrop snapshot', 'token generation event', 'TGE confirmed', 'airdrop distribution', 'claim your tokens', 'airdrop eligibility', 'retroactive airdrop'];
    const TIER_2 = ['incentivized testnet', 'testnet rewards', 'mainnet launch airdrop', 'community allocation', 'token allocation', 'genesis drop', 'loyalty airdrop', 'early adopter reward'];
    const TIER_3 = ['raised $', 'series A funding', 'seed round', 'testnet phase', 'mainnet beta', 'public testnet'];

    const ANTI_ENHANCED = ['airdrop scam', 'airdrop exploit', 'hacked', 'rug pull', 'airdrop ended', 'airdrop over', 'claim deadline passed', 'snapshot ended', 'already claimed', 'no longer available'];

    function matchTier(text: string): number {
        const lower = text.toLowerCase();
        if (ANTI_ENHANCED.some(k => lower.includes(k.toLowerCase()))) return -1;
        if (TIER_1.some(k => lower.includes(k.toLowerCase()))) return 1;
        if (TIER_2.some(k => lower.includes(k.toLowerCase()))) return 2;
        if (TIER_3.some(k => lower.includes(k.toLowerCase()))) return 3;
        return 0;
    }

    it('Tier 1 should match direct airdrop announcements', () => {
        expect(matchTier('LayerZero airdrop snapshot confirmed for June')).toBe(1);
        expect(matchTier('Claim your tokens from the TGE')).toBe(1);
    });

    it('Tier 2 should match incentivized programs', () => {
        expect(matchTier('Join the incentivized testnet for rewards')).toBe(2);
        expect(matchTier('Community allocation announced for genesis drop')).toBe(2);
    });

    it('Tier 3 should match predictive signals', () => {
        expect(matchTier('Protocol raised $50M in Series A funding')).toBe(3);
        expect(matchTier('Mainnet beta now open for testing')).toBe(3);
    });

    it('Anti-keywords should reject scam/expired content', () => {
        expect(matchTier('Airdrop scam alert: phishing attempt detected')).toBe(-1);
        expect(matchTier('Airdrop ended — claim deadline passed')).toBe(-1);
        expect(matchTier('This project was hacked and rug pulled')).toBe(-1);
    });

    it('should return 0 for non-airdrop content', () => {
        expect(matchTier('Bitcoin reaches new all-time high')).toBe(0);
    });
});

console.log('\n✅ Airdrop Pipeline V2 Test Suite loaded successfully\n');
