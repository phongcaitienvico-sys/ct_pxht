import React, { useState, useEffect, useMemo, useContext, useCallback } from 'react';
import {
  Calendar,
  Clock,
  Package,
  Users,
  RefreshCw,
  Edit3,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Search,
  X,
  Layers,
  Loader2,
  Filter,
  Check,
  ChevronRight,
  Info
} from 'lucide-react';

import {
  getProductionLogs,
  updateProductionLog,
  deleteProductionLog,
  subscribeToLogs
} from '../../lib/supabase.js';

import { AuthContext } from '../../contexts/AuthContext.jsx';

import {
  groupLogsByEmployee,
  calculateTeamDailyTotals,
  filterLogsByDateAndTeam,
  validateEditInput,
  getEmployeeInitials,
  getQuickDate,
  formatDateDisplay
} from './leaderDailyLogsLogic.js';

/**
 * Màn hình Lịch sử & Chỉnh sửa Sản lượng trong ngày của Người nhập liệu (Mobile-First)
 * Cho phép xem theo ngày, nhóm theo thợ, chỉnh sửa số lượng / giờ làm, hoặc xóa bản ghi nhầm.
 */
export default function LeaderDailyLogs({
  initialDate,
  onNavigateToEntry
}) {
  // Selected Date state (defaults to today)
  const [selectedDate, setSelectedDate] = useState(() => initialDate || getQuickDate('today'));

  // Data state
  const [rawLogs, setRawLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Toast feedback
  const [toast, setToast] = useState({ show: false, type: 'success', message: '' });

  const showToast = useCallback((message, type = 'success') => {
    setToast({ show: true, type, message });
    setTimeout(() => {
      setToast({ show: false, type: 'success', message: '' });
    }, 3500);
  }, []);

  // Modal states: Edit
  const [editingLog, setEditingLog] = useState(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editErrors, setEditErrors] = useState({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Modal states: Delete
  const [deletingLog, setDeletingLog] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load logs for the selected date (all workers)
  const fetchLogs = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const data = await getProductionLogs({ date: selectedDate });
        setRawLogs(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Lỗi khi tải nhật ký sản lượng:', err);
        showToast('Không thể tải dữ liệu nhật ký sản lượng!', 'error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedDate, showToast]
  );

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Subscribe to realtime changes
  useEffect(() => {
    const unsubscribe = subscribeToLogs((payload) => {
      // Refresh current date's logs when changes occur
      fetchLogs();
    });
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [fetchLogs]);

  // Filter and compute data
  const dateLogs = useMemo(() => {
    return filterLogsByDateAndTeam(rawLogs, selectedDate, null);
  }, [rawLogs, selectedDate]);

  // Search filter
  const displayedLogs = useMemo(() => {
    if (!searchQuery.trim()) return dateLogs;
    const query = searchQuery.trim().toLowerCase();
    return dateLogs.filter((log) => {
      const empName = (log.employee_name || log.employees?.full_name || '').toLowerCase();
      const empCode = (log.employee_code || log.employees?.code || '').toLowerCase();
      const prodName = (log.product_name || log.products?.name || '').toLowerCase();
      const prodId = String(log.product_id || '').toLowerCase();
      const customer = (log.customer || log.products?.customer || '').toLowerCase();

      return (
        empName.includes(query) ||
        empCode.includes(query) ||
        prodName.includes(query) ||
        prodId.includes(query) ||
        customer.includes(query)
      );
    });
  }, [dateLogs, searchQuery]);

  // Daily totals KPI
  const teamDailyTotals = useMemo(() => {
    return calculateTeamDailyTotals(displayedLogs);
  }, [displayedLogs]);

  // Worker grouped list
  const workerGroups = useMemo(() => {
    return groupLogsByEmployee(displayedLogs);
  }, [displayedLogs]);

  // Quick date switches
  const handleSelectQuickDate = (preset) => {
    const targetDate = getQuickDate(preset);
    setSelectedDate(targetDate);
  };

  const isToday = selectedDate === getQuickDate('today');
  const isYesterday = selectedDate === getQuickDate('yesterday');

  // Handle Edit Action
  const handleOpenEditModal = (log) => {
    setEditingLog(log);
    setEditQuantity(String(log.quantity || ''));
    setEditDuration(String(log.duration_hours || ''));
    setEditNotes(log.notes || '');
    setEditErrors({});
  };

  const handleCloseEditModal = () => {
    setEditingLog(null);
    setEditQuantity('');
    setEditDuration('');
    setEditNotes('');
    setEditErrors({});
    setIsSavingEdit(false);
  };

  const handleSaveEdit = async () => {
    if (!editingLog) return;

    const validation = validateEditInput(editQuantity, editDuration);
    if (!validation.isValid) {
      setEditErrors(validation.errors);
      return;
    }

    setIsSavingEdit(true);
    try {
      await updateProductionLog(editingLog.id, {
        quantity: validation.parsedQuantity,
        duration_hours: validation.parsedDuration,
        notes: editNotes.trim()
      });

      showToast('Đã cập nhật nhật ký sản lượng thành công!', 'success');
      handleCloseEditModal();
      fetchLogs();
    } catch (err) {
      console.error('Lỗi khi cập nhật sản lượng:', err);
      showToast('Lỗi khi lưu cập nhật. Vui lòng thử lại!', 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle Delete Action
  const handleOpenDeleteModal = (log) => {
    setDeletingLog(log);
  };

  const handleCloseDeleteModal = () => {
    setDeletingLog(null);
    setIsDeleting(false);
  };

  const handleConfirmDelete = async () => {
    if (!deletingLog) return;

    setIsDeleting(true);
    try {
      await deleteProductionLog(deletingLog.id);
      showToast('Đã xóa bản ghi sản lượng thành công!', 'success');
      handleCloseDeleteModal();
      fetchLogs();
    } catch (err) {
      console.error('Lỗi khi xóa bản ghi:', err);
      showToast('Không thể xóa bản ghi này. Vui lòng thử lại!', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Edit increment / decrement helpers for mobile touch
  const handleAdjustEditQuantity = (delta) => {
    const current = Number(editQuantity) || 0;
    const nextVal = Math.max(1, current + delta);
    setEditQuantity(String(nextVal));
    if (editErrors.quantity) {
      setEditErrors((prev) => ({ ...prev, quantity: '' }));
    }
  };

  const handleAdjustEditDuration = (delta) => {
    const current = Number(editDuration) || 0;
    const nextVal = Math.max(0.5, Math.round((current + delta) * 10) / 10);
    setEditDuration(String(nextVal));
    if (editErrors.duration) {
      setEditErrors((prev) => ({ ...prev, duration: '' }));
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto bg-slate-50 min-h-screen pb-24 text-slate-900 font-sans">
      {/* Toast Notification */}
      {toast.show && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all duration-300 max-w-[90vw] ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-emerald-500/20'
              : 'bg-rose-600 text-white border-rose-700 shadow-rose-500/20'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Sticky Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3.5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5" />
              <span>Nhập liệu</span>
            </div>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">
              Lịch Sử & Nhật Ký Trong Ngày
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchLogs(true)}
              disabled={refreshing || loading}
              className="inline-flex items-center justify-center p-2 rounded-xl text-slate-600 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 active:scale-95 transition-all"
              title="Làm mới dữ liệu"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing || loading ? 'animate-spin text-blue-600' : ''}`}
              />
            </button>

            {onNavigateToEntry && (
              <button
                type="button"
                onClick={onNavigateToEntry}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nhập Mới</span>
              </button>
            )}
          </div>
        </div>

        {/* Date Selector Controls */}
        <div className="mt-3 flex items-center gap-2">
          {/* Quick Date: Today */}
          <button
            type="button"
            onClick={() => handleSelectQuickDate('today')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              isToday
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            Hôm nay
          </button>

          {/* Quick Date: Yesterday */}
          <button
            type="button"
            onClick={() => handleSelectQuickDate('yesterday')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              isYesterday
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            Hôm qua
          </button>

          {/* Date Picker Input */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
              <Calendar className="w-3.5 h-3.5" />
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
            />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="p-4 space-y-4">
        {/* Team Daily KPI Summary Card */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <span>Tóm Tắt Ngày: {formatDateDisplay(selectedDate)}</span>
            </h2>
            <span className="text-xs text-slate-400 font-medium">
              {teamDailyTotals.logCount} lượt ghi
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            {/* Total Quantity */}
            <div className="bg-emerald-50/80 rounded-xl p-2.5 border border-emerald-100 flex flex-col justify-center">
              <div className="flex items-center justify-center text-emerald-600 mb-1">
                <Package className="w-4 h-4 mr-1" />
                <span className="text-[11px] font-semibold">Sản phẩm</span>
              </div>
              <span className="text-lg font-extrabold text-emerald-700 leading-tight">
                +{teamDailyTotals.totalQuantity}
              </span>
              <span className="text-[10px] text-emerald-600 font-medium mt-0.5">chiếc/cái</span>
            </div>

            {/* Total Hours */}
            <div className="bg-blue-50/80 rounded-xl p-2.5 border border-blue-100 flex flex-col justify-center">
              <div className="flex items-center justify-center text-blue-600 mb-1">
                <Clock className="w-4 h-4 mr-1" />
                <span className="text-[11px] font-semibold">Giờ làm</span>
              </div>
              <span className="text-lg font-extrabold text-blue-700 leading-tight">
                {teamDailyTotals.totalHours}h
              </span>
              <span className="text-[10px] text-blue-600 font-medium mt-0.5">tổng công</span>
            </div>

            {/* Worker Count */}
            <div className="bg-indigo-50/80 rounded-xl p-2.5 border border-indigo-100 flex flex-col justify-center">
              <div className="flex items-center justify-center text-indigo-600 mb-1">
                <Users className="w-4 h-4 mr-1" />
                <span className="text-[11px] font-semibold">Thợ có mặt</span>
              </div>
              <span className="text-lg font-extrabold text-indigo-700 leading-tight">
                {teamDailyTotals.workerCount}
              </span>
              <span className="text-[10px] text-indigo-600 font-medium mt-0.5">người</span>
            </div>
          </div>
        </section>

        {/* Search / Filter in Day's Logs */}
        {dateLogs.length > 0 && (
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Tìm theo tên thợ, mã sản phẩm hoặc khách hàng..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Content Section: Loading, Empty, or Worker Groups */}
        {loading ? (
          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center space-y-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-xs text-slate-500 font-medium">Đang tải nhật ký sản lượng...</p>
          </div>
        ) : workerGroups.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm text-center space-y-4">
            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <Package className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-700">
                {searchQuery ? 'Không tìm thấy kết quả phù hợp' : 'Chưa có nhật ký nào trong ngày'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                {searchQuery
                  ? `Không có bản ghi nào khớp với từ khóa "${searchQuery}". Thử xóa tìm kiếm.`
                  : `Ngày ${formatDateDisplay(selectedDate)} chưa có sản lượng nào được ghi nhận.`}
              </p>
            </div>

            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all"
              >
                Xóa bộ lọc tìm kiếm
              </button>
            ) : onNavigateToEntry ? (
              <button
                type="button"
                onClick={onNavigateToEntry}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Nhập sản lượng mới</span>
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3.5">
            {workerGroups.map((group) => {
              const initials = getEmployeeInitials(group.employee_name);

              return (
                <div
                  key={group.employee_id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                >
                  {/* Worker Header */}
                  <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-200/80 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white text-xs font-bold flex items-center justify-center shadow-sm flex-shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-bold text-slate-800 truncate">
                            {group.employee_name}
                          </h3>
                          {group.employee_code && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-700">
                              {group.employee_code}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {group.log_count} sản phẩm gia công
                        </p>
                      </div>
                    </div>

                    {/* Group Totals Badge */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-extrabold text-emerald-700">
                        +{group.total_quantity} cái
                      </div>
                      <div className="text-[11px] font-medium text-blue-700">
                        {group.total_hours}h
                      </div>
                    </div>
                  </div>

                  {/* Log Items List */}
                  <div className="divide-y divide-slate-100">
                    {group.logs.map((log) => {
                      const prodId = log.product_id || log.products?.id || '';
                      const isDaily = !prodId || Boolean(log.is_daily_work);
                      const prodName = isDaily
                        ? (log.operation || log.daily_work || (log.notes ? `[Ghi chú] ${log.notes}` : 'Công nhật'))
                        : (log.product_name || log.products?.name || 'Sản phẩm');
                      const customer = isDaily ? '' : (log.customer || log.products?.customer || '');

                      return (
                        <div
                          key={log.id}
                          className="p-3.5 hover:bg-slate-50/60 transition-colors flex items-center justify-between gap-3"
                        >
                          {/* Product Info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-slate-800">
                                {prodName}
                              </span>
                              {prodId ? (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                  #{prodId}
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                  Công nhật
                                </span>
                              )}
                              {log.operation && !isDaily && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  Công đoạn: {log.operation}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                              {customer && (
                                <span className="truncate max-w-[140px] text-slate-600">
                                  {customer}
                                </span>
                              )}
                              {customer && <span>•</span>}
                              <span className="font-semibold text-emerald-600">
                                +{log.quantity} cái
                              </span>
                              <span>•</span>
                              <span className="font-medium text-slate-700">
                                {log.duration_hours}h
                              </span>
                            </div>

                            {log.notes && (
                              <p className="text-[11px] text-slate-400 italic mt-0.5 truncate">
                                "{log.notes}"
                              </p>
                            )}
                          </div>

                          {/* Action Buttons: Edit & Delete */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(log)}
                              className="inline-flex items-center justify-center p-2 rounded-xl text-blue-600 hover:bg-blue-50 border border-blue-200/60 active:scale-95 transition-all"
                              title="Sửa số lượng và giờ"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenDeleteModal(log)}
                              className="inline-flex items-center justify-center p-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200/60 active:scale-95 transition-all"
                              title="Xóa bản ghi này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* MODAL: SỬA BẢN GHI (EDIT MODAL) */}
      {editingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl border border-slate-200 overflow-hidden transform transition-all">
            {/* Modal Header */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700">
                <Edit3 className="w-4 h-4" />
                <span>Sửa Nhật Ký Sản Lượng</span>
              </div>
              <button
                type="button"
                onClick={handleCloseEditModal}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              {/* Context Summary */}
              <div className="bg-blue-50/60 rounded-xl p-3 border border-blue-100 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Thợ gia công:</span>
                  <span className="font-bold text-slate-800">
                    {editingLog.employee_name || editingLog.employees?.full_name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Sản phẩm:</span>
                  <span className="font-bold text-slate-800 truncate max-w-[180px]">
                    {editingLog.product_name || editingLog.products?.name} (#{editingLog.product_id})
                  </span>
                </div>
                {editingLog.operation && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Công đoạn:</span>
                    <span className="font-bold text-slate-800">{editingLog.operation}</span>
                  </div>
                )}
              </div>

              {/* Edit Quantity with +/- touch buttons */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số lượng hoàn thành (cái) <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAdjustEditQuantity(-1)}
                    className="w-10 h-10 rounded-xl border border-slate-300 bg-slate-50 text-slate-700 font-bold hover:bg-slate-100 active:scale-95 flex items-center justify-center text-sm"
                  >
                    -1
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={editQuantity}
                    onChange={(e) => {
                      setEditQuantity(e.target.value);
                      if (editErrors.quantity) {
                        setEditErrors((prev) => ({ ...prev, quantity: '' }));
                      }
                    }}
                    placeholder="VD: 10"
                    className={`flex-1 text-center font-bold text-base h-10 rounded-xl border ${
                      editErrors.quantity
                        ? 'border-rose-400 focus:ring-rose-500'
                        : 'border-slate-300 focus:ring-blue-500'
                    } focus:outline-none focus:ring-2`}
                  />
                  <button
                    type="button"
                    onClick={() => handleAdjustEditQuantity(1)}
                    className="w-10 h-10 rounded-xl border border-slate-300 bg-slate-50 text-slate-700 font-bold hover:bg-slate-100 active:scale-95 flex items-center justify-center text-sm"
                  >
                    +1
                  </button>
                </div>
                {editErrors.quantity && (
                  <p className="text-[11px] text-rose-500 font-medium mt-1">
                    {editErrors.quantity}
                  </p>
                )}
              </div>

              {/* Edit Duration Hours with +/- touch buttons */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Thời gian làm (giờ) <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAdjustEditDuration(-0.5)}
                    className="w-10 h-10 rounded-xl border border-slate-300 bg-slate-50 text-slate-700 font-bold hover:bg-slate-100 active:scale-95 flex items-center justify-center text-xs"
                  >
                    -0.5
                  </button>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={editDuration}
                    onChange={(e) => {
                      setEditDuration(e.target.value);
                      if (editErrors.duration) {
                        setEditErrors((prev) => ({ ...prev, duration: '' }));
                      }
                    }}
                    placeholder="VD: 4.5"
                    className={`flex-1 text-center font-bold text-base h-10 rounded-xl border ${
                      editErrors.duration
                        ? 'border-rose-400 focus:ring-rose-500'
                        : 'border-slate-300 focus:ring-blue-500'
                    } focus:outline-none focus:ring-2`}
                  />
                  <button
                    type="button"
                    onClick={() => handleAdjustEditDuration(0.5)}
                    className="w-10 h-10 rounded-xl border border-slate-300 bg-slate-50 text-slate-700 font-bold hover:bg-slate-100 active:scale-95 flex items-center justify-center text-xs"
                  >
                    +0.5
                  </button>
                </div>
                {editErrors.duration && (
                  <p className="text-[11px] text-rose-500 font-medium mt-1">
                    {editErrors.duration}
                  </p>
                )}
              </div>

              {/* Edit Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ghi chú (tùy chọn)
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Ghi chú máy, ca làm, chi tiết..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseEditModal}
                disabled={isSavingEdit}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-all"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50"
              >
                {isSavingEdit ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Lưu Cập Nhật</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: XÁC NHẬN XÓA (DELETE MODAL) */}
      {deletingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl border border-slate-200 overflow-hidden transform transition-all">
            <div className="p-5 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Xác nhận xóa bản ghi sản lượng?
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Hành động này sẽ xóa vĩnh viễn lượt làm của thợ{' '}
                  <span className="font-semibold text-slate-700">
                    {deletingLog.employee_name || deletingLog.employees?.full_name}
                  </span>{' '}
                  cho sản phẩm{' '}
                  <span className="font-semibold text-slate-700">
                    {deletingLog.product_name || deletingLog.products?.name}
                  </span>{' '}
                  ({deletingLog.quantity} cái, {deletingLog.duration_hours}h).
                </p>
              </div>

              <div className="pt-2 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleCloseDeleteModal}
                  disabled={isDeleting}
                  className="flex-1 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang xóa...</span>
                    </>
                  ) : (
                    <span>Xóa Bản Ghi</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
