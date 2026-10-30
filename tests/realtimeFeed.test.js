import assert from 'node:assert';
import {
  calculateTodayKPI,
  filterLogs,
  handleRealtimeEvent,
  formatLogTime,
  normalizeSearchText
} from '../src/components/admin/realtimeFeedLogic.js';

console.log('Running tests/realtimeFeed.test.js...\n');

// Sample test dataset
const mockLogs = [
  {
    id: 'log-001',
    log_date: '2026-10-30',
    team_id: 'team-01',
    team_name: 'Tổ 1 - Cơ khí & Đúc',
    employee_id: 'emp-01',
    employee_code: 'NV01',
    employee_name: 'Trần Văn Hùng',
    product_id: '1732',
    product_name: 'Cánh đập phản kích 2021',
    quantity: 10,
    duration_hours: 4.5,
    notes: 'Hoàn thành đợt 1',
    created_at: '2026-10-30T08:30:00.000Z'
  },
  {
    id: 'log-002',
    log_date: '2026-10-30',
    team_id: 'team-01',
    team_name: 'Tổ 1 - Cơ khí & Đúc',
    employee_id: 'emp-02',
    employee_code: 'NV02',
    employee_name: 'Lê Văn Cường',
    product_id: '1775',
    product_name: 'Cánh búa tâm 360',
    quantity: 25,
    duration_hours: 6.0,
    notes: 'Phay tinh xong',
    created_at: '2026-10-30T09:15:00.000Z'
  },
  {
    id: 'log-003',
    log_date: '2026-10-30',
    team_id: 'team-02',
    team_name: 'Tổ 2 - Tiện & Phay',
    employee_id: 'emp-04',
    employee_code: 'NV04',
    employee_name: 'Phạm Văn Minh',
    product_id: '1780',
    product_name: 'Con lăn băng tải D133x500',
    quantity: 15,
    duration_hours: 5.5,
    notes: 'Tiện ren đầu trục',
    created_at: '2026-10-30T10:00:00.000Z'
  },
  {
    id: 'log-004',
    log_date: '2026-10-30',
    team_id: 'team-01',
    team_name: 'Tổ 1 - Cơ khí & Đúc',
    employee_id: 'emp-01', // Same worker as log-001
    employee_code: 'NV01',
    employee_name: 'Trần Văn Hùng',
    product_id: '1733',
    product_name: 'Ống gối bi 231/500',
    quantity: 5,
    duration_hours: 2.5,
    notes: 'Làm thêm ca chiều',
    created_at: '2026-10-30T14:30:00.000Z'
  },
  {
    id: 'log-005',
    log_date: '2026-10-29', // Yesterday's log
    team_id: 'team-02',
    team_name: 'Tổ 2 - Tiện & Phay',
    employee_id: 'emp-05',
    employee_code: 'NV05',
    employee_name: 'Hoàng Đức Tuấn',
    product_id: '1785',
    product_name: 'Trục cán định hình',
    quantity: 8,
    duration_hours: 7.0,
    notes: 'Hôm qua làm',
    created_at: '2026-10-29T16:00:00.000Z'
  }
];

// ============================================================================
// 1. Tests for calculateTodayKPI
// ============================================================================
console.log('1. Testing calculateTodayKPI...');

{
  // Test KPI calculation for 2026-10-30
  const kpi = calculateTodayKPI(mockLogs, '2026-10-30');

  // Total quantity for 2026-10-30: 10 + 25 + 15 + 5 = 55 (ignores log-005 which is yesterday)
  assert.strictEqual(kpi.totalQuantity, 55, 'Total quantity today should be 55');

  // Total hours for 2026-10-30: 4.5 + 6.0 + 5.5 + 2.5 = 18.5
  assert.strictEqual(kpi.totalHours, 18.5, 'Total hours today should be 18.5');

  // Active workers count: emp-01, emp-02, emp-04 -> 3 distinct workers
  assert.strictEqual(kpi.activeWorkersCount, 3, 'Active workers count should be 3 distinct workers');

  // Active teams count: team-01, team-02 -> 2 distinct teams
  assert.strictEqual(kpi.activeTeamsCount, 2, 'Active teams count should be 2 distinct teams');

  // Total logs today: 4 logs
  assert.strictEqual(kpi.totalLogsCount, 4, 'Total logs today should be 4');
}

