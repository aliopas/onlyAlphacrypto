const https = require('https');

/**
 * Super Simple Zero-Dependency Fetcher
 */
function fastFetch(url) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: { 'User-Agent': 'Mozilla/5.0 (OnlyAlpha-Test-Engine/4.1)' }
        };
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 400) {
                    reject(new Error(`HTTP ${res.statusCode} from ${url}`));
                } else {
                    resolve({
                        data,
                        status: res.statusCode,
                        isJson: res.headers['content-type']?.includes('application/json'),
                        isXml: res.headers['content-type']?.includes('xml') || data.trim().startsWith('<')
                    });
                }
            });
        }).on('error', (err) => reject(err));
    });
}

async function runMasterSourceTest() {
    console.log("🛠️  Starting Master Source Connectivity Test (v4.1)...");
    console.log("--------------------------------------------------\n");

    const tests = [
        { name: "1. RSS (Cointelegraph)", url: "https://cointelegraph.com/rss" },
        { name: "2. Google News RSS", url: "https://news.google.com/rss/search?q=bitcoin+crypto+ETF&hl=en&gl=US&ceid=US:en" },
        { name: "3. DexScreener Boosts", url: "https://api.dexscreener.com/token-boosts/top/v1" },
        { name: "4. DexScreener Price (SOL)", url: "https://api.dexscreener.com/latest/dex/search?q=SOL" },
        { name: "5. Binance Public API (BTC)", url: "https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT" },
        { name: "6. Wikipedia REST API (Solana)", url: "https://en.wikipedia.org/api/rest_v1/page/summary/Solana_(blockchain)" }
    ];

    for (const test of tests) {
        process.stdout.write(`Testing ${test.name}... `);
        try {
            const res = await fastFetch(test.url);
            let snippet = "";
            
            if (res.isJson) {
                const parsed = JSON.parse(res.data);
                // Print a small snippet of the data to prove it's real
                if (Array.isArray(parsed)) snippet = `[Array size: ${parsed.length}] First item key: ${Object.keys(parsed[0]||{})[0]}`;
                else if (parsed.pairs) snippet = `[Found ${parsed.pairs.length} pairs] Price: $${parsed.pairs[0].priceUsd}`;
                else if (parsed.lastPrice) snippet = `Price: $${parsed.lastPrice}`;
                else if (parsed.extract) snippet = `Extract: ${parsed.extract.slice(0, 40)}...`;
            } else if (res.isXml) {
                snippet = `[XML Detected] Starts with: ${res.data.slice(0, 50).replace(/\n/g, '')}...`;
            }

            console.log(`✅ OK (${res.status})`);
            if (snippet) console.log(`   └─ Data: ${snippet}`);
        } catch (error) {
            console.log(`❌ FAILED`);
            console.log(`   └─ Error: ${error.message}`);
        }
        console.log("");
    }

    console.log("--------------------------------------------------");
    console.log("🏁 Test Cycle Complete.");
}

runMasterSourceTest();
