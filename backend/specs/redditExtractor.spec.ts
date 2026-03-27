import { extractSymbolsFromReddit } from '../src/utils/redditExtractor';

describe('redditExtractor - extractSymbolsFromReddit', () => {
    it('should extract unique uppercase symbols and cashtags from Reddit titles', () => {
        const titles = [
            "Is $BTC going to the moon?",
            "I just bought some SOL and ETH",
            "Market is crashing",
            "What about $ETH and eth?",
            "Check out LINK and $DOT",
            "Multiple $BTC $BTC $BTC should be unique"
        ];

        const expected = ["BTC", "SOL", "ETH", "LINK", "DOT"];
        const result = extractSymbolsFromReddit(titles);

        expect(result.sort()).toEqual(expected.sort());
    });

    it('should ignore common words and emojis', () => {
        const titles = [
            "Hey $DOG 🟣",
            "THE price is high AND DOG is low",
            "FOR YOU AND ME",
            "Wait for the $PEPE 🐸",
            "Is HEY a symbol? No."
        ];

        const result = extractSymbolsFromReddit(titles);
        // DOG, THE, AND, FOR, YOU, HEY should be ignored.
        // PEPE should be kept.
        expect(result).toEqual(["PEPE"]);
    });

    it('should handle alphanumeric symbols but not pure numbers', () => {
        const titles = [
            "Check out $WIF and $A8",
            "I like 1000 and 12345",
            "Symbol $404 is valid"
        ];
        const result = extractSymbolsFromReddit(titles);
        expect(result).toContain("WIF");
        expect(result).toContain("A8");
        expect(result).toContain("404");
        expect(result).not.toContain("1000");
    });

    it('should extract 2-5 character uppercase symbols only', () => {
        const titles = ["ABC", "ABCD", "ABCDE", "ABCDEF", "AB"];
        const result = extractSymbolsFromReddit(titles);
        expect(result).toContain("ABC");
        expect(result).toContain("ABCD");
        expect(result).toContain("ABCDE");
        expect(result).toContain("AB");
        expect(result).not.toContain("ABCDEF");
    });
});
