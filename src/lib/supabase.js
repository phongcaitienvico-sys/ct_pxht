import { createClient } from '@supabase/supabase-js';
import { seedProducts, seedTeams, seedEmployees, seedLogs, getDynamicSeedLogs } from '../data/seedData.js';
import { hashPassword, verifyPassword } from './passwordHash.js';
import {
  DEFAULT_ADMIN,
  normalizeUsername,
  validateNewAccount,
  validateAccountUpdate,
  validatePassword,
  canDeleteAccount,
  canToggleActive
} from '../components/admin/accountManagerLogic.js';

// Safe environment variable resolution (supports Vite import.meta.env and Node process.env)
const env =
  (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env :
  (typeof process !== 'undefined' && process.env) ? process.env :
  {};

const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || '';

// Check if running in demo / fallback mode
export function isDemoMode() {
  return (
    !supabaseUrl ||
    supabaseUrl === 'YOUR_SUPABASE_URL' ||
    supabaseUrl.includes('placeholder') ||
    !supabaseAnonKey ||
    supabaseAnonKey === 'YOUR_SUPABASE_ANON_KEY'
  );
}

// Local / In-memory storage keys
const KEYS = {
  PRODUCTS: 'pxht_products',
  TEAMS: 'pxht_teams',
  EMPLOYEES: 'pxht_employees',
  LOGS: 'pxht_production_logs',
  ACCOUNTS: 'pxht_accounts'
};

const memoryStore = {};

function getStore(key, defaultValue) {
  if (typeof localStorage !== 'undefined') {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : defaultValue;
    } catch {
      return defaultValue;
    }
  }
  return memoryStore[key] ? JSON.parse(JSON.stringify(memoryStore[key])) : defaultValue;
}

function setStore(key, value) {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('localStorage write failed:', e);
    }
  }
  memoryStore[key] = JSON.parse(JSON.stringify(value));
}

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

export const MAX_OPERATIONS = 10;

/**
 * Chuẩn hóa danh sách công đoạn: mảng chuỗi đã trim, bỏ rỗng, tối đa 10 mục
 */
function normalizeOperations(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
    .slice(0, MAX_OPERATIONS);
}

// Đảm bảo sản phẩm luôn có mảng operations (mặc định [])
function withOperations(product) {
  if (!product) return product;
  return { ...product, operations: normalizeOperations(product.operations) };
}

// Realtime listeners for Demo Mode
const demoSubscribers = new Set();

function notifySubscribers(event) {
  for (const cb of demoSubscribers) {
    try {
      cb(event);
    } catch (err) {
      console.error('Subscriber callback error:', err);
    }
  }
}

/**
 * Reset local demo store to initial seed data
 */
export async function resetDemoData() {
  setStore(KEYS.PRODUCTS, seedProducts);
  setStore(KEYS.TEAMS, seedTeams);
  setStore(KEYS.EMPLOYEES, seedEmployees);
  const dynamicLogs = typeof getDynamicSeedLogs === 'function' ? getDynamicSeedLogs() : seedLogs;
  setStore(KEYS.LOGS, dynamicLogs);
  setStore('pxht_demo_version', DEMO_DATA_VERSION);
  return {
    products: seedProducts,
    teams: seedTeams,
    employees: seedEmployees,
    logs: dynamicLogs
  };
}

/**
 * Ensure demo store is initialized with seed data if empty
 */
export const DEMO_DATA_VERSION = 'pxht-seed-v5-operations';

export async function initDemoData() {
  const version = getStore('pxht_demo_version', null);
  const existingProducts = getStore(KEYS.PRODUCTS, null);
  const existingLogs = getStore(KEYS.LOGS, null);

  if (
    version !== DEMO_DATA_VERSION ||
    !existingProducts ||
    !Array.isArray(existingProducts) ||
    existingProducts.length === 0 ||
    !existingLogs ||
    !Array.isArray(existingLogs) ||
    existingLogs.length <= 2
  ) {
    await resetDemoData();
  }
}

async function ensureDemoInitialized() {
  await initDemoData();
}

// ==============================================================================
// PRODUCT APIS
// ==============================================================================

