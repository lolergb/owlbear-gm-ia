/**
 * @fileoverview Panel de chat: renderiza mensajes, input y límites freemium.
 */

export class ChatPanel {
  constructor(container) {
    this.container = container;
    this.messagesEl = container?.querySelector('#chat-messages');
    this.welcomeEl = container?.querySelector('#welcome');
    this.inputEl = container?.querySelector('#chat-input');
    this.sendBtn = container?.querySelector('#btn-send');
    this.limitsEl = container?.querySelector('#chat-limits');
    this.tierBadge = document.getElementById('tier-badge');
  }

  hideWelcome() {
    if (this.welcomeEl) this.welcomeEl.classList.add('hidden');
  }

  showWelcome() {
    if (this.welcomeEl) this.welcomeEl.classList.remove('hidden');
  }

  appendMessage(role, content, isError = false) {
    if (!this.messagesEl) return;
    this.hideWelcome();
    const div = document.createElement('div');
    div.className = `msg msg--${role}${isError ? ' msg--error' : ''}`;
    const inner = document.createElement('div');
    inner.className = 'msg__content';
    inner.textContent = content;
    div.appendChild(inner);
    this.messagesEl.appendChild(div);
    this.scrollToBottom();
  }

  appendLoading() {
    if (!this.messagesEl) return;
    this.hideWelcome();
    const div = document.createElement('div');
    div.className = 'msg msg--assistant msg--loading';
    div.setAttribute('data-loading', 'true');
    const inner = document.createElement('div');
    inner.className = 'msg__content';
    inner.textContent = '';
    div.appendChild(inner);
    this.messagesEl.appendChild(div);
    this.scrollToBottom();
    return div;
  }

  replaceLoadingWithMessage(loadingEl, content, isError = false) {
    if (!loadingEl) return;
    loadingEl.classList.remove('msg--loading');
    loadingEl.removeAttribute('data-loading');
    const contentEl = loadingEl.querySelector('.msg__content');
    if (contentEl) contentEl.textContent = content;
    if (isError) loadingEl.classList.add('msg--error');
    this.scrollToBottom();
  }

  removeLoading() {
    const el = this.messagesEl?.querySelector('[data-loading="true"]');
    if (el) el.remove();
  }

  scrollToBottom() {
    if (this.messagesEl) this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  clearMessages() {
    if (!this.messagesEl) return;
    const toRemove = this.messagesEl.querySelectorAll('.msg');
    toRemove.forEach(n => n.remove());
    this.showWelcome();
  }

  setInput(value) {
    if (this.inputEl) this.inputEl.value = value || '';
  }

  getInputValue() {
    return this.inputEl?.value?.trim() || '';
  }

  setInputDisabled(disabled) {
    if (this.inputEl) this.inputEl.disabled = !!disabled;
    if (this.sendBtn) this.sendBtn.disabled = !!disabled;
  }

  setTierBadge(tier, remaining) {
    if (!this.tierBadge) return;
    this.tierBadge.textContent = tier === 'premium' ? 'Premium' : 'Free';
    this.tierBadge.classList.toggle('premium', tier === 'premium');
    this.tierBadge.title = tier === 'premium' ? 'Plan premium' : `Plan gratuito${remaining != null ? ` (${remaining} mensajes hoy)` : ''}`;
  }

  setLimitsHtml(html) {
    if (this.limitsEl) this.limitsEl.innerHTML = html || '';
  }

  renderLimits(tier, usedToday, dailyLimit) {
    if (tier === 'premium') {
      this.setLimitsHtml('Plan premium: sin límite.');
      return;
    }
    const remaining = Math.max(0, (dailyLimit || 10) - (usedToday || 0));
    this.setLimitsHtml(
      `${remaining} de ${dailyLimit || 10} mensajes hoy. <a href="#" data-action="patreon">Obtener premium</a>`
    );
  }
}
