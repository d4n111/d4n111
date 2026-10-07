// Lógica de estudio: tarjetas con repaso espaciado y tests.

import { listNotes, cardsForNote, saveCards, newId } from './db.js';
import { getJSON } from './claude.js';
import { sistemaEstudio, ESQUEMA_TARJETAS, instruccionesTarjetas, ESQUEMA_TEST, instruccionesTest } from './prompts.js';
import { getSettings, readJSON, writeJSON } from './store.js';

const DAY = 24 * 60 * 60 * 1000;
// Días hasta el siguiente repaso según la «caja» de la tarjeta (1 a 6).
const INTERVALS = [0, 1, 2, 4, 8, 16, 30];
// Límite de apuntes que se envían de golpe (≈ 100.000 tokens).
export const MAX_NOTES_CHARS = 400000;

export function startOfDay(ts = Date.now()) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function isDue(card, now = Date.now()) {
  return card.due < startOfDay(now) + DAY;
}

export function examTime() {
  const t = Date.parse(`${getSettings().examDate}T09:00:00`);
  return Number.isFinite(t) ? t : null;
}

// Programa el siguiente repaso: «mal» vuelve a la caja 1 (hoy mismo),
// «regular» se repite mañana y «bien» sube de caja (cada vez más tarde).
export function grade(card, result) {
  const now = Date.now();
  let box = card.box || 1;
  let days;
  if (result === 'mal') {
    box = 1;
    days = 0;
  } else if (result === 'regular') {
    days = 1;
  } else {
    box = Math.min(box + 1, INTERVALS.length - 1);
    days = INTERVALS[box];
  }
  let due = days === 0 ? now : startOfDay(now) + days * DAY;
  // Ninguna tarjeta se queda sin repasar antes del examen.
  const exam = examTime();
  if (exam && exam > now) due = Math.min(due, Math.max(startOfDay(now) + DAY, startOfDay(exam) - DAY));
  return { ...card, box, due, reviewedAt: now };
}

export async function generateCards(note) {
  const existing = await cardsForNote(note.id);
  const { tarjetas } = await getJSON({
    system: sistemaEstudio(),
    prompt: instruccionesTarjetas(note, existing),
    schema: ESQUEMA_TARJETAS,
  });
  const now = Date.now();
  const cards = tarjetas
    .filter((t) => t.pregunta?.trim() && t.respuesta?.trim())
    .map((t) => ({
      id: newId(),
      noteId: note.id,
      subject: note.subject,
      front: t.pregunta.trim(),
      back: t.respuesta.trim(),
      box: 1,
      due: now,
      createdAt: now,
      reviewedAt: null,
    }));
  await saveCards(cards);
  return cards;
}

// Junta los apuntes de una asignatura (o uno concreto), del más reciente al
// más antiguo, hasta el límite de tamaño.
export async function gatherNotes({ subject, noteId }) {
  const all = await listNotes();
  const pool = noteId ? all.filter((n) => n.id === noteId) : all.filter((n) => n.subject === subject);
  const notes = [];
  let chars = 0;
  for (const note of pool) {
    if (notes.length && chars + note.content.length > MAX_NOTES_CHARS) break;
    notes.push(note);
    chars += note.content.length;
  }
  return { notes, total: pool.length, chars };
}

export async function generateQuiz({ subject, notes, num }) {
  const { preguntas } = await getJSON({
    system: sistemaEstudio(),
    prompt: instruccionesTest(subject, notes, num),
    schema: ESQUEMA_TEST,
  });
  return preguntas.filter((p) => p.opciones?.length >= 2 && p.correcta >= 0 && p.correcta < p.opciones.length);
}

const TESTS_KEY = 'apuntesPau.tests';

export function testHistory() {
  return readJSON(TESTS_KEY, []);
}

export function recordTest(entry) {
  writeJSON(TESTS_KEY, [{ ...entry, date: Date.now() }, ...testHistory()].slice(0, 30));
}
