/**
 * Pure business logic and helper functions for Leader Entry Form (Mobile-first)
 * Handles row creation, active product filtering, team worker filtering, validation, and batch payload generation.
 */

/**
 * Tạo một dòng sản phẩm trống với ID duy nhất
 * @returns {{ id: string, product_id: string, quantity: string, duration_hours: string, notes: string }}
 */
export function createEmptyRow() {
  const randomPart = Math.random().toString(36).substring(2, 9);
  return {
    id: `row_${Date.now()}_${randomPart}`,
    product_id: '',
    quantity: '',
    duration_hours: '',
    notes: ''
  };
}

/**
 * Lọc các sản phẩm đang được Quản đốc kích hoạt sản xuất hôm nay (is_active_today = true)
 * @param {Array<Object>} products
 * @returns {Array<Object>}
 */
export function filterActiveProducts(products = []) {
  if (!Array.isArray(products)) return [];
  return products.filter((p) => Boolean(p && p.is_active_today));
}

/**
 * Lọc danh sách nhân viên theo tổ hoặc toàn xưởng (khi mượn thợ)
 * @param {Array<Object>} employees
 * @param {string|null} teamId
 * @param {boolean} includeOtherTeams
 * @returns {Array<Object>}
 */
export function filterTeamEmployees(employees = [], teamId = null, includeOtherTeams = false) {
  if (!Array.isArray(employees)) return [];
  return employees.filter((emp) => {
    if (!emp || emp.is_active === false) return false;
    if (includeOtherTeams) return true;
    if (!teamId) return true;
    return emp.team_id === teamId;
  });
}

/**
 * Kiểm tra tính hợp lệ của toàn bộ form trước khi gửi
 * - Bắt buộc chọn nhân viên
 * - Cần ít nhất 1 dòng sản phẩm
 * - Mỗi dòng: Bắt buộc chọn sản phẩm, số lượng > 0, thời gian > 0
 * - Không cho phép chọn trùng sản phẩm trong cùng 1 lần nhập
 * @param {Object} formData
 * @returns {{ isValid: boolean, errors: Object, errorMessages: Array<string> }}
 */
export function validateEntryForm(formData) {
  const errors = {
    employee_id: '',
    rows: {},
    duplicateProductIds: [],
    general: ''
  };
  const errorMessages = [];

  if (!formData) {
    return {
      isValid: false,
      errors: { employee_id: '', rows: {}, duplicateProductIds: [], general: 'Dữ liệu không hợp lệ' },
      errorMessages: ['Dữ liệu không hợp lệ']
    };
  }

  // 1. Kiểm tra nhân viên
  if (!formData.employee_id || !String(formData.employee_id).trim()) {
    errors.employee_id = 'Vui lòng chọn thợ / nhân viên';
    errorMessages.push('Vui lòng chọn nhân viên');
  }

  const rows = Array.isArray(formData.rows) ? formData.rows : [];
  if (rows.length === 0) {
    errors.general = 'Cần ít nhất một dòng sản phẩm';
    errorMessages.push('Cần ít nhất một dòng sản phẩm');
    return { isValid: false, errors, errorMessages };
  }

  // 2. Kiểm tra trùng lặp sản phẩm giữa các dòng
  const seenProducts = new Map();
  rows.forEach((row, idx) => {
    const pid = row?.product_id ? String(row.product_id).trim() : '';
    if (pid) {
      if (!seenProducts.has(pid)) {
        seenProducts.set(pid, []);
      }
      seenProducts.get(pid).push(idx);
    }
  });

  const duplicatePids = [];
  seenProducts.forEach((indices, pid) => {
    if (indices.length > 1) {
      duplicatePids.push(pid);
    }
  });

  if (duplicatePids.length > 0) {
    errors.duplicateProductIds = duplicatePids;
    duplicatePids.forEach((pid) => {
      errorMessages.push(`Sản phẩm mã #${pid} bị chọn trùng lặp ở nhiều dòng`);
    });
  }

  // 3. Kiểm tra chi tiết từng dòng
  rows.forEach((row, index) => {
    const rowErrors = {};
    const pid = row?.product_id ? String(row.product_id).trim() : '';

    if (!pid) {
      rowErrors.product_id = 'Vui lòng chọn sản phẩm';
      errorMessages.push(`Dòng ${index + 1}: Vui lòng chọn sản phẩm`);
    } else if (duplicatePids.includes(pid)) {
      rowErrors.product_id = 'Sản phẩm này bị trùng lặp với dòng khác';
    }

    // Kiểm tra Số lượng (> 0)
    const rawQty = row?.quantity;
    const qtyNum = Number(rawQty);
    if (
      rawQty === '' ||
      rawQty === null ||
      rawQty === undefined ||
      Number.isNaN(qtyNum) ||
      qtyNum <= 0
    ) {
      rowErrors.quantity = 'Số lượng phải lớn hơn 0';
      errorMessages.push(`Dòng ${index + 1}: Số lượng phải lớn hơn 0`);
    }

    // Kiểm tra Thời gian làm (> 0)
    const rawDur = row?.duration_hours;
    const durNum = Number(rawDur);
    if (
      rawDur === '' ||
      rawDur === null ||
      rawDur === undefined ||
      Number.isNaN(durNum) ||
      durNum <= 0
    ) {
      rowErrors.duration_hours = 'Thời gian làm phải lớn hơn 0';
      errorMessages.push(`Dòng ${index + 1}: Thời gian làm phải lớn hơn 0`);
    }

    if (Object.keys(rowErrors).length > 0) {
      errors.rows[index] = rowErrors;
    }
  });

  const hasRowErrors = Object.keys(errors.rows).length > 0;
  const isValid = !errors.employee_id && !hasRowErrors && duplicatePids.length === 0 && !errors.general;

  return {
    isValid,
    errors,
    errorMessages
  };
}

