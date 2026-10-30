import assert from 'node:assert';
import {
  getDatePresetRange,
  filterLogsByCriteria,
  calculateAnalyticsKPI,
  groupLogsByDay,
  groupLogsByEmployeeSummary,
  formatDateVN,
  formatNumber
} from '../src/components/admin/reportAnalyticsLogic.js';

console.log('Running tests/reportAnalytics.test.js...\n');

// Mock reference date: Friday, October 30, 2026
const REF_DATE = new Date('2026-10-30T12:00:00Z');

// Sample test logs spanning multiple days, employees, teams, and products
const mockLogs = [
  {
    id: 'log-101',
    log_date: '2026-10-30',
    team_id: 'team-1',
    team_name: 'Tổ 1 - Cơ khí & Đúc',
    employee_id: 'emp-1',
    employee_code: 'NV01',
    employee_name: 'Trần Văn Hùng',
    product_id: '1732',
    product_name: 'Cánh đập phản kích 2021',
    customer: 'Đại Phú',
    quantity: 4,
    duration_hours: 4.5,
    notes: 'Tiện mặt đầu',
    created_at: '2026-10-30T08:30:00.000Z'
  },
  {
    id: 'log-102',
    log_date: '2026-10-30',
    team_id: 'team-1',
    team_name: 'Tổ 1 - Cơ khí & Đúc',
    employee_id: 'emp-1',
    employee_code: 'NV01',
    employee_name: 'Trần Văn Hùng',
    product_id: '1775',
    product_name: 'Cánh búa tâm 360',
    customer: 'Hòa Phát',
    quantity: 10,
    duration_hours: 3.5,
    notes: 'Phay rãnh then',
    created_at: '2026-10-30T13:30:00.000Z'
  },
  {
    id: 'log-103',
    log_date: '2026-10-29',
    team_id: 'team-1',
    team_name: 'Tổ 1 - Cơ khí & Đúc',
    employee_id: 'emp-1',
    employee_code: 'NV01',
    employee_name: 'Trần Văn Hùng',
    product_id: '1732',
    product_name: 'Cánh đập phản kích 2021',
    customer: 'Đại Phú',
    quantity: 6,
    duration_hours: 7.0,
    notes: 'Gia công nhiệt luyện',
    created_at: '2026-10-29T09:00:00.000Z'
  },
  {
    id: 'log-104',
    log_date: '2026-10-29',
    team_id: 'team-1',
    team_name: 'Tổ 1 - Cơ khí & Đúc',
    employee_id: 'emp-2',
    employee_code: 'NV02',
    employee_name: 'Lê Văn Cường',
    product_id: '1733',
    product_name: 'Ống gối bi 231/500',
    customer: 'Đại Phú',
    quantity: 2,
    duration_hours: 8.0,
    notes: 'Móc lỗ gối',
    created_at: '2026-10-29T10:00:00.000Z'
  },
  {
    id: 'log-105',
    log_date: '2026-10-15',
    team_id: 'team-2',
    team_name: 'Tổ 2 - Tiện & Phay',
    employee_id: 'emp-4',
    employee_code: 'NV04',
    employee_name: 'Phạm Văn Minh',
    product_id: '1816',
    product_name: 'Đĩa búa 1600x1800',
    customer: 'Đại Phú',
    quantity: 12,
    duration_hours: 6.0,
    notes: 'Khoan lỗ bulong',
    created_at: '2026-10-15T08:00:00.000Z'
  },
  {
    id: 'log-106',
    log_date: '2026-09-25',
    team_id: 'team-2',
    team_name: 'Tổ 2 - Tiện & Phay',
    employee_id: 'emp-4',
    employee_code: 'NV04',
    employee_name: 'Phạm Văn Minh',
    product_id: '1462',
    product_name: 'Thanh đập đá vôi',
    customer: 'Hà Song Hải',
    quantity: 15,
    duration_hours: 8.0,
    notes: 'Tháng trước',
    created_at: '2026-09-25T08:00:00.000Z'
  }
];

let passed = 0;
let failed = 0;

function runTest(testName, fn) {
  try {
    fn();
    console.log(`  ✓ ${testName}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${testName}`);
    console.error(`    Error: ${err.message}`);
    failed++;
  }
}

// -------------------------------------------------------------
// 1. Suite: getDatePresetRange
// -------------------------------------------------------------
console.log('--- Suite 1: getDatePresetRange ---');

runTest('returns correct range for preset "today" / "hom_nay"', () => {
  const range1 = getDatePresetRange('today', REF_DATE);
  assert.strictEqual(range1.startDate, '2026-10-30');
  assert.strictEqual(range1.endDate, '2026-10-30');

  const range2 = getDatePresetRange('hom_nay', REF_DATE);
  assert.strictEqual(range2.startDate, '2026-10-30');
  assert.strictEqual(range2.endDate, '2026-10-30');
});

