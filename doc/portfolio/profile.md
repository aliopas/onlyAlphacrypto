# ⚙️ Settings & User Profile — Master Engineering Architecture

## 📌 1. Overview
The **Settings & Profile** page is the user's central control panel. It goes far beyond simple password changes — it is the **security and identity hub** of the platform, serving three distinct roles:
1. **Web3 Identity Layer** — Managing and verifying the user's blockchain wallet addresses.
2. **API Distribution Gateway** — Issuing cryptographic keys for developers building on top of OnlyAlpha's data.
3. **Security & Session Manager** — Tracking all active sessions with remote revocation capability.

> This page's existence signals that OnlyAlpha is architected for **institutional scalability**, not just individual use.

## 🔗 2. Sub-Feature Documentation
All logic is contained within this single master document. Design reference: `profil.html`.

---

## 🏗️ 3. UI Components → Backend Logic Mapping

| UI Section | Powered By | Data Source | Key Action |
|---|---|---|---|
| **Identity Profile** | Auth Engine (NextAuth / JWT) | `users` DB table | Display user ID, OG badge, email |
| **Public Wallet Tracking** | Web3 Verification Engine | `user_wallets` DB table | Validate address, trigger Airdrop tracking |
| **Developer API** | API Gateway (Node.js + Redis) | `api_keys` DB table | Generate key, enforce rate limits |
| **Alerts & Notifications** | User Preferences Engine | `user_preferences` DB table | Toggle notification flags |
| **Active Sessions** | Session Manager (Redis) | `sessions` DB table | Track devices, remote revoke tokens |

---

## ⚙️ 4. Core Feature Logic

### 👤 4.1 Identity Profile
* **User ID Format:** Platform-generated unique ID (e.g., `OA-9921-X`) assigned upon registration.
* **OG Genesis Badge:** A `is_og_genesis` boolean flag in the `users` table. Set to `true` only for users who registered during the platform's founding period (e.g., first 1,000 users). This is immutable — cannot be purchased or earned after the cutoff.
* **Edit Details:** Updates go through a standard `PATCH /api/user/profile` endpoint with server-side validation.

### 🦊 4.2 Public Wallet Tracking
The entry point for the entire **Web3 feature ecosystem** of the platform.

* **Slot Quota (10 max):** Enforced at the backend to protect Moralis API consumption. Attempting to add an 11th wallet returns a `403 Limit Reached` error.
* **Validation (Checksum):** On submission, the server runs `Web3.utils.isAddress(address)` (from `web3.js` or `ethers.js`) to validate the EVM checksum. No wallet signature (Sign Message) is required at this stage — keeping onboarding frictionless.
* **Cross-Feature Trigger:** The critical integration point. The moment a new wallet is saved to `user_wallets`, the server fires an internal **event** to the **Airdrop Auto-Verification Engine** and the **Web3 Wallet Engine**, instructing them to begin fetching the transaction history for this address immediately.

```
User adds wallet → Server validates checksum → Save to user_wallets
    └──► Event fired → Airdrop Hunter begins tracking this wallet
    └──► Web3 Wallet Engine fetches transaction history (Moralis)
    └──► Stats & Recent Activity populate on Airdrop page
```

### 🔑 4.3 Developer API Gateway
* **Key Generation:** Pressing `GENERATE KEY` sends a `POST /api/developer/keys` request. The server generates a **cryptographically random string** (e.g., using `crypto.randomBytes(32)`) prefixed with `oa_live_sk_`. The raw key is displayed **exactly once** to the user (like AWS/Stripe), then only its **hash** is stored in the database.
* **Rate Limiting (Redis):** Every incoming API request with a key hits a Redis counter: `INCR api:usage:{keyId}`. The counter resets on the first day of each month. If the count exceeds 10,000 (free tier), the gateway returns `429 Too Many Requests`.
* **Monthly Quota Indicator:** The UI counter (`1,242 / 10,000 req`) is read from the live Redis counter via a `GET /api/developer/usage` endpoint, polled every time the Settings page loads.

### 🔔 4.4 Alerts & Notifications
Simple boolean flags stored in the `user_preferences` table, toggleable via a `PATCH /api/user/preferences` endpoint:
- `airdrop_alerts_enabled` → Push notification when a tracked project's Snapshot is detected
- `ai_signals_enabled` → Push notification for high-impact radar signals
- `newsletter_enabled` → Weekly ecosystem alpha email digest

### 🛡️ 4.5 Active Sessions (Security Layer)
* **Session Tracking:** On every login, the server captures:
  - `user_agent` → Parsed to extract OS and browser name (e.g., `MacOS / Chrome`)
  - `ip_address` → Reverse-geocoded to city/country (e.g., `London, UK`)
  - `created_at` → Session start time
  - `refresh_token_hash` → Hashed refresh token bound to this session
* **Remote Revocation (`REVOKE` button):** Deletes the `refresh_token_hash` for the target session from the `sessions` table. The next time that device attempts to refresh its access token, the server detects the token is invalid and forces a logout.
* **Terminate All:** Same logic applied to every session record for the user except the current one, instantly logging out all other devices.

---

## 🗄️ 5. Database Schema

```typescript
// Core user identity
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  platformId: varchar('platform_id', { length: 20 }).notNull().unique(), // 'OA-9921-X'
  email: varchar('email', { length: 255 }).notNull().unique(),
  isOgGenesis: boolean('is_og_genesis').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Tracked wallet addresses per user
export const userWallets = pgTable('user_wallets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  walletAddress: varchar('wallet_address', { length: 100 }).notNull(),
  isVerified: boolean('is_verified').default(true),  // checksum validated
  addedAt: timestamp('added_at').defaultNow().notNull(),
});

// Developer API keys
export const apiKeys = pgTable('api_keys', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  keyHash: varchar('key_hash', { length: 255 }).notNull(),  // Never store raw key
  monthlyQuota: integer('monthly_quota').default(10000),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at'),
});

// Active login sessions
export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  refreshTokenHash: varchar('refresh_token_hash', { length: 255 }).notNull(),
  userAgent: text('user_agent'),
  ipAddress: varchar('ip_address', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastActiveAt: timestamp('last_active_at').defaultNow().notNull(),
});

// User notification preferences
export const userPreferences = pgTable('user_preferences', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull().unique(),
  airdropAlertsEnabled: boolean('airdrop_alerts_enabled').default(true),
  aiSignalsEnabled: boolean('ai_signals_enabled').default(true),
  newsletterEnabled: boolean('newsletter_enabled').default(false),
});
```

---

## 🔀 6. Cross-Feature Integration
The Profile page is the **trigger point** for cross-platform data flows:

```
User adds Wallet Address
    ├──► user_wallets table (Settings page owns this)
    ├──► Airdrop Tracker: starts auto-verification for this wallet
    └──► Home Page Airdrop Watchlist: personalized to this wallet

User generates API Key
    ├──► api_keys table (hashed key stored)
    └──► Redis: monthly usage counter initialized for this key
```
