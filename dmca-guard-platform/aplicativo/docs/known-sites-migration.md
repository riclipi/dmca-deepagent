# 📋 Known Sites Migration Guide

## Overview

This guide explains how to migrate from hardcoded site lists to database-managed known sites.

## 🚀 Migration Steps

### 1. Run the Migration

First, do a dry run to see what will be migrated:

```bash
npm run migrate:known-sites:dry-run
```

Then run the actual migration:

```bash
npm run migrate:known-sites
```

This will:
- Create/find a system admin user
- Import all 543+ sites from the hardcoded list
- Categorize sites automatically
- Set appropriate risk scores

### 2. Verify Migration

Check the migration results:

```bash
# Connect to database
npm run prisma:studio

# Or use the API
curl http://localhost:3000/api/admin/known-sites \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Update Search Engine Service

The `SearchEngineService` needs to be updated to use the database:

```typescript
// OLD: Using hardcoded list
const sites = ADULT_LEAK_SITES;

// NEW: Using database
import { knownSitesService } from '@/lib/services/known-sites.service';
const sites = await knownSitesService.getLeakSites();
```

### 4. Remove Hardcoded List

After confirming the migration:

1. Remove `ADULT_LEAK_SITES` array from `lib/search-engines.ts`
2. Update all references to use `knownSitesService`
3. Commit the cleanup

## 🛠️ Site Management

### Add New Sites via API

```bash
# Add a single site
curl -X POST http://localhost:3000/api/admin/known-sites \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "example-leak.com",
    "category": "LEAK_SITE",
    "riskScore": 85
  }'

# Bulk import sites
curl -X POST http://localhost:3000/api/admin/known-sites/bulk-import \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sites": [
      {"domain": "site1.com", "category": "LEAK_SITE"},
      {"domain": "site2.com", "category": "FILE_HOSTING"}
    ]
  }'
```

### Update Site Information

```bash
curl -X PATCH http://localhost:3000/api/admin/known-sites/SITE_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "riskScore": 95,
    "isActive": false
  }'
```

### Search Sites

```bash
# Search by domain
curl "http://localhost:3000/api/admin/known-sites?search=reddit"

# Filter by category
curl "http://localhost:3000/api/admin/known-sites?category=SOCIAL_MEDIA"

# High risk sites only
curl "http://localhost:3000/api/admin/known-sites?minRiskScore=80"
```

## 📊 Site Categories

Sites are automatically categorized as:

- **LEAK_SITE**: Direct leak/adult content sites (risk: 80-95)
- **SOCIAL_MEDIA**: Reddit, Twitter, etc. (risk: 60)
- **FILE_HOSTING**: Mega, RapidGator, etc. (risk: 70)
- **IMAGE_HOSTING**: Imgur, ImageTwist, etc. (risk: 50)
- **FORUM**: Discussion boards (risk: 65)
- **TUBE_SITE**: Video platforms (risk: 75)
- **TELEGRAM_CHANNEL**: Telegram channels (risk: 85)
- **OTHER**: Uncategorized (risk: 50)

## 🔧 Maintenance

### Regular Cleanup

Remove inactive sites periodically:

```bash
# Via API
curl -X POST http://localhost:3000/api/admin/known-sites/cleanup \
  -H "Authorization: Bearer YOUR_TOKEN"

# Or via script
npm run cleanup:known-sites
```

### Validate Site Availability

Check if sites are still active:

```bash
curl -X POST http://localhost:3000/api/admin/known-sites/validate/SITE_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🏗️ Building Admin UI

Create an admin interface with these features:

1. **Site List View**
   - Search/filter functionality
   - Sort by risk score, violations, last checked
   - Bulk actions (activate/deactivate)

2. **Site Details**
   - Edit category, risk score, platform
   - View violation history
   - Availability status

3. **Import/Export**
   - CSV import for bulk additions
   - Export current site list
   - Backup/restore functionality

4. **Analytics**
   - Sites by category chart
   - Risk distribution
   - Violation trends

## 🔒 Security Considerations

1. **Access Control**
   - Only SUPER_USER and ENTERPRISE plans can manage sites
   - Audit all site modifications

2. **Validation**
   - Validate domains before adding
   - Prevent duplicate entries
   - Sanitize all inputs

3. **Rate Limiting**
   - Limit bulk imports to 1000 sites
   - Throttle validation checks
   - Implement queue for large operations

## 📈 Performance Tips

1. **Caching**
   - Cache active sites for 1 hour
   - Invalidate on updates
   - Use Redis for hot data

2. **Indexing**
   - Index on domain, category, riskScore
   - Composite index for common queries
   - Regular ANALYZE on tables

3. **Batch Operations**
   - Process sites in batches of 50
   - Use transactions for consistency
   - Implement progress tracking

## 🚨 Rollback Plan

If migration fails:

1. **Immediate Rollback**
   ```sql
   -- Delete migrated sites
   DELETE FROM known_sites 
   WHERE created_at > 'MIGRATION_START_TIME';
   ```

2. **Revert Code**
   ```bash
   git revert MIGRATION_COMMIT
   npm run build
   npm run start
   ```

3. **Use Hardcoded List**
   - Keep backup of `ADULT_LEAK_SITES`
   - Can temporarily revert to hardcoded list
   - Plan re-migration with fixes

## 📝 Checklist

- [ ] Backup database before migration
- [ ] Run dry-run first
- [ ] Execute migration script
- [ ] Verify site count matches
- [ ] Test search functionality
- [ ] Update SearchEngineService
- [ ] Remove hardcoded list
- [ ] Deploy admin UI
- [ ] Document for team
- [ ] Monitor for issues

## 🔗 Related Files

- Migration script: `scripts/migrate-known-sites.ts`
- Service: `lib/services/known-sites.service.ts`
- API: `app/api/admin/known-sites/route.ts`
- Schema: `prisma/schema.prisma` (KnownSite model)