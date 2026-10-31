import React, { useState } from 'react';
import { Factory, Lock, User, Eye, EyeOff, AlertCircle, LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';

/**
 * Màn hình đăng nhập toàn trang (giao diện sáng). Dùng khi chưa có phiên đăng nhập.
 */
export default function LoginModal() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const res = await login(username, password);
      if (!res.success) {
        setError(res.error || 'Đăng nhập không thành công');
        setPassword('');
      }
    } catch (err) {
      setError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
            <Factory className="w-7 h-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">PXHT</h1>
          <p className="text-sm text-slate-500">Phân Xưởng Hoàn Thiện</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4"
        >
          <div>
            <h2 className="text-base font-semibold text-slate-900">Đăng nhập hệ thống</h2>
            <p className="text-xs text-slate-500 mt-0.5">Nhập tên đăng nhập và mật khẩu được cấp.</p>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 p-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="login-username" className="block text-xs font-semibold text-slate-700 mb-1">
              Tên đăng nhập
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ví dụ: admin"
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-slate-900"
              />
            </div>
          </div>

          <div>
            <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 mb-1">
              Mật khẩu
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                className="w-full pl-9 pr-10 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-slate-900"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-xl transition-colors shadow-sm"
          >
            <LogIn className="w-4 h-4" />
            {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>

          {/* Hộp gợi ý tài khoản mẫu dùng thử */}
          <div className="pt-2 border-t border-slate-100">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Tài khoản mẫu dùng thử:
            </p>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setUsername('admin');
                  setPassword('admin123');
                  setError('');
                }}
                className="p-2 text-left bg-slate-50 hover:bg-blue-50 hover:border-blue-200 border border-slate-200 rounded-lg transition-colors group"
              >
                <div className="font-semibold text-slate-800 group-hover:text-blue-700">🖥️ Quản Đốc (PC)</div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">admin / admin123</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setUsername('totruong1');
                  setPassword('123456');
                  setError('');
                }}
                className="p-2 text-left bg-slate-50 hover:bg-emerald-50 hover:border-emerald-200 border border-slate-200 rounded-lg transition-colors group"
              >
                <div className="font-semibold text-slate-800 group-hover:text-emerald-700">📱 Người nhập liệu (ĐT)</div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">totruong1 / 123456</div>
              </button>
            </div>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          PXHT • Phân Xưởng Hoàn Thiện • v0.1.0
        </p>
      </div>
    </div>
  );
}
