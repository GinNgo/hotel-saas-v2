# Review P5-FUZZY-INTEGRATE-02 — round 1

TaskId: P5-FUZZY-INTEGRATE-02
Round: 1
SubmissionId: sub-p5-fuzzy-integrate-02-r1-20261011
Decision: **ChangesRequested — test production query path**

## Finding

P2 — All synthetic handler tests use a second constructor that duplicates Active filtering/projection and bypasses _context.Properties/IgnoreQueryFilters/AsNoTracking/ToListAsync entirely. Thus removing the real branch's Active guard or breaking its DTO projection leaves all 28 new tests green; current claims of fully verified wiring/guard are overstated. Remove the duplicated test-only production loader/constructor and nullable context branch. Exercise the normal IApplicationDbContext constructor using a small test-only async IQueryable/DbSet fake (no new dependency/DB), or an equivalent shared query-building seam that executes the actual guard/projection. Include inactive-exact, blank/normalized-empty, fuzzy ordering and exact serialized DTO keys/value preservation on the real query pipeline. EF translation/real SQL remains an explicit untested limitation; fake provider must not claim SQL verification. Prefer keeping test scaffolding in test project and production handler minimal. Do not start backend or connect a real DB to solve this.

## Independent Validation

Read handler, DTO matcher overload and synthetic test class first. Production source currently retains Active-only, lightweight DTO projection, AsNoTracking, existing route/array contract and native sorting. No observed query-rule defect by inspection. Ran dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --no-restore --filter 'FullyQualifiedName~FuzzyPropertyMatcherTests|FullyQualifiedName~GetPublicPropertiesSyntheticTests' --logger 'console;verbosity=minimal': exit0,74 passed,0 failed/skipped (46 matcher+28 synthetic),380ms reported duration. No DB fixtures instantiated by these classes. Tests verify matcher/synthetic loader behavior, NOT actual production EF path. No performance/coverage/browser/API-wire acceptance inferred.

## Next

Round2/new submission, minimal handler and no-DB test-path correction only. Keep existing endpoint/direct PublicPropertyDto array/Active-only, no full entity materialization, relevance exposure, dependency/schema/permission/geography/inventory/TTL changes. Preserve all PO gates/team reservations. No commit/deploy/migration/real DB. Previous review archived before replacement; keyed history then controlled writer release.
