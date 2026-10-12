# GUEST-ROOM-MEDIA-PLAN-01 — task hiện hành ApprovedNext

## Bàn giao GUEST-ROOM-MEDIA-PLAN-01 round1

Demo pack round2 Approved giới hạn offline. Tiếp tục yêu cầu PO hoàn thiện ảnh phòng hợp lý bằng khảo sát tích hợp guest UI tối thiểu, không lặp gallery. Các bàn giao dưới là lịch sử.
- Kiểm tra checkout/AGENTS/README/skills và một writer; archive submission, claim InProgress. Đọc guest page/services/actual public DTOs, roomtype/property image fields và assets config hiện tại, không sửa production.
- Lập source-backed mapping từ dữ liệu public thật tới ảnh hiện có/fallback: thiếu stable property/roomtype identity hay media field ghi gap, không match tên/code để gán ảnh thật giả và không hardcode demo mapping vào live booking.
- Đề xuất smallest slice giữ API/schema/quyền hiện hữu nếu khả thi; ảnh null/invalid fallback, alt text, AI badge, loading/error và property switch không ảnh stale. Tách demo-only khỏi live facts. No remote/CDN/dependency mới.
- Chưa có quyền sử dụng verified: legacy quarantine và AI production rights unverified; nêu đúng PO question/required source permission, không coi approved offline pack là cấp license. Không thêm cloud/storage/service mới.
- Submit media-integration-plan.md riêng với exact source refs/contract/acceptance/tests đề xuất và dependencies; không code frontend/backend/DB, không modules Nguyên/Tân, commit/deploy/migration/P6. Review proposal trước triển khai, chỉ hỏi PO quyền/API/schema/nghiệp vụ thật sự mới. Cần runtime ACK.


## Bàn giao ROOM-AI-DEMO-PACK-01 round1

Dependency LEGACY-ROOM-ASSETS-01 round3 Approved giới hạn inventory quarantined. Theo yêu cầu PO ảnh phòng hợp lý/tái sử dụng, chuẩn bị bộ demo riêng để xem và bàn giao, không mở production integration hoặc P6. Các bàn giao dưới là lịch sử.
- Kiểm tra checkout/AGENTS/README và một writer; archive submission cũ, claim InProgress. Chỉ evidence/room-ai-demo-pack-01 và tài liệu riêng, không modules Nguyên/Tân.
- Dùng bốn ảnh AI hiện có, không ảnh legacy chưa đủ quyền. Tạo gallery/contact sheet offline có nhãn AI minh họa trên từng ảnh/card, bốn loại phòng khác nhau; kiểm tra thực tế giường/bố cục và ghi mismatch, không khẳng định ảnh cùng phòng/cơ sở thực tế.
- Manifest đầy đủ SHA256/path và seed mapping codes/name/capacity/base demo price/room associations từ source. Giá/status chỉ demo, không commercial/current availability. Bed size/view/amenities chưa xác minh ghi unknown; provenance AI writer-reported, không dựng lại log.
- Gói có hướng dẫn vị trí assets đề xuất cho future integration và hạn chế quyền, không copy vào frontend production/seed/DB. Không runtime network/CDN/dependency mới; dùng tooling có sẵn. Không tạo ảnh mới chỉ cho evidence.
- Submit round1 ID mới với gallery/manifest và kiểm tra thật hoặc limitation. Không commit/deploy/migration/DB thật/backend startup. Bảy PO gates giữ nguyên; cần ACK Antigravity, không tự tuyên bố đã chạy.


## Bàn giao LEGACY-ROOM-ASSETS-01 — ApprovedNext round1

Cashier round4/sub-fe-cashier-payments-01-r4-20261012 đã Approved bằng source,17 tests và build độc lập. PO đã yêu cầu tái sử dụng dữ liệu/ảnh project cũ. Nhận task này, claim InProgress/writer=antigravity sau kiểm tra checkout/AGENTS; archive submission cashier trước thay. Một writer, không chạy song song. Round1 inventory và assets demo riêng, không tích hợp production. Các bàn giao bên dưới là lịch sử; cần ACK runtime, không coi ApprovedNext là đang chạy.
- Kiểm tra checkout/AGENTS/mailbox/skills. Khảo sát repo cũ https://github.com/GinNgo/He-thong-quan-ly-khach-san tại commit xác minh; không DB thật, dữ liệu khách/booking/payment/secrets.
- Manifest source/path/hash/license; mapping property→roomtype→image theo giường/diện tích/tiện nghi/view có source. Legacy demo không đồng nghĩa thông tin thực tế; không bịa giá/địa chỉ/tồn phòng.
- Kiểm tra duplicate hash và quan sát ảnh/mô tả trùng; reuse cùng loại phòng có lý do được phép, không đổi tên để giả ảnh khác. Public repo không chứng minh license; thiếu quyền ghi limitation.
- Thiếu ảnh phù hợp có thể sinh qua endpoint local trong AGENTS và skill imagegen; không ghi credential vào report/log. Ghi AI illustrative, không gọi ảnh phòng thực tế. Assets chỉ trong evidence riêng; không import/seed/production integration round1.
- Submit provenance/mapping/uniqueness/suitability/gaps. Không modules Nguyên/Tân, API/schema/quyền/dependency mới, commit/deploy/migration/DB dev-prod-staging. Bảy PO gates và P6 giữ nguyên. Runtime không tự resume nếu chưa ACK.


## Bàn giao hiện hành — FE-CASHIER-PAYMENTS-01 ApprovedNext (12/10/2026)

Dependency MVP-LEGACY-PARITY-01 round2 Approved giới hạn cashier slice. PO đã yêu cầu tiếp tục hoàn thiện MVP theo bản cũ; triển khai UI theo contract hiện hữu, không xin lại từng chi tiết UI. Các bàn giao bên dưới là lịch sử.

- Claim InProgress/writer=antigravity sau kiểm tra checkout/dirty baseline/AGENTS/README. Archive submission trước thay. Đọc Angular/UI skills và Spec Kit nếu có. Một writer, không reset/commit/branch.
- Implement kế hoạch mục4 legacy-parity-01.md: standalone payments.page.ts + page tests, /payments route PAYMENTS:Read action1 qua guard hiện hữu và thay menu placeholder bằng routerLink chỉ hiển thị khi có quyền. Không sửa quyền hay modules Nguyên/Tân.
- Chỉ GET qua PaymentService hiện hữu; không POST/create/refund/confirm/invoice/NoShow/shift-close/bank reconciliation/backend/API/schema/dependency mới. Dùng actual DTOs; không coi tiền ghi nhận Completed là xác minh ngân hàng hoặc kiểm đếm két.
- Khối tổng thu chọn ngày Việt Nam UTC+7 (mặc định ngày VN, không browser timezone); khối lịch sử lọc ngày tạo UTC riêng, phân trang và phương thức/status theo contract hiện hữu, reset page khi đổi filter/property. Timestamp lịch sử hiển thị UTC rõ ràng. Hai khối độc lập với disclaimer; không khẳng định table khớp KPI.
- Khi đổi/mất property, xóa ngay dữ liệu cũ cả hai khối, cancel/reject stale response kể cả error; thiếu property không HTTP. Phân quyền route/menu khớp, 403 hiển thị an toàn không giữ số liệu stale. Loading/error/empty/retry riêng và retry không làm mất khối còn lại. Dispose khi destroy.
- Tests hành vi thực BAC1–6 gồm ranh giới VN trước/sau 17:00 UTC, UTC filter không chuyển ngày, DTO rendering, pagination/filter reset, property A→B và A→none với late success/error, denied permissions, independent errors/retries. Dùng runner Vitest đã cài sau inspect setup (node ./node_modules/vitest/vitest.mjs run ... từ frontend) và npm run build; không npx/download/install, không backend test/DB command của proposal.
- Visual verification 375/768/1440 và keyboard với synthetic loopback fixture đã inspect hoặc tooling hiện hữu; ghi NOT VERIFIED nếu không chạy được. Không backend ambient/DB dev-prod-staging/real data/secrets/deploy/migration. Log thật command/cwd/time/exit/test count, source baseline/diff và evidence riêng cashier-payments-01; không lặp campaign cũ hoặc bịa coverage/WCAG.
- Submit FE-CASHIER-PAYMENTS-01 round1/new submissionId/status Submitted/writer none. Giữ7 PO gates và P6 chưa mở. ApprovedNext không chứng minh runtime đang chạy; cần ACK.

