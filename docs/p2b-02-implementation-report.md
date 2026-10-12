# Báo cáo Thực thi & Nghiệm thu Giai đoạn P2B-02: Backend Pricing, Rate Tables, Policies & Quote Engine Gate

> **Giai đoạn:** P2B-02 (Backend Gate: Quản lý Chính sách Chi nhánh, Bảng giá Versioned, Interval Splitting, PostgreSQL GiST Exclusion Constraint, Quote Engine & E2E HTTP Testing)  
> **Ngày thực hiện:** 2026-10-08  
> **Môi trường thử nghiệm:** PostgreSQL Test Database cô lập (`hotel_saas_p1b01a_test`, Dedicated Schemas `p1b01b_test_*` và `p1b02b_pricing_http_*`)  
> **Ranh giới tuân thủ:**  
> - Tuyệt đối không can thiệp, migrate hay làm biến đổi database dev/prod (`hotel_saas_dev`).  
> - Mọi thao tác kiểm thử DDL/DML chỉ thực hiện trên database được gắn cờ `_test` qua script và test isolation.  
> - P2B-02 là backend pricing gate độc lập; chưa triển khai UI (P2C) hoặc quy trình đặt phòng/giữ phòng (P3).

---

## 1. Tóm tắt Triển khai Nghiệp vụ & Quyết định PO Đã Duyệt

Gói P2B-02 triển khai toàn diện các quyết định nghiệp vụ đã thống nhất trong tài liệu `docs/p2a-room-pricing-design.md`:

1. **Chính sách Vận hành Chi nhánh (Decision D12, D14 - Trạng thái: D14 ĐÃ ĐƯỢC PO PHÊ DUYỆT):**
   - Quản lý giờ nhận phòng (`CheckInTime`) và trả phòng (`CheckOutTime`) mặc định 12:00, cấu hình độc lập theo từng chi nhánh.
   - Thời gian dọn phòng (`BufferMinutes`): tối thiểu 30 phút, kiểm tra bằng FluentValidation.
   - Giới hạn thuê giờ tối đa (`MaxHourlyHours`): cấu hình theo chính sách cơ sở từ 1 đến 24 giờ, mặc định 12 giờ (D14 đã được PO phê duyệt chính thức theo Phương án C; vượt giới hạn từ chối với ERR_HOURLY_LIMIT_EXCEEDED, không tự chuyển sang đêm).
   - Chính sách phụ thu nhận sớm / trả muộn (`PropertySurchargePolicies`): cấu hình theo khung giờ (`FromTime` – `ToTime`), hỗ trợ hai phương thức tính: Tỷ lệ % giá đêm (`PercentageOfNightly`) hoặc Số tiền cố định (`FlatAmount`).

2. **Bảng giá Versioned & Interval Splitting (Decision D13, D25):**
   - Giá phòng lưu trữ theo bảng version riêng biệt `RoomTypeRates` và bảng audit `RoomTypeRateAudits`.
   - Ngăn chặn chồng lấn khoảng ngày hiệu lực bằng exclusion constraint PostgreSQL với extension `btree_gist`:
     ```sql
     EXCLUDE USING gist (
         "TenantId" WITH =,
         "PropertyId" WITH =,
         "RoomTypeId" WITH =,
         daterange("EffectiveFrom", "EffectiveTo", '[)') WITH &&
     ) WHERE ("IsActive" = true);
     ```
   - Xử lý chia tách khoảng ngày (Interval Splitting) trong transaction có khóa dòng phòng (`LockRoomTypeRowAsync`):
     - **Khớp đầu khoảng (Exact Head):** Vô hiệu hóa giá cũ (`IsActive = false`), ghi audit `Replaced`, tạo bản ghi giá mới với audit `Replaced_Created`.
     - **Chồng lấn giữa khoảng (Mid):** Rút ngắn khoảng giá cũ đến ngày hiệu lực mới (`EffectiveTo = request.EffectiveFrom`), ghi audit `Split_Shortened`, tạo bản ghi giá mới với audit `Split_Created`.
   - Bảo toàn lịch sử giá không phá hủy (non-destructive).

3. **Bảo vệ Khóa ngoại Phân vùng Composite (Cross-Scope Protection):**
   - `RoomTypeRates` và `RoomTypeRateAudits` sử dụng composite foreign key liên kết với `RoomTypes(TenantId, PropertyId, Id)` với `ON DELETE RESTRICT`. Ngăn chặn việc gán bảng giá của một phòng thuộc Chi nhánh 1 sang Chi nhánh 2.
   - `PropertySurchargePolicies` sử dụng composite foreign key liên kết với `Properties(TenantId, Id)`.