/**
 * Lấy toàn bộ danh mục sản phẩm
 */
export async function getProducts() {
  if (isDemoMode()) {
    await ensureDemoInitialized();
    return getStore(KEYS.PRODUCTS, []).map(withOperations);
  }

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error('getProducts error:', error);
    throw error;
  }
  return (data || []).map(withOperations);
}

/**
 * Bật/tắt 1 mã sản phẩm làm hôm nay
 */
export async function updateProductToggle(id, isActive) {
  const activeBool = Boolean(isActive);
  const now = new Date().toISOString();

  if (isDemoMode()) {
    await ensureDemoInitialized();
    const products = getStore(KEYS.PRODUCTS, []);
    const product = products.find((p) => String(p.id) === String(id));
    if (!product) {
      throw new Error(`Product with id ${id} not found`);
    }
    product.is_active_today = activeBool;
    product.updated_at = now;
    setStore(KEYS.PRODUCTS, products);
    return { ...product };
  }

  const { data, error } = await supabase
    .from('products')
    .update({ is_active_today: activeBool, updated_at: now })
    .eq('id', String(id))
    .select()
    .single();

  if (error) {
    console.error('updateProductToggle error:', error);
    throw error;
  }
  return data;
}

/**
 * Bật/tắt nhiều mã sản phẩm cùng lúc, hoặc 'all'
 */
export async function bulkUpdateProductToggle(ids, isActive) {
  const activeBool = Boolean(isActive);
  const now = new Date().toISOString();

  if (isDemoMode()) {
    await ensureDemoInitialized();
    const products = getStore(KEYS.PRODUCTS, []);
    if (ids === 'all') {
      products.forEach((p) => {
        p.is_active_today = activeBool;
        p.updated_at = now;
      });
    } else if (Array.isArray(ids)) {
      const idSet = new Set(ids.map(String));
      products.forEach((p) => {
        if (idSet.has(String(p.id))) {
          p.is_active_today = activeBool;
          p.updated_at = now;
        }
      });
    }
    setStore(KEYS.PRODUCTS, products);
    return products;
  }

  let query = supabase.from('products').update({ is_active_today: activeBool, updated_at: now });
  if (ids === 'all') {
    query = query.neq('id', '');
  } else if (Array.isArray(ids)) {
    query = query.in('id', ids.map(String));
  }

  const { data, error } = await query.select();
  if (error) {
    console.error('bulkUpdateProductToggle error:', error);
    throw error;
  }
  return data;
}

/**
 * Thêm hoặc cập nhật hàng loạt sản phẩm (dùng khi Import Excel)
 */
export async function upsertProducts(productsArray) {
  if (!Array.isArray(productsArray) || productsArray.length === 0) return [];
  const now = new Date().toISOString();

  if (isDemoMode()) {
    await ensureDemoInitialized();
    const products = getStore(KEYS.PRODUCTS, []);
    const productMap = new Map(products.map((p) => [String(p.id), p]));

    for (const item of productsArray) {
      const id = String(item.id);
      const existing = productMap.get(id);
      const updated = {
        id,
        name: item.name || '',
        customer: item.customer || '',
        order_quantity: Number(item.order_quantity) || 0,
        blank_quantity: Number(item.blank_quantity) || 0,
        status: item.status || 'Sx',
        operations:
          item.operations !== undefined
            ? normalizeOperations(item.operations)
            : existing
            ? normalizeOperations(existing.operations)
            : [],
        is_active_today:
          item.is_active_today !== undefined
            ? Boolean(item.is_active_today)
            : existing
            ? existing.is_active_today
            : false,
        updated_at: now
      };
      productMap.set(id, updated);
    }

    const updatedList = Array.from(productMap.values());
    setStore(KEYS.PRODUCTS, updatedList);
    return productsArray.map((p) => productMap.get(String(p.id)));
  }

  // Chuẩn hóa công đoạn (chỉ gửi khi có truyền vào để không ghi đè dữ liệu cũ)
  const payload = productsArray.map((item) =>
    item.operations !== undefined ? { ...item, operations: normalizeOperations(item.operations) } : item
  );

  const { data, error } = await supabase
    .from('products')
    .upsert(payload, { onConflict: 'id' })
    .select();

  if (error) {
    console.error('upsertProducts error:', error);
    throw error;
  }
  return (data || []).map(withOperations);
}

