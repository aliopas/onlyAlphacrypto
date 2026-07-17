/**
 * SEO body content (H1, coin overviews, terminal copy).
 * Defaults ON so production indexes real text without a missing env flag.
 * Set SEO_CONTENT_ENABLED=false only to intentionally hide body SEO blocks.
 */
export const SEO_CONTENT_ENABLED =
  process.env.SEO_CONTENT_ENABLED !== 'false';
