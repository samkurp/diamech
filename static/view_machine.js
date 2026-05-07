// Конфигурация
const API_BASE = '/api';

// Состояние
let machineData = null;
let currentImages = [];
let currentImageIndex = 0;
let customerData = null;

// Список возможных статусов
const STATUS_OPTIONS = [
    { value: 'Сборка', label: 'Сборка', class: 'сборка' },
    { value: 'Собран', label: 'Собран', class: 'собран' },
    { value: 'На испытании', label: 'На испытании', class: 'на-испытании' },
    { value: 'Испытан', label: 'Испытан', class: 'испытан' },
    { value: 'На упаковке', label: 'На упаковке', class: 'на-упаковке' },
    { value: 'Упакован', label: 'Упакован', class: 'упакован' },
    { value: 'Отгружен', label: 'Отгружен', class: 'отгружен' }
];

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    loadMachineData();
    setupImageModal();
    setupCustomerModal();
});

// Загрузка данных станка
async function loadMachineData() {
    const urlParams = new URLSearchParams(window.location.search);
    const draftId = urlParams.get('id');

    if (!draftId) {
        showStatus('ID станка не указан', 'error');
        window.location.href = '/';
        return;
    }

    const status = showLoading('Загрузка данных...');

    try {
        const response = await fetch(`${API_BASE}/drafts/${draftId}`);
        const result = await response.json();

        if (result.success) {
            machineData = result.draft;
            displayMachineData();
            setupNotesClickHandler();
            setupStatusClickHandler();
            loadMachineImages();
            await loadCustomerData();
            await loadRequestFileInfo();
            await loadSchemaFileInfo();
            document.title = machineData.display_name || 'Станок';

            // Проверяем статус и показываем/скрываем кнопки
            updateActionButtons();
        } else {
            throw new Error(result.error || 'Ошибка загрузки данных');
        }
    } catch (error) {
        showStatus(`❌ ${error.message}`, 'error');
        setTimeout(() => window.location.href = '/', 2000);
    } finally {
        status.remove();
    }
}

// Загрузка информации о схеме
async function loadSchemaFileInfo() {
    if (!machineData) return;

    try {
        const response = await fetch(`${API_BASE}/drafts/${machineData.id}/schema-info`);
        const result = await response.json();

        if (result.success && result.has_schema) {
            const schemaCard = document.getElementById('schemaFileStatus');
            if (schemaCard) {
                schemaCard.innerHTML = `📄 ${result.filename}`;
                schemaCard.classList.remove('empty');
                schemaCard.style.color = '#10b981';
                schemaCard.style.cursor = 'pointer';
                schemaCard.title = 'Нажмите для открытия схемы';

                const card = document.getElementById('schemaFileCard');
                if (card) {
                    card.onclick = () => openSchema();
                    card.style.cursor = 'pointer';
                }
            }
        } else {
            const schemaCard = document.getElementById('schemaFileStatus');
            if (schemaCard) {
                schemaCard.textContent = 'Не загружена';
                schemaCard.classList.add('empty');
                schemaCard.style.color = '#64748b';
            }
        }
    } catch (error) {
        console.log('Ошибка загрузки информации о схеме:', error);
        const schemaCard = document.getElementById('schemaFileStatus');
        if (schemaCard) {
            schemaCard.textContent = 'Не загружена';
            schemaCard.classList.add('empty');
        }
    }
}

// Функция открытия PDF схемы
function openSchema() {
    if (!machineData) return;

    const url = `${API_BASE}/drafts/${machineData.id}/schema`;
    window.open(url, '_blank');
}

// Функция загрузки информации о заявке
async function loadRequestFileInfo() {
    if (!machineData) return;

    try {
        const response = await fetch(`${API_BASE}/drafts/${machineData.id}/request-file`);

        if (response.ok) {
            const requestCard = document.getElementById('requestFileStatus');
            if (requestCard) {
                requestCard.innerHTML = 'Нажмите для просмотра';
                requestCard.classList.remove('empty');
                requestCard.style.color = '#10b981';
                requestCard.style.cursor = 'pointer';

                const card = document.getElementById('requestFileCard');
                if (card) {
                    card.onclick = () => openRequestText();
                    card.style.cursor = 'pointer';
                }
            }
        } else if (response.status === 404) {
            const requestCard = document.getElementById('requestFileStatus');
            if (requestCard) {
                requestCard.textContent = 'Не загружена';
                requestCard.classList.add('empty');
                requestCard.style.color = '#64748b';
            }
        }
    } catch (error) {
        console.log('Ошибка загрузки информации о заявке:', error);
    }
}

