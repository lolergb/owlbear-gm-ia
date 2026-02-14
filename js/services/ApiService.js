/**
 * @fileoverview Servicio de llamadas al backend: chat (proxy OpenAI) y tier.
 * La API key de OpenAI NUNCA se envía desde el cliente; el backend la inyecta.
 */

const DEFAULT_MODEL = 'gpt-4o-mini';

export class ApiService {
  constructor(configService) {
    this.configService = configService;
  }

  getBaseUrl() {
    return this.configService.getApiBaseUrl().replace(/\/+$/, '');
  }

  /**
   * Envía la conversación al backend y devuelve la respuesta del asistente.
   * @param {Array<{ role: string, content: string }>} messages
   * @param {{ model?: string, documentUrls?: string, vaultContext?: string }} options
   * @returns {Promise<{ content: string, error?: string }>}
   */
  async chat(messages, options = {}) {
    const base = this.getBaseUrl();
    if (!base) {
      return { content: '', error: 'Configure the backend URL in Settings (gear icon).' };
    }

    const url = `${base}/.netlify/functions/chat`;
    const body = {
      messages,
      model: options.model || this.configService.getAiModel() || DEFAULT_MODEL,
      documentUrls: options.documentUrls || this.configService.getDocumentUrls(),
      vaultContext: options.vaultContext || ''
    };

    const token = this.configService.getPatreonToken();
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    };
    if (token) {
      headers['X-Patreon-Token'] = token;
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data.error || data.message || `Error ${res.status}`;
        return { content: '', error: msg };
      }

      if (data.limitReached) {
        return { content: '', error: 'Message limit reached.' };
      }

      if (data.error) {
        return { content: '', error: typeof data.error === 'string' ? data.error : (data.error.message || data.error.code || 'Server error') };
      }

      const content = (data.choices && data.choices[0] && data.choices[0].message)
        ? data.choices[0].message.content
        : (data.content || '');
      return { content: (content || '').trim() };
    } catch (e) {
      console.error('[GM AI] ApiService chat error', e);
      return { content: '', error: e.message || 'Connection error.' };
    }
  }
}
