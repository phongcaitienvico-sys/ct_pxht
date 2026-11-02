/**
 * Dịch vụ xử lý Import / Export file Excel (SheetJS Service)
 * Hỗ trợ linh hoạt cả môi trường Browser và Node.js
 */

import * as XLSX from 'xlsx';

/**
 * Chuẩn hóa tiêu đề cột (bỏ dấu tiếng Việt, ký tự đặc biệt, chuyển chữ thường)
 * Ví dụ: "Tên sản phẩm" -> "tensanpham", "T.t" -> "tt", "Mã SP" -> "masp"
 */
export function normalizeColumnKey(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (c) => (c === 'đ' ? 'd' : 'd'))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Tạo UUID ngẫu nhiên tương thích browser & Node
 */
function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Đọc buffer hoặc binary data thành XLSX Workbook
 */
function readWorkbook(data) {
  if (!data) {
    throw new Error('Dữ liệu file Excel không hợp lệ hoặc rỗng');
  }

  // Node Buffer
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) {
    return XLSX.read(data, { type: 'buffer', cellDates: true });
  }

  // Uint8Array hoặc ArrayBuffer
  if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
    return XLSX.read(data, { type: 'array', cellDates: true });
  }

  // Chuỗi (Base64 hoặc Binary String)
  if (typeof data === 'string') {
    const b64Marker = ';base64,';
    const b64Idx = data.indexOf(b64Marker);
    if (b64Idx !== -1) {
      return XLSX.read(data.substring(b64Idx + b64Marker.length), { type: 'base64', cellDates: true });
    }
    return XLSX.read(data, { type: 'binary', cellDates: true });
  }

  return XLSX.read(data, { cellDates: true });
}

/**
 * Lưu hoặc tải xuống Workbook tùy môi trường (Browser download vs Node Buffer)
 */
function saveWorkbook(wb, defaultFileName, options = {}) {
  const fileName = options.fileName || defaultFileName;
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

  if (isBrowser && !options.returnBuffer) {
    XLSX.writeFile(wb, fileName);
    return true;
  }

  // Node.js hoặc khi có tùy chọn returnBuffer: true
  if (typeof Buffer !== 'undefined') {
    return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  } else {
    return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  }
}

const MAX_PRODUCT_OPERATIONS = 10;

// Bảng ánh xạ các cột dữ liệu sản phẩm
const PRODUCT_FIELD_MAP = {
  id: ['id', 'masp', 'masanpham', 'productid', 'productcode', 'code', 'ma', 'iddonhang', 'idsanpham'],
  name: ['tensanpham', 'productname', 'name', 'tensp', 'sanpham', 'ten', 'tenhang'],
  customer: ['khachhang', 'customer', 'khach', 'doitac', 'tenkhachhang'],
  order_quantity: ['soluong', 'orderquantity', 'quantity', 'sl', 'soluongdonhang', 'soluongdat'],
  blank_quantity: ['phoi', 'blankquantity', 'phoico', 'slphoi', 'soluongphoi'],
  status: ['tt', 'status', 'trangthai', 'tinhtrang'],
  is_active_today: ['isactivetoday', 'kichhoat', 'active', 'hoatdong', 'hoatdonghomnay']
};

/**
 * Chuẩn hóa tên công đoạn (bỏ tiền tố số thứ tự như "01- ", "02 - " nếu có)
 */
function cleanOperationName(raw) {
  if (raw === undefined || raw === null) return '';
  return String(raw).trim().replace(/^\d+\s*-\s*/, '').trim();
}

/**
 * Kiểm tra và trích xuất danh mục sản phẩm đang sản xuất từ file tổng hợp PXHT_Sh.xlsx
 * (Có sheet Data chứa bảng Đơn Hàng ở cột J..AP + bảng Phôi ở cột BD..BF, và/hoặc sheet Nhap_Sanluong)
 */
