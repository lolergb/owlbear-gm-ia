/**
 * @fileoverview Servicio de tier freemium (Patreon).
 * Consulta al backend el plan del usuario; el uso diario se rastrea en cliente.
 */

import { getUsedToday } from './UsageTracker.js';

const DEFAULT_TIER = { tier: 'free', dailyLimit: 10, usedToday: 0 };
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

export class TierService {
  constructor(configService) {
    this.configService = configService;
    this._cached = null;
    this._cacheExpiry = 0;
  }

  /**
   * Obtiene el tier actual del usuario (free | premium) y límites.
   * usedToday viene del UsageTracker local.
   * @returns {Promise<{ tier: string, dailyLimit: number, usedToday: number }>}
   */
  async getTier() {
    const base = this.configService.getApiBaseUrl();
    const usedToday = getUsedToday();

    if (!base) {
      return { ...DEFAULT_TIER, usedToday };
    }

    if (this._cached && Date.now() < this._cacheExpiry) {
      return { ...this._cached, usedToday };
    }

    const token = this.configService.getPatreonToken();
    let url = `${base}/.netlify/functions/tier`;
    if (token) {
      url += `?token=${encodeURIComponent(token)}`;
    }

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' }
      });
      if (!res.ok) {
        return { ...DEFAULT_TIER, usedToday };
      }
      const data = await res.json();
      this._cached = {
        tier: data.tier || 'free',
        dailyLimit: data.dailyLimit ?? DEFAULT_TIER.dailyLimit
      };
      this._cacheExpiry = Date.now() + CACHE_TTL_MS;
      return { ...this._cached, usedToday };
    } catch (e) {
      console.warn('[GM IA] TierService: error fetching tier', e);
      return { ...DEFAULT_TIER, usedToday };
    }
  }

  invalidateCache() {
    this._cached = null;
    this._cacheExpiry = 0;
  }

  isPremium() {
    return this._cached?.tier === 'premium';
  }

  canSendMessage(usedToday, dailyLimit) {
    if (!this._cached) return true;
    if (this._cached.tier === 'premium') return true;
    const limit = dailyLimit ?? this._cached.dailyLimit ?? 10;
    const used = usedToday ?? 0;
    return used < limit;
  }

  remainingFreeMessages(usedToday, dailyLimit) {
    if (!this._cached || this._cached.tier === 'premium') return null;
    const limit = dailyLimit ?? this._cached.dailyLimit ?? 10;
    const used = usedToday ?? 0;
    return Math.max(0, limit - used);
  }
}
