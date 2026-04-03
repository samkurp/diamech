// Конфигурация статусов
const STATUS_CONFIG = {
    'Сборка': {
        order: 1,
        class: 'sborka'
    },
    'Собран': {
        order: 2,
        class: 'sobran'
    },
    'На испытании': {
        order: 3,
        class: 'на-испытании'
    },
    'Испытан': {
        order: 4,
        class: 'испытан'
    },
    'На упаковке': {
        order: 5,
        class: 'на-упаковке'
    },
    'Упакован': {
        order: 6,
        class: 'упакован'
    }
};

// Оптимизация: Кэш для данных черновиков
let draftsCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 30000; // 30 секунд кэш

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    loadDrafts();
});

// Загрузка черновиков с кэшированием
async function loadDrafts(forceRefresh = false) {
    const now = Date.now();
    
    // Проверяем кэш
    if (!forceRefresh && draftsCache && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION)) {
        renderDrafts(draftsCache);
        return;
    }
    
    try {
        const response = await fetch('/api/drafts?status=active');
        const result = await response.json();

        if (result.success && result.drafts.length > 0) {
            // Фильтруем активные станки
            const activeDrafts = result.drafts.filter(draft =>
                draft.machine_status !== 'Отгружен'
            );

            if (activeDrafts.length === 0) {
                showEmptyState('📝', 'Нет активных станков', 'Все станки отгружены');
                return;
            }

            // Сортируем и кэшируем
            draftsCache = sortDrafts(activeDrafts);
            cacheTimestamp = now;
            
            renderDrafts(draftsCache);
        } else {
            showEmptyState('📝', 'Нет станков в работе', 'Добавьте первый станок');
        }

    } catch (error) {
        showStatus(`Ошибка загрузки: ${error.message}`, 'error');
    }
}

// Рендеринг черновиков (вынесено для оптимизации)
function renderDrafts(drafts) {
    const draftsList = document.getElementById('draftsList');
    
    if (!draftsList) return;
    
    draftsList.innerHTML = '';
    
    // Используем DocumentFragment для оптимизации DOM операций
    const fragment = document.createDocumentFragment();
    
    drafts.forEach(draft => {
        const draftElement = createDraftElement(draft);
        fragment.appendChild(draftElement);
    });
    
    draftsList.appendChild(fragment);
}

// Создание элемента черновика
function createDraftElement(draft) {
    const draftDiv = document.createElement('div');
    draftDiv.className = 'draft-item';

    // При клике на карточку открываем страницу просмотра
    draftDiv.onclick = () => viewDraft(draft.id);
    draftDiv.style.cursor = 'pointer';

    const statusClass = draft.machine_status ?
        draft.machine_status.toLowerCase().replace(/\s+/g, '-') : '';

    // Форматируем дату отгрузки, если она есть
    let shippingDateFormatted = 'Не указана';
    if (draft.shipping_date) {
        const date = new Date(draft.shipping_date);
        if (!isNaN(date.getTime())) {
            shippingDateFormatted = date.toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        }
    }

    draftDiv.innerHTML = `
        <div class="draft-header">
            <div class="draft-title">
                ${draft.display_name}
            </div>
        </div>

        <div class="draft-info">
            <div class="info-item">
                <span class="info-label">Тип работы:</span>
                <span class="info-value">${draft.work_type}</span>
            </div>

            <div class="info-item">
                <span class="info-label">Заказчик:</span>
                <span class="info-value">${draft.customer || 'Не указан'}</span>
            </div>

            <div class="info-item">
                <span class="info-label">Статус:</span>
                <span class="info-value status-value ${statusClass}">
                    ${draft.machine_status}
                </span>
            </div>

            <div class="info-item">
                <span class="info-label">Отгрузка:</span>
                <span class="info-value shipping-date">
                    ${shippingDateFormatted}
                </span>
            </div>
        </div>
    `;

    return draftDiv;
}

// Открытие страницы просмотра
function viewDraft(draftId) {
    window.location.href = `/view-machine.html?id=${draftId}`;
}

// Сортировка
function sortDrafts(drafts) {
    return drafts.sort((a, b) => {
        const orderA = STATUS_CONFIG[a.machine_status]?.order || 999;
        const orderB = STATUS_CONFIG[b.machine_status]?.order || 999;

        if (orderA !== orderB) {
            return orderA - orderB;
        }

        return a.display_name.localeCompare(b.display_name);
    });
}

// Показ состояния "пусто"
function showEmptyState(icon, title, message) {
    const draftsList = document.getElementById('draftsList');
    draftsList.innerHTML = `
        <div class="empty-state">
            <div class="icon">${icon}</div>
            <h3>${title}</h3>
            <p>${message}</p>
            <a href="/add-draft" class="action-btn" style="max-width: 200px; margin-top: 15px;">
                + Станок
            </a>
        </div>
    `;
}

// Показ статуса
function showStatus(message, type) {
    const statusElement = document.getElementById('statusMessage');
    if (!statusElement) return;

    statusElement.textContent = message;
    statusElement.className = `status-message ${type}`;
    statusElement.style.display = 'block';

    setTimeout(() => {
        statusElement.style.display = 'none';
    }, 3000);
}