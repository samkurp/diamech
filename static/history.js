// Конфигурация
const API_BASE = '/api';
let allHistory = [];
let displayedHistory = [];
let currentFilter = 'all';
let currentPage = 1;
const ITEMS_PER_PAGE = 20;

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    loadHistory();
    setupFilters();
    setupModal();
});

// Загрузка истории
async function loadHistory() {
    try {
        const response = await fetch(`${API_BASE}/history?limit=500`);
        const result = await response.json();

        if (result.success) {
            allHistory = result.history;
            applyFilter(currentFilter);
        } else {
            showError('Ошибка загрузки истории');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showError('Не удалось загрузить историю');
    }
}

// Применение фильтра
function applyFilter(filter) {
    currentFilter = filter;
    currentPage = 1;

    if (filter === 'all') {
        displayedHistory = [...allHistory];
    } else if (filter === 'image') {
        displayedHistory = allHistory.filter(item => 
            item.action_type?.startsWith('image_')
        );
    } else {
        displayedHistory = allHistory.filter(item => 
            item.action_type === filter
        );
    }

    renderHistory();
}

// Настройка фильтров
function setupFilters() {
    const filters = document.querySelectorAll('.history-filter');
    
    filters.forEach(filter => {
        filter.addEventListener('click', () => {
            filters.forEach(f => f.classList.remove('active'));
            filter.classList.add('active');
            applyFilter(filter.dataset.filter);
        });
    });
}

// Рендер истории
function renderHistory() {
    const timeline = document.getElementById('historyTimeline');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    
    if (!timeline) return;

    if (displayedHistory.length === 0) {
        timeline.innerHTML = `
            <div class="empty-state">
                <div class="icon">📭</div>
                <h3>Нет записей</h3>
                <p>По выбранному фильтру ничего не найдено</p>
            </div>
        `;
        loadMoreBtn.style.display = 'none';
        return;
    }

    // Пагинация
    const start = 0;
    const end = currentPage * ITEMS_PER_PAGE;
    const itemsToShow = displayedHistory.slice(start, end);

    timeline.innerHTML = '';
    
    itemsToShow.forEach((item, index) => {
        const element = createHistoryElement(item, index);
        timeline.appendChild(element);
    });

    // Показываем/скрываем кнопку "Загрузить еще"
    if (displayedHistory.length > end) {
        loadMoreBtn.style.display = 'block';
        loadMoreBtn.onclick = () => {
            currentPage++;
            renderHistory();
        };
    } else {
        loadMoreBtn.style.display = 'none';
    }
}

// Создание элемента истории
function createHistoryElement(item, index) {
    const div = document.createElement('div');
    div.className = 'history-item';
    
    // Определяем тип действия для стилей
    let badgeClass = 'badge-update';
    let badgeText = 'Изменение';
    
    if (item.action_type === 'create') {
        badgeClass = 'badge-create';
        badgeText = 'Создание';
    } else if (item.action_type === 'status_change') {
        badgeClass = 'badge-status';
        badgeText = 'Статус';
    } else if (item.action_type?.startsWith('image_')) {
        badgeClass = 'badge-image';
        badgeText = 'Изображение';
    }
    
    // Получаем название станка
    const machineName = item.drafts?.display_name || 'Неизвестный станок';
    const machineInfo = item.drafts?.data ? 
        `${item.drafts.data.machineType || ''}${item.drafts.data.serialNumber || ''}` : '';
    
    div.innerHTML = `
        <div class="history-dot"></div>
        <div class="history-card" data-id="${item.id}" data-index="${index}">
            <div class="history-header">
                <div>
                    <span class="history-badge ${badgeClass}">${badgeText}</span>
                    <span class="history-machine">
                        ${machineName}
                        ${machineInfo ? `<small>${machineInfo}</small>` : ''}
                    </span>
                </div>
                <span class="history-time">${item.created_at_formatted || item.created_at || 'Неизвестно'}</span>
            </div>
            
            <div class="history-description">
                ${item.description || 'Без описания'}
            </div>
            
            <div class="history-details" id="details-${item.id}">
                ${renderDetails(item)}
            </div>
            
            <div class="expand-icon">▼</div>
        </div>
    `;

    // Добавляем обработчик клика для разворачивания
    const card = div.querySelector('.history-card');
    card.addEventListener('click', (e) => {
        e.stopPropagation();
        card.classList.toggle('expanded');
    });

    return div;
}

// Рендер деталей изменения
function renderDetails(item) {
    if (!item.changed_fields) return '<p>Нет деталей</p>';
    
    const fields = item.changed_fields;
    const previousValues = item.previous_values || {};
    const newValues = item.new_values || {};
    
    let html = '<div class="history-details-grid">';
    
    // Если есть старые и новые значения
    if (Object.keys(previousValues).length > 0 || Object.keys(newValues).length > 0) {
        // Старые значения
        html += '<div class="detail-column"><div class="detail-title">Было</div>';
        for (const [key, value] of Object.entries(previousValues)) {
            if (value !== undefined && value !== null && value !== '') {
                html += `
                    <div class="detail-item">
                        <span class="detail-label">${getFieldName(key)}:</span>
                        <span class="detail-value old">${value}</span>
                    </div>
                `;
            }
        }
        html += '</div>';
        
        // Новые значения
        html += '<div class="detail-column"><div class="detail-title">Стало</div>';
        for (const [key, value] of Object.entries(newValues)) {
            if (value !== undefined && value !== null && value !== '') {
                html += `
                    <div class="detail-item">
                        <span class="detail-label">${getFieldName(key)}:</span>
                        <span class="detail-value new">${value}</span>
                    </div>
                `;
            }
        }
        html += '</div>';
    } else {
        // Простой показ измененных полей
        html += '<div class="detail-column" style="grid-column: 1/-1;">';
        for (const [key, change] of Object.entries(fields)) {
            if (typeof change === 'object' && change.old !== undefined) {
                html += `
                    <div class="detail-item">
                        <span class="detail-label">${getFieldName(key)}:</span>
                        <span class="detail-value old">${change.old || 'пусто'}</span>
                        → 
                        <span class="detail-value new">${change.new || 'пусто'}</span>
                    </div>
                `;
            } else {
                html += `
                    <div class="detail-item">
                        <span class="detail-label">${key}:</span>
                        <span class="detail-value">${JSON.stringify(change)}</span>
                    </div>
                `;
            }
        }
        html += '</div>';
    }
    
    html += '</div>';
    return html;
}

// Получение русского названия поля
function getFieldName(key) {
    const names = {
        'workType': 'Тип работы',
        'machineType': 'Тип станка',
        'liftingCapacity': 'Грузоподъемность',
        'serialNumber': 'Заводской номер',
        'customer': 'Заказчик',
        'notes': 'Примечания',
        'driveType': 'Тип привода',
        'driveNumber': 'Номер привода',
        'brakeResistor': 'Тормозной резистор',
        'resistorCount': 'Кол-во резисторов',
        'electricMotor': 'Электродвигатель',
        'EnginePower': 'Мощность',
        'motorNumber': 'Номер двигателя',
        'angleSensor': 'Датчик угла',
        'angleSensorNumber': 'Номер датчика угла',
        'speedSensorNumber': 'Номер отметчика',
        'leftVibrationSensor': 'Левый датчик',
        'leftSensitivity': 'Чувствительность левого',
        'leftSensorNumber': 'Номер левого',
        'rightVibrationSensor': 'Правый датчик',
        'rightSensitivity': 'Чувствительность правого',
        'rightSensorNumber': 'Номер правого',
        'measuringDevice': 'Измерительный прибор',
        'measuringDeviceNumber': 'Номер прибора',
        'signalProcessor': 'Блок обработки',
        'signalProcessorNumber': 'Номер блока',
        'machineStatus': 'Статус',
        'shippingDate': 'Дата отгрузки'
    };
    return names[key] || key;
}

// Настройка модального окна
function setupModal() {
    const modal = document.getElementById('historyModal');
    const closeBtn = modal.querySelector('.close');
    
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// Показ ошибки
function showError(message) {
    const timeline = document.getElementById('historyTimeline');
    if (timeline) {
        timeline.innerHTML = `
            <div class="empty-state">
                <div class="icon">❌</div>
                <h3>${message}</h3>
                <button onclick="location.reload()" class="action-btn" style="margin-top: 15px;">
                    Повторить
                </button>
            </div>
        `;
    }
}

// Экспорт в глобальную область
window.applyFilter = applyFilter;
