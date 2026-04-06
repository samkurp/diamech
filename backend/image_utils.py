"""
Утилиты для обработки изображений
"""
import io
from PIL import Image
from .config import Config


def compress_image(image_data, max_size=None, quality=None):
    """
    Сжимает изображение до заданных размеров и качества
    
    Args:
        image_data: байтовые данные изображения
        max_size: максимальный размер стороны в пикселях (по умолчанию из Config)
        quality: качество сжатия в процентах (по умолчанию из Config)
    
    Returns:
        сжатые байтовые данные изображения
    """
    if max_size is None:
        max_size = Config.IMAGE_MAX_SIZE
    if quality is None:
        quality = Config.IMAGE_QUALITY
        
    try:
        # Открываем изображение
        img = Image.open(io.BytesIO(image_data))

        # Конвертируем в RGB если нужно
        if img.mode in ('RGBA', 'LA', 'P'):
            img = img.convert('RGB')

        # Изменяем размер с сохранением пропорций
        img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

        # Сохраняем с сжатием
        output = io.BytesIO()
        img.save(output, format=Config.IMAGE_FORMAT, quality=quality, optimize=True)
        compressed_data = output.getvalue()

        print(f"🖼️ Изображение сжато: {len(image_data)} -> {len(compressed_data)} байт")
        return compressed_data

    except Exception as e:
        print(f"❌ Ошибка сжатия изображения: {e}")
        return image_data  # Возвращаем оригинал в случае ошибки


def allowed_file(filename):
    """
    Проверяет, разрешен ли формат файла
    
    Args:
        filename: имя файла
    
    Returns:
        True если формат разрешен, False иначе
    """
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS
