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
 * Đọc file Excel danh mục sản phẩm
 * @param {ArrayBuffer|Uint8Array|Buffer|string} data
 * @returns {Array<Object>} Mảng sản phẩm chuẩn hóa
 */
export function parseProductExcel(data) {
  const wb = readWorkbook(data);
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return [];

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
  code: ['manv', 'manhanvien', 'code', 'employeecode', 'id', 'ma'],
  full_name: ['hovaten', 'hoten', 'fullname', 'name', 'tennv', 'tennhanvien', 'nhanvien', 'ten'],
  team_name: ['to', 'tosanxuat', 'bophan', 'tobophan', 'teamname', 'department', 'team', 'phongban'],
  is_active: ['isactive', 'hoatdong', 'trangthai', 'active']
};

/**
 * Đọc file Excel danh sách nhân viên
 * @param {ArrayBuffer|Uint8Array|Buffer|string} data
 * @returns {Array<Object>} Mảng nhân viên chuẩn hóa
 */
export function parseEmployeeExcel(data) {
  const wb = readWorkbook(data);
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return [];

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
    const prodName = log.product_name || (log.products && log.products.name) || '';
    const customer = log.customer || (log.products && log.products.customer) || '';
    const operation = log.operation || '';
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
      'Số lượng': qty,
      'Số giờ': hours,
      'Ghi chú': notes
    };
  });

  const wsDetail = XLSX.utils.json_to_sheet(
    detailRows.length > 0 ? detailRows : [
      { 'Ngày': '', 'Mã NV': '', 'Tên NV': '', 'Mã SP': '', 'Tên SP': '', 'Khách hàng': '', 'Công đoạn': '', 'Số lượng': '', 'Số giờ': '', 'Ghi chú': '' }
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
    const qty = Number(log.quantity) || 0;
    const hours = Number(log.duration_hours) || 0;

    let existing = employeeSummaryMap.get(empCode);
    if (!existing) {
      existing = {
        empCode,
        empName,
        totalQty: 0,
        totalHours: 0,
        workDays: new Set()
      };
      employeeSummaryMap.set(empCode, existing);
    }

    if (!existing.empName && empName) existing.empName = empName;
    existing.totalQty += qty;
    existing.totalHours += hours;
    if (logDate) {
      existing.workDays.add(logDate);
    }
  }

  const summaryRows = Array.from(employeeSummaryMap.values()).map((item) => ({
    'Mã NV': item.empCode,
    'Tên NV': item.empName,
    'Tổng sản phẩm': item.totalQty,
    'Tổng giờ': Math.round(item.totalHours * 100) / 100,
    'Số ngày làm việc': item.workDays.size
  }));

  const wsSummary = XLSX.utils.json_to_sheet(
    summaryRows.length > 0 ? summaryRows : [
      { 'Mã NV': '', 'Tên NV': '', 'Tổng sản phẩm': '', 'Tổng giờ': '', 'Số ngày làm việc': '' }
    ]
  );

  wsSummary['!cols'] = [
    { wch: 10 }, // Mã NV
    { wch: 22 }, // Tên NV
    { wch: 16 }, // Tổng sản phẩm
    { wch: 14 }, // Tổng giờ
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
