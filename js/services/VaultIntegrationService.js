/**
 * @fileoverview Service for integrating with GM Vault
 * Reads GM Vault data from OBR room metadata (persistent, always available)
 * and optionally via broadcast when GM Vault is open
 */

// Room metadata key used by GM Vault
const ROOM_METADATA_KEY = 'com.dmscreen/pagesConfig';

// Broadcast channels from GM Vault (only work when GM Vault popover is open)
const BROADCAST_CHANNEL_REQUEST_FULL_VAULT = 'com.dmscreen/requestFullVault';
const BROADCAST_CHANNEL_RESPONSE_FULL_VAULT = 'com.dmscreen/responseFullVault';
const BROADCAST_CHANNEL_VISIBLE_PAGES = 'com.dmscreen/visiblePages';

export class VaultIntegrationService {
  constructor() {
    this.OBR = null;
    this._cachedVaultData = null;
    this._isListening = false;
    this._playerId = null;
    this._playerName = 'GM AI';
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
    } catch (e) {
      console.warn('[GM AI] Error initializing vault integration:', e);
    }
  }

  /**
   * Loads vault data from OBR room metadata (always available, no need for GM Vault to be open)
   * @returns {Promise<boolean>} True if data was found
   * @private
   */
  async _loadFromRoomMetadata() {
    if (!this.OBR) return false;

    try {
      const metadata = await this.OBR.room.getMetadata();
      console.log('[GM AI] Room metadata keys:', Object.keys(metadata || {}));

      if (metadata && metadata[ROOM_METADATA_KEY]) {
        console.log('[GM AI] Found vault data in room metadata');
        this._processVaultConfig(metadata[ROOM_METADATA_KEY]);
        return true;
      } else {
        console.log('[GM AI] No vault data found in room metadata (key:', ROOM_METADATA_KEY, ')');
        return false;
      }
    } catch (e) {
      console.warn('[GM AI] Error reading room metadata:', e);
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
   * @param {Object} config - Vault configuration
   * @private
   */
  _processVaultConfig(config) {
    if (!config || !config.categories) {
      console.warn('[GM AI] Invalid vault config received');
      return;
    }

    const vaultData = {
      categories: config.categories || [],
      pages: [],
      lastUpdate: Date.now()
    };

    config.categories.forEach(category => {
      if (category.pages && Array.isArray(category.pages)) {
        category.pages.forEach(page => {
          if (page.visible !== false) {
            vaultData.pages.push({
              id: page.id,
              title: page.title || 'Untitled',
              category: category.name || 'Uncategorized',
              url: page.url || null,
              icon: page.icon || null
            });
          }
        });
      }
    });

    this._cachedVaultData = vaultData;
    console.log(`[GM AI] Vault data processed: ${vaultData.pages.length} pages in ${vaultData.categories.length} categories`);
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
