// Ventana para ver, crear y editar un apunte.

import { getNote, saveNote, deleteNote, cardsForNote } from './db.js';
import { generateCards } from './study.js';
import { friendlyError } from './claude.js';
import { renderFinal, escapeHtml } from './render.js';
import { $, toast, chipHtml, fillSubjectSelects, setLoading, copyText, download, slug, formatDate } from './ui.js';
import { goTo } from './nav.js';

export const KIND_LABEL = { resumen: 'Resumen', comentario: 'Comentario', apunte: 'Nota propia', respuesta: 'Respuesta' };

let current = null; // apunte guardado que se está viendo o editando
let draft = null; // datos de un apunte nuevo (aún sin guardar)
let snapshot = ''; // para saber si hay cambios sin guardar

const dialog = () => $('#note-dialog');
const form = () => $('#nd-form');

export async function openNote(id) {
  const note = await getNote(id);
  if (!note) {
    toast('Ese apunte ya no existe.', 'warn');
    return;
  }
  current = note;
  draft = null;
  if (!dialog().open) dialog().showModal();
  await showNote();
}

// Abre el editor. Sin `id` crea un apunte nuevo con esos datos por defecto.
export function openEditor(data = {}) {
  current = data.id ? data : null;
  draft = data.id ? null : data;
  if (!dialog().open) dialog().showModal();
  showEditor(data);
}

async function showNote() {
  const note = current;
  const cards = await cardsForNote(note.id);
  $('#nd-titulo').textContent = note.title;
  $('#nd-meta').innerHTML = [
    chipHtml(note.subject),
    note.topic && `<span class="chip plain">${escapeHtml(note.topic)}</span>`,
    `<span class="chip plain">${KIND_LABEL[note.kind] || 'Apunte'}</span>`,
    ...(note.tags || []).map((t) => `<span class="chip plain">#${escapeHtml(t)}</span>`),
    `<span class="chip plain">${formatDate(note.updatedAt)}</span>`,
    cards.length && `<span class="chip plain">🃏 ${cards.length} tarjetas</span>`,
  ].filter(Boolean).join('');
  $('#nd-body').hidden = false;
  form().hidden = true;
  $('#nd-actions-view').hidden = false;
  $('#nd-actions-edit').hidden = true;
  $('.sheet-body', dialog()).scrollTop = 0;
  await renderFinal($('#nd-body'), note.content);
}

function formValues() {
  const f = form().elements;
  return {
    title: f.title.value.trim(),
    subject: f.subject.value,
    topic: f.topic.value.trim(),
    tags: f.tags.value.split(',').map((t) => t.trim()).filter(Boolean),
    content: f.content.value,
  };
}

function showEditor(data) {
  $('#nd-titulo').textContent = data.id ? 'Editar apunte' : 'Guardar apunte';
  $('#nd-meta').innerHTML = '';
  const f = form().elements;
  fillSubjectSelects(form());
  if (data.subject && ![...f.subject.options].some((o) => o.value === data.subject)) {
    f.subject.add(new Option(data.subject, data.subject));
  }
  f.title.value = data.title || '';
  f.subject.value = data.subject || f.subject.options[0]?.value || '';
  f.topic.value = data.topic || '';
  f.tags.value = (data.tags || []).join(', ');
  f.content.value = data.content || '';
  $('#nd-preview').hidden = true;
  f.content.hidden = false;
  $('#nd-preview-btn').textContent = 'Vista previa';
  $('#nd-body').hidden = true;
  form().hidden = false;
  $('#nd-actions-view').hidden = true;
  $('#nd-actions-edit').hidden = false;
  snapshot = JSON.stringify(formValues());
  (data.title ? f.content : f.title).focus();
}

function isEditing() {
  return dialog().open && !form().hidden;
}

function hasUnsavedChanges() {
  return isEditing() && JSON.stringify(formValues()) !== snapshot;
}

function confirmDiscard() {
  return !hasUnsavedChanges() || confirm('Tienes cambios sin guardar. ¿Salir sin guardar?');
}

async function save() {
  const values = formValues();
  if (!values.title) {
    toast('Ponle un título al apunte.', 'warn');
    form().elements.title.focus();
    return;
  }
  if (!values.content.trim()) {
    toast('El apunte está vacío.', 'warn');
    return;
  }
  const button = $('#nd-guardar');
  setLoading(button, true);
  try {
    current = await saveNote({ ...(current || draft || {}), ...values });
    draft = null;
    toast('Guardado en Mis apuntes ✅', 'ok');
    await showNote();
  } catch (err) {
    toast(`No se ha podido guardar: ${err.message}`, 'error');
  } finally {
    setLoading(button, false);
  }
}

export function initNotesDialog() {
  const dlg = dialog();

  $('[data-close]', dlg).onclick = () => {
    if (confirmDiscard()) dlg.close();
  };
  dlg.addEventListener('cancel', (e) => {
    if (!confirmDiscard()) e.preventDefault();
  });
  dlg.addEventListener('close', () => {
    $('#nd-body').innerHTML = '';
  });
  // Si se cambia de pestaña (por ejemplo, con «atrás»), se cierra el apunte.
  document.addEventListener('view-shown', () => {
    if (dlg.open && !hasUnsavedChanges()) dlg.close();
  });

  $('#nd-editar').onclick = () => showEditor(current);
  $('#nd-guardar').onclick = save;
  form().addEventListener('submit', (e) => {
    e.preventDefault();
    save();
  });
  $('#nd-cancelar').onclick = () => {
    if (!confirmDiscard()) return;
    if (current) showNote();
    else dlg.close();
  };

  $('#nd-preview-btn').onclick = async () => {
    const preview = $('#nd-preview');
    const textarea = form().elements.content;
    const showing = !preview.hidden;
    preview.hidden = showing;
    textarea.hidden = !showing;
    $('#nd-preview-btn').textContent = showing ? 'Vista previa' : 'Volver a editar';
    if (!showing) await renderFinal(preview, textarea.value);
  };

  $('#nd-tarjetas').onclick = async () => {
    const button = $('#nd-tarjetas');
    setLoading(button, true, 'Creando tarjetas…');
    try {
      const cards = await generateCards(current);
      toast(`🃏 ${cards.length} tarjetas nuevas. Repásalas en Estudiar.`, 'ok');
      if (dlg.open && current) await showNote();
    } catch (err) {
      toast(friendlyError(err), 'error');
    } finally {
      setLoading(button, false);
    }
  };

  $('#nd-test').onclick = () => {
    dlg.close();
    goTo('estudiar', { action: 'test', subject: current.subject, noteId: current.id });
  };

  $('#nd-preguntar').onclick = () => {
    dlg.close();
    goTo('estudiar', { action: 'preguntar', subject: current.subject });
  };

  $('#nd-copiar').onclick = () => copyText(current.content);

  $('#nd-descargar').onclick = () => download(`${slug(current.title)}.md`, `# ${current.title}\n\n${current.content}\n`);

  $('#nd-borrar').onclick = async () => {
    const cards = await cardsForNote(current.id);
    const extra = cards.length ? ` y sus ${cards.length} tarjetas` : '';
    if (!confirm(`¿Borrar «${current.title}»${extra}? No se puede deshacer.`)) return;
    await deleteNote(current.id);
    dlg.close();
    toast('Apunte borrado.');
  };
}
