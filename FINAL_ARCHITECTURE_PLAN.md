# 🛡️ OnlyAlpha — Final Engineering Architecture & Remediation Plan
> **Objective:** Restore production stability, eliminate AI hallucinations, and implement a sustainable, zero-cost data gathering pipeline.

---

## 🏗️ 1. The New Data Flow (V2.0)
The system is now independent of expensive/unstable third-party aggregators.

### **Phase 1A: Gathering (Every 10 Minutes)**
- **Source A (News):** `RSS Scraper` (Direct connections to CoinDesk, Cointelegraph, Decrypt, The Block).
- **Source B (New Gems):** `DexScreener Boosts` (Detects hype coins on chain).
- **Source C (Sentiment):** `Reddit Service` (Fetches hot/rising topics from r/CryptoCurrency).

### **Phase 1B: Triage (GPT-nano)**
- **Input:** Raw headlines + DexScreener signals.
- **Goal:** Filter noise. Determine `impactScore`. Look for associated `coinSymbol`.
- **Threshold:** Score ≥ 70 → Forward to Deep Analysis (Phase 2).

### **Phase 2: Deep Analysis (DeepSeek R1)**
- **Context:** News + Reddit Sentiment + Binance/DexScreener Price Data.
- **Output:** Professional Analysis (800+ words) + Radar Signal summary.

### **Phase 3: SEO & Publishing (GPT-nano)**
- **Goal:** Refine headlines and metatags without changing the analysis.
- **Output:** JSON for DB/Redis storage.

---

## 🛠️ 2. Critical Remediation Priorities

### **P0: Infrastructure & Security (Immediate)**
1. **DB Schema Sync:** Run `npx drizzle-kit push` to fix missing `published_at` column.
2. **Environment Cleanup:** Remove invalid `CRYPTOCOMPARE_API_KEY`.
3. **Universal Language Mandate:** Apply English-only constraints to all prompts in `prompt-factory.ts`.

### **P1: Logic & UI Stability**
1. **RSS Migration:** Replace `CryptoCompare` fetching logic in `terminalEngine.cron.ts`.
2. **Terminal Highlighting:** Remove "Coin Filter" from `TerminalWire.tsx`. Show ALL signals, use URL param only for visual highlighting.
3. **Chat Deadlock:** Remove the `disclaimerAccepted === null` block in `useTerminalChat.ts`.
4. **Chat Mode Match:** Change frontend mode name from `private` to `context` to match Backend expectations.

### **P2: Performance & Data Fallbacks**
1. **Price Fallback:** Modify `binance.service.ts` to use `DexScreener` if Binance returns no price for a ticker.
2. **SSE Parser Fix:** Update string slicing in `useTerminalChat.ts` to prevent stream breakage.

---

## 🔒 3. The Universal Language Mandate
Every System Prompt MUST start with this non-negotiable block:

```text
CRITICAL LANGUAGE RULE — NON-NEGOTIABLE:
You MUST write ALL output exclusively in English.
Do NOT output Arabic, Chinese, Korean, Japanese, or any non-English characters.
If input data contains non-English text, translate it to English before using it.
Violation of this rule makes the entire output invalid.
```

---

## 🤖 4. Model Routing Summary
- **Analysis:** `DeepSeek-R1` (Heavy thinking, logic, deep crypto context).
- **SEO/Format/Chat:** `GPT-5-nano` (Fast, low-cost, accurate formatting).

---
**Status:** ✅ Architecture Finalized  
**Authorized by:** AI Director of Engineering  
**Implementation Ready.**
