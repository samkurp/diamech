"""
Утилиты для генерации имен файлов и папок
"""


def transliterate_machine_type(machine_type):
    """Транслитерирует тип станка для имени ZIP файла"""
    translit_map = {
        'В': 'B',
        'ВТ': 'BT',
        'ВМ': 'BM',
        'СП': 'SP',
        'ДБС': 'DBS'
    }
    return translit_map.get(machine_type, machine_type)


def generate_folder_name(data):
    """Генерирует имя папки для сохранения"""
    machine_type = data.get('machineType', '').strip()
    lifting_capacity = data.get('liftingCapacity', '').strip()
    serial_number = data.get('serialNumber', 'unknown').strip().replace(' ', '_')
    return f"ML_{machine_type}{lifting_capacity}№{serial_number}"


def generate_protocol_filename(data):
    """Генерирует имя файла протокола (кириллица)"""
    machine_type = data.get('machineType', '').strip()
    lifting_capacity = data.get('liftingCapacity', '').strip()
    serial_number = data.get('serialNumber', 'unknown').strip().replace(' ', '_')
    return f"{machine_type}{lifting_capacity}№{serial_number}.xlsx"


def generate_zip_filename(data):
    """Генерирует имя ZIP файла (латиница)"""
    machine_type = data.get('machineType', '').strip()
    lifting_capacity = data.get('liftingCapacity', '').strip()
    serial_number = data.get('serialNumber', 'unknown').strip().replace(' ', '_')
    
    # Транслитерируем тип станка
    machine_type_lat = transliterate_machine_type(machine_type)
    
    return f"{machine_type_lat}{lifting_capacity}№{serial_number}.zip"
