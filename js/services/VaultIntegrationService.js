/**
 * @fileoverview Service for integrating with GM Vault
 * Reads GM Vault data from localStorage to provide context to the AI
 */

const GM_VAULT_PREFIX = 'notion_room_';
const GM_VAULT_TOKEN_KEY = 'gm-vault-notion-token';

export class VaultIntegrationService {
  constructor() {
    this._cachedVaultData = null;
    this._lastCheck = 0;
    this._checkInterval = 5000; // Check every 5 seconds
  }

  /**
   * Checks if GM Vault is available by looking for its localStorage keys
   * @returns {boolean}
   */
  isVaultAvailable() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(GM_VAULT_PREFIX)) {
          return true;
        }
      }
    } catch (e) {
      console.warn('[GM AI] Error checking vault availability:', e);
    }
    return false;
  }

  /**
   * Gets all vault data from localStorage
   * @returns {Object|null}
   */
  getVaultData() {
    const now = Date.now();
    
    // Return cached data if recent
    if (this._cachedVaultData && (now - this._lastCheck) < this._checkInterval) {
      return this._cachedVaultData;
    }

    try {
      const vaultData = {
        categories: [],
        pages: [],
        hasToken: false
      };

      // Check if user has Notion token configured
      const token = localStorage.getItem(GM_VAULT_TOKEN_KEY);
      vaultData.hasToken = Boolean(token);

      // Look for vault configuration in localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        
        if (key && key.startsWith(GM_VAULT_PREFIX)) {
          try {
            const data = localStorage.getItem(key);
            if (data) {
              const parsed = JSON.parse(data);
              
              if (parsed.categories && Array.isArray(parsed.categories)) {
                vaultData.categories = parsed.categories;
                
                // Extract all pages from categories
                parsed.categories.forEach(category => {
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
              }
              
              break; // Found vault data, no need to continue
            }
          } catch (e) {
            console.warn('[GM AI] Error parsing vault key:', key, e);
          }
        }
      }

      this._cachedVaultData = vaultData;
      this._lastCheck = now;
      
      return vaultData;
    } catch (e) {
      console.error('[GM AI] Error getting vault data:', e);
      return null;
    }
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
   * Invalidates the cache to force a fresh read on next access
   */
  invalidateCache() {
    this._cachedVaultData = null;
    this._lastCheck = 0;
  }
}
