/**
 * @fileoverview Controlador principal: orquesta servicios y UI del chat.
 */

import { ConfigService, ChatService, ApiService } from './services/index.js';
// BYOK: Tier system commented out (not needed when users bring their own API key)
// import { TierService } from './services/index.js';
// import { getUsedToday, incrementUsedToday } from './services/UsageTracker.js';
import { ChatPanel } from './ui/ChatPanel.js';
import { VaultIntegrationService } from './services/VaultIntegrationService.js';

export class AppController {
  constructor() {
    this.configService = new ConfigService();
    // this.tierService = new TierService(this.configService); // BYOK: Commented out
    this.chatService = new ChatService();
    this.apiService = new ApiService(this.configService);
    this.vaultService = new VaultIntegrationService();
    this.chatPanel = new ChatPanel(document.getElementById('app'));
    this._loadingEl = null;
  }

  async init(OBR) {
    // Initialize vault integration with OBR
    if (OBR) {
      this.vaultService.setOnVaultUpdated(() => {
        const panel = document.getElementById('settings-panel');
        if (panel && !panel.classList.contains('hidden')) {
          this._updateVaultStatus();
        }
      });
      await this.vaultService.init(OBR);
    }

    // await this._refreshTier(); // BYOK: Commented out
    this._bindEvents();
    this._loadSettingsIntoUI();
    this._updateVaultStatus();
  }

  _bindEvents() {
    const sendBtn = document.getElementById('btn-send');
    const input = document.getElementById('chat-input');
    const btnSettings = document.getElementById('btn-settings');
    const btnSettingsClose = document.getElementById('btn-settings-close');
    const btnSettingsSave = document.getElementById('btn-settings-save');
    const settingsPanel = document.getElementById('settings-panel');
    const useVaultCheckbox = document.getElementById('use-vault');

    const send = () => this._sendMessage();
    sendBtn?.addEventListener('click', send);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
    input?.addEventListener('input', () => this.chatPanel.hideNotice());

    btnSettings?.addEventListener('click', async () => {
      this.chatPanel.hideNotice();
      settingsPanel?.classList.remove('hidden');
      // Request fresh vault data when opening settings
      await this._updateVaultStatus();
    });

    btnSettingsClose?.addEventListener('click', () => {
      settingsPanel?.classList.add('hidden');
    });

    btnSettingsSave?.addEventListener('click', () => {
      this._saveSettingsFromUI();
      settingsPanel?.classList.add('hidden');
      // this.tierService.invalidateCache(); // BYOK: Commented out
      // this._refreshTier(); // BYOK: Commented out
    });

    useVaultCheckbox?.addEventListener('change', () => {
      this._updateVaultStatus();
    });

    // BYOK: Patreon listener commented out (no tier system)
    // this.chatPanel.limitsEl?.addEventListener('click', (e) => {
    //   if (e.target?.getAttribute('data-action') === 'patreon') {
    //     e.preventDefault();
    //     window.open('https://www.patreon.com/', '_blank');
    //   }
    // });
  }

  _loadSettingsIntoUI() {
    const openaiApiKey = document.getElementById('openai-api-key');
    const apiBase = document.getElementById('api-base-url');
    const patreon = document.getElementById('patreon-token');
    const documentUrls = document.getElementById('document-urls');
    const aiModel = document.getElementById('ai-model');
    const useVault = document.getElementById('use-vault');
    
    if (openaiApiKey) openaiApiKey.value = this.configService.getOpenAiApiKey();
    if (apiBase) apiBase.value = this.configService.getApiBaseUrl();
    if (patreon) patreon.value = this.configService.getPatreonToken();
    if (documentUrls) documentUrls.value = this.configService.getDocumentUrls();
    if (aiModel) aiModel.value = this.configService.getAiModel();
    if (useVault) useVault.checked = this.configService.getUseVault();
  }

  _saveSettingsFromUI() {
    const openaiApiKey = document.getElementById('openai-api-key');
    const apiBase = document.getElementById('api-base-url');
    const patreon = document.getElementById('patreon-token');
    const documentUrls = document.getElementById('document-urls');
    const aiModel = document.getElementById('ai-model');
    const useVault = document.getElementById('use-vault');
    
    if (openaiApiKey) this.configService.setOpenAiApiKey(openaiApiKey.value);
    if (apiBase) this.configService.setApiBaseUrl(apiBase.value);
    if (patreon) this.configService.setPatreonToken(patreon.value);
    if (documentUrls) this.configService.setDocumentUrls(documentUrls.value);
    if (aiModel) this.configService.setAiModel(aiModel.value);
    if (useVault) this.configService.setUseVault(useVault.checked);
  }

