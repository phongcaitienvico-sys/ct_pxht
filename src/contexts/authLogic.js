/**
 * Auth Logic & Session Helpers
 * Đăng nhập bằng tên đăng nhập + mật khẩu (tài khoản lưu qua adapter supabase.js),
 * phiên làm việc lưu ở localStorage (`pxht_session`) và chỉ chứa thông tin an toàn (không có mật khẩu/băm).
 */

import { isDefaultCredentials } from '../components/admin/accountManagerLogic.js';

// Map demo team identifiers to database seed team UUIDs (tương thích dữ liệu cũ)
export const DEMO_TEAM_MAP = {
  'team-1': 'a0000000-0000-0000-0000-000000000001',
  'team-2': 'a0000000-0000-0000-0000-000000000002'
};

export function resolveEffectiveTeamId(teamId) {
  if (!teamId) return null;
  return DEMO_TEAM_MAP[teamId] || teamId;
}

export const AUTH_STORAGE_KEY = 'pxht_session';
let inMemoryAuthUser = null;

/**
 * Retrieves the stored user profile from localStorage or in-memory fallback
 */
export function getStoredUser() {
  if (typeof localStorage !== 'undefined') {
    try {
      const val = localStorage.getItem(AUTH_STORAGE_KEY);
      return val ? JSON.parse(val) : null;
    } catch {
      return null;
    }
  }
  return inMemoryAuthUser ? JSON.parse(JSON.stringify(inMemoryAuthUser)) : null;
}

/**
 * Saves or clears the user profile in storage (luôn loại bỏ trường nhạy cảm)
 */
export function setStoredUser(user) {
  let safe = null;
  if (user) {
    // eslint-disable-next-line no-unused-vars
    const { password, password_hash, salt, ...rest } = user;
    safe = rest;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      if (safe) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(safe));
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch {
      // Ignore localStorage errors (e.g. quota or sandbox)
    }
  }
  inMemoryAuthUser = safe ? JSON.parse(JSON.stringify(safe)) : null;
}

/**
 * Resolves role from user profile ('admin' | 'leader' | null)
 */
export function resolveUserRole(user) {
  if (!user) return null;
  if (user.role === 'admin') return 'admin';
  return 'leader';
}

/**
 * Resolves team object ({ id, name }) from user profile, or null for admin / no-team
 */
export function resolveUserTeam(user) {
  if (!user) return null;
  if (user.role === 'admin' && !user.teamId) return null;
  if (user.teamId) {
    return {
      id: user.teamId,
      name: user.teamName || `Tổ ${user.teamId}`
    };
  }
  return null;
}

/**
 * Validates username and password presence
 */
export function validateCredentials(username, password) {
  if (!username || !username.trim() || !password || !password.trim()) {
    return {
      valid: false,
      error: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu'
    };
  }
  return { valid: true };
}

/**
 * Chuyển tài khoản (an toàn) thành người dùng phiên làm việc
 */
export function toSessionUser(account, teams = [], extra = {}) {
  const team = account.team_id ? teams.find((t) => t.id === account.team_id) : null;
  return {
    id: account.id,
    username: account.username,
    name: account.full_name,
    full_name: account.full_name,
    role: account.role,
    teamId: account.team_id || null,
    teamName: team ? team.name : account.team_id ? null : null,
    defaultPassword: false,
    ...extra
  };
}

function buildSession(user) {
  return {
    user,
    role: resolveUserRole(user),
    currentTeam: resolveUserTeam(user)
  };
}

async function loadTeamsSafe() {
  try {
    const { getTeams } = await import('../lib/supabase.js');
    return await getTeams();
  } catch {
    return [];
  }
}

/**
 * Đăng nhập bằng tên đăng nhập + mật khẩu
 */
export async function loginLogic(username, password) {
  const validation = validateCredentials(username, password);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    const { authenticateAccount } = await import('../lib/supabase.js');
    const account = await authenticateAccount(username, password);
    if (!account) {
      return { success: false, error: 'Tên đăng nhập hoặc mật khẩu không chính xác' };
    }
    const teams = account.team_id ? await loadTeamsSafe() : [];
    const user = toSessionUser(account, teams, {
      defaultPassword: account.role === 'admin' && isDefaultCredentials(username, password)
    });
    setStoredUser(user);
    return { success: true, ...buildSession(user) };
  } catch (err) {
    return { success: false, error: err?.message || 'Không thể kết nối máy chủ' };
  }
}

/**
 * Đổi mật khẩu của chính người dùng đang đăng nhập
 */
export async function changePasswordLogic(user, oldPassword, newPassword) {
  if (!user) return { success: false, error: 'Chưa đăng nhập' };
  try {
    const { changeAccountPassword } = await import('../lib/supabase.js');
    await changeAccountPassword(user.username, oldPassword, newPassword);
    const updated = { ...user, defaultPassword: false };
    setStoredUser(updated);
    return { success: true, user: updated };
  } catch (err) {
    return { success: false, error: err?.message || 'Không thể đổi mật khẩu' };
  }
}

/**
 * Load initial session from storage (không tự động đăng nhập)
 */
export function loadAuthSession() {
  const user = getStoredUser();
  return {
    currentUser: user,
    role: resolveUserRole(user),
    currentTeam: resolveUserTeam(user)
  };
}

/**
 * Save auth session
 */
export function saveAuthSession(user) {
  setStoredUser(user);
  return {
    currentUser: user,
    role: resolveUserRole(user),
    currentTeam: resolveUserTeam(user)
  };
}

/**
 * Clear auth session (logout)
 */
export function clearAuthSession() {
  setStoredUser(null);
  return {
    currentUser: null,
    role: null,
    currentTeam: null
  };
}
