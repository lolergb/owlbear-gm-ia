/**
 * @fileoverview Servicio de estado del chat: historial de mensajes y lógica de conversación.
 */

const MAX_MESSAGES_IN_CONTEXT = 30;

export class ChatService {
  constructor() {
    this._messages = [];
  }

  getMessages() {
    return [...this._messages];
  }

  addUserMessage(content) {
    this._messages.push({ role: 'user', content: (content || '').trim() });
  }

  addAssistantMessage(content) {
    this._messages.push({ role: 'assistant', content: (content || '').trim() });
  }

  addErrorMessage(content) {
    this._messages.push({ role: 'user', content: '' });
    this._messages.push({ role: 'assistant', content: content || 'Error desconocido.', isError: true });
  }

  /**
   * Mensajes en formato API OpenAI (sistema + usuario/asistente), con límite para contexto.
   */
  getApiMessages(systemContent) {
    const list = [];
    if (systemContent) {
      list.push({ role: 'system', content: systemContent });
    }
    const fromHistory = this._messages
      .filter(m => m.role === 'user' || (m.role === 'assistant' && !m.isError))
      .map(m => ({ role: m.role, content: m.content }))
      .slice(-MAX_MESSAGES_IN_CONTEXT);
    list.push(...fromHistory);
    return list;
  }

  clear() {
    this._messages = [];
  }

  isEmpty() {
    return this._messages.length === 0;
  }
}
