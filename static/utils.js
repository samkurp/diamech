/**
 * Оптимизированный Debounce/Throttle утилиты
 * Для ограничения частоты выполнения функций
 */

// Debounce - задержка выполнения функции до прекращения вызовов
function debounce(func, wait = 300) {
    let timeout;
    
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };

        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle - выполнение функции не чаще одного раза в указанный интервал
function throttle(func, limit = 300) {
    let inThrottle;
    
    return function executedFunction(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            
            setTimeout(() => {
                inThrottle = false;
            }, limit);
        }
    };
}

// Оптимизированный поиск с debounce
function setupOptimizedSearch(inputSelector, searchCallback, delay = 300) {
    const input = document.querySelector(inputSelector);
    
    if (!input) return null;

    const debouncedSearch = debounce(searchCallback, delay);
    
    input.addEventListener('input', (e) => {
        debouncedSearch(e.target.value);
    });

    return debouncedSearch;
}

// Оптимизированный скролл с throttle
function setupOptimizedScroll(scrollCallback, limit = 100) {
    const throttledScroll = throttle(scrollCallback, limit);
    
    window.addEventListener('scroll', throttledScroll, { passive: true });
    
    return throttledScroll;
}

// Оптимизированный resize с throttle
function setupOptimizedResize(resizeCallback, limit = 250) {
    const throttledResize = throttle(resizeCallback, limit);
    
    window.addEventListener('resize', throttledResize, { passive: true });
    
    return throttledResize;
}

// Экспорт утилит
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        debounce,
        throttle,
        setupOptimizedSearch,
        setupOptimizedScroll,
        setupOptimizedResize
    };
}
