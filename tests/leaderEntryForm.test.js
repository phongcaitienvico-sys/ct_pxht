import assert from 'node:assert';
import {
  createEmptyRow,
  validateEntryForm,
  buildBatchPayload,
  filterActiveProducts,
  filterTeamEmployees,
  formatProductLabel,
  calculateFormTotals
} from '../src/components/leader/leaderEntryLogic.js';

console.log('Running tests/leaderEntryForm.test.js...\n');

// Mock data for tests
const mockProducts = [
  { id: '1732', name: 'Cánh đập phản kích 2021', customer: 'Đại Phú', is_active_today: true },
  { id: '1733', name: 'Ống gối bi 231/500', customer: 'Đại Phú', is_active_today: false },
  { id: '1775', name: 'Cánh búa tâm 360', customer: 'Hòa Phát', is_active_today: true },
  { id: '1780', name: 'Con lăn băng tải D133x500', customer: 'VICEM Bút Sơn', is_active_today: false },
  { id: '1816', name: 'Đĩa búa 1600x1800', customer: 'Đại Phú', is_active_today: true }
];

const mockEmployees = [
  { id: 'emp-1', code: 'NV01', full_name: 'Trần Văn Hùng', team_id: 'team-1', is_active: true },
  { id: 'emp-2', code: 'NV02', full_name: 'Lê Văn Cường', team_id: 'team-1', is_active: true },
  { id: 'emp-3', code: 'NV03', full_name: 'Nguyễn Văn Thắng', team_id: 'team-1', is_active: false }, // inactive
  { id: 'emp-4', code: 'NV04', full_name: 'Phạm Văn Minh', team_id: 'team-2', is_active: true },
  { id: 'emp-5', code: 'NV05', full_name: 'Hoàng Văn Toàn', team_id: 'team-2', is_active: true }
];

// ==========================================
// Test Suite 1: createEmptyRow
// ==========================================
console.log('--- Test Suite 1: createEmptyRow ---');
{
  const row1 = createEmptyRow();
  const row2 = createEmptyRow();

  assert.ok(row1.id, 'Row must have an auto-generated id');
  assert.ok(row2.id, 'Row must have an auto-generated id');
  assert.notStrictEqual(row1.id, row2.id, 'Each generated row must have a unique id');

  assert.strictEqual(row1.product_id, '', 'Initial product_id must be empty string');
  assert.strictEqual(row1.quantity, '', 'Initial quantity must be empty string');
  assert.strictEqual(row1.duration_hours, '', 'Initial duration_hours must be empty string');
  assert.strictEqual(row1.notes, '', 'Initial notes must be empty string');
  assert.strictEqual(row1.operation, '', 'Initial operation must be empty string');

  console.log('✔ createEmptyRow passed');
}

// ==========================================
// Test Suite 2: filterActiveProducts
// ==========================================
console.log('\n--- Test Suite 2: filterActiveProducts ---');
{
  const activeProducts = filterActiveProducts(mockProducts);
  assert.strictEqual(activeProducts.length, 3, 'Should filter exactly 3 active products');
  assert.deepStrictEqual(
    activeProducts.map(p => p.id),
    ['1732', '1775', '1816'],
    'Must return products with is_active_today = true'
  );

  // Edge cases
  assert.deepStrictEqual(filterActiveProducts([]), [], 'Empty array should return empty array');
  assert.deepStrictEqual(filterActiveProducts(null), [], 'Null input should return empty array');
  assert.deepStrictEqual(filterActiveProducts(undefined), [], 'Undefined input should return empty array');

  console.log('✔ filterActiveProducts passed');
}