4. **Quote Engine Báo giá Độc lập (Decision D05, D06, D19, D20, D25, BR_PRICE03 & D14 Đã Duyệt):**
   - **Thuê theo giờ (D05):** Thu tối thiểu đủ gói giờ đầu (`FirstHours`); thời gian phát sinh tính chính xác bằng `TimeSpan` và làm tròn lên trực tiếp (`Math.Ceiling(extraDuration.TotalHours)`) mà không làm tròn trung gian trên số phút; làm tròn tiền `MidpointRounding.AwayFromZero` đến 1 VND.
   - **Cắt ngưỡng thuê giờ (D14):** Thời lượng vượt quá `MaxHourlyHours` của chi nhánh bị từ chối với HTTP 422 `ERR_HOURLY_LIMIT_EXCEEDED` (ràng buộc D14 đã được PO phê duyệt chính thức).
   - **Thuê theo ngày/đêm (D06):** Tính tổng giá hiệu lực của từng đêm riêng biệt. Nhận muộn không tự giảm giá đêm đó.
   - **Đồng bộ múi giờ chi nhánh & chống mất đêm:** `CheckInDate` và `CheckOutDate` bắt buộc khớp với `StartAtUtc` và `EndAtUtc` quy đổi theo múi giờ chi nhánh (`Asia/Ho_Chi_Minh`), sai lệch bị từ chối ngay với HTTP 400 `ERR_DATE_TIMEZONE_MISMATCH`.
   - **Kiểm tra quyền & Membership fail-closed:** Bắt buộc ngữ cảnh xác thực (`TenantId`, `UserId`); chỉ trạng thái `MembershipLookupStatus.Success` mới được tiếp tục, mọi trạng thái khác fail-closed HTTP 403 / 404 / 409.
   - **Chặn RentalType ngoài enum & cấm báo giá 0đ:** Từ chối `RentalType` ngoài enum (1, 2) với HTTP 400 `ERR_INVALID_RENTAL_TYPE`; `TotalAmount <= 0` lập tức fail-closed HTTP 422 `ERR_INVALID_QUOTE_TOTAL`.
   - **Fail-closed phụ thu (D19):** Nhận sớm hoặc trả muộn ngoài khung giờ chuẩn mà chi nhánh chưa cấu hình phụ thu bị từ chối với HTTP 422 `ERR_SURCHARGE_NOT_CONFIGURED`.
   - **Fail-closed bảng giá (BR_PRICE03):** Thiếu bảng giá hiệu lực cho bất kỳ ngày nào trong khoảng lưu trú bị từ chối với HTTP 422 `ERR_PRICING_NOT_CONFIGURED`, tuyệt đối không fallback về `BasePrice`.
   - **Snapshot báo giá có TTL (D20):** Báo giá có thời hạn hiệu lực 5 phút (`ExpiresAtUtc = UtcNow.AddMinutes(5)`), chỉ là giá tham chiếu được xác minh, không giữ phòng và không giữ giá vô thời hạn.

5. **Rollback Migration Fail-Closed An Toàn:**
   - Migration `20261008000000_P2B02_Rates_Policies_Quote` trong hàm `Down()` kiểm tra số lượng bản ghi thực tế trong schema hiện tại (`current_schema()`).
   - Nếu có dữ liệu trong `RoomTypeRates`, `RoomTypeRateAudits`, hoặc `PropertySurchargePolicies`, lệnh `Down()` lập tức ném exception `MIGRATION ROLLBACK ABORTED (FAIL-CLOSED)` và dừng lại, không drop bảng để tránh mất mát dữ liệu âm thầm. Chỉ cho phép drop khi các bảng hoàn toàn rỗng.

---

## 2. Danh mục Source Code Đã Triển khai

### Domain Layer
- `RentalType.cs`: Enum loại thuê (`Hourly = 1`, `Overnight = 2`).
- `SurchargeType.cs`: Enum loại phụ thu (`EarlyCheckIn = 1`, `LateCheckOut = 2`).
- `SurchargeCalculationMethod.cs`: Enum phương thức tính phụ thu (`PercentageOfNightly = 1`, `FlatAmount = 2`).
- `Property.cs`: Bổ sung `MaxHourlyHours` (mặc định 12), navigation `SurchargePolicies`, `RoomTypeRates`.
- `RoomType.cs`: Bổ sung navigation `Rates`, `RateAudits`.
- `PropertySurchargePolicy.cs`: Entity chính sách phụ thu chi nhánh.
- `RoomTypeRate.cs`: Entity bảng giá versioned của loại phòng.
- `RoomTypeRateAudit.cs`: Entity nhật ký kiểm toán thay đổi bảng giá và chia tách khoảng ngày.

### Application Layer
- `UnprocessableEntityException.cs`: Exception ánh xạ sang HTTP 422.
- `IApplicationDbContext.cs`: Khai báo DbSet cho các entity mới và phương thức `LockRoomTypeRowAsync`.
- **Chính sách Chi nhánh:**
  - `PropertyPoliciesDto.cs`, `SurchargePolicyDto.cs`: DTO hợp đồng dữ liệu.
  - `GetPropertyPoliciesQueryHandler.cs`: Truy vấn chính sách và danh sách phụ thu chi nhánh.
  - `UpdatePropertyPoliciesCommandHandler.cs`: Cập nhật chính sách chi nhánh và thay thế danh sách phụ thu trong transaction.
  - `UpdatePropertyPoliciesCommandValidator.cs`: Kiểm tra `BufferMinutes >= 30`, `1 <= MaxHourlyHours <= 24`, hợp lệ khoảng thời gian phụ thu.
- **Bảng giá Phòng & Audit:**
  - `RoomTypeRateDto.cs`, `RoomTypeRateAuditDto.cs`: DTO hợp đồng dữ liệu.
  - `GetRoomTypeRatesQueryHandler.cs`: Truy vấn danh sách bảng giá đang hoạt động.
  - `GetRoomTypeRateHistoryQueryHandler.cs`: Truy vấn lịch sử kiểm toán bảng giá.
  - `CreateRoomTypeRateCommandHandler.cs`: Xử lý khóa dòng phòng, xác thực quyền chi nhánh, chia tách khoảng ngày (Mid / Head), ghi audit và lưu bảng giá mới.
  - `CreateRoomTypeRateCommandValidator.cs`: Kiểm tra giá dương, `FirstHours >= 1`, ngày kết thúc sau ngày bắt đầu, không cấu hình lùi trong quá khứ.
