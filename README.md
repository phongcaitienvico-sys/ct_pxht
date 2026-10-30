# PXHT - Hệ Thống Nhật Ký Sản Xuất Phân Xưởng Hoàn Thiện 🚢⚙️

Hệ thống ghi nhận, theo dõi sản lượng và quản lý phân công sản xuất hàng ngày theo thời gian thực (Real-time Production Logging System) được thiết kế chuyên biệt cho **Phân Xưởng Hoàn Thiện (PXHT)**.

Ứng dụng đáp ứng mô hình 2 vai trò linh hoạt:
- 🖥️ **Quản Đốc (Admin PC)**: Quản lý danh mục sản phẩm gia công, danh sách công nhân viên, giám sát luồng sản lượng theo thời gian thực và phân tích báo cáo, xuất file Excel chuẩn biểu mẫu 2 sheet.
- 📱 **Tổ Trưởng (Leader Mobile)**: Giao diện tối ưu thao tác 1 tay trên điện thoại di động tại phân xưởng, nhập sản lượng theo ca cho từng công nhân với nhiều sản phẩm, kiểm tra lịch sử và chỉnh sửa nhanh.

---

## 🌟 Tính Năng Nổi Bật

### 1. Phân Hệ Quản Đốc (Admin PC)
- **📋 Quản Lý Danh Mục Sản Phẩm (`ProductManager`)**:
  - Bật/tắt trạng thái sản phẩm gia công trong ngày chỉ với 1 chạm (Single toggle & Bulk toggle theo khách hàng).
  - Tìm kiếm sản phẩm thông minh theo mã sản phẩm, tên chi tiết, hoặc khách hàng (Đại Phú, Hòa Phát, VICEM Bút Sơn,...).
  - Tải file mẫu Excel và Import/Export danh mục sản phẩm hàng loạt.
  - Reset trạng thái danh mục đầu ca mới an toàn.
- **⚡ Giám Sát Realtime (`RealtimeFeed`)**:
  - Tự động nhận dữ liệu sản lượng tức thì khi Tổ trưởng gửi từ xưởng qua Supabase Realtime channel.
  - Thẻ KPI trực quan: Tổng số sản phẩm hoàn thành, tổng giờ làm, số thợ đã ghi nhận, số tổ đang hoạt động.
  - Phân loại trực quan theo màu sắc từng tổ và tìm kiếm nhanh.
- **📊 Báo Cáo Thống Kê & Phân Tích (`ReportAnalytics`)**:
  - Bộ lọc đa chiều: Khoảng ngày tùy chọn (Hôm nay, 7 ngày qua, Tháng này, Tháng trước), lọc theo Tổ, lọc theo từng Công nhân.
  - Phân tích hiệu suất trung bình (sản phẩm/giờ), tổng ngày công và tổng thời gian gia công.
  - Bảng tổng hợp theo từng người thợ và danh sách chi tiết từng lượt gia công.
  - **Xuất Báo Cáo Excel Đạt Chuẩn**: Tạo file `.xlsx` tự động gồm 2 Sheet chuyên nghiệp (`Chi_Tiet_San_Luong` và `Tong_Hop_Theo_Nhan_Vien`).
- **🔑 Quản Lý Tài Khoản (`AccountManager`)**: tạo/sửa/khóa/xóa tài khoản quản trị & tổ trưởng, đặt lại mật khẩu, quản lý tổ.
- **👥 Quản Lý Nhân Viên (`EmployeeManager`)**:
  - Quản lý danh sách thợ theo tổ (Tổ 1 - Cơ khí & Đúc, Tổ 2 - Tiện & Phay,...).
  - Thêm, sửa thông tin thợ, kích hoạt / tạm dừng trạng thái làm việc.
  - Hỗ trợ Import / Export danh sách thợ bằng Excel.

