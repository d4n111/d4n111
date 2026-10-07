import { $, chipHtml, subjectHue, fold, formatDate } from '../ui.js';
import { listNotes, listCards } from '../db.js';
import { openNote, openEditor, KIND_LABEL } from '../notes-dialog.js';
import { escapeHtml } from '../render.js';
import { getSettings } from '../store.js';

// Texto plano para la vista previa de la tarjeta.
function snippet(md) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' … ')
    .replace(/\$([^$\n]+)\$/g, (_, tex) => tex.replace(/\\[a-zA-Z]+/g, ' '))
    .replace(/[#>*_`|[\]()-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

export function initApuntes() {
  const search = $('#ap-buscar');
  const subjectFilter = $('#ap-filtro-asig');
  const kindFilter = $('#ap-filtro-tipo');
  const list = $('#ap-lista');

  let notes = [];
  let cardCounts = new Map();

  function fillSubjectFilter() {
    const used = new Set([...getSettings().subjects, ...notes.map((n) => n.subject)]);
    const current = subjectFilter.value;
    subjectFilter.innerHTML = '<option value="">Todas las asignaturas</option>'
      + [...used].map((s) => `<option>${escapeHtml(s)}</option>`).join('');
    subjectFilter.value = used.has(current) ? current : '';
  }

  function render() {
    const q = fold(search.value.trim());
    const subject = subjectFilter.value;
    const kind = kindFilter.value;
    const shown = notes.filter((n) => (!subject || n.subject === subject)
      && (!kind || n.kind === kind)
      && (!q || fold(`${n.title} ${n.topic} ${(n.tags || []).join(' ')} ${n.content}`).includes(q)));

    // Resumen por asignatura (se puede pulsar para filtrar).
    const counts = new Map();
    for (const n of notes) counts.set(n.subject, (counts.get(n.subject) || 0) + 1);
    $('#ap-stats').innerHTML = [...counts]
      .sort((a, b) => b[1] - a[1])
      .map(([s, c]) => `<button type="button" class="chip${s === subject ? ' active' : ''}" style="--h:${subjectHue(s)}" data-subject="${escapeHtml(s)}">${escapeHtml(s)} · ${c}</button>`)
      .join('');

    list.innerHTML = shown.map((n) => `
      <button type="button" class="note-card" data-id="${n.id}">
        <div>${chipHtml(n.subject)}</div>
        <h3>${escapeHtml(n.title)}</h3>
        <p class="note-snippet">${escapeHtml(snippet(n.content))}</p>
        <div class="note-foot">
          <span>${KIND_LABEL[n.kind] || 'Apunte'}${n.topic ? ` · ${escapeHtml(n.topic)}` : ''}</span>
          <span>${cardCounts.get(n.id) ? `🃏 ${cardCounts.get(n.id)} · ` : ''}${formatDate(n.updatedAt)}</span>
        </div>
      </button>`).join('');

    $('#ap-vacio').hidden = notes.length > 0;
    if (notes.length && !shown.length) {
      list.innerHTML = '<p class="empty">No hay apuntes que coincidan con la búsqueda.</p>';
    }
  }

  async function load() {
    const [n, cards] = await Promise.all([listNotes(), listCards()]);
    notes = n;
    cardCounts = new Map();
    for (const c of cards) cardCounts.set(c.noteId, (cardCounts.get(c.noteId) || 0) + 1);
    fillSubjectFilter();
    render();
  }

  search.addEventListener('input', render);
  subjectFilter.addEventListener('change', render);
  kindFilter.addEventListener('change', render);
  $('#ap-stats').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-subject]');
    if (!chip) return;
    subjectFilter.value = subjectFilter.value === chip.dataset.subject ? '' : chip.dataset.subject;
    render();
  });
  list.addEventListener('click', (e) => {
    const card = e.target.closest('.note-card');
    if (card) openNote(card.dataset.id);
  });
  $('#ap-nuevo').onclick = () => openEditor({
    subject: subjectFilter.value || getSettings().subjects[0],
    kind: 'apunte',
    source: 'manual',
  });

  document.addEventListener('data-changed', load);
  document.addEventListener('settings-changed', load);
  load();
}
