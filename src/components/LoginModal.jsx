import React, { useState } from 'react';
import { ShieldCheck, Monitor, Smartphone, X, Lock, Mail, AlertCircle, LogIn, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function LoginModal({ isOpen = true, onClose }) {
  const { currentUser, role, login, switchDemoRole, DEMO_PROFILES } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleQuickLogin = (key) => {
    setError('');
    try {
      switchDemoRole(key);
      if (onClose) onClose();
    } catch (err) {
      setError(err.message || 'Không thể chuyển đổi vai trò');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const res = await login(email, password);
      if (res.success) {
        setEmail('');
        setPassword('');
        if (onClose) onClose();
      } else {
        setError(res.error || 'Đăng nhập không thành công');
      }
    } catch (err) {
      setError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-headline"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white px-6 py-5 flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md border border-white/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 id="modal-headline" className="text-lg font-bold tracking-tight">
                Đăng Nhập Phiên Làm Việc
              </h2>
              <p className="text-xs text-blue-100 font-medium mt-0.5">
                Nhật Ký Sản Xuất - Phân Xưởng Hàn Tàu
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-6 space-y-6 max-h-[85vh] overflow-y-auto">
          {/* Section: Đăng nhập nhanh 1 chạm */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                ⚡ Đăng Nhập Nhanh 1 Chạm (Demo)
              </span>
              <span className="text-[11px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-semibold border border-blue-200">
                Khảo sát tiện lợi
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {/* Button: Quản Đốc (PC) */}
              <button
                type="button"
                onClick={() => handleQuickLogin('admin')}
                className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                  currentUser?.email === DEMO_PROFILES.admin.email
                    ? 'border-blue-600 bg-blue-50/70 shadow-sm'
                    : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm">
                    <Monitor className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                      🖥️ Quản Đốc (PC)
                      {currentUser?.email === DEMO_PROFILES.admin.email && (
                        <span className="inline-flex items-center text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded font-medium">
                          Đang chọn
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                      quandoc@pxht.vn • Toàn quyền quản trị & báo cáo
                    </div>
                  </div>
                </div>
                {currentUser?.email === DEMO_PROFILES.admin.email && (
                  <Check className="w-4 h-4 text-blue-600 mr-1" />
                )}
              </button>

              {/* Button: Tổ Trưởng 1 */}
              <button
                type="button"
                onClick={() => handleQuickLogin('leader1')}
                className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                  currentUser?.email === DEMO_PROFILES.leader1.email
                    ? 'border-emerald-600 bg-emerald-50/70 shadow-sm'
                    : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                      📱 Tổ Trưởng 1
                      {currentUser?.email === DEMO_PROFILES.leader1.email && (
                        <span className="inline-flex items-center text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-medium">
                          Đang chọn
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                      totruong1@pxht.vn • Tổ 1 - Cơ khí & Đúc
                    </div>
                  </div>
                </div>
                {currentUser?.email === DEMO_PROFILES.leader1.email && (
                  <Check className="w-4 h-4 text-emerald-600 mr-1" />
                )}
              </button>

              {/* Button: Tổ Trưởng 2 */}
              <button
                type="button"
                onClick={() => handleQuickLogin('leader2')}
                className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                  currentUser?.email === DEMO_PROFILES.leader2.email
                    ? 'border-amber-600 bg-amber-50/70 shadow-sm'
                    : 'border-slate-200 hover:border-amber-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-600 text-white flex items-center justify-center shadow-sm">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                      📱 Tổ Trưởng 2
                      {currentUser?.email === DEMO_PROFILES.leader2.email && (
                        <span className="inline-flex items-center text-[10px] bg-amber-600 text-white px-1.5 py-0.2 rounded font-medium">
                          Đang chọn
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                      totruong2@pxht.vn • Tổ 2 - Gia công & Lắp ráp
                    </div>
                  </div>
                </div>
                {currentUser?.email === DEMO_PROFILES.leader2.email && (
                  <Check className="w-4 h-4 text-amber-600 mr-1" />
                )}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
              Hoặc đăng nhập bằng tài khoản
            </span>
          </div>

          {/* Error notice */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Credentials Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email làm việc
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="quandoc@pxht.vn"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Mật khẩu
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              <span>{isSubmitting ? 'Đang xác thực...' : 'Đăng nhập vào hệ thống'}</span>
            </button>
          </form>
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Phiên bản v0.1.0 • Phân Xưởng Hàn Tàu</span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-slate-600 hover:text-slate-900 font-medium"
            >
              Đóng lại
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
