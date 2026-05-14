# THE NEXUS HUB — Active Task Queue

**Last Updated:** May 14, 2026
**Current Mission:** SEO & Meta Tags Remediation Phase (parallel track, frontend-only)
**Source Plan:** plans/SEO-META-TAGS-PHASE.md
**Decision:** DEC-027
**Status:** 13 SEO TASKS QUEUED + PA Phase PARTIAL (7/10 DONE)

---

## SEO & Meta Tags Remediation Phase

### T-SEO-P1-001 — SEO-9: Hardcoded SITE_URL Cleanup (3 files)
- Status: TODO
- Assignee: Senior Dev
- Context Pack: contexts/CTX-T-SEO-P1-001.md
- Depends On: None

### T-SEO-P1-002 — SEO-4: Airdrop 404 Noindex
- Status: TODO
- Assignee: Senior Dev
- Context Pack: contexts/CTX-T-SEO-P1-002.md
- Depends On: T-SEO-P1-001

### T-SEO-P1-003 — SEO-10: Platform-wide Twitter Attribution
- Status: TODO
- Assignee: Senior Dev
- Context Pack: contexts/CTX-T-SEO-P1-003.md
- Depends On: T-SEO-P1-002

### T-SEO-P1-004 — SEO-1: Home Page Metadata + JSON-LD
- Status: TODO
- Assignee: Senior Dev
- Context Pack: contexts/CTX-T-SEO-P1-004.md
- Depends On: T-SEO-P1-003

### T-SEO-P1-005 — SEO-6: Terminal Index Metadata
- Status: TODO
- Assignee: Senior Dev
- Context Pack: contexts/CTX-T-SEO-P1-005.md
- Depends On: T-SEO-P1-004

### T-SEO-P1-006 — SEO-2: Airdrop Listing OG Image + JSON-LD
- Status: TODO
- Assignee: Senior Dev
- Context Pack: contexts/CTX-T-SEO-P1-006.md
- Depends On: T-SEO-P1-005

### T-SEO-P1-007 — SEO-3: Airdrop Detail JSON-LD + OG Image
- Status: TODO
- Assignee: Senior Dev
- Context Pack: contexts/CTX-T-SEO-P1-007.md
- Depends On: T-SEO-P1-006

### T-SEO-P1-008 — SEO-5: Scorecard JSON-LD + OG Image
- Status: TODO
- Assignee: Senior Dev
- Context Pack: contexts/CTX-T-SEO-P1-008.md
- Depends On: T-SEO-P1-007

### T-SEO-P1-009 — SEO-7: About Page OG + Canonical + JSON-LD
- Status: TODO
- Assignee: Senior Dev
- Context Pack: contexts/CTX-T-SEO-P1-009.md
- Depends On: T-SEO-P1-008

### T-SEO-P1-010 — SEO-8: Static Pages OG + Canonical (4 pages)
- Status: TODO
- Assignee: Senior Dev
- Context Pack: contexts/CTX-T-SEO-P1-010.md
- Depends On: T-SEO-P1-009

### T-SEO-P1-011 — SEO-11: Scorecard in Sitemap
- Status: TODO
- Assignee: Senior Dev
- Context Pack: contexts/CTX-T-SEO-P1-011.md
- Depends On: T-SEO-P1-010

### T-SEO-P1-012 — SEO-12: Alpha Page OG Image
- Status: TODO
- Assignee: Senior Dev
- Context Pack: contexts/CTX-T-SEO-P1-012.md
- Depends On: T-SEO-P1-011

### T-SEO-P1-013 — SEO-13: Home Sitemap Verification
- Status: TODO
- Assignee: Senior Dev
- Context Pack: contexts/CTX-T-SEO-P1-013.md
- Depends On: T-SEO-P1-012

---

## SEO Phase Exit Gate

