"""
Конфигурация приложения
"""
import os


class Config:
    """Класс конфигурации приложения"""
    
    # Supabase конфигурация
    SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
    SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')

    # Шаблон Excel
    TEMPLATE_PATH = "1.xlsx"

    # Разрешенные форматы изображений
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp'}

    # Максимальный размер файла (16MB)
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024

    # Настройки сжатия изображений
    IMAGE_MAX_SIZE = 1024  # Максимальный размер стороны в пикселях
    IMAGE_QUALITY = 70  # Качество сжатия в процентах
    IMAGE_FORMAT = 'JPEG'  # Формат для сохранения
    
    # Расширения файлов документов
    DOCUMENT_EXTENSIONS = {'doc', 'docx'}