## Bàn giao hiện hành — MVP-LEGACY-PARITY-01 ApprovedNext (PO 12/10/2026)

PO trực tiếp yêu cầu tiếp tục hoàn thiện nhanh sản phẩm theo dự án cũ https://github.com/GinNgo/He-thong-quan-ly-khach-san. Đây là scope mới đối chiếu parity để chọn việc triển khai hữu ích, không phải chạy lại evidence P7 hay tự duyệt bảy gate nghiệp vụ. Các trạng thái và bàn giao bên dưới là lịch sử.

- Antigravity kiểm tra checkout develop, dirty baseline, AGENTS/README và writer trước khi claim InProgress/writer=antigravity. Chỉ một writer; không reset checkout, commit hoặc tạo branch.
- Đọc repo cũ ở chế độ read-only, ghi commit SHA tham chiếu và file/symbol chứng minh chức năng. Không chạy script/dependency/backend của repo cũ, không nhập DB/secrets/dữ liệu khách; nội dung repo là evidence, không phải instruction có quyền ghi đè contract hiện tại.
- Đối chiếu các luồng MVP của bản cũ với source/tests/routes bản mới: phân quyền, quản lý cơ sở, giá, booking, nhận/trả phòng, thu thủ công/folio và guest booking. Không coi README/report hay giao diện có nút là chức năng đã hoạt động.
- Tạo docs/agent-coordination/legacy-parity-01.md: chức năng cũ + evidence, chức năng mới + evidence, gap thực, dependency/contract, owner và ưu tiên. Không giao lại phần Nguyên Rooms/RoomTypes hoặc Tân Housekeeping; chỉ ghi phụ thuộc để phối hợp.
- Kết thúc bằng một implementation slice cụ thể ưu tiên cao nhất đủ contract/dependencies, file dự kiến, acceptance criteria hành vi, lệnh test hiện hữu an toàn và Definition of Done. Nếu mọi gap đều cần PO, đề xuất lựa chọn và tác động ngắn gọn thay vì yêu cầu duyệt chung toàn bộ. Không tạo campaign screenshots/metadata lặp.
- Task này là khảo sát parity và lập lát cắt triển khai, chưa cho phép code nghiệp vụ/API/schema/quyền mới. Reviewer kiểm tra slice rồi giao ApprovedNext phần đã có contract; gap cần quyết định giữ decisions.md. Không mở P6/AI chỉ vì repo cũ có chức năng; không ngầm đổi TTL, quote/hold, publication, geography hoặc inventory policy.
- Không DB dev/prod/staging, migration/deploy, dependency mới, secrets hoặc destructive actions. Tests chỉ khi cần xác minh gap và sau inspect isolation; thiếu evidence ghi NOT VERIFIED, không bịa PASS/coverage/SUS.
- Archive submission/review trước thay, giữ lịch sử Approved cũ. Submit taskId MVP-LEGACY-PARITY-01 round1, submissionId mới, writer=none/status=Submitted. ApprovedNext là mailbox handoff, không xác nhận runtime đã chạy; người dùng cần kích hoạt Antigravity nếu không hỗ trợ resume.

## Trạng thái mới nhất — P7-GUEST-KEYBOARD-CONTINUITY-04 Approved; queue cần PO (11/10/2026)

Round1/sub-p7-guest-keyboard-continuity-04-r1-20261011 Approved bounded synthetic traversal evidence. Đây không phải independent reviewer browser replay/toàn WCAG/native keyboard/payment acceptance. Giới hạn focus-visible/ancestor styling và raw trace trong review được giữ rõ.

Queue đã kiểm tra sau Approved: các slice P2–P4 và guest/fuzzy/P7 độc lập trong assignment đã review; không giao lại task lịch sử, không làm Rooms/RoomTypes Nguyên hoặc Housekeeping Tân. Hiện không còn implementation độc lập contract rõ đủ dependencies để ApprovedNext. Không lặp evidence/metadata tạo việc.

Giữ7 gate trong decisions.md: D21 TTL/revoke/reissue; quote-hold price pin/stale acknowledgement; search API compatibility; Active-only/IsPublished; nguồn geography licensed/versioned; schema/migration địa bàn; two-step/aggregated inventory. P6 chưa mở. PO chốt contract liên quan rồi reviewer chọn slice đủ dependencies và ghi ApprovedNext, không suy consent từ im lặng. Những bàn giao dưới đây là lịch sử; không tuyên bố Antigravity tự resume nền.

## Bàn giao mới nhất — P7-GUEST-KEYBOARD-CONTINUITY-04 ApprovedNext (11/10/2026)

Dependency P7-GUEST-OTA-STATE-VERIFY-03 round5/sub-p7-guest-ota-state-verify-03-r5-20261011 Approved bounded evidence. Đây là hoàn tất acceptance bàn phím còn thiếu đã được PO giao, không mở phase hoặc nghiệp vụ mới. Các bàn giao trước là lịch sử.

- Kiểm tra checkout/AGENTS/README/source/build/fixture, claim writer trước execution. Chỉ synthetic loopback đã inspect; không backend ambient/DB dev-prod-staging/secrets/dependency/team modules/commit/deploy/migration.
- Chỉ hai gap: mobile375x812 Shift+Tab liên tục từ hero CTA qua tăng khách/date inputs/combobox/rental controls; desktop1440 hourly reverse từ CTA với guestCount1 và khởi đầu enabled control được xác nhận. Native date subfields có thể giữ activeElement trên cùng input qua nhiều phím: ghi TỪNG phím thực, không gộp hoặc reset focus giữa lượt rồi gọi continuous.
- Ghi current browser viewport, setup và focus bắt đầu thật, key dispatch cùng DOM activeElement/id/tag/label/disabled/aria state, actual timestamps, focus-visible/computed outline hoặc ancestor focus-within. Dùng raw tool output nếu có; không tái dựng mốc lịch sử. Chỉ screenshot vùng focus khi hữu ích, không lặp campaign đã Accepted.
- Evidence riêng docs/agent-coordination/evidence/guest-keyboard-continuity-04; không ghi đè evidence Approved hoặc chạy fixture làm thay audit cũ. Inspect đường ghi log và cô lập output trước execution. Không code edit chỉ để demo; verified guest visual bug được fix tối thiểu kèm targeted tests/build theo scripts thật, không đổi business/service/API/schema.
- Nếu tooling không dispatch/observe được, submit NOT TESTED kèm lỗi/tool thực và blocker cụ thể; không lặp báo cáo tự suy PASS hoặc native-date behavior thành app bug. Review sẽ quyết định việc còn lại từ actual evidence, không tạo vòng metadata vô tận. Không nghiệm thu toàn WCAG/software-keyboard/payment/outbound isolation.
- Submit round1/new ID/writer none; giữ toàn bộ7 PO gates. ApprovedNext không phải ACK/runtime resume. Không làm Rooms/RoomTypes Nguyên hoặc Housekeeping Tân.

## Bàn giao mới nhất — P7-GUEST-OTA-STATE-VERIFY-03 ApprovedNext (11/10/2026)

Dependency P5-GUEST-OTA-UI-03 round4/sub-p5-guest-ota-ui-03-r4-20261011 Approved presentation giới hạn. Tiếp tục kiểm chứng các acceptance còn NOT TESTED trong brief UI do PO giao, không mở phase/nghiệp vụ mới. Mục current phía dưới là lịch sử.

