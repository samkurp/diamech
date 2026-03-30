"""
Модуль утилит
"""
from .logger import setup_logger
from .image_utils import compress_image
from .document_utils import extract_text_from_docx, extract_text_from_doc, extract_text_from_file
from .file_utils import (
    transliterate_machine_type,
    generate_folder_name,
    generate_protocol_filename,
    generate_zip_filename
)
from .validators import allowed_file, validate_draft_data

__all__ = [
    'setup_logger',
    'compress_image',
    'extract_text_from_docx',
    'extract_text_from_doc',
    'extract_text_from_file',
    'transliterate_machine_type',
    'generate_folder_name',
    'generate_protocol_filename',
    'generate_zip_filename',
    'allowed_file',
    'validate_draft_data'
]
