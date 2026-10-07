import { $, toast, radioValue, createFilePicker, setLoading, formatDate } from '../ui.js';
import { createOutput } from '../output.js';
import { filesToBlocks } from '../files.js';
import { sistemaResumen, instruccionesResumen } from '../prompts.js';

export function initResumir() {
  const view = $('#view-resumir');
  const button = $('#res-go');
  const output = createOutput($('#res-output'));
  const picker = createFilePicker($('#res-files'), {
    accept: 'image/*,application/pdf,video/*,.txt,.md,.srt,.vtt',
    onChange: (items) => {
      $('#res-video-opts').hidden = !items.some((i) => i.kind === 'video');
    },
  });
  picker.acceptPasteIn(view);

  button.onclick = async () => {
    if (output.busy) return;
    const texto = $('#res-texto').value.trim();
    const transcripcion = $('#res-transcripcion').value.trim();
    const items = picker.items;
    if (!texto && !items.length) {
      toast('Pega un texto o añade algún archivo.', 'warn');
      return;
    }

    const asignatura = $('#res-asignatura').value;
    const tema = $('#res-tema').value.trim();
    const formato = radioValue('res-formato');
    const hasVideo = items.some((i) => i.kind === 'video');

    setLoading(button, true);
    try {
      let blocks = [];
      let frameCount = 0;
      if (items.length) {
        output.prepare('Preparando archivos…');
        ({ blocks, frameCount } = await filesToBlocks(items, {
          frames: Number($('#res-frames').value),
          onProgress: (text) => output.prepare(text),
        }));
      }
      if (hasVideo && transcripcion) blocks.push({ type: 'text', text: `<transcripcion>\n${transcripcion}\n</transcripcion>` });
      if (texto) blocks.push({ type: 'text', text: `<texto>\n${texto}\n</texto>` });
      blocks.push({
        type: 'text',
        text: instruccionesResumen({
          asignatura,
          tema,
          formato,
          longitud: radioValue('res-longitud'),
          transcribir: $('#res-transcribir').checked,
          frames: frameCount,
          hayArchivos: items.some((i) => i.kind === 'image' || i.kind === 'pdf'),
        }),
      });

      const source = hasVideo ? 'video' : items.some((i) => i.kind === 'image') ? 'foto' : items.some((i) => i.kind === 'pdf') ? 'pdf' : 'texto';
      const etiqueta = { resumen: 'Resumen', esquema: 'Esquema', puntos: 'Puntos clave', facil: 'Explicación' }[formato];
      await output.run({
        system: sistemaResumen(),
        content: blocks,
        effort: 'medium',
        save: {
          title: tema ? `${etiqueta} · ${tema}` : `${etiqueta} de ${asignatura} (${formatDate(Date.now())})`,
          subject: asignatura,
          topic: tema,
          kind: 'resumen',
          source,
        },
      });
    } catch (err) {
      output.fail(err.message);
    } finally {
      setLoading(button, false);
    }
  };
}
