/**
 * Pure business logic and helper functions for Product Manager
 * Supports searching, filtering, bulk toggles, reset shift, pagination, and validation.
 */

export const MAX_OPERATIONS = 10;

/**
 * Remove Vietnamese accents / diacritics and normalize search string
 */
export function normalizeSearchText(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
}

/**
 * Calculate product quick stats
 * @param {Array<Object>} products
 * @returns {{ total: number, activeCount: number, inactiveCount: number }}
 */
export function calculateProductStats(products = []) {
  if (!Array.isArray(products)) {
    return { total: 0, activeCount: 0, inactiveCount: 0 };
  }

  const total = products.length;
  let activeCount = 0;

  for (let i = 0; i < total; i++) {
    if (Boolean(products[i]?.is_active_today)) {
      activeCount++;
    }
  }

  return {
    total,
    activeCount,
    inactiveCount: total - activeCount
  };
}

/**
 * Extract unique, sorted customer list from products
 * @param {Array<Object>} products
 * @returns {Array<string>}
 */
export function extractCustomerOptions(products = []) {
  if (!Array.isArray(products)) return [];

  const customerSet = new Set();
  for (const p of products) {
    if (p && p.customer) {
      const trimmed = String(p.customer).trim();
      if (trimmed) customerSet.add(trimmed);
    }
  }

  return Array.from(customerSet).sort((a, b) => a.localeCompare(b, 'vi'));
}

/**
 * Filter products based on search term, customer dropdown, and status dropdown
 * @param {Array<Object>} products
 * @param {Object} filters
 * @returns {Array<Object>}
 */
