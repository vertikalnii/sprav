// =============================================================================
// Режимы доступа: Просмотрщик (гость) / Администратор
// Пароль администратора хранится в localStorage (однократная настройка).
// По умолчанию: admin123 — смените при первом входе в режиме Администратора.
// =============================================================================

export type Role = 'viewer' | 'admin';

const PASS_KEY = 'spravochnik_admin_pass';
const ROLE_KEY = 'spravochnik_role';
export const DEFAULT_PASSWORD = 'admin123';

function hashPass(pass: string): string {
  // Простое нешифрование достаточно для локального сетевого инструмента;
  // при необходимости замените на Web Crypto SHA-256.
  let h = 5381;
  for (let i = 0; i < pass.length; i++) {
    h = ((h << 5) + h + pass.charCodeAt(i)) >>> 0;
  }
  return 'djb2:' + h.toString(16);
}

export function isPasswordConfigured(): boolean {
  return !!localStorage.getItem(PASS_KEY);
}

export function checkPassword(pass: string): boolean {
  const stored = localStorage.getItem(PASS_KEY);
  if (!stored) return pass === DEFAULT_PASSWORD;
  return stored === hashPass(pass);
}

export function setPassword(pass: string): void {
  localStorage.setItem(PASS_KEY, hashPass(pass));
}

export function loadRole(): Role {
  return localStorage.getItem(ROLE_KEY) === 'admin' ? 'admin' : 'viewer';
}

export function saveRole(role: Role): void {
  localStorage.setItem(ROLE_KEY, role);
}