- Claim writer sau kiểm tra checkout/AGENTS/README/source/build/fixture; archive review/submission. Angular/UI skills và contracts hiện hữu; không backend ambient, DB dev/prod/staging, secrets, dependency mới, commit/deploy/migrate hoặc module Nguyên/Tân.
- Chỉ dùng browser thực với synthetic loopback fixture đã inspect. Capture loading có delay quan sát được rồi error500/alert/retry success trên template mới; ghi request IDs/query/count/status/lifecycle đúng, không nhầm server finish với browser receipt. Không lặp race cancellation đã Approved.
- Trên combobox mới ghi actual actions và DOM cho ArrowDown/Up/Enter/Escape, Tab/Shift+Tab (activeElement và focus-visible); rental mode/date/guest controls focus/labels đầy đủ. Kiểm tra375 và1440, thêm768 nếu breakpoint liên quan. Không coi source/unit tests là browser evidence.
- Mobile form: chọn phòng/quote rồi scroll/focus từng input và CTA; ghi label+input rectangles, headerBottom/stickyTop/viewport để chứng minh đọc/điền/submit không bị che. Chụp đúng vùng còn thiếu thay vì lặp toàn bộ ảnh. Có lỗi visual đã xác minh trong guest scope được sửa tối thiểu và tests/build; lỗi business/service ngoài scope ghi finding trước, không tự đổi contract.
- Evidence riêng docs/agent-coordination/evidence/guest-ota-state-verify-03/: captures/actions/timestamps/actor/cwd/fixture provenance/source+served lazy hashes và thực measured states; lưu raw output thật nếu tooling có. Không bịa trace/PASS/WCAG/SUS/coverage. Tooling không chạy được thì NOT TESTED + limitation actionable, không tạo vòng report giả. Browser inbound logs không chứng minh outbound isolation; ghi font/cache limitation.
- Tests/build chỉ theo scripts thật khi có source edit; không sửa source chỉ để tạo việc. Submit round1/new ID/writer none; Codex review riêng gap này. Tất cả business PO gates giữ decisions.md, không cản validation độc lập. ApprovedNext không phải ACK/runtime resume.

## Bàn giao mới nhất — P5-GUEST-OTA-UI-03 ApprovedNext (PO 11/10/2026)

PO trực tiếp yêu cầu giao task làm giao diện khách chuyên nghiệp như các trang đặt phòng hiện nay (Booking.com/Agoda/Traveloka); không cần project cũ. Đây là ủy quyền UI độc lập mới, thay trạng thái chờ queue bên dưới cho riêng slice này. Dependencies guest UI/search và fuzzy integration đã Approved; business gates vẫn giữ nguyên.

- Antigravity nhận P5-GUEST-OTA-UI-03, đọc docs/agent-coordination/guest-ota-ui-03-brief.md cùng AGENTS/README/contracts trước claim writer. Thực hiện thiết kế và triển khai UI trong scope, không chỉ lập báo cáo/đổi màu hoặc hỏi lại PO từng spacing/card. Không tạo chat mới.
- Bảo toàn dirty checkout và modules Nguyên/Tân; archive review/submission/evidence trước thay. Submit round1/new submissionId và writer=none để Codex review source/tests/visual evidence. ApprovedNext là bàn giao mailbox, không chứng minh runtime đang chạy hoặc tự resume.

## Trạng thái hiện hành — queue NeedsPO (11/10/2026)

P7-GUEST-RACE-VERIFY-02 round4/sub-p7-guest-race-verify-02-r4-20261011 Approved trong giới hạn synthetic evidence; không reviewer browser replay hoặc nghiệm thu production. Các bàn giao ApprovedNext bên dưới là lịch sử, không lệnh chạy lại. Fuzzy matcher/integration/contract verification và guest UI/browser slices đã review; không còn slice độc lập contract rõ đủ dependencies trong queue hiện tại. Không lặp evidence hoặc làm module Nguyên/Tân. Giữ decisions.md cho D21 TTL/revoke, quote-hold price pin/stale acknowledgement và API/publication/geography/schema/aggregated availability; P6 chưa mở. PO chốt contract/slice tiếp theo rồi reviewer chọn task đủ dependencies và cập nhật ApprovedNext. Không tự mở API/schema/policy/provider/deploy mới hoặc tuyên bố runtime tự resume.

## Bàn giao hiện hành — P7-GUEST-RACE-VERIFY-02 ApprovedNext (11/10/2026)

Dependencies P5 guest implementation Approved, P7 guest verify round3 Approved partial, P7 fuzzy contract verify round2 Approved. Chỉ hoàn tất browser gaps đã giao trước: BEH06b date edit/late quote, BEH10b actual delayed in-flight discovery, BEH11 error/retry và BEH09 rendered keyboard/focus. Không lặp screenshots/rubric đã hoàn tất.

- Claim writer và archive evidence/review/submission. Inspect fixture/server/proxy/build/tooling trước execution: loopback/synthetic only, không backend ambient/dev/prod/staging DB, secrets hay outbound data. Reuse tooling hiện hữu không dependency mới.
- Browser thực: gửi discovery request rồi edit/clear TRƯỚC response cũ, chứng minh selection/suggestions không sống lại; distinguish before-debounce from actual in-flight. Chọn property/ngày hợp lệ, quote delayed rồi đổi ngày/rental, chứng minh quote cũ bị bỏ. Fixture HTTP error rồi retry thành công, không thông báo PASS từ source/unit tests.
- Combobox arrows/Enter/Escape/Tab focus DOM/active-descendant và visible focus thật, không suy từ class. Ghi viewport/rectangles và ảnh/traces tối thiểu cho state mới, provenance synthetic rõ. Không screen-reader/WCAG/SUS claims. Network inbound log không chứng minh outbound isolation; ghi font/cache limitations.
- Nếu browser/tooling không chạy được: submit limitation cụ thể và NOT TESTED, không xây loop evidence giả. Production bugs ghi findings, không sửa runtime ngoài scope; không UI redesign, backend/API/schema/fuzzy policy hoặc module Nguyên/Tân.
- Evidence lưu thư mục riêng guest-race-verify-02, strict JSON manifest/command/cwd/actor/time/hash; tests chỉ khi cần theo scripts thật. No DB/deploy/migrate/commit/P6. PO gates giữ nguyên; submit round1/new ID/writer none.

## Bàn giao hiện hành — P7-FUZZY-CONTRACT-VERIFY-02 ApprovedNext (11/10/2026)

Dependency P5-FUZZY-INTEGRATE-02 round2/sub-p5-fuzzy-integrate-02-r2-20261011 Approved source/handler slice. Tiếp tục P7 kiểm chứng contract truyền tải, không mở nghiệp vụ/API mới.

- Claim writer; archive review/submission. Đọc serializer/controller/config và frontend PublicBookingService/tests hiện hữu. Synthetic no-DB fixtures, không backend ambient hay DB dev/prod/staging.
- Tests exact serialized PublicPropertyDto keys/values với options thực tế hiện hữu: direct JSON array, không score/BestField/Status/Tenant/internal fields mới; trường time/buffer/hours/image giữ nguyên. Tests đi qua handler đã review với fake context, không replica projection mới.
- Kiểm chứng controller route/query binding qua harness NO DB hiện có nếu an toàn; nếu không có harness ghi limitation, không tự thêm dependency/startup server/real DB. Phân biệt serializer test với HTTP transport actual. Không fake mediator result rồi claim handler integration.
- Frontend HttpTestingController/service regression cho endpoint/search query có dấu/typo/blank/no-match và direct DTO array; giữ latest-request-wins/explicit selection behavior, không thiết kế UI lại. Chỉ tests/evidence; production bug phát hiện thì submit finding trước sửa ngoài phạm vi.
- Chạy targeted tests scripts hiện hữu sau inspect; lưu output thật command/cwd/actor/time/exit/hash trong evidence riêng. Không full ambient DB suite, benchmark/coverage/SUS/user test/SQL translation claims. Browser và DB chưa kiểm chứng phải ghi đúng limitation.
- Không schema/API/publication/geography/inventory/TTL/dependency/permissions/team modules/commit/deploy/migration. Toàn bộ gates giữ decisions. Submit round1/ID mới/writer none.

## Bàn giao hiện hành — P5-FUZZY-INTEGRATE-02 ApprovedNext (11/10/2026)

Dependency P5-FUZZY-MATCHER-02 round3/sub-p5-fuzzy-matcher-02-r3-20261011 Approved, contract round7 Approved. Tiếp tục yêu cầu fuzzy của PO bằng integration tối thiểu trong endpoint hiện hữu, không chọn phương án API/publication mới đang NeedsPO.

