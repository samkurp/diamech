"""
Сервис для работы с Supabase
"""
import os
import json
import uuid
import base64
import io
from datetime import datetime
from werkzeug.utils import secure_filename
from supabase import create_client
import traceback


class SupabaseService:
    """Сервис для работы с Supabase"""
    
    def __init__(self, url=None, key=None):
        """Инициализация клиента Supabase"""
        self.url = url or os.environ.get('SUPABASE_URL', '')
        self.key = key or os.environ.get('SUPABASE_KEY', '')
        self.client = None
        self._connect()
    
    def _connect(self):
        """Подключение к Supabase"""
        if self.url and self.key:
            try:
                self.client = create_client(self.url, self.key)
                # Проверка подключения
                test_query = self.client.table('drafts').select('*').limit(1).execute()
                print("✅ Supabase: успешно подключен!")
            except Exception as e:
                print(f"❌ Ошибка подключения к Supabase: {e}")
                self.client = None
        else:
            print("⚠️ Supabase не настроен - переменные окружения отсутствуют")
            self.client = None
    
    def is_connected(self):
        """Проверка подключения"""
        return self.client is not None
    
    # ========== DRAFTS ==========
    
    def get_all_drafts(self, filter_status=None):
        """Получает все черновики с фильтрацией"""
        try:
            if not self.client:
                return []
            
            query = self.client.table('drafts').select('*')
            
            if filter_status == 'shipped':
                query = query.eq('machine_status', 'Отгружен')
            elif filter_status == 'active':
                query = query.neq('machine_status', 'Отгружен')
            
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
            
            return drafts
        except Exception as e:
            print(f"❌ Ошибка в get_all_drafts: {e}")
            return []
    
    def get_draft(self, draft_id):
        """Загружает конкретный черновик"""
        try:
            if not self.client:
                return None
            
            response = self.client.table('drafts').select('*').eq('id', draft_id).execute()
            
            if not response.data:
                return None
            
            draft = response.data[0]
            
            # Загружаем изображения
            images_response = self.client.table('images') \
                .select('filename') \
                .eq('draft_id', draft_id) \
                .execute()
            
            draft['image_files'] = [img['filename'] for img in images_response.data]
            
            return draft
        except Exception as e:
            print(f"❌ Ошибка загрузки черновика {draft_id}: {e}")
            return None
    
    def save_draft(self, data, images=None, compress_image_func=None):
        """Сохраняет новый черновик"""
        try:
            if not self.client:
                return False, "Supabase не инициализирован", None
            
            # Генерируем ID из данных станка
            machine_type = data.get('machineType', 'Unknown')
            lifting_capacity = data.get('liftingCapacity', 'Unknown')
            serial_number = data.get('serialNumber', 'Unknown')
            
            draft_id = f"{machine_type}_{lifting_capacity}_{serial_number}"
            draft_id = "".join(c for c in draft_id if c.isalnum() or c in ('_', '-'))
            
            if not draft_id or draft_id == "_Unknown_Unknown":
                draft_id = str(uuid.uuid4())
            
            display_name = f"{machine_type}-{lifting_capacity} №{serial_number}"
            
            # Проверяем существование
            existing_draft = self.get_draft(draft_id)
            
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
            
            # Сохраняем историю если черновик существует
            if existing_draft:
                old_data = existing_draft.get('data', {})
                self.save_history(draft_id, old_data, dict(data))
            
            # Сохраняем в Supabase
            self.client.table('drafts').upsert(draft_data).execute()
            
            # Сохраняем изображения
            saved_images = []
            if images and compress_image_func:
                for img in images:
                    if img and self._allowed_file(img.filename):
                        filename = secure_filename(img.filename)
                        img.seek(0)
                        img_data = img.read()
                        
                        # Сжимаем изображение
                        compressed_data = compress_image_func(img_data)
                        img_base64 = base64.b64encode(compressed_data).decode('utf-8')
                        
                        content_type = img.content_type
                        if not content_type or content_type == 'application/octet-stream':
                            ext = filename.lower().split('.')[-1]
                            content_type = f'image/{ext}'
                        
                        try:
                            existing = self.client.table('images') \
                                .select('*') \
                                .eq('draft_id', draft_id) \
                                .eq('filename', filename) \
                                .execute()
                            
                            if existing.data:
                                self.client.table('images') \
                                    .update({
                                        'image_data': img_base64,
                                        'content_type': content_type,
                                        'uploaded_at': datetime.now().isoformat()
                                    }) \
                                    .eq('draft_id', draft_id) \
                                    .eq('filename', filename) \
                                    .execute()
                            else:
                                image_data = {
                                    'draft_id': draft_id,
                                    'filename': filename,
                                    'image_data': img_base64,
                                    'content_type': content_type,
                                    'uploaded_at': datetime.now().isoformat()
                                }
                                self.client.table('images').insert(image_data).execute()
                            
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
    
    def update_draft(self, draft_id, data, images=None, compress_image_func=None):
        """Обновляет существующий черновик"""
        try:
            if not self.client:
                return False, "Supabase не инициализирован"
            
            draft = self.get_draft(draft_id)
            if not draft:
                return False, "Черновик не найден"
            
            old_data = draft.get('data', {}).copy()
            
            # Обновляем данные
            current_data = draft.get('data', {})
            for key, value in dict(data).items():
                if value:
                    current_data[key] = value
            
            update_data = {
                'data': current_data,
                'updated_at': datetime.now().isoformat(),
                'machine_status': data.get('machineStatus', draft.get('machine_status', 'Сборка'))
            }
            
            # Обновляем display_name
            machine_type = data.get('machineType', current_data.get('machineType', ''))
            lifting_capacity = data.get('liftingCapacity', current_data.get('liftingCapacity', ''))
            serial_number = data.get('serialNumber', current_data.get('serialNumber', ''))
            
            if machine_type and lifting_capacity and serial_number:
                update_data['display_name'] = f"{machine_type}-{lifting_capacity} №{serial_number}"
            
            # Сохраняем
            self.client.table('drafts').update(update_data).eq('id', draft_id).execute()
            
            # Сохраняем историю
            self.save_history(draft_id, old_data, current_data)
            
            # Обрабатываем изображения
            saved_images = []
            if images and compress_image_func:
                for img in images:
                    if img and self._allowed_file(img.filename):
                        filename = secure_filename(img.filename)
                        img.seek(0)
                        img_data = img.read()
                        
                        compressed_data = compress_image_func(img_data)
                        img_base64 = base64.b64encode(compressed_data).decode('utf-8')
                        
                        content_type = img.content_type
                        if not content_type or content_type == 'application/octet-stream':
                            ext = filename.lower().split('.')[-1]
                            content_type = f'image/{ext}'
                        
                        try:
                            existing = self.client.table('images') \
                                .select('*') \
                                .eq('draft_id', draft_id) \
                                .eq('filename', filename) \
                                .execute()
                            
                            if existing.data:
                                self.client.table('images') \
                                    .update({
                                        'image_data': img_base64,
                                        'content_type': content_type,
                                        'uploaded_at': datetime.now().isoformat()
                                    }) \
                                    .eq('draft_id', draft_id) \
                                    .eq('filename', filename) \
                                    .execute()
                            else:
                                image_data = {
                                    'draft_id': draft_id,
                                    'filename': filename,
                                    'image_data': img_base64,
                                    'content_type': content_type,
                                    'uploaded_at': datetime.now().isoformat()
                                }
                                self.client.table('images').insert(image_data).execute()
                            
                            saved_images.append(filename)
                        except Exception as e:
                            print(f"❌ Ошибка при обновлении изображения {filename}: {e}")
            
            return True, {
                'draft_data': update_data,
                'saved_images': saved_images
            }
            
        except Exception as e:
            print(f"❌ Ошибка обновления: {e}")
            traceback.print_exc()
            return False, str(e)
    
    def delete_draft(self, draft_id):
        """Удаляет черновик со всеми связанными данными"""
        try:
            if not self.client:
                return False, "Supabase не инициализирован"
            
            # Удаляем изображения
            self.client.table('images').delete().eq('draft_id', draft_id).execute()
            
            # Удаляем файл заявки
            self.client.table('request_files').delete().eq('draft_id', draft_id).execute()
            
            # Удаляем историю
            self.client.table('draft_history').delete().eq('draft_id', draft_id).execute()
            
            # Удаляем черновик
            result = self.client.table('drafts').delete().eq('id', draft_id).execute()
            
            if result.data:
                return True, "Черновик успешно удален"
            else:
                return False, "Черновик не найден"
                
        except Exception as e:
            print(f"❌ Ошибка удаления: {e}")
            return False, str(e)
    
    def _allowed_file(self, filename, allowed_extensions={'png', 'jpg', 'jpeg', 'gif', 'bmp'}):
        """Проверка разрешенного формата файла"""
        return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions
    
    # ========== HISTORY ==========
    
    def save_history(self, draft_id, old_data, new_data, changed_by=None):
        """Сохраняет изменения в историю"""
        # Реализация будет добавлена в следующем файле
        pass
    
    def get_history(self, draft_id=None, page=1, per_page=50):
        """Получает историю изменений"""
        # Реализация будет добавлена в следующем файле
        pass
    
    # ========== CUSTOMER ==========
    
    def get_customer_data(self, draft_id):
        """Получает данные заказчика"""
        try:
            if not self.client:
                return None
            
            response = self.client.table('drafts') \
                .select('customer_info, data') \
                .eq('id', draft_id) \
                .execute()
            
            if not response.data:
                return None
            
            draft = response.data[0]
            customer_info = draft.get('customer_info', {})
            
            if customer_info:
                return customer_info
            
            customer_name = draft.get('data', {}).get('customer', 'Не указан')
            return {
                'customerName': customer_name,
                'originalCustomer': customer_name
            }
        except Exception as e:
            print(f"❌ Ошибка получения данных заказчика: {e}")
            return None
    
    def update_customer_data(self, draft_id, customer_data):
        """Обновляет данные заказчика"""
        try:
            if not self.client:
                return False, "Supabase не инициализирован"
            
            draft = self.get_draft(draft_id)
            if not draft:
                return False, "Черновик не найден"
            
            customer_info = draft.get('customer_info', {})
            customer_info.update(customer_data)
            customer_info['updated_at'] = datetime.now().isoformat()
            
            self.client.table('drafts') \
                .update({
                    'customer_info': customer_info,
                    'updated_at': datetime.now().isoformat()
                }) \
                .eq('id', draft_id) \
                .execute()
            
            return True, draft
        except Exception as e:
            print(f"❌ Ошибка обновления данных заказчика: {e}")
            return False, str(e)
    
    # ========== IMAGES ==========
    
    def get_image(self, draft_id, filename):
        """Получает изображение из базы"""
        try:
            if not self.client:
                return None
            
            response = self.client.table('images') \
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
    
    # ========== REQUEST FILES ==========
    
    def save_request_file(self, draft_id, file, extract_text_func=None):
        """Сохраняет файл заявки"""
        try:
            if not self.client:
                return False, "Supabase не инициализирован"
            
            if not file or not file.filename:
                return False, "Файл не выбран"
            
            filename = secure_filename(file.filename)
            ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
            
            allowed_extensions = {'doc', 'docx'}
            if ext not in allowed_extensions:
                return False, "Неподдерживаемый формат файла"
            
            file.seek(0)
            file_data = file.read()
            
            # Извлекаем текст
            extracted_text = None
            has_text = False
            if extract_text_func:
                extracted_text = extract_text_func(file_data, filename)
                has_text = bool(extracted_text)
            
            file_base64 = base64.b64encode(file_data).decode('utf-8')
            content_type = 'application/msword' if ext == 'doc' else 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            
            request_data = {
                'draft_id': draft_id,
                'filename': filename,
                'file_data': file_base64,
                'content_type': content_type,
                'extracted_text': extracted_text,
                'has_text': has_text,
                'uploaded_at': datetime.now().isoformat()
            }
            
            existing = self.client.table('request_files') \
                .select('*') \
                .eq('draft_id', draft_id) \
                .execute()
            
            if existing.data:
                self.client.table('request_files') \
                    .update(request_data) \
                    .eq('draft_id', draft_id) \
                    .execute()
            else:
                self.client.table('request_files').insert(request_data).execute()
            
            return True, {
                'filename': filename,
                'has_text': has_text,
                'text_preview': extracted_text[:200] + '...' if extracted_text else None
            }
        except Exception as e:
            print(f"❌ Ошибка сохранения файла заявки: {e}")
            return False, str(e)
    
    def get_request_file(self, draft_id):
        """Получает файл заявки"""
        try:
            if not self.client:
                return None
            
            response = self.client.table('request_files') \
                .select('*') \
                .eq('draft_id', draft_id) \
                .execute()
            
            if not response.data:
                return None
            
            file_data = response.data[0]
            file_bytes = base64.b64decode(file_data['file_data'])
            return file_bytes, file_data['filename'], file_data['content_type']
        except Exception as e:
            print(f"❌ Ошибка получения файла заявки: {e}")
            return None
    
    def delete_request_file(self, draft_id):
        """Удаляет файл заявки"""
        try:
            if not self.client:
                return False
            
            self.client.table('request_files') \
                .delete() \
                .eq('draft_id', draft_id) \
                .execute()
            
            return True
        except Exception as e:
            print(f"❌ Ошибка удаления файла заявки: {e}")
            return False
    
    # ========== UPDATES ==========
    
    def get_updates(self, section=None):
        """Получает все прошивки и утилиты"""
        try:
            if not self.client:
                return None, None
            
            query = self.client.table('updates').select('*')
            if section:
                query = query.eq('section', section)
            
            response = query.order('sort_order', desc=False).order('created_at', desc=True).execute()
            
            meta_response = self.client.table('updates_meta') \
                .select('value') \
                .eq('key', 'last_update') \
                .execute()
            
            last_update = meta_response.data[0]['value'] if meta_response.data else '24.02.2026'
            
            grouped = {
                'sapphire': [],
                'yashma': [],
                'stsh': [],
                'external_utils': [],
                'internal_utils': [],
                'docs': []
            }
            
            for item in response.data:
                section = item.get('section')
                if section in grouped:
                    grouped[section].append({
                        'id': item.get('id'),
                        'title': item.get('title'),
                        'description': item.get('description'),
                        'date': item.get('date'),
                        'file': item.get('file_path'),
                        'badge': item.get('badge'),
                        'sort_order': item.get('sort_order', 0)
                    })
            
            return {'updates': grouped, 'last_update': last_update}, None
        except Exception as e:
            print(f"❌ Ошибка получения прошивок: {e}")
            return None, str(e)
    
    def create_update(self, data):
        """Создает новую запись о прошивке"""
        try:
            if not self.client:
                return False, "Supabase не инициализирован", None
            
            update_data = {
                'section': data.get('section'),
                'title': data.get('title'),
                'description': data.get('description', ''),
                'date': data.get('date', ''),
                'file_path': data.get('file'),
                'badge': data.get('badge', 'ZIP'),
                'sort_order': data.get('sort_order', 0),
                'updated_at': datetime.now().isoformat()
            }
            
            response = self.client.table('updates').insert(update_data).execute()
            
            # Обновляем дату последнего изменения
            self.client.table('updates_meta') \
                .update({
                    'value': datetime.now().strftime('%d.%m.%Y'),
                    'updated_at': datetime.now().isoformat()
                }) \
                .eq('key', 'last_update') \
                .execute()
            
            return True, None, response.data[0] if response.data else None
        except Exception as e:
            print(f"❌ Ошибка создания записи: {e}")
            return False, str(e), None
    
    def update_update(self, update_id, data):
        """Обновляет существующую запись"""
        try:
            if not self.client:
                return False, "Supabase не инициализирован", None
            
            update_data = {
                'title': data.get('title'),
                'description': data.get('description', ''),
                'date': data.get('date', ''),
                'file_path': data.get('file'),
                'badge': data.get('badge', 'ZIP'),
                'sort_order': data.get('sort_order', 0),
                'updated_at': datetime.now().isoformat()
            }
            
            update_data = {k: v for k, v in update_data.items() if v is not None}
            
            response = self.client.table('updates') \
                .update(update_data) \
                .eq('id', update_id) \
                .execute()
            
            self.client.table('updates_meta') \
                .update({
                    'value': datetime.now().strftime('%d.%m.%Y'),
                    'updated_at': datetime.now().isoformat()
                }) \
                .eq('key', 'last_update') \
                .execute()
            
            return True, None, response.data[0] if response.data else None
        except Exception as e:
            print(f"❌ Ошибка обновления записи: {e}")
            return False, str(e), None
    
    def delete_update(self, update_id):
        """Удаляет запись"""
        try:
            if not self.client:
                return False, "Supabase не инициализирован"
            
            self.client.table('updates').delete().eq('id', update_id).execute()
            
            self.client.table('updates_meta') \
                .update({
                    'value': datetime.now().strftime('%d.%m.%Y'),
                    'updated_at': datetime.now().isoformat()
                }) \
                .eq('key', 'last_update') \
                .execute()
            
            return True, None
        except Exception as e:
            print(f"❌ Ошибка удаления записи: {e}")
            return False, str(e)
    
    def reorder_updates(self, orders):
        """Изменяет порядок сортировки записей"""
        try:
            if not self.client:
                return False, "Supabase не инициализирован"
            
            for item in orders:
                self.client.table('updates') \
                    .update({'sort_order': item['order']}) \
                    .eq('id', item['id']) \
                    .execute()
            
            return True, None
        except Exception as e:
            print(f"❌ Ошибка обновления сортировки: {e}")
            return False, str(e)