function tryParsePxhtMasterProducts(wb) {
  const dataSheet = wb.Sheets['Data'];
  const nslSheet = wb.Sheets['Nhap_Sanluong'];
  if (!dataSheet && !nslSheet) return null;

  const dataRows = dataSheet ? XLSX.utils.sheet_to_json(dataSheet, { header: 1, defval: '' }) : [];
  const headerRow2 = dataRows[1] || [];
  const isPxhtDataSheet =
    normalizeColumnKey(headerRow2[9]) === 'iddonhang' &&
    normalizeColumnKey(headerRow2[10]) === 'tensanpham';

  if (!isPxhtDataSheet && !nslSheet) return null;

  // 1. Cộng dồn số lượng Phôi theo Id sản phẩm từ cột BD..BF (index 55..57) của sheet Data
  const phoiMap = new Map();
  if (isPxhtDataSheet) {
    for (let r = 3; r < dataRows.length; r++) {
      const row = dataRows[r];
      if (!row) continue;
      const rawPid = row[55];
      const rawPhoi = row[57];
      if (rawPid !== '' && rawPid !== null && rawPid !== undefined) {
        const pidKey = String(rawPid).trim();
        const pVal = typeof rawPhoi === 'number' ? rawPhoi : Number(String(rawPhoi).replace(/,/g, '').trim());
        if (pidKey && Number.isFinite(pVal) && pVal > 0) {
          phoiMap.set(pidKey, (phoiMap.get(pidKey) || 0) + Math.round(pVal));
        }
      }
    }
  }

  // 2. Tập hợp các mã đang nằm trong sheet Nhap_Sanluong (nếu có)
  const nslMap = new Map();
  if (nslSheet) {
    const nslRows = XLSX.utils.sheet_to_json(nslSheet, { header: 1, defval: '' });
    const nslHeader = nslRows[1] || [];
    if (normalizeColumnKey(nslHeader[0]) === 'tensanpham' && normalizeColumnKey(nslHeader[5]) === 'id') {
      for (let r = 3; r < nslRows.length; r++) {
        const row = nslRows[r];
        if (!row) continue;
        const rawId = String(row[5] ?? '').trim();
        const rawName = String(row[0] ?? '').trim();
        if (!rawId || rawId.toLowerCase() === 'mẫu' || !rawName) continue;
        const ops = [];
        for (let c = 96; c < 106; c++) {
          const opText = cleanOperationName(row[c]);
          if (opText && ops.length < MAX_PRODUCT_OPERATIONS) ops.push(opText);
        }
        const qty = typeof row[2] === 'number' ? row[2] : Number(String(row[2]).replace(/,/g, '').trim()) || 0;
        const phoi = typeof row[3] === 'number' ? row[3] : Number(String(row[3]).replace(/,/g, '').trim()) || 0;
        nslMap.set(rawId, {
          id: rawId,
          name: rawName,
          customer: String(row[1] ?? '').trim(),
          order_quantity: Number.isFinite(qty) ? Math.round(qty) : 0,
          blank_quantity: phoiMap.get(rawId) ?? (Number.isFinite(phoi) ? Math.round(phoi) : 0),
          status: String(row[4] || 'Sx').trim() || 'Sx',
          is_active_today: true,
          operations: ops
        });
      }
    }
  }

  // 3. Đọc bảng Đơn Hàng trong sheet Data (cột J..AP, index 9..41)
  if (isPxhtDataSheet) {
    const results = [];
    const seenIds = new Set();

    for (let r = 3; r < dataRows.length; r++) {
      const row = dataRows[r];
      if (!row) continue;
      const rawId = String(row[9] ?? '').trim();
      const rawName = String(row[10] ?? '').trim();
      if (!rawId && !rawName) break;
      if (!rawId || rawId === 'C1' || !rawName) continue;

      const status = String(row[19] ?? '').trim();
      const inNsl = nslMap.has(rawId);
      // Chỉ lấy các mã đang sản xuất (status === 'Sx' hoặc có trong Nhap_Sanluong)
      if (status !== 'Sx' && !inNsl) continue;

      const ops = [];
      for (let c = 32; c <= 41; c++) {
        const opText = cleanOperationName(row[c]);
        if (opText && ops.length < MAX_PRODUCT_OPERATIONS) {
          ops.push(opText);
        }
      }
      const nslItem = nslMap.get(rawId);
      const finalOps = ops.length > 0 ? ops : (nslItem ? nslItem.operations : []);
      const rawQty = row[14];
      const parsedQty = typeof rawQty === 'number' ? rawQty : Number(String(rawQty).replace(/,/g, '').trim());
      const orderQuantity = Number.isFinite(parsedQty) && parsedQty > 0
        ? Math.round(parsedQty)
        : (nslItem ? nslItem.order_quantity : 0);

      results.push({
        id: rawId,
        name: rawName,
        customer: String(row[11] ?? '').trim() || (nslItem ? nslItem.customer : ''),
        order_quantity: orderQuantity,
        blank_quantity: phoiMap.get(rawId) || (nslItem ? nslItem.blank_quantity : 0),
        status: status || 'Sx',
        is_active_today: inNsl,
        operations: finalOps
      });
      seenIds.add(rawId);
    }

    for (const [id, item] of nslMap.entries()) {
      if (!seenIds.has(id)) {
        results.push(item);
      }
    }

    if (results.length > 0) return results;
  }

  if (nslMap.size > 0) {
    return Array.from(nslMap.values());
  }

  return null;
}