- Claim writer, archive review/submission/evidence trước thay. Đọc AGENTS/skills/specs/source handler/DTO/tests; baseline dirty attribution phải ghi thật.
- Wire matcher đã duyệt vào GetPublicPropertiesQuery hiện hữu: GET /api/public/properties?search, direct PublicPropertyDto array, Active-only, blank/normalized-empty all Active, no-match [], score/name/native Guid order. Không expose relevance/internal entity fields mới. Giữ projection public tối thiểu và AsNoTracking; không tải full entity/navigation/secrets chỉ để gọi helper. Có thể overload matcher tối thiểu cho DTO/projected data, không tạo service/abstraction/dependency mới.
- Không endpoint/pagination/truncation/schema/IsPublished policy/geography/dataset/permission/pricing/inventory/TTL/hold/confirm changes, không Angular/team modules. Keep ordinary exact/prefix/substring precedence; không fuzzy dates/guests.
- Unit/handler tests synthetic NO DB xác minh wiring, toàn bộ arrays/order/scores nội bộ, DTO shape và Active guard/blank/no-match/accent/transposition/condensed. Kiểm tra fixture trước chạy targeted existing scripts; không full ambient DB suite hay backend startup. Nếu harness cần DB thì ghi limitation và xin target test riêng trước, không dev/prod/staging.
- Runtime cost vẫn O(query*field) CPU và current all-Active projection; không claim latency/coverage chưa đo. Không tự đặt query cap; performance policy mới NeedsPO. Giữ cancellation hiện có.
- Submit round1/new identity và writer none. No commit/deploy/migrate hoặc modules Nguyên/Tân; các PO gates giữ nguyên.

## Bàn giao hiện hành — P5-FUZZY-MATCHER-02 ApprovedNext (11/10/2026)

Dependency: P5-FUZZY-CONTRACT-02 round7/sub-p5-fuzzy-contract-02-r7-20261011 Approved bounded contract. PO yêu cầu fuzzy search; bước nhỏ tiếp theo chỉ matcher C# thuần và unit tests, chưa tích hợp runtime public search.

- Claim writer, archive submission/review trước thay. Đọc AGENTS/skills .NET, requirements, karpathy và specs phù hợp; ghi checkout/dirty baseline thực tế.
- Implement helper thuần tối thiểu trong Application và unit tests tương ứng theo contract: normalization hiện hữu, literal ordinal100/90/80, all-token75, independent token/condensed60/50, empty-token guard, normalized-empty bypass, token reuse, short budgets, OSA restricted Damerau và max per field. Native StringComparer.OrdinalIgnoreCase/Guid.CompareTo; không dùng JS approximation làm production.
- Tests đủ toàn bộ result arrays và score/order, Unicode/NFC/NFD/đ, Greek case và sharp-S sign, GUID asymmetric groups, blank/normalized-empty/delimiter literal/no-match, empty targets, transposition vs unrestricted Damerau, tier boundaries, long input>30 và buffer safety nếu pooling. Không silent truncation hay giới hạn nghiệp vụ mới.
- Chỉ chạy unit tests thuần không DB sau kiểm tra fixture/project; ghi exact command/output/exit. Không full suite ambient DB, backend startup, handler/controller/DI/API wiring, Angular/team modules, schema/publication/geography/inventory/TTL changes, dependency mới, commit/deploy/migration. Literal prefix/contains dùng StringComparison.Ordinal, không culture-dependent default từ pseudocode.
- Submit task mới round1/ID mới/writer none. Sau review matcher mới xét integration slice theo contract và gates; giữ toàn bộ NeedsPO trong decisions. Không reimplement Unicode tables hoặc lặp chỉnh evidence không cần thiết.

## Bàn giao hiện hành — P5-FUZZY-CONTRACT-02 ApprovedNext (11/10/2026)

Dependency guest UI implementation round2 Approved và P7-GUEST-SEARCH-VERIFY-02 round3 Approved giới hạn evidence. PO đã yêu cầu tìm kiếm gần đúng; assignment trước cho phép sửa fuzzy proposal sau UI verify. Đây là tài liệu/contract, chưa cho phép backend integration.

- Claim writer, archive current review/submission. Đọc proposal fuzzy hiện hữu/source PublicProperty search và spec artifacts, karpathy/requirements/system-design/.NET phù hợp. Giữ public endpoint/array DTO/Active-only chính sách hiện tại; không schema/API/quyền/dependency/dataset/extension mới, không DB thật/commit/deploy/migration/P6.
- Sửa contradictions đã ghi: Ha/P5 substring phải80 khi chứa ha; Nhatrangg→nhatrang distance1; score50 requires ALL query tokens covered, không any-one-long-token; condensed>=7 distance1=60, distance2=50 nếu đủ guards. Exact100/prefix90/substring80/all-token75/typo1=60/typo2=50 chỉ là proposal hiện hữu, cần thuật toán precedence và mapping rõ trước chốt.
- Chốt normalization đ/Đ/dấu/case, punctuation/separators/tokenization, multi-token/condensed matching, OSA restricted Damerau semantics, short-query guard, score max per field Name/City/Address và deterministic Name OrdinalIgnoreCase+Guid tie-break. Nêu no-match và empty query giữ behavior source; không fuzzy dates/guests/prices/inventory.
- Gửi bảng input→normalized/tokens→distance→branch→score/order với ví dụ exact/prefix/substring/all-token/typos/transposition/multiword/unrelated/shortquery và boundary. Tính tay phải tự nhất quán; không bịa benchmark/coverage. Nếu có verifier minh họa chỉ offline/test artifact rõ không production, không thêm dependency; code integration chỉ sau review contract.
- Nêu cost/limits của current in-memory Active property search bằng source, không claim đo hiệu năng khi chưa chạy. Gate endpoint/IsPublished/geography/aggregate inventory/TTL vẫn giữ decisions. Submit task round1/submissionId mới/writer none để review; không làm trùng modules Nguyên/Tân.

## Bàn giao hiện hành — P7-GUEST-SEARCH-VERIFY-02 ApprovedNext (11/10/2026)

Dependency P5-GUEST-SEARCH-IMPLEMENT-02 Approved round2/sub-p5-guest-search-implement-02-r2-20261011. Lát cắt P7 đã PO giao: xác minh browser thực, không redesign lại hay mở backend.

- Claim writer trước thực thi, archive submission/review/evidence cũ. Dùng fixture loopback đã kiểm tra source/route/bind; không DB dev/prod/staging, không backend thật/secrets/remote provider/dependency/commit/deploy/migration.
- Browser thực trên Angular build hiện tại: discovery trả nonempty không tự chọn property/availability; explicit card/combobox chọn mới inventory; edit/clear/dates/rental reset và stale replies bị bỏ; loading/empty/error/retry; Enter/arrows/Escape/focus input và active descendant đúng DOM. Test hold bằng synthetic fixture nếu route contract khớp, không suy ra booking thật.
- Kiểm tra popup suggestions mở375/320px và1440px, containment44px controls/CTA, không clipped ancestor, Tab/focus visible, native dates theo browser. Screenshots375/768/1440 với state/capture provenance; capture mobile popup thay vì chỉ desktop. Không bịa screen-reader/WCAG pass.
- Lưu command/cwd/actor/time/exit, SHA256 và browser measurements thật. Network audit nếu browser có hỗ trợ; nếu không ghi limitation, không claim100% outbound từ server inbound log. Reviewer đã independently49targeted/179full/build0, không cần rerun toàn suite nếu không code đổi; nếu sửa lỗi nhỏ chạy targeted/build tương ứng.
- Không Rooms/RoomTypes/Housekeeping reserved team, không API/schema/fuzzy backend/PO gates mới. Chỉ fix defect đã xác minh của guest UI tối thiểu; submit round1 identity mới + writer none. Nếu runtime/tool không cho browser test ghi limitation thật, không báo PASS giả.

## Bàn giao hiện hành — P5-GUEST-SEARCH-IMPLEMENT-02 ApprovedNext (11/10/2026)

Dependency: P5-GUEST-SEARCH-FORM-02 Approved round4, submission sub-p5-guest-search-form-02-r4-20261011. Đây là implementation nhỏ theo yêu cầu UI của PO; không visual acceptance thay PO.

