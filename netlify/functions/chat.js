/**
 * Netlify Function: OpenAI proxy for D&D chat.
 * Uses OPENAI_API_KEY from environment variables (never expose on client).
 * Reference: SRD 5.2 https://media.dndbeyond.com/compendium-images/srd/5.2/SP_SRD_CC_v5.2.1.pdf
 */

function buildSystemPrompt(documentUrls = '') {
  let prompt = `You are an expert assistant for Dungeons & Dragons 5th edition (D&D 5e). Your knowledge is based on the official SRD 5.2 (Systems Reference Document) under Creative Commons license, available at: https://media.dndbeyond.com/compendium-images/srd/5.2/SP_SRD_CC_v5.2.1.pdf`;

  if (documentUrls) {
    const urls = documentUrls.split('\n').map(u => u.trim()).filter(u => u);
    if (urls.length > 0) {
      prompt += `\n\nAdditional reference documents:\n${urls.map(u => `- ${u}`).join('\n')}`;
    }
  }

  prompt += `\n\nYou must:
- Respond CONCISELY and DIRECTLY. Avoid long introductions.
- Base your answers on SRD 5.2 rules and the additional documents provided.
- Be clear and direct about rules, creatures, spells, classes, races, and mechanics.
- If something is not in the SRD or additional documents, indicate it briefly.
- Only cite sources if essential to the answer.

IMPORTANT: Keep responses BRIEF and TO THE POINT. No unnecessary elaboration.`;

  return prompt;
}

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

  const { messages = [], model = 'gpt-4o-mini', documentUrls = '' } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonResponse({ error: 'messages array required' }, 400);
  }

  const patreonToken = event.headers['x-patreon-token'] || event.headers['X-Patreon-Token'];
  const isPremium = Boolean(patreonToken && process.env.PATREON_PREMIUM_TOKEN && patreonToken === process.env.PATREON_PREMIUM_TOKEN);

  const systemPrompt = buildSystemPrompt(documentUrls);
  const openAiMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content }))
  ];

  const FALLBACK_MODEL = 'gpt-4o-mini';

  async function callOpenAI(useModel) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: useModel,
        messages: openAiMessages,
        max_tokens: 1024,
        temperature: 0.7
      })
    });
    return { res, data: await res.json().catch(() => ({})) };
  }

  try {
    let { res, data } = await callOpenAI(model);
    const isModelError = !res.ok && (data.error?.code === 'model_not_found' || data.error?.message?.toLowerCase().includes('model'));
    if (isModelError && model !== FALLBACK_MODEL) {
      const fallback = await callOpenAI(FALLBACK_MODEL);
      res = fallback.res;
      data = fallback.data;
    }
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
