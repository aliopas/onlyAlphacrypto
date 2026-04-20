# Current Bug Reports & Issues

## 1. Article Content Fails to Load on Direct Navigation (Deep Dive Not Opening)
- **Description:** When navigating directly to a specific token's terminal page (e.g., `/terminal/sol` for Solana) from a search engine result or direct link, the platform only loads the token's price chart. The central panel, which should contain the actual article or "Deep Dive" content, remains stuck on the "Alpha Stream Standby" screen. 
- **Impact:** Users clicking on search results for specific news (e.g., "Solana Futures OI Surges 20%") are not seeing the article they clicked for. Currently, only one article on the site has been observed to open correctly; the rest fail to instantiate the article content.

## 2. Ghost Pages Indexing (Indexing Tokens Without Articles)
- **Description:** Search engines are indexing terminal pages for tokens (e.g., "PEPE Terminal") even if no dedicated article or deep dive content has ever been generated for them. 
- **Impact:** Users find these links on Google, but clicking them leads to an empty terminal (chart only, no article). This results in a poor user experience and potential SEO penalties for thin or "ghost" content.

## 3. SEO Indexing Errors in Google Search Console
- **Description:** Google Search Console is reporting several issues preventing pages from being indexed. The specific errors noted are:
  - **Page with redirect (صفحة تتضمن إعادة توجيه):** 3 pages affected.
  - **Not found 404 (لم يتم العثور عليها):** 1 page affected.
  - **Discovered - currently not indexed (تم اكتشاف الصفحة - لم تتم فهرستها حتى الآن):** 2 pages affected.
- **Impact:** These technical SEO issues are preventing certain URLs from appearing in Google search results, hurting overall organic discoverability and indicating potential broken links or routing misconfigurations.
