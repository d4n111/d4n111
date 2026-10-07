// Navegación entre pestañas (#resumir, #comentario, …).

export const VIEWS = ['resumir', 'comentario', 'apuntes', 'estudiar', 'ajustes'];

export function currentView() {
  const name = location.hash.slice(1);
  return VIEWS.includes(name) ? name : 'resumir';
}

export function showView(name) {
  if (!VIEWS.includes(name)) name = 'resumir';
  for (const section of document.querySelectorAll('.view')) section.hidden = section.dataset.view !== name;
  for (const tab of document.querySelectorAll('[data-tab]')) {
    const active = tab.dataset.tab === name;
    tab.classList.toggle('active', active);
    if (active) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }
  document.dispatchEvent(new CustomEvent('view-shown', { detail: name }));
}

// Cambia de pestaña. `intent` permite pedirle algo a la pestaña de destino
// (por ejemplo, «haz un test de este apunte»).
export function goTo(name, intent) {
  if (location.hash !== `#${name}`) history.pushState(null, '', `#${name}`);
  showView(name);
  window.scrollTo({ top: 0 });
  if (intent) document.dispatchEvent(new CustomEvent(`intent:${name}`, { detail: intent }));
}
