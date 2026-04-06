🔬 OnlyAlpha — Engineering Audit & Master Remediation Plan
PART 1: DEEP AUDIT — Root Cause Analysis
🔴 Bug 1 — Language Hallucination (Arabic/Chinese in Articles)
Root Cause — prompt-factory.ts:

DeepSeek-R1 مدرَّب بشكل ضخم على بيانات صينية. لا يوجد في أي prompt من prompts الحالية أي توجيه صريح للغة. النموذج يُطابق لغة المُدخَلات تلقائيًا — إذا كان الخبر عن مشروع صيني أو مصدره موقع صيني، ينزلق R1 للصينية.

الملفات المتأثرة (لا يوجد فيها language constraint):

buildDeepSynthesisMessages — الأخطر (مقال 800+ كلمة)
buildDualNewsStep1Messages — التحليل العميق (DeepSeek)
buildDualNewsStep2Messages — SEO formatting (GPT-nano)
buildDeepIntelligenceMessages
buildChatMessages (كلا الـ modes)
الحل: إضافة هذا الـ block كأول سطر في كل system prompt:

CRITICAL LANGUAGE RULE — NON-NEGOTIABLE:
You MUST write ALL output exclusively in English.
Do NOT output Arabic, Chinese, Korean, Japanese, or any non-English characters — not even in JSON values.
If input contains non-English text, translate it to English first.
Violation makes the entire output invalid and it will be rejected.
🟡 Bug 2 — AI Pipeline Model Delegation
الوضع الحالي (مؤكَّد بقراءة openai.service.ts):

المرحلة	النموذج المستخدم	الحالة
Step 1 — Deep Analysis	env.ANALYSIS_MODEL → DeepSeek-R1	✅ صحيح
Step 2 — SEO Formatting	env.SEO_MODEL → GPT-5-nano	✅ صحيح
Triage	env.SEO_MODEL → GPT-nano	✅ صحيح
Chat	env.SEO_MODEL → GPT-nano	✅ صحيح
المشكلة: التوثيق لا يزال يذكر GLM-5 في الـ comments (legacy artifact). وPrompt الـ Step 2 لا تُخبر GPT-nano صراحةً أن دورها formatting فقط — لا تحليل، لا رأي جديد. هذا يسمح لها بالانحراف.

الحل: تنظيف الـ comments + تقوية Step 2 prompt.

🔴 Bug 3 — Chart Data Fallback (Binance → DEX)
Root Cause — binance.service.ts:

typescript
// اللتان تفشلان بصمت:
export async function getLivePrice(symbol: string) { ... return null; }
export async function getCoinKlines(symbol: string) { ... return []; }
كلتاهما تبتلعان الخطأ وتعودان بـ null / [] — لا fallback. الـ dexscreener.service.ts موجود ومجهَّز بـ getTokenData(address) يعطي priceUsd, priceChange24h, volume24h — كل ما نحتاجه. المشكلة الوحيدة: DEX يحتاج contract address مش ticker symbol.

الحل — getChartDataWithFallback(symbol):

typescript
async function getChartDataWithFallback(symbol: string) {
  // 1. جرب Binance
  const klines = await getCoinKlines(symbol);
  if (klines.length > 0) return { source: 'binance', data: klines };
  
  // 2. Fallback → DEX Screener search by symbol
  const dexRes = await axios.get(
    `https://api.dexscreener.com/latest/dex/search?q=${symbol}`
  );
  const bestPair = dexRes.data.pairs
    ?.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
  
  if (!bestPair) return null;
  
  // 3. Normalize to same candle format
  return { source: 'dex', price: bestPair.priceUsd, ... };
}
🔴 Bug 4 — Terminal UI Routing Bug (أهم بق في الـ UI)
Root Cause — TerminalWire.tsx lines 40-42:

tsx
// هنا المشكلة:
const filteredRadar = targetedCoin
    ? radarSignals.filter(r => r.coin?.toLowerCase() === targetedCoin.toLowerCase())
    : radarSignals;
