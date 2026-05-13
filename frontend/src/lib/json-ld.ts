export function sanitizeForJsonLd(value: string | null | undefined): string {
    if (!value) return '';
    return String(value)
        .replace(/</g, '\u003c')
        .replace(/>/g, '\u003e');
}