# ⚙️ Web3 Wallet Engine (Read-Only Tracking)

## 📌 1. Overview
The **Web3 Wallet Engine** is the core backend logic powering the Airdrop Tracker Hub (specifically the `My Farming Stats` and `Recent Activity` sections defined in `airdrop.html`).

Instead of forcing users to connect their wallets via MetaMask and sign messages (which can cause friction and security concerns for beginners), this engine utilizes a **"Read-Only Tracking"** model. The user simply inputs their public wallet address (e.g., `0x...`), and the system automatically audits their on-chain activity.

## 🔑 2. Login & Validation Logic
* **Frictionless Onboarding (Read-Only):**
  * The user provides their public EVM address.
  * No `Sign Message` or direct wallet connection is required for basic tracking.
  * This acts as a Read-only Dashboard, making it incredibly fast and safe for users to monitor their airdrop farming progress.
* **Future Scalability:** We can later introduce a full Web3 login (MetaMask/WalletConnect) for advanced features (like executing automated transactions), but Read-Only is the MVP priority.

## 📡 3. The Tracking Architecture (Data Fetching)
Once the server receives the `0x...` address, it acts as an aggregator:
* The backend communicates with specialized **Blockchain Indexing APIs** such as:
  * **Moralis** (Great for cross-chain token balances and NFT checks).
  * **Alchemy** (Excellent for deep raw transaction tracing).
  * **DeBank API** (Perfect for parsing complex DeFi protocol interactions and farming stats).
* The APIs scan multiple networks (Ethereum Mainnet, ZkSync, Linea, Berachain Testnet, etc.) simultaneously.

## 📊 4. UI Integration & Automated Results
The raw data returned from the Blockchain APIs is heavily filtered by our backend before being pushed to the frontend (`airdrop.html`).

### A. "My Farming Stats" (Aggregated Metrics)
The engine calculates global metrics across all tracked networks and pushes them to the UI:
* **Total TXs (Total Transactions):** Calculates the absolute sum of all interactions the wallet has made across supported chains. *(Matches UI: `1,242`)*
* **Wallets Active:** If the user inputs multiple addresses to track, the system groups them. *(Matches UI: `08`)*
* **Total Unrealized Value:** An estimated dollar value of potential airdrops based on the volume and frequency of the tracked transactions.

### B. "Recent Activity" (Activity Feed)
Instead of showing complex transaction hashes (TxHash), the backend translates raw blockchain data into human-readable actions:
* **Filtering:** The system identifies a transaction on the ZkSync network interacting with a DEX router.
* **Translation:** It parses the data and formats a clean string for the UI: *"Swapped 0.2 ETH on ZkSync"*.
* **Real-time Delivery:** The parsed event is displayed in the "Recent Activity" sidebar along with an exact timestamp (e.g., *"2 minutes ago"*).

## 🔀 5. Data Flow Summary
1. **User** inputs Wallet Address (`0x...`).
2. **Backend Engine** validates the format and sends requests to **Moralis/DeBank APIs**.
3. **APIs** return thousands of raw contract interactions.
4. **Backend Engine** processes, filters, and translates data into English sentences and calculated totals.
5. **Frontend (`airdrop.html`)** dynamically updates the **Stats** and **Activity** blocks without page reloads.
