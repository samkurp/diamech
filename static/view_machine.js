// Конфигурация
const API_BASE = '/api';

// Состояние
let machineData = null;
let currentImages = [];
let currentImageIndex = 0;
let customerData = null;

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
            loadMachineImages();
            await loadCustomerData();
            document.title = machineData.display_name || 'Станок';
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

// Загрузка данных заказчика
async function loadCustomerData() {
    if (!machineData) return;

    try {
        const response = await fetch(`${API_BASE}/drafts/${machineData.id}/customer`);
        const result = await response.json();

        if (result.success) {
            customerData = result.customer_data || {};
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
    document.getElementById('machineStatus').textContent = data.machineStatus || 'Не указан';

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
    if (notes) {
        document.getElementById('notes').textContent = notes;
        document.getElementById('notes').classList.remove('empty');
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
            document.getElementById('machineStatus').textContent = 'Сборка';
            document.getElementById('machineStatus').style.background = 'rgba(59, 130, 246, 0.3)';
            document.getElementById('machineStatus').style.color = '#3b82f6';
            document.getElementById('machineStatus').style.borderColor = 'rgba(59, 130, 246, 0.5)';

            // Прячем кнопку возврата
            button.style.display = 'none';

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
    status.innerHTML = `<div style="font-size: 0.9rem;">${message}</div>`;
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
    status.innerHTML = `<span style="font-size: 0.9rem;">${message}</span>`;
    status.className = `status-message ${type}`;
    status.style.display = 'block';

    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            status.style.display = 'none';
        }, 3000);
    }
}