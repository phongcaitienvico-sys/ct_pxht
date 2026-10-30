import React, { useState } from 'react';
import { X, KeyRound, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { validatePassword } from './admin/accountManagerLogic.js';

/**
 * Hộp thoại "Đổi mật khẩu của tôi" cho mọi người dùng đã đăng nhập.
 */
export default function ChangePasswordModal({ isOpen, onClose }) {
  const { changeMyPassword } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const close = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirm('');
    setError('');
    setDone(false);
    onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const pwError = validatePassword(newPassword);
    if (pwError) return setError(pwError);
    if (newPassword !== confirm) return setError('Mật khẩu xác nhận không khớp');
    if (newPassword === oldPassword) return setError('Mật khẩu mới phải khác mật khẩu hiện tại');
    setBusy(true);
    const res = await changeMyPassword(oldPassword, newPassword);
    setBusy(false);
    if (res.success) setDone(true);
    else setError(res.error || 'Không thể đổi mật khẩu');
  };

  const inputCls =
    'w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-slate-900';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200" role="dialog" aria-modal="true">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <KeyRound className="w-4 h-4 text-blue-600" />
            Đổi mật khẩu của tôi
          </h2>
          <button type="button" onClick={close} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg" aria-label="Đóng">
            <X className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <CheckCircle2 className="w-4 h-4" /> Đã đổi mật khẩu thành công.
            </div>
            <button type="button" onClick={close} className="w-full py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl">
              Đóng
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-5 space-y-3">
            {error && (
              <div role="alert" className="flex items-start gap-2 p-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mật khẩu hiện tại</label>
              <input type={show ? 'text' : 'password'} autoComplete="current-password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mật khẩu mới (tối thiểu 6 ký tự)</label>
              <input type={show ? 'text' : 'password'} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nhập lại mật khẩu mới</label>
              <input type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
            </div>
            <button type="button" onClick={() => setShow((v) => !v)} className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800">
              {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            </button>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={close} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl">
                Hủy bỏ
              </button>
              <button type="submit" disabled={busy} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-xl">
                {busy ? 'Đang lưu...' : 'Đổi mật khẩu'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
