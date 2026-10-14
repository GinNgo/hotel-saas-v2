-- Benchmark and Index Evaluation on Isolated Test Database
-- Database: hotel_saas_p1b01a_test
-- Schema: perf_catalog_test (isolated, will be cleaned up)

DROP SCHEMA IF EXISTS perf_catalog_test CASCADE;
CREATE SCHEMA perf_catalog_test;

CREATE TABLE perf_catalog_test."RoomTypes" (
    "Id" uuid NOT NULL PRIMARY KEY,
    "TenantId" uuid NOT NULL,
    "PropertyId" uuid NOT NULL,
    "Name" varchar(100) NOT NULL,
    "Code" varchar(20) NOT NULL,
    "Description" text,
    "BasePrice" numeric(18,2) NOT NULL,
    "MaxOccupancy" integer NOT NULL,
    "BedType" varchar(50),
    "SquareMeters" numeric(6,2),
    "ImageUrl" text,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL
);

CREATE TABLE perf_catalog_test."Rooms" (
    "Id" uuid NOT NULL PRIMARY KEY,
    "TenantId" uuid NOT NULL,
    "PropertyId" uuid NOT NULL,
    "RoomTypeId" uuid NOT NULL REFERENCES perf_catalog_test."RoomTypes"("Id"),
    "RoomNumber" varchar(20) NOT NULL,
    "Floor" integer NOT NULL,
    "Status" integer NOT NULL,
    "Notes" text,
    "IsActive" boolean NOT NULL,
    "CreatedAtUtc" timestamp with time zone NOT NULL,
    "UpdatedAtUtc" timestamp with time zone NOT NULL
);

-- Baseline indexes matching current EF Core configuration
CREATE INDEX "IX_Rooms_TenantId" ON perf_catalog_test."Rooms" ("TenantId");
CREATE INDEX "IX_Rooms_RoomTypeId" ON perf_catalog_test."Rooms" ("RoomTypeId");
CREATE UNIQUE INDEX "UX_Room_PropertyId_RoomNumber" ON perf_catalog_test."Rooms" ("PropertyId", "RoomNumber");

-- Populate representative synthetic data
-- 1 Tenant, 2 Properties, 10 RoomTypes per property (total 20 room types)
-- 5,000 Rooms (2,500 rooms per property, floors 1-25)
DO $$
DECLARE
    v_tenant_id uuid := '11111111-1111-1111-1111-111111111111';
    v_prop_1 uuid := '22222222-2222-2222-2222-222222222221';
    v_prop_2 uuid := '22222222-2222-2222-2222-222222222222';
    v_rt_id uuid;
    v_rt_ids uuid[] := '{}';
    i int;
    f int;
    r int;
    v_status int;
BEGIN
    -- Insert RoomTypes
    FOR i IN 1..10 LOOP
        v_rt_id := gen_random_uuid();
        v_rt_ids := array_append(v_rt_ids, v_rt_id);
        INSERT INTO perf_catalog_test."RoomTypes"
            ("Id", "TenantId", "PropertyId", "Name", "Code", "Description", "BasePrice", "MaxOccupancy", "BedType", "SquareMeters", "ImageUrl", "CreatedAtUtc", "UpdatedAtUtc")
        VALUES
            (v_rt_id, v_tenant_id, v_prop_1, 'Deluxe Type ' || i, 'DLX' || i, 'Description ' || i, 1000000 + i * 100000, 2, 'King', 35.0, NULL, NOW() - (i || ' days')::interval, NOW());
    END LOOP;

    -- Insert 2,500 Rooms for Property 1 across floors 1 to 25 (100 rooms per floor)
    FOR f IN 1..25 LOOP
        FOR r IN 1..100 LOOP
            v_status := (r % 5); -- 0: Clean, 1: Dirty, 2: Cleaning, 3: Occupied, 4: OutOfService
            INSERT INTO perf_catalog_test."Rooms"
                ("Id", "TenantId", "PropertyId", "RoomTypeId", "RoomNumber", "Floor", "Status", "Notes", "IsActive", "CreatedAtUtc", "UpdatedAtUtc")
            VALUES
                (gen_random_uuid(), v_tenant_id, v_prop_1, v_rt_ids[(r % 10) + 1], f || LPAD(r::text, 3, '0'), f, v_status, 'Note for room ' || f || r, true, NOW() - ((f * 10 + r) || ' hours')::interval, NOW());
        END LOOP;
    END LOOP;

    -- Insert 2,500 Rooms for Property 2
    FOR f IN 1..25 LOOP
        FOR r IN 1..100 LOOP
            v_status := (r % 5);
            INSERT INTO perf_catalog_test."Rooms"
                ("Id", "TenantId", "PropertyId", "RoomTypeId", "RoomNumber", "Floor", "Status", "Notes", "IsActive", "CreatedAtUtc", "UpdatedAtUtc")
            VALUES
                (gen_random_uuid(), v_tenant_id, v_prop_2, v_rt_ids[(r % 10) + 1], 'P2-' || f || LPAD(r::text, 3, '0'), f, v_status, 'Note P2 ' || f || r, true, NOW() - ((f * 10 + r) || ' hours')::interval, NOW());
        END LOOP;
    END LOOP;