/**
 * Xóa một sản phẩm khỏi danh mục
 */
export async function deleteProduct(id) {
  if (isDemoMode()) {
    await ensureDemoInitialized();
    const products = getStore(KEYS.PRODUCTS, []);
    const filtered = products.filter((p) => String(p.id) !== String(id));
    setStore(KEYS.PRODUCTS, filtered);
    return true;
  }

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', String(id));

  if (error) {
    console.error('deleteProduct error:', error);
    throw error;
  }
  return true;
}

// ==============================================================================
// TEAMS & EMPLOYEES APIS
// ==============================================================================

/**
 * Lấy danh sách tổ sản xuất
 */
export async function getTeams() {
  if (isDemoMode()) {
    await ensureDemoInitialized();
    return getStore(KEYS.TEAMS, []);
  }

  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('getTeams error:', error);
    throw error;
  }
  return data;
}

/**
 * Lấy danh sách nhân viên (có thể lọc theo teamId)
 */
export async function getEmployees(teamId = null) {
  if (isDemoMode()) {
    await ensureDemoInitialized();
    let emps = getStore(KEYS.EMPLOYEES, []);
    if (teamId) {
      emps = emps.filter((e) => e.team_id === teamId);
    }
    return emps;
  }

  let query = supabase.from('employees').select('*, teams(name)').eq('is_active', true);
  if (teamId) {
    query = query.eq('team_id', teamId);
  }

  const { data, error } = await query.order('code', { ascending: true });
  if (error) {
    console.error('getEmployees error:', error);
    throw error;
  }
  return data;
}

/**
 * Thêm hoặc cập nhật hàng loạt nhân viên (dùng khi Import Excel)
 */
export async function upsertEmployees(employeesArray) {
  if (!Array.isArray(employeesArray) || employeesArray.length === 0) return [];

  if (isDemoMode()) {
    await ensureDemoInitialized();
    const emps = getStore(KEYS.EMPLOYEES, []);
    const empMap = new Map(emps.map((e) => [e.code || e.id, e]));

    for (const item of employeesArray) {
      const key = item.code || item.id || generateId();
      const existing = empMap.get(key);
      const updated = {
        id: item.id || (existing ? existing.id : generateId()),
        code: item.code || (existing ? existing.code : key),
        full_name: item.full_name || '',
        team_id: item.team_id || (existing ? existing.team_id : null),
        is_active: item.is_active !== undefined ? Boolean(item.is_active) : true,
        created_at: existing ? existing.created_at : new Date().toISOString()
      };
      empMap.set(key, updated);
    }

    const updatedList = Array.from(empMap.values());
    setStore(KEYS.EMPLOYEES, updatedList);
    return employeesArray.map((e) => empMap.get(e.code || e.id));
  }

  const { data, error } = await supabase
    .from('employees')
    .upsert(employeesArray, { onConflict: 'code' })
    .select();

  if (error) {
    console.error('upsertEmployees error:', error);
    throw error;
  }
  return data;
}

/**
 * Xóa một nhân viên khỏi danh sách
 */
export async function deleteEmployee(id) {
  if (isDemoMode()) {
    await ensureDemoInitialized();
    const emps = getStore(KEYS.EMPLOYEES, []);
    const filtered = emps.filter((e) => String(e.id) !== String(id) && String(e.code) !== String(id));
    setStore(KEYS.EMPLOYEES, filtered);
    return true;
  }

  const { error } = await supabase
    .from('employees')
    .delete()
    .eq('id', String(id));

  if (error) {
    console.error('deleteEmployee error:', error);
    throw error;
  }
  return true;
}

// ==============================================================================
// PRODUCTION LOGS APIS
// ==============================================================================

/**
 * Ghi nhận nhật ký sản lượng (Hỗ trợ batch insert nhiều sản phẩm cho 1 thợ)
 */
