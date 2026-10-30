import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Boxes,
  CheckCircle2,
  PowerOff,
  Search,
  Filter,
  Plus,
  Upload,
  Download,
  RotateCcw,
  Check,
  X,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileSpreadsheet,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Info
} from 'lucide-react';

import {
  calculateProductStats,
  extractCustomerOptions,
  filterProducts,
  paginateProducts,
  toggleSingleProduct,
  bulkToggleProducts,
  resetShiftProducts,
  validateProductInput
} from './productManagerLogic.js';

import {
  getProducts,
  updateProductToggle,
  bulkUpdateProductToggle,
  upsertProducts,
  deleteProduct
} from '../../lib/supabase.js';

import {
  parseProductExcel,
  generateProductTemplate
} from '../../lib/excel.js';

export default function ProductManager() {
  // Products state
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success' | 'error' | 'info', message: string }

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active_only' | 'inactive_only'

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Selected items for bulk operations (Set of IDs)
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null); // null = Add, object = Edit
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    customer: '',
    order_quantity: 0,
    blank_quantity: 0,
    status: 'Sx',
    is_active_today: false
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Import Modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [parsedPreview, setParsedPreview] = useState([]);
  const [importError, setImportError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);

  // Confirm Reset Shift Dialog state
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Delete Confirm Dialog state
  const [deletingProductId, setDeletingProductId] = useState(null);

  // Show Toast helper
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 3500);
  };

  // Fetch products from database
  const loadProducts = async (showLoadingSpinner = true) => {
    try {
      if (showLoadingSpinner) setLoading(true);
      else setRefreshing(true);

      const data = await getProducts();
      setProducts(data || []);
    } catch (err) {
      console.error('Error loading products:', err);
      showToast('error', 'Không thể tải danh sách sản phẩm: ' + err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // Quick stats calculation
  const stats = useMemo(() => calculateProductStats(products), [products]);

  // Customer dropdown options
  const customerOptions = useMemo(() => extractCustomerOptions(products), [products]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return filterProducts(products, {
      searchTerm,
      customerFilter,
      statusFilter
    });
  }, [products, searchTerm, customerFilter, statusFilter]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, customerFilter, statusFilter]);

  // Paginated products
  const paginationData = useMemo(() => {
    return paginateProducts(filteredProducts, page, pageSize);
  }, [filteredProducts, page, pageSize]);

  // Selected checkbox helpers
  const currentPageIds = useMemo(() => {
    return paginationData.items.map((p) => String(p.id));
  }, [paginationData.items]);

  const isAllCurrentPageSelected =
    currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.has(id));

  const isSomeCurrentPageSelected =
    currentPageIds.some((id) => selectedIds.has(id)) && !isAllCurrentPageSelected;

  const handleToggleSelectPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isAllCurrentPageSelected) {
        currentPageIds.forEach((id) => next.delete(id));
      } else {
        currentPageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleToggleSelectItem = (id) => {
    const strId = String(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(strId)) next.delete(strId);
      else next.add(strId);
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    const allFilteredIds = filteredProducts.map((p) => String(p.id));
    setSelectedIds(new Set(allFilteredIds));
    showToast('info', `Đã chọn toàn bộ ${allFilteredIds.length} sản phẩm theo bộ lọc`);
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  // ---------------------------------------------------------------------------
  // TOGGLE ACTIONS
  // ---------------------------------------------------------------------------

  // Single Toggle
  const handleToggleProduct = async (product) => {
    const targetId = String(product.id);
    const nextState = !Boolean(product.is_active_today);

    // Optimistic update
    setProducts((prev) => toggleSingleProduct(prev, targetId, nextState));

    try {
      await updateProductToggle(targetId, nextState);
      showToast('success', `${nextState ? 'Đã bật' : 'Đã tắt'} sản phẩm "${product.name}"`);
    } catch (err) {
      console.error('Toggle error:', err);
      // Revert optimistic update
      setProducts((prev) => toggleSingleProduct(prev, targetId, !nextState));
      showToast('error', 'Lỗi khi cập nhật trạng thái: ' + err.message);
    }
  };

  // Bulk Toggle for Selected or All Filtered
  const handleBulkToggle = async (nextState) => {
    let targetIds = [];
    if (selectedIds.size > 0) {
      targetIds = Array.from(selectedIds);
    } else {
      targetIds = filteredProducts.map((p) => String(p.id));
    }

    if (targetIds.length === 0) {
      showToast('info', 'Không có sản phẩm nào để cập nhật');
      return;
    }

    const actionText = nextState ? 'Bật' : 'Tắt';

    // Optimistic UI update
    setProducts((prev) => bulkToggleProducts(prev, targetIds, nextState));

    try {
      await bulkUpdateProductToggle(targetIds, nextState);
      showToast('success', `Đã ${actionText.toLowerCase()} thành công ${targetIds.length} sản phẩm`);
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Bulk toggle error:', err);
      loadProducts(false);
      showToast('error', `Lỗi khi ${actionText.toLowerCase()} sản phẩm: ` + err.message);
    }
  };

  // Reset shift (deactivate all products)
  const handleResetShift = async () => {
    setIsResetting(true);
    try {
      // Optimistic update
      setProducts((prev) => resetShiftProducts(prev));
      await bulkUpdateProductToggle('all', false);
      setSelectedIds(new Set());
      setIsResetConfirmOpen(false);
      showToast('success', 'Đã tắt toàn bộ sản phẩm hôm nay. Ca mới sẵn sàng!');
    } catch (err) {
      console.error('Reset shift error:', err);
      loadProducts(false);
      showToast('error', 'Lỗi khi reset ca: ' + err.message);
    } finally {
      setIsResetting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // ADD / EDIT FORM
  // ---------------------------------------------------------------------------

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormData({
      id: '',
      name: '',
      customer: '',
      order_quantity: 0,
      blank_quantity: 0,
      status: 'Sx',
      is_active_today: false
    });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (product) => {
    setEditingProduct(product);
    setFormData({
      id: product.id || '',
      name: product.name || '',
      customer: product.customer || '',
      order_quantity: product.order_quantity || 0,
      blank_quantity: product.blank_quantity || 0,
      status: product.status || 'Sx',
      is_active_today: Boolean(product.is_active_today)
    });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const validation = validateProductInput(formData);

    if (!validation.valid) {
      setFormErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);
    try {
      await upsertProducts([validation.sanitized]);
      showToast('success', editingProduct ? 'Đã cập nhật sản phẩm thành công' : 'Đã thêm sản phẩm mới thành công');
      setIsFormModalOpen(false);
      await loadProducts(false);
    } catch (err) {
      console.error('Save product error:', err);
      showToast('error', 'Lỗi khi lưu sản phẩm: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete product
  const handleDeleteProduct = async (id) => {
    try {
      await deleteProduct(id);
      setProducts((prev) => prev.filter((p) => String(p.id) !== String(id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(String(id));
        return next;
      });
      setDeletingProductId(null);
      showToast('success', 'Đã xóa sản phẩm khỏi danh mục');
    } catch (err) {
      console.error('Delete product error:', err);
      showToast('error', 'Lỗi khi xóa sản phẩm: ' + err.message);
    }
  };

  // ---------------------------------------------------------------------------
  // EXCEL IMPORT & TEMPLATE DOWNLOAD
  // ---------------------------------------------------------------------------

  const handleDownloadTemplate = () => {
    try {
      generateProductTemplate();
      showToast('success', 'Đang tải file mẫu danh mục sản phẩm (Mau_Danh_Muc_San_Pham.xlsx)');
    } catch (err) {
      console.error('Template download error:', err);
      showToast('error', 'Không thể tạo file mẫu: ' + err.message);
    }
  };

  const handleOpenImportModal = () => {
    setImportFile(null);
    setParsedPreview([]);
    setImportError('');
    setIsImportModalOpen(true);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportError('');

    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseProductExcel(buffer);

      if (!parsed || parsed.length === 0) {
        setImportError('File không chứa dữ liệu sản phẩm hợp lệ hoặc thiếu cột bắt buộc.');
        setParsedPreview([]);
      } else {
        setParsedPreview(parsed);
      }
    } catch (err) {
      console.error('File parsing error:', err);
      setImportError('Lỗi đọc file Excel: ' + (err.message || 'Định dạng file không được hỗ trợ'));
      setParsedPreview([]);
    }
  };

  const handleConfirmImport = async () => {
    if (!parsedPreview || parsedPreview.length === 0) {
      setImportError('Không có dữ liệu hợp lệ để nhập.');
      return;
    }

    setIsImporting(true);
    try {
      await upsertProducts(parsedPreview);
      showToast('success', `Đã nhập thành công ${parsedPreview.length} sản phẩm vào hệ thống!`);
      setIsImportModalOpen(false);
      await loadProducts(false);
    } catch (err) {
      console.error('Import save error:', err);
      setImportError('Lỗi lưu dữ liệu: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setCustomerFilter('all');
    setStatusFilter('all');
  };

  const isFilterActive = searchTerm !== '' || customerFilter !== 'all' || statusFilter !== 'all';

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-fadeIn">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center px-4 py-3 rounded-xl shadow-xl text-sm font-medium border transition-all transform animate-bounce-subtle ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : toast.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-blue-50 text-blue-800 border-blue-200'
          }`}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 mr-2 text-emerald-600 flex-shrink-0" />}
          {toast.type === 'error' && <AlertTriangle className="w-5 h-5 mr-2 text-rose-600 flex-shrink-0" />}
          {toast.type === 'info' && <Info className="w-5 h-5 mr-2 text-blue-600 flex-shrink-0" />}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-3 p-1 rounded-md hover:bg-black/5 text-slate-500 hover:text-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl text-white shadow-md shadow-blue-500/20">
            <Boxes className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Quản Lý Danh Mục & Bật/Tắt Sản Phẩm Hôm Nay
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Chọn các mã sản phẩm cần gia công hôm nay để Tổ trưởng nhìn thấy và nhập nhật ký sản xuất
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full md:w-auto">
          <button
            onClick={handleDownloadTemplate}
            className="inline-flex items-center px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors border border-slate-200"
            title="Tải file mẫu Excel"
          >
            <Download className="w-4 h-4 mr-1.5 text-slate-600" />
            File Mẫu
          </button>

          <button
            onClick={handleOpenImportModal}
            className="inline-flex items-center px-3.5 py-2 text-xs sm:text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors border border-indigo-200"
          >
            <Upload className="w-4 h-4 mr-1.5 text-indigo-600" />
            Import Excel
          </button>

          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm shadow-blue-600/30 transition-all hover:shadow"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Thêm Sản Phẩm
          </button>

          <button
            onClick={() => loadProducts(false)}
            disabled={refreshing}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
            title="Tải lại danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Total Products */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tổng Số Mã Sản Phẩm</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total.toLocaleString('vi-VN')}</p>
            <p className="text-xs text-slate-400 mt-0.5">Trong toàn bộ danh mục</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
            <Boxes className="w-6 h-6" />
          </div>
        </div>

        {/* Active Today */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-200/80 shadow-sm flex items-center justify-between bg-gradient-to-br from-white to-emerald-50/30">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Đang Bật Làm Hôm Nay</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.activeCount.toLocaleString('vi-VN')}</p>
            <p className="text-xs text-emerald-600/80 mt-0.5">Hiển thị trong ca làm việc</p>
          </div>
          <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Inactive Products */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Đang Tắt (Chờ Ca)</p>
            <p className="text-2xl font-bold text-slate-600 mt-1">{stats.inactiveCount.toLocaleString('vi-VN')}</p>
            <p className="text-xs text-slate-400 mt-0.5">Không xuất hiện trong ca</p>
          </div>
          <div className="p-3 bg-slate-100 text-slate-600 rounded-xl border border-slate-200">
            <PowerOff className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Toolbar Card */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên sản phẩm hoặc khách hàng..."
              className="w-full pl-10 pr-9 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800 placeholder-slate-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filters Group */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Customer Dropdown */}
            <div className="relative min-w-[160px]">
              <select
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                className="w-full pl-3 pr-8 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700 transition-all appearance-none cursor-pointer"
              >
                <option value="all">Tất cả Khách hàng</option>
                {customerOptions.map((cust) => (
                  <option key={cust} value={cust}>
                    {cust}
                  </option>
                ))}
              </select>
              <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Status Dropdown */}
            <div className="relative min-w-[150px]">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-3 pr-8 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700 transition-all appearance-none cursor-pointer"
              >
                <option value="all">Tất cả Trạng thái</option>
                <option value="active_only">Chỉ SP Đang Bật</option>
                <option value="inactive_only">Chỉ SP Đang Tắt</option>
              </select>
              <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Clear Filters Button */}
            {isFilterActive && (
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors border border-slate-200"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Xóa lọc
              </button>
            )}
          </div>
        </div>

        {/* Bulk Action Controls */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-700">
              Kết quả: <span className="text-blue-600">{filteredProducts.length}</span> sản phẩm
            </span>
            {selectedIds.size > 0 ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                Đã chọn {selectedIds.size} mục
                <button onClick={handleDeselectAll} className="ml-1.5 hover:text-blue-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ) : (
              <button
                onClick={handleSelectAllFiltered}
                className="text-xs text-blue-600 hover:text-blue-800 underline font-medium"
              >
                Chọn tất cả {filteredProducts.length} kết quả
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleBulkToggle(true)}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 transition-colors shadow-sm"
              title="Bật hôm nay cho các mục đã chọn hoặc tất cả kết quả đang lọc"
            >
              <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              {selectedIds.size > 0 ? `Bật (${selectedIds.size}) mục` : '✓ Bật tất cả kết quả'}
            </button>

            <button
              onClick={() => handleBulkToggle(false)}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition-colors shadow-sm"
              title="Tắt hôm nay cho các mục đã chọn hoặc tất cả kết quả đang lọc"
            >
              <X className="w-3.5 h-3.5 mr-1 text-slate-500" />
              {selectedIds.size > 0 ? `Tắt (${selectedIds.size}) mục` : '✕ Tắt tất cả kết quả'}
            </button>

            <button
              onClick={() => setIsResetConfirmOpen(true)}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition-colors shadow-sm"
              title="Tắt toàn bộ sản phẩm trong hệ thống để chuẩn bị ca mới"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1 text-rose-600" />
              🔄 Tắt tất cả hôm nay (Reset ca)
            </button>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-sm text-slate-500">Đang tải danh mục sản phẩm...</p>
          </div>
        ) : paginationData.items.length === 0 ? (
          <div className="py-16 text-center px-4">
            <Boxes className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">Không tìm thấy sản phẩm nào</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Không có sản phẩm nào khớp với bộ lọc hoặc từ khóa tìm kiếm hiện tại.
            </p>
            {isFilterActive && (
              <button
                onClick={handleClearFilters}
                className="mt-4 inline-flex items-center px-3.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition-colors"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-600">
                  <th className="py-3.5 pl-4 pr-2 w-10">
                    <input
                      type="checkbox"
                      checked={isAllCurrentPageSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeCurrentPageSelected;
                      }}
                      onChange={handleToggleSelectPage}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                  </th>
                  <th className="py-3.5 px-3 text-center w-36">Bật/Tắt Hôm Nay</th>
                  <th className="py-3.5 px-3">Tên Sản Phẩm</th>
                  <th className="py-3.5 px-3">Khách Hàng</th>
                  <th className="py-3.5 px-3 text-right">SL Đơn</th>
                  <th className="py-3.5 px-3 text-right">SL Phôi</th>
                  <th className="py-3.5 pr-4 pl-3 text-center w-24">Hành Động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginationData.items.map((prod) => {
                  const isActive = Boolean(prod.is_active_today);
                  const isChecked = selectedIds.has(String(prod.id));

                  return (
                    <tr
                      key={prod.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isActive ? 'bg-emerald-50/20' : ''
                      } ${isChecked ? 'bg-blue-50/40' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 pl-4 pr-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelectItem(prod.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                        />
                      </td>

                      {/* Toggle Switch */}
                      <td className="py-3.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleProduct(prod)}
                          className={`relative inline-flex h-6 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                            isActive ? 'bg-emerald-600' : 'bg-slate-300'
                          }`}
                          role="switch"
                          aria-checked={isActive}
                          title={isActive ? 'Nhấp để TẮT sản phẩm hôm nay' : 'Nhấp để BẬT sản phẩm hôm nay'}
                        >
                          <span className="sr-only">Bật tắt hôm nay</span>
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              isActive ? 'translate-x-6' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        <div className="mt-0.5">
                          <span
                            className={`inline-block text-[11px] font-semibold ${
                              isActive ? 'text-emerald-700' : 'text-slate-400'
                            }`}
                          >
                            {isActive ? 'ĐANG BẬT' : 'Đang tắt'}
                          </span>
                        </div>
                      </td>

                      {/* Name */}
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-slate-900">{prod.name}</div>
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-3">
                        {prod.customer ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            {prod.customer}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-xs">—</span>
                        )}
                      </td>

                      {/* Order Quantity */}
                      <td className="py-3.5 px-3 text-right font-medium text-slate-700">
                        {Number(prod.order_quantity || 0).toLocaleString('vi-VN')}
                      </td>

                      {/* Blank Quantity */}
                      <td className="py-3.5 px-3 text-right">
                        <span
                          className={`font-medium ${
                            Number(prod.blank_quantity || 0) === 0 ? 'text-amber-600 font-semibold' : 'text-slate-700'
                          }`}
                        >
                          {Number(prod.blank_quantity || 0).toLocaleString('vi-VN')}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 pr-4 pl-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => handleOpenEditModal(prod)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Sửa thông tin sản phẩm"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeletingProductId(prod.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Xóa sản phẩm khỏi danh mục"
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

          {/* Mobile Product Cards (< md) */}
          <div className="md:hidden divide-y divide-slate-100 p-2.5 space-y-2.5">
            {paginationData.items.map((prod) => {
              const isActive = Boolean(prod.is_active_today);
              const isChecked = selectedIds.has(String(prod.id));

              return (
                <div
                  key={prod.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isActive
                      ? 'bg-emerald-50/40 border-emerald-300'
                      : 'bg-white border-slate-200 shadow-xs'
                  } ${isChecked ? 'ring-2 ring-blue-500' : ''}`}
                >
                  {/* Row 1: Checkbox + Product Name */}
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleSelectItem(prod.id)}
                      className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-900 leading-snug break-words">
                        {prod.name}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md font-medium">
                          KH: {prod.customer || '—'}
                        </span>
                        <span className="text-xs text-slate-500">
                          Đơn: <strong className="text-slate-800">{prod.order_quantity || 0}</strong> • Phôi: <strong className="text-slate-800">{prod.blank_quantity || 0}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Touch-friendly Toggle Switch & Actions */}
                  <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleToggleProduct(prod)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-xs ${
                        isActive
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-white animate-pulse' : 'bg-slate-400'}`} />
                      {isActive ? 'ĐANG BẬT HÔM NAY' : 'BẤM ĐỂ BẬT'}
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditModal(prod)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Sửa sản phẩm"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingProductId(prod.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Xóa sản phẩm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          </>
        )}

        {/* Pagination Bar */}
        {!loading && paginationData.totalItems > 0 && (
          <div className="bg-slate-50/80 px-4 py-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-slate-600">
            <div className="flex items-center space-x-2">
              <span>
                Hiển thị <span className="font-semibold text-slate-900">{paginationData.startIndex}</span> -{' '}
                <span className="font-semibold text-slate-900">{paginationData.endIndex}</span> trên tổng{' '}
                <span className="font-semibold text-slate-900">{paginationData.totalItems}</span> mã
              </span>
              <span className="text-slate-300">|</span>
              <label className="flex items-center space-x-1.5">
                <span>Số dòng:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </label>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setPage(1)}
                disabled={paginationData.page <= 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Trang đầu"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={paginationData.page <= 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Trang trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="px-3 py-1 font-semibold text-xs text-slate-700 bg-white border border-slate-200 rounded-lg">
                Trang {paginationData.page} / {paginationData.totalPages}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(paginationData.totalPages, p + 1))}
                disabled={paginationData.page >= paginationData.totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Trang kế tiếp"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(paginationData.totalPages)}
                disabled={paginationData.page >= paginationData.totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Trang cuối"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: THÊM / SỬA SẢN PHẨM                                                */}
      {/* ========================================================================= */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all">
            <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Boxes className="w-5 h-5 text-blue-200" />
                <h3 className="font-bold text-lg">
                  {editingProduct ? 'Chỉnh Sửa Sản Phẩm' : 'Thêm Sản Phẩm Mới'}
                </h3>
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
              {/* Product Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên Sản Phẩm <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (formErrors.name) setFormErrors({ ...formErrors, name: null });
                  }}
                  placeholder="Ví dụ: Cánh đập phản kích 2021 (670x300x80)"
                  className={`w-full px-3.5 py-2 text-sm bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 transition-all text-slate-800 ${
                    formErrors.name
                      ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-500'
                      : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'
                  }`}
                />
                {formErrors.name && (
                  <p className="text-xs text-rose-600 mt-1">{formErrors.name}</p>
                )}
              </div>

              {/* Customer */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Khách Hàng / Đơn Vị Đặt
                </label>
                <input
                  type="text"
                  value={formData.customer}
                  onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                  placeholder="Ví dụ: Đại Phú, Hòa Phát, VICEM..."
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                />
              </div>

              {/* Quantities Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Số Lượng Đơn Hàng
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.order_quantity}
                    onChange={(e) => setFormData({ ...formData, order_quantity: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Số Lượng Phôi
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.blank_quantity}
                    onChange={(e) => setFormData({ ...formData, blank_quantity: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
                  />
                </div>
              </div>

              {/* Active Today Row */}
              <div className="pt-1">
                <div className="flex flex-col justify-end">
                  <label className="inline-flex items-center space-x-2 p-2 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.is_active_today}
                      onChange={(e) => setFormData({ ...formData, is_active_today: e.target.checked })}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-slate-800">Bật làm hôm nay</span>
                  </label>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all disabled:opacity-60"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                  {editingProduct ? 'Cập Nhật' : 'Lưu Sản Phẩm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: IMPORT EXCEL                                                       */}
      {/* ========================================================================= */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-r from-indigo-700 to-blue-800 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <FileSpreadsheet className="w-5 h-5 text-indigo-200" />
                <h3 className="font-bold text-lg">Import Danh Mục Sản Phẩm Từ Excel</h3>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 flex items-start space-x-2">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold">Định dạng hỗ trợ:</span> File .xlsx hoặc .xlsm. Cột dữ liệu hỗ trợ tiêu đề tiếng Việt: <strong>Mã SP</strong>, <strong>Tên sản phẩm</strong>, <strong>Khách hàng</strong>, <strong>Số lượng</strong>, <strong>Phôi</strong>, <strong>T.t</strong>.
                  <button
                    onClick={handleDownloadTemplate}
                    className="ml-2 text-blue-700 underline font-semibold hover:text-blue-900"
                  >
                    Tải file mẫu tại đây
                  </button>
                </div>
              </div>

              {/* File Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-6 text-center cursor-pointer bg-slate-50 hover:bg-indigo-50/30 transition-colors"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".xlsx, .xlsm, .xls"
                  className="hidden"
                />
                <Upload className="w-10 h-10 text-indigo-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-800">
                  {importFile ? importFile.name : 'Nhấp vào đây để chọn file Excel hoặc kéo thả file'}
                </p>
                <p className="text-xs text-slate-400 mt-1">Hỗ trợ các định dạng .xlsx, .xlsm (tối đa 10MB)</p>
              </div>

              {/* Error Alert */}
              {importError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Parsed Preview Table */}
              {parsedPreview.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span>
                      Xem trước dữ liệu: <span className="text-emerald-600">{parsedPreview.length} mã hợp lệ</span>
                    </span>
                    <span className="text-slate-400">Hiển thị 5 dòng đầu tiên</span>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-600 font-semibold sticky top-0">
                        <tr>
                          <th className="py-2 px-3">Mã SP</th>
                          <th className="py-2 px-3">Tên sản phẩm</th>
                          <th className="py-2 px-3">Khách hàng</th>
                          <th className="py-2 px-3 text-right">SL Đơn</th>
                          <th className="py-2 px-3 text-right">SL Phôi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedPreview.slice(0, 5).map((row, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="py-1.5 px-3 font-mono font-medium">{row.id}</td>
                            <td className="py-1.5 px-3 text-slate-800">{row.name}</td>
                            <td className="py-1.5 px-3 text-slate-600">{row.customer || '—'}</td>
                            <td className="py-1.5 px-3 text-right">{row.order_quantity}</td>
                            <td className="py-1.5 px-3 text-right">{row.blank_quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-200 transition-colors"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={parsedPreview.length === 0 || isImporting}
                onClick={handleConfirmImport}
                className="inline-flex items-center px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
              >
                {isImporting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                Xác Nhận Nhập ({parsedPreview.length} mã)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DIALOG: XÁC NHẬN RESET CA (TẮT TẤT CẢ)                                    */}
      {/* ========================================================================= */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <h3 className="font-bold text-lg text-slate-900">Xác Nhận Reset Ca Mới</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn <span className="font-semibold text-rose-600">TẮT TOÀN BỘ</span> các sản phẩm đang bật hôm nay không?
              Hành động này sẽ giúp làm sạch danh sách gia công để chuẩn bị cho ca làm việc mới.
            </p>
            <div className="pt-2 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={handleResetShift}
                className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition-all disabled:opacity-60"
              >
                {isResetting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                Đồng Ý Tắt Tất Cả
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DIALOG: XÁC NHẬN XÓA SẢN PHẨM                                             */}
      {/* ========================================================================= */}
      {deletingProductId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <h3 className="font-bold text-lg text-slate-900">Xác Nhận Xóa Sản Phẩm</h3>
            </div>
            <p className="text-sm text-slate-600">
              Bạn có chắc chắn muốn xóa mã sản phẩm <span className="font-mono font-bold text-slate-900">[{deletingProductId}]</span> khỏi danh mục? Hành động này không thể hoàn tác.
            </p>
            <div className="pt-2 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setDeletingProductId(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => handleDeleteProduct(deletingProductId)}
                className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition-all"
              >
                Xóa Sản Phẩm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
