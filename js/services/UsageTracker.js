/**
 * @fileoverview Rastrea el uso diario de mensajes en el cliente (freemium).
 * Clave en localStorage: gm-ia-used-YYYY-MM-DD
 */

const KEY_PREFIX = 'gm-ia-used-';

function todayKey() {
  return KEY_PREFIX + new Date().toISOString().slice(0, 10);
}

export function getUsedToday() {
  try {
    const raw = localStorage.getItem(todayKey());
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

export function incrementUsedToday() {
  try {
    const key = todayKey();
    const n = getUsedToday() + 1;
    localStorage.setItem(key, String(n));
    return n;
  } catch {
    return 0;
  }
}
