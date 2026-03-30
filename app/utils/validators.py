"""
Утилиты для валидации данных
"""


def allowed_file(filename, allowed_extensions):
    """Проверка разрешенного формата файла"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions


def validate_draft_data(data):
    """
    Валидация данных черновика
    
    Args:
        data: словарь с данными черновика
    
    Returns:
        tuple: (is_valid, error_message)
    """
    required_fields = [
        'machineType',
        'liftingCapacity',
        'serialNumber'
    ]
    
    for field in required_fields:
        if not data.get(field):
            return False, f"Поле '{field}' является обязательным"
    
    return True, None
