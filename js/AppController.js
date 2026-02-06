/**
 * @fileoverview Controlador principal: orquesta servicios y UI del chat.
 */

import { ConfigService, TierService, ChatService, ApiService } from './services/index.js';
import { getUsedToday, incrementUsedToday } from './services/UsageTracker.js';
import { ChatPanel } from './ui/ChatPanel.js';

export class AppController {
  constructor() {
    this.configService = new ConfigService();
    this.tierService = new TierService(this.configService);
    this.chatService = new ChatService();
    this.apiService = new ApiService(this.configService);
    this.chatPanel = new ChatPanel(document.getElementById('app'));
    this._loadingEl = null;
  }

  async init() {
    await this._refreshTier();
    this._bindEvents();
    this._loadSettingsIntoUI();
  }

  _bindEvents() {
    const sendBtn = document.getElementById('btn-send');
    const input = document.getElementById('chat-input');
    const btnSettings = document.getElementById('btn-settings');
    const btnSettingsClose = document.getElementById('btn-settings-close');
    const apiBaseUrl = document.getElementById('api-base-url');
    const patreonToken = document.getElementById('patreon-token');
    const settingsPanel = document.getElementById('settings-panel');

    const send = () => this._sendMessage();
    sendBtn?.addEventListener('click', send);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
    input?.addEventListener('input', () => this.chatPanel.hideNotice());

    btnSettings?.addEventListener('click', () => {
      this.chatPanel.hideNotice();
      settingsPanel?.classList.remove('hidden');
    });
    btnSettingsClose?.addEventListener('click', () => {
      settingsPanel?.classList.add('hidden');
      this._saveSettingsFromUI();
      this.tierService.invalidateCache();
      this._refreshTier();
    });

    const saveAndClose = () => {
      this._saveSettingsFromUI();
      settingsPanel?.classList.add('hidden');
      this.tierService.invalidateCache();
      this._refreshTier();
    };
    apiBaseUrl?.addEventListener('blur', saveAndClose);
    patreonToken?.addEventListener('blur', saveAndClose);

    this.chatPanel.limitsEl?.addEventListener('click', (e) => {
      if (e.target?.getAttribute('data-action') === 'patreon') {
        e.preventDefault();
        window.open('https://www.patreon.com/', '_blank');
      }
    });
  }

  _loadSettingsIntoUI() {
    const apiBase = document.getElementById('api-base-url');
    const patreon = document.getElementById('patreon-token');
    if (apiBase) apiBase.value = this.configService.getApiBaseUrl();
    if (patreon) patreon.value = this.configService.getPatreonToken();
  }

  _saveSettingsFromUI() {
    const apiBase = document.getElementById('api-base-url');
    const patreon = document.getElementById('patreon-token');
    if (apiBase) this.configService.setApiBaseUrl(apiBase.value);
    if (patreon) this.configService.setPatreonToken(patreon.value);
  }

  async _refreshTier() {
    const tierInfo = await this.tierService.getTier();
    const remaining = this.tierService.remainingFreeMessages(tierInfo.usedToday, tierInfo.dailyLimit);
    this.chatPanel.setTierBadge(tierInfo.tier, remaining);
    this.chatPanel.renderLimits(tierInfo.tier, tierInfo.usedToday, tierInfo.dailyLimit);
  }

  async _sendMessage() {
    const text = this.chatPanel.getInputValue();
    if (!text) return;

    this.chatPanel.hideNotice();

    if (!this.configService.hasValidApiBase()) {
      this.chatPanel.showNotice('Configura la URL del backend en Ajustes (icono de engranaje).', true);
      return;
    }

    const usedToday = getUsedToday();
    const tierInfo = await this.tierService.getTier();
    if (!this.tierService.canSendMessage(usedToday, tierInfo.dailyLimit)) {
      this.chatPanel.showNotice('Límite de mensajes del plan gratuito alcanzado. Conéctate con Patreon para premium.', true);
      return;
    }

    this.chatService.addUserMessage(text);
    this.chatPanel.appendMessage('user', text);
    this.chatPanel.setInput('');
    this.chatPanel.setInputDisabled(true);

    this._loadingEl = this.chatPanel.appendLoading();

    const messages = this.chatService.getApiMessages(undefined);
    const result = await this.apiService.chat(messages);

    this.chatPanel.setInputDisabled(false);

    if (this._loadingEl) {
      if (result.error) {
        this.chatService.addErrorMessage(result.error);
        this.chatPanel.replaceLoadingWithMessage(this._loadingEl, result.error || 'Error desconocido.', true);
      } else {
        incrementUsedToday();
        const content = result.content || '(Sin respuesta.)';
        this.chatService.addAssistantMessage(content);
        this.chatPanel.replaceLoadingWithMessage(this._loadingEl, content);
      }
      this._loadingEl = null;
    } else {
      this.chatPanel.removeLoading();
      if (result.error) {
        this.chatService.addErrorMessage(result.error);
        this.chatPanel.appendMessage('assistant', result.error || 'Error desconocido.', true);
      } else {
        incrementUsedToday();
        const content = result.content || '(Sin respuesta.)';
        this.chatService.addAssistantMessage(content);
        this.chatPanel.appendMessage('assistant', content);
      }
    }

    await this._refreshTier();
  }
}
