/**
 * api.js - Модуль для работы с API
 * Централизованное управление HTTP-запросами
 */

const API = (function() {
    'use strict';

    const BASE_URL = '/api';

    /**
     * Выполнение HTTP-запроса
     * @param {string} endpoint - Эндпоинт
     * @param {Object} options - Опции запроса
     * @returns {Promise<Object>} - Результат запроса
     */
    async function request(endpoint, options = {}) {
        const url = `${BASE_URL}${endpoint}`;
        
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            // Проверяем Content-Type ответа
            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.includes('application/json')) {
                const result = await response.json();
                
                if (!response.ok) {
                    throw new Error(result.error || `Ошибка ${response.status}`);
                }
                
                return result;
            } else {
                // Для бинарных ответов (файлы)
                if (!response.ok) {
                    const text = await response.text();
                    throw new Error(text || `Ошибка ${response.status}`);
                }
                return { blob: await response.blob(), headers: response.headers };
            }
        } catch (error) {
            console.error(`API error (${options.method || 'GET'} ${endpoint}):`, error);
            throw error;
        }
    }

    /**
     * GET запрос
     */
    async function get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return request(url, { method: 'GET' });
    }

    /**
     * POST запрос с JSON
     */
    async function post(endpoint, data) {
        return request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * POST запрос с FormData
     */
    async function postFormData(endpoint, formData) {
        const config = {
            method: 'POST',
            body: formData
        };
        // Не устанавливаем Content-Type для FormData - браузер сделает это сам
        
        try {
            const response = await fetch(`${BASE_URL}${endpoint}`, config);
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || `Ошибка ${response.status}`);
            }
            
            return result;
        } catch (error) {
            console.error(`API error (POST FormData ${endpoint}):`, error);
            throw error;
        }
    }

    /**
     * PUT запрос
     */
    async function put(endpoint, data) {
        return request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE запрос
     */
    async function del(endpoint) {
        return request(endpoint, { method: 'DELETE' });
    }

    /**
     * Загрузка файла (GET с blob ответом)
     */
    async function downloadFile(endpoint) {
        try {
            const response = await fetch(`${BASE_URL}${endpoint}`);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || `Ошибка ${response.status}`);
            }
            
            const blob = await response.blob();
            const filename = getFilenameFromHeader(response.headers.get('Content-Disposition'));
            
            return { blob, filename, headers: response.headers };
        } catch (error) {
            console.error(`Download error (${endpoint}):`, error);
            throw error;
        }
    }

    /**
     * Извлечение имени файла из заголовка Content-Disposition
     */
    function getFilenameFromHeader(contentDisposition) {
        if (!contentDisposition) return 'download';
        
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match && match[1]) {
            return match[1].replace(/['"]/g, '');
        }
        return 'download';
    }

    /**
     * Скачивание файла через создание ссылки
     */
    function triggerDownload(blob, filename) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }

    // Публичный API модуля
    return {
        request,
        get,
        post,
        put,
        delete: del,
        postFormData,
        downloadFile,
        triggerDownload
    };
})();

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
}
