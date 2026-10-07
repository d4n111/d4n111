# Librerías incluidas

Estas librerías van copiadas dentro del proyecto para que la web funcione sin
pasos de compilación (basta con servir la carpeta `apuntes-pau/`).

| Archivo | Librería | Versión | Licencia |
|---|---|---|---|
| `anthropic-sdk.mjs` | [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript) | 0.131.0 | MIT |
| `marked.esm.js` | [marked](https://github.com/markedjs/marked) | 18.1.0 | MIT |
| `purify.es.mjs` | [DOMPurify](https://github.com/cure53/DOMPurify) | 3.4.16 | Apache-2.0 / MPL-2.0 |

KaTeX (fórmulas) y Mermaid (diagramas) se cargan desde jsDelivr solo cuando
hacen falta, porque pesan mucho. Si no cargan, la web sigue funcionando y
muestra las fórmulas como texto.

## Cómo actualizar el SDK de Claude

```bash
mkdir /tmp/sdk && cd /tmp/sdk && npm init -y
npm install @anthropic-ai/sdk esbuild
echo 'export { default } from "@anthropic-ai/sdk";' > entry.mjs
npx esbuild entry.mjs --bundle --format=esm --platform=browser --minify \
  --outfile=anthropic-sdk.mjs
```

Después copia `anthropic-sdk.mjs` aquí y actualiza la versión de la tabla.
