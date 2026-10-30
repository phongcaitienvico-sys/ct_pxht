import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import * as XLSX from 'xlsx';

import {
  resetDemoData,
  getProducts,
  updateProductToggle,
  getTeams,
  getEmployees,
  submitProductionLogs,
  getProductionLogs,
  isDemoMode
} from '../src/lib/supabase.js';

import { filterActiveProducts } from '../src/components/leader/leaderEntryLogic.js';
import { calculateTodayKPI } from '../src/components/admin/realtimeFeedLogic.js';
import {
  filterLogsByCriteria,
  calculateAnalyticsKPI,
  groupLogsByEmployeeSummary
} from '../src/components/admin/reportAnalyticsLogic.js';
import { exportProductionReportToExcel } from '../src/lib/excel.js';

console.log('Running tests/e2eApp.test.js (End-to-End Integration Flow)...\n');

const projectRoot = process.cwd();

function assertFileExists(filePath, description) {
  const fullPath = path.join(projectRoot, filePath);
  assert.ok(fs.existsSync(fullPath), `Missing required file: ${description} (${filePath})`);
  return fs.readFileSync(fullPath, 'utf8');
}

async function runE2ETests() {
  // =========================================================================
  // SECTION 1: END-TO-END BUSINESS WORKFLOW INTEGRATION
  // =========================================================================
  console.log('--- Test Suite 1: Full Business Process Integration Workflow ---');

  // Reset database state to pristine seed
  resetDemoData();
  assert.strictEqual(isDemoMode(), true, 'E2E should run cleanly in demo mode');

  // Step 1: Quản đốc cấu hình danh mục sản phẩm (Toggle sản phẩm sản xuất hôm nay)
  const initialProducts = await getProducts();
  assert.ok(initialProducts.length > 0, 'Products catalog should not be empty');

  // Target product to toggle
  const targetProduct = initialProducts[0];
  const originalToggle = targetProduct.is_active_today;
  const toggledTarget = await updateProductToggle(targetProduct.id, true);
  assert.strictEqual(toggledTarget.is_active_today, true, 'Product should now be active for today');

  // Step 2: Tổ trưởng đăng nhập & mở form nhập liệu -> lọc thấy các sản phẩm đang active
  const activeProducts = filterActiveProducts(await getProducts());
  assert.ok(activeProducts.length > 0, 'There should be active products available for today');
  assert.ok(
    activeProducts.some((p) => p.id === targetProduct.id),
    'Active products must include the product toggled by admin'
  );

  // Step 3: Tổ trưởng nhập sản lượng cho 1 công nhân với nhiều sản phẩm trong ca
  const teams = await getTeams();
  assert.ok(teams.length > 0, 'Teams list should not be empty');
  const targetTeam = teams[0];
  const employees = await getEmployees(targetTeam.id);
  assert.ok(employees.length > 0, `Team ${targetTeam.name} should have employees`);
  const targetEmployee = employees[0];

  const todayStr = '2026-10-30';
  const newBatch = [
    {
      team_id: targetTeam.id,
      team_name: targetTeam.name,
      employee_id: targetEmployee.id,
      employee_code: targetEmployee.code || targetEmployee.employee_code,
      employee_name: targetEmployee.full_name || targetEmployee.employee_name,
      product_id: activeProducts[0].id,
      product_name: activeProducts[0].product_name,
      customer: activeProducts[0].customer,
      quantity: 12,
      duration_hours: 4.5,
      notes: 'Gia công phay mặt đầu chi tiết đúc',
      log_date: todayStr
    },
    {
      team_id: targetTeam.id,
      team_name: targetTeam.name,
      employee_id: targetEmployee.id,
      employee_code: targetEmployee.code || targetEmployee.employee_code,
      employee_name: targetEmployee.full_name || targetEmployee.employee_name,
      product_id: activeProducts[Math.min(1, activeProducts.length - 1)].id,
      product_name: activeProducts[Math.min(1, activeProducts.length - 1)].product_name,
      customer: activeProducts[Math.min(1, activeProducts.length - 1)].customer,
      quantity: 8,
      duration_hours: 3.5,
      notes: 'Khoan định vị tâm trục',
      log_date: todayStr
    }
  ];

  const submittedLogs = await submitProductionLogs(newBatch);
  assert.strictEqual(submittedLogs.length, 2, 'Should successfully insert 2 log entries');
  assert.ok(submittedLogs[0].id, 'Created log 1 should have an ID');
  assert.ok(submittedLogs[1].id, 'Created log 2 should have an ID');
  console.log('  ✔ Step 1-3: Admin toggle product & Leader multi-entry batch logging passed');

  // Step 4: Quản đốc theo dõi bảng Giám sát Realtime (RealtimeFeed)
  const todayLogs = await getProductionLogs({ date: todayStr });
  assert.ok(
    todayLogs.some((l) => l.id === submittedLogs[0].id),
    'Realtime feed must include newly submitted log 1'
  );
  assert.ok(
    todayLogs.some((l) => l.id === submittedLogs[1].id),
    'Realtime feed must include newly submitted log 2'
  );

  const realtimeKPI = calculateTodayKPI(todayLogs);
  assert.ok(realtimeKPI.totalQuantity >= 20, 'Realtime total quantity must include new 20 items');
  assert.ok(realtimeKPI.totalHours >= 8.0, 'Realtime total hours must include new 8.0 hours');
  console.log('  ✔ Step 4: Quản đốc Realtime Feed received live data with updated KPI');

  // Step 5: Báo cáo phân tích (ReportAnalytics) lọc theo nhân viên & tính đúng KPI
  const allLogs = await getProductionLogs();
  const empFilteredLogs = filterLogsByCriteria(allLogs, {
    startDate: todayStr,
    endDate: todayStr,
    employeeId: targetEmployee.id
  });

  assert.ok(empFilteredLogs.length >= 2, 'Filtered logs for employee should contain today entries');
  const empKPI = calculateAnalyticsKPI(empFilteredLogs);
  const expectedEmpQty = empFilteredLogs.reduce((sum, l) => sum + Number(l.quantity || 0), 0);
  const expectedEmpHours = empFilteredLogs.reduce((sum, l) => sum + Number(l.duration_hours || 0), 0);

  assert.strictEqual(empKPI.totalQuantity, expectedEmpQty, 'KPI totalQuantity must match sum');
  assert.strictEqual(empKPI.totalHours, expectedEmpHours, 'KPI totalHours must match sum');

  const employeeSummaries = groupLogsByEmployeeSummary(empFilteredLogs);
  const targetSummary = employeeSummaries.find(
    (s) => s.employeeId === targetEmployee.id || s.employeeCode === (targetEmployee.code || targetEmployee.employee_code)
  );
  assert.ok(targetSummary, 'Employee summary row must exist');
  assert.strictEqual(targetSummary.totalQuantity, expectedEmpQty, 'Summary quantity must match');
  assert.strictEqual(targetSummary.totalHours, expectedEmpHours, 'Summary hours must match');
  console.log('  ✔ Step 5: Report Analytics calculated exact employee metrics and summaries');

  // Step 6: Xuất file Excel báo cáo sản xuất với 2 sheets
  const excelBuffer = exportProductionReportToExcel(empFilteredLogs, {
    returnBuffer: true,
    dateRangeText: '30/10/2026 - 30/10/2026',
    teamName: targetTeam.name
  });

  assert.ok(excelBuffer, 'Export should generate buffer');
  const workbook = XLSX.read(excelBuffer, { type: 'buffer' });
  assert.strictEqual(workbook.SheetNames.length, 2, 'Excel workbook must contain exactly 2 sheets');
  assert.strictEqual(workbook.SheetNames[0], 'Chi_Tiet_San_Luong', 'Sheet 1 title correct');
  assert.strictEqual(workbook.SheetNames[1], 'Tong_Hop_Theo_Nhan_Vien', 'Sheet 2 title correct');

  const detailSheet = workbook.Sheets['Chi_Tiet_San_Luong'];
  const summarySheet = workbook.Sheets['Tong_Hop_Theo_Nhan_Vien'];
  const detailJson = XLSX.utils.sheet_to_json(detailSheet);
  const summaryJson = XLSX.utils.sheet_to_json(summarySheet);

  assert.ok(detailJson.length >= 2, 'Detail sheet should have log rows');
  assert.ok(summaryJson.length >= 1, 'Summary sheet should have employee summary rows');
  console.log('  ✔ Step 6: Excel dual-sheet report generation verified successfully');

  // =========================================================================
  // SECTION 2: APPLICATION SHELL & COMPONENT VERIFICATION
  // =========================================================================
  console.log('\n--- Test Suite 2: App Shell, Navbar, Deployment & Docs Verification ---');

  // 1. Verify src/components/Navbar.jsx
  const navbarContent = assertFileExists('src/components/Navbar.jsx', 'Corporate Navbar component');
  assert.ok(
    navbarContent.includes('export default function Navbar') || navbarContent.includes('export default Navbar'),
    'Navbar.jsx must export default Navbar component'
  );
  assert.ok(
    navbarContent.includes('PXHT') || navbarContent.includes('Quản Lý Sản Lượng'),
    'Navbar must show PXHT brand'
  );
  assert.ok(
    navbarContent.includes('switchDemoRole') || navbarContent.includes('DEMO_PROFILES'),
    'Navbar must support fast demo role switching'
  );
  assert.ok(
    navbarContent.includes('isDemoMode'),
    'Navbar must display data mode indicator (Demo vs Supabase Live)'
  );
  assert.ok(
    navbarContent.includes('products') &&
    navbarContent.includes('realtime') &&
    navbarContent.includes('reports') &&
    navbarContent.includes('employees'),
    'Navbar must declare admin navigation tabs (products, realtime, reports, employees)'
  );
  assert.ok(
    navbarContent.includes('entry') && navbarContent.includes('logs'),
    'Navbar must declare leader navigation tabs (entry, logs)'
  );
  console.log('  ✔ Navbar component meets all design and functional specifications');

  // 2. Verify src/App.jsx
  const appContent = assertFileExists('src/App.jsx', 'Main App component');
  assert.ok(appContent.includes('AuthProvider'), 'App.jsx must wrap children with AuthProvider');
  assert.ok(appContent.includes('Navbar'), 'App.jsx must render Navbar');
  assert.ok(appContent.includes('ProductManager'), 'App.jsx must import ProductManager');
  assert.ok(appContent.includes('RealtimeFeed'), 'App.jsx must import RealtimeFeed');
  assert.ok(appContent.includes('ReportAnalytics'), 'App.jsx must import ReportAnalytics');
  assert.ok(appContent.includes('EmployeeManager'), 'App.jsx must import EmployeeManager');
  assert.ok(appContent.includes('LeaderEntryForm'), 'App.jsx must import LeaderEntryForm');
  assert.ok(appContent.includes('LeaderDailyLogs'), 'App.jsx must import LeaderDailyLogs');
  assert.ok(appContent.includes('LoginModal'), 'App.jsx must support LoginModal');
  console.log('  ✔ App.jsx orchestrates all sub-modules for Admin and Leader');

  // 3. Verify GitHub Actions Pages workflow
  const workflowContent = assertFileExists(
    '.github/workflows/deploy.yml',
    'GitHub Pages workflow configuration'
  );
  assert.ok(
    workflowContent.includes('actions/upload-pages-artifact') &&
    workflowContent.includes('actions/deploy-pages'),
    'deploy.yml must use official GitHub Pages deployment actions'
  );
  assert.ok(
    workflowContent.includes('npm run build') || workflowContent.includes('vite build'),
    'deploy.yml must execute the build script'
  );
  assert.ok(
    workflowContent.includes('permissions:') &&
    workflowContent.includes('pages: write') &&
    workflowContent.includes('id-token: write'),
    'deploy.yml must declare pages: write and id-token: write permissions'
  );
  console.log('  ✔ GitHub Pages deploy workflow configured properly');

  // 4. Verify README.md documentation
  const readmeContent = assertFileExists('README.md', 'Project Documentation README');
  assert.ok(
    readmeContent.includes('Phân Xưởng Hàn Tàu') || readmeContent.includes('PXHT'),
    'README.md must describe PXHT production logging application'
  );
  assert.ok(
    readmeContent.includes('npm run dev') && readmeContent.includes('npm run build'),
    'README.md must guide local setup and build'
  );
  assert.ok(
    readmeContent.includes('supabase_schema.sql') &&
    readmeContent.includes('VITE_SUPABASE_URL') &&
    readmeContent.includes('VITE_SUPABASE_ANON_KEY'),
    'README.md must guide Supabase cloud configuration'
  );
  assert.ok(
    readmeContent.includes('GitHub Pages') || readmeContent.includes('deploy.yml'),
    'README.md must guide GitHub Pages deployment'
  );
  console.log('  ✔ README.md provides comprehensive operational documentation');

  console.log('\n=========================================');
  console.log('🎉 ALL E2E & APP INTEGRATION TESTS PASSED!');
  console.log('=========================================');
}

runE2ETests().catch((err) => {
  console.error('\n❌ E2E Integration test failed:', err);
  process.exit(1);
});
