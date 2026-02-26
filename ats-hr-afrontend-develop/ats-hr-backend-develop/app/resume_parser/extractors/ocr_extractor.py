from typing import List


def _prepare_image(image):
    # Import lazily to keep module safe when OCR deps are not installed.
    from PIL import ImageEnhance, ImageFilter

    img = image.convert("L")
    img = ImageEnhance.Contrast(img).enhance(2.0)
    img = img.filter(ImageFilter.SHARPEN)
    return img


def extract_text_from_images(images: List) -> str:
    try:
        import pytesseract
    except Exception:
        return ""

    chunks = []
    for image in images:
        try:
            prepared = _prepare_image(image)
            text = pytesseract.image_to_string(prepared, lang="eng", config="--psm 6")
            if text and text.strip():
                chunks.append(text)
        except Exception:
            continue
    return "\n".join(chunks).strip()


def extract_pdf_with_ocr(file_path: str, dpi: int = 300, max_pages: int = 20) -> str:
    try:
        from pdf2image import convert_from_path
    except Exception:
        return ""

    try:
        pages = convert_from_path(file_path, dpi=dpi)
    except Exception:
        return ""

    if not pages:
        return ""
    return extract_text_from_images(pages[:max_pages])


def extract_image_file_text(file_path: str) -> str:
    try:
        from PIL import Image
    except Exception:
        return ""

    try:
        image = Image.open(file_path)
    except Exception:
        return ""
    return extract_text_from_images([image])

