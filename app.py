from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from openpyxl import load_workbook
import os
from datetime import datetime
import tempfile
import shutil
import json
import uuid
import traceback
from werkzeug.utils import secure_filename
from supabase import create_client, Client
import io
from PIL import Image
import base64
from dotenv import load_dotenv
app = Flask(__name__, static_folder='static')
CORS(app)
# Вставьте ЭТОТ КОД сразу после load_dotenv() в самом верху app.py



load_dotenv()

# ========== СРОЧНАЯ ДИАГНОСТИКА ==========
print("\n" + "="*50)
print("🔴 ДИАГНОСТИКА SUPABASE НА RENDER")
print("="*50)

# Проверяем переменные окружения
supabase_url = os.environ.get('SUPABASE_URL', '')
supabase_key = os.environ.get('SUPABASE_KEY', '')

print(f"1. SUPABASE_URL: {'✅ НАЙДЕН' if supabase_url else '❌ ОТСУТСТВУЕТ'}")
print(f"   Длина: {len(supabase_url)} символов")
print(f"   Значение: {supabase_url[:20]}...")

print(f"\n2. SUPABASE_KEY: {'✅ НАЙДЕН' if supabase_key else '❌ ОТСУТСТВУЕТ'}")
print(f"   Длина: {len(supabase_key)} символов")
print(f"   Начинается с: {supabase_key[:20]}...")

print("\n3. ВСЕ ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ:")
for key, value in os.environ.items():
    if 'SUPABASE' in key or 'PYTHON' in key or 'PORT' in key:
        print(f"   {key}: {'✅' if value else '❌'}")
print("="*50 + "\n")
# ========================================

# Конфигурация для Render
class Config:
    # Supabase конфигурация
    SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
    SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')

    # SMB опционально
    SMB_SERVER = os.environ.get('SMB_SERVER', '')
    SMB_SHARE = os.environ.get('SMB_SHARE', '')
    SMB_USERNAME = os.environ.get('SMB_USERNAME', '')
    SMB_PASSWORD = os.environ.get('SMB_PASSWORD', '')

    TEMPLATE_PATH = "1.xlsx"
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp'}
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size


# Инициализация Supabase
supabase: Client = None


def init_supabase():
    global supabase
    if Config.SUPABASE_URL and Config.SUPABASE_KEY:
        supabase = create_client(Config.SUPABASE_URL, Config.SUPABASE_KEY)
        print("Supabase подключение успешно")

        # Создаем таблицы при запуске
        create_tables()
    else:
        print("Supabase не настроен")


def create_tables():
    """Создание таблиц в Supabase"""
    try:
        # Таблица для черновиков
        supabase.table('drafts').select('*').limit(1).execute()
        print("Таблицы существуют")
    except Exception as e:
        print(f"Ошибка при проверке таблиц: {e}")


# Вспомогательные функции
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS


def generate_folder_name(data):
    """Генерирует имя папки для сохранения"""
    machine_type = data.get('machineType', '').strip()
    lifting_capacity = data.get('liftingCapacity', '').strip()
    serial_number = data.get('serialNumber', 'unknown').strip().replace(' ', '_')
    return f"ML_{machine_type}{lifting_capacity}№{serial_number}"


