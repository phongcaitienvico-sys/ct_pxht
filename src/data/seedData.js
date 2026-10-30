/**
 * Dữ liệu hạt giống ban đầu (Seed Data)
 * Trích xuất từ bảng theo dõi sản xuất thực tế của Phân Xưởng Hoàn Thiện
 */

export const seedTeams = [
  {
    id: 'a0000000-0000-0000-0000-000000000001',
    name: 'Tổ 1 - Cơ khí & Đúc',
    leader_email: 'to1@xuong.vn'
  },
  {
    id: 'a0000000-0000-0000-0000-000000000002',
    name: 'Tổ 2 - Tiện & Phay',
    leader_email: 'to2@xuong.vn'
  },
  {
    id: 'a0000000-0000-0000-0000-000000000003',
    name: 'Tổ 3 - Hàn & Hoàn thiện',
    leader_email: 'to3@xuong.vn'
  }
];

export const seedEmployees = [
  {
    id: 'e0000000-0000-0000-0000-000000000001',
    code: 'NV01',
    full_name: 'Trần Văn Hùng',
    team_id: 'a0000000-0000-0000-0000-000000000001',
    is_active: true
  },
  {
    id: 'e0000000-0000-0000-0000-000000000002',
    code: 'NV02',
    full_name: 'Lê Văn Cường',
    team_id: 'a0000000-0000-0000-0000-000000000001',
    is_active: true
  },
  {
    id: 'e0000000-0000-0000-0000-000000000003',
    code: 'NV03',
    full_name: 'Nguyễn Đình Tú',
    team_id: 'a0000000-0000-0000-0000-000000000001',
    is_active: true
  },
  {
    id: 'e0000000-0000-0000-0000-000000000004',
    code: 'NV04',
    full_name: 'Phạm Văn Minh',
    team_id: 'a0000000-0000-0000-0000-000000000002',
    is_active: true
  },
  {
    id: 'e0000000-0000-0000-0000-000000000005',
    code: 'NV05',
    full_name: 'Hoàng Đức Tuấn',
    team_id: 'a0000000-0000-0000-0000-000000000002',
    is_active: true
  },
  {
    id: 'e0000000-0000-0000-0000-000000000006',
    code: 'NV06',
    full_name: 'Đỗ Quốc Việt',
    team_id: 'a0000000-0000-0000-0000-000000000002',
    is_active: true
  },
  {
    id: 'e0000000-0000-0000-0000-000000000007',
    code: 'NV07',
    full_name: 'Vũ Hải Nam',
    team_id: 'a0000000-0000-0000-0000-000000000003',
    is_active: true
  },
  {
    id: 'e0000000-0000-0000-0000-000000000008',
    code: 'NV08',
    full_name: 'Bùi Quang Sáng',
    team_id: 'a0000000-0000-0000-0000-000000000003',
    is_active: true
  }
];

export const seedProducts = [
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
    is_active_today: true
  },
  {
    id: '1765',
    name: 'Cánh đập MPK (660x400x120)',
    customer: 'Đại Phú',
    order_quantity: 64,
    blank_quantity: 16,
    status: 'Sx',
    is_active_today: true
  },
  {
    id: '1775',
    name: 'Cánh búa tâm 360',
    customer: 'Đại Phú',
    order_quantity: 100,
    blank_quantity: 30,
    status: 'Sx',
    is_active_today: true
  },
  {
    id: '1781',
    name: 'Cánh búa tâm 365 (Dày 55/45/35/74)',
    customer: 'Đại Phú',
    order_quantity: 20,
    blank_quantity: 16,
    status: 'Sx',
    is_active_today: false
  },
  {
    id: '1790',
    name: 'Cánh búa 395 (Dày 55/35/45/65)',
    customer: 'Đại Phú',
    order_quantity: 100,
    blank_quantity: 57,
    status: 'Sx',
    is_active_today: true
  },
  {
    id: '1816',
    name: 'Đĩa búa 1600x1800 (Đĩa 2 bên Φ700 moay ơ)',
    customer: 'Đại Phú',
    order_quantity: 22,
    blank_quantity: 0,
    status: 'Sx',
    is_active_today: true
  },
  {
    id: '1817',
    name: 'Đĩa búa 1600x1800 (Đĩa 1 bên Φ700 moay ơ)',
    customer: 'Đại Phú',
    order_quantity: 4,
    blank_quantity: 0,
    status: 'Sx',
    is_active_today: false
  },
  {
    id: '1462',
    name: 'Thanh đập đá vôi (2220x510x145)',
    customer: 'Hà Song Hải- XM Hạ',
    order_quantity: 18,
    blank_quantity: 4,
    status: 'Sx',
    is_active_today: true
  },
  {
    id: '714',
    name: 'Búa nghiền 685x98x35',
    customer: 'Hải Vinh Quảng Ninh',
    order_quantity: 500,
    blank_quantity: 120,
    status: 'Sx',
    is_active_today: true
  },
  {
    id: '1820',
    name: 'Vành tỳ con lăn lò quay (Φ2200x500)',
    customer: 'Xi Măng Cẩm Phả',
    order_quantity: 2,
    blank_quantity: 2,
    status: 'Sx',
    is_active_today: false
  },
  {
    id: '1825',
    name: 'Trục cán thô thép tấm (Φ450 dài 2800)',
    customer: 'Thép Hoà Phát',
    order_quantity: 6,
    blank_quantity: 6,
    status: 'Sx',
    is_active_today: true
  }
];