// ==========================================
// Test Suite 3: filterTeamEmployees
// ==========================================
console.log('\n--- Test Suite 3: filterTeamEmployees ---');
{
  // Không còn phân tổ: luôn trả về mọi nhân viên đang hoạt động
  const team1Employees = filterTeamEmployees(mockEmployees, 'team-1', false);
  assert.strictEqual(team1Employees.length, 4, 'Should include all active employees regardless of team');
  assert.ok(team1Employees.every(e => e.is_active !== false), 'Must exclude inactive employees');
  assert.strictEqual(filterTeamEmployees(mockEmployees).length, 4, 'No team arg => all active employees');

  // Filter with includeOtherTeams = true (borrow workers from other teams)
  const allTeamEmployees = filterTeamEmployees(mockEmployees, 'team-1', true);
  assert.strictEqual(allTeamEmployees.length, 4, 'Should include active employees from all teams');
  assert.ok(allTeamEmployees.some(e => e.team_id === 'team-2'), 'Should include workers from team-2');
  assert.ok(allTeamEmployees.every(e => e.is_active !== false), 'Must still exclude inactive employees');

  // Edge cases
  assert.deepStrictEqual(filterTeamEmployees([], 'team-1'), [], 'Empty array should return empty array');
  assert.deepStrictEqual(filterTeamEmployees(null, 'team-1'), [], 'Null employees should return empty array');

  console.log('✔ filterTeamEmployees passed');
}