/**
 * Đọc file Excel danh mục sản phẩm
 * @param {ArrayBuffer|Uint8Array|Buffer|string} data
 * @returns {Array<Object>} Mảng sản phẩm chuẩn hóa
 */
export function parseProductExcel(data) {
  const wb = readWorkbook(data);
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return [];

  // Hỗ trợ đọc trực tiếp file tổng hợp PXHT_Sh.xlsx (multi-sheet / multi-table)
  const masterProducts = tryParsePxhtMasterProducts(wb);
  if (masterProducts && masterProducts.length > 0) {
    return masterProducts;
  }

  const ws = wb.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  const products = [];

  rawRows.forEach((row, index) => {
    const matched = {};
    // Công đoạn: cột CD1..CD10 (hoặc CongDoan1..CongDoan10), giữ theo thứ tự số cột
    const opsByIndex = [];

    for (const [colName, colVal] of Object.entries(row)) {
      const normKey = normalizeColumnKey(colName);

      const opMatch = /^(?:cd|congdoan)(\d{1,2})$/.exec(normKey);
      if (opMatch) {
        const n = Number(opMatch[1]);
        const text = colVal === undefined || colVal === null ? '' : String(colVal).trim();
        if (n >= 1 && n <= MAX_PRODUCT_OPERATIONS && text) {
          opsByIndex.push({ n, text });
        }
        continue;
      }

      for (const [field, aliases] of Object.entries(PRODUCT_FIELD_MAP)) {
        if (aliases.includes(normKey)) {
          const isValEmpty = colVal === undefined || colVal === null || String(colVal).trim() === '';
          if (!isValEmpty) {
            matched[field] = colVal;
          } else if (matched[field] === undefined) {
            matched[field] = colVal;
          }
          break;
        }
      }
    }

    const rawName = matched.name !== undefined ? String(matched.name).trim() : '';
    const rawId = matched.id !== undefined && matched.id !== '' ? String(matched.id).trim() : '';

    // Bỏ qua dòng trống hoàn toàn
    if (!rawName && !rawId && matched.order_quantity === undefined && matched.customer === undefined) {
      return;
    }

    // Tự sinh ID nếu thiếu
    const id = rawId || `SP_${Date.now().toString(36)}_${(index + 1).toString().padStart(3, '0')}`;

    // Ép kiểu số lượng đơn hàng
    let orderQuantity = 0;
    if (matched.order_quantity !== undefined && matched.order_quantity !== '') {
      const parsed = typeof matched.order_quantity === 'number'
        ? matched.order_quantity
        : Number(String(matched.order_quantity).replace(/,/g, '').trim());
      if (Number.isFinite(parsed)) orderQuantity = parsed;
    }

    // Ép kiểu số lượng phôi
    let blankQuantity = 0;
    if (matched.blank_quantity !== undefined && matched.blank_quantity !== '') {
      const parsed = typeof matched.blank_quantity === 'number'
        ? matched.blank_quantity
        : Number(String(matched.blank_quantity).replace(/,/g, '').trim());
      if (Number.isFinite(parsed)) blankQuantity = parsed;
    }

    // Trạng thái mặc định là 'Sx'
    const status = matched.status ? String(matched.status).trim() : 'Sx';

    // Trạng thái kích hoạt hôm nay (mặc định false trừ khi có chỉ định)
    let isActiveToday = false;
    if (matched.is_active_today !== undefined && matched.is_active_today !== '') {
      const v = String(matched.is_active_today).trim().toLowerCase();
      isActiveToday = v === 'true' || v === '1' || v === 'x' || v === 'yes';
    }

    products.push({
      id,
      name: rawName,
      customer: matched.customer ? String(matched.customer).trim() : '',
      order_quantity: orderQuantity,
      blank_quantity: blankQuantity,
      status,
      is_active_today: isActiveToday,
      operations: opsByIndex.sort((a, b) => a.n - b.n).map((o) => o.text)
    });
  });

  return products;
}