  async _updateVaultStatus() {
    const statusEl = document.getElementById('vault-status');
    const useVaultCheckbox = document.getElementById('use-vault');
    const containerEl = document.getElementById('vault-integration-container');
    
    if (!statusEl || !containerEl) return;

    // Show loading state
    statusEl.textContent = '⏳ Checking for GM Vault...';
    statusEl.className = 'vault-status unavailable';
    if (useVaultCheckbox) {
      useVaultCheckbox.disabled = true;
    }

    // Request vault from GM
    const received = await this.vaultService.requestVaultFromGM();
    
    // Update status based on result
    const isAvailable = this.vaultService.isVaultAvailable();
    
    if (isAvailable) {
      const vaultData = this.vaultService.getVaultData();
      const pageCount = vaultData?.pages?.length || 0;
      const categoryCount = vaultData?.categories?.length || 0;
      
      statusEl.textContent = `✓ GM Vault detected: ${pageCount} pages in ${categoryCount} categories`;
      statusEl.className = 'vault-status available';
      
      if (useVaultCheckbox) {
        useVaultCheckbox.disabled = false;
      }
    } else {
      statusEl.textContent = '✗ GM Vault not detected (no response from GM)';
      statusEl.className = 'vault-status unavailable';
      
      if (useVaultCheckbox) {
        useVaultCheckbox.disabled = true;
        useVaultCheckbox.checked = false;
      }
    }
  }

  // BYOK: _refreshTier method commented out (no tier system)
  // async _refreshTier() {
  //   const tierInfo = await this.tierService.getTier();
  //   const remaining = this.tierService.remainingFreeMessages(tierInfo.usedToday, tierInfo.dailyLimit);
  //   this.chatPanel.setTierBadge(tierInfo.tier, remaining);
  //   this.chatPanel.renderLimits(tierInfo.tier, tierInfo.usedToday, tierInfo.dailyLimit);
  // }

  async _sendMessage() {
    const text = this.chatPanel.getInputValue();
    if (!text) return;

    this.chatPanel.hideNotice();

    // BYOK: Check if user has configured their OpenAI API key
    if (!this.configService.hasOpenAiApiKey()) {
      this.chatPanel.showNotice('Please add your OpenAI API key in Settings (gear icon) to use the assistant.', true);
      return;
    }

    this.chatService.addUserMessage(text);
    this.chatPanel.appendMessage('user', text);
    this.chatPanel.setInput('');
    this.chatPanel.setInputDisabled(true);

    this._loadingEl = this.chatPanel.appendLoading();

    // Get vault context if enabled
    let vaultContext = '';
    if (this.configService.getUseVault() && this.vaultService.isVaultAvailable()) {
      vaultContext = this.vaultService.getVaultSummary();
    }

    const documentUrls = this.configService.getDocumentUrls();
    const messages = this.chatService.getApiMessages(undefined);
    
    // BYOK: Call OpenAI directly using user's API key
    const apiKey = this.configService.getOpenAiApiKey();
    const result = await this.apiService.chatDirect(apiKey, messages, { vaultContext, documentUrls });

    this.chatPanel.setInputDisabled(false);

    if (this._loadingEl) {
      if (result.error) {
        this.chatService.addErrorMessage(result.error);
        this.chatPanel.replaceLoadingWithMessage(this._loadingEl, result.error || 'Unknown error.', true);
      } else {
        // incrementUsedToday(); // BYOK: No usage tracking needed
        const content = result.content || '(No response.)';
        this.chatService.addAssistantMessage(content);
        this.chatPanel.replaceLoadingWithMessage(this._loadingEl, content);
      }
      this._loadingEl = null;
    } else {
      this.chatPanel.removeLoading();
      if (result.error) {
        this.chatService.addErrorMessage(result.error);
        this.chatPanel.appendMessage('assistant', result.error || 'Unknown error.', true);
      } else {
        // incrementUsedToday(); // BYOK: No usage tracking needed
        const content = result.content || '(No response.)';
        this.chatService.addAssistantMessage(content);
        this.chatPanel.appendMessage('assistant', content);
      }
    }

    // await this._refreshTier(); // BYOK: No tier system needed
  }
}
