# OnlyAlpha Migration Strategy

**Version:** 1.0  
**Date:** May 4, 2026  
**Author:** Strategic Planner  
**Purpose:** Safe, controlled database migration discipline for OnlyAlpha platform. No unapproved migrations. Feature flags not enabled without approval.

## 1. Purpose

To establish a disciplined, safe migration process for OnlyAlpha that prioritizes:
- Zero unplanned database changes
- Backward compatibility preservation
- Feature flag-controlled rollouts
- Comprehensive rollback planning
- Explicit approval gates for all schema changes
- Policy-safe terminology in all migration-related activities

## 2. Current Principles

### Core Rules
- **No migrations run without explicit approval** — All database changes require Tech Lead + QA review
- **No schema changes bundled with unrelated tasks** — Each migration is a dedicated phase
- **Backward compatibility required** — All migrations maintain API/model compatibility
- **Feature flags not enabled without approval** — All new features start disabled
- **DB changes include rollback thinking** — Every migration has a documented rollback path
- **Production safety first** — Staging testing required before production deployment

### Technical Standards
- **Drizzle ORM discipline** — All schema changes via Drizzle migrations
- **PostgreSQL best practices** — Proper indexing, FK constraints, data types
- **Zero downtime migrations** — Additive changes preferred, destructive changes require extended approval
- **TypeScript safety** — All migrations maintain type safety across backend/frontend
- **Audit trail** — Every migration logged in AGENT_LOGS.md with verdict and notes

## 3. Migration Classification

### Migration Types

| Type | Definition | Approval Level | Risk Level |
|---|---|---|---|
| **docs-only** | Documentation/planning changes only, no DB code | Strategic Planner | None |
| **additive schema change** | New tables, columns, indexes (no data loss) | Tech Lead + QA | Low |
| **destructive schema change** | Column drops, table drops, data type changes (potential data loss) | Tech Lead + Product Lead + QA | High |
| **data backfill** | Populating new columns with computed data | Tech Lead + QA | Medium |
| **index/performance migration** | Index creation, query optimization | Tech Lead + QA | Low |
| **feature-flagged migration** | Schema change behind disabled feature flag | Tech Lead + QA | Low |
| **emergency fix** | Critical bug fix requiring immediate deployment | Tech Lead (emergency approval) | Variable |

### Forbidden Migration Types
- **Bundled migrations** — No combining multiple migration types in one task
- **Unplanned migrations** — No migrations without HUB task definition
- **Production-first migrations** — All migrations tested in staging first
- **Unreviewed migrations** — All migrations require QA review before commit

## 4. Approval Gates

### Standard Approval Flow

1. **Architect Review** — Migration proposal in HUB, classification confirmed, rollback documented
2. **Tech Lead Approval** — Code review, technical feasibility confirmed
3. **QA Validation** — Dry-run testing, type safety verified, no regressions
4. **Product Lead Approval** (if destructive) — Business justification documented
5. **Release Manager Execution** — Commit, staging deployment, monitoring
6. **Production Deployment** — Only after 24h staging observation

### Emergency Approval Flow (Critical Bugs Only)
1. **Tech Lead Emergency Declaration** — Issue severity documented
2. **Architect Rapid Review** — 1h turnaround, rollback priority
3. **QA Emergency Validation** — Critical path testing only
4. **Immediate Deployment** — With rollback plan ready

### Rejection Criteria
- Missing rollback documentation
- Unclassified migration type
- Combined with unrelated changes
- No staging testing plan
- TypeScript compilation failures
- API breaking changes without compatibility layer

## 5. Preflight Checklist

### Pre-Migration Verification
- [ ] Clean git working tree (git status --short clean)
- [ ] Database backup confirmed (production/staging)
- [ ] Environment verified (staging vs production)
- [ ] Migration SQL reviewed by Tech Lead
- [ ] Rollback plan documented and tested
- [ ] Feature flags disabled (default false)
- [ ] No unexpected generated files (npm run build clean)
- [ ] TypeScript compilation clean (backend + frontend tsc --noEmit)
- [ ] API compatibility checks (existing endpoints return expected schemas)
- [ ] QA checklist complete (68+ items depending on migration type)

### Staging Deployment Checks
- [ ] Migration applied successfully in staging
- [ ] Application restarts without errors
- [ ] API endpoints functional
- [ ] Frontend builds and renders correctly
- [ ] Feature flags remain disabled
- [ ] No data corruption observed
- [ ] Performance benchmarks met
- [ ] Logs show expected behavior

### Production Deployment Checks
- [ ] 24h staging observation complete
- [ ] Production backup verified
- [ ] Maintenance window scheduled (if required)
- [ ] Rollback scripts ready
- [ ] Monitoring dashboards configured
- [ ] Support team notified
- [ ] Post-deployment validation plan ready

## 6. Drizzle/PostgreSQL Process

