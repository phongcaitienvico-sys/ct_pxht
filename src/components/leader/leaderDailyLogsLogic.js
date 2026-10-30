/**
 * Pure business logic and helper functions for Leader Daily Logs (Mobile-First History & Edit)
 * Handles worker grouping, daily KPIs/totals, filtering by date and team, and validation for editing logs.
 */

/**
 * Tính tổng hợp số liệu trong ngày của tổ (Sản lượng, Giờ làm, Số thợ, Số bản ghi, Số sản phẩm)
 * @param {Array<Object>} logs
 * @returns {{ totalQuantity: number, totalHours: number, workerCount: number, logCount: number, productCount: number }}
 */
export function calculateTeamDailyTotals(logs = []) {
  if (!Array.isArray(logs) || logs.length === 0) {
    return {
      totalQuantity: 0,
      totalHours: 0,
      workerCount: 0,
      logCount: 0,
      productCount: 0
    };
  }

  const workerIds = new Set();
  const productIds = new Set();
  let totalQuantity = 0;
  let totalHours = 0;

  for (const log of logs) {
    if (!log) continue;
    const qty = Number(log.quantity) || 0;
    const hours = Number(log.duration_hours) || 0;
    totalQuantity += qty;
    totalHours += hours;

    const empId = log.employee_id || (log.employees && log.employees.id);
    if (empId) {
      workerIds.add(String(empId));
    }

    const prodId = log.product_id || (log.products && log.products.id);
    if (prodId) {
      productIds.add(String(prodId));
    }
  }

  return {
    totalQuantity: Math.round(totalQuantity * 100) / 100,
    totalHours: Math.round(totalHours * 100) / 100,
    workerCount: workerIds.size,
    logCount: logs.length,
    productCount: productIds.size
  };
}

/**
 * Gom nhóm danh sách nhật ký theo từng nhân viên (Worker Grouping)
 * Mỗi nhân viên có thông tin tóm tắt và danh sách chi tiết các lượt đã làm
 * @param {Array<Object>} logs
 * @returns {Array<Object>}
 */
export function groupLogsByEmployee(logs = []) {
  if (!Array.isArray(logs) || logs.length === 0) {
    return [];
  }

  const groupsMap = new Map();

  for (const log of logs) {
    if (!log) continue;
    const empId = log.employee_id || (log.employees && log.employees.id) || 'unknown';
    const empName = log.employee_name || (log.employees && log.employees.full_name) || 'Chưa rõ nhân viên';
    const empCode = log.employee_code || (log.employees && log.employees.code) || '';
    const teamId = log.team_id || (log.teams && log.teams.id) || '';
    const teamName = log.team_name || (log.teams && log.teams.name) || '';

    if (!groupsMap.has(empId)) {
      groupsMap.set(empId, {
        employee_id: empId,
        employee_name: empName,
        employee_code: empCode,
        team_id: teamId,
        team_name: teamName,
        total_quantity: 0,
        total_hours: 0,
        log_count: 0,
        logs: []
      });
    }

    const group = groupsMap.get(empId);
    const qty = Number(log.quantity) || 0;
    const hours = Number(log.duration_hours) || 0;

    group.total_quantity += qty;
    group.total_hours += hours;
    group.log_count += 1;
    group.logs.push(log);
  }

  const groups = Array.from(groupsMap.values());
  for (const group of groups) {
    group.total_quantity = Math.round(group.total_quantity * 100) / 100;
    group.total_hours = Math.round(group.total_hours * 100) / 100;
  }

  return groups;
}

/**
 * Lọc danh sách bản ghi theo ngày và tổ
 * @param {Array<Object>} logs
 * @param {string|null} date YYYY-MM-DD
 * @param {string|null} teamId
 * @returns {Array<Object>}
 */
export function filterLogsByDateAndTeam(logs = [], date = null, teamId = null) {
  if (!Array.isArray(logs)) return [];

  return logs.filter((log) => {
    if (!log) return false;

    // Filter by date if date provided and not 'all'
    if (date && date !== 'all') {
      const logDate = log.log_date ? String(log.log_date).slice(0, 10) : '';
      if (logDate !== String(date).slice(0, 10)) {
        return false;
      }
    }

    // Filter by teamId if provided and not 'all'
    if (teamId && teamId !== 'all') {
      const logTeamId = log.team_id || (log.teams && log.teams.id);
      if (logTeamId !== teamId) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Kiểm tra tính hợp lệ khi sửa bản ghi (Số lượng > 0, Thời gian > 0)
 * @param {number|string} quantity
 * @param {number|string} duration
 * @returns {{ isValid: boolean, errors: Object, errorMessages: Array<string>, parsedQuantity: number, parsedDuration: number }}
 */
export function validateEditInput(quantity, duration) {
  const errors = {};
  const errorMessages = [];

  const rawQty = quantity;
  const parsedQuantity = Number(rawQty);

  if (
    rawQty === '' ||
    rawQty === null ||
    rawQty === undefined ||
    Number.isNaN(parsedQuantity) ||
    !Number.isFinite(parsedQuantity) ||
    parsedQuantity <= 0
  ) {
    errors.quantity = 'Số lượng phải lớn hơn 0';
    errorMessages.push('Số lượng phải lớn hơn 0');
  }

  const rawDur = duration;
  const parsedDuration = Number(rawDur);

  if (
    rawDur === '' ||
    rawDur === null ||
    rawDur === undefined ||
    Number.isNaN(parsedDuration) ||
    !Number.isFinite(parsedDuration) ||
    parsedDuration <= 0
  ) {
    errors.duration = 'Thời gian làm phải lớn hơn 0';
    errorMessages.push('Thời gian làm phải lớn hơn 0');
  }

  const isValid = Object.keys(errors).length === 0;

  return {
    isValid,
    errors,
    errorMessages,
    parsedQuantity: isValid ? parsedQuantity : (Number.isNaN(parsedQuantity) ? 0 : parsedQuantity),
    parsedDuration: isValid ? parsedDuration : (Number.isNaN(parsedDuration) ? 0 : parsedDuration)
  };
}

/**
 * Lấy chữ cái viết tắt từ họ tên nhân viên để hiển thị Avatar
 * @param {string} name
 * @returns {string}
 */
export function getEmployeeInitials(name) {
  if (!name || typeof name !== 'string') return 'NV';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'NV';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  const last = parts[parts.length - 1][0].toUpperCase();
  const prev = parts[parts.length - 2][0].toUpperCase();
  return (prev + last).toUpperCase();
}

/**
 * Lấy ngày theo định dạng YYYY-MM-DD cho các nút chọn nhanh
 * @param {'today' | 'yesterday'} preset
 * @returns {string}
 */
export function getQuickDate(preset) {
  const d = new Date();
  if (preset === 'yesterday') {
    d.setDate(d.getDate() - 1);
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Định dạng ngày hiển thị thân thiện tiếng Việt
 * @param {string} dateStr YYYY-MM-DD
 * @returns {string}
 */
export function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).slice(0, 10).split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}
