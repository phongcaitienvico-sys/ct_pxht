import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEMO_TEAM_MAP,
  resolveEffectiveTeamId,
  resolveUserRole,
  resolveUserTeam,
  validateCredentials,
  loginLogic,
  saveAuthSession,
  loadAuthSession,
  clearAuthSession,
  getStoredUser,
  AUTH_STORAGE_KEY
} from '../src/contexts/authLogic.js';

console.log('Running tests/authContext.test.js...\n');

async function runTests() {
  const projectRoot = process.cwd();

  const adminUser = { id: 'a1', username: 'admin', name: 'Quản Trị Viên', role: 'admin', teamId: null };
  const leaderUser = {
    id: 'l1',
    username: 'to1',
    name: 'Nguyễn Văn A',
    role: 'leader',
    teamId: 'a0000000-0000-0000-0000-000000000001',
    teamName: 'Tổ 1 - Cơ khí & Đúc'
  };

  console.log('Test Suite 1: Role & Team resolution');
  assert.strictEqual(resolveUserRole(adminUser), 'admin');
  assert.strictEqual(resolveUserTeam(adminUser), null);
  assert.strictEqual(resolveUserRole(leaderUser), 'leader');
  assert.deepStrictEqual(resolveUserTeam(leaderUser), {
    id: 'a0000000-0000-0000-0000-000000000001',
    name: 'Tổ 1 - Cơ khí & Đúc'
  });
  assert.strictEqual(resolveUserRole(null), null);
  assert.strictEqual(resolveUserTeam(null), null);
  console.log('✔ Role and team resolution preserves teamId for leaders');

  console.log('\nTest Suite 2: DEMO_TEAM_MAP compatibility');
  assert.strictEqual(DEMO_TEAM_MAP['team-1'], 'a0000000-0000-0000-0000-000000000001');
  assert.strictEqual(DEMO_TEAM_MAP['team-2'], 'a0000000-0000-0000-0000-000000000002');
  assert.strictEqual(resolveEffectiveTeamId('team-2'), 'a0000000-0000-0000-0000-000000000002');
  assert.strictEqual(resolveEffectiveTeamId('some-real-uuid'), 'some-real-uuid');
  assert.strictEqual(resolveEffectiveTeamId(null), null);
  console.log('✔ Team id mapping resolves correctly');

  console.log('\nTest Suite 3: Credential validation (username based)');
  const emptyCheck = validateCredentials('', '');
  assert.strictEqual(emptyCheck.valid, false);
  assert.ok(emptyCheck.error.includes('tên đăng nhập'));
  assert.strictEqual(validateCredentials('admin', '').valid, false);
  assert.strictEqual(validateCredentials('admin', 'admin123').valid, true);
  const failLogin = await loginLogic('khongtontai', 'password');
  assert.strictEqual(failLogin.success, false);
  assert.ok(failLogin.error);
  console.log('✔ Credential validation passed');

  console.log('\nTest Suite 4: Session persistence (no auto-login)');
  clearAuthSession();
  const empty = loadAuthSession();
  assert.strictEqual(empty.currentUser, null, 'No session means no user (login screen shown)');
  assert.strictEqual(empty.role, null);

  saveAuthSession({ ...leaderUser, password_hash: 'x', salt: 'y' });
  const stored = getStoredUser();
  assert.strictEqual(stored.password_hash, undefined, 'hash is never persisted in session');
  assert.strictEqual(stored.salt, undefined);
  const loaded = loadAuthSession();
  assert.strictEqual(loaded.currentUser.id, 'l1');
  assert.strictEqual(loaded.role, 'leader');
  assert.strictEqual(loaded.currentTeam.id, leaderUser.teamId);
  assert.strictEqual(AUTH_STORAGE_KEY, 'pxht_session');
  clearAuthSession();
  assert.strictEqual(loadAuthSession().currentUser, null);
  console.log('✔ Session persistence logic passed');

  console.log('\nTest Suite 5: Source files and Component verification');
  const read = (p) => fs.readFileSync(path.join(projectRoot, p), 'utf8');
  const authContextContent = read('src/contexts/AuthContext.jsx');
  assert.ok(authContextContent.includes('createContext') && authContextContent.includes('useContext'));
  assert.ok(authContextContent.includes('export function AuthProvider'));
  assert.ok(authContextContent.includes('export function useAuth'));
  assert.ok(authContextContent.includes('changeMyPassword'), 'AuthContext must provide changeMyPassword');
  assert.ok(authContextContent.includes('logout') && authContextContent.includes('login'));
  assert.ok(!authContextContent.includes('switchDemoRole'), 'demo role switch removed');

  const loginModalContent = read('src/components/LoginModal.jsx');
  assert.ok(loginModalContent.includes('export default function LoginModal'));
  assert.ok(!loginModalContent.includes('switchDemoRole'), 'No quick demo login');
  assert.ok(!loginModalContent.includes('quandoc') && !loginModalContent.includes('leader1'));
  assert.ok(loginModalContent.includes('Tên đăng nhập'), 'Login uses username');
  assert.ok(loginModalContent.includes('type={showPassword'), 'Show/hide password toggle');

  const appContent = read('src/App.jsx');
  assert.ok(appContent.includes('LoginScreen') || appContent.includes('LoginModal'));
  assert.ok(!appContent.includes('DEMO_PROFILES'));
  console.log('✔ Source files and component integrity verified');

  console.log('\n🎉 ALL AUTH CONTEXT TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('\n❌ Test failed with error:');
  console.error(err);
  process.exit(1);
});