# Управление черновиками в Supabase
class DraftManager:
    @staticmethod
    def get_drafts_paginated(page=1, per_page=20, filter_status=None):
        """Получает черновики с пагинацией"""
        try:
            query = supabase.table('drafts').select('*', count='exact')

            if filter_status == 'shipped':
                query = query.eq('machine_status', 'Отгружен')
            elif filter_status == 'active':
                query = query.neq('machine_status', 'Отгружен')

            # Пагинация
            start = (page - 1) * per_page
            end = start + per_page - 1

            result = query.order('updated_at', desc=True).range(start, end).execute()

            drafts = []
            for draft in result.data:
                draft_info = {
                    'id': draft['id'],
                    'display_name': draft.get('display_name', 'Без названия'),
                    'machine_type': draft.get('data', {}).get('machineType', 'Неизвестно'),
                    'serial_number': draft.get('data', {}).get('serialNumber', 'Неизвестно'),
                    'lifting_capacity': draft.get('data', {}).get('liftingCapacity', 'Неизвестно'),
                    'work_type': draft.get('data', {}).get('workType', 'Не указан'),
                    'customer': draft.get('data', {}).get('customer', 'Не указан'),
                    'created_at': draft.get('created_at', ''),
                    'updated_at': draft.get('updated_at', ''),
                    'machine_status': draft.get('machine_status', 'Сборка'),
                    'shipping_date': draft.get('shipping_date', ''),
                    'customer_info': draft.get('customer_info', {})
                }
                drafts.append(draft_info)

            return {
                'drafts': drafts,
                'total': result.count,
                'page': page,
                'per_page': per_page,
                'total_pages': (result.count + per_page - 1) // per_page
            }

        except Exception as e:
            print(f"Error getting drafts: {e}")
            return {'drafts': [], 'total': 0, 'page': page, 'per_page': per_page, 'total_pages': 0}

    @staticmethod
    def search_drafts(query, filter_status=None):
        """Поиск черновиков"""
        try:
            # Сначала получаем все черновики с фильтром
            drafts = DraftManager.get_all_drafts(filter_status)

            # Фильтруем по поисковому запросу
            query = query.lower().strip()
            if not query:
                return drafts

            results = []
            for draft in drafts:
                searchable_fields = [
                    draft.get('display_name', '').lower(),
                    draft.get('serial_number', '').lower(),
                    draft.get('machine_type', '').lower(),
                    draft.get('customer', '').lower(),
                    draft.get('work_type', '').lower()
                ]

                if any(query in field for field in searchable_fields):
                    results.append(draft)

            return results

        except Exception as e:
            print(f"Search error: {e}")
            return []
    @staticmethod
    def save_draft(data, images=None):
        """Сохраняет черновик в Supabase"""
        try:
            machine_type = data.get('machineType', 'Unknown')
            lifting_capacity = data.get('liftingCapacity', 'Unknown')
            serial_number = data.get('serialNumber', 'Unknown')

            # Генерируем ID черновика
            draft_id = f"{machine_type}_{lifting_capacity}_{serial_number}"
            draft_id = "".join(c for c in draft_id if c.isalnum() or c in ('_', '-')).rstrip()

            if not draft_id or draft_id == "_Unknown_Unknown":
                draft_id = str(uuid.uuid4())

            # Подготавливаем данные
            display_name = f"{machine_type}-{lifting_capacity} №{serial_number}"

            draft_data = {
                'id': draft_id,
                'data': dict(data),
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat(),
                'display_name': display_name,
                'machine_status': data.get('machineStatus', 'Сборка'),
                'shipping_date': data.get('shippingDate', '')
            }

            # Сохраняем в Supabase
            result = supabase.table('drafts').upsert(draft_data).execute()

            # Сохраняем изображения
            saved_images = []
            if images:
                for img in images:
                    if img and allowed_file(img.filename):
                        filename = secure_filename(img.filename)
                        # Читаем и конвертируем изображение
                        img.seek(0)
                        img_data = img.read()
                        img_base64 = base64.b64encode(img_data).decode('utf-8')

                        image_data = {
                            'draft_id': draft_id,
                            'filename': filename,
                            'image_data': img_base64,
                            'content_type': img.content_type,
                            'uploaded_at': datetime.now().isoformat()
                        }

                        supabase.table('images').upsert(image_data).execute()
                        saved_images.append(filename)

            return True, {'id': draft_id, 'display_name': display_name, 'saved_images': saved_images}, None

        except Exception as e:
            return False, f"Draft save error: {str(e)}", None

    @staticmethod
    def load_draft(draft_id):
        """Загружает черновик из Supabase"""
        try:
            result = supabase.table('drafts').select('*').eq('id', draft_id).execute()

            if not result.data:
                return None

            draft_data = result.data[0]

            # Загружаем информацию об изображениях
            images_result = supabase.table('images') \
                .select('filename') \
                .eq('draft_id', draft_id) \
                .execute()

            draft_data['image_files'] = [img['filename'] for img in images_result.data]

            return draft_data

        except Exception as e:
            print(f"Error loading draft: {e}")
            return None

    @staticmethod
    def update_draft(draft_id, data, new_images=None):
        """Обновляет черновик"""
        try:
            draft_data = DraftManager.load_draft(draft_id)
            if not draft_data:
                return False, "Черновик не найден"

            # Обновляем данные
            current_data = draft_data.get('data', {})
            for key, value in dict(data).items():
                current_data[key] = value

            update_data = {
                'data': current_data,
                'updated_at': datetime.now().isoformat(),
                'machine_status': data.get('machineStatus', draft_data.get('machine_status', 'Сборка')),
                'shipping_date': data.get('shippingDate', draft_data.get('shipping_date', ''))
            }

            # Обновляем display_name
            machine_type = data.get('machineType', current_data.get('machineType', 'Неизвестно'))
            lifting_capacity = data.get('liftingCapacity', current_data.get('liftingCapacity', 'Неизвестно'))
            serial_number = data.get('serialNumber', current_data.get('serialNumber', 'Неизвестно'))
            update_data['display_name'] = f"{machine_type}-{lifting_capacity} №{serial_number}"

            # Сохраняем в Supabase
            supabase.table('drafts').update(update_data).eq('id', draft_id).execute()

            # Сохраняем новые изображения
            if new_images:
                for img in new_images:
                    if img and allowed_file(img.filename):
                        filename = secure_filename(img.filename)
                        img.seek(0)
                        img_data = img.read()
                        img_base64 = base64.b64encode(img_data).decode('utf-8')

                        image_data = {
                            'draft_id': draft_id,
                            'filename': filename,
                            'image_data': img_base64,
                            'content_type': img.content_type,
                            'uploaded_at': datetime.now().isoformat()
                        }

                        supabase.table('images').upsert(image_data).execute()

            return True, update_data

        except Exception as e:
            return False, f"Update error: {str(e)}"

    @staticmethod
    def update_customer_data(draft_id, customer_data):
        """Обновляет данные заказчика"""
        try:
            draft_data = DraftManager.load_draft(draft_id)
            if not draft_data:
                return False, "Черновик не найден"

            customer_info = draft_data.get('customer_info', {})
            customer_info.update(customer_data)
            customer_info['updated_at'] = datetime.now().isoformat()

            supabase.table('drafts') \
                .update({'customer_info': customer_info, 'updated_at': datetime.now().isoformat()}) \
                .eq('id', draft_id) \
                .execute()

            return True, draft_data

        except Exception as e:
            return False, f"Customer update error: {str(e)}"

    @staticmethod
    def get_customer_data(draft_id):
        """Получает данные заказчика"""
        try:
            result = supabase.table('drafts') \
                .select('customer_info, data') \
                .eq('id', draft_id) \
                .execute()

            if not result.data:
                return None

            draft = result.data[0]
            customer_info = draft.get('customer_info', {})

            if customer_info:
                return customer_info

            customer_name = draft.get('data', {}).get('customer', 'Не указан')
            return {
                'customerName': customer_name,
                'originalCustomer': customer_name
            }

        except Exception as e:
            print(f"Error getting customer data: {e}")
            return None

    @staticmethod
    def get_all_drafts(filter_status=None):
        """Получает все черновики с фильтрацией"""
        try:
            query = supabase.table('drafts').select('*')

            if filter_status == 'shipped':
                query = query.eq('machine_status', 'Отгружен')
            elif filter_status == 'active':
                query = query.neq('machine_status', 'Отгружен')

            result = query.execute()

            drafts = []
            for draft in result.data:
                draft_info = {
                    'id': draft['id'],
                    'display_name': draft.get('display_name', 'Без названия'),
                    'machine_type': draft.get('data', {}).get('machineType', 'Неизвестно'),
                    'serial_number': draft.get('data', {}).get('serialNumber', 'Неизвестно'),
                    'lifting_capacity': draft.get('data', {}).get('liftingCapacity', 'Неизвестно'),
                    'work_type': draft.get('data', {}).get('workType', 'Не указан'),
                    'customer': draft.get('data', {}).get('customer', 'Не указан'),
                    'created_at': draft.get('created_at', ''),
                    'updated_at': draft.get('updated_at', ''),
                    'machine_status': draft.get('machine_status', 'Сборка'),
                    'shipping_date': draft.get('shipping_date', ''),
                    'customer_info': draft.get('customer_info', {})
                }
                drafts.append(draft_info)

            drafts.sort(key=lambda x: x.get('updated_at', ''), reverse=True)
            return drafts

        except Exception as e:
            print(f"Error getting drafts: {e}")
            return []

    @staticmethod
    def get_image(draft_id, filename):
        """Получает изображение из Supabase"""
        try:
            result = supabase.table('images') \
                .select('image_data, content_type') \
                .eq('draft_id', draft_id) \
                .eq('filename', filename) \
                .execute()

            if not result.data:
                return None

            img_data = result.data[0]
            image_bytes = base64.b64decode(img_data['image_data'])
            return image_bytes, img_data.get('content_type', 'image/jpeg')

        except Exception as e:
            print(f"Error getting image: {e}")
            return None


