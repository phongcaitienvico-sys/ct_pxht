import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEMO_PROFILES,
  resolveUserRole,
  resolveUserTeam,
  switchDemoRoleLogic,
  validateCredentials,
  loginLogic,
  saveAuthSession,
  loadAuthSession,
  clearAuthSession
} from '../src/contexts/authLogic.js';

console.log('Running tests/authContext.test.js...\n');

async function runTests() {
  const projectRoot = process.cwd();

  // ============================================================================
  // 1. Verify DEMO_PROFILES structure and requirements
  // ============================================================================
  console.log('Test Suite 1: DEMO_PROFILES verification');
  assert.ok(DEMO_PROFILES, 'DEMO_PROFILES must be defined');
  assert.ok(DEMO_PROFILES.admin, 'DEMO_PROFILES.admin must be defined');
  assert.strictEqual(DEMO_PROFILES.admin.id, 'admin-1');
  assert.strictEqual(DEMO_PROFILES.admin.email, 'quandoc@pxht.vn');
  assert.strictEqual(DEMO_PROFILES.admin.role, 'admin');
  assert.strictEqual(DEMO_PROFILES.admin.name, 'Quản Đốc Phân Xưởng');

  assert.ok(DEMO_PROFILES.leader1, 'DEMO_PROFILES.leader1 must be defined');
  assert.strictEqual(DEMO_PROFILES.leader1.id, 'leader-1');
  assert.strictEqual(DEMO_PROFILES.leader1.email, 'totruong1@pxht.vn');
  assert.strictEqual(DEMO_PROFILES.leader1.role, 'leader');
  assert.strictEqual(DEMO_PROFILES.leader1.name, 'Tổ Trưởng 1 (Nguyễn Văn A)');
  assert.strictEqual(DEMO_PROFILES.leader1.teamId, 'team-1');
  assert.strictEqual(DEMO_PROFILES.leader1.teamName, 'Tổ 1 - Cơ khí & Đúc');

  assert.ok(DEMO_PROFILES.leader2, 'DEMO_PROFILES.leader2 must be defined');
  assert.strictEqual(DEMO_PROFILES.leader2.id, 'leader-2');
  assert.strictEqual(DEMO_PROFILES.leader2.email, 'totruong2@pxht.vn');
  assert.strictEqual(DEMO_PROFILES.leader2.role, 'leader');
  assert.strictEqual(DEMO_PROFILES.leader2.name, 'Tổ Trưởng 2 (Lê Văn B)');
  assert.strictEqual(DEMO_PROFILES.leader2.teamId, 'team-2');
  assert.strictEqual(DEMO_PROFILES.leader2.teamName, 'Tổ 2 - Gia công & Lắp ráp');
  console.log('✔ DEMO_PROFILES structure matches specification');

  // ============================================================================
  // 2. Role and Team Resolution Logic (Preserving Team ID for Leaders)
  // ============================================================================
  console.log('\nTest Suite 2: Role & Team resolution');
  assert.strictEqual(resolveUserRole(DEMO_PROFILES.admin), 'admin');
  assert.strictEqual(resolveUserTeam(DEMO_PROFILES.admin), null);

  assert.strictEqual(resolveUserRole(DEMO_PROFILES.leader1), 'leader');
  const team1 = resolveUserTeam(DEMO_PROFILES.leader1);
  assert.deepStrictEqual(team1, { id: 'team-1', name: 'Tổ 1 - Cơ khí & Đúc' });

  assert.strictEqual(resolveUserRole(DEMO_PROFILES.leader2), 'leader');
  const team2 = resolveUserTeam(DEMO_PROFILES.leader2);
  assert.deepStrictEqual(team2, { id: 'team-2', name: 'Tổ 2 - Gia công & Lắp ráp' });

  assert.strictEqual(resolveUserRole(null), null);
  assert.strictEqual(resolveUserTeam(null), null);
  console.log('✔ Role and team resolution preserves teamId for leaders');

  // ============================================================================
  // 3. switchDemoRole Logic
  // ============================================================================
  console.log('\nTest Suite 3: switchDemoRole logic');
  const switchedAdmin = switchDemoRoleLogic('admin');
  assert.strictEqual(switchedAdmin.user.email, 'quandoc@pxht.vn');
  assert.strictEqual(switchedAdmin.role, 'admin');
  assert.strictEqual(switchedAdmin.currentTeam, null);

  const switchedLeader1 = switchDemoRoleLogic('leader1');
  assert.strictEqual(switchedLeader1.user.email, 'totruong1@pxht.vn');
  assert.strictEqual(switchedLeader1.role, 'leader');
  assert.deepStrictEqual(switchedLeader1.currentTeam, { id: 'team-1', name: 'Tổ 1 - Cơ khí & Đúc' });

  const switchedLeader2 = switchDemoRoleLogic('leader2');
  assert.strictEqual(switchedLeader2.user.email, 'totruong2@pxht.vn');
  assert.strictEqual(switchedLeader2.role, 'leader');
  assert.deepStrictEqual(switchedLeader2.currentTeam, { id: 'team-2', name: 'Tổ 2 - Gia công & Lắp ráp' });

  assert.throws(
    () => switchDemoRoleLogic('invalid-key'),
    /Invalid demo role key/i,
    'Should throw error on invalid demo key'
  );
  console.log('✔ switchDemoRole logic operates correctly');

  // ============================================================================
  // 4. Credential Validation & Demo Login
  // ============================================================================
  console.log('\nTest Suite 4: Credential validation & login logic');
  const emptyCheck = validateCredentials('', '');
  assert.strictEqual(emptyCheck.valid, false);
  assert.ok(emptyCheck.error.includes('email'));

  const badEmailCheck = validateCredentials('not-an-email', '123456');
  assert.strictEqual(badEmailCheck.valid, false);

  const validCheck = validateCredentials('quandoc@pxht.vn', '123456');
  assert.strictEqual(validCheck.valid, true);

  // Login demo profiles
  const adminLoginResult = await loginLogic('quandoc@pxht.vn', '123456');
  assert.strictEqual(adminLoginResult.success, true);
  assert.strictEqual(adminLoginResult.user.role, 'admin');

  const leaderLoginResult = await loginLogic('totruong1@pxht.vn', '123456');
  assert.strictEqual(leaderLoginResult.success, true);
  assert.strictEqual(leaderLoginResult.user.role, 'leader');
  assert.strictEqual(leaderLoginResult.user.teamId, 'team-1');

  const failLoginResult = await loginLogic('nonexistent@pxht.vn', 'password');
  assert.strictEqual(failLoginResult.success, false);
  assert.ok(failLoginResult.error);
  console.log('✔ Credential validation and login logic passed');

  // ============================================================================
  // 5. Session Storage & Persistence
  // ============================================================================
  console.log('\nTest Suite 5: Session persistence');
  clearAuthSession();
  const defaultSession = loadAuthSession();
  assert.ok(defaultSession.currentUser, 'Default session should fallback to demo admin');
  assert.strictEqual(defaultSession.role, 'admin');

  saveAuthSession(DEMO_PROFILES.leader1);
  const loadedSession = loadAuthSession();
  assert.strictEqual(loadedSession.currentUser.id, 'leader-1');
  assert.strictEqual(loadedSession.role, 'leader');
  assert.deepStrictEqual(loadedSession.currentTeam, { id: 'team-1', name: 'Tổ 1 - Cơ khí & Đúc' });

  clearAuthSession();
  console.log('✔ Session persistence logic passed');

  // ============================================================================
  // 6. Source Files & Component Integrity Verification
  // ============================================================================
  console.log('\nTest Suite 6: Source files and Component verification');
  const authContextPath = path.join(projectRoot, 'src/contexts/AuthContext.jsx');
  assert.ok(fs.existsSync(authContextPath), 'src/contexts/AuthContext.jsx must exist');
  const authContextContent = fs.readFileSync(authContextPath, 'utf8');

  assert.ok(
    authContextContent.includes('createContext') && authContextContent.includes('useContext'),
    'AuthContext.jsx must use React createContext and useContext'
  );
  assert.ok(
    authContextContent.includes('export function AuthProvider') ||
    authContextContent.includes('export const AuthProvider'),
    'AuthContext.jsx must export AuthProvider'
  );
  assert.ok(
    authContextContent.includes('export function useAuth') ||
    authContextContent.includes('export const useAuth'),
    'AuthContext.jsx must export useAuth'
  );
  assert.ok(
    authContextContent.includes('switchDemoRole'),
    'AuthContext.jsx must provide switchDemoRole'
  );

  const loginModalPath = path.join(projectRoot, 'src/components/LoginModal.jsx');
  assert.ok(fs.existsSync(loginModalPath), 'src/components/LoginModal.jsx must exist');
  const loginModalContent = fs.readFileSync(loginModalPath, 'utf8');

  assert.ok(
    loginModalContent.includes('export default function LoginModal') ||
    loginModalContent.includes('export function LoginModal'),
    'LoginModal.jsx must export LoginModal component'
  );
  assert.ok(
    loginModalContent.includes('Quản Đốc') || loginModalContent.includes('quandoc'),
    'LoginModal.jsx must include Quản Đốc quick login'
  );
  assert.ok(
    loginModalContent.includes('Tổ Trưởng 1') || loginModalContent.includes('leader1'),
    'LoginModal.jsx must include Tổ Trưởng 1 quick login'
  );
  assert.ok(
    loginModalContent.includes('Tổ Trưởng 2') || loginModalContent.includes('leader2'),
    'LoginModal.jsx must include Tổ Trưởng 2 quick login'
  );
  console.log('✔ Source files and component integrity verified');

  console.log('\n🎉 ALL AUTH CONTEXT TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('\n❌ Test failed with error:');
  console.error(err);
  process.exit(1);
});
