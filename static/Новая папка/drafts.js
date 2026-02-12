// Функция для получения цвета статуса
function getStatusColor(status) {
    const statusColors = {
        'Наладка': '#ed8936',
        'Обкатка': '#38b2ac',
        'Доработка механики': '#9f7aea',
        'Доработка Электрики': '#ed64a6',
        'Аттестация': '#68d391',
        'Готов': '#38a169'
    };
    return statusColors[status] || '#3182ce';
}

// Загрузка списка черновиков при открытии страницы
document.addEventListener('DOMContentLoaded', function() {
    loadDrafts();
});

// Загрузка списка черновиков
async function loadDrafts() {
    try {
        const response = await fetch('/api/drafts');
        const result = await response.json();

        const draftsList = document.getElementById('draftsList');

        if (result.success && result.drafts.length > 0) {
            draftsList.innerHTML = '';

            result.drafts.forEach(draft => {
                const draftElement = createDraftElement(draft);
                draftsList.appendChild(draftElement);
            });
        } else {
            draftsList.innerHTML = `
                <div class="empty-state">
                    <div class="icon">📝</div>
                    <h3>Станков в работе нет</h3>
                    <p>Сохраните первый черновик из формы ввода данных</p>
                </div>
            `;
        }
    } catch (error) {
        showStatus('❌ Ошибка загрузки черновиков: ' + error.message, 'error');
    }
}

// Создание элемента черновика

function createDraftElement(draft) {
    const draftDiv = document.createElement('div');
    draftDiv.className = 'draft-item';

    // Определяем цвет карточки в зависимости от статуса
    let statusClass = '';
    if (draft.machine_status === 'Доработка') {
        statusClass = 'status-dorabotka';
    } else if (draft.machine_status === 'Готов к упаковке') {
        statusClass = 'status-ready';
    }

    draftDiv.innerHTML = `
        <div class="draft-header">
            <button class="draft-title" onclick="editDraft('${draft.id}')">${draft.display_name}</button>
        </div>
        <div class="draft-info">
            <div class="info-item">
                <span class="info-label">Тип работы:</span>
                <span class="info-value">${draft.work_type}</span>
                <span class="info-label">Заказчик:</span>
                <span class="info-value">${draft.customer || 'Не указан'}</span>
            </div>

            <div class="info-item">
                <span class="info-label">Статус:</span>
                <span class="info-value status-value ${draft.machine_status?.toLowerCase().replace(/\s+/g, '-') || ''}">
                    ${draft.machine_status || 'Не указан'}
                </span>
                <span class="info-label">Примечания:</span>
                <span class="info-value">${draft.notes || 'Нет'}</span>
            </div>
        </div>

    `;

    // Добавляем класс статуса к основной карточке
    if (statusClass) {
        draftDiv.classList.add(statusClass);
    }

    return draftDiv;
}

// Редактирование черновика
function editDraft(draftId) {
    window.location.href = `/?draft=${draftId}`;
}

// Показать статус
function showStatus(message, type) {
    const statusElement = document.getElementById('statusMessage');
    statusElement.textContent = message;
    statusElement.className = `status-message ${type}`;
    statusElement.style.display = 'block';

    setTimeout(() => {
        statusElement.style.display = 'none';
    }, 1000);
}
// Обновление статуса черновика
