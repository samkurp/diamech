// admin_updates.js - управление админ-панелью обновлений
const API_BASE = '/api';
let currentData = null;
let currentTab = 'sapphire';
let editingId = null;

document.addEventListener('DOMContentLoaded', function() {
    loadData();
    initTabs();
    initModal();
});

async function loadData() {
    try {
        const response = await fetch(`${API_BASE}/updates`);
        const result = await response.json();

        if (result.success) {
            currentData = result.updates;
            updateSectionInfo();
            renderItems();
        } else {
            showError('Ошибка загрузки данных');
        }
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        showError('Ошибка соединения с сервером');
    }
}

function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentTab = this.dataset.tab;
            renderItems();
            updateSectionInfo();
        });
    });
}

function updateSectionInfo() {
    const titles = {
        sapphire: 'САПФИР-3',
        yashma: 'ЯШМА',
        stsh: 'СТШ',
        external_utils: 'Стороннее ПО',
        internal_utils: 'Внутренние утилиты',
        docs: 'Документация'
    };

    const count = currentData?.[currentTab]?.length || 0;
    const sectionInfo = document.querySelector('.section-info');

    sectionInfo.innerHTML = `
        <span><strong>${titles[currentTab]}</strong> — ${count} записей</span>
        ${count > 0 ? `<span class="item-badge">${count}</span>` : ''}
    `;
}

function renderItems() {
    const container = document.getElementById('itemsContainer');
    const items = currentData?.[currentTab] || [];

    if (items.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">📂</div>
                <h3>В этом разделе пока ничего нет</h3>
                <p>Нажмите "Добавить" чтобы создать запись</p>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(item => `
        <div class="item-card">
            <div class="item-header">
                <span class="item-title">${escapeHtml(item.title)}</span>
                <span class="item-badge">${escapeHtml(item.badge || 'ZIP')}</span>
            </div>
            ${item.description ? `<div class="item-description">${escapeHtml(item.description)}</div>` : ''}
            ${item.date ? `<div class="item-date">📅 ${escapeHtml(item.date)}</div>` : ''}
            <div class="item-file">📁 ${escapeHtml(item.file)}</div>
            <div class="item-actions">
                <button class="edit-btn" onclick="editItem(${item.id})">✏️ Ред.</button>
                <button class="delete-btn" onclick="deleteItem(${item.id})">🗑️ Уд.</button>
            </div>
        </div>
    `).join('');
}

function initModal() {
    const openBtn = document.getElementById('openAddModalBtn');
    const saveBtn = document.getElementById('saveItemBtn');
    const cancelBtn = document.getElementById('cancelModalBtn');
    const modal = document.getElementById('itemModal');
    const closeBtn = document.querySelector('#itemModal .close');

    openBtn.addEventListener('click', () => openAddModal());
    saveBtn.addEventListener('click', () => saveItem());
    cancelBtn.addEventListener('click', () => closeModal());

    if (closeBtn) closeBtn.addEventListener('click', () => closeModal());

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

function openAddModal() {
    editingId = null;
    document.getElementById('modalTitle').textContent = 'Добавить элемент';
    document.getElementById('itemSection').value = currentTab;
    document.getElementById('itemTitle').value = '';
    document.getElementById('itemDescription').value = '';
    document.getElementById('itemDate').value = '';
    document.getElementById('itemFile').value = '';
    document.getElementById('itemBadge').value = 'ZIP';
    document.getElementById('itemModal').style.display = 'flex';
}

function editItem(id) {
    const item = currentData[currentTab].find(i => i.id === id);
    if (!item) return;

    editingId = id;
    document.getElementById('modalTitle').textContent = 'Редактировать элемент';
    document.getElementById('itemSection').value = currentTab;
    document.getElementById('itemTitle').value = item.title || '';
    document.getElementById('itemDescription').value = item.description || '';
    document.getElementById('itemDate').value = item.date || '';
    document.getElementById('itemFile').value = item.file || '';
    document.getElementById('itemBadge').value = item.badge || 'ZIP';
    document.getElementById('itemModal').style.display = 'flex';
}

async function saveItem() {
    const section = document.getElementById('itemSection').value;
    const title = document.getElementById('itemTitle').value.trim();
    const description = document.getElementById('itemDescription').value.trim();
    const date = document.getElementById('itemDate').value.trim();
    const file = document.getElementById('itemFile').value.trim();
    const badge = document.getElementById('itemBadge').value.trim() || 'ZIP';

    if (!title || !file) {
        alert('Заполните название и путь к файлу');
        return;
    }

    const data = { section, title, description, date, file, badge };

    try {
        let response;
        if (editingId) {
            response = await fetch(`${API_BASE}/updates/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            response = await fetch(`${API_BASE}/updates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }

        const result = await response.json();

        if (result.success) {
            await loadData();
            closeModal();
        } else {
            alert('Ошибка: ' + (result.error || 'Неизвестная ошибка'));
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка соединения с сервером');
    }
}

async function deleteItem(id) {
    if (!confirm('Удалить этот элемент?')) return;

    try {
        const response = await fetch(`${API_BASE}/updates/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            await loadData();
        } else {
            alert('Ошибка: ' + (result.error || 'Неизвестная ошибка'));
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка соединения с сервером');
    }
}

function closeModal() {
    document.getElementById('itemModal').style.display = 'none';
}

function showError(message) {
    const container = document.getElementById('itemsContainer');
    container.innerHTML = `
        <div class="empty-state">
            <div class="icon">⚠️</div>
            <h3>Ошибка загрузки</h3>
            <p>${escapeHtml(message)}</p>
            <button class="retry-btn" onclick="location.reload()">Повторить</button>
        </div>
    `;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}