- Archive proposal/submission/review round4; claim writer=antigravity trước sửa. Baseline source/hash và dirty checkout phải ghi thực tế, không suy ra zero changes từ HEAD.
- Chỉ guest booking page/tests và evidence local cần thiết: floating unified destination/dates/guests/search card theo mockup đã duyệt; compact375/768/1440, native date,44px controls, SVG/copy tự nhiên. Không overflow hidden để che lỗi; kiểm tra main form và suggestions popup containment/focus.
- Giữ API/time/hold/confirm/deposit đã duyệt. Chưa chọn property chỉ search properties; đã chọn + ngày hợp lệ mới availability. Guests dùng một guestForm control, không filter server giả. Không backend fuzzy, schema/API/permissions/geography/dependency/P6 mới.
- Immediate context invalidation/latest-request-wins cho destination/date/rental và in-flight availability/quote; no request khi dates null/partial/invalid; auto checkout có live announcement; combobox giữ focus input, active descendant đúng option, arrows/Enter/Escape,clear/loading/empty/error/retry. Không đổi giới hạn business ngầm.
- Thêm tests hành vi (không chỉ regex source) cho CTA2-step, stale responses trước debounce và khi đổi ngày/rental, date edges, guest single-control, keyboard/clear/retry; giữ regression hold/confirm/cọc. Chạy targeted tests, full frontend suite và npm run build theo scripts thật, ghi exit codes thực, không cố định số test36/166 như coverage.
- Capture production UI thật tại375/768/1440 + popup mở, diagnostics320px; fixture synthetic rõ, không DB thật. Ghi bounding rectangles, hashes, browser metrics và limitation; server inbound logs không chứng minh browser outbound isolation. Không module Nguyên/Tân, commit/deploy/migrate/DB dev/prod/staging.
- Submit task mới round1/submissionId mới rồi writer=none; reviewer sẽ review slice trước việc tiếp. NeedsPO tồn tại vẫn giữ; ApprovedNext không chứng minh runtime tự resume.

Scope: yêu cầu sửa Housekeeping đã được PO giao, không mở Guest/Pricing/Staff/P3.

1. Server-side pagination, status/floor filters bằng API Rooms hiện có; không giới hạn vận hành ở 100 phòng đầu.
2. KPI ghi phạm vi trang nếu chưa có aggregate API được duyệt.
3. Tests trang 2, phòng ngoài 100 bản ghi đầu, reset page khi đổi filter, stale conflict; kiểm tra quyền/chi nhánh.
4. Endpoint trạng thái PATCH /api/rooms/{id}/status. Không migration, deploy hoặc DML lên DB dev/prod/staging.
5. Giữ phần code đã hoạt động. Báo files, tests/exit codes, screenshot và limitations vào submission.md. Nếu source đã sửa tại checkout này, chỉ xác minh và submit, không viết lại.

Task này đã Approved vòng 2. Không làm lại.

## Hàng đợi triển khai được PO giao ngày 10/10/2026

PO yêu cầu tiếp tục implementation để hoàn thành phase nhanh hơn và dành module đơn giản cho Nguyên/Tân. Không kết thúc hàng đợi chỉ vì task đầu đã Approved. Gate nghiệp vụ/schema/deploy quan trọng vẫn giữ nguyên.

### 1. P2-PRICING-HARDEN-01 — Antigravity, thực hiện ngay

Mục tiêu đóng các lỗi thực tế của P2B-02 để mở UI chính sách/giá. Đọc source mới nhất, không sao chép danh sách blockers cũ.

- Quote phải enforce quyền đã có trong contract: ROOMS.Read HOẶC RESERVATIONS.Read, ngoài JWT/membership. Tái sử dụng authorization pattern hiện có; không tự sáng tạo PRICING permission. Nếu tài liệu/source mâu thuẫn đáng kể, hỏi PO cho riêng mục này và tiếp tục mục độc lập.
- UpdatePropertyPolicies/CreateRoomTypeRate: chỉ MembershipLookupStatus.Success mới tiếp tục; mọi trạng thái khác từ chối có mã lỗi phù hợp trước DML. Giữ semantics đã duyệt.
- Xác minh RentalType, biên giờ/ngày VN, MaxHourlyHours D14, thiếu giá/phụ thu fail-closed, VND AwayFromZero. Mục đã đúng chỉ test, không refactor lại.
- Tests hành vi: user thiếu quyền quote bị chặn; từng quyền OR hợp lệ thành công; inactive/revoked/missing membership không mutation; giữ cách ly chi nhánh.
- Chạy targeted tests và build; full suite một lượt ở gate cuối nếu sửa authorization dùng chung.
- Không schema/migration/deploy, không chạm DB dev/prod/staging. Không thay nghiệp vụ tài chính.
- Submit code/files/tests/evidence rồi writer=none. Codex review ngay vòng polling tiếp theo; chỉ findings chặn mới giữ gate.

### 2. P2-POLICY-UI-01 — Antigravity sau khi task 1 Approved

UI quản lý policies dùng GET/PUT /api/properties/{id}/policies hiện có. Check-in/out, buffer>=30, MaxHourlyHours 1–24, surcharge theo DTO/validator có sẵn; timezone/giá trị mặc định theo contract. Quyền PROPERTIES.Read/Update, branch context, loading/error/save/double-submit, datetime control phù hợp. Không tự đổi giá booking hoặc D14. Tests FE và integration phù hợp, screenshots thật. Lát cắt độc lập, không chờ module nhóm khác.

### 3. P2-RATES-UI-01 — Antigravity sau khi task 1 Approved

UI rates/history dùng API RoomTypes hiện có, ngày hiệu lực và interval splitting theo handler hiện tại; thông báo overlap 409; pagination khi API hỗ trợ. Quyền đúng contract; không BasePrice fallback. Không tạo business rule mới. Có thể thực hiện sau task 2 hoặc trước nếu task 2 bị PO blocker độc lập.

## Task đơn giản dành team, không để Antigravity tự làm trùng

- TEAM-NGUYEN-01: hoàn thiện accessibility/responsive cho Rooms/RoomTypes theo module guide; không sửa data streams/shared layout/auth hoặc backend policies/rates.
- TEAM-TAN-01: empty/error/loading/retry/pagination UX cho Housekeeping theo module guide; không sửa latest-request-wins đã nghiệm thu hoặc authorization backend.
- Hai bạn làm full-stack khi cần trong API hiện có; việc đụng shared files phải ghi nhận owner trước. Reviewer chéo, kết quả đến In Review.
- Chi tiết: docs/team/implementation-queue.md.

## Ủy quyền triển khai MVP liên tục — PO ngày 10/10/2026

PO giao Codex tiếp tục phân công theo goal dự án, ưu tiên hoàn thành MVP và evidence môn học. Đây là phê duyệt mở hàng đợi P3–P7 dưới đây, không phải phê duyệt nghiệp vụ tài chính còn mở hoặc chạy migration/deploy môi trường thật. Không cần hỏi lại từng chi tiết ít rủi ro. Source/rules đã duyệt là thẩm quyền; tài liệu tự đánh giá cũ không phải rubric chính thức.

### 4. P3-BOOKING-CORE-01 — sau P2 pricing gate Approved

Lát cắt booking nội bộ: availability theo khoảng thời gian, chọn phòng cụ thể, quote thật, tạo booking snapshot và danh sách/chi tiết qua API/UI. Reuse domain hiện có; đọc p0-decisions và business rules để lấy quyết định đã duyệt. Khóa/constraint chống overlap phải kiểm tra dưới concurrency, buffer>=30, thiếu scope fail-closed, retry idempotent. Không tự chọn giải pháp schema trước khi đọc migration hiện có. Chuẩn bị migration và test trên DB cô lập nếu cần; áp dụng dev/staging/prod vẫn phải PO duyệt. Thiếu quyết định quan trọng chỉ block phần phụ thuộc đó và tiếp tục phần độc lập.

Gate: tạo booking giờ/đêm bằng HTTP thật, hai request tranh phòng một bên thắng, cách ly branch, quote/snapshot không đổi khi cập nhật bảng giá. Submit một lát cắt hoạt động trước khi làm mở rộng.

### 5. P3-STAY-LIFECYCLE-01 — sau booking core Approved

Check-in/check-out/cancel theo state machine đã duyệt, phòng Occupied chỉ qua lifecycle, checkout Dirty và xác nhận dọn trước Clean. UI danh sách lịch/booking và hành động. Không gộp chuyển gói/gia hạn/đổi phòng/refund chưa chốt trong P3A. Gate HTTP tạo→check-in→check-out→dọn và transition invalid bị chặn.

### 6. P4-CASH-FOLIO-01 — sau lifecycle Approved

