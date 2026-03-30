// Подключаем общие утилиты (должен быть подключен перед этим файлом в HTML)
// Функции showStatus, showEmptyState, formatDate, extractNumberFromSerial доступны глобально

// Глобальные переменные
let allMachines = [];
let searchTimeout = null;

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    initSearch();
    loadShippedMachines();
});

// Инициализация минималистичного поиска
function initSearch() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearch');

    if (!searchInput || !clearBtn) return;

    // Поиск с дебаунсом
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);

        // Показываем/скрываем кнопку очистки
        clearBtn.classList.toggle('visible', this.value.length > 0);

        // Поиск через 250мс после остановки ввода
        searchTimeout = setTimeout(() => {
            performSearch(this.value.trim());
        }, 250);
    });

    // Поиск по Enter
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            clearTimeout(searchTimeout);
            performSearch(this.value.trim());
        }
    });

    // Очистка поиска
    clearBtn.addEventListener('click', function(e) {
        e.preventDefault();
        searchInput.value = '';
        searchInput.focus();
        this.classList.remove('visible');
        performSearch('');
    });

    // Фокус на поисковую строку
    searchInput.focus();
}

// Загрузка отгруженных станков
async function loadShippedMachines() {
    try {
        const response = await fetch('/api/drafts?status=shipped');
        const result = await response.json();

        if (result.success) {
            allMachines = result.drafts;
            displayMachines(allMachines);

            // После отображения загружаем данные заказчиков
            setTimeout(() => loadAllCustomerData(), 100);
        } else {
            showEmptyState('shippedList', '📦', 'Нет отгруженных станков',
                          'Станки со статусом "Отгружен" появятся здесь автоматически');
            allMachines = [];
        }
    } catch (error) {
        showStatus(`Ошибка загрузки: ${error.message}`, 'error');
    }
}

// Загрузка данных всех заказчиков
async function loadAllCustomerData() {
    const shippedList = document.getElementById('shippedList');
    if (!shippedList) return;

    const draftElements = shippedList.querySelectorAll('.draft-item');

    for (const draftElement of draftElements) {
        const draftId = draftElement.dataset.draftId;
        if (draftId) {
            try {
                const response = await fetch(`/api/drafts/${draftId}/customer`);
                const result = await response.json();

                if (result.success) {
                    const customerData = result.customer_data || {};
                    updateDraftCustomerDisplay(draftElement, customerData);
                }
            } catch (error) {
                // Тихая ошибка для отдельных заказчиков
            }
        }
    }
}

// Поиск станков
function performSearch(query) {
    if (!query.trim()) {
        displayMachines(allMachines);
        return;
    }

    const results = searchMachines(query);
    displayMachines(results);
}

// Алгоритм поиска
function searchMachines(query) {
    const normalizedQuery = query.toLowerCase().trim();

    return allMachines.filter(machine => {
        // Подготавливаем поля для поиска
        const fields = [
            machine.display_name || '',
            machine.machine_type || '',
            machine.serial_number || '',
            machine.customer || '',
            machine.work_type || ''
        ].map(field => field.toLowerCase());

        // Ищем в каждом поле
        return fields.some(field => field.includes(normalizedQuery));
    });
}


// Отображение станков
function displayMachines(machines) {
    const shippedList = document.getElementById('shippedList');
    const noResults = document.getElementById('noResults');

    if (!shippedList || !noResults) return;

    if (machines.length > 0) {
        shippedList.innerHTML = '';

        // Сортировка по заводскому номеру (serial_number) по убыванию
        const sortedMachines = [...machines].sort((a, b) => {
            // Извлекаем заводские номера (serial_number)
            const serialA = a.serial_number || '';
            const serialB = b.serial_number || '';
            
            // Извлекаем числовую часть из заводского номера
            const numA = extractNumberFromSerial(serialA);
            const numB = extractNumberFromSerial(serialB);
            
            // Если удалось извлечь числа из обоих номеров
            if (numA !== null && numB !== null) {
                return numB - numA; // По убыванию (большие номера сверху)
            }
            
            // Если не удалось извлечь числа, сравниваем как строки
            return serialB.localeCompare(serialA);
        });

        sortedMachines.forEach(draft => {
            const draftElement = createShippedElement(draft);
            shippedList.appendChild(draftElement);
        });

        shippedList.style.display = 'grid';
        noResults.style.display = 'none';

    } else {
        shippedList.style.display = 'none';
        noResults.style.display = 'block';
    }
}