// Bảng ánh xạ các cột danh sách nhân viên
const EMPLOYEE_FIELD_MAP = {
  code: ['manv', 'manhanvien', 'code', 'employeecode', 'id', 'ma', 'idnhanvien'],
  full_name: ['hovaten', 'hoten', 'fullname', 'name', 'tennv', 'tennhanvien', 'nhanvien', 'ten'],
  team_name: ['to', 'tosanxuat', 'bophan', 'tobophan', 'teamname', 'department', 'team', 'phongban'],
  is_active: ['isactive', 'hoatdong', 'trangthai', 'active']
};

/**
 * Chuẩn hóa mã nhân viên từ dạng NV001 -> NV01 (giữ ít nhất 2 chữ số)
 */
export function normalizeEmployeeCode(rawCode) {
  const trimmed = String(rawCode ?? '').trim().toUpperCase();
  const match = /^NV0*(\d+)$/i.exec(trimmed);
  if (match) {
    const num = Number(match[1]);
    if (Number.isFinite(num) && num > 0) {
      return `NV${String(num).padStart(2, '0')}`;
    }
  }
  return trimmed;
}

/**
 * Kiểm tra và trích xuất danh sách nhân viên từ sheet Data của file tổng hợp PXHT_Sh.xlsx
 */
function tryParsePxhtMasterEmployees(wb) {
  const dataSheet = wb.Sheets['Data'] || wb.Sheets[wb.SheetNames[0]];
  if (!dataSheet) return null;

  const rows = XLSX.utils.sheet_to_json(dataSheet, { header: 1, defval: '' });
  const headerRow2 = rows[1] || [];
  if (
    normalizeColumnKey(headerRow2[0]) !== 'idnhanvien' ||
    normalizeColumnKey(headerRow2[1]) !== 'hovaten'
  ) {
    return null;
  }

  const employees = [];
  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const rawCode = String(row[0] ?? '').trim();
    const rawFullName = String(row[1] ?? '').trim();
    if (!rawCode && !rawFullName) break;
    // Bỏ qua dòng ký hiệu cột C1..C4 và dòng ảo NV000 (Công Trung Bình)
    if (
      rawCode.toUpperCase() === 'C1' ||
      /^NV0+$/i.test(rawCode) ||
      normalizeColumnKey(rawFullName) === 'congtrungbinh'
    ) {
      continue;
    }
    employees.push({
      id: generateId(),
      code: normalizeEmployeeCode(rawCode),
      full_name: rawFullName,
      team_name: '',
      is_active: true
    });
  }

  return employees.length > 0 ? employees : null;
}