export async function submitProductionLogs(logsArray) {
  if (!Array.isArray(logsArray) || logsArray.length === 0) {
    return [];
  }
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  if (isDemoMode()) {
    await ensureDemoInitialized();
    const currentLogs = getStore(KEYS.LOGS, []);
    const products = getStore(KEYS.PRODUCTS, []);
    const employees = getStore(KEYS.EMPLOYEES, []);
    const teams = getStore(KEYS.TEAMS, []);

    const inserted = logsArray.map((item) => {
      const id = item.id || generateId();
      const log_date = item.log_date || today;
      const quantity = Number(item.quantity) || 0;
      const duration_hours = Number(item.duration_hours) || 0;
      const emp = employees.find((e) => e.id === item.employee_id);
      const prod = products.find((p) => String(p.id) === String(item.product_id));
      const team = teams.find((t) => t.id === item.team_id);

      return {
        ...item,
        id,
        log_date,
        quantity,
        duration_hours,
        operation: String(item.operation ?? '').trim(),
        created_at: item.created_at || now,
        employee_name: emp ? emp.full_name : '',
        employee_code: emp ? emp.code : '',
        product_name: prod ? prod.name : '',
        customer: prod ? prod.customer : '',
        team_name: team ? team.name : '',
        employees: emp || null,
        products: prod || null,
        teams: team || null
      };
    });

    const updatedList = [...currentLogs, ...inserted];
    setStore(KEYS.LOGS, updatedList);

    for (const record of inserted) {
      notifySubscribers({ eventType: 'INSERT', new: record, old: null });
    }

    return inserted;
  }

  const formatted = logsArray.map(({ created_by, ...item }) => ({
    ...item,
    log_date: item.log_date || today,
    quantity: Number(item.quantity) || 0,
    duration_hours: Number(item.duration_hours) || 0,
    operation: String(item.operation ?? '').trim(),
    created_at: item.created_at || now
  }));

  const { data, error } = await supabase
    .from('production_logs')
    .insert(formatted)
    .select('*, employees(*), products(*), teams(*)');

  if (error) {
    console.error('submitProductionLogs error:', error);
    throw error;
  }
  return data;
}

/**
 * Lấy danh sách nhật ký sản lượng kèm bộ lọc (date, startDate, endDate, teamId, employeeId)
 */
