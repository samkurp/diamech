/**
 * script.js - Главный файл инициализации приложения
 * Подключает модули и инициализирует приложение
 */

// Порядок загрузки: utils -> api -> form -> images -> main

(function() {
    'use strict';

    // Ждем загрузки DOM
    document.addEventListener('DOMContentLoaded', () => {
        // Проверяем, на какой странице мы находимся
        const path = window.location.pathname;
        
        // Инициализация в зависимости от страницы
        if (path === '/' || path === '/main.html') {
            initMainPage();
        } else if (path === '/add-draft' || path.includes('add_draft')) {
            initAddDraftPage();
        } else if (path.includes('view-machine')) {
            initViewMachinePage();
        } else if (path.includes('history')) {
            initHistoryPage();
        } else if (path.includes('shipped')) {
            initShippedPage();
        }
        
        // Общая инициализация для всех страниц
        initCommonFeatures();
    });

    /**
     * Инициализация главной страницы
     */
    function initMainPage() {
        console.log('Инициализация главной страницы...');
        if (typeof Drafts !== 'undefined') {
            Drafts.loadActiveDrafts();
        }
    }

    /**
     * Инициализация страницы добавления черновика
     */
    async function initAddDraftPage() {
        console.log('Инициализация страницы добавления черновика...');
        
        if (typeof FormManager !== 'undefined') {
            FormManager.initForm();
            FormManager.setupEventListeners();
            
            // Загрузка черновика если указан в URL
            const urlParams = new URLSearchParams(window.location.search);
            const draftId = urlParams.get('draft');
            const viewMode = urlParams.get('view');
            
            if (draftId) {
                await loadDraft(draftId, viewMode === 'true');
            }
        }
        
        // Настройка предпросмотра изображений
        if (typeof ImageManager !== 'undefined') {
            ImageManager.init();
        }
        
        // Обработка параметра delete
        handleDeleteParam();
    }

    /**
     * Загрузка черновика
     */
    async function loadDraft(draftId, isViewMode) {
        try {
            const status = Utils.showLoading('📥 Загрузка черновика...');
            const result = await API.get(`/drafts/${draftId}`);
            
            if (result.success) {
                populateForm(result.draft);
                
                if (isViewMode) {
                    disableFormForViewMode();
                }
                
                Utils.showStatus(`✅ Черновик "${result.draft.display_name}" загружен`, 'success');
                
                // Сохраняем текущий черновик в состоянии
                if (typeof FormManager !== 'undefined') {
                    FormManager.state.currentDraft = draftId;
                    FormManager.state.isViewMode = isViewMode;
                }
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            Utils.showStatus(`❌ Ошибка загрузки: ${error.message}`, 'error');
        } finally {
            // Скрываем индикатор загрузки
            const loadingEl = document.querySelector('.loading');
            if (loadingEl && loadingEl.parentElement) {
                loadingEl.parentElement.style.display = 'none';
            }
        }
    }

    /**
     * Заполнение формы данными черновика
     */
    function populateForm(draft) {
        const data = draft.data || {};
        
        // Устанавливаем тип станка
        if (data.machineType) {
            const machineTypeEl = document.getElementById('machineType');
            if (machineTypeEl) machineTypeEl.value = data.machineType;
        }
        
        // Заполняем поля
        Object.keys(data).forEach(fieldName => {
            const field = document.querySelector(`[name="${fieldName}"]`);
            if (!field) return;
            
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
        });
        
        // Обрабатываем переключатели секций
        ['driveSystemToggle', 'electricMotorToggle', 'sensorsToggle'].forEach(toggleId => {
            const toggle = document.getElementById(toggleId);
            if (toggle) {
                const toggleValue = data[toggleId];
                if (toggleValue !== undefined) {
                    toggle.checked = toggleValue === 'true' || toggleValue === true;
                }
                toggle.dispatchEvent(new Event('change'));
            }
        });
        
        // Обновляем зависимости полей
        setTimeout(() => {
            if (typeof FormManager !== 'undefined') {
                FormManager.handleMachineTypeChange();
            }
            
            // Устанавливаем значения "Нет" для select
            Object.keys(data).forEach(fieldName => {
                if (data[fieldName] === 'Нет') {
                    const field = document.getElementById(fieldName);
                    if (field && field.tagName === 'SELECT') {
                        field.value = 'Нет';
                    }
                }
            });
        }, 100);
        
        // Загружаем изображения если есть
        if (draft.image_files && draft.image_files.length > 0) {
            loadDraftImages(draft.id, draft.image_files);
        }
        
        // Загружаем информацию о файле заявки
        loadRequestFileInfo(draft.id);
        
        // Обновляем стили полей
        if (typeof FormManager !== 'undefined') {
            FormManager.initializeFieldStyles();
            FormManager.updateSubmitButton();
        }
    }

    /**
     * Загрузка изображений черновика
     */
    async function loadDraftImages(draftId, imageFiles) {
        const previewContainer = document.getElementById('imagePreview');
        if (!previewContainer) return;
        
        previewContainer.innerHTML = '';
        const dataTransfer = new DataTransfer();
        
        for (const filename of imageFiles) {
            try {
                const img = document.createElement('img');
                img.className = 'preview-image';
                img.src = `/api/drafts/${draftId}/images/${filename}`;
                img.alt = filename;
                img.dataset.filename = filename;
                
                previewContainer.appendChild(img);
                
                const response = await fetch(img.src);
                const blob = await response.blob();
                const file = new File([blob], filename, { type: blob.type });
                dataTransfer.items.add(file);
            } catch (error) {
                console.error(`Ошибка загрузки изображения ${filename}:`, error);
            }
        }
        
        const fileInput = document.getElementById('images');
        if (fileInput) {
            fileInput.files = dataTransfer.files;
            if (typeof FormManager !== 'undefined') {
                FormManager.state.hasImages = fileInput.files.length > 0;
                FormManager.updateSubmitButton();
            }
        }
    }

    /**
     * Загрузка информации о файле заявки
     */
    async function loadRequestFileInfo(draftId) {
        try {
            const response = await fetch(`/api/drafts/${draftId}/request-file`);
            
            if (response.ok) {
                const fileInfo = document.getElementById('requestFileInfo');
                const fileNameSpan = document.getElementById('currentRequestFileName');
                
                if (fileInfo) {
                    fileInfo.style.display = 'block';
                    if (fileNameSpan) {
                        fileNameSpan.textContent = 'Файл заявки загружен';
                    }
                }
                
                if (typeof FormManager !== 'undefined') {
                    FormManager.state.hasRequestFile = true;
                }
            }
        } catch (error) {
            console.log('Нет файла заявки:', error);
        }
    }

    /**
     * Отключение формы для режима просмотра
     */
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
        
        Utils.showStatus('🔒 Режим просмотра. Можно изменить только статус станка.', 'warning');
    }

    /**
     * Обработка параметра delete в URL
     */
    function handleDeleteParam() {
        const urlParams = new URLSearchParams(window.location.search);
        const draftId = urlParams.get('draft');
        const hasDelete = window.location.search.includes('delete');
        
        if (draftId && hasDelete && !window._deleteProcessed) {
            window._deleteProcessed = true;
            
            setTimeout(() => {
                if (confirm('⚠️ ВНИМАНИЕ!\n\nВы действительно хотите ПОЛНОСТЬЮ УДАЛИТЬ этот станок?\n\nБудут удалены:\n• Все данные станка\n• Все фотографии\n• Вся история изменений\n\nЭто действие НЕОБРАТИМО!')) {
                    deleteDraft(draftId);
                } else {
                    window.location.href = '/add-draft?draft=' + draftId;
                }
            }, 500);
        }
    }

    /**
     * Удаление черновика
     */
    async function deleteDraft(draftId) {
        const status = document.getElementById('statusMessage') || createStatusElement();
        
        status.innerHTML = '🔄 Удаление станка...';
        status.className = 'status-message info';
        status.style.display = 'block';
        
        try {
            const result = await API.post(`/drafts/${draftId}/delete?confirm=yes`, {});
            
            if (result.success) {
                status.innerHTML = '✅ Станок успешно удален! Перенаправление...';
                status.className = 'status-message success';
                
                setTimeout(() => {
                    window.location.href = '/';
                }, 2000);
            } else {
                throw new Error(result.error || 'Ошибка при удалении');
            }
        } catch (error) {
            console.error('Ошибка удаления:', error);
            status.innerHTML = `❌ Ошибка: ${error.message}`;
            status.className = 'status-message error';
            
            setTimeout(() => {
                if (confirm('Не удалось удалить станок. Вернуться к редактированию?')) {
                    window.location.href = '/add-draft?draft=' + draftId;
                } else {
                    window.location.href = '/';
                }
            }, 3000);
        }
    }

    /**
     * Создание элемента статуса
     */
    function createStatusElement() {
        const status = document.createElement('div');
        status.id = 'statusMessage';
        status.className = 'status-message';
        const container = document.querySelector('.container');
        if (container) {
            container.appendChild(status);
        }
        return status;
    }

    /**
     * Инициализация страницы просмотра станка
     */
    function initViewMachinePage() {
        console.log('Инициализация страницы просмотра станка...');
        // Здесь будет инициализация для view_machine.js
    }

    /**
     * Инициализация страницы истории
     */
    function initHistoryPage() {
        console.log('Инициализация страницы истории...');
        // Здесь будет инициализация для history.js
    }

    /**
     * Инициализация страницы отгруженных
     */
    function initShippedPage() {
        console.log('Инициализация страницы отгруженных...');
        // Здесь будет инициализация для shipped.js
    }

    /**
     * Общая инициализация для всех страниц
     */
    function initCommonFeatures() {
        // Проверка поддержки современных функций браузера
        if (!window.fetch) {
            alert('Ваш браузер не поддерживается. Пожалуйста, обновите браузер.');
            return;
        }
        
        console.log('Приложение инициализировано');
    }

})();