runTest('returns correct 7-day range for "last_7_days" / "7_ngay_qua"', () => {
  const range = getDatePresetRange('last_7_days', REF_DATE);
  assert.strictEqual(range.endDate, '2026-10-30');
  assert.strictEqual(range.startDate, '2026-10-24'); // 24 to 30 = 7 days inclusive

  const rangeAlias = getDatePresetRange('7_days', REF_DATE);
  assert.strictEqual(rangeAlias.startDate, '2026-10-24');
  assert.strictEqual(rangeAlias.endDate, '2026-10-30');
});

runTest('returns correct month range for "this_month" / "thang_nay"', () => {
  const range = getDatePresetRange('this_month', REF_DATE);
  assert.strictEqual(range.startDate, '2026-10-01');
  assert.strictEqual(range.endDate, '2026-10-31');
});

runTest('returns correct previous month range for "last_month" / "thang_truoc"', () => {
  const range = getDatePresetRange('last_month', REF_DATE);
  assert.strictEqual(range.startDate, '2026-09-01');
  assert.strictEqual(range.endDate, '2026-09-30');
});

runTest('handles leap year in February for "this_month" and "last_month"', () => {
  const feb2028 = new Date('2028-02-15T00:00:00Z');
  const rangeFeb = getDatePresetRange('this_month', feb2028);
  assert.strictEqual(rangeFeb.startDate, '2028-02-01');
  assert.strictEqual(rangeFeb.endDate, '2028-02-29');

  const march2028 = new Date('2028-03-10T00:00:00Z');
  const rangeLastFeb = getDatePresetRange('last_month', march2028);
  assert.strictEqual(rangeLastFeb.startDate, '2028-02-01');
  assert.strictEqual(rangeLastFeb.endDate, '2028-02-29');
});

runTest('returns fallback range on unknown preset', () => {
  const range = getDatePresetRange('unknown_preset', REF_DATE);
  assert.ok(range.startDate && range.endDate);
  assert.strictEqual(range.endDate, '2026-10-30');
});

// -------------------------------------------------------------
// 2. Suite: filterLogsByCriteria
// -------------------------------------------------------------
console.log('\n--- Suite 2: filterLogsByCriteria ---');

runTest('filters by date range (startDate to endDate inclusive)', () => {
  const filtered = filterLogsByCriteria(mockLogs, {
    startDate: '2026-10-29',
    endDate: '2026-10-30'
  });
  // Should include logs 101, 102, 103, 104 (4 logs)
  assert.strictEqual(filtered.length, 4);
  assert.ok(filtered.every(l => l.log_date >= '2026-10-29' && l.log_date <= '2026-10-30'));
});

runTest('filters by single employeeId', () => {
  const filtered = filterLogsByCriteria(mockLogs, {
    employeeId: 'emp-1'
  });
  // emp-1 has log-101, 102, 103 (3 logs)
  assert.strictEqual(filtered.length, 3);
  assert.ok(filtered.every(l => l.employee_id === 'emp-1'));
});

runTest('keeps all employees when employeeId is "all" or empty', () => {
  const filtered1 = filterLogsByCriteria(mockLogs, { employeeId: 'all' });
  assert.strictEqual(filtered1.length, mockLogs.length);

  const filtered2 = filterLogsByCriteria(mockLogs, { employeeId: '' });
  assert.strictEqual(filtered2.length, mockLogs.length);
});

runTest('filters by teamId', () => {
  const filtered = filterLogsByCriteria(mockLogs, {
    teamId: 'team-2'
  });
  // team-2 has log-105, 106 (2 logs)
  assert.strictEqual(filtered.length, 2);
  assert.ok(filtered.every(l => l.team_id === 'team-2'));
});

runTest('filters by search keyword matching product, customer or employee', () => {
  // Search product name
  const res1 = filterLogsByCriteria(mockLogs, { search: 'phản kích' });
  assert.strictEqual(res1.length, 2); // log-101 and log-103

  // Search product ID
  const res2 = filterLogsByCriteria(mockLogs, { search: '1775' });
  assert.strictEqual(res2.length, 1);
  assert.strictEqual(res2[0].id, 'log-102');

  // Search customer
  const res3 = filterLogsByCriteria(mockLogs, { search: 'Hòa Phát' });
  assert.strictEqual(res3.length, 1);
  assert.strictEqual(res3[0].id, 'log-102');

  // Search employee code
  const res4 = filterLogsByCriteria(mockLogs, { search: 'NV04' });
  assert.strictEqual(res4.length, 2);
});