/**
 * Đọc file Excel danh sách nhân viên
 * @param {ArrayBuffer|Uint8Array|Buffer|string} data
 * @returns {Array<Object>} Mảng nhân viên chuẩn hóa
 */
export function parseEmployeeExcel(data) {
  const wb = readWorkbook(data);
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return [];

  // Hỗ trợ đọc trực tiếp bảng DANH SÁCH NHÂN VIÊN từ file PXHT_Sh.xlsx
  const masterEmployees = tryParsePxhtMasterEmployees(wb);
  if (masterEmployees && masterEmployees.length > 0) {
    return masterEmployees;
  }

  const ws = wb.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  const employees = [];

  rawRows.forEach((row, index) => {
    const matched = {};

    for (const [colName, colVal] of Object.entries(row)) {
      const normKey = normalizeColumnKey(colName);
      for (const [field, aliases] of Object.entries(EMPLOYEE_FIELD_MAP)) {
        if (aliases.includes(normKey)) {
          const isValEmpty = colVal === undefined || colVal === null || String(colVal).trim() === '';
          if (!isValEmpty) {
            matched[field] = colVal;
          } else if (matched[field] === undefined) {
            matched[field] = colVal;
          }
          break;
        }
      }
    }

    const rawCode = matched.code !== undefined && matched.code !== '' ? String(matched.code).trim() : '';
    const rawFullName = matched.full_name !== undefined ? String(matched.full_name).trim() : '';
    const rawTeam = matched.team_name !== undefined ? String(matched.team_name).trim() : '';

    // Bỏ qua dòng trống
    if (!rawCode && !rawFullName) {
      return;
    }

    const code = rawCode || `NV_${(index + 1).toString().padStart(2, '0')}`;
    let isActive = true;
    if (matched.is_active !== undefined && matched.is_active !== '') {
      const v = String(matched.is_active).trim().toLowerCase();
      isActive = v === 'true' || v === '1' || v === 'active' || v === 'hoatdong';
    }

    employees.push({
      id: generateId(),
      code,
      full_name: rawFullName,
      team_name: rawTeam,
      is_active: isActive
    });
  });

  return employees;
}

/**
 * Xuất Báo cáo sản lượng ra file Excel gồm 2 Sheet:
 * - Sheet 1: Chi_Tiet_San_Luong
 * - Sheet 2: Tong_Hop_Theo_Nhan_Vien
 * @param {Array<Object>} logs Danh sách nhật ký sản lượng
 * @param {Object} options Tùy chọn xuất (fileName, returnBuffer)
 * @returns {Buffer|Uint8Array|boolean}
 */
