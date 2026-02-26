import mimetypes
import os
import shutil
import subprocess
import tempfile
from typing import Optional

from .docx_extractor import extract_docx_text
from .ocr_extractor import extract_image_file_text
from .pdf_extractor import extract_pdf_text

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".tiff", ".bmp"}


def _detect_mime(file_path: str) -> str:
    try:
        import magic

        return str(magic.from_file(file_path, mime=True) or "").lower()
    except Exception:
        guessed, _ = mimetypes.guess_type(file_path)
        return str(guessed or "").lower()


def _extract_txt(file_path: str) -> str:
    for enc in ("utf-8", "utf-16", "latin-1"):
        try:
            with open(file_path, "r", encoding=enc, errors="ignore") as handle:
                txt = handle.read()
                if txt and txt.strip():
                    return txt.strip()
        except Exception:
            continue
    return ""


def _extract_doc_with_textract(file_path: str) -> str:
    try:
        import textract
    except Exception:
        return ""

    try:
        raw = textract.process(file_path)
        return raw.decode("utf-8", errors="ignore").strip()
    except Exception:
        return ""


def _convert_doc_to_docx(doc_path: str) -> Optional[str]:
    soffice = shutil.which("soffice")
    if not soffice:
        return None

    out_dir = tempfile.mkdtemp(prefix="resume_doc_convert_")
    try:
        result = subprocess.run(
            [soffice, "--headless", "--convert-to", "docx", "--outdir", out_dir, doc_path],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode != 0:
            return None
        base = os.path.splitext(os.path.basename(doc_path))[0]
        converted = os.path.join(out_dir, f"{base}.docx")
        if not os.path.exists(converted):
            return None
        return converted
    except Exception:
        return None


def smart_extract_text(file_path: str, file_ext: Optional[str] = None) -> str:
    ext = (file_ext or os.path.splitext(file_path)[1]).lower()
    mime = _detect_mime(file_path)

    if ext == ".pdf" or "pdf" in mime:
        return extract_pdf_text(file_path)

    if ext == ".docx" or "wordprocessingml.document" in mime:
        return extract_docx_text(file_path)

    if ext == ".doc" or mime in {"application/msword"}:
        converted = _convert_doc_to_docx(file_path)
        if converted:
            try:
                txt = extract_docx_text(converted)
                if txt.strip():
                    return txt
            finally:
                try:
                    os.remove(converted)
                except Exception:
                    pass
        return _extract_doc_with_textract(file_path)

    if ext in IMAGE_EXTS or mime.startswith("image/"):
        return extract_image_file_text(file_path)

    if ext in {".txt", ".md", ".rtf"} or mime.startswith("text/"):
        return _extract_txt(file_path)

    # Catch-all
    fallback = _extract_doc_with_textract(file_path)
    if fallback.strip():
        return fallback
    return _extract_txt(file_path)

