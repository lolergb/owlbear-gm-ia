/**
 * @fileoverview Builds the system prompt for OpenAI
 * Used by the client when calling OpenAI directly (BYOK mode)
 */

/**
 * Builds the complete system prompt including SRD, document URLs, and vault context
 * @param {string} documentUrls - URLs from settings (one per line)
 * @param {string} vaultContext - GM Vault summary text
 * @returns {string} Complete system prompt
 */
export function buildSystemPrompt(documentUrls = '', vaultContext = '') {
  let prompt = `You are an expert assistant for Dungeons & Dragons 5th edition (D&D 5e). Your knowledge is based on the official SRD 5.2 (Systems Reference Document) under Creative Commons license, available at: https://media.dndbeyond.com/compendium-images/srd/5.2/SP_SRD_CC_v5.2.1.pdf`;

  // Normalize document URLs (support \n and \r\n, trim, remove empty)
  const urlList = typeof documentUrls === 'string'
    ? documentUrls.split(/\r?\n/).map(u => u.trim()).filter(u => u.length > 0)
    : Array.isArray(documentUrls) ? documentUrls.map(u => String(u).trim()).filter(u => u) : [];

  if (urlList.length > 0) {
    prompt += `\n\n--- USER'S REFERENCE DOCUMENTS (from Settings) ---
The user has configured these documents as their reference materials. You MUST treat these as primary sources. When answering, refer to these documents when relevant. Do NOT say you cannot read or access them.

Document URLs:
${urlList.map(u => `- ${u}`).join('\n')}
---`;
  }

  if (vaultContext) {
    prompt += vaultContext;
  }

  prompt += `\n\nSTRICT RULES:
- Maximum 2-4 short sentences per answer. Never write paragraphs.
- No introductions like "Generally...", "It depends...", "You could...". Answer the question directly.
- No suggestions to "consult your document" unless the user explicitly asks where to look. If you don't know the exact rule, give one concrete option and stop.
- Base answers on: SRD 5.2, user's document URLs, GM Vault. Do NOT say you cannot read PDFs or documents.
- One skill check suggestion = one line (e.g. "Arcana CD 13" or "Prueba de Arcana CD 13"). No explaining when to use it unless asked.`;

  return prompt;
}
