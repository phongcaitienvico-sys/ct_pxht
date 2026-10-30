# Kế Hoạch Triển Khai Hệ Thống Quản Lý & Nhập Sản Lượng Xưởng (Production Logging Web App)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng ứng dụng web quản lý và ghi nhận sản lượng đa nền tảng: Quản đốc dùng PC (quản lý danh mục, bật/tắt mã hôm nay làm, xem báo cáo theo ngày/tháng/nhân viên, import/export Excel) và Tổ trưởng dùng điện thoại (chọn nhân viên, thêm nhiều dòng sản phẩm cùng lúc, nhập số lượng và thời gian, lưu 1 chạm).

**Architecture:** Frontend React SPA (Vite) triển khai tĩnh trên GitHub Pages, giao diện sáng hiện đại phong cách Tailwind/Shadcn. Backend sử dụng Supabase (PostgreSQL, Supabase Auth, Row Level Security, Supabase Realtime). Tích hợp sẵn LocalStorage Fallback khi chưa nhập Supabase API Key để người dùng có thể trải nghiệm đầy đủ tính năng ngay lập tức.

**Tech Stack:** React 18+, Vite, Tailwind CSS, Lucide React, SheetJS (`xlsx`), `@supabase/supabase-js`.

**Spec:** `docs/superpowers/specs/2026-10-30-production-logging-web-app-design.md`

## Global Constraints
- Node.js version >= 18.
- Frontend là Single Page Application tĩnh, tương thích 100% với GitHub Pages (`base: './'`).
- Theme màu sáng (Clean Corporate Light Theme): nền trắng `#ffffff`, xám nhạt `#f8fafc`, xanh điểm nhấn `#2563eb` và `#16a34a`.
- Không sử dụng trường "Công đoạn" (đã bỏ theo yêu cầu trực tiếp của Quản đốc).
- Form Mobile phải hỗ trợ thêm không giới hạn số lượng sản phẩm cho 1 nhân viên trong 1 lần ghi nhận.
- Đọc và xuất file Excel tương thích định dạng `.xlsx` và `.xlsm`.

## Review Focus
1. **Trường hợp mất mạng / chưa cấu hình Supabase**: Ứng dụng phải tự động chuyển sang chế độ Mock/LocalStorage và hiển thị thông báo nhẹ nhàng, không bị crash trắng màn hình.
2. **Nhập liệu số lượng âm hoặc bằng 0**: Form Mobile phải chặn validation không cho lưu số lượng <= 0 hoặc thời gian < 0.
3. **Danh mục sản phẩm lớn (1.000+ mã)**: Bộ lọc tìm kiếm và bảng danh mục phải phản hồi tức thì (< 100ms) không bị lag giật.
4. **Trùng lặp mã sản phẩm khi Import Excel**: Hàm parse Excel phải tự động chuẩn hóa ID và ghi đè (upsert) nếu mã sản phẩm đã tồn tại.
5. **Định dạng ngày ca đêm**: Cho phép Tổ trưởng chọn ngày làm việc (mặc định Hôm nay) để nhập bù cho ca đêm kết thúc rạng sáng hôm sau.

---

### Task 1: Khởi Tạo Dự Án & Cấu Hình Môi Trường (Scaffolding & Tailwind Setup)

