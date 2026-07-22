// Types for the Airdrops features (DEC-041 AD-4 portfolio card)

export type AirdropTask = {
    id: number;
    projectId: number;
    description: string;
    contractAddress?: string;
    minAmount?: string;
    tokenSymbol?: string;
    chain?: string;
    isAutoVerifiable: boolean;
    orderIndex: number;
};

/** Portfolio card task (may lack DB id) */
export type PortfolioTaskItem = {
    id: number | null;
    description: string;
    isAutoVerifiable: boolean;
    chain: string | null;
};

export type PortfolioMoodStrip = {
    window: '24h' | '7d';
    moodLabel: 'cold' | 'warming' | 'hot' | 'toxic';
    mentionCount: number;
    uniqueSourceCount: number;
    hypeScore: number;
    fudScore: number;
    controversyFlag: boolean;
    computedAt: string | null;
};

export type PortfolioDateSignal = {
    kind: string;
    isoDate: string | null;
    raw?: string;
    confidence: 'low' | 'medium' | 'high';
};

export type PortfolioProvenanceLink = {
    label: string;
    url: string;
    kind: 'signal' | 'cited' | 'official' | 'social';
};

export type AirdropProject = {
    id: number;
    name: string;
    logoUrl?: string | null;
    network: string;
    estValue?: string | null;
    aiReport?: string | null;
    riskVerdict: string;
    isActive: boolean;
    snapshotAt?: string | null;
    tgeAt?: string | null;
    createdAt: string;
    updatedAt: string;
    tasks?: Array<AirdropTask | PortfolioTaskItem>;
    progressPercent?: number;
    ecosystem?: string | null;
    effortLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | string | null;
    rewardConfidence?: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNVERIFIED' | string | null;
    qualityScore?: number;
    /** AD-4 portfolio fields */
    pipelineStatus?: string;
    publishPath?: string;
    whyFarmNow?: string;
    teamSummary?: string;
    docsSummary?: string;
    fundingSummary?: string;
    howItWorks?: string;
    dates?: PortfolioDateSignal[];
    mood?: {
        strip24h: PortfolioMoodStrip | null;
        strip7d: PortfolioMoodStrip | null;
    };
    moodLabel?: string | null;
    provenanceLinks?: PortfolioProvenanceLink[];
    provenanceCount?: number;
    taskCount?: number;
    websiteUrl?: string | null;
    twitterUrl?: string | null;
    discordUrl?: string | null;
    fundingRound?: string | null;
    nfaDisclaimer?: string;
};

export type UserProgress = {
    id: number;
    userId: number;
    taskId: number;
    walletId?: number;
    completed: boolean;
    completedAt?: string;
    verifiedBy?: 'auto' | 'manual';
    txHash?: string;
};

export type UrgentAirdrop = {
    id: number;
    name: string;
    logoUrl: string | null;
    network: string;
    estValue: string | null;
    riskVerdict: string | null;
    snapshotAt: string | null;
    tgeAt: string | null;
    createdAt: string;
    urgencyScore: number;
    daysLeft: number | null;
    isNew: boolean;
    progressPercent: number;
    qualityScore?: number;
};

export type ProgressResponse = {
    percent: number;
    completedCount: number;
    totalCount: number;
    userProgress: UserProgress[];
};

/** DEC-042 Research Archive */
export type ResearchTier = 'recommended' | 'under_review' | 'not_recommended';
export type EvidenceStrength = 'low' | 'medium' | 'high';
export type PublicVerdictLabel =
    | 'not_recommended'
    | 'under_review'
    | 'high_risk'
    | 'insufficient_evidence'
    | 'failed_legitimacy_checks';

export type AirdropPublicStats = {
    projectsScanned: number;
    recommended: number;
    underReview: number;
    notRecommended: number;
    acceptanceRatePercent: number;
    lastPipelineAt: string | null;
    /** Legacy farm sidebar fields (optional on pure public-stats) */
    totalValue?: number;
    walletCount?: number;
    txCount?: number;
    completedTasks?: number;
};

export type AirdropResearchListItem = {
    id: number;
    slug: string;
    name: string;
    network: string;
    tier: 'not_recommended' | 'under_review';
    verdictLabel: PublicVerdictLabel;
    evidenceStrength: EvidenceStrength;
    riskVerdict: string | null;
    reasonsPublic: string[];
    analyzedAt: string;
    seoEligible: boolean;
    logoUrl: string | null;
};

export type AirdropResearchDetail = AirdropResearchListItem & {
    summary: string;
    headline: string;
    websiteUrl: string | null;
    twitterUrl: string | null;
    qualityScore: number | null;
    nfaDisclaimer: string;
    methodologyBlurb: string;
    /** DEC-042 AR-4 AI note; null when flag off or unavailable */
    researchBlurb: string | null;
};

export type ResearchListResult = {
    items: AirdropResearchListItem[];
    page: number;
    limit: number;
    total: number;
    tier: 'not_recommended' | 'under_review';
};
