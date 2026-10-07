// Instrucciones que se le dan a Claude. Si quieres cambiar cómo resume o
// cómo hace los comentarios, este es el archivo que hay que tocar.

import { getSettings } from './store.js';

function pau() {
  const region = getSettings().region.trim();
  return region ? `la PAU de ${region}` : 'la PAU (Prueba de Acceso a la Universidad, España)';
}

export const ESTILO = `Normas de estilo (síguelas siempre):
- Escribe en español de España, para un estudiante de 2.º de Bachillerato que prepara la PAU.
- Claro y visual: nunca más de un párrafo seguido; sepáralo con listas, tablas, ejemplos o esquemas.
- Cuando expliques algo complejo (sobre todo de ciencias), primero hazlo de forma simple y concisa, y después con el nivel normal de 2.º de Bachillerato.
- Usa Markdown: títulos con ##, **negrita** para los conceptos clave, listas y tablas.
- Fórmulas de matemáticas, física o química SIEMPRE en LaTeX: $...$ en línea y $$...$$ en bloque (en química puedes usar \\ce{...}).
- Si un dibujo o esquema ayuda, añade un diagrama en un bloque \`\`\`mermaid usando «flowchart TD» o «flowchart LR», con pocas palabras por nodo y todas las etiquetas entre comillas dobles, por ejemplo: A["Causa"] --> B["Consecuencia"].
- No inventes nada: si algo no se lee bien en una foto o falta información, dilo claramente.`;

// ===================== Resúmenes =====================

export function sistemaResumen() {
  return `Eres un profesor particular experto en ${pau()}. Conviertes cualquier material (textos, fotos de apuntes, PDFs, fotogramas y transcripciones de vídeos de clase) en apuntes de estudio claros, fieles al material y útiles para el examen.

${ESTILO}`;
}

const FORMATOS = {
  resumen: `Haz un RESUMEN DE ESTUDIO con esta estructura:
## 🎯 Idea principal
(1-2 frases)
## 📝 Resumen
(organizado en apartados con subtítulos ###; lo esencial de cada uno)
## 🔑 Conceptos clave
(tabla: | Concepto | Definición corta | Ejemplo |)
## ❓ Para la PAU
(3-5 preguntas típicas de examen sobre esto y lo que no puede faltar en cada respuesta)`,

  esquema: `Haz un ESQUEMA para estudiar con esta estructura:
## 🗺️ Mapa conceptual
(un diagrama mermaid de 6 a 15 nodos con las ideas y sus relaciones)
## 📋 Esquema
(lista anidada de 2-3 niveles con palabras clave, sin frases largas)
## ⭐ Lo más importante
(los 5 puntos que no se pueden olvidar)`,

  puntos: `Extrae los PUNTOS CLAVE con esta estructura:
## ✅ Puntos clave
(entre 8 y 15 puntos, una línea cada uno)
## 📅 Para memorizar
(datos, fechas, nombres, definiciones o fórmulas exactas; en tabla si procede)
## ❓ Autoevaluación
(5 preguntas cortas, cada una con su respuesta en una línea)`,

  facil: `EXPLÍCAMELO FÁCIL, en dos niveles:
## 🟢 Versión sencilla
(muy simple y concisa, para entenderlo a la primera: máximo 6 líneas, con una analogía o ejemplo cotidiano y, si ayuda, un dibujo con mermaid)
## 🔵 Explicación completa
(la explicación normal de 2.º de Bachillerato: rigurosa, paso a paso, con ejemplos y, si las hay, fórmulas en LaTeX)
## ⚠️ Errores típicos
(los fallos más habituales en el examen con este tema y cómo evitarlos)`,
};

const LONGITUD = {
  breve: 'Sé breve: solo lo imprescindible (unas 150-300 palabras).',
  normal: 'Extensión media (unas 400-700 palabras).',
  detallado: 'Sé detallado y completo, sin dejarte nada importante del material.',
};

export function instruccionesResumen({ asignatura, tema, formato, longitud, transcribir, frames, hayArchivos }) {
  const partes = [`Asignatura: ${asignatura}.${tema ? ` Tema: ${tema}.` : ''}`];
  if (frames) {
    partes.push(`El material incluye ${frames} fotogramas de un vídeo de clase (con su minuto) y, si la hay, su transcripción. Usa la transcripción para el contenido y los fotogramas para la pizarra, las diapositivas o las fórmulas.`);
  }
  partes.push(FORMATOS[formato] || FORMATOS.resumen);
  partes.push(LONGITUD[longitud] || LONGITUD.normal);
  if (transcribir && hayArchivos) {
    partes.push('Al final añade un apartado «## 📄 Texto pasado a limpio» con la transcripción fiel y ordenada del texto que aparece en las fotos o PDF (corrige solo errores evidentes y respeta fórmulas y esquemas).');
  }
  return partes.join('\n\n');
}

