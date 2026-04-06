/**
 * form.js - Модуль для управления формами
 * Валидация, сохранение черновиков, работа с полями
 */

const FormManager = (function() {
    'use strict';

    // Конфигурация зависимостей полей
    const FIELD_DEPENDENCIES = {
        'СП': {
            disabledFields: [
                'angleSensor', 'angleSensorNumber', 'rightVibrationSensor',
                'rightSensitivity', 'rightSensorNumber', 'signalProcessor',
                'signalProcessorNumber'
            ]
        }
    };

    // Состояние формы
    let state = {
        isFormValid: false,
        hasImages: false,
        currentDraft: null,
        isViewMode: false,
        currentImages: [],
        hasRequestFile: false,
        currentRequestFileName: null
    };

    /**
     * Инициализация формы
     */
    function initForm() {
        setupSectionToggles();
        setupRadioButtons();
        setupFieldDependencies();
        setupRequestFileHandlers();
        initializeFieldStyles();
        updateSubmitButton();
    }

    /**
     * Настройка переключателей секций
     */
    function setupSectionToggles() {
        const toggles = [
            { toggleId: 'driveSystemToggle', sectionId: 'driveSystemSection', fields: ['driveType', 'driveNumber', 'brakeResistor', 'resistorCount'] },
            { toggleId: 'electricMotorToggle', sectionId: 'electricMotorSection', fields: ['electricMotor', 'EnginePower', 'motorNumber'] },
            { toggleId: 'sensorsToggle', sectionId: 'sensorsSection', fields: ['angleSensor', 'angleSensorNumber', 'speedSensorNumber'] }
        ];

        toggles.forEach(({ toggleId, sectionId, fields }) => {
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
                            if (['ОТСУТСТВУЕТ', 'Нет'].includes(field.value)) {
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
                            if (!field.value || field.value === '' || ['ОТСУТСТВУЕТ', 'Нет'].includes(field.value)) {
                                field.value = field.tagName === 'SELECT' ? 'Нет' : 'ОТСУТСТВУЕТ';
                            }
                        }
                    });
                }

                updateSubmitButton();
            };

            toggle.addEventListener('change', updateSection);
            updateSection.call(toggle);
        });
    }

    /**
     * Настройка радиокнопок
     */
    function setupRadioButtons() {
        const radios = document.querySelectorAll('input[name="workType"]');
        const errorElement = document.getElementById('workTypeError');

        radios.forEach(radio => {
            radio.addEventListener('change', function() {
                if (errorElement) errorElement.style.display = 'none';
                const radioGroup = document.getElementById('workTypeGroup');
                if (radioGroup) radioGroup.classList.remove('invalid');
                updateSubmitButton();
            });
        });
    }

    /**
     * Настройка зависимостей полей
     */
    function setupFieldDependencies() {
        handleMachineTypeChange();
        
        const machineTypeSelect = document.getElementById('machineType');
        if (machineTypeSelect) {
            machineTypeSelect.addEventListener('change', handleMachineTypeChange);
        }
    }

    /**
     * Обработчик изменения типа станка
     */
    function handleMachineTypeChange() {
        const machineTypeSelect = document.getElementById('machineType');
        if (!machineTypeSelect) return;

        const machineType = machineTypeSelect.value;
        const config = FIELD_DEPENDENCIES[machineType];

        // Сначала включаем все поля
        Object.values(FIELD_DEPENDENCIES).flatMap(c => c.disabledFields || [])
            .forEach(fieldId => {
                const field = document.getElementById(fieldId);
                if (field) {
                    field.disabled = false;
                    field.style.opacity = '1';
                    field.style.cursor = 'auto';
                }
            });

        // Затем отключаем нужные
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

    /**
     * Настройка обработчиков файла заявки
     */
    function setupRequestFileHandlers() {
        const requestFileInput = document.getElementById('requestFile');
        const removeBtn = document.getElementById('removeRequestFile');

        if (requestFileInput) {
            requestFileInput.addEventListener('change', function() {
                const fileInfo = document.getElementById('requestFileInfo');
                const fileNameSpan = document.getElementById('currentRequestFileName');

                if (this.files && this.files.length > 0) {
                    const file = this.files[0];
                    if (fileInfo && fileNameSpan) {
                        fileNameSpan.textContent = file.name;
                        fileInfo.style.display = 'block';
                        state.hasRequestFile = true;
                        state.currentRequestFileName = file.name;
                    }
                } else {
                    if (fileInfo) fileInfo.style.display = 'none';
                    state.hasRequestFile = false;
                    state.currentRequestFileName = null;
                }
            });
        }

        if (removeBtn) {
            removeBtn.onclick = async () => {
                if (!confirm('Удалить файл заявки?')) return;

                if (state.currentDraft) {
                    try {
                        const result = await API.delete(`/drafts/${state.currentDraft}/request-file`);
                        
                        if (result.success) {
                            Utils.showNotification('✅ Файл заявки удален', 'success');
                            const fileInfo = document.getElementById('requestFileInfo');
                            const requestFileInput = document.getElementById('requestFile');
                            if (fileInfo) fileInfo.style.display = 'none';
                            if (requestFileInput) requestFileInput.value = '';
                            state.hasRequestFile = false;
                            state.currentRequestFileName = null;
                        } else {
                            throw new Error(result.error);
                        }
                    } catch (error) {
                        Utils.showStatus(`❌ Ошибка удаления: ${error.message}`, 'error');
                    }
                } else {
                    const fileInfo = document.getElementById('requestFileInfo');
                    const requestFileInput = document.getElementById('requestFile');
                    if (fileInfo) fileInfo.style.display = 'none';
                    if (requestFileInput) requestFileInput.value = '';
                    state.hasRequestFile = false;
                    state.currentRequestFileName = null;
                }
            };
        }
    }

    /**
     * Инициализация стилей полей
     */
    function initializeFieldStyles() {
        const fields = document.querySelectorAll('input, select, textarea');
        fields.forEach(field => updateFieldBorderColor(field));
    }

    /**
     * Обновление цвета границы поля
     */
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

    /**
     * Проверка валидности формы
     */
    function validateForm(forDraft = false) {
        let isValid = true;

        // Проверка радиокнопок
        const workTypeSelected = document.querySelector('input[name="workType"]:checked');
        if (!workTypeSelected) {
            const errorEl = document.getElementById('workTypeError');
            const radioGroup = document.getElementById('workTypeGroup');
            if (errorEl) errorEl.style.display = 'block';
            if (radioGroup) radioGroup.classList.add('invalid');
            isValid = false;
        }

        // Проверка обязательных полей
        const requiredFields = ['machineType', 'liftingCapacity', 'serialNumber', 'customer', 'machineStatus'];
        
        requiredFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field && !field.value.trim()) {
                field.style.borderColor = '#ef4444';
                isValid = false;
            }
        });

        // Для финальной отправки проверяем изображения
        if (!forDraft) {
            const fileInput = document.getElementById('images');
            if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
                if (fileInput) fileInput.style.borderColor = '#ef4444';
                isValid = false;
            }
        }

        return isValid;
    }

    /**
     * Проверка валидности радиокнопок
     */
    function validateRadioButtons() {
        const selected = document.querySelector('input[name="workType"]:checked');
        const errorElement = document.getElementById('workTypeError');
        const radioGroup = document.getElementById('workTypeGroup');

        if (!selected) {
            if (errorElement) errorElement.style.display = 'block';
            if (radioGroup) radioGroup.classList.add('invalid');
            return false;
        } else {
            if (errorElement) errorElement.style.display = 'none';
            if (radioGroup) radioGroup.classList.remove('invalid');
            return true;
        }
    }

    /**
     * Обновление состояния кнопки отправки
     */
    function updateSubmitButton() {
        const submitButton = document.querySelector('button[type="submit"]');
        if (!submitButton) return;

        const isRadioValid = validateRadioButtons();
        const fileInput = document.getElementById('images');
        const hasImages = fileInput && fileInput.files.length > 0;

        const requiredFields = ['machineType', 'liftingCapacity', 'serialNumber', 'customer', 'machineStatus'];
        const allRequiredFilled = requiredFields.every(fieldId => {
            const field = document.getElementById(fieldId);
            return field && field.value.trim();
        });

        state.isFormValid = isRadioValid && allRequiredFilled && hasImages;
        state.hasImages = hasImages;

        if (state.isFormValid) {
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

    /**
     * Сохранение черновика
     */
    async function saveDraft() {
        if (!validateForm(true)) {
            Utils.showStatus('❌ Заполните все обязательные поля перед сохранением', 'error');
            return;
        }

        const status = Utils.showLoading('💾 Сохранение черновика...');

        try {
            const formData = new FormData(document.getElementById('machineForm'));

            // Добавляем состояние переключателей
            ['driveSystemToggle', 'electricMotorToggle', 'sensorsToggle'].forEach(toggleId => {
                const toggle = document.getElementById(toggleId);
                if (toggle) {
                    formData.append(toggleId, toggle.checked.toString());
                }
            });

            const result = await API.postFormData('/save-draft', formData);

            if (result.success) {
                const draftId = result.draft_id;

                // Загружаем файл заявки если есть
                const requestFile = document.getElementById('requestFile');
                if (requestFile && requestFile.files.length > 0) {
                    const fileFormData = new FormData();
                    fileFormData.append('requestFile', requestFile.files[0]);
                    
                    try {
                        await API.postFormData(`/drafts/${draftId}/upload-request`, fileFormData);
                    } catch (error) {
                        console.warn('Файл заявки не загружен:', error);
                    }
                }

                Utils.showNotification('✅ Черновик успешно сохранен!', 'success');
                state.currentDraft = draftId;

                // Обновляем URL
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
            Utils.showStatus(`❌ Ошибка сохранения: ${error.message}`, 'error');
        } finally {
            status.remove();
        }
    }

    /**
     * Настройка событий формы
     */
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
    }

    /**
     * Обработчик изменения поля
     */
    function handleFieldChange(e) {
        updateFieldBorderColor(e.target);
        updateSubmitButton();

        if (e.target.name === 'machineType') {
            handleMachineTypeChange();
        }
    }

    // Публичный API модуля
    return {
        state,
        initForm,
        setupEventListeners,
        validateForm,
        saveDraft,
        handleMachineTypeChange,
        updateSubmitButton,
        initializeFieldStyles
    };
})();

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FormManager;
}
