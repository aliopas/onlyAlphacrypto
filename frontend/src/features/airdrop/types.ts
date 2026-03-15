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
};

export type UserProgress = {
    id: number;
    userId: number;
    projectId: number;
    taskId: number;
    status: 'PENDING' | 'VERIFIED' | 'FAILED';
    txHash?: string;
    verifiedAt?: string;
};

export type ProgressResponse = {
    projectId: number;
    totalTasks: number;
    completedTasks: number;
    progressPercentage: number;
    userProgress: UserProgress[];
};
