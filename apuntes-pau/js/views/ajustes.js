import { $, toast, setLoading, download } from '../ui.js';
import { getSettings, saveSettings, getSpend, resetSpend } from '../store.js';
import { MODELS, modelInfo, testKey, friendlyError } from '../claude.js';
import { exportData, importData, listNotes, listCards } from '../db.js';
import { formatUsd } from '../output.js';

export function initAjustes() {
  const s = getSettings();
  const keyInput = $('#aj-key');
  const modelSelect = $('#aj-modelo');

  // ---------- Clave y modelo ----------
  keyInput.value = s.apiKey;
  $('#aj-key-ver').onclick = () => {
    const show = keyInput.type === 'password';
    keyInput.type = show ? 'text' : 'password';
    $('#aj-key-ver').textContent = show ? 'Ocultar' : 'Mostrar';
  };
  $('#aj-key-guardar').onclick = async () => {
    const apiKey = keyInput.value.trim();
    if (!apiKey) {
      toast('Pega primero tu clave de API.', 'warn');
      return;
    }
    saveSettings({ apiKey });
    const button = $('#aj-key-guardar');
    setLoading(button, true, 'Probando…');
    try {
      await testKey();
      toast('¡Clave correcta! Ya puedes usar la web ✅', 'ok');
    } catch (err) {
      toast(friendlyError(err), 'error');
    } finally {
      setLoading(button, false);
    }
  };
  $('#aj-key-borrar').onclick = () => {
    if (!confirm('¿Borrar la clave de este navegador?')) return;
    keyInput.value = '';
    saveSettings({ apiKey: '' });
    toast('Clave borrada.');
  };

  modelSelect.innerHTML = MODELS.map((m) => `<option value="${m.id}">${m.name}</option>`).join('');
  modelSelect.value = modelInfo(s.model).id;
  const modelHint = () => {
    const { price } = modelInfo(modelSelect.value);
    $('#aj-modelo-info').textContent = `Precio: ${price.input} $ por millón de tokens de entrada y ${price.output} $ por millón de salida. Un resumen normal cuesta unos céntimos.`;
  };
  modelSelect.onchange = () => {
    saveSettings({ model: modelSelect.value });
    modelHint();
    toast('Modelo cambiado.', 'ok');
  };
  modelHint();

  // ---------- PAU ----------
  $('#aj-fecha').value = s.examDate;
  $('#aj-fecha').onchange = (e) => saveSettings({ examDate: e.target.value });
  $('#aj-region').value = s.region;
  $('#aj-region').onchange = (e) => saveSettings({ region: e.target.value.trim() });

  $('#aj-asignaturas').value = s.subjects.join('\n');
  $('#aj-asignaturas').onchange = (e) => {
    const subjects = [...new Set(e.target.value.split('\n').map((x) => x.trim()).filter(Boolean))];
    if (!subjects.length) {
      toast('Deja al menos una asignatura.', 'warn');
      return;
    }
    saveSettings({ subjects });
    toast('Asignaturas guardadas.', 'ok');
  };

  for (const asig of ['lengua', 'filosofia', 'historia']) {
    const area = $(`#aj-crit-${asig}`);
    area.value = s.criteria[asig];
    area.onchange = () => saveSettings({ criteria: { ...getSettings().criteria, [asig]: area.value } });
  }

  // ---------- Gasto ----------
  const renderSpend = () => {
    const spend = getSpend();
    const since = new Date(spend.since).toLocaleDateString('es-ES');
    $('#aj-gasto').textContent = `≈ ${formatUsd(spend.usd)}`;
    $('#aj-gasto').title = `${spend.requests} peticiones desde el ${since}`;
    $('#aj-gasto').nextElementSibling.textContent = `${spend.requests} peticiones desde el ${since}. Es una estimación; el gasto real lo ves en console.anthropic.com.`;
  };
  $('#aj-gasto-reset').onclick = () => {
    resetSpend();
    renderSpend();
  };
  document.addEventListener('spend-changed', renderSpend);
  renderSpend();

  // ---------- Copia de seguridad ----------
  const renderDataInfo = async () => {
    const [notes, cards] = await Promise.all([listNotes(), listCards()]);
    $('#aj-datos-info').textContent = `Ahora mismo tienes ${notes.length} apuntes y ${cards.length} tarjetas en este navegador.`;
  };
  $('#aj-exportar').onclick = async () => {
    const data = await exportData();
    const date = new Date().toISOString().slice(0, 10);
    download(`apuntes-pau-${date}.json`, JSON.stringify(data, null, 1), 'application/json');
    toast('Copia descargada ✅', 'ok');
  };
  $('#aj-importar').onchange = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { notes, cards } = await importData(JSON.parse(await file.text()));
      toast(`Copia cargada: ${notes} apuntes y ${cards} tarjetas ✅`, 'ok');
    } catch (err) {
      toast(err instanceof SyntaxError ? 'El archivo no es válido.' : err.message, 'error');
    }
  };
  document.addEventListener('data-changed', renderDataInfo);
  renderDataInfo();
}
