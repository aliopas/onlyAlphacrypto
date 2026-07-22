/**
 * Gate-1 fast filter (DEC-041 AD-3) — spam / scam patterns / junk.
 * No AI. Mood is not considered.
 */

export interface Gate1Input {
    title?: string | null;
    body?: string | null;
    urls?: string[];
}

export interface Gate1Result {
    pass: boolean;
    reasons: string[];
}

const HARD_SCAM: RegExp[] = [
    /\bphishing\b/i,
    /\bhoneypot\b/i,
    /\brug\s*pull\b/i,
    /\bfake\s+airdrop\b/i,
    /\bseed\s*phrase\b/i,
    /\bprivate\s*key\b/i,
    /\bconnect\s+wallet\s+to\s+claim\b/i,
    /\bdrainer\b/i,
    /t\.me\/joinchat/i,
    /\bguaranteed\s+(profit|returns?)\b/i,
    /\bsend\s+\d+\s*(eth|bnb|sol)\b/i,
];

const SPAM_JUNK: RegExp[] = [
    /\bclick\s+here\s+now\b/i,
    /\bsend\s+dm\b/i,
    /\bdm\s+me\b/i,
    /\b100x\b/i,
    /\bpump\s+signal\b/i,
    /💰.*free.*money/i,
    /\bfollow\s+and\s+retweet\s+only\b/i,
];

const MIN_BODY_LEN = 40;

export function runGate1(input: Gate1Input): Gate1Result {
    const text = `${input.title ?? ''}\n${input.body ?? ''}`.trim();
    const reasons: string[] = [];

    if (text.length < MIN_BODY_LEN) {
        reasons.push('too_short');
        return { pass: false, reasons };
    }

    for (const p of HARD_SCAM) {
        if (p.test(text)) {
            reasons.push('hard_scam_pattern');
            return { pass: false, reasons };
        }
    }

    let spamHits = 0;
    for (const p of SPAM_JUNK) {
        if (p.test(text)) spamHits += 1;
    }
    if (spamHits >= 2) {
        reasons.push('spam_density');
        return { pass: false, reasons };
    }

    const urls = input.urls ?? [];
    const suspiciousUrl = urls.some(
        (u) =>
            /bit\.ly|tinyurl|t\.co\/|cutt\.ly|rb\.gy/i.test(u) &&
            !/twitter\.com|x\.com|github\.com|docs\./i.test(u)
    );
    if (suspiciousUrl && spamHits >= 1) {
        reasons.push('suspicious_short_url');
        return { pass: false, reasons };
    }

    return { pass: true, reasons: [] };
}

/** Aggregate Gate-1 across multiple signal texts for one entity. */
export function runGate1OnCorpus(parts: Gate1Input[]): Gate1Result {
    if (parts.length === 0) {
        return { pass: false, reasons: ['no_signals'] };
    }

    let failCount = 0;
    const reasons: string[] = [];
    for (const p of parts) {
        const r = runGate1(p);
        if (!r.pass) {
            failCount += 1;
            for (const reason of r.reasons) {
                if (!reasons.includes(reason)) reasons.push(reason);
            }
        }
    }

    // Reject entity only if majority of signals fail hard, or any hard_scam
    if (reasons.includes('hard_scam_pattern')) {
        return { pass: false, reasons };
    }
    if (failCount === parts.length) {
        return { pass: false, reasons: reasons.length ? reasons : ['all_signals_failed_gate1'] };
    }

    return { pass: true, reasons: [] };
}
