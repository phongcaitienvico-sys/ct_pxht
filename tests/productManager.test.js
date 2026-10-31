import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  calculateProductStats,
  extractCustomerOptions,
  filterProducts,
  paginateProducts,
  toggleSingleProduct,
  bulkToggleProducts,
  resetShiftProducts,
  validateProductInput
} from '../src/components/admin/productManagerLogic.js';

console.log('Running tests/productManager.test.js...\n');

// Sample dataset representing real factory products
const sampleProducts = [
  {
    id: '1732',
    name: 'Cánh đập phản kích 2021 (670x300x80)',
    customer: 'Đại Phú',
    order_quantity: 8,
    blank_quantity: 3,
    status: 'Sx',
    is_active_today: true
  },
  {
    id: '1733',
    name: 'Ống gối bi 231/500 (Φ1070/950 dài 1470)',
    customer: 'Đại Phú',
    order_quantity: 2,
    blank_quantity: 0,
    status: 'Sx',
    is_active_today: false
  },
  {
    id: '1775',
    name: 'Cánh búa tâm 360',
    customer: 'Hòa Phát',
    order_quantity: 100,
    blank_quantity: 30,
    status: 'Sx',
    is_active_today: true
  },
  {
    id: '1780',
    name: 'Con lăn băng tải D133x500',
    customer: 'VICEM Bút Sơn',
    order_quantity: 50,
    blank_quantity: 12,
    status: 'Sx',
    is_active_today: false
  },
  {
    id: '1785',
    name: 'Trục cán định hình thép tròn',
    customer: 'Hòa Phát',
    order_quantity: 15,
    blank_quantity: 5,
    status: 'TamDung',
    is_active_today: false
  }
];

