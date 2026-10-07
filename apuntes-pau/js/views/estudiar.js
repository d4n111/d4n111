import { $, $$, toast, radioValue, setLoading, subjectHue } from '../ui.js';
import { listNotes, listCards, saveCards, deleteCard } from '../db.js';
import { isDue, grade, examTime, startOfDay, gatherNotes, generateQuiz, testHistory, recordTest } from '../study.js';
import { friendlyError, modelInfo } from '../claude.js';
import { createOutput, formatUsd } from '../output.js';
import { sistemaPreguntar } from '../prompts.js';
import { mdToHtml, mdInlineToHtml, loadKatex, escapeHtml } from '../render.js';
import { getSettings } from '../store.js';

const DAY = 24 * 60 * 60 * 1000;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

// ===================== Cuenta atrás =====================

function updateCountdown() {
  const exam = examTime();
  const pill = $('#countdown-pill');
  if (!exam) {
    pill.hidden = true;
    $('#cd-dias').textContent = '—';
    $('#cd-texto').textContent = 'Pon la fecha de la PAU en Ajustes.';
    return;
  }
  const days = Math.round((startOfDay(exam) - startOfDay()) / DAY);
  const now = new Date();
  const courseStart = new Date(now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1, 8, 15).getTime();
  const pct = Math.min(100, Math.max(0, ((Date.now() - courseStart) / (exam - courseStart)) * 100));
  const fecha = new Date(exam).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  $('#cd-bar').style.width = `${pct}%`;
  if (days > 0) {
    $('#cd-dias').textContent = days;
    $('#cd-label').textContent = days === 1 ? 'día para la PAU' : 'días para la PAU';
    $('#cd-texto').textContent = `PAU: ${fecha}. Unas ${Math.ceil(days / 7)} semanas: ¡a por ello! 💪`;
    pill.textContent = `PAU en ${days} d`;
    pill.hidden = false;
  } else if (days === 0) {
    $('#cd-dias').textContent = '🍀';
    $('#cd-label').textContent = '¡Hoy es la PAU!';
    $('#cd-texto').textContent = 'Mucha suerte. Lo has preparado bien.';
    pill.textContent = '¡Hoy es la PAU!';
    pill.hidden = false;
  } else {
    $('#cd-dias').textContent = '✓';
    $('#cd-label').textContent = 'La PAU ya ha pasado';
    $('#cd-texto').textContent = 'Si tienes otra convocatoria, cambia la fecha en Ajustes.';
    pill.hidden = true;
  }
}

// ===================== Tarjetas =====================

