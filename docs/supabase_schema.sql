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

-- ==============================================================================
-- QUAN LY TAI KHOAN (ACCOUNT MANAGEMENT) - dang nhap bang ten dang nhap + mat khau
-- Bang app_accounts bat RLS va KHONG co policy nao -> anon key khong doc/ghi truc tiep duoc.
-- Moi thao tac di qua ham SECURITY DEFINER ben duoi. Mat khau duoc bam bang bcrypt
-- (pgcrypto crypt/gen_salt) NGAY TREN MAY CHU; trinh duyet chi gui mat khau qua HTTPS toi RPC.
-- Luu y: cac bang du lieu khac (products, production_logs...) van dung anon key (xem README).
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS app_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  salt TEXT NOT NULL DEFAULT '', -- bcrypt da nhung salt vao password_hash; cot giu lai cho dong bo voi che do demo
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'leader')),
  team_id UUID REFERENCES teams(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT leader_needs_team CHECK (role <> 'leader' OR team_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_accounts_username ON app_accounts (lower(username));

ALTER TABLE app_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_accounts FROM anon, authenticated;

-- Kiem tra quan tri vien (ten + mat khau); tra ve id hoac bao loi. Khong cho goi tu client.
CREATE OR REPLACE FUNCTION app_assert_admin(p_admin_username TEXT, p_admin_password TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_id UUID;
BEGIN
  SELECT id INTO v_id FROM app_accounts
   WHERE lower(username) = lower(COALESCE(p_admin_username, ''))
     AND role = 'admin' AND is_active
     AND password_hash = crypt(COALESCE(p_admin_password, ''), password_hash);
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Chỉ tài khoản quản trị (nhập đúng mật khẩu) mới có quyền thực hiện';
  END IF;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION app_assert_admin(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- Dang nhap: tra ve jsonb thong tin an toan hoac NULL neu sai / bi khoa
CREATE OR REPLACE FUNCTION app_login(p_username TEXT, p_password TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE r JSONB;
BEGIN
  SELECT jsonb_build_object('id', id, 'username', username, 'full_name', full_name,
                            'role', role, 'team_id', team_id, 'is_active', is_active)
    INTO r FROM app_accounts
   WHERE lower(username) = lower(COALESCE(p_username, '')) AND is_active
     AND password_hash = crypt(COALESCE(p_password, ''), password_hash);
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION app_list_accounts(p_admin_username TEXT, p_admin_password TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  PERFORM app_assert_admin(p_admin_username, p_admin_password);
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', id, 'username', username, 'full_name', full_name,
                                        'role', role, 'team_id', team_id, 'is_active', is_active)
                     ORDER BY username)
      FROM app_accounts), '[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION app_create_account(
  p_admin_username TEXT, p_admin_password TEXT,
  p_username TEXT, p_password TEXT, p_full_name TEXT, p_role TEXT, p_team_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE r JSONB;
BEGIN
  PERFORM app_assert_admin(p_admin_username, p_admin_password);
  IF length(COALESCE(p_password, '')) < 6 THEN
    RAISE EXCEPTION 'Mật khẩu phải có ít nhất 6 ký tự';
  END IF;
  IF p_role = 'leader' AND p_team_id IS NULL THEN
    RAISE EXCEPTION 'Tổ trưởng bắt buộc phải thuộc một tổ';
  END IF;
  IF EXISTS (SELECT 1 FROM app_accounts WHERE lower(username) = lower(p_username)) THEN
    RAISE EXCEPTION 'Tên đăng nhập đã tồn tại';
  END IF;
  INSERT INTO app_accounts (username, password_hash, full_name, role, team_id)
  VALUES (lower(trim(p_username)), crypt(p_password, gen_salt('bf')), trim(p_full_name), p_role,
          CASE WHEN p_role = 'leader' THEN p_team_id ELSE NULL END)
  RETURNING jsonb_build_object('id', id, 'username', username, 'full_name', full_name,
                               'role', role, 'team_id', team_id, 'is_active', is_active) INTO r;
  RETURN r;
END $$;

-- Cap nhat: ho ten, to, khoa/mo khoa, dat lai mat khau (tham so NULL = giu nguyen)
CREATE OR REPLACE FUNCTION app_update_account(
  p_admin_username TEXT, p_admin_password TEXT, p_id UUID,
  p_full_name TEXT DEFAULT NULL, p_team_id UUID DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL, p_password TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_admin UUID; v_target app_accounts; r JSONB;
BEGIN
  v_admin := app_assert_admin(p_admin_username, p_admin_password);
  SELECT * INTO v_target FROM app_accounts WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy tài khoản'; END IF;
  IF p_password IS NOT NULL AND length(p_password) < 6 THEN
    RAISE EXCEPTION 'Mật khẩu phải có ít nhất 6 ký tự';
  END IF;
  IF p_is_active = FALSE AND v_target.is_active THEN
    IF v_target.id = v_admin THEN RAISE EXCEPTION 'Không thể khóa chính mình'; END IF;
    IF v_target.role = 'admin'
       AND (SELECT count(*) FROM app_accounts WHERE role = 'admin' AND is_active) <= 1 THEN
      RAISE EXCEPTION 'Không thể khóa tài khoản quản trị cuối cùng';
    END IF;
  END IF;
  UPDATE app_accounts SET
    full_name = COALESCE(NULLIF(trim(p_full_name), ''), full_name),
    team_id = CASE WHEN role = 'leader' THEN COALESCE(p_team_id, team_id) ELSE NULL END,
    is_active = COALESCE(p_is_active, is_active),
    password_hash = CASE WHEN p_password IS NOT NULL THEN crypt(p_password, gen_salt('bf')) ELSE password_hash END
  WHERE id = p_id
  RETURNING jsonb_build_object('id', id, 'username', username, 'full_name', full_name,
                               'role', role, 'team_id', team_id, 'is_active', is_active) INTO r;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION app_delete_account(p_admin_username TEXT, p_admin_password TEXT, p_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_admin UUID; v_target app_accounts;
BEGIN
  v_admin := app_assert_admin(p_admin_username, p_admin_password);
  SELECT * INTO v_target FROM app_accounts WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy tài khoản'; END IF;
  IF v_target.id = v_admin THEN RAISE EXCEPTION 'Không thể xóa chính mình'; END IF;
  IF v_target.role = 'admin' AND v_target.is_active
     AND (SELECT count(*) FROM app_accounts WHERE role = 'admin' AND is_active) <= 1 THEN
    RAISE EXCEPTION 'Không thể xóa tài khoản quản trị cuối cùng';
  END IF;
  DELETE FROM app_accounts WHERE id = p_id;
END $$;

-- Nguoi dung tu doi mat khau cua minh
CREATE OR REPLACE FUNCTION app_change_password(p_username TEXT, p_old_password TEXT, p_new_password TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_id UUID;
BEGIN
  IF length(COALESCE(p_new_password, '')) < 6 THEN
    RAISE EXCEPTION 'Mật khẩu phải có ít nhất 6 ký tự';
  END IF;
  SELECT id INTO v_id FROM app_accounts
   WHERE lower(username) = lower(COALESCE(p_username, '')) AND is_active
     AND password_hash = crypt(COALESCE(p_old_password, ''), password_hash);
  IF v_id IS NULL THEN RAISE EXCEPTION 'Mật khẩu hiện tại không đúng'; END IF;
  UPDATE app_accounts SET password_hash = crypt(p_new_password, gen_salt('bf')) WHERE id = v_id;
END $$;

GRANT EXECUTE ON FUNCTION app_login(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_list_accounts(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_create_account(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_update_account(TEXT, TEXT, UUID, TEXT, UUID, BOOLEAN, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_delete_account(TEXT, TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_change_password(TEXT, TEXT, TEXT) TO anon, authenticated;

-- Tai khoan quan tri mac dinh (admin / admin123) - CHI tao khi chua co tai khoan nao. Hay doi mat khau ngay!
INSERT INTO app_accounts (username, password_hash, full_name, role)
SELECT 'admin', crypt('admin123', gen_salt('bf')), 'Quản Trị Viên', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM app_accounts);