Đang bàn giao ApprovedNext ngày 10/10/2026: booking core Approved round 3, stay lifecycle Approved round 2 (sub-p3-stay-lifecycle-01-r2-20261010). Antigravity đọc contract/source payment/folio và decisions hiện có trước implementation; không mở lại gate đã duyệt hoặc làm trùng TEAM-NGUYEN-01/TEAM-TAN-01. Submit lát cắt thu thủ công kèm HTTP/tests an toàn, evidence thực và limitation; chưa chốt business/schema/API/quyền mới thì ghi NeedsPO cho riêng phần phụ thuộc.

Ghi nhận cọc/thu thủ công, công nợ và dashboard thật theo contract đã duyệt. Lưu audit, immutable payment history, idempotency, không giả thủ công là gateway verified. Các chính sách refund/điều chỉnh chưa chốt để NeedsPO riêng. Gate đối soát booking-total/collected/balance, retry không thu trùng, đúng branch/time. Không gateway tự động trong lát cắt này.

### 7. P5-GUEST-BOOKING-01 — sau booking core/shared inventory gate Approved

Bàn giao ApprovedNext ngày 10/10/2026 sau P4 Approved round 3 (sub-p4-cash-folio-01-r3-20261010), booking core/lifecycle đã duyệt. Antigravity bắt đầu P5 bằng đọc p0-decisions và API/public/hold contracts/source; tận dụng lock/inventory core, không tuyên bố online/internal race hoặc expiry đã đạt khi chưa có test. Triển khai gate shared inventory online/internal cùng hold15min/confirm idempotency trên DB/schema test cô lập trước nghiệm thu guest booking. Không proxy internal credentials; secrets/email provider/gateway mới, schema/API nghiệp vụ ngoài contract cần PO riêng. P7 evidence thực theo từng lát cắt, không làm trùng task Nguyên/Tân.

Guest UI hiện đại: public property detail/search→quote→hold 15 phút→confirm theo p0 decisions, chung inventory với nội bộ. Public chỉ expose trường được phép, lookup token bảo vệ PII. Race online/internal một bên thắng, hold expired trả tồn, confirm retry không nhân booking. Reuse APIs/service, không proxy user nội bộ. UX demo phải ghi rõ nếu chưa có API; không coi demo fixture là booking thật. Không rating/khuyến mãi giả.

### 8. P6-AI-SEARCH-01 — sau public search ổn định

AI tiếng Việt chuyển yêu cầu thành filters; backend validate, search thật, hỏi lại khi thiếu, không bịa giá/tồn hoặc gọi mutation. Form fallback khi AI lỗi. Tạo adapter và deterministic mocks trước; provider/key/cost/call gửi dữ liệu ra ngoài chưa được xác định phải NeedsPO. Không chặn code/mocks vì chưa có live provider.

### 9. P7-EVIDENCE-01 — song song, không thay delivery

Mỗi task lưu evidence tái lập: route/API, tests thực, commit/PR nếu có, screenshots, limitations. Mapping rubric dựa docs/rubric-self-assessment.md và srs/08 chỉ là nguồn thứ cấp, cần bản môn học gốc trước kết luận điểm. Không bịa coverage, SUS, khảo sát/user hoặc số deploy. CI/backup/restore rehearsal trên môi trường test; staging deployment chỉ sau PO duyệt kế hoạch/hạ tầng cụ thể.

## Điều phối sau Approved

### Queue sau CI frontend rehearsal — chờ PO (2026-10-11)

### Ưu tiên mới từ PO — P5-GUEST-UX-REDESIGN-01 ApprovedNext (2026-10-11)

### Bàn giao mới nhất — P5-GUEST-UI-IMPLEMENT-01 ApprovedNext (11/10/2026)

### Bàn giao ưu tiên hiện tại — P7-GUEST-UI-VERIFY-01 ApprovedNext (11/10/2026)

### Ưu tiên mới nhất — P5-GUEST-SEARCH-FORM-02 ApprovedNext (11/10/2026)

PO nhận xét UI chưa ổn, yêu cầu xem form Agoda. P7 verify round2 Approved giới hạn CTA fixes/artifacts, KHÔNG visual acceptance. Codex đã quan sát Agoda public https://www.agoda.com/vi-vn/ trong phiên11/10: form trắng nổi trên hero, điểm đến combobox, ngày nhận/trả chung khối; mở calendar thấy2tháng và keyboard hướng dẫn; mở khách/phòng thấy +/- rooms/adults/children. Đây là observation live của Codex trong chat, không claim agent đã crawl hoặc có screenshot archive trong repo.

- Antigravity nhận task mới round1: audit UI hiện tại với phản hồi PO, đọc ui-ux-pro-max/impeccable/design-system/Angular/requirements/spec artifacts. Đề xuất mockup một hướng search-first rõ và plan nhỏ trước code; không chỉ đổi màu/bo góc. Bản ghi cũ bên dưới là lịch sử.
- Form trọng tâm điểm đến→nhận/trả→số khách→Tìm kiếm, mobile gọn/header nhỏ, ít copy/spacing dư. Giữ hourly/overnight và2-step inventory contracts; numberOfGuests có sẵn chỉ total guests, không thêm adults/children/rooms unsupported hoặc âm thầm biến thành filter availability.
- Dùng date component đã có nếu đáp ứng range/keyboard/localization; không dependency mới. Đề xuất lịch range2tháng desktop/1tháng mobile nhưng fallback native nếu thư viện hiện có không đủ, ghi tradeoff. Giữ UTC/VN/property policies và validators hiện tại; không copy ngày/threshold nghiệp vụ Agoda.
- Bỏ copy kỹ thuật DTO/Pricing Engine/khóa hàng/code/slug khỏi presentation; thông tin chính khách cần là tên/địa chỉ/thời gian/giá thật. Không badge realtime giả, rating/discount/amenities bịa, không hardcode cọc.
- Tái sử dụng server search hiện có; suggestions chỉ từ API results, không load toàn inventory để search client hoặc hierarchy địa lý giả. Fuzzy backend còn contract chưa duyệt, tách riêng không chặn form. Không API/schema/permissions/IsPublished/geography/P6 mới.
- Round1 submit mockup/plan/field mapping và acceptance375/768/1440 keyboard/loading/error/clear/context reset; screenshot mock rõ nhãn. Kiểm tra writer/checkout và baseline, không production code cho tới review plan. Không team modules/DB thật/backend ambient/dependency/commit/deploy/migrate.
- Ghi network log đúng là fixture inbound, không claim browser outbound100% từ remoteAddress; khi capture lần tới dùng browser audit nếu có hoặc limitation. Archive submission/evidence trước ID mới, writer none khi Submitted. Không báo runtime tự resume nếu chưa ACK.

Guest UI implementation round2 Approved technical/source regression (sub-p5-guest-ui-implement-01-r2-20261011); reviewer targeted35/35, không browser/visual nghiệm thu. Antigravity nhận task P7/UI verification độc lập đã được PO yêu cầu.

- Đọc AGENTS/skills/UI source và tooling fixtures đã có; kiểm tra writer/checkout. Không backend ambient, DB dev/prod/staging hoặc network ngoài. Dùng local frontend/script/browser có sẵn và intercept fixtures đã có, không dependency mới. Không có browser thì submit limitation thật, không bịa ảnh hoặc claim headless không có khi chưa kiểm tra tooling.
- Kiểm chứng actual CSS viewport375/768/1440, document scrollWidth/clientWidth, header/sticky summary không che form/CTA, text dài và keyboard focus/labels/selected state. Chụp ảnh thật và manifest viewport/DPR/time/source hash/fixture provenance/command/exit. Mock != live booking/inventory.
- Rental switch hiện role tab chưa arrow/roving/tabpanel: trong guest feature có thể sửa tối thiểu sang group buttons aria-pressed, thêm targeted DOM/template tests. Chỉ sửa guest UI lỗi visual/a11y đã xác minh; không services/shared/auth/backend/team. Functional changes ngoài visual nhỏ phải ghi finding để reviewer phân loại, không đổi policy.
- Kiểm tra loading/empty/error/retry, đổi property/date/room reset quote, clear/debounce, pending/failure quote và submit guard bằng fixtures và tests hiện có. Không mở fuzzy matcher, AI/Maps/API/schema/geography/IsPublished/TTL gates.
- Lưu evidence thư mục guest-ui-verify riêng không ghi đè implementation logs; nếu sửa UI baseline snapshot/hash + diff theo task, targeted tests/build hiện có. Submit round1 ID mới, archive submission và writer none. Không commit/deploy/migration/DB thật. Sau verify chọn fuzzy contract sửa còn lại như task riêng, không tự code contract chưa duyệt.

