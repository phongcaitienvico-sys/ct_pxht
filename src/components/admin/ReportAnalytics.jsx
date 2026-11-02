import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Users,
  Layers,
  Package,
  Clock,
  TrendingUp,
  Download,
  Search,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  BarChart3,
  User,
  ArrowRight,
  RotateCcw,
  FileText,
  Info,
  X,
  ChevronRight
} from 'lucide-react';

import {
  getProductionLogs,
  getEmployees,
  getProducts
} from '../../lib/supabase.js';

import { exportProductionReportToExcel } from '../../lib/excel.js';

import {
  getDatePresetRange,
  filterLogsByCriteria,
  calculateAnalyticsKPI,
  groupLogsByDay,
  groupLogsByEmployeeSummary,
  groupLogsByOperation,
  formatDateVN,
  formatFullDateVN,
  formatNumber
} from './reportAnalyticsLogic.js';

export default function ReportAnalytics() {
  // Master data & logs
  const [logs, setLogs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null); // { type, message }

  // Date range presets: 'today' | 'last_7_days' | 'this_month' | 'last_month' | 'custom'
  const [activePreset, setActivePreset] = useState('this_month');
  const [startDate, setStartDate] = useState(() => getDatePresetRange('this_month').startDate);
  const [endDate, setEndDate] = useState(() => getDatePresetRange('this_month').endDate);

  // Filters
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Toast notification
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Fetch initial data
  const loadData = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const [logsData, employeesData, productsData] = await Promise.all([
        getProductionLogs(),
        getEmployees(),
        getProducts()
      ]);

      const safeLogs = logsData || [];
      setLogs(safeLogs);
      setEmployees(employeesData || []);
      setProducts(productsData || []);

      if (!isSilent && safeLogs.length > 0) {
        const thisMonthRange = getDatePresetRange('this_month');
        const thisMonthMatches = filterLogsByCriteria(safeLogs, thisMonthRange);
        if (thisMonthMatches.length === 0) {
          const lastMonthRange = getDatePresetRange('last_month');
          const lastMonthMatches = filterLogsByCriteria(safeLogs, lastMonthRange);
          if (lastMonthMatches.length > 0) {
            setActivePreset('last_month');
            setStartDate(lastMonthRange.startDate);
            setEndDate(lastMonthRange.endDate);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      showToast('error', 'Không thể kết nối máy chủ dữ liệu: ' + (err.message || 'Lỗi mạng'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle Preset selection
  const handleApplyPreset = (presetKey) => {
    setActivePreset(presetKey);
    const range = getDatePresetRange(presetKey);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  };

  // Handle custom date change
  const handleStartDateChange = (val) => {
    setStartDate(val);
    setActivePreset('custom');
  };

  const handleEndDateChange = (val) => {
    setEndDate(val);
    setActivePreset('custom');
  };

  // Reset all filters to default
  const handleResetFilters = () => {
    const range = getDatePresetRange('this_month');
    setActivePreset('this_month');
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    setSelectedEmployeeId('all');
    setSearchQuery('');
  };

  // Selected Employee Details
  const currentSelectedEmployee = useMemo(() => {
    if (selectedEmployeeId === 'all') return null;
    return employees.find((e) => e.id === selectedEmployeeId || e.code === selectedEmployeeId) || null;
  }, [employees, selectedEmployeeId]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return filterLogsByCriteria(logs, {
      startDate,
      endDate,
      employeeId: selectedEmployeeId,
      search: searchQuery
    });
  }, [logs, startDate, endDate, selectedEmployeeId, searchQuery]);

  // Calculated KPI summary metrics
  const kpi = useMemo(() => {
    return calculateAnalyticsKPI(filteredLogs);
  }, [filteredLogs]);

  // Day-by-day logs (Used when a single employee is selected)
  const dayGroups = useMemo(() => {
    return groupLogsByDay(filteredLogs);
  }, [filteredLogs]);

  // Employee summaries table (Used when "All employees" is selected)
  const employeeSummaries = useMemo(() => {
    return groupLogsByEmployeeSummary(filteredLogs);
  }, [filteredLogs]);

  // Operation (công đoạn) summaries
  const operationSummaries = useMemo(() => {
    return groupLogsByOperation(filteredLogs);
  }, [filteredLogs]);

  // Export to Excel handler
  const handleExportExcel = () => {
    if (filteredLogs.length === 0) {
      showToast('error', 'Không có dữ liệu trong khoảng thời gian và bộ lọc đã chọn để xuất file!');
      return;
    }

    try {
      const empPrefix = currentSelectedEmployee ? `${currentSelectedEmployee.code}_` : 'Toan_Xuong_';
      const cleanStart = (startDate || '').replace(/-/g, '');
      const cleanEnd = (endDate || '').replace(/-/g, '');
      const fileName = `Bao_Cao_San_Luong_${empPrefix}${cleanStart}_den_${cleanEnd}.xlsx`;

      exportProductionReportToExcel(filteredLogs, { fileName });
      showToast('success', `Đã xuất ${filteredLogs.length} dòng dữ liệu ra file Excel thành công!`);
    } catch (err) {
      console.error('Error exporting excel:', err);
      showToast('error', 'Lỗi khi xuất file Excel: ' + (err.message || 'Chưa rõ nguyên nhân'));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-bounce">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg text-sm font-medium border ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : toast.type === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />}
            {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />}
            {toast.type === 'info' && <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Báo Cáo & Phân Tích Sản Xuất Đa Chiều
              </h1>
            </div>
            <p className="text-sm text-slate-500">
              Phân tích chi tiết từng ngày làm việc theo nhân viên, tổng hợp so sánh toàn xưởng và xuất báo cáo Excel chuẩn 2 Sheet.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm rounded-xl transition border border-slate-200 disabled:opacity-60"
              title="Làm mới dữ liệu từ hệ thống"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
              <span>{refreshing ? 'Đang tải...' : 'Làm mới'}</span>
            </button>

            <button
              onClick={handleExportExcel}
              disabled={loading || filteredLogs.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-sm rounded-xl shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              title="Tải về file Excel chứa Sheet Chi tiết & Sheet Tổng hợp theo nhân viên"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Xuất Báo Cáo Excel (.xlsx)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Filter Section */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Khoảng thời gian:
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'today', label: 'Hôm nay' },
                { id: 'last_7_days', label: '7 ngày qua' },
                { id: 'this_month', label: 'Tháng này' },
                { id: 'last_month', label: 'Tháng trước' }
              ].map((preset) => {
                const isActive = activePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleApplyPreset(preset.id)}
                    className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}

              {(activePreset === 'custom' || selectedEmployeeId !== 'all' || searchQuery) && (
                <button
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                  title="Đặt lại về mặc định"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Đặt lại</span>
                </button>
              )}
            </div>
          </div>

          {/* Form Filter Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Start Date */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Từ ngày:
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-medium"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Đến ngày:
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-medium"
              />
            </div>

            {/* Employee Dropdown */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Nhân viên cụ thể:
              </label>
              <div className="relative">
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-medium appearance-none"
                >
                  <option value="all">👥 Tất cả nhân viên</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.code})
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                  <User className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            {/* Search Query */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Tìm kiếm nhanh:
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Mã SP, tên SP, khách..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 placeholder-slate-400"
                />
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {/* Card 1: Work Days */}
          <div className="bg-white p-3 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2.5 sm:gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 flex-shrink-0">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Ngày Có Sản Lượng
              </p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-bold text-slate-900">
                  {kpi.workDaysCount}
                </span>
                <span className="text-xs text-slate-500 font-medium">ngày</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {kpi.totalLogs} lượt ghi nhận
              </p>
            </div>
          </div>

          {/* Card 2: Total Quantity */}
          <div className="bg-white p-3 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2.5 sm:gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 flex-shrink-0">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Tổng Sản Phẩm
              </p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-bold text-blue-600">
                  {formatNumber(kpi.totalQuantity)}
                </span>
                <span className="text-xs text-slate-500 font-medium">chiếc / cái</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {kpi.uniqueProductsCount} chủng loại sản phẩm
              </p>
            </div>
          </div>

          {/* Card 3: Total Hours */}
          <div className="bg-white p-3 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2.5 sm:gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 flex-shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Tổng Giờ Làm Việc
              </p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-bold text-slate-900">
                  {formatNumber(kpi.totalHours)}
                </span>
                <span className="text-xs text-slate-500 font-medium">giờ</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                TB {kpi.avgHoursPerDay}h / ngày làm
              </p>
            </div>
          </div>

          {/* Card 4: Average Productivity */}
          <div className="bg-white p-3 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2.5 sm:gap-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl border border-purple-100 flex-shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Năng Suất Bình Quân
              </p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-bold text-purple-600">
                  {kpi.productivityPerHour}
                </span>
                <span className="text-xs text-slate-500 font-medium">sp / giờ</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                TB {kpi.avgQuantityPerDay} sp / ngày
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Operation (Công đoạn) Summary */}
      {!loading && filteredLogs.length > 0 && operationSummaries.length > 0 && (
        <div className="max-w-7xl mx-auto mb-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/60">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-violet-600" />
                <span>Theo công đoạn</span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3">Công đoạn</th>
                    <th className="px-5 py-3 text-right">Số lượng</th>
                    <th className="px-5 py-3 text-right">Số giờ</th>
                    <th className="px-5 py-3 text-right">Số lượt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {operationSummaries.map((op, idx) => (
                    <tr key={op.operation || `none-${idx}`} className="hover:bg-slate-50/70 transition">
                      <td className="px-5 py-2.5 font-semibold text-slate-900">
                        {op.operation || <span className="italic font-normal text-slate-400">Chưa gán công đoạn</span>}
                      </td>
                      <td className="px-5 py-2.5 text-right font-bold text-slate-900">{formatNumber(op.totalQuantity)}</td>
                      <td className="px-5 py-2.5 text-right text-slate-600 font-mono text-xs">{op.totalHours} h</td>
                      <td className="px-5 py-2.5 text-right text-slate-500 font-mono text-xs">{op.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Main View Area: Day-by-Day (Single Emp) vs Overview (All Emps) */}
      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
            <div className="inline-block p-4 bg-blue-50 text-blue-600 rounded-2xl mb-4 animate-spin">
              <RefreshCw className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">Đang tải dữ liệu sản xuất...</h3>
            <p className="text-sm text-slate-500 mt-1">Hệ thống đang tổng hợp dữ liệu từ Supabase</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
            <div className="inline-block p-4 bg-slate-100 text-slate-400 rounded-2xl mb-4">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">Không tìm thấy dữ liệu nhật ký</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Không có sản lượng nào được ghi nhận trong khoảng thời gian từ{' '}
              <span className="font-semibold text-slate-700">{formatDateVN(startDate)}</span> đến{' '}
              <span className="font-semibold text-slate-700">{formatDateVN(endDate)}</span> với các bộ lọc hiện tại.
            </p>
            <button
              onClick={handleResetFilters}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-sm rounded-xl transition"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Đặt lại bộ lọc tìm kiếm</span>
            </button>
          </div>
        ) : selectedEmployeeId !== 'all' ? (
          /* ========================================================================= */
          /* MODE A: DAY-BY-DAY BREAKDOWN CHO 1 NHÂN VIÊN                              */
          /* ========================================================================= */
          <div className="space-y-6">
            {/* Employee Header Banner */}
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center font-bold text-xl text-blue-200">
                  {currentSelectedEmployee ? currentSelectedEmployee.code : 'NV'}
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-bold">
                      {currentSelectedEmployee ? currentSelectedEmployee.full_name : 'Nhân Viên'}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/30 text-blue-200 border border-blue-400/30">
                      Mã: {currentSelectedEmployee ? currentSelectedEmployee.code : ''}
                    </span>
                  </div>
                  <p className="text-xs text-blue-200 mt-1 flex items-center gap-1.5">
                    <span>Kỳ báo cáo: {formatDateVN(startDate)} - {formatDateVN(endDate)}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedEmployeeId('all')}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold transition flex items-center gap-1.5 text-blue-100"
                >
                  <span>Xem toàn xưởng</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* List of Days */}
            <div className="space-y-4">
              {dayGroups.map((group) => (
                <div
                  key={group.date}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
                >
                  {/* Day Header */}
                  <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">
                          {group.dayFormatted}
                        </h4>
                        <span className="text-xs text-slate-500">
                          {formatDateVN(group.date)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-xs font-semibold">
                        Sản lượng: <span className="font-bold text-blue-900">{formatNumber(group.totalQuantity)}</span> cái
                      </div>
                      <div className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
                        Số giờ: <span className="font-bold text-emerald-900">{group.totalHours}</span> h
                      </div>
                      <div className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium">
                        {group.productCount} mặt hàng
                      </div>
                    </div>
                  </div>

                  {/* Day Products Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50/40 text-slate-500 text-xs uppercase font-semibold border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-3">STT</th>
                          <th className="px-6 py-3">Mã #ID</th>
                          <th className="px-6 py-3">Tên sản phẩm / Công nhật</th>
                          <th className="px-6 py-3">Khách hàng</th>
                          <th className="px-6 py-3">Công đoạn / Công nhật</th>
                          <th className="px-6 py-3 text-right">Số lượng</th>
                          <th className="px-6 py-3 text-right">Thời gian</th>
                          <th className="px-6 py-3 text-right">Năng suất</th>
                          <th className="px-6 py-3">Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {group.logs.map((log, idx) => {
                          const isDaily = !log.product_id || Boolean(log.is_daily_work);
                          const prodRate = log.duration_hours > 0 && log.quantity > 0
                            ? Math.round((Number(log.quantity) / Number(log.duration_hours)) * 100) / 100
                            : 0;
                          return (
                            <tr key={log.id || idx} className={isDaily ? 'bg-amber-50/30 hover:bg-amber-50/60 transition' : 'hover:bg-slate-50/70 transition'}>
                              <td className="px-6 py-3 text-xs text-slate-400 font-mono">
                                {idx + 1}
                              </td>
                              <td className="px-6 py-3 font-mono text-xs font-bold">
                                {isDaily ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200 font-sans">
                                    Công nhật
                                  </span>
                                ) : (
                                  <span className="text-blue-600">
                                    #{log.product_id || (log.products && log.products.id) || '---'}
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-3 font-semibold text-slate-900 max-w-xs truncate" title={log.product_name}>
                                {isDaily
                                  ? log.operation || log.daily_work || (log.notes ? `[Ghi chú] ${log.notes}` : 'Công việc công nhật')
                                  : log.product_name || (log.products && log.products.name) || '---'}
                              </td>
                              <td className="px-6 py-3 text-slate-600">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                                  isDaily ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {isDaily ? 'Công nhật' : (log.customer || (log.products && log.products.customer) || 'Nội bộ')}
                                </span>
                              </td>
                              <td className="px-6 py-3 text-xs font-medium text-violet-700">
                                {log.operation ? (
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold ${
                                    isDaily
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : 'bg-violet-50 text-violet-700 border-violet-200'
                                  }`}>
                                    {log.operation}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-6 py-3 text-right font-bold text-slate-900">
                                {isDaily && Number(log.quantity) === 0 ? '—' : formatNumber(log.quantity)}
                              </td>
                              <td className="px-6 py-3 text-right text-slate-600 font-mono text-xs">
                                {log.duration_hours} h
                              </td>
                              <td className="px-6 py-3 text-right text-xs font-semibold text-emerald-600">
                                {isDaily && Number(log.quantity) === 0 ? '—' : `${prodRate} sp/h`}
                              </td>
                              <td className="px-6 py-3 text-xs text-slate-600 max-w-xs truncate" title={log.notes}>
                                {log.notes ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                                    {log.notes}
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* MODE B: BẢNG TỔNG HỢP SO SÁNH TẤT CẢ NHÂN VIÊN TOÀN XƯỞNG               */
          /* ========================================================================= */
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/60">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <span>Bảng Tổng Hợp Sản Lượng Toàn Xưởng (Theo Nhân Viên)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Khoảng thời gian: {formatDateVN(startDate)} đến {formatDateVN(endDate)} • {employeeSummaries.length} nhân viên có phát sinh sản lượng
                </p>
              </div>

              <div className="text-xs text-slate-500 font-medium">
                Nhấp vào <span className="font-semibold text-blue-600">"Xem chi tiết"</span> để mở lịch sử từng ngày của nhân viên đó
              </div>
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3.5">STT</th>
                    <th className="px-4 py-3.5">Mã NV</th>
                    <th className="px-4 py-3.5">Họ và tên</th>
                    <th className="px-4 py-3.5 text-center">Số ngày làm</th>
                    <th className="px-4 py-3.5 text-right">Tổng sản phẩm</th>
                    <th className="px-4 py-3.5 text-right">Tổng giờ</th>
                    <th className="px-4 py-3.5">Công nhật</th>
                    <th className="px-4 py-3.5">Ghi chú</th>
                    <th className="px-4 py-3.5 text-right">Năng suất (sp/h)</th>
                    <th className="px-4 py-3.5 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {employeeSummaries.map((emp, index) => (
                    <tr
                      key={emp.employeeCode || index}
                      className="hover:bg-blue-50/40 transition cursor-pointer group"
                      onClick={() => {
                        if (emp.employeeId) {
                          setSelectedEmployeeId(emp.employeeId);
                        } else {
                          setSelectedEmployeeId(emp.employeeCode);
                        }
                      }}
                    >
                      <td className="px-4 py-4 text-xs font-mono text-slate-400">
                        {index + 1}
                      </td>
                      <td className="px-4 py-4 font-mono text-xs font-bold text-blue-600">
                        {emp.employeeCode}
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-900 group-hover:text-blue-700 transition">
                        {emp.employeeName}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          {emp.workDaysCount} ngày
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-slate-900">
                        {formatNumber(emp.totalQuantity)}
                      </td>
                      <td className="px-4 py-4 text-right text-slate-600 font-mono text-xs">
                        {emp.totalHours} h
                      </td>
                      <td className="px-4 py-4 text-xs max-w-[220px]" title={emp.dailyWorkSummary}>
                        {emp.dailyWorkSummary || emp.dailyWorkHours > 0 ? (
                          <div className="space-y-0.5">
                            {emp.dailyWorkHours > 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 mr-1">
                                {emp.dailyWorkHours}h
                              </span>
                            )}
                            <span className="text-slate-700 line-clamp-1">{emp.dailyWorkSummary || 'Công nhật'}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-600 max-w-[180px] truncate" title={emp.notesSummary}>
                        {emp.notesSummary ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                            {emp.notesSummary}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right text-xs font-bold text-emerald-600">
                        {emp.productivityPerHour}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (emp.employeeId) {
                              setSelectedEmployeeId(emp.employeeId);
                            } else {
                              setSelectedEmployeeId(emp.employeeCode);
                            }
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white text-xs font-semibold transition"
                        >
                          <span>Xem chi tiết</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Employee Summary Cards (< md) */}
            <div className="md:hidden divide-y divide-slate-100 p-2.5 space-y-2.5">
              {employeeSummaries.map((emp, index) => (
                <div
                  key={emp.employeeCode || index}
                  onClick={() => {
                    if (emp.employeeId) {
                      setSelectedEmployeeId(emp.employeeId);
                    } else {
                      setSelectedEmployeeId(emp.employeeCode);
                    }
                  }}
                  className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs cursor-pointer active:bg-blue-50/50 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-mono text-[10px] font-bold">
                          {index + 1}
                        </span>
                        <span className="font-mono text-xs font-bold text-blue-600">
                          #{emp.employeeCode}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-slate-900 mt-1">{emp.employeeName}</div>
                    </div>

                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      {emp.workDaysCount} ngày làm
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-slate-100 text-center">
                    <div className="bg-slate-50 p-1.5 rounded-lg">
                      <div className="text-[10px] uppercase font-semibold text-slate-400">Tổng SP</div>
                      <div className="text-sm font-bold text-slate-900">{formatNumber(emp.totalQuantity)}</div>
                    </div>
                    <div className="bg-slate-50 p-1.5 rounded-lg">
                      <div className="text-[10px] uppercase font-semibold text-slate-400">Tổng Giờ</div>
                      <div className="text-sm font-bold text-slate-900">{emp.totalHours}h</div>
                    </div>
                    <div className="bg-emerald-50 p-1.5 rounded-lg border border-emerald-100">
                      <div className="text-[10px] uppercase font-semibold text-emerald-600">Năng Suất</div>
                      <div className="text-sm font-bold text-emerald-700">{emp.productivityPerHour}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1 mt-2.5 pt-2 border-t border-slate-100 text-xs font-semibold text-blue-600">
                    <span>Xem lịch sử từng ngày</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