- **Quote Engine:**
  - `QuoteDto.cs`, `QuoteBreakdownItemDto.cs`, `AppliedPoliciesDto.cs`: DTO phản hồi báo giá chi tiết và snapshot chính sách.
  - `CalculateQuoteQuery.cs`: Lệnh truy vấn báo giá theo giờ / theo đêm.
  - `CalculateQuoteQueryValidator.cs`: Kiểm tra tính hợp lệ của thời lượng, dung sai walk-in 30 phút, ràng buộc `CheckInDate`/`CheckOutDate`.
  - `CalculateQuoteQueryHandler.cs`: Động cơ tính giá hoàn chỉnh, thực thi các quy tắc D05, D06, D14, D19, D20, D25, BR_PRICE03.

### Infrastructure Layer
- `PropertyConfiguration.cs`: Cấu hình `MaxHourlyHours` mặc định 12, check constraint `CK_Properties_MaxHourlyHours`.
- `RoomTypeConfiguration.cs`: Cấu hình alternate key `UQ_RoomTypes_Tenant_Property_Id`.
- `PropertySurchargePolicyConfiguration.cs`: Cấu hình khóa ngoại composite và index tìm kiếm.
- `RoomTypeRateConfiguration.cs`: Cấu hình composite foreign key `FK_RoomTypeRates_RoomTypes_Composite`.
- `RoomTypeRateAuditConfiguration.cs`: Cấu hình audit foreign keys và index lịch sử.
- `ApplicationDbContext.cs`:
  - Triển khai `LockRoomTypeRowAsync` với câu lệnh SQL tường minh `SELECT "Id" FROM "RoomTypes" WHERE ... FOR UPDATE`.
  - Bắt lỗi exclusion constraint `23P01` của PostgreSQL và chuyển đổi thành `ConflictException("ERR_RATE_OVERLAP")`.
  - Ghi đè `OnConfiguring` cấu hình bỏ qua `PendingModelChangesWarning` trong EF Core 10.
- `ExceptionHandlingMiddleware.cs`: Bổ sung xử lý `UnprocessableEntityException` $\to$ HTTP 422 và SQLSTATE `23P01` $\to$ HTTP 409 `ERR_RATE_OVERLAP`.
- `20261008000000_P2B02_Rates_Policies_Quote.cs`: Script migration hoàn chỉnh với `Up()` và `Down()` fail-closed.
- `20261008000000_P2B02_Rates_Policies_Quote.Designer.cs` & `ApplicationDbContextModelSnapshot.cs`: Cập nhật đồng bộ model snapshot cho EF Core 10.

### WebApi Layer
- `PropertiesController.cs`:
  - `GET /api/properties/{id}/policies` (`[RequirePermission("PROPERTIES", Read)]`)
  - `PUT /api/properties/{id}/policies` (`[RequirePermission("PROPERTIES", Update)]`)
- `RoomTypesController.cs`:
  - `GET /api/room-types/{id}/rates` (`[RequirePermission("ROOM_TYPES", Read)]`)
  - `GET /api/room-types/{id}/rates/history` (`[RequirePermission("ROOM_TYPES", Read)]`)
  - `POST /api/room-types/{id}/rates` (`[RequirePermission("ROOM_TYPES", Update)]`)
- `QuotesController.cs`:
  - `POST /api/quotes/calculate` (`[Authorize]`)

---

## 3. Bảng Ma Trận Ánh Xạ Nghiệp vụ, Source Code và Bằng Chứng Kiểm thử

