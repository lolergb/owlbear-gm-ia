/**
 * @fileoverview Service for integrating with GM Vault
 * Uses OBR broadcast to get vault data from GM in real-time
 */

// Broadcast channels from GM Vault
const BROADCAST_CHANNEL_REQUEST_FULL_VAULT = 'com.dmscreen/requestFullVault';
const BROADCAST_CHANNEL_RESPONSE_FULL_VAULT = 'com.dmscreen/responseFullVault';
const BROADCAST_CHANNEL_VISIBLE_PAGES = 'com.dmscreen/visiblePages';
const ROOM_METADATA_KEY = 'com.dmscreen/config';

export class VaultIntegrationService {
  constructor() {
    this.OBR = null;
    this._cachedVaultData = null;
    this._isListening = false;
    this._playerId = null;
    this._playerName = 'GM AI';
    this._pendingRequest = null; // Para resolver la promesa cuando llega la respuesta
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
      // Get player info
      const player = await this.OBR.player.getRole();
      this._playerId = await this.OBR.player.getId();
      this._playerName = await this.OBR.player.getName();
      
      console.log('[GM AI] Vault integration initialized for:', this._playerName);
      
      // Set up listeners
      this._setupBroadcastListeners();
      
      // Try to get initial vault data
      await this._tryGetInitialVaultData();
    } catch (e) {
      console.warn('[GM AI] Error initializing vault integration:', e);
    }
  }

  /**
   * Sets up broadcast listeners for vault updates
   * @private
   */
  _setupBroadcastListeners() {
    if (!this.OBR || this._isListening) return;

    console.log('[GM AI] Setting up broadcast listeners...');

    // Listen for full vault broadcasts (sent by GM when saving or when requested)
    this.OBR.broadcast.onMessage(BROADCAST_CHANNEL_RESPONSE_FULL_VAULT, (event) => {
      console.log('[GM AI] Broadcast received on RESPONSE_FULL_VAULT channel:', event.data);
      const { config, requesterId } = event.data;
      if (config) {
        console.log('[GM AI] Received vault update from GM');
        this._processVaultConfig(config);
        
        // Resolver promesa pendiente si existe
        if (this._pendingRequest && (!requesterId || requesterId === this._playerId)) {
          console.log('[GM AI] Resolving pending request');
          this._pendingRequest.resolve(true);
          this._pendingRequest = null;
        }
      } else {
        console.warn('[GM AI] Received broadcast but no config data');
      }
    });

    // Listen for visible pages updates (lighter payload)
    this.OBR.broadcast.onMessage(BROADCAST_CHANNEL_VISIBLE_PAGES, (event) => {
      console.log('[GM AI] Broadcast received on VISIBLE_PAGES channel');
      const { config } = event.data;
      if (config) {
        console.log('[GM AI] Received visible pages update from GM');
        this._processVaultConfig(config);
        
        // También resolver promesa pendiente con visible pages
        if (this._pendingRequest) {
          console.log('[GM AI] Resolving pending request with visible pages');
          this._pendingRequest.resolve(true);
          this._pendingRequest = null;
        }
      }
    });

    this._isListening = true;
    console.log('[GM AI] Broadcast listeners active');
  }

  /**
   * Tries to get initial vault data from multiple sources
   * @private
   */
  async _tryGetInitialVaultData() {
    if (!this.OBR) return;

    try {
      // 1. Try to get from room metadata (visible pages only - quick check)
      const metadata = await this.OBR.room.getMetadata();
      if (metadata && metadata[ROOM_METADATA_KEY]) {
        console.log('[GM AI] Found vault structure in room metadata');
        this._processVaultConfig(metadata[ROOM_METADATA_KEY]);
      }

      // 2. ALWAYS request full vault from GM via broadcast (to get complete data)
      console.log('[GM AI] Requesting full vault from GM...');
      await this.requestVaultFromGM();
    } catch (e) {
      console.warn('[GM AI] Error getting initial vault data:', e);
    }
  }

  /**
   * Requests vault data from GM via broadcast with timeout
   * @returns {Promise<boolean>} True if vault was received
   */
  async requestVaultFromGM() {
    if (!this.OBR) {
      console.warn('[GM AI] Cannot request vault: OBR not available');
      return false;
    }

    return new Promise((resolve, reject) => {
      console.log('[GM AI] Requesting vault from GM...');
      
      // Timeout de 5 segundos
      const timeout = setTimeout(() => {
        console.warn('[GM AI] Timeout waiting for vault response from GM (5s)');
        this._pendingRequest = null;
        resolve(false);
      }, 5000);
      
      // Guardar la promesa pendiente para que el listener la resuelva
      this._pendingRequest = {
        resolve: (success) => {
          clearTimeout(timeout);
          resolve(success);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      };
      
      // Enviar solicitud
      try {
        this.OBR.broadcast.sendMessage(BROADCAST_CHANNEL_REQUEST_FULL_VAULT, {
          requesterId: this._playerId,
          requesterName: this._playerName,
          timestamp: Date.now()
        });
        console.log('[GM AI] Vault request sent to GM (waiting for response...)');
      } catch (e) {
        console.error('[GM AI] Error sending vault request:', e);
        clearTimeout(timeout);
        this._pendingRequest = null;
        resolve(false);
      }
    });
  }

  /**
   * Processes vault configuration data
   * @param {Object} config - Vault configuration
   * @private
   */
  _processVaultConfig(config) {
    if (!config || !config.categories) {
      this._cachedVaultData = null;
      return;
    }

    const vaultData = {
      categories: config.categories || [],
      pages: [],
      lastUpdate: Date.now()
    };

    // Extract all pages from categories
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
   * Checks if GM Vault is available
   * @returns {boolean}
   */
  isVaultAvailable() {
    return this._cachedVaultData !== null && this._cachedVaultData.pages.length > 0;
  }

  /**
   * Gets all vault data
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

    // Format as list
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
   * Invalidates the cache and requests fresh data
   */
  async invalidateCache() {
    this._cachedVaultData = null;
    if (this.OBR) {
      await this.requestVaultFromGM();
    }
  }
}
