# 🛠️ Báo Cáo Thực Hiện Kỹ Thuật (Implementation Report)
## Ticket: BE-FIX-01 — Sửa Lỗi Vòng Đời, Concurrency & Siết Guard Của Extension `btree_gist`
### Dự án: Hotel SaaS Platform v2 (.NET 10 + PostgreSQL 17)

> **Mã tài liệu:** `REPORT-BE-FIX-01` | **Phiên bản:** 1.1 (Cập nhật theo Review Kỹ thuật)  
> **Ngày thực hiện:** 2026-10-09 | **Trạng thái:** Hoàn tất Triển khai & Kiểm chứng Thực nghiệm Toàn diện (Chờ Reviewer Thẩm định)  
> **Tài liệu tham chiếu:** [`docs/be-repro-01-root-cause-report.md`](file:///C:/Dev/hotel-saas-v2/docs/be-repro-01-root-cause-report.md), [`docs/team-handoff-package.md`](file:///C:/Dev/hotel-saas-v2/docs/team-handoff-package.md)  
> **Nguyên tắc thực thi:** **CHỈ SỬA TRONG PHẠM VI TEST HARNESS, REGRESSION TESTS VÀ MIGRATION LIÊN QUAN**. Tuyệt đối không can thiệp mã nguồn nghiệp vụ, `Program.cs` hay frontend. Chỉ thao tác trên cơ sở dữ liệu kiểm thử được whitelist nghiêm ngặt. Không đụng tới `hotel_saas_dev` hay CSDL production. Không tắt tính năng chạy song song (parallelism) hay skip test.

---

## 1. Kết Quả Xác Minh Trước Sửa (Pre-Fix Audit)

Trước khi thực hiện sửa đổi, các điều kiện tiên quyết đã được thẩm định độc lập:
1. **Kiểm tra trạng thái phát hành của Migration P2B-02:**
   - File migration `backend/src/HotelSaas.Infrastructure/Migrations/20261008000000_P2B02_Rates_Policies_Quote.cs` ở trạng thái **untracked** (`??`) trong Git.
   - Chưa từng được commit, tag, merge vào nhánh `main` hay xuất bản lên bất kỳ môi trường Staging/Production nào.
   - CSDL `hotel_saas_dev` hoàn toàn chưa tồn tại trên cluster PostgreSQL; không có migration nào bị áp dụng ngoài CSDL test.
   - $\implies$ **Đủ điều kiện phê duyệt:** Migration P2B-02 được xác định là bản thảo nội bộ (unreleased draft), được phép chuẩn hóa Step 0.
2. **Kiểm tra ranh giới an toàn cơ sở dữ liệu:**
   - 100% kết nối DDL/DML kiểm thử được bảo vệ bởi bộ lọc an toàn `PostgresTestDatabaseGuard`.
   - CSDL dùng chung duy nhất được cho phép là `hotel_saas_p1b01a_test`.
   - CSDL tạm bắt buộc phải theo mẫu định danh có GUID hợp lệ do harness sinh.

---

## 2. Chi Tiết Các Giải Pháp Kỹ Thuật Đã Triển Khai (Implemented Solutions v1.1)

### 2.1. Siết Chặt Database Guard & Quản Lý Quyền Sở Hữu (Database Guard Hardening)
- **Vấn đề đã xử lý:** Loại bỏ hoàn toàn cơ chế whitelist lỏng lẻo như `Contains("test_")` hoặc `EndsWith("_test")` nhằm ngăn ngừa nguy cơ vô tình thao tác trên các database như `hotel_saas_dev_test` hoặc database ngoài ý muốn.
- **Giải pháp triển khai trong [`PostgresTestDatabaseGuard.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/MigrationFixtures/PostgresTestDatabaseGuard.cs):**
  1. **CSDL dùng chung:** Chỉ chấp nhận chính xác tên canonical `hotel_saas_p1b01a_test`.
  2. **CSDL tạm thời (ephemeral):** Bắt buộc có tiền tố cố định `hotel_saas_tmp_` kết hợp với chuỗi GUID 32 ký tự hex (`^hotel_saas_tmp_[0-9a-fA-F]{32}$`).
  3. **Ghi nhận quyền sở hữu (Ownership Tracking):** Khi harness gọi `CREATE DATABASE` thành công, CSDL đó được đăng ký vào danh bạ `ConcurrentDictionary<string, bool> OwnedDatabases`.
  4. **Bảo vệ thao tác DROP:** Lệnh `DROP DATABASE` chỉ được phép thực thi đối với CSDL tạm do chính lượt chạy test đó tạo và đã đăng ký quyền sở hữu. Tuyệt đối từ chối drop CSDL chưa được sở hữu và cấm drop CSDL dùng chung `hotel_saas_p1b01a_test`.
  5. **Negative Tests:** Bổ sung 4 unit tests kiểm chứng guard từ chối tên không hợp lệ, dev/prod, và CSDL không có ownership mà không thực thi bất kỳ lệnh DDL phá hủy nào.

---

### 2.2. Bỏ `ClearAllPools()` & Giải Phóng Kết Nối Đúng Mục Tiêu
- **Vấn đề đã xử lý:** `NpgsqlConnection.ClearAllPools()` xóa kết nối của toàn bộ các pool trong tiến trình, gây gián đoạn không cần thiết cho các runner kiểm thử song song khác.
- **Giải pháp triển khai:**
  - Toàn bộ kết nối (`NpgsqlConnection`) và `ApplicationDbContext` trong test được dispose đầy đủ và kịp thời qua `await using` scope.
  - Khi cần teardown CSDL tạm, chỉ thực hiện giải phóng pool mục tiêu của CSDL đó thông qua:
    ```csharp
    await using (var tempConn = new NpgsqlConnection(targetConnStr))
    {
        NpgsqlConnection.ClearPool(tempConn);
    }
    ```
  - Kết hợp với cú pháp `DROP DATABASE IF EXISTS "{databaseName}" WITH (FORCE);` để dọn dẹp triệt để.

---

### 2.3. Đồng Bộ Khởi Tạo Extension Cấp Database & Cố Định Schema `public`
- **Vấn đề đã xử lý:** `CREATE EXTENSION IF NOT EXISTS` đơn thuần gây race condition danh mục PostgreSQL khi chạy song song (`23505: pg_extension_name_index`), đồng thời mặc định cài extension vào schema tạm của session đầu tiên nếu không chỉ định schema.
- **Giải pháp triển khai:**
  - Sử dụng khóa giao dịch cố vấn cấp database: `PERFORM pg_advisory_xact_lock(7420261008);` (Khóa định danh riêng cho `btree_gist`).
  - Khóa tự động giải phóng khi transaction commit hoặc rollback.
  - Kiểm tra và cài đặt extension nghiêm ngặt vào schema dùng chung ổn định `public`: `CREATE EXTENSION btree_gist SCHEMA public;`.
- **Vị trí tích hợp:**
  - `backend/src/HotelSaas.Infrastructure/Migrations/20261008000000_P2B02_Rates_Policies_Quote.cs:14-36` (Step 0 của Migration thật).
  - `backend/tests/HotelSaas.Application.Tests/MigrationFixtures/PostgresExtensionLifecycleHelper.cs:28-56`.

---

### 2.4. Fail-Fast Khi Extension Nằm Ở Schema Sai & Bảo Vệ Dữ Liệu
- Khi phát hiện `v_schema != 'public'`, khối PL/pgSQL kích hoạt ngay `RAISE EXCEPTION`:
  `[EXTENSION CONFIGURATION ERROR] Extension btree_gist is installed in unauthorized schema % instead of public. Manual intervention required.`
- Dừng ngay lập tức (fail-fast), transaction của migration tự động rollback, migration P2B-02 không được stamp vào `__EFMigrationsHistory`, và giữ nguyên toàn bộ extension và dữ liệu hiện hữu.

---

## 3. Danh Mục Các Kịch Bản Kiểm Thử (12 Tests Trong Suite Mới)

File kiểm thử: [`P2B02_BtreeGistLifecycleAndConcurrencyTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/MigrationFixtures/P2B02_BtreeGistLifecycleAndConcurrencyTests.cs):

### Nhóm 1: Kiểm Thử Guard An Toàn Database (Negative Tests — Không Thực Thi DDL)
1. `DatabaseGuard_Negative_01_InvalidDatabaseNames_Throw_Without_DDL`: Từ chối tên rỗng, tên sai định dạng, tên chứa ký tự không hợp lệ.
2. `DatabaseGuard_Negative_02_DevAndProdDatabaseNames_Throw_Without_DDL`: Từ chối nghiêm ngặt các tên nhạy cảm (`hotel_saas_dev`, `hotel_saas_prod`, `postgres`, `template1`, v.v.).
3. `DatabaseGuard_Negative_03_UnownedDatabase_RefusesDrop_Without_DDL`: Từ chối drop CSDL tạm hợp lệ về mặt cú pháp nhưng không do lượt test hiện tại tạo/đăng ký.
4. `DatabaseGuard_Negative_04_SharedDatabase_RefusesDrop_Without_DDL`: Từ chối tuyệt đối lệnh drop đối với CSDL dùng chung `hotel_saas_p1b01a_test`.

### Nhóm 2: Kiểm Chứng Migration EF Core Thật (`Database.MigrateAsync`)
5. `RealMigration_01_CleanDatabase_EFMigration_Installs_BtreeGist_In_Public`: Trên CSDL sạch, thực thi EF migration thật; xác minh `btree_gist` và `gist_uuid_ops` nằm tại `public`, `__EFMigrationsHistory` stamp P2B-02.
6. `RealMigration_02_ConcurrentRunners_WithBarrier_Migrate_Without_Collision_Or_Deadlock`: 2 runner trên 2 schema độc lập trong cùng CSDL sạch, đồng bộ xuất phát bằng `Barrier`, cùng chạy EF migration thật. Xác minh không xảy ra catalog collision `23505`, không xảy ra deadlock `40P01`, extension cài 1 lần duy nhất tại `public`.
7. `RealMigration_03_UnauthorizedSchema_Migration_FailsFast_PreservesData_DoesNotStampMigration`: Cài extension ở schema sai kèm dữ liệu nghiệp vụ mẫu. Chạy EF migration thật bị fail-fast ngay tại Step 0; extension và dữ liệu được bảo toàn nguyên vẹn; migration P2B-02 không bị ghi nhận vào lịch sử migration.
8. `RealMigration_04_DropEphemeralSchemaCascade_Preserves_Extension_And_OtherSchemaConstraints`: Schema A chạy EF migration và seed dữ liệu hợp lệ; Schema B bị DROP CASCADE. Xác minh extension tại `public` nguyên vẹn và exclusion constraint của Schema A tiếp tục chặn vi phạm trùng khoảng thời gian (`23P01`).

### Nhóm 3: Kiểm Thử Trực Tiếp Helper (Low-Level Unit Tests)
9. `Helper_01_CleanDatabase_Initializes_Extension_In_Public_Schema`: Khởi tạo trực tiếp qua helper trên DB sạch.
10. `Helper_02_ConcurrentRunners_Initialize_Without_CatalogCollision_Or_Deadlock`: 10 connection song song chạy helper.
11. `Helper_03_EphemeralSchemaDropCascade_Preserves_Extension_And_OtherSchemaConstraints`: DROP CASCADE schema tạm cô lập ở tầng SQL raw.
12. `Helper_04_ExtensionInUnauthorizedSchema_FailsFast_Without_DataLoss_Or_Relocation`: Fail-fast tầng helper khi schema không hợp lệ.

---

## 4. Nhật Ký Kiểm Thử Tự Động & Bằng Chứng Thực Nghiệm

### 4.1. Chạy Suite Mới `P2B02_BtreeGistLifecycleAndConcurrencyTests` (12 Tests)
```powershell
dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --filter "FullyQualifiedName~P2B02_BtreeGistLifecycleAndConcurrencyTests" -v normal
```
- **Exit Code:** `0`
- **Kết quả:** **Passed: 12/12 (100%)** | Thời gian thực thi: 19.08 giây.

### 4.2. Chạy Suite `P1B01B_RealDatabaseBehavioralTests` (11 Tests)
```powershell
dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --filter "FullyQualifiedName~P1B01B_RealDatabaseBehavioralTests" -v normal
```
- **Exit Code:** `0`
- **Kết quả:** **Passed: 11/11 (100%)** | Thời gian thực thi: 31.82 giây.  
  *(Tất cả các test bao gồm `Behavior_04` và `Behavior_06` đều đạt chuẩn).*

### 4.3. Chạy Toàn Bộ Solution Lượt 1 (Full Concurrency Run 1)
```powershell
dotnet test backend/HotelSaas.slnx -v normal
```
- **Exit Code:** `0` | **Thời gian:** 3 phút 40 giây
- **Chi tiết các project:**
  - `HotelSaas.Domain.Tests`: **1/1 PASS**
  - `HotelSaas.WebApi.Tests`: **41/41 PASS**
  - `HotelSaas.Application.Tests`: **170/170 PASS**
- **Tổng cộng:** **212/212 PASS (100%)**, 0 Warning, 0 Error.

### 4.4. Chạy Toàn Bộ Solution Lượt 2 (Full Concurrency Run 2)
```powershell
dotnet test backend/HotelSaas.slnx -v normal
```
- **Exit Code:** `0` | **Thời gian:** 3 phút 20 giây
- **Chi tiết các project:**
  - `HotelSaas.Domain.Tests`: **1/1 PASS**
  - `HotelSaas.WebApi.Tests`: **41/41 PASS**
  - `HotelSaas.Application.Tests`: **170/170 PASS**
- **Tổng cộng:** **212/212 PASS (100%)**, 0 Warning, 0 Error.

### 4.5. Kiểm Tra Cluster PostgreSQL & Dọn Dẹp Sau Kiểm Thử
1. **Kiểm tra CSDL trên Cluster:**
   ```sql
   SELECT datname FROM pg_database WHERE datname LIKE 'hotel_saas_%';
   ```
   **Kết quả:**
   ```text
           datname         
   ------------------------
    hotel_saas_p1b01a_test
   (1 row)
   ```
   - 100% CSDL tạm thời dạng `hotel_saas_tmp_*` đã được teardown sạch sẽ, không rò rỉ CSDL rác.
   - `hotel_saas_dev` hoàn toàn chưa từng được tạo.
2. **Kiểm tra Extension trong `hotel_saas_p1b01a_test`:**
   ```sql
   SELECT extname, extnamespace::regnamespace::text FROM pg_extension;
   ```
   **Kết quả:**
   ```text
     extname   | extnamespace 
   ------------+--------------
    plpgsql    | pg_catalog
    btree_gist | public
   (2 rows)
   ```
   - Extension `btree_gist` tồn tại ổn định, duy nhất tại namespace `public`.

---

## 5. Bảng Đối Chiếu Thay Đổi Mã Nguồn (Code Diff Mapping)

| STT | File Thay Đổi | Phạm Vi Dòng | Nội Dung Sửa Đổi |
|:---:|:---|:---:|:---|
| **1** | [`PostgresTestDatabaseGuard.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/MigrationFixtures/PostgresTestDatabaseGuard.cs) | Toàn văn (Tạo mới) | Cung cấp guard kiểm soát CSDL: whitelist canonical `hotel_saas_p1b01a_test`, regex `hotel_saas_tmp_<guid>`, quản lý ownership và cấm drop unowned DB. |
| **2** | [`20261008000000_P2B02_Rates_Policies_Quote.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Infrastructure/Migrations/20261008000000_P2B02_Rates_Policies_Quote.cs) | Dòng 14–36 | Khối PL/pgSQL với `pg_advisory_xact_lock(7420261008)`, kiểm tra namespace `public` và fail-fast. |
| **3** | [`PostgresExtensionLifecycleHelper.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/MigrationFixtures/PostgresExtensionLifecycleHelper.cs) | Toàn văn | Cung cấp helper quản lý vòng đời và khóa cố vấn `EnsureBtreeGistExtensionAsync`. |
| **4** | [`P1B01B_RealDatabaseBehavioralTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/MigrationFixtures/P1B01B_RealDatabaseBehavioralTests.cs) | Dòng 44–47, 104 | Chuyển đổi sang sử dụng `PostgresTestDatabaseGuard.ValidateConnectionTarget(connStr)` và tích hợp `EnsureBtreeGistExtensionAsync`. |
| **5** | [`P2B02_BtreeGistLifecycleAndConcurrencyTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/MigrationFixtures/P2B02_BtreeGistLifecycleAndConcurrencyTests.cs) | Toàn văn | 12 tests: 4 guard negative tests (no DDL), 4 real EF migration tests (với `Barrier`), 4 helper unit tests; sử dụng `ClearPool` đơn lẻ. |
| **6** | [`docs/team-handoff-package.md`](file:///C:/Dev/hotel-saas-v2/docs/team-handoff-package.md) | Toàn văn | Đồng bộ 212/212 test pass, cập nhật trạng thái BE-FIX-01 v1.1. |

---

## 6. Đánh Giá Kỹ Thuật Về Tính Đồng Thời & Deadlock

- **Quan sát thực nghiệm:** Trong toàn bộ các lần chạy đơn lẻ, chạy song song với `Barrier`, và 2 lượt chạy toàn bộ solution (212 tests), **không ghi nhận bất kỳ lỗi deadlock nào (`40P01`) hay lỗi catalog collision (`23505`)**.
- **Cơ chế bảo vệ:** Việc sử dụng `pg_advisory_xact_lock(7420261008)` đảm bảo việc kiểm tra và khởi tạo extension ở cấp CSDL được thực thi tuần tự hóa (serialized) giữa các transaction.
- **Lưu ý kỹ thuật:** Kết quả kiểm thử thực nghiệm thành công không đồng nghĩa với việc tuyên bố mang tính tuyệt đối về mặt lý thuyết ("không thể deadlock trong mọi điều kiện biên ngoại cảnh"). Tuy nhiên, cơ chế khóa cố vấn kết hợp vòng đời transaction tự giải phóng là giải pháp chuẩn công nghiệp, loại bỏ được nguyên nhân gây race condition quan sát được trên PostgreSQL.

---

## 7. Ranh Giới Nghiệm Thu & Khuyến Nghị Trình Reviewer

1. **Ticket BE-FIX-01:** ĐÃ HOÀN TẤT TRIỂN KHAI VÀ XÁC MINH 100% THEO TOÀN BỘ YÊU CẦU REVIEW.
2. **Blocker P2B-02 & P3A:** Tiếp tục **GIỮ NGUYÊN TRẠNG THÁI CHƯA NGHIỆM THU / CHỜ PO PHÊ DUYỆT**:
   - P2B-02 chờ Reviewer nghiệm thu 5 findings độc lập.
   - P3A chờ PO phê duyệt 6 quyết định nghiệp vụ.
3. **Các Ticket Chưa Thực Hiện:** Chưa triển khai `BE-SEED-01` hay các ticket Frontend UI (`FE-AUTH-01`, `FE-ROOM-01`, `FE-HK-01`).