- [ ] All 13 tasks deployed
- [ ] Zero TypeScript errors in all modified files
- [ ] Every public page: unique title + description (no duplicates)
- [ ] Every public page: canonical URL
- [ ] Every public page: og:title, og:description, og:image, og:url, og:type
- [ ] Every public page: twitter:card, twitter:title, twitter:description
- [ ] Home page: WebSite + SearchAction JSON-LD
- [ ] Airdrop detail: Product JSON-LD
- [ ] Airdrop 404: noindex, nofollow
- [ ] Scorecard: JSON-LD + in sitemap
- [ ] SITE_URL imported from constants (zero hardcoded)
- [ ] twitter:site set in root layout
- [ ] Lighthouse SEO >= 95 on /, /airdrops, /terminal

---

## Parallel Track: Phase A — Algorithm Intelligence Upgrade

**Status:** 10 TASKS (7 DONE, 3 TODO) — PAUSED while SEO track executes
**Source Plan:** plans/ALGORITHM-INTELLIGENCE-UPGRADE.md

### T-TR3-PA-001 — FIX-3: Lower S/R Strength Filter (60→40)
- Status: TODO
- Assignee: Senior Dev
- Context Pack: contexts/CTX-T-TR3-PA-001.md
- Depends On: None

### T-TR3-PA-002 — FIX-1: Fix TP/SL V2 RR Fallback Math
- Status: TODO
- Assignee: Senior Dev
- Context Pack: contexts/CTX-T-TR3-PA-002.md
- Depends On: T-TR3-PA-001

### T-TR3-PA-003 — FIX-5: Raise VOLATILE Regime Threshold (3%→5%)
- Status: TODO
- Assignee: Senior Dev
- Context Pack: contexts/CTX-T-TR3-PA-003.md
- Depends On: T-TR3-PA-002

### T-TR3-PA-004 — FIX-2: Fix Hardcoded Direction in Classification
- Status: TODO
- Assignee: Senior Dev
- Context Pack: contexts/CTX-T-TR3-PA-004.md
- Depends On: T-TR3-PA-003

### T-TR3-PA-005 — FIX-4: Fix Daily Trend Directional Alignment
- Status: TODO
- Assignee: Senior Dev
- Context Pack: contexts/CTX-T-TR3-PA-005.md
- Depends On: T-TR3-PA-004

### T-TR3-PA-006 — FIX-6: Deduplicate RR Check
- Status: TODO
- Assignee: Senior Dev
- Context Pack: contexts/CTX-T-TR3-PA-006.md
- Depends On: T-TR3-PA-005

### T-TR3-PA-007 — FIX-7A: Implement deriveAlgorithmVerdict
- Status: ✅ DONE (May 14, QA APPROVED)
- Assignee: Senior Dev
- Context Pack: contexts/CTX-T-TR3-PA-007.md
- Depends On: T-TR3-PA-006

### T-TR3-PA-008 — FIX-7B: Implement deriveAlgorithmDirection
- Status: ✅ DONE (May 14, QA APPROVED)
- Assignee: Senior Dev
- Context Pack: contexts/CTX-T-TR3-PA-008.md
- Depends On: T-TR3-PA-007

### T-TR3-PA-009 — FIX-7C: Wire Shadow Block to New Functions
- Status: ✅ DONE (May 14, QA APPROVED)
- Assignee: Senior Dev
- Context Pack: contexts/CTX-T-TR3-PA-009.md
- Depends On: T-TR3-PA-008

### T-TR3-PA-010 — FIX-7Q: Quality Gate — Verify Live Pipeline Untouched
- Status: ✅ DONE (May 14, QA APPROVED)
- Assignee: QA Hunter
- Context Pack: contexts/CTX-T-TR3-PA-010.md
- Depends On: T-TR3-PA-009

---

## Archive Locations

| Period | Archive File |
|---|---|
| Tranche 1 (Phase 0 + 0.1) | archives/phases/nexus-hub-tranche1-2-complete-2026-05-13.md |
| Tranche 2 (Phase 0.5/2/3/4/5/7.1/9) | archives/phases/nexus-hub-tranche1-2-complete-2026-05-13.md |
| Hotfix (May 11) | archives/phases/nexus-hub-tranche1-2-complete-2026-05-13.md |