export function filterProducts(products = [], { searchTerm = '', customerFilter = 'all', statusFilter = 'all' } = {}) {
  if (!Array.isArray(products)) return [];

  const query = normalizeSearchText(searchTerm);
  const targetCust = customerFilter && customerFilter !== 'all' ? String(customerFilter).trim() : null;
  const isStatusFilterActive = statusFilter && statusFilter !== 'all';

  return products.filter((p) => {
    if (!p) return false;

    // 1. Search term check (id, name, customer)
    if (query) {
      const idNorm = normalizeSearchText(p.id);
      const nameNorm = normalizeSearchText(p.name);
      const custNorm = normalizeSearchText(p.customer);
      const opsNorm = normalizeSearchText(Array.isArray(p.operations) ? p.operations.join(' ') : '');

      const matchesQuery =
        opsNorm.includes(query) ||
        idNorm.includes(query) ||
        nameNorm.includes(query) ||
        custNorm.includes(query);

      if (!matchesQuery) return false;
    }

    // 2. Customer dropdown filter
    if (targetCust) {
      if (String(p.customer || '').trim() !== targetCust) {
        return false;
      }
    }

    // 3. Status filter ('active_only', 'active', 'inactive_only', 'inactive')
    if (isStatusFilterActive) {
      const isActive = Boolean(p.is_active_today);
      if ((statusFilter === 'active_only' || statusFilter === 'active') && !isActive) {
        return false;
      }
      if ((statusFilter === 'inactive_only' || statusFilter === 'inactive') && isActive) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Toggle single product active state
 * @param {Array<Object>} products
 * @param {string|number} targetId
 * @param {boolean} [forceValue]
 * @returns {Array<Object>}
 */
export function toggleSingleProduct(products = [], targetId, forceValue) {
  if (!Array.isArray(products)) return [];
  const targetStr = String(targetId);

  return products.map((p) => {
    if (String(p.id) === targetStr) {
      const nextActive = forceValue !== undefined ? Boolean(forceValue) : !Boolean(p.is_active_today);
      return {
        ...p,
        is_active_today: nextActive,
        updated_at: new Date().toISOString()
      };
    }
    return p;
  });
}

/**
 * Bulk toggle multiple or all products
 * @param {Array<Object>} products
 * @param {Array<string|number>|'all'} targetIds
 * @param {boolean} newActiveState
 * @returns {Array<Object>}
 */
export function bulkToggleProducts(products = [], targetIds, newActiveState) {
  if (!Array.isArray(products)) return [];
  const activeBool = Boolean(newActiveState);
  const now = new Date().toISOString();

  if (targetIds === 'all') {
    return products.map((p) => ({
      ...p,
      is_active_today: activeBool,
      updated_at: now
    }));
  }

  const idSet = new Set((Array.isArray(targetIds) ? targetIds : []).map(String));

  return products.map((p) => {
    if (idSet.has(String(p.id))) {
      return {
        ...p,
        is_active_today: activeBool,
        updated_at: now
      };
    }
    return p;
  });
}

/**
 * Reset shift: deactivate all products for today
 * @param {Array<Object>} products
 * @returns {Array<Object>}
 */
export function resetShiftProducts(products = []) {
  if (!Array.isArray(products)) return [];
  const now = new Date().toISOString();

  return products.map((p) => ({
    ...p,
    is_active_today: false,
    updated_at: now
  }));
}

/**
 * Paginate items array
 * @param {Array<any>} items
 * @param {number} [page=1]
 * @param {number} [pageSize=20]
 * @returns {{ page: number, pageSize: number, totalItems: number, totalPages: number, items: Array<any>, startIndex: number, endIndex: number }}
 */
export function paginateProducts(items = [], page = 1, pageSize = 20) {
  const safeItems = Array.isArray(items) ? items : [];
  const totalItems = safeItems.length;
  const safePageSize = Math.max(1, Number(pageSize) || 20);
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));

  // Clamp page between 1 and totalPages
  const parsedPage = Number(page) || 1;
  const currentPage = Math.min(Math.max(1, parsedPage), totalPages);

  const startIdxZero = (currentPage - 1) * safePageSize;
  const endIdxZero = Math.min(startIdxZero + safePageSize, totalItems);

  const pagedSlice = safeItems.slice(startIdxZero, endIdxZero);
  const startIndex = totalItems === 0 ? 0 : startIdxZero + 1;
  const endIndex = totalItems === 0 ? 0 : endIdxZero;

  return {
    page: currentPage,
    pageSize: safePageSize,
    totalItems,
    totalPages,
    items: pagedSlice,
    startIndex,
    endIndex
  };
}

/**
 * Validate manual product form inputs
 * @param {Object} productData
 * @returns {{ valid: boolean, errors: Object, sanitized: Object }}
 */
export function validateProductInput(productData = {}) {
  const errors = {};
  const rawName = productData?.name !== undefined && productData?.name !== null ? String(productData.name).trim() : '';
  const rawId = productData?.id !== undefined && productData?.id !== null ? String(productData.id).trim() : '';
  const rawCustomer = productData?.customer !== undefined && productData?.customer !== null ? String(productData.customer).trim() : '';
  const rawStatus = productData?.status !== undefined && productData?.status !== null ? String(productData.status).trim() : 'Sx';

  if (!rawName) {
    errors.name = 'Tên sản phẩm không được để trống';
  }

  // Parse order quantity
  let orderQty = 0;
  if (productData?.order_quantity !== undefined && productData?.order_quantity !== null && productData?.order_quantity !== '') {
    const parsed = Number(String(productData.order_quantity).replace(/,/g, '').trim());
    if (Number.isFinite(parsed) && parsed >= 0) {
      orderQty = Math.floor(parsed);
    }
  }

  // Parse blank quantity
  let blankQty = 0;
  if (productData?.blank_quantity !== undefined && productData?.blank_quantity !== null && productData?.blank_quantity !== '') {
    const parsed = Number(String(productData.blank_quantity).replace(/,/g, '').trim());
    if (Number.isFinite(parsed) && parsed >= 0) {
      blankQty = Math.floor(parsed);
    }
  }

  // Công đoạn: nhận mảng hoặc chuỗi phân tách bằng xuống dòng / dấu phẩy / chấm phẩy
  const rawOps = Array.isArray(productData?.operations)
    ? productData.operations
    : typeof productData?.operations === 'string'
    ? productData.operations.split(/[\n,;]+/)
    : [];
  const operations = rawOps.map((v) => String(v ?? '').trim()).filter(Boolean);
  if (operations.length > MAX_OPERATIONS) {
    errors.operations = `Tối đa ${MAX_OPERATIONS} công đoạn`;
  }

  const generatedId = rawId || `SP_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const sanitized = {
    id: generatedId,
    name: rawName,
    customer: rawCustomer,
    order_quantity: orderQty,
    blank_quantity: blankQty,
    status: rawStatus || 'Sx',
    operations: operations.slice(0, MAX_OPERATIONS),
    is_active_today: Boolean(productData?.is_active_today)
  };

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    sanitized
  };
}
