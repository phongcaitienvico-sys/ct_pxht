import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Upload,
  Download,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  FileSpreadsheet,
  X,
  Check,
  Building2,
  Info
} from 'lucide-react';

import {
  getTeams,
  getEmployees,
  upsertEmployees,
  deleteEmployee
} from '../../lib/supabase.js';

import {
  parseEmployeeExcel,
  generateEmployeeTemplate
} from '../../lib/excel.js';

import { normalizeSearchText } from './realtimeFeedLogic.js';

/**
 * Match a raw team name from Excel to an existing team ID in database
 */
function resolveTeamId(teamName, teams) {
  if (!teamName || !Array.isArray(teams) || teams.length === 0) return null;
  const norm = normalizeSearchText(teamName);

  // 1. Exact match or contains
  const found = teams.find((t) => {
    const tNorm = normalizeSearchText(t.name);
    return tNorm === norm || tNorm.includes(norm) || norm.includes(tNorm);
  });
  if (found) return found.id;

  // 2. Check "to 1", "to 2" etc.
  const numMatch = norm.match(/\d+/);
  if (numMatch) {
    const num = numMatch[0];
    const teamByNum = teams.find((t) => normalizeSearchText(t.name).includes(num));
    if (teamByNum) return teamByNum.id;
  }

  return teams[0]?.id || null;
}

