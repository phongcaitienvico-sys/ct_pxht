/**
 * Pure business logic and helper functions for Realtime Feed & Foreman Monitoring
 * Supports KPI calculations, multi-criteria filtering, realtime event reconciliation, and data formatting.
 */

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
 * Get current local date as YYYY-MM-DD
 */
export function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate today's real-time production KPIs:
 * 1. Total quantity completed today
 * 2. Total logged hours today
 * 3. Distinct active workers count today
 * 4. Distinct active teams count today
 * 5. Total log records today
 *
 * @param {Array<Object>} logs All production logs
 * @param {string} [targetDate] Date string in YYYY-MM-DD (defaults to today)
 * @returns {{ totalQuantity: number, totalHours: number, activeWorkersCount: number, activeTeamsCount: number, totalLogsCount: number }}
 */
export function calculateTodayKPI(logs = [], targetDate = null) {
  if (!Array.isArray(logs) || logs.length === 0) {
    return {
      totalQuantity: 0,
      totalHours: 0,
      activeWorkersCount: 0,
      activeTeamsCount: 0,
      totalLogsCount: 0
    };
  }

  const effectiveDate = targetDate === 'all' ? 'all' : (targetDate || getTodayDateString());

  let totalQuantity = 0;
  let totalHours = 0;
  let totalLogsCount = 0;

  const workerSet = new Set();
  const teamSet = new Set();

  for (const log of logs) {
    if (!log) continue;

    // Check date match
    const logDate =
      log.log_date ||
      (log.created_at ? String(log.created_at).slice(0, 10) : '');

    if (effectiveDate !== 'all' && logDate !== effectiveDate) {
      continue;
    }

    totalLogsCount++;

    // Quantity (positive numbers only)
    const rawQty = Number(log.quantity);
    if (!isNaN(rawQty) && rawQty > 0) {
      totalQuantity += rawQty;
    }

    // Duration hours (positive numbers only)
    const rawHours = Number(log.duration_hours);
    if (!isNaN(rawHours) && rawHours > 0) {
      totalHours += rawHours;
    }

    // Worker key
    const workerKey =
      log.employee_id ||
      log.employee_code ||
      (log.employees && (log.employees.id || log.employees.code));

    if (workerKey) {
      workerSet.add(String(workerKey));
    }

    // Team key
    const teamKey =
      log.team_id ||
      log.team_name ||
      (log.teams && (log.teams.id || log.teams.name));

    if (teamKey) {
      teamSet.add(String(teamKey));
    }
  }

  // Round hours to 1 decimal place to prevent floating-point inaccuracy
  const roundedHours = Math.round(totalHours * 10) / 10;

  return {
    totalQuantity,
    totalHours: roundedHours,
    activeWorkersCount: workerSet.size,
    activeTeamsCount: teamSet.size,
    totalLogsCount
  };
}

/**
 * Filter logs based on teamId, search term, and date
 *
 * @param {Array<Object>} logs
 * @param {Object} filters
 * @param {string} [filters.teamId]
 * @param {string} [filters.searchTerm]
 * @param {string} [filters.date]
 * @returns {Array<Object>}
 */
export function filterLogs(logs = [], { teamId = 'all', searchTerm = '', date = 'all' } = {}) {
  if (!Array.isArray(logs)) return [];

  const query = normalizeSearchText(searchTerm);
  const isTeamFilterActive = teamId && teamId !== 'all';
  const isDateFilterActive = date && date !== 'all';

  return logs.filter((log) => {
    if (!log) return false;

    // 1. Team filter
    if (isTeamFilterActive) {
      const matchTeam =
        log.team_id === teamId ||
        log.team_name === teamId ||
        (log.teams && (log.teams.id === teamId || log.teams.name === teamId));
      if (!matchTeam) return false;
    }

    // 2. Date filter
    if (isDateFilterActive) {
      const logDate =
        log.log_date ||
        (log.created_at ? String(log.created_at).slice(0, 10) : '');
      if (logDate !== date) return false;
    }

    // 3. Search query filter
    if (query) {
      const empName = normalizeSearchText(log.employee_name || (log.employees && log.employees.full_name) || '');
      const empCode = normalizeSearchText(log.employee_code || (log.employees && log.employees.code) || '');
      const prodName = normalizeSearchText(log.product_name || (log.products && log.products.name) || '');
      const prodId = normalizeSearchText(log.product_id || (log.products && log.products.id) || '');
      const teamName = normalizeSearchText(log.team_name || (log.teams && log.teams.name) || '');
      const notes = normalizeSearchText(log.notes || '');
      const operation = normalizeSearchText(log.operation || '');

      const matches =
        operation.includes(query) ||
        empName.includes(query) ||
        empCode.includes(query) ||
        prodName.includes(query) ||
        prodId.includes(query) ||
        teamName.includes(query) ||
        notes.includes(query);

      if (!matches) return false;
    }

    return true;
  });
}

