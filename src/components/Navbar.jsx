import React, { useState } from 'react';
import {
  Factory,
  Layers,
  Activity,
  BarChart3,
  Users,
  PenLine,
  FileText,
  ShieldCheck,
  Smartphone,
  Monitor,
  LogIn,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Database,
  Radio
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { isDemoMode } from '../lib/supabase.js';

export default function Navbar({
  activeTab = 'realtime',
  setActiveTab = () => {},
  onOpenLogin = () => {}
}) {
  const { currentUser, role, currentTeam, logout, switchDemoRole, DEMO_PROFILES } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [demoDropdownOpen, setDemoDropdownOpen] = useState(false);

  const demoActive = isDemoMode();

  // Danh sách Tab theo từng vai trò
  const adminTabs = [
    { id: 'products', label: 'Danh Mục Sản Phẩm', shortLabel: 'Sản Phẩm', icon: Layers },
    { id: 'realtime', label: 'Giám Sát Realtime', shortLabel: 'Realtime', icon: Activity },
    { id: 'reports', label: 'Báo Cáo Thống Kê', shortLabel: 'Báo Cáo', icon: BarChart3 },
    { id: 'employees', label: 'Quản Lý Nhân Viên', shortLabel: 'Nhân Viên', icon: Users }
  ];

  const leaderTabs = [
    { id: 'entry', label: 'Nhập Sản Lượng', shortLabel: 'Nhập Liệu', icon: PenLine },
    { id: 'logs', label: 'Lịch Sử Của Tổ', shortLabel: 'Nhật Ký', icon: FileText }
  ];

  const currentTabs = role === 'admin' ? adminTabs : leaderTabs;

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  const handleSwitchRole = (key) => {
    try {
      switchDemoRole(key);
      setDemoDropdownOpen(false);
      setMobileMenuOpen(false);
      // Auto-switch to default tab for new role
      if (key === 'admin') {
        setActiveTab('realtime');
      } else {
        setActiveTab('entry');
      }
    } catch (err) {
      console.error('Error switching demo role:', err);
    }
  };

  const getRoleBadge = () => {
    if (role === 'admin') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
          <Monitor className="w-3 h-3" />
          Quản Đốc (PC)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
        <Smartphone className="w-3 h-3" />
        {currentTeam?.name ? currentTeam.name.split('-')[0].trim() : 'Tổ Trưởng'}
      </span>
    );
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Brand Identity & Mode Badge */}
          <div className="flex items-center space-x-3.5">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <Factory className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 tracking-tight text-base sm:text-lg">
                  PXHT
                </span>
                <span className="text-slate-300 font-light hidden sm:inline">|</span>
                <span className="text-sm font-semibold text-slate-700 hidden sm:inline">
                  Quản Lý Sản Lượng
                </span>
                {/* Data status badge */}
                <div className="hidden md:inline-flex items-center">
                  {demoActive ? (
                    <span
                      title="Hệ thống đang hoạt động với dữ liệu Demo offline (Local Memory)"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                      Demo Mode
                    </span>
                  ) : (
                    <span
                      title="Kết nối trực tiếp Supabase Cloud PostgreSQL"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                    >
                      <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
                      Supabase Live
                    </span>
                  )}
                </div>
              </div>
              <div className="text-[11px] text-slate-500 font-medium leading-none mt-0.5">
                Phân Xưởng Hàn Tàu
              </div>
            </div>
          </div>

          {/* Center: Desktop Navigation Tabs */}
          <nav className="hidden lg:flex items-center space-x-1">
            {currentTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 shadow-xs border border-blue-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right: Quick Demo Role Switch & User Profile */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Quick Demo Switcher (Desktop) */}
            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => setDemoDropdownOpen(!demoDropdownOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors"
                title="Chuyển đổi nhanh vai trò để trải nghiệm"
              >
                <span>⚡ Chuyển Vai Trò</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>

              {demoDropdownOpen && (
                <div
                  className="absolute right-0 mt-1.5 w-60 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 z-50 animate-fadeIn"
                  onMouseLeave={() => setDemoDropdownOpen(false)}
                >
                  <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Chuyển tài khoản Demo
                  </div>
                  <button
                    onClick={() => handleSwitchRole('admin')}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors ${
                      currentUser?.email === DEMO_PROFILES.admin.email
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-blue-600" />
                      Quản Đốc (PC)
                    </span>
                    {currentUser?.email === DEMO_PROFILES.admin.email && (
                      <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold">
                        Đang dùng
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => handleSwitchRole('leader1')}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors ${
                      currentUser?.email === DEMO_PROFILES.leader1.email
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-emerald-600" />
                      Tổ Trưởng 1 (Cơ khí)
                    </span>
                    {currentUser?.email === DEMO_PROFILES.leader1.email && (
                      <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold">
                        Đang dùng
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => handleSwitchRole('leader2')}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors ${
                      currentUser?.email === DEMO_PROFILES.leader2.email
                        ? 'bg-amber-50 text-amber-700'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-amber-600" />
                      Tổ Trưởng 2 (Lắp ráp)
                    </span>
                    {currentUser?.email === DEMO_PROFILES.leader2.email && (
                      <span className="text-[10px] bg-amber-600 text-white px-1.5 py-0.5 rounded font-bold">
                        Đang dùng
                      </span>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* User Profile Info */}
            <div className="flex items-center space-x-2 pl-1 border-l border-slate-200">
              <div className="hidden sm:flex flex-col items-end text-right">
                <span className="text-xs font-bold text-slate-800 leading-tight">
                  {currentUser?.name || 'Người dùng'}
                </span>
                <div className="mt-0.5">{getRoleBadge()}</div>
              </div>

              {/* Login / Switch Account Modal Trigger */}
              <button
                type="button"
                onClick={onOpenLogin}
                className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                title="Đăng nhập / Đổi tài khoản"
              >
                <LogIn className="w-4 h-4" />
              </button>

              {/* Logout Button */}
              {currentUser && (
                <button
                  type="button"
                  onClick={logout}
                  className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                  title="Đăng xuất"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Mobile Hamburger Toggle */}
            <div className="lg:hidden flex items-center">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl focus:outline-none"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-4 space-y-3 shadow-lg">
          {/* User info on mobile */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <div className="text-xs font-bold text-slate-800">
                {currentUser?.name || 'Người dùng'}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                {currentUser?.email || ''}
              </div>
            </div>
            <div>{getRoleBadge()}</div>
          </div>

          {/* Navigation Links */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1">
              Chức Năng {role === 'admin' ? 'Quản Đốc' : 'Tổ Trưởng'}
            </div>
            {currentTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Demo Role Switch Buttons on Mobile */}
          <div className="pt-2 border-t border-slate-100">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1.5">
              Chuyển nhanh vai trò Demo
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => handleSwitchRole('admin')}
                className={`px-2 py-1.5 text-xs font-medium rounded-lg border text-center transition-all ${
                  currentUser?.email === DEMO_PROFILES.admin.email
                    ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                🖥️ Quản Đốc
              </button>
              <button
                type="button"
                onClick={() => handleSwitchRole('leader1')}
                className={`px-2 py-1.5 text-xs font-medium rounded-lg border text-center transition-all ${
                  currentUser?.email === DEMO_PROFILES.leader1.email
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700 font-bold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                📱 Tổ 1
              </button>
              <button
                type="button"
                onClick={() => handleSwitchRole('leader2')}
                className={`px-2 py-1.5 text-xs font-medium rounded-lg border text-center transition-all ${
                  currentUser?.email === DEMO_PROFILES.leader2.email
                    ? 'border-amber-600 bg-amber-50 text-amber-700 font-bold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                📱 Tổ 2
              </button>
            </div>
          </div>

          {/* Connection status note */}
          <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>Trạng thái kết nối:</span>
            {demoActive ? (
              <span className="font-semibold text-amber-600">● Demo Mode</span>
            ) : (
              <span className="font-semibold text-emerald-600">● Supabase Live</span>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