export default function EmployeeManager() {
  // Data states
  const [employees, setEmployees] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success' | 'error' | 'info', message: string }

  // Search & Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'

  // Modal Thêm / Sửa states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null); // null = Add, object = Edit
  const [formData, setFormData] = useState({
    id: '',
    code: '',
    full_name: '',
    team_id: '',
    is_active: true
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal Import Excel states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [parsedPreview, setParsedPreview] = useState([]);
  const [importError, setImportError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);

  // Modal Xóa states
  const [deletingEmployee, setDeletingEmployee] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Show Toast notification
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Load initial data
  const fetchData = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const [teamsData, employeesData] = await Promise.all([
        getTeams(),
        getEmployees()
      ]);

      setTeams(teamsData || []);
      setEmployees(employeesData || []);
    } catch (err) {
      console.error('Error loading employee data:', err);
      showToast('error', 'Không thể tải danh sách nhân viên: ' + (err.message || 'Lỗi kết nối'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Map team ID to Team Name helper
  const teamMap = useMemo(() => {
    const map = new Map();
    teams.forEach((t) => map.set(t.id, t.name));
    return map;
  }, [teams]);

  // Filtered employees list
  const filteredEmployees = useMemo(() => {
    const query = normalizeSearchText(searchTerm);
    return employees.filter((emp) => {
      if (!emp) return false;

      // 1. Team filter
      if (teamFilter !== 'all' && emp.team_id !== teamFilter) {
        return false;
      }

      // 2. Status filter
      if (statusFilter === 'active' && !emp.is_active) return false;
      if (statusFilter === 'inactive' && emp.is_active) return false;

      // 3. Search query (code or full_name)
      if (query) {
        const codeNorm = normalizeSearchText(emp.code);
        const nameNorm = normalizeSearchText(emp.full_name);
        const teamName = normalizeSearchText(teamMap.get(emp.team_id) || '');
        if (!codeNorm.includes(query) && !nameNorm.includes(query) && !teamName.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [employees, teamFilter, statusFilter, searchTerm, teamMap]);

  // Statistics
  const stats = useMemo(() => {
    const total = employees.length;
    let active = 0;
    employees.forEach((e) => {
      if (e.is_active) active++;
    });
    return {
      total,
      active,
      inactive: total - active,
      teamsCount: teams.length
    };
  }, [employees, teams]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    setEditingEmployee(null);
    setFormData({
      id: '',
      code: `NV${String(employees.length + 1).padStart(2, '0')}`,
      full_name: '',
      team_id: teams[0]?.id || '',
      is_active: true
    });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (emp) => {
    setEditingEmployee(emp);
    setFormData({
      id: emp.id || '',
      code: emp.code || '',
      full_name: emp.full_name || '',
      team_id: emp.team_id || (teams[0]?.id || ''),
      is_active: emp.is_active !== undefined ? Boolean(emp.is_active) : true
    });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  // Validate form
  const validateForm = () => {
    const errors = {};
    const trimmedCode = String(formData.code || '').trim();
    const trimmedName = String(formData.full_name || '').trim();

    if (!trimmedCode) {
      errors.code = 'Mã nhân viên không được để trống';
    } else {
      // Check duplicate code (excluding current editing employee)
      const isDuplicate = employees.some(
        (e) =>
          normalizeSearchText(e.code) === normalizeSearchText(trimmedCode) &&
          (!editingEmployee || e.id !== editingEmployee.id)
      );
      if (isDuplicate) {
        errors.code = `Mã "${trimmedCode}" đã tồn tại trong xưởng`;
      }
    }

    if (!trimmedName) {
      errors.full_name = 'Họ và tên nhân viên không được để trống';
    }

    if (!formData.team_id) {
      errors.team_id = 'Vui lòng chọn Tổ sản xuất';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Add / Edit
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      const record = {
        id: formData.id || undefined,
        code: String(formData.code).trim().toUpperCase(),
        full_name: String(formData.full_name).trim(),
        team_id: formData.team_id,
        is_active: Boolean(formData.is_active)
      };

      await upsertEmployees([record]);
      await fetchData(true);

      showToast(
        'success',
        editingEmployee
          ? `Cập nhật thông tin công nhân ${record.code} thành công!`
          : `Thêm công nhân mới ${record.code} thành công!`
      );
      setIsFormModalOpen(false);
    } catch (err) {
      console.error('Error saving employee:', err);
      showToast('error', 'Lưu thông tin thất bại: ' + (err.message || 'Lỗi hệ thống'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle active status
  const handleToggleActive = async (emp) => {
    try {
      const updated = {
        ...emp,
        is_active: !emp.is_active
      };
      await upsertEmployees([updated]);
      setEmployees((prev) =>
        prev.map((e) => (e.id === emp.id ? { ...e, is_active: !e.is_active } : e))
      );
      showToast(
        'success',
        `${updated.is_active ? 'Kích hoạt' : 'Tạm dừng'} công nhân ${emp.full_name}`
      );
    } catch (err) {
      console.error('Error toggling status:', err);
      showToast('error', 'Không thể đổi trạng thái nhân viên');
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deletingEmployee) return;
    try {
      setIsDeleting(true);
      await deleteEmployee(deletingEmployee.id);
      setEmployees((prev) => prev.filter((e) => e.id !== deletingEmployee.id));
      showToast('success', `Đã xóa nhân viên ${deletingEmployee.full_name} (${deletingEmployee.code})`);
      setDeletingEmployee(null);
    } catch (err) {
      console.error('Error deleting employee:', err);
      showToast('error', 'Xóa nhân viên thất bại: ' + (err.message || 'Lỗi hệ thống'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Download Excel Template
  const handleDownloadTemplate = () => {
    try {
      generateEmployeeTemplate({ fileName: 'Mau_Danh_Sach_Nhan_Vien_PXHT.xlsx' });
      showToast('success', 'Đã tải xuống file mẫu Excel danh sách nhân viên');
    } catch (err) {
      console.error('Download template error:', err);
      showToast('error', 'Không thể tải file mẫu: ' + err.message);
    }
  };

  // Open Import Modal
  const handleOpenImportModal = () => {
    setImportFile(null);
    setParsedPreview([]);
    setImportError('');
    setIsImportModalOpen(true);
  };

  // Handle file select for Excel Import
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportError('');

    try {
      const buffer = await file.arrayBuffer();
      const rawParsed = parseEmployeeExcel(buffer);

      if (!rawParsed || rawParsed.length === 0) {
        setImportError('File không chứa dữ liệu nhân viên hợp lệ hoặc định dạng cột chưa đúng.');
        setParsedPreview([]);
        return;
      }

      // Map parsed employees with team IDs
      const mapped = rawParsed.map((item) => {
        const teamId = resolveTeamId(item.team_name, teams);
        return {
          code: item.code,
          full_name: item.full_name,
          team_id: teamId,
          team_name_raw: item.team_name || '',
          team_name_resolved: teamMap.get(teamId) || 'Chưa phân tổ',
          is_active: item.is_active !== undefined ? Boolean(item.is_active) : true
        };
      });

      setParsedPreview(mapped);
    } catch (err) {
      console.error('Parse Excel error:', err);
      setImportError('Lỗi đọc file Excel: ' + (err.message || 'File hỏng hoặc không đúng định dạng'));
      setParsedPreview([]);
    }
  };

  // Execute Import
  const handleExecuteImport = async () => {
    if (parsedPreview.length === 0) return;

    try {
      setIsImporting(true);
      const employeesToUpsert = parsedPreview.map((item) => ({
        code: item.code,
        full_name: item.full_name,
        team_id: item.team_id,
        is_active: item.is_active
      }));

      await upsertEmployees(employeesToUpsert);
      await fetchData(true);

      showToast('success', `Đã nhập thành công ${employeesToUpsert.length} nhân viên vào hệ thống!`);
      setIsImportModalOpen(false);
    } catch (err) {
      console.error('Import error:', err);
      setImportError('Nhập dữ liệu thất bại: ' + (err.message || 'Lỗi lưu database'));
    } finally {
      setIsImporting(false);
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
          {toast.type === 'info' && <Info className="w-5 h-5 text-blue-600" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-800">
              Quản Lý Nhân Viên & Công Nhân
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
              {stats.total} nhân sự
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Danh sách nhân viên theo tổ cơ khí, phân quyền và trạng thái công việc
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
          {/* Refresh Button */}
          <button
            onClick={() => fetchData(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">Làm mới</span>
          </button>

          {/* Download Template */}
          <button
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Tải Mẫu Excel</span>
          </button>

          {/* Import Excel */}
          <button
            onClick={handleOpenImportModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Import Excel</span>
          </button>

          {/* Add Employee Button */}
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            <span>Thêm Nhân Viên</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
            <div className="text-xs text-slate-500">Tổng công nhân</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-600">{stats.active}</div>
            <div className="text-xs text-slate-500">Đang hoạt động</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-700">{stats.inactive}</div>
            <div className="text-xs text-slate-500">Tạm nghỉ / Đã nghỉ</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-indigo-600">{stats.teamsCount}</div>
            <div className="text-xs text-slate-500">Tổ sản xuất</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo họ tên hoặc mã NV (ví dụ: NV01, Hùng)..."
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

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
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

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 border border-slate-200 rounded-lg">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-medium text-slate-700 bg-transparent border-none focus:outline-none cursor-pointer pr-2"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Tạm nghỉ</option>
            </select>
          </div>

          {/* Reset Filters */}
          {(searchTerm || teamFilter !== 'all' || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setTeamFilter('all');
                setStatusFilter('all');
              }}
              className="px-2.5 py-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline"
            >
              Đặt lại
            </button>
          )}
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
            <p className="text-sm">Đang tải danh sách nhân viên...</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-base font-semibold text-slate-700">Không tìm thấy nhân viên phù hợp</p>
            <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
              Thử thay đổi từ khóa tìm kiếm hoặc chọn lọc theo tổ khác.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">STT</th>
                  <th className="py-3 px-4">Mã NV</th>
                  <th className="py-3 px-4">Họ và Tên</th>
                  <th className="py-3 px-4">Tổ / Bộ Phận</th>
                  <th className="py-3 px-4 text-center">Trạng Thái</th>
                  <th className="py-3 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp, idx) => {
                  const teamName = teamMap.get(emp.team_id) || 'Chưa phân tổ';
                  const initials = emp.full_name
                    ? emp.full_name
                        .split(' ')
                        .filter(Boolean)
                        .slice(-2)
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                    : 'NV';

                  return (
                    <tr
                      key={emp.id || emp.code}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* STT */}
                      <td className="py-3.5 px-4 text-center text-xs text-slate-400">
                        {idx + 1}
                      </td>

                      {/* Mã NV */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-mono text-xs font-semibold border border-slate-200">
                          {emp.code}
                        </span>
                      </td>

                      {/* Họ và Tên */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800">
                              {emp.full_name}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Tổ / Phân Xưởng */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          <Building2 className="w-3 h-3 text-blue-500" />
                          {teamName}
                        </span>
                      </td>

                      {/* Trạng Thái */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleToggleActive(emp)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                            emp.is_active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                          }`}
                          title="Bấm để bật/tắt hoạt động"
                        >
                          {emp.is_active ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span>Hoạt động</span>
                            </>
                          ) : (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              <span>Tạm nghỉ</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Thao Tác */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEditModal(emp)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Sửa thông tin"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeletingEmployee(emp)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="Xóa nhân viên"
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

          {/* Mobile Employee Cards (< md) */}
          <div className="md:hidden divide-y divide-slate-100 p-2.5 space-y-2.5">
            {filteredEmployees.map((emp) => {
              const teamName = teamMap.get(emp.team_id) || 'Chưa phân tổ';
              const initials = emp.full_name
                ? emp.full_name
                    .split(' ')
                    .filter(Boolean)
                    .slice(-2)
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                : 'NV';

              return (
                <div
                  key={emp.id || emp.code}
                  className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {initials}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">{emp.full_name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-xs font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                            {emp.code}
                          </span>
                          <span className="text-xs text-blue-700 font-medium">
                            {teamName}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleActive(emp)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                        emp.is_active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {emp.is_active ? '✓ Hoạt động' : 'Tạm nghỉ'}
                    </button>
                  </div>

                  <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleOpenEditModal(emp)}
                      className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Sửa
                    </button>
                    <button
                      onClick={() => setDeletingEmployee(emp)}
                      className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
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
      {/* MODAL THÊM / SỬA NHÂN VIÊN */}
      {/* ===================================================================== */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-800">
                  {editingEmployee ? 'Cập Nhật Thông Tin Nhân Viên' : 'Thêm Nhân Viên Mới'}
                </h3>
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitForm} className="p-6 space-y-4">
              {/* Mã NV */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Mã Nhân Viên <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                  }
                  placeholder="Ví dụ: NV01, NV02..."
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 font-mono ${
                    formErrors.code
                      ? 'border-rose-400 focus:ring-rose-200'
                      : 'border-slate-300 focus:ring-blue-100 focus:border-blue-500'
                  }`}
                />
                {formErrors.code && (
                  <p className="text-xs text-rose-500 mt-1">{formErrors.code}</p>
                )}
              </div>

              {/* Họ và Tên */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Họ và Tên <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                  placeholder="Ví dụ: Trần Văn Hùng"
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                    formErrors.full_name
                      ? 'border-rose-400 focus:ring-rose-200'
                      : 'border-slate-300 focus:ring-blue-100 focus:border-blue-500'
                  }`}
                />
                {formErrors.full_name && (
                  <p className="text-xs text-rose-500 mt-1">{formErrors.full_name}</p>
                )}
              </div>

              {/* Tổ sản xuất */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Tổ Sản Xuất <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.team_id}
                  onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 bg-white"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                {formErrors.team_id && (
                  <p className="text-xs text-rose-500 mt-1">{formErrors.team_id}</p>
                )}
              </div>

              {/* Trạng thái hoạt động */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) =>
                      setFormData({ ...formData, is_active: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Đang làm việc tại xưởng (Hoạt động)
                  </span>
                </label>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingEmployee ? 'Lưu Thay Đổi' : 'Thêm Nhân Viên'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL IMPORT EXCEL */}
      {/* ===================================================================== */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-800">
                  Import Danh Sách Nhân Viên Từ Excel
                </h3>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Template Download Banner */}
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-950">Chưa có file mẫu nhân sự?</h4>
                    <p className="text-xs text-emerald-800/80 mt-0.5">
                      Tải file mẫu chuẩn (.xlsx) có sẵn cột: <strong>Mã NV</strong>, <strong>Họ và tên</strong>, <strong>Tổ / Bộ phận</strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-all shrink-0 hover:shadow"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải File Mẫu (.xlsx)</span>
                </button>
              </div>

              {/* File Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-emerald-50/20"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                />
                <Upload className="w-10 h-10 text-slate-400 hover:text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">
                  {importFile ? importFile.name : 'Bấm để chọn file Excel (.xlsx, .xls)'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Hệ thống tự động nhận diện các cột: Mã NV, Họ và Tên, Tổ / Bộ Phận
                </p>
              </div>

              {/* Error Message */}
              {importError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Parsed Preview Table */}
              {parsedPreview.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 uppercase">
                      Xem Trước Dữ Liệu ({parsedPreview.length} nhân viên)
                    </span>
                    <span className="text-xs text-emerald-600 font-medium">
                      Đã khớp thông tin tự động
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0">
                        <tr>
                          <th className="p-2 w-10 text-center">STT</th>
                          <th className="p-2">Mã NV</th>
                          <th className="p-2">Họ Tên</th>
                          <th className="p-2">Tổ Ghép Khớp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedPreview.map((item, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-2 text-center text-slate-400">{i + 1}</td>
                            <td className="p-2 font-mono font-semibold text-slate-800">
                              {item.code}
                            </td>
                            <td className="p-2 text-slate-700">{item.full_name}</td>
                            <td className="p-2">
                              <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium text-[11px]">
                                {item.team_name_resolved}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50 shrink-0">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="text-xs text-slate-600 hover:text-blue-600 flex items-center gap-1 font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Chưa có mẫu? Tải file mẫu tại đây</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={parsedPreview.length === 0 || isImporting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {isImporting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Xác Nhận Import ({parsedPreview.length})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL XÁC NHẬN XÓA */}
      {/* ===================================================================== */}
      {deletingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full border border-slate-200 p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Xóa Nhân Viên</h3>
                <p className="text-xs text-slate-500">Hành động này không thể hoàn tác</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-6">
              Bạn có chắc chắn muốn xóa nhân viên{' '}
              <span className="font-semibold text-slate-800">
                {deletingEmployee.full_name} ({deletingEmployee.code})
              </span>{' '}
              khỏi danh sách phân xưởng?
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingEmployee(null)}
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
