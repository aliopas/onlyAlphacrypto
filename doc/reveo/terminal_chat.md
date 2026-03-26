# Terminal Chat Component

## Overview
The `TerminalChat` component occupies the right side of the Terminal interface. It provides two core functions: A live-updating price chart (bar visuals) and an interactive AI chatbot capable of streaming responses.

## Logic & Data Flow
- **Props:** Receives `coin` as a string wrapper for the current targeted coin.
- **Live Price Feed:**
  - A `useEffect` polls the public Binance API `https://api.binance.com/api/v3/ticker/price?symbol=[COIN]USDT` every 10 seconds.
  - Formats the price to 4 decimals (if < $1) or 2 decimals (if > $1).
- **Chat Feed State:**
  - Initializes with a system-style prompt `"Terminal Interface ready. Scanning data streams for $[coin]..."`
  - When the `coin` prop changes, the chat unceremoniously resets its messages to the default prompt for the new coin.
- **Chat Request / Streaming:**
  - Calls `POST /api/chat/stream` natively with the user's message and current coin.
  - Employs `ReadableStream` and `TextDecoder` to parse the `data: ...` chunks dynamically as they arrive.
  - Appends the buffered response letter-by-letter to the UI.

## Potential Bugs & Improvements
- **Binance API Rate Limits:** The component blindly polls Binance's public REST API every 10 seconds. If many users are doing this simultaneously, or if the user leaves the tab open, it could result in rate limiting (`429 Too Many Requests`). **Improvement:** Connect to a WebSocket endpoint (like `wss://stream.binance.com:9443`) for push-based live prices, which consumes fewer resources and is instant.
- **Fake Chart Data:** The volume/candle bars at the top of the pane (`[12, 8, 20, 24, 6, 16].map(...)`) are hardcoded integers designed to look pretty. They do not represent real market data. **Improvement:** Wire this up to actual Binance Kline/Candlestick data to show real 24H volume or price structures.
- **No Chat History Persistence:** The chat resets fully if the user clicks a different asset on the left pane (triggering a `coin` prop update). **Improvement:** Store conversation histories indexed by the `coin` symbol in `sessionStorage` or application context so switching back and forth doesn't wipe the chat.