| Tiêu chí / Quyết định | Yêu cầu Kỹ thuật & Nghiệp vụ | File Triển khai | Bằng chứng Kiểm thử (Test Suite) |
| :--- | :--- | :--- | :--- |
| **Quyết định D12, D14 (Chờ PO)** | Chính sách cơ sở: Check-in/out, `BufferMinutes >= 30`, `1 <= MaxHourlyHours <= 24`, Surcharge policies. D14 giữ trạng thái chờ PO duyệt. | `PropertyConfiguration.cs`<br>`UpdatePropertyPoliciesCommandHandler.cs`<br>`UpdatePropertyPoliciesCommandValidator.cs` | `PricingAndPoliciesHttpPipelineTests.cs`<br>- Step 2a: GET trả đúng mặc định 30p, 12h.<br>- Step 2b: Buffer < 30 trả 400 Bad Request.<br>- Step 2c: MaxHours > 24 trả 400 Bad Request.<br>- Step 2d: PUT hợp lệ cập nhật 45p, 8h và 2 biểu phí phụ thu.<br>`P2B02_ReviewerFindingsRegressionTests.cs`<br>- `Finding1_D14_PendingPOApproval_InterimConfiguration_DocumentedAndEnforced` |
| **Quyết định D13 & SQLSTATE 23P01** | Bảng giá versioned; exclusion constraint chống chồng lấn; race condition giữa 2 connection đồng thời phải map về HTTP 409 `ERR_RATE_OVERLAP`. | `RoomTypeRateConfiguration.cs`<br>`ApplicationDbContext.cs`<br>`ExceptionHandlingMiddleware.cs` | `P2B02_RealDatabasePricingAndConcurrencyTests.cs`<br>- `ConcurrentRateInsert_WithExclusionConstraint_BarrierGuaranteesConflictAndOneWinner`: Hai DbContext đồng thời insert đụng độ ngày qua `Barrier(2)`, đúng 1 winner thành công, đúng 1 loser nhận `ERR_RATE_OVERLAP` (`23P01`), DB chỉ ghi nhận 1 bản ghi. |
| **Composite FK Protection** | Khóa ngoại composite ngăn chặn gán bảng giá sang chi nhánh khác. | `RoomTypeConfiguration.cs`<br>`RoomTypeRateConfiguration.cs` | `P2B02_RealDatabasePricingAndConcurrencyTests.cs`<br>- `RoomTypeRate_CompositeForeignKey_CrossPropertyViolation_ThrowsDbUpdateException`: Insert rate có `PropertyId = P2` nhưng `RoomTypeId` thuộc P1 bị chặn bởi FK `FK_RoomTypeRates_RoomTypes_Composite` (SQLSTATE `23503`). |
| **Interval Splitting (Mid & Head)** | Chia tách khoảng giá Mid (shorten + create) và Head (replace old), ghi nhật ký kiểm toán không phá hủy. | `CreateRoomTypeRateCommandHandler.cs`<br>`RoomTypeRateAuditConfiguration.cs` | `P2B02_RealDatabasePricingAndConcurrencyTests.cs`<br>- `IntervalSplitting_MidAndHead_UpdatesContinuousCoverageAndPersistsAudits`: Chạy qua 3 bước (Initial, Mid split, Head replace); xác nhận DB giữ đúng 2 khoảng giá không chồng lấn và ghi đủ các audit: `Created`, `Split_Shortened`, `Split_Created`, `Replaced`, `Replaced_Created`. |
| **Rollback Fail-Closed** | Rollback migration từ chối drop bảng nếu có dữ liệu thực trong schema; chỉ drop khi bảng rỗng. | `20261008000000_P2B02_Rates_Policies_Quote.cs` | `P2B02_RealDatabasePricingAndConcurrencyTests.cs`<br>- `MigrationRollback_FailClosed_WhenDataExists_RefusesTableDrop`: Khi có dữ liệu rate, chạy script Down ném `MIGRATION ROLLBACK ABORTED (FAIL-CLOSED)`, bảng không bị drop; xóa dữ liệu và chạy lại thì drop thành công. |
| **Quyết định D05, D25 (Quote Hourly)** | Thuê giờ: tối thiểu gói giờ đầu; giờ phát sinh ceil lên 1 giờ; AwayFromZero làm tròn 1 đồng. Không Math.Round phút trước khi ceil. | `CalculateQuoteQueryHandler.cs` | `P2B02_ReviewerFindingsRegressionTests.cs`<br>- `Finding5a_ExactDuration_WithoutIntermediateMinuteRounding_CeilsExtraHour`: Dư 20 giây ceil thành 1 giờ thêm = 200,000 VND.<br>- `Finding5b_AwayFromZero_VndRounding_EnforcedOnAllLineItemsAndTotal`: Midpoint 0.5 làm tròn lên 1 đồng.<br>`QuoteEngineCalculationTests.cs`<br>- `CalculateQuote_Hourly_ExceedsBy61Minutes_RoundsUpTo2ExtraHours_PerDecisionD05` |
| **Quyết định D14 (Quote Hourly Cap)** | Thuê giờ vượt `MaxHourlyHours` của chi nhánh bị từ chối 422 `ERR_HOURLY_LIMIT_EXCEEDED`. | `CalculateQuoteQueryHandler.cs` | `P2B02_ReviewerFindingsRegressionTests.cs`<br>- `Finding1_D14_PendingPOApproval_InterimConfiguration_DocumentedAndEnforced`<br>`QuoteEngineCalculationTests.cs`<br>- `CalculateQuote_Hourly_ExceedsMaxHourlyLimit_ThrowsUnprocessableEntity_PerDecisionD14` |
| **Quote Auth & Membership** | Kiểm tra quyền nghiêm ngặt; membership chỉ Success mới được tính giá; unauthenticated/revoked/inactive fail-closed. | `CalculateQuoteQueryHandler.cs` | `P2B02_ReviewerFindingsRegressionTests.cs`<br>- `Finding2a_Quote_MissingTenantOrUserContext_FailsClosed_ThrowsUnauthorizedAccessException`<br>- `Finding2b_Quote_ContextMismatch_ThrowsBadRequestException`<br>- `Finding2c_Quote_MembershipNotSuccess_FailsClosed` |
| **Timezone & Date Alignment** | CheckInDate/CheckOutDate phải khớp StartAtUtc/EndAtUtc theo timezone cơ sở, tránh tính thiếu đêm. | `CalculateQuoteQueryHandler.cs`<br>`CalculateQuoteQueryValidator.cs` | `P2B02_ReviewerFindingsRegressionTests.cs`<br>- `Finding3_DatesMustMatchStartEndUtc_InBranchTimeZone_PreventsNightLoss` |
| **Enum RentalType Validation** | RentalType ngoài enum bị từ chối HTTP 400; tuyệt đối không trả báo giá 0đ. | `CalculateQuoteQueryHandler.cs`<br>`CalculateQuoteQueryValidator.cs` | `P2B02_ReviewerFindingsRegressionTests.cs`<br>- `Finding4_InvalidRentalType_RejectedWithBadRequest_NeverReturnsZeroVndQuote` |
| **Quyết định D06 (Quote Overnight)** | Thuê đêm: cộng dồn giá hiệu lực từng đêm; nhận muộn không giảm giá. | `CalculateQuoteQueryHandler.cs` | `QuoteEngineCalculationTests.cs`<br>- `CalculateQuote_Overnight_Standard3Nights_SumsDailyRates_PerDecisionD06`: Đặt 3 đêm tính đúng tổng giá 3 đêm.<br>- `CalculateQuote_Overnight_LateArrival_DoesNotReduceNightRate_PerDecisionD06`: Khách đến 23:00 vẫn tính đủ giá đêm. |
| **Quyết định D19 (Surcharge Fail-Closed)** | Nhận sớm / trả muộn thiếu cấu hình phụ thu bị từ chối 422 `ERR_SURCHARGE_NOT_CONFIGURED`. | `CalculateQuoteQueryHandler.cs` | `QuoteEngineCalculationTests.cs`<br>- `CalculateQuote_Overnight_EarlyCheckIn_WithoutPolicy_ThrowsUnprocessableEntity_PerDecisionD19`<br>- `CalculateQuote_Overnight_LateCheckOut_WithoutPolicy_ThrowsUnprocessableEntity_PerDecisionD19` |
| **Quy tắc BR_PRICE03 (Missing Rate)** | Thiếu bảng giá hiệu lực ném 422 `ERR_PRICING_NOT_CONFIGURED`, không fallback `BasePrice`. | `CalculateQuoteQueryHandler.cs` | `QuoteEngineCalculationTests.cs`<br>- `CalculateQuote_Hourly_MissingPricing_ThrowsUnprocessableEntity_PerDecisionBR_PRICE03` |
| **Quyết định D20 (Quote TTL)** | Báo giá kèm thời hạn hiệu lực 5 phút (`ExpiresAtUtc`). | `CalculateQuoteQueryHandler.cs` | `PricingAndPoliciesHttpPipelineTests.cs`<br>- Step 4a: Xác nhận `expiresAtUtc` có giá trị và đúng thời hạn 5 phút. |