runTest('combines multiple filter criteria (date + employee + search)', () => {
  const filtered = filterLogsByCriteria(mockLogs, {
    startDate: '2026-10-29',
    endDate: '2026-10-30',
    employeeId: 'emp-1',
    search: '1732'
  });
  // emp-1 on 29th and 30th with product 1732 -> log-101 and log-103
  assert.strictEqual(filtered.length, 2);
});

runTest('handles empty or null inputs safely', () => {
  assert.deepStrictEqual(filterLogsByCriteria([], {}), []);
  assert.deepStrictEqual(filterLogsByCriteria(null, {}), []);
  assert.strictEqual(filterLogsByCriteria(mockLogs, null).length, mockLogs.length);
});

// -------------------------------------------------------------
// 3. Suite: calculateAnalyticsKPI
// -------------------------------------------------------------
console.log('\n--- Suite 3: calculateAnalyticsKPI ---');

runTest('calculates accurate KPI metrics for single employee logs', () => {
  // Take emp-1's 3 logs:
  // log-101: qty 4, hrs 4.5, date 2026-10-30, prod 1732
  // log-102: qty 10, hrs 3.5, date 2026-10-30, prod 1775
  // log-103: qty 6, hrs 7.0, date 2026-10-29, prod 1732
  // Total Qty: 4 + 10 + 6 = 20
  // Total Hours: 4.5 + 3.5 + 7.0 = 15.0
  // Work days: 2 days (Oct 29, Oct 30)
  // Productivity: 20 / 15.0 = 1.33 items/hr
  // Avg hours/day: 15.0 / 2 = 7.5 hrs/day
  // Unique products: 2 (1732, 1775)
  const empLogs = mockLogs.filter(l => l.employee_id === 'emp-1');
  const kpi = calculateAnalyticsKPI(empLogs);

  assert.strictEqual(kpi.totalLogs, 3);
  assert.strictEqual(kpi.totalQuantity, 20);
  assert.strictEqual(kpi.totalHours, 15.0);
  assert.strictEqual(kpi.workDaysCount, 2);
  assert.strictEqual(kpi.uniqueEmployeesCount, 1);
  assert.strictEqual(kpi.uniqueProductsCount, 2);
  assert.strictEqual(kpi.productivityPerHour, 1.33);
  assert.strictEqual(kpi.avgHoursPerDay, 7.5);
  assert.strictEqual(kpi.avgQuantityPerDay, 10.0);
});

runTest('calculates accurate KPI metrics across factory for multiple logs', () => {
  const kpi = calculateAnalyticsKPI(mockLogs);
  // Total logs: 6
  // Total quantity: 4 + 10 + 6 + 2 + 12 + 15 = 49
  // Total hours: 4.5 + 3.5 + 7.0 + 8.0 + 6.0 + 8.0 = 37.0
  // Unique work dates: 2026-10-30, 2026-10-29, 2026-10-15, 2026-09-25 = 4 days
  // Unique employees: emp-1, emp-2, emp-4 = 3
  // Unique products: 1732, 1775, 1733, 1816, 1462 = 5
  assert.strictEqual(kpi.totalLogs, 6);
  assert.strictEqual(kpi.totalQuantity, 49);
  assert.strictEqual(kpi.totalHours, 37.0);
  assert.strictEqual(kpi.workDaysCount, 4);
  assert.strictEqual(kpi.uniqueEmployeesCount, 3);
  assert.strictEqual(kpi.uniqueProductsCount, 5);
  assert.strictEqual(kpi.productivityPerHour, Math.round((49 / 37.0) * 100) / 100);
});

runTest('returns zeros and avoids NaN or Division-by-Zero on empty logs', () => {
  const emptyKpi = calculateAnalyticsKPI([]);
  assert.strictEqual(emptyKpi.totalLogs, 0);
  assert.strictEqual(emptyKpi.totalQuantity, 0);
  assert.strictEqual(emptyKpi.totalHours, 0);
  assert.strictEqual(emptyKpi.workDaysCount, 0);
  assert.strictEqual(emptyKpi.productivityPerHour, 0);
  assert.strictEqual(emptyKpi.avgHoursPerDay, 0);
  assert.strictEqual(emptyKpi.avgQuantityPerDay, 0);
  assert.strictEqual(emptyKpi.uniqueEmployeesCount, 0);
  assert.strictEqual(emptyKpi.uniqueProductsCount, 0);
});

// -------------------------------------------------------------
// 4. Suite: groupLogsByDay (Employee Day-by-day View)
// -------------------------------------------------------------
console.log('\n--- Suite 4: groupLogsByDay ---');