function initTarjetas() {
  const select = $('#tj-asig');
  let cards = [];
  let session = null;

  async function refresh() {
    cards = await listCards();
    const subjects = [...new Set(cards.map((c) => c.subject))].sort();
    const current = select.value;
    select.innerHTML = '<option value="">Todas las asignaturas</option>'
      + subjects.map((s) => `<option>${escapeHtml(s)}</option>`).join('');
    select.value = subjects.includes(current) ? current : '';
    summary();
  }

  function filtered() {
    return select.value ? cards.filter((c) => c.subject === select.value) : cards;
  }

  function summary() {
    const pool = filtered();
    const due = pool.filter((c) => isDue(c));
    $('#tj-resumen').innerHTML = pool.length
      ? `Para hoy: <b>${plural(due.length, 'tarjeta', 'tarjetas')}</b> · En total: ${pool.length}`
      : 'Todavía no tienes tarjetas. Créalas desde un apunte.';
    $('#tj-empezar').disabled = !due.length;
    $('#tj-todas').hidden = !pool.length || due.length === pool.length;
  }

  function start(queue) {
    session = { queue: shuffle(queue), pos: 0, retries: new Map(), stats: { bien: 0, regular: 0, mal: 0 } };
    $('#tj-sesion').hidden = false;
    $('#tj-fin').hidden = true;
    $('.flashcard', $('#tj-sesion')).hidden = false;
    $('#tj-sesion').scrollIntoView({ behavior: 'smooth', block: 'start' });
    show();
  }

  async function show() {
    const card = session.queue[session.pos];
    if (!card) {
      finish();
      return;
    }
    await loadKatex();
    const chip = $('#tj-chip');
    chip.textContent = card.subject;
    chip.style.setProperty('--h', subjectHue(card.subject));
    $('#tj-progreso').textContent = `${session.pos + 1} / ${session.queue.length}`;
    $('#tj-front').innerHTML = mdToHtml(card.front);
    $('#tj-back').innerHTML = mdToHtml(card.back);
    $('#tj-back').hidden = true;
    $('#tj-acciones-ver').hidden = false;
    $('#tj-acciones-nota').hidden = true;
    $('#tj-borrar').hidden = false;
    $('#tj-ver').focus();
  }

  function finish() {
    const { bien, regular, mal } = session.stats;
    $('.flashcard', $('#tj-sesion')).hidden = true;
    $('#tj-acciones-ver').hidden = true;
    $('#tj-acciones-nota').hidden = true;
    $('#tj-borrar').hidden = true;
    $('#tj-progreso').textContent = '';
    $('#tj-fin').hidden = false;
    $('#tj-fin').innerHTML = `
      <p class="big-emoji">🎉</p>
      <h2>¡Repaso terminado!</h2>
      <p>😄 ${bien} me la sabía · 🤔 ${regular} más o menos · 😕 ${mal} no me la sabía</p>
      <div class="actions center"><button type="button" class="btn primary" id="tj-cerrar">Hecho</button></div>`;
    $('#tj-cerrar').onclick = () => {
      $('#tj-sesion').hidden = true;
      session = null;
    };
    refresh();
  }

  $('#tj-empezar').onclick = () => start(filtered().filter((c) => isDue(c)));
  $('#tj-todas').onclick = () => start(filtered());
  select.addEventListener('change', summary);

  $('#tj-ver').onclick = () => {
    $('#tj-back').hidden = false;
    $('#tj-acciones-ver').hidden = true;
    $('#tj-acciones-nota').hidden = false;
  };

  for (const button of $$('[data-grade]', $('#tj-acciones-nota'))) {
    button.onclick = async () => {
      const result = button.dataset.grade;
      const card = session.queue[session.pos];
      session.stats[result] += 1;
      // Las que fallas vuelven a salir al final del repaso (una vez más).
      const retries = session.retries.get(card.id) || 0;
      if (result === 'mal' && retries < 1) {
        session.retries.set(card.id, retries + 1);
        session.queue.push(card);
      }
      await saveCards([grade(card, result)]);
      session.pos += 1;
      show();
    };
  }

  $('#tj-borrar').onclick = async () => {
    const card = session.queue[session.pos];
    if (!confirm('¿Borrar esta tarjeta?')) return;
    await deleteCard(card.id);
    session.queue = session.queue.filter((c, i) => i < session.pos || c.id !== card.id);
    show();
  };

  document.addEventListener('data-changed', () => {
    if (!session) refresh();
  });
  refresh();
}

// ===================== Test =====================

