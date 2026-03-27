/**
 * Extracts unique cryptocurrency symbols from an array of Reddit titles.
 * Matches:
 * 1. Cashtags like $BTC (removes the $)
 * 2. Standalone uppercase words between 2 and 5 characters (e.g., ETH, SOL)
 */

const BLACKLIST = new Set(['HEY', 'DOG', 'THE', 'AND', 'FOR', 'YOU', 'ARE', 'THIS', 'THAT', 'WITH', 'FROM']);

function isValidSymbol(symbol: string): boolean {
    // Strictly uppercase alphabetical and numbers only, 2-5 chars
    const strictRegex = /^[A-Z0-9]{2,5}$/;
    
    if (!strictRegex.test(symbol)) return false;
    if (BLACKLIST.has(symbol)) return false;
    
    // Check if it's purely numbers (often not a symbol)
    if (/^\d+$/.test(symbol)) return false;

    return true;
}

export function extractSymbolsFromReddit(titles: string[]): string[] {
    const symbols = new Set<string>();

    // Regex for $CASHTAG (e.g., $BTC) - capturing alphanumeric only
    const cashtagRegex = /\$([A-Z0-9]{2,5})\b/g;
    
    // Regex for standalone uppercase words (e.g., ETH)
    const uppercaseRegex = /\b([A-Z0-9]{2,5})\b/g;

    for (const title of titles) {
        // Clean title from emojis/non-ascii to avoid regex weirdness with \b
        const cleanTitle = title.replace(/[^\x00-\x7F]/g, ' ');

        let match;
        // Find $CASHTAGS
        while ((match = cashtagRegex.exec(cleanTitle)) !== null) {
            const sym = match[1].toUpperCase();
            if (isValidSymbol(sym)) {
                symbols.add(sym);
            }
        }

        // Find standalone uppercase words
        while ((match = uppercaseRegex.exec(cleanTitle)) !== null) {
            const sym = match[1].toUpperCase();
            if (isValidSymbol(sym)) {
                symbols.add(sym);
            }
        }
    }

    return Array.from(symbols);
}
