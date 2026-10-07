// Punto de entrada: prepara todas las pestañas.

import { fillSubjectSelects, toast } from './ui.js';
import { currentView, showView } from './nav.js';
import { loadKatex } from './render.js';
import { initNotesDialog } from './notes-dialog.js';
import { initResumir } from './views/resumir.js';
import { initComentario } from './views/comentario.js';
import { initApuntes } from './views/apuntes.js';
import { initEstudiar } from './views/estudiar.js';
import { initAjustes } from './views/ajustes.js';
import { hasKey } from './claude.js';

function start() {
  fillSubjectSelects();
  document.addEventListener('settings-changed', () => fillSubjectSelects());

  initNotesDialog();
  initResumir();
  initComentario();
  initApuntes();
  initEstudiar();
  initAjustes();

  window.addEventListener('popstate', () => showView(currentView()));
  window.addEventListener('hashchange', () => showView(currentView()));
  showView(currentView());

  if (!hasKey() && currentView() !== 'ajustes') {
    toast('👋 Para empezar, añade tu clave de API en Ajustes.');
  }

  // Precarga las fórmulas en segundo plano.
  loadKatex();
}

if (!('indexedDB' in window)) {
  document.body.innerHTML = '<p style="padding:24px">Este navegador no permite guardar datos. Prueba con Chrome, Edge, Firefox o Safari actualizados.</p>';
} else {
  start();
}