export function getSeedDate(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDynamicSeedLogs() {
  const today = getSeedDate(0);
  const yesterday = getSeedDate(1);

  return [
    {
      id: 'l0000000-0000-0000-0000-000000000001',
      log_date: today,
      team_id: 'a0000000-0000-0000-0000-000000000001',
      employee_id: 'e0000000-0000-0000-0000-000000000001',
      product_id: '1732',
      quantity: 4,
      duration_hours: 3.5,
      notes: 'Tiện khỏa mặt & doa lỗ',
      created_at: `${today}T08:15:00.000Z`
    },
    {
      id: 'l0000000-0000-0000-0000-000000000002',
      log_date: today,
      team_id: 'a0000000-0000-0000-0000-000000000001',
      employee_id: 'e0000000-0000-0000-0000-000000000001',
      product_id: '1733',
      quantity: 1,
      duration_hours: 4.0,
      notes: 'Gia công gối đỡ bi',
      created_at: `${today}T10:30:00.000Z`
    },
    {
      id: 'l0000000-0000-0000-0000-000000000003',
      log_date: today,
      team_id: 'a0000000-0000-0000-0000-000000000001',
      employee_id: 'e0000000-0000-0000-0000-000000000002',
      product_id: '1775',
      quantity: 20,
      duration_hours: 7.5,
      notes: 'Phay rãnh cánh búa',
      created_at: `${today}T09:00:00.000Z`
    },
    {
      id: 'l0000000-0000-0000-0000-000000000004',
      log_date: today,
      team_id: 'a0000000-0000-0000-0000-000000000002',
      employee_id: 'e0000000-0000-0000-0000-000000000004',
      product_id: '1816',
      quantity: 3,
      duration_hours: 6.0,
      notes: 'Tiện tinh moay ơ đĩa búa',
      created_at: `${today}T08:45:00.000Z`
    },
    {
      id: 'l0000000-0000-0000-0000-000000000005',
      log_date: yesterday,
      team_id: 'a0000000-0000-0000-0000-000000000001',
      employee_id: 'e0000000-0000-0000-0000-000000000001',
      product_id: '1732',
      quantity: 2,
      duration_hours: 4.0,
      notes: 'Gia công nhiệt luyện',
      created_at: `${yesterday}T08:30:00.000Z`
    },
    {
      id: 'l0000000-0000-0000-0000-000000000006',
      log_date: yesterday,
      team_id: 'a0000000-0000-0000-0000-000000000001',
      employee_id: 'e0000000-0000-0000-0000-000000000002',
      product_id: '1775',
      quantity: 15,
      duration_hours: 6.5,
      notes: 'Phay tinh bề mặt',
      created_at: `${yesterday}T10:15:00.000Z`
    },
    {
      id: 'l0000000-0000-0000-0000-000000000007',
      log_date: yesterday,
      team_id: 'a0000000-0000-0000-0000-000000000002',
      employee_id: 'e0000000-0000-0000-0000-000000000005',
      product_id: '1462',
      quantity: 5,
      duration_hours: 7.0,
      notes: 'Khoan lỗ bắt bu lông',
      created_at: `${yesterday}T09:30:00.000Z`
    }
  ];
}

export const seedLogs = getDynamicSeedLogs();

export default {
  seedTeams,
  seedEmployees,
  seedProducts,
  seedLogs
};
