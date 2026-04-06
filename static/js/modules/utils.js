/**
 * utils.js - Общие утилиты и вспомогательные функции
 * Модуль для фронтенда системы учета станков
 */

const Utils = (function() {
    'use strict';

    // Конфигурация
    const API_BASE = '/api';

    /**
     * Безопасное экранирование HTML
     * @param {string} text - Текст для экранирования
     * @returns {string} - Экранированный текст
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Форматирование даты в русский формат
     * @param {string} dateString - ISO строка даты
     * @returns {string} - Отформатированная дата
     */
    function formatDate(dateString) {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch {
            return dateString;
        }
    }

    /**
     * Форматирование даты и времени
     * @param {string} dateString - ISO строка даты
     * @returns {string} - Отформатированные дата и время
     */
    function formatDateTime(dateString) {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            return date.toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateString;
        }
    }

    /**
     * Показ уведомления
     * @param {string} message - Сообщение
     * @param {string} type - Тип ('success' | 'error' | 'info')
     * @param {number} duration - Длительность в мс
     */
    function showNotification(message, type = 'success', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
                <span class="notification-text">${escapeHtml(message)}</span>
            </div>
        `;

        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? 'rgba(16, 185, 129, 0.95)' : type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(59, 130, 246, 0.95)'};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
            backdrop-filter: blur(10px);
            border: 1px solid ${type === 'success' ? 'rgba(16, 185, 129, 0.3)' : type === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)'};
            max-width: 350px;
            font-family: 'Inter', sans-serif;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out forwards';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
    }

    /**
     * Показ статуса в элементе statusMessage
     * @param {string} message - Сообщение
     * @param {string} type - Тип ('success' | 'error' | 'info' | 'warning')
     */
    function showStatus(message, type = 'info') {
        const status = document.getElementById('statusMessage');
        if (!status) return;

        status.innerHTML = `<span style="font-size: 0.9rem;">${message}</span>`;
        status.className = `status-message ${type}`;
        status.style.display = 'block';

        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                status.style.display = 'none';
            }, 5000);
        }
    }

    /**
     * Показ индикатора загрузки
     * @param {string} message - Сообщение
     * @returns {Object} - Объект с методом remove()
     */
    function showLoading(message) {
        let status = document.getElementById('statusMessage');
        
        if (!status) {
            status = document.createElement('div');
            status.id = 'tempStatusMessage';
            status.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(30, 41, 59, 0.95);
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                z-index: 10000;
                border: 1px solid var(--border);
            `;
            document.body.appendChild(status);
        }

        status.innerHTML = `<div class="loading">${escapeHtml(message)}</div>`;
        status.className = 'status-message info';
        status.style.display = 'block';

        return {
            remove: () => {
                status.style.display = 'none';
                if (status.id === 'tempStatusMessage' && status.parentNode) {
                    status.parentNode.removeChild(status);
                }
            }
        };
    }

    /**
     * Debounce функция
     * @param {Function} func - Функция
     * @param {number} wait - Задержка в мс
     * @returns {Function} - Debounced функция
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Извлечение числа из строки (например, из заводского номера)
     * @param {string} serial - Строка с номером
     * @returns {number|null} - Число или null
     */
    function extractNumberFromString(serial) {
        if (!serial) return null;
        const numbers = serial.match(/\d+/g);
        if (!numbers) return null;
        const fullNumber = numbers.join('');
        const num = parseInt(fullNumber, 10);
        return isNaN(num) ? null : num;
    }

    /**
     * Проверка валидации email
     * @param {string} email - Email для проверки
     * @returns {boolean} - Результат проверки
     */
    function isValidEmail(email) {
        if (!email) return false;
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    /**
     * Округление до указанного количества знаков
     * @param {number} value - Число
     * @param {number} decimals - Количество знаков
     * @returns {number} - Округленное число
     */
    function roundTo(value, decimals = 0) {
        const multiplier = Math.pow(10, decimals);
        return Math.round(value * multiplier) / multiplier;
    }

    /**
     * Сохранение в localStorage с обработкой ошибок
     * @param {string} key - Ключ
     * @param {any} value - Значение
     * @returns {boolean} - Успешность сохранения
     */
    function saveToLocalStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`Ошибка сохранения в localStorage (${key}):`, error);
            return false;
        }
    }

    /**
     * Загрузка из localStorage с обработкой ошибок
     * @param {string} key - Ключ
     * @param {any} defaultValue - Значение по умолчанию
     * @returns {any} - Загруженное значение или defaultValue
     */
    function loadFromLocalStorage(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error(`Ошибка загрузки из localStorage (${key}):`, error);
            return defaultValue;
        }
    }

    /**
     * Добавление стилей анимации для уведомлений
     */
    function injectNotificationStyles() {
        const existingStyle = document.getElementById('notification-styles');
        if (existingStyle) return;

        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
            .loading {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .loading::after {
                content: '';
                width: 16px;
                height: 16px;
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-top-color: white;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }

    // Инициализация при загрузке
    injectNotificationStyles();

    // Публичный API модуля
    return {
        API_BASE,
        escapeHtml,
        formatDate,
        formatDateTime,
        showNotification,
        showStatus,
        showLoading,
        debounce,
        extractNumberFromString,
        isValidEmail,
        roundTo,
        saveToLocalStorage,
        loadFromLocalStorage
    };
})();

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}
