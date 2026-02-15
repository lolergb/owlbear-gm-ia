/**
 * @fileoverview Servicio de configuración del plugin GM IA.
 * Persiste en localStorage: URL base del API y token Patreon.
 */

const STORAGE_KEY_PREFIX = 'gm-ia-';
const KEY_API_BASE = STORAGE_KEY_PREFIX + 'api-base-url';
const KEY_PATREON_TOKEN = STORAGE_KEY_PREFIX + 'patreon-token';
const KEY_DOCUMENT_URLS = STORAGE_KEY_PREFIX + 'document-urls';
const KEY_AI_MODEL = STORAGE_KEY_PREFIX + 'ai-model';
const KEY_USE_VAULT = STORAGE_KEY_PREFIX + 'use-vault';
const KEY_OPENAI_API_KEY = STORAGE_KEY_PREFIX + 'openai-api-key';

export class ConfigService {
  constructor() {
    this._apiBaseUrl = null;
    this._patreonToken = null;
    this._documentUrls = null;
    this._aiModel = null;
    this._useVault = null;
    this._openaiApiKey = null;
    this._load();
  }

  _load() {
    try {
      // Use current domain as default API base URL
      const defaultBaseUrl = window.location.origin;
      this._apiBaseUrl = localStorage.getItem(KEY_API_BASE) || defaultBaseUrl;
      this._patreonToken = localStorage.getItem(KEY_PATREON_TOKEN) || '';
      this._documentUrls = localStorage.getItem(KEY_DOCUMENT_URLS) || '';
      this._aiModel = localStorage.getItem(KEY_AI_MODEL) || 'gpt-4o-mini';
      this._useVault = localStorage.getItem(KEY_USE_VAULT) === 'true';
      this._openaiApiKey = localStorage.getItem(KEY_OPENAI_API_KEY) || '';
    } catch (e) {
      console.warn('[GM AI] ConfigService: error loading config', e);
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
      console.warn('[GM AI] ConfigService: error saving api base', e);
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
      console.warn('[GM AI] ConfigService: error saving patreon token', e);
    }
  }

  hasValidApiBase() {
    const base = this.getApiBaseUrl();
    return base.length > 0 && (base.startsWith('http://') || base.startsWith('https://'));
  }

  getDocumentUrls() {
    return this._documentUrls || '';
  }

  setDocumentUrls(urls) {
    this._documentUrls = (urls || '').trim();
    try {
      if (this._documentUrls) localStorage.setItem(KEY_DOCUMENT_URLS, this._documentUrls);
      else localStorage.removeItem(KEY_DOCUMENT_URLS);
    } catch (e) {
      console.warn('[GM AI] ConfigService: error saving document urls', e);
    }
  }

  getAiModel() {
    return this._aiModel || 'gpt-4o-mini';
  }

  setAiModel(model) {
    this._aiModel = (model || '').trim();
    try {
      if (this._aiModel) localStorage.setItem(KEY_AI_MODEL, this._aiModel);
      else localStorage.removeItem(KEY_AI_MODEL);
    } catch (e) {
      console.warn('[GM AI] ConfigService: error saving ai model', e);
    }
  }

  getUseVault() {
    return this._useVault === true;
  }

  setUseVault(enabled) {
    this._useVault = Boolean(enabled);
    try {
      localStorage.setItem(KEY_USE_VAULT, this._useVault ? 'true' : 'false');
    } catch (e) {
      console.warn('[GM AI] ConfigService: error saving use vault setting', e);
    }
  }

  getOpenAiApiKey() {
    return this._openaiApiKey || '';
  }

  setOpenAiApiKey(key) {
    this._openaiApiKey = (key || '').trim();
    try {
      if (this._openaiApiKey) localStorage.setItem(KEY_OPENAI_API_KEY, this._openaiApiKey);
      else localStorage.removeItem(KEY_OPENAI_API_KEY);
    } catch (e) {
      console.warn('[GM AI] ConfigService: error saving OpenAI API key', e);
    }
  }

  hasOpenAiApiKey() {
    const key = this.getOpenAiApiKey();
    return key.length > 0 && key.startsWith('sk-');
  }
}
