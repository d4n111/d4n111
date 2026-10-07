// Piezas de interfaz reutilizables.

import { getSettings } from './store.js';
import { detectKind, formatSize, KIND_ICON } from './files.js';
import { newId } from './db.js';
import { escapeHtml, mdToHtml, loadKatex, renderDiagrams } from './render.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function toast(message, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  const box = $('#toasts');
  box.append(el);
  while (box.children.length > 3) box.firstElementChild.remove();
  setTimeout(() => el.remove(), type === 'error' ? 7000 : 3500);
}

export function radioValue(name) {
  return $(`input[name="${name}"]:checked`)?.value;
}

// Cada asignatura tiene siempre el mismo color.
export function subjectHue(subject) {
  let h = 0;
  for (const ch of subject || '') h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function chipHtml(subject) {
  return `<span class="chip" style="--h:${subjectHue(subject)}">${escapeHtml(subject)}</span>`;
}

// Rellena los <select data-subjects> con las asignaturas de Ajustes.
export function fillSubjectSelects(root = document) {
  const { subjects } = getSettings();
  for (const select of $$('select[data-subjects]', root)) {
    const current = select.value;
    select.innerHTML = subjects.map((s) => `<option>${escapeHtml(s)}</option>`).join('');
    if (subjects.includes(current)) select.value = current;
  }
}

export function setLoading(button, loading, text) {
  if (loading) {
    button.dataset.label ??= button.textContent;
    button.disabled = true;
    button.classList.add('loading');
    if (text) button.textContent = text;
  } else {
    button.disabled = false;
    button.classList.remove('loading');
    if (button.dataset.label) button.textContent = button.dataset.label;
    delete button.dataset.label;
  }
}

export function download(filename, text, type = 'text/markdown') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copiado ✅', 'ok');
  } catch {
    toast('No se ha podido copiar. Selecciona el texto y cópialo a mano.', 'warn');
  }
}

export function slug(s) {
  return String(s || 'apunte').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60) || 'apunte';
}

export function fold(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function formatDate(ts) {
  return new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Imprime (o guarda como PDF) un texto en Markdown.
export async function printMarkdown(title, md) {
  await loadKatex();
  let area = $('#print-area');
  if (!area) {
    area = document.createElement('div');
    area.id = 'print-area';
    document.body.append(area);
  }
  area.innerHTML = `<h1>${escapeHtml(title)}</h1><div class="md">${mdToHtml(md)}</div>`;
  await renderDiagrams(area);
  document.body.classList.add('printing');
  const done = () => {
    document.body.classList.remove('printing');
    area.innerHTML = '';
  };
  window.addEventListener('afterprint', done, { once: true });
  window.print();
}

// ---------- Selector de archivos (arrastrar, elegir o hacer foto) ----------

export function createFilePicker(container, { accept, camera = true, onChange } = {}) {
  container.innerHTML = `
    <div class="drop" tabindex="-1">
      <p>Arrastra aquí los archivos o pega una captura (Ctrl+V)</p>
      <label class="btn small">
        <input type="file" multiple accept="${accept}" hidden>
        📎 Elegir archivos
      </label>
      ${camera ? `<label class="btn small">
        <input type="file" accept="image/*" capture="environment" hidden>
        📷 Hacer foto
      </label>` : ''}
    </div>
    <ul class="file-list"></ul>`;

  const drop = $('.drop', container);
  const list = $('.file-list', container);
  let items = [];

  function render() {
    list.innerHTML = '';
    for (const item of items) {
      const li = document.createElement('li');
      li.innerHTML = `
        ${item.url ? `<img class="file-thumb" src="${item.url}" alt="">` : `<span class="file-thumb">${KIND_ICON[item.kind]}</span>`}
        <span class="file-name">${escapeHtml(item.file.name)}<small>${formatSize(item.file.size)}</small></span>
        <button type="button" class="icon-btn" aria-label="Quitar ${escapeHtml(item.file.name)}">✕</button>`;
      $('button', li).onclick = () => {
        if (item.url) URL.revokeObjectURL(item.url);
        items = items.filter((x) => x !== item);
        render();
        onChange?.(items);
      };
      list.append(li);
    }
  }

  function add(files) {
    for (const file of files) {
      const kind = detectKind(file);
      if (!kind) {
        toast(`No sé leer «${file.name}». Usa fotos, PDF, vídeo, .txt o subtítulos.`, 'warn');
        continue;
      }
      items.push({ id: newId(), file, kind, url: kind === 'image' ? URL.createObjectURL(file) : null });
    }
    render();
    onChange?.(items);
  }

  for (const input of $$('input[type=file]', container)) {
    input.onchange = () => {
      add(input.files);
      input.value = '';
    };
  }
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('over');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    add(e.dataTransfer.files);
  });

  return {
    get items() {
      return items;
    },
    add,
    // Permite pegar capturas de pantalla en `area` (Ctrl+V).
    acceptPasteIn(area) {
      area.addEventListener('paste', (e) => {
        const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
        if (files.length) {
          e.preventDefault();
          add(files);
          toast(`Imagen añadida (${files.length})`, 'ok');
        }
      });
    },
    clear() {
      for (const item of items) if (item.url) URL.revokeObjectURL(item.url);
      items = [];
      render();
      onChange?.(items);
    },
  };
}
