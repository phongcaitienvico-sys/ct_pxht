import assert from 'node:assert';
import {
  groupLogsByEmployee,
  calculateTeamDailyTotals,
  filterLogsByDateAndTeam,
  validateEditInput,
  getEmployeeInitials,
  getQuickDate
} from '../src/components/leader/leaderDailyLogsLogic.js';

console.log('Running tests/leaderDailyLogs.test.js...\n');

// Mock logs data for testing
const mockLogs = [
  {
    id: 'log-1',
    log_date: '2026-10-30',
    team_id: 'team-1',
    team_name: 'Tổ Hàn 1',
    employee_id: 'emp-1',
    employee_code: 'NV01',
    employee_name: 'Trần Văn Hùng',
    product_id: '1732',
    product_name: 'Cánh đập phản kích 2021',
    customer: 'Đại Phú',
    quantity: 10,
    duration_hours: 4.5,
    notes: 'Ca sáng',
    created_at: '2026-10-30T08:00:00Z'
  },
  {
    id: 'log-2',
    log_date: '2026-10-30',
    team_id: 'team-1',
    team_name: 'Tổ Hàn 1',
    employee_id: 'emp-2',
    employee_code: 'NV02',
    employee_name: 'Lê Văn Cường',
    product_id: '1775',
    product_name: 'Cánh búa tâm 360',
    customer: 'Hòa Phát',
    quantity: 25,
    duration_hours: 6.0,
    notes: 'Hoàn thành',
    created_at: '2026-10-30T09:30:00Z'
  },
  {
    id: 'log-3',
    log_date: '2026-10-30',
    team_id: 'team-1',
    team_name: 'Tổ Hàn 1',
    employee_id: 'emp-1', // Same worker as log-1
    employee_code: 'NV01',
    employee_name: 'Trần Văn Hùng',
    product_id: '1816',
    product_name: 'Đĩa búa 1600x1800',
    customer: 'Đại Phú',
    quantity: 5,
    duration_hours: 2.5,
    notes: 'Ca chiều',
    created_at: '2026-10-30T14:00:00Z'
  },
  {
    id: 'log-4',
    log_date: '2026-10-30',
    team_id: 'team-2', // Different team
    team_name: 'Tổ Tiện 2',
    employee_id: 'emp-3',
    employee_code: 'NV03',
    employee_name: 'Phạm Văn Minh',
    product_id: '1780',
    product_name: 'Con lăn băng tải D133x500',
    customer: 'VICEM Bút Sơn',
    quantity: 15,
    duration_hours: 7.0,
    notes: '',
    created_at: '2026-10-30T10:00:00Z'
  },
  {
    id: 'log-5',
    log_date: '2026-10-29', // Different date (yesterday)
    team_id: 'team-1',
    team_name: 'Tổ Hàn 1',
    employee_id: 'emp-1',
    employee_code: 'NV01',
    employee_name: 'Trần Văn Hùng',
    product_id: '1732',
    product_name: 'Cánh đập phản kích 2021',
    customer: 'Đại Phú',
    quantity: 8,
    duration_hours: 4.0,
    notes: 'Hôm qua',
    created_at: '2026-10-29T08:00:00Z'
  }
];

// ==========================================
// Test Suite 1: calculateTeamDailyTotals
// ==========================================
console.log('--- Test Suite 1: calculateTeamDailyTotals ---');
{
  // Test with team-1 logs on 2026-10-30: log-1, log-2, log-3
  const team1TodayLogs = [mockLogs[0], mockLogs[1], mockLogs[2]];
  const totals = calculateTeamDailyTotals(team1TodayLogs);

  assert.strictEqual(totals.totalQuantity, 40, 'Total quantity should be 10 + 25 + 5 = 40');
  assert.strictEqual(totals.totalHours, 13.0, 'Total hours should be 4.5 + 6.0 + 2.5 = 13.0');
  assert.strictEqual(totals.workerCount, 2, 'Should count 2 distinct workers (emp-1 and emp-2)');
  assert.strictEqual(totals.logCount, 3, 'Should count 3 logs');
  assert.strictEqual(totals.productCount, 3, 'Should count 3 distinct products (1732, 1775, 1816)');

  // Test empty and invalid inputs
  const emptyTotals = calculateTeamDailyTotals([]);
  assert.strictEqual(emptyTotals.totalQuantity, 0);
  assert.strictEqual(emptyTotals.totalHours, 0);
  assert.strictEqual(emptyTotals.workerCount, 0);
  assert.strictEqual(emptyTotals.logCount, 0);

  const nullTotals = calculateTeamDailyTotals(null);
  assert.strictEqual(nullTotals.totalQuantity, 0);
  assert.strictEqual(nullTotals.totalHours, 0);
  assert.strictEqual(nullTotals.workerCount, 0);

  // Test with string numbers and decimal precision
  const stringNumLogs = [
    { employee_id: 'e1', product_id: 'p1', quantity: '12', duration_hours: '3.333' },
    { employee_id: 'e1', product_id: 'p1', quantity: '8', duration_hours: '2.667' }
  ];
  const stringTotals = calculateTeamDailyTotals(stringNumLogs);
  assert.strictEqual(stringTotals.totalQuantity, 20);
  assert.strictEqual(stringTotals.totalHours, 6.0);
  assert.strictEqual(stringTotals.workerCount, 1);

  console.log('✔ calculateTeamDailyTotals passed');
}