# API эндпоинты
@app.route('/api/generate-protocol', methods=['POST'])
def generate_protocol():
    """Генерирует протокол"""
    try:
        if not os.path.exists(Config.TEMPLATE_PATH):
            return jsonify({
                'success': False,
                'error': f'Шаблон {Config.TEMPLATE_PATH} не найден'
            })

        data = request.form

        # Загружаем и заполняем шаблон
        wb = load_workbook(Config.TEMPLATE_PATH)
        ws = wb.active

        mapping = {
            'workType': 'I1',
            'machineType': 'C3',
            'liftingCapacity': 'D3',
            'serialNumber': 'J3',
            'driveType': 'C5',
            'driveNumber': 'F5',
            'brakeResistor': 'E7',
            'resistorCount': 'H7',
            'electricMotor': 'D9',
            'motorNumber': 'G9',
            'angleSensor': 'D11',
            'angleSensorNumber': 'G11',
            'leftVibrationSensor': 'D15',
            'leftSensitivity': 'G15',
            'leftSensorNumber': 'I15',
            'rightVibrationSensor': 'D16',
            'rightSensitivity': 'G16',
            'rightSensorNumber': 'I16',
            'measuringDevice': 'E18',
            'measuringDeviceNumber': 'G18',
            'signalProcessor': 'E20',
            'signalProcessorNumber': 'G20',
            'EnginePower': 'K9',
            'notes': 'B37',
            'speedSensorNumber': 'K11'
        }

        for field, cell in mapping.items():
            if field in data:
                ws[cell] = data[field]

        # Сохраняем в BytesIO
        excel_buffer = io.BytesIO()
        wb.save(excel_buffer)
        excel_buffer.seek(0)

        # Генерируем имя папки
        folder_name = generate_folder_name(data)

        # Сохраняем в Supabase Storage (опционально)
        # Здесь можно добавить сохранение в Supabase Storage если нужно

        return jsonify({
            'success': True,
            'message': 'Протокол успешно создан',
            'folder_name': folder_name
        })

    except Exception as e:
        print(f"Protocol error: {traceback.format_exc()}")
        return jsonify({
            'success': False,
            'error': f'Критическая ошибка: {str(e)}'
        })


