/**
 * Optimized History Page Management
 */
'use strict';

let currentPage = 1, currentDate = '', totalPages = 1;

document.addEventListener('DOMContentLoaded', () => { loadHistory(); initFilters(); });

async function loadHistory() {
    Utils.showLoading('Загрузка истории...');
    try {
        let url = `/api/history?page=${currentPage}&per_page=50`;
        if (currentDate) url += `&date=${currentDate}`;
        
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success) {
            renderHistory(result.history);
            renderPagination(result.pagination);
        } else throw new Error(result.error);
    } catch (error) {
        console.error('Ошибка:', error);
        showError('Ошибка загрузки данных');
    } finally { hideLoading(); }
}

function renderHistory(history) {
    const container = document.getElementById('historyList');
    if (!history || !history.length) {
        container.innerHTML = `<div class="empty-state"><div class="icon">📭</div><h3>Нет записей в истории</h3><p>Изменения черновиков будут отображаться здесь</p></div>`;
        return;
    }

    container.innerHTML = history.map(item => {
        const date = Utils.formatDateTime(item.created_at);
        let changesHtml = '';
        const changedFields = item.changed_fields || {};

        for (const field in changedFields) {
            const info = changedFields[field];
            if (field === 'Примечания' && info.type === 'addition') {
                const text = (info.добавлено && Array.isArray(info.добавлено)) 
                    ? info.добавлено.map(n => n.text).join(' ') 
                    : (info.добавлено || '');
                changesHtml += `<div class="change-addition"><div class="change-addition-field">${Utils.escapeHtml(field)}</div><div class="change-addition-text\">➕ ${Utils.escapeHtml(text.trim())}</div></div>`;
            } else {
                changesHtml += `<div class="change-item"><div class="change-field">${Utils.escapeHtml(field)}</div><div class="change-old">${Utils.escapeHtml(info.было || '<пусто>')}</div><div class="change-new">${Utils.escapeHtml(info.стало || '<пусто>')}</div></div>`;
            }
        }

        return `<div class="history-item"><div class="history-item-header"><a href="/add-draft?draft=${item.draft_id}&view=true" class="draft-title">${Utils.escapeHtml(item.draft_display_name || 'Неизвестный черновик')}</a><span class="change-date">${date}</span></div><div class="changes-list">${changesHtml}</div></div>`;
    }).join('');
}

function renderPagination(pagination) {
    const container = document.getElementById('pagination');
    if (!pagination || pagination.total_pages <= 1) { container.innerHTML = ''; return; }

    totalPages = pagination.total_pages;
    let buttons = `<button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>←</button>`;

    for (let i = 1; i <= pagination.total_pages; i++) {
        if (i === 1 || i === pagination.total_pages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            buttons += `<button onclick="changePage(${i})" ${i === currentPage ? 'class="active"' : ''}>${i}</button>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            buttons += `<button disabled>...</button>`;
        }
    }
    buttons += `<button onclick="changePage(${currentPage + 1})" ${currentPage === pagination.total_pages ? 'disabled' : ''}>→</button>`;
    container.innerHTML = buttons;
}

function changePage(page) { if (page >= 1 && page <= totalPages) { currentPage = page; loadHistory(); } }

function initFilters() {
    document.getElementById('applyFilterBtn')?.addEventListener('click', () => { currentDate = document.getElementById('dateFilter').value; currentPage = 1; loadHistory(); });
    document.getElementById('clearFilterBtn')?.addEventListener('click', () => { document.getElementById('dateFilter').value = ''; currentDate = ''; currentPage = 1; loadHistory(); });
}

function showLoading(message) {
    const status = document.getElementById('statusMessage');
    if (status) { status.innerHTML = `<div class="loading">${Utils.escapeHtml(message)}</div>`; status.className = 'status-message info'; status.style.display = 'block'; }
}

function hideLoading() { const status = document.getElementById('statusMessage'); if (status) status.style.display = 'none'; }

function showError(message) {
    document.getElementById('historyList').innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><h3>Ошибка загрузки</h3><p>${Utils.escapeHtml(message)}</p></div>`;
}
