/**
 * @fileoverview Service for integrating with GM Vault
 * Reads GM Vault data from OBR room metadata (persistent, always available)
 * and optionally via broadcast when GM Vault is open
 */

// Room metadata keys used by GM Vault
/** Compact summary written by GM Vault for GM AI (cross-domain bridge) */
const ROOM_METADATA_VAULT_SUMMARY_GM_IA = 'com.dmscreen/vaultSummaryForGMIA';
const ROOM_METADATA_FULL_CONFIG = 'com.dmscreen/fullConfig';
const ROOM_METADATA_PAGES_CONFIG = 'com.dmscreen/pagesConfig';

// Broadcast channels from GM Vault (only work when GM Vault popover is open)
const BROADCAST_CHANNEL_REQUEST_FULL_VAULT = 'com.dmscreen/requestFullVault';
const BROADCAST_CHANNEL_RESPONSE_FULL_VAULT = 'com.dmscreen/responseFullVault';
const BROADCAST_CHANNEL_VISIBLE_PAGES = 'com.dmscreen/visiblePages';

const POLL_INTERVAL_MS = 20000; // Refresh vault from room metadata every 20s

export class VaultIntegrationService {
  constructor() {
    this.OBR = null;
    this._cachedVaultData = null;
    this._isListening = false;
    this._playerId = null;
    this._playerName = 'GM AI';
    this._pollIntervalId = null;
    this._onVaultUpdated = null;
  }

  /**
   * Set callback when vault data is updated (e.g. to refresh Settings UI)
   * @param {Function} fn
   */
  setOnVaultUpdated(fn) {
    this._onVaultUpdated = fn;
  }

  /**
   * Initializes the service with OBR reference
   * @param {Object} obr - OBR SDK instance
   */
  async init(obr) {
    if (!obr) {
      console.warn('[GM AI] OBR not available for vault integration');
      return;
    }

    this.OBR = obr;

    try {
      this._playerId = await this.OBR.player.getId();
      this._playerName = await this.OBR.player.getName();
      console.log('[GM AI] Vault integration initialized for:', this._playerName);

      // Set up broadcast listeners for live updates
      this._setupBroadcastListeners();

      // Load initial data from room metadata
      await this._loadFromRoomMetadata();

      // Poll room metadata so we see GM Vault changes without reopening
      this._startPolling();
    } catch (e) {
      console.warn('[GM AI] Error initializing vault integration:', e);
    }
  }

  _startPolling() {
    if (this._pollIntervalId) return;
    this._pollIntervalId = setInterval(async () => {
      if (!this.OBR) return;
      const prevCount = this._cachedVaultData?.pages?.length ?? 0;
      await this._loadFromRoomMetadata(true);
      const nextCount = this._cachedVaultData?.pages?.length ?? 0;
      if (prevCount !== nextCount && this._onVaultUpdated) {
        this._onVaultUpdated();
      }
    }, POLL_INTERVAL_MS);
  }

  stopPolling() {
    if (this._pollIntervalId) {
      clearInterval(this._pollIntervalId);
      this._pollIntervalId = null;
    }
  }

  /**
   * Loads vault data from OBR room metadata (cross-domain: same room, any extension).
   * Prefers the bridge key written by GM Vault for GM AI.
   * @param {boolean} [silent=false] - If true, skip console logs (used for polling)
   * @returns {Promise<boolean>} True if data was found
   * @private
   */
  async _loadFromRoomMetadata(silent = false) {
    if (!this.OBR) return false;

    const log = silent ? () => {} : (msg, ...args) => console.log('[GM AI]', msg, ...args);

    try {
      const metadata = await this.OBR.room.getMetadata();
      if (!silent) console.log('[GM AI] Room metadata keys:', Object.keys(metadata || {}));

      // 1. Prefer vault summary for GM AI (bridge key written by GM Vault when saving)
      if (metadata && metadata[ROOM_METADATA_VAULT_SUMMARY_GM_IA]) {
        log('Found vault summary (GM Vault bridge)');
        this._processVaultConfig(metadata[ROOM_METADATA_VAULT_SUMMARY_GM_IA], silent);
        return true;
      }

      // 2. Fallback: fullConfig if present
      if (metadata && metadata[ROOM_METADATA_FULL_CONFIG]) {
        log('Found full vault config in room metadata');
        this._processVaultConfig(metadata[ROOM_METADATA_FULL_CONFIG], silent);
        return true;
      }

      // 3. Fallback: pagesConfig (visible-to-players only)
      if (metadata && metadata[ROOM_METADATA_PAGES_CONFIG]) {
        log('Found visible pages config in room metadata');
        this._processVaultConfig(metadata[ROOM_METADATA_PAGES_CONFIG], silent);
        return true;
      }

      if (!silent) console.log('[GM AI] No vault data in room metadata. Open GM Vault and save to publish summary for GM AI.');
      return false;
    } catch (e) {
      if (!silent) console.warn('[GM AI] Error reading room metadata:', e);
      return false;
    }
  }

