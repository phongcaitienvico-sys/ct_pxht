-- ==============================================================================
-- MIGRATION 2026: Cong doan (process steps) + bo rang buoc "to truong phai co to"
-- Dan toan bo file nay vao Supabase SQL Editor va bam Run. An toan khi chay lai nhieu lan (idempotent).
-- ==============================================================================

-- 1. Cong doan cua san pham (mang chuoi, toi da 10) va cong doan da chon trong nhat ky san luong
ALTER TABLE products ADD COLUMN IF NOT EXISTS operations JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS operation TEXT NOT NULL DEFAULT '';

-- 2. Bo khai niem "to": production_logs.team_id khong bat buoc; to truong khong can thuoc to
ALTER TABLE production_logs ALTER COLUMN team_id DROP NOT NULL;
ALTER TABLE app_accounts DROP CONSTRAINT IF EXISTS leader_needs_team;

-- 3. Tao tai khoan: khong con yeu cau to truong phai co to
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

-- 4. Cap nhat tai khoan: ho ten, to (tuy chon), khoa/mo khoa, dat lai mat khau (tham so NULL = giu nguyen)
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

GRANT EXECUTE ON FUNCTION app_create_account(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_update_account(TEXT, TEXT, UUID, TEXT, UUID, BOOLEAN, TEXT) TO anon, authenticated;
