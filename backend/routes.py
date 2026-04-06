"""
Маршруты Flask приложения (API endpoints)
"""
from flask import Blueprint, request, jsonify, send_from_directory, send_file
from werkzeug.utils import secure_filename
import os
import json
import traceback
from datetime import datetime

from .config import Config
from .database import SupabaseDB, supabase, init_supabase
from .image_utils import compress_image, allowed_file
from .balancing import calculate_balancing as calc_balancing, calculate_vector_balancing
from .protocol_generator import generate_protocol


# Создаем Blueprint для API
api_bp = Blueprint('api', __name__, url_prefix='/api')


# ========== ЭНДПОИНТЫ БАЛАНСИРОВКИ ==========

@api_bp.route('/balancing/calculate', methods=['POST'])
def calculate_balancing():
    """
    API для расчета балансировки методом трех пусков
    Возвращает только корректирующий груз и угол установки
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({'success': False, 'error': 'Нет данных для расчета'}), 400

        # Получаем входные параметры
        V0 = data.get('V0')
        V1 = data.get('V1')
        V2 = data.get('V2')
        V3 = data.get('V3')
        P = data.get('P')

        # Валидация
        required_fields = ['V0', 'V1', 'V2', 'V3', 'P']
        for field in required_fields:
            if data.get(field) is None:
                return jsonify({
                    'success': False,
                    'error': f'Поле {field} обязательно для заполнения'
                }), 400

        try:
            V0 = float(V0)
            V1 = float(V1)
            V2 = float(V2)
            V3 = float(V3)
            P = float(P)
        except ValueError:
            return jsonify({
                'success': False,
                'error': 'Все значения должны быть числами'
            }), 400

        if V0 <= 0 or V1 <= 0 or V2 <= 0 or V3 <= 0 or P <= 0:
            return jsonify({
                'success': False,
                'error': 'Все значения должны быть положительными числами'
            }), 400

        result = calc_balancing(V0, V1, V2, V3, P)

        return jsonify({
            'success': True,
            'result': result
        })

    except Exception as e:
        print(f"❌ Ошибка расчета балансировки: {e}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@api_bp.route('/balancing/vector', methods=['POST'])
def vector_balancing():
    """
    API для расчета векторной балансировки
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({'success': False, 'error': 'Нет данных для расчета'}), 400

        # Получаем входные параметры
        V0 = data.get('V0')
        V1 = data.get('V1')
        V2 = data.get('V2')
        V3 = data.get('V3')
        P = data.get('P')

        # Валидация
        required_fields = ['V0', 'V1', 'V2', 'V3', 'P']
        for field in required_fields:
            if data.get(field) is None:
                return jsonify({
                    'success': False,
                    'error': f'Поле {field} обязательно для заполнения'
                }), 400

        try:
            V0 = float(V0)
            V1 = float(V1)
            V2 = float(V2)
            V3 = float(V3)
            P = float(P)
        except ValueError:
            return jsonify({
                'success': False,
                'error': 'Все значения должны быть числами'
            }), 400

        if V0 <= 0 or V1 <= 0 or V2 <= 0 or V3 <= 0 or P <= 0:
            return jsonify({
                'success': False,
                'error': 'Все значения должны быть положительными числами'
            }), 400

        result = calculate_vector_balancing(V0, V1, V2, V3, P)

        return jsonify({
            'success': True,
            'result': result
        })

    except Exception as e:
        print(f"❌ Ошибка расчета векторной балансировки: {e}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ========== ЭНДПОИНТЫ ЧЕРНОВИКОВ ==========

@api_bp.route('/drafts', methods=['GET'])
def get_drafts():
    """Получает все черновики с опциональной фильтрацией"""
    try:
        filter_status = request.args.get('status')
        drafts = SupabaseDB.get_all_drafts(filter_status=filter_status)
        return jsonify({'success': True, 'drafts': drafts})
    except Exception as e:
        print(f"❌ Ошибка получения черновиков: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/drafts/<draft_id>', methods=['GET'])
def get_draft(draft_id):
    """Получает конкретный черновик"""
    try:
        draft = SupabaseDB.get_draft(draft_id)
        if draft:
            return jsonify({'success': True, 'draft': draft})
        return jsonify({'success': False, 'error': 'Черновик не найден'}), 404
    except Exception as e:
        print(f"❌ Ошибка получения черновика: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/save-draft', methods=['POST'])
def save_draft():
    """Сохраняет новый черновик"""
    try:
        data = request.form.to_dict()
        images = request.files.getlist('images')
        
        success, result, error = SupabaseDB.save_draft(data, images)
        
        if success:
            return jsonify({'success': True, 'data': result})
        return jsonify({'success': False, 'error': error or result}), 400
    except Exception as e:
        print(f"❌ Ошибка сохранения черновика: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/drafts/<draft_id>', methods=['PUT'])
def update_draft(draft_id):
    """Обновляет существующий черновик"""
    try:
        data = request.form.to_dict()
        images = request.files.getlist('images')
        
        success, result = SupabaseDB.update_draft(draft_id, data, images)
        
        if success:
            return jsonify({'success': True, 'data': result})
        return jsonify({'success': False, 'error': result}), 400
    except Exception as e:
        print(f"❌ Ошибка обновления черновика: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/drafts/<draft_id>/customer', methods=['GET', 'POST', 'PUT'])
def manage_customer_data(draft_id):
    """Управляет данными заказчика"""
    try:
        if request.method == 'GET':
            customer_data = SupabaseDB.get_customer_data(draft_id)
            if customer_data:
                return jsonify({'success': True, 'customer': customer_data})
            return jsonify({'success': False, 'error': 'Данные не найдены'}), 404
        
        elif request.method in ['POST', 'PUT']:
            customer_data = request.get_json()
            success, result = SupabaseDB.update_customer_data(draft_id, customer_data)
            
            if success:
                return jsonify({'success': True, 'draft': result})
            return jsonify({'success': False, 'error': result}), 400
    except Exception as e:
        print(f"❌ Ошибка управления данными заказчика: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/drafts/<draft_id>/images/<filename>')
def get_draft_image(draft_id, filename):
    """Получает изображение черновика"""
    try:
        image_data = SupabaseDB.get_image(draft_id, filename)
        if image_data:
            img_bytes, content_type = image_data
            from flask import Response
            return Response(img_bytes, mimetype=content_type)
        return jsonify({'error': 'Изображение не найдено'}), 404
    except Exception as e:
        print(f"❌ Ошибка получения изображения: {e}")
        return jsonify({'error': str(e)}), 500


@api_bp.route('/drafts/<draft_id>/request-file', methods=['GET', 'POST', 'DELETE'])
def manage_request_file(draft_id):
    """Управляет файлом заявки"""
    try:
        if request.method == 'GET':
            file_data = SupabaseDB.get_request_file(draft_id)
            if file_data:
                file_bytes, filename, content_type = file_data
                return send_file(
                    io.BytesIO(file_bytes),
                    mimetype=content_type,
                    as_attachment=True,
                    download_name=filename
                )
            return jsonify({'error': 'Файл не найден'}), 404
        
        elif request.method == 'POST':
            if 'file' not in request.files:
                return jsonify({'success': False, 'error': 'Файл не выбран'}), 400
            
            file = request.files['file']
            success, result = SupabaseDB.save_request_file(draft_id, file)
            
            if success:
                return jsonify({'success': True, 'data': result})
            return jsonify({'success': False, 'error': result}), 400
        
        elif request.method == 'DELETE':
            success = SupabaseDB.delete_request_file(draft_id)
            if success:
                return jsonify({'success': True, 'message': 'Файл удален'})
            return jsonify({'success': False, 'error': 'Ошибка удаления'}), 500
    except Exception as e:
        print(f"❌ Ошибка управления файлом заявки: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@api_bp.route('/drafts/<draft_id>/delete', methods=['POST', 'DELETE'])
def delete_draft(draft_id):
    """Удаляет черновик"""
    try:
        success, result = SupabaseDB.delete_draft(draft_id)
        if success:
            return jsonify({'success': True, 'message': result})
        return jsonify({'success': False, 'error': result}), 400
    except Exception as e:
        print(f"❌ Ошибка удаления черновика: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/drafts/<draft_id>/request-text', methods=['GET'])
def get_request_text(draft_id):
    """Получает извлеченный текст из файла заявки"""
    try:
        file_data = SupabaseDB.get_request_file(draft_id)
        if file_data:
            # Текст уже извлечен при сохранении, нужно получить его из БД
            response = supabase.table('request_files') \
                .select('extracted_text, has_text') \
                .eq('draft_id', draft_id) \
                .execute()
            
            if response.data:
                file_info = response.data[0]
                return jsonify({
                    'success': True,
                    'has_text': file_info.get('has_text', False),
                    'text': file_info.get('extracted_text', '')
                })
        
        return jsonify({'success': False, 'error': 'Файл не найден'}), 404
    except Exception as e:
        print(f"❌ Ошибка получения текста заявки: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/drafts/<draft_id>/upload-request', methods=['POST'])
def upload_request_file(draft_id):
    """Загружает файл заявки"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'Файл не выбран'}), 400
        
        file = request.files['file']
        success, result = SupabaseDB.save_request_file(draft_id, file)
        
        if success:
            return jsonify({'success': True, 'data': result})
        return jsonify({'success': False, 'error': result}), 400
    except Exception as e:
        print(f"❌ Ошибка загрузки файла заявки: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ========== ЭНДПОИНТЫ ПРОТОКОЛОВ ==========

@api_bp.route('/generate-protocol', methods=['POST'])
def generate_protocol_endpoint():
    """Генерирует протокол и возвращает ZIP архив"""
    try:
        data = request.form
        draft_id = data.get('draft_id')
        images = request.files.getlist('images')
        
        result = generate_protocol(data, images, draft_id)
        
        if result.get('success'):
            return send_file(
                io.BytesIO(result['data']),
                mimetype='application/zip',
                as_attachment=True,
                download_name=result['filename']
            )
        return jsonify(result), 400
    except Exception as e:
        print(f"❌ Ошибка генерации протокола: {e}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Ошибка генерации протокола: {str(e)}'
        }), 500


# ========== ЭНДПОИНТЫ ИСТОРИИ ==========

@api_bp.route('/history', methods=['GET'])
def get_history():
    """Получает историю изменений всех черновиков"""
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        date = request.args.get('date')
        
        if date:
            history = SupabaseDB.get_history_by_date(date, page, per_page)
        else:
            history = SupabaseDB.get_history(draft_id=None, page=page, per_page=per_page)
        
        return jsonify({'success': True, **history})
    except Exception as e:
        print(f"❌ Ошибка получения истории: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/history/<draft_id>', methods=['GET'])
def get_draft_history(draft_id):
    """Получает историю конкретного черновика"""
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        
        history = SupabaseDB.get_history(draft_id=draft_id, page=page, per_page=per_page)
        
        return jsonify({'success': True, **history})
    except Exception as e:
        print(f"❌ Ошибка получения истории черновика: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ========== ЭНДПОИНТЫ ОБНОВЛЕНИЙ ==========

@api_bp.route('/updates', methods=['GET'])
def get_updates():
    """Получает список обновлений"""
    try:
        if supabase is None:
            return jsonify({'success': False, 'error': 'База данных не подключена'}), 500
        
        response = supabase.table('updates').select('*').order('sort_order').execute()
        updates = response.data if response.data else []
        
        return jsonify({'success': True, 'updates': updates})
    except Exception as e:
        print(f"❌ Ошибка получения обновлений: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/updates', methods=['POST'])
def create_update():
    """Создает новое обновление"""
    try:
        if supabase is None:
            return jsonify({'success': False, 'error': 'База данных не подключена'}), 500
        
        data = request.get_json()
        update_data = {
            'title': data.get('title'),
            'description': data.get('description'),
            'date': data.get('date', datetime.now().isoformat()),
            'sort_order': data.get('sort_order', 0)
        }
        
        result = supabase.table('updates').insert(update_data).execute()
        
        return jsonify({'success': True, 'update': result.data[0]})
    except Exception as e:
        print(f"❌ Ошибка создания обновления: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/updates/<int:update_id>', methods=['PUT'])
def update_update(update_id):
    """Обновляет обновление"""
    try:
        if supabase is None:
            return jsonify({'success': False, 'error': 'База данных не подключена'}), 500
        
        data = request.get_json()
        update_data = {
            'title': data.get('title'),
            'description': data.get('description'),
            'date': data.get('date'),
            'sort_order': data.get('sort_order')
        }
        
        result = supabase.table('updates') \
            .update(update_data) \
            .eq('id', update_id) \
            .execute()
        
        return jsonify({'success': True, 'update': result.data[0]})
    except Exception as e:
        print(f"❌ Ошибка обновления обновления: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/updates/<int:update_id>', methods=['DELETE'])
def delete_update(update_id):
    """Удаляет обновление"""
    try:
        if supabase is None:
            return jsonify({'success': False, 'error': 'База данных не подключена'}), 500
        
        supabase.table('updates').delete().eq('id', update_id).execute()
        
        return jsonify({'success': True, 'message': 'Обновление удалено'})
    except Exception as e:
        print(f"❌ Ошибка удаления обновления: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/updates/reorder', methods=['POST'])
def reorder_updates():
    """Изменяет порядок сортировки обновлений"""
    try:
        if supabase is None:
            return jsonify({'success': False, 'error': 'База данных не подключена'}), 500
        
        data = request.get_json()
        orders = data.get('orders', [])
        
        if not orders:
            return jsonify({'success': False, 'error': 'Нет данных для сортировки'}), 400
        
        # Обновляем порядок для каждой записи
        for item in orders:
            supabase.table('updates') \
                .update({'sort_order': item['order']}) \
                .eq('id', item['id']) \
                .execute()
        
        return jsonify({'success': True, 'message': 'Порядок сортировки обновлен'})
    except Exception as e:
        print(f"❌ Ошибка обновления сортировки: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ========== ВСПОМОГАТЕЛЬНЫЕ ЭНДПОИНТЫ ==========

@api_bp.route('/health', methods=['GET'])
def health_check():
    """Проверка здоровья приложения"""
    return jsonify({
        'status': 'ok',
        'supabase_connected': supabase is not None,
        'timestamp': datetime.now().isoformat()
    })


def register_routes(app):
    """Регистрирует все маршруты в приложении"""
    app.register_blueprint(api_bp)
    
    # Статические маршруты (не API)
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

    # Обработчики ошибок
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
    
    return app