{
  // Test KPI calculation for all dates
  const allKpi = calculateTodayKPI(mockLogs, 'all');
  assert.strictEqual(allKpi.totalQuantity, 63, 'Total quantity all should be 63 (55 + 8)');
  assert.strictEqual(allKpi.totalHours, 25.5, 'Total hours all should be 25.5 (18.5 + 7.0)');
  assert.strictEqual(allKpi.activeWorkersCount, 4, 'Active workers count all should be 4');
  assert.strictEqual(allKpi.activeTeamsCount, 2, 'Active teams count all should be 2');
  assert.strictEqual(allKpi.totalLogsCount, 5, 'Total logs count all should be 5');
}

{
  // Test KPI calculation with string quantities/hours and edge cases
  const dirtyLogs = [
    { log_date: '2026-10-30', employee_id: 'e1', team_id: 't1', quantity: '12', duration_hours: '3.5' },
    { log_date: '2026-10-30', employee_id: 'e2', team_id: 't1', quantity: 0, duration_hours: null },
    { log_date: '2026-10-30', employee_id: 'e2', team_id: 't1', quantity: -2, duration_hours: -1 }, // Should ignore or handle negative
    { log_date: '2026-10-30', employee_id: null, team_id: null, quantity: 'invalid', duration_hours: undefined }
  ];

  const kpi = calculateTodayKPI(dirtyLogs, '2026-10-30');
  assert.strictEqual(kpi.totalQuantity, 12, 'Should parse string quantity and skip invalid/negative');
  assert.strictEqual(kpi.totalHours, 3.5, 'Should parse string hours and skip null/negative');
  assert.strictEqual(kpi.activeWorkersCount, 2, 'Should count valid unique worker ids (e1, e2)');
  assert.strictEqual(kpi.activeTeamsCount, 1, 'Should count valid unique team id (t1)');
}

{
  // Test empty and invalid inputs
  const emptyKpi = calculateTodayKPI([], '2026-10-30');
  assert.deepStrictEqual(emptyKpi, {
    totalQuantity: 0,
    totalHours: 0,
    activeWorkersCount: 0,
    activeTeamsCount: 0,
    totalLogsCount: 0
  }, 'Empty logs array should return 0 for all KPIs');

  const nullKpi = calculateTodayKPI(null);
  assert.strictEqual(nullKpi.totalQuantity, 0, 'Null logs should return 0 quantity');
  assert.strictEqual(nullKpi.totalHours, 0, 'Null logs should return 0 hours');
}

console.log('✓ calculateTodayKPI passed all assertions.\n');

// ============================================================================
// 2. Tests for filterLogs
// ============================================================================
console.log('2. Testing filterLogs...');

{
  // No filter returns all logs
  const all = filterLogs(mockLogs, {});
  assert.strictEqual(all.length, mockLogs.length, 'No filters should return all logs');

  const allWithAllValues = filterLogs(mockLogs, { teamId: 'all', searchTerm: '', date: 'all' });
  assert.strictEqual(allWithAllValues.length, mockLogs.length, 'Filter with all values should return all logs');
}

{
  // Filter by teamId
  const team1Logs = filterLogs(mockLogs, { teamId: 'team-01' });
  assert.strictEqual(team1Logs.length, 3, 'Team 1 should have 3 logs');
  assert.ok(team1Logs.every(l => l.team_id === 'team-01'), 'All filtered logs must belong to team-01');

  const team2Logs = filterLogs(mockLogs, { teamId: 'team-02' });
  assert.strictEqual(team2Logs.length, 2, 'Team 2 should have 2 logs');
}

