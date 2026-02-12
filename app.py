import os
from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
from openpyxl import load_workbook
from datetime import datetime
import uuid
import traceback
import json
import base64
import io
from werkzeug.utils import secure_filename

# Загружаем переменные окружения
load_dotenv()

app = Flask(__name__, static_folder='static')
CORS(app)

# Конфигурация
class Config:
    # Supabase конфигурация
    SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
    SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')
    
    # Шаблон Excel
    TEMPLATE_PATH = "1.xlsx"
    
    # Разрешенные форматы изображений
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp'}
    
    # Максимальный размер файла (16MB)
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024

# ========== ИНИЦИАЛИЗАЦИЯ SUPABASE ==========
supabase = None
if Config.SUPABASE_URL and Config.SUPABASE_KEY:
    try:
        print("\n" + "="*50)
        print("🔄 ИНИЦИАЛИЗАЦИЯ SUPABASE")
        print("="*50)
        print(f"📌 URL: {Config.SUPABASE_URL[:50]}...")
        print(f"📌 Key length: {len(Config.SUPABASE_KEY)} символов")
        
        from supabase import create_client
        supabase = create_client(Config.SUPABASE_URL, Config.SUPABASE_KEY)
        
        # Проверка подключения
        test_query = supabase.table('drafts').select('*').limit(1).execute()
        print("✅ Supabase: успешно подключен!")
        print("✅ Таблица 'drafts' доступна")
        print("="*50 + "\n")
        
    except ImportError as e:
        print(f"❌ Ошибка импорта supabase: {e}")
        print("   Установите: pip install supabase==2.12.0")
        supabase = None
    except Exception as e:
        print(f"❌ Ошибка подключения к Supabase: {e}")
        print(f"   Тип ошибки: {type(e).__name__}")
        supabase = None
else:
    print("\n⚠️ Supabase не настроен - переменные окружения отсутствуют")
    print("   Установите SUPABASE_URL и SUPABASE_KEY в переменных окружения\n")
# ============================================

