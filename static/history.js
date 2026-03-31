// history.js - управление страницей истории изменений
const API_BASE = '/api';
let currentPage = 1;
let currentDate = '';
let totalPages = 1;

document.addEventListener('DOMContentLoaded', function() {
    loadHistory();
    initFilters();
});

async function loadHistory() {
    showLoading('Загрузка истории...');

    try {
        let url = `${API_BASE}/history?page=${currentPage}&per_page=50`;
        if (currentDate) {
            url += `&date=${currentDate}`;
        }

        const response = await fetch(url);
        const result = await response.json();

        if (result.success) {
            renderHistory(result.history);
            renderPagination(result.pagination);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Ошибка:', error);
        showError('Ошибка загрузки данных');
    } finally {
        hideLoading();
    }
}

function renderHistory(history) {
    const container = document.getElementById('historyList');

    if (!history || history.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">📭</div>
                <h3>Нет записей в истории</h3>
                <p>Изменения черновиков будут отображаться здесь</p>
            </div>
        `;
        return;
    }

    container.innerHTML = history.map(item => {
        const date = new Date(item.created_at);
        const formattedDate = date.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        let changesHtml = '';
        const changedFields = item.changed_fields || {};

        for (const field in changedFields) {
            const changeInfo = changedFields[field];

            if (field === 'Примечания' && changeInfo.type === 'addition') {
                let additionText = '';
                if (changeInfo.добавлено && Array.isArray(changeInfo.добавлено)) {
                    additionText = changeInfo.добавлено.map(n => n.text).join(' ');
                } else if (changeInfo.добавлено) {
                    additionText = changeInfo.добавлено;
                }

                changesHtml += `
                    <div class="change-addition">
                        <div class="change-addition-field">${escapeHtml(field)}</div>
                        <div class="change-addition-text">➕ ${escapeHtml(additionText.trim())}</div>
                    </div>
                `;
            } else {
                changesHtml += `
                    <div class="change-item">
                        <div class="change-field">${escapeHtml(field)}</div>
                        <div class="change-old">${escapeHtml(changeInfo.было || '<пусто>')}</div>
                        <div class="change-new">${escapeHtml(changeInfo.стало || '<пусто>')}</div>
                    </div>
                `;
            }
        }

        return `
            <div class="history-item">
                <div class="history-item-header">
                    <a href="/add-draft?draft=${item.draft_id}&view=true" class="draft-title">
                        ${escapeHtml(item.draft_display_name || 'Неизвестный черновик')}
                    </a>
                    <span class="change-date">${formattedDate}</span>
                </div>
                <div class="changes-list">${changesHtml}</div>
            </div>
        `;
    }).join('');
}

function renderPagination(pagination) {
    const container = document.getElementById('pagination');

    if (!pagination || pagination.total_pages <= 1) {
        container.innerHTML = '';
        return;
    }

    totalPages = pagination.total_pages;
    let buttons = '';

    buttons += `<button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>←</button>`;

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

function changePage(page) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    loadHistory();
}

function initFilters() {
    const applyBtn = document.getElementById('applyFilterBtn');
    const clearBtn = document.getElementById('clearFilterBtn');
    const dateInput = document.getElementById('dateFilter');

    applyBtn.addEventListener('click', () => {
        currentDate = dateInput.value;
        currentPage = 1;
        loadHistory();
    });

    clearBtn.addEventListener('click', () => {
        dateInput.value = '';
        currentDate = '';
        currentPage = 1;
        loadHistory();
    });
}

function showLoading(message) {
    const status = document.getElementById('statusMessage');
    status.innerHTML = `<div class="loading">${message}</div>`;
    status.className = 'status-message info';
    status.style.display = 'block';
}

function hideLoading() {
    const status = document.getElementById('statusMessage');
    status.style.display = 'none';
}

function showError(message) {
    const container = document.getElementById('historyList');
    container.innerHTML = `
        <div class="empty-state">
            <div class="icon">⚠️</div>
            <h3>Ошибка загрузки</h3>
            <p>${escapeHtml(message)}</p>
        </div>
    `;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}