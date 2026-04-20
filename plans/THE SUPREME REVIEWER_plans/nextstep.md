# Phase 10 — Top Movers Widget: Full Implementation

**Proposed by:** Product Visionary
**Date:** April 20, 2026
**Status:** PENDING TECH LEAD APPROVAL

---

## 1. Feature Overview

Replace the current placeholder `TopMovers.tsx` ("Coming Soon" lock icon) with a fully functional, live-updating Top Movers widget in the Home Dashboard right sidebar.

The backend is **already complete** — `GET /market/movers` returns the top 10 gainers from Binance 24hr ticker, filtered by USDT pairs, >$10M quote volume, positive change only, cached 30s.

This is a **frontend-only implementation**.

---

## 2. Current Infrastructure (No Changes Needed)

### Backend Endpoint
- **Route:** `GET /market/movers`
- **Controller:** `getTopMoversController` in `backend/src/controllers/market.controller.ts:461`
- **Service:** `getTopMovers()` in `backend/src/services/binance.service.ts:62`
- **Cache:** 30 seconds via `CacheManager`

### Frontend API
- **Method:** `homeApi.getTopMovers()` in `frontend/src/features/home/api.ts:35`
- **Endpoint:** `/market/movers`
- **Returns:** `TopMover[]`

### Existing Type
```typescript
// frontend/src/features/home/types.ts:46
export type TopMover = {
    symbol: string;
    priceChangePercent: string;
    lastPrice: string;
    volume: string;
    quoteVolume: string;
};
```

### Files to Modify
- `frontend/src/features/home/components/TopMovers.tsx` — FULL REWRITE (currently placeholder)

### Files to Reference (Do NOT modify)
- `frontend/src/features/home/api.ts`
- `frontend/src/features/home/types.ts`
- `frontend/src/features/shared/components/TickerBar.tsx` (already consumes same API, use as reference for polling pattern)
- `frontend/src/features/home/components/MarketMoodGauge.tsx` (reference for loading state and tier-based styling)

---

## 3. User Journey

1. User opens Home Dashboard
2. Right sidebar renders — `TopMovers` shows a loading skeleton for ~1 second
3. First fetch completes — 5 rows appear instantly with rank, symbol, price, 24h change%, and volume bar
4. User scans the list — a coin they don't recognize is surging 18%
5. User clicks that row → navigates to `/terminal/[coin]` for deep AI analysis
6. Every 30 seconds, the list refreshes silently in the background
7. If a new coin enters the top 5, it gets a `NEW` badge for 60 seconds
8. If Binance API fails, last known data persists with a `LIVE DELAYED` indicator

---

## 4. UX Specifications

### 4.1 Layout

```
┌─────────────────────────────────────────┐
│ TOP MOVERS (24H)              ● LIVE    │
├──────┬────────────┬──────────┬──────────┤
│  #   │   ASSET    │   24H    │  VOL     │
├──────┼────────────┼──────────┼──────────┤
│  1   │  ETH  NEW  │ +18.2%   │ ████████ │
│  2   │  SOL       │ +12.4%   │ ██████   │
│  3   │  AVAX      │ +9.1%    │ █████    │
│  4   │  LINK      │ +7.3%    │ ████     │
│  5   │  AAVE      │ +5.8%    │ ███      │
└──────┴────────────┴──────────┴──────────┘
         ↑ clickable → /terminal/[coin]
```

### 4.2 Visual Rules

| Element | Specification |
|---|---|
| **Header** | `text-[10px] font-mono text-[#888] uppercase tracking-[0.2em]` (match existing widgets) |
| **LIVE dot** | `w-1.5 h-1.5 rounded-full bg-emerald-500` with `animate-ping` |
| **Row rank** | `text-[10px] font-mono text-[#555]` |
| **Symbol** | Strip `USDT` suffix. `text-[12px] font-mono text-white font-bold uppercase` |
| **Price** | `$X,XXX.XX` format (or `$0.XXXX` if price < $1). `text-[10px] font-mono text-[#888]` |
| **Change %** | Green `#10b981` for positive. `text-[12px] font-mono font-bold`. Prefix with `+` |
| **Volume bar** | Thin bar `h-1 bg-emerald-500/40`. Width proportional to `quoteVolume` relative to max in the list |
| **NEW badge** | `text-[8px] font-mono text-[#00ff88] border border-[#00ff88]/30 px-1 py-0.5 uppercase`. Fades after 60s |
| **Row hover** | `hover:bg-white/5 transition-colors cursor-pointer` |
| **Container** | Match existing: `bg-[#0A0A0A] border border-[#333] p-6` |

### 4.3 Interactive Behavior

| Behavior | Rule |
|---|---|
| **Click** | Each row is a `<Link href="/terminal/[symbol_without_USDT]">` |
| **Refresh** | `useEffect` with `setInterval` every 30 seconds (same pattern as `TickerBar.tsx`) |
| **First load** | Show skeleton: 5 rows of `animate-pulse` bars |
| **Error** | If fetch fails and no cached data, show: `● LIVE DELAYED` with `text-[#eab308]` and last known data |
| **Empty market** | If 0 movers returned, show: `No significant movers detected` in dimmed text |

### 4.4 Edge Cases