runTest('groups logs by date and orders newest first', () => {
  const empLogs = mockLogs.filter(l => l.employee_id === 'emp-1');
  const dayGroups = groupLogsByDay(empLogs);

  // emp-1 worked on 2 dates: 2026-10-30 and 2026-10-29
  assert.strictEqual(dayGroups.length, 2);
  assert.strictEqual(dayGroups[0].date, '2026-10-30');
  assert.strictEqual(dayGroups[1].date, '2026-10-29');

  // Day 1 (Oct 30): 2 logs (log-101 & 102), total qty = 14, total hrs = 8.0
  const day1 = dayGroups[0];
  assert.strictEqual(day1.logs.length, 2);
  assert.strictEqual(day1.totalQuantity, 14);
  assert.strictEqual(day1.totalHours, 8.0);
  assert.strictEqual(day1.productCount, 2);
  assert.ok(day1.dayFormatted);

  // Day 2 (Oct 29): 1 log (log-103), qty = 6, hrs = 7.0
  const day2 = dayGroups[1];
  assert.strictEqual(day2.logs.length, 1);
  assert.strictEqual(day2.totalQuantity, 6);
  assert.strictEqual(day2.totalHours, 7.0);
  assert.strictEqual(day2.productCount, 1);
});

runTest('handles empty list in groupLogsByDay', () => {
  const dayGroups = groupLogsByDay([]);
  assert.deepStrictEqual(dayGroups, []);
});

// -------------------------------------------------------------
// 5. Suite: groupLogsByEmployeeSummary (All Employees Comparison)
// -------------------------------------------------------------
console.log('\n--- Suite 5: groupLogsByEmployeeSummary ---');

runTest('summarizes each employee with totals, work days, productivity', () => {
  const summaries = groupLogsByEmployeeSummary(mockLogs);

  // There are 3 distinct employees in mockLogs: emp-1, emp-2, emp-4
  assert.strictEqual(summaries.length, 3);

  // emp-4 has 12 + 15 = 27 qty (highest), should be sorted first or present
  const emp4 = summaries.find(s => s.employeeCode === 'NV04');
  assert.ok(emp4);
  assert.strictEqual(emp4.employeeName, 'Phạm Văn Minh');
  assert.strictEqual(emp4.teamName, 'Tổ 2 - Tiện & Phay');
  assert.strictEqual(emp4.totalQuantity, 27);
  assert.strictEqual(emp4.totalHours, 14.0);
  assert.strictEqual(emp4.workDaysCount, 2); // 2026-10-15 and 2026-09-25
  assert.strictEqual(emp4.logsCount, 2);
  assert.strictEqual(emp4.productivityPerHour, Math.round((27 / 14.0) * 100) / 100);

  // emp-1: 20 qty, 15.0 hrs, 2 work days (Oct 30, Oct 29), 3 logs
  const emp1 = summaries.find(s => s.employeeCode === 'NV01');
  assert.ok(emp1);
  assert.strictEqual(emp1.totalQuantity, 20);
  assert.strictEqual(emp1.totalHours, 15.0);
  assert.strictEqual(emp1.workDaysCount, 2);
  assert.strictEqual(emp1.logsCount, 3);
  assert.strictEqual(emp1.avgHoursPerDay, 7.5);

  // emp-2: 2 qty, 8.0 hrs, 1 work day
  const emp2 = summaries.find(s => s.employeeCode === 'NV02');
  assert.ok(emp2);
  assert.strictEqual(emp2.totalQuantity, 2);
  assert.strictEqual(emp2.totalHours, 8.0);
  assert.strictEqual(emp2.workDaysCount, 1);
  assert.strictEqual(emp2.logsCount, 1);
});

runTest('formats date and number helpers correctly', () => {
  assert.strictEqual(formatDateVN('2026-10-30'), '30/10/2026');
  assert.strictEqual(formatNumber(1250), '1,250');
  assert.strictEqual(formatNumber(12.5), '12.5');
  assert.strictEqual(formatNumber(0), '0');
});

runTest('handles logs with missing or partial employee info in summary', () => {
  const edgeLogs = [
    {
      id: 'l-edge-1',
      log_date: '2026-10-30',
      quantity: 5,
      duration_hours: 4,
      employees: { code: 'NV99', name: 'Nhân Viên Khác' }
    }
  ];
  const summaries = groupLogsByEmployeeSummary(edgeLogs);
  assert.strictEqual(summaries.length, 1);
  assert.strictEqual(summaries[0].employeeCode, 'NV99');
  assert.strictEqual(summaries[0].employeeName, 'Nhân Viên Khác');
  assert.strictEqual(summaries[0].totalQuantity, 5);
  assert.strictEqual(summaries[0].totalHours, 4);
});

console.log(`\n========================================`);
console.log(`Summary: ${passed} passed, ${failed} failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