// ==========================================
// Test Suite 2: groupLogsByEmployee
// ==========================================
console.log('\n--- Test Suite 2: groupLogsByEmployee ---');
{
  const team1TodayLogs = [mockLogs[0], mockLogs[1], mockLogs[2]];
  const groups = groupLogsByEmployee(team1TodayLogs);

  assert.strictEqual(groups.length, 2, 'Should group into 2 employees');

  // Find Trần Văn Hùng group (emp-1)
  const hungGroup = groups.find(g => g.employee_id === 'emp-1');
  assert.ok(hungGroup, 'Group for emp-1 must exist');
  assert.strictEqual(hungGroup.employee_name, 'Trần Văn Hùng');
  assert.strictEqual(hungGroup.employee_code, 'NV01');
  assert.strictEqual(hungGroup.total_quantity, 15, 'Hung total quantity: 10 + 5 = 15');
  assert.strictEqual(hungGroup.total_hours, 7.0, 'Hung total hours: 4.5 + 2.5 = 7.0');
  assert.strictEqual(hungGroup.logs.length, 2, 'Hung should have 2 log items');

  // Find Lê Văn Cường group (emp-2)
  const cuongGroup = groups.find(g => g.employee_id === 'emp-2');
  assert.ok(cuongGroup, 'Group for emp-2 must exist');
  assert.strictEqual(cuongGroup.employee_name, 'Lê Văn Cường');
  assert.strictEqual(cuongGroup.employee_code, 'NV02');
  assert.strictEqual(cuongGroup.total_quantity, 25);
  assert.strictEqual(cuongGroup.total_hours, 6.0);
  assert.strictEqual(cuongGroup.logs.length, 1);

  // Test empty and invalid inputs
  assert.deepStrictEqual(groupLogsByEmployee([]), []);
  assert.deepStrictEqual(groupLogsByEmployee(null), []);
  assert.deepStrictEqual(groupLogsByEmployee(undefined), []);

  // Test nested employee object support (Supabase joins return employees: { full_name, code })
  const nestedLogs = [
    {
      id: 'nested-1',
      employee_id: 'emp-99',
      employees: { full_name: 'Nguyễn Văn A', code: 'NV99' },
      quantity: 5,
      duration_hours: 2.0
    }
  ];
  const nestedGroups = groupLogsByEmployee(nestedLogs);
  assert.strictEqual(nestedGroups.length, 1);
  assert.strictEqual(nestedGroups[0].employee_name, 'Nguyễn Văn A');
  assert.strictEqual(nestedGroups[0].employee_code, 'NV99');

  console.log('✔ groupLogsByEmployee passed');
}

// ==========================================
// Test Suite 3: filterLogsByDateAndTeam
// ==========================================
console.log('\n--- Test Suite 3: filterLogsByDateAndTeam ---');
{
  // Filter by date '2026-10-30' and team 'team-1'
  const filtered1 = filterLogsByDateAndTeam(mockLogs, '2026-10-30', 'team-1');
  assert.strictEqual(filtered1.length, 3, 'Should match 3 logs for team-1 on 2026-10-30');
  assert.ok(filtered1.every(l => l.log_date === '2026-10-30' && l.team_id === 'team-1'));

  // Filter by date only (all teams)
  const filteredDateOnly = filterLogsByDateAndTeam(mockLogs, '2026-10-30', null);
  assert.strictEqual(filteredDateOnly.length, 4, 'Should return 4 logs on 2026-10-30 across all teams');

  // Filter by team only (all dates)
  const filteredTeamOnly = filterLogsByDateAndTeam(mockLogs, null, 'team-1');
  assert.strictEqual(filteredTeamOnly.length, 4, 'Should return 4 logs for team-1 across all dates');

  // Filter by team-2 on 2026-10-30
  const filteredTeam2 = filterLogsByDateAndTeam(mockLogs, '2026-10-30', 'team-2');
  assert.strictEqual(filteredTeam2.length, 1);
  assert.strictEqual(filteredTeam2[0].id, 'log-4');

  // Filter with no match
  const noMatch = filterLogsByDateAndTeam(mockLogs, '2025-01-01', 'team-1');
  assert.strictEqual(noMatch.length, 0);

  // Edge cases
  assert.deepStrictEqual(filterLogsByDateAndTeam([], '2026-10-30', 'team-1'), []);
  assert.deepStrictEqual(filterLogsByDateAndTeam(null, '2026-10-30', 'team-1'), []);
  assert.deepStrictEqual(filterLogsByDateAndTeam(undefined, '2026-10-30', 'team-1'), []);

  // 'all' keyword should behave like no filter for team
  const allTeamFilter = filterLogsByDateAndTeam(mockLogs, '2026-10-30', 'all');
  assert.strictEqual(allTeamFilter.length, 4);

  console.log('✔ filterLogsByDateAndTeam passed');
}

