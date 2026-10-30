import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  DEMO_TEAM_MAP,
  resolveUserRole,
  resolveUserTeam,
  loginLogic,
  changePasswordLogic,
  loadAuthSession,
  clearAuthSession
} from './authLogic.js';

export { DEMO_TEAM_MAP, resolveUserRole, resolveUserTeam };

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [role, setRole] = useState(null);
  const [currentTeam, setCurrentTeam] = useState(null);
  const [loading, setLoading] = useState(true);

  // Khôi phục phiên đã lưu (pxht_session); không có phiên -> hiển thị màn hình đăng nhập
  useEffect(() => {
    try {
      const session = loadAuthSession();
      setCurrentUser(session.currentUser);
      setRole(session.role);
      setCurrentTeam(session.currentTeam);
    } catch (err) {
      console.error('Failed to initialize auth session:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Đăng nhập bằng tên đăng nhập & mật khẩu
   */
  const login = useCallback(async (username, password) => {
    const result = await loginLogic(username, password);
    if (result.success) {
      setCurrentUser(result.user);
      setRole(result.role);
      setCurrentTeam(result.currentTeam);
      return { success: true, user: result.user };
    }
    return { success: false, error: result.error };
  }, []);

  /**
   * Đăng xuất hệ thống
   */
  const logout = useCallback(async () => {
    clearAuthSession();
    setCurrentUser(null);
    setRole(null);
    setCurrentTeam(null);
    return { success: true };
  }, []);

  /**
   * Đổi mật khẩu của chính mình
   */
  const changeMyPassword = useCallback(
    async (oldPassword, newPassword) => {
      const result = await changePasswordLogic(currentUser, oldPassword, newPassword);
      if (result.success) {
        setCurrentUser(result.user);
      }
      return result;
    },
    [currentUser]
  );

  const value = {
    currentUser,
    role,
    currentTeam,
    loading,
    login,
    logout,
    changeMyPassword
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
