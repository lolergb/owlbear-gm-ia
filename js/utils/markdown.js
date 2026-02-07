/**
 * Renderizado mínimo de Markdown a HTML seguro para las respuestas del asistente.
 * Soporta: **negrita**, *cursiva*, saltos de línea, [enlaces](url).
 */

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Convierte texto con Markdown básico a HTML seguro.
 * @param {string} text
 * @returns {string} HTML seguro
 */
export function markdownToHtml(text) {
  if (!text || typeof text !== 'string') return '';
  let html = escapeHtml(text);

  // **negrita** (evitar doble match en ***)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // *cursiva* (solo si no es **)
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  // [texto](url)
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  // Saltos de línea
  html = html.replace(/\n/g, '<br>');

  return html;
}
