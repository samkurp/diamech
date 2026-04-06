/**
 * Optimized Frontend Utilities - Shared functions for all pages
 * Performance-focused with minimal DOM manipulation
 */
'use strict';

// Configuration
const API_BASE = '/api';

// Utility Functions
const Utils = {
    // Debounce function for search and input handling
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Escape HTML to prevent XSS
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Format date to Russian locale
    formatDate(dateString) {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            return isNaN(date.getTime()) ? dateString : date.toLocaleDateString('ru-RU', {
                day: '2-digit', month: '2-digit', year: 'numeric'
            });
        } catch { return dateString; }
    },

    // Format datetime to Russian locale
    formatDateTime(dateString) {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            return isNaN(date.getTime()) ? dateString : date.toLocaleDateString('ru-RU', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch { return dateString; }
    },

    // Show status message
    showStatus(message, type = 'info', duration = 3000) {
        const statusElement = document.getElementById('statusMessage');
        if (!statusElement) return;
        
        statusElement.textContent = message;
        statusElement.className = `status-message ${type}`;
        statusElement.style.display = 'block';
        
        if (duration > 0 && type !== 'info') {
            setTimeout(() => { statusElement.style.display = 'none'; }, duration);
        }
    },

    // Show loading indicator
    showLoading(message = 'Загрузка...') {
        const status = document.getElementById('statusMessage');
        if (status) {
            status.innerHTML = `<div class="loading"><span class="loading-spinner"></span>${Utils.escapeHtml(message)}</div>`;
            status.className = 'status-message info';
            status.style.display = 'block';
        }
        return { remove: () => { if (status) status.style.display = 'none'; } };
    },

    // Fetch wrapper with error handling
    async fetchJson(url, options = {}) {
        try {
            const response = await fetch(url, {
                ...options,
                headers: { 'Content-Type': 'application/json', ...options.headers }
            });
            const result = await response.json();
            return { ok: response.ok, status: response.status, ...result };
        } catch (error) {
            console.error('Fetch error:', error);
            throw error;
        }
    },

    // LocalStorage helpers
    storage: {
        get(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch { return defaultValue; }
        },
        set(key, value) {
            try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.warn('Storage error:', e); }
        },
        remove(key) { try { localStorage.removeItem(key); } catch (e) { console.warn('Storage error:', e); } }
    }
};

// Export for use in other scripts
window.Utils = Utils;