export function exportProductionReportToExcel(logs = [], options = {}) {
  const wb = XLSX.utils.book_new();

  // 1. Chuẩn bị dữ liệu Sheet 1: Chi tiết sản lượng
  const detailRows = logs.map((log) => {
    const logDate = log.log_date || log.date || (log.created_at ? String(log.created_at).slice(0, 10) : '');
    const empCode = log.employee_code || (log.employees && (log.employees.code || log.employees.id)) || '';
    const empName = log.employee_name || (log.employees && (log.employees.full_name || log.employees.name)) || '';
    const prodId = log.product_id || (log.products && (log.products.id || log.products.code)) || '';
    const isDaily = !prodId || Boolean(log.is_daily_work);
    const prodName = isDaily ? '' : (log.product_name || (log.products && log.products.name) || '');
    const customer = isDaily ? '' : (log.customer || (log.products && log.products.customer) || '');
    const operation = isDaily ? '' : (log.operation || '');
    const dailyWork = isDaily ? (log.operation || log.daily_work || '') : '';
    const qty = Number(log.quantity) || 0;
    const hours = Number(log.duration_hours) || 0;
    const notes = log.notes || '';

    return {
      'Ngày': logDate,
      'Mã NV': empCode,
      'Tên NV': empName,
      'Mã SP': prodId,
      'Tên SP': prodName,
      'Khách hàng': customer,
      'Công đoạn': operation,
      'Công nhật': dailyWork,
      'Số lượng': qty,
      'Số giờ': hours,
      'Ghi chú': notes
    };
  });

  const wsDetail = XLSX.utils.json_to_sheet(
    detailRows.length > 0 ? detailRows : [
      { 'Ngày': '', 'Mã NV': '', 'Tên NV': '', 'Mã SP': '', 'Tên SP': '', 'Khách hàng': '', 'Công đoạn': '', 'Công nhật': '', 'Số lượng': '', 'Số giờ': '', 'Ghi chú': '' }
    ]
  );

  wsDetail['!cols'] = [
    { wch: 12 }, // Ngày
    { wch: 10 }, // Mã NV
    { wch: 22 }, // Tên NV
    { wch: 10 }, // Mã SP
    { wch: 35 }, // Tên SP
    { wch: 20 }, // Khách hàng
    { wch: 16 }, // Công đoạn
    { wch: 25 }, // Công nhật
    { wch: 12 }, // Số lượng
    { wch: 10 }, // Số giờ
    { wch: 30 }  // Ghi chú
  ];

  XLSX.utils.book_append_sheet(wb, wsDetail, 'Chi_Tiet_San_Luong');

  // 2. Chuẩn bị dữ liệu Sheet 2: Tổng hợp theo nhân viên
  const employeeSummaryMap = new Map();

  for (const log of logs) {
    const empCode = log.employee_code || (log.employees && (log.employees.code || log.employees.id)) || 'CHUA_RO';
    const empName = log.employee_name || (log.employees && (log.employees.full_name || log.employees.name)) || '';
    const logDate = log.log_date || log.date || (log.created_at ? String(log.created_at).slice(0, 10) : '');
    const prodId = log.product_id || (log.products && (log.products.id || log.products.code)) || '';
    const isDaily = !prodId || Boolean(log.is_daily_work);
    const qty = Number(log.quantity) || 0;
    const hours = Number(log.duration_hours) || 0;

    let existing = employeeSummaryMap.get(empCode);
    if (!existing) {
      existing = {
        empCode,
        empName,
        totalQty: 0,
        totalHours: 0,
        dailyWorkHours: 0,
        dailyWorkSet: new Set(),
        notesSet: new Set(),
        workDays: new Set()
      };
      employeeSummaryMap.set(empCode, existing);
    }

    if (!existing.empName && empName) existing.empName = empName;
    existing.totalQty += qty;
    existing.totalHours += hours;
    if (isDaily) {
      existing.dailyWorkHours += hours;
      const opText = String(log.operation || log.daily_work || '').trim();
      if (opText) existing.dailyWorkSet.add(opText);
    }
    const noteText = String(log.notes || '').trim();
    if (noteText) existing.notesSet.add(noteText);
    if (logDate) {
      existing.workDays.add(logDate);
    }
  }

  const summaryRows = Array.from(employeeSummaryMap.values()).map((item) => ({
    'Mã NV': item.empCode,
    'Tên NV': item.empName,
    'Tổng sản phẩm': item.totalQty,
    'Tổng giờ': Math.round(item.totalHours * 100) / 100,
    'Giờ công nhật': Math.round(item.dailyWorkHours * 100) / 100,
    'Nội dung công nhật': Array.from(item.dailyWorkSet).join(', '),
    'Ghi chú': Array.from(item.notesSet).join(', '),
    'Số ngày làm việc': item.workDays.size
  }));

  const wsSummary = XLSX.utils.json_to_sheet(
    summaryRows.length > 0 ? summaryRows : [
      { 'Mã NV': '', 'Tên NV': '', 'Tổng sản phẩm': '', 'Tổng giờ': '', 'Giờ công nhật': '', 'Nội dung công nhật': '', 'Ghi chú': '', 'Số ngày làm việc': '' }
    ]
  );

  wsSummary['!cols'] = [
    { wch: 10 }, // Mã NV
    { wch: 22 }, // Tên NV
    { wch: 16 }, // Tổng sản phẩm
    { wch: 14 }, // Tổng giờ
    { wch: 14 }, // Giờ công nhật
    { wch: 30 }, // Nội dung công nhật
    { wch: 25 }, // Ghi chú
    { wch: 18 }  // Số ngày làm việc
  ];

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Tong_Hop_Theo_Nhan_Vien');

  // 3. Tên file mặc định Bao_Cao_San_Luong_YYYYMMDD.xlsx
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const defaultFileName = `Bao_Cao_San_Luong_${yyyy}${mm}${dd}.xlsx`;

  return saveWorkbook(wb, defaultFileName, options);
}