function initTest() {
  const subjectSelect = $('#ts-asig');
  const noteSelect = $('#ts-apunte');
  const quiz = $('#ts-quiz');
  let notes = [];

  async function refresh() {
    notes = await listNotes();
    const { subjects } = getSettings();
    const all = [...new Set([...notes.map((n) => n.subject), ...subjects])];
    const withNotes = all.filter((s) => notes.some((n) => n.subject === s));
    const current = subjectSelect.value;
    subjectSelect.innerHTML = (withNotes.length ? withNotes : all).map((s) => `<option>${escapeHtml(s)}</option>`).join('');
    if ([...subjectSelect.options].some((o) => o.value === current)) subjectSelect.value = current;
    fillNotes();
    renderHistory();
  }

  function fillNotes() {
    const current = noteSelect.value;
    const mine = notes.filter((n) => n.subject === subjectSelect.value);
    noteSelect.innerHTML = `<option value="">Todos los apuntes (${mine.length})</option>`
      + mine.map((n) => `<option value="${n.id}">${escapeHtml(n.title)}</option>`).join('');
    if (mine.some((n) => n.id === current)) noteSelect.value = current;
  }

  function renderHistory() {
    const last = testHistory().slice(0, 4);
    $('#ts-historial').textContent = last.length
      ? `Últimos tests: ${last.map((t) => `${t.score}/${t.total} en ${t.subject}`).join(' · ')}`
      : '';
  }

  function renderQuiz(subject, preguntas, aviso) {
    quiz.innerHTML = `
      <div class="card">
        <h2>📝 Test de ${escapeHtml(subject)}</h2>
        ${aviso ? `<p class="hint">${escapeHtml(aviso)}</p>` : ''}
        <form id="ts-form">
          ${preguntas.map((p, i) => `
            <fieldset class="quiz-q" data-q="${i}">
              <legend>Pregunta ${i + 1}</legend>
              <div class="enunciado md">${mdToHtml(p.enunciado)}</div>
              ${p.opciones.map((o, j) => `
                <label class="quiz-opt" data-o="${j}">
                  <input type="radio" name="q${i}" value="${j}">
                  <span class="md">${mdInlineToHtml(o)}</span>
                </label>`).join('')}
              <div class="quiz-exp md" hidden>${mdToHtml(`**Explicación:** ${p.explicacion}`)}</div>
            </fieldset>`).join('')}
          <div class="actions center"><button type="submit" class="btn primary big">Corregir</button></div>
        </form>
        <div id="ts-nota" hidden></div>
      </div>`;

    const form = $('#ts-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let score = 0;
      preguntas.forEach((p, i) => {
        const fs = $(`[data-q="${i}"]`, form);
        const chosen = form.elements[`q${i}`].value;
        if (Number(chosen) === p.correcta && chosen !== '') score += 1;
        $(`[data-o="${p.correcta}"]`, fs).classList.add('correct');
        if (chosen !== '' && Number(chosen) !== p.correcta) $(`[data-o="${chosen}"]`, fs).classList.add('wrong');
        $('.quiz-exp', fs).hidden = false;
        for (const input of $$('input', fs)) input.disabled = true;
      });
      $('button[type=submit]', form).hidden = true;
      const nota = (score / preguntas.length) * 10;
      const emoji = nota >= 9 ? '🏆' : nota >= 7 ? '🎉' : nota >= 5 ? '👍' : '💪';
      $('#ts-nota').hidden = false;
      $('#ts-nota').innerHTML = `
        <div class="quiz-score">
          <p class="big-number">${emoji} ${score}/${preguntas.length}</p>
          <p>Nota: <b>${nota.toLocaleString('es-ES', { maximumFractionDigits: 1 })}</b> · Revisa las explicaciones de las que has fallado.</p>
          <div class="actions center"><button type="button" class="btn primary" id="ts-otro">Otro test</button></div>
        </div>`;
      $('#ts-otro').onclick = () => $('#ts-go').click();
      $('#ts-nota').scrollIntoView({ behavior: 'smooth', block: 'center' });
      recordTest({ subject, score, total: preguntas.length });
      renderHistory();
    });
  }

  async function generate() {
    const button = $('#ts-go');
    const subject = subjectSelect.value;
    const noteId = noteSelect.value || null;
    const { notes: chosen, total } = await gatherNotes({ subject, noteId });
    if (!chosen.length) {
      toast(`No tienes apuntes guardados de ${subject}.`, 'warn');
      return;
    }
    setLoading(button, true, 'Creando test…');
    quiz.innerHTML = '<div class="card"><div class="out-status"><span class="spinner"></span>Claude está preparando tus preguntas…</div></div>';
    try {
      await loadKatex();
      const preguntas = await generateQuiz({ subject, notes: chosen, num: Number($('#ts-num').value) });
      if (!preguntas.length) throw new Error('No se han podido crear preguntas. Inténtalo de nuevo.');
      const aviso = total > chosen.length ? `Se han usado tus ${chosen.length} apuntes más recientes de ${total}, para no gastar de más.` : '';
      renderQuiz(subject, preguntas, aviso);
      quiz.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      quiz.innerHTML = `<div class="card"><div class="notice error"><p>${escapeHtml(friendlyError(err))}</p></div></div>`;
    } finally {
      setLoading(button, false);
    }
  }

  subjectSelect.addEventListener('change', fillNotes);
  $('#ts-go').onclick = generate;
  document.addEventListener('data-changed', refresh);
  document.addEventListener('settings-changed', refresh);

  return {
    refresh,
    async startFor(subject, noteId) {
      await refresh();
      subjectSelect.value = subject;
      fillNotes();
      noteSelect.value = noteId || '';
      generate();
    },
  };
}