### Schema Change Workflow

1. **Design Phase**
   - Update Drizzle schema in market.model.ts
   - Generate migration: `npx drizzle-kit generate`
   - Review generated SQL for correctness
   - Document rollback steps

2. **Testing Phase**
   - Apply migration locally: `npx drizzle-kit migrate`
   - Verify schema changes in database
   - Run TypeScript checks: `npm run tsc --noEmit`
   - Test affected services/controllers

3. **Staging Phase**
   - Deploy migration to staging environment
   - Monitor application startup logs
   - Test full application functionality
   - Verify rollback capability

4. **Production Phase**
   - Schedule maintenance window (if needed)
   - Apply migration with monitoring
   - Immediate post-deployment checks
   - 24h observation period

### Migration Commands (Approval Required)

```bash
# Generate migration (safe, no DB changes)
npx drizzle-kit generate

# Apply migration (PRODUCTION ONLY with explicit approval)
npx drizzle-kit migrate

# Rollback preparation (documented for each migration)
# [rollback commands documented per migration]
```

### Schema Design Guidelines
- Use appropriate PostgreSQL data types (timestamptz for timestamps, numeric for precision)
- Add indexes for frequently queried columns
- Use foreign keys for referential integrity
- Prefer nullable columns over default values when appropriate
- Document column purposes in schema comments
- Maintain backward compatibility in API responses

## 7. Rollback Strategy

### Rollback Feasibility Assessment

| Migration Type | Rollback Feasibility | Timeline | Data Loss Risk |
|---|---|---|---|
| Additive (new tables/columns) | High | Immediate | None |
| Index creation | High | Immediate | None |
| Data backfill | Medium | 1-2h | None (if backup exists) |
| Destructive (column drop) | Low | 1-4h | High (data permanently lost) |
| Data type change | Low | 2-8h | High (incompatible conversions) |
| Table drop | Critical | 4-24h | Critical (full data loss) |

### Rollback Methods

1. **Automated Rollback (Preferred)**
   - Drizzle down migration: `npx drizzle-kit migrate --down`
   - Requires down migration script prepared
   - Tested in staging before production

2. **Manual Rollback (Fallback)**
   - SQL scripts for data restoration
   - Backup restoration (last resort)
   - Application code reversion

3. **Forward Fix (When Rollback Unsafe)**
   - New migration to correct issues
   - Feature flag disable + re-enable
   - Gradual data migration

### Rollback Triggers
- Application startup failures
- API response errors
- Data integrity violations
- Performance degradation (>50% regression)
- User-reported issues within 1h of deployment

## 8. Validation Commands

### Pre-Migration
```bash
# Git status check
git status --short

# TypeScript compilation
cd backend && npx tsc --noEmit
cd ../frontend && npx tsc --noEmit

# Build verification
cd backend && npm run build
cd ../frontend && npm run build
```

### Post-Migration
```bash
# Database schema verification
# [query to verify new tables/columns exist]

# API endpoint testing
curl -X GET "http://localhost:3001/api/market/scorecard?coin=BTC"

# Frontend rendering check
# [manual browser verification]
```

### Monitoring Commands
```bash
# Application logs
tail -f backend/logs/application.log

# Database connection health
# [query to verify DB connectivity]

# Performance metrics
# [queries for response times, error rates]
```

## 9. Release Documentation

### Commit Format
```
chore: [migration-type] [brief description]

Example:
chore: additive-schema add event_impacts table
chore: data-backfill populate classification_confidence
chore: index-performance create event_type index
```

### HUB Update Requirements
- Task status: PENDING → APPROVED → COMMITTED → COMPLETE
- Verdict: APPROVED / REJECTED / NEEDS ADJUSTMENT
- Commit hash recorded
- Critical review notes documented

### AGENT_LOGS Update Requirements
- Date, task ID, verdict, executor, reviewer
- Critical review notes
- Commit hash linked

## 10. Stop Conditions

### Immediate Stop Triggers
- **Destructive migration** without Product Lead approval
- **Missing rollback plan** for any migration
- **Migration touches production** without staging validation
- **Feature flag enablement** without explicit approval
- **Unclear DB target** (production vs staging confusion)
- **Failing build/tsc** after migration application
- **Unexpected modified files** (migration should only touch schema files)

### Warning Triggers
- Migration complexity >4h estimated
- Cross-service dependencies
- Weekend deployment required
- External API dependencies
- Large data sets (>1M rows affected)

### Emergency Stop Triggers
- Production data loss detected
- Application crash loop
- Security vulnerability introduced
- Compliance violation (AdSense, GDPR)

---

**Document Control:**
- **Next Review:** May 4, 2027 (annual review)
- **Change History:**
  - v1.0 — May 4, 2026: Initial creation, comprehensive migration discipline established
- **Approval:** Strategic Planner — May 4, 2026
- **QA Review:** [Pending QA completion]