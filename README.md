# GM IA - Plugin Owlbear Rodeo

Chat tipo ChatGPT con un **agente experto en D&D 5e** basado en el [SRD 5.2 (Creative Commons)](https://media.dndbeyond.com/compendium-images/srd/5.2/SP_SRD_CC_v5.2.1.pdf). Arquitectura por servicios y modelo **freemium** controlable por Patreon.

## Requisitos

- Cuenta OpenAI con API key.
- Despliegue en Netlify (o otro host que ejecute las funciones serverless) para mantener la API key en el servidor.

## Configuración

### 1. Variables de entorno (Netlify)

En **Site settings → Environment variables** (o en `.env` en local) define:

| Variable | Descripción |
|----------|-------------|
| `OPENAI_API_KEY` | Tu API key de OpenAI. **No la pongas nunca en el código ni en el frontend.** |
| `PATREON_PREMIUM_TOKEN` | (Opcional) Token secreto para usuarios premium. Quien lo introduzca en el plugin se considera premium. |
| `FREE_DAILY_LIMIT` | (Opcional) Límite diario de mensajes en plan gratuito. Por defecto: 10. |

### 2. Modelo

El backend usa por defecto **gpt-5-nano**. Puedes cambiarlo en `netlify/functions/chat.js` (parámetro `model` o body desde el cliente).

### 3. En el plugin (Owlbear)

1. Abre el plugin en Owlbear.
2. Clic en el icono de **configuración** (engranaje).
3. **URL base del backend**: la URL de tu sitio Netlify, p. ej. `https://tu-proyecto.netlify.app` (sin barra final).
4. **Token Patreon**: si tienes plan premium, introduce el valor que hayas definido en `PATREON_PREMIUM_TOKEN`.

## Estructura del proyecto (por servicios)

```
js/
  main.js              # Entrada; inicializa Owlbear y AppController
  AppController.js     # Orquesta UI y servicios
  constants.js
  services/
    ConfigService.js   # URL del API, token Patreon (localStorage)
    TierService.js    # Tier free/premium y límites
    UsageTracker.js   # Uso diario en cliente (freemium)
    ChatService.js    # Historial de mensajes
    ApiService.js     # Llamadas al backend (chat)
  ui/
    ChatPanel.js      # Render del chat y límites
netlify/functions/
  chat.js             # Proxy a OpenAI + system prompt D&D SRD 5.2
  tier.js             # Devuelve tier (free/premium) para freemium
```

## Freemium y Patreon

- **Plan free**: límite diario de mensajes (p. ej. 10). El uso se cuenta en el cliente por día.
- **Plan premium**: sin límite. Quien tenga el token configurado en el servidor (`PATREON_PREMIUM_TOKEN`) y lo introduzca en el plugin se considera premium.

Para un flujo real con Patreon (OAuth, comprobación de suscripción), sustituye la lógica en `netlify/functions/tier.js` por una llamada a la API de Patreon y devuelve `tier: 'premium'` según la suscripción del usuario.

## Seguridad

- **Nunca** incluyas `OPENAI_API_KEY` en el repositorio ni en el frontend. Úsala solo en variables de entorno del servidor (Netlify).
- Si alguna vez has expuesto la API key (p. ej. en un mensaje o commit), **revócala y genera una nueva** en [OpenAI API keys](https://platform.openai.com/api-keys).

## Referencia del agente

El asistente usa como referencia el documento oficial:

- [SRD 5.2 PDF](https://media.dndbeyond.com/compendium-images/srd/5.2/SP_SRD_CC_v5.2.1.pdf) (D&D 5e, Creative Commons).

El system prompt en `netlify/functions/chat.js` define al agente como experto en ese SRD.

## Desarrollo local

1. Clona el repo y despliega las funciones en Netlify (o usa `netlify dev` con `.env` configurado).
2. En Owlbear, carga el plugin desde la carpeta del proyecto (manifest + index.html).
3. En configuración del plugin, pon la URL de tu backend (Netlify o `http://localhost:8888` si usas `netlify dev`).

## Licencia

Plugin de ejemplo; el SRD 5.2 está bajo su propia licencia Creative Commons.