{
  // Filter by date
  const todayLogs = filterLogs(mockLogs, { date: '2026-10-30' });
  assert.strictEqual(todayLogs.length, 4, 'Should filter exactly 4 logs for 2026-10-30');

  const yesterdayLogs = filterLogs(mockLogs, { date: '2026-10-29' });
  assert.strictEqual(yesterdayLogs.length, 1, 'Should filter 1 log for 2026-10-29');
}

{
  // Filter by search term - worker name (Vietnamese accent insensitive)
  const hungLogs = filterLogs(mockLogs, { searchTerm: 'tran van hung' });
  assert.strictEqual(hungLogs.length, 2, 'Search "tran van hung" should find 2 logs for Tran Van Hung');

  const hungAccentLogs = filterLogs(mockLogs, { searchTerm: 'Trần Văn Hùng' });
  assert.strictEqual(hungAccentLogs.length, 2, 'Search with diacritics should match');

  // Filter by worker code
  const nv04Logs = filterLogs(mockLogs, { searchTerm: 'NV04' });
  assert.strictEqual(nv04Logs.length, 1, 'Search by code NV04 should find 1 log');
  assert.strictEqual(nv04Logs[0].employee_name, 'Phạm Văn Minh');

  // Filter by product ID
  const prod1732Logs = filterLogs(mockLogs, { searchTerm: '1732' });
  assert.strictEqual(prod1732Logs.length, 1, 'Search by product id 1732 should find 1 log');

  // Filter by product name
  const buaLogs = filterLogs(mockLogs, { searchTerm: 'cánh búa' });
  assert.strictEqual(buaLogs.length, 1, 'Search "cánh búa" should find 1 log');

  // Filter by notes
  const caChieuLogs = filterLogs(mockLogs, { searchTerm: 'ca chiều' });
  assert.strictEqual(caChieuLogs.length, 1, 'Search in notes "ca chiều" should find log-004');
}

{
  // Combined filtering: Team + Search + Date
  const combined = filterLogs(mockLogs, {
    teamId: 'team-01',
    searchTerm: 'Trần Văn Hùng',
    date: '2026-10-30'
  });
  assert.strictEqual(combined.length, 2, 'Combined filter should match 2 logs');

  const nonMatchingCombined = filterLogs(mockLogs, {
    teamId: 'team-02',
    searchTerm: 'Trần Văn Hùng',
    date: '2026-10-30'
  });
  assert.strictEqual(nonMatchingCombined.length, 0, 'No logs match Hung in team 2');
}

console.log('✓ filterLogs passed all assertions.\n');

// ============================================================================
// 3. Tests for handleRealtimeEvent
// ============================================================================
console.log('3. Testing handleRealtimeEvent...');

{
  // INSERT event: adds to the top of the list and marks _isNew
  const newLog = {
    id: 'log-099',
    log_date: '2026-10-30',
    team_id: 'team-02',
    employee_name: 'Lê Văn Cường',
    product_name: 'Chi tiết mới',
    quantity: 30,
    duration_hours: 4.0,
    created_at: '2026-10-30T17:00:00.000Z'
  };

  const resultInsert = handleRealtimeEvent(mockLogs, {
    eventType: 'INSERT',
    new: newLog
  });

  assert.strictEqual(resultInsert.length, mockLogs.length + 1, 'List length should increase by 1');
  assert.strictEqual(resultInsert[0].id, 'log-099', 'New record should be at index 0 (top of feed)');
  assert.strictEqual(resultInsert[0]._isNew, true, 'New record should have _isNew flag');

  // Prevent duplicate if INSERT receives an existing ID
  const duplicateInsert = handleRealtimeEvent(resultInsert, {
    eventType: 'INSERT',
    new: { ...newLog, quantity: 35 }
  });
  assert.strictEqual(duplicateInsert.length, resultInsert.length, 'Duplicate insert should not increase length');
  assert.strictEqual(duplicateInsert[0].quantity, 35, 'Duplicate insert should update existing record');
}

