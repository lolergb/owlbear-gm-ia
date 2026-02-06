/**
 * @fileoverview Servicio de llamadas al backend: chat (proxy OpenAI) y tier.
 * La API key de OpenAI NUNCA se envía desde el cliente; el backend la inyecta.
 */

const DEFAULT_MODEL = 'gpt-5-nano';

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
   * @param {{ model?: string }} options
   * @returns {Promise<{ content: string, error?: string }>}
   */
  async chat(messages, options = {}) {
    const base = this.getBaseUrl();
    if (!base) {
      return { content: '', error: 'Configura la URL del backend en Ajustes (icono de engranaje).' };
    }

    const url = `${base}/.netlify/functions/chat`;
    const body = {
      messages,
      model: options.model || DEFAULT_MODEL
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
        return { content: '', error: 'Has alcanzado el límite de mensajes del plan gratuito. Conéctate con Patreon para premium.' };
      }

      if (data.error) {
        return { content: '', error: typeof data.error === 'string' ? data.error : (data.error.message || data.error.code || 'Error del servidor') };
      }

      const content = (data.choices && data.choices[0] && data.choices[0].message)
        ? data.choices[0].message.content
        : (data.content || '');
      return { content: (content || '').trim() };
    } catch (e) {
      console.error('[GM IA] ApiService chat error', e);
      return { content: '', error: e.message || 'Error de conexión.' };
    }
  }
}