export async function getProductionLogs(filter = {}) {
  if (isDemoMode()) {
    await ensureDemoInitialized();
    let logs = getStore(KEYS.LOGS, []);
    const products = getStore(KEYS.PRODUCTS, []);
    const employees = getStore(KEYS.EMPLOYEES, []);
    const teams = getStore(KEYS.TEAMS, []);

    if (filter.date) {
      logs = logs.filter((l) => l.log_date === filter.date);
    }
    if (filter.startDate) {
      logs = logs.filter((l) => l.log_date >= filter.startDate);
    }
    if (filter.endDate) {
      logs = logs.filter((l) => l.log_date <= filter.endDate);
    }
    if (filter.teamId) {
      logs = logs.filter((l) => l.team_id === filter.teamId);
    }
    if (filter.employeeId) {
      logs = logs.filter((l) => l.employee_id === filter.employeeId);
    }

    const enriched = logs.map((l) => {
      const emp = employees.find((e) => e.id === l.employee_id);
      const prod = products.find((p) => String(p.id) === String(l.product_id));
      const team = teams.find((t) => t.id === l.team_id);
      return {
        ...l,
        employee_name: emp ? emp.full_name : (l.employee_name || ''),
        employee_code: emp ? emp.code : (l.employee_code || ''),
        product_name: prod ? prod.name : (l.product_name || ''),
        customer: prod ? prod.customer : (l.customer || ''),
        team_name: team ? team.name : (l.team_name || ''),
        employees: emp || l.employees || null,
        products: prod || l.products || null,
        teams: team || l.teams || null
      };
    });

    enriched.sort((a, b) => {
      const dateA = a.log_date || '';
      const dateB = b.log_date || '';
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      return (b.created_at || '').localeCompare(a.created_at || '');
    });

    return enriched;
  }

  const PAGE_SIZE = 1000;
  let allRows = [];
  let from = 0;

  while (true) {
    let query = supabase.from('production_logs').select('*, employees(*), products(*), teams(*)');

    if (filter.date) {
      query = query.eq('log_date', filter.date);
    }
    if (filter.startDate) {
      query = query.gte('log_date', filter.startDate);
    }
    if (filter.endDate) {
      query = query.lte('log_date', filter.endDate);
    }
    if (filter.teamId) {
      query = query.eq('team_id', filter.teamId);
    }
    if (filter.employeeId) {
      query = query.eq('employee_id', filter.employeeId);
    }

    const { data, error } = await query
      .order('log_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error('getProductionLogs error:', error);
      throw error;
    }
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allRows;
}

/**
 * Cập nhật bản ghi nhật ký sản lượng
 */
export async function updateProductionLog(logId, updates) {
  if (isDemoMode()) {
    await ensureDemoInitialized();
    const currentLogs = getStore(KEYS.LOGS, []);
    const products = getStore(KEYS.PRODUCTS, []);
    const employees = getStore(KEYS.EMPLOYEES, []);
    const teams = getStore(KEYS.TEAMS, []);

    const index = currentLogs.findIndex((l) => l.id === logId);
    if (index === -1) {
      throw new Error(`Log with id ${logId} not found`);
    }

    const oldRecord = currentLogs[index];
    const updated = { ...oldRecord, ...updates };
    if (updates.quantity !== undefined) updated.quantity = Number(updates.quantity);
    if (updates.duration_hours !== undefined) updated.duration_hours = Number(updates.duration_hours);
    if (updates.operation !== undefined) updated.operation = String(updates.operation ?? '').trim();

    const emp = employees.find((e) => e.id === updated.employee_id);
    const prod = products.find((p) => String(p.id) === String(updated.product_id));
    const team = teams.find((t) => t.id === updated.team_id);

    updated.employee_name = emp ? emp.full_name : '';
    updated.employee_code = emp ? emp.code : '';
    updated.product_name = prod ? prod.name : '';
    updated.customer = prod ? prod.customer : '';
    updated.team_name = team ? team.name : '';
    updated.employees = emp || null;
    updated.products = prod || null;
    updated.teams = team || null;

    currentLogs[index] = updated;
    setStore(KEYS.LOGS, currentLogs);

    notifySubscribers({ eventType: 'UPDATE', new: updated, old: oldRecord });
    return updated;
  }

  const payload = { ...updates };
  if (payload.operation !== undefined) payload.operation = String(payload.operation ?? '').trim();

  const { data, error } = await supabase
    .from('production_logs')
    .update(payload)
    .eq('id', logId)
    .select('*, employees(*), products(*), teams(*)')
    .single();

  if (error) {
    console.error('updateProductionLog error:', error);
    throw error;
  }
  return data;
}

/**
 * Xóa bản ghi nhật ký sản lượng
 */
export async function deleteProductionLog(logId) {
  if (isDemoMode()) {
    await ensureDemoInitialized();
    const currentLogs = getStore(KEYS.LOGS, []);
    const oldRecord = currentLogs.find((l) => l.id === logId);
    const remaining = currentLogs.filter((l) => l.id !== logId);
    setStore(KEYS.LOGS, remaining);

    if (oldRecord) {
      notifySubscribers({ eventType: 'DELETE', new: null, old: oldRecord });
    }
    return true;
  }

  const { error } = await supabase
    .from('production_logs')
    .delete()
    .eq('id', logId);

  if (error) {
    console.error('deleteProductionLog error:', error);
    throw error;
  }
  return true;
}

/**
 * Đăng ký nhận thông báo thay đổi nhật ký (Realtime)
 */
export function subscribeToLogs(callback) {
  if (isDemoMode()) {
    demoSubscribers.add(callback);
    return () => {
      demoSubscribers.delete(callback);
    };
  }

  const channel = supabase
    .channel('production_logs_realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'production_logs' }, (payload) => {
      callback(payload);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ==============================================================================
// TEAM MANAGEMENT APIS
// ==============================================================================

function normalizeTeamName(name) {
  return String(name ?? '').trim();
}

/**
 * Tạo tổ sản xuất mới
 */
export async function createTeam(name) {
  const clean = normalizeTeamName(name);
  if (!clean) throw new Error('Vui lòng nhập tên tổ');

  if (isDemoMode()) {
    await ensureDemoInitialized();
    const teams = getStore(KEYS.TEAMS, []);
    if (teams.some((t) => t.name.toLowerCase() === clean.toLowerCase())) {
      throw new Error('Tên tổ đã tồn tại');
    }
    const team = { id: generateId(), name: clean, leader_email: null };
    setStore(KEYS.TEAMS, [...teams, team]);
    return { ...team };
  }

  const { data, error } = await supabase.from('teams').insert({ name: clean }).select().single();
  if (error) {
    if (error.code === '23505') throw new Error('Tên tổ đã tồn tại');
    throw error;
  }
  return data;
}

/**
 * Đổi tên tổ sản xuất
 */
export async function updateTeam(id, updates = {}) {
  const clean = normalizeTeamName(updates.name);
  if (!clean) throw new Error('Vui lòng nhập tên tổ');

  if (isDemoMode()) {
    await ensureDemoInitialized();
    const teams = getStore(KEYS.TEAMS, []);
    const team = teams.find((t) => t.id === id);
    if (!team) throw new Error('Không tìm thấy tổ');
    if (teams.some((t) => t.id !== id && t.name.toLowerCase() === clean.toLowerCase())) {
      throw new Error('Tên tổ đã tồn tại');
    }
    team.name = clean;
    setStore(KEYS.TEAMS, teams);
    return { ...team };
  }

  const { data, error } = await supabase.from('teams').update({ name: clean }).eq('id', id).select().single();
  if (error) {
    if (error.code === '23505') throw new Error('Tên tổ đã tồn tại');
    throw error;
  }
  return data;
}

// ==============================================================================
// ACCOUNT APIS
// Demo: lưu cục bộ (mật khẩu băm SHA-256 + salt). Supabase: gọi RPC security definer,
// việc băm (pgcrypto/bcrypt) diễn ra phía máy chủ.
// ==============================================================================

function safeAccount(a) {
  if (!a) return null;
  const { salt, password_hash, password, ...safe } = a;
  return { ...safe };
}

let seedingAccounts = null;

async function ensureAccountsSeeded() {
  const existing = getStore(KEYS.ACCOUNTS, null);
  if (Array.isArray(existing) && existing.length > 0) return;
  if (!seedingAccounts) {
    seedingAccounts = (async () => {
      const adminCreds = await hashPassword(DEFAULT_ADMIN.password);
      const leader1Creds = await hashPassword('123456');
      const leader2Creds = await hashPassword('123456');

      setStore(KEYS.ACCOUNTS, [
        {
          id: generateId(),
          username: DEFAULT_ADMIN.username,
          salt: adminCreds.salt,
          password_hash: adminCreds.hash,
          full_name: DEFAULT_ADMIN.full_name,
          role: 'admin',
          team_id: null,
          is_active: true,
          created_at: new Date().toISOString()
        },
        {
          id: generateId(),
          username: 'totruong1',
          salt: leader1Creds.salt,
          password_hash: leader1Creds.hash,
          full_name: 'Nguyễn Văn An (Tổ 1)',
          role: 'leader',
          team_id: 'a0000000-0000-0000-0000-000000000001',
          is_active: true,
          created_at: new Date().toISOString()
        },
        {
          id: generateId(),
          username: 'totruong2',
          salt: leader2Creds.salt,
          password_hash: leader2Creds.hash,
          full_name: 'Lê Văn Bình (Tổ 2)',
          role: 'leader',
          team_id: 'a0000000-0000-0000-0000-000000000002',
          is_active: true,
          created_at: new Date().toISOString()
        }
      ]);
    })().finally(() => {
      seedingAccounts = null;
    });
  }
  await seedingAccounts;
}

/**
 * Xoá toàn bộ tài khoản demo (sẽ tự tạo lại admin mặc định ở lần dùng kế tiếp)
 */
export function resetAccounts() {
  setStore(KEYS.ACCOUNTS, []);
}

function adminRpcArgs(admin) {
  return {
    p_admin_username: admin?.username || '',
    p_admin_password: admin?.password || ''
  };
}

async function callRpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    throw new Error(error.message || 'Lỗi máy chủ');
  }
  return data;
}

async function assertDemoAdmin(accounts, admin) {
  if (!admin) return null;
  const acting = accounts.find((a) => normalizeUsername(a.username) === normalizeUsername(admin.username));
  if (
    !acting ||
    acting.role !== 'admin' ||
    acting.is_active === false ||
    !(await verifyPassword(admin.password, acting.salt, acting.password_hash))
  ) {
    throw new Error('Chỉ tài khoản quản trị (nhập đúng mật khẩu) mới có quyền thực hiện');
  }
  return acting;
}

function firstError(errors) {
  return Object.values(errors)[0];
}

/**
 * Đăng nhập: trả về thông tin an toàn của tài khoản hoặc null nếu sai thông tin / bị khoá
 */
export async function authenticateAccount(username, password) {
  const uname = normalizeUsername(username);
  if (!uname || !password) return null;

  if (isDemoMode()) {
    await ensureAccountsSeeded();
    const acc = getStore(KEYS.ACCOUNTS, []).find((a) => normalizeUsername(a.username) === uname);
    if (!acc || acc.is_active === false) return null;
    if (!(await verifyPassword(password, acc.salt, acc.password_hash))) return null;
    return safeAccount(acc);
  }

  const data = await callRpc('app_login', { p_username: uname, p_password: password });
  return data || null;
}

/**
 * Danh sách tài khoản (không kèm mật khẩu/băm)
 * @param {{username: string, password: string}} [admin] bắt buộc ở chế độ Supabase
 */
export async function getAccounts(admin) {
  if (isDemoMode()) {
    await ensureAccountsSeeded();
    const accounts = getStore(KEYS.ACCOUNTS, []);
    await assertDemoAdmin(accounts, admin);
    return accounts.map(safeAccount);
  }
  const data = await callRpc('app_list_accounts', adminRpcArgs(admin));
  return data || [];
}

/**
 * Tạo tài khoản mới
 * @param {{username, password, full_name, role, team_id}} input
 */
export async function createAccount(input, admin) {
  if (isDemoMode()) {
    await ensureAccountsSeeded();
    const accounts = getStore(KEYS.ACCOUNTS, []);
    await assertDemoAdmin(accounts, admin);
    const v = validateNewAccount(input, accounts);
    if (!v.valid) throw new Error(firstError(v.errors));
    const { salt, hash } = await hashPassword(v.sanitized.password);
    const account = {
      id: generateId(),
      username: v.sanitized.username,
      salt,
      password_hash: hash,
      full_name: v.sanitized.full_name,
      role: v.sanitized.role,
      team_id: v.sanitized.team_id,
      is_active: true,
      created_at: new Date().toISOString()
    };
    setStore(KEYS.ACCOUNTS, [...accounts, account]);
    return safeAccount(account);
  }

  const v = validateNewAccount(input, []);
  if (!v.valid) throw new Error(firstError(v.errors));
  return callRpc('app_create_account', {
    ...adminRpcArgs(admin),
    p_username: v.sanitized.username,
    p_password: v.sanitized.password,
    p_full_name: v.sanitized.full_name,
    p_role: v.sanitized.role,
    p_team_id: v.sanitized.team_id
  });
}

/**
 * Cập nhật tài khoản: full_name, team_id, is_active, password (đặt lại mật khẩu)
 */
export async function updateAccount(id, updates = {}, admin) {
  if (updates.password !== undefined && updates.password !== '') {
    const pwError = validatePassword(updates.password);
    if (pwError) throw new Error(pwError);
  }

  if (isDemoMode()) {
    await ensureAccountsSeeded();
    const accounts = getStore(KEYS.ACCOUNTS, []);
    const acting = await assertDemoAdmin(accounts, admin);
    const target = accounts.find((a) => String(a.id) === String(id));
    if (!target) throw new Error('Không tìm thấy tài khoản');

    if (updates.is_active === false && target.is_active !== false) {
      const check = canToggleActive(accounts, target, acting);
      if (!check.ok) throw new Error(check.reason);
    }
    if (updates.full_name !== undefined) {
      const name = String(updates.full_name).trim();
      if (!name) throw new Error('Vui lòng nhập họ tên');
      target.full_name = name;
    }
    if (updates.team_id !== undefined && target.role === 'leader') {
      // Tổ không còn bắt buộc: cho phép để trống (null)
      target.team_id = updates.team_id || null;
    }
    if (updates.is_active !== undefined) target.is_active = Boolean(updates.is_active);
    if (updates.password) {
      const { salt, hash } = await hashPassword(updates.password);
      target.salt = salt;
      target.password_hash = hash;
    }
    setStore(KEYS.ACCOUNTS, accounts);
    return safeAccount(target);
  }

  return callRpc('app_update_account', {
    ...adminRpcArgs(admin),
    p_id: id,
    p_full_name: updates.full_name ?? null,
    p_team_id: updates.team_id ?? null,
    p_is_active: updates.is_active ?? null,
    p_password: updates.password || null
  });
}

/**
 * Xoá tài khoản (không xoá chính mình / quản trị cuối cùng)
 */
export async function deleteAccount(id, admin) {
  if (isDemoMode()) {
    await ensureAccountsSeeded();
    const accounts = getStore(KEYS.ACCOUNTS, []);
    const acting = await assertDemoAdmin(accounts, admin);
    const target = accounts.find((a) => String(a.id) === String(id));
    const check = canDeleteAccount(accounts, target, acting);
    if (!check.ok) throw new Error(check.reason);
    setStore(KEYS.ACCOUNTS, accounts.filter((a) => String(a.id) !== String(id)));
    return true;
  }
  await callRpc('app_delete_account', { ...adminRpcArgs(admin), p_id: id });
  return true;
}

/**
 * Người dùng tự đổi mật khẩu của mình
 */
export async function changeAccountPassword(username, oldPassword, newPassword) {
  const pwError = validatePassword(newPassword);
  if (pwError) throw new Error(pwError);

  if (isDemoMode()) {
    await ensureAccountsSeeded();
    const accounts = getStore(KEYS.ACCOUNTS, []);
    const acc = accounts.find((a) => normalizeUsername(a.username) === normalizeUsername(username));
    if (!acc || !(await verifyPassword(oldPassword, acc.salt, acc.password_hash))) {
      throw new Error('Mật khẩu hiện tại không đúng');
    }
    const { salt, hash } = await hashPassword(newPassword);
    acc.salt = salt;
    acc.password_hash = hash;
    setStore(KEYS.ACCOUNTS, accounts);
    return true;
  }

  await callRpc('app_change_password', {
    p_username: normalizeUsername(username),
    p_old_password: oldPassword,
    p_new_password: newPassword
  });
  return true;
}

// Fallback mock Supabase client for demo mode
function createMockSupabaseClient() {
  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      signInWithPassword: async () => ({ data: {}, error: new Error('Demo mode: Supabase URL not configured') }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    },
    from: () => ({
      select: () => Promise.resolve({ data: [], error: null }),
      insert: () => Promise.resolve({ data: [], error: null }),
      update: () => Promise.resolve({ data: [], error: null }),
      delete: () => Promise.resolve({ data: [], error: null })
    }),
    channel: () => ({
      on: () => ({
        subscribe: () => ({ unsubscribe: () => {} })
      })
    }),
    removeChannel: () => {}
  };
}

export const supabase = isDemoMode()
  ? createMockSupabaseClient()
  : createClient(supabaseUrl, supabaseAnonKey);

export default {
  supabase,
  isDemoMode,
  resetDemoData,
  initDemoData,
  getProducts,
  updateProductToggle,
  bulkUpdateProductToggle,
  upsertProducts,
  deleteProduct,
  getTeams,
  createTeam,
  updateTeam,
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  authenticateAccount,
  changeAccountPassword,
  resetAccounts,
  getEmployees,
  upsertEmployees,
  deleteEmployee,
  submitProductionLogs,
  getProductionLogs,
  updateProductionLog,
  deleteProductionLog,
  subscribeToLogs
};