### 2. Phân Hệ Tổ Trưởng (Leader Mobile)
- **📝 Nhập Sản Lượng Ca Sản Xuất (`LeaderEntryForm`)**:
  - Thiết kế Mobile-First giao diện thẻ hiện đại, nút bấm to bản dễ thao tác trong môi trường nhà xưởng.
  - Lọc nhanh chỉ hiển thị những sản phẩm đang được Quản đốc kích hoạt trong ca hôm nay.
  - Chọn thợ trong tổ hoặc linh hoạt mượn thợ từ tổ khác (`includeOtherTeams`).
  - Cho phép thêm nhiều dòng sản phẩm cho cùng một thợ trong 1 lượt gửi.
  - Tự động tính nhẩm tổng sản lượng và tổng giờ ngay trên giao diện trước khi lưu.
  - Hệ thống kiểm tra hợp lệ thông minh: Chống chọn trùng mã sản phẩm, kiểm tra số lượng và giờ làm > 0.
- **📑 Lịch Sử Nhật Ký Của Tổ (`LeaderDailyLogs`)**:
  - Xem danh sách sản lượng đã nhập của tổ theo ngày đã chọn.
  - Xem theo dạng danh sách chi tiết hoặc gom nhóm theo từng công nhân.
  - Chỉnh sửa nhanh số lượng, giờ làm, ghi chú hoặc xóa dòng nhập nhầm có hộp thoại xác nhận an toàn.
  - Nút chuyển nhanh sang màn hình nhập sản lượng mới.

### 3. Chế Độ Thử Nghiệm (Offline Fallback)
- Khi chưa cấu hình Supabase Cloud, hệ thống tự chạy ở **chế độ thử nghiệm** lưu dữ liệu cục bộ (Local Storage) với dữ liệu mẫu của xưởng. Chế độ này cũng yêu cầu đăng nhập như bình thường (xem mục **Quản lý tài khoản** bên dưới).
- Trên máy tính, màn hình Tổ trưởng có mục **Mô phỏng màn hình điện thoại** trong menu người dùng (góc phải thanh điều hướng).

## 🔑 Quản lý tài khoản

Hệ thống đăng nhập bằng **tên đăng nhập + mật khẩu** (không dùng email). Không còn chế độ tự đăng nhập hay chuyển vai trò demo.

- **Tài khoản quản trị mặc định**: tên đăng nhập `admin`, mật khẩu `admin123` (tự tạo ở lần chạy đầu tiên khi chưa có tài khoản nào; trong Supabase thì được seed bởi `docs/supabase_schema.sql`). Khi còn dùng mật khẩu mặc định, giao diện quản trị hiển thị cảnh báo *"Bạn đang dùng mật khẩu mặc định — hãy đổi ngay"*. Hãy đổi ngay qua menu người dùng → **Đổi mật khẩu**.
- **Thêm tổ trưởng**: đăng nhập quản trị → tab **Tài Khoản**:
  1. Mục **Quản lý tổ**: thêm tổ thật của xưởng hoặc đổi tên tổ có sẵn.
  2. Bấm **Thêm tài khoản**, nhập tên đăng nhập, họ tên, chọn vai trò **Tổ trưởng**, chọn **Tổ**, đặt mật khẩu (tối thiểu 6 ký tự).
  3. Có thể sửa họ tên/tổ, **đặt lại mật khẩu**, khóa/mở khóa hoặc xóa tài khoản. Không thể xóa/khóa chính mình hoặc quản trị viên cuối cùng.
- **Mọi người dùng** (kể cả tổ trưởng) tự đổi mật khẩu từ menu người dùng → **Đổi mật khẩu**.
- **Lưu mật khẩu**: không bao giờ lưu mật khẩu thô. Chế độ thử nghiệm băm SHA-256 + salt ngẫu nhiên từng tài khoản (Web Crypto). Chế độ Supabase gửi mật khẩu qua HTTPS tới các hàm RPC `security definer` (`app_login`, `app_create_account`...) và băm bcrypt (`pgcrypto`) ngay trên máy chủ; bảng `app_accounts` bật RLS và không có policy truy cập trực tiếp. Khi quản lý tài khoản ở chế độ Supabase, hệ thống yêu cầu nhập lại mật khẩu quản trị (chỉ giữ trong bộ nhớ trang).
- **Hạn chế đã biết (cần siết chặt sau)**: các bảng dữ liệu khác (`products`, `employees`, `production_logs`, `teams`) vẫn truy cập bằng khóa `anon` của Supabase với policy rộng, nên đăng nhập hiện chủ yếu kiểm soát *giao diện*, chưa phải ranh giới bảo mật dữ liệu ở tầng cơ sở dữ liệu. Chưa có giới hạn số lần đăng nhập sai. Khi triển khai thật nên chuyển sang Supabase Auth / JWT và siết RLS cho các bảng còn lại. Nếu đã chạy schema cũ, hãy chạy lại `docs/supabase_schema.sql` để tạo bảng `app_accounts` và các hàm RPC.

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Cục Bộ (Local)