// ===================== Comentarios de texto =====================

export const COMENTARIOS = {
  lengua: {
    nombre: 'Lengua Castellana y Literatura II',
    estructura: `1. **Tema**: enunciado breve (una frase nominal) que recoja la idea central.
2. **Resumen**: con palabras propias, objetivo y sin copiar frases del texto (más o menos 1/4 de su extensión).
3. **Estructura**: partes del texto (indicando líneas o párrafos), idea de cada parte y tipo de estructura (analizante, sintetizante, encuadrada, paralela…).
4. **Tipología y adecuación**: modalidad textual (expositiva, argumentativa…), ámbito y género, intención comunicativa, emisor y receptor, registro y funciones del lenguaje, con rasgos lingüísticos del texto que lo demuestren.
5. **Mecanismos de cohesión**: recurrencias, sustituciones (sinónimos, hiperónimos, pronombres), elipsis, deixis, campos semánticos y conectores, siempre con ejemplos del texto.
6. **Valoración crítica**: texto argumentativo propio (150-200 palabras) con tesis clara, al menos dos argumentos de distinto tipo y conclusión.`,
  },
  filosofia: {
    nombre: 'Historia de la Filosofía',
    estructura: `1. **Contexto**: autor, obra y época; contexto histórico-cultural y filosófico (breve, solo lo que ayuda a entender el texto).
2. **Tema e idea principal** del fragmento.
3. **Ideas secundarias y estructura argumentativa**: cómo razona el autor (pasos del argumento y partes del texto).
4. **Explicación de los conceptos clave**: define los términos filosóficos del fragmento tal como los entiende el autor.
5. **Relación con el pensamiento del autor**: cómo encaja el texto en su filosofía (metafísica, conocimiento, ética, política… según el caso).
6. **Comparación** con otro autor o corriente de otra época: semejanzas y diferencias.
7. **Valoración y actualidad**: vigencia del planteamiento, con argumentos propios.`,
  },
  historia: {
    nombre: 'Historia de España',
    estructura: `1. **Clasificación**: tipo de fuente (primaria o secundaria), naturaleza (política, jurídica, económica, periodística, historiográfica, discurso, gráfica…), autor, fecha y lugar, destinatario y finalidad.
2. **Análisis**: idea principal e ideas secundarias, explicando los términos, personajes y hechos que aparecen (citando el texto).
3. **Contextualización**: antecedentes, causas y momento histórico en el que se sitúa la fuente.
4. **Conclusión y valoración**: consecuencias, importancia histórica y relación con el resto del temario.`,
  },
};

export function sistemaComentario(asig) {
  const { nombre } = COMENTARIOS[asig];
  const criterios = getSettings().criteria[asig]?.trim();
  return `Eres profesor/a de ${nombre} con mucha experiencia preparando y corrigiendo ${pau()}. Sabes lo que valoran los correctores: responder a lo que se pide, rigor y terminología de la materia, apoyarse en el texto citándolo, orden, buena redacción y ortografía.
${criterios ? `\nCriterios oficiales o de mi profesor/a. Tienen prioridad sobre cualquier otra estructura:\n<criterios>\n${criterios}\n</criterios>\n` : ''}
${ESTILO}`;
}