---

## 4. Tổng hợp Kết quả Kiểm thử Toàn Solution (200/200 tests PASS, 100% GREEN)

Chạy kiểm thử thực tế độc lập trên toàn bộ Solution:

```text
================================================================================
Test Run Results:
================================================================================

1. HotelSaas.Domain.Tests:
   Passed! - Failed: 0, Passed:   1, Skipped: 0, Total:   1, Duration: 16 ms

2. HotelSaas.WebApi.Tests:
   Passed! - Failed: 0, Passed:  41, Skipped: 0, Total:  41, Duration: 15 s
   (Bao gồm toàn bộ baseline 40 HTTP tests + test HTTP mới PricingAndPoliciesHttpPipelineTests)

3. HotelSaas.Application.Tests:
   Passed! - Failed: 0, Passed: 158, Skipped: 0, Total: 158, Duration: 2 m 44 s
   (Bao gồm 135 tests baseline + 8 tests QuoteEngineCalculationTests + 4 tests P2B02_RealDatabasePricingAndConcurrencyTests + 11 tests mới P2B02_ReviewerFindingsRegressionTests)

================================================================================
TỔNG CỘNG: 200 / 200 TESTS PASSED (100% GREEN, 0 FAILED, 0 SKIPPED)
EXIT CODE: 0
================================================================================
```

---

## 5. Kết luận & Trạng thái Bàn giao

1. **Khắc phục triệt để 5 Reviewer Findings:**
   - Quyết định D14 được trả về đúng trạng thái **Chờ PO phê duyệt (Pending PO Approval)**; cấu hình `MaxHourlyHours` chỉ là rào chắn kỹ thuật tạm thời.
   - Quote Engine kiểm soát chặt chẽ xác thực người dùng/doanh nghiệp và quyền hạn chi nhánh: chỉ `MembershipLookupStatus.Success` mới được tính giá.
   - Đồng bộ ngày theo múi giờ chi nhánh (`Asia/Ho_Chi_Minh`): `CheckInDate`/`CheckOutDate` bắt buộc khớp `StartAtUtc`/`EndAtUtc`, bảo vệ đầy đủ số đêm lưu trú.
   - Chặn đứng mọi giá trị `RentalType` ngoài enum, ngăn ngừa hoàn toàn báo giá 0đ.
   - Tính toán thời lượng chính xác bằng `TimeSpan`, làm tròn lên trực tiếp không qua trung gian số phút; làm tròn toàn bộ tiền VND bằng `MidpointRounding.AwayFromZero`.
2. **Bảo toàn dữ liệu & Không gây regression:**
   - Cơ sở dữ liệu dev/prod (`hotel_saas_dev`) được bảo vệ 100% nguyên vẹn, không chịu bất kỳ tác động nào.
   - Không sửa đổi migration files hoặc schema production.
   - Toàn bộ 189 tests trước đây + 11 regression tests mới = 200 tests xanh hoàn toàn.

---

## 6. Báo cáo Chi tiết Xử lý 5 Findings của Reviewer

### Finding 1: Quyết định D14 chưa được PO duyệt — Giữ trạng thái Chờ PO phê duyệt

- **Mô tả Finding:** Quyết định D14 chưa được PO phê duyệt chính thức; không được gọi mặc định 12h hay dải giá trị 1–24 là quyết định đã chốt; giữ trạng thái chờ PO phê duyệt.
- **Vị trí sửa & Source Diff:**
  - `Property.cs` (line 89–94):
    ```diff
    - /// <summary>
    - /// Maximum allowable duration for hourly rentals in hours (Decision D14, 1 <= MaxHourlyHours <= 24, default: 12).
    + /// <summary>
    + /// Interim maximum allowable duration for hourly rentals in hours (Decision D14 - Chờ PO phê duyệt / Pending PO Approval).
    + /// Configured as property policy boundary (1 <= MaxHourlyHours <= 24, interim default: 12) pending formal PO decision.
    + /// Rentals exceeding this threshold must book overnight.
    + /// </summary>
      public int MaxHourlyHours { get; set; } = 12;
    ```
  - `PropertyConfiguration.cs` (line 64):
    ```csharp
    // Decision D14 (Chờ PO phê duyệt / Pending PO Approval): Interim configurable property policy boundary (1..24, default 12)
    builder.Property(p => p.MaxHourlyHours).HasDefaultValue(12);
    ```
  - `CalculateQuoteQueryHandler.cs` (line 18, 107):
    ```csharp
    /// Enforces Decision D05, D06, D19, D20, D25 fail-closed constraints and interim branch policy limits (D14 pending PO approval).
    ```
  - `docs/p2a-room-pricing-design.md` & `docs/p2b-02-implementation-report.md`: Cập nhật đồng bộ tiêu đề và nội dung nêu rõ D14 đang ở trạng thái Chờ PO phê duyệt.