// ===================== Pregunta a tus apuntes =====================

function initPreguntar() {
  const select = $('#pq-asig');
  const output = createOutput($('#pq-output'));

  async function refresh() {
    const notes = await listNotes();
    const { subjects } = getSettings();
    const all = [...new Set([...notes.map((n) => n.subject), ...subjects])];
    const current = select.value;
    select.innerHTML = all.map((s) => {
      const n = notes.filter((x) => x.subject === s).length;
      return `<option value="${escapeHtml(s)}">${escapeHtml(s)}${n ? ` (${n})` : ''}</option>`;
    }).join('');
    if (all.includes(current)) select.value = current;
    info();
  }

  async function info() {
    const { notes, total, chars } = await gatherNotes({ subject: select.value });
    if (!notes.length) {
      $('#pq-info').textContent = 'No tienes apuntes de esta asignatura todavía. Claude responderá con lo que sabe, avisándote.';
      return;
    }
    const tokens = Math.round(chars / 4);
    const { price } = modelInfo(getSettings().model);
    const cost = (tokens * price.input) / 1e6;
    $('#pq-info').textContent = `Claude leerá ${plural(notes.length, 'apunte', 'apuntes')}${total > notes.length ? ` (los más recientes de ${total})` : ''}: unos ${tokens.toLocaleString('es-ES')} tokens, ≈ ${formatUsd(cost)} la primera pregunta. Las siguientes salen más baratas.`;
  }

  $('#pq-go').onclick = async () => {
    if (output.busy) return;
    const question = $('#pq-pregunta').value.trim();
    if (!question) {
      toast('Escribe tu pregunta.', 'warn');
      return;
    }
    const subject = select.value;
    const button = $('#pq-go');
    setLoading(button, true);
    try {
      const { notes } = await gatherNotes({ subject });
      await output.run({
        system: sistemaPreguntar(subject, notes),
        content: question,
        effort: 'medium',
        save: { title: question.slice(0, 90), subject, kind: 'respuesta', source: 'apuntes' },
      });
    } finally {
      setLoading(button, false);
    }
  };

  select.addEventListener('change', info);
  document.addEventListener('data-changed', refresh);
  document.addEventListener('settings-changed', refresh);
  refresh();

  return {
    async focusOn(subject) {
      await refresh();
      if ([...select.options].some((o) => o.value === subject)) select.value = subject;
      info();
      $('#pq-pregunta').focus();
    },
  };
}

// ===================== Vista =====================

export function initEstudiar() {
  const panels = { tarjetas: $('#est-tarjetas'), test: $('#est-test'), preguntar: $('#est-preguntar') };

  function showMode(mode) {
    for (const [name, panel] of Object.entries(panels)) panel.hidden = name !== mode;
    const radio = $(`input[name="est-modo"][value="${mode}"]`);
    if (radio) radio.checked = true;
  }
  for (const radio of $$('input[name="est-modo"]')) radio.addEventListener('change', () => showMode(radioValue('est-modo')));

  initTarjetas();
  const test = initTest();
  const preguntar = initPreguntar();
  test.refresh();

  updateCountdown();
  document.addEventListener('settings-changed', updateCountdown);
  document.addEventListener('view-shown', (e) => {
    if (e.detail === 'estudiar') updateCountdown();
  });

  document.addEventListener('intent:estudiar', (e) => {
    const { action, subject, noteId } = e.detail;
    if (action === 'test') {
      showMode('test');
      test.startFor(subject, noteId);
    } else if (action === 'preguntar') {
      showMode('preguntar');
      preguntar.focusOn(subject);
    }
  });
}
