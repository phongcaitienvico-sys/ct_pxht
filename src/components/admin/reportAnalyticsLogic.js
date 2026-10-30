/**
 * Logic pure functions cho màn hình Quản Đốc - Báo Cáo Phân Tích Đa Chiều & Xuất Excel
 */

/**
 * Định dạng YYYY-MM-DD từ đối tượng Date
 * @param {Date} d
 * @returns {string}
 */
export function formatYMD(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) {
    return '';
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Phân tích đối tượng Date an toàn từ tham số đầu vào
 * @param {Date|string|number} refDate
 * @returns {Date}
 */
function parseSafeDate(refDate) {
  if (refDate instanceof Date && !isNaN(refDate.getTime())) {
    return refDate;
  }
  if (typeof refDate === 'string' || typeof refDate === 'number') {
    const parsed = new Date(refDate);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
}

/**
 * Lấy khoảng thời gian { startDate, endDate } theo preset được chỉ định
 * @param {string} preset 'today' | 'hom_nay' | 'last_7_days' | '7_days' | '7_ngay_qua' | 'this_month' | 'thang_nay' | 'last_month' | 'thang_truoc'
 * @param {Date|string|number} [referenceDate=new Date()]
 * @returns {{ startDate: string, endDate: string }}
 */
export function getDatePresetRange(preset, referenceDate = new Date()) {
  const ref = parseSafeDate(referenceDate);
  const normalizedPreset = String(preset || '').trim().toLowerCase();

  const year = ref.getFullYear();
  const month = ref.getMonth(); // 0-indexed
  const day = ref.getDate();

  switch (normalizedPreset) {
    case 'today':
    case 'hom_nay': {
      const todayStr = formatYMD(ref);
      return {
        startDate: todayStr,
        endDate: todayStr
      };
    }

    case 'last_7_days':
    case '7_days':
    case '7_ngay_qua': {
      // 7 ngày gần nhất tính cả hôm nay (ref - 6 ngày đến ref)
      const startDateObj = new Date(year, month, day - 6);
      return {
        startDate: formatYMD(startDateObj),
        endDate: formatYMD(ref)
      };
    }

    case 'this_month':
    case 'thang_nay': {
      // Ngày đầu tháng đến ngày cuối cùng của tháng hiện tại
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      return {
        startDate: formatYMD(firstDay),
        endDate: formatYMD(lastDay)
      };
    }

    case 'last_month':
    case 'thang_truoc': {
      // Ngày đầu tháng trước đến ngày cuối cùng của tháng trước
      const firstDayPrev = new Date(year, month - 1, 1);
      const lastDayPrev = new Date(year, month, 0);
      return {
        startDate: formatYMD(firstDayPrev),
        endDate: formatYMD(lastDayPrev)
      };
    }

    default: {
      // Mặc định trả về từ đầu tháng đến ngày hiện tại
      const firstDay = new Date(year, month, 1);
      return {
        startDate: formatYMD(firstDay),
        endDate: formatYMD(ref)
      };
    }
  }
}

/**
 * Lọc danh sách nhật ký sản lượng theo nhiều tiêu chí đa chiều
 * @param {Array<Object>} logs
 * @param {Object} filters { startDate, endDate, employeeId, teamId, search }
 * @returns {Array<Object>}
 */
export function filterLogsByCriteria(logs, filters = {}) {
  if (!Array.isArray(logs)) {
    return [];
  }
  if (!filters || typeof filters !== 'object') {
    return [...logs];
  }

  const { startDate, endDate, employeeId, teamId, search } = filters;

  const searchKeyword = search ? String(search).trim().toLowerCase() : '';

  return logs.filter((log) => {
    if (!log) return false;

    const logDate = log.log_date || log.date || (log.created_at ? String(log.created_at).slice(0, 10) : '');

    // 1. Lọc theo startDate
    if (startDate && logDate && logDate < startDate) {
      return false;
    }

    // 2. Lọc theo endDate
    if (endDate && logDate && logDate > endDate) {
      return false;
    }

    // 3. Lọc theo employeeId
    if (employeeId && employeeId !== 'all') {
      const currentEmpId = log.employee_id || (log.employees && log.employees.id);
      const currentEmpCode = log.employee_code || (log.employees && log.employees.code);
      if (currentEmpId !== employeeId && currentEmpCode !== employeeId) {
        return false;
      }
    }

    // 4. Lọc theo teamId
    if (teamId && teamId !== 'all') {
      const currentTeamId = log.team_id || (log.teams && log.teams.id);
      if (currentTeamId !== teamId) {
        return false;
      }
    }

    // 5. Tìm kiếm theo từ khóa (Mã SP, Tên SP, Khách hàng, Mã NV, Tên NV, Ghi chú)
    if (searchKeyword) {
      const prodName = log.product_name || (log.products && log.products.name) || '';
      const prodId = log.product_id || (log.products && (log.products.id || log.products.code)) || '';
      const customer = log.customer || (log.products && log.products.customer) || '';
      const empName = log.employee_name || (log.employees && (log.employees.full_name || log.employees.name)) || '';
      const empCode = log.employee_code || (log.employees && log.employees.code) || '';
      const notes = log.notes || '';
      const teamName = log.team_name || (log.teams && log.teams.name) || '';

      const fullHaystack = `${prodName} ${prodId} ${customer} ${empName} ${empCode} ${notes} ${teamName}`.toLowerCase();
      if (!fullHaystack.includes(searchKeyword)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Tính toán các chỉ số KPI phân tích từ danh sách logs
 * @param {Array<Object>} logs
 * @returns {Object} { totalLogs, totalQuantity, totalHours, workDaysCount, uniqueEmployeesCount, uniqueProductsCount, productivityPerHour, avgHoursPerDay, avgQuantityPerDay }
 */
export function calculateAnalyticsKPI(logs) {
  if (!Array.isArray(logs) || logs.length === 0) {
    return {
      totalLogs: 0,
      totalQuantity: 0,
      totalHours: 0,
      workDaysCount: 0,
      uniqueEmployeesCount: 0,
      uniqueProductsCount: 0,
      productivityPerHour: 0,
      avgHoursPerDay: 0,
      avgQuantityPerDay: 0
    };
  }

  let totalQuantity = 0;
  let totalHours = 0;
  const workDays = new Set();
  const employeesSet = new Set();
  const productsSet = new Set();

  for (const log of logs) {
    if (!log) continue;

    const qty = Number(log.quantity) || 0;
    const hrs = Number(log.duration_hours) || 0;

    totalQuantity += qty;
    totalHours += hrs;

    const logDate = log.log_date || log.date || (log.created_at ? String(log.created_at).slice(0, 10) : '');
    if (logDate) {
      workDays.add(logDate);
    }

    const empIdentifier = log.employee_id || log.employee_code || (log.employees && (log.employees.id || log.employees.code));
    if (empIdentifier) {
      employeesSet.add(empIdentifier);
    }

    const prodIdentifier = log.product_id || log.product_name || (log.products && (log.products.id || log.products.name));
    if (prodIdentifier) {
      productsSet.add(prodIdentifier);
    }
  }

  const roundedHours = Math.round(totalHours * 100) / 100;
  const workDaysCount = workDays.size;

  const productivityPerHour = roundedHours > 0
    ? Math.round((totalQuantity / roundedHours) * 100) / 100
    : 0;

  const avgHoursPerDay = workDaysCount > 0
    ? Math.round((roundedHours / workDaysCount) * 100) / 100
    : 0;

  const avgQuantityPerDay = workDaysCount > 0
    ? Math.round((totalQuantity / workDaysCount) * 100) / 100
    : 0;

  return {
    totalLogs: logs.length,
    totalQuantity,
    totalHours: roundedHours,
    workDaysCount,
    uniqueEmployeesCount: employeesSet.size,
    uniqueProductsCount: productsSet.size,
    productivityPerHour,
    avgHoursPerDay,
    avgQuantityPerDay
  };
}

/**
 * Nhóm nhật ký theo từng ngày làm việc (xếp từ ngày mới nhất trở về trước)
 * Phục vụ chế độ xem Day-by-Day khi lọc 1 nhân viên
 * @param {Array<Object>} logs
 * @returns {Array<Object>}
 */
export function groupLogsByDay(logs) {
  if (!Array.isArray(logs) || logs.length === 0) {
    return [];
  }

  const mapByDate = new Map();

  for (const log of logs) {
    if (!log) continue;
    const dateStr = log.log_date || log.date || (log.created_at ? String(log.created_at).slice(0, 10) : 'CHUA_RO');

    let dayGroup = mapByDate.get(dateStr);
    if (!dayGroup) {
      dayGroup = {
        date: dateStr,
        dayFormatted: formatFullDateVN(dateStr),
        logs: [],
        totalQuantity: 0,
        totalHours: 0,
        productSet: new Set()
      };
      mapByDate.set(dateStr, dayGroup);
    }

    const qty = Number(log.quantity) || 0;
    const hrs = Number(log.duration_hours) || 0;

    dayGroup.totalQuantity += qty;
    dayGroup.totalHours += hrs;
    dayGroup.logs.push(log);

    const prodId = log.product_id || (log.products && log.products.id) || log.product_name;
    if (prodId) {
      dayGroup.productSet.add(prodId);
    }
  }

  // Chuyển Map thành mảng và sắp xếp ngày giảm dần (mới nhất lên đầu)
  const result = Array.from(mapByDate.values()).map((item) => ({
    date: item.date,
    dayFormatted: item.dayFormatted,
    logs: item.logs.sort((a, b) => {
      const timeA = a.created_at || '';
      const timeB = b.created_at || '';
      return timeB.localeCompare(timeA);
    }),
    totalQuantity: item.totalQuantity,
    totalHours: Math.round(item.totalHours * 100) / 100,
    productCount: item.productSet.size
  }));

  result.sort((a, b) => b.date.localeCompare(a.date));

  return result;
}

/**
 * Nhóm nhật ký tổng hợp theo từng nhân viên (khi chọn Tất cả nhân viên)
 * @param {Array<Object>} logs
 * @returns {Array<Object>}
 */
export function groupLogsByEmployeeSummary(logs) {
  if (!Array.isArray(logs) || logs.length === 0) {
    return [];
  }

  const mapByEmp = new Map();

  for (const log of logs) {
    if (!log) continue;

    const empCode = log.employee_code || (log.employees && (log.employees.code || log.employees.id)) || log.employee_id || 'CHUA_RO';
    const empId = log.employee_id || (log.employees && log.employees.id) || '';
    const empName = log.employee_name || (log.employees && (log.employees.full_name || log.employees.name)) || '';
    const teamId = log.team_id || (log.teams && log.teams.id) || '';
    const teamName = log.team_name || (log.teams && log.teams.name) || '';
    const logDate = log.log_date || log.date || (log.created_at ? String(log.created_at).slice(0, 10) : '');
    const qty = Number(log.quantity) || 0;
    const hrs = Number(log.duration_hours) || 0;

    let existing = mapByEmp.get(empCode);
    if (!existing) {
      existing = {
        employeeId: empId,
        employeeCode: empCode,
        employeeName: empName,
        teamId,
        teamName,
        totalQuantity: 0,
        totalHours: 0,
        workDays: new Set(),
        productsSet: new Set(),
        logsCount: 0
      };
      mapByEmp.set(empCode, existing);
    }

    if (!existing.employeeName && empName) existing.employeeName = empName;
    if (!existing.teamName && teamName) existing.teamName = teamName;
    if (!existing.employeeId && empId) existing.employeeId = empId;
    if (!existing.teamId && teamId) existing.teamId = teamId;

    existing.totalQuantity += qty;
    existing.totalHours += hrs;
    existing.logsCount += 1;

    if (logDate) {
      existing.workDays.add(logDate);
    }

    const prodId = log.product_id || (log.products && log.products.id) || log.product_name;
    if (prodId) {
      existing.productsSet.add(prodId);
    }
  }

  const summaries = Array.from(mapByEmp.values()).map((item) => {
    const workDaysCount = item.workDays.size;
    const totalHours = Math.round(item.totalHours * 100) / 100;
    const productivityPerHour = totalHours > 0
      ? Math.round((item.totalQuantity / totalHours) * 100) / 100
      : 0;
    const avgHoursPerDay = workDaysCount > 0
      ? Math.round((totalHours / workDaysCount) * 100) / 100
      : 0;

    return {
      employeeId: item.employeeId,
      employeeCode: item.employeeCode,
      employeeName: item.employeeName,
      teamId: item.teamId,
      teamName: item.teamName,
      totalQuantity: item.totalQuantity,
      totalHours,
      workDaysCount,
      logsCount: item.logsCount,
      productCount: item.productsSet.size,
      productivityPerHour,
      avgHoursPerDay
    };
  });

  // Sắp xếp mặc định theo tổng sản lượng giảm dần
  summaries.sort((a, b) => {
    if (b.totalQuantity !== a.totalQuantity) {
      return b.totalQuantity - a.totalQuantity;
    }
    return a.employeeCode.localeCompare(b.employeeCode);
  });

  return summaries;
}

/**
 * Định dạng ngày Việt Nam: DD/MM/YYYY
 * @param {string} dateStr 'YYYY-MM-DD'
 * @returns {string}
 */
export function formatDateVN(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Định dạng thứ và ngày đầy đủ: ví dụ "Thứ Sáu, 30/10/2026"
 * @param {string} dateStr 'YYYY-MM-DD'
 * @returns {string}
 */
export function formatFullDateVN(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length !== 3) return dateStr;

  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);

  const dateObj = new Date(y, m, d);
  const dayIndex = dateObj.getDay();

  const dayNames = [
    'Chủ Nhật',
    'Thứ Hai',
    'Thứ Ba',
    'Thứ Tư',
    'Thứ Năm',
    'Thứ Sáu',
    'Thứ Bảy'
  ];

  const weekday = dayNames[dayIndex] || '';
  return `${weekday}, ${String(d).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}/${y}`;
}

/**
 * Định dạng số có dấu phẩy ngăn cách hàng nghìn
 * @param {number|string} val
 * @returns {string}
 */
export function formatNumber(val) {
  if (val === null || val === undefined || isNaN(val)) return '0';
  const num = Number(val);
  return num.toLocaleString('en-US');
}

export default {
  formatYMD,
  getDatePresetRange,
  filterLogsByCriteria,
  calculateAnalyticsKPI,
  groupLogsByDay,
  groupLogsByEmployeeSummary,
  formatDateVN,
  formatFullDateVN,
  formatNumber
};
