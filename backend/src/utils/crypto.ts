import crypto from 'crypto';

export function hashKey(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
}

const ETHEREUM_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

export function isValidEthereumAddress(address: string): boolean {
    return ETHEREUM_ADDRESS_REGEX.test(address);
}

export function sanitizeString(input: string, maxLength: number): string {
    return input.slice(0, maxLength).replace(/[<>&"']/g, '');
}
