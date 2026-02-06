/**
 * @fileoverview Punto de entrada del plugin GM IA - D&D Assistant para Owlbear Rodeo.
 * El estilo usa el tema de OBR (OBR.theme) para coincidir con la interfaz de Owlbear.
 */

import OBR from 'https://esm.sh/@owlbear-rodeo/sdk@3.1.0';
import { AppController } from './AppController.js';

let appController = null;

function applyOBRTheme(theme) {
  const raw = typeof theme === 'string' ? theme : (theme?.mode ?? theme?.theme ?? 'DARK');
  const mode = String(raw).toLowerCase();
  document.documentElement.setAttribute('data-obr-theme', mode === 'light' ? 'light' : 'dark');
}

OBR.onReady(async () => {
  if (typeof OBR.theme?.getTheme === 'function') {
    try {
      const theme = await OBR.theme.getTheme();
      applyOBRTheme(theme);
    } catch (_) {}
    if (typeof OBR.theme?.onChange === 'function') {
      OBR.theme.onChange(applyOBRTheme);
    }
  }
  appController = new AppController();
  appController.init();
});

window.gmIa = {
  getController: () => appController
};