/**
 * Handle incoming realtime events (INSERT, UPDATE, DELETE)
 * Returns a new immutable array of logs with updates applied.
 *
 * @param {Array<Object>} logs Current logs
 * @param {Object} event Event payload { eventType: 'INSERT'|'UPDATE'|'DELETE', new?, old?, oldId? }
 * @returns {Array<Object>}
 */
export function handleRealtimeEvent(logs = [], event = null) {
  if (!Array.isArray(logs)) return [];
  if (!event || !event.eventType) return logs;

  const eventType = String(event.eventType).toUpperCase();

  if (eventType === 'INSERT') {
    const newItem = event.new;
    if (!newItem || !newItem.id) return logs;

    const taggedItem = { ...newItem, _isNew: true };
    const existingIndex = logs.findIndex((l) => l.id === newItem.id);

    if (existingIndex !== -1) {
      // Already in list, update it in-place
      const updated = [...logs];
      updated[existingIndex] = taggedItem;
      return updated;
    }

    // Prepend to top of feed
    return [taggedItem, ...logs];
  }

  if (eventType === 'UPDATE') {
    const updatedItem = event.new;
    if (!updatedItem || !updatedItem.id) return logs;

    const existingIndex = logs.findIndex((l) => l.id === updatedItem.id);
    if (existingIndex !== -1) {
      const updated = [...logs];
      updated[existingIndex] = { ...updated[existingIndex], ...updatedItem };
      return updated;
    }

    // If somehow not in list, prepend
    return [updatedItem, ...logs];
  }

  if (eventType === 'DELETE') {
    const targetId =
      (event.old && event.old.id) ||
      event.oldId ||
      (typeof event.old === 'string' ? event.old : null);

    if (!targetId) return logs;

    return logs.filter((l) => l.id !== targetId);
  }

  return logs;
}

/**
 * Format timestamp (ISO or Date string) to readable time (HH:mm or HH:mm - DD/MM)
 *
 * @param {string|Date} isoStringOrDate
 * @returns {string}
 */
export function formatLogTime(isoStringOrDate) {
  if (!isoStringOrDate) return '';

  const dateObj = new Date(isoStringOrDate);
  if (isNaN(dateObj.getTime())) {
    return '';
  }

  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');

  return `${hours}:${minutes} (${day}/${month})`;
}

/**
 * Validate log edit input
 *
 * @param {Object} input
 * @returns {{ isValid: boolean, errors: Object }}
 */
export function validateLogInput(input = {}) {
  const errors = {};

  const qty = Number(input.quantity);
  if (isNaN(qty) || qty <= 0) {
    errors.quantity = 'Số lượng sản phẩm phải lớn hơn 0';
  }

  const hours = Number(input.duration_hours);
  if (isNaN(hours) || hours <= 0) {
    errors.duration_hours = 'Số giờ làm việc phải lớn hơn 0';
  } else if (hours > 24) {
    errors.duration_hours = 'Số giờ làm việc không thể vượt quá 24h';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export default {
  normalizeSearchText,
  getTodayDateString,
  calculateTodayKPI,
  filterLogs,
  handleRealtimeEvent,
  formatLogTime,
  validateLogInput
};
