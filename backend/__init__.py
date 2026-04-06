"""
Backend модули приложения
"""

from .config import Config
from .database import SupabaseDB, supabase
from .image_utils import compress_image, allowed_file
from .document_utils import extract_text_from_docx, extract_text_from_doc, extract_text_from_file
from .balancing import calculate_balancing, calculate_vector_balancing
from .protocol_generator import generate_protocol
from .routes import register_routes
from .app import create_app

__all__ = [
    'Config',
    'SupabaseDB',
    'supabase',
    'compress_image',
    'allowed_file',
    'extract_text_from_docx',
    'extract_text_from_doc',
    'extract_text_from_file',
    'calculate_balancing',
    'calculate_vector_balancing',
    'generate_protocol',
    'register_routes',
    'create_app'
]
