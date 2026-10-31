import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Search,
  Pencil,
  KeyRound,
  Trash2,
  Lock,
  Unlock,
  X,
  AlertCircle,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import {
  isDemoMode,
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount
} from '../../lib/supabase.js';
import {
  MIN_PASSWORD_LENGTH,
  validateNewAccount,
  validateAccountUpdate,
  validatePassword,
  canDeleteAccount,
  canToggleActive,
  filterAccounts
} from './accountManagerLogic.js';

const inputCls =
  'w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-slate-900 disabled:bg-slate-50 disabled:text-slate-500';
const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-xl transition-colors';
const btnGhost =
  'inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors';

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg" aria-label="Đóng">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
    </div>
  );
}

const roleLabel = (role) => (role === 'admin' ? 'Quản trị' : 'Người nhập liệu');

function RoleBadge({ role }) {
  return role === 'admin' ? (
    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
      {roleLabel(role)}
    </span>
  ) : (
    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
      {roleLabel(role)}
    </span>
  );
}

export default function AccountManager() {
  const { currentUser } = useAuth();
  const demo = isDemoMode();

  // Mật khẩu quản trị chỉ giữ trong bộ nhớ component (chế độ Supabase)
  const [adminPassword, setAdminPassword] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null); // {type, account?}
  const [busy, setBusy] = useState(false);

  const admin = useMemo(
    () => (demo ? undefined : { username: currentUser?.username, password: adminPassword }),
    [demo, currentUser, adminPassword]
  );
  const needsAdminPassword = !demo && !adminPassword;

  const notify = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const reload = useCallback(
    async (creds = admin) => {
      setLoading(true);
      try {
        const accs = await getAccounts(creds);
        setAccounts(accs);
        return true;
      } catch (err) {
        notify('error', err.message || 'Không tải được dữ liệu');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [admin]
  );

  useEffect(() => {
    if (needsAdminPassword) {
      setLoading(false);
      return;
    }
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsAdminPassword]);

  const run = async (fn, successText) => {
    setBusy(true);
    try {
      await fn();
      notify('success', successText);
      setModal(null);
      await reload();
    } catch (err) {
      notify('error', err.message || 'Có lỗi xảy ra');
      if (!demo && /mật khẩu|quyền/i.test(err.message || '')) setAdminPassword(null);
    } finally {
      setBusy(false);
    }
  };

  const visible = useMemo(() => filterAccounts(accounts, search), [accounts, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            Quản lý tài khoản
          </h2>
          <p className="text-sm text-slate-500">Tạo tài khoản quản trị / người nhập liệu, đặt lại mật khẩu, khóa hoặc xóa tài khoản.</p>
        </div>
        <button type="button" className={btnPrimary} onClick={() => setModal({ type: 'create' })} disabled={needsAdminPassword}>
          <Plus className="w-4 h-4" /> Thêm tài khoản
        </button>
      </div>

      {toast && (
        <div
          role="status"
          className={`flex items-center gap-2 p-3 text-sm rounded-xl border ${
            toast.type === 'success'
              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
              : 'text-rose-700 bg-rose-50 border-rose-200'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.text}
        </div>
      )}

      {needsAdminPassword && (
        <AdminPasswordPrompt
          username={currentUser?.username}
          onConfirm={async (pw) => {
            const creds = { username: currentUser.username, password: pw };
            try {
              const accs = await getAccounts(creds);
              setAccounts(accs);
              setAdminPassword(pw);
              return null;
            } catch (err) {
              return err.message || 'Mật khẩu không đúng';
            }
          }}
        />
      )}

      {!needsAdminPassword && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-4 border-b border-slate-100">
            <div className="relative max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên đăng nhập hoặc họ tên..."
                className={`${inputCls} pl-9`}
              />
            </div>
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                  <th className="py-3 px-4">Tên đăng nhập</th>
                  <th className="py-3 px-4">Họ tên</th>
                  <th className="py-3 px-4">Vai trò</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">Đang tải...</td>
                  </tr>
                )}
                {!loading && visible.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">Không có tài khoản nào.</td>
                  </tr>
                )}
                {!loading &&
                  visible.map((acc) => {
                    const isSelf = String(acc.id) === String(currentUser?.id);
                    const active = acc.is_active !== false;
                    return (
                      <tr key={acc.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-800">
                          {acc.username}
                          {isSelf && <span className="ml-2 text-[10px] font-sans font-semibold text-blue-600">(Bạn)</span>}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">{acc.full_name}</td>
                        <td className="py-3 px-4"><RoleBadge role={acc.role} /></td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                              active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {active ? 'Hoạt động' : 'Đã khóa'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-0.5">
                            <button type="button" title="Sửa thông tin" className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg" onClick={() => setModal({ type: 'edit', account: acc })}>
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button type="button" title="Đặt lại mật khẩu" className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg" onClick={() => setModal({ type: 'password', account: acc })}>
                              <KeyRound className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              title={active ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                              onClick={() => {
                                const check = canToggleActive(accounts, acc, currentUser);
                                if (!check.ok) return notify('error', check.reason);
                                run(() => updateAccount(acc.id, { is_active: !active }, admin), active ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản');
                              }}
                            >
                              {active ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            </button>
                            <button
                              type="button"
                              title="Xóa tài khoản"
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                              onClick={() => {
                                const check = canDeleteAccount(accounts, acc, currentUser);
                                if (!check.ok) return notify('error', check.reason);
                                setModal({ type: 'delete', account: acc });
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Mobile Account Cards (< md) */}
          <div className="md:hidden divide-y divide-slate-100 p-2.5 space-y-2.5">
            {loading && <div className="py-6 text-center text-slate-500 text-sm">Đang tải...</div>}
            {!loading && visible.length === 0 && (
              <div className="py-6 text-center text-slate-500 text-sm">Không có tài khoản nào.</div>
            )}
            {!loading &&
              visible.map((acc) => {
                const isSelf = String(acc.id) === String(currentUser?.id);
                const active = acc.is_active !== false;

                return (
                  <div key={acc.id} className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-900">
                          <span>{acc.username}</span>
                          {isSelf && <span className="text-[10px] font-sans font-semibold text-blue-600">(Bạn)</span>}
                        </div>
                        <div className="text-sm font-semibold text-slate-800 mt-0.5">{acc.full_name}</div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <RoleBadge role={acc.role} />
                        </div>
                      </div>

                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                          active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {active ? 'Hoạt động' : 'Đã khóa'}
                      </span>
                    </div>

                    <div className="flex items-center justify-end gap-1 mt-3 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        title="Sửa thông tin"
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg"
                        onClick={() => setModal({ type: 'edit', account: acc })}
                      >
                        <Pencil className="w-3.5 h-3.5 text-blue-600" />
                        Sửa
                      </button>
                      <button
                        type="button"
                        title="Đặt lại mật khẩu"
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg"
                        onClick={() => setModal({ type: 'password', account: acc })}
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        Đổi MK
                      </button>
                      <button
                        type="button"
                        title={active ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                        onClick={() => {
                          const check = canToggleActive(accounts, acc, currentUser);
                          if (!check.ok) return notify('error', check.reason);
                          run(() => updateAccount(acc.id, { is_active: !active }, admin), active ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản');
                        }}
                      >
                        {active ? <Lock className="w-4 h-4 text-slate-500" /> : <Unlock className="w-4 h-4 text-emerald-600" />}
                      </button>
                      <button
                        type="button"
                        title="Xóa tài khoản"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                        onClick={() => {
                          const check = canDeleteAccount(accounts, acc, currentUser);
                          if (!check.ok) return notify('error', check.reason);
                          setModal({ type: 'delete', account: acc });
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {modal?.type === 'create' && (
        <AccountFormModal
          accounts={accounts}
          busy={busy}
          onClose={() => setModal(null)}
          onSubmit={(data) => run(() => createAccount(data, admin), 'Đã tạo tài khoản')}
        />
      )}
      {modal?.type === 'edit' && (
        <AccountFormModal
          account={modal.account}
          accounts={accounts}
          busy={busy}
          onClose={() => setModal(null)}
          onSubmit={(data) => run(() => updateAccount(modal.account.id, data, admin), 'Đã cập nhật tài khoản')}
        />
      )}
      {modal?.type === 'password' && (
        <ResetPasswordModal
          account={modal.account}
          busy={busy}
          onClose={() => setModal(null)}
          onSubmit={(pw) => run(() => updateAccount(modal.account.id, { password: pw }, admin), 'Đã đặt lại mật khẩu')}
        />
      )}
      {modal?.type === 'delete' && (
        <Modal title="Xóa tài khoản" onClose={() => setModal(null)}>
          <p className="text-sm text-slate-700">
            Bạn có chắc muốn xóa tài khoản <b>{modal.account.username}</b> ({modal.account.full_name})? Thao tác này không thể hoàn tác.
          </p>
          <div className="flex justify-end gap-2 pt-5">
            <button type="button" className={btnGhost} onClick={() => setModal(null)}>Hủy bỏ</button>
            <button
              type="button"
              disabled={busy}
              className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-60 rounded-xl"
              onClick={() => run(() => deleteAccount(modal.account.id, admin), 'Đã xóa tài khoản')}
            >
              Xóa
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AdminPasswordPrompt({ username, onConfirm }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Nhập lại mật khẩu quản trị để xác nhận" onClose={() => {}}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const err = await onConfirm(pw);
          setBusy(false);
          if (err) setError(err);
        }}
        className="space-y-3"
      >
        <p className="text-sm text-slate-600">
          Để quản lý tài khoản, hãy xác nhận mật khẩu của <b>{username}</b>. Mật khẩu chỉ được giữ tạm trong bộ nhớ trang này.
        </p>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <input type="password" autoFocus autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} placeholder="Mật khẩu quản trị" />
        <div className="flex justify-end">
          <button type="submit" disabled={busy || !pw} className={btnPrimary}>Xác nhận</button>
        </div>
      </form>
    </Modal>
  );
}

function AccountFormModal({ account, accounts, busy, onClose, onSubmit }) {
  const isEdit = Boolean(account);
  const [form, setForm] = useState({
    username: account?.username || '',
    full_name: account?.full_name || '',
    role: account?.role || 'leader',
    team_id: account?.team_id || '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    if (isEdit) {
      const v = validateAccountUpdate(form, account);
      setErrors(v.errors);
      if (v.valid) onSubmit(v.sanitized);
    } else {
      const v = validateNewAccount(form, accounts);
      setErrors(v.errors);
      if (v.valid) onSubmit(v.sanitized);
    }
  };

  return (
    <Modal title={isEdit ? `Sửa tài khoản: ${account.username}` : 'Thêm tài khoản'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Tên đăng nhập" error={errors.username}>
          <input className={inputCls} value={form.username} disabled={isEdit} onChange={(e) => set('username', e.target.value)} autoCapitalize="none" placeholder="Ví dụ: totruong1" />
        </Field>
        <Field label="Họ tên" error={errors.full_name}>
          <input className={inputCls} value={form.full_name} onChange={(e) => set('full_name', e.target.value)} placeholder="Ví dụ: Nguyễn Văn A" />
        </Field>
        <Field label="Vai trò" error={errors.role}>
          <select className={inputCls} value={form.role} disabled={isEdit} onChange={(e) => set('role', e.target.value)}>
            <option value="leader">Người nhập liệu</option>
            <option value="admin">Quản trị</option>
          </select>
        </Field>
        <Field label={isEdit ? `Mật khẩu mới (bỏ trống nếu không đổi)` : `Mật khẩu (tối thiểu ${MIN_PASSWORD_LENGTH} ký tự)`} error={errors.password}>
          <input type="password" autoComplete="new-password" className={inputCls} value={form.password} onChange={(e) => set('password', e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={btnGhost} onClick={onClose}>Hủy bỏ</button>
          <button type="submit" disabled={busy} className={btnPrimary}>{isEdit ? 'Lưu thay đổi' : 'Tạo tài khoản'}</button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ account, busy, onClose, onSubmit }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  return (
    <Modal title={`Đặt lại mật khẩu: ${account.username}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const err = validatePassword(pw);
          setError(err || '');
          if (!err) onSubmit(pw);
        }}
        className="space-y-3"
      >
        <Field label={`Mật khẩu mới (tối thiểu ${MIN_PASSWORD_LENGTH} ký tự)`} error={error}>
          <input type="text" autoComplete="off" className={inputCls} value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        <p className="text-xs text-slate-500">Hãy thông báo mật khẩu mới cho người dùng và nhắc họ đổi lại sau khi đăng nhập.</p>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={btnGhost} onClick={onClose}>Hủy bỏ</button>
          <button type="submit" disabled={busy} className={btnPrimary}>Đặt lại mật khẩu</button>
        </div>
      </form>
    </Modal>
  );
}
