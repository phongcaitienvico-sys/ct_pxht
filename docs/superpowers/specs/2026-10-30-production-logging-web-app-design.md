# Tài Liệu Thiết Kế (Design Document)
## Hệ Thống Quản Lý & Nhập Sản Lượng Xưởng (Production Logging Web App)

- **Ngày tạo**: 2026-10-30
- **Trạng thái**: Đã qua thẩm định kỹ thuật (Builder-Checked & Approved)
- **Nền tảng mục tiêu**: Web App đa nền tảng (PC Desktop cho Quản đốc, Mobile Responsive / PWA cho Tổ trưởng)
- **Kiến trúc công nghệ**: Supabase (Backend: Database PostgreSQL + Auth + Realtime + RLS) + React Vite Frontend (Tailwind CSS, Lucide Icons, SheetJS) triển khai tĩnh trên GitHub Pages.

---

### 1. Bối Cảnh & Mục Tiêu (Intent & The Why)
Trong mô hình sản xuất gia công cơ khí / chế tạo, việc quản lý sản lượng hàng ngày hiện đang thực hiện thủ công trên file Excel với hàng chục cột kéo ngang phức tạp. Các tổ trưởng ở xưởng khó thao tác trên điện thoại thông minh, dễ nhập sai hoặc sót dữ liệu.
Hệ thống này được xây dựng nhằm:
1. **Tinh gọn hóa việc nhập sản lượng tại xưởng**: Cung cấp giao diện điện thoại cực kỳ tiện lợi cho Tổ trưởng: 1 nhân viên có thể làm nhiều sản phẩm trong 1 ca, bấm nút thêm sản phẩm tùy ý, chỉ cần nhập Số lượng và Thời gian rồi Lưu tất cả trong 1 chạm.
2. **Quản trị tập trung & Bật/Tắt linh hoạt cho Quản đốc**: Quản đốc dùng máy tính, import danh sách hàng nghìn sản phẩm và nhân viên từ Excel. Hàng ngày Quản đốc kích hoạt (bật/tắt) các mã sản phẩm sẽ làm hôm nay, tổ trưởng chỉ nhìn thấy danh sách đã lọc gọn.
3. **Giám sát & Báo cáo Real-time đa chiều**: Quản đốc theo dõi dữ liệu đổ về tức thì mà không cần tải lại trang; xem báo cáo lịch sử theo tháng, ngày, từng nhân viên và xuất Excel chuẩn biểu mẫu.

---

### 2. Mục Tiêu, Phi Mục Tiêu & Chống Mục Tiêu (Goals, Non-Goals, Anti-Goals)

#### Goals (Mục tiêu cốt lõi):
- **Phân quyền đăng nhập riêng biệt**:
  - Quản đốc (Role: `admin`): Toàn quyền quản trị danh mục sản phẩm, nhân viên, bật/tắt mã hôm nay làm, xem toàn bộ báo cáo, sửa/xóa bản ghi sai sót, xuất Excel.
  - Tổ trưởng (Role: `leader`): Đăng nhập theo tài khoản của từng Tổ (ví dụ: Tổ 1, Tổ 2, Tổ Tiện, Tổ Phay...), chỉ nhập và xem lịch sử các bản ghi thuộc tổ của mình.
- **Tối ưu Mobile cho Tổ trưởng**:
  - Giao diện dạng thẻ/form cảm ứng thân thiện với bàn tay công nhân, nút bấm to.
  - Cho phép chọn 1 Nhân viên $\rightarrow$ thêm nhiều dòng sản phẩm cùng lúc $\rightarrow$ nhập Số lượng và Thời gian cho từng món $\rightarrow$ Lưu 1 lần toàn bộ.
  - Mặc định ngày làm việc là Hôm nay, nhưng cho phép lùi ngày (ví dụ: nhập bù ca tối qua).
  - Xem danh sách lịch sử trong ngày của tổ, hỗ trợ sửa / xóa nhanh nếu nhập nhầm.
