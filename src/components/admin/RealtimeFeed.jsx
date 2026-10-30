import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Activity,
  Radio,
  Clock,
  Layers,
  Users,
  Package,
  Search,
  Filter,
  RefreshCw,
  RotateCcw,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Download,
  X,
  Check,
  Calendar,
  Building2,
  Loader2,
  FileSpreadsheet,
  Info
} from 'lucide-react';

import {
  getProductionLogs,
  getTeams,
  getProducts,
  updateProductionLog,
  deleteProductionLog,
  subscribeToLogs,
  resetDemoData,
  isDemoMode
} from '../../lib/supabase.js';

import { exportProductionReportToExcel } from '../../lib/excel.js';

import {
  calculateTodayKPI,
  filterLogs,
  handleRealtimeEvent,
  formatLogTime,
  getTodayDateString,
  validateLogInput,
  normalizeSearchText
} from './realtimeFeedLogic.js';

export default function RealtimeFeed() {
  // Logs & Master data
  const [logs, setLogs] = useState([]);
  const [teams, setTeams] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null); // { type, message }

  // Live stream status
  const [lastSyncTime, setLastSyncTime] = useState(new Date());
  const [recentInsertedId, setRecentInsertedId] = useState(null);

  // Filters
  const [teamFilter, setTeamFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('today'); // 'today' | 'all' | 'custom'
  const [customDate, setCustomDate] = useState(getTodayDateString());

  // Edit Log Modal
  const [editingLog, setEditingLog] = useState(null);
  const [editFormData, setEditFormData] = useState({
    quantity: 0,
    duration_hours: 0,
    notes: '',
    product_id: ''
  });
  const [editErrors, setEditErrors] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete Log Modal
  const [deletingLog, setDeletingLog] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Show Toast
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Fetch initial logs and reference data
  const loadData = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const [logsData, teamsData, productsData] = await Promise.all([
        getProductionLogs(),
        getTeams(),
        getProducts()
      ]);

      setLogs(logsData || []);
      setTeams(teamsData || []);
      setProducts(productsData || []);
      setLastSyncTime(new Date());
    } catch (err) {
      console.error('Error fetching realtime logs:', err);
      showToast('error', 'Không thể kết nối máy chủ dữ liệu nhật ký: ' + (err.message || 'Lỗi mạng'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Subscribe to Realtime events on mount
  useEffect(() => {
    loadData();

    // Listen for Realtime inserts/updates/deletes
    const unsubscribe = subscribeToLogs((event) => {
      setLogs((prev) => handleRealtimeEvent(prev, event));
      setLastSyncTime(new Date());

      if (event && event.eventType === 'INSERT' && event.new) {
        setRecentInsertedId(event.new.id);
        showToast(
          'info',
          `⚡ Vừa có sản lượng mới: ${event.new.employee_name || 'Thợ'} (+${event.new.quantity} SP)`
        );

        // Auto remove highlight after 5 seconds
        setTimeout(() => {
          setRecentInsertedId((current) => (current === event.new.id ? null : current));
        }, 5000);
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  // Determine current active date for KPIs and filtering
  const todayStr = useMemo(() => getTodayDateString(), []);
  const activeFilterDate = useMemo(() => {
    if (dateFilter === 'today') return todayStr;
    if (dateFilter === 'custom') return customDate;
    return 'all';
  }, [dateFilter, customDate, todayStr]);

  // Helper to format date display YYYY-MM-DD -> DD/MM/YYYY
  const formatDisplayDate = (dateStr) => {
    if (!dateStr || dateStr === 'all') return '';
    const parts = String(dateStr).split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Real-time KPI Calculation for active filter date (today, all, or custom)
  const currentKPI = useMemo(() => {
    return calculateTodayKPI(logs, activeFilterDate);
  }, [logs, activeFilterDate]);

  // Handle Reset Demo Data
  const handleResetDemoData = async () => {
    try {
      setRefreshing(true);
      await resetDemoData();
      await loadData(true);
      showToast('success', 'Đã nạp lại dữ liệu mẫu thành công với các bản ghi hôm nay!');
    } catch (err) {
      console.error('Reset demo error:', err);
      showToast('error', 'Không thể nạp lại dữ liệu mẫu: ' + (err.message || 'Lỗi'));
    } finally {
      setRefreshing(false);
    }
  };

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return filterLogs(logs, {
      teamId: teamFilter,
      searchTerm: searchTerm,
      date: activeFilterDate
    });
  }, [logs, teamFilter, searchTerm, activeFilterDate]);

  // Open Edit Modal
  const handleOpenEdit = (log) => {
    setEditingLog(log);
    setEditFormData({
      quantity: log.quantity || 1,
      duration_hours: log.duration_hours || 1,
      notes: log.notes || '',
      product_id: log.product_id || ''
    });
    setEditErrors({});
  };

  // Submit Edit
  const handleSubmitEdit = async (e) => {
    e.preventDefault();
    const validation = validateLogInput(editFormData);
    if (!validation.isValid) {
      setEditErrors(validation.errors);
      return;
    }

    try {
      setIsUpdating(true);
      const updates = {
        quantity: Number(editFormData.quantity),
        duration_hours: Number(editFormData.duration_hours),
        notes: String(editFormData.notes || '').trim(),
        product_id: editFormData.product_id || editingLog.product_id
      };

      await updateProductionLog(editingLog.id, updates);

      // Local state will update either via subscription or direct fallback
      setLogs((prev) =>
        prev.map((l) =>
          l.id === editingLog.id
            ? {
                ...l,
                ...updates,
                product_name:
                  products.find((p) => String(p.id) === String(updates.product_id))?.name ||
                  l.product_name
              }
            : l
        )
      );

      showToast('success', 'Đã cập nhật lượt báo cáo sản lượng thành công!');
      setEditingLog(null);
    } catch (err) {
      console.error('Error updating log:', err);
      showToast('error', 'Cập nhật thất bại: ' + (err.message || 'Lỗi hệ thống'));
    } finally {
      setIsUpdating(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deletingLog) return;
    try {
      setIsDeleting(true);
      await deleteProductionLog(deletingLog.id);
      setLogs((prev) => prev.filter((l) => l.id !== deletingLog.id));
      showToast('success', 'Đã xóa lượt báo cáo sản lượng.');
      setDeletingLog(null);
    } catch (err) {
      console.error('Error deleting log:', err);
      showToast('error', 'Xóa thất bại: ' + (err.message || 'Lỗi hệ thống'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Export filtered logs to Excel
  const handleExportExcel = () => {
    try {
      exportProductionReportToExcel(filteredLogs, {
        fileName: `Bao_Cao_San_Luong_${activeFilterDate || 'All'}.xlsx`
      });
      showToast('success', `Đã xuất ${filteredLogs.length} dòng dữ liệu ra file Excel!`);
    } catch (err) {
      console.error('Export error:', err);
      showToast('error', 'Không thể xuất file: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl border text-sm font-medium transition-all transform animate-bounce-short ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : toast.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-blue-50 text-blue-800 border-blue-200'
          }`}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-600" />}
          {toast.type === 'info' && <Radio className="w-5 h-5 text-blue-600 animate-pulse" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header & Live Sync Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-800">
              Giám Sát Sản Lượng Thời Gian Thực
            </h2>
            {/* Live Indicator Pill */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>LIVE FEED</span>
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Tự động cập nhật tức thì khi Tổ trưởng gửi nhật ký từ xưởng • Cập nhật lúc:{' '}
            <span className="font-medium text-slate-700">
              {lastSyncTime.toLocaleTimeString('vi-VN')}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
          {/* Refresh button */}
          <button
            onClick={() => loadData(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            title="Làm mới bảng feed"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">Đồng bộ lại</span>
          </button>

          {/* Reset Demo Data Button */}
          {isDemoMode() && (
            <button
              onClick={handleResetDemoData}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
              title="Khôi phục lại dữ liệu mẫu ban đầu (kèm sản lượng hôm nay)"
            >
              <RotateCcw className="w-4 h-4 text-amber-600" />
              <span className="hidden md:inline">Nạp lại mẫu</span>
            </button>
          )}

          {/* Export Excel Button */}
          <button
            onClick={handleExportExcel}
            disabled={filteredLogs.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-emerald-700 transition-colors shadow-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Xuất Excel ({filteredLogs.length})</span>
          </button>
        </div>
      </div>

      {/* 4 Real-time KPI Cards for Today */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Card 1: Sản lượng hôm nay */}
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-blue-200 bg-gradient-to-br from-white to-blue-50/30 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              {dateFilter === 'today'
                ? 'Sản Lượng Hôm Nay'
                : dateFilter === 'all'
                ? 'Tổng Sản Lượng (Tất Cả)'
                : `Sản Lượng Ngày ${formatDisplayDate(customDate)}`}
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-blue-900">
              {currentKPI.totalQuantity.toLocaleString('vi-VN')}
            </span>
            <span className="text-xs font-medium text-blue-600">sản phẩm</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Gồm {currentKPI.totalLogsCount} lượt ghi nhận {dateFilter === 'today' ? 'hôm nay' : dateFilter === 'all' ? 'toàn bộ' : 'trong ngày'}
          </div>
        </div>

        {/* Card 2: Tổng giờ làm */}
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-indigo-200 bg-gradient-to-br from-white to-indigo-50/30 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
              Tổng Giờ Làm Việc
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-indigo-900">
              {currentKPI.totalHours}
            </span>
            <span className="text-xs font-medium text-indigo-600">giờ</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Thời gian gia công thực tế
          </div>
        </div>

        {/* Card 3: Thợ có sản lượng */}
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/30 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Công Nhân Đạt Sản Lượng
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-900">
              {currentKPI.activeWorkersCount}
            </span>
            <span className="text-xs font-medium text-emerald-600">thợ</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Đã có sản phẩm hoàn thành
          </div>
        </div>

        {/* Card 4: Tổ đã báo cáo */}
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-amber-200 bg-gradient-to-br from-white to-amber-50/30 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
              Tổ Đã Nhập Dữ Liệu
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-900">
              {currentKPI.activeTeamsCount}
            </span>
            <span className="text-xs font-medium text-amber-600">
              / {teams.length} tổ
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Tiến độ báo cáo từ các tổ
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên thợ, mã NV, tên sản phẩm, mã SP, ghi chú..."
            className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Date & Team Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Date Selector */}
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs font-medium">
            <button
              onClick={() => setDateFilter('today')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                dateFilter === 'today'
                  ? 'bg-white text-blue-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hôm nay
            </button>
            <button
              onClick={() => setDateFilter('all')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                dateFilter === 'all'
                  ? 'bg-white text-blue-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setDateFilter('custom')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                dateFilter === 'custom'
                  ? 'bg-white text-blue-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Chọn ngày
            </button>
          </div>

          {/* Custom Date Input */}
          {dateFilter === 'custom' && (
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}

          {/* Team Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 border border-slate-200 rounded-lg">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="text-xs font-medium text-slate-700 bg-transparent border-none focus:outline-none cursor-pointer pr-2"
            >
              <option value="all">Tất cả tổ</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Realtime Feed Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
            <p className="text-sm">Đang tải nhật ký sản lượng...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-700">Chưa có nhật ký nào phù hợp</p>
            <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
              Khi tổ trưởng nhập sản lượng từ điện thoại, dữ liệu sẽ tự động xuất hiện tại đây theo thời gian thực.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4 w-28">Thời Điểm</th>
                  <th className="py-3 px-4">Tổ</th>
                  <th className="py-3 px-4">Công Nhân</th>
                  <th className="py-3 px-4">Chi Tiết Sản Phẩm</th>
                  <th className="py-3 px-4 text-center">Số Lượng</th>
                  <th className="py-3 px-4 text-center">Thời Gian</th>
                  <th className="py-3 px-4">Ghi Chú</th>
                  <th className="py-3 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => {
                  const isNewItem = log._isNew || log.id === recentInsertedId;
                  const empName =
                    log.employee_name || (log.employees && log.employees.full_name) || 'Chưa rõ';
                  const empCode =
                    log.employee_code || (log.employees && log.employees.code) || 'NV';
                  const prodName =
                    log.product_name || (log.products && log.products.name) || 'Sản phẩm ' + log.product_id;
                  const prodId =
                    log.product_id || (log.products && log.products.id) || '';
                  const customer =
                    log.customer || (log.products && log.products.customer) || '';
                  const teamName =
                    log.team_name || (log.teams && log.teams.name) || 'Tổ sản xuất';

                  return (
                    <tr
                      key={log.id}
                      className={`transition-colors duration-500 group ${
                        isNewItem
                          ? 'bg-emerald-50/90 font-medium'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Thời điểm */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-mono">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatLogTime(log.created_at || log.log_date)}</span>
                        </div>
                        {isNewItem && (
                          <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-600 text-white mt-1 uppercase tracking-wider">
                            Vừa gửi
                          </span>
                        )}
                      </td>

                      {/* Tổ */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          <Building2 className="w-3 h-3 text-blue-500" />
                          {teamName}
                        </span>
                      </td>

                      {/* Công nhân */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{empName}</div>
                        <div className="text-xs text-slate-400 font-mono">{empCode}</div>
                      </td>

                      {/* Sản phẩm */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-medium text-slate-800 truncate" title={prodName}>
                          {prodName}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          <span className="font-mono text-slate-400">#{prodId}</span>
                          {customer && (
                            <>
                              <span>•</span>
                              <span className="text-slate-600 font-medium truncate">
                                {customer}
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Số lượng */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="inline-block px-3 py-1 rounded-lg bg-blue-50 text-blue-800 font-bold text-sm border border-blue-100">
                          {log.quantity}
                        </span>
                      </td>

                      {/* Giờ làm */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap text-slate-700 font-medium">
                        {log.duration_hours} giờ
                      </td>

                      {/* Ghi chú */}
                      <td className="py-3.5 px-4 text-xs text-slate-600 max-w-xs truncate">
                        {log.notes ? (
                          <span>{log.notes}</span>
                        ) : (
                          <span className="text-slate-300 italic">Không có</span>
                        )}
                      </td>

                      {/* Thao tác (Quản đốc sửa/xóa) */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(log)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Sửa bản ghi (nếu tổ trưởng báo nhầm)"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeletingLog(log)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="Xóa bản ghi"
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

          {/* Mobile Real-time Cards (< md) */}
          <div className="md:hidden divide-y divide-slate-100 p-2.5 space-y-2.5">
            {filteredLogs.map((log) => {
              const isHighlighted = recentInsertedId === log.id;
              return (
                <div
                  key={log.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isHighlighted
                      ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400 shadow-md animate-pulse'
                      : 'bg-white border-slate-200/90 shadow-xs'
                  }`}
                >
                  {/* Row 1: Time, Team & Stats */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700">
                        <Clock className="w-3 h-3 mr-1 text-slate-400" />
                        {formatLogTime(log.created_at || log.log_date)}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        {log.team_name || (log.teams && log.teams.name) || 'Tổ SX'}
                      </span>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <span className="text-base font-extrabold text-blue-700">{log.quantity}</span>
                      <span className="text-xs text-slate-500 font-medium ml-1">SP</span>
                      <span className="text-xs text-slate-400 ml-1">({log.duration_hours}h)</span>
                    </div>
                  </div>

                  {/* Row 2: Worker & Product */}
                  <div className="space-y-1.5 my-2">
                    <div className="flex items-center text-sm font-semibold text-slate-900">
                      <Users className="w-3.5 h-3.5 text-blue-600 mr-1.5 flex-shrink-0" />
                      <span className="truncate">{log.employee_name || 'Công nhân'}</span>
                      {log.employee_code && (
                        <span className="ml-1.5 text-xs text-slate-500 font-mono font-normal">#{log.employee_code}</span>
                      )}
                    </div>
                    <div className="flex items-start text-xs text-slate-700">
                      <Package className="w-3.5 h-3.5 text-slate-400 mr-1.5 mt-0.5 flex-shrink-0" />
                      <div className="leading-tight">
                        <span className="font-medium text-slate-800">{log.product_name || `Mã #${log.product_id}`}</span>
                        {log.customer && (
                          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-normal">
                            {log.customer}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Notes if any */}
                  {log.notes && (
                    <div className="text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 mb-2 italic">
                      "{log.notes}"
                    </div>
                  )}

                  {/* Row 4: Action buttons */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleOpenEdit(log)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Sửa
                    </button>
                    <button
                      onClick={() => setDeletingLog(log)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Xóa
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          </>
        )}
      </div>

      {/* ===================================================================== */}
      {/* MODAL SỬA BẢN GHI NHẬT KÝ */}
      {/* ===================================================================== */}
      {editingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-800">
                  Điều Chỉnh Sản Lượng (Quản Đốc)
                </h3>
              </div>
              <button
                onClick={() => setEditingLog(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitEdit} className="p-6 space-y-4">
              {/* Thông tin cố định */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                <div>
                  <span className="text-slate-500">Công nhân:</span>{' '}
                  <span className="font-semibold text-slate-800">
                    {editingLog.employee_name || editingLog.employees?.full_name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Tổ sản xuất:</span>{' '}
                  <span className="font-medium text-blue-700">
                    {editingLog.team_name || editingLog.teams?.name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Sản phẩm:</span>{' '}
                  <span className="font-medium text-slate-700">
                    {editingLog.product_name || editingLog.products?.name}
                  </span>
                </div>
              </div>

              {/* Số lượng */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Số Lượng Sản Phẩm Hoàn Thành <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={editFormData.quantity}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, quantity: e.target.value })
                  }
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 font-bold ${
                    editErrors.quantity
                      ? 'border-rose-400 focus:ring-rose-200'
                      : 'border-slate-300 focus:ring-blue-100 focus:border-blue-500'
                  }`}
                />
                {editErrors.quantity && (
                  <p className="text-xs text-rose-500 mt-1">{editErrors.quantity}</p>
                )}
              </div>

              {/* Số giờ */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Số Giờ Làm Việc (giờ) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.1"
                  max="24"
                  value={editFormData.duration_hours}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, duration_hours: e.target.value })
                  }
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                    editErrors.duration_hours
                      ? 'border-rose-400 focus:ring-rose-200'
                      : 'border-slate-300 focus:ring-blue-100 focus:border-blue-500'
                  }`}
                />
                {editErrors.duration_hours && (
                  <p className="text-xs text-rose-500 mt-1">{editErrors.duration_hours}</p>
                )}
              </div>

              {/* Ghi chú */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Ghi Chú Điều Chỉnh
                </label>
                <textarea
                  rows={2}
                  value={editFormData.notes}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, notes: e.target.value })
                  }
                  placeholder="Lý do điều chỉnh hoặc chi tiết công đoạn..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingLog(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {isUpdating && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Lưu Thay Đổi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL XÁC NHẬN XÓA BẢN GHI */}
      {/* ===================================================================== */}
      {deletingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full border border-slate-200 p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Xóa Lượt Báo Cáo</h3>
                <p className="text-xs text-slate-500">Hành động này không thể hoàn tác</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-6">
              Bạn có chắc chắn muốn xóa lượt ghi nhận sản lượng của thợ{' '}
              <span className="font-semibold text-slate-800">
                {deletingLog.employee_name || deletingLog.employees?.full_name}
              </span>{' '}
              ({deletingLog.quantity} SP - {deletingLog.product_name || deletingLog.products?.name})?
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingLog(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Xác Nhận Xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
