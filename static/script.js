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
    currentImages: [],
    hasRequestFile: false,
    currentRequestFileName: null
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

    // Настройка файла заявки
    setupRequestFileHandlers();

    // Инициализация стилей
    initializeFieldStyles();
    updateSubmitButton();
}

// Настройка обработчиков файла заявки
function setupRequestFileHandlers() {
    const requestFileInput = document.getElementById('requestFile');
    const removeBtn = document.getElementById('removeRequestFile');

    if (requestFileInput) {
        requestFileInput.addEventListener('change', function(e) {
            const fileInfo = document.getElementById('requestFileInfo');
            const fileNameSpan = document.getElementById('currentRequestFileName');

            if (this.files && this.files.length > 0) {
                const file = this.files[0];
                if (fileInfo && fileNameSpan) {
                    fileNameSpan.textContent = file.name;
                    fileInfo.style.display = 'block';
                    appState.hasRequestFile = true;
                    appState.currentRequestFileName = file.name;
                }
            } else {
                if (fileInfo) fileInfo.style.display = 'none';
                appState.hasRequestFile = false;
                appState.currentRequestFileName = null;
            }
        });
    }

    if (removeBtn) {
        removeBtn.onclick = async () => {
            if (confirm('Удалить файл заявки?')) {
                if (appState.currentDraft) {
                    try {
                        const response = await fetch(`${API_BASE}/drafts/${appState.currentDraft}/request-file`, {
                            method: 'DELETE'
                        });

                        const result = await response.json();

                        if (result.success) {
                            showStatus('✅ Файл заявки удален', 'success');
                            const fileInfo = document.getElementById('requestFileInfo');
                            const requestFileInput = document.getElementById('requestFile');
                            if (fileInfo) fileInfo.style.display = 'none';
                            if (requestFileInput) requestFileInput.value = '';
                            appState.hasRequestFile = false;
                            appState.currentRequestFileName = null;
                        } else {
                            throw new Error(result.error);
                        }
                    } catch (error) {
                        showStatus(`❌ Ошибка удаления: ${error.message}`, 'error');
                    }
                } else {
                    const fileInfo = document.getElementById('requestFileInfo');
                    const requestFileInput = document.getElementById('requestFile');
                    if (fileInfo) fileInfo.style.display = 'none';
                    if (requestFileInput) requestFileInput.value = '';
                    appState.hasRequestFile = false;
                    appState.currentRequestFileName = null;
                }
            }
        };
    }
}

// Настройка событий
function setupEventListeners() {
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

        // Сначала сохраняем черновик
        const response = await fetch(`${API_BASE}/save-draft`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            const draftId = result.draft_id;

            // Если есть файл заявки, загружаем его отдельно
            const requestFile = document.getElementById('requestFile');
            if (requestFile && requestFile.files.length > 0) {
                const fileFormData = new FormData();
                fileFormData.append('requestFile', requestFile.files[0]);

                const uploadResponse = await fetch(`${API_BASE}/drafts/${draftId}/upload-request`, {
                    method: 'POST',
                    body: fileFormData
                });

                const uploadResult = await uploadResponse.json();
                if (!uploadResult.success) {
                    // Файл заявки не загружен
                } else {
                    // Файл заявки загружен
                }
            }

            showNotification('✅ Черновик успешно сохранен!');
            appState.currentDraft = draftId;

            const url = new URL(window.location);
            url.searchParams.set('draft', draftId);
            window.history.replaceState({}, '', url);

            setTimeout(() => {
                window.location.href = '/';
            }, 1500);
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

    // Загружаем информацию о файле заявки
    await loadRequestFileInfoForEdit(draft.id);

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
            // Ошибка загрузки изображения
        }
    }

    const fileInput = document.getElementById('images');
    if (fileInput) {
        fileInput.files = dataTransfer.files;
        appState.hasImages = fileInput.files.length > 0;
    }

    updateSubmitButton();
}

// Функция загрузки информации о заявке для редактирования
async function loadRequestFileInfoForEdit(draftId) {
    try {
        const response = await fetch(`${API_BASE}/drafts/${draftId}/request-file`);

        if (response.ok) {
            const fileInfo = document.getElementById('requestFileInfo');
            const fileNameSpan = document.getElementById('currentRequestFileName');
            const removeBtn = document.getElementById('removeRequestFile');

            // Показываем информацию о файле
            if (fileInfo) {
                fileInfo.style.display = 'block';
                const filename = response.headers.get('Content-Disposition');
                if (fileNameSpan) {
                    fileNameSpan.textContent = 'Файл заявки загружен';
                }
                appState.hasRequestFile = true;
            }

            // Обработчик удаления уже настроен в setupRequestFileHandlers
        }
    } catch (error) {
        // Нет файла заявки
        appState.hasRequestFile = false;
    }
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

// Функция для проверки параметра delete при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const draftId = urlParams.get('draft');
    const hasDelete = window.location.search.includes('delete');

    if (draftId && hasDelete && !window._deleteProcessed) {
        window._deleteProcessed = true;

        setTimeout(() => {
            if (confirm('⚠️ ВНИМАНИЕ!\n\nВы действительно хотите ПОЛНОСТЬЮ УДАЛИТЬ этот станок?\n\n' +
                       'Будут удалены:\n' +
                       '• Все данные станка\n' +
                       '• Все фотографии\n' +
                       '• Вся история изменений\n\n' +
                       'Это действие НЕОБРАТИМО!')) {

                deleteDraft(draftId);
            } else {
                window.location.href = '/add-draft?draft=' + draftId;
            }
        }, 500);
    }
});

// Функция удаления
async function deleteDraft(draftId) {
    const status = document.getElementById('statusMessage') || createStatusElement();

    status.innerHTML = '🔄 Удаление станка...';
    status.className = 'status-message info';
    status.style.display = 'block';

    try {
        const response = await fetch(`/api/drafts/${draftId}/delete?confirm=yes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (result.success) {
            status.innerHTML = '✅ Станок успешно удален! Перенаправление...';
            status.className = 'status-message success';
            status.style.display = 'block';

            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        } else {
            throw new Error(result.error || 'Ошибка при удалении');
        }
    } catch (error) {
        // Ошибка удаления

        status.innerHTML = `❌ Ошибка: ${error.message}`;
        status.className = 'status-message error';
        status.style.display = 'block';

        setTimeout(() => {
            if (confirm('Не удалось удалить станок. Вернуться к редактированию?')) {
                window.location.href = '/add-draft?draft=' + draftId;
            } else {
                window.location.href = '/';
            }
        }, 3000);
    }
}

// Вспомогательная функция для создания элемента статуса
function createStatusElement() {
    const status = document.createElement('div');
    status.id = 'statusMessage';
    status.className = 'status-message';
    document.querySelector('.container').appendChild(status);
    return status;
}