- **Tối ưu Quản trị cho Quản đốc (PC)**:
  - Theme sáng chuẩn doanh nghiệp lớn (Clean Corporate / Modern SaaS phong cách Tailwind / Shadcn).
  - Quản lý danh mục lên đến 10.000+ mã: Tìm kiếm tức thì, lọc theo Khách hàng, lọc trạng thái, Bật/Tắt hàng loạt (Bulk Toggle) kèm nút "Tắt tất cả hôm nay".
  - Import 2 file Excel: Danh mục Sản phẩm (Tên, Khách hàng, Số lượng đơn, Phôi, T.t, ID) và Danh bạ Nhân viên (Mã NV, Họ tên, Tổ).
  - Module Báo cáo Thống kê linh hoạt: Lọc theo khoảng ngày (từ ngày - đến ngày), lọc theo nhân viên, xem bảng chi tiết ngày nào làm sản phẩm gì, tổng sản lượng, tổng số giờ, xuất Excel trực tiếp.
- **Triển khai miễn phí, zero-server maintenance**: Chạy Frontend tĩnh trên GitHub Pages, Backend trên Supabase Cloud Free Tier.

#### Non-Goals (Không thuộc phạm vi):
- Không quản lý tính lương hay đơn giá sản phẩm trong pha này (chỉ quản lý Số lượng và Thời gian làm việc).
- Không quản lý kho nguyên vật liệu đầu vào chuyên sâu hay ERP toàn diện.
- Bỏ trường "Công đoạn" theo yêu cầu trực tiếp từ Quản đốc để tinh gọn tối đa.

#### Anti-Goals (Tuyệt đối tránh):
- **Không dàn bảng ngang cuộn ngang vô tận trên điện thoại**: Tránh việc bắt tổ trưởng phải zoom in / cuộn màn hình như file Excel truyền thống.
- **Không làm chậm thao tác ở xưởng**: Tổ trưởng không phải chọn lại tên nhân viên nhiều lần khi một người làm 3-4 món đồ khác nhau.
- **Không phụ thuộc vào server local cố định**: Không yêu cầu dựng server phức tạp trong mạng LAN, có thể truy cập qua 4G/Wifi từ bất kỳ đâu.

---

### 3. Ràng Buộc & Công Nghệ (Constraints)
- **Hosting**: GitHub Pages (Static Hosting) - không chạy backend Node.js server truyền thống trên host này.
- **Backend & Database**: Supabase (PostgreSQL, Supabase Auth, Row Level Security, Supabase Realtime).
- **Frontend Stack**: React 18+ (Vite SPA) + Tailwind CSS + Lucide React + SheetJS (`xlsx`) để đọc/xuất Excel.
- **Bảo mật**: Row Level Security (RLS) trên PostgreSQL đảm bảo Tổ trưởng chỉ ghi/sửa được dữ liệu của tổ mình, Admin quản lý toàn quyền.

---

### 4. Các Phương Án Đã Cân Nhắc & Lựa Chọn (Approaches)
1. **Phương án A: Next.js + SQLite / Server riêng**
   - *Đánh đổi*: Cần server luôn bật hoặc VPS trả phí, khó cấu hình IP/mạng nội bộ cho điện thoại công nhân truy cập.
2. **Phương án B: Supabase Cloud + GitHub Pages (Người dùng chọn - Được phê duyệt)**
   - *Ưu điểm*: Zero chi phí hosting, uptime 99.9%, HTTPS mặc định, Database PostgreSQL mạnh mẽ có Realtime và Auth sẵn, tổ trưởng mở link bằng điện thoại bất cứ đâu (kể cả 4G).
   - *Lý do chọn*: Phù hợp nhất với hạ tầng không cần bảo trì máy chủ và yêu cầu truy cập linh hoạt bằng điện thoại từ xưởng.

---

### 5. Thiết Kế Chi Tiết (Detailed Architecture & Schema)

#### 5.1. Cơ Sở Dữ Liệu Supabase (PostgreSQL Schema)

