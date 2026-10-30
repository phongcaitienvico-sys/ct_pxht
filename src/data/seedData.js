/**
 * Dữ liệu hạt giống ban đầu (Seed Data)
 * Trích xuất từ bảng theo dõi sản xuất thực tế của Quản đốc xưởng
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
    is_active_today: false
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
  }
];

export const seedLogs = [
  {
    id: 'l0000000-0000-0000-0000-000000000001',
    log_date: '2026-10-29',
    team_id: 'a0000000-0000-0000-0000-000000000001',
    employee_id: 'e0000000-0000-0000-0000-000000000001',
    product_id: '1732',
    quantity: 2,
    duration_hours: 4.0,
    notes: 'Gia công nhiệt luyện',
    created_at: '2026-10-29T08:30:00.000Z'
  },
  {
    id: 'l0000000-0000-0000-0000-000000000002',
    log_date: '2026-10-29',
    team_id: 'a0000000-0000-0000-0000-000000000001',
    employee_id: 'e0000000-0000-0000-0000-000000000002',
    product_id: '1775',
    quantity: 15,
    duration_hours: 6.5,
    notes: 'Phay tinh bề mặt',
    created_at: '2026-10-29T10:15:00.000Z'
  }
];

export default {
  seedTeams,
  seedEmployees,
  seedProducts,
  seedLogs
};
