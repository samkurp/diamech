// Конфигурация
const API_BASE = '/api';
const FIELD_DEPENDENCIES = {
    'СП': {
        disabledFields: ['angleSensor', 'angleSensorNumber', 'rightVibrationSensor',
                       'rightSensitivity', 'rightSensorNumber', 'signalProcessor',
                       'signalProcessorNumber']
    }
};

// Состояние приложения
const appState = {
    isFormValid: false,
    hasImages: false,
    currentDraft: null,
    isViewMode: false,
    currentImages: []
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    initForm();
    setupImagePreview();
    setupImageModal();
    loadDraftFromURL();
    setupEventListeners();
});

// Инициализация формы
function initForm() {
    // Настройка переключателей секций
    setupSectionToggle('driveSystemToggle', 'driveSystemSection', [
        'driveType', 'driveNumber', 'brakeResistor', 'resistorCount'
    ]);

    setupSectionToggle('electricMotorToggle', 'electricMotorSection', [
        'electricMotor', 'EnginePower', 'motorNumber'
    ]);

    setupSectionToggle('sensorsToggle', 'sensorsSection', [
        'angleSensor', 'angleSensorNumber', 'speedSensorNumber'
    ]);

    // Настройка радиокнопок
    setupRadioButtons();

    // Настройка зависимостей полей
    setupFieldDependencies();

    // Настройка поля даты - УБИРАЕМ ОГРАНИЧЕНИЯ
    const shippingDateInput = document.getElementById('shippingDate');
    if (shippingDateInput) {
        // Убираем атрибут min, чтобы можно было выбрать любую дату
        shippingDateInput.removeAttribute('min');
        
        // Устанавливаем значение по умолчанию (текущая дата + 30 дней)
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 30);
        shippingDateInput.value = defaultDate.toISOString().split('T')[0];
    }

    // Инициализация стилей
    initializeFieldStyles();
    updateSubmitButton();
}

// Настройка событий
function setupEventListeners() {
    const form = document.getElementById('machineForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }

    const fields = document.querySelectorAll('input, select, textarea');
    fields.forEach(field => {
        if (field.type !== 'file') {
            field.addEventListener('input', handleFieldChange);
            field.addEventListener('change', handleFieldChange);
        }
    });

    const saveBtn = document.querySelector('.save-draft-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveDraft);
    }

    const machineTypeSelect = document.getElementById('machineType');
    if (machineTypeSelect) {
        machineTypeSelect.addEventListener('change', handleMachineTypeChange);
    }
}

// Обработчики событий
function handleFieldChange(e) {
    updateFieldBorderColor(e.target);
    updateSubmitButton();

    if (e.target.name === 'machineType') {
        handleMachineTypeChange();
    }
}

function handleMachineTypeChange() {
    const machineType = document.getElementById('machineType').value;
    const config = FIELD_DEPENDENCIES[machineType];

    Object.values(FIELD_DEPENDENCIES).flatMap(c => c.disabledFields || [])
        .forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.disabled = false;
                field.style.opacity = '1';
                field.style.cursor = 'auto';
            }
        });

    if (config && config.disabledFields) {
        config.disabledFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.disabled = true;
                field.style.opacity = '0.6';
                field.style.cursor = 'not-allowed';

                if (field.tagName === 'SELECT' && !field.value) {
                    field.value = 'Нет';
                }
            }
        });
    }

    updateSubmitButton();
}

