
// Конфигурация зависимостей полей от типа станка
const FIELD_DEPENDENCIES = {
    'СП': {
        hideSections: [], // Больше не скрываем секции
        setDefaultValues: {
            'angleSensor': 'Нет',
            'angleSensorNumber': 'Нет',
            'rightVibrationSensor': 'Нет',
            'rightSensitivity': 'Нет',
            'rightSensorNumber': 'Нет',
            'signalProcessor': 'Нет',
            'signalProcessorNumber': 'Нет'
        }
    },
    'default': {
        hideSections: [],
        setDefaultValues: {}
    }
};

// Базовый URL для API
const API_BASE = '/api';

// Переменная для отслеживания состояния формы
let isFormValid = false;
let hasImages = false;

// Функция для проверки заполнения всех полей
function checkAllFieldsFilled() {
    const allInputs = document.querySelectorAll('input, select, textarea');
    let allFilled = true;

    // Проверяем радиокнопки
    const workTypeSelected = document.querySelector('input[name="workType"]:checked');
    if (!workTypeSelected) {
        allFilled = false;
    }

    // Проверяем все видимые поля
    allInputs.forEach(field => {
        // Пропускаем скрытые поля и файловый ввод
        if (field.type === 'file' || field.style.display === 'none' ||
            field.closest('.form-section')?.style.display === 'none') {
            return;
        }

        // Проверяем заполнение поля
        if (field.hasAttribute('required') && !field.value.trim()) {
            allFilled = false;
        } else if (!field.hasAttribute('required') && field.value.trim() === '') {
            allFilled = false;
        }
    });

    // Проверяем загрузку изображений
    const fileInput = document.getElementById('images');
    hasImages = fileInput.files && fileInput.files.length > 0;

    return allFilled && hasImages;
}

// Функция для обновления состояния кнопки
function updateSubmitButton() {
    const submitButton = document.querySelector('button[type="submit"]');
    isFormValid = checkAllFieldsFilled();

    if (isFormValid) {
        submitButton.disabled = false;
        submitButton.style.opacity = '1';
        submitButton.style.cursor = 'pointer';
        submitButton.title = '';
    } else {
        submitButton.disabled = true;
        submitButton.style.opacity = '0.6';
        submitButton.style.cursor = 'not-allowed';
        submitButton.title = 'Заполните все поля и загрузите хотя бы одно изображение';
    }
}


// Функция для скрытия/показа секций
function toggleSectionsBasedOnMachineType() {
    const machineType = document.getElementById('machineType').value;
    const config = FIELD_DEPENDENCIES[machineType] || FIELD_DEPENDENCIES['default'];

    // Список всех полей для управления
    const allFieldsToManage = [
        'angleSensor', 'angleSensorNumber',
        'rightVibrationSensor', 'rightSensitivity', 'rightSensorNumber',
        'signalProcessor', 'signalProcessorNumber'
    ];

    // Сбрасываем все поля к активному состоянию
    allFieldsToManage.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.disabled = false;
            field.style.opacity = '1';
            field.style.cursor = 'auto';
        }
    });

    // Деактивируем нужные поля для типа СП
    if (machineType === 'СП') {
        Object.keys(config.setDefaultValues).forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.disabled = true;
                field.style.opacity = '0.6';
                field.style.cursor = 'not-allowed';
                field.value = config.setDefaultValues[fieldId];
            }
        });
    }

    // Обновляем состояние кнопки после изменения полей
    setTimeout(updateSubmitButton, 100);
}

// Функция для обновления цвета границы поля
function updateFieldBorderColor(field) {
    if (field.hasAttribute('required')) {
        if (field.value.trim()) {
            field.style.borderColor = '#48bb78'; // Зеленый если заполнено
        } else {
            field.style.borderColor = '#f56565'; // Красный если пустое
        }
    } else {
        field.style.borderColor = '#4a5568'; // Стандартный цвет для необязательных
    }

    // Обновляем состояние кнопки при изменении поля
    updateSubmitButton();
}

// Функция для инициализации стилей полей при загрузке
function initializeFieldStyles() {
    const allFields = document.querySelectorAll('input, select, textarea');

    allFields.forEach(field => {
        updateFieldBorderColor(field);
    });
}

// Обработка радиокнопок
function handleRadioButtons() {
    const radios = document.querySelectorAll('input[name="workType"]');
    const errorElement = document.getElementById('workTypeError');
    const radioGroup = document.getElementById('workTypeGroup');

    radios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.checked) {
                // Скрываем ошибку
                errorElement.style.display = 'none';
                radioGroup.classList.remove('invalid');

                // Добавляем визуальное выделение выбранного элемента
                document.querySelectorAll('.radio-item').forEach(item => {
                    item.style.borderColor = '#4a5568';
                    item.style.background = '#2d3748';
                });

                const selectedItem = this.closest('.radio-item');
                if (selectedItem) {
                    selectedItem.style.borderColor = '#3182ce';
                    selectedItem.style.background = 'linear-gradient(135deg, #2a5568 0%, #3182ce 100%)';
                }

                // Обновляем состояние кнопки
                updateSubmitButton();
            }
        });
    });
}

