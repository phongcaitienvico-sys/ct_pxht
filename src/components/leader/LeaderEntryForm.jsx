import React, { useState, useEffect, useMemo, useContext, useCallback } from 'react';
import {
  User,
  Users,
  Calendar,
  Package,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  Layers,
  Info,
  X,
  Loader2,
  ArrowRight,
  ShieldAlert,
  Hash,
  Sparkles
} from 'lucide-react';

import {
  getEmployees,
  getProducts,
  getTeams,
  submitProductionLogs
} from '../../lib/supabase.js';

import { AuthContext } from '../../contexts/AuthContext.jsx';

import {
  createEmptyRow,
  validateEntryForm,
  buildBatchPayload,
  filterActiveProducts,
  filterTeamEmployees,
  formatProductLabel,
  calculateFormTotals
} from './leaderEntryLogic.js';

/**
 * Màn hình nhập sản lượng của Tổ trưởng (Mobile-First)
 * Cho phép 1 chạm lưu nhiều sản phẩm đã gia công cho 1 thợ trong ngày.
 */
export default function LeaderEntryForm({
  teamId: propTeamId,
  userId: propUserId,
  teamName: propTeamName,
  initialEmployees,
  initialProducts,
  onSuccess
}) {
  // Auth context fallback
  const auth = useContext(AuthContext);
  const currentTeam = auth?.currentTeam;
  const currentUser = auth?.currentUser;

  const effectiveTeamId = propTeamId || currentTeam?.id || null;
  const effectiveUserId = propUserId || currentUser?.id || null;

  // Master data
  const [employees, setEmployees] = useState(initialEmployees || []);
  const [products, setProducts] = useState(initialProducts || []);
  const [teams, setTeams] = useState([]);
  const [loadingData, setLoadingData] = useState(!initialEmployees || !initialProducts);
  const [refreshing, setRefreshing] = useState(false);

  // Form states
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [logDate, setLogDate] = useState(todayStr);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [includeOtherTeams, setIncludeOtherTeams] = useState(false);
  const [rows, setRows] = useState([createEmptyRow()]);
  const [keepWorkerAfterSave, setKeepWorkerAfterSave] = useState(false);

  // Validation & Submission
  const [formErrors, setFormErrors] = useState({
    employee_id: '',
    rows: {},
    duplicateProductIds: [],
    general: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success' | 'error' | 'info', message: string, detail?: string }

  // Load master data
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [empList, prodList, teamList] = await Promise.all([
        getEmployees(),
        getProducts(),
        getTeams()
      ]);
      setEmployees(empList || []);
      setProducts(prodList || []);
      setTeams(teamList || []);
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu cho form Tổ trưởng:', err);
      setToast({
        type: 'error',
        message: 'Không thể kết nối cơ sở dữ liệu. Vui lòng thử lại!'
      });
    } finally {
      setLoadingData(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!initialEmployees || !initialProducts) {
      loadData();
    }
  }, [loadData, initialEmployees, initialProducts]);

  // Active products & filtered employees
  const activeProducts = useMemo(() => {
    return filterActiveProducts(products);
  }, [products]);

  const filteredEmployees = useMemo(() => {
    return filterTeamEmployees(employees, effectiveTeamId, includeOtherTeams);
  }, [employees, effectiveTeamId, includeOtherTeams]);

  // Current selected employee object
  const selectedEmployee = useMemo(() => {
    return employees.find((e) => e.id === selectedEmployeeId) || null;
  }, [employees, selectedEmployeeId]);

  // Active team name resolution
  const displayTeamName = useMemo(() => {
    if (propTeamName) return propTeamName;
    if (currentTeam?.name) return currentTeam.name;
    if (effectiveTeamId && teams.length > 0) {
      const found = teams.find((t) => t.id === effectiveTeamId);
      if (found) return found.name;
    }
    return 'Tổ Sản Xuất';
  }, [propTeamName, currentTeam, effectiveTeamId, teams]);

  // Form quick totals
  const totals = useMemo(() => {
    return calculateFormTotals(rows);
  }, [rows]);

  // Handlers for rows
  const handleAddRow = () => {
    setRows((prev) => [...prev, createEmptyRow()]);
  };

  const handleRemoveRow = (indexToRemove) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    // Clear error for removed row
    setFormErrors((prev) => {
      const nextRows = { ...prev.rows };
      delete nextRows[indexToRemove];
      return { ...prev, rows: nextRows };
    });
  };

  const handleRowChange = (index, field, value) => {
    setRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });

    // Clear specific error field
    if (formErrors.rows[index]?.[field]) {
      setFormErrors((prev) => {
        const nextRowErrors = { ...(prev.rows[index] || {}) };
        delete nextRowErrors[field];
        const nextRows = { ...prev.rows };
        if (Object.keys(nextRowErrors).length === 0) {
          delete nextRows[index];
        } else {
          nextRows[index] = nextRowErrors;
        }
        return { ...prev, rows: nextRows };
      });
    }

    // Clear duplicate product errors if product changed
    if (field === 'product_id' && formErrors.duplicateProductIds.length > 0) {
      setFormErrors((prev) => ({ ...prev, duplicateProductIds: [] }));
    }
  };

  const adjustQuantity = (index, delta) => {
    const currentVal = Number(rows[index]?.quantity) || 0;
    const newVal = Math.max(1, currentVal + delta);
    handleRowChange(index, 'quantity', String(newVal));
  };

  const adjustDuration = (index, delta) => {
    const currentVal = Number(rows[index]?.duration_hours) || 0;
    const newVal = Math.max(0.5, Math.round((currentVal + delta) * 10) / 10);
    handleRowChange(index, 'duration_hours', String(newVal));
  };

  // Quick date pickers
  const setQuickDate = (type) => {
    const d = new Date();
    if (type === 'yesterday') {
      d.setDate(d.getDate() - 1);
    }
    setLogDate(d.toISOString().slice(0, 10));
  };

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Submit Handler
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    const formData = {
      employee_id: selectedEmployeeId,
      log_date: logDate,
      rows
    };

    const validation = validateEntryForm(formData);
    if (!validation.isValid) {
      setFormErrors(validation.errors);
      setToast({
        type: 'error',
        message: validation.errorMessages[0] || 'Vui lòng kiểm tra lại thông tin nhập!',
        detail: validation.errorMessages.length > 1 ? `Có ${validation.errorMessages.length} lỗi cần sửa` : undefined
      });
      return;
    }

    setSubmitting(true);
    setFormErrors({ employee_id: '', rows: {}, duplicateProductIds: [], general: '' });

    try {
      const payload = buildBatchPayload(formData, effectiveTeamId, effectiveUserId);
      const result = await submitProductionLogs(payload);

      const workerName = selectedEmployee ? selectedEmployee.full_name : 'thợ';
      setToast({
        type: 'success',
        message: `Lưu thành công ${payload.length} sản phẩm cho ${workerName}!`,
        detail: `Tổng: ${totals.totalQuantity} SP, ${totals.totalHours}h`
      });

      // Reset rows to 1 empty row
      setRows([createEmptyRow()]);

      // If user chose NOT to keep worker, reset worker selection
      if (!keepWorkerAfterSave) {
        setSelectedEmployeeId('');
      }

      if (onSuccess && typeof onSuccess === 'function') {
        onSuccess(result);
      }
    } catch (err) {
      console.error('Lỗi khi lưu nhật ký sản xuất:', err);
      setToast({
        type: 'error',
        message: 'Không thể lưu dữ liệu lên máy chủ. Vui lòng thử lại!',
        detail: err.message
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto pb-12 px-3 sm:px-4">
      {/* Toast Notification */}
      {toast && (
        <div
          role="alert"
          className={`fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 p-4 rounded-xl shadow-xl border flex items-start gap-3 transition-all transform animate-bounce-short ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : toast.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : 'bg-blue-50 border-blue-300 text-blue-900'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-rose-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 text-sm">
            <p className="font-bold">{toast.message}</p>
            {toast.detail && <p className="text-xs mt-0.5 opacity-80">{toast.detail}</p>}
          </div>
          <button
            onClick={() => setToast(null)}
            className="p-1 rounded-lg hover:bg-black/5 text-slate-500"
            aria-label="Đóng thông báo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Container Card */}
      <div className="bg-white rounded-3xl shadow-md border border-slate-200 overflow-hidden">
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 p-4 sm:p-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-white border border-white/20">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight">
                  Nhập Sản Lượng Theo Thợ
                </h1>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-blue-100">
                  <span className="inline-flex items-center gap-1 font-medium bg-white/20 px-2 py-0.5 rounded-full">
                    {displayTeamName}
                  </span>
                  <span>•</span>
                  <span>1 chạm lưu nhiều món</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => loadData(true)}
              disabled={refreshing || loadingData}
              title="Làm mới dữ liệu từ máy chủ"
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Làm mới"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Loading Indicator */}
        {loadingData ? (
          <div className="p-12 text-center text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-3" />
            <p className="text-sm font-medium">Đang tải danh sách thợ và sản phẩm...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
            {/* Warning if no active products enabled today */}
            {activeProducts.length === 0 && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <strong className="block font-semibold">Chưa có sản phẩm nào được mở hôm nay!</strong>
                  Quản đốc chưa bật sản phẩm trong ca làm việc. Vui lòng liên hệ Quản đốc hoặc chuyển sang giao diện Quản lý để mở sản phẩm trước khi nhập sản lượng.
                </div>
              </div>
            )}

            {/* BƯỚC 1: CHỌN NGÀY & THỢ */}
            <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px]">1</span>
                  Thời Gian & Thợ Thực Hiện
                </span>
                {selectedEmployee && (
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Đã chọn: {selectedEmployee.full_name}
                  </span>
                )}
              </div>

              {/* Ngày làm việc */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    Ngày làm việc
                  </span>
                  <div className="flex items-center gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setQuickDate('today')}
                      className={`px-2 py-0.5 rounded font-medium border ${
                        logDate === todayStr
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Hôm nay
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickDate('yesterday')}
                      className="px-2 py-0.5 rounded font-medium bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                    >
                      Hôm qua
                    </button>
                  </div>
                </label>
                <input
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-base font-medium shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              {/* Dropdown Chọn Thợ */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    Thợ thực hiện <span className="text-rose-500">*</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeOtherTeams}
                      onChange={(e) => setIncludeOtherTeams(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <Users className="w-3 h-3 text-slate-500" />
                    <span>Xem thợ tổ khác</span>
                  </label>
                </div>

                <div className="relative">
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => {
                      setSelectedEmployeeId(e.target.value);
                      if (formErrors.employee_id) {
                        setFormErrors((prev) => ({ ...prev, employee_id: '' }));
                      }
                    }}
                    className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border bg-white text-slate-800 text-base font-semibold shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none transition-all ${
                      formErrors.employee_id
                        ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:ring-rose-400'
                        : 'border-slate-300'
                    }`}
                  >
                    <option value="">-- Bấm để chọn thợ --</option>
                    {filteredEmployees.map((emp) => {
                      const empTeam = teams.find((t) => t.id === emp.team_id);
                      const isOtherTeam = effectiveTeamId && emp.team_id !== effectiveTeamId;
                      return (
                        <option key={emp.id} value={emp.id}>
                          {emp.code ? `[${emp.code}] ` : ''}
                          {emp.full_name}
                          {isOtherTeam && empTeam ? ` (Mượn từ: ${empTeam.name})` : ''}
                        </option>
                      );
                    })}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-3.5 pointer-events-none text-slate-400">
                    ▼
                  </div>
                </div>

                {formErrors.employee_id && (
                  <p className="text-xs text-rose-600 mt-1 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                    {formErrors.employee_id}
                  </p>
                )}
              </div>
            </div>

            {/* BƯỚC 2: CÁC DÒNG SẢN PHẨM ĐỘNG */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px]">2</span>
                  Danh Sách Sản Phẩm Đã Làm
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {rows.length} món
                </span>
              </div>

              {/* Danh sách từng món */}
              <div className="space-y-3">
                {rows.map((row, index) => {
                  const rowError = formErrors.rows[index] || {};
                  const isDuplicate = formErrors.duplicateProductIds?.includes(row.product_id);

                  return (
                    <div
                      key={row.id || index}
                      className={`relative bg-white rounded-2xl border transition-all p-3.5 sm:p-4 shadow-sm ${
                        isDuplicate || Object.keys(rowError).length > 0
                          ? 'border-rose-300 ring-1 ring-rose-300 bg-rose-50/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Tiêu đề dòng & nút xóa */}
                      <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                          <span className="w-5 h-5 rounded-md bg-blue-50 text-blue-700 font-extrabold flex items-center justify-center text-xs">
                            #{index + 1}
                          </span>
                          <span>Món thứ {index + 1}</span>
                        </div>

                        {rows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(index)}
                            className="min-h-[44px] min-w-[44px] -my-2 -mr-2 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all flex items-center gap-1"
                            title="Xóa món này"
                            aria-label={`Xóa món thứ ${index + 1}`}
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Xóa dòng</span>
                          </button>
                        )}
                      </div>

                      {/* Chọn sản phẩm */}
                      <div className="mb-3">
                        <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                          <Package className="w-3.5 h-3.5 text-blue-600" />
                          Sản phẩm <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <select
                            value={row.product_id}
                            onChange={(e) => handleRowChange(index, 'product_id', e.target.value)}
                            className={`w-full min-h-[48px] px-3 py-2.5 rounded-xl border bg-white text-slate-800 text-sm font-medium shadow-sm focus:ring-2 focus:ring-blue-500 outline-none appearance-none ${
                              rowError.product_id || isDuplicate
                                ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:ring-rose-400'
                                : 'border-slate-300'
                            }`}
                          >
                            <option value="">-- Chọn sản phẩm Quản đốc đã mở --</option>
                            {activeProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {formatProductLabel(p)}
                              </option>
                            ))}
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-400">
                            ▼
                          </div>
                        </div>

                        {(rowError.product_id || isDuplicate) && (
                          <p className="text-xs text-rose-600 mt-1 font-medium flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                            {isDuplicate
                              ? 'Sản phẩm này bị chọn trùng ở 2 dòng!'
                              : rowError.product_id}
                          </p>
                        )}
                      </div>

                      {/* 2 Cột: Số lượng & Thời gian */}
                      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 mb-2.5">
                        {/* Cột Số lượng */}
                        <div className="bg-emerald-50/40 p-2.5 sm:p-3 rounded-xl border border-emerald-200/80">
                          <label className="block text-xs font-bold text-emerald-900 mb-1 flex items-center justify-between">
                            <span>Số lượng (cái) *</span>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => adjustQuantity(index, -1)}
                                className="w-7 h-7 rounded-lg bg-white border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center justify-center hover:bg-emerald-100 active:scale-95"
                              >
                                -1
                              </button>
                              <button
                                type="button"
                                onClick={() => adjustQuantity(index, 1)}
                                className="w-7 h-7 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center justify-center hover:bg-emerald-700 active:scale-95"
                              >
                                +1
                              </button>
                            </div>
                          </label>

                          <input
                            type="number"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            placeholder="0"
                            value={row.quantity}
                            onChange={(e) => handleRowChange(index, 'quantity', e.target.value)}
                            className={`w-full min-h-[48px] px-2 py-1.5 text-center text-xl sm:text-2xl font-black rounded-lg border bg-white shadow-inner focus:ring-2 focus:ring-emerald-500 outline-none transition-all ${
                              rowError.quantity
                                ? 'border-rose-400 text-rose-700 bg-rose-50'
                                : 'border-emerald-300 text-emerald-800'
                            }`}
                          />

                          {rowError.quantity && (
                            <p className="text-[11px] text-rose-600 mt-1 font-semibold text-center">
                              {rowError.quantity}
                            </p>
                          )}
                        </div>

                        {/* Cột Thời gian */}
                        <div className="bg-blue-50/40 p-2.5 sm:p-3 rounded-xl border border-blue-200/80">
                          <label className="block text-xs font-bold text-blue-900 mb-1 flex items-center justify-between">
                            <span>Giờ làm (h) *</span>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => adjustDuration(index, -0.5)}
                                className="w-7 h-7 rounded-lg bg-white border border-blue-300 text-blue-800 text-xs font-bold flex items-center justify-center hover:bg-blue-100 active:scale-95"
                              >
                                -0.5
                              </button>
                              <button
                                type="button"
                                onClick={() => adjustDuration(index, 0.5)}
                                className="w-7 h-7 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center justify-center hover:bg-blue-700 active:scale-95"
                              >
                                +0.5
                              </button>
                            </div>
                          </label>

                          <input
                            type="number"
                            min="0.1"
                            step="0.5"
                            inputMode="decimal"
                            placeholder="0.0"
                            value={row.duration_hours}
                            onChange={(e) => handleRowChange(index, 'duration_hours', e.target.value)}
                            className={`w-full min-h-[48px] px-2 py-1.5 text-center text-xl sm:text-2xl font-black rounded-lg border bg-white shadow-inner focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                              rowError.duration_hours
                                ? 'border-rose-400 text-rose-700 bg-rose-50'
                                : 'border-blue-300 text-blue-800'
                            }`}
                          />

                          {rowError.duration_hours && (
                            <p className="text-[11px] text-rose-600 mt-1 font-semibold text-center">
                              {rowError.duration_hours}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Ghi chú tùy chọn */}
                      <div>
                        <input
                          type="text"
                          placeholder="Ghi chú thêm (ví dụ: tiện thô, hàn đắp...)"
                          value={row.notes}
                          onChange={(e) => handleRowChange(index, 'notes', e.target.value)}
                          className="w-full min-h-[40px] px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-400 outline-none"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Nút Thêm Dòng Sản Phẩm */}
              <button
                type="button"
                onClick={handleAddRow}
                className="w-full min-h-[48px] py-3.5 px-4 rounded-2xl border-2 border-dashed border-blue-400 bg-blue-50/60 hover:bg-blue-100/70 text-blue-800 font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-sm"
              >
                <Plus className="w-5 h-5 text-blue-700" />
                <span>
                  + THÊM DÒNG SẢN PHẨM CHO{' '}
                  {selectedEmployee
                    ? `ANH ${selectedEmployee.full_name.toUpperCase()}`
                    : 'THỢ NÀY'}
                </span>
              </button>
            </div>

            {/* BƯỚC 3: TỔNG KẾT & NÚT LƯU 1 CHẠM */}
            <div className="pt-2 border-t border-slate-200 space-y-3">
              {/* Thẻ tóm tắt nhanh */}
              <div className="bg-slate-100/90 rounded-2xl p-3.5 flex items-center justify-between text-xs sm:text-sm">
                <div className="text-slate-600 font-medium">
                  {selectedEmployee ? (
                    <span className="font-bold text-slate-800">{selectedEmployee.full_name}</span>
                  ) : (
                    <span>Chưa chọn thợ</span>
                  )}
                </div>
                <div className="flex items-center gap-3 font-semibold">
                  <span className="text-emerald-700">
                    SL: <span className="font-bold text-base">{totals.totalQuantity}</span>
                  </span>
                  <span className="text-blue-700">
                    Giờ: <span className="font-bold text-base">{totals.totalHours}h</span>
                  </span>
                </div>
              </div>

              {/* Checkbox giữ lại thợ */}
              <label className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-700 cursor-pointer select-none px-1 py-1 min-h-[44px]">
                <input
                  type="checkbox"
                  checked={keepWorkerAfterSave}
                  onChange={(e) => setKeepWorkerAfterSave(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                />
                <span>Giữ nguyên thợ này sau khi lưu (để nhập thêm đợt khác)</span>
              </label>

              {/* Nút to màu xanh lá: LƯU TẤT CẢ TRONG 1 CHẠM */}
              <button
                type="submit"
                disabled={submitting || activeProducts.length === 0}
                className="w-full min-h-[54px] py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-base sm:text-lg shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin text-white" />
                    <span>Đang lưu lên máy chủ...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-6 h-6 text-white" />
                    <span>
                      ✓ LƯU TẤT CẢ (Đang có {totals.productCount || rows.length} món của{' '}
                      {selectedEmployee ? `anh ${selectedEmployee.full_name}` : 'thợ'})
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
