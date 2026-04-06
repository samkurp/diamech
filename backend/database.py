"""
База данных и работа с Supabase
"""
import traceback
from datetime import datetime
from .config import Config

# Глобальная переменная для клиента Supabase
supabase = None


def init_supabase():
    """Инициализирует подключение к Supabase"""
    global supabase
    
    if not Config.SUPABASE_URL or not Config.SUPABASE_KEY:
        print("\n⚠️ Supabase не настроен - переменные окружения отсутствуют")
        print("   Установите SUPABASE_URL и SUPABASE_KEY в переменных окружения\n")
        return None
    
    try:
        print("\n" + "=" * 50)
        print("🔄 ИНИЦИАЛИЗАЦИЯ SUPABASE")
        print("=" * 50)
        print(f"📌 URL: {Config.SUPABASE_URL[:50]}...")
        print(f"📌 Key length: {len(Config.SUPABASE_KEY)} символов")

        from supabase import create_client

        supabase = create_client(Config.SUPABASE_URL, Config.SUPABASE_KEY)

        # Проверка подключения
        test_query = supabase.table('drafts').select('*').limit(1).execute()
        print("✅ Supabase: успешно подключен!")
        print("✅ Таблица 'drafts' доступна")
        print("=" * 50 + "\n")
        
        return supabase

    except ImportError as e:
        print(f"❌ Ошибка импорта supabase: {e}")
        print("   Установите: pip install supabase==2.12.0")
        return None
    except Exception as e:
        print(f"❌ Ошибка подключения к Supabase: {e}")
        print(f"   Тип ошибки: {type(e).__name__}")
        return None