وفي TerminalPageClient.tsx line 81:

tsx
<TerminalWire
    targetedCoin={selectedCoin}  // ← هنا الخطأ
    news={initialNews}
    ...
/>
تسلسل الخطأ:

المستخدم يضغط على كارت BTC من الـ Home
يُوجَّه إلى /terminal?coin=BTC
coin="BTC" يُمرَّر كـ prop
selectedCoin يُصبح "BTC" (مع fallback || 'SOL' في السطر 70)
يُمرَّر لـ TerminalWire كـ targetedCoin
الـ filter يُبقي فقط signals الـ BTC
إذا لا يوجد signals لـ BTC → اللوحة اليسارية فارغة تمامًا
الحل:

tsx
// قبل (الخطأ):
const filteredRadar = targetedCoin
    ? radarSignals.filter(r => r.coin?.toLowerCase() === targetedCoin.toLowerCase())
    : radarSignals;
// بعد (الصحيح):
const filteredRadar = radarSignals; // دايمًا كل الـ signals
// واستخدم targetedCoin فقط للـ visual highlight:
const isTargeted = (coin?: string) =>
    targetedCoin && coin?.toLowerCase() === targetedCoin.toLowerCase();
ثم في الـ card styling:

tsx
className={`... ${isTargeted(item.coin) ? 'border-amber-400 ring-1 ring-amber-400/50' : 'border-[#333]'}`}
🔴 Bug 5 — Broken AI Chat (3 مشاكل متراكمة)
Layer 1 — Disclaimer Gate Deadlock (useTerminalChat.ts lines 68-69):

typescript
// المشكلة: null يمنع الإرسال طول فترة تحميل الـ API
if (disclaimerAccepted === false) return;
if (disclaimerAccepted === null) return; // ← DEADLOCK هنا
إذا /chat/disclaimer-status بطيء أو فاشل → disclaimerAccepted يبقى null → المستخدم يكتب ويضغط send → لا يحدث شيء، بدون أي رسالة خطأ.

الحل:

typescript
// Graceful timeout: بعد 3 ثواني إذا ما جاء الرد، نعتبرها مقبولة
useEffect(() => {
    const timeout = setTimeout(() => {
        if (disclaimerAccepted === null) setDisclaimerAccepted(true);
    }, 3000);
    return () => clearTimeout(timeout);
}, [disclaimerAccepted]);
Layer 2 — Mode Type Mismatch (Critical):

tsx
// TerminalChat.tsx line 45 — خطأ:
onClick={() => setMode('private')}
// useTerminalChat.ts line 4 — خطأ:
export type ChatMode = 'general' | 'private';
// openai.service.ts line 388 — الـ backend يتوقع:
mode?: 'general' | 'context'
النتيجة: الـ backend يستقبل mode: 'private' → لا يطابق أي branch في buildChatMessages → يسقط دائمًا على General mode → Context Mode لا يعمل أبدًا.

الحل (3 ملفات):

tsx
// TerminalChat.tsx line 45:
onClick={() => setMode('context')}  // ← تغيير 'private' لـ 'context'
// useTerminalChat.ts line 4:
export type ChatMode = 'general' | 'context';  // ← تغيير النوع
Layer 3 — SSE Stream Parse Bug:

typescript
// useTerminalChat.ts lines 101-103 — خطأ:
const chunk = line.replace('data:', '').trim();
// replace() بتشيل أول occurrence فقط
// وإذا كان الـ chunk نفسه يحتوي 'data:' هيتكسر
// الصح:
const chunk = line.slice(5).trim(); // 'data:' = 5 characters دايمًا
🔴 Bug 6 — Production Logs Analysis
من logs.md — 3 فئات فشل:

❌ Failure A — /api/market/wire → 500 (تكرر 10+ مرات)
Error: Failed query: select ... from "coin_news" order by "coin_news"."published_at" desc limit $1
at NodePgPreparedQuery.queryWithCache
التشخيص: الـ published_at column موجودة في Drizzle ORM schema لكن غير موجودة في قاعدة البيانات الفعلية — migration drift. Postgres بيعطي column "published_at" does not exist وDrizzle بيلفّه كـ "Failed query".

