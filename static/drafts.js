/**
 * Optimized Drafts Management - main page functionality
 */
'use strict';

const STATUS_CONFIG = {
    'Сборка': { order: 1, class: 'сборка' },
    'Собран': { order: 2, class: 'собран' },
    'На испытании': { order: 3, class: 'на-испытании' },
    'Испытан': { order: 4, class: 'испытан' },
    'На упаковке': { order: 5, class: 'на-упаковке' },
    'Упакован': { order: 6, class: 'упакован' }
};

document.addEventListener('DOMContentLoaded', () => loadDrafts());

async function loadDrafts() {
    try {
        const response = await fetch('/api/drafts?status=active');
        const result = await response.json();
        const draftsList = document.getElementById('draftsList');
        
        if (!result.success || !result.drafts.length) {
            showEmptyState('📝', 'Нет станков в работе', 'Добавьте первый станок');
            return;
        }

        const activeDrafts = result.drafts.filter(d => d.machine_status !== 'Отгружен');
        
        if (!activeDrafts.length) {
            showEmptyState('📝', 'Нет активных станков', 'Все станки отгружены');
            return;
        }

        draftsList.innerHTML = '';
        sortDrafts(activeDrafts).forEach(draft => {
            draftsList.appendChild(createDraftElement(draft));
        });
    } catch (error) {
        Utils.showStatus(`Ошибка загрузки: ${error.message}`, 'error');
    }
}

function createDraftElement(draft) {
    const div = document.createElement('div');
    div.className = 'draft-item';
    div.onclick = () => viewDraft(draft.id);
    div.style.cursor = 'pointer';

    const statusClass = draft.machine_status ? draft.machine_status.toLowerCase().replace(/\s+/g, '-') : '';
    const shippingDate = draft.shipping_date ? formatDate(draft.shipping_date) : 'Не указана';

    div.innerHTML = `
        <div class="draft-header">
            <div class="draft-title">${Utils.escapeHtml(draft.display_name)}</div>
        </div>
        <div class="draft-info">
            <div class="info-item"><span class="info-label">Тип работы:</span><span class="info-value">${Utils.escapeHtml(draft.work_type)}</span></div>
            <div class="info-item"><span class="info-label">Заказчик:</span><span class="info-value">${Utils.escapeHtml(draft.customer || 'Не указан')}</span></div>
            <div class="info-item"><span class="info-label">Статус:</span><span class="info-value status-value ${statusClass}">${Utils.escapeHtml(draft.machine_status)}</span></div>
            <div class="info-item"><span class="info-label">Отгрузка:</span><span class="info-value">${Utils.escapeHtml(shippingDate)}</span></div>
        </div>`;
    return div;
}

function viewDraft(id) { window.location.href = `/view-machine.html?id=${id}`; }

function sortDrafts(drafts) {
    return drafts.sort((a, b) => {
        const orderA = STATUS_CONFIG[a.machine_status]?.order || 999;
        const orderB = STATUS_CONFIG[b.machine_status]?.order || 999;
        return orderA !== orderB ? orderA - orderB : a.display_name.localeCompare(b.display_name);
    });
}

function showEmptyState(icon, title, message) {
    const draftsList = document.getElementById('draftsList');
    draftsList.innerHTML = `<div class="empty-state"><div class="icon">${icon}</div><h3>${Utils.escapeHtml(title)}</h3><p>${Utils.escapeHtml(message)}</p><a href="/add-draft" class="action-btn" style="max-width:200px;margin-top:15px;display:inline-flex">+ Станок</a></div>`;
}

function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? dateString : date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return dateString; }
}
