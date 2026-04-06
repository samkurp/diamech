# Модули фронтенда

Эта директория содержит модульную структуру JavaScript кода для системы учета станков.

## Структура модулей

### 1. `utils.js` - Общие утилиты
Базовые вспомогательные функции:
- `escapeHtml(text)` - Безопасное экранирование HTML
- `formatDate(dateString)` - Форматирование даты
- `formatDateTime(dateString)` - Форматирование даты и времени
- `showNotification(message, type, duration)` - Показ уведомлений
- `showStatus(message, type)` - Показ статуса
- `showLoading(message)` - Индикатор загрузки
- `debounce(func, wait)` - Debounce функция
- `extractNumberFromString(serial)` - Извлечение числа из строки
- `isValidEmail(email)` - Проверка email
- `roundTo(value, decimals)` - Округление
- `saveToLocalStorage(key, value)` - Сохранение в localStorage
- `loadFromLocalStorage(key, defaultValue)` - Загрузка из localStorage

### 2. `api.js` - HTTP клиент
Централизованное управление API запросами:
- `request(endpoint, options)` - Базовый HTTP запрос
- `get(endpoint, params)` - GET запрос
- `post(endpoint, data)` - POST запрос с JSON
- `postFormData(endpoint, formData)` - POST запрос с FormData
- `put(endpoint, data)` - PUT запрос
- `delete(endpoint)` - DELETE запрос
- `downloadFile(endpoint)` - Загрузка файла
- `triggerDownload(blob, filename)` - Скачивание файла

### 3. `form.js` - Управление формами
Работа с формами, валидация, сохранение черновиков:
- `initForm()` - Инициализация формы
- `setupEventListeners()` - Настройка событий
- `validateForm(forDraft)` - Валидация формы
- `saveDraft()` - Сохранение черновика
- `handleMachineTypeChange()` - Обработчик типа станка
- `updateSubmitButton()` - Обновление кнопки отправки
- `initializeFieldStyles()` - Инициализация стилей полей

### 4. `drafts.js` - Работа с черновиками
Управление списком черновиков:
- `loadActiveDrafts(containerId)` - Загрузка активных черновиков
- `sortDrafts(drafts)` - Сортировка черновиков
- `renderDrafts(containerId, drafts)` - Отрисовка списка
- `createDraftElement(draft)` - Создание элемента черновика
- `viewDraft(draftId)` - Переход к просмотру
- `showEmptyState(containerId, icon, title, message)` - Пустое состояние
- `loadCustomerData(draftId)` - Загрузка данных заказчика
- `updateCustomerDisplay(element, customerData)` - Обновление отображения

## Порядок подключения

```html
<!-- Модули приложения (порядок важен) -->
<script src="/static/js/modules/utils.js"></script>
<script src="/static/js/modules/api.js"></script>
<script src="/static/js/modules/form.js"></script>
<script src="/static/js/modules/drafts.js"></script>
<script src="/static/script.js"></script>
```

**Важно:** Модули должны подключаться в указанном порядке, так как они имеют зависимости:
- `api.js` зависит от `utils.js`
- `form.js` зависит от `utils.js` и `api.js`
- `drafts.js` зависит от `utils.js` и `api.js`
- `script.js` зависит от всех модулей

## Использование

### Пример использования Utils:
```javascript
Utils.showNotification('Операция выполнена!', 'success');
const escapedText = Utils.escapeHtml(userInput);
const formattedDate = Utils.formatDate('2024-01-15T10:30:00');
```

### Пример использования API:
```javascript
// GET запрос
const result = await API.get('/drafts', { status: 'active' });

// POST запрос с JSON
const result = await API.post('/drafts', { name: 'Станок 1' });

// POST запрос с FormData
const formData = new FormData();
formData.append('file', fileInput.files[0]);
const result = await API.postFormData('/upload', formData);

// Удаление
const result = await API.delete(`/drafts/${draftId}`);
```

### Пример использования FormManager:
```javascript
// Инициализация формы
FormManager.initForm();
FormManager.setupEventListeners();

// Валидация
if (FormManager.validateForm()) {
    // Форма валидна
}

// Сохранение черновика
await FormManager.saveDraft();
```

### Пример использования Drafts:
```javascript
// Загрузка активных черновиков
await Drafts.loadActiveDrafts('draftsList');

// Создание элемента черновика
const element = Drafts.createDraftElement(draftData);
```

## Преимущества модульной структуры

1. **Разделение ответственности** - каждый модуль отвечает за свою область
2. **Переиспользование кода** - общие функции в utils.js
3. **Упрощение тестирования** - модули можно тестировать отдельно
4. **Легкость поддержки** - проще найти и исправить ошибку
5. **Читаемость** - код организован логически
6. **Масштабируемость** - легко добавлять новые модули

## Добавление нового модуля

1. Создайте файл в `/workspace/static/js/modules/`
2. Используйте шаблон IIFE (Immediately Invoked Function Expression)
3. Экспортируйте публичный API через return
4. Добавьте JSDoc комментарии
5. Подключите модуль в нужные HTML страницы

```javascript
/**
 * mymodule.js - Описание модуля
 */
const MyModule = (function() {
    'use strict';
    
    // Приватные переменные и функции
    
    /**
     * Публичная функция
     */
    function publicFunction() {
        // ...
    }
    
    return {
        publicFunction
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MyModule;
}
```