// ==========================================
// Test Suite 4: validateEntryForm
// ==========================================
console.log('\n--- Test Suite 4: validateEntryForm ---');
{
  // 4.1 Missing worker/employee
  const noWorkerForm = {
    employee_id: '',
    log_date: '2026-10-30',
    rows: [{ id: '1', product_id: '1732', quantity: 5, duration_hours: 4 }]
  };
  const valNoWorker = validateEntryForm(noWorkerForm);
  assert.strictEqual(valNoWorker.isValid, false, 'Must be invalid if employee_id is empty');
  assert.ok(valNoWorker.errors.employee_id, 'Must set employee_id error');

  // 4.2 Missing product in row
  const missingProductForm = {
    employee_id: 'emp-1',
    log_date: '2026-10-30',
    rows: [{ id: '1', product_id: '', quantity: 5, duration_hours: 4 }]
  };
  const valMissingProduct = validateEntryForm(missingProductForm);
  assert.strictEqual(valMissingProduct.isValid, false, 'Must be invalid if product_id is empty');
  assert.ok(valMissingProduct.errors.rows[0]?.product_id, 'Row 0 must have product_id error');

  // 4.3 Quantity <= 0 or invalid
  const invalidQtyCases = [0, -2, '', 'abc', null, NaN];
  for (const qty of invalidQtyCases) {
    const invalidQtyForm = {
      employee_id: 'emp-1',
      log_date: '2026-10-30',
      rows: [{ id: '1', product_id: '1732', quantity: qty, duration_hours: 4 }]
    };
    const valQty = validateEntryForm(invalidQtyForm);
    assert.strictEqual(valQty.isValid, false, `Must reject quantity: ${qty}`);
    assert.ok(valQty.errors.rows[0]?.quantity, `Row 0 must have quantity error for: ${qty}`);
  }

  // 4.4 Duration <= 0 or invalid
  const invalidDurationCases = [0, -1.5, '', 'xyz', null, NaN];
  for (const dur of invalidDurationCases) {
    const invalidDurationForm = {
      employee_id: 'emp-1',
      log_date: '2026-10-30',
      rows: [{ id: '1', product_id: '1732', quantity: 10, duration_hours: dur }]
    };
    const valDur = validateEntryForm(invalidDurationForm);
    assert.strictEqual(valDur.isValid, false, `Must reject duration_hours: ${dur}`);
    assert.ok(valDur.errors.rows[0]?.duration_hours, `Row 0 must have duration error for: ${dur}`);
  }

  // 4.5 Duplicate products in different rows
  const duplicateProductForm = {
    employee_id: 'emp-1',
    log_date: '2026-10-30',
    rows: [
      { id: '1', product_id: '1732', quantity: 5, duration_hours: 3 },
      { id: '2', product_id: '1775', quantity: 2, duration_hours: 2 },
      { id: '3', product_id: '1732', quantity: 3, duration_hours: 2 } // DUPLICATE product_id 1732
    ]
  };
  const valDuplicate = validateEntryForm(duplicateProductForm);
  assert.strictEqual(valDuplicate.isValid, false, 'Must reject duplicate products in the same batch');
  assert.ok(
    valDuplicate.errors.duplicateProductIds?.includes('1732') ||
    valDuplicate.errors.rows[2]?.product_id,
    'Must indicate duplicate error for product 1732'
  );
  assert.ok(
    valDuplicate.errorMessages.some(msg => msg.includes('trùng lặp') || msg.includes('1732')),
    'errorMessages must mention duplicate product'
  );

  // 4.5b Cùng sản phẩm nhưng khác công đoạn thì hợp lệ; trùng cả công đoạn thì không
  const opProducts = [
    { id: '1732', name: 'A', operations: ['Mài đậu', 'Sơn'] },
    { id: '1775', name: 'B', operations: [] }
  ];
  const sameProdDiffOp = validateEntryForm({
    employee_id: 'emp-1',
    rows: [
      { id: '1', product_id: '1732', operation: 'Mài đậu', quantity: 5, duration_hours: 3 },
      { id: '2', product_id: '1732', operation: 'Sơn', quantity: 2, duration_hours: 2 }
    ]
  }, opProducts);
  assert.strictEqual(sameProdDiffOp.isValid, true, 'Same product with different operations is allowed');
  const sameProdSameOp = validateEntryForm({
    employee_id: 'emp-1',
    rows: [
      { id: '1', product_id: '1732', operation: 'Sơn', quantity: 5, duration_hours: 3 },
      { id: '2', product_id: '1732', operation: 'Sơn', quantity: 2, duration_hours: 2 }
    ]
  }, opProducts);
  assert.strictEqual(sameProdSameOp.isValid, false, 'Same product + same operation is a duplicate');
  assert.ok(sameProdSameOp.errors.duplicateProductIds.includes('1732'));

  // 4.5c Sản phẩm có công đoạn thì bắt buộc chọn
  const missingOp = validateEntryForm({
    employee_id: 'emp-1',
    rows: [{ id: '1', product_id: '1732', operation: '', quantity: 5, duration_hours: 3 }]
  }, opProducts);
  assert.strictEqual(missingOp.isValid, false);
  assert.strictEqual(missingOp.errors.rows[0].operation, 'Vui lòng chọn công đoạn');
  const noOpNeeded = validateEntryForm({
    employee_id: 'emp-1',
    rows: [{ id: '1', product_id: '1775', quantity: 5, duration_hours: 3 }]
  }, opProducts);
  assert.strictEqual(noOpNeeded.isValid, true, 'Product without operations needs no operation');
  const noProductsArg = validateEntryForm({
    employee_id: 'emp-1',
    rows: [{ id: '1', product_id: '1732', quantity: 5, duration_hours: 3 }]
  });
  assert.strictEqual(noProductsArg.isValid, true, 'Without product list operation is not enforced');

  // 4.6 Empty rows list
  const emptyRowsForm = {
    employee_id: 'emp-1',
    log_date: '2026-10-30',
    rows: []
  };
  const valEmptyRows = validateEntryForm(emptyRowsForm);
  assert.strictEqual(valEmptyRows.isValid, false, 'Form with no rows must be invalid');

  // 4.7 Completely valid multi-row form
  const validForm = {
    employee_id: 'emp-1',
    log_date: '2026-10-30',
    rows: [
      { id: '1', product_id: '1732', quantity: 5, duration_hours: 3.5, notes: 'Gia công tiện' },
      { id: '2', product_id: '1775', quantity: 12, duration_hours: 4.5, notes: 'Phay rãnh' }
    ]
  };
  const valValid = validateEntryForm(validForm);
  assert.strictEqual(valValid.isValid, true, 'Valid form must pass validation');
  assert.strictEqual(valValid.errorMessages.length, 0, 'No error messages on valid form');

  console.log('✔ validateEntryForm passed');
}