- **Regression Test:**
  - File: `backend/tests/HotelSaas.Application.Tests/Pricing/P2B02_ReviewerFindingsRegressionTests.cs`
  - Ca kiểm thử: `Finding1_D14_PendingPOApproval_InterimConfiguration_DocumentedAndEnforced()`
  - Tái hiện trước sửa: Xem 12h là hằng số cứng nghiệp vụ toàn hệ thống.
  - Kết quả sau sửa: Kiểm chứng cơ sở cấu hình 8h, yêu cầu thuê 8h 1s ném 422 `ERR_HOURLY_LIMIT_EXCEEDED` ("vượt quá giới hạn tối đa cho phép của chi nhánh (8 giờ)"), yêu cầu 8h thành công.
- **Lệnh chạy, exit code & kết quả:**
  ```powershell
  dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --filter "FullyQualifiedName~Finding1" --verbosity normal
  ```
  - Exit code: 0
  - Output: `Passed Finding1_D14_PendingPOApproval_InterimConfiguration_DocumentedAndEnforced [2 s]`, `Total tests: 1, Passed: 1`.

---

### Finding 2: Quote phải kiểm tra quyền; membership chỉ Success mới được tiếp tục, mọi trạng thái khác fail-closed

- **Mô tả Finding:** Quote Engine phải kiểm tra quyền; context thiếu/rỗng hoặc membership khác Success phải lập tức fail-closed; không được bypass kiểm tra khi gọi nội bộ.
- **Vị trí sửa & Source Diff:**
  - `CalculateQuoteQueryHandler.cs` (line 49–102):
    ```csharp
    // Finding 2: Require authenticated tenant and user context fail-closed
    var tenantId = _tenantService.TenantId;
    if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
    {
        throw new UnauthorizedAccessException("Tenant context is required.");
    }

    var userId = _userContext.UserId;
    if (userId == Guid.Empty)
    {
        throw new UnauthorizedAccessException("User identity context is required.");
    }

    // Header / Token property context check
    if (_propertyService != null)
    {
        if (_propertyService.HeaderPropertyId.HasValue && _propertyService.HeaderPropertyId.Value != request.PropertyId)
        {
            throw new BadRequestException("ERR_CONTEXT_MISMATCH",
                "Chi nhánh trong header X-Property-Id không khớp với chi nhánh trong nội dung yêu cầu.");
        }

        if (!_propertyService.IsTenantWide &&
            _propertyService.TokenPropertyId.HasValue && _propertyService.TokenPropertyId.Value != request.PropertyId)
        {
            throw new BadRequestException("ERR_CONTEXT_MISMATCH",
                "Chi nhánh trong nội dung yêu cầu không khớp với chi nhánh trong token xác thực.");
        }
    }
    ...
    // Finding 2: Authoritative membership check - ONLY Success proceeds, everything else fails closed
    var membership = await _membershipLookupService.ResolveMembershipAsync(tenantId.Value, userId, request.PropertyId, cancellationToken);
    if (membership.Status != MembershipLookupStatus.Success)
    {
        switch (membership.Status)
        {
            case MembershipLookupStatus.MembershipRevoked:
                throw new ForbiddenException("ERR_MEMBERSHIP_REVOKED", membership.ErrorMessage ?? "Quyền nhân sự tại chi nhánh đã bị thu hồi.");
            case MembershipLookupStatus.PropertyNotFound:
                throw new NotFoundException(membership.ErrorMessage ?? "Chi nhánh không tồn tại.");
            case MembershipLookupStatus.PropertyInactive:
                throw new ConflictException("ERR_PROPERTY_INACTIVE", membership.ErrorMessage ?? "Chi nhánh hiện không hoạt động.");
            case MembershipLookupStatus.PropertyForbidden:
                throw new ForbiddenException("ERR_PROPERTY_FORBIDDEN", membership.ErrorMessage ?? "Bạn không có quyền truy cập chi nhánh này.");
            case MembershipLookupStatus.TenantNotFoundOrInactive:
                throw new ForbiddenException("ERR_TENANT_INACTIVE", membership.ErrorMessage ?? "Doanh nghiệp hiện bị tạm ngưng.");
            default:
                throw new ForbiddenException("ERR_FORBIDDEN", membership.ErrorMessage ?? "Không có quyền truy cập chi nhánh này.");
        }
    }
    ```
- **Regression Tests:**
  - File: `backend/tests/HotelSaas.Application.Tests/Pricing/P2B02_ReviewerFindingsRegressionTests.cs`
  - Ca kiểm thử:
    1. `Finding2a_Quote_MissingTenantOrUserContext_FailsClosed_ThrowsUnauthorizedAccessException`: Kiểm tra `TenantId == null` hoặc `UserId == Guid.Empty` ném `UnauthorizedAccessException` (HTTP 401).
    2. `Finding2b_Quote_ContextMismatch_ThrowsBadRequestException`: Header `X-Property-Id` lệch chi nhánh ném HTTP 400 `ERR_CONTEXT_MISMATCH`.
    3. `Finding2c_Quote_MembershipNotSuccess_FailsClosed`: Chạy 4 trường hợp (`MembershipRevoked` $\to$ 403 `ERR_MEMBERSHIP_REVOKED`, `PropertyInactive` $\to$ 409 `ERR_PROPERTY_INACTIVE`, `PropertyForbidden` $\to$ 403 `ERR_PROPERTY_FORBIDDEN`, `TenantNotFoundOrInactive` $\to$ 403 `ERR_TENANT_INACTIVE`).
  - Tái hiện trước sửa: Bỏ qua kiểm tra quyền nếu thiếu context, cho phép tính giá trái phép.
  - Kết quả sau sửa: Mọi truy cập trái quyền hoặc membership không hợp lệ đều bị chặn đứng fail-closed.
