/**
 * Netlify Function: devuelve el tier del usuario (free/premium) para freemium Patreon.
 * Si env PATREON_PREMIUM_TOKEN está definido, el token enviado por el cliente se compara con él.
 * Para producción: sustituir por validación real con API de Patreon.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Patreon-Token',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

const FREE_DAILY_LIMIT = 10;

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const token = event.queryStringParameters?.token || event.headers['x-patreon-token'] || event.headers['X-Patreon-Token'];
  const premiumSecret = process.env.PATREON_PREMIUM_TOKEN;
  const isPremium = Boolean(premiumSecret && token && token === premiumSecret);

  const body = {
    tier: isPremium ? 'premium' : 'free',
    dailyLimit: FREE_DAILY_LIMIT,
    usedToday: 0
  };

  return {
    statusCode: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
};