| Edge Case | Solution |
|---|---|
| **Flat market (all < 3% change)** | Change header to `"Market Pulse (24h)"` with subtitle `"Low volatility regime"` in `text-[9px] text-[#555]` |
| **Extreme move (> 40%)** | Add `⚡ EXTREME` badge next to symbol. Slightly dim the row with `opacity-80` to signal caution |
| **Same 5 coins for 3+ consecutive fetches** | Do NOT expand. Keep showing 5 — consistency > variety |
| **Meme coins dominating** | Backend already filters by `quoteVolume > $10M`. Consider raising to `$50M` in future polish (out of scope for this phase) |
| **Mobile layout** | When sidebar stacks below on mobile (`lg:` breakpoint), the table should render full-width with horizontal scroll if needed |
| **Duplicate symbols across fetches** | Use `symbol` as key for React reconciliation — no duplicates possible from Binance API |

### 4.5 NEW Badge Logic

```
State: prevSymbols = Set of symbols from previous fetch
State: newEntries = Map<symbol, timestamp> // when each NEW coin was first detected

On each fetch:
  currentSymbols = Set of top 5 symbols from new data
  freshCoins = currentSymbols - prevSymbols
  for each coin in freshCoins:
    newEntries.set(coin, Date.now())
  
  prevSymbols = currentSymbols

Render:
  For each row, if newEntries.has(symbol) AND (Date.now() - newEntries.get(symbol)) < 60000:
    Show NEW badge
  Clean up newEntries entries older than 60s
```

### 4.6 Volume Bar Logic

```
maxVolume = Math.max(...top5.map(m => parseFloat(m.quoteVolume)))
For each mover:
  barWidth = (parseFloat(mover.quoteVolume) / maxVolume) * 100
  Render: <div style={{ width: `${barWidth}%` }} className="h-1 bg-emerald-500/40" />
```

### 4.7 Extreme Move Detection

```
change = parseFloat(mover.priceChangePercent)
isExtreme = Math.abs(change) >= 40

If isExtreme:
  Show ⚡ EXTREME badge: text-[8px] font-mono text-[#eab308] border border-[#eab308]/30 px-1 py-0.5
  Apply: opacity-80 to the row
```

### 4.8 Flat Market Detection

```
allBelow3 = top5.every(m => Math.abs(parseFloat(m.priceChangePercent)) < 3)

If allBelow3:
  Header changes to: "Market Pulse (24h)"
  Subtitle: "Low volatility regime" — text-[9px] font-mono text-[#555] uppercase
Else:
  Header: "Top Movers (24h)"
```

---

## 5. Loading / Error States

### Loading (First Fetch)
```
┌─────────────────────────────────────┐
│ TOP MOVERS (24H)                    │
├─────────────────────────────────────┤
│  ░░░░  ░░░░░░░░░░  ░░░░  ░░░░░░░  │
│  ░░░░  ░░░░░░░░░░  ░░░░  ░░░░░░░  │
│  ░░░░  ░░░░░░░░░░  ░░░░  ░░░░░░░  │
│  ░░░░  ░░░░░░░░░░  ░░░░  ░░░░░░░  │
│  ░░░░  ░░░░░░░░░░  ░░░░  ░░░░░░░  │
└─────────────────────────────────────┘
```
- 5 rows of `animate-pulse` gray bars (`bg-[#222] h-3`)
- No "LIVE" dot during loading

### Error (Fetch Failed, Has Cached Data)
```
┌─────────────────────────────────────┐
│ TOP MOVERS (24H)      ⚠ LIVE DELAYED│
├─────────────────────────────────────┤
│  [last known data rendered normally]│
└─────────────────────────────────────┘
```
- "LIVE DELAYED" in `text-[9px] font-mono text-[#eab308]` replacing the green dot

### Error (Fetch Failed, No Cached Data)
```
┌─────────────────────────────────────┐
│ TOP MOVERS (24H)                    │
├─────────────────────────────────────┤
│        ● RECONNECTING...            │
│  Market data temporarily unavailable│
└─────────────────────────────────────┘
```
- Centered, dimmed text. Auto-retry on next 30s interval.

---

## 6. Design Constraints

1. **Only 5 rows** in the sidebar widget (not 10) — space is limited in the 30% column
2. **No new packages** — use existing Next.js `Link`, React hooks, and Tailwind
3. **No new backend changes** — the endpoint already returns everything needed
4. **Must match the existing visual language** — monospace fonts, dark theme, minimal borders, no rounded corners, no shadows (except existing patterns)
5. **Must use `'use client'`** — component needs `useState`, `useEffect`, and `setInterval` for polling
6. **Symbol must strip `USDT`** for display AND for the terminal link (e.g., `ETHUSDT` → display `ETH`, link `/terminal/eth`)

---

## 7. Implementation Scope

### Single File Rewrite
- `frontend/src/features/home/components/TopMovers.tsx`

### What This Component Must Do
1. Be a `'use client'` component
2. On mount, call `homeApi.getTopMovers()` and take only the first 5 results
3. Poll every 30 seconds
4. Track previous symbols for NEW badge logic
5. Detect flat market for header swap
6. Detect extreme moves for ⚡ badge
7. Render loading skeleton on first fetch
8. Render error state on failure
9. Each row links to `/terminal/[symbol]`
10. Price formatting: `$X,XXX.XX` if price >= $1, `$0.XXXX` if price < $1

### What This Component Must NOT Do
- Must NOT modify any other component
- Must NOT add new dependencies
- Must NOT create new types (use existing `TopMover` type)
- Must NOT change the API layer
- Must NOT add WebSocket connections (polling only, like TickerBar)
