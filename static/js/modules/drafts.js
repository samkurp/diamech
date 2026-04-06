/**
 * drafts.js - Модуль для работы с черновиками станков
 * Оптимизированная и рефакторенная версия
 */

const Drafts = (function() {
    'use strict';

    // Конфигурация статусов
    const STATUS_CONFIG = {
        'Сборка': { order: 1, class: 'sborka' },
        'Собран': { order: 2, class: 'sobran' },
        'На испытании': { order: 3, class: 'на-испытании' },
        'Испытан': { order: 4, class: 'испытан' },
        'На упаковке': { order: 5, class: 'на-упаковке' },
        'Упакован': { order: 6, class: 'упакован' }
    };

    /**
     * Загрузка активных черновиков
     */
    async function loadActiveDrafts(containerId = 'draftsList') {
        try {
            const result = await API.get('/drafts', { status: 'active' });
            const container = document.getElementById(containerId);
            
            if (!container) return;

            if (!result.success || result.drafts.length === 0) {
                showEmptyState(containerId, '📝', 'Нет станков в работе', 'Добавьте первый станок');
                return;
            }

            // Фильтруем активные станки (не отгруженные)
            const activeDrafts = result.drafts.filter(d => d.machine_status !== 'Отгружен');

            if (activeDrafts.length === 0) {
                showEmptyState(containerId, '📝', 'Нет активных станков', 'Все станки отгружены');
                return;
            }

            const sortedDrafts = sortDrafts(activeDrafts);
            renderDrafts(containerId, sortedDrafts);

        } catch (error) {
            Utils.showStatus(`Ошибка загрузки: ${error.message}`, 'error');
        }
    }

    /**
     * Сортировка черновиков по статусу и названию
     */
    function sortDrafts(drafts) {
        return [...drafts].sort((a, b) => {
            const orderA = STATUS_CONFIG[a.machine_status]?.order || 999;
            const orderB = STATUS_CONFIG[b.machine_status]?.order || 999;

            if (orderA !== orderB) return orderA - orderB;
            return a.display_name.localeCompare(b.display_name);
        });
    }

    /**
     * Отрисовка списка черновиков
     */
    function renderDrafts(containerId, drafts) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';
        
        drafts.forEach(draft => {
            const draftElement = createDraftElement(draft);
            container.appendChild(draftElement);
        });
    }

    /**
     * Создание элемента черновика
     */
    function createDraftElement(draft) {
        const draftDiv = document.createElement('div');
        draftDiv.className = 'draft-item';
        draftDiv.style.cursor = 'pointer';
        draftDiv.onclick = () => viewDraft(draft.id);

        const statusClass = draft.machine_status 
            ? draft.machine_status.toLowerCase().replace(/\s+/g, '-') 
            : '';

        const shippingDateFormatted = formatShippingDate(draft.shipping_date);

        draftDiv.innerHTML = `
            <div class="draft-header">
                <div class="draft-title">${Utils.escapeHtml(draft.display_name)}</div>
            </div>
            <div class="draft-info">
                <div class="info-item">
                    <span class="info-label">Тип работы:</span>
                    <span class="info-value">${Utils.escapeHtml(draft.work_type)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Заказчик:</span>
                    <span class="info-value">${Utils.escapeHtml(draft.customer || 'Не указан')}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Статус:</span>
                    <span class="info-value status-value ${statusClass}">${Utils.escapeHtml(draft.machine_status)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Отгрузка:</span>
                    <span class="info-value shipping-date">${shippingDateFormatted}</span>
                </div>
            </div>
        `;

        return draftDiv;
    }

    /**
     * Форматирование даты отгрузки
     */
    function formatShippingDate(dateString) {
        if (!dateString) return 'Не указана';
        
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Не указана';
        
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    /**
     * Переход к просмотру черновика
     */
    function viewDraft(draftId) {
        window.location.href = `/view-machine.html?id=${draftId}`;
    }

    /**
     * Отображение пустого состояния
     */
    function showEmptyState(containerId, icon, title, message) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">${icon}</div>
                <h3>${Utils.escapeHtml(title)}</h3>
                <p>${Utils.escapeHtml(message)}</p>
                <a href="/add-draft" class="action-btn" style="max-width: 200px; margin-top: 15px;">
                    + Станок
                </a>
            </div>
        `;
    }

    /**
     * Загрузка данных заказчика для черновика
     */
    async function loadCustomerData(draftId) {
        try {
            const result = await API.get(`/drafts/${draftId}/customer`);
            return result.success ? result.customer_data : null;
        } catch (error) {
            console.log(`Ошибка загрузки данных заказчика для ${draftId}:`, error);
            return null;
        }
    }

    /**
     * Обновление отображения заказчика в элементе
     */
    function updateCustomerDisplay(element, customerData) {
        const customerEl = element.querySelector('.customer-value');
        if (!customerEl || !customerData) return;

        if (customerData.customerName) {
            customerEl.textContent = customerData.customerName;
        }

        customerEl.classList.remove('customer-clickable', 'customer-has-info');
        customerEl.onclick = null;
        customerEl.style.cursor = 'default';

        // Добавляем tooltip с дополнительной информацией
        const hasExtraInfo = customerData.productionAddress || 
                            customerData.hotelName || 
                            customerData.contactPerson || 
                            customerData.contactPhone;

        if (hasExtraInfo) {
            customerEl.classList.add('customer-has-info');
            customerEl.title = buildCustomerTooltip(customerData);
        } else {
            customerEl.title = '';
        }
    }

    /**
     * Построение текста подсказки для заказчика
     */
    function buildCustomerTooltip(data) {
        let tooltip = data.customerName || '';

        if (data.productionAddress) tooltip += `\n🏭 ${data.productionAddress}`;
        if (data.hotelName) {
            tooltip += `\n🏨 ${data.hotelName}`;
            if (data.hotelAddress) tooltip += ` (${data.hotelAddress})`;
        }
        if (data.contactPerson) tooltip += `\n👤 ${data.contactPerson}`;
        if (data.contactPhone) tooltip += `\n📞 ${data.contactPhone}`;
        if (data.contactEmail) tooltip += `\n📧 ${data.contactEmail}`;

        return tooltip;
    }

    // Публичный API модуля
    return {
        STATUS_CONFIG,
        loadActiveDrafts,
        sortDrafts,
        renderDrafts,
        createDraftElement,
        viewDraft,
        showEmptyState,
        loadCustomerData,
        updateCustomerDisplay
    };
})();

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // Проверяем, есть ли элемент draftsList на странице
    if (document.getElementById('draftsList')) {
        Drafts.loadActiveDrafts();
    }
});

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Drafts;
}
