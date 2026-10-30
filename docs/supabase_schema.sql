-- ==============================================================================
-- HE THONG QUAN LY & NHAP SAN LUONG XUONG (PRODUCTION LOGGING WEB APP)
-- Supabase PostgreSQL Schema & Row Level Security (RLS) DDL
-- ==============================================================================

-- 1. Bảng Tổ sản xuất (Teams / Units)
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- Ví dụ: "Tổ 1 - Cơ khí & Đúc", "Tổ 2 - Tiện & Phay"
  leader_email TEXT UNIQUE,  -- Email đăng nhập của Tổ trưởng
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Bảng Nhân viên (Employees)
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE, -- Mã NV: NV01, NV02...
  full_name TEXT NOT NULL,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Bảng Sản phẩm / Đơn hàng (Products)
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, -- Mã ID sản phẩm từ Excel (ví dụ: '1732', '1733')
  name TEXT NOT NULL,
  customer TEXT NOT NULL, -- Khách hàng: Đại Phú, Hà Song Hải...
  order_quantity INTEGER DEFAULT 0, -- Số lượng kế hoạch theo đơn
  blank_quantity INTEGER DEFAULT 0, -- Số lượng phôi
  status TEXT DEFAULT 'Sx', -- Trạng thái sản xuất: 'Sx', 'Tạm dừng', 'Hoàn thành'
  is_active_today BOOLEAN DEFAULT FALSE, -- Cờ kích hoạt làm hôm nay (Admin điều khiển)
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Bảng Nhật ký Sản lượng (Production Logs)
CREATE TABLE IF NOT EXISTS production_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  team_id UUID REFERENCES teams(id) ON DELETE RESTRICT,
  employee_id UUID REFERENCES employees(id) ON DELETE RESTRICT,
  product_id TEXT REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0), -- Số lượng hoàn thành
  duration_hours NUMERIC(4, 2) NOT NULL CHECK (duration_hours >= 0), -- Số giờ làm việc (ví dụ: 2.5)
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- INDEXES CHO TOI UU TRUY VAN VA BAO CAO
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_logs_date ON production_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_logs_employee ON production_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_logs_team ON production_logs(team_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active_today);
CREATE INDEX IF NOT EXISTS idx_employees_team ON employees(team_id);

-- ==============================================================================
-- REALTIME SUBSCRIPTIONS
-- Cho phép Supabase Realtime phát thông báo khi có thay đổi bản ghi
-- ==============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE production_logs;
    ALTER PUBLICATION supabase_realtime ADD TABLE products;
    ALTER PUBLICATION supabase_realtime ADD TABLE employees;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_logs ENABLE ROW LEVEL SECURITY;

-- Helper Function: Kiem tra nguoi dung co quyen Admin khong
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (auth.jwt() ->> 'role' = 'service_role') OR
    (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin') OR
    (auth.jwt() ->> 'email' LIKE '%admin%'),
    FALSE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --- POLICIES FOR TEAMS ---
CREATE POLICY "Cho phép đọc danh sách tổ"
  ON teams FOR SELECT
  USING (true);

CREATE POLICY "Admin toàn quyền quản lý tổ"
  ON teams FOR ALL
  USING (is_admin() OR auth.role() = 'anon');

-- --- POLICIES FOR EMPLOYEES ---
CREATE POLICY "Cho phép đọc danh sách nhân viên"
  ON employees FOR SELECT
  USING (true);

CREATE POLICY "Admin quản lý nhân viên"
  ON employees FOR ALL
  USING (is_admin() OR auth.role() = 'anon');

-- --- POLICIES FOR PRODUCTS ---
CREATE POLICY "Cho phép đọc danh sách sản phẩm"
  ON products FOR SELECT
  USING (true);

CREATE POLICY "Admin quản lý sản phẩm"
  ON products FOR ALL
  USING (is_admin() OR auth.role() = 'anon');

-- --- POLICIES FOR PRODUCTION LOGS ---
CREATE POLICY "Xem nhật ký sản lượng"
  ON production_logs FOR SELECT
  USING (true);

CREATE POLICY "Thêm nhật ký sản lượng"
  ON production_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Chỉnh sửa nhật ký sản lượng"
  ON production_logs FOR UPDATE
  USING (is_admin() OR auth.role() = 'anon' OR created_at >= NOW() - INTERVAL '24 hours');

CREATE POLICY "Xóa nhật ký sản lượng"
  ON production_logs FOR DELETE
  USING (is_admin() OR auth.role() = 'anon' OR created_at >= NOW() - INTERVAL '24 hours');

-- ==============================================================================
-- SEED DATA (Du lieu khoi tao mau)
-- ==============================================================================
INSERT INTO teams (id, name, leader_email) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Tổ 1 - Cơ khí & Đúc', 'to1@xuong.vn'),
  ('a0000000-0000-0000-0000-000000000002', 'Tổ 2 - Tiện & Phay', 'to2@xuong.vn')
ON CONFLICT (id) DO NOTHING;

INSERT INTO employees (code, full_name, team_id, is_active) VALUES
  ('NV01', 'Trần Văn Hùng', 'a0000000-0000-0000-0000-000000000001', true),
  ('NV02', 'Lê Văn Cường', 'a0000000-0000-0000-0000-000000000001', true),
  ('NV03', 'Nguyễn Đình Tú', 'a0000000-0000-0000-0000-000000000001', true),
  ('NV04', 'Phạm Văn Minh', 'a0000000-0000-0000-0000-000000000002', true),
  ('NV05', 'Hoàng Đức Tuấn', 'a0000000-0000-0000-0000-000000000002', true),
  ('NV06', 'Đỗ Quốc Việt', 'a0000000-0000-0000-0000-000000000002', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO products (id, name, customer, order_quantity, blank_quantity, status, is_active_today) VALUES
  ('1732', 'Cánh đập phản kích 2021 (670x300x80)', 'Đại Phú', 8, 3, 'Sx', true),
  ('1733', 'Ống gối bi 231/500 (Φ1070/950 dài 1470)', 'Đại Phú', 2, 0, 'Sx', true),
  ('1765', 'Cánh đập MPK (660x400x120)', 'Đại Phú', 64, 16, 'Sx', false),
  ('1775', 'Cánh búa tâm 360', 'Đại Phú', 100, 30, 'Sx', true),
  ('1781', 'Cánh búa tâm 365 (Dày 55/45/35/74)', 'Đại Phú', 20, 16, 'Sx', false),
  ('1790', 'Cánh búa 395 (Dày 55/35/45/65)', 'Đại Phú', 100, 57, 'Sx', true),
  ('1816', 'Đĩa búa 1600x1800 (Đĩa 2 bên Φ700 moay ơ)', 'Đại Phú', 22, 0, 'Sx', true),
  ('1817', 'Đĩa búa 1600x1800 (Đĩa 1 bên Φ700 moay ơ)', 'Đại Phú', 4, 0, 'Sx', false),
  ('1462', 'Thanh đập đá vôi (2220x510x145)', 'Hà Song Hải- XM Hạ', 18, 4, 'Sx', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  customer = EXCLUDED.customer,
  order_quantity = EXCLUDED.order_quantity,
  blank_quantity = EXCLUDED.blank_quantity,
  status = EXCLUDED.status,
  is_active_today = EXCLUDED.is_active_today,
  updated_at = NOW();
