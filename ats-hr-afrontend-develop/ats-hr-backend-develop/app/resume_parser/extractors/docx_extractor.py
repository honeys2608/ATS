from typing import List


def extract_docx_text(file_path: str) -> str:
    try:
        from docx import Document
    except Exception:
        return ""

    chunks: List[str] = []
    try:
        doc = Document(file_path)
    except Exception:
        return ""

    for para in doc.paragraphs:
        line = (para.text or "").strip()
        if not line:
            continue
        style_name = str(getattr(para.style, "name", "") or "")
        if "heading" in style_name.lower():
            chunks.append(f"[HEADING] {line}")
        else:
            chunks.append(line)

    for table in doc.tables:
        for row in table.rows:
            row_text = " | ".join((cell.text or "").strip() for cell in row.cells if (cell.text or "").strip())
            if row_text:
                chunks.append(row_text)

    return "\n".join(chunks).strip()

