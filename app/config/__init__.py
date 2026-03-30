"""
Конфигурация приложения для production-среды
"""
import os
from dotenv import load_dotenv

# Загружаем переменные окружения
load_dotenv()


class Config:
    """Базовая конфигурация"""
    
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
    
    # Папка для загрузки файлов
    UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', 'uploads')
    
    # Секретный ключ для сессий
    SECRET_KEY = os.environ.get('SECRET_KEY', os.urandom(32).hex())
    
    # Настройки безопасности
    SESSION_COOKIE_SECURE = os.environ.get('FLASK_ENV', 'development') == 'production'
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    
    # Таймаут сессии (30 дней)
    PERMANENT_SESSION_LIFETIME = 2592000


class DevelopmentConfig(Config):
    """Конфигурация для разработки"""
    DEBUG = True
    FLASK_ENV = 'development'


class ProductionConfig(Config):
    """Конфигурация для production"""
    DEBUG = False
    FLASK_ENV = 'production'


class TestingConfig(Config):
    """Конфигурация для тестирования"""
    TESTING = True
    DEBUG = True


config_by_name = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
