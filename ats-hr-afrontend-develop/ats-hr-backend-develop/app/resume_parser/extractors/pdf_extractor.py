from typing import List

from .ocr_extractor import extract_pdf_with_ocr


def _extract_with_pymupdf(file_path: str) -> str:
    try:
        import fitz
    except Exception:
        return ""

    chunks: List[str] = []
    try:
        doc = fitz.open(file_path)
        for page in doc:
            blocks = page.get_text("blocks")
            if not blocks:
                continue
            ordered = sorted(blocks, key=lambda b: (b[1], b[0]))
            chunks.extend([b[4] for b in ordered if len(b) > 6 and b[6] == 0 and b[4]])
    except Exception:
        return ""
    return "\n".join(chunks).strip()


def _extract_with_pdfplumber(file_path: str) -> str:
    try:
        import pdfplumber
    except Exception:
        return ""

    chunks: List[str] = []
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                txt = page.extract_text(x_tolerance=3, y_tolerance=3)
                if txt:
                    chunks.append(txt)
                for table in page.extract_tables() or []:
                    table_lines = [" | ".join((cell or "").strip() for cell in row) for row in table if row]
                    table_text = "\n".join([ln for ln in table_lines if ln.strip()])
                    if table_text:
                        chunks.append(table_text)
    except Exception:
        return ""
    return "\n".join(chunks).strip()


def _extract_with_pypdf2(file_path: str) -> str:
    try:
        from PyPDF2 import PdfReader
    except Exception:
        return ""

    chunks: List[str] = []
    try:
        reader = PdfReader(file_path)
        for page in reader.pages:
            txt = page.extract_text() or ""
            if txt.strip():
                chunks.append(txt)
    except Exception:
        return ""
    return "\n".join(chunks).strip()


def extract_pdf_text(file_path: str) -> str:
    text = _extract_with_pymupdf(file_path)
    if len(text.strip()) >= 50:
        return text

    alt = _extract_with_pdfplumber(file_path)
    if len(alt.strip()) >= len(text.strip()):
        text = alt
    if len(text.strip()) >= 50:
        return text

    fallback = _extract_with_pypdf2(file_path)
    if len(fallback.strip()) >= len(text.strip()):
        text = fallback
    if len(text.strip()) >= 50:
        return text

    ocr = extract_pdf_with_ocr(file_path)
    if len(ocr.strip()) >= len(text.strip()):
        text = ocr
    return text

