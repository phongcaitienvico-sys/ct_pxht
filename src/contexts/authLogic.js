/**
 * Auth Logic & Session Helpers
 * Core logic for role resolution, demo profiles, credentials validation, and session persistence.
 */

// Demo profiles as specified in architecture specs
export const DEMO_PROFILES = {
  admin: {
    id: 'admin-1',
    email: 'quandoc@pxht.vn',
    role: 'admin',
    name: 'Quản Đốc Phân Xưởng'
  },
  leader1: {
    id: 'leader-1',
    email: 'totruong1@pxht.vn',
    role: 'leader',
    name: 'Tổ Trưởng 1 (Nguyễn Văn A)',
    teamId: 'team-1',
    teamName: 'Tổ 1 - Cơ khí & Đúc'
  },
  leader2: {
    id: 'leader-2',
    email: 'totruong2@pxht.vn',
    role: 'leader',
    name: 'Tổ Trưởng 2 (Lê Văn B)',
    teamId: 'team-2',
    teamName: 'Tổ 2 - Gia công & Lắp ráp'
  }
};

// Map demo role team identifiers to database seed team UUIDs
export const DEMO_TEAM_MAP = {
  'team-1': 'a0000000-0000-0000-0000-000000000001',
  'team-2': 'a0000000-0000-0000-0000-000000000002'
};

export function resolveEffectiveTeamId(teamId) {
  if (!teamId) return null;
  return DEMO_TEAM_MAP[teamId] || teamId;
}

const AUTH_STORAGE_KEY = 'pxht_auth_user';
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
 * Saves or clears the user profile in storage
 */
export function setStoredUser(user) {
  if (typeof localStorage !== 'undefined') {
    try {
      if (user) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch {
      // Ignore localStorage errors (e.g. quota or sandbox)
    }
  }
  inMemoryAuthUser = user ? JSON.parse(JSON.stringify(user)) : null;
}

/**
 * Resolves role from user profile ('admin' | 'leader' | null)
 */
export function resolveUserRole(user) {
  if (!user) return null;
  if (user.role === 'admin') return 'admin';
  if (user.role === 'leader') return 'leader';
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
 * Switch demo profile logic by key ('admin' | 'leader1' | 'leader2')
 */
export function switchDemoRoleLogic(key) {
  const profile = DEMO_PROFILES[key];
  if (!profile) {
    throw new Error(
      `Invalid demo role key: "${key}". Must be one of: 'admin', 'leader1', 'leader2'.`
    );
  }

  const role = resolveUserRole(profile);
  const currentTeam = resolveUserTeam(profile);
  setStoredUser(profile);

  return {
    user: { ...profile },
    role,
    currentTeam
  };
}

/**
 * Validates email and password format
 */
export function validateCredentials(email, password) {
  if (!email || !email.trim() || !password || !password.trim()) {
    return {
      valid: false,
      error: 'Vui lòng nhập đầy đủ email và mật khẩu'
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return {
      valid: false,
      error: 'Định dạng email không hợp lệ'
    };
  }

  return { valid: true };
}

/**
 * Login logic supporting both Demo profiles and Supabase Auth
 */
export async function loginLogic(email, password) {
  const validation = validateCredentials(email, password);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error
    };
  }

  const cleanEmail = email.trim().toLowerCase();

  // 1. Check demo profiles first
  const matchedDemo = Object.values(DEMO_PROFILES).find(
    (p) => p.email.toLowerCase() === cleanEmail
  );

  if (matchedDemo) {
    const user = { ...matchedDemo };
    setStoredUser(user);
    return {
      success: true,
      user,
      role: resolveUserRole(user),
      currentTeam: resolveUserTeam(user)
    };
  }

  // 2. Fallback to Supabase Auth if not in demo mode
  try {
    const { isDemoMode, supabase } = await import('../lib/supabase.js');
    if (!isDemoMode()) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
      });

      if (error) {
        return {
          success: false,
          error: error.message || 'Đăng nhập không thành công'
        };
      }

      const authUser = data.user;
      const role = authUser?.user_metadata?.role || 'leader';
      const user = {
        id: authUser.id,
        email: authUser.email,
        role,
        name: authUser.user_metadata?.name || authUser.email,
        teamId: authUser.user_metadata?.teamId || null,
        teamName: authUser.user_metadata?.teamName || null
      };

      setStoredUser(user);
      return {
        success: true,
        user,
        role: resolveUserRole(user),
        currentTeam: resolveUserTeam(user)
      };
    }
  } catch {
    // If supabase import or connection fails, proceed to default fail response
  }

  return {
    success: false,
    error: 'Tài khoản hoặc mật khẩu không chính xác'
  };
}

/**
 * Load initial session from storage; defaults to DEMO_PROFILES.admin in demo mode
 */
export function loadAuthSession() {
  let user = getStoredUser();
  if (!user) {
    user = DEMO_PROFILES.admin;
    setStoredUser(user);
  }

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