// ОСНОВНОЙ ОБРАБОТЧИК - ФОРМИРОВАНИЕ ПРОТОКОЛА И СКАЧИВАНИЕ АРХИВА
async function handleFormSubmit(e) {
    e.preventDefault();

    if (!validateForm(false)) {
        showStatus('❌ Заполните все обязательные поля и загрузите изображения', 'error');
        return;
    }

    const status = showLoading('📦 Формирование протокола и подготовка архива...');

    try {
        const formData = new FormData(e.target);

        // Добавляем состояние переключателей
        const toggles = ['driveSystemToggle', 'electricMotorToggle', 'sensorsToggle'];
        toggles.forEach(toggleId => {
            const toggle = document.getElementById(toggleId);
            if (toggle) {
                formData.append(toggleId, toggle.checked.toString());
            }
        });

        // Добавляем ID черновика если есть
        if (appState.currentDraft) {
            formData.append('draft_id', appState.currentDraft);
        }

        // Отправляем запрос на генерацию протокола и получение архива
        const response = await fetch(`${API_BASE}/generate-protocol`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ошибка сервера: ${response.status} - ${errorText || response.statusText}`);
        }

        // Получаем имя файла из заголовков
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'protocol_package.zip';
        
        if (contentDisposition) {
            const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (match && match[1]) {
                filename = match[1].replace(/['"]/g, '');
            }
        }

        // Скачиваем ZIP архив
        const blob = await response.blob();
        
        // Проверяем, что это ZIP архив
        if (!blob.type.includes('zip') && !filename.endsWith('.zip')) {
            const text = await blob.text();
            try {
                const errorData = JSON.parse(text);
                throw new Error(errorData.error || 'Не удалось создать архив');
            } catch {
                throw new Error('Получен некорректный формат файла');
            }
        }

        // Инициируем скачивание
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showNotification(`✅ Архив "${filename}" успешно загружен`, 'success');

        // Сохраняем черновик после успешной генерации протокола
        if (!appState.currentDraft) {
            await autoSaveDraft(formData);
        }

        // Сброс формы
        e.target.reset();
        document.getElementById('imagePreview').innerHTML = '';
        appState.currentImages = [];
        appState.currentDraft = null;
        appState.hasImages = false;

        initializeFieldStyles();
        updateSubmitButton();

        window.history.replaceState({}, document.title, window.location.pathname);

        // ОТКРЫВАЕМ ГЛАВНУЮ СТРАНИЦУ ПОСЛЕ СКАЧИВАНИЯ
        setTimeout(() => {
            window.location.href = '/';
        }, 1500);

    } catch (error) {
        console.error('Ошибка при формировании протокола:', error);
        showStatus(`❌ Ошибка: ${error.message}`, 'error');
    } finally {
        status.remove();
    }
}

// Автосохранение черновика
async function autoSaveDraft(formData) {
    try {
        const response = await fetch(`${API_BASE}/save-draft`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            console.log('✅ Черновик автоматически сохранен:', result.draft_id);
            appState.currentDraft = result.draft_id;
            
            // Проверяем статус для перехода
            const machineStatus = formData.get('machineStatus');
            if (machineStatus === 'Отгружен') {
                setTimeout(() => {
                    window.location.href = '/static/shipped.html';
                }, 1500);
            }
        }
    } catch (error) {
        console.error('❌ Ошибка автосохранения:', error);
    }
}

// Валидация
function validateForm(forDraft = false) {
    let isValid = true;

    const workTypeSelected = document.querySelector('input[name="workType"]:checked');
    if (!workTypeSelected) {
        document.getElementById('workTypeError').style.display = 'block';
        document.getElementById('workTypeGroup').classList.add('invalid');
        isValid = false;
    }

    const requiredFields = [
        'machineType',
        'liftingCapacity',
        'serialNumber',
        'customer',
        'machineStatus'
    ];

    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field && !field.value.trim()) {
            field.style.borderColor = '#ef4444';
            isValid = false;
        }
    });

    // УБИРАЕМ ПРОВЕРКУ ДАТЫ ОТГРУЗКИ - теперь можно любую дату

    // Для финальной отправки проверяем наличие изображений
    if (!forDraft) {
        const fileInput = document.getElementById('images');
        if (!fileInput.files || fileInput.files.length === 0) {
            fileInput.style.borderColor = '#ef4444';
            isValid = false;
        }
    }

    return isValid;
}

function validateRadioButtons() {
    const selected = document.querySelector('input[name="workType"]:checked');
    const errorElement = document.getElementById('workTypeError');
    const radioGroup = document.getElementById('workTypeGroup');

    if (!selected) {
        errorElement.style.display = 'block';
        radioGroup.classList.add('invalid');
        return false;
    } else {
        errorElement.style.display = 'none';
        radioGroup.classList.remove('invalid');
        return true;
    }
}

// Сохранение черновика
async function saveDraft() {
    if (!validateForm(true)) {
        showStatus('❌ Заполните все обязательные поля перед сохранением', 'error');
        return;
    }

    const status = showLoading('💾 Сохранение черновика...');

    try {
        const formData = new FormData(document.getElementById('machineForm'));

        const toggles = ['driveSystemToggle', 'electricMotorToggle', 'sensorsToggle'];
        toggles.forEach(toggleId => {
            const toggle = document.getElementById(toggleId);
            if (toggle) {
                formData.append(toggleId, toggle.checked.toString());
            }
        });

        const response = await fetch(`${API_BASE}/save-draft`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            // Показываем красивое уведомление
            showNotification('✅ Черновик успешно сохранен!', 'success');
            
            appState.currentDraft = result.draft_id;

            const url = new URL(window.location);
            url.searchParams.set('draft', result.draft_id);
            window.history.replaceState({}, '', url);

            // Проверяем статус - если "Отгружен", переходим на страницу отгруженных
            const machineStatus = document.getElementById('machineStatus')?.value;
            if (machineStatus === 'Отгружен') {
                setTimeout(() => {
                    window.location.href = '/static/shipped.html';
                }, 1500);
            } else {
                setTimeout(() => {
                    window.location.href = '/';
                }, 1500);
            }
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        showStatus(`❌ Ошибка сохранения: ${error.message}`, 'error');
    } finally {
        status.remove();
    }
}

// Загрузка черновика из URL
async function loadDraftFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const draftId = urlParams.get('draft');
    const viewMode = urlParams.get('view');

    if (draftId) {
        appState.currentDraft = draftId;
        appState.isViewMode = viewMode === 'true';

        const status = showLoading('📥 Загрузка черновика...');

        try {
            const response = await fetch(`${API_BASE}/drafts/${draftId}`);
            const result = await response.json();

            if (result.success) {
                await populateForm(result.draft);

                if (appState.isViewMode) {
                    disableFormForViewMode();
                }

                showStatus(`✅ Черновик "${result.draft.display_name}" загружен`, 'success');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            showStatus(`❌ Ошибка загрузки: ${error.message}`, 'error');
        } finally {
            status.remove();
        }
    }
}

async function populateForm(draft) {
    const data = draft.data || {};

    if (data.machineType) {
        document.getElementById('machineType').value = data.machineType;
    }

    Object.keys(data).forEach(fieldName => {
        const field = document.querySelector(`[name="${fieldName}"]`);
        if (field) {
            if (field.type === 'radio') {
                const radio = document.querySelector(`[name="${fieldName}"][value="${data[fieldName]}"]`);
                if (radio) radio.checked = true;
            } else if (field.type === 'checkbox') {
                field.checked = data[fieldName] === 'true' || data[fieldName] === true;
            } else if (field.type === 'date') {
                if (data[fieldName]) {
                    const date = new Date(data[fieldName]);
                    if (!isNaN(date.getTime())) {
                        field.valueAsDate = date;
                    } else {
                        field.value = data[fieldName];
                    }
                }
            } else {
                if (data[fieldName] !== undefined && data[fieldName] !== null) {
                    field.value = data[fieldName];
                }
            }
        }
    });

    const toggles = ['driveSystemToggle', 'electricMotorToggle', 'sensorsToggle'];
    toggles.forEach(toggleId => {
        const toggle = document.getElementById(toggleId);
        if (toggle) {
            const toggleValue = data[toggleId];
            if (toggleValue !== undefined) {
                toggle.checked = toggleValue === 'true' || toggleValue === true;
            }
            const event = new Event('change');
            toggle.dispatchEvent(event);
        }
    });

    setTimeout(() => {
        handleMachineTypeChange();

        Object.keys(data).forEach(fieldName => {
            if (data[fieldName] === 'Нет') {
                const field = document.getElementById(fieldName);
                if (field && field.tagName === 'SELECT') {
                    field.value = 'Нет';
                }
            }
        });
    }, 100);

    if (draft.image_files && draft.image_files.length > 0) {
        await loadDraftImages(draft.id, draft.image_files);
    }

    initializeFieldStyles();
    updateSubmitButton();
}

async function loadDraftImages(draftId, imageFiles) {
    const previewContainer = document.getElementById('imagePreview');
    if (!previewContainer) return;

    previewContainer.innerHTML = '';

    const dataTransfer = new DataTransfer();
    appState.currentImages = [];

    for (const filename of imageFiles) {
        try {
            const img = document.createElement('img');
            img.className = 'preview-image';
            img.src = `${API_BASE}/drafts/${draftId}/images/${filename}`;
            img.alt = filename;
            img.dataset.filename = filename;

            previewContainer.appendChild(img);
            appState.currentImages.push(img);

            const response = await fetch(img.src);
            const blob = await response.blob();
            const file = new File([blob], filename, { type: blob.type });
            dataTransfer.items.add(file);
        } catch (error) {
            console.error(`Ошибка загрузки изображения:`, error);
        }
    }

    const fileInput = document.getElementById('images');
    if (fileInput) {
        fileInput.files = dataTransfer.files;
        appState.hasImages = fileInput.files.length > 0;
    }

    updateSubmitButton();
}

// Утилиты
function setupSectionToggle(toggleId, sectionId, fields) {
    const toggle = document.getElementById(toggleId);
    const section = document.getElementById(sectionId);

    if (!toggle || !section) return;

    const updateSection = function() {
        const isEnabled = this.checked;

        if (isEnabled) {
            section.classList.remove('section-disabled');
            fields.forEach(fieldId => {
                const field = document.getElementById(fieldId);
                if (field) {
                    field.disabled = false;
                    if (field.value === 'ОТСУТСТВУЕТ' || field.value === 'Нет') {
                        field.value = '';
                    }
                }
            });
        } else {
            section.classList.add('section-disabled');
            fields.forEach(fieldId => {
                const field = document.getElementById(fieldId);
                if (field) {
                    field.disabled = true;
                    if (!field.value || field.value === '' ||
                        field.value === 'ОТСУТСТВУЕТ' || field.value === 'Нет') {
                        field.value = field.tagName === 'SELECT' ? 'Нет' : 'ОТСУТСТВУЕТ';
                    }
                }
            });
        }

        updateSubmitButton();
    };

    toggle.addEventListener('change', updateSection);
    updateSection.call(toggle);
}

function setupRadioButtons() {
    const radios = document.querySelectorAll('input[name="workType"]');
    const errorElement = document.getElementById('workTypeError');

    radios.forEach(radio => {
        radio.addEventListener('change', function() {
            errorElement.style.display = 'none';
            document.getElementById('workTypeGroup').classList.remove('invalid');
            updateSubmitButton();
        });
    });
}

function setupFieldDependencies() {
    handleMachineTypeChange();
}

function initializeFieldStyles() {
    const fields = document.querySelectorAll('input, select, textarea');
    fields.forEach(field => updateFieldBorderColor(field));
}

function updateFieldBorderColor(field) {
    if (field.disabled) {
        field.style.borderColor = 'rgba(148, 163, 184, 0.2)';
        return;
    }

    if (field.hasAttribute('required')) {
        field.style.borderColor = field.value.trim() ? '#10b981' : '#ef4444';
    } else {
        field.style.borderColor = field.value.trim() ? '#3b82f6' : 'rgba(148, 163, 184, 0.3)';
    }
}

function updateSubmitButton() {
    const submitButton = document.querySelector('button[type="submit"]');
    if (!submitButton) return;

    const isRadioValid = validateRadioButtons();
    const fileInput = document.getElementById('images');
    const hasImages = fileInput && fileInput.files.length > 0;

    const requiredFields = [
        'machineType',
        'liftingCapacity',
        'serialNumber',
        'customer',
        'machineStatus'
    ];

    const allRequiredFilled = requiredFields.every(fieldId => {
        const field = document.getElementById(fieldId);
        return field && field.value.trim();
    });

    appState.isFormValid = isRadioValid && allRequiredFilled && hasImages;
    appState.hasImages = hasImages;

    if (appState.isFormValid) {
        submitButton.disabled = false;
        submitButton.style.opacity = '1';
        submitButton.style.cursor = 'pointer';
        submitButton.title = '';
    } else {
        submitButton.disabled = true;
        submitButton.style.opacity = '0.6';
        submitButton.style.cursor = 'not-allowed';

        if (!hasImages) {
            submitButton.title = 'Загрузите хотя бы одно изображение';
        } else if (!isRadioValid) {
            submitButton.title = 'Выберите тип работы';
        } else {
            submitButton.title = 'Заполните все обязательные поля';
        }
    }
}

// Работа с изображениями
function setupImagePreview() {
    const fileInput = document.getElementById('images');
    const previewContainer = document.getElementById('imagePreview');

    if (!fileInput || !previewContainer) return;

    fileInput.addEventListener('change', function() {
        previewContainer.innerHTML = '';
        appState.currentImages = [];

        if (this.files && this.files.length > 0) {
            Array.from(this.files).forEach((file, index) => {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    const img = document.createElement('img');
                    img.className = 'preview-image';
                    img.alt = file.name;
                    img.dataset.index = index;

                    reader.onload = function(e) {
                        img.src = e.target.result;
                        appState.currentImages.push(img);
                    };

                    reader.readAsDataURL(file);
                    previewContainer.appendChild(img);
                }
            });
        }

        updateSubmitButton();
    });
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

    if (!modal || !modalImg || !closeBtn) return;

    let currentIndex = 0;

    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('preview-image')) {
            const images = Array.from(document.querySelectorAll('.preview-image'));
            currentIndex = images.indexOf(e.target);
            openModal(images, currentIndex);
        }
    });

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) closeModal();
    });

    if (prevBtn) prevBtn.addEventListener('click', () => navigateModal(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => navigateModal(1));

    document.addEventListener('keydown', function(e) {
        if (modal.style.display === 'block') {
            if (e.key === 'ArrowLeft') navigateModal(-1);
            else if (e.key === 'ArrowRight') navigateModal(1);
            else if (e.key === 'Escape') closeModal();
        }
    });

    function openModal(images, index) {
        currentIndex = index;
        updateModalImage(images);
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        currentIndex = 0;
    }

    function navigateModal(direction) {
        const images = Array.from(document.querySelectorAll('.preview-image'));
        if (images.length === 0) return;

        currentIndex = (currentIndex + direction + images.length) % images.length;
        updateModalImage(images);
    }

    function updateModalImage(images) {
        if (images.length === 0 || currentIndex < 0 || currentIndex >= images.length) return;

        const img = images[currentIndex];
        modalImg.src = img.src;
        caption.textContent = img.alt || `Изображение ${currentIndex + 1}`;
        if (counter) counter.textContent = `${currentIndex + 1} / ${images.length}`;

        if (prevBtn) prevBtn.disabled = images.length <= 1;
        if (nextBtn) nextBtn.disabled = images.length <= 1;
    }
}

// Режим просмотра
function disableFormForViewMode() {
    const fields = document.querySelectorAll('input, select, textarea, button');
    const saveBtn = document.querySelector('.save-draft-btn');

    fields.forEach(field => {
        if (field.id !== 'machineStatus' && field.type !== 'submit') {
            field.disabled = true;
            field.style.opacity = '0.6';
            field.style.cursor = 'not-allowed';
        }
    });

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.style.opacity = '0.4';
        saveBtn.style.cursor = 'not-allowed';
    }

    showStatus('🔒 Режим просмотра. Можно изменить только статус станка.', 'warning');
}

// Вспомогательные функции
function showLoading(message) {
    const status = document.getElementById('statusMessage');
    if (!status) {
        const tempStatus = document.createElement('div');
        tempStatus.id = 'tempStatusMessage';
        tempStatus.innerHTML = `<div class="loading">${message}</div>`;
        tempStatus.style.cssText = `
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
        document.body.appendChild(tempStatus);

        return {
            remove: () => {
                if (tempStatus.parentNode) {
                    tempStatus.parentNode.removeChild(tempStatus);
                }
            }
        };
    }

    status.innerHTML = `<div class="loading">${message}</div>`;
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
    if (!status) return;

    status.innerHTML = message;
    status.className = `status-message ${type}`;
    status.style.display = 'block';

    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            status.style.display = 'none';
        }, 5000);
    }
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${type === 'success' ? '✅' : '❌'}</span>
            <span class="notification-text">${message}</span>
        </div>
    `;

    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        backdrop-filter: blur(10px);
        border: 1px solid ${type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'};
        max-width: 350px;
        font-family: 'Inter', sans-serif;
        font-weight: 500;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out forwards';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
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
