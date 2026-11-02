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
    operation: '',
    notes: ''
  };
}

/**
 * Tạo một dòng Công nhật / Ghi chú (không gắn mã sản phẩm)
 */
export function createDailyWorkRow() {
  const randomPart = Math.random().toString(36).substring(2, 9);
  return {
    id: `row_cn_${Date.now()}_${randomPart}`,
    is_daily_work: true,
    product_id: '',
    quantity: '',
    duration_hours: '',
    operation: '',
    notes: ''
  };
}

export const DEMO_TEAM_MAP = {
  'team-1': 'a0000000-0000-0000-0000-000000000001',
  'team-2': 'a0000000-0000-0000-0000-000000000002'
};

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
  // Không còn phân tổ: trả về toàn bộ nhân viên đang hoạt động (giữ tham số để tương thích)
  if (!Array.isArray(employees)) return [];
  return employees.filter((emp) => Boolean(emp) && emp.is_active !== false);
}

/**
 * Kiểm tra tính hợp lệ của toàn bộ form trước khi gửi
 * - Bắt buộc chọn nhân viên
 * - Cần ít nhất 1 dòng sản phẩm
 * - Mỗi dòng: Bắt buộc chọn sản phẩm, số lượng > 0, thời gian > 0
 * - Không cho phép chọn trùng (sản phẩm + công đoạn) trong cùng 1 lần nhập
 * - Nếu truyền danh sách products và sản phẩm có công đoạn: bắt buộc chọn công đoạn
 * @param {Object} formData
 * @param {Array<Object>} [products] Danh sách sản phẩm (để kiểm tra công đoạn bắt buộc)
 * @returns {{ isValid: boolean, errors: Object, errorMessages: Array<string> }}
 */
export function validateEntryForm(formData, products = []) {
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
  // Khóa trùng = mã SP + công đoạn: cùng SP khác công đoạn vẫn hợp lệ
  const rowKey = (row) => {
    const pid = row?.product_id ? String(row.product_id).trim() : '';
    const op = row?.operation ? String(row.operation).trim() : '';
    return pid ? `${pid}::${op}` : '';
  };

  const seenKeys = new Map();
  rows.forEach((row, idx) => {
    const key = rowKey(row);
    if (key) {
      if (!seenKeys.has(key)) {
        seenKeys.set(key, []);
      }
      seenKeys.get(key).push(idx);
    }
  });

  const duplicateKeys = new Set();
  const duplicatePids = [];
  seenKeys.forEach((indices, key) => {
    if (indices.length > 1) {
      duplicateKeys.add(key);
      const pid = key.split('::')[0];
      const op = key.slice(pid.length + 2);
      if (!duplicatePids.includes(pid)) duplicatePids.push(pid);
      errorMessages.push(
        op
          ? `Sản phẩm mã #${pid} (công đoạn ${op}) bị chọn trùng lặp ở nhiều dòng`
          : `Sản phẩm mã #${pid} bị chọn trùng lặp ở nhiều dòng`
      );
    }
  });

  if (duplicatePids.length > 0) {
    errors.duplicateProductIds = duplicatePids;
  }

  const productList = Array.isArray(products) ? products : [];

  // 3. Kiểm tra chi tiết từng dòng
  rows.forEach((row, index) => {
    const rowErrors = {};

    if (row?.is_daily_work) {
      const opText = row?.operation ? String(row.operation).trim() : '';
      const noteText = row?.notes ? String(row.notes).trim() : '';
      if (!opText && !noteText) {
        rowErrors.operation = 'Vui lòng nhập nội dung công nhật hoặc ghi chú';
        errorMessages.push(`Dòng ${index + 1}: Vui lòng nhập nội dung công nhật hoặc ghi chú`);
      }

      const rawQty = row?.quantity;
      if (rawQty !== '' && rawQty !== null && rawQty !== undefined) {
        const qtyNum = Number(rawQty);
        if (Number.isNaN(qtyNum) || qtyNum < 0) {
          rowErrors.quantity = 'Số lượng không hợp lệ';
          errorMessages.push(`Dòng ${index + 1}: Số lượng không hợp lệ`);
        }
      }

      const rawDur = row?.duration_hours;
      if (rawDur !== '' && rawDur !== null && rawDur !== undefined) {
        const durNum = Number(rawDur);
        if (Number.isNaN(durNum) || durNum < 0) {
          rowErrors.duration_hours = 'Thời gian không hợp lệ';
          errorMessages.push(`Dòng ${index + 1}: Thời gian không hợp lệ`);
        }
      }

      if (Object.keys(rowErrors).length > 0) {
        errors.rows[index] = rowErrors;
      }
      return;
    }

    const pid = row?.product_id ? String(row.product_id).trim() : '';

    if (!pid) {
      rowErrors.product_id = 'Vui lòng chọn sản phẩm';
      errorMessages.push(`Dòng ${index + 1}: Vui lòng chọn sản phẩm`);
    } else {
      if (duplicateKeys.has(rowKey(row))) {
        rowErrors.product_id = 'Sản phẩm này bị trùng lặp với dòng khác';
      }

      // Sản phẩm có công đoạn thì bắt buộc chọn 1 công đoạn
      const product = productList.find((p) => p && String(p.id) === pid);
      const hasOperations = Array.isArray(product?.operations) && product.operations.length > 0;
      if (hasOperations && !(row?.operation && String(row.operation).trim())) {
        rowErrors.operation = 'Vui lòng chọn công đoạn';
        errorMessages.push(`Dòng ${index + 1}: Vui lòng chọn công đoạn`);
      }
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

  return formData.rows.map((row) => {
    const isDaily = Boolean(row?.is_daily_work);
    return {
      employee_id: formData.employee_id,
      product_id: isDaily ? null : String(row.product_id || '').trim(),
      is_daily_work: isDaily,
      team_id: finalTeamId,
      created_by: finalUserId,
      log_date,
      quantity: Number(row.quantity) || 0,
      duration_hours: Number(row.duration_hours) || 0,
      operation: typeof row.operation === 'string' ? row.operation.trim() : '',
      notes: typeof row.notes === 'string' ? row.notes.trim() : ''
    };
  });
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