export function instruccionesComentario({ asig, modo, datos }) {
  const { estructura } = COMENTARIOS[asig];
  const contexto = datos ? `Datos del texto que me han dado: ${datos}.\n\n` : '';

  if (modo === 'guia') {
    return `${contexto}NO hagas el comentario: ayúdame a hacerlo yo. Para cada apartado de esta estructura:
${estructura}

En cada apartado escribe:
- **Qué piden** (1 línea).
- **Pistas**: 2-3 preguntas que me lleven a la respuesta.
- **Dónde mirar**: fragmentos concretos del texto, citados entre comillas.
- **Cómo empezar**: una frase de arranque para ese apartado.

No des las respuestas completas. Termina con un apartado «## ⏱️ Plan de examen» con el tiempo recomendado para cada apartado.`;
  }

  if (modo === 'corregir') {
    return `${contexto}Corrige MI COMENTARIO como un corrector de la PAU: exigente pero motivador. Estructura de referencia:
${estructura}

Responde así:
## 📊 Nota orientativa: X/10
(tabla: | Apartado | Puntuación | Comentario breve |; aclara que la nota es orientativa)
## ✅ Lo que está bien
## ❌ Errores y cómo arreglarlos
(para cada uno: mi frase citada → qué falla → cómo quedaría bien)
## ✍️ Ortografía y expresión
(faltas, tildes, puntuación, repeticiones o registro coloquial; si no hay, dilo)
## 🚀 Versión mejorada
(reescribe los apartados más flojos tal como deberían quedar)`;
  }

  return `${contexto}Haz un COMENTARIO MODELO del texto, como lo haría un alumno de 10 en la PAU, siguiendo exactamente esta estructura:
${estructura}

Para cada apartado (con su título ##): primero una línea «📌 **Clave:**» con la idea esencial en pocas palabras; después, la redacción tal como la escribiría en el examen, en párrafos cortos y citando el texto entre comillas cuando lo uses.

Termina con:
## 💡 Claves para el examen
(3-5 consejos concretos para este tipo de texto y errores que hay que evitar)`;
}

// ===================== Estudio =====================

export function sistemaEstudio() {
  return `Eres un experto en técnicas de estudio (recuerdo activo y repaso espaciado) y en ${pau()}. Creas material de repaso fiel a los apuntes del alumno, sin añadir errores ni información que no esté en ellos salvo que sea imprescindible.`;
}

export const ESQUEMA_TARJETAS = {
  type: 'object',
  properties: {
    tarjetas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pregunta: { type: 'string' },
          respuesta: { type: 'string' },
        },
        required: ['pregunta', 'respuesta'],
        additionalProperties: false,
      },
    },
  },
  required: ['tarjetas'],
  additionalProperties: false,
};

export function instruccionesTarjetas(note, existentes) {
  const previas = existentes.length
    ? `\nYa existen estas tarjetas (no las repitas):\n<ya_existen>\n${existentes.map((c) => `- ${c.front}`).join('\n')}\n</ya_existen>\n`
    : '';
  return `Crea tarjetas de memoria a partir de este apunte de ${note.subject}.
- Entre 6 y 25 tarjetas, según la cantidad de contenido.
- Una sola idea por tarjeta y una pregunta concreta (nada de «Háblame de…»).
- Respuesta corta: 1-3 líneas, lo justo para el examen.
- Cubre definiciones, fechas, causas y consecuencias, autores, fórmulas y procedimientos si los hay.
- Fórmulas en LaTeX con $...$.
${previas}
<apunte titulo="${escapeAttr(note.title)}">
${note.content}
</apunte>`;
}

export const ESQUEMA_TEST = {
  type: 'object',
  properties: {
    preguntas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          enunciado: { type: 'string' },
          opciones: { type: 'array', items: { type: 'string' } },
          correcta: { type: 'integer' },
          explicacion: { type: 'string' },
        },
        required: ['enunciado', 'opciones', 'correcta', 'explicacion'],
        additionalProperties: false,
      },
    },
  },
  required: ['preguntas'],
  additionalProperties: false,
};

export function instruccionesTest(subject, notes, num) {
  return `Crea un test de ${num} preguntas de opción múltiple sobre estos apuntes de ${subject}, con el nivel de ${pau()}.
- 4 opciones por pregunta y solo una correcta; los distractores deben ser creíbles.
- «correcta» es la posición (0, 1, 2 o 3) de la opción correcta; varía esa posición entre preguntas.
- «explicacion»: 1-2 frases que expliquen por qué es la correcta.
- Mezcla preguntas de memoria y de comprensión o aplicación (y de cálculo si la asignatura es de ciencias).
- Fórmulas en LaTeX con $...$.

${notesAsXML(notes)}`;
}

export function sistemaPreguntar(subject, notes) {
  return `Eres mi profesor/a particular de ${subject} y me preparas para ${pau()}. Abajo tienes MIS APUNTES. Responde a mis preguntas basándote en ellos. Si algo no aparece en mis apuntes, dilo y complétalo marcándolo con «(fuera de tus apuntes)». Cuando ayude, indica de qué apunte sale la información.

${ESTILO}

<mis_apuntes>
${notesAsXML(notes)}
</mis_apuntes>`;
}

function notesAsXML(notes) {
  return notes
    .map((n) => `<apunte titulo="${escapeAttr(n.title)}"${n.topic ? ` tema="${escapeAttr(n.topic)}"` : ''}>\n${n.content}\n</apunte>`)
    .join('\n\n');
}

function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '\'');
}