  /**
   * Sets up broadcast listeners for live vault updates (only work when GM Vault is open)
   * @private
   */
  _setupBroadcastListeners() {
    if (!this.OBR || this._isListening) return;

    // Listen for full vault broadcasts
    this.OBR.broadcast.onMessage(BROADCAST_CHANNEL_RESPONSE_FULL_VAULT, (event) => {
      const { config } = event.data;
      if (config) {
        console.log('[GM AI] Received live vault update from GM');
        this._processVaultConfig(config);
      }
    });

    // Listen for visible pages updates
    this.OBR.broadcast.onMessage(BROADCAST_CHANNEL_VISIBLE_PAGES, (event) => {
      const { config } = event.data;
      if (config) {
        console.log('[GM AI] Received visible pages update from GM');
        this._processVaultConfig(config);
      }
    });

    this._isListening = true;
  }

  /**
   * Refreshes vault data: reads room metadata + optionally requests from GM via broadcast
   * @returns {Promise<boolean>} True if data was found
   */
  async requestVaultFromGM() {
    if (!this.OBR) return false;

    // 1. Always read from room metadata (reliable, always available)
    const found = await this._loadFromRoomMetadata();

    // 2. Also try broadcast in case GM Vault is open (may get richer data)
    try {
      this.OBR.broadcast.sendMessage(BROADCAST_CHANNEL_REQUEST_FULL_VAULT, {
        requesterId: this._playerId,
        requesterName: this._playerName,
        timestamp: Date.now()
      });
      console.log('[GM AI] Broadcast request sent (will use if GM Vault is open)');
    } catch (e) {
      // Broadcast failed, no big deal - we already have room metadata
    }

    return found;
  }

  /**
   * Processes vault configuration data into a usable format
   * Handles nested categories (categories can contain sub-categories)
   * @param {Object} config - Vault configuration
   * @param {boolean} [silent=false]
   * @private
   */
  _processVaultConfig(config, silent = false) {
    if (!config || !config.categories) {
      if (!silent) console.warn('[GM AI] Invalid vault config received:', config);
      return;
    }

    if (!silent) console.log('[GM AI] Processing vault config, top-level categories:', config.categories.length);

    const vaultData = {
      categories: [],
      pages: [],
      lastUpdate: Date.now()
    };

    // Recursively extract pages from nested categories
    const extractPages = (categories, parentPath = '') => {
      if (!Array.isArray(categories)) return;

      categories.forEach(category => {
        const categoryName = parentPath
          ? `${parentPath} > ${category.name || 'Uncategorized'}`
          : (category.name || 'Uncategorized');

        vaultData.categories.push(categoryName);

        // Extract pages from this category
        if (category.pages && Array.isArray(category.pages)) {
          category.pages.forEach(page => {
            vaultData.pages.push({
              id: page.id,
              title: page.title || 'Untitled',
              category: categoryName,
              url: page.url || null,
              icon: page.icon || null
            });
          });
        }

        // Recurse into sub-categories
        if (category.categories && Array.isArray(category.categories)) {
          extractPages(category.categories, categoryName);
        }
      });
    };

    extractPages(config.categories);

    this._cachedVaultData = vaultData;
    if (!silent) {
      console.log(`[GM AI] Vault data processed: ${vaultData.pages.length} pages in ${vaultData.categories.length} categories`);
      if (vaultData.pages.length > 0) {
        console.log('[GM AI] Sample pages:', vaultData.pages.slice(0, 3).map(p => p.title));
      }
    }
  }

  /**
   * Checks if GM Vault data is available
   * @returns {boolean}
   */
  isVaultAvailable() {
    return this._cachedVaultData !== null && this._cachedVaultData.pages.length > 0;
  }

  /**
   * Gets cached vault data
   * @returns {Object|null}
   */
  getVaultData() {
    return this._cachedVaultData;
  }

  /**
   * Formats vault data as a text summary for AI context
   * @returns {string}
   */
  getVaultSummary() {
    const vaultData = this.getVaultData();

    if (!vaultData || vaultData.pages.length === 0) {
      return '';
    }

    let summary = '\n\n## GM Vault Content\n\n';
    summary += `The user has a GM Vault with ${vaultData.pages.length} pages organized in ${vaultData.categories.length} categories.\n\n`;

    // Group pages by category
    const pagesByCategory = {};
    vaultData.pages.forEach(page => {
      if (!pagesByCategory[page.category]) {
        pagesByCategory[page.category] = [];
      }
      pagesByCategory[page.category].push(page);
    });

    summary += 'Available pages:\n';
    Object.keys(pagesByCategory).sort().forEach(category => {
      summary += `\n**${category}:**\n`;
      pagesByCategory[category].forEach(page => {
        summary += `- ${page.icon || '📄'} ${page.title}\n`;
      });
    });

    summary += '\nNote: The user can reference these pages when asking questions. You can mention them if relevant to the conversation.\n';

    return summary;
  }

  /**
   * Invalidates the cache and refreshes data
   */
  async invalidateCache() {
    this._cachedVaultData = null;
    if (this.OBR) {
      await this.requestVaultFromGM();
    }
  }
}
