// Conexión con la API de Claude usando el SDK oficial de Anthropic.
// La clave la pone el propio alumno en Ajustes y solo se envía a Anthropic.

import Anthropic from '../vendor/anthropic-sdk.mjs';
import { getSettings, addSpend } from './store.js';

// Precios en dólares por millón de tokens.
export const MODELS = [
  {
    id: 'claude-opus-5-5',
    name: 'Claude Opus 5.5 · el más listo (recomendado)',
    price: { input: 4, output: 20, cacheRead: 0.2 },
    effort: true,
    fallbacks: true,
  },
  {
    id: 'claude-sonnet-5-5',
    name: 'Claude Sonnet 5.5 · muy bueno y más barato',
    price: { input: 2, output: 10, cacheRead: 0.2 },
    effort: true,
    fallbacks: true,
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5 · el más rápido y barato',
    price: { input: 1, output: 5, cacheRead: 0.1 },
    effort: false,
    fallbacks: false,
  },
];

export function modelInfo(id) {
  return MODELS.find((m) => m.id === id) || MODELS[0];
}

export function hasKey() {
  return Boolean(getSettings().apiKey);
}

export class NoKeyError extends Error {
  constructor() {
    super('Falta tu clave de API. Añádela en Ajustes.');
  }
}

export class RefusalError extends Error {
  constructor() {
    super('Claude no ha podido responder a esta petición. Prueba a reformularla o a usar otro texto.');
  }
}

function client() {
  const { apiKey } = getSettings();
  if (!apiKey) throw new NoKeyError();
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

function buildParams({ model, system, messages, effort, maxTokens, format }) {
  const info = modelInfo(model);
  const params = {
    model: info.id,
    max_tokens: maxTokens,
    system,
    messages,
    // Caché automática: si repites preguntas sobre el mismo material, sale más barato.
    cache_control: { type: 'ephemeral' },
  };
  const outputConfig = {};
  if (info.effort && effort) outputConfig.effort = effort;
  if (format) outputConfig.format = format;
  if (Object.keys(outputConfig).length) params.output_config = outputConfig;
  if (info.fallbacks) {
    // Si el modelo rechaza la petición, la API la reintenta sola con otro modelo.
    params.betas = ['server-side-fallback-2026-07-01'];
    params.fallbacks = 'default';
  }
  return params;
}

export function costOf(usage, modelId) {
  if (!usage) return 0;
  const { price } = modelInfo(modelId);
  const input = usage.input_tokens || 0;
  const cacheWrite = usage.cache_creation_input_tokens || 0;
  const cacheRead = usage.cache_read_input_tokens || 0;
  const output = usage.output_tokens || 0;
  return (input * price.input + cacheWrite * price.input * 1.25 + cacheRead * price.cacheRead + output * price.output) / 1e6;
}

export function textOf(message) {
  return message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

// Llamada con respuesta en streaming. `onText` recibe cada trozo de texto.
async function stream({ model, system, messages, effort = 'medium', maxTokens = 64000, format, onText, signal }) {
  const params = buildParams({ model, system, messages, effort, maxTokens, format });
  const s = client().beta.messages.stream(params, { signal });
  if (onText) s.on('text', (delta) => onText(delta));
  const message = await s.finalMessage();
  addSpend(costOf(message.usage, model));
  if (message.stop_reason === 'refusal') throw new RefusalError();
  return message;
}

// Petición que devuelve JSON con la forma de `schema` (salidas estructuradas).
export async function getJSON({ system, prompt, schema, effort = 'medium' }) {
  const model = getSettings().model;
  const message = await stream({
    model,
    system,
    messages: [{ role: 'user', content: prompt }],
    effort,
    maxTokens: 32000,
    format: { type: 'json_schema', schema },
  });
  if (message.stop_reason === 'max_tokens') {
    throw new Error('La respuesta era demasiado larga. Prueba con menos contenido.');
  }
  return JSON.parse(textOf(message));
}

// Conversación con varias preguntas seguidas sobre el mismo material.
// El historial solo crece (nunca se edita): así lo exige la API para
// conservar el razonamiento del modelo entre turnos y aprovechar la caché.
export class Conversation {
  constructor({ system, effort = 'medium' }) {
    this.system = system;
    this.effort = effort;
    this.model = getSettings().model;
    this.messages = [];
  }

  async send(content, { onText, signal } = {}) {
    this.messages.push({ role: 'user', content });
    try {
      const message = await stream({
        model: this.model,
        system: this.system,
        messages: this.messages,
        effort: this.effort,
        onText,
        signal,
      });
      this.messages.push({ role: 'assistant', content: message.content });
      return message;
    } catch (err) {
      // Se quita la pregunta fallida (es el último mensaje, no hay nada detrás).
      this.messages.pop();
      throw err;
    }
  }
}

// Comprueba la clave sin gastar: consulta los datos del modelo elegido.
export async function testKey() {
  const model = getSettings().model;
  await client().models.retrieve(model);
}

export function isAbort(err) {
  return err instanceof Anthropic.APIUserAbortError || err?.name === 'AbortError';
}

export function friendlyError(err) {
  if (err instanceof NoKeyError || err instanceof RefusalError) return err.message;
  if (err instanceof Anthropic.AuthenticationError) return 'Tu clave de API no es válida. Revísala en Ajustes.';
  if (err instanceof Anthropic.PermissionDeniedError) return 'Tu clave no tiene permiso para usar este modelo. Prueba otro modelo en Ajustes.';
  if (err instanceof Anthropic.NotFoundError) return 'Ese modelo no está disponible para tu cuenta. Elige otro en Ajustes.';
  if (err instanceof Anthropic.RateLimitError) return 'Has hecho demasiadas peticiones seguidas. Espera un minuto y vuelve a intentarlo.';
  if (err instanceof Anthropic.BadRequestError) {
    return `La petición no es válida (¿te has quedado sin saldo o el archivo es demasiado grande?). Detalle: ${err.message}`;
  }
  if (err instanceof Anthropic.InternalServerError) return 'Los servidores de Claude están saturados ahora mismo. Inténtalo de nuevo en un rato.';
  if (err instanceof Anthropic.APIConnectionError) return 'No hay conexión con Claude. Revisa tu internet.';
  if (err instanceof Anthropic.APIError) return `Error de Claude (${err.status ?? '?'}): ${err.message}`;
  return err?.message || String(err);
}

// Convierte una petición en texto para pegarla en claude.ai (si no tienes clave).
export function promptAsText(system, content) {
  const blocks = typeof content === 'string' ? [{ type: 'text', text: content }] : content;
  const texts = blocks.filter((b) => b.type === 'text').map((b) => b.text);
  const attachments = blocks.filter((b) => b.type !== 'text').length;
  const parts = [system, '---', ...texts];
  if (attachments) {
    parts.unshift(`(Recuerda adjuntar en claude.ai las ${attachments} fotos o PDF que habías añadido.)`);
  }
  return parts.join('\n\n');
}
