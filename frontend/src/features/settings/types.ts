// Types for Settings/Profile feature

export type UserProfile = {
    id: number;
    email: string;
    plan: 'free' | 'pro' | 'institutional';
    isOgGenesis: boolean;
    createdAt: string;
    wallets: UserWallet[];
    preferences: UserPreferences | null;
};

export type UserWallet = {
    id: number;
    userId: number;
    address: string;
    label?: string;
    chains?: string[];
    createdAt: string;
};

export type UserPreferences = {
    id: number;
    userId: number;
    emailAlerts: boolean;
    breakingNewsAlerts: boolean;
    airdropDeadlineAlerts: boolean;
    alphaFocusAlerts: boolean;
    preferredCoins?: string[];
};

export type ApiKey = {
    id: number;
    name: string;
    rateLimit: number;
    lastUsedAt?: string;
    createdAt: string;
    key?: string; // Only present on creation response
};