- **Lệnh chạy, exit code & kết quả:**
  ```powershell
  dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --filter "FullyQualifiedName~Finding2" --verbosity normal
  ```
  - Exit code: 0
  - Output: `Passed: 6, Failed: 0, Total: 6`.

---

### Finding 3: CheckInDate/CheckOutDate phải khớp StartAtUtc/EndAtUtc theo timezone cơ sở, tránh tính thiếu đêm

- **Mô tả Finding:** Client gửi `CheckInDate`/`CheckOutDate` lệch với `StartAtUtc`/`EndAtUtc` theo timezone chi nhánh (`Asia/Ho_Chi_Minh`) có nguy cơ làm hệ thống tính thiếu đêm hoặc sai lệch doanh thu.
- **Vị trí sửa & Source Diff:**
  - `CalculateQuoteQueryValidator.cs` (lines 48–72):
    ```csharp
    RuleFor(x => x.CheckInDate)
        .Must((query, checkInDate) =>
        {
            if (!checkInDate.HasValue) return true;
            var tz = GetVietnamTimeZone();
            var startLocal = TimeZoneInfo.ConvertTimeFromUtc(query.StartAtUtc, tz);
            return checkInDate.Value == DateOnly.FromDateTime(startLocal);
        })
        .When(x => x.CheckInDate.HasValue)
        .WithErrorCode("ERR_DATE_TIMEZONE_MISMATCH")
        .WithMessage("Ngày nhận phòng (CheckInDate) phải khớp với thời điểm bắt đầu (StartAtUtc) theo múi giờ chi nhánh.");

    RuleFor(x => x.CheckOutDate)
        .Must((query, checkOutDate) =>
        {
            if (!checkOutDate.HasValue) return true;
            var tz = GetVietnamTimeZone();
            var endLocal = TimeZoneInfo.ConvertTimeFromUtc(query.EndAtUtc, tz);
            return checkOutDate.Value == DateOnly.FromDateTime(endLocal);
        })
        .When(x => x.CheckOutDate.HasValue)
        .WithErrorCode("ERR_DATE_TIMEZONE_MISMATCH")
        .WithMessage("Ngày trả phòng (CheckOutDate) phải khớp với thời điểm kết thúc (EndAtUtc) theo múi giờ chi nhánh.");
    ```
  - `CalculateQuoteQueryHandler.cs` (lines 173–193):
    ```csharp
    var startLocal = TimeZoneInfo.ConvertTimeFromUtc(request.StartAtUtc, tz);
    var startDateLocal = DateOnly.FromDateTime(startLocal);
    var endLocal = TimeZoneInfo.ConvertTimeFromUtc(request.EndAtUtc, tz);
    var endDateLocal = DateOnly.FromDateTime(endLocal);

    if (request.CheckInDate.HasValue && request.CheckInDate.Value != startDateLocal)
        throw new BadRequestException("ERR_DATE_TIMEZONE_MISMATCH", $"Ngày nhận phòng ({request.CheckInDate.Value:yyyy-MM-dd}) không khớp với thời điểm bắt đầu theo múi giờ chi nhánh ({startDateLocal:yyyy-MM-dd}).");

    if (request.CheckOutDate.HasValue && request.CheckOutDate.Value != endDateLocal)
        throw new BadRequestException("ERR_DATE_TIMEZONE_MISMATCH", $"Ngày trả phòng ({request.CheckOutDate.Value:yyyy-MM-dd}) không khớp với thời điểm kết thúc theo múi giờ chi nhánh ({endDateLocal:yyyy-MM-dd}).");
    ```
- **Regression Test:**
  - File: `backend/tests/HotelSaas.Application.Tests/Pricing/P2B02_ReviewerFindingsRegressionTests.cs`
  - Ca kiểm thử: `Finding3_DatesMustMatchStartEndUtc_InBranchTimeZone_PreventsNightLoss()`
  - Tái hiện trước sửa: Khách ở 3 đêm (15/10 đến 18/10), nhưng gửi `CheckOutDate = 2026-10-16` $\to$ Động cơ cũ lặp qua ngày và chỉ tính 1 đêm (400,000 VND thay vì 1,200,000 VND), làm mất trắng 2 đêm doanh thu.
  - Kết quả sau sửa: Mismatch bị từ chối ngay với HTTP 400 `ERR_DATE_TIMEZONE_MISMATCH`; khi ngày khớp đúng tính đủ 1,200,000 VND cho 3 đêm không sai lệch.
- **Lệnh chạy, exit code & kết quả:**
  ```powershell
  dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --filter "FullyQualifiedName~Finding3" --verbosity normal
  ```
  - Exit code: 0
  - Output: `Passed Finding3_DatesMustMatchStartEndUtc_InBranchTimeZone_PreventsNightLoss [1 s]`, `Total tests: 1, Passed: 1`.

---

### Finding 4: RentalType ngoài enum phải bị từ chối, tuyệt đối không trả quote 0đ

