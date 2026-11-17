# Markdocs

Aplicación de escritorio para **Linux, macOS y Windows** que convierte tus documentos a **Markdown** sin que salgan de tu equipo. Usa [Docling](https://docling.ai/) como motor de conversión.

![Markdocs](docs/screenshot.png)

## Qué hace

- **Convierte** PDF, DOCX, XLSX, PPTX, ODT/ODS/ODP, HTML, CSV, AsciiDoc, EPUB e imágenes (PNG, JPG, TIFF, BMP, WEBP) a Markdown.
- **Carpetas**: crea carpetas de proyecto para agrupar archivos, o importa una carpeta completa del equipo (con subcarpetas; la salida replica la estructura).
- **Un archivo o muchos**: selecciona archivos sueltos, o deja la selección vacía para convertir todo lo pendiente de la carpeta.
- **Arrastrar y soltar** archivos y carpetas en cualquier parte de la ventana.
- **OCR** para páginas escaneadas y **reconstrucción de tablas**.
- **Imágenes** referenciadas como archivos, incrustadas en base64 u omitidas.
- **Vista previa** del original junto al Markdown (renderizado o código), copiar al portapapeles y mostrar el archivo en su carpeta.
- **Cola de conversión** con cancelación y reintento; tema claro y oscuro.
- **Local**: después de la instalación inicial del motor, no necesita internet.

## Instalación

Descarga el paquete de tu sistema desde [Releases](https://github.com/omarmendozaaa/markdocs/releases):

| Sistema | Archivo | Notas |
| --- | --- | --- |
| Linux (x64) | `Markdocs-x.y.z-linux-x86_64.AppImage` | `chmod +x` y ejecútalo. También hay un `.tar.gz`. |
| macOS (Apple Silicon) | `Markdocs-x.y.z-mac-arm64.dmg` | Ver nota sobre apps sin firmar. |
| macOS (Intel) | `Markdocs-x.y.z-mac-x64.dmg` | Ver nota sobre apps sin firmar. |
| Windows 10/11 (x64) | `Markdocs-x.y.z-win-x64.exe` | SmartScreen: «Más información» → «Ejecutar de todas formas». |

Los paquetes **no están firmados**. En macOS, tras copiar la app a Aplicaciones, quita la cuarentena con `xattr -cr /Applications/Markdocs.app` (o clic derecho → Abrir).

En el primer inicio, Markdocs ofrece **instalar el motor Docling**. Descarga Python, Docling y los modelos (≈ 2 GB) en la carpeta de datos de la app; tarda varios minutos y solo se hace una vez. Necesitas unos 3 GB de espacio libre.

## Cómo funciona

```
Electron (main) ──── IPC ──── React (renderer)
      │
      ├── library.json        carpetas, archivos y ajustes
      └── engine/worker.py    proceso Python persistente con Docling
              ▲  JSON por línea (stdin/stdout)
```

- El motor vive en la carpeta de datos de la app (`~/.config/Markdocs/engine` en Linux, `~/Library/Application Support/Markdocs/engine` en macOS, `%APPDATA%\Markdocs\engine` en Windows): un entorno virtual creado con [uv](https://docs.astral.sh/uv/) (incluido en cada paquete), con su propio Python y los modelos. No modifica el Python del sistema. Para desinstalarlo basta borrar esa carpeta.
- El worker mantiene los modelos cargados entre conversiones, por lo que solo el primer archivo paga el coste de carga.
- Las carpetas de Markdocs son listas de archivos: quitar un archivo o una carpeta en la app **nunca borra nada del disco**.
- Por defecto los `.md` se guardan en `Documentos/Markdocs/<carpeta>`; se puede cambiar por carpeta o guardar junto a cada original.

## Desarrollo

Necesitas Node.js 22+ y [uv](https://docs.astral.sh/uv/) en el `PATH` (en desarrollo se usa el `uv` del sistema). El desarrollo es igual en los tres sistemas.

```bash
npm install
npm run dev          # app con recarga en caliente
npm run typecheck
npm run build        # compila a out/
```

Prueba de extremo a extremo (instala el motor real y convierte los documentos que pongas en `.e2e/samples/`):

```bash
npm run build && npm run e2e
```

Generar el paquete de tu sistema:

```bash
node scripts/fetch-uv.mjs       # descarga uv para esta plataforma a resources/bin
npm run dist                    # dist/Markdocs-x.y.z-<so>-<arq>.<ext>
```

Cada push a `main` compila los paquetes de Linux, macOS (Apple Silicon e Intel) y Windows en GitHub Actions; una etiqueta `v*` los publica además en un Release.

### Estructura

| Ruta | Contenido |
| --- | --- |
| `src/main` | Proceso principal: biblioteca, cola, instalación del motor, IPC |
| `src/preload` | Puente seguro (`window.api`) |
| `src/renderer` | Interfaz React |
| `src/shared` | Tipos compartidos |
| `engine/worker.py` | Worker de Docling |

## Limitaciones conocidas

- El progreso es por etapas (cargar modelos, analizar, escribir); Docling no informa del avance página a página.
- Los PDF protegidos con contraseña no se pueden convertir.
- El motor se instala con PyTorch para CPU en Linux y Windows (sin aceleración por GPU).

## Licencia

[MIT](LICENSE). Markdocs es un proyecto independiente, no afiliado al proyecto Docling. Docling se distribuye bajo licencia MIT; los modelos que descarga tienen sus propias licencias.
