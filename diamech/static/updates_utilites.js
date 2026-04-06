// updates_utilites.js - управление страницей обновлений и утилит
const API_BASE = '/api';

document.addEventListener('DOMContentLoaded', function() {
    loadUpdates();
    checkMobile();
    window.addEventListener('resize', checkMobile);
});

async function loadUpdates() {
    const container = document.getElementById('updatesContainer');
    const loadingSpinner = document.getElementById('loadingSpinner');

    try {
        loadingSpinner.style.display = 'block';

        const response = await fetch(`${API_BASE}/updates`);
        const result = await response.json();

        loadingSpinner.style.display = 'none';

        if (result.success) {
            renderUpdates(result.updates);
        } else {
            showError('Ошибка загрузки данных: ' + (result.error || 'Неизвестная ошибка'));
        }
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        loadingSpinner.style.display = 'none';
        showError('Не удалось загрузить данные. Проверьте подключение к серверу.');
    }
}

function renderUpdates(data) {
    const container = document.getElementById('updatesContainer');

    const hasSapphire = data.sapphire && data.sapphire.length > 0;
    const hasYashma = data.yashma && data.yashma.length > 0;
    const hasStsh = data.stsh && data.stsh.length > 0;
    const hasExternalUtils = data.external_utils && data.external_utils.length > 0;
    const hasInternalUtils = data.internal_utils && data.internal_utils.length > 0;
    const hasDocs = data.docs && data.docs.length > 0;

    if (!hasSapphire && !hasYashma && !hasStsh && !hasExternalUtils && !hasInternalUtils && !hasDocs) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">📂</div>
                <h3>Нет доступных обновлений</h3>
                <p>В данный момент нет доступных прошивок и утилит</p>
            </div>
        `;
        return;
    }

    let html = `<div class="grid-cols-2"><div>`;

    if (hasSapphire) {
        html += `
            <div class="draft-item overflow-hidden p-0">
                <div class="section-header-blue">
                    <h3 class="section-title section-title-color-blue">
                        <span class="sapphire-icon">📡</span> САПФИР-3
                    </h3>
                </div>
                <div class="section-content-padding">
                    <div class="d-flex flex-column gap-12">
                        ${data.sapphire.map(item => renderUpdateItem(item, 'sapphire')).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    if (hasYashma) {
        html += `
            <div class="draft-item overflow-hidden p-0 mt-20">
                <div class="section-header-purple">
                    <h3 class="section-title section-title-color-purple">
                        <span class="yashma-icon">💎</span> ЯШМА
                    </h3>
                </div>
                <div class="section-content-padding">
                    <div class="d-flex flex-column gap-12">
                        ${data.yashma.map(item => renderUpdateItem(item, 'yashma')).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    if (hasStsh) {
        html += `
            <div class="draft-item overflow-hidden p-0 mt-20">
                <div class="section-header-pink">
                    <h3 class="section-title section-title-color-pink">
                        <span class="stsh-icon">🔧</span> СТШ
                    </h3>
                </div>
                <div class="section-content-padding">
                    <div class="d-flex flex-column gap-12">
                        ${data.stsh.map(item => renderUpdateItem(item, 'stsh')).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    html += `</div><div>`;

    if (hasExternalUtils || hasInternalUtils || hasDocs) {
        html += `
            <div class="draft-item overflow-hidden p-0">
                <div class="section-header-green">
                    <h3 class="section-title section-title-color-green">
                        <span class="utilities-icon">🧰</span> Утилиты
                    </h3>
                </div>
                <div class="section-content-padding">
                    <div class="d-flex flex-column gap-20">
        `;

        if (hasExternalUtils) {
            html += `
                <div>
                    <h4 class="subsection-title"><span class="external-icon">🔌</span> Стороннее ПО для настройки</h4>
                    <div class="d-flex flex-column gap-8">
                        ${data.external_utils.map(item => renderUtilItem(item)).join('')}
                    </div>
                </div>
            `;
        }

        if (hasInternalUtils) {
            html += `
                <div>
                    <h4 class="subsection-title"><span class="internal-icon">⚡</span> Внутренние утилиты</h4>
                    <div class="d-flex flex-column gap-8">
                        ${data.internal_utils.map(item => renderUtilItem(item)).join('')}
                    </div>
                </div>
            `;
        }

        if (hasDocs) {
            html += `
                <div>
                    <h4 class="subsection-title"><span class="docs-icon">📚</span> Документация</h4>
                    <div class="d-flex flex-column gap-8">
                        ${data.docs.map(item => renderUtilItem(item)).join('')}
                    </div>
                </div>
            `;
        }

        html += `</div></div></div>`;
    }

    html += `</div></div>`;
    container.innerHTML = html;
}

function renderUpdateItem(item, iconType) {
    const iconMap = { sapphire: '📡', yashma: '💎', stsh: '🔧' };
    const icon = iconMap[iconType] || '⚙️';
    const dateHtml = item.date ? `<span class="text-secondary font-size-14">${escapeHtml(item.date)}</span>` : '';
    const descHtml = item.description ? `<span class="text-secondary font-size-14">${escapeHtml(item.description)}</span>` : '';

    return `
        <a href="${escapeHtml(item.file)}" class="action-btn action-btn-start" target="_blank">
            <span class="icon-large ${iconType}-icon">${icon}</span>
            <div class="d-flex flex-column flex-1">
                <span class="font-weight-600">${escapeHtml(item.title)}</span>
                ${dateHtml}
                ${descHtml}
            </div>
            <span class="download-badge">${escapeHtml(item.badge || 'ZIP')}</span>
        </a>
    `;
}

function renderUtilItem(item) {
    let icon = '📄';
    const title = item.title || '';

    if (title.includes('MR Configurator2')) icon = '📊';
    else if (title.includes('ESView-V4')) icon = '📈';
    else if (title.includes('SV_Tool')) icon = '🛠️';
    else if (title.includes('Diamech')) icon = '⚙️';
    else if (title.includes('Парсер')) icon = '📋';
    else if (title.includes('API')) icon = '📕';
    else if (title.includes('Protocol')) icon = '📗';
    else if (title.includes('Developer')) icon = '📘';

    const descHtml = item.description ? `<span class="text-secondary font-size-14">${escapeHtml(item.description)}</span>` : '';

    return `
        <a href="${escapeHtml(item.file)}" class="action-btn action-btn-start" target="_blank">
            <span class="mr-10 opacity-8">${icon}</span>
            <div class="d-flex flex-column flex-1">
                <span class="font-weight-600">${escapeHtml(title)}</span>
                ${descHtml}
            </div>
            <span class="download-badge">${escapeHtml(item.badge || 'ZIP')}</span>
        </a>
    `;
}

function showError(message) {
    const container = document.getElementById('updatesContainer');
    container.innerHTML = `
        <div class="error-message-block">
            <div class="icon">⚠️</div>
            <h3>Ошибка загрузки</h3>
            <p>${escapeHtml(message)}</p>
            <button class="retry-btn" onclick="location.reload()">Повторить</button>
        </div>
    `;
}

function checkMobile() {
    const hint = document.querySelector('.mobile-hint');
    if (hint) {
        hint.style.display = window.innerWidth <= 768 ? 'block' : 'none';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}