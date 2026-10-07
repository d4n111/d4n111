# 📚 Apuntes PAU

Web para preparar la PAU con ayuda de Claude (la IA de Anthropic):

| Pestaña | Qué hace |
|---|---|
| **Resumir** | Resume textos, fotos de apuntes, PDFs y vídeos de clase. Formatos: resumen, esquema con mapa conceptual, puntos clave o «explícamelo fácil». Puede pasar a limpio tus fotos. |
| **Comentario** | Comentarios de texto de **Lengua**, **Filosofía** e **Historia de España** con la estructura de la PAU: comentario modelo, guía paso a paso o **corrección del tuyo** (también desde fotos de lo que has escrito a mano). |
| **Mis apuntes** | Tu base de datos: guarda todo lo anterior y tus notas propias, con buscador y filtros por asignatura. |
| **Estudiar** | Cuenta atrás hasta la PAU, **tarjetas** con repaso espaciado, **tests** tipo examen y **preguntas** a tus propios apuntes. |
| **Ajustes** | Clave de API, modelo, fecha de la PAU, asignaturas, criterios de corrección y copias de seguridad. |

Las fórmulas se ven bien (LaTeX con KaTeX, también química con `\ce{}`) y los esquemas se dibujan solos (Mermaid).

---

## 🚀 Ponerla en marcha (5 minutos)

### 1. Publicarla gratis con GitHub Pages

1. Une estos cambios a la rama `main` (aceptando el *pull request*).
2. En GitHub: **Settings › Pages**.
3. En *Source* elige **Deploy from a branch**, rama **main** y carpeta **/ (root)**. Pulsa **Save**.
4. En un par de minutos estará en:
   **https://d4n111.github.io/d4n111/apuntes-pau/**

En el móvil, ábrela y usa «Añadir a pantalla de inicio» para tenerla como una app.

### 2. Conectar Claude

1. Crea una cuenta en [console.anthropic.com](https://console.anthropic.com/).
2. En **Billing** añade saldo.
3. En **API Keys** crea una clave.
4. En la web: **Ajustes › Clave de API › Guardar y probar**.

> 💡 Sin clave también puedes usarla: al pulsar «Resumir» te deja **copiar las instrucciones** para pegarlas en claude.ai.

---

## 💶 Cuánto cuesta

Pagas solo lo que usas (precios por millón de *tokens*; 1 token ≈ ¾ de palabra):

| Modelo | Entrada | Salida | Un resumen normal |
|---|---|---|---|
| Claude Opus 5.5 (por defecto) | 4 $ | 20 $ | ≈ 5-10 céntimos |
| Claude Sonnet 5.5 | 2 $ | 10 $ | ≈ 3-5 céntimos |
| Claude Haiku 4.5 | 1 $ | 5 $ | ≈ 1-2 céntimos |

Cada respuesta muestra su coste aproximado y en **Ajustes** ves el total. Lo más caro: muchas fotos, vídeos con muchos fotogramas y «Pregunta a tus apuntes» con muchos apuntes.

---

## 🔒 Tus datos

- Apuntes y tarjetas se guardan **en tu navegador** (IndexedDB). No se suben a ningún servidor.
- Lo que resumes se envía a Anthropic solo para generar la respuesta.
- **Haz copias** en *Ajustes › Copia de seguridad*. Sirven también para pasar los apuntes del ordenador al móvil (descargas en uno y cargas en el otro).
- La clave de API se guarda solo en ese navegador: no la uses en ordenadores compartidos.

---

## 🛠️ Para trastear

Probarla en tu ordenador (hace falta un servidor, no vale abrir el archivo con doble clic):

```bash
cd apuntes-pau
python3 -m http.server 8000
# abre http://localhost:8000
```

| Archivo | Para qué sirve |
|---|---|
| `js/prompts.js` | **Las instrucciones que recibe Claude**: estructura de resúmenes y comentarios. Es lo primero que conviene adaptar a lo que pide tu profe. |
| `js/claude.js` | Conexión con la API (modelos, precios, errores). |
| `js/db.js` | Base de datos de apuntes y tarjetas. |
| `js/study.js` | Repaso espaciado y tests. |
| `js/views/*.js` | Cada pestaña de la web. |
| `css/styles.css` | Colores y diseño (tiene modo oscuro automático). |
| `vendor/` | Librerías incluidas (ver `vendor/LEEME.md`). |

No necesita compilar nada: son archivos HTML, CSS y JavaScript normales.

### Limitaciones

- **Vídeos**: Claude no oye el audio. Analiza fotogramas y la transcripción (pégala o añade un `.srt`/`.vtt`; en YouTube: *Más › Mostrar transcripción*).
- **Word (.docx)**: guárdalo como PDF antes de subirlo.
- Las notas de las correcciones son **orientativas**: pega los criterios oficiales de tu universidad en *Ajustes* para que se ajusten más.
