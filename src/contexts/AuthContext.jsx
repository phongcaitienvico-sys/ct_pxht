import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  DEMO_PROFILES,
  DEMO_TEAM_MAP,
  resolveUserRole,
  resolveUserTeam,
  switchDemoRoleLogic,
  loginLogic,
  loadAuthSession,
  saveAuthSession,
  clearAuthSession
} from './authLogic.js';

export { DEMO_PROFILES, DEMO_TEAM_MAP, resolveUserRole, resolveUserTeam };

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [role, setRole] = useState(null);
  const [currentTeam, setCurrentTeam] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize session from storage / demo defaults
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        const session = loadAuthSession();
        if (isMounted) {
          setCurrentUser(session.currentUser);
          setRole(session.role);
          setCurrentTeam(session.currentTeam);
        }
      } catch (err) {
        console.error('Failed to initialize auth session:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Đăng nhập với email & mật khẩu (hỗ trợ cả demo và Supabase Auth)
   */
  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const result = await loginLogic(email, password);
      if (result.success) {
        setCurrentUser(result.user);
        setRole(result.role);
        setCurrentTeam(result.currentTeam);
        return { success: true, user: result.user };
      }
      return { success: false, error: result.error };
    } catch (err) {
      return { success: false, error: err.message || 'Lỗi khi đăng nhập' };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Đăng xuất hệ thống
   */
  const logout = useCallback(async () => {
    setLoading(true);
    try {
      try {
        const { isDemoMode, supabase } = await import('../lib/supabase.js');
        if (!isDemoMode()) {
          await supabase.auth.signOut();
        }
      } catch {
        // Ignore supabase signout error in demo mode
      }
      clearAuthSession();
      setCurrentUser(null);
      setRole(null);
      setCurrentTeam(null);
      return { success: true };
    } catch (err) {
      console.error('Logout error:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Chuyển đổi nhanh vai trò Demo ('admin' | 'leader1' | 'leader2')
   */
  const switchDemoRole = useCallback((key) => {
    try {
      const result = switchDemoRoleLogic(key);
      setCurrentUser(result.user);
      setRole(result.role);
      setCurrentTeam(result.currentTeam);
      return result.user;
    } catch (err) {
      console.error('switchDemoRole error:', err);
      throw err;
    }
  }, []);

  const value = {
    currentUser,
    role,
    currentTeam,
    loading,
    login,
    logout,
    switchDemoRole,
    DEMO_PROFILES
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook tiện ích để các component truy cập AuthContext
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
