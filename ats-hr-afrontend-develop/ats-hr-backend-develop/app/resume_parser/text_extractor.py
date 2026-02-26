"""
Backwards-compatible text extraction API.
Now delegates to the Phase-1 smart extractor and cleaner modules.
"""

from .cleaners.text_cleaner import clean_resume_text
from .extractors.smart_extractor import smart_extract_text


def extract_text_from_file(file_path: str, file_ext: str) -> str:
    return smart_extract_text(file_path=file_path, file_ext=file_ext)


def clean_extracted_text(text: str) -> str:
    return clean_resume_text(text)