// Валидация радиокнопок
function validateRadioButtons() {
    const selectedWorkType = document.querySelector('input[name="workType"]:checked');
    const errorElement = document.getElementById('workTypeError');
    const radioGroup = document.getElementById('workTypeGroup');

    if (!selectedWorkType) {
        errorElement.style.display = 'block';
        radioGroup.classList.add('invalid');
        return false;
    } else {
        errorElement.style.display = 'none';
        radioGroup.classList.remove('invalid');
        return true;
    }
}

// Валидация всей формы
function validateForm() {
    let isValid = true;

    // Проверяем радиокнопки
    if (!validateRadioButtons()) {
        isValid = false;
    }

    // Проверяем обязательные поля (только указанные)
    const requiredFields = [
        'machineType',
        'liftingCapacity',
        'serialNumber'
    ];

    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field && !field.value.trim()) {
            field.style.borderColor = '#f56565';
            isValid = false;
        } else if (field && field.value.trim()) {
            field.style.borderColor = '#48bb78';
        }
    });

    // Проверяем загрузку изображений
    const fileInput = document.getElementById('images');
    if (!fileInput.files || fileInput.files.length === 0) {
        isValid = false;
        // Подсвечиваем поле загрузки файлов
        fileInput.style.borderColor = '#f56565';
    } else {
        fileInput.style.borderColor = '#48bb78';
    }

    return isValid;
}

// Предпросмотр изображений
function setupImagePreview() {
    const fileInput = document.getElementById('images');
    const previewContainer = document.getElementById('imagePreview');

    fileInput.addEventListener('change', function() {
        previewContainer.innerHTML = '';

        if (this.files && this.files.length > 0) {
            Array.from(this.files).forEach(file => {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    const img = document.createElement('img');
                    img.className = 'preview-image';

                    reader.onload = function(e) {
                        img.src = e.target.result;
                    };

                    reader.readAsDataURL(file);
                    previewContainer.appendChild(img);
                }
            });
        }

        // Обновляем состояние кнопки при изменении файлов
        updateSubmitButton();
    });
}

