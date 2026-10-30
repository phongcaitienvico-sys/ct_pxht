import assert from 'node:assert';
import {
  isDemoMode,
  resetDemoData,
  getProducts,
  updateProductToggle,
  bulkUpdateProductToggle,
  upsertProducts,
  getTeams,
  getEmployees,
  upsertEmployees,
  submitProductionLogs,
  getProductionLogs,
  updateProductionLog,
  deleteProductionLog,
  subscribeToLogs
} from '../src/lib/supabase.js';

console.log('Running tests/supabaseClient.test.js...\n');

async function runTests() {
  // 1. Demo Mode Check
  assert.strictEqual(isDemoMode(), true, 'Should be in demo mode when VITE_SUPABASE_URL is not set');
  console.log('✔ isDemoMode passed');

  // 2. Reset and Get Products
  await resetDemoData();
  const initialProducts = await getProducts();
  assert.ok(Array.isArray(initialProducts), 'getProducts should return an array');
  assert.ok(initialProducts.length >= 9, 'getProducts should return at least 9 seed products');
  
  const product1732 = initialProducts.find(p => p.id === '1732');
  assert.ok(product1732, 'Product 1732 must exist');
  assert.strictEqual(product1732.name, 'Cánh đập phản kích 2021 (670x300x80)');
  assert.strictEqual(product1732.customer, 'Đại Phú');
  assert.strictEqual(product1732.is_active_today, true);
  console.log('✔ getProducts and seed data verified');

  // 3. updateProductToggle
  const updated1732 = await updateProductToggle('1732', false);
  assert.strictEqual(updated1732.is_active_today, false, 'Product 1732 toggle should be false');
  const check1732 = (await getProducts()).find(p => p.id === '1732');
  assert.strictEqual(check1732.is_active_today, false);
  console.log('✔ updateProductToggle passed');

  // 4. bulkUpdateProductToggle
  await bulkUpdateProductToggle(['1732', '1733'], true);
  const productsAfterBulk = await getProducts();
  assert.strictEqual(productsAfterBulk.find(p => p.id === '1732').is_active_today, true);
  assert.strictEqual(productsAfterBulk.find(p => p.id === '1733').is_active_today, true);

  // Turn all off
  await bulkUpdateProductToggle('all', false);
  const allOff = await getProducts();
  assert.ok(allOff.every(p => p.is_active_today === false), 'All products should be toggled off');
  console.log('✔ bulkUpdateProductToggle passed');

  // 5. upsertProducts
  const newProduct = {
    id: '9999',
    name: 'Búa nghiền mẫu test',
    customer: 'Công ty Test',
    order_quantity: 50,
    blank_quantity: 10,
    status: 'Sx',
    is_active_today: true
  };
  await upsertProducts([newProduct]);
  const fetchedNew = (await getProducts()).find(p => p.id === '9999');
  assert.ok(fetchedNew, 'Upserted product 9999 must exist');
  assert.strictEqual(fetchedNew.name, 'Búa nghiền mẫu test');
  console.log('✔ upsertProducts passed');

  // 6. Teams & Employees
  const teams = await getTeams();
  assert.ok(Array.isArray(teams) && teams.length >= 2, 'getTeams should return at least 2 teams');
  const team1 = teams[0];

  const allEmployees = await getEmployees();
  assert.ok(Array.isArray(allEmployees) && allEmployees.length >= 4, 'getEmployees should return employees');
  
  const team1Employees = await getEmployees(team1.id);
  assert.ok(team1Employees.length > 0, 'getEmployees(teamId) should return employees for team 1');
  assert.ok(team1Employees.every(e => e.team_id === team1.id), 'Filtered employees must belong to team 1');

  // upsertEmployees
  const newEmp = {
    code: 'NV99',
    full_name: 'Vũ Đức Test',
    team_id: team1.id,
    is_active: true
  };
  await upsertEmployees([newEmp]);
  const fetchedEmp = (await getEmployees()).find(e => e.code === 'NV99');
  assert.ok(fetchedEmp, 'Upserted employee NV99 must exist');
  assert.strictEqual(fetchedEmp.full_name, 'Vũ Đức Test');
  console.log('✔ teams and employees APIs passed');

  // 7. Subscribe to logs test
  let subscriptionCallCount = 0;
  const unsubscribe = subscribeToLogs((event) => {
    subscriptionCallCount++;
  });

  // 8. submitProductionLogs & getProductionLogs
  const testDate = '2026-10-30';
  const logsToSubmit = [
    {
      log_date: testDate,
      team_id: team1.id,
      employee_id: team1Employees[0].id,
      product_id: '1732',
      quantity: 5,
      duration_hours: 4.5,
      notes: 'Làm ca sáng'
    },
    {
      log_date: testDate,
      team_id: team1.id,
      employee_id: team1Employees[0].id,
      product_id: '1733',
      quantity: 2,
      duration_hours: 3.5,
      notes: 'Làm ca chiều'
    }
  ];

  const submittedLogs = await submitProductionLogs(logsToSubmit);
  assert.strictEqual(submittedLogs.length, 2, 'Should return 2 submitted logs');
  assert.ok(submittedLogs[0].id, 'Submitted log must have an id');
  assert.strictEqual(subscriptionCallCount > 0, true, 'Subscription callback should be invoked');

  // Fetch logs with filter
  const logsForDate = await getProductionLogs({ date: testDate });
  assert.ok(logsForDate.length >= 2, 'Should find logs for testDate');
  assert.ok(logsForDate.some(l => l.product_id === '1732'), 'Should find log with product 1732');

  const logsByEmp = await getProductionLogs({ employeeId: team1Employees[0].id });
  assert.ok(logsByEmp.length >= 2, 'Should find logs for employee');

  const logsByTeam = await getProductionLogs({ teamId: team1.id });
  assert.ok(logsByTeam.length >= 2, 'Should find logs for team');

  // 9. updateProductionLog
  const logToUpdate = submittedLogs[0];
  const updatedLog = await updateProductionLog(logToUpdate.id, { quantity: 10, notes: 'Đã cập nhật' });
  assert.strictEqual(updatedLog.quantity, 10, 'Log quantity should be updated to 10');
  assert.strictEqual(updatedLog.notes, 'Đã cập nhật', 'Log notes should be updated');

  // 10. deleteProductionLog
  const logToDelete = submittedLogs[1];
  const deleteResult = await deleteProductionLog(logToDelete.id);
  assert.strictEqual(deleteResult, true, 'deleteProductionLog should return true');

  const remainingLogs = await getProductionLogs({ date: testDate });
  assert.ok(!remainingLogs.some(l => l.id === logToDelete.id), 'Deleted log should not exist in logs');
  console.log('✔ submitProductionLogs, getProductionLogs, updateProductionLog, deleteProductionLog passed');

  unsubscribe();
  console.log('\nAll Supabase client adapter tests passed successfully!');
}

runTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