def allowed_file(filename):
    """Проверка разрешенного формата файла"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS

def generate_folder_name(data):
    """Генерирует имя папки для сохранения"""
    machine_type = data.get('machineType', '').strip()
    lifting_capacity = data.get('liftingCapacity', '').strip()
    serial_number = data.get('serialNumber', 'unknown').strip().replace(' ', '_')
    return f"ML_{machine_type}{lifting_capacity}№{serial_number}"

# ========== КЛАСС ДЛЯ РАБОТЫ С SUPABASE ==========
class SupabaseDB:
    @staticmethod
    def get_all_drafts(filter_status=None):
        """Получает все черновики с фильтрацией"""
        try:
            if supabase is None:
                print("⚠️ Supabase не инициализирован")
                return []
            
            # Базовый запрос
            query = supabase.table('drafts').select('*')
            
            # Фильтрация по статусу
            if filter_status == 'shipped':
                query = query.eq('machine_status', 'Отгружен')
            elif filter_status == 'active':
                query = query.neq('machine_status', 'Отгружен')
            
            # Сортировка по дате обновления
            response = query.order('updated_at', desc=True).execute()
            
            drafts = []
            for draft in response.data:
                drafts.append({
                    'id': draft.get('id', ''),
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
                })
            
            print(f"📥 Загружено {len(drafts)} черновиков")
            return drafts
            
        except Exception as e:
            print(f"❌ Ошибка в get_all_drafts: {e}")
            return []
    
    @staticmethod
    def get_draft(draft_id):
        """Загружает конкретный черновик"""
        try:
            if supabase is None:
                return None
            
            response = supabase.table('drafts').select('*').eq('id', draft_id).execute()
            
            if not response.data:
                return None
            
            draft = response.data[0]
            
            # Загружаем изображения
            images_response = supabase.table('images') \
                .select('filename') \
                .eq('draft_id', draft_id) \
                .execute()
            
            draft['image_files'] = [img['filename'] for img in images_response.data]
            
            return draft
            
        except Exception as e:
            print(f"❌ Ошибка загрузки черновика {draft_id}: {e}")
            return None
    
    @staticmethod
    def save_draft(data, images=None):
        """Сохраняет новый черновик"""
        try:
            if supabase is None:
                return False, "Supabase не инициализирован", None
            
            # Генерируем ID из данных станка
            machine_type = data.get('machineType', 'Unknown')
            lifting_capacity = data.get('liftingCapacity', 'Unknown')
            serial_number = data.get('serialNumber', 'Unknown')
            
            draft_id = f"{machine_type}_{lifting_capacity}_{serial_number}"
            draft_id = "".join(c for c in draft_id if c.isalnum() or c in ('_', '-'))
            
            if not draft_id or draft_id == "_Unknown_Unknown":
                draft_id = str(uuid.uuid4())
            
            # Формируем отображаемое имя
            display_name = f"{machine_type}-{lifting_capacity} №{serial_number}"
            
            # Подготавливаем данные
            draft_data = {
                'id': draft_id,
                'data': dict(data),
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat(),
                'display_name': display_name,
                'machine_status': data.get('machineStatus', 'Сборка'),
                'shipping_date': data.get('shippingDate', ''),
                'customer_info': {}
            }
            
            # Сохраняем в Supabase
            supabase.table('drafts').upsert(draft_data).execute()
            print(f"💾 Сохранен черновик: {draft_id}")
            
            # Сохраняем изображения
            saved_images = []
            if images:
                for img in images:
                    if img and allowed_file(img.filename):
                        filename = secure_filename(img.filename)
                        img.seek(0)
                        img_data = img.read()
                        img_base64 = base64.b64encode(img_data).decode('utf-8')
                        
                        image_data = {
                            'draft_id': draft_id,
                            'filename': filename,
                            'image_data': img_base64,
                            'content_type': img.content_type or 'image/jpeg',
                            'uploaded_at': datetime.now().isoformat()
                        }
                        
                        supabase.table('images').upsert(image_data).execute()
                        saved_images.append(filename)
                        print(f"🖼️ Сохранено изображение: {filename}")
            
            return True, {
                'id': draft_id, 
                'display_name': display_name, 
                'saved_images': saved_images
            }, None
            
        except Exception as e:
            print(f"❌ Ошибка сохранения: {e}")
            return False, str(e), None
    
    @staticmethod
    def update_draft(draft_id, data):
        """Обновляет существующий черновик"""
        try:
            if supabase is None:
                return False, "Supabase не инициализирован"
            
            # Получаем текущие данные
            draft = SupabaseDB.get_draft(draft_id)
            if not draft:
                return False, "Черновик не найден"
            
            # Обновляем данные
            current_data = draft.get('data', {})
            for key, value in dict(data).items():
                if value:  # Обновляем только непустые значения
                    current_data[key] = value
            
            # Подготавливаем обновление
            update_data = {
                'data': current_data,
                'updated_at': datetime.now().isoformat(),
                'machine_status': data.get('machineStatus', draft.get('machine_status', 'Сборка'))
            }
            
            # Обновляем display_name если изменились основные поля
            machine_type = data.get('machineType', current_data.get('machineType', ''))
            lifting_capacity = data.get('liftingCapacity', current_data.get('liftingCapacity', ''))
            serial_number = data.get('serialNumber', current_data.get('serialNumber', ''))
            
            if machine_type and lifting_capacity and serial_number:
                update_data['display_name'] = f"{machine_type}-{lifting_capacity} №{serial_number}"
            
            # Сохраняем
            supabase.table('drafts').update(update_data).eq('id', draft_id).execute()
            print(f"📝 Обновлен черновик: {draft_id}")
            
            return True, update_data
            
        except Exception as e:
            print(f"❌ Ошибка обновления: {e}")
            return False, str(e)
    
    @staticmethod
    def update_customer_data(draft_id, customer_data):
        """Обновляет данные заказчика"""
        try:
            if supabase is None:
                return False, "Supabase не инициализирован"
            
            draft = SupabaseDB.get_draft(draft_id)
            if not draft:
                return False, "Черновик не найден"
            
            customer_info = draft.get('customer_info', {})
            customer_info.update(customer_data)
            customer_info['updated_at'] = datetime.now().isoformat()
            
            supabase.table('drafts') \
                .update({
                    'customer_info': customer_info,
                    'updated_at': datetime.now().isoformat()
                }) \
                .eq('id', draft_id) \
                .execute()
            
            print(f"👥 Обновлены данные заказчика: {draft_id}")
            return True, draft
            
        except Exception as e:
            print(f"❌ Ошибка обновления данных заказчика: {e}")
            return False, str(e)
    
    @staticmethod
    def get_customer_data(draft_id):
        """Получает данные заказчика"""
        try:
            if supabase is None:
                return None
            
            response = supabase.table('drafts') \
                .select('customer_info, data') \
                .eq('id', draft_id) \
                .execute()
            
            if not response.data:
                return None
            
            draft = response.data[0]
            customer_info = draft.get('customer_info', {})
            
            if customer_info:
                return customer_info
            
            # Если нет customer_info, возвращаем базовые данные
            customer_name = draft.get('data', {}).get('customer', 'Не указан')
            return {
                'customerName': customer_name,
                'originalCustomer': customer_name
            }
            
        except Exception as e:
            print(f"❌ Ошибка получения данных заказчика: {e}")
            return None
    
    @staticmethod
    def get_image(draft_id, filename):
        """Получает изображение из базы"""
        try:
            if supabase is None:
                return None
            
            response = supabase.table('images') \
                .select('image_data, content_type') \
                .eq('draft_id', draft_id) \
                .eq('filename', filename) \
                .execute()
            
            if not response.data:
                return None
            
            img = response.data[0]
            img_bytes = base64.b64decode(img['image_data'])
            return img_bytes, img.get('content_type', 'image/jpeg')
            
        except Exception as e:
            print(f"❌ Ошибка получения изображения: {e}")
            return None

# ========== API ЭНДПОИНТЫ ==========

@app.route('/api/health', methods=['GET'])
def health_check():
    """Проверка состояния сервера"""
    return jsonify({
        'success': True,
        'status': 'ok',
        'service': 'machine-protocol-generator',
        'supabase_configured': supabase is not None,
        'template_exists': os.path.exists(Config.TEMPLATE_PATH),
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/drafts', methods=['GET'])
def get_drafts():
    """Получает список черновиков"""
    try:
        status_filter = request.args.get('status')
        drafts = SupabaseDB.get_all_drafts(status_filter)
        
        return jsonify({
            'success': True,
            'drafts': drafts,
            'total': len(drafts),
            'filter': status_filter
        })
    except Exception as e:
        print(f"❌ Ошибка в /api/drafts: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/drafts/<draft_id>', methods=['GET'])
def get_draft(draft_id):
    """Получает конкретный черновик"""
    try:
        draft = SupabaseDB.get_draft(draft_id)
        
        if draft:
            return jsonify({
                'success': True,
                'draft': draft
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Черновик не найден'
            }), 404
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/save-draft', methods=['POST'])
def save_draft():
    """Сохраняет черновик"""
    try:
        data = request.form
        images = request.files.getlist('images')
        
        success, result, error = SupabaseDB.save_draft(data, images)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Черновик успешно сохранен',
                'draft_id': result['id'],
                'draft_data': result
            })
        else:
            return jsonify({
                'success': False,
                'error': result
            }), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Ошибка сохранения: {str(e)}'
        }), 500

@app.route('/api/drafts/<draft_id>', methods=['PUT'])
def update_draft(draft_id):
    """Обновляет черновик"""
    try:
        data = request.form
        success, result = SupabaseDB.update_draft(draft_id, data)
        
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
            }), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/drafts/<draft_id>/customer', methods=['GET', 'POST', 'PUT'])
def manage_customer_data(draft_id):
    """Управление данными заказчика"""
    try:
        if request.method == 'GET':
            customer_data = SupabaseDB.get_customer_data(draft_id)
            
            if customer_data:
                return jsonify({
                    'success': True,
                    'customer_data': customer_data
                })
            else:
                return jsonify({
                    'success': False,
                    'error': 'Данные заказчика не найдены'
                }), 404
                
        elif request.method in ['POST', 'PUT']:
            data = request.get_json()
            
            if not data:
                return jsonify({
                    'success': False,
                    'error': 'Нет данных для сохранения'
                }), 400
            
            success, result = SupabaseDB.update_customer_data(draft_id, data)
            
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
                }), 400
                
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/drafts/<draft_id>/images/<filename>')
def get_draft_image(draft_id, filename):
    """Возвращает изображение"""
    try:
        image_data = SupabaseDB.get_image(draft_id, filename)
        
        if image_data:
            img_bytes, content_type = image_data
            return send_file(
                io.BytesIO(img_bytes),
                mimetype=content_type,
                as_attachment=False,
                download_name=filename
            )
        else:
            return jsonify({
                'success': False,
                'error': 'Изображение не найдено'
            }), 404
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/generate-protocol', methods=['POST'])
def generate_protocol():
    """Генерирует протокол Excel"""
    try:
        if not os.path.exists(Config.TEMPLATE_PATH):
            return jsonify({
                'success': False,
                'error': f'Шаблон {Config.TEMPLATE_PATH} не найден'
            }), 404
        
        data = request.form
        
        # Загружаем шаблон
        wb = load_workbook(Config.TEMPLATE_PATH)
        ws = wb.active
        
        # Маппинг полей на ячейки Excel
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
            'EnginePower': 'K9',
            'angleSensor': 'D11',
            'angleSensorNumber': 'G11',
            'speedSensorNumber': 'K11',
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
            'notes': 'B37'
        }
        
        # Заполняем ячейки
        for field, cell in mapping.items():
            if field in data and data[field]:
                ws[cell] = data[field]
        
        # Сохраняем во временный файл
        folder_name = generate_folder_name(data)
        temp_file = f"/tmp/{folder_name}_{uuid.uuid4()}.xlsx"
        wb.save(temp_file)
        
        # Отправляем файл
        return send_file(
            temp_file,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=f"{folder_name}.xlsx"
        )
        
    except Exception as e:
        print(f"❌ Ошибка генерации протокола: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# ========== СТАТИЧЕСКИЕ ФАЙЛЫ ==========

@app.route('/')
def serve_main():
    """Главная страница"""
    return send_from_directory(app.static_folder, 'main.html')

@app.route('/add-draft')
def serve_add_draft():
    """Страница добавления станка"""
    return send_from_directory(app.static_folder, 'add_draft.html')

@app.route('/view-machine.html')
def serve_view_machine():
    """Страница просмотра станка"""
    return send_from_directory(app.static_folder, 'view_machine.html')

@app.route('/static/<path:path>')
def serve_static(path):
    """Статические файлы"""
    return send_from_directory('static', path)

@app.route('/favicon.ico')
def favicon():
    """Иконка сайта"""
    return send_from_directory('static', 'favicon.ico'), 404

# ========== ОБРАБОТЧИКИ ОШИБОК ==========

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'success': False,
        'error': 'Эндпоинт не найден'
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'success': False,
        'error': 'Внутренняя ошибка сервера'
    }), 500

# ========== ЗАПУСК ПРИЛОЖЕНИЯ ==========

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port, debug=False)