// Вспомогательная функция для извлечения числа из заводского номера
function extractNumberFromSerial(serial) {
    if (!serial) return null;
    
    // Ищем все цифры в строке
    const numbers = serial.match(/\d+/g);
    if (!numbers) return null;
    
    // Объединяем все найденные цифры в одно число
    const fullNumber = numbers.join('');
    
    // Преобразуем в число
    const num = parseInt(fullNumber, 10);
    
    // Проверяем, что получилось валидное число
    return isNaN(num) ? null : num;
}

// Создание элемента станка
function createShippedElement(draft) {
    const draftDiv = document.createElement('div');
    draftDiv.className = 'draft-item';
    draftDiv.classList.add('status-shipped');
    draftDiv.classList.add('clickable-draft');
    draftDiv.dataset.draftId = draft.id;

    // Форматируем дату
    const updatedDate = formatDate(draft.updated_at);
    const createdDate = formatDate(draft.created_at);

    draftDiv.innerHTML = `
        <div class="draft-info">
            <div class="info-item">
                <span class="info-label">Название:</span>
                <span class="info-value draft-title">${draft.display_name}</span>
            </div>

            <div class="info-item">
                <span class="info-label">Тип работы:</span>
                <span class="info-value">${draft.work_type}</span>
            </div>

            <div class="info-item">
                <span class="info-label">Заказчик:</span>
                <span class="info-value customer-value" id="customer-${draft.id}">
                    ${draft.customer || 'Не указан'}
                </span>
            </div>

        </div>
    `;

    // Обработчик клика на весь элемент (кроме заказчика)
    draftDiv.addEventListener('click', (e) => {
        if (!e.target.classList.contains('customer-value')) {
            window.location.href = `/view-machine.html?id=${draft.id}`;
        }
    });

    return draftDiv;
}

// Обновление отображения заказчика в элементе списка
function updateDraftCustomerDisplay(draftElement, customerData) {
    const customerElement = draftElement.querySelector('.customer-value');
    if (!customerElement) return;

    // Обновляем текст, если есть данные заказчика
    if (customerData && customerData.customerName) {
        customerElement.textContent = customerData.customerName;
    }

    // Убираем все классы для кликабельности
    customerElement.classList.remove('customer-clickable');
    customerElement.classList.remove('customer-has-info');

    // Убираем обработчик клика
    customerElement.onclick = null;
    customerElement.style.cursor = 'default';

    // Если есть дополнительные данные, просто показываем их
    if (customerData && (
        customerData.productionAddress ||
        customerData.hotelName ||
        customerData.contactPerson ||
        customerData.contactPhone
    )) {
        // Добавляем только индикатор наличия информации
        customerElement.classList.add('customer-has-info');

        // Создаем текст для всплывающей подсказки
        let tooltipText = customerData.customerName || customerElement.textContent;

        if (customerData.productionAddress) {
            tooltipText += `\n🏭 ${customerData.productionAddress}`;
        }

        if (customerData.hotelName) {
            tooltipText += `\n🏨 ${customerData.hotelName}`;
            if (customerData.hotelAddress) {
                tooltipText += ` (${customerData.hotelAddress})`;
            }
        }

        if (customerData.contactPerson) {
            tooltipText += `\n👤 ${customerData.contactPerson}`;
        }

        if (customerData.contactPhone) {
            tooltipText += `\n📞 ${customerData.contactPhone}`;
        }

        if (customerData.contactEmail) {
            tooltipText += `\n📧 ${customerData.contactEmail}`;
        }

        customerElement.title = tooltipText;
    } else {
        // Убираем title если нет доп. информации
        customerElement.title = '';
    }
}

// Глобальная функция для очистки поиска
window.clearSearch = function() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearch');

    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
        searchInput.dispatchEvent(new Event('input'));
    }

    if (clearBtn) {
        clearBtn.classList.remove('visible');
    }
}