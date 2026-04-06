"""
Основное приложение Flask
"""
import os
from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS

# Загружаем переменные окружения
load_dotenv()


def create_app(static_folder='static'):
    """
    Создает и настраивает приложение Flask
    
    Args:
        static_folder: папка со статическими файлами
    
    Returns:
        настроенное приложение Flask
    """
    app = Flask(__name__, static_folder=static_folder)
    CORS(app)
    
    # Настраиваем максимальный размер загружаемых файлов
    from .config import Config
    app.config['MAX_CONTENT_LENGTH'] = Config.MAX_CONTENT_LENGTH
    
    # Инициализируем Supabase
    from .database import init_supabase
    init_supabase()
    
    # Регистрируем маршруты
    from .routes import register_routes
    register_routes(app)
    
    print("✅ Приложение успешно инициализировано")
    
    return app


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    app = create_app()
    app.run(host='0.0.0.0', port=port, debug=False)
