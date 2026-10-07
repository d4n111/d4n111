import { $, $$, toast, radioValue, createFilePicker, setLoading, formatDate } from '../ui.js';
import { createOutput } from '../output.js';
import { filesToBlocks } from '../files.js';
import { COMENTARIOS, sistemaComentario, instruccionesComentario } from '../prompts.js';
import { renderMarkdown } from '../render.js';
import { getSettings } from '../store.js';

const BOTON = { modelo: 'Hacer comentario', guia: 'Guíame', corregir: 'Corregir mi comentario' };
const ACCEPT = 'image/*,application/pdf,.txt,.md';

// Busca en Ajustes el nombre de asignatura que corresponde (para guardar).
function subjectFor(asig) {
  const { subjects } = getSettings();
  const key = { lengua: 'lengua', filosofia: 'filosof', historia: 'historia de espa' }[asig];
  return subjects.find((s) => s.toLowerCase().includes(key)) || COMENTARIOS[asig].nombre;
}

export function initComentario() {
  const view = $('#view-comentario');
  const button = $('#com-go');
  const output = createOutput($('#com-output'));
  const textoPicker = createFilePicker($('#com-files'), { accept: ACCEPT });
  const mioPicker = createFilePicker($('#com-mio-files'), { accept: ACCEPT });
  textoPicker.acceptPasteIn($('#com-texto'));
  mioPicker.acceptPasteIn($('#com-mio'));

  function update() {
    const asig = radioValue('com-asig');
    const modo = radioValue('com-modo');
    $('#com-mio-wrap').hidden = modo !== 'corregir';
    button.textContent = BOTON[modo];
    renderMarkdown($('#com-estructura-body'), COMENTARIOS[asig].estructura);
    const criterios = getSettings().criteria[asig]?.trim();
    $('#com-estructura summary').textContent = criterios
      ? 'Ver la estructura (además se aplicarán tus criterios de Ajustes)'
      : 'Ver la estructura que se va a seguir';
  }
  for (const input of $$('input[name="com-asig"], input[name="com-modo"]', view)) input.addEventListener('change', update);
  document.addEventListener('settings-changed', update);
  update();

  button.onclick = async () => {
    if (output.busy) return;
    const asig = radioValue('com-asig');
    const modo = radioValue('com-modo');
    const texto = $('#com-texto').value.trim();
    const mio = $('#com-mio').value.trim();
    const datos = $('#com-datos').value.trim();

    if (!texto && !textoPicker.items.length) {
      toast('Pega el texto o añade una foto o PDF del texto.', 'warn');
      return;
    }
    if (modo === 'corregir' && !mio && !mioPicker.items.length) {
      toast('Escribe tu comentario o añade fotos de él para poder corregirlo.', 'warn');
      return;
    }

    setLoading(button, true);
    try {
      output.prepare('Preparando…');
      const content = [];
      // Texto a comentar
      const textoFiles = await filesToBlocks(textoPicker.items);
      content.push({ type: 'text', text: 'TEXTO A COMENTAR:' });
      content.push(...textoFiles.blocks);
      if (texto) content.push({ type: 'text', text: `<texto_a_comentar>\n${texto}\n</texto_a_comentar>` });
      // Comentario del alumno
      if (modo === 'corregir') {
        const mioFiles = await filesToBlocks(mioPicker.items);
        content.push({ type: 'text', text: 'MI COMENTARIO (el que tienes que corregir):' });
        content.push(...mioFiles.blocks);
        if (mio) content.push({ type: 'text', text: `<mi_comentario>\n${mio}\n</mi_comentario>` });
      }
      content.push({ type: 'text', text: instruccionesComentario({ asig, modo, datos }) });

      const tipo = { modelo: 'Comentario', guia: 'Guía de comentario', corregir: 'Corrección de comentario' }[modo];
      await output.run({
        system: sistemaComentario(asig),
        content,
        effort: 'high',
        save: {
          title: `${tipo}${datos ? ` · ${datos}` : ''} (${formatDate(Date.now())})`,
          subject: subjectFor(asig),
          topic: datos,
          kind: 'comentario',
          source: textoPicker.items.length ? 'foto' : 'texto',
        },
      });
    } catch (err) {
      output.fail(err.message);
    } finally {
      setLoading(button, false);
      button.textContent = BOTON[radioValue('com-modo')];
    }
  };
}
