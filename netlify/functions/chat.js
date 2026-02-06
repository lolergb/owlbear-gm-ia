/**
 * Netlify Function: proxy a OpenAI para el chat D&D.
 * Usa OPENAI_API_KEY desde variables de entorno (nunca exponer en cliente).
 * Referencia: SRD 5.2 https://media.dndbeyond.com/compendium-images/srd/5.2/SP_SRD_CC_v5.2.1.pdf
 */

const SYSTEM_PROMPT = `Eres un asistente experto en Dungeons & Dragons 5ª edición (D&D 5e). Tu conocimiento se basa en el documento oficial SRD 5.2 (Systems Reference Document) bajo licencia Creative Commons, disponible en: https://media.dndbeyond.com/compendium-images/srd/5.2/SP_SRD_CC_v5.2.1.pdf

Debes:
- Responder en el mismo idioma que use el usuario (español o inglés).
- Basar tus respuestas en las reglas del SRD 5.2 cuando sea posible.
- Ser claro y conciso sobre reglas, criaturas, hechizos, clases, razas y mecánicas.
- Si algo no está en el SRD, indicarlo y dar una respuesta razonable según las convenciones de 5e.
- Citar brevemente la fuente (ej. "según el SRD 5.2...") cuando sea relevante.

No inventes contenido que contradiga el SRD. Para contenido bajo otra licencia (p. ej. contenido propietario de D&D Beyond), indica que no está en el SRD gratuito.`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Patreon-Token, X-User-Id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function jsonResponse(body, statusCode = 200) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: 'OPENAI_API_KEY not configured on server' }, 500);
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { messages = [], model = 'gpt-5-nano' } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonResponse({ error: 'messages array required' }, 400);
  }

  const patreonToken = event.headers['x-patreon-token'] || event.headers['X-Patreon-Token'];
  const isPremium = Boolean(patreonToken && process.env.PATREON_PREMIUM_TOKEN && patreonToken === process.env.PATREON_PREMIUM_TOKEN);

  const openAiMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map((m) => ({ role: m.role, content: m.content }))
  ];

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: openAiMessages,
        max_tokens: 1024,
        temperature: 0.7
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return jsonResponse({
        error: data.error?.message || data.error?.code || `OpenAI error ${res.status}`
      }, 200);
    }
    return jsonResponse(data);
  } catch (err) {
    console.error('OpenAI request failed', err);
    return jsonResponse({ error: err.message || 'OpenAI request failed' }, 200);
  }
};
