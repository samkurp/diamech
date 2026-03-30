"""
Модуль логгирования для production-среды
"""
import logging
import sys
from logging.handlers import RotatingFileHandler
import os


def setup_logger(app):
    """
    Настраивает логгер для приложения
    
    Args:
        app: Flask приложение
    """
    
    # Создаем директорию для логов если не существует
    log_dir = 'logs'
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
    
    # Форматтер для логов
    formatter = logging.Formatter(
        '[%(asctime)s] %(levelname)s in %(module)s: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # File handler с ротацией (10MB max, 5 файлов)
    file_handler = RotatingFileHandler(
        'logs/app.log',
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding='utf-8'
    )
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(formatter)
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG)
    console_handler.setFormatter(formatter)
    
    # Настраиваем logger приложения
    app.logger.addHandler(file_handler)
    app.logger.addHandler(console_handler)
    app.logger.setLevel(logging.INFO)
    
    # В production режиме увеличиваем уровень логгирования
    if os.environ.get('FLASK_ENV') == 'production':
        app.logger.setLevel(logging.WARNING)
        console_handler.setLevel(logging.WARNING)
    
    app.logger.info('🚀 Приложение запущено')
    app.logger.info(f'📁 Режим: {os.environ.get("FLASK_ENV", "development")}')
    
    return app.logger