class SupabaseDB:
    """Класс для работы с базой данных Supabase"""

    @staticmethod
    def save_history(draft_id, old_data, new_data, changed_by=None):
        """
        Сохраняет изменения в историю с умным сравнением текстовых полей
        """
        try:
            if supabase is None:
                print("⚠️ Supabase не инициализирован, история не сохраняется")
                return False

            print(f"\n{'=' * 50}")
            print(f"📝 СОХРАНЕНИЕ ИСТОРИИ ДЛЯ {draft_id}")
            print(f"{'=' * 50}")

            # Получаем отображаемое имя черновика
            draft = SupabaseDB.get_draft(draft_id)
            if not draft:
                display_name = "Неизвестный черновик"
                print("⚠️ Черновик не найден в БД")
            else:
                display_name = draft.get('display_name', 'Неизвестный черновик')
                print(f"📌 Отображаемое имя: {display_name}")

            # Сравниваем и находим изменившиеся поля
            changed_fields = {}
            all_keys = set(old_data.keys()) | set(new_data.keys())
            print(f"📊 Всего полей для сравнения: {len(all_keys)}")

            for key in all_keys:
                old_value = old_data.get(key, '')
                new_value = new_data.get(key, '')

                # Пропускаем технические поля
                if key in ['draft_id', 'created_at', 'updated_at', 'id']:
                    continue

                # Приводим к строке
                old_str = str(old_value) if old_value is not None else ''
                new_str = str(new_value) if new_value is not None else ''

                # Если значения одинаковые - пропускаем
                if old_str == new_str:
                    continue

                print(f"🔍 Изменение в поле '{key}':")

                # Специальная обработка для текстовых полей (примечания)
                if key == 'notes' and len(old_str) > 0 and len(new_str) > 0:
                    additions = SupabaseDB.find_text_additions(old_str, new_str)

                    if additions:
                        changed_fields[key] = {
                            'type': 'addition',
                            'old': old_str,
                            'new': new_str,
                            'additions': additions,
                            'full_text': new_str
                        }
                        print(f"   📝 Найдены дополнения: {additions}")
                    else:
                        changed_fields[key] = {
                            'type': 'full_change',
                            'old': old_str,
                            'new': new_str
                        }
                        print(f"   🔄 Полная замена текста")
                else:
                    changed_fields[key] = {
                        'type': 'simple',
                        'old': old_str,
                        'new': new_str
                    }
                    print(f"   Было: '{old_str}'")
                    print(f"   Стало: '{new_str}'")

            # Если нет изменений - выходим
            if not changed_fields:
                print("ℹ️ Нет изменений для сохранения в истории")
                return True

            print(f"✅ Найдено изменений: {len(changed_fields)}")

            # Форматируем changed_fields для удобочитаемости
            formatted_fields = SupabaseDB._format_changed_fields(changed_fields)

            # Сохраняем в историю
            history_data = {
                'draft_id': draft_id,
                'draft_display_name': display_name,
                'changed_fields': formatted_fields,
                'changed_by': changed_by or 'system',
                'created_at': datetime.now().isoformat()
            }

            print(f"💾 Сохраняем в БД: {history_data}")

            result = supabase.table('draft_history').insert(history_data).execute()
            print(f"✅ Результат сохранения: {result}")
            print(f"📝 История изменений сохранена для {draft_id}, изменено полей: {len(formatted_fields)}")
            print(f"{'=' * 50}\n")

            return True

        except Exception as e:
            print(f"❌ Ошибка сохранения истории: {e}")
            traceback.print_exc()
            return False

    @staticmethod
    def _format_changed_fields(changed_fields):
        """Форматирует измененные поля для хранения в БД"""
        field_names = {
            'workType': 'Тип работы',
            'machineType': 'Тип станка',
            'liftingCapacity': 'Грузоподъемность',
            'serialNumber': 'Заводской номер',
            'customer': 'Заказчик',
            'driveType': 'Тип привода',
            'driveNumber': 'Номер привода',
            'brakeResistor': 'Тормозной резистор',
            'resistorCount': 'Кол-во резисторов',
            'electricMotor': 'Электродвигатель',
            'motorNumber': 'Номер двигателя',
            'EnginePower': 'Мощность',
            'angleSensor': 'Датчик угла',
            'angleSensorNumber': 'Номер датчика угла',
            'speedSensorNumber': 'Номер отметчика',
            'leftVibrationSensor': 'Левый датчик вибрации',
            'leftSensitivity': 'Чувствительность левого',
            'leftSensorNumber': 'Номер левого датчика',
            'rightVibrationSensor': 'Правый датчик вибрации',
            'rightSensitivity': 'Чувствительность правого',
            'rightSensorNumber': 'Номер правого датчика',
            'measuringDevice': 'Измерительный прибор',
            'measuringDeviceNumber': 'Номер прибора',
            'signalProcessor': 'Блок обработки',
            'signalProcessorNumber': 'Номер блока',
            'notes': 'Примечания',
            'machineStatus': 'Статус станка',
            'shippingDate': 'Дата отгрузки'
        }

        formatted_fields = {}
        for key, change_info in changed_fields.items():
            field_display = field_names.get(key, key)

            if change_info['type'] == 'addition':
                formatted_fields[field_display] = {
                    'type': 'addition',
                    'добавлено': change_info['additions'],
                    'полный_текст': change_info['full_text']
                }
            elif change_info['type'] == 'full_change':
                formatted_fields[field_display] = {
                    'type': 'full_change',
                    'было': change_info['old'] if change_info['old'] else '<пусто>',
                    'стало': change_info['new'] if change_info['new'] else '<пусто>'
                }
            else:
                formatted_fields[field_display] = {
                    'type': 'simple',
                    'было': change_info['old'] if change_info['old'] else '<пусто>',
                    'стало': change_info['new'] if change_info['new'] else '<пусто>'
                }

        return formatted_fields

    @staticmethod
    def find_text_additions(old_text, new_text):
        """
        Находит добавленный текст в new_text по сравнению с old_text
        Возвращает список добавленных фрагментов
        """
        try:
            if not old_text or not new_text:
                return []

            additions = []

            # Если новый текст начинается со старого - значит текст дополнен в конце
            if new_text.startswith(old_text):
                addition = new_text[len(old_text):].strip()
                if addition:
                    additions.append({
                        'position': 'end',
                        'text': addition
                    })
                return additions

            # Если новый текст заканчивается старым - значит текст дополнен в начале
            if new_text.endswith(old_text):
                addition = new_text[:len(new_text) - len(old_text)].strip()
                if addition:
                    additions.append({
                        'position': 'start',
                        'text': addition
                    })
                return additions

            # Разбиваем на слова для более точного поиска
            old_words = old_text.split()
            new_words = new_text.split()

            # Находим добавленные слова
            added_words = []
            i, j = 0, 0

            while i < len(old_words) and j < len(new_words):
                if old_words[i] == new_words[j]:
                    i += 1
                    j += 1
                else:
                    added_words.append(new_words[j])
                    j += 1

            # Добавляем оставшиеся слова из new_text
            while j < len(new_words):
                added_words.append(new_words[j])
                j += 1

            if added_words:
                additions.append({
                    'position': 'middle',
                    'text': ' '.join(added_words)
                })

            return additions

        except Exception as e:
            print(f"❌ Ошибка при поиске дополнений: {e}")
            return []

    @staticmethod
    def get_history(draft_id=None, page=1, per_page=50):
        """
        Получает историю изменений
        Если draft_id указан - для конкретного черновика
        Если нет - общую историю всех черновиков
        """
        try:
            if supabase is None:
                return {'items': [], 'total': 0, 'page': page, 'per_page': per_page, 'total_pages': 0}

            # Базовый запрос
            query = supabase.table('draft_history').select('*')

            # Фильтр по черновику если указан
            if draft_id:
                query = query.eq('draft_id', draft_id)

            # Пагинация
            offset = (page - 1) * per_page

            # Получаем данные с сортировкой по дате (сначала новые)
            response = query.order('created_at', desc=True) \
                .range(offset, offset + per_page - 1) \
                .execute()

            # Получаем общее количество для пагинации
            count_query = supabase.table('draft_history').select('count', count='exact')
            if draft_id:
                count_query = count_query.eq('draft_id', draft_id)
            count_response = count_query.execute()

            total = count_response.count if hasattr(count_response, 'count') else 0

            history = []
            for item in response.data:
                history.append({
                    'id': item.get('id'),
                    'draft_id': item.get('draft_id'),
                    'draft_display_name': item.get('draft_display_name'),
                    'changed_fields': item.get('changed_fields', {}),
                    'changed_by': item.get('changed_by'),
                    'created_at': item.get('created_at')
                })

            return {
                'items': history,
                'total': total,
                'page': page,
                'per_page': per_page,
                'total_pages': (total + per_page - 1) // per_page
            }

        except Exception as e:
            print(f"❌ Ошибка получения истории: {e}")
            return {'items': [], 'total': 0, 'page': page, 'per_page': per_page, 'total_pages': 0}

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
    def delete_draft(draft_id):
        """Полностью удаляет черновик, его изображения и историю изменений"""
        try:
            if supabase is None:
                return False, "Supabase не инициализирован"

            print(f"\n{'=' * 50}")
            print(f"🗑️ УДАЛЕНИЕ ЧЕРНОВИКА: {draft_id}")
            print(f"{'=' * 50}")

            # 1. Удаляем все изображения черновика
            try:
                images_result = supabase.table('images') \
                    .delete() \
                    .eq('draft_id', draft_id) \
                    .execute()
                print(f"✅ Удалено изображений: {len(images_result.data) if images_result.data else 0}")
            except Exception as e:
                print(f"⚠️ Ошибка при удалении изображений: {e}")

            # 2. Удаляем файл заявки
            try:
                request_result = supabase.table('request_files') \
                    .delete() \
                    .eq('draft_id', draft_id) \
                    .execute()
                print(f"✅ Удален файл заявки: {len(request_result.data) if request_result.data else 0}")
            except Exception as e:
                print(f"⚠️ Ошибка при удалении файла заявки: {e}")

            # 3. Удаляем историю изменений черновика
            try:
                history_result = supabase.table('draft_history') \
                    .delete() \
                    .eq('draft_id', draft_id) \
                    .execute()
                print(f"✅ Удалено записей истории: {len(history_result.data) if history_result.data else 0}")
            except Exception as e:
                print(f"⚠️ Ошибка при удалении истории: {e}")

            # 4. Удаляем сам черновик
            try:
                draft_result = supabase.table('drafts') \
                    .delete() \
                    .eq('id', draft_id) \
                    .execute()

                if draft_result.data:
                    print(f"✅ Черновик удален: {draft_id}")
                    print(f"{'=' * 50}\n")
                    return True, "Черновик успешно удален"
                else:
                    print(f"❌ Черновик не найден: {draft_id}")
                    print(f"{'=' * 50}\n")
                    return False, "Черновик не найден"
            except Exception as e:
                print(f"❌ Ошибка при удалении черновика: {e}")
                print(f"{'=' * 50}\n")
                return False, str(e)

        except Exception as e:
            print(f"❌ Критическая ошибка при удалении: {e}")
            traceback.print_exc()
            print(f"{'=' * 50}\n")
            return False, str(e)

    @staticmethod
    def save_request_file(draft_id, file):
        """Сохраняет файл заявки и извлекает текст"""
        from .document_utils import extract_text_from_file
        from werkzeug.utils import secure_filename
        
        try:
            if supabase is None:
                return False, "Supabase не инициализирован"

            if not file or not file.filename:
                return False, "Файл не выбран"

            filename = secure_filename(file.filename)
            ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''

            if ext not in Config.DOCUMENT_EXTENSIONS:
                return False, "Неподдерживаемый формат файла. Используйте DOC или DOCX"

            file.seek(0)
            file_data = file.read()

            # Извлекаем текст из файла
            print(f"📝 Извлечение текста из файла: {filename}")
            extracted_text = extract_text_from_file(file_data, filename)

            if extracted_text:
                print(f"✅ Текст извлечен. Длина: {len(extracted_text)} символов")
                print(f"   Первые 200 символов: {extracted_text[:200]}...")
                has_text = True
            else:
                print(f"⚠️ Не удалось извлечь текст из файла")
                extracted_text = None
                has_text = False

            # Конвертируем файл в base64
            import base64
            file_base64 = base64.b64encode(file_data).decode('utf-8')

            # Определяем content type
            content_type = 'application/msword' if ext == 'doc' else 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

            # Сохраняем в таблицу request_files
            request_data = {
                'draft_id': draft_id,
                'filename': filename,
                'file_data': file_base64,
                'content_type': content_type,
                'extracted_text': extracted_text,
                'has_text': has_text,
                'uploaded_at': datetime.now().isoformat()
            }

            # Проверяем, существует ли уже файл
            existing = supabase.table('request_files') \
                .select('*') \
                .eq('draft_id', draft_id) \
                .execute()

            if existing.data:
                supabase.table('request_files') \
                    .update(request_data) \
                    .eq('draft_id', draft_id) \
                    .execute()
                print(f"📄 Обновлен файл заявки: {filename}")
            else:
                supabase.table('request_files').insert(request_data).execute()
                print(f"📄 Сохранен файл заявки: {filename}")

            return True, {
                'filename': filename,
                'has_text': has_text,
                'text_preview': extracted_text[:200] + '...' if extracted_text else None
            }

        except Exception as e:
            print(f"❌ Ошибка сохранения файла заявки: {e}")
            traceback.print_exc()
            return False, str(e)

    @staticmethod
    def get_request_file(draft_id):
        """Получает файл заявки"""
        try:
            if supabase is None:
                return None

            response = supabase.table('request_files') \
                .select('*') \
                .eq('draft_id', draft_id) \
                .execute()

            if not response.data:
                return None

            file_data = response.data[0]
            import base64
            file_bytes = base64.b64decode(file_data['file_data'])
            return file_bytes, file_data['filename'], file_data['content_type']

        except Exception as e:
            print(f"❌ Ошибка получения файла заявки: {e}")
            return None

    @staticmethod
    def delete_request_file(draft_id):
        """Удаляет файл заявки"""
        try:
            if supabase is None:
                return False

            supabase.table('request_files') \
                .delete() \
                .eq('draft_id', draft_id) \
                .execute()

            print(f"📄 Удален файл заявки для {draft_id}")
            return True

        except Exception as e:
            print(f"❌ Ошибка удаления файла заявки: {e}")
            return False

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
            import base64
            img_bytes = base64.b64decode(img['image_data'])
            return img_bytes, img.get('content_type', 'image/jpeg')

        except Exception as e:
            print(f"❌ Ошибка получения изображения: {e}")
            return None

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
    def save_draft(data, images=None):
        """Сохраняет новый черновик со сжатыми изображениями"""
        from .image_utils import compress_image, allowed_file
        import base64
        import uuid
        from werkzeug.utils import secure_filename
        
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

            # Проверяем, существует ли уже черновик с таким ID
            existing_draft = SupabaseDB.get_draft(draft_id)

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

            # ЕСЛИ ЧЕРНОВИК УЖЕ СУЩЕСТВУЕТ - СОХРАНЯЕМ ИСТОРИЮ
            if existing_draft:
                old_data = existing_draft.get('data', {})
                SupabaseDB.save_history(draft_id, old_data, dict(data))
                print(f"📝 История изменений сохранена при обновлении через save_draft")

            # Сохраняем в Supabase
            supabase.table('drafts').upsert(draft_data).execute()
            print(f"💾 Сохранен черновик: {draft_id}")

            # Сохраняем изображения со сжатием
            saved_images = []
            if images:
                for img in images:
                    if img and allowed_file(img.filename):
                        filename = secure_filename(img.filename)
                        img.seek(0)
                        img_data = img.read()

                        # Сжимаем изображение
                        compressed_data = compress_image(
                            img_data,
                            max_size=Config.IMAGE_MAX_SIZE,
                            quality=Config.IMAGE_QUALITY
                        )

                        # Конвертируем в base64
                        img_base64 = base64.b64encode(compressed_data).decode('utf-8')

                        # Определяем content type
                        content_type = img.content_type
                        if not content_type or content_type == 'application/octet-stream':
                            ext = filename.lower().split('.')[-1]
                            if ext in ['jpg', 'jpeg']:
                                content_type = 'image/jpeg'
                            elif ext == 'png':
                                content_type = 'image/png'
                            else:
                                content_type = f'image/{ext}'

                        try:
                            existing = supabase.table('images') \
                                .select('*') \
                                .eq('draft_id', draft_id) \
                                .eq('filename', filename) \
                                .execute()

                            if existing.data:
                                supabase.table('images') \
                                    .update({
                                    'image_data': img_base64,
                                    'content_type': content_type,
                                    'uploaded_at': datetime.now().isoformat()
                                }) \
                                    .eq('draft_id', draft_id) \
                                    .eq('filename', filename) \
                                    .execute()
                                print(f"🔄 Обновлено существующее изображение: {filename}")
                            else:
                                image_data = {
                                    'draft_id': draft_id,
                                    'filename': filename,
                                    'image_data': img_base64,
                                    'content_type': content_type,
                                    'uploaded_at': datetime.now().isoformat()
                                }
                                supabase.table('images').insert(image_data).execute()
                                print(f"🖼️ Сохранено новое изображение: {filename}")

                            saved_images.append(filename)

                        except Exception as e:
                            print(f"❌ Ошибка при сохранении изображения {filename}: {e}")

            return True, {
                'id': draft_id,
                'display_name': display_name,
                'saved_images': saved_images,
                'is_update': bool(existing_draft)
            }, None

        except Exception as e:
            print(f"❌ Ошибка сохранения: {e}")
            traceback.print_exc()
            return False, str(e), None

    @staticmethod
    def update_draft(draft_id, data, images=None):
        """Обновляет существующий черновик с сохранением истории изменений"""
        from .image_utils import compress_image, allowed_file
        import base64
        from werkzeug.utils import secure_filename
        
        try:
            if supabase is None:
                return False, "Supabase не инициализирован"

            # Получаем текущие данные ДО обновления
            draft = SupabaseDB.get_draft(draft_id)
            if not draft:
                return False, "Черновик не найден"

            old_data = draft.get('data', {}).copy()

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

            # СОХРАНЯЕМ ИСТОРИЮ ИЗМЕНЕНИЙ
            SupabaseDB.save_history(draft_id, old_data, current_data)

            # ОБРАБАТЫВАЕМ ИЗОБРАЖЕНИЯ ПРИ ОБНОВЛЕНИИ
            saved_images = []
            if images:
                for img in images:
                    if img and allowed_file(img.filename):
                        filename = secure_filename(img.filename)
                        img.seek(0)
                        img_data = img.read()

                        # Сжимаем изображение
                        compressed_data = compress_image(
                            img_data,
                            max_size=Config.IMAGE_MAX_SIZE,
                            quality=Config.IMAGE_QUALITY
                        )

                        # Конвертируем в base64
                        img_base64 = base64.b64encode(compressed_data).decode('utf-8')

                        # Определяем content type
                        content_type = img.content_type
                        if not content_type or content_type == 'application/octet-stream':
                            ext = filename.lower().split('.')[-1]
                            if ext in ['jpg', 'jpeg']:
                                content_type = 'image/jpeg'
                            elif ext == 'png':
                                content_type = 'image/png'
                            else:
                                content_type = f'image/{ext}'

                        # Проверяем существование изображения
                        try:
                            existing = supabase.table('images') \
                                .select('*') \
                                .eq('draft_id', draft_id) \
                                .eq('filename', filename) \
                                .execute()

                            if existing.data:
                                # Обновляем существующее
                                supabase.table('images') \
                                    .update({
                                    'image_data': img_base64,
                                    'content_type': content_type,
                                    'uploaded_at': datetime.now().isoformat()
                                }) \
                                    .eq('draft_id', draft_id) \
                                    .eq('filename', filename) \
                                    .execute()
                                print(f"🔄 Обновлено изображение при обновлении: {filename}")
                            else:
                                # Вставляем новое
                                image_data = {
                                    'draft_id': draft_id,
                                    'filename': filename,
                                    'image_data': img_base64,
                                    'content_type': content_type,
                                    'uploaded_at': datetime.now().isoformat()
                                }
                                supabase.table('images').insert(image_data).execute()
                                print(f"🖼️ Добавлено новое изображение при обновлении: {filename}")

                            saved_images.append(filename)

                        except Exception as e:
                            print(f"❌ Ошибка при обновлении изображения {filename}: {e}")

            # Сохраняем файл заявки, если есть
            if 'requestFile' in data:
                request_file = data.get('requestFile')
                if request_file and hasattr(request_file, 'filename') and request_file.filename:
                    success, result = SupabaseDB.save_request_file(draft_id, request_file)
                    if not success:
                        print(f"⚠️ Ошибка сохранения файла заявки при обновлении: {result}")

            return True, {
                'draft_data': update_data,
                'saved_images': saved_images
            }

        except Exception as e:
            print(f"❌ Ошибка обновления: {e}")
            traceback.print_exc()
            return False, str(e)