// Функция для сохранения черновика
// Функция для сохранения черновика
async function saveDraft() {
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.style.display = 'block';
    statusMessage.textContent = '💾 Сохранение черновика...';
    statusMessage.className = 'status-message';

    // Собираем данные формы
    const formData = new FormData(document.getElementById('machineForm'));

    try {
        const response = await fetch(`${API_BASE}/save-draft`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            statusMessage.textContent = '✅ Черновик успешно сохранен!';
            statusMessage.classList.add('success');

            // Предлагаем перейти к списку черновиков
            setTimeout(() => {
                if (confirm('Черновик сохранен! Хотите перейти к списку черновиков?')) {
                    window.location.href = '/drafts';
                }
            }, 1000);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        statusMessage.textContent = `❌ Ошибка сохранения черновика: ${error.message}`;
        statusMessage.classList.add('error');
    }
}

// Функция для загрузки черновика
async function loadDraft(draftId) {
    try {
        const response = await fetch(`${API_BASE}/drafts/${draftId}`);
        const result = await response.json();

        if (result.success) {
            const draft = result.draft;

            // Заполняем форму данными из черновика
            Object.keys(draft.data).forEach(fieldName => {
                const field = document.querySelector(`[name="${fieldName}"]`);
                if (field) {
                    if (field.type === 'radio') {
                        // Для радиокнопок
                        const radio = document.querySelector(`[name="${fieldName}"][value="${draft.data[fieldName]}"]`);
                        if (radio) {
                            radio.checked = true;
                        }
                    } else {
                        // Для остальных полей
                        field.value = draft.data[fieldName];
                    }
                }
            });

            // Загружаем изображения черновика
            if (draft.image_files && draft.image_files.length > 0) {
                await loadDraftImages(draftId, draft.image_files);
            } else {
                // Очищаем превью если нет изображений
                document.getElementById('imagePreview').innerHTML = '';
            }

            // Обновляем стили полей
            initializeFieldStyles();

            // Применяем логику для типа станка
            toggleSectionsBasedOnMachineType();

            showStatus(`✅ Черновик "${draft.display_name}" загружен`, 'success');

            // Обновляем состояние кнопки отправки
            updateSubmitButton();

            return true;
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        showStatus(`❌ Ошибка загрузки черновика: ${error.message}`, 'error');
        return false;
    }
}



// Функция для загрузки изображений черновика
async function loadDraftImages(draftId, imageFiles) {
    const previewContainer = document.getElementById('imagePreview');
    previewContainer.innerHTML = '';

    // Создаем объект FileList для хранения файлов
    const dataTransfer = new DataTransfer();

    for (const filename of imageFiles) {
        try {
            // Создаем элемент изображения для превью
            const img = document.createElement('img');
            img.className = 'preview-image';
            img.src = `${API_BASE}/drafts/${draftId}/images/${filename}`;
            img.alt = filename;

            // Добавляем в превью
            previewContainer.appendChild(img);

            // Загружаем файл и добавляем в FileList
            const response = await fetch(img.src);
            const blob = await response.blob();
            const file = new File([blob], filename, { type: blob.type });
            dataTransfer.items.add(file);

        } catch (error) {
            console.error(`Ошибка загрузки изображения ${filename}:`, error);
        }
    }

    // Обновляем файловый input
    const fileInput = document.getElementById('images');
    fileInput.files = dataTransfer.files;

    // Обновляем состояние кнопки
    updateSubmitButton();
}


// Проверяем статус станка
const machineStatus = document.getElementById('machineStatus');
if (!machineStatus || !machineStatus.value.trim()) {
    allFilled = false;
}


// Функция для показа статуса
function showStatus(message, type) {
    const statusElement = document.getElementById('statusMessage');
    statusElement.textContent = message;
    statusElement.className = `status-message ${type}`;
    statusElement.style.display = 'block';

    if (type === 'success') {
        setTimeout(() => {
            statusElement.style.display = 'none';
        }, 5000);
    }
}

// Основная функция отправки формы
document.getElementById('machineForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    // Дополнительная проверка перед отправкой
    if (!isFormValid) {
        showStatus('❌ Заполните все поля и загрузите хотя бы одно изображение', 'error');
        return;
    }

    const statusMessage = document.getElementById('statusMessage');
    statusMessage.style.display = 'block';
    statusMessage.textContent = '📤 Отправка данных на сервер...';
    statusMessage.className = 'status-message';

    // Валидация формы
    if (!validateForm()) {
        statusMessage.textContent = '❌ Пожалуйста, заполните все обязательные поля';
        statusMessage.classList.add('error');
        return;
    }

    // Создаем FormData для отправки файлов
    const formData = new FormData(this);

    // ✅ Добавляем ID черновика если он есть в URL
    const urlParams = new URLSearchParams(window.location.search);
    const draftId = urlParams.get('draft');
    if (draftId) {
        formData.append('draft_id', draftId);
    }

    try {
        const response = await fetch(`${API_BASE}/generate-protocol`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            let successMsg = `✅ Протокол находится по адресу Отделы/Экран/Маршрутные листы/${result.folder_name}`;
            if (result.saved_images && result.saved_images.length > 0) {
                successMsg += `\nСохранено изображений: ${result.saved_images.length}`;
            }

            statusMessage.textContent = successMsg;
            statusMessage.classList.add('success');

            // Очистка формы после успешной отправки
            this.reset();
            document.getElementById('imagePreview').innerHTML = '';
            toggleSectionsBasedOnMachineType();
            initializeFieldStyles();
            updateSubmitButton(); // Обновляем состояние кнопки

            // Убираем параметр draft из URL
            if (draftId) {
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        statusMessage.textContent = `❌ Ошибка: ${error.message}`;
        statusMessage.classList.add('error');
    }
});

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    handleRadioButtons();
    setupImagePreview();
    initializeFieldStyles();
    toggleSectionsBasedOnMachineType();

    // Проверяем параметры URL для загрузки черновика
    const urlParams = new URLSearchParams(window.location.search);
    const draftId = urlParams.get('draft');
    if (draftId) {
        loadDraft(draftId);
    }

    // Инициализируем состояние кнопки
    updateSubmitButton();

    document.getElementById('machineType').addEventListener('change', function() {
        toggleSectionsBasedOnMachineType();
        initializeFieldStyles();
        updateSubmitButton();
    });

    // Добавляем обработчики событий для всех полей формы
    const allFields = document.querySelectorAll('input, select, textarea');
    allFields.forEach(field => {
        if (field.type !== 'file') {
            field.addEventListener('input', function() {
                updateFieldBorderColor(this);
                updateSubmitButton();
            });

            field.addEventListener('change', function() {
                updateFieldBorderColor(this);
                updateSubmitButton();
            });
        }
    });

    const radios = document.querySelectorAll('input[name="workType"]');
    radios.forEach(radio => {
        radio.addEventListener('change', function() {
            validateRadioButtons();
            updateSubmitButton();
        });
    });
});