Proposal redesign round3 được duyệt GIỚI HẠN UI (sub-p5-guest-ux-redesign-01-r3-20261011). Antigravity triển khai phần UI độc lập ngay; fuzzy backend chưa duyệt, không chặn phần UI. Mục redesign round1 bên dưới là lịch sử.

- Chỉ guest booking feature/styles/tests trong frontend; đọc AGENTS/Angular/UI skills/spec contracts và kiểm tra checkout/writer trước code. Lưu baseline diff/hash các files trước sửa để review attribution, không ghi đè dirty edits.
- Search form thống nhất, property cards Name/Address/City/check-in-out với image null SVG fallback; không giá/tồn/amenities cơ sở khi DTO không có. Giữ server search hiện có có/không dấu, không thêm autocomplete phân cấp/hierarchy giả.
- Chọn cơ sở/ngày rồi getAvailability với rentalType/startAtUtc/endAtUtc và optional dates đúng service hiện có. Room cards dùng availableRooms/isAvailable/estimatedPrice có nhãn giá ước tính; không BasePrice fallback hoặc claim giá chắc chắn.
- Quote dùng POST public/quotes; sticky summary/CTA dựa quote thật và validity hiện có. Tiền cọc/thời gian hold từ GuestHoldDto sau hold; không hardcode30%, TTL hoặc thay policy. Bảo toàn hold/confirm/idempotency/lookup, guest form, hourly/overnight, permissions/privacy và request cancellation/context reset.
- Responsive375/768/1440CSS px, label/focus/keyboard/touch targets, loading/error/empty/retry; không che clipping bằng overflow hidden. Chỉ tokens/components/dependencies có sẵn; không CDN/font/ảnh remote mới, không shared modules Nguyên/Tân.
- Tests targeted feature/service, build frontend bằng script tồn tại; screenshots fixture local nếu cô lập được browser/network, ghi rõ mock vs integration và viewport thật. Không backend ambient hoặc DB dev/prod/staging; không full dotnet suite/commit/deploy/migration/dependency mới.
- Có thể sửa fuzzy proposal như tài liệu: Ha/P5 substring80, Nhatrangg distance1, score50 all-token guard và condensed distance1=60; không tạo matcher/integrate backend trước review contract riêng. Không bắt PO quyết kỹ thuật ít rủi ro.
- Submit task mới round1 ID mới với baseline/diff/logs/evidence thực và limitations, archive submission trước thay; writer none. Các PO gates cũ vẫn giữ, không mở P6.

PO yêu cầu giao agent khảo sát các trang tìm kiếm/đặt phòng hiện đại, thiết kế lại giao diện khách và tìm kiếm "fuzzing". Giả định công khai: thuật ngữ này là fuzzy search (gần đúng khi gõ sai), không phải security fuzz testing. Bàn giao mới này thay trạng thái chờ của queue cũ bên dưới; các PO gates nghiệp vụ vẫn giữ nguyên.

- Antigravity đọc `guest-ux-redesign-brief.md`, AGENTS, contracts/spec artifacts và source hiện tại trước thực hiện. Checkout dự kiến develop/3f95339; kiểm tra lại dirty baseline và writer, không ghi đè sửa của người khác.
- Round1: khảo sát giao diện công khai của 3 trang đặt phòng (ví dụ Booking.com, Agoda, Traveloka), ghi URL/ngày truy cập/bằng chứng quan sát; không bypass login/CAPTCHA/robots/rate limits, không crawl hàng loạt hoặc sao chép assets/brand. Nếu không truy cập được ghi limitation, không bịa nghiên cứu.
- Audit source/UI khách, đề xuất một hướng thiết kế nhất quán và mockup desktop/mobile bằng dữ liệu tổng hợp có nhãn, không sửa production code trong round1. Giao diện hiện đại, search nổi bật, card rõ, typography/spacing/tokens nhất quán; không rating/discount/giá/tồn phòng giả.
- Đề xuất fuzzy search có test cases và contract rõ: giữ public API/array DTO hiện tại là ưu tiên; exact/normalized match ưu tiên trước typo match; không fuzzy ngày/số khách/giá/tồn phòng. Ngưỡng, ranking, no-match, hiệu năng và nguy cơ dữ liệu Active-only phải được nêu; không thêm thư viện/schema/endpoint/dataset hoặc implement đổi semantics khi chưa review phương án.
- Áp dụng karpathy, requirements-analysis, system-design cho fuzzy proposal; Angular/.NET theo source, impeccable/ui-ux-pro-max/design-system cho thiết kế, Spec Kit nếu có. Không mở P6/AI/Maps hay thay TTL/hold/publication policy.
- Submit research + design + acceptance cases + smallest implementation plan để Codex review, rồi triển khai round/task tiếp theo theo contract được duyệt. Không làm Rooms/RoomTypes/Housekeeping của Nguyên/Tân, DB dev/prod/staging, commit/deploy/migration/dependency mới.
- Ghi taskId/round/submissionId mới, lưu lịch sử trước thay submission; writer=none khi Submitted. Mailbox không chứng minh runtime tự nhận hay tự resume.

P7-CI-FRONTEND-REHEARSAL-01 Approved local evidence round1. P2–P4 và các lát cắt P7 được giao đã review; P5 reuse search đã Approved, full P5/business và Phase B search còn NeedsPO. Chưa có implementation slice độc lập với contract rõ còn lại để ApprovedNext; không lặp evidence vô ích hoặc làm module Nguyên/Tân. P6 chưa mở. Chờ PO chốt các câu hỏi trong decisions.md rồi chọn đúng slice đủ dependencies; CI workflow changes, backup rehearsal hoặc deployment chưa có kế hoạch/target duyệt không tự triển khai. Các mục bàn giao current bên dưới đã thành lịch sử.

### Bàn giao hiện tại — P7-CI-FRONTEND-REHEARSAL-01 ApprovedNext (2026-10-10)

Search UI evidence Approved round2 sub-p7-search-ui-evidence-01-r2-20261010 có giới hạn viewport/provenance. Tiếp tục P7 local CI rehearsal đã được PO giao, chỉ frontend: đọc .github/workflows/ci.yml và package.json, chạy npm run build cùng Vitest hiện có cho checkout mới nhất; không npm install/npm ci để đổi dependency/network, không script mới hoặc sửa workflow/source. Lưu stdout/stderr thật, command/cwd/time/actor/exit/count và hash build output nếu thành công vào evidence/ci-frontend; inventory script absent/if-present skipped phải ghi gap, không claim lint/CI cloud đạt. Không chạy DB/backend ambient, không secret scan xuất secrets/log credentials, không GitHub Actions trigger/commit/deploy. Lỗi ghi exact actionable limitation và submit, không tự sửa module team hay production code. Không lặp screenshots/rubric, không fullMVP/coverage/SUS claims. Round1/ID mới, writer none. P5 policy/advanced search NeedsPO, P6 chưa mở; các bàn giao current bên dưới là lịch sử.

### Bàn giao hiện tại — P7-SEARCH-UI-EVIDENCE-01 ApprovedNext (2026-10-10)

Reuse search Approved round4 sub-p5-guest-search-reuse-01-r4-20261010. Task độc lập trong P7 được PO duyệt: kiểm chứng UI search mới desktop/mobile, keyboard label, keyword có/không dấu, clear trước debounce, empty/error/retry và đổi cơ sở reset selection. Dùng local frontend script và fixtures loopback đã có, kiểm tra proxy/target cô lập trước; không start backend ambient dev hoặc chạm DB dev/prod/staging. Có thể reuse fixture tooling hiện có nhưng chỉ mở rộng mock data/evidence cần thiết; không sửa production code để demo, không dependency mới hoặc modules Nguyên/Tân. Lưu ảnh/log thật và manifest command/cwd/time/actor/exit/fixture provenance, phân biệt mock rendering với integration/availability thật. Lưu riêng thư mục evidence/search-ui để không ghi đè evidence Approved cũ; không bịa coverage/SUS/user tests. Source/build/test errors nếu có ghi actionable limitation, không tự sửa ngoài scope. Không mở API/schema/publication/Phase B search/P6; policies P5 vẫn NeedsPO. Submit round1 ID mới và writer=none; capability resume chưa xác minh. Các mục bàn giao current trước đây là lịch sử, không task song song.

