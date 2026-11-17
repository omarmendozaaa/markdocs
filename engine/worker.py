"""Markdocs conversion worker.

Long-lived process driven by the Electron main process.

Protocol (UTF-8, one JSON object per line):
  stdin  -> {"id": str, "input": path, "output": path, "options": {...}}
  stdout <- {"type": "ready", "version": str}
            {"type": "stage", "id": str, "stage": "loading"|"converting"|"writing"}
            {"type": "done", "id": str, "output": path, "pages": int, "tables": int, "ms": int}
            {"type": "error", "id": str, "message": str}

Run with --warmup to download/initialise the models and exit.
"""

import json
import os
import sys
import time
import traceback
from pathlib import Path

# Keep the protocol channel private: anything a library prints to stdout
# is redirected to stderr so it can never corrupt the JSON stream.
_proto = os.fdopen(os.dup(1), "w", encoding="utf-8", newline="\n")
os.dup2(2, 1)
sys.stdout = sys.stderr


def emit(obj):
    _proto.write(json.dumps(obj, ensure_ascii=False) + "\n")
    _proto.flush()


_converters = {}


def get_converter(options):
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions
    from docling.document_converter import (
        DocumentConverter,
        ImageFormatOption,
        PdfFormatOption,
    )

    ocr = bool(options.get("ocr", True))
    tables = bool(options.get("tables", True))
    pictures = options.get("images", "referenced") != "placeholder"
    key = (ocr, tables, pictures)
    if key not in _converters:
        po = PdfPipelineOptions()
        po.do_ocr = ocr
        po.do_table_structure = tables
        po.generate_picture_images = pictures
        if pictures:
            po.images_scale = 2.0
        _converters[key] = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(pipeline_options=po),
                InputFormat.IMAGE: ImageFormatOption(pipeline_options=po),
            }
        )
    return _converters[key]


def friendly_error(exc):
    text = str(exc) or exc.__class__.__name__
    low = text.lower()
    if "password" in low or "encrypted" in low:
        return "El PDF está protegido con contraseña. Quita la protección y vuelve a intentarlo."
    if isinstance(exc, FileNotFoundError):
        return "No se encontró el archivo. ¿Se movió o se eliminó?"
    if isinstance(exc, PermissionError):
        return "Sin permiso para leer el archivo o escribir en la carpeta de salida."
    if "not supported" in low or "format not allowed" in low:
        return "Docling no admite este formato de archivo."
    first = text.strip().splitlines()[0] if text.strip() else exc.__class__.__name__
    return first[:300]


def convert(job):
    from docling_core.types.doc import ImageRefMode

    job_id = job["id"]
    options = job.get("options") or {}
    src = Path(job["input"])
    out = Path(job["output"])
    started = time.time()

    emit({"type": "stage", "id": job_id, "stage": "loading"})
    converter = get_converter(options)

    emit({"type": "stage", "id": job_id, "stage": "converting"})
    result = converter.convert(src)
    doc = result.document

    emit({"type": "stage", "id": job_id, "stage": "writing"})
    out.parent.mkdir(parents=True, exist_ok=True)
    mode = {
        "embedded": ImageRefMode.EMBEDDED,
        "referenced": ImageRefMode.REFERENCED,
    }.get(options.get("images", "referenced"), ImageRefMode.PLACEHOLDER)
    doc.save_as_markdown(out, image_mode=mode)
    artifacts = out.with_name(out.stem + "_artifacts")
    try:
        if artifacts.is_dir() and not any(artifacts.iterdir()):
            artifacts.rmdir()
    except OSError:
        pass

    emit(
        {
            "type": "done",
            "id": job_id,
            "output": str(out),
            "pages": len(getattr(doc, "pages", None) or {}),
            "tables": len(getattr(doc, "tables", None) or []),
            "ms": int((time.time() - started) * 1000),
        }
    )


def warmup():
    from docling.datamodel.base_models import InputFormat

    converter = get_converter({"ocr": True, "tables": True, "images": "referenced"})
    converter.initialize_pipeline(InputFormat.PDF)


def main():
    if hasattr(sys.stdin, "reconfigure"):
        sys.stdin.reconfigure(encoding="utf-8")

    if "--warmup" in sys.argv:
        warmup()
        return

    from importlib.metadata import version

    emit({"type": "ready", "version": version("docling")})
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        job = None
        try:
            job = json.loads(line)
            convert(job)
        except Exception as exc:  # noqa: BLE001 - report every failure to the UI
            traceback.print_exc(file=sys.stderr)
            emit(
                {
                    "type": "error",
                    "id": (job or {}).get("id", ""),
                    "message": friendly_error(exc),
                }
            )


if __name__ == "__main__":
    main()
