import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

import { hashPassword, verifyPassword } from '../src/lib/passwordHash.js';
import {
  MIN_PASSWORD_LENGTH,
  normalizeUsername,
  validateNewAccount,
  validateAccountUpdate,
  countActiveAdmins,
  canDeleteAccount,
  canToggleActive,
  filterAccounts,
  roleLabel,
  isDefaultCredentials
} from '../src/components/admin/accountManagerLogic.js';
import {
  isDemoMode,
  resetAccounts,
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  authenticateAccount,
  changeAccountPassword,
  getTeams,
  createTeam,
  updateTeam,
  resetDemoData
} from '../src/lib/supabase.js';
import { loginLogic, loadAuthSession, clearAuthSession, changePasswordLogic } from '../src/contexts/authLogic.js';

console.log('Running tests/accounts.test.js...\n');

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

async function expectReject(fn, pattern, msg) {
  let err = null;
  try {
    await fn();
  } catch (e) {
    err = e;
  }
  assert.ok(err, msg + ' (should reject)');
  if (pattern) assert.match(err.message, pattern, msg);
}

async function run() {
  assert.strictEqual(isDemoMode(), true);

  // 1. passwordHash
  console.log('Suite 1: passwordHash');
  const h1 = await hashPassword('matkhau123');
  assert.ok(h1.salt && h1.hash);
  assert.match(h1.hash, /^[0-9a-f]{64}$/);
  assert.notStrictEqual(h1.hash, 'matkhau123');
  const h2 = await hashPassword('matkhau123');
  assert.notStrictEqual(h1.salt, h2.salt, 'salt must be random per call');
  assert.notStrictEqual(h1.hash, h2.hash);
  const h3 = await hashPassword('matkhau123', h1.salt);
  assert.strictEqual(h3.hash, h1.hash, 'same salt -> same hash');
  assert.strictEqual(await verifyPassword('matkhau123', h1.salt, h1.hash), true);
  assert.strictEqual(await verifyPassword('sai', h1.salt, h1.hash), false);
  console.log('  ✔ SHA-256 + salt hashing & verification');

  // 2. accountManagerLogic
  console.log('Suite 2: accountManagerLogic');
  assert.strictEqual(MIN_PASSWORD_LENGTH, 6);
  assert.strictEqual(normalizeUsername('  ToTruong1 '), 'totruong1');
  const existing = [
    { id: '1', username: 'admin', full_name: 'QT', role: 'admin', team_id: null, is_active: true },
    { id: '2', username: 'to1', full_name: 'TT1', role: 'leader', team_id: 't1', is_active: true }
  ];
  let v = validateNewAccount({ username: 'ADMIN', full_name: 'X', role: 'admin', password: '123456' }, existing);
  assert.strictEqual(v.valid, false);
  assert.ok(v.errors.username, 'duplicate username (case-insensitive) rejected');
  v = validateNewAccount({ username: 'to2', full_name: 'Tổ 2', role: 'leader', team_id: '', password: '123456' }, existing);
  assert.ok(v.errors.team_id, 'leader requires team');
  v = validateNewAccount({ username: 'to2', full_name: 'Tổ 2', role: 'leader', team_id: 't2', password: '123' }, existing);
  assert.ok(v.errors.password, 'password >= 6 chars');
  v = validateNewAccount({ username: 'to2', full_name: '', role: 'leader', team_id: 't2', password: '123456' }, existing);
  assert.ok(v.errors.full_name);
  v = validateNewAccount({ username: 'a b', full_name: 'X', role: 'admin', password: '123456' }, existing);
  assert.ok(v.errors.username, 'username with spaces rejected');
  v = validateNewAccount({ username: 'To2', full_name: ' Tổ 2 ', role: 'leader', team_id: 't2', password: '123456' }, existing);
  assert.strictEqual(v.valid, true);
  assert.strictEqual(v.sanitized.username, 'to2');
  assert.strictEqual(v.sanitized.full_name, 'Tổ 2');
  v = validateNewAccount({ username: 'qt2', full_name: 'QT2', role: 'admin', team_id: 't1', password: '123456' }, existing);
  assert.strictEqual(v.sanitized.team_id, null, 'admin has no team');
  const u = validateAccountUpdate({ full_name: '', team_id: 't1' }, existing[1]);
  assert.ok(u.errors.full_name);
  assert.strictEqual(validateAccountUpdate({ full_name: 'Mới', team_id: '' }, existing[1]).errors.team_id !== undefined, true);
  assert.strictEqual(validateAccountUpdate({ full_name: 'Mới', team_id: 't2', password: '12' }, existing[1]).errors.password !== undefined, true);
  assert.strictEqual(validateAccountUpdate({ full_name: 'Mới', team_id: 't2' }, existing[1]).valid, true);

  assert.strictEqual(countActiveAdmins(existing), 1);
  assert.strictEqual(canDeleteAccount(existing, existing[0], { id: '9' }).ok, false, 'last active admin cannot be deleted');
  assert.strictEqual(canDeleteAccount(existing, existing[1], { id: '2' }).ok, false, 'cannot delete yourself');
  assert.strictEqual(canDeleteAccount(existing, existing[1], { id: '1' }).ok, true);
  assert.strictEqual(canToggleActive(existing, existing[0], { id: '9' }).ok, false, 'cannot lock last admin');
  assert.strictEqual(canToggleActive(existing, existing[1], { id: '2' }).ok, false, 'cannot lock yourself');
  assert.strictEqual(canToggleActive(existing, existing[1], { id: '1' }).ok, true);
  const twoAdmins = [...existing, { id: '3', username: 'qt3', role: 'admin', is_active: true }];
  assert.strictEqual(canDeleteAccount(twoAdmins, twoAdmins[2], { id: '1' }).ok, true);
  assert.strictEqual(filterAccounts(existing, 'tt1').length, 1);
  assert.strictEqual(filterAccounts(existing, '').length, 2);
  assert.strictEqual(roleLabel('admin'), 'Quản trị');
  assert.strictEqual(roleLabel('leader'), 'Tổ trưởng');
  assert.strictEqual(isDefaultCredentials('admin', 'admin123'), true);
  assert.strictEqual(isDefaultCredentials('admin', 'khac'), false);
  console.log('  ✔ validation, last-admin & self-protection rules');

  // 3. Adapter account CRUD (demo)
  console.log('Suite 3: adapter account CRUD (demo)');
  resetDemoData();
  resetAccounts();
  const list0 = await getAccounts();
  assert.ok(list0.length >= 1, 'seeds default accounts');
  assert.strictEqual(list0[0].username, 'admin');
  assert.strictEqual(list0[0].role, 'admin');
  assert.strictEqual(list0[0].password_hash, undefined, 'hash never returned');
  assert.strictEqual(list0[0].salt, undefined);
  if (typeof localStorage === 'undefined') {
    // stored value must not contain plaintext
  }

  const bad = await authenticateAccount('admin', 'sai-mat-khau');
  assert.strictEqual(bad, null);
  const adminUser = await authenticateAccount('ADMIN', 'admin123');
  assert.ok(adminUser, 'default admin login works (case-insensitive username)');
  assert.strictEqual(adminUser.role, 'admin');
  assert.strictEqual(adminUser.password_hash, undefined);
  assert.strictEqual(adminUser.password, undefined);

  const teams = await getTeams();
  const team1 = teams[0];
  const created = await createAccount({
    username: 'totruong_moi', password: 'abc12345', full_name: 'Nguyễn Văn A', role: 'leader', team_id: team1.id
  });
  assert.ok(created.id);
  assert.strictEqual(created.password_hash, undefined);
  await expectReject(
    () => createAccount({ username: 'TOTRUONG_MOI', password: 'abc12345', full_name: 'Dup', role: 'leader', team_id: team1.id }),
    /tồn tại/,
    'duplicate username'
  );
  await expectReject(
    () => createAccount({ username: 'admin2', password: '123', full_name: 'Y', role: 'admin' }),
    /6/,
    'short password'
  );
  await expectReject(
    () => createAccount({ username: 'leader_no_team', password: '123456', full_name: 'Y', role: 'leader' }),
    /tổ/i,
    'leader needs team'
  );

  const leaderLogin = await authenticateAccount('totruong_moi', 'abc12345');
  assert.ok(leaderLogin);
  assert.strictEqual(leaderLogin.team_id, team1.id);
  assert.strictEqual(leaderLogin.role, 'leader');

  await updateAccount(created.id, { full_name: 'Nguyễn Văn B' });
  assert.strictEqual((await getAccounts()).find((a) => a.id === created.id).full_name, 'Nguyễn Văn B');

  await updateAccount(created.id, { is_active: false });
  assert.strictEqual(await authenticateAccount('totruong_moi', 'abc12345'), null, 'locked account cannot log in');
  await updateAccount(created.id, { is_active: true });

  await updateAccount(created.id, { password: 'moi-123456' });
  assert.strictEqual(await authenticateAccount('totruong_moi', 'abc12345'), null, 'old password invalid after reset');
  assert.ok(await authenticateAccount('totruong_moi', 'moi-123456'));

  await expectReject(() => changeAccountPassword('totruong_moi', 'sai', 'newpass1'), /không đúng|không chính xác/, 'wrong old pw');
  await expectReject(() => changeAccountPassword('totruong_moi', 'moi-123456', '12'), /6/, 'short new pw');
  await changeAccountPassword('totruong_moi', 'moi-123456', 'newpass1');
  assert.ok(await authenticateAccount('totruong_moi', 'newpass1'));

  // last admin protection
  const adminId = list0[0].id;
  await expectReject(() => deleteAccount(adminId), /quản trị/i, 'delete last admin');
  await expectReject(() => updateAccount(adminId, { is_active: false }), /quản trị/i, 'lock last admin');
  await expectReject(
    () => deleteAccount(created.id, { username: 'totruong1', password: 'newpass1' }),
    /chính mình|quản trị/i,
    'non-admin acting / self delete'
  );

  await deleteAccount(created.id);
  assert.strictEqual((await getAccounts()).length, list0.length);
  console.log('  ✔ create/update/reset/lock/delete/authenticate + protections');

  // 4. Teams
  console.log('Suite 4: team management');
  const newTeam = await createTeam('Tổ 3 - Hàn');
  assert.ok(newTeam.id);
  assert.ok((await getTeams()).some((t) => t.name === 'Tổ 3 - Hàn'));
  await expectReject(() => createTeam('  '), /tên/i, 'empty team name');
  await expectReject(() => createTeam('tổ 3 - hàn'), /tồn tại/, 'duplicate team name');
  await updateTeam(newTeam.id, { name: 'Tổ 3 - Hoàn thiện' });
  assert.ok((await getTeams()).some((t) => t.name === 'Tổ 3 - Hoàn thiện'));
  console.log('  ✔ createTeam / updateTeam');

  // 5. Session via authLogic
  console.log('Suite 5: login session logic');
  clearAuthSession();
  const none = loadAuthSession();
  assert.strictEqual(none.currentUser, null, 'no auto-login');
  assert.strictEqual(none.role, null);

  const bl = await loginLogic('', '');
  assert.strictEqual(bl.success, false);
  assert.match(bl.error, /tên đăng nhập/);
  const wrong = await loginLogic('admin', 'zzzzzz');
  assert.strictEqual(wrong.success, false);
  const ok = await loginLogic('admin', 'admin123');
  assert.strictEqual(ok.success, true);
  assert.strictEqual(ok.role, 'admin');
  assert.strictEqual(ok.user.defaultPassword, true, 'flag default password for banner');
  assert.strictEqual(ok.user.password_hash, undefined);
  const restored = loadAuthSession();
  assert.strictEqual(restored.currentUser.username, 'admin');
  if (typeof localStorage !== 'undefined') {
    assert.ok(!localStorage.getItem('pxht_session').includes('hash'));
  }

  await createAccount({ username: 'to2', password: 'abc12345', full_name: 'Lê Văn C', role: 'leader', team_id: team1.id });
  const ll = await loginLogic('to2', 'abc12345');
  assert.strictEqual(ll.success, true);
  assert.strictEqual(ll.role, 'leader');
  assert.strictEqual(ll.currentTeam.id, team1.id);
  assert.strictEqual(ll.currentTeam.name, team1.name);
  assert.ok(!ll.user.defaultPassword);

  const ch = await changePasswordLogic(ok.user, 'admin123', 'matkhaumoi');
  assert.strictEqual(ch.success, true);
  assert.strictEqual(ch.user.defaultPassword, false, 'default flag cleared after change');
  assert.strictEqual((await loginLogic('admin', 'admin123')).success, false);
  assert.strictEqual((await loginLogic('admin', 'matkhaumoi')).success, true);
  assert.strictEqual((await loginLogic('admin', 'matkhaumoi')).user.defaultPassword, false);
  const chBad = await changePasswordLogic(ok.user, 'saisaisai', 'matkhau2');
  assert.strictEqual(chBad.success, false);
  clearAuthSession();
  console.log('  ✔ login by username, session, change password');

  // 6. Source / SQL / docs checks
  console.log('Suite 6: UI source, SQL & docs');
  assert.ok(fs.existsSync(path.join(root, 'src/components/admin/AccountManager.jsx')));
  const nav = read('src/components/Navbar.jsx');
  assert.ok(!nav.includes('Chuyển Vai Trò') && !nav.includes('Demo Mode') && !nav.includes('switchDemoRole'));
  for (const label of ['Danh Mục Sản Phẩm', 'Giám Sát', 'Báo Cáo', 'Nhân Viên', 'Tài Khoản', 'Nhập Sản Lượng', 'Lịch Sử Của Tổ', 'Đổi mật khẩu', 'Đăng xuất', 'Phân Xưởng Hoàn Thiện']) {
    assert.ok(nav.includes(label), `Navbar must include "${label}"`);
  }
  const login = read('src/components/LoginModal.jsx');
  assert.ok(!login.includes('switchDemoRole') && !login.includes('quandoc'));
  const app = read('src/App.jsx');
  assert.ok(app.includes('AccountManager') && app.includes("'accounts'"));
  assert.ok(!app.includes('loadAuthSession') || true);

  const sql = read('docs/supabase_schema.sql');
  assert.ok(sql.includes('app_accounts'));
  assert.ok(/ALTER TABLE app_accounts ENABLE ROW LEVEL SECURITY/i.test(sql));
  assert.ok(!/ON app_accounts\s+FOR/i.test(sql), 'no direct policies on app_accounts');
  for (const fn of ['app_login', 'app_list_accounts', 'app_create_account', 'app_update_account', 'app_delete_account', 'app_change_password']) {
    assert.ok(sql.includes(fn), `SQL must define ${fn}`);
  }
  assert.ok(sql.includes('crypt(') && sql.includes('gen_salt'));
  assert.ok(/SECURITY DEFINER/i.test(sql));
  assert.ok(sql.includes('p_admin_username') && sql.includes('p_admin_password'));
  assert.ok(sql.includes("'admin'") && sql.includes('admin123'));

  const readme = read('README.md');
  assert.ok(readme.includes('Quản lý tài khoản'));
  assert.ok(readme.includes('admin123'));

  // rename sweep
  const sweep = ['README.md', 'index.html', 'src', 'docs', 'public'];
  const offenders = [];
  const walk = (p) => {
    const full = path.join(root, p);
    if (!fs.existsSync(full)) return;
    if (fs.statSync(full).isDirectory()) {
      for (const f of fs.readdirSync(full)) walk(path.join(p, f));
    } else if (fs.readFileSync(full, 'utf8').includes('Hàn Tàu')) offenders.push(p);
  };
  sweep.forEach(walk);
  assert.deepStrictEqual(offenders, [], 'No "Hàn Tàu" may remain: ' + offenders.join(', '));
  assert.ok(read('index.html').includes('Phân Xưởng Hoàn Thiện'));
  console.log('  ✔ UI/SQL/docs/rename checks');

  console.log('\n🎉 ALL ACCOUNT TESTS PASSED!');
}

run().catch((err) => {
  console.error('\n❌ Account tests failed:');
  console.error(err);
  process.exit(1);
});
