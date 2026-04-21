// Types for the Airdrops features

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

export type AirdropProject = {
    id: number;
    name: string;
    logoUrl?: string;
    network: string;
    estValue?: string;
    aiReport?: string;
    riskVerdict: 'SAFE' | 'MEDIUM_RISK' | 'HIGH_RISK' | 'SCAM';
    isActive: boolean;
    snapshotAt?: string;
    tgeAt?: string;
    createdAt: string;
    updatedAt: string;
    tasks?: AirdropTask[];
    progressPercent?: number;
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
};

export type ProgressResponse = {
    percent: number;
    completedCount: number;
    totalCount: number;
    userProgress: UserProgress[];
};