@app.route('/api/save-draft', methods=['POST'])
def save_draft():
    """Сохраняет черновик"""
    try:
        data = request.form
        images = request.files.getlist('images')

        success, result, error = DraftManager.save_draft(data, images)

        if success:
            return jsonify({
                'success': True,
                'message': 'Черновик сохранен',
                'draft_id': result['id'],
                'draft_data': result
            })
        else:
            return jsonify({
                'success': False,
                'error': result
            })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Ошибка сохранения: {str(e)}'
        })


@app.route('/api/drafts', methods=['GET'])
def get_drafts():
    """Получает список черновиков"""
    try:
        status_filter = request.args.get('status')
        drafts = DraftManager.get_all_drafts(status_filter)

        return jsonify({
            'success': True,
            'drafts': drafts,
            'total': len(drafts),
            'filter': status_filter
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Ошибка получения: {str(e)}'
        })


@app.route('/api/drafts/<draft_id>', methods=['GET'])
def get_draft(draft_id):
    """Получает конкретный черновик"""
    try:
        draft = DraftManager.load_draft(draft_id)

        if draft:
            return jsonify({
                'success': True,
                'draft': draft
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Черновик не найден'
            })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Ошибка загрузки: {str(e)}'
        })


@app.route('/api/drafts/<draft_id>', methods=['PUT'])
def update_draft(draft_id):
    """Обновляет черновик"""
    try:
        data = request.form
        new_images = request.files.getlist('new_images')

        success, result = DraftManager.update_draft(draft_id, data, new_images)

        if success:
            return jsonify({
                'success': True,
                'message': 'Черновик обновлен',
                'draft_data': result
            })
        else:
            return jsonify({
                'success': False,
                'error': result
            })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Ошибка обновления: {str(e)}'
        })