// ==========================================
// Test Suite 4: validateEditInput
// ==========================================
console.log('\n--- Test Suite 4: validateEditInput ---');
{
  // Valid input
  const valid1 = validateEditInput(10, 4.5);
  assert.strictEqual(valid1.isValid, true);
  assert.strictEqual(valid1.errorMessages.length, 0);
  assert.strictEqual(valid1.parsedQuantity, 10);
  assert.strictEqual(valid1.parsedDuration, 4.5);

  // Valid with string representations
  const validStrings = validateEditInput('25', '6.0');
  assert.strictEqual(validStrings.isValid, true);
  assert.strictEqual(validStrings.parsedQuantity, 25);
  assert.strictEqual(validStrings.parsedDuration, 6.0);

  // Invalid quantity: 0
  const invalidQtyZero = validateEditInput(0, 4.0);
  assert.strictEqual(invalidQtyZero.isValid, false);
  assert.ok(invalidQtyZero.errors.quantity, 'Should have quantity error');
  assert.ok(invalidQtyZero.errorMessages.some(m => m.includes('Số lượng')));

  // Invalid quantity: negative
  const invalidQtyNeg = validateEditInput(-5, 4.0);
  assert.strictEqual(invalidQtyNeg.isValid, false);
  assert.ok(invalidQtyNeg.errors.quantity);

  // Invalid quantity: empty string / null / undefined / NaN
  assert.strictEqual(validateEditInput('', 4.0).isValid, false);
  assert.strictEqual(validateEditInput(null, 4.0).isValid, false);
  assert.strictEqual(validateEditInput(undefined, 4.0).isValid, false);
  assert.strictEqual(validateEditInput('abc', 4.0).isValid, false);

  // Invalid duration: 0
  const invalidDurZero = validateEditInput(10, 0);
  assert.strictEqual(invalidDurZero.isValid, false);
  assert.ok(invalidDurZero.errors.duration, 'Should have duration error');
  assert.ok(invalidDurZero.errorMessages.some(m => m.includes('Thời gian')));

  // Invalid duration: negative
  const invalidDurNeg = validateEditInput(10, -2.5);
  assert.strictEqual(invalidDurNeg.isValid, false);
  assert.ok(invalidDurNeg.errors.duration);

  // Invalid duration: empty / non-numeric
  assert.strictEqual(validateEditInput(10, '').isValid, false);
  assert.strictEqual(validateEditInput(10, 'xyz').isValid, false);
  assert.strictEqual(validateEditInput(10, null).isValid, false);

  // Both invalid
  const bothInvalid = validateEditInput(-1, 0);
  assert.strictEqual(bothInvalid.isValid, false);
  assert.ok(bothInvalid.errors.quantity);
  assert.ok(bothInvalid.errors.duration);
  assert.strictEqual(bothInvalid.errorMessages.length, 2);

  console.log('✔ validateEditInput passed');
}

// ==========================================
// Test Suite 5: Helper utilities
// ==========================================
console.log('\n--- Test Suite 5: Helper utilities ---');
{
  // getEmployeeInitials
  assert.strictEqual(getEmployeeInitials('Trần Văn Hùng'), 'VH');
  assert.strictEqual(getEmployeeInitials('Lê Văn Cường'), 'VC');
  assert.strictEqual(getEmployeeInitials('Nguyễn Nam'), 'NN');
  assert.strictEqual(getEmployeeInitials('Hải'), 'H');
  assert.strictEqual(getEmployeeInitials(''), 'NV');
  assert.strictEqual(getEmployeeInitials(null), 'NV');

  // getQuickDate
  const today = new Date().toISOString().slice(0, 10);
  assert.strictEqual(getQuickDate('today'), today);

  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);
  assert.strictEqual(getQuickDate('yesterday'), yesterday);

  console.log('✔ Helper utilities passed');
}

console.log('\n========================================');
console.log('🎉 ALL LEADER DAILY LOGS TESTS PASSED!');
console.log('========================================\n');