END $$;

VACUUM ANALYZE perf_catalog_test."Rooms";
VACUUM ANALYZE perf_catalog_test."RoomTypes";

-- Record table and index sizes
SELECT pg_size_pretty(pg_total_relation_size('perf_catalog_test."Rooms"')) AS rooms_total_size,
       pg_size_pretty(pg_relation_size('perf_catalog_test."Rooms"')) AS rooms_table_size,
       pg_size_pretty(pg_indexes_size('perf_catalog_test."Rooms"')) AS rooms_index_size;

\echo '========================================================================'
\echo '1. BASELINE QUERY 1: Lọc theo PropertyId + Floor + Order by Floor, RoomNumber, Id + Limit 20'
\echo '========================================================================'
EXPLAIN (ANALYZE, BUFFERS)
SELECT r."Id", r."PropertyId", r."RoomNumber", r."Floor", r."Status", r."Notes", r."IsActive", r."RoomTypeId", rt."Name", rt."Code", rt."BasePrice", r."CreatedAtUtc"
FROM perf_catalog_test."Rooms" AS r
LEFT JOIN perf_catalog_test."RoomTypes" AS rt ON r."RoomTypeId" = rt."Id"
WHERE r."TenantId" = '11111111-1111-1111-1111-111111111111'
  AND r."PropertyId" = '22222222-2222-2222-2222-222222222221'
  AND r."Floor" = 5
ORDER BY r."Floor", r."RoomNumber", r."Id"
LIMIT 20 OFFSET 0;

\echo '========================================================================'
\echo '2. BASELINE QUERY 2: Lọc theo PropertyId + Status (Housekeeping) + Order by Floor, RoomNumber, Id'
\echo '========================================================================'
EXPLAIN (ANALYZE, BUFFERS)
SELECT r."Id", r."PropertyId", r."RoomNumber", r."Floor", r."Status", r."Notes", r."IsActive", r."RoomTypeId", rt."Name", rt."Code", rt."BasePrice", r."CreatedAtUtc"
FROM perf_catalog_test."Rooms" AS r
LEFT JOIN perf_catalog_test."RoomTypes" AS rt ON r."RoomTypeId" = rt."Id"
WHERE r."TenantId" = '11111111-1111-1111-1111-111111111111'
  AND r."PropertyId" = '22222222-2222-2222-2222-222222222221'
  AND r."Status" = 1 -- Dirty
ORDER BY r."Floor", r."RoomNumber", r."Id"
LIMIT 20 OFFSET 0;