// Функция открытия текста заявки
async function openRequestText() {
    if (!machineData) return;

    const modal = document.getElementById('requestTextModal');
    const fileNameSpan = document.getElementById('requestFileName');
    const contentDiv = document.getElementById('requestTextContent');

    if (!modal) return;

    // Показываем модальное окно с загрузкой
    modal.style.display = 'block';
    contentDiv.innerHTML = 'Загрузка текста заявки...';
    document.body.style.overflow = 'hidden';

    try {
        const response = await fetch(`${API_BASE}/drafts/${machineData.id}/request-text`);
        const result = await response.json();

        if (result.success) {
            fileNameSpan.textContent = result.filename;

            // Форматируем текст для отображения
            let formattedText = result.text;

            // Заменяем переносы строк на <br>
            formattedText = formattedText.replace(/\n/g, '<br>');

            // Добавляем подсветку для заголовков
            formattedText = formattedText.replace(/^([А-Я][А-Я ]+[А-Я])/gm, '<strong style="color: #3b82f6;">$1</strong>');

            contentDiv.innerHTML = formattedText || 'Текст не найден';
        } else {
            contentDiv.innerHTML = '<div style="color: #ef4444;">Не удалось загрузить текст заявки. Возможно, файл не содержит текста или не был извлечен.</div>';
        }
    } catch (error) {
        console.error('Ошибка загрузки текста:', error);
        contentDiv.innerHTML = '<div style="color: #ef4444;">Ошибка загрузки текста заявки</div>';
    }
}