### Yêu Cầu Môi Trường
- **Node.js** phiên bản 18+ (khuyên dùng Node 20 LTS).
- **npm** phiên bản 9+.

### Các Bước Thực Hiện
1. Clone mã nguồn về máy:
   ```bash
   git clone <URL_REPOSITORY>
   cd ct_pxht3010
   ```

2. Cài đặt các thư viện phụ thuộc:
   ```bash
   npm install
   ```

3. Chạy ứng dụng ở môi trường phát triển:
   ```bash
   npm run dev
   ```
   Mở trình duyệt truy cập: `http://localhost:5173`

4. Chạy toàn bộ bộ kiểm thử tự động (Unit & Integration Tests):
   ```bash
   npm test
   ```

5. Đóng gói kiểm tra biên dịch ứng dụng (Production Build):
   ```bash
   npm run build
   ```

---

## 🗄️ Hướng Dẫn Kết Nối Supabase Cloud (PostgreSQL Realtime)

Khi muốn đưa hệ thống vào vận hành thực tế tại phân xưởng với cơ sở dữ liệu đồng bộ đám mây và tính năng Realtime, hãy làm theo các bước sau:

### Bước 1: Khởi Tạo Dự Án Trên Supabase
1. Đăng ký/đăng nhập tài khoản tại [supabase.com](https://supabase.com).
2. Tạo một Project mới (ví dụ đặt tên: `pxht-production-logging`).
3. Chọn khu vực máy chủ gần nhất (ví dụ: `Singapore - ap-southeast-1`).

### Bước 2: Thiết Lập Cơ Sở Dữ Liệu
1. Tại thanh điều hướng Supabase Dashboard, chọn mục **SQL Editor**.
2. Mở file [docs/supabase_schema.sql](file:///docs/supabase_schema.sql) trong thư mục dự án này, copy toàn bộ nội dung.
3. Dán vào khung SQL Editor và nhấn **Run**.
4. Toàn bộ các bảng (`teams`, `employees`, `products`, `production_logs`), chính sách phân quyền RLS, trigger Realtime và dữ liệu khởi tạo ban đầu sẽ được thiết lập tự động.

### Bước 3: Lấy Thông Tin Kết Nối API
1. Vào mục **Project Settings** (biểu tượng bánh răng) -> Chọn **API**.
2. Tìm và copy 2 thông số:
   - **Project URL**
   - **Project API keys** -> copy key `anon` `public`

### Bước 4: Tạo File Biến Môi Trường Cục Bộ
Tạo file `.env` tại thư mục gốc của dự án với nội dung:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Bước 5: Kiểm Tra Kết Nối
Khởi động lại ứng dụng bằng lệnh:
```bash
npm run dev
```
Quan sát thanh điều hướng trên cùng của giao diện:
- Badge trạng thái sẽ chuyển từ **● Demo Mode** sang **● Supabase Live**.
- Mọi thao tác nhập liệu của Tổ trưởng sẽ phát tín hiệu Realtime tức thì lên bảng Giám sát của Quản đốc!

---

## 🌐 Hướng Dẫn Triển Khai GitHub Pages Miễn Phí

Dự án đã được cấu hình tự động hóa toàn diện thông qua GitHub Actions tại [.github/workflows/deploy.yml](file:///.github/workflows/deploy.yml).

### Các Bước Bật Tự Động Triển Khai:
1. Đẩy mã nguồn dự án lên GitHub repository của bạn:
   ```bash
   git add .
   git commit -m "feat: complete application shell, github pages workflow and documentation"
   git push origin main
   ```
2. Mở trang quản trị kho mã nguồn trên GitHub, chọn tab **Settings**.
3. Tại menu bên trái, tìm đến mục **Pages**.
4. Tại phần **Build and deployment**:
   - Mục **Source**: Chọn **GitHub Actions**.
5. *(Tùy chọn khi dùng Supabase Live trên GitHub Pages)*:
   - Vào **Settings** -> **Secrets and variables** -> **Actions**.
   - Thêm 2 Repository Secrets:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
6. Chuyển sang tab **Actions** trên GitHub để theo dõi tiến trình Deploy.
7. Khi workflow chạy xong (khoảng 1-2 phút), trang web sẽ sẵn sàng tại địa chỉ:
   `https://<ten-tai-khoan>.github.io/<ten-repo>/`

---

## 📁 Cấu Trúc Mã Nguồn Dự Án

```
├── .github/
│   └── workflows/
│       └── deploy.yml             # Tự động hóa build & deploy GitHub Pages
├── docs/
│   └── supabase_schema.sql        # Kịch bản DDL tạo bảng & RLS cho PostgreSQL
├── src/
│   ├── components/
│   │   ├── admin/
│   │   │   ├── EmployeeManager.jsx       # Quản lý nhân sự & phân tổ
│   │   │   ├── ProductManager.jsx        # Quản lý danh mục & bật tắt ca
│   │   │   ├── productManagerLogic.js   # Logic nghiệp vụ danh mục sản phẩm
│   │   │   ├── RealtimeFeed.jsx          # Giám sát sản lượng thời gian thực
│   │   │   ├── realtimeFeedLogic.js      # Logic tính KPI và xử lý luồng sự kiện
│   │   │   ├── ReportAnalytics.jsx       # Báo cáo thống kê & xuất dữ liệu
│   │   │   └── reportAnalyticsLogic.js   # Logic bộ lọc đa chiều & KPI thống kê
│   │   ├── leader/
│   │   │   ├── LeaderDailyLogs.jsx       # Lịch sử ghi nhận của tổ
│   │   │   ├── leaderDailyLogsLogic.js   # Logic chỉnh sửa & tổng hợp theo ngày
│   │   │   ├── LeaderEntryForm.jsx       # Form nhập sản lượng mobile-first
│   │   │   └── leaderEntryLogic.js       # Logic kiểm tra hợp lệ & gom payload
│   │   ├── LoginModal.jsx                # Hộp thoại đăng nhập & đổi vai trò
│   │   └── Navbar.jsx                    # Thanh điều hướng Corporate & Role switcher
│   ├── contexts/
│   │   ├── AuthContext.jsx               # Context quản lý phiên đăng nhập
│   │   └── authLogic.js                  # Logic phân quyền và chuyển vai trò demo
│   ├── data/
│   │   └── seedData.js                   # Dữ liệu hạt giống nhà xưởng thực tế
│   ├── lib/
│   │   ├── excel.js                      # Tiện ích Import/Export Excel 2 Sheet
│   │   └── supabase.js                   # Adapter Supabase SDK & Fallback Offline
│   ├── App.jsx                           # Component gốc điều phối các phân hệ
│   ├── index.css                         # Cấu hình Tailwind CSS
│   └── main.jsx                          # Điểm vào React DOM
├── tests/
│   ├── authContext.test.js               # Kiểm thử phân quyền & session
│   ├── e2eApp.test.js                    # Kiểm thử tích hợp toàn trình (E2E)
│   ├── excel.test.js                     # Kiểm thử tiện ích Excel
│   ├── leaderDailyLogs.test.js           # Kiểm thử màn hình nhật ký tổ
│   ├── leaderEntryForm.test.js           # Kiểm thử form nhập liệu tổ trưởng
│   ├── productManager.test.js            # Kiểm thử quản lý sản phẩm
│   ├── realtimeFeed.test.js              # Kiểm thử luồng realtime & KPI
│   ├── reportAnalytics.test.js           # Kiểm thử báo cáo & phân tích
│   ├── setup.test.js                     # Kiểm thử cấu hình scaffolding
│   └── supabaseClient.test.js            # Kiểm thử client Supabase
├── package.json
├── tailwind.config.js
└── vite.config.js
```

---

## 🔒 Giấy Phép & Bản Quyền

Dự án được xây dựng và phát triển phục vụ công tác điều hành sản xuất tại **Phân Xưởng Hoàn Thiện (PXHT)**.
Bản quyền © 2026 PXHT. Mọi quyền được bảo lưu.
