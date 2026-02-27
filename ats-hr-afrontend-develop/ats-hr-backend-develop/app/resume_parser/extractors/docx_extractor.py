from typing import List


def _iter_block_items(document):
    """
    Yield paragraphs and tables in actual document order.
    """
    try:
        from docx.document import Document as _Document
        from docx.oxml.table import CT_Tbl
        from docx.oxml.text.paragraph import CT_P
        from docx.table import Table
        from docx.text.paragraph import Paragraph
    except Exception:
        return []

    if isinstance(document, _Document):
        parent_elm = document.element.body
    else:
        parent_elm = document.element.body

    items = []
    for child in parent_elm.iterchildren():
        if isinstance(child, CT_P):
            items.append(Paragraph(child, document))
        elif isinstance(child, CT_Tbl):
            items.append(Table(child, document))
    return items


def _extract_table_row_text(row) -> str:
    cells = []
    for cell in row.cells:
        value = " ".join((p.text or "").strip() for p in cell.paragraphs if (p.text or "").strip())
        value = value.strip()
        if value:
            cells.append(value)
    return " | ".join(cells)


def extract_docx_text(file_path: str) -> str:
    try:
        from docx import Document
        from docx.table import Table
        from docx.text.paragraph import Paragraph
    except Exception:
        return ""

    chunks: List[str] = []
    try:
        doc = Document(file_path)
    except Exception:
        return ""

    for block in _iter_block_items(doc):
        if isinstance(block, Paragraph):
            line = (block.text or "").strip()
            if not line:
                continue
            style_name = str(getattr(block.style, "name", "") or "")
            if "heading" in style_name.lower():
                chunks.append(f"[HEADING] {line}")
            else:
                chunks.append(line)
        elif isinstance(block, Table):
            for row in block.rows:
                row_text = _extract_table_row_text(row)
                if row_text:
                    chunks.append(row_text)

    return "\n".join(chunks).strip()
