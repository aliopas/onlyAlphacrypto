export type Ecosystem = 'ETH' | 'SOL' | 'TON' | 'BNB' | 'Other';
export type EffortLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type RewardConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNVERIFIED';

export interface AirdropProjectInput {
    name: string;
    network: string;
    fundingRound?: string | null;
    twitterUrl?: string | null;
    discordUrl?: string | null;
    websiteUrl?: string | null;
    riskVerdict?: string | null;
    estValue?: string | null;
}

export interface AirdropQualityResult {
    qualityScore: number;
    ecosystem: Ecosystem;
    effortLevel: EffortLevel;
    rewardConfidence: RewardConfidence;
    isEligible: boolean;
}

const ECOSYSTEM_COINS: Record<string, string[]> = {
    ETH: ['ETH', 'BTC'],
    SOL: ['SOL'],
    TON: ['TON'],
    BNB: ['BNB'],
};

function detectEcosystem(project: AirdropProjectInput): Ecosystem {
    const nameLower = project.name.toLowerCase();
    const networkLower = project.network.toLowerCase();

    if (networkLower.includes('ethereum') || networkLower.includes('arb') || networkLower.includes('op') || nameLower.includes('ethereum') || nameLower.includes('layer')) {
        return 'ETH';
    }
    if (networkLower.includes('solana') || nameLower.includes('solana')) return 'SOL';
    if (networkLower.includes('ton') || nameLower.includes('ton')) return 'TON';
    if (networkLower.includes('bnb') || networkLower.includes('bsc') || nameLower.includes('bnb')) return 'BNB';
    return 'Other';
}

function calcEcosystemScore(ecosystem: Ecosystem): number {
    return ecosystem === 'Other' ? 0 : 30;
}

function calcFundingScore(fundingRound: string | null | undefined): number {
    if (!fundingRound) return 6;
    const round = fundingRound.toLowerCase();
    if (round.includes('seed') || round.includes('series a')) return 25;
    if (round.includes('series b') || round.includes('strategic')) return 18;
    if (round.includes('grant') || round.includes('incubator')) return 12;
    return 6;
}

function calcCommunityScore(twitterUrl: string | null | undefined, discordUrl: string | null | undefined): number {
    let score = 0;
    if (twitterUrl) score += 10;
    if (discordUrl) score += 10;
    return score;
}

function calcEffortRewardScore(estValue: string | null | undefined): number {
    if (!estValue || estValue.toLowerCase() === 'tbd' || estValue.trim() === '') {
        return 0;
    }
    const nums = estValue.match(/\d+/g);
    if (!nums || nums.length === 0) return 0;
    const val = parseInt(nums[0], 10);
    if (isNaN(val) || val <= 0) return 0;
    if (val >= 1000) return 15;
    if (val >= 500) return 10;
    if (val >= 100) return 5;
    return 2;
}

function calcRiskScore(riskVerdict: string | null | undefined): number {
    if (!riskVerdict) return 3;
    const v = riskVerdict.toUpperCase();
    if (v === 'LOW' || v === 'SAFE') return 10;
    if (v === 'MEDIUM' || v === 'MEDIUM_RISK') return 5;
    if (v === 'HIGH' || v === 'HIGH_RISK') return 2;
    return 0;
}

export function calculateAirdropQuality(project: AirdropProjectInput): AirdropQualityResult {
    const ecosystem = detectEcosystem(project);

    const ecosystemRaw = calcEcosystemScore(ecosystem);
    const fundingRaw = calcFundingScore(project.fundingRound);
    const communityRaw = calcCommunityScore(project.twitterUrl, project.discordUrl);
    const effortRewardRaw = calcEffortRewardScore(project.estValue);
    const riskRaw = calcRiskScore(project.riskVerdict);

    const maxEcosystem = 30;
    const maxFunding = 25;
    const maxCommunity = 20;
    const maxEffortReward = 15;
    const maxRisk = 10;

    const totalScore = (
        (ecosystemRaw / maxEcosystem) * maxEcosystem +
        (fundingRaw / maxFunding) * maxFunding +
        (communityRaw / maxCommunity) * maxCommunity +
        (effortRewardRaw / maxEffortReward) * maxEffortReward +
        (riskRaw / maxRisk) * maxRisk
    );
    const qualityScore = Math.min(100, Math.max(0, Math.round(totalScore)));

    const isEligible = qualityScore >= 60;

    let effortLevel: EffortLevel = 'HIGH';
    if (qualityScore >= 80) effortLevel = 'LOW';
    else if (qualityScore >= 60) effortLevel = 'MEDIUM';

    let rewardConfidence: RewardConfidence = 'UNVERIFIED';
    if (qualityScore >= 80) rewardConfidence = 'HIGH';
    else if (qualityScore >= 60) rewardConfidence = 'MEDIUM';

    return {
        qualityScore,
        ecosystem,
        effortLevel,
        rewardConfidence,
        isEligible,
    };
}