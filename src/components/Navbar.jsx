import React, { useState, useRef, useEffect } from 'react';
import {
  Factory,
  Layers,
  Activity,
  BarChart3,
  Users,
  KeyRound,
  PenLine,
  FileText,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Smartphone,
  Monitor
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { isDemoMode } from '../lib/supabase.js';

const ADMIN_TABS = [
  { id: 'products', label: 'Danh Mục Sản Phẩm', icon: Layers },
  { id: 'realtime', label: 'Giám Sát', icon: Activity },
  { id: 'reports', label: 'Báo Cáo', icon: BarChart3 },
  { id: 'employees', label: 'Nhân Viên', icon: Users },
  { id: 'accounts', label: 'Tài Khoản', icon: KeyRound }
];

const LEADER_TABS = [
  { id: 'entry', label: 'Nhập Sản Lượng', icon: PenLine },
  { id: 'logs', label: 'Lịch Sử Của Tổ', icon: FileText }
];

export function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Navbar({
  activeTab = 'realtime',
  setActiveTab = () => {},
  onChangePassword = () => {},
  isMobileFrame = false,
  onToggleMobileFrame = null
}) {
  const { currentUser, role, currentTeam, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const demoActive = isDemoMode();
  const tabs = role === 'admin' ? ADMIN_TABS : LEADER_TABS;
  const displayName = currentUser?.name || currentUser?.full_name || currentUser?.username || 'Người dùng';
  const roleText = role === 'admin' ? 'Quản trị' : currentTeam?.name || 'Tổ trưởng';

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const selectTab = (id) => {
    setActiveTab(id);
    setDrawerOpen(false);
  };

  const isLeader = role === 'leader';

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="h-16 px-4 lg:px-6 flex items-center justify-between gap-4">
          {/* Left: hamburger (admin, <lg) + brand */}
          <div className="flex items-center gap-2 shrink-0">
            {!isLeader && (
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                aria-label="Mở menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600 text-white">
              <Factory className="w-5 h-5" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-tight text-slate-900">PXHT</div>
              <div className="hidden sm:block text-[11px] text-slate-500 whitespace-nowrap">Phân Xưởng Hoàn Thiện</div>
            </div>
          </div>

          {/* Centre: underline tabs (lg+) */}
          <nav className="hidden lg:flex items-stretch h-16 gap-1" aria-label="Điều hướng chính">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => selectTab(tab.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative inline-flex items-center gap-2 px-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    active
                      ? 'text-blue-600 border-blue-600'
                      : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right: single user menu */}
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-2.5 pl-1.5 pr-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                {getInitials(displayName)}
              </span>
              <span className="hidden sm:block text-left leading-tight max-w-[180px]">
                <span className="block text-sm font-medium text-slate-900 truncate">{displayName}</span>
                <span className="block text-[11px] text-slate-500 truncate">{roleText}</span>
              </span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-64 bg-white rounded-xl border border-slate-200 shadow-lg py-1.5 z-50"
              >
                <div className="px-4 py-2.5 border-b border-slate-100">
                  <div className="text-sm font-semibold text-slate-900 truncate">{displayName}</div>
                  <div className="text-xs text-slate-500 truncate">
                    @{currentUser?.username} • {roleText}
                  </div>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onChangePassword();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <KeyRound className="w-4 h-4 text-slate-400" />
                  Đổi mật khẩu
                </button>
                {onToggleMobileFrame && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onToggleMobileFrame();
                    }}
                    className="hidden lg:flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    {isMobileFrame ? (
                      <Monitor className="w-4 h-4 text-slate-400" />
                    ) : (
                      <Smartphone className="w-4 h-4 text-slate-400" />
                    )}
                    {isMobileFrame ? 'Mở rộng toàn màn hình' : 'Mô phỏng màn hình điện thoại'}
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50"
                >
                  <LogOut className="w-4 h-4" />
                  Đăng xuất
                </button>
                <div
                  className="mt-1.5 px-4 pt-2 pb-1 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-500"
                  title={
                    demoActive
                      ? 'Dữ liệu đang lưu cục bộ trên trình duyệt này'
                      : 'Đang kết nối cơ sở dữ liệu Supabase'
                  }
                >
                  <span className={`w-2 h-2 rounded-full ${demoActive ? 'bg-slate-400' : 'bg-emerald-500'}`} />
                  {demoActive ? 'Chế độ thử nghiệm' : 'Trực tuyến'}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Admin drawer (<lg) */}
      {!isLeader && drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 max-w-[85%] bg-white shadow-xl flex flex-col">
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200">
              <div className="leading-tight">
                <div className="text-sm font-bold text-slate-900">PXHT</div>
                <div className="text-[11px] text-slate-500">Phân Xưởng Hoàn Thiện</div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                aria-label="Đóng menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-2" aria-label="Điều hướng">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => selectTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium ${
                      active ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Mobile bottom tab bar (<lg) for Admin (5 tabs) and Leader (2 tabs) */}
      <nav
        className={`lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 shadow-lg grid ${
          isLeader ? 'grid-cols-2' : 'grid-cols-5'
        }`}
        aria-label="Điều hướng"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectTab(tab.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 px-1 text-[10px] sm:text-[11px] font-medium transition-colors ${
                active ? 'text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'text-blue-600 stroke-[2.25]' : 'text-slate-400'}`} />
              <span className="truncate max-w-[65px] text-center leading-tight">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