@app.route('/api/drafts/<draft_id>/customer', methods=['GET', 'POST', 'PUT'])
def manage_customer_data(draft_id):
    """Управление данными заказчика"""
    try:
        if request.method == 'GET':
            customer_data = DraftManager.get_customer_data(draft_id)

            if customer_data:
                return jsonify({
                    'success': True,
                    'customer_data': customer_data
                })
            else:
                return jsonify({
                    'success': False,
                    'error': 'Данные заказчика не найдены'
                })

        elif request.method in ['POST', 'PUT']:
            data = request.get_json()

            if not data:
                return jsonify({
                    'success': False,
                    'error': 'Нет данных для сохранения'
                })

            success, result = DraftManager.update_customer_data(draft_id, data)

            if success:
                return jsonify({
                    'success': True,
                    'message': 'Данные заказчика сохранены',
                    'draft_data': result
                })
            else:
                return jsonify({
                    'success': False,
                    'error': result
                })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Ошибка работы с данными заказчика: {str(e)}'
        })


@app.route('/api/drafts/<draft_id>/images/<filename>')
def get_draft_image(draft_id, filename):
    """Возвращает изображение черновика"""
    try:
        image_data = DraftManager.get_image(draft_id, filename)

        if image_data:
            image_bytes, content_type = image_data
            return send_file(
                io.BytesIO(image_bytes),
                mimetype=content_type,
                as_attachment=False,
                download_name=filename
            )
        else:
            return jsonify({'success': False, 'error': 'Изображение не найдено'}), 404

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    """Проверка состояния сервера"""
    return jsonify({
        'status': 'ok',
        'service': 'machine-protocol-generator',
        'supabase_configured': bool(Config.SUPABASE_URL and Config.SUPABASE_KEY),
        'template_exists': os.path.exists(Config.TEMPLATE_PATH)
    })


# Статические файлы
@app.route('/')
def serve_main():
    return send_from_directory(app.static_folder, 'main.html')


@app.route('/add-draft')
def serve_add_draft():
    return send_from_directory(app.static_folder, 'add_draft.html')


@app.route('/view-machine.html')
def serve_view_machine():
    return send_from_directory(app.static_folder, 'view_machine.html')


@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)


# Обработчики ошибок
@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'error': 'Эндпоинт не найден'}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'error': 'Внутренняя ошибка сервера'}), 500


if __name__ == '__main__':
    init_supabase()
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port, debug=False)