الحل:

bash
# Option 1: تشغيل migrations
npx drizzle-kit push
# Option 2: إضافة العمود يدويًا
ALTER TABLE coin_news ADD COLUMN published_at TIMESTAMPTZ DEFAULT NOW();
❌ Failure B — CryptoCompare API Key فاشل
{"Response":"Error","Message":"You need a valid auth key or api key"}
التشخيص: CRYPTOCOMPARE_API_KEY في .env إما مش موجود أو منتهي الصلاحية. هذا يُعطِّل الـ pipeline بالكامل:

Phase 1A (TerminalEngine): لا أخبار تُجمَع ❌
Phase 1B (TriageEngine): لا شيء يُصفَّى ❌
Phase 2 (AI Workflow): No high-scoring items to analyze ❌
النتيجة: صفر مقالات جديدة
الحل: تجديد المفتاح + إضافة fallback source (CryptoPanic مجاني) في terminalEngine.cron.ts.

❌ Failure C — SIGTERM (Server أُعيد تشغيله 3 مرات)
npm error signal SIGTERM
npm error command sh -c node dist/server.js
التشخيص: ليست مشكلة كود — هي cascading failure: wire → 500 → health check فشل → orchestrator (Render/Docker) أرسل SIGTERM → restart → تكرار.

الحل: فصل wire query عن health check. الـ server يُبلَّغ بـ "healthy" طالما DB متصل، حتى لو endpoint معين فاشل.

