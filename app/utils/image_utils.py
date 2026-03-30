"""
Утилиты для работы с изображениями
"""
import io
from PIL import Image


def compress_image(image_data, max_size=1024, quality=70):
    """
    Сжимает изображение до заданных размеров и качества
    
    Args:
        image_data: байты изображения
        max_size: максимальный размер стороны в пикселях
        quality: качество сжатия (1-100)
    
    Returns:
        сжатые байты изображения
    """
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
        img.save(output, format='JPEG', quality=quality, optimize=True)
        compressed_data = output.getvalue()
        
        return compressed_data
        
    except Exception as e:
        print(f"❌ Ошибка сжатия изображения: {e}")
        return image_data  # Возвращаем оригинал в случае ошибки
