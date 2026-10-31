import assert from 'node:assert';
import * as XLSX from 'xlsx';
import {
  parseProductExcel,
  parseEmployeeExcel,
  exportProductionReportToExcel,
  generateProductTemplate,
  generateEmployeeTemplate,
  normalizeColumnKey
} from '../src/lib/excel.js';

console.log('Running tests/excel.test.js...\n');

// Helper to create an in-memory workbook Buffer from an array of objects
function createExcelBuffer(sheetName, data) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
}

async function runExcelTests() {
  // =========================================================================
  // 1. Column Normalizer Helper
  // =========================================================================
  console.log('--- Test Suite 1: normalizeColumnKey ---');
  assert.strictEqual(normalizeColumnKey('Tên sản phẩm'), 'tensanpham');
  assert.strictEqual(normalizeColumnKey('Ten san pham'), 'tensanpham');
  assert.strictEqual(normalizeColumnKey('product_name'), 'productname');
  assert.strictEqual(normalizeColumnKey('  Mã SP  '), 'masp');
  assert.strictEqual(normalizeColumnKey('T.t'), 'tt');
  console.log('✔ normalizeColumnKey passed');

  // =========================================================================
  // 2. parseProductExcel
  // =========================================================================
  console.log('\n--- Test Suite 2: parseProductExcel ---');

  // 2.1 Standard Vietnamese headers
  const vnProductRows = [
    {
      'Mã SP': '1732',
      'Tên sản phẩm': 'Cánh đập phản kích 2021 (670x300x80)',
      'Khách hàng': 'Đại Phú',
      'Số lượng': 8,
      'Phôi': 3,
      'T.t': 'Sx'
    },
    {
      'Mã SP': '1733',
      'Tên sản phẩm': 'Ống gối bi 231/500 (Φ1070/950 dài 1470)',
      'Khách hàng': 'Đại Phú',
      'Số lượng': '2', // String number
      'Phôi': '0',
      'T.t': 'Sx'
    }
  ];
  const vnBuf = createExcelBuffer('Products', vnProductRows);
  const parsedVn = parseProductExcel(vnBuf);
  assert.strictEqual(parsedVn.length, 2, 'Should parse 2 products with VN headers');
  assert.strictEqual(parsedVn[0].id, '1732');
  assert.strictEqual(parsedVn[0].name, 'Cánh đập phản kích 2021 (670x300x80)');
  assert.strictEqual(parsedVn[0].customer, 'Đại Phú');
  assert.strictEqual(parsedVn[0].order_quantity, 8);
  assert.strictEqual(parsedVn[0].blank_quantity, 3);
  assert.strictEqual(parsedVn[0].status, 'Sx');
  assert.strictEqual(parsedVn[1].order_quantity, 2);
  assert.strictEqual(parsedVn[1].blank_quantity, 0);
  console.log('✔ parseProductExcel with Vietnamese headers passed');

  // 2.2 English / normalized headers and auto-generating IDs
  const enProductRows = [
    {
      product_name: 'Chi tiết trục bạc',
      customer: 'Xi Măng Hạ Long',
      order_quantity: 15,
      blank_quantity: 5,
      status: 'Cho_Giao'
    },
    {
      name: 'Vỏ hộp số giảm tốc',
      customer: 'VICEM',
      quantity: 4,
      blank_quantity: 2
      // missing status and id
    }
  ];
  const enBuf = createExcelBuffer('Sheet1', enProductRows);
  const parsedEn = parseProductExcel(enBuf);
  assert.strictEqual(parsedEn.length, 2, 'Should parse 2 products with English headers');
  assert.ok(parsedEn[0].id && parsedEn[0].id.length > 0, 'Auto-generated ID must exist for row 1');
  assert.strictEqual(parsedEn[0].name, 'Chi tiết trục bạc');
  assert.strictEqual(parsedEn[0].customer, 'Xi Măng Hạ Long');
  assert.strictEqual(parsedEn[0].status, 'Cho_Giao');
  assert.ok(parsedEn[1].id && parsedEn[1].id.length > 0, 'Auto-generated ID must exist for row 2');
  assert.notStrictEqual(parsedEn[0].id, parsedEn[1].id, 'Generated IDs must be unique');
  assert.strictEqual(parsedEn[1].name, 'Vỏ hộp số giảm tốc');
  assert.strictEqual(parsedEn[1].order_quantity, 4);
  assert.strictEqual(parsedEn[1].status, 'Sx', 'Default status should be Sx');
  console.log('✔ parseProductExcel with English headers and auto-generated IDs passed');

  // 2.3 Input type tolerance (Uint8Array and ArrayBuffer)
  const uint8 = new Uint8Array(vnBuf);
  const parsedFromUint8 = parseProductExcel(uint8);
  assert.strictEqual(parsedFromUint8.length, 2, 'Should handle Uint8Array input');

  const arrayBuf = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
  const parsedFromAB = parseProductExcel(arrayBuf);
  assert.strictEqual(parsedFromAB.length, 2, 'Should handle ArrayBuffer input');
  console.log('✔ parseProductExcel ArrayBuffer/Uint8Array compatibility passed');

  // 2.4 Công đoạn (CD1..CD10) theo file mẫu thực tế
  const opRows = [
    {
      'Id đơn hàng': 'A100',
      'Tên sản phẩm': 'Cánh búa 395',
      'Khách hàng': 'Đại Phú',
      'Mác thép': 'C45',
      'Số lượng': 10,
      'Tỉ lệ 1': 1,
      'CD1': 'Mài đậu',
      'CD2': ' Hoàn thiện ',
      'CD3': 'Nắn',
      'CD4': 'Sơn',
      'CD5': 'Đóng thùng',
      'CD6': ''
    },
    {
      'Id đơn hàng': 'A101',
      'Tên sản phẩm': 'Không có công đoạn',
      'Khách hàng': 'Đại Phú',
      'Số lượng': 1,
      'CD1': '',
      'CD2': ''
    },
    {
      'idsanpham': 'A102',
      'Tên sản phẩm': 'Cột CongDoan',
      'CongDoan2': 'B',
      'CongDoan1': 'A',
      'CD10': 'J'
    }
  ];
  const parsedOps = parseProductExcel(createExcelBuffer('Ops', opRows));
  assert.strictEqual(parsedOps.length, 3);
  assert.strictEqual(parsedOps[0].id, 'A100', 'Id đơn hàng is an id alias');
  assert.deepStrictEqual(parsedOps[0].operations, ['Mài đậu', 'Hoàn thiện', 'Nắn', 'Sơn', 'Đóng thùng']);
  assert.deepStrictEqual(parsedOps[1].operations, [], 'No CD cells => []');
  assert.strictEqual(parsedOps[2].id, 'A102', 'idsanpham is an id alias');
  assert.deepStrictEqual(parsedOps[2].operations, ['A', 'B', 'J'], 'CongDoanN ordered by index');
  assert.deepStrictEqual(parsedVn[0].operations, [], 'Products without CD columns => []');
  console.log('✔ parseProductExcel operations (CD1..CD10) passed');

  // =========================================================================
  // 3. parseEmployeeExcel
  // =========================================================================
  console.log('\n--- Test Suite 3: parseEmployeeExcel ---');

  const employeeRows = [
    {
      'Mã NV': 'NV01',
      'Họ và tên': 'Trần Văn Hùng',
      'Tổ': 'Tổ 1 - Cơ khí & Đúc'
    },
    {
      'Mã NV': 'NV02',
      'Họ và tên': 'Lê Văn Cường',
      'Bộ phận': 'Tổ 1 - Cơ khí & Đúc'
    },
    {
      code: 'NV04',
      full_name: 'Phạm Văn Minh',
      team_name: 'Tổ 2 - Tiện & Phay'
    }
  ];
  const empBuf = createExcelBuffer('Employees', employeeRows);
  const parsedEmps = parseEmployeeExcel(empBuf);
  assert.strictEqual(parsedEmps.length, 3, 'Should parse 3 employees');
  assert.strictEqual(parsedEmps[0].code, 'NV01');
  assert.strictEqual(parsedEmps[0].full_name, 'Trần Văn Hùng');
  assert.strictEqual(parsedEmps[0].team_name, 'Tổ 1 - Cơ khí & Đúc');
  assert.strictEqual(parsedEmps[1].code, 'NV02');
  assert.strictEqual(parsedEmps[1].team_name, 'Tổ 1 - Cơ khí & Đúc');
  assert.strictEqual(parsedEmps[2].code, 'NV04');
  assert.strictEqual(parsedEmps[2].full_name, 'Phạm Văn Minh');
  assert.strictEqual(parsedEmps[2].team_name, 'Tổ 2 - Tiện & Phay');
  assert.strictEqual(parsedEmps[0].is_active, true);
  console.log('✔ parseEmployeeExcel passed');

  // =========================================================================
  // 4. exportProductionReportToExcel
  // =========================================================================
  console.log('\n--- Test Suite 4: exportProductionReportToExcel ---');

  const testLogs = [
    {
      id: 'l1',
      log_date: '2026-10-28',
      team_name: 'Tổ 1 - Cơ khí & Đúc',
      employee_code: 'NV01',
      employee_name: 'Trần Văn Hùng',
      product_id: '1732',
      product_name: 'Cánh đập phản kích 2021',
      customer: 'Đại Phú',
      operation: 'Mài đậu',
      quantity: 5,
      duration_hours: 4.0,
      notes: 'Gia công nhiệt luyện ca sáng'
    },
    {
      id: 'l2',
      log_date: '2026-10-29',
      team_name: 'Tổ 1 - Cơ khí & Đúc',
      employee_code: 'NV01',
      employee_name: 'Trần Văn Hùng',
      product_id: '1732',
      product_name: 'Cánh đập phản kích 2021',
      customer: 'Đại Phú',
      quantity: 3,
      duration_hours: 2.5,
      notes: 'Hoàn thiện đợt 2'
    },
    {
      id: 'l3',
      log_date: '2026-10-29',
      team_name: 'Tổ 2 - Tiện & Phay',
      employee_code: 'NV04',
      employee_name: 'Phạm Văn Minh',
      product_id: '1775',
      product_name: 'Cánh búa tâm 360',
      customer: 'Đại Phú',
      quantity: 12,
      duration_hours: 7.0,
      notes: 'Phay tinh'
    }
  ];

  // In Node.js environment, exportProductionReportToExcel returns a Buffer
  const reportBuf = exportProductionReportToExcel(testLogs, { returnBuffer: true });
  assert.ok(reportBuf, 'Report buffer should be generated');
  assert.ok(Buffer.isBuffer(reportBuf) || reportBuf instanceof Uint8Array, 'Result must be binary buffer');

  // Read back the generated Excel workbook
  const readWb = XLSX.read(reportBuf, { type: 'buffer' });
  assert.deepStrictEqual(
    readWb.SheetNames,
    ['Chi_Tiet_San_Luong', 'Tong_Hop_Theo_Nhan_Vien'],
    'Workbook must have exactly 2 sheets: Chi_Tiet_San_Luong and Tong_Hop_Theo_Nhan_Vien'
  );

  // Check Sheet 1: Chi_Tiet_San_Luong
  const sheet1Data = XLSX.utils.sheet_to_json(readWb.Sheets['Chi_Tiet_San_Luong']);
  assert.strictEqual(sheet1Data.length, 3, 'Sheet 1 should contain 3 detail rows');
  assert.strictEqual(sheet1Data[0]['Mã NV'], 'NV01');
  assert.strictEqual(sheet1Data[0]['Tên NV'], 'Trần Văn Hùng');
  assert.strictEqual(sheet1Data[0]['Mã SP'], '1732');
  assert.strictEqual(sheet1Data[0]['Số lượng'], 5);
  assert.strictEqual(sheet1Data[0]['Số giờ'], 4);
  assert.strictEqual(sheet1Data[0]['Ghi chú'], 'Gia công nhiệt luyện ca sáng');
  assert.strictEqual(sheet1Data[0]['Tổ'], undefined, 'Detail sheet no longer has Tổ column');
  assert.strictEqual(sheet1Data[0]['Công đoạn'], 'Mài đậu', 'Detail sheet has Công đoạn column');
  assert.strictEqual(sheet1Data[2]['Công đoạn'] || '', '', 'Empty operation stays empty');

  // Check Sheet 2: Tong_Hop_Theo_Nhan_Vien
  const sheet2Data = XLSX.utils.sheet_to_json(readWb.Sheets['Tong_Hop_Theo_Nhan_Vien']);
  assert.strictEqual(sheet2Data.length, 2, 'Sheet 2 should aggregate into 2 employees');

  const nv01Agg = sheet2Data.find((r) => r['Mã NV'] === 'NV01');
  assert.ok(nv01Agg, 'NV01 aggregated row must exist');
  assert.strictEqual(nv01Agg['Tên NV'], 'Trần Văn Hùng');
  assert.strictEqual(nv01Agg['Tổ'], undefined, 'Summary sheet no longer has Tổ column');
  assert.strictEqual(nv01Agg['Tổng sản phẩm'], 8, 'NV01 total quantity 5 + 3 = 8');
  assert.strictEqual(nv01Agg['Tổng giờ'], 6.5, 'NV01 total hours 4.0 + 2.5 = 6.5');
  assert.strictEqual(nv01Agg['Số ngày làm việc'], 2, 'NV01 worked on 2 distinct dates (10-28 and 10-29)');

  const nv04Agg = sheet2Data.find((r) => r['Mã NV'] === 'NV04');
  assert.ok(nv04Agg, 'NV04 aggregated row must exist');
  assert.strictEqual(nv04Agg['Tổng sản phẩm'], 12);
  assert.strictEqual(nv04Agg['Tổng giờ'], 7.0);
  assert.strictEqual(nv04Agg['Số ngày làm việc'], 1);
  console.log('✔ exportProductionReportToExcel verified with 2 sheets and correct aggregations');

  // Test with relational log structures (e.g. log.employees, log.products, log.teams)
  const relationalLogs = [
    {
      id: 'l4',
      date: '2026-10-30',
      quantity: 10,
      duration_hours: 5,
      notes: 'Nested relations test',
      employees: { code: 'NV05', full_name: 'Hoàng Đức Tuấn' },
      products: { id: '1790', name: 'Cánh búa 395', customer: 'Đại Phú' },
      teams: { name: 'Tổ 2 - Tiện & Phay' }
    }
  ];
  const relationalBuf = exportProductionReportToExcel(relationalLogs, { returnBuffer: true });
  const readRelationalWb = XLSX.read(relationalBuf, { type: 'buffer' });
  const relSheet1 = XLSX.utils.sheet_to_json(readRelationalWb.Sheets['Chi_Tiet_San_Luong']);
  assert.strictEqual(relSheet1[0]['Mã NV'], 'NV05');
  assert.strictEqual(relSheet1[0]['Tên NV'], 'Hoàng Đức Tuấn');
  assert.strictEqual(relSheet1[0]['Mã SP'], '1790');
  assert.strictEqual(relSheet1[0]['Khách hàng'], 'Đại Phú');
  console.log('✔ exportProductionReportToExcel handles nested relation objects');

  // =========================================================================
  // 5. generateProductTemplate & generateEmployeeTemplate
  // =========================================================================
  console.log('\n--- Test Suite 5: Template Generators ---');

  const prodTplBuf = generateProductTemplate({ returnBuffer: true });
  assert.ok(Buffer.isBuffer(prodTplBuf) || prodTplBuf instanceof Uint8Array);
  const parsedTplProducts = parseProductExcel(prodTplBuf);
  assert.ok(parsedTplProducts.length > 0, 'Product template must have sample rows');
  assert.ok(parsedTplProducts[0].name, 'Product template sample row must have a name');
  assert.deepStrictEqual(
    parsedTplProducts[0].operations,
    ['Mài đậu', 'Hoàn thiện', 'Nắn', 'Sơn', 'Đóng thùng'],
    'Product template includes CD1..CD5 example'
  );

  const empTplBuf = generateEmployeeTemplate({ returnBuffer: true });
  assert.ok(Buffer.isBuffer(empTplBuf) || empTplBuf instanceof Uint8Array);
  const parsedTplEmps = parseEmployeeExcel(empTplBuf);
  assert.ok(parsedTplEmps.length > 0, 'Employee template must have sample rows');
  assert.ok(parsedTplEmps[0].code, 'Employee template sample row must have code');
  assert.ok(parsedTplEmps[0].full_name, 'Employee template sample row must have full_name');
  const empTplSheet = XLSX.read(empTplBuf, { type: 'buffer' });
  const empTplRows = XLSX.utils.sheet_to_json(empTplSheet.Sheets[empTplSheet.SheetNames[0]]);
  assert.strictEqual(empTplRows[0]['Tổ / Bộ phận'], undefined, 'Employee template has no team column');
  // Vẫn chấp nhận file nhân viên không có cột tổ
  const noTeamEmps = parseEmployeeExcel(createExcelBuffer('E', [{ 'Mã NV': 'X1', 'Họ và tên': 'A' }]));
  assert.strictEqual(noTeamEmps.length, 1);
  console.log('✔ generateProductTemplate and generateEmployeeTemplate passed');

  console.log('\n=========================================');
  console.log('🎉 ALL EXCEL SERVICE TESTS PASSED SUCCESSFULLY!');
  console.log('=========================================');
}

runExcelTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