```sql
-- 1. Bảng Tổ sản xuất (Teams / Units)
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- ví dụ: "Tổ 1 - Cơ khí", "Tổ 2 - Tiện Phay"
  leader_email TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Bảng Nhân viên (Employees)
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE, -- Mã NV: NV01, NV02...
  full_name TEXT NOT NULL,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Bảng Sản phẩm / Đơn hàng (Products)
CREATE TABLE products (
  id TEXT PRIMARY KEY, -- Mã ID sản phẩm từ Excel (ví dụ: '1732', '1733')
  name TEXT NOT NULL,
  customer TEXT NOT NULL, -- Khách hàng: Đại Phú, Hà Song Hải...
  order_quantity INTEGER DEFAULT 0, -- Số lượng đơn/kế hoạch
  blank_quantity INTEGER DEFAULT 0, -- Số lượng phôi
  status TEXT DEFAULT 'Sx', -- Trạng thái: Sx...
  is_active_today BOOLEAN DEFAULT FALSE, -- Cờ bật/tắt làm hôm nay (Admin điều khiển)
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Bảng Nhật ký Sản lượng (Production Logs)
CREATE TABLE production_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  team_id UUID REFERENCES teams(id) ON DELETE RESTRICT,
  employee_id UUID REFERENCES employees(id) ON DELETE RESTRICT,
  product_id TEXT REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0), -- Số lượng làm được
  duration_hours NUMERIC(4, 2) NOT NULL CHECK (duration_hours >= 0), -- Thời gian làm (ví dụ: 2.5)
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chỉ mục tối ưu truy vấn báo cáo theo ngày và nhân viên
CREATE INDEX idx_logs_date ON production_logs(log_date);
CREATE INDEX idx_logs_employee ON production_logs(employee_id);
CREATE INDEX idx_logs_team ON production_logs(team_id);
CREATE INDEX idx_products_active ON products(is_active_today);
```

#### 5.2. Các Quyết Định Kỹ Thuật Đã Thẩm Định (Builder Decisions Sourced)
1. **Ranh giới ngày làm việc & Ca làm**: Form Mobile mặc định chọn ngày hiện tại (`CURRENT_DATE`), nhưng cho phép Tổ trưởng bấm đổi ngày (hỗ trợ nhập bù ngày hôm trước nếu ca đêm kết thúc muộn).
2. **Quyền hạn Quản đốc**: Quản đốc có quyền Toàn phần (Full CRUD) trên màn hình Báo cáo, cho phép chỉnh sửa hoặc xóa bất kỳ dòng ghi nhận sai sót nào của các tổ.
3. **Vòng đời Bật/Tắt SP**: Giữ trạng thái thủ công theo lựa chọn của Quản đốc, bổ sung nút **`Tắt tất cả hôm nay`** để Quản đốc nhanh chóng reset danh mục về 0 vào đầu mỗi ca mới mà không cần xóa database.
4. **Mượn thợ chéo tổ**: Dropdown nhân viên của tổ trưởng ưu tiên các công nhân thuộc tổ mình, kèm nút "Thêm thợ tổ khác" khi có điều động tăng cường.
5. **Cấp phát tài khoản**: Cung cấp script tạo sẵn tài khoản Admin và tài khoản các Tổ trưởng mẫu; mật khẩu có thể đổi trực tiếp trong giao diện cài đặt.

---

### 6. Cấu Trúc Mã Nguồn Dự Án (Project Structure)
```
ct_pxht3010/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── lib/
│   │   ├── supabase.js          # Kết nối Supabase Client
│   │   └── excel.js             # Tiện ích đọc / ghi file Excel (SheetJS)
│   ├── contexts/
│   │   └── AuthContext.jsx      # Quản lý phiên đăng nhập (Admin vs Leader)
│   ├── components/
│   │   ├── Navbar.jsx           # Thanh điều hướng (Theme sáng)
│   │   ├── admin/
│   │   │   ├── ProductManager.jsx   # Quản lý & Bật/Tắt hàng nghìn SP (List, Filter, Bulk)
│   │   │   ├── EmployeeManager.jsx  # Quản lý danh sách thợ & Import Excel
│   │   │   ├── RealtimeFeed.jsx     # Bảng giám sát sản lượng thời gian thực
│   │   │   └── ReportAnalytics.jsx  # Báo cáo lọc theo tháng/ngày/thợ & Xuất Excel
│   │   └── leader/
│   │       ├── LeaderEntryForm.jsx  # Form Mobile thêm nhiều SP cho 1 thợ
│   │       └── LeaderDailyLogs.jsx  # Xem & sửa lịch sử tổ đã nhập hôm nay
│   └── data/
│       └── seedData.js          # Dữ liệu ban đầu từ bảng mẫu của bạn để test ngay
└── docs/
    └── supabase_schema.sql      # Toàn bộ mã SQL tạo bảng & phân quyền trên Supabase
```
