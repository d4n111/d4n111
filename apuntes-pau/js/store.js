// Ajustes y gasto: se guardan en localStorage. Si el navegador lo bloquea
// (modo privado, etc.), se usa un respaldo en memoria para la sesión actual.

const SETTINGS_KEY = 'apuntesPau.ajustes';
const SPEND_KEY = 'apuntesPau.gasto';
const memory = new Map();

export const DEFAULT_SUBJECTS = [
  'Lengua Castellana y Literatura II',
  'Historia de España',
  'Historia de la Filosofía',
  'Inglés II',
  'Matemáticas II',
  'Física',
  'Química',
  'Biología',
  'Dibujo Técnico II',
  'Otra',
];

const DEFAULTS = {
  apiKey: '',
  model: 'claude-opus-5-5',
  examDate: '2027-06-01',
  region: '',
  subjects: DEFAULT_SUBJECTS,
  criteria: { lengua: '', filosofia: '', historia: '' },
};

export function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw != null) return JSON.parse(raw);
  } catch {
    // Sin localStorage o dato corrupto: se usa la copia en memoria.
  }
  return memory.has(key) ? memory.get(key) : fallback;
}

export function writeJSON(key, value) {
  memory.set(key, value);
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sin localStorage: se queda solo en memoria.
  }
}

export function getSettings() {
  const saved = readJSON(SETTINGS_KEY, {});
  return {
    ...DEFAULTS,
    ...saved,
    subjects: Array.isArray(saved.subjects) && saved.subjects.length ? saved.subjects : DEFAULTS.subjects,
    criteria: { ...DEFAULTS.criteria, ...(saved.criteria || {}) },
  };
}

export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch };
  writeJSON(SETTINGS_KEY, next);
  document.dispatchEvent(new CustomEvent('settings-changed', { detail: next }));
  return next;
}

export function getSpend() {
  return readJSON(SPEND_KEY, { usd: 0, requests: 0, since: new Date().toISOString() });
}

export function addSpend(usd) {
  const spend = getSpend();
  spend.usd += usd;
  spend.requests += 1;
  writeJSON(SPEND_KEY, spend);
  document.dispatchEvent(new CustomEvent('spend-changed', { detail: spend }));
}

export function resetSpend() {
  writeJSON(SPEND_KEY, { usd: 0, requests: 0, since: new Date().toISOString() });
  document.dispatchEvent(new CustomEvent('spend-changed'));
}
