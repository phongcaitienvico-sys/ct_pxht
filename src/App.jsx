import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import Navbar from './components/Navbar.jsx';
import LoginModal from './components/LoginModal.jsx';
import ProductManager from './components/admin/ProductManager.jsx';
import RealtimeFeed from './components/admin/RealtimeFeed.jsx';
import ReportAnalytics from './components/admin/ReportAnalytics.jsx';
import EmployeeManager from './components/admin/EmployeeManager.jsx';
import LeaderEntryForm from './components/leader/LeaderEntryForm.jsx';
import LeaderDailyLogs from './components/leader/LeaderDailyLogs.jsx';
import { Smartphone, Monitor } from 'lucide-react';

function MainAppShell() {
  const { currentUser, role, currentTeam, loading } = useAuth();
  const [activeTab, setActiveTab] = useState(role === 'admin' ? 'realtime' : 'entry');
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isMobileFrame, setIsMobileFrame] = useState(false);

  // Auto-sync tab when switching role
  useEffect(() => {
    if (role === 'admin') {
      if (['entry', 'logs'].includes(activeTab)) {
        setActiveTab('realtime');
      }
    } else if (role === 'leader') {
      if (['products', 'realtime', 'reports', 'employees'].includes(activeTab)) {
        setActiveTab('entry');
      }
    }
  }, [role]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-600">Đang khởi tạo hệ thống...</p>
      </div>
    );
  }

  // Team parameters for leader forms
  const effectiveTeamId =
    currentTeam?.id ||
    currentUser?.teamId ||
    'a0000000-0000-0000-0000-000000000001';
  const effectiveTeamName =
    currentTeam?.name ||
    currentUser?.teamName ||
    'Tổ 1 - Cơ khí & Đúc';
  const effectiveUserId = currentUser?.id || 'leader-1';

  const renderContent = () => {
    // When role is Admin
    if (role === 'admin') {
      switch (activeTab) {
        case 'products':
          return <ProductManager />;
        case 'realtime':
          return <RealtimeFeed />;
        case 'reports':
          return <ReportAnalytics />;
        case 'employees':
          return <EmployeeManager />;
        default:
          return <RealtimeFeed />;
      }
    }

    // When role is Leader
    switch (activeTab) {
      case 'entry':
        return (
          <LeaderEntryForm
            teamId={effectiveTeamId}
            userId={effectiveUserId}
            teamName={effectiveTeamName}
            onSuccess={() => setActiveTab('logs')}
          />
        );
      case 'logs':
        return (
          <LeaderDailyLogs
            teamId={effectiveTeamId}
            userId={effectiveUserId}
            teamName={effectiveTeamName}
            onNavigateToEntry={() => setActiveTab('entry')}
          />
        );
      default:
        return (
          <LeaderEntryForm
            teamId={effectiveTeamId}
            userId={effectiveUserId}
            teamName={effectiveTeamName}
            onSuccess={() => setActiveTab('logs')}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col">
      {/* Clean Corporate Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenLogin={() => setIsLoginOpen(true)}
      />

      {/* Main View Area */}
      <main className="flex-1 w-full pb-12 pt-4">
        {/* Helper Bar for testing mobile view on PC */}
        {role === 'leader' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-3 flex items-center justify-between text-xs text-slate-500">
            <span className="hidden sm:inline">
              Giao diện dành riêng cho Tổ trưởng ghi nhận sản lượng tại xưởng
            </span>
            <button
              type="button"
              onClick={() => setIsMobileFrame(!isMobileFrame)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs font-semibold text-slate-700 ml-auto transition-colors"
            >
              {isMobileFrame ? (
                <>
                  <Monitor className="w-3.5 h-3.5 text-blue-600" />
                  <span>Mở rộng toàn màn hình</span>
                </>
              ) : (
                <>
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Mô phỏng màn hình điện thoại</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Content container */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {isMobileFrame && role === 'leader' ? (
            <div className="flex justify-center py-2 animate-fadeIn">
              <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border-4 border-slate-800 p-2 overflow-hidden">
                <div className="w-20 h-1 bg-slate-300 rounded-full mx-auto mb-3 mt-1" />
                <div className="max-h-[80vh] overflow-y-auto pr-1">
                  {renderContent()}
                </div>
              </div>
            </div>
          ) : (
            <div className="animate-fadeIn">{renderContent()}</div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <span className="font-semibold text-slate-700">PXHT - Phân Xưởng Hàn Tàu</span>
            <span className="mx-2">•</span>
            <span>Hệ Thống Quản Lý Sản Lượng Ca Sản Xuất v0.1.0</span>
          </div>
          <div className="text-slate-400">
            Hỗ trợ kết nối Supabase Cloud & Triển khai GitHub Pages
          </div>
        </div>
      </footer>

      {/* Login / Switch Account Modal */}
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
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
