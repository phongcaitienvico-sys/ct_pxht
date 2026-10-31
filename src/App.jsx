import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth, DEMO_TEAM_MAP } from './contexts/AuthContext.jsx';
import Navbar from './components/Navbar.jsx';
import LoginModal from './components/LoginModal.jsx';
import ChangePasswordModal from './components/ChangePasswordModal.jsx';
import ProductManager from './components/admin/ProductManager.jsx';
import RealtimeFeed from './components/admin/RealtimeFeed.jsx';
import ReportAnalytics from './components/admin/ReportAnalytics.jsx';
import EmployeeManager from './components/admin/EmployeeManager.jsx';
import AccountManager from './components/admin/AccountManager.jsx';
import LeaderEntryForm from './components/leader/LeaderEntryForm.jsx';
import LeaderDailyLogs from './components/leader/LeaderDailyLogs.jsx';
import { AlertTriangle } from 'lucide-react';

export { DEMO_TEAM_MAP };

const ADMIN_TAB_IDS = ['products', 'realtime', 'reports', 'employees', 'accounts'];
const LEADER_TAB_IDS = ['entry', 'logs'];

function MainAppShell() {
  const { currentUser, role, loading } = useAuth();
  const [activeTab, setActiveTab] = useState(role === 'admin' ? 'realtime' : 'entry');
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [isMobileFrame, setIsMobileFrame] = useState(false);

  // Đồng bộ tab hợp lệ theo vai trò (khi đăng nhập / đăng xuất)
  useEffect(() => {
    if (role === 'admin' && !ADMIN_TAB_IDS.includes(activeTab)) {
      setActiveTab('realtime');
    } else if (role === 'leader' && !LEADER_TAB_IDS.includes(activeTab)) {
      setActiveTab('entry');
    }
  }, [role, activeTab]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-600">Đang khởi tạo hệ thống...</p>
      </div>
    );
  }

  // Chưa đăng nhập -> màn hình đăng nhập toàn trang
  if (!currentUser) {
    return <LoginModal />;
  }

  const effectiveUserId = currentUser?.id;

  const renderLeader = (tab) => {
    if (tab === 'logs') {
      return (
        <LeaderDailyLogs
          userId={effectiveUserId}
          onNavigateToEntry={() => setActiveTab('entry')}
        />
      );
    }
    return (
      <LeaderEntryForm
        userId={effectiveUserId}
        onSuccess={() => setActiveTab('logs')}
      />
    );
  };

  const renderContent = () => {
    if (role === 'admin') {
      switch (activeTab) {
        case 'products':
          return <ProductManager />;
        case 'reports':
          return <ReportAnalytics />;
        case 'employees':
          return <EmployeeManager />;
        case 'accounts':
          return <AccountManager />;
        default:
          return <RealtimeFeed />;
      }
    }
    return renderLeader(activeTab);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onChangePassword={() => setIsPasswordOpen(true)}
        isMobileFrame={isMobileFrame}
        onToggleMobileFrame={() => setIsMobileFrame((v) => !v)}
      />

      {role === 'admin' && currentUser.defaultPassword && (
        <div role="alert" className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-amber-900">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            <span className="font-medium">Bạn đang dùng mật khẩu mặc định — hãy đổi ngay</span>
            <button
              type="button"
              onClick={() => setIsPasswordOpen(true)}
              className="font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-700"
            >
              Đổi mật khẩu
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 w-full pt-3 sm:pt-4 pb-24 lg:pb-12">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          {isMobileFrame ? (
            <div className="flex justify-center py-2 animate-fadeIn">
              <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border-4 border-slate-800 p-2 overflow-hidden">
                <div className="w-20 h-1 bg-slate-300 rounded-full mx-auto mb-3 mt-1" />
                <div className="max-h-[80vh] overflow-y-auto pr-1">{renderContent()}</div>
              </div>
            </div>
          ) : (
            <div className="animate-fadeIn">{renderContent()}</div>
          )}
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500 hidden lg:block">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <span className="font-semibold text-slate-700">PXHT - Phân Xưởng Hoàn Thiện</span>
            <span className="mx-2">•</span>
            <span>Hệ Thống Quản Lý Sản Lượng Ca Sản Xuất v0.1.0</span>
          </div>
          <div className="text-slate-400">Hỗ trợ kết nối Supabase Cloud &amp; Triển khai GitHub Pages</div>
        </div>
      </footer>

      <ChangePasswordModal isOpen={isPasswordOpen} onClose={() => setIsPasswordOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainAppShell />
    </AuthProvider>
  );
}
