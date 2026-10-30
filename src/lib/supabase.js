import { createClient } from '@supabase/supabase-js';
import { seedProducts, seedTeams, seedEmployees, seedLogs } from '../data/seedData.js';

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
  LOGS: 'pxht_production_logs'
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
  setStore(KEYS.LOGS, seedLogs);
  return {
    products: seedProducts,
    teams: seedTeams,
    employees: seedEmployees,
    logs: seedLogs
  };
}

/**
 * Ensure demo store is initialized with seed data if empty
 */
export async function initDemoData() {
  const existingProducts = getStore(KEYS.PRODUCTS, null);
  if (!existingProducts || !Array.isArray(existingProducts) || existingProducts.length === 0) {
    await resetDemoData();
  }
}

async function ensureDemoInitialized() {
  const existingProducts = getStore(KEYS.PRODUCTS, null);
  if (!existingProducts || !Array.isArray(existingProducts) || existingProducts.length === 0) {
    await resetDemoData();
  }
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
    return getStore(KEYS.PRODUCTS, []);
  }

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error('getProducts error:', error);
    throw error;
  }
  return data;
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

  const { data, error } = await supabase
    .from('products')
    .upsert(productsArray, { onConflict: 'id' })
    .select();

  if (error) {
    console.error('upsertProducts error:', error);
    throw error;
  }
  return data;
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

  const formatted = logsArray.map((item) => ({
    ...item,
    log_date: item.log_date || today,
    quantity: Number(item.quantity) || 0,
    duration_hours: Number(item.duration_hours) || 0,
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
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getProductionLogs error:', error);
    throw error;
  }
  return data;
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

  const { data, error } = await supabase
    .from('production_logs')
    .update(updates)
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
  getEmployees,
  upsertEmployees,
  deleteEmployee,
  submitProductionLogs,
  getProductionLogs,
  updateProductionLog,
  deleteProductionLog,
  subscribeToLogs
};
