// Muestra Markdown con fórmulas (KaTeX) y diagramas (Mermaid).

import { marked } from '../vendor/marked.esm.js';
import DOMPurify from '../vendor/purify.es.mjs';

const CDN = 'https://cdn.jsdelivr.net/npm';
const KATEX = `${CDN}/katex@0.19.0/dist`;
const MERMAID = `${CDN}/mermaid@12.1.0/dist/mermaid.esm.min.mjs`;

marked.setOptions({ gfm: true });

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('href')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    document.head.append(s);
  });
}

// ---------- Fórmulas (KaTeX) ----------

let katexPromise;
export function loadKatex() {
  if (!katexPromise) {
    katexPromise = withTimeout((async () => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = `${KATEX}/katex.min.css`;
      document.head.append(css);
      await loadScript(`${KATEX}/katex.min.js`);
      await loadScript(`${KATEX}/contrib/mhchem.min.js`).catch(() => {});
      return window.katex;
    })(), 12000).catch(() => null);
  }
  return katexPromise;
}

// $$…$$, \[…\], \(…\) y $…$ (sin espacios pegados a los $, para no confundir precios).
const MATH_RE = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$(?=\S)([^$\n]+?)(?<=\S)\$(?!\d)/g;

// Aparta las fórmulas antes de pasar el Markdown, para que no se estropeen
// (los _ y * de LaTeX se confundirían con cursivas y negritas).
function protectMath(md) {
  const math = [];
  const parts = md.split(/(```[\s\S]*?(?:```|$)|`[^`\n]*`)/g);
  const text = parts
    .map((part, i) => (i % 2 ? part : part.replace(MATH_RE, (_, d1, d2, i1, i2) => {
      math.push({ tex: d1 ?? d2 ?? i1 ?? i2, display: d1 !== undefined || d2 !== undefined });
      return `MATHPH${math.length - 1}END`;
    })))
    .join('');
  return { text, math };
}

function renderMath({ tex, display }) {
  const katex = window.katex;
  if (katex) {
    try {
      const html = katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: 'ignore', output: 'htmlAndMathml' });
      return display ? `<span class="math-display">${html}</span>` : html;
    } catch {
      // Se muestra como texto.
    }
  }
  return `<code class="math-raw">${escapeHtml(display ? `$$${tex}$$` : `$${tex}$`)}</code>`;
}

function toHtml(md, inline) {
  const { text, math } = protectMath(md || '');
  const html = DOMPurify.sanitize(inline ? marked.parseInline(text) : marked.parse(text));
  return math.length ? html.replace(/MATHPH(\d+)END/g, (_, i) => renderMath(math[Number(i)])) : html;
}

export function mdToHtml(md) {
  return toHtml(md, false);
}

export function mdInlineToHtml(md) {
  return toHtml(md, true);
}

export function renderMarkdown(el, md) {
  el.innerHTML = mdToHtml(md);
}

// ---------- Diagramas (Mermaid) ----------

let mermaidPromise;
function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = withTimeout(import(MERMAID), 15000)
      .then(({ default: mermaid }) => {
        const dark = matchMedia('(prefers-color-scheme: dark)').matches;
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'neutral' });
        return mermaid;
      })
      .catch(() => null);
  }
  return mermaidPromise;
}

let diagramSeq = 0;
export async function renderDiagrams(el) {
  const blocks = [...el.querySelectorAll('pre > code.language-mermaid')];
  if (!blocks.length) return;
  const mermaid = await loadMermaid();
  if (!mermaid) return;
  for (const code of blocks) {
    const pre = code.parentElement;
    const id = `diagrama-${++diagramSeq}`;
    try {
      const { svg } = await mermaid.render(id, code.textContent);
      const box = document.createElement('div');
      box.className = 'mermaid-box';
      box.innerHTML = svg;
      pre.replaceWith(box);
    } catch {
      document.getElementById(id)?.remove();
      document.getElementById(`d${id}`)?.remove();
      pre.insertAdjacentHTML('beforebegin', '<p class="hint">(No se ha podido dibujar este diagrama; aquí tienes su código.)</p>');
    }
  }
}

// Render definitivo: espera a KaTeX y dibuja los diagramas.
export async function renderFinal(el, md) {
  await loadKatex();
  renderMarkdown(el, md);
  await renderDiagrams(el);
}
