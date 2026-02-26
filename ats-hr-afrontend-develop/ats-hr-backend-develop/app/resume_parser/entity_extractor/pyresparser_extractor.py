from functools import lru_cache
from typing import Dict


@lru_cache(maxsize=1)
def _get_parser_cls():
    try:
        from pyresparser import ResumeParser

        return ResumeParser
    except Exception:
        return None


def extract_entities_pyresparser(file_path: str) -> Dict:
    parser_cls = _get_parser_cls()
    if parser_cls is None:
        return {}
    try:
        return parser_cls(file_path).get_extracted_data() or {}
    except Exception:
        return {}