\echo '========================================================================'
\echo '3. BASELINE QUERY 3: Range date filter [startUtc, endExclusiveUtc)'
\echo '========================================================================'
EXPLAIN (ANALYZE, BUFFERS)
SELECT r."Id", r."PropertyId", r."RoomNumber", r."Floor", r."Status", r."CreatedAtUtc"
FROM perf_catalog_test."Rooms" AS r
WHERE r."TenantId" = '11111111-1111-1111-1111-111111111111'
  AND r."PropertyId" = '22222222-2222-2222-2222-222222222221'
  AND r."CreatedAtUtc" >= NOW() - INTERVAL '7 days'
  AND r."CreatedAtUtc" < NOW()
ORDER BY r."CreatedAtUtc" DESC, r."Id"
LIMIT 20;

\echo '========================================================================'
\echo 'CREATING PROPOSED OPTIMIZED INDEXES'
\echo '========================================================================'

-- Index 1: Composite index covering Property scoping + Floor + RoomNumber for the default catalog view & sorting
CREATE INDEX "IX_Rooms_PropertyId_Floor_RoomNumber" ON perf_catalog_test."Rooms" ("PropertyId", "Floor", "RoomNumber");

-- Index 2: Index covering Property scoping + Status for Housekeeping filtration
CREATE INDEX "IX_Rooms_PropertyId_Status" ON perf_catalog_test."Rooms" ("PropertyId", "Status");

-- Index 3: Index covering Property scoping + CreatedAtUtc for date range audits
CREATE INDEX "IX_Rooms_PropertyId_CreatedAtUtc" ON perf_catalog_test."Rooms" ("PropertyId", "CreatedAtUtc");

VACUUM ANALYZE perf_catalog_test."Rooms";

\echo '========================================================================'
\echo 'AFTER PROPOSED INDEXES: RUNNING OPTIMIZED QUERIES'
\echo '========================================================================'

\echo '1. OPTIMIZED QUERY 1: Floor filter + sort'
EXPLAIN (ANALYZE, BUFFERS)
SELECT r."Id", r."PropertyId", r."RoomNumber", r."Floor", r."Status", r."Notes", r."IsActive", r."RoomTypeId", rt."Name", rt."Code", rt."BasePrice", r."CreatedAtUtc"
FROM perf_catalog_test."Rooms" AS r
LEFT JOIN perf_catalog_test."RoomTypes" AS rt ON r."RoomTypeId" = rt."Id"
WHERE r."TenantId" = '11111111-1111-1111-1111-111111111111'
  AND r."PropertyId" = '22222222-2222-2222-2222-222222222221'
  AND r."Floor" = 5
ORDER BY r."Floor", r."RoomNumber", r."Id"
LIMIT 20 OFFSET 0;

\echo '2. OPTIMIZED QUERY 2: Status filter + sort'
EXPLAIN (ANALYZE, BUFFERS)
SELECT r."Id", r."PropertyId", r."RoomNumber", r."Floor", r."Status", r."Notes", r."IsActive", r."RoomTypeId", rt."Name", rt."Code", rt."BasePrice", r."CreatedAtUtc"
FROM perf_catalog_test."Rooms" AS r
LEFT JOIN perf_catalog_test."RoomTypes" AS rt ON r."RoomTypeId" = rt."Id"
WHERE r."TenantId" = '11111111-1111-1111-1111-111111111111'
  AND r."PropertyId" = '22222222-2222-2222-2222-222222222221'
  AND r."Status" = 1 -- Dirty
ORDER BY r."Floor", r."RoomNumber", r."Id"
LIMIT 20 OFFSET 0;

\echo '3. OPTIMIZED QUERY 3: Range date filter [startUtc, endExclusiveUtc)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT r."Id", r."PropertyId", r."RoomNumber", r."Floor", r."Status", r."CreatedAtUtc"
FROM perf_catalog_test."Rooms" AS r
WHERE r."TenantId" = '11111111-1111-1111-1111-111111111111'
  AND r."PropertyId" = '22222222-2222-2222-2222-222222222221'
  AND r."CreatedAtUtc" >= NOW() - INTERVAL '7 days'
  AND r."CreatedAtUtc" < NOW()
ORDER BY r."CreatedAtUtc" DESC, r."Id"
LIMIT 20;

-- Clean up benchmark schema
DROP SCHEMA perf_catalog_test CASCADE;