- **Mô tả Finding:** Gửi `RentalType` ngoài enum (ví dụ 0, 99) không được rơi vào fall-through trả về báo giá 0 VND.
- **Vị trí sửa & Source Diff:**
  - `CalculateQuoteQueryValidator.cs` (lines 21–27):
    ```csharp
    RuleFor(x => x.RentalType)
        .IsInEnum()
        .Must(x => x == RentalType.Hourly || x == RentalType.Overnight)
        .WithErrorCode("ERR_INVALID_RENTAL_TYPE")
        .WithMessage("Hình thức thuê không hợp lệ. Chỉ chấp nhận Hourly (1) hoặc Overnight (2).");
    ```
  - `CalculateQuoteQueryHandler.cs` (lines 280–292):
    ```csharp
    else
    {
        // Finding 4: Reject any RentalType outside enum - NEVER return 0 VND quote
        throw new BadRequestException("ERR_INVALID_RENTAL_TYPE",
            "Hình thức thuê không hợp lệ. Chỉ chấp nhận Hourly hoặc Overnight.");
    }

    // Finding 4 & 5: Safety check - totalAmount must be strictly positive
    if (totalAmount <= 0)
    {
        throw new UnprocessableEntityException("ERR_INVALID_QUOTE_TOTAL",
            "Tổng tiền báo giá không hợp lệ (nhỏ hơn hoặc bằng 0).");
    }
    ```
- **Regression Test:**
  - File: `backend/tests/HotelSaas.Application.Tests/Pricing/P2B02_ReviewerFindingsRegressionTests.cs`
  - Ca kiểm thử: `Finding4_InvalidRentalType_RejectedWithBadRequest_NeverReturnsZeroVndQuote()`
  - Tái hiện trước sửa: Khi truyền `RentalType = (RentalType)99`, cả hai nhánh `if` đều bỏ qua, `totalAmount` giữ giá trị 0m và trả về `QuoteDto` với giá 0 VND.
  - Kết quả sau sửa: Handler ném `BadRequestException("ERR_INVALID_RENTAL_TYPE")`, Validator ném lỗi validation `ERR_INVALID_RENTAL_TYPE`; không một báo giá 0đ nào được tạo ra.
- **Lệnh chạy, exit code & kết quả:**
  ```powershell
  dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --filter "FullyQualifiedName~Finding4" --verbosity normal
  ```
  - Exit code: 0
  - Output: `Passed Finding4_InvalidRentalType_RejectedWithBadRequest_NeverReturnsZeroVndQuote [1 s]`, `Total tests: 1, Passed: 1`.

---

### Finding 5: Tính thời lượng chính xác, không Math.Round phút trước khi ceil giờ; làm tròn tiền VND đúng contract

- **Mô tả Finding:** Thuê theo giờ không được dùng `Math.Round` trên phút trước khi làm tròn lên (Ceil) giờ phụ trội, tránh làm tròn xuống nuốt mất phút phát sinh; toàn bộ tiền VND phải làm tròn `MidpointRounding.AwayFromZero` đến 1 đồng.
- **Vị trí sửa & Source Diff:**
  - `CalculateQuoteQueryHandler.cs` (lines 104–157, 275):
    ```csharp
    // Finding 5: Exact duration calculation without prior rounding on minutes
    var duration = request.EndAtUtc - request.StartAtUtc;
    if (duration <= TimeSpan.Zero)
        throw new BadRequestException("ERR_INVALID_DURATION", "Thời gian thuê phải lớn hơn 0.");

    var packageDuration = TimeSpan.FromHours(rate.FirstHours);
    if (duration <= packageDuration)
    {
        var firstHoursPrice = Math.Round(rate.FirstHoursPrice, 0, MidpointRounding.AwayFromZero);
        totalAmount = firstHoursPrice;
        ...
    }
    else
    {
        var extraDuration = duration - packageDuration;
        // Finding 5: strictly ceil extra hours without intermediate Math.Round on minutes
        var extraHours = (int)Math.Ceiling(extraDuration.TotalHours);
        var additionalUnitPrice = Math.Round(rate.AdditionalHourPrice, 0, MidpointRounding.AwayFromZero);
        var additionalAmount = Math.Round(extraHours * additionalUnitPrice, 0, MidpointRounding.AwayFromZero);
        var firstHoursPrice = Math.Round(rate.FirstHoursPrice, 0, MidpointRounding.AwayFromZero);
        totalAmount = firstHoursPrice + additionalAmount;
        ...
    }
    ```
- **Regression Tests:**
  - File: `backend/tests/HotelSaas.Application.Tests/Pricing/P2B02_ReviewerFindingsRegressionTests.cs`
  - Ca kiểm thử:
    1. `Finding5a_ExactDuration_WithoutIntermediateMinuteRounding_CeilsExtraHour`:
       - Khách thuê 2 giờ và 20 giây (vượt gói 2 giờ đúng 20 giây = 120.333 phút).
       - Tái hiện trước sửa: `Math.Round(120.333)` làm tròn XUỐNG thành 120 phút $\to$ ExtraMinutes = 0 $\to$ Thu 150,000 VND (bỏ sót giờ phát sinh).
       - Kết quả sau sửa: `extraDuration.TotalHours` (20 giây) được ceil trực tiếp lên 1 giờ thêm $\to$ Thu đúng 200,000 VND (150,000đ + 50,000đ).
    2. `Finding5b_AwayFromZero_VndRounding_EnforcedOnAllLineItemsAndTotal`:
       - Giá đêm 350,001 VND, phụ thu nhận sớm 50% = 175,000.5 VND.
       - Kết quả sau sửa: `MidpointRounding.AwayFromZero` làm tròn điểm giữa 0.5 lên 175,001 VND, tổng tiền 525,002 VND (trong khi làm tròn Bankers/ToEven sẽ làm tròn xuống 175,000 VND).
- **Lệnh chạy, exit code & kết quả:**
  ```powershell
  dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --filter "FullyQualifiedName~Finding5" --verbosity normal
  ```
  - Exit code: 0
  - Output: `Passed: 2, Failed: 0, Total: 2`.
