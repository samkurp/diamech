# Рефакторинг проекта для Production

## Выполненные изменения

### 1. Модульная архитектура
Проект реорганизован в модульную структуру:

```
/workspace/
├── app/                      # Основной пакет приложения
│   ├── __init__.py          # Точка входа, фабрика приложений
│   ├── config/              # Конфигурация
│   │   └── __init__.py      # Config классы (Dev/Prod/Test)
│   ├── services/            # Бизнес-логика
│   │   └── supabase_service.py  # Сервис работы с Supabase
│   ├── utils/               # Утилиты
│   │   ├── __init__.py
│   │   ├── logger.py        # Настройка логгирования
│   │   ├── image_utils.py   # Сжатие изображений
│   │   ├── document_utils.py # Извлечение текста из DOC/DOCX
│   │   ├── file_utils.py    # Генерация имен файлов
│   │   └── validators.py    # Валидация данных
│   ├── models/              # Модели данных (пусто, для расширения)
│   └── routes/              # API маршруты (встроены в __init__.py)
├── static/                  # Frontend файлы
├── logs/                    # Логи приложения (создается автоматически)
├── uploads/                 # Загруженные файлы
├── .env.example             # Пример переменных окружения
├── requirements.txt         # Зависимости
└── render.yaml             # Конфигурация для Render.com
```

### 2. Конфигурация (app/config/__init__.py)
- Разделение конфигурации на DevelopmentConfig, ProductionConfig, TestingConfig
- Безопасные настройки сессий (HTTPONLY, SAMESITE, SECURE)
- Генерация SECRET_KEY из переменных окружения
- Настройки через FLASK_ENV

### 3. Логирование (app/utils/logger.py)
- RotatingFileHandler с ротацией (10MB, 5 файлов)
- Разные уровни логгирования для dev/prod
- Форматированные логи с timestamp
- Логирование в файлы и консоль

### 4. Сервисный слой (app/services/supabase_service.py)
- Выделен SupabaseService для работы с БД
- Инкапсуляция всей бизнес-логики
- Удобное тестирование через моки
- Методы: get_all_drafts, save_draft, update_draft, delete_draft, get_history и др.

### 5. Утилиты
- **image_utils.py**: Сжатие изображений с настраиваемым качеством
- **document_utils.py**: Извлечение текста из DOC/DOCX файлов
- **file_utils.py**: Генерация имен файлов и папок, транслитерация
- **validators.py**: Валидация данных и проверка расширений файлов

### 6. Фабрика приложений (app/__init__.py)
- Функция create_app() для гибкой инициализации
- Регистрация маршрутов через register_routes()
- Регистрация обработчиков ошибок
- Интеграция всех компонентов

### 7. Безопасность
- SECRET_KEY из переменных окружения
- SESSION_COOKIE_SECURE для HTTPS
- SESSION_COOKIE_HTTPONLY = True
- SESSION_COOKIE_SAMESITE = 'Lax'
- Валидация загружаемых файлов
- Подтверждение удаления через параметр confirm=yes

### 8. Production-готовность
- Логирование с ротацией файлов
- Обработка ошибок с логированием
- Конфигурация через переменные окружения
- Поддержка WSGI серверов (gunicorn)
- Health check эндпоинт (/api/health)

## Обновленный requirements.txt
```
Flask==2.3.3
flask-cors==4.0.0
openpyxl==3.1.2
supabase==2.12.0
python-dotenv==1.0.0
gunicorn==21.2.0
Pillow==10.1.0
python-docx==0.8.11
olefile==0.46
```

## Переменные окружения (.env)
```bash
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# Безопасность
SECRET_KEY=your_secret_key_32_chars_min
FLASK_ENV=production  # или development

# Файлы
UPLOAD_FOLDER=uploads
PORT=10000
```

## Запуск приложения

### Development
```bash
export FLASK_ENV=development
python app/__init__.py
```

### Production (gunicorn)
```bash
export FLASK_ENV=production
export SECRET_KEY=your_secret_key
gunicorn "app:create_app()" --bind 0.0.0.0:$PORT --workers 4
```

### Render.com
Автоматически через render.yaml:
```yaml
buildCommand: pip install -r requirements.txt
startCommand: gunicorn "app:create_app()"
```

## Преимущества новой архитектуры

1. **Поддерживаемость**: Код разделен на логические модули
2. **Тестируемость**: Сервисы можно легко мокать в тестах
3. **Масштабируемость**: Легко добавлять новые функции
4. **Безопасность**: Production-ready настройки безопасности
5. **Надежность**: Логирование и обработка ошибок
6. **Гибкость**: Фабрика приложений для разных конфигураций

## Сохранена функциональность
- ✅ CRUD операции с черновиками
- ✅ Загрузка и сжатие изображений
- ✅ Генерация Excel протоколов
- ✅ Создание ZIP архивов
- ✅ История изменений
- ✅ Управление файлами заявок (DOC/DOCX)
- ✅ Система обновлений прошивок
- ✅ Все существующие API эндпоинты
