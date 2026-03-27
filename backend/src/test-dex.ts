import { getTopBoostedTokens, getTokenData } from './services/dexscreener.service';

async function runTest() {
    console.log("=== Testing DexScreener API ===");
    console.log("\n1) Testing getTopBoostedTokens()...");
    const tokens = await getTopBoostedTokens();
    
    if (tokens && tokens.length > 0) {
        console.log(`✅ Success: Fetched ${tokens.length} tokens.`);
        console.log("First 3 tokens:", tokens.slice(0, 3));
        
        console.log(`\n2) Testing getTokenData() with address: ${tokens[0].address} (${tokens[0].symbol})`);
        const tokenInfo = await getTokenData(tokens[0].address);
        console.log("Result:", tokenInfo);
    } else {
        console.log("❌ Failed to fetch boosted tokens (returned empty or errored).");
        
        console.log("\n2) Testing getTokenData() with fallback address (Wrapped SOL on Solana)...");
        const fallbackAddress = 'So11111111111111111111111111111111111111112';
        const tokenInfo = await getTokenData(fallbackAddress);
        console.log("Result:", tokenInfo);
    }
}

runTest().catch(console.error);