/**
 * Xây dựng danh sách payload để gửi lên Supabase qua submitProductionLogs
 * @param {Object} formData
 * @param {string|null} teamId
 * @param {string|null} userId
 * @returns {Array<Object>}
 */
export function buildBatchPayload(formData = {}, teamId = null, userId = null) {
  if (!formData || !Array.isArray(formData.rows) || formData.rows.length === 0) {
    return [];
  }

  const today = new Date().toISOString().slice(0, 10);
  const log_date = formData.log_date || today;
  const finalTeamId = teamId || formData.team_id || null;
  const finalUserId = userId || formData.created_by || null;

  return formData.rows.map((row) => ({
    employee_id: formData.employee_id,
    product_id: String(row.product_id || '').trim(),
    team_id: finalTeamId,
    created_by: finalUserId,
    log_date,
    quantity: Number(row.quantity) || 0,
    duration_hours: Number(row.duration_hours) || 0,
    notes: typeof row.notes === 'string' ? row.notes.trim() : ''
  }));
}

/**
 * Format nhãn hiển thị cho sản phẩm dạng: [#ID] Tên Sản Phẩm (Khách hàng)
 * @param {Object} product
 * @returns {string}
 */
export function formatProductLabel(product) {
  if (!product) return '';
  const id = product.id ?? '';
  const name = product.name ?? '';
  const customer = product.customer ? ` (${product.customer})` : '';
  return `[#${id}] ${name}${customer}`.trim();
}

/**
 * Tính tổng nhanh số lượng, tổng giờ và số món đã chọn
 * @param {Array<Object>} rows
 * @returns {{ totalQuantity: number, totalHours: number, productCount: number }}
 */
export function calculateFormTotals(rows = []) {
  if (!Array.isArray(rows)) {
    return { totalQuantity: 0, totalHours: 0, productCount: 0 };
  }

  let totalQuantity = 0;
  let totalHours = 0;
  let productCount = 0;

  for (const r of rows) {
    if (r?.product_id) {
      productCount++;
    }
    const q = Number(r?.quantity);
    if (!Number.isNaN(q) && q > 0) {
      totalQuantity += q;
    }
    const h = Number(r?.duration_hours);
    if (!Number.isNaN(h) && h > 0) {
      totalHours += h;
    }
  }

  return {
    totalQuantity: Math.round(totalQuantity * 100) / 100,
    totalHours: Math.round(totalHours * 100) / 100,
    productCount
  };
}