// Функция закрытия модального окна текста
function closeRequestTextModal() {
    const modal = document.getElementById('requestTextModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// Функция скачивания оригинального файла
async function downloadRequestFile() {
    if (!machineData) return;

    const url = `${API_BASE}/drafts/${machineData.id}/request-file`;
    window.open(url, '_blank');
}

// Обновление кнопок действий в зависимости от статуса
function updateActionButtons() {
    const restoreBtn = document.getElementById('restoreBtn');
    const editBtn = document.getElementById('editBtn');

    if (!machineData) return;

    const status = machineData.data?.machineStatus || machineData.machine_status;
    const isShipped = status === 'Отгружен';

    // Кнопка "Вернуть в работу" видна только для отгруженных станков
    if (restoreBtn) {
        restoreBtn.style.display = isShipped ? 'flex' : 'none';
    }

    // Кнопка "Редактировать" всегда видна
    if (editBtn) {
        editBtn.style.display = 'flex';
    }
}

// Переход к редактированию
function editDraft() {
    if (machineData && machineData.id) {
        window.location.href = `/add-draft?draft=${machineData.id}`;
    }
}

// Возврат станка в работу
async function restoreToWork() {
    if (!machineData) return;

    if (!confirm('Вернуть станок в работу? Статус будет изменен на "Сборка".')) {
        return;
    }

    const button = document.getElementById('restoreBtn');
    const originalText = button.innerHTML;

    button.disabled = true;
    button.innerHTML = '⏳ Обработка...';

    try {
        const formData = new FormData();
        formData.append('machineStatus', 'Сборка');

        const response = await fetch(`${API_BASE}/drafts/${machineData.id}`, {
            method: 'PUT',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            showStatus('✅ Станок возвращен в работу', 'success');

            // Обновляем статус на странице
            updateStatusDisplay('Сборка');

            // Обновляем кнопки
            updateActionButtons();

            // Перенаправляем через 1.5 секунды
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);

        } else {
            throw new Error(result.error);
        }

    } catch (error) {
        showStatus(`❌ Ошибка: ${error.message}`, 'error');
        button.disabled = false;
        button.innerHTML = originalText;
    }
}

// Загрузка данных заказчика
async function loadCustomerData() {
    if (!machineData) return;

    try {
        const response = await fetch(`${API_BASE}/drafts/${machineData.id}/customer`);
        const result = await response.json();

        if (result.success) {
            customerData = result.customer_data || {};
            // Обновляем отображение заказчика
            const customerElement = document.getElementById('customer');
            if (customerData.customerName && customerElement) {
                customerElement.textContent = customerData.customerName;
            }
        } else {
            const customerName = machineData.data?.customer || 'Не указан';
            customerData = {
                customerName: customerName,
                originalCustomer: customerName
            };
        }
    } catch (error) {
        console.log('Не удалось загрузить данные заказчика:', error);
        const customerName = machineData.data?.customer || 'Не указан';
        customerData = {
            customerName: customerName,
            originalCustomer: customerName
        };
    }
}

// Отображение данных станка
function displayMachineData() {
    if (!machineData) return;

    const data = machineData.data || {};

    // Заголовок
    const titleParts = machineData.display_name ? machineData.display_name.split(' ') : ['Станок'];
    document.getElementById('machineTitle').textContent = titleParts.slice(0, 2).join(' ');
    document.getElementById('machineSubtitle').textContent = titleParts.slice(2).join(' ') || 'Детальная информация';

    // Статус
    const status = data.machineStatus || 'Не указан';
    updateStatusDisplay(status);

    // Базовая информация
    document.getElementById('workType').textContent = data.workType || 'Не указан';

    // Заказчик
    const customerElement = document.getElementById('customer');
    customerElement.textContent = data.customer || 'Не указан';

    // Дата отгрузки
    const shippingDate = machineData.shipping_date || data.shippingDate || '';
    if (shippingDate) {
        try {
            const date = new Date(shippingDate);
            if (!isNaN(date.getTime())) {
                document.getElementById('shippingDate').textContent = date.toLocaleDateString('ru-RU');
                document.getElementById('shippingDate').classList.remove('empty');
            }
        } catch (e) {
            console.log('Ошибка форматирования даты:', e);
        }
    }

    // Приводная система
    const driveType = data.driveType || '';
    const driveNumber = data.driveNumber || '';
    document.getElementById('driveType').textContent = driveType || 'Не указано';
    if (driveNumber) {
        document.getElementById('driveNumber').textContent = driveNumber;
        document.getElementById('driveNumber').classList.remove('empty');
    }

    const electricMotor = data.electricMotor || '';
    const motorNumber = data.motorNumber || '';
    document.getElementById('electricMotor').textContent = electricMotor || 'Не указано';
    if (motorNumber) {
        document.getElementById('motorNumber').textContent = motorNumber;
        document.getElementById('motorNumber').classList.remove('empty');
    }

    // Датчики
    const angleSensor = data.angleSensor || '';
    const angleSensorNumber = data.angleSensorNumber || '';
    document.getElementById('angleSensor').textContent = angleSensor || 'Не указано';
    if (angleSensorNumber) {
        document.getElementById('angleSensorNumber').textContent = angleSensorNumber;
        document.getElementById('angleSensorNumber').classList.remove('empty');
    }

    const speedSensorNumber = data.speedSensorNumber || '';
    if (speedSensorNumber) {
        document.getElementById('speedSensorNumber').textContent = speedSensorNumber;
        document.getElementById('speedSensorNumber').classList.remove('empty');
    }

    // Датчики вибрации
    const leftVibrationSensor = data.leftVibrationSensor || '';
    const leftSensitivity = data.leftSensitivity || '';
    const leftSensorNumber = data.leftSensorNumber || '';
    document.getElementById('leftVibrationSensor').textContent = leftVibrationSensor || 'Не указано';
    if (leftSensitivity) {
        document.getElementById('leftSensitivity').textContent = leftSensitivity;
        document.getElementById('leftSensitivity').classList.remove('empty');
    }
    if (leftSensorNumber) {
        document.getElementById('leftSensorNumber').textContent = leftSensorNumber;
        document.getElementById('leftSensorNumber').classList.remove('empty');
    }

    const rightVibrationSensor = data.rightVibrationSensor || '';
    const rightSensitivity = data.rightSensitivity || '';
    const rightSensorNumber = data.rightSensorNumber || '';
    document.getElementById('rightVibrationSensor').textContent = rightVibrationSensor || 'Не указано';
    if (rightSensitivity) {
        document.getElementById('rightSensitivity').textContent = rightSensitivity;
        document.getElementById('rightSensitivity').classList.remove('empty');
    }
    if (rightSensorNumber) {
        document.getElementById('rightSensorNumber').textContent = rightSensorNumber;
        document.getElementById('rightSensorNumber').classList.remove('empty');
    }

    // Измерительное оборудование
    const measuringDevice = data.measuringDevice || '';
    const measuringDeviceNumber = data.measuringDeviceNumber || '';
    document.getElementById('measuringDevice').textContent = measuringDevice || 'Не указано';
    if (measuringDeviceNumber) {
        document.getElementById('measuringDeviceNumber').textContent = measuringDeviceNumber;
        document.getElementById('measuringDeviceNumber').classList.remove('empty');
    }

    const signalProcessor = data.signalProcessor || '';
    const signalProcessorNumber = data.signalProcessorNumber || '';
    document.getElementById('signalProcessor').textContent = signalProcessor || 'Не указано';
    if (signalProcessorNumber) {
        document.getElementById('signalProcessorNumber').textContent = signalProcessorNumber;
        document.getElementById('signalProcessorNumber').classList.remove('empty');
    }

    // Примечания
    const notes = data.notes || '';
    const notesElement = document.getElementById('notes');
    if (notes) {
        notesElement.textContent = notes;
        notesElement.classList.remove('empty');
    } else {
        notesElement.textContent = 'Примечаний нет';
        notesElement.classList.add('empty');
    }
}

// Обновление отображения статуса на странице
function updateStatusDisplay(status) {
    const statusElement = document.getElementById('machineStatus');
    if (!statusElement) return;

    statusElement.textContent = status;

    // Обновляем класс для стилизации
    const statusClassMap = {
        'Сборка': 'sborka',
        'Собран': 'sobran',
        'На испытании': 'na-ispytanii',
        'Испытан': 'ispytan',
        'На упаковке': 'na-upakovke',
        'Упакован': 'upakovan',
        'Отгружен': 'otgruzhen'
    };

    const className = statusClassMap[status] || 'sborka';

    // Удаляем старые классы статуса
    statusElement.classList.remove('sborka', 'sobran', 'na-ispytanii', 'ispytan', 'na-upakovke', 'upakovan', 'otgruzhen');
    statusElement.classList.add(className);

    // Обновляем стиль
    const styleMap = {
        'Сборка': { background: 'rgba(59, 130, 246, 0.3)', color: '#3b82f6', borderColor: 'rgba(59, 130, 246, 0.5)' },
        'Собран': { background: 'rgba(100, 116, 139, 0.3)', color: '#475569', borderColor: 'rgba(100, 116, 139, 0.5)' },
        'На испытании': { background: 'rgba(245, 158, 11, 0.3)', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.5)' },
        'Испытан': { background: 'rgba(16, 185, 129, 0.3)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.5)' },
        'На упаковке': { background: 'rgba(139, 92, 246, 0.3)', color: '#8b5cf6', borderColor: 'rgba(139, 92, 246, 0.5)' },
        'Упакован': { background: 'rgba(236, 72, 153, 0.3)', color: '#ec4899', borderColor: 'rgba(236, 72, 153, 0.5)' },
        'Отгружен': { background: 'rgba(156, 163, 175, 0.3)', color: '#9ca3af', borderColor: 'rgba(156, 163, 175, 0.5)' }
    };

    const style = styleMap[status];
    if (style) {
        statusElement.style.background = style.background;
        statusElement.style.color = style.color;
        statusElement.style.borderColor = style.borderColor;
    }
}

// Настройка модального окна заказчика
function setupCustomerModal() {
    const modal = document.getElementById('customerModal');
    const closeBtn = document.querySelector('.customer-modal-close');
    const cancelBtn = document.querySelector('.btn-cancel-customer');
    const form = document.getElementById('customerForm');

    if (!modal || !closeBtn || !cancelBtn || !form) return;

    closeBtn.addEventListener('click', closeCustomerModal);
    cancelBtn.addEventListener('click', closeCustomerModal);

    modal.addEventListener('click', function(event) {
        if (event.target === modal) {
            closeCustomerModal();
        }
    });

    form.addEventListener('submit', saveCustomerData);

    document.addEventListener('keydown', function(e) {
        if (modal.style.display === 'block' && e.key === 'Escape') {
            closeCustomerModal();
        }
    });
}

// Открытие модального окна заказчика
function openCustomerModal() {
    const modal = document.getElementById('customerModal');
    const form = document.getElementById('customerForm');

    if (!modal || !form) return;

    // Заполняем форму данными
    document.getElementById('customerName').value = customerData?.customerName ||
                                                  machineData?.data?.customer ||
                                                  '';

    document.getElementById('productionAddress').value = customerData?.productionAddress || '';
    document.getElementById('hotelName').value = customerData?.hotelName || '';
    document.getElementById('hotelAddress').value = customerData?.hotelAddress || '';
    document.getElementById('contactPerson').value = customerData?.contactPerson || '';
    document.getElementById('contactPhone').value = customerData?.contactPhone || '';
    document.getElementById('contactEmail').value = customerData?.contactEmail || '';
    document.getElementById('additionalInfo').value = customerData?.additionalInfo || '';

    // Показываем модальное окно
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    // Фокус на первое поле
    setTimeout(() => {
        document.getElementById('customerName').focus();
    }, 100);
}

// Закрытие модального окна заказчика
function closeCustomerModal() {
    const modal = document.getElementById('customerModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Сохранение данных заказчика
async function saveCustomerData(event) {
    event.preventDefault();

    const saveBtn = document.querySelector('.btn-save-customer');
    if (!saveBtn) return;

    const originalText = saveBtn.innerHTML;

    saveBtn.disabled = true;
    saveBtn.innerHTML = '⏳ Сохранение...';

    try {
        // Собираем данные из формы
        const newCustomerData = {
            customerName: document.getElementById('customerName').value.trim(),
            productionAddress: document.getElementById('productionAddress').value.trim(),
            hotelName: document.getElementById('hotelName').value.trim(),
            hotelAddress: document.getElementById('hotelAddress').value.trim(),
            contactPerson: document.getElementById('contactPerson').value.trim(),
            contactPhone: document.getElementById('contactPhone').value.trim(),
            contactEmail: document.getElementById('contactEmail').value.trim(),
            additionalInfo: document.getElementById('additionalInfo').value.trim(),
            updated_at: new Date().toISOString()
        };

        // Если не указано имя компании, используем оригинальное
        if (!newCustomerData.customerName && customerData?.originalCustomer) {
            newCustomerData.customerName = customerData.originalCustomer;
        }

        // Отправляем на сервер
        const response = await fetch(`${API_BASE}/drafts/${machineData.id}/customer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(newCustomerData)
        });

        const result = await response.json();

        if (result.success) {
            customerData = newCustomerData;
            closeCustomerModal();
            showStatus('✅ Данные заказчика сохранены', 'success');
        } else {
            throw new Error(result.error || 'Ошибка сохранения');
        }

    } catch (error) {
        showStatus(`❌ Ошибка: ${error.message}`, 'error');
        console.error('Error saving customer data:', error);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

// Загрузка изображений станка
async function loadMachineImages() {
    if (!machineData || !machineData.image_files || machineData.image_files.length === 0) {
        document.getElementById('noImages').style.display = 'block';
        return;
    }

    const imagesContainer = document.getElementById('machineImages');
    const noImages = document.getElementById('noImages');

    imagesContainer.innerHTML = '';
    currentImages = [];
    noImages.style.display = 'none';

    for (const filename of machineData.image_files) {
        const img = document.createElement('img');
        img.className = 'image-thumb-minimal';
        img.loading = 'lazy';
        img.src = `${API_BASE}/drafts/${machineData.id}/images/${filename}`;
        img.alt = filename;
        img.dataset.filename = filename;
        img.onclick = () => openImageModal(currentImages.indexOf(img));

        // Обработка ошибок загрузки
        img.onerror = () => {
            img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="150" height="100" viewBox="0 0 150 100"><rect width="150" height="100" fill="%231e293b"/><text x="50%" y="50%" fill="%2394a3b8" font-family="Arial" font-size="12" text-anchor="middle" dy=".3em">Ошибка загрузки</text></svg>';
        };

        imagesContainer.appendChild(img);
        currentImages.push(img);
    }
}

// Модальное окно для изображений
function setupImageModal() {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    const caption = document.getElementById('modalCaption');
    const closeBtn = modal.querySelector('.close');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const counter = document.getElementById('imageCounter');

    function openModal(index) {
        if (currentImages.length === 0 || index < 0 || index >= currentImages.length) return;

        currentImageIndex = index;
        const img = currentImages[index];
        modalImg.src = img.src;
        caption.textContent = img.alt || `Изображение ${index + 1}`;
        counter.textContent = `${index + 1} / ${currentImages.length}`;
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    function navigateModal(direction) {
        if (currentImages.length === 0) return;

        currentImageIndex = (currentImageIndex + direction + currentImages.length) % currentImages.length;
        openModal(currentImageIndex);
    }

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) closeModal();
    });

    prevBtn.addEventListener('click', () => navigateModal(-1));
    nextBtn.addEventListener('click', () => navigateModal(1));

    document.addEventListener('keydown', function(e) {
        const customerModal = document.getElementById('customerModal');
        if (customerModal && customerModal.style.display === 'block') {
            if (e.key === 'Escape') closeCustomerModal();
            return;
        }

        if (modal.style.display === 'block') {
            if (e.key === 'ArrowLeft') navigateModal(-1);
            else if (e.key === 'ArrowRight') navigateModal(1);
            else if (e.key === 'Escape') closeModal();
        }
    });

    window.openImageModal = openModal;
}

// Вспомогательные функции
function showLoading(message) {
    const status = document.getElementById('statusMessage');
    status.innerHTML = `<div>${message}</div>`;
    status.className = 'status-message info';
    status.style.display = 'block';

    return {
        remove: () => {
            status.style.display = 'none';
        }
    };
}

function showStatus(message, type = 'info') {
    const status = document.getElementById('statusMessage');
    status.innerHTML = `<span>${message}</span>`;
    status.className = `status-message ${type}`;
    status.style.display = 'block';

    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            status.style.display = 'none';
        }, 3000);
    }
}

// ========== ФУНКЦИИ ДЛЯ РАБОТЫ С ПРИМЕЧАНИЯМИ ==========

// Инициализация кликабельного блока примечаний
function setupNotesClickHandler() {
    const notesBlock = document.getElementById('notes');
    if (notesBlock) {
        notesBlock.style.cursor = 'pointer';
        notesBlock.style.transition = 'all 0.2s ease';

        // Добавляем иконку редактирования при наведении
        notesBlock.addEventListener('mouseenter', () => {
            if (!notesBlock.classList.contains('empty')) {
                notesBlock.style.backgroundColor = 'rgba(59, 130, 246, 0.05)';
            } else {
                notesBlock.style.backgroundColor = 'rgba(239, 68, 68, 0.05)';
            }
            notesBlock.title = 'Нажмите для редактирования';
        });

        notesBlock.addEventListener('mouseleave', () => {
            notesBlock.style.backgroundColor = '';
        });

        notesBlock.addEventListener('click', () => openNotesModal());
    }
}

// Открытие модального окна для редактирования примечаний
function openNotesModal() {
    const modal = document.getElementById('notesModal');
    const notesTextarea = document.getElementById('notesText');

    if (!modal || !notesTextarea) return;

    // Получаем текущие примечания
    const currentNotes = machineData?.data?.notes || '';
    notesTextarea.value = currentNotes;

    // Показываем модальное окно
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    // Устанавливаем фокус на текстовое поле
    setTimeout(() => {
        notesTextarea.focus();
        // Перемещаем курсор в конец текста
        notesTextarea.setSelectionRange(notesTextarea.value.length, notesTextarea.value.length);
    }, 100);

    // Настраиваем обработчик отправки формы
    const notesForm = document.getElementById('notesForm');
    const handleSubmit = async (e) => {
        e.preventDefault();
        await saveNotes();
        notesForm.removeEventListener('submit', handleSubmit);
    };

    // Удаляем старый обработчик, если есть, и добавляем новый
    notesForm.removeEventListener('submit', notesForm._submitHandler);
    notesForm._submitHandler = handleSubmit;
    notesForm.addEventListener('submit', notesForm._submitHandler);
}

// Закрытие модального окна примечаний
function closeNotesModal() {
    const modal = document.getElementById('notesModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// Сохранение примечаний
async function saveNotes() {
    const notesTextarea = document.getElementById('notesText');
    const newNotes = notesTextarea.value.trim();
    const saveBtn = document.querySelector('#notesForm .btn-save-customer');

    if (!saveBtn) return;

    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '⏳ Сохранение...';

    try {
        // Берём все текущие данные станка
        const currentData = machineData.data || {};

        // Создаём FormData для отправки
        const formData = new FormData();

        // Копируем все поля, кроме notes (чтобы избежать дублирования)
        for (const [key, value] of Object.entries(currentData)) {
            if (key !== 'notes' && value !== undefined && value !== null) {
                formData.append(key, value);
            }
        }
        // Добавляем новое значение notes (даже пустое)
        formData.append('notes', newNotes);

        // Обязательно передаём draft_id для upsert
        formData.append('draft_id', machineData.id);

        // Отправляем на универсальный эндпоинт save-draft
        const response = await fetch(`${API_BASE}/save-draft`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            // Обновляем локальные данные
            machineData.data.notes = newNotes;

            // Обновляем отображение на странице
            const notesElement = document.getElementById('notes');
            if (newNotes) {
                notesElement.textContent = newNotes;
                notesElement.classList.remove('empty');
            } else {
                notesElement.textContent = 'Примечаний нет';
                notesElement.classList.add('empty');
            }

            showStatus('✅ Примечания успешно сохранены', 'success');
            closeNotesModal();
        } else {
            throw new Error(result.error || 'Ошибка сохранения');
        }

    } catch (error) {
        console.error('Ошибка сохранения примечаний:', error);
        showStatus(`❌ Ошибка: ${error.message}`, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

// ========== ФУНКЦИИ ДЛЯ РАБОТЫ СО СТАТУСОМ ==========

// Инициализация кликабельного блока статуса
function setupStatusClickHandler() {
    const statusBlock = document.getElementById('machineStatus');
    if (statusBlock) {
        // Добавляем класс для кликабельности, если его нет
        if (!statusBlock.classList.contains('clickable-status')) {
            statusBlock.classList.add('clickable-status');
        }

        statusBlock.style.cursor = 'pointer';
        statusBlock.style.transition = 'all 0.2s ease';

        statusBlock.addEventListener('mouseenter', () => {
            statusBlock.style.transform = 'translateY(-1px)';
            statusBlock.style.opacity = '0.9';
        });

        statusBlock.addEventListener('mouseleave', () => {
            statusBlock.style.transform = '';
            statusBlock.style.opacity = '';
        });

        statusBlock.addEventListener('click', () => openStatusModal());
    }
}

// Получение описания статуса
function getStatusDescription(status) {
    const descriptions = {
        'Сборка': 'Оборудование находится в процессе сборки',
        'Собран': 'Оборудование собрано, ожидает проверки',
        'На испытании': 'Оборудование проходит испытания',
        'Испытан': 'Испытания пройдены успешно',
        'На упаковке': 'Оборудование готовится к упаковке',
        'Упакован': 'Оборудование упаковано',
        'Отгружен': 'Оборудование отгружено заказчику'
    };
    return descriptions[status] || status;
}

// Открытие модального окна для выбора статуса
function openStatusModal() {
    // Создаем модальное окно динамически
    let modal = document.getElementById('statusSelectorModal');

    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'statusSelectorModal';
        modal.className = 'customer-modal status-selector-modal';
        modal.innerHTML = `
            <div class="customer-modal-content">
                <div class="customer-modal-header">
                    <div class="customer-modal-title">
                        <span class="modal-icon">🔄</span>
                        <h3>Изменение статуса станка</h3>
                    </div>
                    <span class="customer-modal-close" onclick="closeStatusModal()">&times;</span>
                </div>
                <div class="customer-modal-body">
                    <div id="statusOptionsList" class="status-options-list"></div>
                </div>
                <div class="customer-modal-actions">
                    <button type="button" class="btn-cancel-customer" onclick="closeStatusModal()">✕ Отмена</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Закрытие по клику вне модального окна
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                closeStatusModal();
            }
        });

        // Закрытие по Escape
        document.addEventListener('keydown', function(e) {
            if (modal.style.display === 'block' && e.key === 'Escape') {
                closeStatusModal();
            }
        });
    }

    // Получаем текущий статус
    const currentStatus = machineData?.data?.machineStatus || machineData?.machine_status || 'Сборка';

    // Заполняем список статусов
    const optionsList = document.getElementById('statusOptionsList');
    optionsList.innerHTML = '';

    STATUS_OPTIONS.forEach(option => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'status-option';
        if (option.value === currentStatus) {
            optionDiv.classList.add('selected');
        }

        optionDiv.innerHTML = `
            <span class="status-badge status-value ${option.class}">${option.label}</span>
            <span class="status-name">${getStatusDescription(option.value)}</span>
        `;

        optionDiv.addEventListener('click', () => selectStatus(option.value));
        optionsList.appendChild(optionDiv);
    });

    // Показываем модальное окно
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

// Закрытие модального окна статуса
function closeStatusModal() {
    const modal = document.getElementById('statusSelectorModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// Выбор и сохранение нового статуса
async function selectStatus(newStatus) {
    if (!machineData) return;

    const currentStatus = machineData?.data?.machineStatus || machineData?.machine_status || 'Сборка';

    if (currentStatus === newStatus) {
        closeStatusModal();
        return;
    }

    // Подтверждение изменения статуса
    const confirmMessage = `Изменить статус станка с "${currentStatus}" на "${newStatus}"?`;
    if (!confirm(confirmMessage)) {
        return;
    }

    // Закрываем модальное окно выбора статуса
    closeStatusModal();

    // Показываем индикатор загрузки
    const statusElement = document.getElementById('machineStatus');
    const originalText = statusElement.innerHTML;
    statusElement.innerHTML = '⏳ Сохранение...';
    statusElement.style.opacity = '0.7';

    try {
        // Получаем все текущие данные станка
        const currentData = machineData.data || {};

        // Создаём FormData для отправки
        const formData = new FormData();

        // Копируем все поля
        for (const [key, value] of Object.entries(currentData)) {
            if (key !== 'machineStatus' && value !== undefined && value !== null && value !== '') {
                formData.append(key, value);
            }
        }

        // Добавляем новый статус
        formData.append('machineStatus', newStatus);

        // Обязательно передаём draft_id для upsert
        formData.append('draft_id', machineData.id);

        // Отправляем на универсальный эндпоинт save-draft
        const response = await fetch(`${API_BASE}/save-draft`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            // Обновляем локальные данные
            if (machineData.data) {
                machineData.data.machineStatus = newStatus;
            }
            machineData.machine_status = newStatus;

            // Обновляем отображение статуса на странице
            updateStatusDisplay(newStatus);

            showStatus(`✅ Статус изменён на "${newStatus}"`, 'success');

            // Если статус изменился на "Отгружен", обновляем кнопки
            if (newStatus === 'Отгружен') {
                updateActionButtons();
                // Предлагаем перейти на страницу отгруженных
                setTimeout(() => {
                    if (confirm('Станок отгружен. Перейти на страницу отгруженных станков?')) {
                        window.location.href = '/static/shipped.html';
                    }
                }, 1000);
            } else if (currentStatus === 'Отгружен' && newStatus !== 'Отгружен') {
                // Если возвращаем из отгруженных в работу
                updateActionButtons();
            }
        } else {
            throw new Error(result.error || 'Ошибка сохранения статуса');
        }

    } catch (error) {
        console.error('Ошибка сохранения статуса:', error);
        showStatus(`❌ Ошибка: ${error.message}`, 'error');
        // Восстанавливаем отображение
        updateStatusDisplay(currentStatus);
    } finally {
        statusElement.innerHTML = originalText;
        statusElement.style.opacity = '';
    }
}

// Функция для генерации протокола
async function generateProtocol() {
    if (!machineData) {
        showStatus('❌ Данные станка не загружены', 'error');
        return;
    }

    const status = showLoading('📦 Формирование протокола и подготовка архива...');

    try {
        // Создаем FormData и заполняем данными из machineData
        const formData = new FormData();
        const data = machineData.data || {};

        // Заполняем все поля формы
        Object.keys(data).forEach(key => {
            if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
                formData.append(key, data[key]);
            }
        });

        // Добавляем информацию о переключателях
        const toggles = ['driveSystemToggle', 'electricMotorToggle', 'sensorsToggle'];
        toggles.forEach(toggleId => {
            if (data[toggleId] !== undefined) {
                formData.append(toggleId, data[toggleId].toString());
            } else {
                // По умолчанию включаем все секции
                formData.append(toggleId, 'true');
            }
        });

        // Добавляем ID черновика
        formData.append('draft_id', machineData.id);

        // Проверяем наличие файла заявки
        try {
            const checkResponse = await fetch(`${API_BASE}/drafts/${machineData.id}/request-file`);
            if (checkResponse.ok) {
                // Если есть файл заявки, загружаем его и добавляем в formData
                const fileResponse = await fetch(`${API_BASE}/drafts/${machineData.id}/request-file`);
                const fileBlob = await fileResponse.blob();
                const fileName = fileResponse.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/["']/g, '') || 'request.docx';
                formData.append('requestFile', fileBlob, fileName);
            }
        } catch (error) {
            console.log('Файл заявки не найден:', error);
        }

        // Загружаем изображения
        if (machineData.image_files && machineData.image_files.length > 0) {
            for (const filename of machineData.image_files) {
                try {
                    const imgResponse = await fetch(`${API_BASE}/drafts/${machineData.id}/images/${filename}`);
                    const imgBlob = await imgResponse.blob();
                    formData.append('images', imgBlob, filename);
                } catch (error) {
                    console.error(`Ошибка загрузки изображения ${filename}:`, error);
                }
            }
        }

        // Отправляем запрос на генерацию протокола
        const response = await fetch(`${API_BASE}/generate-protocol`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ошибка сервера: ${response.status} - ${errorText || response.statusText}`);
        }

        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'protocol_package.zip';

        if (contentDisposition) {
            const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (match && match[1]) {
                filename = match[1].replace(/['"]/g, '');
            }
        }

        const blob = await response.blob();

        if (!blob.type.includes('zip') && !filename.endsWith('.zip')) {
            const text = await blob.text();
            try {
                const errorData = JSON.parse(text);
                throw new Error(errorData.error || 'Не удалось создать архив');
            } catch {
                throw new Error('Получен некорректный формат файла');
            }
        }

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showStatus(`✅ Архив "${filename}" успешно сформирован`, 'success');

    } catch (error) {
        console.error('Ошибка при формировании протокола:', error);
        showStatus(`❌ Ошибка: ${error.message}`, 'error');
    } finally {
        status.remove();
    }
}