/**
 * Tạo file Excel mẫu cho Danh mục sản phẩm
 * @param {Object} options Tùy chọn (fileName, returnBuffer)
 */
export function generateProductTemplate(options = {}) {
  const wb = XLSX.utils.book_new();

  const sampleProducts = [
    {
      'Mã SP': '1732',
      'Tên sản phẩm': 'Cánh đập phản kích 2021 (670x300x80)',
      'Khách hàng': 'Đại Phú',
      'Số lượng': 8,
      'Phôi': 3,
      'T.t': 'Sx',
      'CD1': 'Mài đậu',
      'CD2': 'Hoàn thiện',
      'CD3': 'Nắn',
      'CD4': 'Sơn',
      'CD5': 'Đóng thùng'
    },
    {
      'Mã SP': '1733',
      'Tên sản phẩm': 'Ống gối bi 231/500 (Φ1070/950 dài 1470)',
      'Khách hàng': 'Đại Phú',
      'Số lượng': 2,
      'Phôi': 0,
      'T.t': 'Sx',
      'CD1': 'Hoàn thiện',
      'CD2': 'Sơn',
      'CD3': 'Đóng thùng',
      'CD4': '',
      'CD5': ''
    },
    {
      'Mã SP': '1775',
      'Tên sản phẩm': 'Cánh búa tâm 360',
      'Khách hàng': 'Đại Phú',
      'Số lượng': 100,
      'Phôi': 30,
      'T.t': 'Sx',
      'CD1': 'Mài đậu',
      'CD2': 'Nắn',
      'CD3': '',
      'CD4': '',
      'CD5': ''
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleProducts);
  ws['!cols'] = [
    { wch: 12 },
    { wch: 40 },
    { wch: 22 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Danh_Muc_SP');
  return saveWorkbook(wb, 'Mau_Danh_Muc_San_Pham.xlsx', options);
}

/**
 * Tạo file Excel mẫu cho Danh sách nhân viên
 * @param {Object} options Tùy chọn (fileName, returnBuffer)
 */
export function generateEmployeeTemplate(options = {}) {
  const wb = XLSX.utils.book_new();

  const sampleEmployees = [
    {
      'Mã NV': 'NV01',
      'Họ và tên': 'Trần Văn Hùng'
    },
    {
      'Mã NV': 'NV02',
      'Họ và tên': 'Lê Văn Cường'
    },
    {
      'Mã NV': 'NV04',
      'Họ và tên': 'Phạm Văn Minh'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleEmployees);
  ws['!cols'] = [
    { wch: 12 },
    { wch: 25 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Danh_Sach_NV');
  return saveWorkbook(wb, 'Mau_Danh_Sach_Nhan_Vien.xlsx', options);
}

export default {
  normalizeColumnKey,
  parseProductExcel,
  parseEmployeeExcel,
  exportProductionReportToExcel,
  generateProductTemplate,
  generateEmployeeTemplate
};
