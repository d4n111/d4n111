// Convierte los archivos que añade el alumno en bloques que entiende Claude:
// fotos → imagen (reducida), PDF → documento, vídeo → fotogramas, texto → texto.

const MAX_IMAGE_SIDE = 2000;
const MAX_PDF_MB = 25;

export function detectKind(file) {
  const name = file.name.toLowerCase();
  const type = file.type;
  if (type.startsWith('image/') || /\.(heic|heif)$/.test(name)) return 'image';
  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (type.startsWith('video/') || /\.(mp4|webm|mov|m4v|mkv)$/.test(name)) return 'video';
  if (/\.(srt|vtt)$/.test(name)) return 'subtitles';
  if (type.startsWith('text/') || /\.(txt|md)$/.test(name)) return 'text';
  return null;
}

export const KIND_ICON = { image: '🖼️', pdf: '📄', video: '🎬', subtitles: '💬', text: '📃' };

export function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function readAsDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function loadBitmap(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Algunos navegadores solo saben abrir ciertos formatos con <img>.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

async function imageBlock(file) {
  let bitmap;
  try {
    bitmap = await loadBitmap(file);
  } catch {
    throw new Error(`No puedo abrir la imagen «${file.name}». Prueba a guardarla como JPG o PNG.`);
  }
  const w = bitmap.width;
  const h = bitmap.height;
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const data = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
  return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } };
}

async function pdfBlock(file) {
  if (file.size > MAX_PDF_MB * 1024 * 1024) {
    throw new Error(`El PDF «${file.name}» pesa demasiado (máximo ${MAX_PDF_MB} MB). Divídelo en partes.`);
  }
  const data = (await readAsDataURL(file)).split(',')[1];
  return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data }, title: file.name };
}

// Quita números de línea y tiempos de un archivo .srt o .vtt.
export function subtitlesToText(raw) {
  const lines = raw.replace(/\r/g, '').split('\n');
  const out = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t || t === 'WEBVTT' || /^\d+$/.test(t) || t.includes('-->') || /^(NOTE|STYLE|Kind:|Language:)/.test(t)) continue;
    const clean = t.replace(/<[^>]+>/g, '');
    if (out[out.length - 1] !== clean) out.push(clean);
  }
  return out.join(' ');
}

function once(target, event, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      target.removeEventListener(event, ok);
      target.removeEventListener('error', fail);
    };
    const ok = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error('Este navegador no puede abrir el vídeo. Prueba con un MP4.')); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('El vídeo tarda demasiado en cargar.')); }, timeoutMs);
    target.addEventListener(event, ok);
    target.addEventListener('error', fail);
  });
}

function mmss(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Saca `count` fotogramas repartidos por todo el vídeo.
async function videoBlocks(file, count, onProgress) {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;
  try {
    await once(video, 'loadeddata');
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('No puedo saber cuánto dura el vídeo.');
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    const blocks = [];
    for (let i = 0; i < count; i++) {
      const t = (duration * (i + 0.5)) / count;
      video.currentTime = t;
      await once(video, 'seeked');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL('image/jpeg', 0.75).split(',')[1];
      blocks.push({ type: 'text', text: `Fotograma ${i + 1} (minuto ${mmss(t)}):` });
      blocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } });
      onProgress?.(`Extrayendo fotogramas del vídeo… ${i + 1}/${count}`);
    }
    return { blocks, duration };
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute('src');
    video.load();
  }
}

// Convierte la lista de archivos en bloques de contenido para la API.
// Devuelve también cuántos fotogramas de vídeo se han incluido.
export async function filesToBlocks(items, { frames = 16, onProgress } = {}) {
  const blocks = [];
  let frameCount = 0;
  for (const [i, { file, kind }] of items.entries()) {
    onProgress?.(`Preparando archivos… ${i + 1}/${items.length}`);
    if (kind === 'image') {
      blocks.push(await imageBlock(file));
    } else if (kind === 'pdf') {
      blocks.push(await pdfBlock(file));
    } else if (kind === 'text') {
      blocks.push({ type: 'text', text: `<archivo nombre="${file.name}">\n${await file.text()}\n</archivo>` });
    } else if (kind === 'subtitles') {
      blocks.push({ type: 'text', text: `<transcripcion origen="${file.name}">\n${subtitlesToText(await file.text())}\n</transcripcion>` });
    } else if (kind === 'video') {
      const { blocks: videoParts, duration } = await videoBlocks(file, frames, onProgress);
      blocks.push({ type: 'text', text: `Vídeo «${file.name}» (duración ${mmss(duration)}). Fotogramas:` });
      blocks.push(...videoParts);
      frameCount += frames;
    }
  }
  return { blocks, frameCount };
}
