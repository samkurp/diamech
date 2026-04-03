/**
 * Оптимизированный утилита для ленивой загрузки изображений
 * Использует Intersection Observer API для эффективной загрузки
 */

class LazyImageLoader {
    constructor(options = {}) {
        this.options = {
            rootMargin: options.rootMargin || '50px',
            threshold: options.threshold || 0.01,
            effectDuration: options.effectDuration || 300,
            ...options
        };
        
        this.observer = null;
        this.init();
    }

    init() {
        // Проверка поддержки Intersection Observer
        if (!('IntersectionObserver' in window)) {
            this.fallbackLoadAll();
            return;
        }

        this.observer = new IntersectionObserver(
            this.handleIntersection.bind(this),
            {
                rootMargin: this.options.rootMargin,
                threshold: this.options.threshold
            }
        );
    }

    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                this.loadImage(img);
                this.observer.unobserve(img);
            }
        });
    }

    loadImage(img) {
        const src = img.dataset.src || img.src;
        
        if (!src) return;

        // Создаем новое изображение для предзагрузки
        const tempImg = new Image();
        
        tempImg.onload = () => {
            img.src = src;
            img.classList.add('loaded');
            img.classList.remove('lazy');
        };

        tempImg.onerror = () => {
            img.classList.add('error');
            console.warn('Failed to load image:', src);
        };

        tempImg.src = src;
    }

    observe(container = document) {
        if (!this.observer) return;

        const images = container.querySelectorAll('img.lazy');
        images.forEach(img => this.observer.observe(img));
    }

    fallbackLoadAll() {
        // Fallback для старых браузеров - загружаем все изображения сразу
        const images = document.querySelectorAll('img.lazy');
        images.forEach(img => {
            img.classList.add('loaded');
            img.classList.remove('lazy');
        });
    }

    disconnect() {
        if (this.observer) {
            this.observer.disconnect();
        }
    }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LazyImageLoader;
}
