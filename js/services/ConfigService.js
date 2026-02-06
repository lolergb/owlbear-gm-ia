/**
 * @fileoverview Servicio de configuración del plugin GM IA.
 * Persiste en localStorage: URL base del API y token Patreon.
 */

const STORAGE_KEY_PREFIX = 'gm-ia-';
const KEY_API_BASE = STORAGE_KEY_PREFIX + 'api-base-url';
const KEY_PATREON_TOKEN = STORAGE_KEY_PREFIX + 'patreon-token';

export class ConfigService {
  constructor() {
    this._apiBaseUrl = null;
    this._patreonToken = null;
    this._load();
  }

  _load() {
    try {
      this._apiBaseUrl = localStorage.getItem(KEY_API_BASE) || '';
      this._patreonToken = localStorage.getItem(KEY_PATREON_TOKEN) || '';
    } catch (e) {
      console.warn('[GM IA] ConfigService: error loading config', e);
    }
  }

  getApiBaseUrl() {
    return this._apiBaseUrl || '';
  }

  setApiBaseUrl(url) {
    this._apiBaseUrl = (url || '').trim().replace(/\/+$/, '');
    try {
      if (this._apiBaseUrl) localStorage.setItem(KEY_API_BASE, this._apiBaseUrl);
      else localStorage.removeItem(KEY_API_BASE);
    } catch (e) {
      console.warn('[GM IA] ConfigService: error saving api base', e);
    }
  }

  getPatreonToken() {
    return this._patreonToken || '';
  }

  setPatreonToken(token) {
    this._patreonToken = (token || '').trim();
    try {
      if (this._patreonToken) localStorage.setItem(KEY_PATREON_TOKEN, this._patreonToken);
      else localStorage.removeItem(KEY_PATREON_TOKEN);
    } catch (e) {
      console.warn('[GM IA] ConfigService: error saving patreon token', e);
    }
  }

  hasValidApiBase() {
    const base = this.getApiBaseUrl();
    return base.length > 0 && (base.startsWith('http://') || base.startsWith('https://'));
  }
}