async function runProductManagerTests() {
  // =========================================================================
  // 1. calculateProductStats
  // =========================================================================
  console.log('--- Test Suite 1: calculateProductStats ---');
  {
    const emptyStats = calculateProductStats([]);
    assert.deepStrictEqual(emptyStats, { total: 0, activeCount: 0, inactiveCount: 0 });

    const stats = calculateProductStats(sampleProducts);
    assert.strictEqual(stats.total, 5, 'Total products should be 5');
    assert.strictEqual(stats.activeCount, 2, 'Active today products should be 2');
    assert.strictEqual(stats.inactiveCount, 3, 'Inactive products should be 3');

    // Handles items with undefined or null is_active_today
    const unnormalized = [
      { id: '1', name: 'A', is_active_today: true },
      { id: '2', name: 'B', is_active_today: undefined },
      { id: '3', name: 'C' }
    ];
    const unnormStats = calculateProductStats(unnormalized);
    assert.strictEqual(unnormStats.total, 3);
    assert.strictEqual(unnormStats.activeCount, 1);
    assert.strictEqual(unnormStats.inactiveCount, 2);
    console.log('✔ calculateProductStats passed');
  }

  // =========================================================================
  // 2. extractCustomerOptions
  // =========================================================================
  console.log('\n--- Test Suite 2: extractCustomerOptions ---');
  {
    const customers = extractCustomerOptions(sampleProducts);
    // Unique, trimmed, sorted alphabetically
    assert.deepStrictEqual(customers, ['Đại Phú', 'Hòa Phát', 'VICEM Bút Sơn']);

    // Empty and null handling
    const withEmpty = [
      { id: '1', customer: '  Hòa Phát ' },
      { id: '2', customer: '' },
      { id: '3', customer: null },
      { id: '4', customer: 'An Khánh' }
    ];
    assert.deepStrictEqual(extractCustomerOptions(withEmpty), ['An Khánh', 'Hòa Phát']);
    assert.deepStrictEqual(extractCustomerOptions([]), []);
    console.log('✔ extractCustomerOptions passed');
  }

  // =========================================================================
  // 3. filterProducts
  // =========================================================================
  console.log('\n--- Test Suite 3: filterProducts ---');
  {
    // 3.1 Search by product ID
    const byId = filterProducts(sampleProducts, { searchTerm: '1732' });
    assert.strictEqual(byId.length, 1);
    assert.strictEqual(byId[0].id, '1732');

    // 3.2 Search by name with Vietnamese accent & case-insensitivity
    const byName = filterProducts(sampleProducts, { searchTerm: 'canh bua' });
    assert.strictEqual(byName.length, 1);
    assert.strictEqual(byName[0].id, '1775');

    const byNameExactCase = filterProducts(sampleProducts, { searchTerm: 'Cánh Đập' });
    assert.strictEqual(byNameExactCase.length, 1);
    assert.strictEqual(byNameExactCase[0].id, '1732');

    // 3.3 Search by Customer name
    const byCustSearch = filterProducts(sampleProducts, { searchTerm: 'vicem' });
    assert.strictEqual(byCustSearch.length, 1);
    assert.strictEqual(byCustSearch[0].id, '1780');

    // 3.4 Filter by Customer Dropdown
    const byCustDropdown = filterProducts(sampleProducts, { customerFilter: 'Hòa Phát' });
    assert.strictEqual(byCustDropdown.length, 2);
    assert.ok(byCustDropdown.every(p => p.customer === 'Hòa Phát'));

    // 3.5 Filter by Status
    const activeOnly = filterProducts(sampleProducts, { statusFilter: 'active_only' });
    assert.strictEqual(activeOnly.length, 2);
    assert.ok(activeOnly.every(p => p.is_active_today === true));

    const inactiveOnly = filterProducts(sampleProducts, { statusFilter: 'inactive_only' });
    assert.strictEqual(inactiveOnly.length, 3);
    assert.ok(inactiveOnly.every(p => !p.is_active_today));

    const allStatus = filterProducts(sampleProducts, { statusFilter: 'all' });
    assert.strictEqual(allStatus.length, 5);

    // 3.6 Combined filters
    const combined = filterProducts(sampleProducts, {
      searchTerm: 'canh',
      customerFilter: 'Hòa Phát',
      statusFilter: 'active_only'
    });
    assert.strictEqual(combined.length, 1);
    assert.strictEqual(combined[0].id, '1775');

    // 3.7 Empty / null query returns all
    const noFilter = filterProducts(sampleProducts, {});
    assert.strictEqual(noFilter.length, 5);
    console.log('✔ filterProducts passed');
  }

  // =========================================================================
  // 4. toggleSingleProduct & bulkToggleProducts
  // =========================================================================
  console.log('\n--- Test Suite 4: toggleSingleProduct & bulkToggleProducts ---');
  {
    // Toggle single
    const toggled1732 = toggleSingleProduct(sampleProducts, '1732');
    const p1732 = toggled1732.find(p => p.id === '1732');
    assert.strictEqual(p1732.is_active_today, false, 'Should toggle from true to false');
    // Original immutability check
    assert.strictEqual(sampleProducts[0].is_active_today, true, 'Original array should not be mutated');

    // Force single
    const forced = toggleSingleProduct(sampleProducts, '1733', true);
    assert.strictEqual(forced.find(p => p.id === '1733').is_active_today, true);

    // Bulk toggle specific IDs
    const bulkActive = bulkToggleProducts(sampleProducts, ['1733', '1780'], true);
    assert.strictEqual(bulkActive.find(p => p.id === '1733').is_active_today, true);
    assert.strictEqual(bulkActive.find(p => p.id === '1780').is_active_today, true);
    // Others unchanged
    assert.strictEqual(bulkActive.find(p => p.id === '1785').is_active_today, false);

    // Bulk toggle all
    const bulkAllOff = bulkToggleProducts(sampleProducts, 'all', false);
    assert.ok(bulkAllOff.every(p => p.is_active_today === false));

    const bulkAllOn = bulkToggleProducts(sampleProducts, 'all', true);
    assert.ok(bulkAllOn.every(p => p.is_active_today === true));

    console.log('✔ toggleSingleProduct & bulkToggleProducts passed');
  }

  // =========================================================================
  // 5. resetShiftProducts
  // =========================================================================
  console.log('\n--- Test Suite 5: resetShiftProducts ---');
  {
    const reset = resetShiftProducts(sampleProducts);
    assert.strictEqual(reset.length, 5);
    assert.ok(reset.every(p => p.is_active_today === false), 'All products must have is_active_today = false');
    assert.strictEqual(sampleProducts[0].is_active_today, true, 'Original must remain unchanged');

    // Empty list
    assert.deepStrictEqual(resetShiftProducts([]), []);
    console.log('✔ resetShiftProducts passed');
  }

  // =========================================================================
  // 6. paginateProducts
  // =========================================================================
  console.log('\n--- Test Suite 6: paginateProducts ---');
  {
    const manyItems = Array.from({ length: 55 }, (_, i) => ({
      id: `SP_${i + 1}`,
      name: `Sản phẩm ${i + 1}`
    }));

    // Page 1 with pageSize 20
    const page1 = paginateProducts(manyItems, 1, 20);
    assert.strictEqual(page1.page, 1);
    assert.strictEqual(page1.pageSize, 20);
    assert.strictEqual(page1.totalItems, 55);
    assert.strictEqual(page1.totalPages, 3);
    assert.strictEqual(page1.items.length, 20);
    assert.strictEqual(page1.startIndex, 1);
    assert.strictEqual(page1.endIndex, 20);
    assert.strictEqual(page1.items[0].id, 'SP_1');
    assert.strictEqual(page1.items[19].id, 'SP_20');

    // Page 3 (last page with remainder)
    const page3 = paginateProducts(manyItems, 3, 20);
    assert.strictEqual(page3.items.length, 15);
    assert.strictEqual(page3.startIndex, 41);
    assert.strictEqual(page3.endIndex, 55);

    // Page out of bounds (too high -> clamped to totalPages)
    const pageOverflow = paginateProducts(manyItems, 10, 20);
    assert.strictEqual(pageOverflow.page, 3);
    assert.strictEqual(pageOverflow.items.length, 15);

    // Page out of bounds (negative or zero -> clamped to 1)
    const pageUnderflow = paginateProducts(manyItems, 0, 20);
    assert.strictEqual(pageUnderflow.page, 1);
    assert.strictEqual(pageUnderflow.items.length, 20);

    // Empty items array
    const emptyPaged = paginateProducts([], 1, 20);
    assert.strictEqual(emptyPaged.totalItems, 0);
    assert.strictEqual(emptyPaged.totalPages, 1);
    assert.strictEqual(emptyPaged.items.length, 0);
    assert.strictEqual(emptyPaged.startIndex, 0);
    assert.strictEqual(emptyPaged.endIndex, 0);

    console.log('✔ paginateProducts passed');
  }

  // =========================================================================
  // 7. validateProductInput
  // =========================================================================
  console.log('\n--- Test Suite 7: validateProductInput ---');
  {
    // Valid product input
    const validResult = validateProductInput({
      id: '2025',
      name: 'Bánh răng côn xoắn m=8',
      customer: 'Thép Miền Nam',
      order_quantity: '10',
      blank_quantity: 4,
      status: 'Sx'
    });
    assert.strictEqual(validResult.valid, true);
    assert.strictEqual(validResult.sanitized.id, '2025');
    assert.strictEqual(validResult.sanitized.name, 'Bánh răng côn xoắn m=8');
    assert.strictEqual(validResult.sanitized.order_quantity, 10);
    assert.strictEqual(validResult.sanitized.blank_quantity, 4);
    assert.strictEqual(validResult.sanitized.status, 'Sx');

    // Missing name
    const invalidName = validateProductInput({ id: '2025', name: '' });
    assert.strictEqual(invalidName.valid, false);
    assert.ok(invalidName.errors.name);

    // Missing id gets auto-generated or flagged if required
    const missingId = validateProductInput({ name: 'Trục đùn cao su' });
    assert.strictEqual(missingId.valid, true);
    assert.ok(missingId.sanitized.id.length > 0, 'Auto-generates ID if omitted');

    // Negative quantities
    const negQty = validateProductInput({
      id: '2026',
      name: 'Chi tiết X',
      order_quantity: -5,
      blank_quantity: 'abc'
    });
    assert.strictEqual(negQty.valid, true);
    assert.strictEqual(negQty.sanitized.order_quantity, 0);
    assert.strictEqual(negQty.sanitized.blank_quantity, 0);

    console.log('✔ validateProductInput passed');
  }

  // Catalog UI: columns "Mã ID" and "Trạng Thái" removed, id still searchable & auto-generated
  {
    const pmSource = fs.readFileSync(path.join(process.cwd(), 'src/components/admin/ProductManager.jsx'), 'utf8');
    assert.ok(!pmSource.includes('>Mã ID<'), 'Mã ID column header must be removed');
    assert.ok(!/<th[^>]*>Trạng Thái<\/th>/.test(pmSource), 'Trạng Thái column header must be removed');
    assert.ok(!pmSource.includes('Mã ID Sản Phẩm'), 'Mã ID form field must be removed');
    assert.ok(!pmSource.includes('Trạng Thái Sản Xuất'), 'Status form field must be removed');
    for (const col of ['Bật/Tắt Hôm Nay', 'Tên Sản Phẩm', 'Khách Hàng', 'SL Đơn', 'SL Phôi', 'Hành Động']) {
      assert.ok(pmSource.includes(col), `Column "${col}" must remain`);
    }
    const autoId = validateProductInput({ name: 'SP mới', customer: 'KH' });
    assert.strictEqual(autoId.valid, true);
    assert.ok(autoId.sanitized.id.startsWith('SP_'), 'id auto-generated when not provided');
    assert.strictEqual(autoId.sanitized.status, 'Sx', 'status defaults to Sx');
    assert.strictEqual(filterProducts(sampleProducts, { searchTerm: sampleProducts[0].id }).length >= 1, true, 'search still matches id');
    console.log('✔ ProductManager id/status columns removed, search by id kept');
  }

  console.log('\n=========================================');

  // Công đoạn trong validateProductInput
  {
    const withOps = validateProductInput({ name: 'A', operations: [' Mài đậu ', '', 'Sơn'] });
    assert.deepStrictEqual(withOps.sanitized.operations, ['Mài đậu', 'Sơn']);
    assert.strictEqual(withOps.valid, true);
    const fromText = validateProductInput({ name: 'A', operations: 'Mài đậu\nSơn, Nắn' });
    assert.deepStrictEqual(fromText.sanitized.operations, ['Mài đậu', 'Sơn', 'Nắn']);
    assert.deepStrictEqual(validateProductInput({ name: 'A' }).sanitized.operations, []);
    const tooMany = validateProductInput({ name: 'A', operations: Array.from({ length: 11 }, (_, i) => 'CD' + i) });
    assert.strictEqual(tooMany.valid, false);
    assert.ok(tooMany.errors.operations);
    assert.strictEqual(tooMany.sanitized.operations.length, 10);
    console.log('✔ validateProductInput operations passed');
  }

  console.log('🎉 ALL PRODUCT MANAGER TESTS PASSED SUCCESSFULLY!');
  console.log('=========================================');
}

runProductManagerTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
