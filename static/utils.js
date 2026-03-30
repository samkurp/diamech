// Общие утилиты для фронтенда
// Этот файл содержит переиспользуемые функции для всех страниц

/**
 * Показ сообщения о статусе
 * @param {string} message - Текст сообщения
 * @param {string} type - Тип сообщения (success, error, warning, info)
 * @param {number} duration - Время отображения в мс (0 = не скрывать автоматически)
 */
function showStatus(message, type, duration = 3000) {
    const statusElement = document.getElementById('statusMessage');
    if (!statusElement) return;

    statusElement.textContent = message;
    statusElement.className = `status-message ${type}`;
    statusElement.style.display = 'block';

    if (duration > 0) {
        setTimeout(() => {
            statusElement.style.display = 'none';
        }, duration);
    }
}

/**
 * Показ состояния "пусто" для списков
 * @param {string} containerId - ID контейнера
 * @param {string} icon - Иконка (эмодзи)
 * @param {string} title - Заголовок
 * @param {string} message - Описание
 * @param {string} actionText - Текст кнопки действия (опционально)
 * @param {string} actionHref - Ссылка кнопки действия (опционально)
 */
function showEmptyState(containerId, icon, title, message, actionText, actionHref) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
        <div class="empty-state">
            <div class="icon">${icon}</div>
            <h3>${title}</h3>
            <p>${message}</p>
            ${actionText && actionHref ? `
                <a href="${actionHref}" class="action-btn" style="max-width: 200px; margin-top: 15px;">
                    ${actionText}
                </a>
            ` : ''}
        </div>
    `;
}

/**
 * Форматирование даты в русский формат
 * @param {string} dateString - Строка даты
 * @returns {string} Отформатированная дата или исходная строка при ошибке
 */
function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return dateString;
        }
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
 * Показ индикатора загрузки
 * @param {string} text - Текст загрузки
 * @returns {HTMLElement} Элемент загрузки (для удаления)
 */
function showLoading(text = 'Загрузка...') {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading-overlay';
    loadingDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(255, 255, 255, 0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
    `;
    loadingDiv.innerHTML = `<div style="text-align: center;"><div class="spinner"></div><p style="margin-top: 10px; color: var(--text-muted);">${text}</p></div>`;
    document.body.appendChild(loadingDiv);
    return loadingDiv;
}

/**
 * Извлечение числа из серийного номера
 * @param {string} serial - Серийный номер
 * @returns {number|null} Число или null
 */
function extractNumberFromSerial(serial) {
    if (!serial) return null;
    const numbers = serial.match(/\d+/g);
    if (!numbers) return null;
    const fullNumber = numbers.join('');
    const num = parseInt(fullNumber, 10);
    return isNaN(num) ? null : num;
}

/**
 * Дебаунс для функций
 * @param {Function} func - Функция
 * @param {number} wait - Время ожидания в мс
 * @returns {Function} Обернутая функция
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
