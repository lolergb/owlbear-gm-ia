/**
 * @fileoverview Servicio de llamadas al backend: chat (proxy OpenAI) y tier.
 * La API key de OpenAI NUNCA se envía desde el cliente; el backend la inyecta.
 * 
 * BYOK Mode: When user provides their own OpenAI API key, chatDirect() calls OpenAI directly
 */

import { buildSystemPrompt } from '../utils/promptBuilder.js';

const DEFAULT_MODEL = 'gpt-4o-mini';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

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

  /**
   * Calls OpenAI directly from the client using user's API key (BYOK mode)
   * @param {string} apiKey - User's OpenAI API key
   * @param {Array<{ role: string, content: string }>} messages - User/assistant message history
   * @param {{ model?: string, documentUrls?: string, vaultContext?: string }} options
   * @returns {Promise<{ content: string, error?: string }>}
   */
  async chatDirect(apiKey, messages, options = {}) {
    if (!apiKey || !apiKey.startsWith('sk-')) {
      return { 
        content: '', 
        error: 'OpenAI API key is required. Please add your key in Settings (gear icon).' 
      };
    }

    try {
      // Build system prompt using document URLs and vault context
      const systemPrompt = buildSystemPrompt(
        options.documentUrls || this.configService.getDocumentUrls(),
        options.vaultContext || ''
      );

      // Construct messages array with system prompt
      const fullMessages = [
        { role: 'system', content: systemPrompt },
        ...messages
      ];

      const body = {
        model: options.model || this.configService.getAiModel() || DEFAULT_MODEL,
        messages: fullMessages,
        temperature: 0.7,
        max_tokens: 500
      };

      const res = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        let errorMsg = 'OpenAI API error';
        
        if (res.status === 401) {
          errorMsg = 'Invalid API key. Please check your OpenAI API key in Settings.';
        } else if (res.status === 429) {
          errorMsg = 'Rate limit exceeded. Please wait a moment and try again.';
        } else if (res.status === 403) {
          errorMsg = 'Access denied. Check your API key permissions.';
        } else if (data.error) {
          errorMsg = data.error.message || data.error.code || errorMsg;
        }
        
        return { content: '', error: errorMsg };
      }

      if (data.error) {
        return { 
          content: '', 
          error: typeof data.error === 'string' 
            ? data.error 
            : (data.error.message || data.error.code || 'OpenAI API error') 
        };
      }

      const content = (data.choices && data.choices[0] && data.choices[0].message)
        ? data.choices[0].message.content
        : '';
      
      return { content: (content || '').trim() };
    } catch (e) {
      console.error('[GM AI] ApiService chatDirect error', e);
      return { 
        content: '', 
        error: e.message || 'Connection error. Check your internet connection.' 
      };
    }
  }
}