// ==========================================
// Test Suite 5: buildBatchPayload
// ==========================================
console.log('\n--- Test Suite 5: buildBatchPayload ---');
{
  const formData = {
    employee_id: 'emp-1',
    log_date: '2026-10-30',
    rows: [
      { id: '1', product_id: '1732', operation: ' Sơn ', quantity: '5', duration_hours: '3.5', notes: 'Gia công tiện ' },
      { id: '2', product_id: '1775', quantity: 10, duration_hours: 4, notes: '' }
    ]
  };
  const teamId = 'team-1';
  const userId = 'leader-user-123';

  const payload = buildBatchPayload(formData, teamId, userId);

  assert.strictEqual(Array.isArray(payload), true, 'Payload must be an array');
  assert.strictEqual(payload.length, 2, 'Payload must contain 2 log items');

  const item1 = payload[0];
  assert.strictEqual(item1.employee_id, 'emp-1');
  assert.strictEqual(item1.product_id, '1732');
  assert.strictEqual(item1.team_id, 'team-1');
  assert.strictEqual(item1.created_by, 'leader-user-123');
  assert.strictEqual(item1.log_date, '2026-10-30');
  assert.strictEqual(item1.quantity, 5, 'Quantity must be parsed to Number');
  assert.strictEqual(item1.duration_hours, 3.5, 'Duration must be parsed to Number');
  assert.strictEqual(item1.notes, 'Gia công tiện', 'Notes must be trimmed');
  assert.strictEqual(item1.operation, 'Sơn', 'Operation must be trimmed');

  const item2 = payload[1];
  assert.strictEqual(item2.employee_id, 'emp-1');
  assert.strictEqual(item2.product_id, '1775');
  assert.strictEqual(item2.quantity, 10);
  assert.strictEqual(item2.duration_hours, 4);
  assert.strictEqual(item2.notes, '');
  assert.strictEqual(item2.operation, '', 'Missing operation => empty string');

  // Default date fallback
  const noDatePayload = buildBatchPayload({
    employee_id: 'emp-1',
    rows: [{ product_id: '1732', quantity: 1, duration_hours: 1 }]
  }, teamId, userId);
  assert.strictEqual(typeof noDatePayload[0].log_date, 'string');
  assert.strictEqual(noDatePayload[0].log_date.length, 10, 'Default date should be YYYY-MM-DD');

  // Edge cases
  assert.deepStrictEqual(buildBatchPayload(null), [], 'Null formData should return empty array');
  assert.deepStrictEqual(buildBatchPayload({ rows: [] }), [], 'Empty rows should return empty array');

  console.log('✔ buildBatchPayload passed');
}

// ==========================================
// Test Suite 6: Utilities (formatProductLabel & calculateFormTotals)
// ==========================================
console.log('\n--- Test Suite 6: formatProductLabel & calculateFormTotals ---');
{
  const p1 = { id: '1732', name: 'Cánh đập phản kích 2021', customer: 'Đại Phú' };
  const p2 = { id: '1733', name: 'Ống gối bi' };

  assert.strictEqual(
    formatProductLabel(p1),
    '[#1732] Cánh đập phản kích 2021 (Đại Phú)'
  );
  assert.strictEqual(
    formatProductLabel(p2),
    '[#1733] Ống gối bi'
  );

  const totals = calculateFormTotals([
    { product_id: '1732', quantity: 5, duration_hours: 3.5 },
    { product_id: '1775', quantity: '10', duration_hours: '4.5' },
    { product_id: '', quantity: '', duration_hours: '' } // empty row
  ]);

  assert.strictEqual(totals.productCount, 2, 'Should count 2 filled products');
  assert.strictEqual(totals.totalQuantity, 15, 'Total quantity should be 15');
  assert.strictEqual(totals.totalHours, 8, 'Total hours should be 8.0');

  console.log('✔ formatProductLabel & calculateFormTotals passed');
}

console.log('\n=========================================');
console.log('🎉 ALL LEADER ENTRY FORM TESTS PASSED SUCCESSFULLY!');
console.log('=========================================');