🟡 Bug 7 — Architecture & Polish
❌ لا يوجد README.md في root
❌ coin vs coinSymbol غير متسق في TerminalWire.tsx line 79: n.coin || n.coinSymbol
❌ لا يوجد global error boundary في الـ frontend
❌ rouls.md في الـ root (typo — يجب أن يكون rules.md)
PART 2: MASTER REMEDIATION PLAN
أولويات التنفيذ
الأولوية	المهمة	الملف	الخطورة
P0	إصلاح DB migration drift	DB / drizzle	🔴 مرتفعة
P0	تجديد CryptoCompare API key	.env	🔴 مرتفعة
P0	إضافة English mandate لكل الـ prompts	prompt-factory.ts	🟡 متوسطة
P0	إصلاح mode mismatch (private → context)	TerminalChat.tsx + useTerminalChat.ts	🟢 منخفضة
P0	إصلاح disclaimer deadlock	useTerminalChat.ts	🟢 منخفضة
P1	إزالة coin filter من TerminalWire	TerminalWire.tsx	🟢 منخفضة
P1	إصلاح targetedCoin scope	TerminalPageClient.tsx	🟢 منخفضة
P1	إصلاح SSE stream parser	useTerminalChat.ts	🟢 منخفضة
P1	Binance → DEX fallback	binance.service.ts	🟡 متوسطة
P2	تقوية GPT-nano Step 2 prompt	prompt-factory.ts	🟢 منخفضة
P2	حذف comments القديمة (GLM-5)	openai.service.ts	🟢 منخفضة
P2	توحيد coin/coinSymbol	TerminalWire.tsx	🟢 منخفضة
P2	Frontend global error boundary	app/error.tsx	🟢 منخفضة
P2	كتابة README.md	/OnlyAlpha/README.md	لا يوجد
PART 3: HARDENED SYSTEM PROMPTS
🔒 Universal Language Mandate (يُضاف كأول سطر في كل prompt)
CRITICAL LANGUAGE RULE — NON-NEGOTIABLE:
You MUST write ALL output exclusively in English.
Do NOT output Arabic, Chinese, Korean, Japanese, or any non-English characters — not even inside JSON string values.
If input data contains non-English text, translate it to English before using it.
Violation of this rule makes the entire output invalid.
DeepSeek-R1: Step 1 — Deep Analysis
CRITICAL LANGUAGE RULE — NON-NEGOTIABLE:
All output MUST be in English only. Translate any non-English input before use.
You are an elite cryptocurrency news analyst (Deep Analysis Engine — DeepSeek R1).
Your role is ANALYSIS ONLY. Do NOT write article copy or SEO content.
A separate formatting engine handles that.
Return STRICT JSON:
{
  "analysis": "<3-4 sentence in-depth analysis. English ONLY.>",
  "sentiment": "bullish|bearish|neutral",
  "impactScore": <0-100>,
  "isBreaking": <true if: Snapshot/TGE/Claim/Hack/Exploit/SEC/Crash/Listing; else false>,
  "coinSymbol": "<uppercase ticker if identifiable, else null>",
  "signalText": "<2 English sentences MAX 40 words. Include price level or % data.>",
  "keyFacts": ["<English fact 1>", "<English fact 2>", "<English fact 3>"]
}
GPT-nano: Step 2 — SEO Formatter
CRITICAL LANGUAGE RULE — NON-NEGOTIABLE:
All output MUST be in English only.
You are an expert crypto SEO content editor (Formatting Engine ONLY — GPT-nano).
DO NOT generate new analysis. DO NOT form new opinions. ONLY reformat the input JSON.
Return STRICT JSON:
{
  "headline": "<SEO-rich, action-verb title, keyword-first, MAX 15 words. English ONLY.>",
  "hook": "<1 powerful opening sentence. Urgency or curiosity. English ONLY.>",
  "summary": "<Hook + 3-4 sentences from input analysis/keyFacts. Price levels and % from input. English ONLY.>",
  "metaTitle": "<Max 60 chars. Format: 'Keyword Action | OnlyAlpha'. English ONLY.>",
  "metaDescription": "<Max 160 chars. Keyword + insight + CTA: 'Read the full analysis on OnlyAlpha.' English ONLY.>",
  "seoKeywords": ["<primary>", "<secondary>", "<long-tail>", "<coin+action>", "<trend keyword>"]
}
DeepSeek-R1: Deep Synthesis (buildDeepSynthesisMessages)
CRITICAL LANGUAGE RULE — NON-NEGOTIABLE:
All output MUST be in English only. No non-English characters anywhere in the JSON.
You are an elite cryptocurrency deep analysis engine (DeepSeek R1 — Heavy Analysis).
Return STRICT JSON:
{
  "executiveSummary": "<4-6 English sentences. WHY behind market action with specific data points.>",
  "keyDrivers": ["<English reason 1>", "<English reason 2>", "<English reason 3>", "<English reason 4>"],
  "marketContext": "<2-3 English sentences on broader market context.>",
  "riskAssessment": "LOW|MEDIUM|HIGH",
  "redFlags": ["<English flag 1>", "<English flag 2>"],
  "confidenceScore": <0-100>,
  "fullArticle": "<800+ word article. English ONLY. Structure: 1) Hook. 2) Executive Brief. 3) Deep Analysis with data. 4) Historical Context. 5) Red Flags. 6) Trader Implications.>"
}
Rules: All English. 800+ word fullArticle. Be specific with numbers. Clear actionable analysis.
GPT-nano: Chat — General Mode
CRITICAL: Respond in English ONLY.
You are 'Ask OnlyAlpha', an elite concise crypto analyst.
Coin: {symbol} | Price: ${price} | Context: {newsSummary}
Rules:
1. English only — always.
2. Bullet points where possible. Under 50 words unless asked.
3. No direct financial advice — use "Historically," or "Data suggests..."
4. Only discuss crypto markets.
GPT-nano: Chat — Context Mode
CRITICAL: Respond in English ONLY.
You are 'Ask OnlyAlpha' in Context Mode — deep analysis assistant.
Coin: {symbol} | Price: ${price}
Rules:
1. English only — always.
2. Focus on the selected article/signal.
3. Cross-reference latest market updates.
4. Use specific numbers, price levels, timeframes.
5. Highlight developments confirming or contradicting the original analysis.
6. No direct financial advice.
7. Responses up to 200 words in this mode.
 the dp prp has been updated and solved