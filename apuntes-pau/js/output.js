// Panel donde aparece la respuesta de Claude (en directo), con botones para
// guardar, copiar o imprimir y un cuadro para seguir preguntando.

import { Conversation, NoKeyError, hasKey, textOf, costOf, friendlyError, isAbort, promptAsText, modelInfo } from './claude.js';
import { renderMarkdown, renderFinal, escapeHtml } from './render.js';
import { $, copyText, printMarkdown } from './ui.js';
import { openEditor } from './notes-dialog.js';
import { goTo } from './nav.js';

export function formatUsd(n) {
  return `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: n < 0.1 ? 3 : 2 })} $`;
}

export function createOutput(container) {
  container.hidden = true;
  container.innerHTML = `
    <div class="card output">
      <div class="out-status" role="status" hidden>
        <span class="spinner" aria-hidden="true"></span>
        <span class="out-status-text"></span>
        <button type="button" class="btn small ghost out-stop">Parar</button>
      </div>
      <div class="out-thread"></div>
      <div class="out-foot" hidden>
        <small class="out-cost"></small>
        <div class="actions">
          <button type="button" class="btn primary out-save">💾 Guardar en mis apuntes</button>
          <button type="button" class="btn out-copy">📋 Copiar</button>
          <button type="button" class="btn out-print">🖨️ Imprimir / PDF</button>
        </div>
        <form class="followup">
          <input type="text" placeholder="¿Dudas? Pregunta sobre esto…" aria-label="Pregunta de seguimiento" required>
          <button type="submit" class="btn">Preguntar</button>
        </form>
      </div>
    </div>`;

  const status = $('.out-status', container);
  const statusText = $('.out-status-text', container);
  const stopButton = $('.out-stop', container);
  const thread = $('.out-thread', container);
  const foot = $('.out-foot', container);
  const costEl = $('.out-cost', container);
  const followup = $('.followup', container);
  const followInput = $('input', followup);
  const followButton = $('button', followup);

  let conversation = null;
  let turns = [];
  let saveDefaults = {};
  let controller = null;
  let totalCost = 0;

  function setStatus(text, { stoppable = false } = {}) {
    status.hidden = !text;
    statusText.textContent = text || '';
    stopButton.hidden = !stoppable;
  }

  function markdown() {
    return turns
      .filter((t) => t.md)
      .map((t) => (t.question ? `### ❓ ${t.question}\n\n${t.md}` : t.md))
      .join('\n\n---\n\n');
  }

  function clear() {
    container.hidden = false;
    thread.innerHTML = '';
    turns = [];
    totalCost = 0;
    costEl.textContent = '';
    foot.hidden = true;
  }

  function showNoKey(system, content) {
    const attachments = Array.isArray(content) && content.some((b) => b.type !== 'text');
    thread.innerHTML = `
      <div class="notice">
        <p><b>Te falta conectar Claude.</b> Para que la web lo haga sola, añade tu clave de API en Ajustes.</p>
        <p>Mientras tanto, puedes copiar las instrucciones y pegarlas en <a href="https://claude.ai" target="_blank" rel="noopener">claude.ai</a>${attachments ? ' (adjunta allí tus fotos o PDF)' : ''}. Después guarda el resultado con «+ Nuevo apunte».</p>
        <div class="actions">
          <button type="button" class="btn primary" data-go>Ir a Ajustes</button>
          <button type="button" class="btn" data-copy>📋 Copiar instrucciones</button>
        </div>
      </div>`;
    $('[data-go]', thread).onclick = () => goTo('ajustes');
    $('[data-copy]', thread).onclick = () => copyText(promptAsText(system, content));
  }

  async function send(content, question) {
    const turn = { question, md: '' };
    turns.push(turn);
    let questionEl = null;
    if (question) {
      questionEl = document.createElement('div');
      questionEl.className = 'out-q';
      questionEl.textContent = question;
      thread.append(questionEl);
    }
    const el = document.createElement('article');
    el.className = 'md answer';
    thread.append(el);

    setStatus('Pensando…', { stoppable: true });
    followButton.disabled = true;
    controller = new AbortController();
    let frame = 0;
    try {
      const message = await conversation.send(content, {
        signal: controller.signal,
        onText: (delta) => {
          turn.md += delta;
          setStatus('Escribiendo…', { stoppable: true });
          if (!frame) {
            frame = requestAnimationFrame(() => {
              frame = 0;
              renderMarkdown(el, turn.md);
            });
          }
        },
      });
      cancelAnimationFrame(frame);
      turn.md = textOf(message) || turn.md;
      setStatus('');
      await renderFinal(el, turn.md);
      if (message.stop_reason === 'max_tokens') {
        el.insertAdjacentHTML('beforeend', '<p class="notice">La respuesta se ha cortado por ser demasiado larga.</p>');
      }
      totalCost += costOf(message.usage, conversation.model);
      costEl.textContent = `Coste aproximado: ${formatUsd(totalCost)} · ${modelInfo(conversation.model).name.split(' · ')[0]}`;
    } catch (err) {
      cancelAnimationFrame(frame);
      setStatus('');
      if (isAbort(err) && turn.md) {
        turn.md += '\n\n*(Detenido)*';
        await renderFinal(el, turn.md);
      } else {
        turns.pop();
        if (isAbort(err)) {
          el.remove();
          questionEl?.remove();
        } else {
          el.innerHTML = `<div class="notice error"><p>${escapeHtml(friendlyError(err))}</p></div>`;
          if (err instanceof NoKeyError) showNoKey(conversation.system, content);
        }
      }
    } finally {
      controller = null;
      followButton.disabled = false;
      foot.hidden = !turns.some((t) => t.md);
    }
  }

  stopButton.onclick = () => controller?.abort();

  followup.addEventListener('submit', (e) => {
    e.preventDefault();
    const question = followInput.value.trim();
    if (!question || !conversation || controller) return;
    followInput.value = '';
    send(question, question);
  });

  $('.out-save', container).onclick = () => openEditor({ ...saveDefaults, content: markdown() });
  $('.out-copy', container).onclick = () => copyText(markdown());
  $('.out-print', container).onclick = () => printMarkdown(saveDefaults.title || 'Apuntes PAU', markdown());

  return {
    get busy() {
      return Boolean(controller);
    },

    // Muestra un estado previo (por ejemplo, «Preparando archivos…»).
    prepare(text) {
      clear();
      setStatus(text);
    },

    fail(message) {
      clear();
      setStatus('');
      thread.innerHTML = `<div class="notice error"><p>${escapeHtml(message)}</p></div>`;
    },

    // Empieza una conversación nueva. `save` son los datos por defecto al guardar.
    async run({ system, content, effort, save }) {
      clear();
      setStatus('');
      saveDefaults = save || {};
      if (!hasKey()) {
        showNoKey(system, content);
        return;
      }
      conversation = new Conversation({ system, effort });
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
      await send(content);
    },
  };
}