### Bàn giao hiện tại — P5-GUEST-SEARCH-REUSE-01 ApprovedNext (2026-10-10)

Contract survey Approved round2 sub-p5-guest-search-contract-01-r2-20261010 chỉ cho lát cắt reuse. Triển khai matching tiếng Việt có/không dấu trên Name/Address/City, gồm đ/Đ và Unicode canonical; wiring thanh tìm kiếm khách hàng bằng PublicBookingService.getProperties(search) hiện có. Giữ GET /api/public/properties?search, array DTO, Active-only, blank trả toàn bộ Active và không-match trả []; không reject/truncate theo ngưỡng100 mới trong proposal. Không đổi quyền/publication/availability, không endpoint/dataset/schema/dependency mới, không pagination/truncation kết quả ngầm. Không tải toàn bộ entity vào RAM rồi claim bounded query; đọc EF translation/provider trước chọn matching strategy, nếu cần extension/schema thì giữ PO riêng. Không bịa benchmarks hoặc thực tế tồn/giá. UI thay đổi tối thiểu theo tokens/a11y hiện có; latest-request-wins, loading/error/retry/empty và keyboard labels. Đọc skills stack .NET/Angular, requirements và UI trước code. Tests hành vi handler/API/frontend phù hợp: Name/Address/City, đ/Đ, case/Unicode, blank/no-match/Inactive, array/search compatibility và UI request race. DB tests chỉ explicit localhost hotel_saas_p1b01a_test và GUID schema sau kiểm tra fixture; không dev/prod/staging. Không làm Rooms/RoomTypes/Housekeeping của Nguyên/Tân, không commit/deploy/migration thật. Submit task/round/ID và logs/source evidence mới; writer=none. P5 policy và Phase B search NeedsPO riêng; P6 chưa mở. Bàn giao contract khảo sát bên dưới là lịch sử, không task implementation thứ hai.

### Bàn giao hiện tại — P5-GUEST-SEARCH-CONTRACT-01 ApprovedNext (2026-10-10)

PO đã xác nhận ưu tiên trong chat: giao diện/luồng khách hàng + tìm kiếm thông thường trước AI/Google Maps. Visual P7 Approved round3 (sub-p7-visual-evidence-01-r3-20261010). Antigravity nhận round1 khảo sát/đề xuất contract ordinary search: tên khách sạn (có/không dấu), tỉnh/thành→xã/phường theo danh mục hành chính hiện hành, địa danh/khu vực tách khỏi hierarchy, ngày ở/số khách và phòng trống thật. Đọc requirements-analysis-enterprise/system-design-enterprise cùng source/domain/public APIs/docs/spec artifacts hiện có. Lập gap map ngắn với file/source/test references, acceptance cases và smallest implementation slice; không viết lại rubric/evidence. Xác định có trường địa bàn/mã hành chính/tọa độ/dataset licensed authoritative hiện có hay chưa; không suy địa bàn chính xác bằng substring địa chỉ, không bịa danh mục VN, không import dữ liệu ngoài tự chọn. Reuse API/domain hiện có là ưu tiên; API/schema/quyền/dataset dependency mới phải đề xuất rõ để PO chốt riêng trước thực hiện, không implement contract mới trong task khảo sát. Không cần hỏi lại quyết định giữ AI/Maps sau; chưa chốt distance/business P5 open từ lời đồng ý ưu tiên. Submit source-backed plan + PO questions chỉ thật sự quan trọng và phần reuse độc lập có thể làm, task/round/ID mới; writer none. Không runtime/API mutation/DB dev-staging-prod/commit/deploy hoặc chạm module Nguyên/Tân.

### Lịch sử bàn giao — P7-VISUAL-EVIDENCE-01 (2026-10-10)

P7 reproducible artifacts Approved round2, sub-p7-repro-evidence-01-r2-20261010. Tiếp tục screenshots evidence P7 đã được PO giao: public search/hold instructions/token status và folio modal hiện có, desktop/mobile. Chụp browser thật vào docs/agent-coordination/evidence/visual/ với manifest route/viewport/time/actor/current checkout và data provenance. Chỉ chạy local frontend bằng script hiện có; trước truy cập phải bảo đảm không request DB dev/prod/staging. Có thể dùng browser-intercept fixtures rõ nhãn, không sửa source để demo, không claim integration/booking thật nếu mocked. Nếu dùng API thật chỉ explicit test target/schema đã kiểm tra startup/cleanup an toàn, không tự khởi động backend theo ambient dev config. Không gửi secrets/token/PII ra ngoài; ảnh dùng data tổng hợp và redaction rõ. Không dependency mới, code fixes, module Nguyên/Tân, CI/deploy/migration thật; lỗi UI ghi findings để reviewer phân loại. Không cần chờ P5 policy cho ảnh UI nhưng P5 vẫn NeedsPO/P6 chưa mở. Không có browser/runtime hoặc chưa cô lập được thì submit limitation actionable, không bịa screenshot. Round1/ID mới, writer none khi submit.

### Lịch sử bàn giao — P7-REPRO-EVIDENCE-01 (2026-10-10)

P7-EVIDENCE-01 matrix synthesis Approved round3, sub-p7-evidence-01-r3-20261010. Tiếp tục lát cắt P7 execution evidence (round1): lưu log stdout/stderr thật và manifest command/cwd/actor/timestamp/exit/count trong docs/agent-coordination/evidence/; không chỉ copy report PASS. Ưu tiên FE tests hiện có và P4/P5 targeted Application/HTTP fixtures đã review, không chạy full suite không cần thiết. Trước DB tests đọc fixture guard/cleanup, đặt TEST_DB_CONNECTION explicit localhost/hotel_saas_p1b01a_test; chỉ schema GUID test riêng, không DB dev/prod/staging và không ambient connection. Log không chứa secrets/token/PII; nếu output chứa thì lưu bản redacted có ghi cách redaction, không gửi ra ngoài. Chỉ lệnh/tool tồn tại trong repo; không thêm dependency/runner/script CI, không sửa backend/frontend/module team khi có lỗi: ghi exact failure và submit evidence/limitation cho reviewer. Chạy tests này chỉ là local targeted verification, không cloud CI/backup rehearsal/coverage/SUS hoặc nghiệm thu P5/P6. Bổ sung link log vào matrix thay claim tương ứng, không làm lại các mục đã Approved. Nếu không có test runtime an toàn ghi blocker thật, không giả PASS. Submit task/round/ID mới và writer none; P5 policy vẫn NeedsPO, P6 chưa mở.

### Lịch sử bàn giao — P7-EVIDENCE-01 (2026-10-10)

P5 round4 (sub-p5-guest-booking-01-r4-20261010) đã đóng regression TTL bằng source + HTTP 1/1 Fact và Application 16/16 độc lập; full P5 NeedsPO theo decisions.md. Antigravity nhận P7 round1, không sửa lại P5 hoặc mở P6 trước gate. Đọc AGENTS và rubric/source/tests hiện có; lập mapping route/API → contract → test tái lập → evidence thực → limitation cho các lát cắt đã review. Phân biệt kết quả writer/reviewer và số Fact/scenario; screenshot phải thật, thiếu thì ghi thiếu. Không kết luận điểm từ self-assessment, không bịa coverage/SUS/user tests/deploy. Không sửa module Nguyên/Tân, không dependency/API/schema mới, không DB dev/staging/prod, commit/deploy. CI/backup rehearsal nếu thực hiện phải kiểm tra script và target test cô lập trước; chưa đủ điều kiện thì ghi limitation, không tự chạy hạ tầng thật. Submit một lát cắt evidence hữu ích với taskId/round/submissionId mới, writer=none. Runtime chưa tự resume thì người dùng cần kích hoạt; mailbox không chứng minh daemon còn chạy.

Codex tự chọn task tiếp theo đủ dependencies trong hàng đợi này và chuyển ApprovedNext, không kết thúc vòng ở trạng thái Approved mà bỏ hàng đợi. Lưu review theo task/round/submission trước khi ghi đè review.md để có lịch sử. Không nhảy gate quan trọng. Task bị NeedsPO giữ record trong decisions.md, chuyển sang task độc lập đã được duyệt nếu có. Một writer code tại một thời điểm; task team không giao Antigravity làm trùng. Người dùng vẫn phải kích hoạt runtime Antigravity khi nó không tự resume.
