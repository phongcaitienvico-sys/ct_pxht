/**
 * Băm mật khẩu bằng SHA-256 + salt ngẫu nhiên riêng cho từng tài khoản (Web Crypto).
 * Chạy được trên trình duyệt và Node >= 20 (globalThis.crypto).
 */

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function randomSalt(bytes = 16) {
  const arr = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(arr);
  return toHex(arr);
}

/**
 * @param {string} password
 * @param {string} [salt] nếu bỏ trống sẽ sinh salt ngẫu nhiên
 * @returns {Promise<{salt: string, hash: string}>}
 */
export async function hashPassword(password, salt) {
  const useSalt = salt || randomSalt();
  const data = new TextEncoder().encode(`${useSalt}:${String(password)}`);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return { salt: useSalt, hash: toHex(digest) };
}

/**
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, salt, hash) {
  if (!salt || !hash) return false;
  const { hash: computed } = await hashPassword(password, salt);
  if (computed.length !== String(hash).length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ String(hash).charCodeAt(i);
  }
  return diff === 0;
}