**Files:**
- Create: `package.json`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src/index.css`, `src/main.jsx`, `src/App.jsx`
- Test: `tests/setup.test.js`

**Interfaces:**
- Produces: Môi trường Vite + React + Tailwind CSS sẵn sàng build và chạy tests.

- [ ] **Step 1: Viết test kiểm tra cấu hình Vite & Tailwind**
Tạo file `tests/setup.test.js` kiểm tra các file cấu hình và package scripts cơ bản tồn tại.
- [ ] **Step 2: Chạy test để xác nhận FAIL**
Chạy `npm test` hoặc `node tests/setup.test.js` $\rightarrow$ FAIL.
- [ ] **Step 3: Khởi tạo package.json, cài đặt dependencies và cấu hình Tailwind CSS**
Cài đặt `react`, `react-dom`, `lucide-react`, `xlsx`, `@supabase/supabase-js`, `tailwindcss`, `postcss`, `autoprefixer`.
Cấu hình `vite.config.js` với `base: './'` để chạy trên GitHub Pages.
- [ ] **Step 4: Chạy test và build thử**
Chạy `npm run build` để đảm bảo output thư mục `dist/` thành công.
- [ ] **Step 5: Commit**
`git add . && git commit -m "feat: scaffold react vite tailwind project"`

---

### Task 2: Supabase Schema, Dữ Liệu Mẫu & Supabase Client Adapter

**Files:**
- Create: `docs/supabase_schema.sql`
- Create: `src/data/seedData.js`
- Create: `src/lib/supabase.js`
- Test: `tests/supabaseClient.test.js`

**Interfaces:**
- Consumes: Environment variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Produces: `supabase` client instance, `initDemoData()` hàm nạp dữ liệu mẫu ban đầu từ bảng tính thực tế của người dùng.

- [ ] **Step 1: Viết test cho `src/lib/supabase.js`**
Kiểm tra khi không có ENV, client tự động kích hoạt LocalStorage Adapter với dữ liệu từ `seedData.js`.
- [ ] **Step 2: Chạy test xác nhận FAIL**
- [ ] **Step 3: Viết `docs/supabase_schema.sql`, `src/data/seedData.js` và `src/lib/supabase.js`**
`seedData.js` chứa các sản phẩm thực tế từ ảnh: Cánh đập phản kích 2021 (1732), Ống gối bi 231/500 (1733), Cánh đập MPK (1765), Cánh búa tâm 360 (1775), khách hàng Đại Phú, XM Hạ...
`supabase.js` cung cấp API CRUD thống nhất: `getProducts()`, `updateProductToggle(id, isActive)`, `getEmployees(teamId)`, `submitProductionLogs(logs)`, `getProductionLogs(filter)`.
- [ ] **Step 4: Chạy test xác nhận PASS**
- [ ] **Step 5: Commit**
`git add docs/supabase_schema.sql src/data/seedData.js src/lib/supabase.js tests/supabaseClient.test.js && git commit -m "feat: supabase schema seed data and client adapter"`

---

### Task 3: Auth Context & Quản Lý Phiên Đăng Nhập (Admin vs Tổ Trưởng)

**Files:**
- Create: `src/contexts/AuthContext.jsx`
- Create: `src/components/LoginModal.jsx`
- Test: `tests/authContext.test.js`

**Interfaces:**
- Produces: `useAuth()` hook cung cấp `{ currentUser, role, currentTeam, login, logout, switchDemoRole }`.

- [ ] **Step 1: Viết test kiểm tra chuyển đổi vai trò Admin và Tổ trưởng**
- [ ] **Step 2: Chạy test xác nhận FAIL**
- [ ] **Step 3: Cài đặt `AuthContext.jsx` và `LoginModal.jsx`**
Hỗ trợ đăng nhập Supabase Auth thật, kèm thanh chọn nhanh tài khoản Demo (Quản đốc, Tổ 1, Tổ 2) để test ngay lập tức mà không cần gõ mật khẩu.
- [ ] **Step 4: Chạy test xác nhận PASS**
- [ ] **Step 5: Commit**
`git add src/contexts/AuthContext.jsx src/components/LoginModal.jsx tests/authContext.test.js && git commit -m "feat: authentication and role management context"`

---

### Task 4: Tiện Ích Đọc & Xuất File Excel (SheetJS Service)

**Files:**
- Create: `src/lib/excel.js`
- Test: `tests/excel.test.js`

**Interfaces:**
- Produces: `parseProductExcel(fileBuffer)`, `parseEmployeeExcel(fileBuffer)`, `exportProductionReportToExcel(logs, metadata)`.

- [ ] **Step 1: Viết test cho logic đọc/ghi Excel**
- [ ] **Step 2: Chạy test xác nhận FAIL**
- [ ] **Step 3: Triển khai `src/lib/excel.js`**
Hỗ trợ đọc các cột từ file theo dõi: Tên sản phẩm, Khách hàng, Số lượng, Phôi, T.t, Id.
Hỗ trợ xuất báo cáo định dạng chuẩn: Tiêu đề báo cáo, bảng tổng hợp theo nhân viên, bảng chi tiết từng ngày.
- [ ] **Step 4: Chạy test xác nhận PASS**
- [ ] **Step 5: Commit**
`git add src/lib/excel.js tests/excel.test.js && git commit -m "feat: excel import export service"`

---

### Task 5: Màn Hình Quản Đốc - Quản Lý Danh Mục & Bật/Tắt Sản Phẩm Hôm Nay

**Files:**
- Create: `src/components/admin/ProductManager.jsx`
- Test: `tests/productManager.test.js`

**Interfaces:**
- Consumes: `supabase` API từ `src/lib/supabase.js`.
- Produces: Giao diện quản lý danh mục sản phẩm (Tìm kiếm, Lọc khách hàng, Lọc trạng thái, Checkbox bật/tắt từng mã, Nút "Bật tất cả", "Tắt tất cả hôm nay", Import file Excel).

- [ ] **Step 1: Viết test kiểm tra lọc và bật tắt hàng loạt sản phẩm**
- [ ] **Step 2: Chạy test xác nhận FAIL**
- [ ] **Step 3: Xây dựng `ProductManager.jsx`**
Tối ưu hóa hiển thị cho hàng nghìn sản phẩm, bộ lọc phản hồi tức thì, hiển thị huy hiệu Khách hàng, số lượng đơn, phôi, ID.
- [ ] **Step 4: Chạy test xác nhận PASS**
- [ ] **Step 5: Commit**
`git add src/components/admin/ProductManager.jsx tests/productManager.test.js && git commit -m "feat: admin product management with bulk toggle and search"`

---

### Task 6: Màn Hình Quản Đốc - Quản Lý Nhân Viên & Giám Sát Real-time

**Files:**
- Create: `src/components/admin/EmployeeManager.jsx`
- Create: `src/components/admin/RealtimeFeed.jsx`
- Test: `tests/realtimeFeed.test.js`

**Interfaces:**
- Consumes: Supabase Realtime channel trên `production_logs`.
- Produces: Bảng giám sát sản lượng tự động cập nhật ngay khi tổ trưởng bấm lưu, danh sách quản lý nhân viên theo tổ kèm chức năng Import Excel nhân viên.

- [ ] **Step 1: Viết test cho `RealtimeFeed.jsx`**
- [ ] **Step 2: Chạy test xác nhận FAIL**
- [ ] **Step 3: Xây dựng `EmployeeManager.jsx` và `RealtimeFeed.jsx`**
Hiển thị thẻ tóm tắt nhanh (Tổng sản phẩm làm hôm nay, số công nhân đang làm việc).
- [ ] **Step 4: Chạy test xác nhận PASS**
- [ ] **Step 5: Commit**
`git add src/components/admin/EmployeeManager.jsx src/components/admin/RealtimeFeed.jsx tests/realtimeFeed.test.js && git commit -m "feat: admin employee manager and realtime live feed"`

---

### Task 7: Màn Hình Tổ Trưởng (Mobile) - Form Nhập Nhiều Sản Phẩm 1 Lần

**Files:**
- Create: `src/components/leader/LeaderEntryForm.jsx`
- Test: `tests/leaderEntryForm.test.js`

**Interfaces:**
- Consumes: Danh sách nhân viên trong tổ và danh sách sản phẩm đang có `is_active_today = true`.
- Produces: Form nhập liệu Mobile-first: Chọn nhân viên, Chọn ngày làm việc, Dynamic rows (thêm/xóa dòng sản phẩm), nút `Lưu tất cả`.

- [ ] **Step 1: Viết test thêm/xóa dòng sản phẩm và validate form**
- [ ] **Step 2: Chạy test xác nhận FAIL**
- [ ] **Step 3: Xây dựng `LeaderEntryForm.jsx`**
Tối ưu cảm ứng trên điện thoại: Nút bấm to bản, hỗ trợ chọn sản phẩm từ danh sách hôm nay kèm mã ID, nhập số lượng và số giờ nhanh chóng.
- [ ] **Step 4: Chạy test xác nhận PASS**
- [ ] **Step 5: Commit**
`git add src/components/leader/LeaderEntryForm.jsx tests/leaderEntryForm.test.js && git commit -m "feat: mobile leader multi-product entry form"`

---

### Task 8: Màn Hình Tổ Trưởng (Mobile) - Lịch Sử & Chỉnh Sửa Trong Ngày

**Files:**
- Create: `src/components/leader/LeaderDailyLogs.jsx`
- Test: `tests/leaderDailyLogs.test.js`

**Interfaces:**
- Consumes: Nhật ký sản lượng của tổ theo ngày đã chọn.
- Produces: Danh sách các bản ghi đã nhập, nhóm theo từng nhân viên, nút Sửa số lượng/giờ và nút Xóa với xác nhận nhanh.

- [ ] **Step 1: Viết test cho hiển thị và xóa bản ghi của tổ**
- [ ] **Step 2: Chạy test xác nhận FAIL**
- [ ] **Step 3: Xây dựng `LeaderDailyLogs.jsx`**
Hiển thị rõ ràng: Họ tên thợ, Tên sản phẩm (#ID), Số lượng làm được, Số giờ, tổng kết ngày của tổ.
- [ ] **Step 4: Chạy test xác nhận PASS**
- [ ] **Step 5: Commit**
`git add src/components/leader/LeaderDailyLogs.jsx tests/leaderDailyLogs.test.js && git commit -m "feat: mobile leader daily logs with edit and delete"`

---

### Task 9: Màn Hình Quản Đốc - Báo Cáo Phân Tích Đa Chiều & Xuất Excel

**Files:**
- Create: `src/components/admin/ReportAnalytics.jsx`
- Test: `tests/reportAnalytics.test.js`

**Interfaces:**
- Consumes: Nhật ký sản lượng toàn xưởng và tiện ích `exportProductionReportToExcel`.
- Produces: Bộ lọc theo khoảng ngày (Từ ngày... Đến ngày...), Lọc theo nhân viên/tổ, Bảng chi tiết phân rã theo ngày, Thẻ tổng hợp KPI (Tổng ngày công, tổng sản lượng, tổng giờ), Nút xuất Excel.

- [ ] **Step 1: Viết test tính toán tổng hợp sản lượng theo nhân viên và khoảng ngày**
- [ ] **Step 2: Chạy test xác nhận FAIL**
- [ ] **Step 3: Xây dựng `ReportAnalytics.jsx`**
Hiển thị bảng chi tiết: Ví dụ chọn 1 tháng của ông A, hiển thị từng ngày ông A làm những mã sản phẩm nào, tổng bao nhiêu chiếc và tổng mấy giờ.
- [ ] **Step 4: Chạy test xác nhận PASS**
- [ ] **Step 5: Commit**
`git add src/components/admin/ReportAnalytics.jsx tests/reportAnalytics.test.js && git commit -m "feat: admin date range report analytics and excel export"`

---

### Task 10: Hoàn Thiện Giao Diện App, Cấu Hình GitHub Pages & Hướng Dẫn Vận Hành

**Files:**
- Create: `src/components/Navbar.jsx`
- Modify: `src/App.jsx`
- Create: `.github/workflows/deploy.yml`
- Create: `README.md`
- Test: `tests/e2eApp.test.js`

**Interfaces:**
- Produces: Ứng dụng hoàn chỉnh, thanh Navbar theme sáng chuyển đổi tab mượt mà, cấu hình GitHub Actions tự động build deploy GitHub Pages.

- [ ] **Step 1: Viết test tích hợp toàn diện E2E (End-to-End)**
Kiểm tra luồng: Quản đốc bật sản phẩm $\rightarrow$ Tổ trưởng mở form thấy sản phẩm đó $\rightarrow$ Tổ trưởng nhập sản lượng $\rightarrow$ Quản đốc thấy dữ liệu trong Realtime Feed và Báo cáo.
- [ ] **Step 2: Chạy test xác nhận FAIL**
- [ ] **Step 3: Hoàn thiện `Navbar.jsx`, `App.jsx`, `.github/workflows/deploy.yml` và `README.md`**
Tạo file `README.md` hướng dẫn chi tiết cách tạo project Supabase miễn phí, chạy file SQL và liên kết biến môi trường khi deploy GitHub Pages.
- [ ] **Step 4: Chạy toàn bộ test suites và build dự án**
Chạy `npm test` và `npm run build` đảm bảo 100% tests PASS và build không lỗi.
- [ ] **Step 5: Commit**
`git add src/components/Navbar.jsx src/App.jsx .github/workflows/deploy.yml README.md tests/e2eApp.test.js && git commit -m "feat: complete application shell, github pages workflow and documentation"`

