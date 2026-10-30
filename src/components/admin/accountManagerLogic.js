/**
 * Logic thuần cho quản lý tài khoản: kiểm tra dữ liệu, bảo vệ quản trị cuối cùng, lọc danh sách.
 */

export const MIN_PASSWORD_LENGTH = 6;
export const DEFAULT_ADMIN = {
  username: 'admin',
  password: 'admin123',
  full_name: 'Quản Trị Viên'
};

export function normalizeUsername(value) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeText(str) {
  return String(str ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
}

export function roleLabel(role) {
  return role === 'admin' ? 'Quản trị' : 'Tổ trưởng';
}

export function isDefaultCredentials(username, password) {
  return (
    normalizeUsername(username) === DEFAULT_ADMIN.username && password === DEFAULT_ADMIN.password
  );
}

export function validatePassword(password) {
  if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
    return `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự`;
  }
  return null;
}

/**
 * @returns {{valid: boolean, errors: Object, sanitized: Object}}
 */
export function validateNewAccount(input = {}, existingAccounts = []) {
  const errors = {};
  const username = normalizeUsername(input.username);
  const fullName = String(input.full_name ?? '').trim();
  const role = input.role === 'admin' ? 'admin' : input.role === 'leader' ? 'leader' : null;
  const teamId = input.team_id ? String(input.team_id) : null;

  if (!username) {
    errors.username = 'Vui lòng nhập tên đăng nhập';
  } else if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    errors.username = 'Tên đăng nhập 3-32 ký tự, chỉ gồm chữ không dấu, số, . _ -';
  } else if (existingAccounts.some((a) => normalizeUsername(a.username) === username)) {
    errors.username = 'Tên đăng nhập đã tồn tại';
  }
  if (!fullName) errors.full_name = 'Vui lòng nhập họ tên';
  if (!role) errors.role = 'Vui lòng chọn vai trò';
  if (role === 'leader' && !teamId) errors.team_id = 'Tổ trưởng bắt buộc phải thuộc một tổ';
  const pwError = validatePassword(input.password);
  if (pwError) errors.password = pwError;

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    sanitized: {
      username,
      full_name: fullName,
      role,
      team_id: role === 'leader' ? teamId : null,
      password: input.password
    }
  };
}

/**
 * Kiểm tra chỉnh sửa tài khoản (họ tên, tổ, mật khẩu mới tuỳ chọn).
 */
export function validateAccountUpdate(input = {}, account = {}) {
  const errors = {};
  const fullName = String(input.full_name ?? '').trim();
  const teamId = input.team_id ? String(input.team_id) : null;
  if (!fullName) errors.full_name = 'Vui lòng nhập họ tên';
  if (account.role === 'leader' && !teamId) errors.team_id = 'Tổ trưởng bắt buộc phải thuộc một tổ';
  if (input.password) {
    const pwError = validatePassword(input.password);
    if (pwError) errors.password = pwError;
  }
  const sanitized = {
    full_name: fullName,
    team_id: account.role === 'leader' ? teamId : null
  };
  if (input.password) sanitized.password = input.password;
  return { valid: Object.keys(errors).length === 0, errors, sanitized };
}

export function countActiveAdmins(accounts = []) {
  return accounts.filter((a) => a.role === 'admin' && a.is_active !== false).length;
}

function isLastActiveAdmin(accounts, target) {
  return (
    target.role === 'admin' && target.is_active !== false && countActiveAdmins(accounts) <= 1
  );
}

export function canDeleteAccount(accounts = [], target, currentUser) {
  if (!target) return { ok: false, reason: 'Không tìm thấy tài khoản' };
  if (currentUser && String(currentUser.id) === String(target.id)) {
    return { ok: false, reason: 'Không thể xóa chính mình' };
  }
  if (isLastActiveAdmin(accounts, target)) {
    return { ok: false, reason: 'Không thể xóa tài khoản quản trị cuối cùng' };
  }
  return { ok: true };
}

/** Kiểm tra có được phép KHOÁ (vô hiệu hoá) tài khoản. Mở khoá luôn được phép. */
export function canToggleActive(accounts = [], target, currentUser) {
  if (!target) return { ok: false, reason: 'Không tìm thấy tài khoản' };
  if (target.is_active === false) return { ok: true };
  if (currentUser && String(currentUser.id) === String(target.id)) {
    return { ok: false, reason: 'Không thể khóa chính mình' };
  }
  if (isLastActiveAdmin(accounts, target)) {
    return { ok: false, reason: 'Không thể khóa tài khoản quản trị cuối cùng' };
  }
  return { ok: true };
}

export function filterAccounts(accounts = [], searchTerm = '') {
  const q = normalizeText(searchTerm);
  if (!q) return accounts;
  return accounts.filter(
    (a) => normalizeText(a.username).includes(q) || normalizeText(a.full_name).includes(q)
  );
}