{
  // UPDATE event: updates record in-place
  const updatedLog = {
    id: 'log-002',
    log_date: '2026-10-30',
    team_id: 'team-01',
    team_name: 'Tổ 1 - Cơ khí & Đúc',
    employee_id: 'emp-02',
    employee_code: 'NV02',
    employee_name: 'Lê Văn Cường',
    product_id: '1775',
    product_name: 'Cánh búa tâm 360 (Đã chỉnh sửa)',
    quantity: 30, // Changed from 25
    duration_hours: 7.0, // Changed from 6.0
    notes: 'Sửa lại số lượng thực tế',
    created_at: '2026-10-30T09:15:00.000Z'
  };

  const resultUpdate = handleRealtimeEvent(mockLogs, {
    eventType: 'UPDATE',
    new: updatedLog
  });

  assert.strictEqual(resultUpdate.length, mockLogs.length, 'Length should remain unchanged on update');
  const target = resultUpdate.find(l => l.id === 'log-002');
  assert.strictEqual(target.quantity, 30, 'Quantity should be updated to 30');
  assert.strictEqual(target.duration_hours, 7.0, 'Hours should be updated to 7.0');
  assert.strictEqual(target.product_name, 'Cánh búa tâm 360 (Đã chỉnh sửa)');
}

{
  // DELETE event: removes record
  const resultDelete = handleRealtimeEvent(mockLogs, {
    eventType: 'DELETE',
    old: { id: 'log-003' }
  });

  assert.strictEqual(resultDelete.length, mockLogs.length - 1, 'Length should decrease by 1');
  assert.strictEqual(resultDelete.find(l => l.id === 'log-003'), undefined, 'log-003 should be removed');

  // DELETE with oldId alternative property
  const resultDeleteOldId = handleRealtimeEvent(mockLogs, {
    eventType: 'DELETE',
    oldId: 'log-001'
  });
  assert.strictEqual(resultDeleteOldId.length, mockLogs.length - 1);
  assert.strictEqual(resultDeleteOldId.find(l => l.id === 'log-001'), undefined);
}

{
  // Edge cases: null event or unknown event type
  const unchanged1 = handleRealtimeEvent(mockLogs, null);
  assert.strictEqual(unchanged1, mockLogs, 'Null event should return same logs');

  const unchanged2 = handleRealtimeEvent(mockLogs, { eventType: 'UNKNOWN' });
  assert.strictEqual(unchanged2.length, mockLogs.length, 'Unknown event type should not change logs');
}

console.log('✓ handleRealtimeEvent passed all assertions.\n');

// ============================================================================
// 4. Tests for formatLogTime & normalizeSearchText
// ============================================================================
console.log('4. Testing formatLogTime and normalizeSearchText...');

{
  assert.strictEqual(normalizeSearchText('ĐẶNG VĂN BÌNH'), 'dang van binh');
  assert.strictEqual(normalizeSearchText('   Tổ 1: Cơ Khí - Đúc   '), 'to 1: co khi - duc');
  assert.strictEqual(normalizeSearchText(null), '');

  // formatLogTime
  const timeFormatted = formatLogTime('2026-10-30T08:30:00.000Z');
  assert.ok(typeof timeFormatted === 'string' && timeFormatted.length > 0, 'formatLogTime should return string');
  assert.strictEqual(formatLogTime(null), '', 'formatLogTime(null) should return empty string');
  assert.strictEqual(formatLogTime('invalid-date'), '', 'formatLogTime(invalid) should return empty string');
}

console.log('✓ formatLogTime and normalizeSearchText passed all assertions.\n');

console.log('----------------------------------------------------');
console.log('All tests in tests/realtimeFeed.test.js PASSED!');
console.log('----------------------------------------------------');
